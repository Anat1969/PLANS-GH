/* ══════════════════════════════════════════════════════════════════
   plans-axis.js: "ציר תוכניות". הרחוב כמפתח לתוכניות (בקשת ענת, 03.11.2026).
   שכבת הרחובות העירונית (geo/ashdod-streets.geojson, נטענת רק כשצריך) מצוירת בשקט מתחת לסמנים.
   לחיצה על רחוב מדגישה את כל הרחוב (אותו סמל רחוב, או אותו שם כשאין סמל), ומציגה את התוכניות
   שעד 60 מ' ממנו, מסודרות לאורכו. בכרטיס התוכנית: "יושבת על" לפי הרחוב הקרוב.
   החלק הטהור (AXIS) בלי DOM ובלי Leaflet, ונבדק ב-node tools/check-axis.js.
   ══════════════════════════════════════════════════════════════════ */
(function(root){
'use strict';

const AXIS_MAX_M = 60;          // תוכנית "על הציר": עד 60 מ' מקו המרכז
const NEAR_MAX_M = 150;         // "יושבת על": הרחוב הקרוב, עד 150 מ'
const SRC = 'שכבת הרחובות של עיריית אשדוד, 03.11.2026';

/* המידרג אינו רשמי: נגזר משמות הרחובות בכל דרגה (הערכה) */
const RANK = { 1:'שדרה ראשית', 2:'רחוב ראשי', 3:'רחוב מקומי', 4:'רחוב מקומי', 5:'רחוב מקומי', 8:'כביש עורקי', 10:'מדרחוב', 0:'לא מסווג' };
const rankLabel = h => RANK[h] || 'לא מסווג';
const rankWeight = h => ({1:4, 8:4, 2:3}[h] || 1.6);

/* מטרים: הטלה מקומית שווה־מרחק, מספיקה לקנה המידה של עיר */
const DEG = Math.PI/180, R = 6371000;
const toXY = (lng, lat, lat0) => [lng*DEG*R*Math.cos(lat0*DEG), lat*DEG*R];

function axisKey(pr){
  if(pr && pr.st_code > 1) return 'c' + pr.st_code;
  if(pr && pr.name) return 'n' + String(pr.name).trim();
  return null;
}

/** בונה את הצירים מה-GeoJSON: מפתח → {key,name,code,rank,quarters,lines} */
function buildAxes(fc){
  const axes = new Map();
  (fc && fc.features || []).forEach(f => {
    const pr = f.properties || {}; const k = axisKey(pr); if(!k || !f.geometry) return;
    let a = axes.get(k);
    if(!a){ a = { key:k, code: pr.st_code > 1 ? pr.st_code : null, names:{}, rank:0, quarters:{}, lines:[] }; axes.set(k, a); }
    if(pr.name) a.names[pr.name] = (a.names[pr.name]||0) + 1;
    if(pr.quarter) a.quarters[pr.quarter] = (a.quarters[pr.quarter]||0) + 1;
    const h = +pr.hierarchy || 0;
    if(h && (!a.rank || h < a.rank)) a.rank = h;          // הדרגה הבולטת ביותר של הרחוב
    const g = f.geometry;
    (g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]).forEach(l => { if(l && l.length > 1) a.lines.push(l); });
  });
  axes.forEach(a => {
    a.name = Object.entries(a.names).sort((x,y) => y[1]-x[1])[0]?.[0] || '';
    a.quarterList = Object.entries(a.quarters).sort((x,y) => y[1]-x[1]).map(x => x[0]);
    let n = 0, la0 = 0; a.lines.forEach(l => l.forEach(p => { la0 += p[1]; n++; }));
    a.lat0 = n ? la0/n : 31.8;
    a.bbox = a.lines.flat().reduce((b,p) => [Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])], [180,90,-180,-90]);
    delete a.names; delete a.quarters;
  });
  return axes;
}

