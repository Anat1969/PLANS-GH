/* ══════════════════════════════════════════════════════════════════
   plans-city.js: דף הכניסה (ענת, 24.11.2026). כל תוכניות הבינוי במצב הסופי, על מפת אשדוד.
   - הנפחים: data/city.json (tools/city-data.py), מגדל ומסד לפי טבלה 5 ותשריט התב"ע מ-plan_models.
     לכל תוכנית בינוי רק המגרשים שלה (מספרי המגרש בשדה "מיקום"). בלי התאמה: כל הנפחים של התב"ע.
     תוכנית בלי נפחים: המגרש הרשום (plans-geo.js) כמשטח, ובלי גובה. הנפח הוא הערכה, לא תוכנית הבינוי.
   - שמש לפי SunCalc (PlanModel.sunPos), שעון ישראל. יום מ-05:00 עד 21:00 בכ-20 שניות,
     והתאריך מתקדם בכל יום בחודש: חורף, אביב, קיץ, סתיו. בלילה החלונות נדלקים.
   - קרוסלה: כרטיס לכל תוכנית. ההדמיה מחומרי התוכנית (planMaterials, קטגוריה render),
     ובלעדיה תמונה של הנפחים מאותה סצנה. לחיצה מקרבת את המצלמה. "כניסה לתוכנית" פותחת את הכרטיס.
   - נפתח כשנכנסים בלי יעד בכתובת, או ב-#city (ו-#city=<מספר תוכנית>, ממוקד בה). "כניסה למערכת" סוגר.
   - דף ציבורי (ענת, 24.11.2026): רק שם, רובע ומגרש, סטטוס כללי, נפח, הדמיה ומשפט מעובדות. בלי יזם, מועדים והערות.
   - הדמיות: data/renders.json (tools/city-renders.py), עותק מוקטן של ההדמיה מ"מרחב מדבר". שיתוף: קישור לדף או לתוכנית.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s||'').replace(/[\s/\\-]+/g, '');
const COL = { residential:'#e8b93c', mixed:'#e0884a', commerce:'#b6529c', public:'#a5673f', open:'#6fae5d', road:'#a8a8a8', employment:'#9aa3ad', hotel:'#c58b6a' };
// הצבעים מהתקן המשותף (משבצות המקרא של מבא"ת). ייעוד בלי צבע מאומת: ניטרלי
window.urbanStandard && window.urbanStandard().then(S => { if(S) Object.keys(COL).forEach(k => { COL[k] = S.landUseColor(k); }); });
const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DAY_S = 20, H0 = 5, H1 = 21;                       // יום של 16 שעות ב-20 שניות
let st = null;

function plansList(){ try{ return (typeof livePlans === 'function' ? livePlans() : plans).filter(p => p && !p.deleted); }catch(e){ return []; } }
function lotsOf(p){ return (String(p.location || '').match(/\d{1,4}/g) || []).map(Number); }
function lotList(p){ const s = String(p.location || ''); const r = s.match(/(\d{1,4})\s*-\s*(\d{1,4})/); if(r && +r[2] - +r[1] < 30){ const a = []; for(let i = +r[1]; i <= +r[2]; i++) a.push(i); return a; } return lotsOf(p); }
let RENDERS = {};                                          // data/renders.json: הדמיות מ"מרחב מדבר" (tools/city-renders.py)
const pnum = p => String(p.planNum || '').replace(/\D/g, '');
function renderOf(p){ const r = RENDERS[pnum(p)]; if(r) return r.img; try{ const m = (window.planMaterials ? window.planMaterials(p) : []).find(x => x.cat === 'render' && x.img); return m ? m.img : ''; }catch(e){ return ''; } }

/** לכל תוכנית: נפחים (מהתב"ע) או משטח המגרש, ומרכז */
function collect(D, BT){
  const P = plansList(), used = new Set(), items = [];
  // תוכניות בינוי שהתב"ע שלהן לא ב-plan_models: מגרשים מ-Xplan או משכבת המגרשים העירונית, ונפח לפי טבלה 5 (data/building-twin.json, הערכה)
  const tw = {}; ((BT && BT.plans) || []).forEach(x => { tw[String(x.plan_number).replace(/\s+/g, '')] = x; });
  P.forEach(p => {
    const t = D.taba[norm(p.change)], geo = window.planGeo ? window.planGeo(p) : null;
    let fs = [], scope = '';
    if(t){ const L = lotList(p); fs = t.f.filter(f => L.includes(+f.lot)); scope = fs.length ? 'lots' : 'taba'; if(!fs.length) fs = t.f; }
    const x = tw[String(p.planNum || '').replace(/\s+/g, '')];
    if(!fs.length && x && x.estimate){ fs = x.estimate.map(e => ({ r:e.r, base:e.base, top:e.top, cat:e.cat, lot:e.lot, est:1 })); scope = 'table5'; }
    const parcel = !fs.length && x && /xplan|municipal/.test(x.source || '') && x.geometry ? x.geometry : !fs.length && geo && geo.geo ? geo.geo : null;
    if(!fs.length && !geo && !renderOf(p)) return;            // תוכנית בלי מיקום אבל עם הדמיה: בקרוסלה, בלי נפח (ענת, 25.11.2026)
    items.push({ p, fs, scope, parcel, geo, taba:t ? t.n : '', sum:t && t.sum || null, render:renderOf(p) });
    fs.forEach(f => used.add(f));
  });
  return items;
}

