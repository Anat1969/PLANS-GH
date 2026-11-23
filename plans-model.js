/* ══════════════════════════════════════════════════════════════════
   plans-model.js: המודל התלת־ממדי של תוכנית הפיתוח (ענת, 23.11.2026).
   כל אלמנט נבנה מהגאומטריה הווקטורית של השרטוט (layers/<תיק>/model.json, מופק ב-tools/extract-model.py):
   משטחים עם מרקם (אספלט, ריצוף, דשא), קירות קומת הקרקע, עצים, עמודי תאורה, ספסלים, מכלים וכבאיות ברחבות הכיבוי.
   המודל ממוקם ברשת ישראל, ולכן השמש, הצל והמפה נכונים למקום.
   מה שאינו מהשרטוט מסומן כהנחה: גובה הבניינים (מספר הקומות) וכיוון הרוח.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ── מקרא: כל סוג אלמנט, הנושא שלו, הצבע וההסבר ── */
const KINDS = [
 { id:'plot', topic:'site', label:'הקו הכחול', color:'#1f5fd0', desc:'גבול התוכנית, כסרט כחול נמוך.' },
 { id:'lots', topic:'site', label:'גבולות מגרשים', color:'#6f8fd8', desc:'חלוקת המגרשים בתוך התוכנית.' },
 { id:'bline', topic:'site', label:'קו מרתף ודיפון', color:'#e08a1e', desc:'תחום החפירה מתחת לקרקע. קובע איפה אפשר לנטוע עץ באדמה עמוקה.' },
 { id:'wall', topic:'build', label:'קירות קומת הקרקע', color:'#e8e4da', desc:'הקירות והעמודים מתוכנית האדריכל, בגובה 4 מ\'.' },
 { id:'glass', topic:'build', label:'זיגוג וחזית מסחרית', color:'#8fc7dc', desc:'קירות המסך והחלונות: איפה הבניין פתוח לרחוב.' },
 { id:'door', topic:'build', label:'דלתות וכניסות', color:'#8a5a2b', desc:'פתחי הכניסה בקומת הקרקע.' },
 { id:'mass', topic:'build', label:'מסת הבניין (הנחה)', color:'#f4f2ec', desc:'נפח מעל קומת הקרקע, לפי מספר הקומות שבחרת. הגובה אינו מהשרטוט.' },
 { id:'asphalt', topic:'road', label:'כביש: אספלט', color:'#48484c', desc:'המיסעה מתוכנית התנועה.' },
 { id:'brt', topic:'road', label:'נתיב תחבורה ציבורית', color:'#b5653a', desc:'הנתיב הצבוע בשדרות הרצל.' },
 { id:'curb', topic:'road', label:'אבני שפה', color:'#cfcbc0', desc:'קו המפגש בין כביש למדרכה, מוגבה 15 ס"מ.' },
 { id:'paint', topic:'road', label:'סימון כביש', color:'#ffffff', desc:'קווי נתיבים, חיצים ואיי תנועה.' },
 { id:'ramp', topic:'park', label:'רמפה לחניון', color:'#77777c', desc:'הירידה לחניון התת־קרקעי.' },
 { id:'parking', topic:'park', label:'קווי חניה ורמפה', color:'#9a9a9a', desc:'מתאר מקומות החניה והרמפות.' },
 { id:'bike', topic:'bike', label:'שביל אופניים', color:'#3f8fb5', desc:'רצועת האופניים, בנפרד מהולכי הרגל.' },
 { id:'paving', topic:'walk', label:'ריצוף', color:'#d9cf9c', desc:'כל המשטחים המרוצפים. הגוון לפי סוג הריצוף בשרטוט.' },
 { id:'cross', topic:'walk', label:'מעברי חצייה', color:'#ffffff', desc:'איפה הולך הרגל חוצה את הכביש.' },
 { id:'stairs', topic:'walk', label:'מדרגות', color:'#5a5a5a', desc:'מדרגות בפיתוח ובמבנים: מכשול לרציפות נגישה.' },
 { id:'lowwall', topic:'level', label:'קירות פיתוח', color:'#b9a98c', desc:'קירות תומכים וקירות ישיבה, בגובה 90 ס"מ.' },
 { id:'fence', topic:'level', label:'גדרות ומעקות', color:'#55524c', desc:'גדרות ומעקות, בגובה 1.2 מ\'.' },
 { id:'green', topic:'green', label:'גינון', color:'#7fbf6a', desc:'שטחי הגינון והדשא: שטח מחלחל.' },
 { id:'gardenedge', topic:'green', label:'אבן גן', color:'#8f8a7a', desc:'תיחום הערוגות.' },
 { id:'treeNew', topic:'trees', label:'עץ מוצע', color:'#5c9a4a', desc:'עץ לנטיעה. קוטר הצמרת לפי השרטוט.' },
 { id:'treeOld', topic:'trees', label:'עץ קיים', color:'#3f7a3a', desc:'עץ שמופיע בשרטוט כקיים.' },
 { id:'treeSurvey', topic:'trees', label:'סימון סקר העצים', color:'#e63a00', desc:'טבעת בצבע הסימון של סקר העצים. המשמעות לפי מקרא הסקר.' },
 { id:'pergola', topic:'shade', label:'פרגולה', color:'#c9b08f', desc:'הצללה בנויה, בגובה 2.8 מ\'.' },
 { id:'deck', topic:'shade', label:'דק עץ', color:'#b08a5e', desc:'משטח עץ לשהייה.' },
 { id:'play', topic:'shade', label:'משטח משחק', color:'#f09a42', desc:'משטח גומי למתקני משחק.' },
 { id:'bench', topic:'shade', label:'ספסל', color:'#9a6b3a', desc:'ספסל במקום ובכיוון שבשרטוט.' },
 { id:'water', topic:'water', label:'קו מים קיים', color:'#1e73d8', desc:'ממפת המדידה: המצב הקיים, לא תכנון מוצע. מוצג מעל הקרקע כדי שייראה.' },
 { id:'sewer', topic:'water', label:'קו ביוב קיים', color:'#8a5a2b', desc:'ממפת המדידה: המצב הקיים, לא תכנון מוצע.' },
 { id:'drain', topic:'water', label:'ניקוז מוצע', color:'#27a3a3', desc:'קווי הניקוז מתוכנית הפיתוח.' },
 { id:'cover', topic:'water', label:'שוחות קיימות', color:'#3a3a3a', desc:'מכסי שוחות ממפת המדידה.' },
 { id:'lamp', topic:'power', label:'עמוד תאורה', color:'#f2c230', desc:'רובם עמודים קיימים בשדרות הרצל. בגובה 7 מ\', ובלילה הפנסים נדלקים.' },
 { id:'cabinet', topic:'power', label:'ארון תשתית קיים', color:'#6d7a6f', desc:'ארונות ממפת המדידה, בגובה 1.4 מ\'.' },
 { id:'trafo', topic:'power', label:'טרנספורמציה ותקשורת', color:'#c8c2b4', desc:'חדר טרנספורמציה, לפי שם השכבה בשרטוט.' },
 { id:'gas', topic:'power', label:'גז', color:'#d8a51e', desc:'קווי ומתקני גז.' },
 { id:'bin', topic:'waste', label:'מכלי מיחזור', color:'#2f7d5a', desc:'מכלים במקום שבשרטוט, לפי שכבת המיחזור.' },
 { id:'fire', topic:'fire', label:'רחבת כיבוי וכבאית', color:'#c8202a', desc:'כבאית באורך 9.5 מ\' עומדת בכל רחבה שסומנה.' },
 { id:'firemark', topic:'fire', label:'סימון הרחבות', color:'#e23b3b', desc:'הסימון האדום מהשרטוט.' },
 { id:'fireroute', topic:'fire', label:'מסלול רכב הכיבוי', color:'#e23b3b', desc:'רדיוסי הסיבוב והגישה.' }
 ,{ id:'exBuild', topic:'exist', label:'מבנה קיים להריסה', color:'#6a6a6a', desc:'מתאר ממפת הרקע העירונית. הגובה סמלי: 13 מ\'.' },
 { id:'rnParcel', topic:'renewal', label:'מגרשים לפי ייעוד', color:'#e0884a', desc:'תאי השטח מהתשריט, בצבע הייעוד.' },
 { id:'rnMass', topic:'renewal', label:'נפח לפי הזכויות', color:'#e8b93c', desc:'נפח לדוגמה מטבלה 5, מחולק לקומות. הערכה, לא תכנון הבינוי.' },
 { id:'facade', topic:'build', label:'חזיתות להמחשה', color:'#e9e3d6', desc:'מגדל מעל קומת הקרקע: הקומות והגובה לפי התב"ע. החלונות, המרפסות והחיפוי הם המחשה, לא מהשרטוט.' },
 { id:'under', topic:'park', label:'קומות מרתף וחניון', color:'#8d98a6', desc:'מספר הקומות מהוראות התוכנית. המתאר הוא גבול המגרש, וזו הנחה.' },
 { id:'rnEnvelope', topic:'renewal', label:'המעטפת המותרת', color:'#ffffff', desc:'השטח שבין קווי הבניין, עד הגובה המרבי.' }
];
/* מקרא הייעודים של התב"ע: אותם צבעים בכל התוכניות */
const ZONES = { residential:['מגורים', '#e8b93c'], mixed:['מגורים ומסחר', '#e0884a'], commerce:['מסחר', '#b6529c'], public:['מבני ציבור', '#a5673f'], open:['שטח פתוח', '#6fae5d'], road:['דרכים', '#a8a8a8'] };
const STATE_KINDS = { exist:['exBuild','treeOld','treeSurvey','water','sewer','cover','cabinet','lamp'], renewal:['rnParcel','rnMass','rnEnvelope'] };
const KIND = Object.fromEntries(KINDS.map(k => [k.id, k]));

