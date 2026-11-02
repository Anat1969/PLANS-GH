/* ══════════════════════════════════════════════════════════════════
   plans-plus.js — מיקום מדויק, ציר זמן שלבים, וחיבור להתחדשות עירונית.
   נטען אחרי הסקריפט הראשי של index.html ומרחיב אותו בלי לשנות לוגיקה קיימת:
   • מפה: מיקום לפי גוש/חלקה (GIS עירוני) או לפי מתחם ההתחדשות, ומקרא דיוק.
   • ציר זמן: כל אבני הדרך של כל תוכנית, משך כל שלב, וחציון העיר כמדד.
   • התחדשות עירונית: סנכרון חי עם "מה נבנה סביבי" (ASHDODMAP / plan_projects).
   הנתונים הסטטיים: plans-geo.js (נוצר מ-SQL, 02.11.2026).
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ── מקורות ─────────────────────────────────────────────── */
const RN_URL  = 'https://cbhexpybdggwzyakgagd.supabase.co';
const RN_KEY  = 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3'; // מפתח ציבורי, קריאה בלבד (RLS)
const RN_SITE = 'https://ashdod-ma-nivne.vercel.app';
const PARCELS = window.PLAN_PARCELS_BY_PLANNUM || {};
let RENEWAL   = (window.RENEWAL_SNAPSHOT || []).slice();
const RN_SYNC = { state:'snapshot', at:'02.11.2026' };

const RN_STATUS = { planning:'בתכנון', approved:'תוכנית מאושרת', permit:'בהיתר', construction:'בביצוע' };
const RN_TRACK  = { pinui_binui:'פינוי-בינוי', other:'התחדשות' };

/* ── עזרים ─────────────────────────────────────────────── */
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N = n => (n==null||n==='') ? '—' : Number(n).toLocaleString('he-IL');
const today = () => (typeof todayStr==='function') ? todayStr() : new Date().toISOString().slice(0,10);
const isDate = d => /^\d{4}-\d{2}-\d{2}/.test(String(d||''));
const d10 = d => String(d||'').slice(0,10);
const days = (a,b) => Math.round((new Date(d10(b)) - new Date(d10(a))) / 864e5);
const fmt = d => { if(!isDate(d)) return '—'; const [y,m,dd]=d10(d).split('-'); return `${+dd}.${+m}.${y.slice(2)}`; };
const median = arr => { const a=arr.filter(x=>isFinite(x)).sort((x,y)=>x-y); if(!a.length) return null; const m=a.length>>1; return a.length%2?a[m]:Math.round((a[m-1]+a[m])/2); };
const live = () => (typeof livePlans==='function' ? livePlans() : plans);
const active = p => (typeof planIsActive==='function') ? planIsActive(p) : p.status!=='הושלם';
const title = p => (typeof buildProjectTitle==='function') ? buildProjectTitle(p) : (p.projectName||p.location||'');

/** מספר תוכנית מנורמל: "תמל 2022" = "תמל/2022", "112//101/02/3" = "112/101/02/3" */
const normPlan = s => String(s||'').replace(/[^0-9א-ת]/g,'');
/** מספר תוכנית הבינוי (תב/1815 → 1815) — המפתח לנתוני המגרש */
const planNo = p => String(p.planNum||'').replace(/[^0-9]/g,'');

