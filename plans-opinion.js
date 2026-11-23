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
function formHTML(p){
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
  const meta = { app:'ashdod-plans-form', v:1, tik:String(p.tik), planNum:p.planNum||'', sentAt:today(), lots:(p.plots||[]).filter(x => x && x.num).map(x => String(x.num)) };
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
#msg{font-size:13.5px;color:#1f5c58}@media print{.bar,.how{display:none}body{padding:0}input,textarea{box-shadow:inset 0 -1px 0 #999}.miss{background:none}}
</style></head><body>
<h1>טופס נתונים לחוות דעת</h1>
<p class="sub">תוכנית בינוי ועיצוב <b>${H(p.planNum||'')}</b> · תיק <b>${H(p.tik)}</b> · עיריית אשדוד, אדריכלית העיר · נשלח ${H(today().split('-').reverse().join('.'))}</p>
<div class="how"><b>איך ממלאים:</b> משלימים את השדות המסומנים בצהוב, לוחצים "שמירת קובץ הנתונים", ושולחים את הקובץ שירד בחזרה לאדריכלית העיר. עמודת "מותר" מציגה את הוראות התוכנית, ואינה לעריכה.</div>

<h2>1. זיהוי הפרויקט</h2>
<div class="grid">${idRows.map(([k, l]) => `<div><label>${l}</label>${inp('id.'+k, p[k])}</div>`).join('')}</div>

<h2>2. תקציר המבוקש</h2>
<textarea data-k="description" rows="4" placeholder="תיאור התוכנית: מה מוצע, כמה מבנים, שימושים ועיקרי הבינוי"${miss((p.opinion||{}).description)}>${H((p.opinion||{}).description||'')}</textarea>

<h2>3. זכויות הבנייה: מותר מול מבוקש</h2>
<table><thead><tr><th>נושא</th><th>מותר</th><th>מבוקש</th><th>הסבר לפער</th></tr></thead><tbody>${t5}</tbody></table>

${lots ? `<h2>4. המבוקש לפי מגרש</h2>
<table><thead><tr><th>מגרש</th><th>מותר</th><th>יח"ד</th><th>קומות</th><th>גובה (מ')</th><th>שטח עיקרי (מ"ר)</th><th>מקומות חניה</th></tr></thead><tbody>${lots}</tbody></table>` : ''}

<h2>${lots ? 5 : 4}. אנשי קשר</h2>
<div class="grid">
<div><label>שם איש הקשר של היזם</label>${inp('ct.dev.name', (ct.dev||{}).name)}</div><div><label>טלפון</label>${inp('ct.dev.phone', (ct.dev||{}).phone)}</div><div><label>דוא"ל</label>${inp('ct.dev.email', (ct.dev||{}).email)}</div>
<div><label>שם האדריכל האחראי</label>${inp('ct.arch.name', (ct.arch||{}).name)}</div><div><label>טלפון</label>${inp('ct.arch.phone', (ct.arch||{}).phone)}</div><div><label>דוא"ל</label>${inp('ct.arch.email', (ct.arch||{}).email)}</div>
</div>

<h2>${lots ? 6 : 5}. הערות האדריכל</h2>
<textarea data-k="remarks" rows="3" placeholder="כל מה שחשוב שאדריכלית העיר תדע"></textarea>

<div class="bar"><button id="save">שמירת קובץ הנתונים</button><button class="sec" onclick="print()">הדפסה</button><label style="margin:0;display:flex;gap:6px;align-items:center">ממלא הטופס <input id="by" style="width:200px" placeholder="שם מלא"></label><span id="msg"></span></div>
<script>
var META = ${JSON.stringify(meta).replace(/</g, '\\u003c')};
document.addEventListener('input', function(e){ var k = e.target.dataset && e.target.dataset.k; if(k && k.indexOf('.note') < 0 && k !== 'remarks') e.target.classList.toggle('miss', !e.target.value.trim()); });
document.getElementById('save').onclick = function(){
  var out = { app:META.app, v:META.v, tik:META.tik, planNum:META.planNum, sentAt:META.sentAt, filledAt:new Date().toISOString().slice(0,10), by:document.getElementById('by').value.trim(), lots:META.lots, f:{} };
  var left = 0; document.querySelectorAll('[data-k]').forEach(function(el){ var v = el.value.trim(); if(v) out.f[el.dataset.k] = v; else if(el.dataset.k.indexOf('.note') < 0 && el.dataset.k !== 'remarks') left++; });
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type:'application/json' })); a.download = 'form-' + META.tik + '.json'; a.click();
  document.getElementById('msg').textContent = 'הקובץ form-' + META.tik + '.json נשמר.' + (left ? ' נשארו ' + left + ' שדות ריקים.' : ' כל השדות מלאים.') + ' שלחו אותו לאדריכלית העיר.';
};
</script></body></html>`;
}
function exportForm(){
  const p = typeof pj === 'function' && pj(); if(!p) return;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([formHTML(p)], { type:'text/html' })); a.download = `tofes-${p.tik}.html`; a.click();
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
    else if(a[0] === 'ct'){ (ct[a[1]] = ct[a[1]] || {})[a[2]] = v; } });
  p.archForm = { receivedAt:today(), filledAt:d.filledAt||'', by:d.by||'', remarks:d.f.remarks||'', contacts:ct };
  return { set, kept };
}
function importForm(file){
  const p = typeof pj === 'function' && pj(); if(!p || !file) return;
  const rd = new FileReader(); rd.onload = () => { let d = null; try{ d = JSON.parse(rd.result); }catch(e){ return say('הקובץ לא נקרא. צריך את קובץ הנתונים (json) שהטופס שומר'); }
    const r = applyForm(p, d); if(r.err) return say(r.err);
    try{ if(typeof logAction === 'function') logAction(p, 'doc', `נקלט טופס האדריכל${d.by ? ' ('+d.by+')' : ''}: ${r.set} שדות`); else savePlans(); }catch(e){}
    try{ savePlans(); renderOpinionTab(p); if(typeof renderReviewTab === 'function') renderReviewTab(p); }catch(e){}
    say(`נקלטו ${r.set} שדות מהטופס${r.kept ? `. ${r.kept} שדות שכבר מולאו נשארו כפי שהיו` : ''}`); };
  rd.readAsText(file);
}
/** מה שהאדריכל ביקש לכל מגרש, ומה שנקלט מהטופס: נוסף לסעיף הזכויות */
function lotsBlock(p){
  const ls = (p.plots||[]).filter(x => x && x.proposed && Object.keys(x.proposed).length), af = p.archForm;
  const t = ls.length ? `<div class="tbl-wrap"><table class="op-tbl"><thead><tr><th>מגרש</th><th>יח״ד מבוקש</th><th>קומות</th><th>גובה</th><th>שטח עיקרי</th><th>חניה</th></tr></thead><tbody>${ls.map(x => `<tr><td>${H(x.num)}</td><td>${H(x.proposed.units||'—')}</td><td>${H(x.proposed.floors||'—')}</td><td>${H(x.proposed.height||'—')}</td><td>${H(x.proposed.main||'—')}</td><td>${H(x.proposed.parking||'—')}</td></tr>`).join('')}</tbody></table></div>` : '';
  const c = af && af.contacts ? Object.entries(af.contacts).map(([k, v]) => `${k==='dev'?'יזם':'אדריכל'}: ${[v.name, v.phone, v.email].filter(Boolean).map(H).join(', ')}`).join(' · ') : '';
  return (t ? `<div class="op-sub">המבוקש לפי מגרש, מטופס האדריכל</div>${t}` : '') + (af ? `<div class="op-from">טופס האדריכל נקלט ${H(String(af.receivedAt).split('-').reverse().join('.'))}${af.by ? ', מולא על ידי ' + H(af.by) : ''}${c ? '. ' + c : ''}${af.remarks ? `<br>הערות: ${H(af.remarks)}` : ''}</div>` : '');
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
      const sec = [...el.querySelectorAll('details.op-fold')].find(d => /טבלה 5/.test(d.querySelector('summary').textContent)), lb = lotsBlock(p);
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
