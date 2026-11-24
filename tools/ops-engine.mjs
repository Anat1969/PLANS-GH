#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   tools/ops-engine.mjs: המערכת ברקע (ענת, 24.11.2026).
   רץ ב-GitHub Actions (.github/workflows/ops-engine.yml), גם כשהאפליקציה סגורה.
   קורא את התוכניות ואנשי הקשר מ-ASHDODMAP, מריץ את אותו מנוע של הדף (plans-ops-core.js),
   ושומר תמונת מצב, היסטוריית הרצות ויומן זיהוי (ledger) בשורה אחת: ashdod_muni / ops_server.
   - לא כותב לתוכניות, ולא לשום שורה אחרת. כך אין התנגשות עם השמירה של הדפדפן.
   - כפילות: הרצה שנייה בתוך 20 דקות מהצלחה קודמת מדולגת (אלא אם --force).
   - כשל: 3 ניסיונות לכל קריאה, ואז רישום הכשל בהיסטוריה ויציאה עם שגיאה (ה-Action נכשל ו-GitHub מתריע).
   - אימות: אחרי הכתיבה קוראים את השורה בחזרה ובודקים שחותמת ההרצה נשמרה.
   הרצה: node tools/ops-engine.mjs [--force] [--dry] [--today 2026-11-24] [--from <snapshot.json>]
   ══════════════════════════════════════════════════════════════════ */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const O = require(path.join(root, 'plans-ops-core.js'));

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? (process.argv[i+1] || true) : null; };
const FORCE = !!arg('--force'), DRY = !!arg('--dry'), FROM = arg('--from'), TODAY = arg('--today');
// המפתח הציבורי של האפליקציה (אותו מפתח שב-index.html). ההרשאות נאכפות ב-RLS של שלב א.
const SB_URL = process.env.SB_URL || 'https://cbhexpybdggwzyakgagd.supabase.co';
const SB_KEY = process.env.SB_KEY || 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3';
const HDR = { apikey:SB_KEY, Authorization:'Bearer ' + SB_KEY, 'Content-Type':'application/json' };
const RUN_GAP_MIN = 20, KEEP_RUNS = 60, LEDGER_DAYS = 45;
let attempts = 1;

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function req(url, opts, tries = 3){
  let last;
  for(let i = 0; i < tries; i++){
    try{ const r = await fetch(url, opts); if(!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160)); return r; }
    catch(e){ last = e; if(i < tries - 1){ attempts++; await sleep(1500 * (i + 1)); } }
  }
  throw last;
}
const getJSON = async u => (await req(SB_URL + u, { headers:HDR })).json();
async function muni(id){ const j = await getJSON('/rest/v1/ashdod_muni?select=data,updated_at&id=eq.' + id); return j[0] ? j[0].data : null; }
async function writeServer(data){
  await req(SB_URL + '/rest/v1/ashdod_muni?on_conflict=id', { method:'POST', headers:Object.assign({}, HDR, { Prefer:'resolution=merge-duplicates,return=minimal' }),
    body:JSON.stringify([{ id:'ops_server', data, updated_at:new Date().toISOString() }]) });
}

function goalFor(p){
  try{ const j = JSON.parse(fs.readFileSync(path.join(root, 'data/taba', String(p.tik) + '.json'), 'utf8'));
    return j.purpose && j.purpose.text ? { text:j.purpose.text, src:`מטרת ${j.taba || 'התב"ע'}${j.purpose.page ? ", עמ' " + j.purpose.page : ''} בהוראות` } : null; }catch(e){ return null; }
}

function weeklyText(r, plans){
  const L = [], act = plans.filter(O.isActive);
  L.push(`סיכום שבועי, תוכניות בינוי, ${O.fmt(r.today)}`);
  L.push('');
  L.push(`בטיפול: ${act.length} תוכניות. ${r.tiers.decide.length} החלטות פתוחות, ${r.tiers.approve.length} תוצרים מוכנים לאישור, ${r.tiers.waiting.length} ממתינים לגורמים אחרים.`);
  const done = r.tiers.done.filter(d => O.days(d.at, r.today) <= 7);
  L.push(done.length ? `השבוע נרשמו ${done.length} פעולות.` : 'השבוע לא נרשמה פעולה באף תוכנית.');
  if(r.tiers.decide.length){ L.push(''); L.push('מה תקוע:'); r.tiers.decide.slice(0, 6).forEach(i => L.push(`- ${i.plan ? i.plan + ': ' : ''}${i.title}`)); }
  const up = r.items.filter(i => i.kind === 'prep' || i.kind === 'upcoming');
  L.push(''); L.push(up.length ? 'בשבועיים הקרובים:' : 'אין פגישה בשבועיים הקרובים.'); up.forEach(i => L.push(`- ${i.plan}: ${i.title}`));
  return L.join('\n');
}