/* ══════════ 1. חיבור לתוכנית התחדשות עירונית ══════════ */
// שיוך לפי שם המתחם, כשהתב"ע בתיק ריקה או שונה. מילים מתוך "מה נבנה סביבי".
const RN_NAME_KEYS = {
  'תמל/2047':['הרב מימון'], '603-0346031':['האצטדיון'], 'תמל/2021':['פלדות'],
  'תמל/2022':['המעפילים'], 'תמל/2023':['אחד העם'], 'תמל/2024':['נאות ספיר'],
  '603-0391219':['מרכז א'], '603-1259092':['גאפנוב'], '603-0780734':['ציזלינג','בני ברית'],
  '603-1097815':['יצחק הנשיא'], '603-0993790':['סיני','קדש'], '3/03/102/94':['הדקל'],
  '603-0271296':['אבן עזרא'], '603-1510577':['מנחם בגין']
};
/** מחזיר {r, how, mismatch} או null */
function planRenewal(p){
  if(!p) return null;
  const ch = normPlan(p.change);
  if(ch){ const r = RENEWAL.find(x => normPlan(x.n)===ch); if(r) return { r, how:'exact' }; }
  const text = [p.location, p.projectName, p.district].join(' ');
  for(const r of RENEWAL){
    const keys = RN_NAME_KEYS[r.n] || [];
    if(keys.some(k => text.includes(k))) return { r, how:'name', mismatch: !!ch };
  }
  return null;
}
function rnUrl(r){ return RN_SITE + '/plan/' + encodeURIComponent(String(r.n).replace(/\s+/g,'').replace(/\//g,'-')); }
window.planRenewal = planRenewal;

/* ══════════ 2. מיקום: מדויק → מתחם → משוער ══════════ */
const PREC = {
  user:     { label:'מיקום שהוזן ידנית',            exact:true  },
  parcel:   { label:'מדויק: גוש וחלקה, GIS עירוני',  exact:true  },
  compound: { label:'מתחם ההתחדשות (מה נבנה סביבי)', exact:true  },
  large:    { label:'משוער: חלקה רשומה גדולה',       exact:false },
  sibling:  { label:'משוער: ממוצע התוכניות ברובע',   exact:false },
  district: { label:'משוער: מרכז הרובע',             exact:false }
};
/** מחזיר {lat,lng,prec,geo,src} או null */
function planGeo(p){
  if(p.lat && p.lng) return { lat:+p.lat, lng:+p.lng, prec:'user' };
  const pc = PARCELS[planNo(p)];
  if(pc) return { lat:pc.c[0], lng:pc.c[1], prec: pc.g ? 'parcel' : 'large', geo: pc.g || null,
                  src:`גוש ${pc.gush} חלקה ${pc.helka}` };
  const rn = planRenewal(p);
  if(rn && rn.r.c) return { lat:rn.r.c[1], lng:rn.r.c[0], prec:'compound', geo: rn.r.g || null, src: rn.r.t };
  // ממוצע התוכניות המדויקות באותו רובע — עדיף על מרכז רובע ידני
  const sib = live().filter(q => q!==p && q.district===p.district && PARCELS[planNo(q)] && PARCELS[planNo(q)].g);
  if(sib.length){
    const la = sib.reduce((s,q)=>s+PARCELS[planNo(q)].c[0],0)/sib.length;
    const ln = sib.reduce((s,q)=>s+PARCELS[planNo(q)].c[1],0)/sib.length;
    return { lat:la, lng:ln, prec:'sibling', src:`${sib.length} תוכניות ברובע ${p.district}` };
  }
  const c = (typeof ASHDOD_DISTRICTS!=='undefined') && ASHDOD_DISTRICTS[p.district];
  if(c) return { lat:c[0], lng:c[1], prec:'district', src:`רובע ${p.district}` };
  return null;
}
window.planGeo = planGeo;

/* ── ציור המפה (מחליף את drawMapMarkers המקורי; אותו מסנן סטטוס) ── */
let _rnLayer = null, _doneLayer = null;
function drawMapMarkersPlus(){
  if(typeof gisMap==='undefined' || !gisMap || !gisLayers.plans) return;
  gisLayers.plans.clearLayers();
  const list = statusFilteredPlans();
  const seen = {};
  const place = (p, g) => {             // פיזור עדין של נקודות זהות
    const k = g.lat.toFixed(4)+','+g.lng.toFixed(4); const i = seen[k] = (seen[k]||0)+1;
    if(i===1) return [g.lat, g.lng];
    const a = i*2.399; const r = 0.00022*Math.sqrt(i);
    return [g.lat + r*Math.cos(a), g.lng + r*Math.sin(a)];
  };
  list.forEach(p => {
    const g = planGeo(p); if(!g) return;
    const color = STATUS_COLORS[p.status] || '#6b6259';
    const exact = PREC[g.prec].exact;
    if(g.geo){
      L.geoJSON(g.geo, { style:{ color, weight:2, fillColor:color, fillOpacity:.18, dashArray: g.prec==='compound'?'5,4':null },
        interactive:false }).addTo(gisLayers.plans);
    }
    const m = L.circleMarker(place(p,g), {
      radius: exact?10:9, fillColor: exact?color:'#fff', color: exact?'#fff':color,
      weight: exact?2:2.5, dashArray: exact?null:'3,3', opacity:1, fillOpacity: exact?.9:.95
    });
    const rn = planRenewal(p);
    m.bindTooltip(`<strong style="font-size:15px">תוכנית בינוי ${H(p.tik)}</strong> <span style="font-family:var(--mono,monospace);font-size:12px;color:#666">${H(p.planNum)}</span>`
      + `<br><span style="font-size:13px">${H(p.district)} · ${H(p.location||'—')}</span>`
      + (rn?`<br><span style="font-size:12px;color:#9c7a3c;font-weight:600">התחדשות עירונית: ${H(rn.r.t)}</span>`:'')
      + `<br><span style="font-size:11px;color:${exact?'#3d8b5e':'#c47a20'}">${H(PREC[g.prec].label)}${g.src?' · '+H(g.src):''}</span>`,
      { direction:'top', offset:[0,-10], className:'big-tooltip' });
    m.on('click', () => openDetail(p.id));
    gisLayers.plans.addLayer(m);
  });
  // תוכניות שהושלמו — שכבת רקע אפורה כשמוצגות רק הפעילות, כדי לראות את ההיסטוריה ברובע
  if(_doneLayer){
    _doneLayer.clearLayers();
    if(statusFilter==='all'){
      live().filter(p=>!active(p)).forEach(p=>{
        const g = planGeo(p); if(!g) return;
        L.circleMarker(place(p,g), { radius:5, fillColor:'#8a8178', color:'#fff', weight:1, fillOpacity:.75 })
          .bindTooltip(`תב/${H(String(p.planNum).replace(/[^0-9]/g,''))} · ${H(p.location||'')} · הושלם`, {direction:'top'})
          .on('click', () => openDetail(p.id)).addTo(_doneLayer);
      });
    }
  }
  renderMapPrecision();
}

function renewalLayer(){
  const lg = L.layerGroup();
  const linked = new Set(live().map(p=>{ const r=planRenewal(p); return r && r.r.n; }).filter(Boolean));
  RENEWAL.forEach(r => {
    if(!r.g) return;
    const has = linked.has(r.n);
    L.geoJSON(r.g, { style:{ color:'#9c7a3c', weight: has?2.5:1.5, fillColor:'#C5A55A', fillOpacity: has?.22:.10 } })
      .bindTooltip(`<strong>${H(r.t)}</strong><br><span style="font-size:12px">${H(r.n)} · ${H(RN_STATUS[r.s]||r.s||'')}</span>`
        + `<br><span style="font-size:12px">${N(r.ue)} → <b>${N(r.up)}</b> יח"ד</span>`
        + (has?'<br><span style="font-size:11px;color:#2A5F5F;font-weight:600">יש תוכנית בינוי במערכת</span>':''), { sticky:true })
      .on('click', () => window.open(rnUrl(r), '_blank', 'noopener'))
      .addTo(lg);
  });
  return lg;
}

function renderMapPrecision(){
  const box = document.getElementById('mapPrecision'); if(!box) return;
  const list = live();
  const cnt = {}; list.forEach(p => { const g=planGeo(p); const k=g?g.prec:'none'; cnt[k]=(cnt[k]||0)+1; });
  const exact = (cnt.user||0)+(cnt.parcel||0)+(cnt.compound||0);
  box.innerHTML = `<div class="pp-insight"><b>${exact}</b> מתוך <b>${list.length}</b> תוכניות ממוקמות מדויק</div>
    <div class="ml-row"><span class="ml-dot" style="background:#2A5F5F;border:2px solid #fff;box-shadow:0 0 0 1px #2A5F5F"></span>מדויק: גוש/חלקה או מתחם (${exact})</div>
    <div class="ml-row"><span class="ml-dot" style="background:#fff;border:2px dashed #c47a20"></span>משוער: לפי רובע (${(cnt.sibling||0)+(cnt.district||0)+(cnt.large||0)})</div>
    <div class="ml-row"><span class="ml-sq" style="background:rgba(197,165,90,.35);border:1.5px solid #9c7a3c"></span>מתחם התחדשות עירונית</div>
    <div class="ml-row"><span class="ml-dot" style="background:#8a8178;width:7px;height:7px"></span>תוכנית שהושלמה (רקע)</div>
    <div class="pp-src">משוער = אין גוש/חלקה בתיק. הוספת גוש וחלקה בכרטיס התוכנית תמקם אותה.</div>`;
}

function patchMap(){
  window.drawMapMarkers = drawMapMarkersPlus;
  const _init = window.initMap;
  window.initMap = function(){
    if(typeof L==='undefined'){ setTimeout(window.initMap, 200); return; }
    _init();
    try{
      _doneLayer = L.layerGroup().addTo(gisMap);
      _rnLayer = renewalLayer(); gisLayers.renewal = _rnLayer; _rnLayer.addTo(gisMap);
      drawMapMarkersPlus();
      const fit = [];
      live().forEach(p=>{ const g=planGeo(p); if(g) fit.push([g.lat,g.lng]); });
      if(fit.length) gisMap.fitBounds(fit, { padding:[30,30], maxZoom:14 });
    }catch(e){ console.warn('plans-plus map', e); }
  };
  // לוח השכבות: שכבת התחדשות + מקרא דיוק
  const panel = document.querySelector('#map .layer-panel');
  if(panel && !document.querySelector('[data-layer=renewal]')){
    const it = document.createElement('div');
    it.className = 'layer-item'; it.setAttribute('onclick',"toggleGIS(this,'renewal')");
    it.innerHTML = '<div class="layer-swatch" style="background:#C5A55A"></div><div class="layer-name">התחדשות עירונית (מה נבנה סביבי)</div><div class="layer-toggle on" data-layer="renewal"></div>';
    panel.insertBefore(it, panel.children[2] || null);
  }
  const legend = document.getElementById('mapLegend');
  if(legend && !document.getElementById('mapPrecision')){
    const d = document.createElement('div'); d.id='mapPrecision'; d.style.marginBottom='10px';
    legend.parentNode.insertBefore(d, legend);
    const t = document.createElement('div'); t.className='section-title'; t.style.marginTop='1.5rem'; t.textContent='דיוק המיקום';
    legend.parentNode.insertBefore(t, d);
  }
  const sub = document.querySelector('#map .page-subtitle');
  if(sub) sub.innerHTML = 'כל תוכנית במגרש שלה: <b>גוש וחלקה</b> מה-GIS העירוני, או <b>מתחם ההתחדשות</b> שלה. לחיצה על סמן פותחת את התוכנית.';
}

/* ══════════ 3. ציר זמן ושלבים ══════════ */
const MS = [  // אבני הדרך, בסדר התהליך. צבעים תואמים ללוח השנה.
  { k:'open', label:'פתיחת תיק',          short:'פתיחה',   color:'#2A5F5F', get:p=>p.date },
  { k:'fa',   label:'פורום אדריכל העיר',  short:'פורום א', color:'#7a1f2b', get:p=>p.forumArchitect },
  { k:'fc',   label:'פורום יועצים',        short:'פורום י', color:'#9c7a3c', get:p=>p.forumConsultants },
  { k:'prep', label:'הכנה לוועדה',         short:'הכנה',    color:'#5B4A8A', get:p=>p.datesPlan&&p.datesPlan.committeePrep },
  { k:'com',  label:'ועדה',                short:'ועדה',    color:'#1a1a1a', get:p=>p.committeeDate },
  { k:'appr', label:'אישור',               short:'אישור',   color:'#3d8b5e', get:p=>p.approvalDate },
  { k:'sign', label:'חתימה',               short:'חתימה',   color:'#3d8b5e', get:p=>p.signDate }
];
function milestones(p){
  return MS.map(m => ({ ...m, d: isDate(m.get(p)) ? d10(m.get(p)) : '' })).filter(m => m.d);
}
/** אבני הדרך לפי סדר התאריכים בפועל (לציור ולשעון). סדר התהליך נשמר לחישוב המדדים. */
const byDate = p => milestones(p).sort((a,b) => a.d.localeCompare(b.d));
/** אבן דרך שמופיעה לפני אבן דרך שקודמת לה בתהליך (למשל ועדה לפני פתיחת תיק) */
function orderIssue(p){
  const ms = milestones(p);
  for(let i=0;i<ms.length;i++) for(let j=i+1;j<ms.length;j++)
    if(ms[j].d < ms[i].d) return { a: ms[i], b: ms[j] };
  return null;
}
/** חציון משך כל מעבר בין אבני דרך עוקבות, על פני כל התוכניות */
function stageBenchmarks(){
  const seg = {}, total = [];
  live().forEach(p => {
    const ms = milestones(p);
    for(let i=1;i<ms.length;i++){
      const dd = days(ms[i-1].d, ms[i].d); if(dd<0) continue;
      const key = ms[i-1].k+'>'+ms[i].k; (seg[key]=seg[key]||[]).push(dd);
    }
    const o = ms.find(m=>m.k==='open'), c = ms.find(m=>m.k==='com');
    if(o && c && c.d>=o.d) total.push(days(o.d, c.d));
  });
  const out = {}; Object.keys(seg).forEach(k => out[k] = { med: median(seg[k]), n: seg[k].length });
  return { seg: out, total: { med: median(total), n: total.length } };
}
/** שעון השלב: כמה ימים התוכנית הפעילה נמצאת מאז אבן הדרך האחרונה שהתקיימה, מול החציון */
function stageClock(p, bm){
  const t = today(), ms = byDate(p);
  const past = ms.filter(m => m.d <= t), next = ms.find(m => m.d > t);
  const last = past[past.length-1]; if(!last) return null;
  const idx = MS.findIndex(m=>m.k===last.k);
  const nxt = next || MS.slice(idx+1).find(m=>m.k!=='appr'&&m.k!=='sign') || null;
  const since = days(last.d, t);
  const key = last.k+'>'+(nxt?nxt.k:'');
  const med = bm.seg[key] ? bm.seg[key].med : null;
  return { last, next, nxt, since, med, late: !next && med!=null && since > med, planned: !!next };
}

let tlFilter = 'active';
try{ tlFilter = localStorage.getItem('ashdod_tl_filter') || 'active'; }catch(e){}
function setTlFilter(k){ tlFilter=k; try{ localStorage.setItem('ashdod_tl_filter',k); }catch(e){} renderTimelinePage(); }
window.setTlFilter = setTlFilter;

function renderTimelinePage(){
  const el = document.getElementById('timelineBody'); if(!el) return;
  const t = today(), bm = stageBenchmarks();
  let list = live().slice();
  if(tlFilter==='active') list = list.filter(active);
  else if(tlFilter==='done') list = list.filter(p=>!active(p));
  else if(tlFilter==='renewal') list = list.filter(p=>planRenewal(p));
  list = list.filter(p => milestones(p).length);
  list.sort((a,b) => (active(b)-active(a)) || String(byDate(b)[0].d).localeCompare(byDate(a)[0].d));

  // טווח הציר: מהאבן הראשונה עד חודשיים אחרי המאוחרת / היום
  let lo = t, hi = t;
  list.forEach(p => milestones(p).forEach(m => { if(m.d<lo) lo=m.d; if(m.d>hi) hi=m.d; }));
  const loD = new Date(lo.slice(0,7)+'-01'); const hiD = new Date(hi); hiD.setMonth(hiD.getMonth()+2); hiD.setDate(1);
  const span = (hiD - loD) || 1;
  const X = d => Math.max(0, Math.min(100, (new Date(d10(d)) - loD) / span * 100));  // RTL: מימין לשמאל

  // סרגל חודשים ושנים
  const HM = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];
  const months = Math.round(span/2.63e9), step = months>30 ? 6 : months>14 ? 3 : 1;
  const ticks = [];
  for(let d = new Date(loD), i=0; d <= hiD; d.setMonth(d.getMonth()+1), i++){
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; const m = d.getMonth();
    const yr = m===0 || i===0;
    const lbl = yr ? `${HM[m]} ${d.getFullYear()}` : (m%step===0 ? HM[m] : '');
    ticks.push(`<span class="tl-tick${yr?' tl-tick-y':''}" style="right:${X(iso)}%">${lbl}</span>`);
  }
  const todayX = X(t);

  const counts = { active: live().filter(active).length, done: live().filter(p=>!active(p)).length,
                   renewal: live().filter(p=>planRenewal(p)).length, all: live().length };
  const chips = [['active','בטיפול'],['renewal','התחדשות עירונית'],['done','הושלמו'],['all','הכול']]
    .map(([k,l]) => `<button class="tl-chip${tlFilter===k?' on':''}" onclick="setTlFilter('${k}')">${l} <span class="tl-n">${counts[k]}</span></button>`).join('');

  // תובנה עליונה
  const act = live().filter(active).map(p => ({ p, c: stageClock(p, bm) })).filter(x => x.c);
  const late = act.filter(x => x.c.late);
  const disorder = live().filter(active).filter(orderIssue);
  const noDates = live().filter(active).filter(p => milestones(p).length<=1);
  const insight = bm.total.med!=null
    ? `<div class="tl-insight"><mark>תוכנית בינוי מגיעה לוועדה בחציון של <b>${bm.total.med}</b> ימים מפתיחת התיק.</mark></div>
       <div class="tl-explain">המדד מחושב מ-<b>${bm.total.n}</b> תוכניות שיש להן גם תאריך פתיחה וגם תאריך ועדה. `
       + (late.length ? `<span class="tl-bad"><b>${late.length}</b> תוכניות בטיפול חורגות מהחציון של השלב שלהן.</span>` : `<span class="tl-good">אף תוכנית בטיפול לא חורגת מהחציון של השלב שלה.</span>`)
       + (noDates.length ? ` <span class="tl-bad"><b>${noDates.length}</b> בלי מועד פורום.</span>` : '')
       + (disorder.length ? `<br><span class="tl-bad">ב-<b>${disorder.length}</b> תוכניות בטיפול סדר המועדים לא הגיוני (למשל ועדה לפני פתיחת התיק).</span> <span class="tl-good">התיקון: בדיקת העקביות בתחתית הדף.</span>` : '') + `</div>`
    : '';

  // רצועת קצב התהליך: חציון כל שלב, ברוחב יחסי
  const flow = [['open','fa'],['fa','fc'],['fc','prep'],['prep','com'],['com','appr']]
    .map(([a,b]) => ({ a: MS.find(m=>m.k===a), b: MS.find(m=>m.k===b), s: bm.seg[a+'>'+b] }))
    .filter(x => x.s && x.s.med!=null);
  const flowSum = flow.reduce((s,x)=>s+Math.max(x.s.med,4),0) || 1;
  const flowHtml = flow.length ? `<div class="tl-flow" aria-label="חציון משך כל שלב">${flow.map(x =>
      `<div class="tl-flow-seg" style="flex:${Math.max(x.s.med,4)/flowSum};border-top-color:${x.b.color}" title="${H(x.a.label)} ← ${H(x.b.label)}: חציון ${x.s.med} ימים (${x.s.n} תוכניות)">
        <span class="tl-flow-lbl">${H(x.a.short)} ← ${H(x.b.short)}</span><span class="tl-flow-val"><b>${x.s.med}</b> ימים</span><span class="tl-flow-n">${x.s.n} תוכניות</span></div>`).join('')}</div>` : '';

  const rows = list.map(p => {
    const ms = byDate(p), isAct = active(p), c = isAct ? stageClock(p, bm) : null;
    const first = ms[0].d, last = ms[ms.length-1].d;
    const end = isAct ? (last > t ? last : t) : last;
    const color = STATUS_COLORS[p.status] || '#6b6259';
    const segs = [];
    for(let i=1;i<ms.length;i++){
      const dd = days(ms[i-1].d, ms[i].d); if(dd<=0) continue;
      const mid = (X(ms[i-1].d)+X(ms[i].d))/2; const w = X(ms[i].d)-X(ms[i-1].d);
      if(w>3.2) segs.push(`<span class="tl-seglbl" style="right:${mid}%">${dd}</span>`);
    }
    const dots = ms.map(m => `<span class="tl-dot${m.d>t?' tl-future':''}" style="right:${X(m.d)}%;--c:${m.color}" title="${H(m.label)}: ${fmt(m.d)}${m.d>t?' (מתוכנן)':''}"></span>`).join('');
    const rn = planRenewal(p);
    const clock = c ? (c.planned
        ? `<span class="tl-clock">הבא: ${H(c.next.short)} בעוד <b>${days(t,c.next.d)}</b> ימים</span>`
        : `<span class="tl-clock${c.late?' late':''}"><b>${c.since}</b> ימים מאז ${H(c.last.short)}${c.med!=null?` · חציון השלב <b>${c.med}</b>`:''}</span>`) : '';
    const oi = orderIssue(p);
    const oiTag = oi ? `<span class="tl-oi" title="${H(oi.b.label)} (${fmt(oi.b.d)}) לפני ${H(oi.a.label)} (${fmt(oi.a.d)})">סדר מועדים</span>` : '';
    return `<div class="tl-row${isAct?' tl-act':''}" onclick="openDetail(${p.id})" tabindex="0" onkeydown="if(event.key==='Enter')openDetail(${p.id})">
      <div class="tl-lab">
        <div class="tl-lab1"><span class="tl-pn">${H(p.planNum||p.tik)}</span> <span class="tl-st" style="color:${color}">${H(p.status)}</span>${rn?'<span class="tl-rn" title="מחובר ל'+H(rn.r.t)+'">התחדשות</span>':''}${oiTag}</div>
        <div class="tl-lab2">${H(p.district)} · ${H(p.location||title(p))}</div>${clock}
      </div>
      <div class="tl-track">
        <span class="tl-bar" style="right:${X(first)}%;width:${Math.max(.4,X(end)-X(first))}%;--c:${color}"></span>
        ${isAct && last<t ? `<span class="tl-wait" style="right:${X(last)}%;width:${Math.max(.3,X(t)-X(last))}%"></span>`:''}
        ${segs.join('')}${dots}
      </div></div>`;
  }).join('');

  const legend = MS.map(m => `<span class="tl-lg"><i style="--c:${m.color}"></i>${m.label}</span>`).join('')
    + `<span class="tl-lg"><i class="tl-future" style="--c:#1a1a1a"></i>מתוכנן</span><span class="tl-lg"><i class="tl-lg-wait"></i>ממתין מאז אבן הדרך האחרונה</span>`;

  el.innerHTML = `
    <div class="page-title">ציר זמן: כל אבני הדרך של כל תוכנית</div>
    ${insight}
    ${flowHtml}
    <div class="tl-tools">${chips}<span class="tl-legend">${legend}</span></div>
    <div class="tl-grid">
      <div class="tl-row tl-head"><div class="tl-lab"><span class="pp-mono">תוכנית · רובע · מגרש</span></div>
        <div class="tl-track tl-axis">${ticks.join('')}<span class="tl-today" style="right:${todayX}%"><em>היום</em></span></div></div>
      ${rows || '<div class="tl-empty">אין תוכניות עם תאריכים בסינון הזה. בחרו "הכול", או הזינו תאריך פתיחה ומועדי פורום בכרטיס התוכנית.</div>'}
      <span class="tl-today-line" style="right:calc(var(--tl-lab) + (100% - var(--tl-lab)) * ${todayX/100})"></span>
    </div>
    <div class="pp-src">המספר על כל קטע = ימים בין שתי אבני דרך. המועדים נקראים מכרטיס התוכנית: תאריך פתיחה, פורום אדריכל, פורום יועצים, הכנה לוועדה, ועדה ואישור. שינוי שם מעדכן גם כאן, בלוח השנה ובמפה.</div>
    ${renderDataChecks()}`;
}
window.renderTimelinePage = renderTimelinePage;

/* ── בדיקת עקביות הנתונים (עלתה מהשוואת קובץ האקסל לאפליקציה) ── */
function dataChecks(){
  const L_ = live(), out = [];
  const byTik = {}; L_.forEach(p => (byTik[p.tik] = byTik[p.tik] || []).push(p));
  Object.entries(byTik).filter(([,a])=>a.length>1).forEach(([t,a]) =>
    out.push({ p:a[0], txt:`מספר תיק <b>${H(t)}</b> משמש ל-${a.length} תוכניות: ${a.map(x=>H(x.planNum)).join(', ')}.` }));
  L_.forEach(p => {
    if(!/^\d+$/.test(String(p.tik))) out.push({ p, txt:`רשומה עם מספר תיק לא תקין (<b>${H(p.tik)}</b>). כנראה שורת בדיקה. כדאי למחוק.` });
    const nm = String(p.projectName||'').match(/תב\s*\/\s*(\d{3,5})/);
    if(nm && planNo(p) && nm[1]!==planNo(p)) out.push({ p, txt:`שם הפרויקט מתייחס ל<b>תב/${nm[1]}</b>, אבל התיק הוא <b>${H(p.planNum)}</b>. ייתכן שהמסמך שויך לפי מספר התיק ולא לפי מספר התוכנית.` });
    const oi = orderIssue(p);
    if(oi) out.push({ p, txt:`<b>${H(p.planNum)}</b>: ${H(oi.b.label)} (<b>${fmt(oi.b.d)}</b>) מופיע לפני ${H(oi.a.label)} (<b>${fmt(oi.a.d)}</b>). כדאי לבדוק את התאריכים בכרטיס.` });
    if(!isDate(p.date)) out.push({ p, txt:`<b>${H(p.planNum)}</b>: חסר תאריך פתיחה, ולכן אין לה ציר זמן.` });
    const rn = planRenewal(p);
    if(rn && rn.how==='name') out.push({ p, txt:`<b>${H(p.planNum)}</b> (${H(p.location)}) שויכה ל<b>${H(rn.r.t)}</b> לפי השם. התב"ע בתיק: <b>${H(p.change||'ריקה')}</b>, ב"מה נבנה סביבי": <b>${H(rn.r.n)}</b>.` });
  });
  return out;
}
function renderDataChecks(){
  const out = dataChecks();
  if(!out.length) return `<div class="tl-checks"><h3 class="tl-h3">בדיקת עקביות הנתונים</h3><div class="tl-good">לא נמצאו פערים.</div></div>`;
  return `<details class="tl-checks"><summary class="tl-h3">בדיקת עקביות הנתונים: <span class="tl-bad"><b>${out.length}</b> פערים לתיקון</span></summary>
    <ol>${out.map(o=>`<li><a href="javascript:void 0" onclick="openDetail(${o.p.id})">${o.txt}</a></li>`).join('')}</ol></details>`;
}

/* ══════════ 4. כרטיס "התחדשות עירונית" בדף התוכנית ══════════ */
function renewalCardHTML(p){
  const rn = planRenewal(p), g = planGeo(p);
  const loc = g ? `<div class="rn-loc"><span class="pp-mono">מיקום</span> <b>${H(PREC[g.prec].label)}</b>${g.src?' · '+H(g.src):''}</div>` : '';
  if(!rn) return loc ? `<div class="rn-card rn-none">${loc}</div>` : '';
  const r = rn.r, mult = (r.ue && r.up) ? (r.up/r.ue).toFixed(1) : null;
  const warn = rn.how==='name'
    ? `<div class="rn-warn">שויך לפי שם המתחם. בתיק: <b>${H(p.change||'אין תב"ע')}</b>. ב"מה נבנה סביבי": <b>${H(r.n)}</b>.
       <button class="btn btn-sm arch-only" onclick="rnFixChange(${p.id})">עדכון התב"ע בתיק ל-${H(r.n)}</button></div>` : '';
  return `<div class="rn-card">
    <div class="rn-k"><span class="pp-mono">התחדשות עירונית · ${H(RN_TRACK[r.tr]||'תוכנית מתחם')}</span></div>
    <div class="rn-main"><b class="rn-t">${H(r.t)}</b> <span class="rn-n">${H(r.n)}</span> <span class="rn-s">${H(RN_STATUS[r.s]||r.s||'')}</span></div>
    <div class="rn-units"><span class="pp-mono">יח"ד</span> <b>${N(r.ue)}</b> קיימות ← <b>${N(r.up)}</b> מתוכננות${mult?` <mark>פי ${mult}</mark>`:''}</div>
    ${loc}${warn}
    <a class="btn btn-sm rn-go" href="${rnUrl(r)}" target="_blank" rel="noopener">המתחם ב"מה נבנה סביבי": מודל תלת־ממדי, צל ושלבים</a>
    <div class="pp-src">${RN_SYNC.state==='live'?'מסונכרן עכשיו עם':'עותק מ-'+RN_SYNC.at+' של'} "מה נבנה סביבי"</div>
  </div>`;
}
window.rnFixChange = function(id){
  const p = plans.find(x=>x.id===id); const rn = planRenewal(p); if(!p||!rn) return;
  p.change = rn.r.n; p.updatedAt = today();
  if(typeof clearSeed==='function') clearSeed(p,'change');
  savePlans(); if(typeof refreshAll==='function') refreshAll();
  if(typeof toast==='function') toast('התב"ע עודכנה ל-'+rn.r.n);
  if(typeof renderStageStrip==='function') renderStageStrip(p);
};
function patchModal(){
  const orig = window.openDetail; if(typeof orig!=='function') return;
  window.openDetail = function(id){
    orig(id);
    try{ const p = plans.find(x=>x.id===id); const mb = document.getElementById('modalBody');
      const html = p && renewalCardHTML(p); if(mb && html) mb.insertAdjacentHTML('afterbegin', html); }catch(e){ console.warn('modal renewal', e); }
  };
}
function patchProject(){
  const orig = window.renderStageStrip;
  if(typeof orig!=='function') return;
  window.renderStageStrip = function(p){
    orig(p);
    try{
      const el = document.getElementById('stageStrip'); if(!el||!p) return;
      const html = renewalCardHTML(p); if(html) el.insertAdjacentHTML('beforeend', html);
    }catch(e){ console.warn('renewal card', e); }
  };
}

/* ══════════ 5. סנכרון חי עם "מה נבנה סביבי" ══════════ */
async function syncRenewal(){
  try{
    const ctl = new AbortController(); const to = setTimeout(()=>ctl.abort(), 7000);
    const res = await fetch(RN_URL + '/rest/v1/plan_projects?select=plan_number,title,renewal_track,status,units_existing,units_planned,center&published=eq.true',
      { headers:{ apikey:RN_KEY, Authorization:'Bearer '+RN_KEY }, signal: ctl.signal });
    clearTimeout(to);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const rows = await res.json(); if(!Array.isArray(rows) || !rows.length) return;
    const geo = {}; RENEWAL.forEach(r => geo[r.n] = r.g);
    RENEWAL = rows.map(r => ({ n:r.plan_number, t:r.title, tr:r.renewal_track, s:r.status,
      ue:r.units_existing, up:r.units_planned, c:r.center, g: geo[r.plan_number] || null }));
    RN_SYNC.state = 'live';
    if(typeof gisMap!=='undefined' && gisMap && _rnLayer){ gisMap.removeLayer(_rnLayer); _rnLayer = renewalLayer(); gisLayers.renewal=_rnLayer;
      const tg=document.querySelector('.layer-toggle[data-layer=renewal]'); if(!tg||tg.classList.contains('on')) _rnLayer.addTo(gisMap); drawMapMarkersPlus(); }
    const pg = document.querySelector('.page.active'); if(pg && pg.id==='timeline') renderTimelinePage();
  }catch(e){ /* נשארים על העותק — הכרטיס אומר זאת */ }
}


/* ══════════ 6. דף הבית: שורת תובנה, מספרים, מודל שלבים איזומטרי ══════════ */
const ISO_STAGES = [
  { k:'stage_1',   label:'פורום אדריכל העיר', color:'#7a1f2b' },
  { k:'stage_2',   label:'פורום יועצים',      color:'#9c7a3c' },
  { k:'committee', label:'הכנה לוועדה',       color:'#5B4A8A' },
  { k:'approved',  label:'אושר, לחתימה',      color:'#2f7d55' },
  { k:'done',      label:'הושלמו',             color:'#1f5c58' }
];
function stageOf(p){ if(!active(p)) return 'done'; const k = p.stage || 'stage_1'; return ISO_STAGES.some(s=>s.k===k) ? k : 'stage_1'; }
function isoSVG(groups){
  const C = .866, S = 34, gap = 1.75, n = ISO_STAGES.length;
  const max = Math.max(1, ...ISO_STAGES.map(s => groups[s.k].length));
  const P = (x,y,z) => [ (x - y) * C * S, (x + y) * .5 * S - z * S ];
  const pts = [], polys = [];
  const poly = (arr, fill, extra='') => { arr.forEach(a=>pts.push(a)); return `<polygon points="${arr.map(a=>a[0].toFixed(1)+','+a[1].toFixed(1)).join(' ')}" fill="${fill}" ${extra}/>`; };
  // לוח בסיס: שולחן השרטוט
  const L0 = -.5, L1 = (n-1)*gap + 1.5, D0 = -.6, D1 = 1.6, T = .18;
  const base = [
    poly([P(L0,D0,0),P(L1,D0,0),P(L1,D1,0),P(L0,D1,0)], '#f4f3ef', 'stroke="#d9d7d0" stroke-width="1"'),
    poly([P(L1,D0,0),P(L1,D1,0),P(L1,D1,-T),P(L1,D0,-T)], '#e2e0d9'),
    poly([P(L0,D1,0),P(L1,D1,0),P(L1,D1,-T),P(L0,D1,-T)], '#d3d1c9')
  ].join('');
  // קו הזרימה על הלוח: מהפתיחה (ימין) להשלמה
  const f0 = P((n-1)*gap+.5, 1.25, 0), f1 = P(.5, 1.25, 0);
  const flow = `<line x1="${f0[0]}" y1="${f0[1]}" x2="${f1[0]}" y2="${f1[1]}" stroke="#1a1a18" stroke-width="1.2" stroke-dasharray="4 4" marker-end="url(#isoArrow)"/>`;
  const cols = ISO_STAGES.map((st, i) => {
    const cnt = groups[st.k].length;
    const x0 = (n-1-i)*gap, y0 = 0, w = 1, d = 1;
    const h = cnt ? .35 + 2.5*Math.sqrt(cnt/max) : .06;
    const top = [P(x0,y0,h),P(x0+w,y0,h),P(x0+w,y0+d,h),P(x0,y0+d,h)];
    const fx = [P(x0+w,y0,0),P(x0+w,y0+d,0),P(x0+w,y0+d,h),P(x0+w,y0,h)];
    const fy = [P(x0,y0+d,0),P(x0+w,y0+d,0),P(x0+w,y0+d,h),P(x0,y0+d,h)];
    const tc = P(x0+w/2, y0+d/2, h);
    // קווי קומות: כל תוכנית היא "קומה" בנפח
    const floors = [];
    for(let f=1, step=cnt>20?5:1; f<cnt; f+=step){ const z = h*f/cnt; const a=P(x0+w,y0+d,z), b=P(x0+w,y0,z), c=P(x0,y0+d,z);
      floors.push(`<polyline points="${b[0]},${b[1]} ${a[0]},${a[1]} ${c[0]},${c[1]}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/>`); }
    return `<g class="iso-col" data-k="${st.k}" style="animation-delay:${.08*i}s" tabindex="0" role="button" aria-label="${H(st.label)}: ${cnt} תוכניות">
      ${poly(fx, st.color)}${poly(fx, '#000', 'fill-opacity=".14"')}
      ${poly(fy, st.color)}${poly(fy, '#000', 'fill-opacity=".32"')}
      ${poly(top, st.color, 'class="iso-top"')}${poly(top, '#fff', 'fill-opacity=".22"')}
      ${floors.join('')}
      <text x="${tc[0]}" y="${tc[1]-10}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="20" fill="#1a1a18">${cnt}</text>
    </g>`;
  }).join('');
  pts.push(P(.5,.5,4.6));
  const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]);
  const vb = [Math.min(...xs)-12, Math.min(...ys)-28, Math.max(...xs)-Math.min(...xs)+24, Math.max(...ys)-Math.min(...ys)+40];
  return `<svg viewBox="${vb.map(v=>v.toFixed(0)).join(' ')}" role="img" aria-label="מודל איזומטרי: מספר התוכניות בכל שלב">
    <defs><marker id="isoArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1a1a18"/></marker></defs>
    ${base}${flow}${cols}</svg>`;
}
let _isoGroups = {};
function isoFocus(k){
  const box = document.querySelector('.home-iso'); if(!box) return;
  box.classList.toggle('hl', !!k);
  box.querySelectorAll('.iso-col').forEach(g => g.classList.toggle('on', g.dataset.k===k));
  document.querySelectorAll('.iso-lg button').forEach(b => b.classList.toggle('on', b.dataset.k===k));
  const cap = document.getElementById('isoCap'); if(!cap) return;
  if(!k){ cap.textContent = 'כל נפח הוא שלב. כל קומה היא תוכנית. ריחוף מציג את התוכניות.'; return; }
  const st = ISO_STAGES.find(s=>s.k===k), list = _isoGroups[k] || [];
  cap.innerHTML = `<b>${H(st.label)}</b>: ` + (list.length ? list.slice(0,8).map(p=>H(p.planNum||p.tik)).join(' · ') + (list.length>8?` ועוד ${list.length-8}`:'') : 'אין תוכניות בשלב הזה');
}
window.isoFocus = isoFocus;
window.isoGo = function(k){ if(k==='done'){ if(typeof setStatusFilter==='function') setStatusFilter('הושלם'); go('table', navBtn('table')); } else { tlFilter='active'; go('timeline', navBtn('timeline')); } };

