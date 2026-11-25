/* ══════════════════════════════════════════════════════════════════
   plans-team.js (ענת, 25.11.2026): שם התוכנית, צוות ומייל אחד, יומן היסטוריה, דוח הערות, תמונות במסגרות.
   1. שם התוכנית בגדול: תב/<מספר> · רובע · רחוב (הכתובת בתיק, או הרחוב שהתוכנית יושבת עליו מ-plans-axis.js).
   2. איש קשר פעם אחת: רשומות כפולות (אותו מייל, או אותו שם בלי מייל סותר) מתאחדות. גיבוי לפני האיחוד.
      שני אנשים באותו שם ובמיילים שונים נשארים נפרדים, ומדווחים.
   3. צוות התוכנית: כל אנשי הקשר שלה (planPeople מ-plans-opinion.js), ו"מייל לצוות": טיוטה אחת לכולם.
   4. היסטוריה: יומן הפעולות, מועדים שהוחלפו, החלטות והערות, לפי תאריך. אפשר להוסיף הערה.
   5. דוח הערות: ההשלמות ליזם, הנחיות המודל והערות התוכנית, בנוסח מוכן להעתקה או לטיוטת מייל לצוות.
   6. תמונות במסגרות: מסגרת ריקה בלשונית הגרפיקה (p.graphics) מקבלת חומר מתאים מחומרי התוכנית, עם מקור. רק מסגרת ריקה.
   7. הסבר בריחוף: כפתור עם אייקון מציג את שמו מיד.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T = () => { try{ return todayStr(); }catch(e){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); } };
const F = d => { const m = String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(d||''); };
const say = m => { try{ toast(m); }catch(e){} };

/* ── 1. שם התוכנית ── */
function projName(p){
  if(!p) return '';
  const tav = p.planNum ? (/תב/.test(p.planNum) ? String(p.planNum) : 'תב/' + p.planNum) : 'תב/' + p.tik;
  const rova = p.district ? (/רובע|אזור|מתחם/.test(p.district) ? p.district : 'רובע ' + p.district) : '';
  const street = String((p.meta && p.meta.address) || p._street || '').trim();
  return [tav, rova, street || p.projectName || ''].filter(Boolean).join(' · ');
}
window.projName = projName;
async function fillStreet(p){ if(!p || p._street !== undefined || (p.meta && p.meta.address)) return false;
  p._street = ''; try{ if(typeof window.planStreet === 'function'){ const s = await window.planStreet(p); p._street = s ? String(s).replace(/\s*\(.*\)\s*$/, '') : ''; } }catch(e){}
  return !!p._street; }
window.planStreetName = fillStreet;

/* ── 7. הסבר בריחוף ── */
let tip = null;
function hoverTips(){
  document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('button[title],a[title],[data-tip]'); if(!b || !b.querySelector('svg') && !b.dataset.tip) return;
    const t = b.dataset.tip || b.getAttribute('title'); if(!t) return; if(b.hasAttribute('title')){ b.dataset.tip = t; b.removeAttribute('title'); }
    tip = tip || Object.assign(document.createElement('div'), { className:'tm-tip' }); tip.textContent = t; document.body.appendChild(tip);
    const r = b.getBoundingClientRect(); tip.style.left = Math.max(4, Math.min(innerWidth - tip.offsetWidth - 4, r.left + r.width/2 - tip.offsetWidth/2)) + 'px';
    tip.style.top = (r.top > 40 ? r.top - tip.offsetHeight - 6 : r.bottom + 6) + 'px'; tip.style.opacity = 1; });
  document.addEventListener('mouseout', e => { if(tip && e.target.closest && e.target.closest('[data-tip]')) tip.style.opacity = 0; });
  document.addEventListener('click', () => { if(tip) tip.style.opacity = 0; }, true);
}