async function main(){
  const t0 = Date.now(), now = new Date().toISOString();
  let prev = null, plans, contacts = [], user = {};
  if(FROM){
    plans = JSON.parse(fs.readFileSync(FROM, 'utf8')).map((r, i) => Object.assign({ id:i }, r.d || r.data || r));
  } else {
    prev = await muni('ops_server').catch(() => null);
    const last = prev && prev.lastRun;
    if(!FORCE && last && last.status === 'ok' && (Date.parse(now) - Date.parse(last.at)) / 60000 < RUN_GAP_MIN){
      console.log(`דילוג: הרצה מוצלחת לפני פחות מ-${RUN_GAP_MIN} דקות (${last.at})`); return;
    }
    const rows = await getJSON('/rest/v1/ashdod_plans?select=plan_key,data,updated_at');
    plans = rows.map((r, i) => Object.assign({ id:i }, r.data || {}));
    const c = await muni('contacts').catch(() => null); contacts = (c && Array.isArray(c.contacts)) ? c.contacts : [];
    user = (await muni('ops_user').catch(() => null)) || {};
  }
  prev = prev || {};
  const contactsFor = p => contacts.filter(c => !c._deleted && (c.plans || []).map(String).includes(String(p.tik))).map(c => ({ name:c.name, email:c.email, phone:c.phone, type:c.type, org:c.org }));
  const today = TODAY || O.todayIL();
  const ledger = Object.assign({}, prev.ledger || {});
  const r = O.compute(plans, { today, user, contactsFor, goalFor, ledger, lastVisit:user.lastVisit });

  // יומן הזיהוי: מתי כל פריט זוהה לראשונה, ומתי נסגר. בלי כפילות: מפתח יציב.
  const seen = new Set(r.items.map(i => i.key)); let fresh = 0, resolved = 0;
  r.items.forEach(i => { if(!ledger[i.key]){ ledger[i.key] = { first:now, tik:i.tik || '', kind:i.kind, title:i.title }; fresh++; } ledger[i.key].last = now; ledger[i.key].tier = i.tier; delete ledger[i.key].resolved; });
  Object.entries(ledger).forEach(([k, v]) => {
    if(!seen.has(k) && !v.resolved){ v.resolved = now; resolved++; }
    if(v.resolved && O.days(v.resolved, today) > LEDGER_DAYS) delete ledger[k];
  });

  const compact = i => ({ key:i.key, tier:i.tier, level:i.level, kind:i.kind, tik:i.tik || '', plan:i.plan || '', title:i.title, why:i.why, due:i.due || '', score:i.score, rec:i.rec || '' });
  const prep = r.items.filter(i => i.kind === 'prep').map(i => { const p = plans.find(x => String(x.tik) === String(i.tik)); return p ? O.meetingPrep(p, i.meetKey, r.items, { today, contactsFor, goalFor }) : null; }).filter(Boolean);
  const dow = new Date(today + 'T00:00:00Z').getUTCDay();
  const weekly = (dow === 0 || !prev.weekly || O.days(prev.weekly.at, today) >= 7) ? { at:today, text:weeklyText(r, plans) } : prev.weekly;
  const run = { at:now, status:'ok', ms:Date.now() - t0, plans:plans.length, active:r.counts.active, items:r.items.length, newItems:fresh, resolved, attempts, by: process.env.GITHUB_RUN_ID ? 'github:' + process.env.GITHUB_RUN_ID : 'ידני' };
  const data = { version:1, lastRun:run, runs:[...(prev.runs || []), run].slice(-KEEP_RUNS), counts:r.counts, morning:r.morning,
    digest:r.items.map(compact), prep, weekly, ledger, automations:O.AUTOMATIONS.map(a => ({ id:a.id, paused:!!(user.paused || {})[a.id], blocked:a.blocked || '' })) };

  console.log(`תוכניות: ${plans.length}, בטיפול: ${r.counts.active}, פריטים: ${r.items.length} (חדשים ${fresh}, נסגרו ${resolved})`);
  O.TIERS.forEach(([k, n]) => console.log(`  ${n}: ${(r.tiers[k] || []).length}`));
  r.items.slice(0, 8).forEach(i => console.log(`  [${i.score}] ${i.tik || ''} ${i.title}`));
  if(DRY || FROM){ console.log('בלי כתיבה (--dry / --from)'); if(arg('--out')) fs.writeFileSync(arg('--out'), JSON.stringify(data, null, 1)); return; }

  await writeServer(data);
  const back = await muni('ops_server');
  if(!back || !back.lastRun || back.lastRun.at !== now) throw new Error('אימות נכשל: השורה ops_server לא מחזיקה את ההרצה הזו');
  console.log('נשמר ואומת: ashdod_muni/ops_server, ' + now);
}

main().catch(async e => {
  console.error('כשל:', e.message);
  if(!DRY && !FROM){
    try{ const prev = (await muni('ops_server')) || {}; const run = { at:new Date().toISOString(), status:'fail', error:String(e.message).slice(0, 300), attempts };
      await writeServer(Object.assign(prev, { lastRun:run, runs:[...(prev.runs || []), run].slice(-KEEP_RUNS) })); }
    catch(e2){ console.error('גם רישום הכשל נכשל:', e2.message); }
  }
  process.exit(1);
});
