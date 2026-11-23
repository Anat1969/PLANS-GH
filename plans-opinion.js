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
const GROUPS = { 'op-grp-id':'זיהוי', 'op-grp-info':'המבוקש והמותר', 'op-grp-check':'בדיקת ההתאמה', 'op-grp-concl':'תנאים', 'op-grp-rec':'המלצה' };
const today = () => { const d = new Date(), z = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; };

/* ── 1. סעיפים מקופלים ── */
let secN = 0, lastGrp = null;
function section(title, cls, body){
  const b = String(body), miss = (b.match(/<\/b>\s*—\s*(מ״ר)?\s*<\/div>|<td>—<\/td>/g) || []).length;
  const empty = !b.replace(/<[^>]+>/g, '').trim() || /<tbody>\s*<\/tbody>/.test(b);
  const head = cls !== lastGrp && GROUPS[cls] ? `<div class="op-grp-h">${GROUPS[cls]}</div>` : ''; lastGrp = cls; secN++;
  const open = cls === 'op-grp-rec' || (cls === 'op-grp-id');
  return head + `<details class="op-sec op-fold ${cls||''}" ${open?'open':''}><summary><i>${secN}</i><span>${title}</span>${miss ? `<b class="op-miss">${miss} חסרים</b>` : empty ? '<b class="op-na">ריק</b>' : ''}</summary><div class="op-sec-b">${body}</div></details>`;
}

/* ── 2. מילוי ממקורות אחרים: רק שדה ריק ── */
const rnCache = {};
async function renewalOf(p){
  const set = window.layerSets && window.layerSets[String(p.tik)]; if(!set || !set.renewal) return null;
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
      const t5 = T5C[p.tik]; if(t5 === undefined) loadT5(p.tik).then(x => { if(x && pj && pj() === p) window.renderOpinionTab(p); });
      const sec = [...el.querySelectorAll('details.op-fold')].find(d => /טבלה 5/.test(d.querySelector('summary').textContent)), lb = lotsBlock(p) + t5Card(p, t5);
      if(sec && lb) sec.querySelector('.op-sec-b').insertAdjacentHTML('beforeend', lb);
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
.op-toolbar{gap:6px;flex-wrap:wrap}
@media print{ .op-grp-h{margin-top:10px} details.op-fold > summary::after{display:none} }
`;
function boot(){
  if(typeof plans === 'undefined' || typeof window.renderOpinionTab !== 'function' || typeof window.renderTable !== 'function') return setTimeout(boot, 60);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  hookOpinion(); hookTable();
}
const api = { formHTML, applyForm, autofill, nextDate };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else { window.PlanOpinion = api; boot(); }
})();