/* ── רשת ישראל החדשה ↔ WGS84 ── */
const G = { a:6378137, f:1/298.257222101, k0:1.0000067, lon0:(35+12/60+16.261/3600)*Math.PI/180, lat0:(31+44/60+3.817/3600)*Math.PI/180, FE:219529.584, FN:626907.39 };
G.e2 = G.f*(2-G.f); G.ep2 = G.e2/(1-G.e2);
function mer(p){ const e = G.e2; return G.a*((1-e/4-3*e*e/64-5*e*e*e/256)*p-(3*e/8+3*e*e/32+45*e*e*e/1024)*Math.sin(2*p)+(15*e*e/256+45*e*e*e/1024)*Math.sin(4*p)-(35*e*e*e/3072)*Math.sin(6*p)); }
function itm2wgs(E, N){
  const e = G.e2, M1 = mer(G.lat0)+(N-G.FN)/G.k0, mu = M1/(G.a*(1-e/4-3*e*e/64-5*e*e*e/256)), e1 = (1-Math.sqrt(1-e))/(1+Math.sqrt(1-e));
  const p1 = mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu)+(151*e1**3/96)*Math.sin(6*mu);
  const C1 = G.ep2*Math.cos(p1)**2, T1 = Math.tan(p1)**2, N1 = G.a/Math.sqrt(1-e*Math.sin(p1)**2), R1 = G.a*(1-e)/Math.pow(1-e*Math.sin(p1)**2, 1.5), D = (E-G.FE)/(N1*G.k0);
  const lat = p1-(N1*Math.tan(p1)/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*G.ep2)*D**4/24+(61+90*T1+298*C1+45*T1*T1-252*G.ep2-3*C1*C1)*D**6/720);
  const lon = G.lon0+(D-(1+2*T1+C1)*D**3/6+(5-2*C1+28*T1-3*C1*C1+8*G.ep2+24*T1*T1)*D**5/120)/Math.cos(p1);
  return [lat*180/Math.PI, lon*180/Math.PI];
}
function wgs2itm(latD, lonD){
  const lat = latD*Math.PI/180, lon = lonD*Math.PI/180, e = G.e2;
  const Nn = G.a/Math.sqrt(1-e*Math.sin(lat)**2), T = Math.tan(lat)**2, C = G.ep2*Math.cos(lat)**2, A = (lon-G.lon0)*Math.cos(lat), M = mer(lat), M0 = mer(G.lat0);
  const x = G.k0*Nn*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*G.ep2)*A**5/120);
  const y = G.k0*(M-M0+Nn*Math.tan(lat)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*G.ep2)*A**6/720));
  return [x+G.FE, y+G.FN];
}

/* ── מיקום השמש (נוסחאות SunCalc) ── */
function sunPos(date, lat, lng){
  const rad = Math.PI/180, d = date.valueOf()/86400000 - 0.5 + 2440588 - 2451545, M = rad*(357.5291+0.98560028*d);
  const C = rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M)), L = M+C+rad*102.9372+Math.PI, e = rad*23.4397;
  const dec = Math.asin(Math.sin(e)*Math.sin(L)), ra = Math.atan2(Math.sin(L)*Math.cos(e), Math.cos(L));
  const H = rad*(280.16+360.9856235*d) + rad*lng - ra, phi = rad*lat;
  return { alt: Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H)),
           az: Math.atan2(Math.sin(H), Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi)) + Math.PI };   // אזימוט מצפון, עם כיוון השעון
}
/** תאריך לפי שעון ישראל */
function ilDate(y, m, d, hour){
  const guess = new Date(Date.UTC(y, m-1, d, Math.floor(hour), Math.round((hour%1)*60)));
  let off = 2; try{ const s = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Jerusalem', hour:'numeric', hour12:false }).format(guess); off = ((+s) - guess.getUTCHours() + 24) % 24; }catch(e){}
  return new Date(guess.valueOf() - off*3600000);
}

/* ── מרקמים: מצוירים בקוד, בלי קבצים ── */
function tex(T, size, draw, repeatM){
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1/repeatM, 1/repeatM); t.anisotropy = 4; return t;
}
function noise(g, s, base, spread, n){ g.fillStyle = base; g.fillRect(0, 0, s, s);
  for(let i = 0; i < n; i++){ const v = Math.floor(Math.random()*spread); g.fillStyle = `rgba(${Math.random()<.5?0:255},${Math.random()<.5?0:255},${Math.random()<.5?0:255},${v/255})`; g.fillRect(Math.random()*s, Math.random()*s, 1+Math.random()*2, 1+Math.random()*2); } }
function textures(T){
  return {
    asphalt: tex(T, 256, (g, s) => noise(g, s, '#ffffff', 46, 5200), 4),
    paving: tex(T, 256, (g, s) => { noise(g, s, '#ffffff', 16, 900); g.strokeStyle = 'rgba(90,80,60,.35)'; g.lineWidth = 1.5;
      for(let i = 0; i <= 8; i++){ g.beginPath(); g.moveTo(0, i*s/8); g.lineTo(s, i*s/8); g.stroke(); }
      for(let r = 0; r < 8; r++) for(let i = 0; i <= 4; i++){ const x = (i + (r%2)*.5) * s/4; g.beginPath(); g.moveTo(x, r*s/8); g.lineTo(x, (r+1)*s/8); g.stroke(); } }, 3.2),
    grass: tex(T, 256, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); for(let i = 0; i < 4200; i++){ g.strokeStyle = `rgba(${20+Math.random()*40},${70+Math.random()*60},20,${.10+Math.random()*.22})`; const x = Math.random()*s, y = Math.random()*s; g.beginPath(); g.moveTo(x, y); g.lineTo(x+Math.random()*3-1.5, y-2-Math.random()*4); g.stroke(); } }, 5),
    wood: tex(T, 128, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); g.fillStyle = 'rgba(70,40,10,.35)'; for(let i = 0; i < 8; i++) g.fillRect(0, i*s/8, s, 2); }, 1.2),
    rubber: tex(T, 128, (g, s) => noise(g, s, '#ffffff', 26, 1500), 2)
  };
}