/* ── הסצנה ── */
function build(el, D, BLD, CM, RT, S, BT, TV){
  const T = window.THREE, items = collect(D, BT);
  const pts = []; items.forEach(it => { it.fs.forEach(f => f.r.forEach(q => pts.push(q))); if(!it.fs.length && it.geo) pts.push([it.geo.lng, it.geo.lat]); });
  const lng0 = pts.reduce((s, q) => s + q[0], 0)/pts.length, lat0 = pts.reduce((s, q) => s + q[1], 0)/pts.length;
  const KX = 111320*Math.cos(lat0*Math.PI/180), KY = 110574;
  const xy = q => [(q[0]-lng0)*KX, (q[1]-lat0)*KY];      // מזרח, צפון במטרים
  const renderer = new T.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  el.appendChild(renderer.domElement);
  const scene = new T.Scene(), sc = c => new T.Color(c).convertSRGBToLinear();
  const cam = new T.PerspectiveCamera(38, 1, 5, 40000);
  const ctl = new T.OrbitControls(cam, renderer.domElement); ctl.enableDamping = true; ctl.maxPolarAngle = 1.35; ctl.minDistance = 150; ctl.maxDistance = 14000;
  ctl.autoRotate = true; ctl.autoRotateSpeed = .35;
  // חוזה האינטראקציה המשותף: אותן פעולות עכבר, מגע ומקלדת כמו בכל מפה בשתי האפליקציות
  const stdUI = S ? S.applyOrbit(ctl, cam, renderer.domElement, T, { reset:() => home(), clear:() => { const b = document.getElementById('cityHome'); if(b) b.click(); } }) : null;
  if(stdUI) renderer.domElement.addEventListener('pointerdown', () => { ctl.autoRotate = false; }, { once:true });

  const hemi = new T.HemisphereLight(0xdfe8f0, 0x8a8478, .55); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffffff, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; scene.add(sun); scene.add(sun.target);
  const moon = new T.DirectionalLight(0x8fa6d8, .0); moon.position.set(-3000, 4000, 2000); scene.add(moon);

  // קרקע ומפה
  const ext = pts.map(xy), minX = Math.min(...ext.map(q => q[0])) - 1500, maxX = Math.max(...ext.map(q => q[0])) + 1500, minY = Math.min(...ext.map(q => q[1])) - 1500, maxY = Math.max(...ext.map(q => q[1])) + 1500;
  const ground = new T.Mesh(new T.PlaneGeometry(60000, 60000), new T.MeshStandardMaterial({ color:sc('#dcdbd6'), roughness:1 })); ground.rotation.x = -Math.PI/2; ground.position.y = -.6; ground.receiveShadow = true; scene.add(ground);
  const shadowCatch = new T.Mesh(new T.PlaneGeometry(maxX - minX, maxY - minY), new T.ShadowMaterial({ opacity:.32 })); shadowCatch.rotation.x = -Math.PI/2; shadowCatch.position.set((minX+maxX)/2, .3, -(minY+maxY)/2); shadowCatch.receiveShadow = true; scene.add(shadowCatch);
  loadMap(T, scene, { lng0, lat0, KX, KY, minX, maxX, minY, maxY }, sc).catch(() => streets(T, scene, xy));

  // נפחים
  const winTex = windowTexture(T), winNight = windowTexture(T, true);
  const mats = {}, matFor = (cat, kind) => { const k = cat + kind; if(mats[k]) return mats[k];
    const side = new T.MeshStandardMaterial({ color:sc(COL[cat] || COL.residential), roughness:.75, map:kind === 'tower' ? winTex : null, emissive:new T.Color(0xffc27a), emissiveMap:kind === 'tower' ? winNight : null, emissiveIntensity:0 });
    const cap = new T.MeshStandardMaterial({ color:sc(COL[cat] || COL.residential).multiplyScalar(1.08), roughness:.9 });
    return mats[k] = [cap, side]; };
  const edgeM = new T.LineBasicMaterial({ color:0x2a2a28, transparent:true, opacity:.35 });
  const hiM = new T.MeshBasicMaterial({ color:0x111111, transparent:true, opacity:.0, depthWrite:false });
  const meshesOf = new Map(), drawn = new Map();
  items.forEach(it => {
    const ms = [];
    it.fs.forEach(f => {
      if(drawn.has(f)){ ms.push(drawn.get(f)); return; }
      const sh = new T.Shape(f.r.map(q => { const [x, y] = xy(q); return new T.Vector2(x, y); }));
      const h = Math.max(1, f.top - f.base), g = new T.ExtrudeGeometry(sh, { depth:h, bevelEnabled:false });
      g.rotateX(-Math.PI/2); g.translate(0, f.base, 0);
      // מרקם החלונות: UV בצדדים לפי מטרים (קומה 3.2 מ', מפתח 4 מ')
      const m = new T.Mesh(g, matFor(f.cat, f.k)); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      const e = new T.LineSegments(new T.EdgesGeometry(g, 30), edgeM); e.userData.f = m; scene.add(e);
      drawn.set(f, m); ms.push(m);
    });
    if(it.parcel){ (it.parcel.type === 'MultiPolygon' ? it.parcel.coordinates : [it.parcel.coordinates]).forEach(poly => {
      const sh = new T.Shape(poly[0].map(q => { const [x, y] = xy(q); return new T.Vector2(x, y); }));
      const g = new T.ShapeGeometry(sh); g.rotateX(-Math.PI/2); g.translate(0, .5, 0);
      const m = new T.Mesh(g, new T.MeshStandardMaterial({ color:sc('#7fb3b0'), transparent:true, opacity:.55, roughness:1 })); scene.add(m); ms.push(m); }); }
    const c = centerOf(it, xy); it.c = c; it.h = it.fs.reduce((a, f) => Math.max(a, f.top), 0);
    meshesOf.set(it, ms);
  });
  /* מבנים קיימים (geo/bld/all.json, ה-GIS העירוני). גובה סמלי לפי שטח. מה שבתוך נפחי התוכניות מוצג רק במצב "קיים" */
  const PM = window.PlanModel, foot = [];
  items.forEach(it => it.fs.forEach(f => foot.push(f.r.map(xy))));
  const modelOf = {}, modelG = new T.Group(); scene.add(modelG);
  if(CM && CM.models) items.forEach(it => { const bl = CM.models[String(it.p.tik)]; if(!bl || !bl.length || modelOf[it.p.tik]) return; modelOf[it.p.tik] = true; it.model = true;
    const mat = [new T.MeshStandardMaterial({ color:sc('#efeae0'), roughness:.8 }), new T.MeshStandardMaterial({ color:sc('#efeae0'), roughness:.7, map:winTex, emissive:new T.Color(0xffc27a), emissiveMap:winNight, emissiveIntensity:0 })];
    mats['model' + it.p.tik] = mat;
    bl.forEach(b => b.s.forEach(([r, y0, y1]) => { const pts = r.map(xy); foot.push(pts);
      const g = new T.ExtrudeGeometry(new T.Shape(pts.map(q => new T.Vector2(q[0], q[1]))), { depth:Math.max(.5, y1 - y0), bevelEnabled:false }); g.rotateX(-Math.PI/2); g.translate(0, y0, 0);
      const m = new T.Mesh(g, mat); m.castShadow = m.receiveShadow = true; modelG.add(m); modelG.add(new T.LineSegments(new T.EdgesGeometry(g, 30), edgeM)); })); });
  const inPoly = (x, y, r) => { let c = false; for(let i = 0, j = r.length-1; i < r.length; j = i++){ const a = r[i], b = r[j]; if((a[1] > y) !== (b[1] > y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1]) + a[0]) c = !c; } return c; };
  const boxOf = r => { const X = r.map(q => q[0]), Y = r.map(q => q[1]); return [Math.min(...X) - 12, Math.min(...Y) - 12, Math.max(...X) + 12, Math.max(...Y) + 12]; };
  const fbox = foot.map(boxOf);
  /* כל נפחי התב"עות: ההתחדשות העירונית מהמודל המשותף (data/renewal-twin.json, city_twin של "מה נבנה סביבי"),
     ותב"עות מאושרות בלי מודל שם (data/taba-volumes.json: המרינה 112/101/02/3, רובע ז' 603-0595660).
     נפח שמרכזו בתוך תוכנית בינוי או מודל שלה לא מצויר: המודל המפורט מחליף אותו, והיתרה נשארת (בלי חפיפה).
     שלוש רשתות: מאושר, בתכנון ומבני ציבור. הצבע לפי המצב (setMode): היום שקוף, מתוכנן לפי הייעוד, אחרי המחשה */
  const RN = { A:mkBuf(), P:mkBuf(), U:mkBuf() }; let rnCount = 0, rnSkip = 0;
  function mkBuf(){ return { p:[], n:[], c:[], uv:[] }; }
  [RT, TV].forEach(R => { if(!R || !R.features) return; const [o0, o1] = R.origin, k = R.scale, rnFoot = [];
    R.features.forEach(([pi, stage, cat, base, top, flat]) => { const r = []; for(let i = 0; i < flat.length; i += 2) r.push(xy([o0 + flat[i]*k, o1 + flat[i+1]*k]));
      if(r.length < 3 || top - base < .5) return;
      let mx = 0, my = 0; r.forEach(q => { mx += q[0]; my += q[1]; }); mx /= r.length; my /= r.length;
      if(fbox.some((b, i) => mx > b[0] && mx < b[2] && my > b[1] && my < b[3] && inPoly(mx, my, foot[i]))){ rnSkip++; return; }
      const B = cat === 'public' ? RN.U : stage === 'planning' ? RN.P : RN.A, col = sc(COL[cat] || (S && S.NEUTRAL) || '#d9d8d4');
      let ar = 0; r.forEach((a, i) => { const b = r[(i+1)%r.length]; ar += a[0]*b[1] - b[0]*a[1]; }); if(ar < 0) r.reverse();
      let run = 0;
      r.forEach((a, i) => { const b = r[(i+1)%r.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, nx = (b[1]-a[1])/L, ny = -(b[0]-a[0])/L;
        B.p.push(a[0], base, -a[1], b[0], base, -b[1], b[0], top, -b[1], a[0], base, -a[1], b[0], top, -b[1], a[0], top, -a[1]); for(let q = 0; q < 6; q++){ B.n.push(nx, 0, -ny); B.c.push(col.r, col.g, col.b); }
        B.uv.push(run, base, run + L, base, run + L, top, run, base, run + L, top, run, top); run += L; });   // UV במטרים, כמו ExtrudeGeometry
      T.ShapeUtils.triangulateShape(r.map(q => new T.Vector2(q[0], q[1])), []).forEach(t => t.forEach(ix => { const q = r[ix]; B.p.push(q[0], top, -q[1]); B.n.push(0, 1, 0); B.c.push(col.r, col.g, col.b); B.uv.push(0, 0); }));
      rnFoot.push(r); rnCount++; });
    rnFoot.forEach(r => { foot.push(r); fbox.push(boxOf(r)); }); });
  // הקו הכחול של כל תוכנית התחדשות (23, גם בלי נפחים), בגובה הקרקע: התמונה העירונית המלאה, ממודל העיר המשותף
  [RT, TV].forEach(R => { if(!R || !R.boundaries || !R.boundaries.length) return; const [o0, o1] = R.origin, k = R.scale, pos = [];
    R.boundaries.forEach(([, , flat]) => { for(let i = 0; i + 3 < flat.length; i += 2){ const a = xy([o0 + flat[i]*k, o1 + flat[i+1]*k]), b = xy([o0 + flat[i+2]*k, o1 + flat[i+3]*k]); pos.push(a[0], 1.2, -a[1], b[0], 1.2, -b[1]); } });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    scene.add(new T.LineSegments(g, new T.LineBasicMaterial({ color:(S && S.BLUE_LINE) || '#1D4ED8', transparent:true, opacity:.75 }))); });
  /* חומרים לפי מצב (ענת, 26.11.2026):
     היום   - מה שמתוכנן במינימום שקיפות ("אחרת זה בלגן"): לבן כמעט שקוף, בלי צל.
     מתוכנן - צבע הייעוד מהתקן (משבצות המקרא בתשריטי מבא"ת). מאושר אטום, בתכנון שקוף.
     אחרי   - המחשה: חזית לבנה עם חלונות ומרפסות לכל מה שמאושר. מה שעוד בתכנון נשאר אפור שקוף, כי הוא יכול להשתנות.
     מבני ציבור (מתג במקרא): הקיים בחום בהיר, והמוצע (603-0828491 ומגרשי הציבור בכל תב"ע) בחום כהה שקוף מעליו, כדי לראות את הגדילה */
  const facTex = facadeTexture(T), facNight = facadeTexture(T, true);
  const M = {
    ghost:new T.MeshStandardMaterial({ color:0xffffff, roughness:1, transparent:true, opacity:.1, depthWrite:false }),
    useA:new T.MeshStandardMaterial({ vertexColors:true, roughness:.85 }),
    useP:new T.MeshStandardMaterial({ vertexColors:true, roughness:.85, transparent:true, opacity:.5, depthWrite:false }),
    real:new T.MeshStandardMaterial({ color:0xffffff, map:facTex, roughness:.55, metalness:.05, emissive:new T.Color(0xffc27a), emissiveMap:facNight, emissiveIntensity:0 }),
    roof:new T.MeshStandardMaterial({ color:sc('#dcd8cf'), roughness:.9 }),
    planGray:new T.MeshStandardMaterial({ color:sc('#cfcdc7'), roughness:.95, transparent:true, opacity:.38, depthWrite:false }),
    pubNew:new T.MeshStandardMaterial({ color:sc('#7a4f28'), roughness:.8, transparent:true, opacity:.55, depthWrite:false }),
    pubOld:new T.MeshStandardMaterial({ color:sc('#e7cfae'), roughness:.9 }),
  };
  mats.real = [M.roof, M.real];
  modelG.children.forEach(o => { if(o.isMesh) o.material = mats.real; });   // המודל המפורט של תוכנית הבינוי: אותה המחשה
  const rnMesh = {};
  Object.entries(RN).forEach(([k, B]) => { if(!B.p.length) return; const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(B.c, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
    const m = new T.Mesh(g, M.ghost); m.renderOrder = 2; m.castShadow = true; m.receiveShadow = true; scene.add(m); rnMesh[k] = m; });
  const exOut = { p:[], n:[] }, exIn = { p:[], n:[] }, pubOut = { p:[], n:[] }, pubIn = { p:[], n:[] };
  if(BLD && BLD.tiles && PM && PM.itm2wgs){ const TL = BLD.tile;
    for(const k in BLD.tiles){ const [tx, ty] = k.split('_').map(Number);
      for(const [cat, h, flat] of BLD.tiles[k]){ const r = []; for(let i = 0; i < flat.length; i += 2){ const w = PM.itm2wgs(tx*TL + flat[i]/10, ty*TL + flat[i+1]/10); r.push(xy([w[1], w[0]])); }
        let mx = 0, my = 0; r.forEach(q => { mx += q[0]; my += q[1]; }); mx /= r.length; my /= r.length;
        const hit = fbox.some((b, i) => mx > b[0] && mx < b[2] && my > b[1] && my < b[3] && near(mx, my, foot[i]));
        const A = cat === 1 ? (hit ? pubIn : pubOut) : hit ? exIn : exOut; let ar = 0; r.forEach((a, i) => { const b = r[(i+1)%r.length]; ar += a[0]*b[1] - b[0]*a[1]; }); if(ar < 0) r.reverse();
        r.forEach((a, i) => { const b = r[(i+1)%r.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, nx = (b[1]-a[1])/L, ny = -(b[0]-a[0])/L;
          A.p.push(a[0], 0, -a[1], b[0], 0, -b[1], b[0], h, -b[1], a[0], 0, -a[1], b[0], h, -b[1], a[0], h, -a[1]); for(let q = 0; q < 6; q++) A.n.push(nx, 0, -ny); });
        T.ShapeUtils.triangulateShape(r.map(q => new T.Vector2(q[0], q[1])), []).forEach(t => t.forEach(ix => { const q = r[ix]; A.p.push(q[0], h, -q[1]); A.n.push(0, 1, 0); })); } } }
  function near(x, y, r){ if(inPoly(x, y, r)) return true; for(let i = 0; i < r.length; i++){ const a = r[i], b = r[(i+1)%r.length], vx = b[0]-a[0], vy = b[1]-a[1], l = vx*vx + vy*vy || 1, t = Math.max(0, Math.min(1, ((x-a[0])*vx + (y-a[1])*vy)/l)); if(Math.hypot(x - a[0] - t*vx, y - a[1] - t*vy) < 8) return true; } return false; }
  const exM = new T.MeshStandardMaterial({ color:sc('#cfccc4'), roughness:.95 });
  const exMesh = A => { if(!A.p.length) return null; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(A.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(A.n, 3)); const m = new T.Mesh(g, exM); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  exMesh(exOut); const exInM = exMesh(exIn), pubOutM = exMesh(pubOut), pubInM = exMesh(pubIn);
  const exCount = (exOut.p.length + exIn.p.length) ? true : false;
  /** שלושה מצבים (ענת, 26.11.2026): היום (הקיים, והמתוכנן שקוף), מתוכנן (נפחי התב"ע בצבע הייעוד), אחרי (המחשה של המאושר ותוכניות הבינוי) */
  let mode = 'build', pub = false;   // מבני הציבור: מתג במקרא, כבוי בפתיחה (בכל העיר יש 490 מגרשי ציבור)
  const withModel = new Set(); items.forEach(it => { if(it.model) (meshesOf.get(it) || []).forEach(x => withModel.add(x)); });
  const bpMats = new Map();   // חומרי הייעוד המקוריים של נפחי תוכניות הבינוי
  meshesOf.forEach(ms => ms.forEach(x => { if(x.isMesh && Array.isArray(x.material)) bpMats.set(x, x.material); }));
  function setMode(m){ mode = m;
    exM.color.copy(sc(m === 'build' ? '#aeaba3' : '#cfccc4'));   // אחרי: הקיים כהה יותר, כדי שהמבנים החדשים יבלטו
    if(exInM) exInM.visible = m === 'exist';
    // מבני ציבור קיימים: בחום בהיר כשהמתג דלוק, גם בתוך תוכניות (הגדילה נראית דרך הנפח השקוף). כבוי: כמו כל מבנה קיים
    [pubOutM, pubInM].forEach(x => { if(x) x.material = pub ? M.pubOld : exM; });
    if(pubInM) pubInM.visible = pub || m === 'exist';
    meshesOf.forEach(ms => ms.forEach(x => { const orig = bpMats.get(x);
      if(!orig){ x.visible = m !== 'build' || !withModel.has(x); return; }      // משטח מגרש בלי נפח
      x.visible = m === 'exist' || m === 'plan' || !withModel.has(x);
      x.material = m === 'exist' ? M.ghost : m === 'plan' ? orig : mats.real; x.castShadow = m !== 'exist'; }));
    scene.children.forEach(o => { if(o.isLineSegments && o.userData.f) o.visible = o.userData.f.visible && mode !== 'exist'; });
    modelG.visible = m === 'build';
    if(rnMesh.A) rnMesh.A.material = m === 'exist' ? M.ghost : m === 'plan' ? M.useA : M.real;
    if(rnMesh.P) rnMesh.P.material = m === 'exist' ? M.ghost : m === 'plan' ? M.useP : M.planGray;
    if(rnMesh.U) rnMesh.U.material = m === 'exist' ? M.ghost : pub ? M.pubNew : m === 'plan' ? M.useA : M.real;
    Object.values(rnMesh).forEach(x => { x.castShadow = m !== 'exist' && x.material !== M.planGray && x.material !== M.pubNew; });
  }
  function setPublic(on){ pub = !!on; setMode(mode); return pub; }
  // סמן לתוכנית שנבחרה
  const ring = new T.Mesh(new T.RingGeometry(1, 1.035, 96), new T.MeshBasicMaterial({ color:0x111111, side:T.DoubleSide, transparent:true, opacity:.85 })); ring.rotation.x = -Math.PI/2; ring.position.y = 1; ring.visible = false; scene.add(ring);

  const cx = (minX+maxX)/2, cy = (minY+maxY)/2, span = Math.max(maxX-minX, maxY-minY);
  cam.position.set(cx + span*.2, span*.27, -cy + span*.36); ctl.target.set(cx, 0, -cy); ctl.update();

  /* שמש: ערך t רץ. כל יום מתקדם חודש */
  let t0 = performance.now() - (11 - H0)/(H1 - H0)*DAY_S*1000, paused = false, pauseAt = 0, lastLabel = '';   // מתחילים ב-11:00 ביוני: העיר נראית מיד (ענת, 25.11.2026)
  const clock = () => { const s = ((paused ? pauseAt : performance.now()) - t0)/1000, day = Math.floor(s/DAY_S), f = (s % DAY_S)/DAY_S;
    const month = (5 + day) % 12, hour = H0 + f*(H1 - H0); return { month, hour }; };
  const sky = { night:sc('#0e1a2b'), dusk:sc('#e6a676'), day:sc('#e4e9ec') };
  function setSun(){
    const { month, hour } = clock(), y = new Date().getFullYear(), d = window.PlanModel.ilDate(y, month + 1, 21, hour);
    const s = window.PlanModel.sunPos(d, lat0, lng0), alt = s.alt, az = s.az;
    const R = 6000, dir = new T.Vector3(Math.sin(az)*Math.cos(alt), Math.sin(alt), -Math.cos(az)*Math.cos(alt));
    sun.target.position.copy(ctl.target); sun.position.copy(ctl.target).addScaledVector(dir, R);
    const half = Math.min(4000, Math.max(600, cam.position.distanceTo(ctl.target)*.9)); Object.assign(sun.shadow.camera, { left:-half, right:half, top:half, bottom:-half, near:10, far:14000 }); sun.shadow.camera.updateProjectionMatrix();
    const day = Math.max(0, Math.min(1, (alt + .05)/.35)), dusk = Math.max(0, 1 - Math.abs(alt - .03)/.18);
    sun.intensity = 2.4*day; sun.color.setHSL(.09, .7*(1-day) + .1, .5 + .45*day);
    hemi.intensity = .12 + .5*day; moon.intensity = .35*(1-day);
    const bg = sky.night.clone().lerp(sky.day, day).lerp(sky.dusk, dusk*.55);
    scene.background = bg; renderer.toneMappingExposure = .75 + .35*day;
    const glow = Math.max(0, 1 - day*1.6); Object.values(mats).forEach(m => { m[1].emissiveIntensity = glow*1.3; });
    const lbl = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1)*4)*15).padStart(2, '0')} · 21 ב${MONTHS[month]} · ${['חורף','חורף','אביב','אביב','אביב','קיץ','קיץ','קיץ','סתיו','סתיו','סתיו','חורף'][month]}`;
    if(lbl !== lastLabel){ lastLabel = lbl; const L = document.getElementById('cityClock'); if(L) L.textContent = lbl; }
    return day;
  }
  let fly = null, dead = false, raf = 0;
  function frame(now){
    if(dead) return; raf = requestAnimationFrame(frame);
    if(fly){ const k = Math.min(1, (now - fly.t)/1600), e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2;
      ctl.target.lerpVectors(fly.a, fly.b, e); cam.position.lerpVectors(fly.pa, fly.pb, e); if(k >= 1) fly = null; }
    ring.material.opacity = .55 + .3*Math.sin(now/300);
    ctl.update(); setSun(); renderer.render(scene, cam);
  }
  function resize(){ const r = el.getBoundingClientRect(); if(r.width < 10) return; renderer.setSize(r.width, r.height, false); cam.aspect = r.width/r.height; cam.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize(); raf = requestAnimationFrame(frame);

  function focus(it){
    if(!it || !it.c) return;
    const b = new T.Vector3(it.c[0], 0, -it.c[1]), d = Math.max(420, it.h*4.2, (it.span || 0)*1.4);
    const dirv = cam.position.clone().sub(ctl.target).setY(0).normalize();
    const pb = b.clone().addScaledVector(dirv, d*.8).setY(d*.62);
    fly = { t:performance.now(), a:ctl.target.clone(), b, pa:cam.position.clone(), pb };
    ring.position.set(b.x, 1.2, b.z); const s = Math.max(90, (it.span || 120)*.75); ring.scale.set(s, s, s); ring.visible = true;
  }
  function home(){ ring.visible = false; fly = { t:performance.now(), a:ctl.target.clone(), b:new T.Vector3(cx, 0, -cy), pa:cam.position.clone(), pb:new T.Vector3(cx + span*.2, span*.27, -cy + span*.36) }; }
  /** תמונה קטנה של הנפחים של תוכנית: אותה סצנה, בצהרי יוני */
  function thumb(it){
    if(!it.c) return '';
    const w = 320, h = 200, r2 = thumbR || (thumbR = new T.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true }));
    r2.setSize(w, h, false); r2.outputEncoding = T.sRGBEncoding; r2.toneMapping = T.ACESFilmicToneMapping; r2.shadowMap.enabled = true;
    const c2 = new T.PerspectiveCamera(34, w/h, 5, 20000), d = Math.max(260, it.h*3.2, (it.span || 0)*1.25);
    c2.position.set(it.c[0] + d*.55, d*.55, -it.c[1] + d*.65); c2.lookAt(it.c[0], it.h*.3, -it.c[1]);
    const keep = { bg:scene.background, si:sun.intensity, hi:hemi.intensity, mi:moon.intensity, sp:sun.position.clone(), tp:sun.target.position.clone(), em:Object.values(mats).map(m => m[1].emissiveIntensity) };
    scene.background = sky.day; sun.intensity = 2.3; hemi.intensity = .6; moon.intensity = 0; Object.values(mats).forEach(m => { m[1].emissiveIntensity = 0; });
    sun.target.position.set(it.c[0], 0, -it.c[1]); sun.position.set(it.c[0] - 1500, 3200, -it.c[1] + 1200); ring.visible = false;
    r2.render(scene, c2); const url = r2.domElement.toDataURL('image/jpeg', .82);
    scene.background = keep.bg; sun.intensity = keep.si; hemi.intensity = keep.hi; moon.intensity = keep.mi; sun.position.copy(keep.sp); sun.target.position.copy(keep.tp); Object.values(mats).forEach((m, i) => { m[1].emissiveIntensity = keep.em[i]; });
    return url;
  }
  let thumbR = null;
  items.forEach(it => { it.span = spanOf(it, xy); });
  setMode('build');
  return { items, focus, home, thumb, setMode, setPublic, get mode(){ return mode; }, get pub(){ return pub; }, exists:exCount, renewal:{ shown:rnCount, replaced:rnSkip, plans:RT ? RT.plans.length : 0 },
    pause(on){ if(on && !paused){ paused = true; pauseAt = performance.now(); } else if(!on && paused){ t0 += performance.now() - pauseAt; paused = false; } return paused; },
    get paused(){ return paused; }, setAuto(on){ ctl.autoRotate = on; },
    setHour(h){ const now = performance.now(); t0 = now - (h - H0)/(H1 - H0)*DAY_S*1000; if(paused) pauseAt = now; },   // לבדיקה ולצילום
    dispose(){ dead = true; if(stdUI) stdUI.unbind(); cancelAnimationFrame(raf); window.removeEventListener('resize', resize); ctl.dispose(); renderer.dispose(); if(thumbR) thumbR.dispose(); renderer.domElement.remove(); } };
}
function centerOf(it, xy){
  const q = it.fs.length ? it.fs.flatMap(f => f.r) : (it.geo ? [[it.geo.lng, it.geo.lat]] : []); if(!q.length) return null;
  const a = q.map(xy); return [a.reduce((s, v) => s + v[0], 0)/a.length, a.reduce((s, v) => s + v[1], 0)/a.length];
}
function spanOf(it, xy){
  const q = it.fs.length ? it.fs.flatMap(f => f.r) : []; if(!q.length) return 120;
  const a = q.map(xy), X = a.map(v => v[0]), Y = a.map(v => v[1]); return Math.max(Math.max(...X) - Math.min(...X), Math.max(...Y) - Math.min(...Y));
}
/** מרקם חלונות: קומה 3.2 מ', מפתח 4 מ'. בלילה כמחצית מהחלונות דולקים בגוונים חמים */
function windowTexture(T, night){
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = night ? '#000' : '#ffffff'; x.fillRect(0, 0, 128, 128);
  let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
  for(let i = 0; i < 4; i++) for(let j = 0; j < 4; j++){
    if(night){ if(rnd() < .5){ x.fillStyle = `hsl(${30 + rnd()*18},90%,${55 + rnd()*20}%)`; x.fillRect(i*32 + 6, j*32 + 8, 20, 16); } }
    else { x.fillStyle = '#c9ced3'; x.fillRect(i*32 + 6, j*32 + 8, 20, 16); }
  }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1/16, 1/12.8);   // 4 חלונות ב-16 מ', 4 קומות ב-12.8 מ'
  if(!night) t.encoding = T.sRGBEncoding; return t;
}
/** חזית להמחשה (מצב "אחרי"): מפתח של 4 מ' וקומה של 3.3 מ'. קיר לבן, חלון כהה עם השתקפות, ופס מרפסת לבן עם מעקה זכוכית.
    בלילה כמחצית מהחלונות דולקים. UV במטרים, כמו ExtrudeGeometry. המחשה, לא התכנון של המבנה */
function facadeTexture(T, night){
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
  let seed = night ? 11 : 3; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
  if(night){ x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
    for(let i = 0; i < 2; i++) if(rnd() < .55){ x.fillStyle = `hsl(${30 + rnd()*16},85%,${52 + rnd()*18}%)`; x.fillRect(i*64 + 8, 22, 48, 74); } }
  else {
    x.fillStyle = '#f3f0ea'; x.fillRect(0, 0, 128, 128);                                   // קיר (וגם הפינה 0,0: הגגות)
    for(let i = 0; i < 2; i++){ const g = x.createLinearGradient(0, 22, 0, 96); g.addColorStop(0, '#8fa3b3'); g.addColorStop(.55, '#53606c'); g.addColorStop(1, '#3d4852');
      x.fillStyle = g; x.fillRect(i*64 + 6, 18, 52, 80); x.fillStyle = '#e9e6df'; x.fillRect(i*64 + 31, 22, 2, 74); }
    x.fillStyle = '#ffffff'; x.fillRect(0, 100, 128, 10);                                  // מעקה המרפסת: פס לבן
    x.fillStyle = 'rgba(160,185,200,.55)'; x.fillRect(0, 96, 128, 4);                      // זכוכית המעקה
    x.fillStyle = '#d8d3c8'; x.fillRect(0, 110, 128, 3); }                                  // צל תקרת המרפסת
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1/4, 1/3.3);
  if(!night) t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
}
/** מפת אשדוד באפור ובלי כיתובים: Esri World Light Gray Base, רמה 14, אריחים על בד אחד (תקן התאום העירוני, סעיף 8) */
function loadMap(T, scene, G, sc){
  const z = 14, n = 2**z, lng = x => x/G.KX + G.lng0, lat = y => y/G.KY + G.lat0;
  const tx = L => Math.floor((L + 180)/360*n), ty = A => { const r = A*Math.PI/180; return Math.floor((1 - Math.log(Math.tan(r) + 1/Math.cos(r))/Math.PI)/2*n); };
  const X0 = tx(lng(G.minX)), X1 = tx(lng(G.maxX)), Y0 = ty(lat(G.maxY)), Y1 = ty(lat(G.minY));
  const tl = (X, Y) => [X/n*360 - 180, Math.atan(Math.sinh(Math.PI*(1 - 2*Y/n)))*180/Math.PI];
  const W = (X1 - X0 + 1)*256, Hh = (Y1 - Y0 + 1)*256, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const cx = cv.getContext('2d');
  cx.fillStyle = '#dedcd6'; cx.fillRect(0, 0, W, Hh);
  const jobs = []; let ok = 0;
  for(let X = X0; X <= X1; X++) for(let Y = Y0; Y <= Y1; Y++) jobs.push(new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { try{ if('filter' in cx) cx.filter = 'grayscale(1) brightness(1.04) contrast(.9)'; cx.drawImage(im, (X - X0)*256, (Y - Y0)*256); ok++; }catch(e){} res(); }; im.onerror = res;
    im.src = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${Y}/${X}`; }));   // בלי כיתובים: מפה שקטה (נבדק בעין ברמה 14; ברמה 16 יש בו שמות רחובות)
  return Promise.all(jobs).then(() => {
    if(ok < jobs.length/2) throw new Error('tiles');
    const [l0, a0] = tl(X0, Y0), [l1, a1] = tl(X1 + 1, Y1 + 1);
    const x0 = (l0 - G.lng0)*G.KX, x1 = (l1 - G.lng0)*G.KX, y0 = (a0 - G.lat0)*G.KY, y1 = (a1 - G.lat0)*G.KY;
    const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
    const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, y0 - y1), new T.MeshStandardMaterial({ map:tex, roughness:1 }));
    m.rotation.x = -Math.PI/2; m.position.set((x0 + x1)/2, -.2, -(y0 + y1)/2); m.receiveShadow = true; scene.add(m);
  });
}
/** בלי אריחים: רחובות העירייה */
function streets(T, scene, xy){
  fetch('geo/ashdod-streets.geojson').then(r => r.json()).then(g => { const pos = [];
    (g.features || []).forEach(f => { const gm = f.geometry; if(!gm) return; const ls = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : [];
      ls.forEach(l => { for(let i = 1; i < l.length; i++){ const a = xy(l[i-1]), b = xy(l[i]); pos.push(a[0], .1, -a[1], b[0], .1, -b[1]); } }); });
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    scene.add(new T.LineSegments(geo, new T.LineBasicMaterial({ color:0x9a978f }))); }).catch(() => {});
}