/** הכיוון הראשי של הרחוב (ניתוח רכיבים ראשיים על הקודקודים, במטרים) */
function principal(a){
  if(a._pc) return a._pc;
  const pts = []; a.lines.forEach(l => l.forEach(p => pts.push(toXY(p[0], p[1], a.lat0))));
  const mx = pts.reduce((s,p)=>s+p[0],0)/pts.length, my = pts.reduce((s,p)=>s+p[1],0)/pts.length;
  let sxx=0, syy=0, sxy=0; pts.forEach(p => { const dx=p[0]-mx, dy=p[1]-my; sxx+=dx*dx; syy+=dy*dy; sxy+=dx*dy; });
  const th = 0.5*Math.atan2(2*sxy, sxx-syy);
  let ex = Math.cos(th), ey = Math.sin(th);
  // סדר קבוע: רחוב צפון־דרום מצפון לדרום, רחוב מזרח־מערב מהים (מערב) פנימה
  const ns = Math.abs(ey) > Math.abs(ex);
  if(ns ? ey > 0 : ex < 0){ ex = -ex; ey = -ey; }   // s גדל לכיוון דרום, או לכיוון מזרח
  const s = pts.map(p => (p[0]-mx)*ex + (p[1]-my)*ey);
  a._pc = { mx, my, ex, ey, ns, smin: Math.min(...s), smax: Math.max(...s),
            from: ns ? 'צפון' : 'מערב', to: ns ? 'דרום' : 'מזרח' };
  return a._pc;
}

/** הנקודה הקרובה על הרחוב: מרחק במטרים ומיקום לאורך הרחוב (0 = הקצה הראשון, 1 = האחרון) */
function nearestOnAxis(a, lat, lng){
  const P = toXY(lng, lat, a.lat0); let best = Infinity, bx = 0, by = 0;
  a.lines.forEach(l => {
    for(let i = 1; i < l.length; i++){
      const A = toXY(l[i-1][0], l[i-1][1], a.lat0), B = toXY(l[i][0], l[i][1], a.lat0);
      const vx = B[0]-A[0], vy = B[1]-A[1], L2 = vx*vx + vy*vy;
      const t = L2 ? Math.max(0, Math.min(1, ((P[0]-A[0])*vx + (P[1]-A[1])*vy)/L2)) : 0;
      const qx = A[0]+t*vx, qy = A[1]+t*vy, d = Math.hypot(P[0]-qx, P[1]-qy);
      if(d < best){ best = d; bx = qx; by = qy; }
    }
  });
  const pc = principal(a);
  const s = (bx-pc.mx)*pc.ex + (by-pc.my)*pc.ey;
  return { d: best, t: pc.smax > pc.smin ? (s-pc.smin)/(pc.smax-pc.smin) : 0.5 };
}

/** התוכניות על הציר, מסודרות לאורכו. items: [{id, lat, lng, ...}] עם מיקום מדויק בלבד */
function plansOnAxis(a, items, maxM){
  const lim = maxM || AXIS_MAX_M;
  return items.map(it => ({ it, ...nearestOnAxis(a, it.lat, it.lng) }))
    .filter(x => x.d <= lim).sort((x,y) => x.t - y.t);
}

/** הרחוב הקרוב לנקודה (לכרטיס התוכנית). מחזיר {axis, d} או null */
function nearestAxis(axes, lat, lng, maxM){
  const lim = maxM || NEAR_MAX_M, pad = lim/90000;   // ~מעלות, עם מרווח
  let best = null;
  axes.forEach(a => {
    const b = a.bbox; if(lng < b[0]-pad*1.2 || lng > b[2]+pad*1.2 || lat < b[1]-pad || lat > b[3]+pad) return;
    const r = nearestOnAxis(a, lat, lng);
    if(r.d <= lim && (!best || r.d < best.d || (r.d - best.d < 3 && (a.rank||9) < (best.axis.rank||9)))) best = { axis:a, d:r.d };
  });
  return best;
}

/** שורת התובנה (עד 8 מילים, ** על המספר) */
function axisInsight(a, hits){
  const n = hits.length, nm = a.name || 'הרחוב';
  if(!n) return `אין תוכניות לאורך ${nm}`;
  const pc = principal(a);
  const first = hits.filter(h => h.t < 0.5).length, last = n - first;
  const where = n === 1 ? `בחלק ה${hits[0].t < 0.5 ? adj(pc.from) : adj(pc.to)}`
    : first >= n*2/3 ? `רובן ב${pc.from}` : last >= n*2/3 ? `רובן ב${pc.to}` : 'לכל אורכו';
  return `**${n}** ${n === 1 ? 'תוכנית' : 'תוכניות'} לאורך ${nm}, ${where}`;
}
const adj = w => ({ 'צפון':'צפוני', 'דרום':'דרומי', 'מערב':'מערבי', 'מזרח':'מזרחי' }[w] || w);

const AXIS = { AXIS_MAX_M, NEAR_MAX_M, SRC, rankLabel, rankWeight, axisKey, buildAxes, principal, nearestOnAxis, plansOnAxis, nearestAxis, axisInsight };
if(typeof module !== 'undefined' && module.exports){ module.exports = AXIS; return; }
root.AXIS = AXIS;

