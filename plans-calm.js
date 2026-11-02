/* ══════════════════════════════════════════════════════════════════
   plans-calm.js: פחות כפתורים ופחות מלל (בקשת ענת, 03.11.2026: "אני הולכת לאיבוד").
   עיקרון: כל מסך מציג את מה שעושים בו עכשיו. פירוט נפתח בלחיצה אחת, ולא נמחק.
   - סרגל: 8 יעדים בלבד. שאר הדפים נגישים מדף הבית ומספריית הידע.
   - פעולות מערכת (נעילה, קוד יזם, איש קשר חדש) עוברות לכפתור הלוגו.
   - רשימות ארוכות ופירוט שלב מקופלים לשורה אחת עם מספר.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const NAV_MAIN = ['landing','table','timeline','calendar','map','contacts','library','outputs'];
const NAV_LABEL = { table:'תוכניות', contacts:'אנשי קשר', library:'ספרייה', outputs:'תוצרים', landing:'ראשי' };

function calmNav(){
  document.querySelectorAll('#mainNav button[data-nav]').forEach(b => {
    const id = b.dataset.nav;
    if(b.dataset.sys) return;
    if(!NAV_MAIN.includes(id) && id!=='devhome' && id!=='exec') b.dataset.more = '1';
    if(NAV_LABEL[id]) b.textContent = NAV_LABEL[id];
  });
  // הנהלה: "תמונת מצב" נשארת בסרגל, כי זה הדף שלה
  const ex = document.querySelector('#mainNav button[data-nav="exec"]');
  if(ex && !(typeof isManager==='function' && isManager())) ex.dataset.more = '1';
}

/** פעולות שעוברות לכפתור הלוגו */
function calmMenu(){
  const menu = document.getElementById('aiMenu'); if(!menu) return;
  menu.addEventListener('click', () => setTimeout(() => {
    const list = Array.isArray(menu.items) ? menu.items.slice() : [];
    const has = l => list.some(x => x.label===l);
    const pg = document.querySelector('.page.active');
    if(pg && pg.id==='projectPage' && typeof pj==='function' && pj() && typeof isArchitect==='function' && isArchitect()){
      if(!has('אישורים ונעילה') && typeof openLocksModal==='function') list.unshift({ label:'אישורים ונעילה', onSelect: openLocksModal });
      if(!has('העתקת קישור ליזם') && typeof copyDevLink==='function') list.unshift({ label:'העתקת קישור ליזם', hint:'עם קוד הגישה', onSelect: copyDevLink });
    }
    if(pg && pg.id==='contacts' && !has('איש קשר חדש') && typeof contactEdit==='function') list.unshift({ label:'איש קשר חדש', onSelect: () => contactEdit('') });
    if(!has('כל הדפים')) list.push({ label:'כל הדפים', hint:'הנחיות, מגמות, הערות', onSelect: () => go('library', navBtn('library')) });
    menu.items = list;
  }, 0), true);
}

/** עוטף אלמנט בשורה אחת מקופלת: כותרת ומספר, ופירוט בלחיצה */
function fold(el, label, count, open){
  if(!el || el.closest('details.calm-fold')) return;
  const d = document.createElement('details'); d.className = 'calm-fold'; if(open) d.open = true;
  d.innerHTML = `<summary><span>${label}</span>${count!=null?`<b>${count}</b>`:''}</summary>`;
  el.parentNode.insertBefore(d, el); d.appendChild(el);
}
function refold(el, label, count){ const d = el && el.closest('details.calm-fold'); if(d){ d.querySelector('summary').innerHTML = `<span>${label}</span>${count!=null?`<b>${count}</b>`:''}`; } else fold(el, label, count); }

function calmHome(){
  const at = document.getElementById('activeTracking'), dw = document.getElementById('dailyWork');
  const n1 = at ? at.querySelectorAll('tr, .at-row, li').length : 0;
  const n2 = dw ? dw.querySelectorAll('.dw-row, li, tr').length : 0;
  if(at && at.innerHTML.trim()) refold(at, 'מעקב: תוכניות בטיפול', null);
  if(dw && dw.innerHTML.trim()) refold(dw, 'תוכנית עבודה להיום', null);
}

function calmProcess(){
  const panel = document.getElementById('procPanel'); if(!panel) return;
  const grid = panel.querySelector('.pr-grid');
  if(grid){
    const n = grid.querySelectorAll('input[type=checkbox]').length, done = grid.querySelectorAll('input[type=checkbox]:checked').length;
    fold(grid, 'פירוט השלב: חומרים, פעולות ותוצר', `${done}/${n}`);
  }
  const doc = panel.querySelector('.pr-doc');
  if(doc){ const n = doc.querySelectorAll('.pr-notes li:not(.muted)').length; fold(doc, 'הערות והיסטוריה', n); }
  const rv = panel.querySelector('.rv-scroll');
  if(rv){ const g = panel.querySelectorAll('.rv-gaps li').length; fold(rv, 'טבלת הבדיקה המלאה', g ? g+' פערים' : null, true); }
}

function patch(){
  calmNav(); calmMenu();
  const wrap = (name, after) => { const o = window[name]; if(typeof o!=='function') return; window[name] = function(){ const r = o.apply(this, arguments); try{ after.apply(this, arguments); }catch(e){ console.warn('calm '+name, e); } return r; }; };
  wrap('renderLanding', calmHome);
  wrap('renderHeadNotes', () => { const el = document.getElementById('ntHeadBody'); const p = typeof pj==='function' && pj();
    const n = p && Array.isArray(p.notes) ? p.notes.filter(x=>!x._deleted).length : 0; if(el) refold(el, 'הערות תוכן', n); });
  wrap('renderStageStrip', () => setTimeout(calmProcess, 0));
  const _rr = window.procOpen; if(typeof _rr==='function') window.procOpen = function(){ _rr.apply(this, arguments); setTimeout(calmProcess, 0); };
  // אחרי כל עדכון של הפאנל (סימון, מועד) מקפלים מחדש
  new MutationObserver(() => { const p = document.getElementById('procPanel'); if(p && !p.querySelector('details.calm-fold')) calmProcess(); })
    .observe(document.body, { childList:true, subtree:true });
  const pg = document.querySelector('.page.active'); if(pg && pg.id==='landing') calmHome();
  // תפקיד ההנהלה נקבע אחרי הכניסה
  wrap('applySession', calmNav); wrap('applyRoleUI', calmNav);
}
function boot(){ if(typeof plans==='undefined' || !document.getElementById('mainNav') || typeof renderStageStrip!=='function') return setTimeout(boot, 50); patch(); }
boot();
})();