/* ── הדף ── */
const CAT_HE = { residential:'מגורים', mixed:'מגורים ומסחר', commerce:'מסחר', public:'מבני ציבור', open:'שטח פתוח', employment:'תעסוקה', hotel:'מלונאות' };
const N = n => Number(n).toLocaleString('he-IL');
/** משפט ציבורי לתוכנית, רק מעובדות: הנפחים שלה (data/city.json) והסיכום של התב"ע (plan_models.summary) */
function sentence(it){
  const a = [];
  if(it.fs.length && it.scope === 'lots'){ const lots = new Set(it.fs.map(f => f.lot)).size, cats = [...new Set(it.fs.map(f => CAT_HE[f.cat]).filter(Boolean))];
    a.push(`${lots === 1 ? 'מגרש אחד' : lots + ' מגרשים'}${cats.length ? ', ' + cats.join(' ו') : ''}, עד ${Math.round(it.h)} מ'.`); }
  if(it.fs.length && it.scope === 'table5') a.push(`מגרש ${it.fs.map(f => f.lot).join(', ')}: נפח לפי טבלה 5 בהוראות התב"ע, עד ${Math.round(it.h)} מ' (הערכה, לא התכנון של תוכנית הבינוי).`);
  const S = it.sum; if(S && it.taba){ const b = [];
    if(S.units_after) b.push(`${N(S.units_after)} יח"ד`); if(S.floors_max) b.push(`עד ${S.floors_max} קומות`); if(S.height_max) b.push(`עד ${Math.round(S.height_max)} מ'`);
    if(b.length) a.push(`התב"ע ${it.taba}${S.lots ? `, ${S.lots} מגרשים` : ''}: ${b.join(', ')}.`); }
  return a.join(' ');
}
const PURPOSE = {};
async function purposeOf(p){
  const k = String(p.tik); if(PURPOSE[k] !== undefined) return PURPOSE[k];
  try{ const r = await fetch(`data/taba/${encodeURIComponent(k)}.json?v=1124a`); const d = r.ok ? await r.json() : null; const t = d && d.purpose && d.purpose.text || '';
    PURPOSE[k] = t ? (t.split(/(?<=\.)\s/)[0]) : ''; }catch(e){ PURPOSE[k] = ''; }
  return PURPOSE[k];
}
const shareUrl = it => location.origin + location.pathname + '#city' + (it ? '=' + pnum(it.p) : '');
async function share(it, btn){
  const url = shareUrl(it), title = it ? `תוכנית בינוי ${it.p.planNum}, אשדוד` : 'תוכניות הבינוי של אשדוד';
  try{ if(navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)){ await navigator.share({ title, url }); return; } }catch(e){ return; }
  let ok = false; try{ await navigator.clipboard.writeText(url); ok = true; }catch(e){}
  if(!ok) prompt('הקישור לשיתוף', url);
  if(btn){ const t = btn.textContent; btn.textContent = 'הקישור הועתק'; setTimeout(() => { btn.textContent = t; }, 1600); }
  window._cityShared = url;
}
function stLabel(p){ const s = String(p.status || ''); return /הושלם/.test(s) ? 'אושרה' : /בטיפול|דחוף|בהמתנה/.test(s) ? 'בטיפול' : 'בהכנה'; }
function card(it, i){
  const p = it.p, img = it.render || it.thumb || '';
  return `<button class="cy-card" data-i="${i}" title="${H(p.planNum)}">
    <span class="cy-img">${img ? `<img src="${H(img)}" alt="" loading="lazy">` : ''}${it.render ? '<em>הדמיה</em>' : it.model ? '<em class="cy-tag-model" title="הצגת המודל במודל התאום של העיר, במצב אחרי">מודל</em>' : '<em>נפח לפי התב"ע</em>'}</span>
    <span class="cy-t"><b>${H(p.planNum)}</b> <small>${H(stLabel(p))}</small></span>
    <span class="cy-d">${H([p.district, p.location].filter(Boolean).join(', '))}</span></button>`;
}
async function open(){
  if(document.getElementById('cityIntro')) return;
  const ov = document.createElement('div'); ov.id = 'cityIntro'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'תוכניות הבינוי של אשדוד');
  ov.innerHTML = `<div class="cy-scene" id="cityScene"></div>
    <header class="cy-top"><div><h1>תוכניות הבינוי של אשדוד</h1><p id="citySub">טוען את העיר</p></div>
      <div class="cy-acts"><span class="cy-modes" id="cityModes" role="tablist" aria-label="מצב">${MODES.map(([k, l, t]) => `<button data-mode="${k}" title="${H(t)}" class="${k === 'build' ? 'on' : ''}">${l}</button>`).join('')}</span>
        <span id="cityClock" class="cy-clock"></span><button class="cy-ghost" id="cityPause" title="עצירת השמש">עצירה</button><button class="cy-ghost" id="cityHome" title="חזרה למבט על כל העיר">כל העיר</button><button class="cy-ghost" id="cityShare" title="העתקת הקישור לדף">שיתוף</button><button class="cy-go" id="cityEnter">כניסה למערכת</button></div></header>
    <div class="cy-legend" id="cityLegend" aria-live="polite"></div>
    <div class="cy-strip" id="cityStrip"><div class="cy-track" id="cityTrack"></div></div>`;
  document.body.appendChild(ov); document.body.classList.add('city-open');
  ov.querySelector('#cityEnter').onclick = close;
  let RT0 = null, TV0 = null;
  try{
    const [, R, D, BLD, CM, RT, S, BT, TV] = await Promise.all([window.PlanModel.loadThree(),
      fetch('data/renders.json?v=1124p').then(r => r.json()).catch(() => ({})), fetch('data/city.json?v=1124p').then(r => r.json()),
      fetch('geo/bld/all.json?v=1125').then(r => r.json()).catch(() => null), fetch('data/city-models.json?v=1125').then(r => r.json()).catch(() => null),
      fetch('data/renewal-twin.json?v=1126c').then(r => r.json()).catch(() => null), window.urbanStandard ? window.urbanStandard() : null,
      fetch('data/building-twin.json?v=1126b').then(r => r.json()).catch(() => null), fetch('data/taba-volumes.json?v=1126c').then(r => r.json()).catch(() => null)]);
    RENDERS = (R && R.renders) || {};
    RT0 = RT; TV0 = TV;
    st = build(ov.querySelector('#cityScene'), D, BLD, CM, RT, S, BT, TV); window._city = st;
    if(S) Object.keys(COL).forEach(k => { COL[k] = S.landUseColor(k); });
  }catch(e){ console.warn('city', e); ov.querySelector('#citySub').textContent = 'ההדמיה לא נטענה. אפשר להיכנס למערכת.'; return; }
  const it = st.items, nv = it.filter(x => x.fs.length).length, nm = it.filter(x => x.model).length;
  // שורה אחת קצרה. ההסבר המלא בריחוף, כדי שהטקסט לא יסתיר את העיר (ענת, 26.11.2026)
  const ntaba = new Set([...(RT0 && RT0.plans || []), ...(TV0 && TV0.plans || [])]).size, sub = ov.querySelector('#citySub');
  sub.textContent = `${it.length} תוכניות בינוי · ${ntaba} תב"עות`;
  sub.title = `${nm} תוכניות בינוי עם מודל, ${nv} עם נפח לפי התב"ע. ברקע ${ntaba} תב"עות: התחדשות עירונית מ"מה נבנה סביבי", המרינה (112/101/02/3) ורובע ז' (603-0595660). מעבר עם העכבר על תוכנית: מתמקדים. לחיצה: נכנסים.`;
  const legend = () => { const lg = ov.querySelector('#cityLegend'), m = st.mode, sw = (bg, t, extra) => `<span><i style="background:${bg};${extra || ''}"></i>${t}</span>`;
    const uses = [['residential','מגורים'],['mixed','מגורים ומסחר'],['commerce','מסחר ותיירות'],['hotel','מלונאות'],['public','מבני ציבור']];
    let a = m === 'exist' ? [sw('#cfccc4', 'קיים'), sw('#ffffff', 'מתוכנן', 'opacity:.5;outline:1px solid #bbb')]
      : m === 'plan' ? uses.map(([k, t]) => sw(COL[k], t)).concat(sw('#cfcdc7', 'בתכנון', 'opacity:.55;outline:1px dashed #999'))
      : [sw('#f3f0ea', 'מאושר', 'outline:1px solid #bbb;background-image:linear-gradient(#53606c 0 0);background-size:5px 6px;background-position:3px 3px;background-repeat:no-repeat'), sw('#cfcdc7', 'בתכנון', 'opacity:.55;outline:1px dashed #999'), sw('#cfccc4', 'קיים')];
    lg.innerHTML = a.join('') + `<button type="button" id="cityPub" aria-pressed="${st.pub}" title="מבני הציבור הקיימים בחום בהיר, והנפח שמותר לפי התב"ע (603-0828491 ומגרשי הציבור בכל תב"ע) בחום כהה שקוף מעליהם: רואים את הגדילה"><i style="background:#e7cfae"></i><i style="background:#7a4f28;opacity:.75"></i>מבני ציבור: היום והתב"ע</button>`
      + `<span class="cy-q" tabindex="0" title="נפחי התב"ע לפי טבלה 5 והתשריט, וגובה המבנים הקיימים לפי השטח: הערכה. צבעי הייעוד ממשבצות המקרא בתשריטי מבא"ת (התקן המשותף). מלונאות: צבע לבדיקה. במצב אחרי החזיתות הן המחשה, לא התכנון של המבנים.">?</span>`;
    lg.querySelector('#cityPub').onclick = e => { const on = st.setPublic(!st.pub); e.currentTarget.setAttribute('aria-pressed', on); }; };
  legend();
  // מהתוכנית האחרונה לראשונה (מספר התוכנית בסדר יורד), מעבר אחד ועצירה בסוף
  const num = x => +String(x.p.planNum || x.p.tik).replace(/\D/g, '') || 0;
  const order = it.slice().sort((a, b) => num(b) - num(a));
  const track = ov.querySelector('#cityTrack'), strip = ov.querySelector('#cityStrip');
  track.innerHTML = order.map(x => card(x, it.indexOf(x))).join('');
  // תמונות הנפחים נוצרות ברקע, אחת בכל פעם, כדי שהדף לא ייתקע (ענת, 25.11.2026: "להימנע מהשהות על מסך לא ברור")
  const todo = order.filter(x => !x.render), idle = f => window.requestIdleCallback ? requestIdleCallback(f, { timeout:250 }) : setTimeout(f, 60);   // גם כשהסצנה עמוסה
  const nextThumb = () => { if(!st || !todo.length) return; const x = todo.shift(); try{ x.thumb = st.thumb(x); }catch(e){ x.thumb = ''; }
    const c = track.querySelector(`.cy-card[data-i="${it.indexOf(x)}"] .cy-img`); if(c && x.thumb && !c.querySelector('img')) c.insertAdjacentHTML('afterbegin', `<img src="${x.thumb}" alt="">`); idle(nextThumb); };
  setTimeout(() => idle(nextThumb), 400);
  let sel = -1, hover = false, pos = 0, last = performance.now();
  const pick = i => { if(sel === i) return; sel = i; st.focus(it[i]); st.setAuto(true); track.querySelectorAll('.cy-card').forEach(c => c.classList.toggle('on', +c.dataset.i === i));
    const p = it[i].p; let b = ov.querySelector('.cy-info'); if(!b){ b = document.createElement('div'); b.className = 'cy-info'; ov.appendChild(b); }
    b.innerHTML = `<div class="cy-name">${H(window.projName ? window.projName(p) : p.planNum)}</div><div><small>${H(stLabel(p))}${it[i].model ? ' · יש מודל' : ''}</small></div>
      <p class="cy-say">${H(sentence(it[i]) || (it[i].model ? 'במצב "אחרי" מוצג המודל של תוכנית הבינוי.' : it[i].fs.length ? '' : !it[i].c ? 'אין עדיין מיקום על המפה.' : 'בלי נפח במקור. מוצג המגרש בלבד.'))}</p><p class="cy-say cy-purpose"></p>
      ${it[i].render && RENDERS[pnum(p)] ? '<small class="muted">ההדמיה: מתוך חומרי התוכנית שהוגשו לעירייה.</small>' : ''}
      <div class="cy-row"><button class="cy-go" data-enter="${p.id}">${it[i].model ? 'כניסה למודל' : 'כניסה לתוכנית'}</button><button class="cy-ghost" data-share="${i}">שיתוף התוכנית</button></div>`;
    try{ history.replaceState(null, '', '#city=' + pnum(p)); }catch(e){}
    if(window.planStreetName) window.planStreetName(p).then(ch => { const q = b.querySelector('.cy-name'); if(ch && q && sel === i) q.textContent = window.projName(p); });
    purposeOf(p).then(t => { const q = b.querySelector('.cy-purpose'); if(q && sel === i && t) q.textContent = 'מטרת התב"ע: ' + t; }); };
  const enter = id => { close(); setTimeout(() => { try{ openProject(id); }catch(err){} }, 60); };   // תוכנית עם מודל נפתחת במודל: תוכנית בינוי, כל השכבות
  track.addEventListener('mouseover', e => { const c = e.target.closest('.cy-card'); if(c) pick(+c.dataset.i); });
  // התג "מודל" בכרטיס: המודל של תוכנית הבינוי הוא חלק מהמודל התאום של העיר. לחיצה עליו מציגה אותו כאן, במצב "אחרי", בלי לצאת
  track.onclick = e => { const c = e.target.closest('.cy-card'); if(!c) return; const x = it[+c.dataset.i];
    if(e.target.closest('.cy-tag-model')){ showMode('build'); sel = -1; pick(+c.dataset.i); return; }
    enter(x.p.id); };
  ov.addEventListener('click', e => { const sh = e.target.closest('[data-share]'); if(sh){ share(it[+sh.dataset.share], sh); return; } const b = e.target.closest('[data-enter]'); if(b) enter(+b.dataset.enter); });
  const showMode = k => { st.setMode(k); ov.querySelectorAll('#cityModes button').forEach(x => x.classList.toggle('on', x.dataset.mode === k)); legend(); };
  ov.querySelector('#cityModes').onclick = e => { const b = e.target.closest('[data-mode]'); if(b) showMode(b.dataset.mode); };
  strip.onmouseenter = () => { hover = true; }; strip.onmouseleave = () => { hover = false; last = performance.now(); };
  strip.addEventListener('wheel', e => { pos += e.deltaY || e.deltaX; e.preventDefault(); }, { passive:false });
  ov.querySelector('#cityPause').onclick = e => { const p = st.pause(!st.paused); e.target.textContent = p ? 'המשך' : 'עצירה'; };
  ov.querySelector('#cityShare').onclick = e => share(null, e.target);
  const want = ((location.hash.match(/^#city=(\d+)/) || [])[1]); if(want){ const k = it.findIndex(x => pnum(x.p) === want); if(k >= 0) pick(k); }
  ov.querySelector('#cityHome').onclick = () => { try{ history.replaceState(null, '', '#city'); }catch(e){} sel = -1; st.home(); ov.querySelector('.cy-info')?.remove(); track.querySelectorAll('.cy-card.on').forEach(c => c.classList.remove('on')); };
  const roll = now => { if(!document.getElementById('cityIntro')) return; requestAnimationFrame(roll);
    const dt = now - last; last = now; if(!hover && !st.paused) pos += dt*.03;
    const max = Math.max(0, track.scrollWidth - strip.clientWidth); pos = Math.max(0, Math.min(max, pos)); track.style.transform = `translateX(${-pos}px)`; };   // בלי לולאה: נעצרת בתוכנית הראשונה
  requestAnimationFrame(roll);
  document.addEventListener('keydown', esc);
}
const MODES = [['exist', 'היום', 'המבנים הקיימים בעיר (GIS עירוני, גובה סמלי). מה שמתוכנן מופיע שקוף מאוד'], ['plan', 'מתוכנן', 'כל נפחי התב"ע ותוכניות הבינוי בצבע הייעוד, לפי מקרא התשריטים. הערכה'], ['build', 'אחרי', 'המחשה: המבנים המאושרים ותוכניות הבינוי עם חזיתות. מה שעוד בתכנון באפור שקוף']];
function esc(e){ if(e.key === 'Escape') close(); }
function close(){
  const ov = document.getElementById('cityIntro'); if(!ov) return;
  document.removeEventListener('keydown', esc);
  if(st){ st.dispose(); st = null; } ov.remove(); document.body.classList.remove('city-open');
  if(/^#city\b/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
}
window.openCity = open; window.closeCity = close;

function boot(){
  let skip = false; try{ skip = localStorage.getItem('ashdod_skip_city') === '1' || /[?&]nocity\b/.test(location.search); }catch(e){}
  const h = (location.hash || '').replace('#', '');
  if(/^city(=\d+)?$/.test(h) || (!h && !skip)) setTimeout(open, 50);
  window.addEventListener('hashchange', () => { if(/^#city(=\d+)?$/.test(location.hash)) open(); });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
