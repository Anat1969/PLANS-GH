/* ══════════════════════════════════════════════════════════════════
   plans-opinion.js: כרטיס התוכנית בפורמט של חוות הדעת לוועדה (ענת, 23.11.2026).
   - 14 הסעיפים של חוות הדעת נשארים כמו שהם. כל סעיף מקופל לשורה אחת, עם מספר ועם "חסרים", ונפתח בלחיצה.
   - מילוי ממקורות אחרים, רק בשדה ריק ועם מקור: זכויות ומגרשים מטבלה 5 של התב"ע (דרך "מה נבנה סביבי"), ויזם ואדריכל מאנשי הקשר.
   - טופס לאדריכל: קובץ HTML עצמאי עם כל השדות. האדריכל ממלא, שומר קובץ נתונים, וענת קולטת אותו בחזרה.
   - טבלת התוכניות: כברירת מחדל רק תוכניות בטיפול, לפי המועד הקרוב.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say = m => { try{ toast(m); }catch(e){} };
const GROUPS = { 'op-grp-id':'זיהוי', 'op-grp-info':'המבוקש והמותר', 'op-grp-check':'בדיקת ההתאמה', 'op-grp-concl':'תנאים', 'op-grp-rec':'המלצה',
  'g-a':'א. הבקשה ובעלי העניין', 'g-b':'ב. הנכס', 'g-c':'ג. מיקום', 'g-d':'ד. התאמה לתב"ע: טבלה 5', 'g-e':'ה. התאמה לבדיקה האדריכלית', 'g-f':'ו. מסקנות' };
const today = () => { const d = new Date(), z = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; };

/* ── 1. סעיפים מקופלים ── */
let secN = 0, lastGrp = null;
function section(title, cls, body){
  const b = String(body), miss = (b.match(/<\/b>\s*—\s*(מ״ר)?\s*<\/div>|<td>—<\/td>/g) || []).length;
  const empty = !b.replace(/<[^>]+>/g, '').trim() || /<tbody>\s*<\/tbody>/.test(b);
  const head = cls !== lastGrp && GROUPS[cls] ? `<div class="op-grp-h">${GROUPS[cls]}</div>` : ''; lastGrp = cls; secN++;
  const open = ['op-grp-rec', 'op-grp-id', 'g-a', 'g-f'].includes(cls);
  return head + `<details class="op-sec op-fold ${cls||''}" ${open?'open':''}><summary><i>${secN}</i><span>${title}</span>${miss ? `<b class="op-miss">${miss === 1 ? 'חסר אחד' : miss + ' חסרים'}</b>` : empty ? '<b class="op-na">ריק</b>' : ''}</summary><div class="op-sec-b">${body}</div></details>`;
}

/* ── 2. מילוי ממקורות אחרים: רק שדה ריק ── */
const rnCache = {};
async function renewalOf(p){
  const set = window.LAYER_SETS && window.LAYER_SETS[String(p.tik)]; if(!set || !set.renewal) return null;
  if(!(p.tik in rnCache)) rnCache[p.tik] = await fetch(set.dir + '/renewal.json').then(r => r.json()).catch(() => null);
  return rnCache[p.tik];
}
function autofill(p, rn){
  let n = 0; const N = v => Number(v).toLocaleString('he-IL');
  if(rn){
    const src = `${rn.plan}, הוראות התוכנית, טבלה 5, עמ' 17`;
    if(!Array.isArray(p.plots) || !p.plots.some(x => x && (x.num || x.use))){
      p.plots = rn.lots.map(l => ({ num:String(l.lot), use:l.title, area:l.lotSize ? N(l.lotSize) : '', units:l.units ? String(l.units) : '', floorsAbove:String(l.floors||''), height:l.height ? String(l.height) : '', coverage:l.coverage ? l.coverage+'%' : '', source:src }));
      n += p.plots.length; }
    p.meta = p.meta || {};
    if(!p.meta.zoningPlan){ p.meta.zoningPlan = rn.plan; n++; }
    if(!p.meta.designation){ p.meta.designation = [...new Set(rn.lots.map(l => l.title))].join('; '); n++; }
    try{ if(typeof ensureTable5 === 'function') ensureTable5(p); }catch(e){}
    p.table5 = p.table5 || {}; const L = rn.lots, max = f => String(Math.max(...L.map(l => l[f] || 0)));
    [['units', String(rn.summary.units)], ['mainArea', String(L.reduce((s, l) => s + (l.main||0), 0))], ['floors', max('floors')], ['height', max('height')], ['coverage', max('coverage')], ['designation', [...new Set(L.map(l => l.title))].join('; ')]]
      .forEach(([k, v]) => { const t = p.table5[k] = p.table5[k] || {}; if(!String(t.allowed||'').trim() && v && v !== '0'){ t.allowed = v; t.source = t.source || src; n++; } });
  }
  try{ const tik = String(p.tik), of = re => (contacts || []).find(c => re.test(String(c.type||'')) && (c.plans||[]).map(String).includes(tik));
    const dev = of(/יזם/), arch = of(/אדריכל/);
    if(!p.developer && dev){ p.developer = dev.org || dev.name; n++; }
    if(!p.submitter && arch){ p.submitter = arch.name; n++; } }catch(e){}
  return n;
}

/* ── 3. טופס לאדריכל ── */
/* ── טבלה 5 לפי מגרש ושימוש (ענת, 24.11.2026): data/table5/<תיק>.json, מ-tools/table5.py. המותר מודפס, המבוקש ממולא ── */
const T5C = {};
async function loadT5(tik){
  if(T5C[tik] !== undefined) return T5C[tik];
  try{ const r = await fetch(`data/table5/${tik}.json?v=1124a`); T5C[tik] = r.ok ? await r.json() : null; }catch(e){ T5C[tik] = null; }
  return T5C[tik];
}
/* ── דרישות מהוראות התב"ע (data/taba/<תיק>.json): מטרה, בעלי עניין ודרישות לתוכנית הבינוי ולהיתר, כל אחת עם ציטוט, סעיף ועמוד ── */
const TABA_C = {};
async function loadTaba(tik){
  if(TABA_C[tik] !== undefined) return TABA_C[tik];
  try{ const r = await fetch(`data/taba/${tik}.json?v=1124h`); TABA_C[tik] = r.ok ? await r.json() : null; }catch(e){ TABA_C[tik] = null; }
  return TABA_C[tik];
}
const T5_LOTKEYS = ['lotSize', 'units', 'height', 'floorsAbove', 'floorsBelow', 'coverage', 'balcony', 'front', 'back', 'sideL', 'sideR'];
const t5num = v => typeof v === 'number' ? v.toLocaleString('he-IL') : String(v == null ? '' : v);
/** המותר בתא, כטקסט: ערך ויחידה, והפניה להערה עם הנוסח שלה */
function t5allowed(t5, r, k, withText){
  const col = (t5.columns || []).find(c => c.key === k) || {}, v = r[k], ns = (r.notes || {})[k] || [];
  const nt = ns.map(n => withText && t5.notes && t5.notes[n] ? `הערה ${n}: ${t5.notes[n]}` : `הערה ${n}`).join('; ');
  if(v === undefined || v === null){ if(withText || !ns.length) return nt; const w = ns.map(n => (t5.notes || {})[n]).filter(Boolean).join('; '); return w ? (w.length > 46 ? w.slice(0, 44) + '…' : w) : nt; }
  return `${t5num(v)}${col.unit ? ' ' + col.unit : ''}${nt ? ` (${nt})` : ''}`;
}
const t5rowLabel = r => r.total_row ? 'סה"כ לתא שטח' : [r.use, r.building].filter(Boolean).join(' · ');
const t5id = r => `${r.lot}|${r.total_row ? 'סה"כ' : r.use || ''}|${r.building || ''}`;
function t5lots(t5){ const m = new Map(); (t5.rows || []).forEach((r, i) => { if(!m.has(r.lot)) m.set(r.lot, []); m.get(r.lot).push([r, i]); }); return [...m.entries()].sort((a, b) => +a[0] - +b[0]); }
/** הסעיף בטופס: בלוק לכל מגרש, שורה לכל שימוש, ובכל שורה רק השדות שיש להם ערך מותר בתוכנית */
function t5FormHTML(t5){
  const keys = (t5.columns || []).map(c => c.key), lab = k => ((t5.columns || []).find(c => c.key === k) || {}).label || k;
  return t5lots(t5).map(([lot, rs]) => {
    const head = rs.find(([r]) => !r.total_row) || rs[0], size = rs.map(([r]) => r.lotSize).find(v => v != null);
    const seen = new Set();                                  // שדה של המגרש (קווי בניין, קומות, גובה): פעם אחת במגרש, בשורה הראשונה שבה הוא מופיע
    const rows = rs.map(([r, i]) => { const ks = keys.filter(k => (r[k] != null || (r.notes || {})[k]) && !(T5_LOTKEYS.includes(k) && seen.has(k + ':' + t5allowed(t5, r, k, true))));
      ks.forEach(k => { if(T5_LOTKEYS.includes(k)) seen.add(k + ':' + t5allowed(t5, r, k, true)); });
      if(!ks.length) return '';
      return `<div class="t5row${r.total_row ? ' tot' : ''}"><div class="t5use">${H(t5rowLabel(r))}</div><div class="t5f">${ks.map(k => `<label><span>${H(lab(k))}</span><b title="${H(t5allowed(t5, r, k, true))}">${H(t5allowed(t5, r, k, false)) || '—'}</b><input data-k="t5r.${i}.${k}" class="miss" placeholder="מבוקש" inputmode="decimal"></label>`).join('')}</div></div>`; }).join('');
    return `<section class="t5lot"><h3>מגרש ${H(lot)} <small>${H(head[0].zone || '')}${size != null ? ' · ' + t5num(size) + ' מ"ר' : ''}</small></h3>${rows}
      <label class="t5note">הסבר לפער במגרש ${H(lot)}<input data-k="t5l.${H(lot)}.note" placeholder="רק אם יש פער"></label></section>`; }).join('');
}