/* ── גאומטריה ── */
function ring2(flat){ const o = []; for(let i = 0; i < flat.length; i += 2) o.push([flat[i]/10, flat[i+1]/10]); return o; }
/** משטחים שטוחים: כל פוליגון משולש ומאוחד לגאומטריה אחת, עם צבע לכל קודקוד */
function flatGeo(T, polys, y, tint){
  const pos = [], uv = [], col = [], c = new T.Color();
  for(const [hex, flat] of polys){
    const r = ring2(flat), v = r.map(p => new T.Vector2(p[0], p[1]));
    let tris; try{ tris = T.ShapeUtils.triangulateShape(v, []); }catch(e){ continue; }
    c.set(hex); const k = tint; const cr = 1-k+k*c.r, cg = 1-k+k*c.g, cb = 1-k+k*c.b;
    for(const t of tris) for(const i of [t[0], t[2], t[1]]){ pos.push(r[i][0], y, -r[i][1]); uv.push(r[i][0], r[i][1]); col.push(cr, cg, cb); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  const nr = new Float32Array(pos.length); for(let i = 1; i < nr.length; i += 3) nr[i] = 1; g.setAttribute('normal', new T.BufferAttribute(nr, 3)); return g;
}
/** הרמה לגובה: פאה עליונה ודפנות */
function extrudeGeo(T, rings, y0, h){
  const pos = [];
  for(const r of rings){
    const v = r.map(p => new T.Vector2(p[0], p[1])); let tris; try{ tris = T.ShapeUtils.triangulateShape(v, []); }catch(e){ continue; }
    for(const t of tris) for(const i of [t[0], t[2], t[1]]) pos.push(r[i][0], y0+h, -r[i][1]);
    const ccw = T.ShapeUtils.isClockWise(v) ? -1 : 1;
    for(let i = 0; i < r.length; i++){ const a = r[i], b = r[(i+1)%r.length]; const [p, q] = ccw > 0 ? [a, b] : [b, a];
      pos.push(p[0], y0, -p[1], q[0], y0, -q[1], q[0], y0+h, -q[1], p[0], y0, -p[1], q[0], y0+h, -q[1], p[0], y0+h, -p[1]); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
/** סרט אנכי לאורך קווים: קירות, גדרות, אבני שפה */
function ribbonGeo(T, lines, y0, h){
  const pos = [];
  for(const flat of lines){ const r = ring2(flat);
    for(let i = 0; i < r.length-1; i++){ const a = r[i], b = r[i+1];
      pos.push(a[0], y0, -a[1], b[0], y0, -b[1], b[0], y0+h, -b[1], a[0], y0, -a[1], b[0], y0+h, -b[1], a[0], y0+h, -a[1]); } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
function lineGeo(T, lines, y){
  const pos = [];
  for(const flat of lines){ const r = ring2(flat); for(let i = 0; i < r.length-1; i++) pos.push(r[i][0], y, -r[i][1], r[i+1][0], y, -r[i+1][1]); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); return g;
}
function polyArea(flat){ let s = 0; const n = flat.length/2; for(let i = 0; i < n; i++){ const j = (i+1)%n; s += flat[2*i]*flat[2*j+1] - flat[2*j]*flat[2*i+1]; } return Math.abs(s)/200; }
function lineLen(flat){ let s = 0; for(let i = 0; i < flat.length-2; i += 2) s += Math.hypot(flat[i+2]-flat[i], flat[i+3]-flat[i+1]); return s/10; }

/** מדידות מהמודל: שטחים במ"ר, אורכים במטרים ומספר אובייקטים. הכול הערכה מהשרטוט */
function measure(m){
  const out = { area:{}, len:{}, count:{} };
  for(const k in m.surf) out.area[k] = Math.round(m.surf[k].reduce((s, p) => s + polyArea(p[1]), 0));
  for(const k in m.lines) out.len[k] = Math.round(m.lines[k].reduce((s, f) => s + lineLen(f), 0));
  for(const k in m.obj) out.count[k] = k==='treeSurvey' ? m.obj[k].reduce((s, x) => s + x[1].length, 0) : m.obj[k].length;
  out.area.foot = Math.round((m.foot||[]).reduce((s, f) => s + polyArea(f), 0)); out.count.foot = (m.foot||[]).length;
  return out;
}

function create(el, model, opts){
  const T = window.THREE, TX = textures(T), groups = {}, center = itm2wgs(model.e0, model.n0);
  const renderer = new T.WebGLRenderer({ antialias:true, preserveDrawingBuffer:!!(opts && opts.capture) });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding; el.appendChild(renderer.domElement); renderer.domElement.className = 'pm-canvas';
  const scene = new T.Scene(); scene.background = new T.Color('#eef2f5'); scene.fog = new T.Fog('#eef2f5', 500, 1400);
  const cam = new T.PerspectiveCamera(38, 1, 0.5, 3000);
  const ctl = new T.OrbitControls(cam, renderer.domElement); ctl.maxPolarAngle = Math.PI/2 - 0.02; ctl.minDistance = 4; ctl.maxDistance = 900; ctl.enableDamping = true; ctl.dampingFactor = 0.12;
  const hemi = new T.HemisphereLight('#ffffff', '#a9a498', 0.5); scene.add(hemi);
  const sun = new T.DirectionalLight('#fff4e0', 1.0); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left:-190, right:190, top:190, bottom:-190, near:10, far:900 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4; scene.add(sun, sun.target);

  { // שמיים פשוטים כמפת סביבה: נותנים לזכוכית במה להשתקף
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#4f8fd0'); gr.addColorStop(.46, '#cfe4f5'); gr.addColorStop(.5, '#f3f6f8'); gr.addColorStop(.54, '#b8b0a0'); gr.addColorStop(1, '#8a8478'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding;
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose(); }
  const M = { std:(o) => new T.MeshStandardMaterial(Object.assign({ roughness:.92, metalness:0, side:T.DoubleSide, envMapIntensity:.22 }, o)) };
  const ghost = M.std({ color:'#dedcd6', transparent:true, opacity:.5 });
  const add = (kind, obj, o) => { const g = groups[kind] || (groups[kind] = Object.assign(new T.Group(), { name:kind })); if(!g.parent) scene.add(g);
    obj.traverse(x => { if(x.isMesh){ x.castShadow = !!(o && o.cast); x.receiveShadow = !(o && o.noReceive); x.userData.mat = x.material; x.userData.solid = !!(o && o.solid); } if(x.isLineSegments) x.userData.mat = x.material; });
    g.add(obj); return obj; };

  // קרקע ומפה
  const ground = new T.Mesh(new T.PlaneGeometry(2400, 2400), M.std({ color:'#cfcabd' })); ground.rotation.x = -Math.PI/2; ground.position.y = -0.06; ground.receiveShadow = true; scene.add(ground);
  // הקשר עירוני: רחובות אשדוד עם שמות, משכבת הרחובות של העירייה. בלי שירות חיצוני ובלי מפתח
  const streetG = new T.Group(); streetG.visible = false; scene.add(streetG); let streetsBuilt = false, streetsOn = false;
  function setStreets(fc, on){
    streetsOn = !!on;
    if(fc && !streetsBuilt){ streetsBuilt = true;
      const loc = c => { const [E, N] = wgs2itm(c[1], c[0]); return [E-model.e0, N-model.n0]; }, R = 520, pos = [], best = {};
      for(const f of fc.features){ const g = f.geometry, pr = f.properties || {}, w = (pr.hierarchy === 1 ? 15 : pr.hierarchy === 2 ? 10 : 6.5) / 2;
        for(const l of (g.type === 'LineString' ? [g.coordinates] : g.coordinates)){ const pts = l.map(loc);
          for(let i = 0; i < pts.length-1; i++){ const a = pts[i], b = pts[i+1]; if(Math.hypot(a[0], a[1]) > R && Math.hypot(b[0], b[1]) > R) continue;
            const len = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, nx = -(b[1]-a[1])/len*w, ny = (b[0]-a[0])/len*w;
            pos.push(a[0]+nx, 0, -(a[1]+ny), a[0]-nx, 0, -(a[1]-ny), b[0]-nx, 0, -(b[1]-ny), a[0]+nx, 0, -(a[1]+ny), b[0]-nx, 0, -(b[1]-ny), b[0]+nx, 0, -(b[1]+ny));
            const mid = [(a[0]+b[0])/2, (a[1]+b[1])/2], d = Math.hypot(mid[0], mid[1]);       // שם אחד לכל רחוב: על המקטע הארוך שקרוב למגרש
            if(pr.name && d < 330){ const score = len - d*.15; if(!best[pr.name] || score > best[pr.name].score) best[pr.name] = { score, mid }; } } } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); const nr = new Float32Array(pos.length); for(let i = 1; i < nr.length; i += 3) nr[i] = 1; g.setAttribute('normal', new T.BufferAttribute(nr, 3));
      const m = new T.Mesh(g, M.std({ color:'#857f74' })); m.position.y = -0.035; m.receiveShadow = true; streetG.add(m);
      for(const name in best){ const c = document.createElement('canvas'); c.width = 512; c.height = 80; const x = c.getContext('2d'); x.font = '600 40px sans-serif'; const tw = Math.min(500, x.measureText(name).width + 28);
        x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect((512-tw)/2, 8, tw, 64); x.fillStyle = '#1a1a18'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillText(name, 256, 42);
        const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), fog:false })); sp.scale.set(44, 6.9, 1); sp.position.set(best[name].mid[0], 9, -best[name].mid[1]); streetG.add(sp); } }
    updGround();
  }
  /* מפת רקע אפורה: Esri World Topo Map, בלי מפתח. כל אריח מומר לגווני אפור, כדי שהצבע יישאר לתוכנית עצמה */
  const mapG = new T.Group(); mapG.visible = false; scene.add(mapG); let mapBuilt = false, mapOn = false, mapFail = 0;
  function loadMap(){
    mapBuilt = true; const z = 18, n = 2**z, [x0, y0, x1, y1] = model.bbox, pad = 300;
    const sw = itm2wgs(model.e0+x0-pad, model.n0+y0-pad), ne = itm2wgs(model.e0+x1+pad, model.n0+y1+pad);
    const tx = lon => Math.floor((lon+180)/360*n), ty = lat => Math.floor((1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*n);
    const lonOf = x => x/n*360-180, latOf = y => Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
    const loc = (lat, lon) => { const [E, N] = wgs2itm(lat, lon); return [E-model.e0, N-model.n0]; };
    for(let X = tx(sw[1]); X <= tx(ne[1]); X++) for(let Y = ty(ne[0]); Y <= ty(sw[0]); Y++){
      const a = loc(latOf(Y), lonOf(X)), b = loc(latOf(Y), lonOf(X+1)), c = loc(latOf(Y+1), lonOf(X+1)), d = loc(latOf(Y+1), lonOf(X));
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([a[0],0,-a[1], d[0],0,-d[1], c[0],0,-c[1], a[0],0,-a[1], c[0],0,-c[1], b[0],0,-b[1]], 3));
      g.setAttribute('uv', new T.Float32BufferAttribute([0,1, 0,0, 1,0, 0,1, 1,0, 1,1], 2));
      const mat = new T.MeshBasicMaterial({ color:'#ffffff', side:T.DoubleSide, transparent:true, opacity:0, depthWrite:false }), mesh = new T.Mesh(g, mat); mesh.position.y = -0.03; mesh.renderOrder = -1; mapG.add(mesh);
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { const cv = document.createElement('canvas'); cv.width = im.naturalWidth || 256; cv.height = im.naturalHeight || 256; const x = cv.getContext('2d');
        if('filter' in x) x.filter = 'grayscale(1)'; x.drawImage(im, 0, 0);
        const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 8; mat.map = t; mat.opacity = 1; mat.needsUpdate = true; draw(); };
      im.onerror = () => { mapFail++; if(mapFail === 3 && opts && opts.onMapError) opts.onMapError(); };
      im.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${Y}/${X}`;
    }
  }
  function setMap(on){ mapOn = !!on; if(mapOn && !mapBuilt) loadMap(); updGround(); }
  function updGround(){ mapG.visible = mapOn && !underOn; streetG.visible = streetsOn && !underOn; ground.visible = !underOn; draw(); }

  // משטחים
  const S = model.surf, surf = (kind, y, mat, tint) => { if(S[kind]) add(kind, new T.Mesh(flatGeo(T, S[kind], y, tint||0), mat)); };
  surf('asphalt', .00, M.std({ color:KIND.asphalt.color, map:TX.asphalt, vertexColors:true, roughness:.97 }));
  surf('brt', .012, M.std({ color:KIND.brt.color, map:TX.asphalt, vertexColors:true }));
  surf('ramp', .02, M.std({ color:KIND.ramp.color, map:TX.asphalt, vertexColors:true }));
  surf('paving', .035, M.std({ color:'#efe6c4', map:TX.paving, vertexColors:true, roughness:.85 }), .55);
  surf('bike', .05, M.std({ color:KIND.bike.color, map:TX.asphalt, vertexColors:true }));
  surf('play', .06, M.std({ color:KIND.play.color, map:TX.rubber, vertexColors:true }));
  surf('deck', .07, M.std({ color:KIND.deck.color, map:TX.wood, vertexColors:true }));
  surf('green', .085, M.std({ color:'#9fd07f', map:TX.grass, vertexColors:true, roughness:1 }), .5);
  surf('firemark', .10, M.std({ color:KIND.firemark.color, transparent:true, opacity:.75 }));
  if(S.wall) add('wall', new T.Mesh(extrudeGeo(T, S.wall.map(p => ring2(p[1])), 0, 4), M.std({ color:KIND.wall.color, roughness:.8 })), { cast:true, solid:true });
  if(S.pergola){ const rs = S.pergola.map(p => ring2(p[1]));
    add('pergola', new T.Mesh(extrudeGeo(T, rs, 2.8, .16), M.std({ color:KIND.pergola.color, map:TX.wood, transparent:true, opacity:.9, side:T.DoubleSide })), { cast:true, solid:true });
    const posts = []; rs.forEach(r => r.forEach(p => { if(posts.every(q => Math.hypot(q[0]-p[0], q[1]-p[1]) > 3)) posts.push(p); }));
    const pm = new T.InstancedMesh(new T.BoxGeometry(.14, 2.8, .14), M.std({ color:'#7a6a55' }), posts.length), o = new T.Object3D();
    posts.forEach((p, i) => { o.position.set(p[0], 1.4, -p[1]); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); }); add('pergola', pm, { cast:true, solid:true }); }

  // קווים
  const L = model.lines;
  const rib = (kind, y0, h, mat, o) => { if(L[kind]) add(kind, new T.Mesh(ribbonGeo(T, L[kind], y0, h), mat), o); };
  const lin = (kind, y, color) => { if(L[kind]) add(kind, new T.LineSegments(lineGeo(T, L[kind], y), new T.LineBasicMaterial({ color }))); };
  rib('plot', 0, .3, new T.MeshBasicMaterial({ color:KIND.plot.color, transparent:true, opacity:.55, side:T.DoubleSide, depthWrite:false }), { noReceive:true });
  lin('plot', .32, KIND.plot.color); lin('lots', .13, KIND.lots.color); lin('bline', .14, KIND.bline.color);
  rib('curb', 0, .15, M.std({ color:KIND.curb.color, side:T.DoubleSide })); lin('paint', .03, '#ffffff'); lin('cross', .05, '#ffffff'); lin('parking', .05, '#f1f1f1');
  rib('lowwall', 0, .9, M.std({ color:KIND.lowwall.color, side:T.DoubleSide }), { cast:true, solid:true });
  rib('fence', 0, 1.2, M.std({ color:KIND.fence.color, side:T.DoubleSide, transparent:true, opacity:.45 }), { solid:true });
  lin('stairs', .12, KIND.stairs.color); lin('gardenedge', .11, KIND.gardenedge.color);
  rib('glass', 0, 3.7, M.std({ color:KIND.glass.color, side:T.DoubleSide, transparent:true, opacity:.5, roughness:.15, metalness:.2 }), { solid:true });
  rib('door', 0, 2.2, M.std({ color:KIND.door.color, side:T.DoubleSide }), { solid:true });
  rib('water', .1, .22, new T.MeshBasicMaterial({ color:KIND.water.color, side:T.DoubleSide }), { noReceive:true });
  rib('sewer', .1, .22, new T.MeshBasicMaterial({ color:KIND.sewer.color, side:T.DoubleSide }), { noReceive:true });
  rib('drain', .1, .22, new T.MeshBasicMaterial({ color:KIND.drain.color, side:T.DoubleSide }), { noReceive:true });
  rib('gas', .1, .22, new T.MeshBasicMaterial({ color:KIND.gas.color, side:T.DoubleSide }), { noReceive:true });
  lin('fireroute', .16, KIND.fireroute.color);

  // אובייקטים
  const O = model.obj, dummy = new T.Object3D();
  const inst = (kind, geo, mat, list, place, o) => { if(!list || !list.length) return; const m = new T.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { place(dummy, it, i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); add(kind, m, Object.assign({ cast:true, solid:true }, o)); return m; };
  const rnd = i => { const x = Math.sin(i*127.1)*43758.5453; return x - Math.floor(x); };
  function trees(kind, list, leaf){
    const trunkH = t => 2.0 + Math.min(3.2, t[2]*0.45);
    inst(kind, new T.CylinderGeometry(.12, .2, 1, 7), M.std({ color:'#6b4a2e' }), list, (d, t) => { const h = trunkH(t); d.position.set(t[0], h/2, -t[1]); d.scale.set(1+t[2]*.12, h, 1+t[2]*.12); });
    const leafM = M.std({ color:leaf, roughness:1, flatShading:true }), ico = new T.IcosahedronGeometry(1, 1);
    inst(kind, ico, leafM, list, (d, t, i) => { const r = Math.max(1.1, t[2]); d.position.set(t[0], trunkH(t)+r*.55, -t[1]); d.scale.set(r, r*.78, r); d.rotation.y = rnd(i)*6; });
    inst(kind, ico, leafM, list, (d, t, i) => { const r = Math.max(1.1, t[2])*.62, a = rnd(i+9)*6.28; d.position.set(t[0]+Math.cos(a)*r*.7, trunkH(t)+r*1.5, -t[1]+Math.sin(a)*r*.7); d.scale.set(r, r*.8, r); });
  }
  trees('treeNew', O.treeNew, KIND.treeNew.color); trees('treeOld', O.treeOld, KIND.treeOld.color);
  (O.treeSurvey||[]).forEach(([hex, list]) => inst('treeSurvey', new T.RingGeometry(.55, .95, 20), new T.MeshBasicMaterial({ color:hex, side:T.DoubleSide }), list, (d, t) => { d.position.set(t[0], .2, -t[1]); d.rotation.x = -Math.PI/2; }, { cast:false, noReceive:true }));
  const lampHead = new T.MeshStandardMaterial({ color:'#fff6cf', emissive:'#ffd66b', emissiveIntensity:0 });
  inst('lamp', new T.CylinderGeometry(.07, .1, 7, 8), M.std({ color:'#5f6368', metalness:.5, roughness:.5 }), O.lamp, (d, t) => d.position.set(t[0], 3.5, -t[1]));
  inst('lamp', new T.BoxGeometry(1.3, .07, .1), M.std({ color:'#5f6368' }), O.lamp, (d, t, i) => { d.position.set(t[0], 6.95, -t[1]); d.rotation.y = rnd(i)*6.28; d.translateX(.6); });
  inst('lamp', new T.SphereGeometry(.2, 10, 8), lampHead, O.lamp, (d, t, i) => { d.position.set(t[0], 6.85, -t[1]); d.rotation.y = rnd(i)*6.28; d.translateX(1.15); }, { cast:false });
  const box = (kind, list, h, mat, y, k) => inst(kind, new T.BoxGeometry(1, 1, 1), mat, list, (d, b) => { d.position.set(b[0], (y||0)+h/2, -b[1]); d.rotation.y = b[4]; d.scale.set(Math.max(.3, b[2]*(k||1)), h, Math.max(.3, b[3]*(k||1))); });
  const wood = M.std({ color:KIND.bench.color, map:TX.wood });
  box('bench', O.bench, .08, wood, .42); inst('bench', new T.BoxGeometry(1, .5, .07), wood, O.bench, (d, b) => { d.position.set(b[0], .72, -b[1]); d.rotation.y = b[4]; d.scale.set(b[2], 1, 1); d.translateZ(Math.max(.18, b[3]/2-.05)); });
  inst('bench', new T.BoxGeometry(1, .42, .4), M.std({ color:'#8d8a84' }), O.bench, (d, b) => { d.position.set(b[0], .21, -b[1]); d.rotation.y = b[4]; d.scale.set(Math.max(.4, b[2]*.82), 1, 1); });
  box('bin', O.bin, 1.25, M.std({ color:KIND.bin.color }), 0, .9); box('cabinet', O.cabinet, 1.4, M.std({ color:KIND.cabinet.color }));
  box('trafo', O.trafo, 2.6, M.std({ color:KIND.trafo.color }));
  inst('cover', new T.CylinderGeometry(1, 1, .03, 18), M.std({ color:KIND.cover.color, metalness:.4 }), O.cover, (d, t) => { d.position.set(t[0], .12, -t[1]); d.scale.set(Math.max(.3, t[2]), 1, Math.max(.3, t[2])); }, { cast:false });
  // כבאית בכל רחבת כיבוי
  (O.fire||[]).forEach(b => {
    const g = new T.Group(), red = M.std({ color:KIND.fire.color, roughness:.5 }), dark = M.std({ color:'#22252a' }), len = Math.min(9.5, b[2]-.6), w = 2.5;
    const part = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    part(new T.BoxGeometry(len*.68, 1.9, w), red, -len*.16, 1.75, 0); part(new T.BoxGeometry(len*.26, 2.2, w), red, len*.33, 1.75, 0);
    part(new T.BoxGeometry(len*.2, .8, w+.02), M.std({ color:'#bfe0ee', roughness:.2 }), len*.36, 2.25, 0);
    part(new T.BoxGeometry(len*.82, .22, .7), M.std({ color:'#c9ccd1', metalness:.5 }), -len*.1, 2.95, 0); part(new T.BoxGeometry(len*.98, .25, w+.04), M.std({ color:'#f3f3f3' }), 0, 1.0, 0);
    part(new T.BoxGeometry(.5, .2, 1.4), new T.MeshStandardMaterial({ color:'#2a6fe0', emissive:'#2a6fe0', emissiveIntensity:.6 }), len*.33, 2.95, 0);
    [-.34, -.22, .32].forEach(k => [-1, 1].forEach(s => { const wh = part(new T.CylinderGeometry(.52, .52, .4, 14), dark, len*k, .52, s*(w/2-.1)); wh.rotation.x = Math.PI/2; }));
    g.position.set(b[0], 0, -b[1]); g.rotation.y = b[4]; add('fire', g, { cast:true, solid:true });
  });
  // מסת הבניינים: רק כשנבחר מספר קומות
  const massMat = M.std({ color:KIND.mass.color, transparent:true, opacity:.9, roughness:.7 }); let massMesh = null;
  function setFloors(n){ if(massMesh){ groups.mass.remove(massMesh); massMesh.geometry.dispose(); massMesh = null; }
    if(n > 0 && model.foot && model.foot.length){ massMesh = add('mass', new T.Mesh(extrudeGeo(T, model.foot.map(ring2), 4, n*3.1), massMat), { cast:true, solid:true }); applyActive(); }
    draw(); }

  // שמש
  const sunBall = new T.Mesh(new T.SphereGeometry(7, 20, 14), new T.MeshBasicMaterial({ color:'#ffc93c', fog:false })); scene.add(sunBall);
  const pathLine = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color:'#e6a700', fog:false })); scene.add(pathLine);
  let sunState = null;
  function setSun(y, m, d, hour){
    const s = sunPos(ilDate(y, m, d, hour), center[0], center[1]), R = 330, dir = a => new T.Vector3(Math.sin(a.az)*Math.cos(a.alt), Math.sin(a.alt), -Math.cos(a.az)*Math.cos(a.alt));
    const v = dir(s); sun.position.copy(v).multiplyScalar(R); sun.target.position.set(0, 0, 0); sunBall.position.copy(v).multiplyScalar(R+30);
    const up = Math.max(0, Math.sin(s.alt)), day = s.alt > 0;
    sun.intensity = day ? .2 + .62*Math.min(1, up*2.2) : 0; hemi.intensity = day ? .44 + .1*up : .13; sunBall.visible = day;
    const sky = new T.Color(day ? '#eef2f5' : '#20283a').lerp(new T.Color('#f6d9b0'), day ? Math.max(0, .5-up*2.2) : 0); scene.background = sky; scene.fog.color = sky;
    lampHead.emissiveIntensity = day ? 0 : 2.4;
    const pts = []; for(let h = 4; h <= 21; h += .25){ const p = sunPos(ilDate(y, m, d, h), center[0], center[1]); if(p.alt > 0) pts.push(dir(p).multiplyScalar(R+30)); }
    pathLine.geometry.setFromPoints(pts); sunState = { alt:s.alt*180/Math.PI, az:(s.az*180/Math.PI+360)%360, day }; draw(); return sunState;
  }

  // רוח: פסים נעים בכיוון שנבחר (הכיוון הוא הנחה, לא מדידה)
  const windG = new T.Group(); windG.visible = false; scene.add(windG); let windDir = null, windT = 0;
  { const mat = new T.MeshBasicMaterial({ color:'#1f7fd6', transparent:true, opacity:.8, fog:false }), shaft = new T.BoxGeometry(1, .35, .35), head = new T.ConeGeometry(1.1, 3.2, 10); head.rotateZ(-Math.PI/2);
    for(let i = 0; i < 110; i++){ const g = new T.Group(), L = 9 + rnd(i)*9, a = new T.Mesh(shaft, mat), h = new T.Mesh(head, mat); a.scale.x = L; h.position.x = L/2 + 1.4; g.add(a, h);
      g.userData = { o:rnd(i+3)*520, y:2.5 + rnd(i+5)*rnd(i+11)*70, s:rnd(i+7)*460-230 }; windG.add(g); } }
  function setWind(deg){ windDir = deg; windG.visible = deg != null; if(deg != null) loop(); else draw(); }
  function stepWind(dt){ if(windDir == null) return; windT += dt*26; const a = (windDir+180)*Math.PI/180, dx = Math.sin(a), dz = -Math.cos(a);   // הרוח נושבת מהכיוון שנבחר
    windG.children.forEach(m => { const t = ((windT + m.userData.o) % 520) - 260; m.position.set(dx*t - dz*m.userData.s, m.userData.y, dz*t + dx*m.userData.s); m.rotation.y = Math.atan2(-dz, dx); }); }

  // תצוגה: שכבות פעילות, רפאים לשאר
  let active = null, state = 'design', envOn = false; const kindOff = new Set();
  const solidOn = (g, v) => { g.visible = v; g.traverse(x => { if(x.isMesh && x.userData.mat){ x.material = x.userData.mat; x.castShadow = v && x.userData.solid; } }); };
  function applyActive(){
    for(const k in groups){ const g = groups[k];
      if(state !== 'design'){ solidOn(g, (STATE_KINDS[state].includes(k) && !kindOff.has(k)) || (k==='under' && underOn && state==='renewal')); continue; }
      if(k==='exBuild' || k==='rnParcel' || k==='rnMass'){ g.visible = false; continue; }
      if(k==='rnEnvelope'){ solidOn(g, envOn); continue; }
      if(k==='under'){ solidOn(g, underOn); continue; }
      if(k==='facade'){ solidOn(g, facOn && !kindOff.has(k)); continue; }
      const on = !kindOff.has(k) && (!active || active.has(KIND[k].topic));
      const off = kindOff.has(k), ctx = ['asphalt','paving','green','wall','brt','bike'].includes(k);
      g.visible = on || (!off && ctx);
      g.traverse(x => { if(x.isMesh && x.userData.mat){ x.material = on ? x.userData.mat : ghost; x.castShadow = on && x.userData.solid; } });
    }
    draw();
  }
  function setActive(set){ active = set ? new Set(set) : null; applyActive(); }
  function setKind(k, on){ if(on) kindOff.delete(k); else kindOff.add(k); applyActive(); }
  function setState(st){ state = st; applyActive(); }
  function setEnvelope(on){ envOn = !!on; applyActive(); }

  /* התחדשות עירונית (נפחים לפי הזכויות) ומצב קיים. הנתונים ב-WGS84, ומומרים לרשת ישראל */
  /* חזיתות להמחשה (תוכנית בינוי ועיצוב): מעל קומת הקרקע שבשרטוט עולה מגדל לפי הקומות והגובה של התב"ע.
     שטח הקומה לפי טבלה 5. החלונות, המרפסות והחיפוי הם המחשה, ולא מהשרטוט. */
  let rnData = null, facOn = false, underOn = false, facBuilt = false, underBuilt = false;
  const locLL = c => { const [E, N] = wgs2itm(c[1], c[0]); return [E-model.e0, N-model.n0]; };
  const pip = (p, r) => { let c = false; for(let i = 0, j = r.length-1; i < r.length; j = i++){ const a = r[i], b = r[j]; if((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) c = !c; } return c; };
  function facadeTex(wall, frame, glass, big){
    const mk = draw2 => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; draw2(c.getContext('2d')); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t; };
    const win = big ? [18, 30, 220, 178] : [34, 44, 188, 150];      // חלון בתוך מפתח אחד של קומה אחת
    const map = mk(g => { g.fillStyle = wall; g.fillRect(0, 0, 256, 256); for(let i = 0; i < 900; i++){ g.fillStyle = `rgba(0,0,0,${Math.random()*.035})`; g.fillRect(Math.random()*256, Math.random()*256, 3, 2); }
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, 248, 256, 8); g.fillStyle = frame; g.fillRect(win[0]-5, win[1]-5, win[2]+10, win[3]+10);
      const gr = g.createLinearGradient(0, win[1], 0, win[1]+win[3]); gr.addColorStop(0, glass[0]); gr.addColorStop(1, glass[1]); g.fillStyle = gr; g.fillRect(...win);
      g.fillStyle = frame; g.fillRect(win[0]+win[2]/2-2, win[1], 4, win[3]); if(big) g.fillRect(win[0], win[1]+win[3]*.62, win[2], 4); });
    map.encoding = T.sRGBEncoding;
    const orm = mk(g => { g.fillStyle = 'rgb(0,225,0)'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgb(0,18,255)'; g.fillRect(...win); });   // G: חספוס, B: מתכתיות. החלון חלק ומשתקף
    return new T.MeshStandardMaterial({ map, roughnessMap:orm, metalnessMap:orm, roughness:1, metalness:1, envMapIntensity:1.15, side:T.DoubleSide });
  }
  function buildFacades(){
    facBuilt = true; if(!rnData || !model.foot) return;
    const lots = Object.fromEntries(rnData.lots.map(l => [l.lot, l])), parcels = rnData.parcels.map(p => ({ lot:p.lot, r:p.c.map(locLL) }));
    const mats = { res:facadeTex('#e9e3d6', '#55595e', ['#5f7f9c', '#9fc0d8'], false), pub:facadeTex('#c9b9a2', '#4a4640', ['#547186', '#a5c2d2'], true) };
    const slabM = M.std({ color:'#f1eee7', roughness:.6 }), railM = new T.MeshStandardMaterial({ color:'#bfe1ee', transparent:true, opacity:.38, roughness:.05, metalness:.6, envMapIntensity:1.3, side:T.DoubleSide });
    const roofM = M.std({ color:'#c9c5bb' }), slabs = [], rails = [], bay = 3.6;
    model.foot.forEach(f => {
      let r = ring2(f); const cx = r.reduce((s2, p) => s2+p[0], 0)/r.length, cy = r.reduce((s2, p) => s2+p[1], 0)/r.length, pc = parcels.find(p => pip([cx, cy], p.r)), lot = pc && lots[pc.lot];
      if(!lot || !lot.floors) return;
      let A = 0; for(let i = 0; i < r.length; i++){ const a = r[i], b = r[(i+1)%r.length]; A += a[0]*b[1]-b[0]*a[1]; } if(A < 0) r = r.slice().reverse(); A = Math.abs(A)/2;
      const k = lot.plate ? Math.min(1, Math.sqrt(lot.plate/A)) : 1; r = r.map(p => [cx+(p[0]-cx)*k, cy+(p[1]-cy)*k]);
      const fh = (lot.height || lot.floors*3.3)/lot.floors, y0 = 4, n = lot.floors - 1, y1 = y0 + n*fh, pos = [], uv = [];
      let u = 0;
      for(let i = 0; i < r.length; i++){ const a = r[i], b = r[(i+1)%r.length], len = Math.hypot(b[0]-a[0], b[1]-a[1]), nb = Math.max(1, Math.round(len/bay)), u1 = u + nb;
        pos.push(a[0], y0, -a[1], b[0], y0, -b[1], b[0], y1, -b[1], a[0], y0, -a[1], b[0], y1, -b[1], a[0], y1, -a[1]); uv.push(u, 0, u1, 0, u1, n, u, 0, u1, n, u, n); u = u1;
        if(len < 9 || lot.cat === 'public') continue;                // מרפסות: בכל מפתח שני, בחזיתות הארוכות
        const dx = (b[0]-a[0])/len, dy = (b[1]-a[1])/len, ox = dy, oy = -dx, ang = Math.atan2(dy, dx);
        for(let j = 0; j < nb; j += 2) for(let fl = 0; fl < n; fl++){ const t = (j+.5)/nb, px = a[0]+(b[0]-a[0])*t, py = a[1]+(b[1]-a[1])*t, y = y0 + fl*fh;
          slabs.push([px+ox*.8, y+.09, py+oy*.8, ang]); rails.push([px+ox*1.55, y+.7, py+oy*1.55, ang]); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      add('facade', new T.Mesh(g, lot.cat === 'public' ? mats.pub : mats.res), { cast:true, solid:true });
      add('facade', new T.Mesh(flatGeo(T, [['#ffffff', r.flatMap(p => [p[0]*10, p[1]*10])]], y1, 0), roofM), { cast:true, solid:true });
      add('facade', new T.Mesh(ribbonGeo(T, [r.concat([r[0]]).flatMap(p => [p[0]*10, p[1]*10])], y1, 1.1), roofM), { cast:true, solid:true });
      const core = new T.Mesh(new T.BoxGeometry(Math.sqrt(A)*k*.3, 3, Math.sqrt(A)*k*.22), roofM); core.position.set(cx, y1+1.5, -cy); add('facade', core, { cast:true, solid:true });
    });
    const place = (list, geo, mat) => inst('facade', geo, mat, list, (d, t) => { d.position.set(t[0], t[1], -t[2]); d.rotation.y = t[3]; }, { cast:false });
    place(slabs, new T.BoxGeometry(3.1, .18, 1.6), slabM); place(rails, new T.BoxGeometry(3.1, 1.05, .05), railM);
  }
  function setFacade(on){ facOn = !!on; if(facOn && !facBuilt) buildFacades(); applyActive(); }
  /* קומות המרתף והחניון: מספר הקומות מהוראות התוכנית. המתאר הוא גבול המגרש, וזו הנחה */
  function buildUnder(){
    underBuilt = true; if(!rnData) return; const fl = r => r.flatMap(p => [Math.round(p[0]*10), Math.round(p[1]*10)]);
    const slabM = M.std({ color:'#8d98a6' }), wallM = new T.MeshBasicMaterial({ color:'#5d6b7c', transparent:true, opacity:.22, side:T.DoubleSide, depthWrite:false }), lineM = new T.LineBasicMaterial({ color:'#2f3a48' });
    rnData.lots.filter(l => l.below).forEach(l => { const pc = rnData.parcels.find(p => p.lot === l.lot); if(!pc) return; const r = pc.c.map(locLL), closed = fl(r.concat([r[0]]));
      for(let i = 1; i <= l.below; i++){ add('under', new T.Mesh(flatGeo(T, [['#ffffff', fl(r)]], -3.1*i, 0), slabM)); add('under', new T.LineSegments(lineGeo(T, [closed], -3.1*i + .03), lineM)); }
      add('under', new T.Mesh(ribbonGeo(T, [closed], -3.1*l.below, 3.1*l.below), wallM), { noReceive:true });
      const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.94)'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#1a1a18'; x.font = '600 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      x.fillText(`מגרש ${l.lot} · ${l.below} קומות מרתף`, 256, 50); const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:false })); sp.scale.set(30, 5.6, 1);
      sp.position.set(r.reduce((s2, p) => s2+p[0], 0)/r.length, 6, -r.reduce((s2, p) => s2+p[1], 0)/r.length); add('under', sp); });
  }
  const FLAT = ['asphalt','brt','ramp','paving','bike','play','deck','green','firemark','rnParcel'];
  function setUnder(on){ underOn = !!on; if(underOn && !underBuilt) buildUnder();
    FLAT.forEach(k => groups[k] && groups[k].traverse(x => { const m = x.userData.mat; if(!x.isMesh || !m) return; if(m.userData.op == null){ m.userData.op = m.opacity; m.userData.tr = m.transparent; }
      m.transparent = underOn || m.userData.tr; m.opacity = underOn ? .16 : m.userData.op; m.depthWrite = !underOn; m.needsUpdate = true; }));
    updGround(); applyActive(); }
  function setRenewal(rn){
    rnData = rn;
    const loc = c => { const [E, N] = wgs2itm(c[1], c[0]); return [E-model.e0, N-model.n0]; }, fl = r => r.flatMap(p => [Math.round(p[0]*10), Math.round(p[1]*10)]);
    const lots = Object.fromEntries((rn.lots||[]).map(l => [l.lot, l]));
    add('rnParcel', new T.Mesh(flatGeo(T, rn.parcels.map(p => [(ZONES[p.cat]||ZONES.road)[1], fl(p.c.map(loc))]), .02, 1), M.std({ vertexColors:true, transparent:true, opacity:.92 })));
    add('rnParcel', new T.LineSegments(lineGeo(T, rn.parcels.map(p => { const r = p.c.map(loc); return fl(r.concat([r[0]])); }), .06), new T.LineBasicMaterial({ color:'#3a3a3a' })));
    const edge = new T.LineBasicMaterial({ color:'#2b2b2b', transparent:true, opacity:.45 }), envEdge = new T.LineBasicMaterial({ color:'#5b6470' });
    (rn.massing||[]).forEach(f => {
      const r = f.c.map(loc), lot = lots[f.lot] || {}, closed = fl(r.concat([r[0]]));
      if(f.kind==='envelope'){
        add('rnEnvelope', new T.Mesh(extrudeGeo(T, [r], f.base, f.top-f.base), new T.MeshBasicMaterial({ color:'#ffffff', transparent:true, opacity:.16, side:T.DoubleSide, depthWrite:false })), { noReceive:true });
        const pos = []; r.forEach(p => pos.push(p[0], f.base, -p[1], p[0], f.top, -p[1])); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        add('rnEnvelope', new T.LineSegments(g, envEdge)); add('rnEnvelope', new T.LineSegments(lineGeo(T, [closed], f.top), envEdge)); return; }
      add('rnMass', new T.Mesh(extrudeGeo(T, [r], f.base, f.top-f.base), M.std({ color:(ZONES[f.cat]||ZONES.residential)[1], roughness:.75 })), { cast:true, solid:true });
      // קווי הקומות: גובה קומה לפי הגובה המרבי חלקי מספר הקומות בטבלה 5
      const fh = lot.floors ? (lot.height || f.top) / lot.floors : 3.3, lines = []; for(let y = f.base + fh; y < f.top - .2; y += fh) lines.push(y);
      const pos = []; lines.forEach(y => { for(let i = 0; i < r.length; i++){ const a = r[i], b = r[(i+1)%r.length]; pos.push(a[0], y, -a[1], b[0], y, -b[1]); } });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); add('rnMass', new T.LineSegments(g, edge));
      if(f.kind==='tower'){ const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.94)'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#1a1a18'; x.font = '600 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
        x.fillText(`מגרש ${f.lot} · ${lot.floors||''} קומות`, 256, 50); const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:false })); sp.scale.set(34, 6.4, 1);
        sp.position.set(r.reduce((s, p) => s+p[0], 0)/r.length, f.top + 7, -r.reduce((s, p) => s+p[1], 0)/r.length); add('rnMass', sp); }
    });
    (rn.demolish||[]).forEach(d => add('exBuild', new T.Mesh(extrudeGeo(T, [d.c.map(loc)], 0, d.h || 13), M.std({ color:KIND.exBuild.color })), { cast:true, solid:true }));
    applyActive();
  }

  // מצלמה
  const [bx0, by0, bx1, by1] = model.bbox;
  function view(name){
    const R = Math.max(bx1-bx0, by1-by0);
    if(name==='top'){ cam.position.set(0, R*1.7, 0.01); ctl.target.set(0, 0, 0); }
    else if(name==='eye'){ // גובה עיניים: עומדים על הריצוף הקרוב למרכז, ומביטים צפונה לאורך המגרש
      const obs = [].concat(O.treeNew||[], O.treeOld||[], O.lamp||[], (O.bench||[]).map(b => [b[0], b[1]]));
      (S.wall||[]).forEach(p => obs.push([p[1][0]/10, p[1][1]/10])); (L.lowwall||[]).forEach(f => { for(let i = 0; i < f.length; i += 6) obs.push([f[i]/10, f[i+1]/10]); });
      let best = [0, 0], bs = -1;
      (S.paving||[]).forEach(p => { const r = ring2(p[1]), cx = r.reduce((s, q) => s+q[0], 0)/r.length, cy = r.reduce((s, q) => s+q[1], 0)/r.length; if(Math.hypot(cx, cy) > 70) return;
        let d = 14; for(const o of obs){ const dd = Math.hypot(o[0]-cx, o[1]-cy); if(dd < d) d = dd; } if(d > bs){ bs = d; best = [cx, cy]; } });
      const dl = Math.hypot(best[0], best[1]) || 1;
      cam.position.set(best[0], 1.65, -best[1]); ctl.target.set(best[0] - best[0]/dl*25, 2.2, -best[1] + best[1]/dl*25); }
    else { cam.position.set(-R*.8, R*.72, R*1.0); ctl.target.set(15, 30, 0); }   // אותו מבט בכל המצבים, רחוק מספיק לנפחים הגבוהים
    ctl.update(); draw();
  }

  // ציור לפי צורך
  let raf = 0, last = 0, dead = false;
  function frame(t){ raf = 0; if(dead) return; const dt = Math.min(.1, (t-last)/1000 || 0); last = t; stepWind(dt); const moving = ctl.update(); renderer.render(scene, cam);
    if(opts && opts.onCamera) opts.onCamera(Math.atan2(cam.position.x-ctl.target.x, cam.position.z-ctl.target.z));
    if(windDir != null || moving) loop(); }
  function loop(){ if(!raf && !dead) raf = requestAnimationFrame(frame); }
  function draw(){ loop(); }
  ctl.addEventListener('change', draw);
  function resize(){ const r = el.getBoundingClientRect(); if(r.width < 10) return; renderer.setSize(r.width, r.height, false); cam.aspect = r.width/r.height; cam.updateProjectionMatrix(); draw(); }
  resize(); view('home');
  return { setActive, setKind, setSun, setFloors, setWind, setState, setEnvelope, setRenewal, setFacade, setUnder, view, resize, center, groups,
    setStreets, setMap,
    dispose(){ dead = true; cancelAnimationFrame(raf); ctl.dispose(); renderer.dispose(); renderer.domElement.remove(); } };
}

/** טעינת הספרייה התלת־ממדית רק כשצריך */
let loading = null;
function loadThree(){
  if(window.THREE && window.THREE.OrbitControls) return Promise.resolve();
  if(loading) return loading;
  const js = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.head.appendChild(s); });
  return loading = js('vendor/three.min.js').then(() => js('vendor/OrbitControls.js'));
}
const api = { KINDS, KIND, ZONES, STATE_KINDS, create, loadThree, measure, itm2wgs, wgs2itm, sunPos, ilDate };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else window.PlanModel = api;
})();
