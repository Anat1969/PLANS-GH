#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   tools/status-check.mjs: בדיקת הסטטוס הסטטוטורי מול מינהל התכנון (ענת, 26.11.2026: "בהתאם להמלצה").
   הרקע: 603-0811588 ו-603-0828491 הופיעו "בתכנון" במסד שנים אחרי שאושרו. מעכשיו זה נבדק לבד.
   - קורא את התב"עות של "מה נבנה סביבי" (plan_projects) ואת התב"עות של תוכניות הבינוי (ashdod_plans, השדה change).
   - שואל את Xplan (ags.iplan.gov.il, שכבה 1, קווים כחולים) בבקשה אחת. מאושרת = station_desc "אישור".
   - מחזיר פערים: תב"ע שהמסד אומר "בתכנון" ו-Xplan אומר "אושרה", או להפך. תב"ע ישנה שאינה ב-Xplan נרשמת כ"לא ב-Xplan".
   - קריאה בלבד. לא מתקן את המסד: הפער מוצג לענת ב"איפה אנחנו עומדים?", והתיקון באישורה (כללי האמינות).
   שימוש: מתוך tools/ops-engine.mjs (השדה statusCheck ב-ops_server), או לבד:
     node tools/status-check.mjs [--out data/urban-standard/status-check.json]
   ══════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import { pathToFileURL } from 'url';

const XPLAN = 'https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/Xplan/MapServer/1/query';
const SB_URL = process.env.SB_URL || 'https://cbhexpybdggwzyakgagd.supabase.co';
const SB_KEY = process.env.SB_KEY || 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3';
const APPROVED = new Set(['approved', 'permit', 'construction', 'completed']);
// מספר התב"ע כפי שהוא ב-Xplan: 603-0811588. "תמל 2022" ו"תמל/2022" הם מספרים אחרים ב-Xplan, ולכן נבדקים רק מספרים חדשים (603-...)
const FIX = { '603-3117784':'603-0317784' };   // שגיאת הקלדה בתיק 1739 (ספרה 1 מיותרת), כמו TABA_FIX ב-building-twin.py
const norm0 = s => { const m = String(s || '').match(/\b(\d{3})-0?(\d{6,7})\b/); return m ? `${m[1]}-${m[2].slice(-7).padStart(7, '0')}` : null; };
const norm = s => { const k = norm0(s); return k && FIX[k] || k; };

export async function statusCheck({ fetchImpl = fetch, timeoutMs = 30000 } = {}){
  const at = new Date().toISOString();
  const H = { apikey:SB_KEY, Authorization:'Bearer ' + SB_KEY };
  const get = async u => { const r = await fetchImpl(SB_URL + u, { headers:H }); if(!r.ok) throw new Error('Supabase ' + r.status); return r.json(); };
  const projects = await get('/rest/v1/plan_projects?select=plan_number,title,status');
  const bplans = await get('/rest/v1/ashdod_plans?select=data->planNum,data->change,data->deleted,data->status').catch(() => []);
  const want = new Map();   // תב"ע -> { db, title, uses }
  projects.forEach(p => { const k = norm(p.plan_number); if(k) want.set(k, { plan:p.plan_number, title:p.title, db:APPROVED.has(p.status) ? 'approved' : 'planning', dbRaw:p.status, uses:[] }); });
  bplans.filter(b => !b.deleted).forEach(b => { const k = norm(b.change); if(!k) return; const w = want.get(k) || { plan:k, title:'', db:null, uses:[] }; w.uses.push(b.planNum); if(/הושלם/.test(String(b.status || ''))) (w.usesApproved = w.usesApproved || []).push(b.planNum); want.set(k, w); });
  const keys = [...want.keys()];
  // בקבוצות של 8, עם 3 ניסיונות לכל קבוצה: Xplan מחזיר לפעמים 503 לבקשה ארוכה או בעומס
  const feats = [];
  const ask = async part => {
    let last;
    for(let i = 0; i < 3; i++){
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
      try{
        const q = new URLSearchParams({ where:`pl_number in (${part.map(k => `'${k}'`).join(',')})`, outFields:'pl_number,internet_short_status,station_desc,pl_date_8', returnGeometry:'false', f:'json' });
        const r = await fetchImpl(XPLAN + '?' + q, { signal:ctl.signal });
        if(!r.ok) throw new Error('Xplan ' + r.status);
        const j = await r.json(); if(j.error) throw new Error('Xplan ' + (j.error.message || 'error'));
        return j.features || [];
      }catch(e){ last = e; await new Promise(res => setTimeout(res, 1500 * (i + 1))); }
      finally{ clearTimeout(timer); }
    }
    throw last;
  };
  for(let i = 0; i < keys.length; i += 8) feats.push(...await ask(keys.slice(i, i + 8)));
  const X = {}; feats.forEach(f => { const a = f.attributes; X[a.pl_number] = a; });
  const rows = keys.map(k => { const w = want.get(k), x = X[k];
    if(!x) return { ...w, plan:k, xplan:null, note:'לא נמצאה ב-Xplan' };
    const xs = x.station_desc === 'אישור' ? 'approved' : 'planning';
    const date = x.pl_date_8 ? new Date(x.pl_date_8).toISOString().slice(0, 10) : '';
    return { ...w, plan:k, xplan:xs, xplanText:`${x.station_desc || ''}${x.internet_short_status ? ', ' + x.internet_short_status : ''}`, date,
      mismatch: !!(w.db && w.db !== xs),
      // תוכנית בינוי על תב"ע שעוד לא אושרה: לא שגיאה במסד, אבל שווה בדיקה (תוכנית הבינוי מסומנת אושרה בתיק)
      notApprovedBase: !w.db && xs !== 'approved' && (w.usesApproved || []).length > 0 };
  });
  const mismatches = rows.filter(r => r.mismatch), notes = rows.filter(r => r.notApprovedBase);
  return { at, checked:rows.length, found:feats.length, mismatches, notes, rows };
}

// הרצה לבד
if(import.meta.url === pathToFileURL(process.argv[1] || '').href){
  const i = process.argv.indexOf('--out'), out = i > 0 ? process.argv[i + 1] : null;
  statusCheck().then(r => {
    console.log(`נבדקו ${r.checked} תב"עות, ${r.found} נמצאו ב-Xplan, ${r.mismatches.length} פערים, ${r.notes.length} תוכניות בינוי על תב"ע שלא אושרה`);
    r.rows.forEach(x => console.log(`  ${x.mismatch ? '✗' : ' '} ${x.plan} ${x.title || ''} | מסד: ${x.dbRaw || x.db || '—'} | Xplan: ${x.xplanText || x.note}${x.date ? ' (' + x.date + ')' : ''}${x.uses.length ? ' | תוכניות בינוי: ' + x.uses.join(', ') : ''}`));
    if(out) fs.writeFileSync(out, JSON.stringify(r, null, 1));
  }).catch(e => { console.error('כשל:', e.message); process.exit(1); });
}