/* ── 2. איש קשר פעם אחת ── */
const nm = s => String(s||'').replace(/^(אד'|אדר'|אדריכל)\s*/, '').replace(/[\s"'׳״.,-]+/g, '').toLowerCase();
const em = s => String(s||'').trim().toLowerCase();
const empty = v => v == null || String(v).trim() === '' || String(v).trim() === '—';
function dedupeContacts(){
  let L; try{ L = contacts; }catch(e){ return null; } if(!Array.isArray(L) || !L.length) return null;
  const keep = [], gone = [], conflict = [];
  const mergeInto = (a, b) => { ['type', 'org', 'title', 'phone', 'email', 'address', 'notes'].forEach(k => { if(empty(a[k]) && !empty(b[k])) a[k] = b[k]; });
    a.plans = [...new Set([].concat(a.plans || [], b.plans || []).map(String))]; a.sources = [...new Set([].concat(a.sources || [], b.sources || [], b.src ? [b.src] : []))];
    if(b.real) a.real = true; a.merged = (a.merged || []).concat([b.id]); };
  L.forEach(c => { if(c.sample){ keep.push(c); return; }
    const byMail = em(c.email) && keep.find(k => em(k.email) === em(c.email));
    const byName = !byMail && nm(c.name) && keep.find(k => nm(k.name) === nm(c.name));
    if(byMail){ mergeInto(byMail, c); gone.push(c.id); return; }
    if(byName){ if(em(byName.email) && em(c.email) && em(byName.email) !== em(c.email)){ conflict.push(c.name); keep.push(c); return; }   // אותו שם, מיילים שונים: אולי שני אנשים
      mergeInto(byName, c); gone.push(c.id); return; }
    keep.push(c); });
  if(gone.length){ try{ localStorage.setItem('ashdod_contacts_backup_' + T(), JSON.stringify({ contacts:L })); }catch(e){}
    L.splice(0, L.length, ...keep); try{ saveContacts(); }catch(e){} }
  return window._contactsDedupe = { merged:gone.length, conflict:[...new Set(conflict)] };
}
function afterContacts(){ let n = 0; const t = setInterval(() => { n++; let ok = false; try{ ok = _contactsLoaded; }catch(e){}
  if(ok || n > 100){ clearInterval(t); if(ok){ const r = dedupeContacts(); if(r && r.merged) console.info('contacts merged', r); } } }, 300); }

/* ── 3. צוות ומייל אחד ── */
function team(p){ try{ return typeof window.planPeople === 'function' ? window.planPeople(p) : []; }catch(e){ return []; } }
function mails(p){ return [...new Set(team(p).map(x => em(x.email)).filter(x => /@/.test(x)))]; }
function mailTeam(p, subject, body, what){
  const to = mails(p); if(!to.length){ say('אין מייל לאף איש קשר בתוכנית. אפשר להוסיף באנשי הקשר'); return false; }
  window.location.href = `mailto:${to.join(',')}?subject=${encodeURIComponent(subject)}${body ? '&body=' + encodeURIComponent(body) : ''}`;
  try{ logAction(p, 'mail', `נפתחה טיוטה: ${what || subject} (${to.length} נמענים)`); }catch(e){}
  return true;
}

/* ── 4. היסטוריה ── */
const KIND = { meeting:'פגישה', mail:'מייל', note:'הערה', todo:'השלמה', status:'סטטוס', decision:'החלטה', date:'מועד', form:'טופס' };
function historyOf(p){
  const out = [];
  (p.actionLog || []).forEach(a => out.push({ at:a.at || '', time:a.time || '', kind:KIND[a.type] || a.type || 'פעולה', text:a.detail || '', by:a.by || '', src:a.src || '' }));
  Object.entries(p.meet || {}).forEach(([k, m]) => { (m && m.history || []).forEach(h => out.push({ at:String(h.replacedAt || h.date || '').slice(0, 10), kind:'מועד שהוחלף', text:`${LABEL[k] || k}: ${F(h.date)}${h.outcome === 'missed' ? ', לא התקיים' : ''}. ${h.note || ''}`, by:'' })); });
  (p.decisions || []).forEach(d => out.push({ at:String(d.at || '').slice(0, 10), kind:'החלטה', text:d.text || '', by:d.by || '', src:d.src || '' }));
  if(p.archForm && p.archForm.receivedAt) out.push({ at:String(p.archForm.receivedAt).slice(0, 10), kind:'טופס', text:'נקלט טופס מהאדריכל' + (p.archForm.by ? ', ' + p.archForm.by : ''), by:'' });
  const seen = new Set();
  return out.filter(x => { const k = x.at + x.text; if(seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => (b.at + b.time).localeCompare(a.at + a.time));
}
const LABEL = { forumArchitect:'פורום אדריכל העיר', forumConsultants:'פורום יועצים', committeePrep:'הכנה לוועדה', committeeDate:'ועדה' };

/* ── 5. דוח הערות ── */
async function reportText(p){
  const L = [`דוח הערות: ${projName(p)}`, `תיק ${p.tik}. ${F(T())}.`, ''];
  let i = 0; const heb = 'אבגדהוזחטיכ'; let k = 0;
  const sec = (title, items) => { items = items.filter(x => String(x || '').trim()); if(!items.length) return; L.push(`${heb[k++]}. ${title}`); items.forEach(x => L.push(`${++i}. ${x}`)); L.push(''); };
  let annex = '';
  try{ const G = await window.planCompletions(p); G.forEach(([t, items]) => sec(t, items.filter(x => !(window.planTodoDone && window.planTodoDone(p, x)))));
    const full = window.planCompletionsText(p, G), a = full.indexOf('נספח:'); if(a >= 0) annex = full.slice(a); }catch(e){}
  const lr = p.layerReview || {}; const its = Object.entries(lr.items || {}).filter(([, v]) => v && !v.d && String(v.n || '').trim()).map(([, v]) => v.n);
  sec('הנחיות מבחינת המודל', its);
  sec('הערות לתוכנית', (p.notes || []).filter(n => n && !n.done && !n.deleted).map(n => n.text || n.t || ''));
  if(L.length <= 3) L.push('אין הערות פתוחות.');
  L.push('נא להתייחס לכל סעיף לפני המועד הבא.', '', 'ענת שטיבלמן', 'אדריכלית העיר, עיריית אשדוד');
  if(annex) L.push('', '', annex);
  return L.join('\n');
}
window.planReportText = reportText;

/* ── חלון ── */
function modal(title, html){ document.getElementById('tmModal')?.remove();
  const m = document.createElement('div'); m.id = 'tmModal'; m.className = 'tm-modal'; m.setAttribute('role', 'dialog');
  m.innerHTML = `<div class="tm-box"><div class="tm-h"><b>${H(title)}</b><button class="tm-x" data-tm="close" title="סגירה" aria-label="סגירה">×</button></div><div class="tm-b">${html}</div></div>`;
  m.onclick = e => { if(e.target === m || e.target.closest('[data-tm="close"]')) m.remove(); }; document.body.appendChild(m); return m; }
function openTeam(p){
  const ps = team(p), to = mails(p);
  const m = modal(`צוות התוכנית: ${projName(p)}`, `<table class="tm-t"><thead><tr><th>תפקיד</th><th>שם</th><th>ארגון</th><th>טלפון</th><th>מייל</th></tr></thead><tbody>
    ${ps.map(x => `<tr><td>${H(x.role)}</td><td><b>${H(x.name)}</b></td><td>${H(x.org)}</td><td>${x.phone ? `<a href="tel:${H(x.phone)}">${H(x.phone)}</a>` : '<span class="muted">חסר</span>'}</td><td>${x.email ? H(x.email) : '<span class="muted">חסר</span>'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">אין אנשי קשר לתוכנית.</td></tr>'}</tbody></table>
    <p class="tm-n">${to.length} כתובות מייל. כל איש קשר מופיע פעם אחת, גם כשהוא בכמה תוכניות.</p>
    <div class="tm-row"><button class="btn btn-primary btn-sm" data-tm="mail"${to.length ? '' : ' disabled'}>מייל לכל הצוות</button><button class="btn btn-ghost btn-sm" data-tm="copy"${to.length ? '' : ' disabled'}>העתקת המיילים</button></div>`);
  m.querySelector('[data-tm="mail"]').onclick = () => mailTeam(p, `תוכנית בינוי ${projName(p)}`, '', 'מייל לצוות');
  m.querySelector('[data-tm="copy"]').onclick = () => { try{ navigator.clipboard.writeText(to.join(', ')); say('המיילים הועתקו'); }catch(e){ prompt('העתקה', to.join(', ')); } };
}
function openHistory(p){
  const draw = () => { const hs = historyOf(p), ed = typeof isArchitect !== 'function' || isArchitect();
    m.querySelector('.tm-b').innerHTML = `${ed ? `<div class="tm-add"><textarea id="tmNote" rows="2" placeholder="הערה ליומן: מה קרה, למה, ומה הלאה"></textarea><button class="btn btn-primary btn-sm" data-tm="add">הוספה ליומן</button></div>` : ''}
      <ol class="tm-log">${hs.map(x => `<li><span class="tm-d">${H(F(x.at))}${x.time ? ' ' + H(x.time) : ''}</span><span class="tm-k">${H(x.kind)}</span><span class="tm-tx">${H(x.text)}${x.by ? ` <small>${H(x.by)}</small>` : ''}</span></li>`).join('') || '<li class="muted">אין עדיין רישומים.</li>'}</ol>`;
    const b = m.querySelector('[data-tm="add"]'); if(b) b.onclick = () => { const v = m.querySelector('#tmNote').value.trim(); if(!v) return; try{ logAction(p, 'note', v); }catch(e){} draw(); }; };
  const m = modal(`היסטוריה: ${projName(p)}`, ''); draw();
}
async function openReport(p){
  const m = modal(`דוח הערות: ${projName(p)}`, '<p class="muted">מכין…</p>'), txt = await reportText(p), to = mails(p);
  m.querySelector('.tm-b').innerHTML = `<textarea class="tm-rep" rows="18">${H(txt)}</textarea>
    <div class="tm-row"><button class="btn btn-primary btn-sm" data-tm="mail"${to.length ? '' : ' disabled'}>טיוטת מייל לצוות (${to.length})</button><button class="btn btn-ghost btn-sm" data-tm="copy">העתקה</button></div>
    <p class="tm-n">הדוח נבנה מההשלמות שבחוות הדעת, מהנחיות המודל ומההערות. אפשר לערוך לפני השליחה. במייל נפתחת טיוטה, וביומן נרשם "נפתחה טיוטה".</p>`;
  const cur = () => m.querySelector('.tm-rep').value;
  m.querySelector('[data-tm="mail"]').onclick = () => mailTeam(p, `הערות לתוכנית בינוי ${projName(p)}`, cur(), 'דוח הערות');
  m.querySelector('[data-tm="copy"]').onclick = () => { try{ navigator.clipboard.writeText(cur()); say('הדוח הועתק'); }catch(e){ prompt('העתקה', cur()); } };
}
window.planTeam = { open:openTeam, history:openHistory, report:openReport, historyOf, mails, dedupe:dedupeContacts };

/* ── 6. תמונות במסגרות ── */
const SLOT = { render:'g9', plan:'g3' };
function fillFrames(p){
  if(!p || typeof window.planMaterials !== 'function') return 0; p.graphics = p.graphics || {}; let n = 0;
  const mats = window.planMaterials(p), R = (window._cityRenders || {})[String(p.planNum || '').replace(/\D/g, '')];
  if(R && R.img && !(p.graphics.g9 && p.graphics.g9.url)){ p.graphics.g9 = { url:R.img, date:T(), src:'הדמיה מ"מרחב מדבר"', auto:1 }; n++; }
  Object.entries(SLOT).forEach(([cat, id]) => { if(p.graphics[id] && p.graphics[id].url) return;
    const it = mats.find(x => x.cat === cat && (x.href || (x.img && !/^data:/.test(x.img))) && !x.mail); if(!it) return;
    p.graphics[id] = { url:it.href || it.img, date:T(), src:it.src || '', auto:1 }; n++; });
  return n;
}
async function fillAllFrames(){
  try{ const r = await fetch('data/renders.json?v=1124p'); window._cityRenders = (await r.json()).renders || {}; }catch(e){ window._cityRenders = {}; }
  let n = 0, ps = 0; try{ plans.forEach(p => { if(p && !p.deleted){ const k = fillFrames(p); if(k){ n += k; ps++; } } }); if(n) savePlans(); }catch(e){}
  window._framesFilled = { frames:n, plans:ps };
}

/* ── בדף התוכנית: שם גדול וכפתורי צוות, היסטוריה ודוח ── */
function hookProject(){
  if(typeof window.buildProjectTitle === 'function') window.buildProjectTitle = projName;
  const op = window.openProject; if(typeof op !== 'function') return setTimeout(hookProject, 80);
  if(op._tm) return;
  window.openProject = function(id){ const r = op.apply(this, arguments); try{ const p = plans.find(x => x.id === id); if(p){ fillFrames(p); head(p); fillStreet(p).then(ch => { if(ch) head(p); }); } }catch(e){} return r; };
  window.openProject._tm = true;
}
function head(p){
  const t = document.getElementById('ppTitle'); if(t){ t.textContent = projName(p); t.classList.add('tm-big'); }
  const c = document.getElementById('ppCrumb'); if(c) c.textContent = projName(p);
  let bar = document.getElementById('tmBar'); const host = document.getElementById('ppSub');
  if(!bar && host){ bar = document.createElement('div'); bar.id = 'tmBar'; bar.className = 'tm-bar no-print'; host.insertAdjacentElement('afterend', bar); }
  if(!bar) return; const n = team(p).length;
  bar.innerHTML = `<button data-tmb="team" title="אנשי הקשר של התוכנית, ומייל אחד לכל הצוות">צוות (${n})</button><button data-tmb="history" title="יומן התוכנית: מיילים, מועדים שנקבעו והוחלפו, פגישות והחלטות. אפשר להוסיף הערה">היסטוריה</button><button data-tmb="report" title="כל ההערות בדוח אחד, מוכן לשליחה במייל לצוות">דוח הערות</button>`;
  bar.onclick = e => { const b = e.target.closest('[data-tmb]'); if(!b) return; const k = b.dataset.tmb; if(k === 'team') openTeam(p); else if(k === 'history') openHistory(p); else openReport(p); };
}

const CSS = `
.tm-tip{position:fixed;z-index:100000;background:#1d1d1b;color:#fff;font:400 12px/1.35 inherit;padding:3px 8px;pointer-events:none;max-width:280px;opacity:0;transition:opacity .08s;direction:rtl}
.pp-title.tm-big{font-size:28px;font-weight:700;line-height:1.2}
.tm-bar{display:flex;gap:4px;margin:4px 0}
.tm-bar button{font:inherit;font-size:12.5px;padding:3px 10px;border:0;background:var(--btn-bg,#e9e8e3);cursor:pointer;border-radius:0}
.tm-bar button:hover{background:#111;color:#fff}
.tm-modal{position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px;overflow:auto}
.tm-box{background:#fff;width:min(820px,100%);box-shadow:0 8px 30px rgba(0,0,0,.25)}
.tm-h{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #e5e3dc;font-size:16px}
.tm-x{border:0;background:none;font-size:22px;cursor:pointer;line-height:1}
.tm-b{padding:12px 14px;max-height:72vh;overflow:auto}
.tm-t{width:100%;border-collapse:collapse;font-size:13px} .tm-t th,.tm-t td{padding:5px 6px;border-bottom:1px solid #eee;text-align:right}
.tm-n{font-size:12px;color:#666;margin:8px 0}
.tm-row{display:flex;gap:6px;flex-wrap:wrap}
.tm-add{display:flex;gap:6px;align-items:flex-start;margin-bottom:10px} .tm-add textarea{flex:1;font:inherit;font-size:13px;padding:6px;border:1px solid #ccc}
.tm-log{list-style:none;margin:0;padding:0} .tm-log li{display:grid;grid-template-columns:110px 92px 1fr;gap:8px;padding:6px 0;border-bottom:1px solid #f0efea;font-size:13px}
.tm-d{color:#555;font-variant-numeric:tabular-nums} .tm-k{font-weight:600} .tm-tx small{color:#777}
.tm-rep{width:100%;font:inherit;font-size:13px;line-height:1.5;padding:8px;border:1px solid #ccc;box-sizing:border-box;margin-bottom:8px}
@media (max-width:640px){ .tm-log li{grid-template-columns:1fr} .pp-title.tm-big{font-size:21px} }`;
function boot(){
  if(typeof plans === 'undefined') return setTimeout(boot, 80);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  hoverTips(); hookProject(); afterContacts(); setTimeout(fillAllFrames, 2500);
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
