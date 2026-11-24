/* ══════════════════════════════════════════════════════════════════
   plans-import.js: הנתונים מ"מרחב מדבר", הדשבורד של אדריכלית העיר (ענת, 23.11.2026).
   - data/merhav-import.json נבנה ב-tools/import-merhav.py מייצוא לקריאה בלבד של "מרחב מדבר".
   - כל ערך נכנס רק לשדה ריק, פעם אחת לכל שדה (_mmDone). שדה שנערך ידנית (_userEdited) לא נוגעים בו.
   - שדה שמולא מסומן בכחול: אותו מנגנון של _seeded ו-ai-seeded שכבר קיים באפליקציה. עריכה ידנית מסירה את הכחול.
   - שדה ריק בכרטיס התוכנית מסומן באדום, להשלמה.
   - אנשי קשר (יזם, אדריכל, מנהל פרויקט) נכנסים למאגר אנשי הקשר. איש קשר קיים לפי שם מקבל רק את מה שחסר לו.
   - מסמכים והדמיות נכנסים לרשימת המסמכים של התוכנית, עם קישור לקובץ ב"מרחב מדבר".
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const SRC = 'מרחב מדבר';
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say = m => { try{ toast(m); }catch(e){} };
const key = s => String(s||'').replace(/\s+/g, '');
const nm = s => String(s||'').replace(/^(אד'|אדר'|אדריכל)\s*/, '').replace(/[\s"'׳״.,-]+/g, '').toLowerCase();
let DATA = null;

function getPath(p, path){ return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), p); }
function setPath(p, path, v){ const a = path.split('.'), last = a.pop(); let o = p; a.forEach(k => { if(!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }); o[last] = v; }
const empty = v => v == null || String(v).trim() === '' || String(v).trim() === '—';

/** ממלא תוכנית אחת. מחזיר כמה ערכים נכנסו */
function applyPlan(p, rec, src){
  let n = 0; p._seeded = p._seeded || {}; p._mmDone = p._mmDone || {}; const ue = p._userEdited || {};
  Object.entries(rec.fields || {}).forEach(([path, v]) => {
    if(p._mmDone[path] || ue[path]) return; p._mmDone[path] = 1;
    if(!empty(getPath(p, path))) return;
    setPath(p, path, v); p._seeded[path] = 1; n++; });
  if(rec.dept && !p.mmDept){ p.mmDept = rec.dept; n++; }
  if(Array.isArray(rec.docs) && rec.docs.length){ p.documents = Array.isArray(p.documents) ? p.documents : []; const have = new Set(p.documents.map(d => d && d.url));
    rec.docs.forEach(d => { if(!have.has(d.url) && !p._mmDone['doc:'+d.url]){ p._mmDone['doc:'+d.url] = 1; p.documents.push({ name:d.name, type:d.type || '', url:d.url, date:d.date || DATA.readAt, src:src || SRC }); n++; } }); }
  return n;
}
/** אנשי קשר: יזם, אדריכל ומנהל פרויקט */
function applyContacts(){
  if(typeof contacts === 'undefined' || !Array.isArray(contacts)) return 0;
  let n = 0;
  const add = (tik, type, name, phone, email, address, org) => {
    if(empty(name)) return;
    if(typeof window.upsertContact === 'function'){ n += window.upsertContact({ name, type, org:org || '', phone:phone || '', email:email || '', address:address || '', src:SRC }, tik); return; }   // plans-contacts.js
    const k = nm(name); let c = contacts.find(x => nm(x.name) === k);
    if(!c){ c = { id:(typeof _cid === 'function' ? _cid() : 'c'+Date.now()), name, type, org:org || '', phone:phone || '', email:email || '', address:address || '', plans:[], notes:'', sample:false, src:SRC, _seeded:1 }; contacts.push(c); n++; }
    else { if(empty(c.phone) && phone){ c.phone = phone; n++; } if(empty(c.email) && email){ c.email = email; n++; } }
    c.plans = Array.isArray(c.plans) ? c.plans : []; if(!c.plans.map(String).includes(String(tik))){ c.plans.push(String(tik)); n++; } };
  livePlans().forEach(p => { const r = recFor(p); if(!r) return; const f = r.fields || {};
    add(p.tik, 'אדריכל', f['meta.archName'], f['meta.archPhone'], f['meta.archEmail'], f['meta.archAddress']);
    add(p.tik, 'יזם', f.developer, f['meta.devPhone'], f['meta.devEmail'], f['meta.devAddress'], f.developer);
    add(p.tik, 'מנהל פרויקט', f['meta.contactName'], f['meta.contactPhone'], f['meta.contactEmail']); });
  if(n){ try{ saveContacts(); }catch(e){} }
  return n;
}
function recFor(p){ return DATA && DATA.plans[key(p.planNum)] ? DATA.plans[key(p.planNum)] : null; }
/* מקור נוסף באותו מבנה: data/concept-import.json, פרטים שחולצו ממצגות של תכנון רעיוני (ענת, 24.11.2026, תיק 1909).
   אותם כללים: רק שדה ריק, פעם אחת לכל שדה, לא שדה שנערך ידנית, וסימון בכחול. המקור נרשם על כל מסמך */
let EXTRA = null;
const extraFor = p => EXTRA && EXTRA.plans[key(p.planNum)] ? EXTRA.plans[key(p.planNum)] : null;

async function run(){
  if(!DATA){ try{ const raw = await (await fetch('data/merhav-import.json?v=1123k')).json(); DATA = { ...raw, plans:Object.fromEntries(Object.entries(raw.plans).map(([k, v]) => [key(k), v])) }; }catch(e){ console.warn('merhav import', e); return; } }
  if(!EXTRA){ try{ const raw = await (await fetch('data/concept-import.json?v=1124a')).json(); EXTRA = { ...raw, plans:Object.fromEntries(Object.entries(raw.plans).map(([k, v]) => [key(k), v])) }; }catch(e){ EXTRA = { plans:{} }; } }
  if(typeof isArchitect === 'function' && typeof session !== 'undefined' && session && !isArchitect()) return;   // רק אדריכלית העיר משנה נתונים
  let n = 0, plansHit = 0;
  livePlans().forEach(p => { const r = recFor(p), x = extraFor(p); let k = 0; if(r) k += applyPlan(p, r); if(x) k += applyPlan(p, x, x.src || EXTRA.source); if(k){ n += k; plansHit++; } });
  if(n){ try{ savePlans(); }catch(e){} }
  const waitC = () => { if(typeof _contactsLoaded !== 'undefined' && !_contactsLoaded) return setTimeout(waitC, 300); const c = applyContacts();
    if(n || c) say(`ממרחב מדבר ומהמצגות: ${n} ערכים ב-${plansHit} תוכניות${c ? `, ${c} עדכוני אנשי קשר` : ''}. מסומנים בכחול`); };
  waitC();
  try{ const a = document.querySelector('.page.active'); if(a && a.id === 'table' && typeof applyFilters === 'function') applyFilters(); if(a && a.id === 'projectPage' && typeof pj === 'function' && pj()){ renderInfoTab(pj()); mark(); } }catch(e){}
}

/* ── סימון: כחול למה שמולא, אדום למה שחסר ── */
function pathOf(el){ const m = String(el.getAttribute('onchange') || '').match(/(pjSet|mSet)\('([^']+)'/); return m ? (m[1] === 'mSet' ? 'meta.' + m[2] : m[2]) : null; }
function mark(){
  const p = typeof pj === 'function' && pj(), root = document.getElementById('panel-info'); if(!p || !root) return;
  let miss = 0, blue = 0;
  root.querySelectorAll('.pp-field input, .pp-field textarea, .pp-field select').forEach(el => {
    if(el.type === 'file' || el.type === 'checkbox' || el.dataset.always === 'ro') return; const path = pathOf(el); if(!path) return;   // במצב תצוגה השדות נעולים, ועדיין מסמנים
    if(p._seeded && p._seeded[path]){ el.classList.add('ai-seeded'); el.title = 'מולא מ' + SRC; blue++; }
    const isEmpty = !String(el.value || '').trim() || el.value === '—'; el.classList.toggle('mm-missing', isEmpty); if(isEmpty) miss++;
    if(!el._mmBound){ el._mmBound = true; el.addEventListener('input', () => el.classList.toggle('mm-missing', !String(el.value || '').trim())); } });
  let lg = document.getElementById('mmLegend');
  if(!lg){ lg = document.createElement('div'); lg.id = 'mmLegend'; lg.className = 'mm-legend no-print'; root.insertBefore(lg, root.firstChild); }
  lg.innerHTML = `<span class="mm-b">כחול</span> מולא אוטומטית, מ${SRC} ומהמסמכים (${blue}) <span class="mm-r">אדום</span> חסר להשלמה (${miss})`;
}
/* דרישות לפי גורם מהוראות התוכנית: לסעיף "חוות דעת הגורמים" בחוות הדעת */
function deptBlock(p){
  if(!p.mmDept) return '';
  return `<details class="mm-dept"><summary>דרישות לפי גורם, מהוראות התוכנית (${SRC}) <b>${Object.keys(p.mmDept).length}</b></summary>
    <dl>${Object.entries(p.mmDept).map(([k, v]) => `<dt>${H(k)}</dt><dd class="ai-seeded">${H(String(v).slice(0, 1200))}</dd>`).join('')}</dl></details>`;
}
function hook(){
  const wrap = (name, after) => { const o = window[name]; if(typeof o !== 'function') return; window[name] = function(){ const r = o.apply(this, arguments); try{ after.apply(this, arguments); }catch(e){ console.warn('mm '+name, e); } return r; }; };
  wrap('renderInfoTab', () => setTimeout(mark, 0));
  wrap('infoGo', () => setTimeout(mark, 0));
  wrap('renderOpinionTab', p => { const el = document.getElementById('panel-opinion'); if(!el || !p) return;
    const sec = [...el.querySelectorAll('.op-sec')].find(s => /חוות דעת הגורמים/.test(s.textContent.slice(0, 80))); const b = deptBlock(p);
    if(sec && b){ const body = sec.querySelector('.op-sec-b') || sec; body.insertAdjacentHTML('beforeend', b); } });
  // אחרי הענן הנתונים נטענים מחדש: מחילים שוב (רק שדות ריקים)
  const _cl = window.cloudLoad; if(typeof _cl === 'function') window.cloudLoad = async function(){ const r = await _cl.apply(this, arguments); setTimeout(run, 50); return r; };
}
const CSS = `
#panel-info .pp-field input.mm-missing,#panel-info .pp-field textarea.mm-missing,#panel-info .pp-field select.mm-missing{box-shadow:inset 0 0 0 1.5px #c8202a !important;background:#fff6f5 !important;min-height:30px}
#panel-info .pp-field:has(.mm-missing) > label{color:#c8202a !important;font-weight:600}
.mm-legend{display:flex;gap:6px 12px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:var(--ink-soft);margin:0 0 8px}
.mm-legend span{font-weight:600;padding:0 6px}
.mm-b{color:#1a56db;box-shadow:inset 0 -2px 0 #1a56db}
.mm-r{color:#c8202a;background:#fff6f5;box-shadow:inset 0 0 0 1.5px #c8202a}
.mm-dept{margin-top:10px}.mm-dept summary{cursor:pointer;font-weight:600;font-size:13px}.mm-dept summary b{font-weight:400;color:var(--ink-mute)}
.mm-dept dl{margin:6px 0 0}.mm-dept dt{font-weight:600;font-size:12.5px;margin-top:8px}.mm-dept dd{margin:2px 0 0;font-size:12.5px;line-height:1.55}
@media print{.mm-missing{box-shadow:none !important;background:none !important}}
`;
function boot(){
  if(typeof plans === 'undefined' || typeof livePlans !== 'function' || !plans.length || typeof savePlans !== 'function' || typeof renderInfoTab !== 'function') return setTimeout(boot, 80);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  hook(); setTimeout(run, 600);
}
boot();
})();