function renderHome(){
  const hero = document.querySelector('#landing .hero'); if(!hero) return;
  const L_ = live(), act = L_.filter(active), done = L_.length - act.length;
  const bm = stageBenchmarks(), t = today();
  let next = null;
  act.forEach(p => milestones(p).forEach(m => { if(m.d > t && (!next || m.d < next.m.d)) next = { p, m }; }));
  const exact = L_.filter(p => { const g = planGeo(p); return g && PREC[g.prec].exact; }).length;
  const issues = dataChecks().length;
  const rnAct = act.filter(p => planRenewal(p));
  const groups = {}; ISO_STAGES.forEach(s => groups[s.k] = []); L_.forEach(p => groups[stageOf(p)].push(p));
  _isoGroups = groups;
  const head = next
    ? `<span class="n">${act.length}</span> תוכניות בטיפול. הבאה בתור בעוד <span class="n">${days(t, next.m.d)}</span> ימים`
    : `<span class="n">${act.length}</span> תוכניות בטיפול, <span class="n">${act.length}</span> בלי מועד הבא`;
  const nextLine = next ? `<br>הבא: <b>${H(next.m.label)}</b> של <b>${H(next.p.planNum)}</b> (${H(next.p.location||'')}), ב-<b>${fmt(next.m.d)}</b>.` : '';
  hero.innerHTML = `
  <div class="home">
    <div class="home-txt rise">
      <div class="home-k">עיריית <b>אשדוד</b> <i>Ashdod</i> · אדריכלית העיר ענת דוד שטיבלמן</div>
      <h1>${head}</h1>
      <p class="home-ex">ניהול, מעקב, תיאום ובדיקה של <b>${L_.length}</b> תוכניות בינוי, מפתיחת התיק ועד החתימה.${nextLine}</p>
      <div class="home-stats">
        <div onclick="go('table',navBtn('table'))"><span class="l">סה״כ תוכניות</span><span class="v">${L_.length}</span><span class="s">במערכת</span></div>
        <div onclick="go('timeline',navBtn('timeline'))"><span class="l">בטיפול</span><span class="v">${act.length}</span><span class="s">פורום עד חתימה</span></div>
        <div onclick="isoGo('done')"><span class="l">הושלמו</span><span class="v">${done}</span><span class="s">נחתמו או נסגרו</span></div>
        <div onclick="go('timeline',navBtn('timeline'))"><span class="l">חציון לוועדה</span><span class="v">${bm.total.med!=null?bm.total.med:'—'}</span><span class="s">ימים מפתיחה</span></div>
        <div onclick="go('map',navBtn('map'))"><span class="l">במגרש מדויק</span><span class="v">${exact}<small style="font-size:.55em;color:var(--ink-mute)">/${L_.length}</small></span><span class="s">על המפה</span></div>
      </div>
      <div id="heroStats" hidden></div>
    </div>
    <div class="home-iso rise" style="animation-delay:.1s" onmouseleave="isoFocus(null)">
      ${isoSVG(groups)}
      <div class="iso-lg">${ISO_STAGES.map(s=>`<button data-k="${s.k}" style="--c:${s.color}" onmouseenter="isoFocus('${s.k}')" onfocus="isoFocus('${s.k}')" onclick="isoGo('${s.k}')"><i></i>${H(s.label)} <span class="tl-n">${groups[s.k].length}</span></button>`).join('')}</div>
      <div class="iso-cap" id="isoCap"></div>
    </div>
  </div>
  <div class="tones">
    <div class="tone tone-problem rise" style="animation-delay:.15s" onclick="go('timeline',navBtn('timeline'));setTimeout(()=>{const d=document.querySelector('.tl-checks');if(d){d.open=true;d.scrollIntoView({behavior:'smooth'});}},120)">
      <div class="k">בעיה</div><h4><b>${issues}</b> פערים בנתוני התוכניות</h4><p>סדר מועדים הפוך, תאריכי פתיחה חסרים ומסמכים ששויכו לתיק הלא נכון.</p></div>
    <div class="tone tone-solution rise" style="animation-delay:.2s" onclick="go('timeline',navBtn('timeline'))">
      <div class="k">פתרון</div><h4>ציר זמן אחד לכל השלבים</h4><p>כל מועד של כל תוכנית, משך כל שלב, והשוואה לחציון העיר.</p></div>
    <div class="tone tone-insight rise" style="animation-delay:.25s" onclick="go('map',navBtn('map'))">
      <div class="k">תובנה</div><h4><mark>${rnAct.length} מתוך ${act.length} תוכניות בטיפול הן בהתחדשות עירונית</mark></h4><p>${rnAct.length?`רובעים: <b>${H([...new Set(rnAct.map(p=>p.district))].join(', '))}</b>. `:''}המפה מחברת כל תוכנית למתחם שלה ולמספר יח"ד המתוכנן.</p></div>
  </div>`;
  // מספר מפתח בכל כרטיס במפת התוכן
  const qn = { table: L_.length, map: exact, timeline: act.length, trends: new Set(L_.map(p=>p.district).filter(Boolean)).size };
  document.querySelectorAll('#landing .quick-card').forEach(c => {
    const m = (c.getAttribute('onclick')||'').match(/go\('(\w+)'/); if(!m || qn[m[1]]==null) return;
    let el = c.querySelector('.qn'); if(!el){ el = document.createElement('span'); el.className='qn'; c.appendChild(el); }
    el.textContent = qn[m[1]];
  });
  // מעקב ותוכנית עבודה: זה לצד זה, גלילה בתוך הרכיב ולא בדף (סעיף 2.9 א)
  const at = document.getElementById('activeTracking'), dw = document.getElementById('dailyWork');
  if(at && dw && !at.closest('.home-work')){
    const wrap = document.createElement('div'); wrap.className = 'home-work';
    at.parentNode.insertBefore(wrap, at); wrap.appendChild(at); wrap.appendChild(dw);
  }
  let src = document.getElementById('homeSrc');
  if(!src){ src = document.createElement('div'); src.id='homeSrc'; src.className='home-src'; document.getElementById('landing').appendChild(src); }
  src.innerHTML = 'השראה: תרשים הגאנט של <b>הנרי גאנט</b> Henry Gantt, 1910, וערימות הנפח של תוכניות בינוי. מקורות: GIS עיריית אשדוד (גושים וחלקות), "מה נבנה סביבי" (מתחמי התחדשות).';
  isoFocus(null);
}
function patchHome(){
  const _rl = window.renderLanding;
  if(typeof _rl==='function') window.renderLanding = function(){ _rl(); try{ renderHome(); }catch(e){ console.warn('home', e); } };
  try{ renderHome(); }catch(e){}
  // הנתונים משתנים אחרי טעינת ה-seed והענן: מרעננים את דף הבית כשהוא פתוח
  ['applySeedOpinions','fixDataIssues','applyFilters'].forEach(fn => {
    const o = window[fn]; if(typeof o!=='function') return;
    window[fn] = function(){ const r = o.apply(this, arguments);
      const pg = document.querySelector('.page.active'); if(pg && pg.id==='landing') requestAnimationFrame(()=>{ try{ renderHome(); }catch(e){} });
      return r; };
  });
  document.addEventListener('mouseover', e => { const g = e.target.closest && e.target.closest('.iso-col'); if(g) isoFocus(g.dataset.k); });
  document.addEventListener('click', e => { const g = e.target.closest && e.target.closest('.iso-col'); if(g) isoGo(g.dataset.k); });
}

/* ══════════ חיבור לניווט ══════════ */
function patchNav(){
  const _go = window.go;
  window.go = function(id, btn, isBack){
    _go(id, btn, isBack);
    if(id==='timeline') renderTimelinePage();
  };
  ['architect','manager'].forEach(r => { if(typeof NAV_VISIBLE!=='undefined' && NAV_VISIBLE[r] && !NAV_VISIBLE[r].includes('timeline')) NAV_VISIBLE[r].splice(NAV_VISIBLE[r].indexOf('calendar')+1, 0, 'timeline'); });
  const _ref = window.refreshAll;
  if(typeof _ref==='function') window.refreshAll = function(){ _ref(); const pg=document.querySelector('.page.active'); if(pg&&pg.id==='timeline') requestAnimationFrame(renderTimelinePage); };
}

function boot(){
  if(typeof plans==='undefined'){ return setTimeout(boot, 50); }
  patchMap(); patchProject(); patchModal(); patchNav(); patchHome();
  syncRenewal();
  if((location.hash||'')==='#timeline'){ const b=document.querySelector('#mainNav button[data-nav="timeline"]'); window.go('timeline', b); }
  if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
}
boot();
})();