/* ══════════ החלק בדפדפן: טעינה עצלה, שכבה שקטה, הדגשה ופאנל ══════════ */
const H = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const md = s => H(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const EXACT = ['user','parcel','compound'];
let _data = null, _axes = null, _layer = null, _hi = null, _loading = null;

function loadStreets(){
  if(_axes) return Promise.resolve(_axes);
  if(_loading) return _loading;
  _loading = fetch('geo/ashdod-streets.geojson').then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(fc => { _data = fc; _axes = buildAxes(fc); return _axes; })
    .catch(e => { _loading = null; console.warn('streets', e); return null; });
  return _loading;
}
root.loadStreets = loadStreets;

/** התוכניות עם מיקום מדויק (מוזן, גוש וחלקה או מתחם). משוערות לא נכנסות לציר */
function placedPlans(){
  const all = (typeof livePlans === 'function') ? livePlans() : [];
  const ok = [], est = [];
  all.forEach(p => { const g = typeof planGeo === 'function' && planGeo(p);
    if(g && EXACT.includes(g.prec)) ok.push({ id:p.id, lat:g.lat, lng:g.lng, p }); else est.push(p); });
  return { ok, est };
}

function drawStreets(){
  if(typeof gisMap === 'undefined' || !gisMap || !_data || _layer) return;
  if(!gisMap.getPane('axisPane')){ const pn = gisMap.createPane('axisPane'); pn.style.zIndex = 390; }
  _layer = L.geoJSON(_data, { pane:'axisPane',
    style: f => ({ color:'#8a8178', weight: rankWeight(f.properties.hierarchy), opacity:.35, lineCap:'round' }),
    onEachFeature: (f, l) => {
      l.on('click', e => { L.DomEvent.stopPropagation(e); const k = axisKey(f.properties); if(k) showAxis(k); });
      l.on('mouseover', () => l.setStyle({ opacity:.8 })); l.on('mouseout', () => l.setStyle({ opacity:.35 }));
    } });
  gisLayers.axis = _layer;
  const tg = document.querySelector('.layer-toggle[data-layer=roads]');
  const nm = tg && tg.parentNode.querySelector('.layer-name'); if(nm) nm.textContent = 'רחובות';
  if(!tg || tg.classList.contains('on')) _layer.addTo(gisMap);
}

function showAxis(key){
  const a = _axes && _axes.get(key); if(!a || typeof gisMap === 'undefined') return;
  if(_hi) gisMap.removeLayer(_hi);
  _hi = L.layerGroup(a.lines.map(l => L.polyline(l.map(p => [p[1], p[0]]), { pane:'axisPane', color:'#1a1a18', weight:7, opacity:.9, lineCap:'round', interactive:false }))).addTo(gisMap);
  gisMap.fitBounds([[a.bbox[1], a.bbox[0]], [a.bbox[3], a.bbox[2]]], { padding:[30,30], maxZoom:17 });
  const { ok, est } = placedPlans();
  const hits = plansOnAxis(a, ok);
  const pc = principal(a);
  const st = typeof STATUS_LABELS !== 'undefined' ? STATUS_LABELS : null;
  const box = axisBox(); if(!box) return;
  const qi = document.getElementById('mapSearch'); if(qi && document.activeElement !== qi) qi.value = a.name;
  box.innerHTML = `<div class="ax-head"><span class="pr-k">על הציר הזה</span><button class="ax-x" onclick="axisClose()" aria-label="סגירה">×</button></div>
    <div class="ax-ins">${md(axisInsight(a, hits))}</div>
    ${hits.length ? `<div class="ax-end">${pc.from}</div><ol class="ax-list">${hits.map(h => `<li><button class="gs-i" onclick="openDetail(${h.it.id})"><b>${H(h.it.p.planNum || 'תב/'+h.it.p.tik)}</b> ${H(h.it.p.projectName || h.it.p.location || '')} <span class="ax-st">${H(st && st[h.it.p.status] || h.it.p.status || '')}</span></button></li>`).join('')}</ol><div class="ax-end">${pc.to}</div>` : ''}
    <details class="calm-fold ax-how"><summary>איך נבדק</summary>עד ${AXIS_MAX_M} מ' מקו הרחוב, ${H(SRC)}. ${H(rankLabel(a.rank))}: לפי שמות הרחובות (הערכה).${est.length ? ` ${est.length} תוכניות בלי מיקום מדויק לא נבדקו.` : ''}</details>`;
  box.hidden = false;
  if(window.innerWidth < 820) box.scrollIntoView({ block:'nearest', behavior:'smooth' });
}
root.showAxis = showAxis;
root.axisClose = function(){ const b = document.getElementById('axisPanel'); if(b) b.hidden = true; if(_hi && typeof gisMap !== 'undefined'){ gisMap.removeLayer(_hi); _hi = null; } };

function axisBox(){
  let b = document.getElementById('axisPanel');
  if(!b){ const find = document.querySelector('#map .map-find'); if(!find) return null;
    b = document.createElement('div'); b.id = 'axisPanel'; b.className = 'ax-panel'; b.setAttribute('aria-live', 'polite'); find.after(b); }
  return b;
}

/** חיפוש: שם רחוב מהשכבה העירונית קודם לחיפוש הכתובת */
function patchFind(){
  const orig = root.mapFind; if(typeof orig !== 'function') return;
  root.mapFind = async function(q){
    q = String(q || '').trim();
    const axes = q && !/^\d+$/.test(q) ? await loadStreets() : null;
    if(axes){
      const nq = norm(q);
      const m = [...axes.values()].filter(a => a.name && (norm(a.name) === nq || norm(a.name).includes(nq) || nq.includes(norm(a.name))));
      if(m.length){
        m.sort((x,y) => (norm(x.name) === nq ? 0 : 1) - (norm(y.name) === nq ? 0 : 1) || (x.rank||9) - (y.rank||9));
        const res = document.getElementById('mapFindRes');
        if(m.length === 1 || norm(m[0].name) === nq){ showAxis(m[0].key); if(res) res.innerHTML = ''; return; }
        if(res) res.innerHTML = m.slice(0, 6).map(a => `<button class="gs-i" onclick="showAxis('${H(a.key)}')"><b>${H(a.name)}</b> <span class="ax-st">${H(a.quarterList[0] || '')}</span></button>`).join('');
        return;
      }
    }
    return orig(q);
  };
}
const norm = s => String(s).replace(/^(שד(רות)?|רח(וב)?|דרך)['׳.]?\s+/, '').replace(/["'׳״\s]/g, '');

/** כרטיס התוכנית (החלון שנפתח מהמפה ומהציר): "יושבת על" מחליף את "רובע / אזור", כי הרובע כבר בכותרת.
    בדף התוכנית לא נוסף, כדי לא להוסיף מילים (כלל השקט, 03.11.2026) */
function streetOf(p){
  const g = typeof planGeo === 'function' && planGeo(p);
  if(!_axes || !g || !EXACT.includes(g.prec)) return null;
  const r = nearestAxis(_axes, g.lat, g.lng); if(!r) return null;
  return `${r.axis.name} (${rankLabel(r.axis.rank)})`;
}
function patchCard(){
  const od = root.openDetail;
  if(typeof od === 'function') root.openDetail = function(id){
    od(id);
    const fill = () => { const p = plans.find(x => x.id === id); const s = p && streetOf(p);
      const cell = s && [...document.querySelectorAll('#modalBody .detail-info-item')].find(c => /רובע/.test(c.querySelector('.dlabel')?.textContent || ''));
      if(cell){ cell.querySelector('.dlabel').textContent = 'יושבת על'; cell.querySelector('.dval').textContent = s; cell.title = 'הרחוב הקרוב, ' + SRC; } };
    if(_axes) fill(); else loadStreets().then(fill);
  };
}

function patchMap(){
  const init = root.initMap;
  root.initMap = function(){
    init.apply(this, arguments);
    const go = () => { if(typeof gisMap === 'undefined' || !gisMap) return setTimeout(go, 300); loadStreets().then(ax => { if(ax) drawStreets(); }); };
    go();
  };
  // הרחובות נדלקים ונכבים עם "שמות רחובות", בלי שכבה חדשה בלוח
  const tg0 = root.toggleGIS;
  root.toggleGIS = function(el, name){
    tg0(el, name);
    if(name === 'roads' && _layer && typeof gisMap !== 'undefined'){
      if(el.querySelector('.layer-toggle').classList.contains('on')) _layer.addTo(gisMap); else gisMap.removeLayer(_layer);
    }
  };
}

// מחכים לשכבות הקודמות (plans-plus, plans-process), כדי לעטוף את הגרסה האחרונה שלהן
let tries = 0;
function boot(){
  if((typeof plans === 'undefined' || !document.getElementById('mapSearch') || typeof root.planGeo !== 'function') && ++tries < 200) return setTimeout(boot, 50);
  try{ patchMap(); patchFind(); patchCard(); }catch(e){ console.warn('plans-axis', e); }
}
boot();
})(typeof window !== 'undefined' ? window : globalThis);