function formHTML(p, t5data){
  try{ ensureTable5(p); }catch(e){}
  const miss = v => String(v||'').trim() ? '' : ' class="miss"';
  const inp = (k, v, ph) => `<input data-k="${k}" value="${H(v||'')}" placeholder="${H(ph||'')}"${miss(v)}>`;
  const idRows = [['projectName', 'שם הפרויקט'], ['developer', 'יזם'], ['submitter', 'אדריכל'], ['parcel', 'גוש וחלקה'], ['location', 'מגרש ומיקום']];
  const af = p.archForm || {}, ct = af.contacts || {};
  const t5 = TABLE5_FIELDS.map(f => { const r = p.table5[f.key] || {};
    return `<tr><td>${H(f.label)}</td><td class="ro">${H(r.allowed || 'לא הוזן')}</td><td>${inp('t5.'+f.key+'.proposed', r.proposed)}</td><td><input data-k="t5.${f.key}.note" value="${H(r.note||'')}" placeholder="רק אם יש פער"></td></tr>`; }).join('');
  const lots = (p.plots || []).filter(x => x && x.num).map((x, i) => { const pr = x.proposed || {};
    return `<tr><td><b>${H(x.num)}</b><br><small>${H(x.use||'')}</small></td><td class="ro">${H([x.units && x.units+' יח"ד', x.floorsAbove && x.floorsAbove+' קומות', x.height && x.height+" מ'"].filter(Boolean).join(' · ') || 'לא הוזן')}</td>
      <td>${inp(`lot.${i}.units`, pr.units)}</td><td>${inp(`lot.${i}.floors`, pr.floors)}</td><td>${inp(`lot.${i}.height`, pr.height)}</td><td>${inp(`lot.${i}.main`, pr.main)}</td><td>${inp(`lot.${i}.parking`, pr.parking)}</td></tr>`; }).join('');
  const T5 = t5data && t5data.rows && t5data.rows.length ? t5data : null;
  const meta = { t5: T5 ? { taba:T5.taba, source:T5.source, pages:T5.pages, notes:T5.notes, columns:T5.columns, rows:T5.rows } : null, app:'ashdod-plans-form', v:1, tik:String(p.tik), planNum:p.planNum||'', sentAt:today(), lots:(p.plots||[]).filter(x => x && x.num).map(x => String(x.num)) };
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>טופס נתונים לחוות דעת: ${H(p.planNum||('תיק '+p.tik))}</title>
<style>
*{box-sizing:border-box}body{font:15px/1.5 Arial,"Segoe UI",sans-serif;color:#1a1a18;background:#fff;margin:0;padding:24px;max-width:1000px;margin-inline:auto}
h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:26px 0 8px;padding-bottom:5px;box-shadow:inset 0 -2px 0 #1a1a18}
.sub{color:#6b6a66;font-size:13.5px;margin:0 0 6px}.how{background:#f6f5f1;padding:10px 14px;font-size:13.5px;margin:12px 0}
.how b{color:#1f5c58}label{display:block;font-size:12.5px;color:#6b6a66;margin:8px 0 2px}
input,textarea{width:100%;font:inherit;padding:7px 9px;border:0;box-shadow:inset 0 0 0 1px #cfcdc6;background:#fff;border-radius:0}
input:focus,textarea:focus{outline:2px solid #1f5c58}.miss{background:#fff8c9}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 16px}
table{width:100%;border-collapse:collapse;font-size:13.5px}th{text-align:start;font-size:12px;color:#6b6a66;padding:4px 6px;font-weight:600}
td{padding:4px 6px;vertical-align:top;box-shadow:inset 0 -1px 0 #e4e2dc}td.ro{background:#f6f5f1;color:#4a4945}small{color:#6b6a66}
.bar{position:sticky;bottom:0;background:#fff;padding:12px 0;margin-top:24px;box-shadow:0 -1px 0 #cfcdc6;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
button{font:600 15px Arial,sans-serif;border:0;background:#1a1a18;color:#fff;padding:10px 20px;cursor:pointer}button.sec{background:#f1f0ec;color:#1a1a18}
#msg{font-size:13.5px;color:#1f5c58}
.t5lot{margin:14px 0 18px;padding-top:6px;box-shadow:inset 0 1px 0 #cfcdc6}.t5lot h3{font-size:15px;margin:4px 0 6px}.t5lot h3 small{font-weight:400;color:#6b6a66}
.t5row{display:grid;grid-template-columns:150px 1fr;gap:8px;padding:6px 0;box-shadow:inset 0 -1px 0 #eeede8}.t5row.tot{background:#f6f5f1}.t5use{font-weight:600;font-size:13.5px}
.t5f{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 10px}.t5f label{margin:0;display:grid;gap:2px}.t5f span{font-size:11.5px}.t5f b{font-weight:400;font-size:12.5px;color:#1a1a18;background:#f6f5f1;padding:2px 6px}
.t5note{margin-top:6px}@media(max-width:640px){.t5row{grid-template-columns:1fr}}@media print{.bar,.how{display:none}body{padding:0}input,textarea{box-shadow:inset 0 -1px 0 #999}.miss{background:none}}
</style></head><body>
<h1>טופס נתונים לחוות דעת</h1>
<p class="sub">תוכנית בינוי ועיצוב <b>${H(p.planNum||'')}</b> · תיק <b>${H(p.tik)}</b> · עיריית אשדוד, אדריכלית העיר · נשלח ${H(today().split('-').reverse().join('.'))}</p>
<div class="how"><b>איך ממלאים:</b> משלימים את השדות המסומנים בצהוב, מצרפים את תוכנית הפיתוח כ-PDF, לוחצים "שמירת קובץ הנתונים", ושולחים את הקובץ שירד בחזרה לאדריכלית העיר. עמודת "מותר" מציגה את הוראות התוכנית, ואינה לעריכה.</div>

<h2>1. זיהוי הפרויקט</h2>
<div class="grid">${idRows.map(([k, l]) => `<div><label>${l}</label>${inp('id.'+k, p[k])}</div>`).join('')}</div>

<h2>2. תקציר המבוקש</h2>
<textarea data-k="description" rows="4" placeholder="תיאור התוכנית: מה מוצע, כמה מבנים, שימושים ועיקרי הבינוי"${miss((p.opinion||{}).description)}>${H((p.opinion||{}).description||'')}</textarea>

${T5 ? `<h2>3. טבלה 5: מותר ומבוקש, לכל מגרש ולכל שימוש</h2>
<p class="sub">המותר מתוך ${H(T5.source || 'הוראות התוכנית')}, עמ' ${H((T5.pages || []).join(', '))}. בריחוף על המותר מופיע נוסח ההערה. בכל שדה צהוב ממלאים את המבוקש.</p>
${t5FormHTML(T5)}` : `<h2>3. זכויות הבנייה: מותר מול מבוקש</h2>
<table><thead><tr><th>נושא</th><th>מותר</th><th>מבוקש</th><th>הסבר לפער</th></tr></thead><tbody>${t5}</tbody></table>`}

${lots && !T5 ? `<h2>4. המבוקש לפי מגרש</h2>
<table><thead><tr><th>מגרש</th><th>מותר</th><th>יח"ד</th><th>קומות</th><th>גובה (מ')</th><th>שטח עיקרי (מ"ר)</th><th>מקומות חניה</th></tr></thead><tbody>${lots}</tbody></table>` : ''}

<h2>${lots && !T5 ? 5 : 4}. אנשי קשר</h2>
<div class="grid">
<div><label>שם איש הקשר של היזם</label>${inp('ct.dev.name', (ct.dev||{}).name)}</div><div><label>טלפון</label>${inp('ct.dev.phone', (ct.dev||{}).phone)}</div><div><label>דוא"ל</label>${inp('ct.dev.email', (ct.dev||{}).email)}</div>
<div><label>שם האדריכל האחראי</label>${inp('ct.arch.name', (ct.arch||{}).name)}</div><div><label>טלפון</label>${inp('ct.arch.phone', (ct.arch||{}).phone)}</div><div><label>דוא"ל</label>${inp('ct.arch.email', (ct.arch||{}).email)}</div>
</div>

<h2>${lots && !T5 ? 6 : 5}. תוכנית הפיתוח (PDF)</h2>
<p class="sub">הקובץ המקורי מ-AutoCAD, עם שכבות. עד 25MB.</p>
<input type="file" id="pdf" accept="application/pdf,.pdf" style="box-shadow:none;padding:4px 0"><div id="pdfMsg" class="sub"></div>

<h2>${lots && !T5 ? 7 : 6}. הערות האדריכל</h2>
<textarea data-k="remarks" rows="3" placeholder="כל מה שחשוב שאדריכלית העיר תדע"></textarea>

<div class="bar"><button id="save">שמירת קובץ הנתונים</button><button class="sec" onclick="print()">הדפסה</button><label style="margin:0;display:flex;gap:6px;align-items:center">ממלא הטופס <input id="by" style="width:200px" placeholder="שם מלא"></label><span id="msg"></span></div>
<script>
var META = ${JSON.stringify(meta).replace(/</g, '\\u003c')};
document.addEventListener('input', function(e){ var k = e.target.dataset && e.target.dataset.k; if(k && k.indexOf('.note') < 0 && k !== 'remarks') e.target.classList.toggle('miss', !e.target.value.trim()); });
var PDF = null;
document.getElementById('pdf').onchange = function(e){
  var f = e.target.files[0], m = document.getElementById('pdfMsg'); PDF = null; m.textContent = ''; if(!f) return;
  if(f.size > 25 * 1024 * 1024){ m.textContent = 'הקובץ גדול מדי (מעל 25MB). אפשר לשלוח את הגיליון של תוכנית הפיתוח בלבד.'; e.target.value = ''; return; }
  var rd = new FileReader(); rd.onload = function(){
    var b = new Uint8Array(rd.result), head = String.fromCharCode.apply(null, b.subarray(0, 5));
    if(head !== '%PDF-'){ m.textContent = 'זה לא קובץ PDF.'; e.target.value = ''; return; }
    var txt = '', i, CH = 0x8000; for(i = 0; i < b.length; i += CH) txt += String.fromCharCode.apply(null, b.subarray(i, i + CH));
    var layers = txt.indexOf('/OCProperties') >= 0;
    PDF = { name:f.name, size:f.size, layers:layers, data:btoa(txt) };
    m.textContent = layers ? 'התקבל PDF עם שכבות. מצוין.' : 'אין בקובץ שכבות. עדיף לייצא מ-AutoCAD עם שכבות (PDF וקטורי). הקובץ יישמר בכל זאת.';
  }; rd.readAsArrayBuffer(f);
};
document.getElementById('save').onclick = function(){
  var out = { app:META.app, v:META.v, tik:META.tik, planNum:META.planNum, sentAt:META.sentAt, filledAt:new Date().toISOString().slice(0,10), by:document.getElementById('by').value.trim(), lots:META.lots, f:{} };
  if(PDF) out.pdf = PDF;
  if(META.t5) out.t5 = { taba:META.t5.taba, source:META.t5.source, notes:META.t5.notes, rows:META.t5.rows };
  var left = 0; document.querySelectorAll('[data-k]').forEach(function(el){ var v = el.value.trim(); if(v) out.f[el.dataset.k] = v; else if(el.dataset.k.indexOf('.note') < 0 && el.dataset.k !== 'remarks') left++; });
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type:'application/json' })); a.download = 'form-' + META.tik + '.json'; a.click();
  document.getElementById('msg').textContent = 'הקובץ form-' + META.tik + '.json נשמר.' + (left ? ' נשארו ' + left + ' שדות ריקים.' : ' כל השדות מלאים.') + (PDF ? ' תוכנית הפיתוח בתוכו.' : ' לא צורפה תוכנית פיתוח.') + ' שלחו אותו לאדריכלית העיר.';
};
</script></body></html>`;
}
async function exportForm(){
  const p = typeof pj === 'function' && pj(); if(!p) return;
  const t5 = await loadT5(p.tik);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([formHTML(p, t5)], { type:'text/html' })); a.download = `tofes-${p.tik}.html`; a.click();
  try{ if(typeof logAction === 'function') logAction(p, 'doc', 'הופק טופס נתונים למילוי של האדריכל'); }catch(e){}
  say('הטופס ירד. שלחי אותו לאדריכל, והוא יחזיר קובץ נתונים');
}
/** קליטת קובץ הנתונים שהאדריכל החזיר. "מבוקש" מתעדכן תמיד (האדריכל הוא המקור), זיהוי ותקציר רק אם השדה ריק */
function applyForm(p, d){
  if(!d || d.app !== 'ashdod-plans-form' || !d.f) return { err:'הקובץ אינו טופס נתונים של האפליקציה' };
  if(String(d.tik) !== String(p.tik)) return { err:`הטופס שייך לתיק ${d.tik}, והכרטיס הפתוח הוא תיק ${p.tik}` };
  try{ ensureTable5(p); }catch(e){} p.table5 = p.table5 || {}; p.opinion = p.opinion || {}; p.plots = p.plots || [];
  let set = 0, kept = 0; const ct = {};
  Object.entries(d.f).forEach(([k, v]) => { const a = k.split('.'); v = String(v).trim(); if(!v) return;
    if(a[0] === 'id'){ if(String(p[a[1]]||'').trim() && p[a[1]] !== v) kept++; else if(!String(p[a[1]]||'').trim()){ p[a[1]] = v; set++; } }
    else if(k === 'description'){ if(String(p.opinion.description||'').trim() && p.opinion.description !== v) kept++; else if(!String(p.opinion.description||'').trim()){ p.opinion.description = v; set++; } }
    else if(a[0] === 't5' && p.table5[a[1]]){ if(p.table5[a[1]][a[2]] !== v){ p.table5[a[1]][a[2]] = v; if(a[2] === 'note') p.table5[a[1]].explain = v; set++; } }
    else if(a[0] === 'lot'){ const num = (d.lots||[])[+a[1]], pl = p.plots.find(x => x && String(x.num) === String(num)); if(pl){ pl.proposed = pl.proposed || {}; if(pl.proposed[a[2]] !== v){ pl.proposed[a[2]] = v; set++; } } }
    else if(a[0] === 'ct'){ (ct[a[1]] = ct[a[1]] || {})[a[2]] = v; }
    else if(a[0] === 't5r' && d.t5 && d.t5.rows[+a[1]]){ const r = d.t5.rows[+a[1]], T = t5store(p, d.t5), row = T.rows[t5id(r)];
      if(row && row.proposed[a[2]] !== v){ row.proposed[a[2]] = v; set++; } }
    else if(a[0] === 't5l' && d.t5){ const T = t5store(p, d.t5); if(T.notes[a[1]] !== v){ T.notes[a[1]] = v; set++; } } });
  if(d.t5) t5toPlots(p);
  p.archForm = { receivedAt:today(), filledAt:d.filledAt||'', by:d.by||'', remarks:d.f.remarks||'', contacts:ct };
  return { set, kept };
}
/** p.t5lots: טבלה 5 לפי מגרש ושימוש. rows[מגרש|שימוש|בניין] = { lot, use, building, total, allowed, notes, proposed }, notes[מגרש] = הסבר לפער */
function t5store(p, t5){
  const T = p.t5lots = p.t5lots && p.t5lots.rows ? p.t5lots : { rows:{}, notes:{} };
  T.taba = t5.taba; T.source = t5.source; T.noteText = t5.notes || {}; T.at = today();
  (t5.rows || []).forEach(r => { const id = t5id(r), allowed = {};
    Object.keys(r).forEach(k => { if(typeof r[k] === 'number') allowed[k] = r[k]; });
    const cur = T.rows[id] || { proposed:{} };
    T.rows[id] = { lot:r.lot, use:r.use || '', building:r.building || '', total:!!r.total_row, zone:r.zone || '', allowed, notes:r.notes || {}, proposed:cur.proposed || {} }; });
  return T;
}
/** הסכום לכל מגרש נכנס גם ל-plots[].proposed, כדי שהכרטיס והמודל הקיימים ימשיכו לעבוד */
function t5toPlots(p){
  const T = p.t5lots; if(!T) return; p.plots = Array.isArray(p.plots) ? p.plots : [];
  const by = {}; Object.values(T.rows).forEach(r => { if(!r.total) (by[r.lot] = by[r.lot] || []).push(r); });
  const n = v => { const x = parseFloat(String(v).replace(/,/g, '')); return isNaN(x) ? null : x; };
  Object.entries(by).forEach(([lot, rs]) => {
    const sum = k => { const xs = rs.map(r => n(r.proposed[k])).filter(x => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; };
    const max = k => { const xs = rs.map(r => n(r.proposed[k])).filter(x => x != null); return xs.length ? Math.max(...xs) : null; };
    const pr = { units:sum('units'), floors:max('floorsAbove'), height:max('height'), main:sum('mainAbove') ?? sum('total') };
    if(Object.values(pr).every(v => v == null)) return;
    let pl = p.plots.find(x => x && String(x.num) === String(lot));
    if(!pl){ pl = { num:String(lot), use:rs[0].zone || '' }; p.plots.push(pl); }
    pl.proposed = pl.proposed || {}; Object.entries(pr).forEach(([k, v]) => { if(v != null) pl.proposed[k] = String(v); }); });
}

/** תוכנית הפיתוח שהאדריכל צירף (base64 בקובץ הנתונים): עולה ל-ashdod-docs ונרשמת במסמכי התוכנית.
    מחזיר: null (לא צורף), 'dup' (כבר נקלט), 'fail', או { layers } */
async function formPdf(p, d){
  const x = d && d.pdf; if(!x || !x.data) return null;
  p.documents = Array.isArray(p.documents) ? p.documents : [];
  if(p.documents.some(z => z && z.name === x.name && z.size === x.size && z.src === 'טופס האדריכל')) return 'dup';
  const bin = atob(x.data), u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  if(String.fromCharCode(...u.subarray(0, 5)) !== '%PDF-') return 'fail';
  const file = new File([u], x.name || `plan-${p.tik}.pdf`, { type:'application/pdf' });
  const up = await uploadDoc(file, 'plans/' + p.tik);
  p.documents.push({ name:file.name, type:'תוכנית בינוי ופיתוח', url:docPublicUrl(up.path), date:today(), src:'טופס האדריכל', size:x.size, layers:!!x.layers, local:!!up.local });
  return { layers:!!x.layers, local:!!up.local };
}
function importForm(file){
  const p = typeof pj === 'function' && pj(); if(!p || !file) return;
  const rd = new FileReader(); rd.onload = async () => { let d = null; try{ d = JSON.parse(rd.result); }catch(e){ return say('הקובץ לא נקרא. צריך את קובץ הנתונים (json) שהטופס שומר'); }
    const r = applyForm(p, d); if(r.err) return say(r.err);
    let pd = null; try{ pd = await formPdf(p, d); }catch(e){ console.warn('form pdf', e); pd = 'fail'; }
    const pdTxt = !pd ? '' : pd === 'dup' ? '. תוכנית הפיתוח כבר נקלטה קודם' : pd === 'fail' ? '. תוכנית הפיתוח לא נשמרה, כי הענן לא זמין והקובץ גדול. בקשי אותה שוב' : `, ותוכנית פיתוח (${pd.layers ? 'PDF עם שכבות' : 'PDF בלי שכבות'})`;
    try{ if(typeof logAction === 'function') logAction(p, 'doc', `נקלט טופס האדריכל${d.by ? ' ('+d.by+')' : ''}: ${r.set} שדות${pd && pd.layers !== undefined ? ', ותוכנית פיתוח' : ''}`); else savePlans(); }catch(e){}
    try{ savePlans(); renderOpinionTab(p); if(typeof renderReviewTab === 'function') renderReviewTab(p); }catch(e){}
    say(`נקלטו ${r.set} שדות מהטופס${pdTxt}${r.kept ? `. ${r.kept} שדות שכבר מולאו נשארו כפי שהיו` : ''}`); };
  rd.readAsText(file);
}
/** מה שהאדריכל ביקש לכל מגרש, ומה שנקלט מהטופס: נוסף לסעיף הזכויות */
function lotsBlock(p){
  const ls = (p.plots||[]).filter(x => x && x.proposed && Object.keys(x.proposed).length), af = p.archForm;
  const t = ls.length ? `<div class="tbl-wrap"><table class="op-tbl"><thead><tr><th>מגרש</th><th>יח״ד מבוקש</th><th>קומות</th><th>גובה</th><th>שטח עיקרי</th><th>חניה</th></tr></thead><tbody>${ls.map(x => `<tr><td>${H(x.num)}</td><td>${H(x.proposed.units||'—')}</td><td>${H(x.proposed.floors||'—')}</td><td>${H(x.proposed.height||'—')}</td><td>${H(x.proposed.main||'—')}</td><td>${H(x.proposed.parking||'—')}</td></tr>`).join('')}</tbody></table></div>` : '';
  const c = af && af.contacts ? Object.entries(af.contacts).map(([k, v]) => `${k==='dev'?'יזם':'אדריכל'}: ${[v.name, v.phone, v.email].filter(Boolean).map(H).join(', ')}`).join(' · ') : '';
  return (t ? `<div class="op-sub">המבוקש לפי מגרש, מטופס האדריכל</div>${t}` : '') + (af ? `<div class="op-from">טופס האדריכל נקלט ${H(String(af.receivedAt).split('-').reverse().join('.'))}${af.by ? ', מולא על ידי ' + H(af.by) : ''}${c ? '. ' + c : ''}${af.remarks ? `<br>הערות: ${H(af.remarks)}` : ''}</div>` : '');
}

/** בכרטיס: טבלה 5 לכל מגרש. מותר מול מבוקש. חריגה (מבוקש גדול מהמותר) באדום. לפני שהטופס חזר: המותר בלבד */
function t5Card(p, t5){
  const T = p.t5lots && p.t5lots.rows ? p.t5lots : null; if(!t5 && !T) return '';
  const cols = (t5 && t5.columns) || [], lab = k => (cols.find(c => c.key === k) || {}).label || k, unit = k => (cols.find(c => c.key === k) || {}).unit || '';
  const rows = t5 ? t5.rows.map(r => ({ r, s:T && T.rows[t5id(r)] })) : Object.values(T.rows).map(x => ({ r:Object.assign({ lot:x.lot, use:x.use, building:x.building, total_row:x.total, zone:x.zone, notes:x.notes }, x.allowed), s:x }));
  const n = v => { const x = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(x) ? null : x; };
  const byLot = new Map(); rows.forEach(o => { if(!byLot.has(o.r.lot)) byLot.set(o.r.lot, []); byLot.get(o.r.lot).push(o); });
  let over = 0, miss = 0;
  const html = [...byLot.entries()].sort((a, b) => +a[0] - +b[0]).map(([lot, os]) => { let lo = 0, lm = 0;
    const seen = new Set(), NT = (t5 && t5.notes) || (T && T.noteText) || {};
    const body = os.map(({ r, s }) => { let ks = cols.length ? cols.map(c => c.key).filter(k => r[k] != null || (r.notes || {})[k]) : Object.keys(r).filter(k => typeof r[k] === 'number');
      ks = ks.filter(k => { const sig = k + ':' + r[k] + ':' + ((r.notes || {})[k] || []).join(','); if(T5_LOTKEYS.includes(k) && seen.has(sig) && !(s && s.proposed[k])) return false; seen.add(sig); return true; });
      if(!ks.length) return '';
      return `<tr><th>${H(t5rowLabel(r))}</th><td>${ks.map(k => { const a = r[k], v = s && s.proposed[k], bad = a != null && n(v) != null && n(v) > a + 1e-9;
        if(bad){ over++; lo++; } if(v == null || v === ''){ miss++; lm++; }
        return `<span class="t5c${bad ? ' over' : ''}"><i>${H(lab(k))}</i> ${a != null ? H(t5num(a)) + (unit(k) ? ' ' + H(unit(k)) : '') : (r.notes || {})[k] ? '<em>לפי הערה</em>' : '<em>לא נקבע</em>'}${(r.notes || {})[k] ? `<sup title="${H(((r.notes[k] || []).map(x => (t5 && t5.notes || (T && T.noteText) || {})[x] || '')).join(' '))}">${H(r.notes[k].join(','))}</sup>` : ''} / <b>${v != null && v !== '' ? H(v) : 'חסר'}</b></span>`; }).join('')}</td></tr>`; }).join('');
    const note = T && T.notes && T.notes[lot];
    return `<details class="t5lotc"><summary>מגרש ${H(lot)} <small>${H((os[0].r.zone) || '')}</small>${lo ? ` <b class="t5bad">${lo === 1 ? 'חריגה אחת' : lo + ' חריגות'}</b>` : ''}${lm ? ` <small>${lm === 1 ? 'חסר אחד' : lm + ' חסרים'}</small>` : ''}</summary><table class="op-tbl t5ct"><tbody>${body}</tbody></table>${note ? `<div class="op-from">הסבר לפער: ${H(note)}</div>` : ''}</details>`; }).join('');
  return `<div class="op-sub">טבלה 5 לפי מגרש: מותר / <b>מבוקש</b>${T ? '' : ' (המבוקש יגיע בטופס האדריכל)'}${over ? ` · <b class="t5bad">${over === 1 ? 'חריגה אחת' : over + ' חריגות'}</b>` : ''}</div>
    <div class="op-from">מקור המותר: ${H((t5 && t5.source) || (T && T.source) || '')}${t5 && t5.pages ? `, עמ' ${H(t5.pages.join(', '))}` : ''}</div>${html}`;
}
/* ── 5. חוות הדעת לפי סדר הבדיקה (ענת, 24.11.2026): מי, מה, איפה, טבלה 5, דרישות התכנון, מסקנות ──
   renderOpinionTab המקורי רץ, ואז המסמך נבנה מחדש. סעיף קיים עם שדה עריכה עובר כמו שהוא (המטפלים כתובים בתוכו). */
const dash = v => v == null || String(v).trim() === '' ? '—' : String(v);
const fmtD = d => /^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).slice(0, 10).split('-').reverse().join('.') : dash(d);
const kv = pairs => `<div class="op-id-grid">${pairs.map(([k, v]) => `<div><b>${H(k)}:</b> ${H(dash(v))}</div>`).join('')}</div>`;
const nm = s => String(s || '').replace(/^(אד'|אדר'|אדריכל)\s*/, '').replace(/[\s"'׳״.,-]+/g, '');
function people(p){
  const m = p.meta || {}, out = [], add = (role, name, phone, email, org) => { if(!String(name || '').trim()) return;
    const k = nm(name), cur = out.find(x => nm(x.name) === k); if(cur){ cur.phone = cur.phone || phone; cur.email = cur.email || email; return; }
    out.push({ role, name, phone:phone || '', email:email || '', org:org || '' }); };
  const ct = (p.archForm || {}).contacts || {};
  add('יזם', p.developer, m.devPhone, m.devEmail); if(ct.dev) add('יזם, איש קשר', ct.dev.name, ct.dev.phone, ct.dev.email);
  add('אדריכל', m.archName || p.submitter, m.archPhone, m.archEmail); if(ct.arch) add('אדריכל אחראי', ct.arch.name, ct.arch.phone, ct.arch.email);
  add('מנהל פרויקט', m.contactName, m.contactPhone, m.contactEmail);
  try{ (contacts || []).filter(c => (c.plans || []).map(String).includes(String(p.tik))).forEach(c => add(c.type || 'איש קשר', c.name, c.phone, c.email, c.org)); }catch(e){}
  (Array.isArray(p.consultants) ? p.consultants : []).forEach(c => add(c.role || 'יועץ', c.name));
  const tb = TABA_C[p.tik]; if(tb) (tb.parties || []).forEach(x => add(x.role + ' (לפי התב"ע)', x.name, x.phone, x.email));
  return out;
}
function secParties(p){
  const ps = people(p);
  return `<h2 class="op-title">חוות דעת: תוכנית בינוי ${H(p.planNum || '')} <small>תיק ${H(p.tik)}</small></h2>
    ${kv([['שם הפרויקט', p.projectName || [p.district, p.location].filter(Boolean).join(', ')], ['סטטוס', p.status], ['פורום אדריכל', fmtD(p.forumArchitect)], ['פורום יועצים', fmtD(p.forumConsultants)], ['הכנה לוועדה', fmtD((p.datesPlan || {}).committeePrep)], ['ועדה', fmtD(p.committeeDate)]])}
    <div class="op-sub">בעלי העניין</div>
    ${ps.length ? `<div class="tbl-wrap"><table class="op-tbl"><thead><tr><th>תפקיד</th><th>שם</th><th>טלפון</th><th>דוא"ל</th></tr></thead><tbody>${ps.map(x => `<tr><td>${H(x.role)}</td><td>${H(x.name)}${x.org && x.org !== x.name ? ` <small>${H(x.org)}</small>` : ''}</td><td>${H(dash(x.phone))}</td><td>${H(dash(x.email))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">לא הוזנו בעלי עניין.</p>'}`;
}
function secProperty(p, t5, planningData){
  const m = p.meta || {}, lots = t5 ? t5lots(t5) : [];
  return kv([['גוש', m.block], ['חלקות', m.lot], ['גוש וחלקה', p.parcel], ['תב"ע חלה', m.zoningPlan || p.change], ['תב"ע מפורטת', m.zoningDetailed], ['ייעוד', m.designation || (lots.length ? [...new Set(t5.rows.map(r => r.zone).filter(Boolean))].join('; ') + ' (מטבלה 5)' : '')],
      ['שטח התוכנית', m.area ? t5num(+String(m.area).replace(/,/g, '') || m.area) + ' מ"ר' : t5 && t5.planArea ? `${t5num(Math.round(t5.planArea * 1000))} מ"ר (${t5.planArea} דונם, הוראות התוכנית סעיף 1.2)` : ''],
      ['סוג התוכנית', t5 && t5.planType]])
    + (lots.length ? `<div class="op-sub">המגרשים בתוכנית, מטבלה 5 (${lots.length})</div><div class="tbl-wrap"><table class="op-tbl"><thead><tr><th>מגרש</th><th>ייעוד</th><th>גודל</th><th>שימושים</th></tr></thead><tbody>${lots.map(([lot, rs]) => { const r0 = rs.find(([r]) => !r.total_row) || rs[0], size = rs.map(([r]) => r.lotSize).find(v => v != null);
        return `<tr><td>${H(lot)}</td><td>${H(r0[0].zone || '')}</td><td>${size != null ? t5num(size) + ' מ"ר' : '—'}</td><td>${H([...new Set(rs.filter(([r]) => !r.total_row).map(([r]) => r.use))].join(', '))}</td></tr>`; }).join('')}</tbody></table></div>` : '')
    + (TABA_C[p.tik] && TABA_C[p.tik].purpose ? `<div class="op-sub">מטרת התב"ע</div><p class="op-purpose">${H(TABA_C[p.tik].purpose.text)} <small>${H(TABA_C[p.tik].source)}, סעיף ${H(TABA_C[p.tik].purpose.section)}, עמ' ${H(TABA_C[p.tik].purpose.page)}</small></p>` : '')
    + (planningData || '');
}
function secLocation(p){
  const g = typeof window.planGeo === 'function' ? window.planGeo(p) : null, pr = g && window.PLAN_PREC && window.PLAN_PREC[g.prec];
  return kv([['רובע', p.district], ['מגרש ומיקום', p.location], ['כתובת', (p.meta || {}).address], ['מתחם', (p.meta || {}).compound]])
    + `<div class="op-id-grid"><div><b>יושבת על:</b> <span id="opStreet">${g ? '…' : '—'}</span></div><div><b>דיוק המיקום:</b> ${H(pr ? pr.label : 'אין מיקום')}${g && g.src ? ` <small>${H(g.src)}</small>` : ''}</div>
      ${g ? `<div><b>נ"צ:</b> ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}</div>` : ''}</div>
    <button class="btn btn-sm no-print" onclick="go('map')">במפה</button>`;
}
/* ── השלמות ליזם (ענת, 24.11.2026): כל מה שלא עומד, עם ההנחיה, בנוסח מוכן להעתקה ולמייל ── */
const INFRA_CACHE = {};
async function infraFindings(p){
  const set = (window.LAYER_SETS || {})[String(p.tik)]; if(!set || !window.PlanInfra || !window.PlanModel) return [];
  if(!INFRA_CACHE[p.tik]){ const m = await fetch(set.dir + '/model.json').then(r => r.json()), rn = set.renewal ? await fetch(set.dir + '/renewal.json').then(r => r.json()).catch(() => null) : null;
    INFRA_CACHE[p.tik] = window.PlanInfra.analyze({ meas:window.PlanModel.measure(m), model:m, rn }); }
  return INFRA_CACHE[p.tik];
}
async function completions(p){
  await Promise.all([loadT5(p.tik), loadTaba(p.tik)]);
  const t5 = T5C[p.tik], T = p.t5lots && p.t5lots.rows ? p.t5lots : null, G = [], add = (title, items) => { items = items.filter(Boolean); if(items.length) G.push([title, items]); };
  const n = v => { const x = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(x) ? null : x; };
  if(t5){ const lab = k => ((t5.columns || []).find(c => c.key === k) || {}).label || k, it = [];
    if(!T) it.push('יש למלא בטופס הנתונים את המבוקש בטבלה 5, לכל מגרש ולכל שימוש.');
    else { const miss = {};
      t5.rows.forEach(r => { const s = T.rows[t5id(r)]; if(!s) return;
        (t5.columns || []).forEach(c => { const a = r[c.key], v = s.proposed[c.key];
          if(a != null && n(v) != null && n(v) > a + 1e-9) it.push(`מגרש ${r.lot}, ${t5rowLabel(r)}: ${lab(c.key)} מבוקש ${v}, והמותר ${t5num(a)}. יש להתאים לטבלה 5, או לנמק ולבקש הקלה.`);
          if((a != null || (r.notes || {})[c.key]) && (v == null || v === '')){ const sig = T5_LOTKEYS.includes(c.key) ? c.key + ':' + t5allowed(t5, r, c.key, true) : t5id(r) + c.key;
            (miss[r.lot] = miss[r.lot] || new Set()).add(sig); } }); });            // שדה של המגרש נספר פעם אחת, כמו בטופס
      const ls = Object.keys(miss).sort((a, b) => a - b), tot = ls.reduce((a, l) => a + miss[l].size, 0);
      if(ls.length) it.push(`חסרים ${tot} ערכים מבוקשים בטבלה 5, ב-${ls.length === 1 ? 'מגרש ' + ls[0] : ls.length + ' מגרשים: ' + ls.join(', ')}. יש להשלים בטופס הנתונים.`); }
    add('טבלה 5', it); }
  const hasPdf = (p.documents || []).some(d => d && d.layers) || !!(window.LAYER_SETS || {})[String(p.tik)];
  add('תוכנית הפיתוח', [hasPdf ? '' : 'יש להגיש את תוכנית הפיתוח כקובץ PDF מקורי מ-AutoCAD, עם שכבות.']);
  const tc = checksTaba(p);
  add('הוראות התב"ע: לא עומד', tc.filter(x => x.st === 'no').map(x => `${x.t.replace(/[.\s]+$/, '')}. ${x.note ? x.note.replace(/[.\s]+$/, '') + ' ' : ''}(סעיף ${x.r.section}).`));
  const show = tc.filter(x => x.st === 'open' && x.r.stage === 'תוכנית בינוי');   // הרשימה המלאה יוצאת כנספח בהעתקה ובמייל
  if(show.length){ const byT = {}; show.forEach(x => byT[x.r.topic] = (byT[x.r.topic] || 0) + 1);
    add('הוראות התב"ע: להציג עמידה', [`יש להציג בתוכנית הבינוי עמידה ב-${show.length} דרישות מהוראות התב"ע: ${Object.entries(byT).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ')}. הרשימה המלאה בנספח.`]); }
  add('הנחיות מרחביות', checksSpatial(p).filter(x => x.st === 'no').map(x => `${x.t}: ${x.note || x.sub || 'אינה עומדת בהנחיה'}.`));
  add('דרישות התב"ע והעירייה', checksMuni(p).filter(x => x.st === 'no').map(x => `${x.t}: ${x.note || x.sub}.`));
  add('דרישות ההגשה לתוכנית הפיתוח', checksSubmission(p).filter(x => x.st === 'no').map(x => `${x.sub}, ${x.t}: ${x.note}`));
  add('הנחיות מבחינת התוכנית', ((p.layerReview || {}).custom || []).filter(c => !c.d && String(c.n || '').trim()).map(c => `${c.t ? c.t + ': ' : ''}${c.n}`));
  try{ add('תיאום תשתיות', (await infraFindings(p)).filter(f => f.ok === false && f.guide).map(f => f.guide)); }catch(e){}
  const seen = new Set(); G.forEach(g => { g[1] = g[1].filter(x => { const k = x.replace(/[\s.,:;"'()\-]+/g, ''); if(seen.has(k)) return false; seen.add(k); return true; }); });
  return G.filter(g => g[1].length);
}
function nextForum(p){
  const t = today(), F = [['פורום אדריכל העיר', p.forumArchitect], ['פורום יועצים', p.forumConsultants], ['הכנה לוועדה', (p.datesPlan || {}).committeePrep], ['ועדה', p.committeeDate]];
  return F.map(([n, d]) => [n, String(d || '').slice(0, 10)]).filter(([, d]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= t).sort((a, b) => a[1] < b[1] ? -1 : 1)[0];
}
/** מעקב: סעיף שהיזם השלים מסומן "הושלם", עם תאריך (p.todoDone). לא יוצא שוב בהעתקה ובמייל */
const todoKey = x => String(x).replace(/[\s.,:;"'()\-]+/g, '').slice(0, 140);
const isDone = (p, x) => !!(p.todoDone || {})[todoKey(x)];
function completionsText(p, G){
  G = G.map(([t, items]) => [t, items.filter(x => !isDone(p, x))]).filter(g => g[1].length);
  const f = nextForum(p), heb = 'אבגדהוזחט'; let i = 0;
  const L = [`השלמות נדרשות: תוכנית בינוי ${p.planNum || ''}, תיק ${p.tik}`, `${fmtD(today())}${f ? `. לקראת ${f[0]}, ${fmtD(f[1])}` : ''}.`, ''];
  if(!G.length) L.push('אין השלמות פתוחות.');
  G.forEach(([t, items], k) => { L.push(`${heb[k]}. ${t}`); items.forEach(x => L.push(`${++i}. ${x}`)); L.push(''); });
  L.push('נא להגיש את ההשלמות, או נימוק לכל סעיף שלא יושלם, לפני המועד.', '', 'ענת שטיבלמן', 'אדריכלית העיר, עיריית אשדוד');
  const show = checksTaba(p).filter(x => x.st === 'open' && x.r.stage === 'תוכנית בינוי'), tb = TABA_C[p.tik];
  if(show.length && G.some(g => /להציג עמידה/.test(g[0]))){ L.push('', '', `נספח: דרישות מהוראות התב"ע להצגה בתוכנית הבינוי (${tb.source})`);
    const byT = {}; show.forEach(x => (byT[x.r.topic] = byT[x.r.topic] || []).push(x));
    Object.entries(byT).forEach(([t, xs]) => { L.push('', t); xs.forEach((x, i) => L.push(`${i + 1}. ${x.t} (סעיף ${x.r.section}, עמ' ${x.r.page})`)); }); }
  return L.join('\n');
}
async function fillTodo(p){
  const el = document.getElementById('opTodo'); if(!el) return;
  const G = await completions(p), all = G.flatMap(g => g[1]), done = all.filter(x => isDone(p, x)).length, open = all.length - done;
  const ed = typeof isArchitect !== 'function' || isArchitect(), D = p.todoDone || {};
  el.innerHTML = `<div class="ck-sum"><b>${open === 1 ? 'השלמה פתוחה אחת' : open + ' השלמות פתוחות'}</b> ליזם${done ? ` · ${done === 1 ? 'אחת הושלמה' : done + ' הושלמו'}` : ''}${open ? `<span class="no-print" style="margin-inline-start:auto;display:flex;gap:4px"><button class="btn btn-sm" data-todo="copy">העתקה</button><button class="btn btn-sm" data-todo="mail">טיוטת מייל</button></span>` : ''}</div>
    ${G.map(([t, items]) => `<div class="op-sub">${H(t)}</div><ol class="op-todo">${items.slice().sort((a, b) => isDone(p, a) - isDone(p, b)).map(x => { const k = todoKey(x), d = D[k];
      return `<li class="${d ? 'done' : ''}">${ed ? `<label class="no-print todo-ck" title="היזם השלים את הסעיף"><input type="checkbox" data-done="${H(k)}"${d ? ' checked' : ''}> הושלם</label>` : ''}<span>${H(x)}</span>${d ? ` <small>הושלם ${H(fmtD(d))}</small>` : ''}</li>`; }).join('')}</ol>`).join('')}`;
  el.onchange = e => { const c = e.target.closest('[data-done]'); if(!c) return; p.todoDone = p.todoDone || {};
    if(c.checked) p.todoDone[c.dataset.done] = today(); else delete p.todoDone[c.dataset.done];
    try{ logAction(p, 'todo', (c.checked ? 'הושלם: ' : 'נפתח מחדש: ') + c.closest('li').querySelector('span').textContent.slice(0, 80)); }catch(err){}
    try{ savePlans(); }catch(err){} fillTodo(p); };
  el.onclick = e => { const b = e.target.closest('[data-todo]'); if(!b) return; const txt = completionsText(p, G);
    if(b.dataset.todo === 'copy'){ try{ navigator.clipboard.writeText(txt).then(() => say('רשימת ההשלמות הועתקה'), () => prompt('העתקה', txt)); }catch(err){ prompt('העתקה', txt); } return; }
    const to = people(p).filter(x => /יזם|אדריכל|מנהל/.test(x.role) && /@/.test(x.email)).map(x => x.email), uniq = [...new Set(to)];
    window.location.href = `mailto:${uniq.join(',')}?subject=${encodeURIComponent(`השלמות נדרשות: תוכנית בינוי ${p.planNum || ''}`)}&body=${encodeURIComponent(txt)}`;
    try{ logAction(p, 'mail', 'נפתחה טיוטה: השלמות ליזם'); savePlans(); }catch(err){} };
}

/* ה: כל הדרישות, גם אלה שלא נבדקו. לא עומד ראשון */
const ST = { no:['לא עומד', 0], yes:['עומד', 1], na:['לא רלוונטי', 2], open:['לא נבדק', 3] };
function checkList(items, link){
  const n = items.length, done = items.filter(x => x.st !== 'open').length, bad = items.filter(x => x.st === 'no').length;
  const ed = typeof isArchitect !== 'function' || isArchitect();
  const mk = x => x.id && ed ? `<span class="ck-mk no-print">${[['yes', 'עומד'], ['no', 'לא עומד'], ['na', 'לא רלוונטי']].map(([k, l]) => `<button class="${x.st === k ? 'on' : ''}" data-tk="${H(x.id)}|${k}">${l}</button>`).join('')}</span>` : '';
  const sg = x => x.sug && ed ? `<span class="ck-sug">הצעה מהמודל: <b>${ST[x.sug.st][0]}</b>. ${H(x.sug.why)}<span class="no-print"><button data-sg="${H(x.id)}|ok">אישור</button><button data-sg="${H(x.id)}|x">דחייה</button></span></span>` : '';
  const ord = x => ST[x.st][1] - (x.sug ? 0.5 : 0);
  const rows = items.slice().sort((a, b) => ord(a) - ord(b)).map(x => `<li class="ck-${x.st}${x.sug ? ' ck-has-sug' : ''}"><span class="ck-st">${ST[x.st][0]}</span><span class="ck-t">${H(x.t)}${x.sub ? ` <small>${H(x.sub)}</small>` : ''}${x.note ? `<em>${H(x.note)}</em>` : ''}${sg(x)}${mk(x)}</span></li>`).join('');
  const ns = items.filter(x => x.sug).length;
  return `<div class="ck-sum">${ns ? `<b>${ns === 1 ? 'הצעה אחת' : ns + ' הצעות'}</b> מהמודל לבדיקה · ` : ''}נבדקו <b>${done}</b> מתוך ${n}${bad ? ` · <b class="t5bad">${bad === 1 ? 'אחת לא עומדת' : bad + ' לא עומדות'}</b>` : ''}${link ? ` <button class="btn btn-sm no-print" onclick="${link}">לבדיקה</button>` : ''}</div><ul class="ck-list">${rows}</ul>`;
}
/* הצעה מהמודל (ענת, 24.11.2026): ממצא של הניתוח הרב תשתיתי מוצע כסימון לדרישת תב"ע באותו נושא.
   זו הצעה, לא קביעה: רק "אישור" של אדריכלית העיר נכנס ל-p.tabaChecks (עם src:'מודל'). "דחייה" נרשמת ב-p.tabaSugNo, כדי שלא תחזור */
const SUG_RULES = [   // re: הדרישה עוסקת במה שנמדד. no: דרישה שהמודל לא יכול לענות עליה
  { infra:'drain', re:/ניהול הנגר|ויסות הנגר|איגום|חלחול|קליטת נגר/, no:/מרתפ|פניאומט/ },
  { infra:'trees', title:/צל/, re:/הצלל|רצף צל|מוצלל/, no:/חניונ|בית גידול/ },
  { infra:'waste', re:/חדרי? (ה)?אשפה|אצירה|פינוי .*אשפה/, no:/^אם יש|פניאומט.*תשתית/ },
  { infra:'fire', re:/רחבות כיבוי|רחבת כיבוי/ },
  { infra:'walk', re:/שטחים מגוננים|יחס .*גינון/, no:/חניונ|עומק/ }
];
function suggestFor(p, r){
  const fs = INFRA_CACHE[p.tik]; if(!fs || ((p.tabaSugNo || {})[r.id])) return null;
  for(const R of SUG_RULES){
    if(!R.re.test(r.text) || (R.no && R.no.test(r.text))) continue;
    const f = fs.find(f => f.infra === R.infra && f.ok !== null && f.ok !== undefined && (!R.title || R.title.test(f.title)));
    if(f) return { st:f.ok ? 'yes' : 'no', why:`${f.title}: ${String(f.fact || '').replace(/\*\*/g, '')} (${f.basis || 'נמדד בשרטוט'})`, guide:f.guide || '' };
  }
  return null;
}
/** דרישות התב"ע: הסימון נעשה כאן, בחוות הדעת (p.tabaChecks[id] = { st, note, at }) */
function checksTaba(p){
  const tb = TABA_C[p.tik]; if(!tb) return [];
  return (tb.requirements || []).map(r => { const c = (p.tabaChecks || {})[r.id] || {}, st = c.st || 'open';
    return { id:r.id, t:r.text, sub:`${r.topic} · ${r.stage} · סעיף ${r.section}, עמ' ${r.page}${c.src ? ' · לפי ' + c.src : ''}`, st, note:c.note || '', r, sug:st === 'open' ? suggestFor(p, r) : null }; });
}
function checksSpatial(p){
  const G = typeof SPATIAL_GUIDELINES !== 'undefined' ? SPATIAL_GUIDELINES : [];
  return G.map((g, i) => { const c = (p.spatialChecks || {})[i] || {}; const [t, sub] = String(typeof g === 'string' ? g : g.title || g.label).split(' — ');
    return { t, sub, st:c.ans === 'yes' ? 'yes' : c.ans === 'no' ? 'no' : c.ans === 'na' ? 'na' : 'open', note:c.note || '' }; });
}
function checksMuni(p){
  let R = []; try{ R = typeof activeRequirements === 'function' ? activeRequirements(p) : []; }catch(e){}
  return R.map(r => { const c = (p.muniChecks || {})[r.id] || {}; return { t:r.topic, sub:r.body + ': ' + r.text, st:c.met === true ? 'yes' : c.met === false ? 'no' : 'open', note:c.note || '' }; });
}
function checksSubmission(p){
  const T = window.LAYER_TOPICS || [], it = ((p.layerReview || {}).items) || {};
  return T.flatMap(t => t.items.map((x, i) => { const c = it[t.id + '.' + i] || {}; return { t:x[0], sub:t.name, st:c.d ? 'yes' : String(c.n || '').trim() ? 'no' : 'open', note:c.n || '' }; }));
}
function secChecks(p){
  const hasModel = !!(window.LAYER_SETS || {})[String(p.tik)], go = t => `ppTabByName('review');setTimeout(()=>{try{reviewGo('${t}')}catch(e){}},50)`;
  const tb = TABA_C[p.tik];
  return [
    ...(tb ? [['דרישות מהוראות התב"ע', checkList(checksTaba(p), '') + `<p class="muted">${H(tb.source)}. כל דרישה עם סעיף ועמוד, והציטוט נבדק מול המסמך. הסימון נעשה כאן.</p>`]] : []),
    ['הנחיות מרחביות', checkList(checksSpatial(p), go('spatial'))],
    ['דרישות התב"ע והעירייה', checkList(checksMuni(p), go('muni'))],
    ['דרישות ההגשה לתוכנית הפיתוח', checkList(checksSubmission(p), hasModel ? `openLayers('${p.tik}')` : '') + (hasModel ? '' : '<p class="muted">הדרישות נבדקות במסך המודל, כשתגיע תוכנית הפיתוח כ-PDF עם שכבות.</p>')],
    ['ניתוח רב תשתיות', `<div id="opInfra">${hasModel ? '…' : '<p class="muted">אין עדיין מודל לתוכנית. הניתוח ייעשה כשתגיע תוכנית הפיתוח כ-PDF עם שכבות.</p>'}</div>`]
  ];
}
async function fillAsync(p){
  try{ const el = document.getElementById('opStreet'); if(el && typeof window.planStreet === 'function'){ const s = await window.planStreet(p); el.textContent = s || 'אין רחוב עד 150 מ\''; } }catch(e){}
  try{ const el = document.getElementById('opInfra'), set = (window.LAYER_SETS || {})[String(p.tik)]; if(!el || !set || !window.PlanInfra || !window.PlanModel) return;
    const had = !!INFRA_CACHE[p.tik], fs = await infraFindings(p);
    if(!had && checksTaba(p).some(x => x.sug) && pj && pj() === p){ refreshOpinion(p); return; }   // ההצעות מהמודל נכנסות לסעיף הדרישות
    el.innerHTML = checkList(fs.map(f => ({ t:f.title, sub:String(f.fact || '').replace(/\*\*/g, ''), st:f.ok === false ? 'no' : f.ok === true ? 'yes' : 'na', note:f.ok === false ? f.guide : '' })), `openLayers('${p.tik}')`)
      + (set.auto === 'approx' ? '<p class="muted">המודל במיקום משוער. הכמויות מדויקות.</p>' : ''); }catch(e){ console.warn('opinion infra', e); }
}
function rebuildOpinion(p){
  const doc = document.getElementById('opinionDoc'); if(!doc) return;
  if(TABA_C[p.tik] === undefined){ loadTaba(p.tik).then(x => { if(x && pj && pj() === p) refreshOpinion(p); }); }
  const old = {}; doc.querySelectorAll('details.op-fold').forEach(d => { const t = d.querySelector('summary span'); if(t) old[t.textContent.trim()] = d.querySelector('.op-sec-b').innerHTML; });
  const body = t => old[t] || '';
  const t5 = T5C[p.tik], pd = (body('נתוני התב״ע והמותר').match(/<div class="pp-field[\s\S]*$/) || [''])[0];
  const t5body = (t5 || (p.t5lots && p.t5lots.rows) ? t5Card(p, t5) : body('טבלה 5 וזכויות הבנייה')) + lotsBlock(p);
  secN = 0; lastGrp = null;
  doc.innerHTML = [
    section('הבקשה ובעלי העניין', 'g-a', secParties(p)),
    section('תקציר המבוקש', 'g-a', body('תקציר המבוקש')),
    section('פרטי הנכס והתב"ע', 'g-b', secProperty(p, t5, pd)),
    section('מיקום', 'g-c', secLocation(p)),
    section('טבלה 5 לכל מגרש: מותר מול מבוקש', 'g-d', t5body),
    ...secChecks(p).map(([t, b]) => section(t, 'g-e', b)),
    section('הסברי היזם לפערים', 'g-e', body('הסברי היזם לפערים')),
    section('חוות דעת הגורמים והיועצים', 'g-e', body('חוות דעת הגורמים והיועצים')),
    section('החלטות הפורומים', 'g-e', body('החלטות הפורומים')),
    section('תנאים והשלמות נדרשות', 'g-f', '<div id="opTodo">…</div>' + body('תנאים והשלמות נדרשות')),
    section('המלצה מקצועית מסכמת', 'g-f', body('המלצה מקצועית מסכמת'))
  ].join('');
  try{ if(typeof autoGrowAll === 'function') setTimeout(autoGrowAll, 30); }catch(e){}
  fillAsync(p); fillTodo(p);
  const onSug = e => { const b = e.target.closest('[data-sg]'); if(!b) return false; const [id, a] = b.dataset.sg.split('|');
    const x = checksTaba(p).find(x => x.id === id); if(!x || !x.sug) return true;
    if(a === 'ok'){ p.tabaChecks = p.tabaChecks || {}; p.tabaChecks[id] = { st:x.sug.st, note:x.sug.st === 'no' ? (x.sug.guide || x.sug.why) : '', at:today(), src:'מודל' };
      try{ logAction(p, 'review', `אושרה הצעה מהמודל: ${ST[x.sug.st][0]}, ${x.t.slice(0, 60)}`); }catch(err){} }
    else { p.tabaSugNo = p.tabaSugNo || {}; p.tabaSugNo[id] = today(); }
    try{ savePlans(); }catch(err){} refreshOpinion(p); return true; };
  doc.onclick = e => { if(onSug(e)) return; const b = e.target.closest('[data-tk]'); if(!b) return; const [id, st] = b.dataset.tk.split('|'); p.tabaChecks = p.tabaChecks || {};
    const cur = p.tabaChecks[id] || {}; if(cur.st === st){ delete p.tabaChecks[id]; }
    else { let note = cur.note || ''; if(st === 'no'){ const n = prompt('מה חסר או לא עומד? (יופיע בחוות הדעת וברשימת ההשלמות)', note); if(n === null) return; note = n.trim(); }
      p.tabaChecks[id] = { st, note:st === 'no' ? note : '', at:today() }; }
    try{ savePlans(); }catch(err){}
    refreshOpinion(p); };
}
/** רענון מלא של חוות הדעת: תמיד מהרינדור המקורי (אחרת סעיף בנוי נבנה שוב בתוך עצמו), עם הסעיפים שהיו פתוחים */
function refreshOpinion(p){
  const open = [...document.querySelectorAll('#opinionDoc details.op-fold')].map(d => d.open);
  window.renderOpinionTab(p);
  const ds = [...document.querySelectorAll('#opinionDoc details.op-fold')]; if(open.length === ds.length) ds.forEach((d, i) => { d.open = open[i]; });
}
/* דף הבית: ליד כל תוכנית בטיפול, כמה השלמות פתוחות יש לה ליזם */
window.planOpenCompletions = async p => { const G = await completions(p); return G.flatMap(g => g[1]).filter(x => !isDone(p, x)).length; };
/* טבלת התוכניות: ליד מספר התוכנית, בתוכנית בטיפול, כמה השלמות פתוחות יש לה ליזם (מחוות הדעת) */
function badgeRows(){
  document.querySelectorAll('#table tr[onclick] td.col-plannum').forEach(async td => { const m = (td.parentNode.getAttribute('onclick') || '').match(/openProject\((\d+)\)/), p = m && plans.find(x => x.id === +m[1]);
    if(!p || !/בטיפול|דחוף|בהמתנה/.test(p.status || '') || td.querySelector('.todo-badge')) return;
    const n = await window.planOpenCompletions(p).catch(() => null); if(n == null || td.querySelector('.todo-badge')) return;
    td.insertAdjacentHTML('beforeend', `<br><span class="todo-badge${n ? '' : ' ok'}" title="השלמות פתוחות ליזם, מחוות הדעת">${n ? (n === 1 ? 'השלמה אחת' : n + ' השלמות') : 'מוכנה'}</span>`); });
}
function hookHome(){
  const _rt = window.renderTable; if(typeof _rt !== 'function') return;
  window.renderTable = function(){ const r = _rt.apply(this, arguments); setTimeout(badgeRows, 0); return r; };
  setTimeout(badgeRows, 0);
}
function hookOpinion(){
  const _r = window.renderOpinionTab; if(typeof _r !== 'function') return;
  window.opinionSection = section;
  window.renderOpinionTab = function(p){
    secN = 0; lastGrp = null; const r = _r.apply(this, arguments);
    try{ const el = document.getElementById('panel-opinion'), dev = typeof isDeveloper === 'function' && isDeveloper(), arch = typeof isArchitect !== 'function' || isArchitect();
      const tb = el.querySelector('.op-toolbar');
      if(tb && arch && !dev){ const m = tb.querySelector('.muted'); if(m) m.textContent = 'כל סעיף נפתח בלחיצה. שדה ריק מתמלא מהתב"ע ומאנשי הקשר.';
        tb.insertAdjacentHTML('beforeend', `<button class="btn btn-sm" id="opFormOut" title="קובץ עם כל השדות, למילוי של האדריכל">טופס לאדריכל</button><label class="btn btn-sm" title="קובץ הנתונים שהאדריכל החזיר">קליטת טופס<input type="file" id="opFormIn" accept=".json,application/json" hidden></label>`);
        tb.querySelector('#opFormOut').onclick = exportForm; tb.querySelector('#opFormIn').onchange = e => { importForm(e.target.files[0]); e.target.value = ''; }; }
      if(T5C[p.tik] === undefined) loadT5(p.tik).then(x => { if(x && pj && pj() === p) window.renderOpinionTab(p); });
      rebuildOpinion(p);
    }catch(e){ console.warn('opinion', e); }
    // מילוי ממקורות אחרים, פעם אחת לכל פתיחה
    if(!p._filling && (typeof isArchitect !== 'function' || isArchitect())){ p._filling = true;
      renewalOf(p).then(rn => { const n = autofill(p, rn); if(n){ try{ savePlans(); }catch(e){} window.renderOpinionTab(p); say(`${n} שדות ריקים מולאו מהתב"ע ומאנשי הקשר`); } }).finally(() => { setTimeout(() => { delete p._filling; }, 0); }); }
    return r;
  };
  window.addEventListener('beforeprint', () => document.querySelectorAll('#opinionDoc details').forEach(d => { d.dataset.was = d.open ? '1' : ''; d.open = true; }));
  window.addEventListener('afterprint', () => document.querySelectorAll('#opinionDoc details').forEach(d => { d.open = d.dataset.was === '1'; }));
}

/* ── 4. טבלת התוכניות: בטיפול בלבד, לפי המועד הקרוב ── */
function nextDate(p){ const t = today(), ds = [p.forumArchitect, p.forumConsultants, (p.datesPlan||{}).committeePrep, p.committeeDate].map(d => String(d||'').slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= t); return ds.sort()[0] || ''; }
function hookTable(){
  try{ tableViewMode = 'active'; }catch(e){}
  const _rt = window.renderTable; if(typeof _rt !== 'function') return;
  window.renderTable = function(){
    try{ if(sortCol === -1 && Array.isArray(filtered)) filtered.sort((a, b) => { const x = nextDate(a), y = nextDate(b); return x && y ? x.localeCompare(y) : x ? -1 : y ? 1 : 0; }); }catch(e){}
    return _rt.apply(this, arguments);
  };
  try{ if(document.querySelector('.page.active') && document.querySelector('.page.active').id === 'table') applyFilters(); }catch(e){}
}

const CSS = `
.op-grp-h{font:700 11.5px var(--sans);color:var(--teal);margin:14px 0 2px;letter-spacing:.02em}
.op-grp-h:first-child{margin-top:0}
details.op-fold{margin:0 !important;padding:0 !important;border:0 !important;box-shadow:inset 0 -1px 0 #e4e2dc !important;background:none !important;border-radius:0 !important}
details.op-fold > summary{display:flex;align-items:center;gap:8px;list-style:none;cursor:pointer;padding:8px 4px;font:600 14px var(--sans);color:var(--ink)}
details.op-fold > summary::-webkit-details-marker{display:none}
details.op-fold > summary i{font-style:normal;font-weight:400;font-size:11.5px;color:var(--ink-mute);min-width:18px;font-variant-numeric:tabular-nums}
details.op-fold > summary span{flex:1}
details.op-fold > summary::after{content:"+";color:var(--ink-mute);font-weight:400;width:12px;text-align:center}
details.op-fold[open] > summary::after{content:"−"}
details.op-fold > summary:hover{background:#f6f5f1}
details.op-fold > .op-sec-b{padding:2px 4px 14px 4px}
.op-miss{font:600 11.5px var(--sans);color:#9b1c1c;background:#fde3e0;padding:1px 6px}
.op-na{font:400 11.5px var(--sans);color:var(--ink-mute)}
.op-sub{font:600 12.5px var(--sans);color:var(--ink-soft);margin:12px 0 4px}
.op-from{font-size:12.5px;color:var(--muted);margin-top:8px;line-height:1.5}
.t5lotc{margin:4px 0;box-shadow:inset 0 -1px 0 var(--line,#e4e2dc)}.t5lotc summary{cursor:pointer;padding:5px 0;font-weight:600;font-size:13.5px}.t5lotc summary small{font-weight:400;color:var(--ink-mute);margin-inline-start:6px}
.t5bad{color:#c8202a !important;font-weight:600}.t5ct th{width:150px;font-size:12.5px;text-align:start;vertical-align:top}.t5ct td{display:flex;flex-wrap:wrap;gap:4px 12px}
.t5c{font-size:12.5px;white-space:nowrap}.t5c i{font-style:normal;color:var(--ink-mute)}.t5c.over{color:#c8202a;font-weight:600}.t5c sup{color:var(--ink-mute);cursor:help}
.ck-mk{display:inline-flex;gap:2px;margin-inline-start:8px}.ck-mk button{border:1px solid var(--btn-line,#d3d1ca);background:var(--btn-bg,#e9e8e3);font:400 11px var(--sans);padding:0 6px;cursor:pointer}.ck-mk button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.op-purpose{font-size:13px;margin:2px 0 8px;line-height:1.55}.op-purpose small{color:var(--ink-mute)}
.todo-badge{font-size:11px;font-weight:600;color:#8a5a00;background:#fff3d6;padding:1px 6px;white-space:nowrap}.todo-badge.ok{color:#2f6b45;background:#e6f2ea}
.op-todo{margin:2px 0 8px;padding-inline-start:22px;font-size:13px;line-height:1.55}.op-todo li{margin:2px 0}
.op-todo li.done span{text-decoration:line-through;color:var(--ink-mute)}.op-todo li small{color:#2f6b45;font-weight:600}.todo-ck{display:inline-flex;gap:3px;align-items:center;font-size:11.5px;color:var(--ink-mute);margin-inline-end:8px;cursor:pointer}
.op-title small{font-weight:400;font-size:13px;color:var(--ink-mute)}
.ck-sum{font-size:13px;margin:2px 0 6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ck-sum .btn{margin-inline-start:auto}
.ck-list{list-style:none;margin:0;padding:0}.ck-list li{display:grid;grid-template-columns:78px 1fr;gap:8px;padding:4px 0;box-shadow:inset 0 -1px 0 var(--line,#eeede8);font-size:13px;line-height:1.45}
.ck-st{font-size:11.5px;font-weight:600;padding:1px 6px;align-self:start;text-align:center}.ck-t small{color:var(--ink-mute)}.ck-t em{display:block;font-style:normal;color:var(--ink-soft);font-size:12.5px}
.ck-no .ck-st{background:#fde8e6;color:#c8202a}.ck-yes .ck-st{background:#e6f2ea;color:#2f6b45}.ck-na .ck-st{background:#f1f0ec;color:var(--ink-mute)}.ck-open .ck-st{background:#f6f5f1;color:#8a8478}.ck-open .ck-t{color:var(--ink-soft)}
.op-toolbar{gap:6px;flex-wrap:wrap}
@media print{ .op-grp-h{margin-top:10px} details.op-fold > summary::after{display:none} }
`;
function boot(){
  if(typeof plans === 'undefined' || typeof window.renderOpinionTab !== 'function' || typeof window.renderTable !== 'function') return setTimeout(boot, 60);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  hookOpinion(); hookTable(); hookHome();
}
const api = { formHTML, applyForm, autofill, nextDate };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else { window.PlanOpinion = api; boot(); }
})();
