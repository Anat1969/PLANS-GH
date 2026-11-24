/* ══════════════════════════════════════════════════════════════════
   plans-contacts.js: אנשי קשר בלי כפילות, ואייקונים קטנים במקום כפתורים (ענת, 24.11.2026).
   1. אייקונים: "חיוג", "מייל", "העתק מייל", "שלח מייל", "עריכה", "מחק" ו"הסר שיוך" מוחלפים
      באייקון בקו דק, עם השם בריחוף (title) ולקורא מסך (aria-label). רק במאגר אנשי הקשר,
      בגורמי העירייה ובאנשי הקשר של התוכנית. הפונקציות המקוריות לא משתנות: השכבה עוברת על התצוגה.
      זה חריג מתועד לכלל "בלי אייקונים", לבקשת ענת.
   2. בטופס איש קשר חדש: רשימת השמות שבמאגר. שם קיים ממלא את הפרטים הקבועים בשדות ריקים,
      והשמירה מעדכנת את הרשומה הקיימת במקום ליצור חדשה.
   3. upsertContact(rec, tik): כל הכנסה שלי (מהתב"ע, מ"מרחב מדבר") עוברת כאן. חיפוש לפי מייל,
      אחר כך לפי שם, אחר כך לפי טלפון וארגון. משלים רק שדה ריק ומוסיף שיוך לתוכנית.
   4. בעלי העניין מסעיף 1.8 בהוראות התב"ע (data/taba/<תיק>.json) נכנסים למאגר דרך upsertContact.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const svg = d => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  mail:  svg('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/>'),
  copy:  svg('<rect x="9" y="9" width="12" height="12" rx="1"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
  edit:  svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  unlink:svg('<path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/><path d="m4 4 16 16"/>')
};
const MAP = { 'חיוג':['phone','חיוג'], 'מייל':['mail','מייל'], 'העתק מייל':['copy','העתקת המייל'], 'שלח מייל':['mail','טיוטת מייל'],
  'עריכה':['edit','עריכה'], '✎ עריכה':['edit','עריכה'], 'מחק':['trash','מחיקה'], 'הסר שיוך':['unlink','הסרת השיוך לתוכנית'] };
const SCOPE = '#contactsBody, #projContacts, #muniDepartments, .muni-contact';
const SEL = 'a.c-ico, .btn, button';

function iconize(root){
  (root || document).querySelectorAll(SCOPE).forEach(box => box.querySelectorAll(SEL).forEach(el => {
    if(el.dataset.ic) return; const m = MAP[el.textContent.trim()]; if(!m) return;
    el.dataset.ic = m[0]; el.innerHTML = ICON[m[0]]; el.title = m[1]; el.setAttribute('aria-label', m[1]);
    el.classList.add('ic-btn'); el.classList.remove('btn-ghost', 'btn-xs', 'btn-sm', 'btn', 'c-ico');
  }));
}
let pend = 0;
function watch(){
  iconize();
  new MutationObserver(() => { if(pend) return; pend = requestAnimationFrame(() => { pend = 0; iconize(); }); })
    .observe(document.body, { childList:true, subtree:true });
}

/* ── התאמה ── */
const nm = s => String(s||'').replace(/^(אד'|אדר'|אדריכל)\s*/, '').replace(/[\s"'׳״.,-]+/g, '').toLowerCase();
const ph = s => String(s||'').replace(/\D/g, '');
const em = s => String(s||'').trim().toLowerCase();
const empty = v => v == null || String(v).trim() === '' || String(v).trim() === '—';
function list(){ try{ return contacts; }catch(e){ return null; } }

function findMatch(rec, ignoreId){
  const L = list() || [];
  const other = L.filter(c => c.id !== ignoreId);
  if(rec.email){ const c = other.find(c => em(c.email) && em(c.email) === em(rec.email)); if(c) return c; }
  if(rec.name){ const c = other.find(c => nm(c.name) && nm(c.name) === nm(rec.name)); if(c) return c; }
  if(rec.phone && rec.org){ const c = other.find(c => ph(c.phone) && ph(c.phone) === ph(rec.phone) && nm(c.org) === nm(rec.org)); if(c) return c; }
  return null;
}
/** מכניס או משלים. מחזיר כמה שינויים נעשו */
function upsertContact(rec, tik){
  const L = list(); if(!L || empty(rec.name)) return 0;
  let n = 0, c = findMatch(rec);
  if(!c){
    c = { id:(typeof _cid === 'function' ? _cid() : 'c' + Date.now() + Math.random().toString(36).slice(2, 6)), name:rec.name, type:rec.type || 'אחר',
      org:rec.org || '', title:rec.title || '', phone:rec.phone || '', email:rec.email || '', address:rec.address || '', notes:'', plans:[], sample:false,
      src:rec.src || '', sources:rec.src ? [rec.src] : [], _seeded:1 };
    L.push(c); n++;
  } else {
    ['org', 'title', 'phone', 'email', 'address'].forEach(k => { if(empty(c[k]) && !empty(rec[k])){ c[k] = rec[k]; n++; } });
    if(rec.src){ c.sources = Array.isArray(c.sources) ? c.sources : []; if(!c.sources.includes(rec.src)){ c.sources.push(rec.src); n++; } }
  }
  if(tik != null){ c.plans = Array.isArray(c.plans) ? c.plans : []; if(!c.plans.map(String).includes(String(tik))){ c.plans.push(String(tik)); n++; } }
  return n;
}
window.upsertContact = upsertContact;
window.findContactMatch = findMatch;

/* ── בעלי העניין מהתב"ע ── */
const TYPE = { 'יזם':'יזם', 'מגיש התכנית':'יזם', 'עורך התכנית':'אדריכל' };
/** "חברה (אדם, תפקיד)" או "אדם, חברה": מפרק לשם, ארגון ותפקיד */
function parseParty(raw){
  let s = String(raw||'').trim(), org = '', name = '', title = '';
  const m = s.match(/^(.*?)\s*\((.*)\)$/);
  if(m){ org = m[1]; const inner = m[2].replace(/מורשה חתימה:?\s*/g, '').split(',').map(x => x.trim()).filter(Boolean);
    if(org.includes(',')){ const [a, ...b] = org.split(','); name = a.trim(); org = b.join(',').trim(); title = inner.join(', '); }
    else { name = inner.shift() || org; title = inner.join(', '); } }
  else if(s.includes(',')){ const [a, ...b] = s.split(','); name = a.trim(); org = b.join(',').trim(); }
  else { name = s; org = s; }
  if(/^מורשה חתימה$/.test(title)) title = '';
  return { name, org, title };
}
async function tabaParties(){
  let P = []; try{ P = livePlans(); }catch(e){ return; }
  if(typeof session !== 'undefined' && session && typeof isArchitect === 'function' && !isArchitect()) return;
  let n = 0;
  for(const p of P){
    if(!(typeof planIsActive !== 'function' || planIsActive(p))) continue;
    let d; try{ const r = await fetch(`data/taba/${encodeURIComponent(p.tik)}.json?v=1124a`); if(!r.ok) continue; d = await r.json(); }catch(e){ continue; }
    (d.parties || []).forEach(x => {
      if(/עיריית אשדוד/.test(x.name) || !TYPE[x.role]) return;
      const q = parseParty(x.name);
      n += upsertContact({ ...q, type:TYPE[x.role], phone:x.phone || '', email:x.email || '', src:`הוראות התב"ע, סעיף ${x.section || '1.8'}` }, p.tik);
    });
  }
  if(n){ try{ saveContacts(); }catch(e){} }
}
window._parseParty = parseParty;

/* ── הטופס: שם קיים ממלא את הפרטים הקבועים ── */
function hookForm(){
  const orig = window.contactEdit, origSave = window.contactSave;
  if(typeof orig !== 'function' || orig._hooked) return;
  window.contactEdit = function(id){
    orig.apply(this, arguments);
    if(id) return;
    const inp = document.getElementById('cf_name'); if(!inp) return;
    const L = list() || [];
    const dl = document.createElement('datalist'); dl.id = 'cf_names';
    dl.innerHTML = L.filter(c => c.name).map(c => `<option value="${String(c.name).replace(/"/g, '&quot;')}">${String(c.org||'').replace(/</g, '&lt;')}</option>`).join('');
    inp.after(dl); inp.setAttribute('list', 'cf_names'); inp.setAttribute('autocomplete', 'off');
    const note = document.createElement('div'); note.className = 'cf-match'; note.hidden = true; dl.after(note);
    const form = inp.closest('.ver-modal');
    const fill = () => {
      const c = findMatch({ name:inp.value.trim(), email:(document.getElementById('cf_email')||{}).value, phone:(document.getElementById('cf_phone')||{}).value });
      if(!c){ delete form.dataset.match; note.hidden = true; return; }
      form.dataset.match = c.id;
      [['cf_type','type'], ['cf_org','org'], ['cf_title','title'], ['cf_phone','phone'], ['cf_email','email'], ['cf_notes','notes'], ['cf_tasks','tasks']].forEach(([fid, k]) => {
        const el = document.getElementById(fid); if(!el || empty(c[k])) return;
        if(el.tagName === 'SELECT'){ if(!el.dataset.touched) el.value = c[k]; } else if(empty(el.value)) el.value = c[k]; });
      form.querySelectorAll('.cf-plans input').forEach(cb => { if((c.plans||[]).map(String).includes(cb.value)) cb.checked = true; });
      note.hidden = false; note.textContent = `נמצא במאגר: ${c.name}${c.org ? ', ' + c.org : ''}. הפרטים הושלמו, והשמירה תעדכן את הרשומה הקיימת.`;
    };
    const sel = document.getElementById('cf_type'); if(sel) sel.addEventListener('change', () => { sel.dataset.touched = 1; });
    inp.addEventListener('change', fill); inp.addEventListener('input', () => { if(findMatch({ name:inp.value.trim() })) fill(); else { delete form.dataset.match; note.hidden = true; } });
    ['cf_email', 'cf_phone'].forEach(fid => { const el = document.getElementById(fid); if(el) el.addEventListener('change', fill); });
  };
  window.contactEdit._hooked = true;
  window.contactSave = function(id){
    const form = document.querySelector('.render-lightbox .ver-modal');
    if(!id && form && form.dataset.match) return origSave.call(this, form.dataset.match);
    return origSave.apply(this, arguments);
  };
}

function boot(){
  hookForm(); watch();
  const wait = () => { if(typeof _contactsLoaded !== 'undefined' && !_contactsLoaded) return setTimeout(wait, 400); tabaParties(); };
  setTimeout(wait, 1500);
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
