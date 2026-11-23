/* ══════════════════════════════════════════════════════════════════
   plans-view.js: מפה ולוח שנה מזוקקים (ענת, 23.11.2026).
   מפה: בלי שכבות מידע שלא עובדים איתן. כל התוכניות מופיעות, ולחיצה על תוכנית מתמקדת בה.
        מקרא הסטטוסים הוא גם הבורר: פלוס מציג הכול, איקס מבטל הכול, ולחיצה על סטטוס מוסיפה או מסירה אותו.
   לוח שנה: נפתח על החודש של היום, והיום מסומן במסגרת שחורה על רקע צהוב.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sel = null, inMapDraw = false;          // sel: הסטטוסים המוצגים. null = עוד לא נבחר, כלומר הכול

const statusOf = p => String(p.status || 'טרם עודכן');
function statuses(){ const cnt = {}; livePlans().forEach(p => { const s = statusOf(p); cnt[s] = (cnt[s]||0) + 1; });
  return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).map(s => ({ s, n:cnt[s], color:(typeof STATUS_COLORS !== 'undefined' && STATUS_COLORS[s]) || '#6b6259' })); }
function drawBar(){
  const el = document.getElementById('mapFilterBar'); if(!el) return;
  const all = statuses(); if(!sel) sel = new Set(all.map(x => x.s));
  const shown = all.filter(x => sel.has(x.s)).reduce((t, x) => t + x.n, 0), total = all.reduce((t, x) => t + x.n, 0);
  el.innerHTML = `<div class="mv-head"><b>${shown}</b> מתוך ${total} תוכניות
      <span><button class="mv-ic" data-mv="all" title="הצגת כל הסטטוסים" aria-label="הצגת הכול">+</button><button class="mv-ic" data-mv="none" title="ביטול כל הסטטוסים" aria-label="ביטול הכול">×</button></span></div>
    <div class="mv-list">${all.map(x => `<button class="mv-st${sel.has(x.s)?' on':''}" data-st="${H(x.s)}" style="--c:${x.color}" aria-pressed="${sel.has(x.s)}"><i></i><span>${H(x.s)}</span><em>${x.n}</em></button>`).join('')}</div>`;
  el.onclick = e => { const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.mv === 'all') sel = new Set(statuses().map(x => x.s)); else if(b.dataset.mv === 'none') sel = new Set();
    else if(b.dataset.st){ if(sel.has(b.dataset.st)) sel.delete(b.dataset.st); else sel.add(b.dataset.st); }
    drawBar(); try{ drawMapMarkers(); }catch(err){} };
}
function cleanPanel(){
  const pg = document.getElementById('map'); if(!pg) return; pg.classList.add('mv-clean');
  pg.querySelectorAll('.section-title').forEach(t => { const x = t.textContent.trim(); if(/^שכבות מידע/.test(x) || /^סטטיסטיקה/.test(x)) t.style.display = 'none'; else if(/^מקרא/.test(x)) t.textContent = 'סטטוס'; });
  const sub = pg.querySelector('.page-subtitle'); if(sub) sub.style.display = 'none';
  drawBar();
}
function hookMap(){
  const _sfp = window.statusFilteredPlans;
  window.statusFilteredPlans = function(){ if(inMapDraw && sel) return livePlans().filter(p => sel.has(statusOf(p))); return _sfp.apply(this, arguments); };
  const wrapDraw = () => { const _d = window.drawMapMarkers; if(typeof _d !== 'function' || _d._mv) return;
    const w = function(){ inMapDraw = true; let r; try{ r = _d.apply(this, arguments); } finally { inMapDraw = false; }
      try{ if(gisLayers.plans) gisLayers.plans.eachLayer(m => { if(m._mvFocus || !m.getLatLng) return; m._mvFocus = true; m.on('click', () => gisMap.flyTo(m.getLatLng(), Math.max(gisMap.getZoom(), 17), { duration:.6 })); }); }catch(e){}
      return r; }; w._mv = true; window.drawMapMarkers = w; };
  wrapDraw();
  const _go = window.go; window.go = function(id){ const r = _go.apply(this, arguments);
    if(id === 'map'){ wrapDraw(); setTimeout(cleanPanel, 0); setTimeout(() => { cleanPanel(); try{ drawMapMarkers(); }catch(e){} }, 400); }
    if(id === 'calendar') setTimeout(focusToday, 60);
    return r; };
  const a = document.querySelector('.page.active'); if(a && a.id === 'map'){ setTimeout(cleanPanel, 300); [1200, 3000].forEach(ms => setTimeout(() => { wrapDraw(); cleanPanel(); try{ drawMapMarkers(); }catch(e){} }, ms)); } if(a && a.id === 'calendar') setTimeout(focusToday, 300);
}
/* לוח שנה: חוזרים לחודש של היום, ומביאים את היום למרכז המסך */
function focusToday(){
  try{ if(typeof _calOffset !== 'undefined' && _calOffset !== 0){ _calOffset = 0; renderCalendar(); } }catch(e){}
  const t = document.querySelector('#calendar .cal-today'); if(t) t.scrollIntoView({ block:'center' });
}
const CSS = `
.mv-clean .layer-panel,.mv-clean #mapLegend,.mv-clean #boxZoomBtn,.mv-clean #mapStats{display:none !important}
.mv-head{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--ink-soft);margin-bottom:6px}
.mv-head b{color:var(--ink);font-size:15px}
.mv-head span{display:flex;gap:3px}
.mv-ic{width:24px;height:24px;border:0 !important;background:#f1f0ec !important;color:var(--ink) !important;font:400 16px/1 var(--sans) !important;cursor:pointer;border-radius:0 !important;padding:0 !important}
.mv-ic:hover{background:var(--ink) !important;color:#fff !important}
.mv-list{display:grid;gap:2px}
.mv-st{display:grid;grid-template-columns:14px 1fr auto;gap:8px;align-items:center;border:0 !important;background:none !important;padding:5px 4px !important;cursor:pointer;border-radius:0 !important;font:400 13.5px var(--sans) !important;color:var(--ink-mute) !important;text-align:start}
.mv-st i{width:12px;height:12px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--c);background:#fff}
.mv-st.on{color:var(--ink) !important;font-weight:600 !important;background:#f6f5f1 !important}
.mv-st.on i{background:var(--c)}
.mv-st em{font-style:normal;font-size:12px;color:var(--ink-soft);font-variant-numeric:tabular-nums;font-weight:400}
.mv-st:hover{background:#eeede8 !important}
#calendar .cal-today{outline:2.5px solid #1a1a18 !important;outline-offset:-2.5px;background:#fff3a8 !important}
`;
function boot(){
  if(typeof plans === 'undefined' || typeof window.go !== 'function' || typeof window.statusFilteredPlans !== 'function' || typeof window.drawMapMarkers !== 'function') return setTimeout(boot, 60);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  setTimeout(hookMap, 250);          // אחרי שהקבצים האחרים עטפו את go ואת drawMapMarkers
}
boot();
})();
