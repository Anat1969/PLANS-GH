/* ══════════════════════════════════════════════════════════════════
   plans-city.js: דף הכניסה (ענת, 24.11.2026). כל תוכניות הבינוי במצב הסופי, על מפת אשדוד.
   - הנפחים: data/city.json (tools/city-data.py), מגדל ומסד לפי טבלה 5 ותשריט התב"ע מ-plan_models.
     לכל תוכנית בינוי רק המגרשים שלה (מספרי המגרש בשדה "מיקום"). בלי התאמה: כל הנפחים של התב"ע.
     תוכנית בלי נפחים: המגרש הרשום (plans-geo.js) כמשטח, ובלי גובה. הנפח הוא הערכה, לא תוכנית הבינוי.
   - שמש לפי SunCalc (PlanModel.sunPos), שעון ישראל. יום מ-05:00 עד 21:00 בכ-20 שניות,
     והתאריך מתקדם בכל יום בחודש: חורף, אביב, קיץ, סתיו. בלילה החלונות נדלקים.
   - קרוסלה: כרטיס לכל תוכנית. ההדמיה מחומרי התוכנית (planMaterials, קטגוריה render),
     ובלעדיה תמונה של הנפחים מאותה סצנה. לחיצה מקרבת את המצלמה. "כניסה לתוכנית" פותחת את הכרטיס.
   - נפתח כשנכנסים בלי יעד בכתובת, או ב-#city. "כניסה למערכת" סוגר. רק מידע ציבורי: שם, מיקום ונפח.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s||'').replace(/[\s/\\-]+/g, '');
const COL = { residential:'#e8b93c', mixed:'#e0884a', commerce:'#b6529c', public:'#a5673f', open:'#6fae5d', road:'#a8a8a8', employment:'#9aa3ad', hotel:'#c58b6a' };
const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DAY_S = 20, H0 = 5, H1 = 21;                       // יום של 16 שעות ב-20 שניות
let st = null;

function plansList(){ try{ return (typeof livePlans === 'function' ? livePlans() : plans).filter(p => p && !p.deleted); }catch(e){ return []; } }
function lotsOf(p){ return (String(p.location || '').match(/\d{1,4}/g) || []).map(Number); }
function lotList(p){ const s = String(p.location || ''); const r = s.match(/(\d{1,4})\s*-\s*(\d{1,4})/); if(r && +r[2] - +r[1] < 30){ const a = []; for(let i = +r[1]; i <= +r[2]; i++) a.push(i); return a; } return lotsOf(p); }
function renderOf(p){ try{ const m = (window.planMaterials ? window.planMaterials(p) : []).find(x => x.cat === 'render' && x.img); return m ? m.img : ''; }catch(e){ return ''; } }

/** לכל תוכנית: נפחים (מהתב"ע) או משטח המגרש, ומרכז */
function collect(D){
  const P = plansList(), used = new Set(), items = [];
  P.forEach(p => {
    const t = D.taba[norm(p.change)], geo = window.planGeo ? window.planGeo(p) : null;
    let fs = [], scope = '';
    if(t){ const L = lotList(p); fs = t.f.filter(f => L.includes(+f.lot)); scope = fs.length ? 'lots' : 'taba'; if(!fs.length) fs = t.f; }
    const parcel = !fs.length && geo && geo.geo ? geo.geo : null;
    if(!fs.length && !geo) return;
    items.push({ p, fs, scope, parcel, geo, taba:t ? t.n : '', render:renderOf(p) });
    fs.forEach(f => used.add(f));
  });
  return items;
}

/* ── הסצנה ── */
function build(el, D){
  const T = window.THREE, items = collect(D);
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
      const e = new T.LineSegments(new T.EdgesGeometry(g, 30), edgeM); scene.add(e);
      drawn.set(f, m); ms.push(m);
    });
    if(it.parcel){ (it.parcel.type === 'MultiPolygon' ? it.parcel.coordinates : [it.parcel.coordinates]).forEach(poly => {
      const sh = new T.Shape(poly[0].map(q => { const [x, y] = xy(q); return new T.Vector2(x, y); }));
      const g = new T.ShapeGeometry(sh); g.rotateX(-Math.PI/2); g.translate(0, .5, 0);
      const m = new T.Mesh(g, new T.MeshStandardMaterial({ color:sc('#7fb3b0'), transparent:true, opacity:.55, roughness:1 })); scene.add(m); ms.push(m); }); }
    const c = centerOf(it, xy); it.c = c; it.h = it.fs.reduce((a, f) => Math.max(a, f.top), 0);
    meshesOf.set(it, ms);
  });
  // סמן לתוכנית שנבחרה
  const ring = new T.Mesh(new T.RingGeometry(1, 1.035, 96), new T.MeshBasicMaterial({ color:0x111111, side:T.DoubleSide, transparent:true, opacity:.85 })); ring.rotation.x = -Math.PI/2; ring.position.y = 1; ring.visible = false; scene.add(ring);

  const cx = (minX+maxX)/2, cy = (minY+maxY)/2, span = Math.max(maxX-minX, maxY-minY);
  cam.position.set(cx + span*.2, span*.27, -cy + span*.36); ctl.target.set(cx, 0, -cy); ctl.update();

  /* שמש: ערך t רץ. כל יום מתקדם חודש */
  let t0 = performance.now(), paused = false, pauseAt = 0, lastLabel = '';
  const clock = () => { const s = ((paused ? pauseAt : performance.now()) - t0)/1000, day = Math.floor(s/DAY_S), f = (s % DAY_S)/DAY_S;
    const month = (11 + day) % 12, hour = H0 + f*(H1 - H0); return { month, hour }; };
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
  return { items, focus, home, thumb,
    pause(on){ if(on && !paused){ paused = true; pauseAt = performance.now(); } else if(!on && paused){ t0 += performance.now() - pauseAt; paused = false; } return paused; },
    get paused(){ return paused; }, setAuto(on){ ctl.autoRotate = on; },
    dispose(){ dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); ctl.dispose(); renderer.dispose(); if(thumbR) thumbR.dispose(); renderer.domElement.remove(); } };
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
/** מפת אשדוד באפור: Esri World Topo, רמה 14, אריחים על בד אחד */
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
    im.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${Y}/${X}`; }));
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
function stLabel(p){ const s = String(p.status || ''); return /הושלם/.test(s) ? 'אושרה' : /בטיפול|דחוף|בהמתנה/.test(s) ? 'בטיפול' : 'בהכנה'; }
function card(it, i){
  const p = it.p, img = it.render || it.thumb || '';
  return `<button class="cy-card" data-i="${i}" title="${H(p.planNum)}">
    <span class="cy-img">${img ? `<img src="${H(img)}" alt="" loading="lazy">` : ''}${it.render ? '<em>הדמיה</em>' : '<em>נפח לפי התב"ע</em>'}</span>
    <span class="cy-t"><b>${H(p.planNum)}</b> <small>${H(stLabel(p))}</small></span>
    <span class="cy-d">${H([p.district, p.location].filter(Boolean).join(', '))}</span></button>`;
}
async function open(){
  if(document.getElementById('cityIntro')) return;
  const ov = document.createElement('div'); ov.id = 'cityIntro'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'תוכניות הבינוי של אשדוד');
  ov.innerHTML = `<div class="cy-scene" id="cityScene"></div>
    <header class="cy-top"><div><h1>תוכניות הבינוי של אשדוד</h1><p id="citySub">טוען את העיר…</p></div>
      <div class="cy-acts"><span id="cityClock" class="cy-clock"></span><button class="cy-ghost" id="cityPause">עצירה</button><button class="cy-ghost" id="cityHome">כל העיר</button><button class="cy-go" id="cityEnter">כניסה למערכת</button></div></header>
    <div class="cy-legend">${[['residential','מגורים'],['mixed','מגורים ומסחר'],['commerce','מסחר'],['public','מבני ציבור']].map(([k, l]) => `<span><i style="background:${COL[k]}"></i>${l}</span>`).join('')}<span><i class="cy-flat"></i>מגרש בלי נפח</span><small>הנפחים לפי טבלה 5 והתשריט של כל תב"ע. הערכה, לא תוכנית הבינוי.</small></div>
    <div class="cy-strip" id="cityStrip"><div class="cy-track" id="cityTrack"></div></div>`;
  document.body.appendChild(ov); document.body.classList.add('city-open');
  ov.querySelector('#cityEnter').onclick = close;
  try{
    await window.PlanModel.loadThree();
    const D = await (await fetch('data/city.json?v=1124a')).json();
    st = build(ov.querySelector('#cityScene'), D);
  }catch(e){ console.warn('city', e); ov.querySelector('#citySub').textContent = 'ההדמיה לא נטענה. אפשר להיכנס למערכת.'; return; }
  const it = st.items, nv = it.filter(x => x.fs.length).length;
  ov.querySelector('#citySub').textContent = `${it.length} תוכניות על המפה, ${nv} עם נפחים. השמש עוברת מבוקר ללילה, ומחורף לקיץ.`;
  it.forEach(x => { if(!x.render) x.thumb = st.thumb(x); });
  const order = it.slice().sort((a, b) => (stLabel(a.p) === 'בטיפול' ? 0 : 1) - (stLabel(b.p) === 'בטיפול' ? 0 : 1) || String(a.p.planNum).localeCompare(String(b.p.planNum), 'he', { numeric:true }));
  const track = ov.querySelector('#cityTrack'), strip = ov.querySelector('#cityStrip');
  track.innerHTML = order.map(x => card(x, it.indexOf(x))).join('') + order.map(x => card(x, it.indexOf(x))).join('');   // פעמיים, לגלילה רציפה
  let sel = -1, hover = false, pos = 0, last = performance.now();
  const pick = i => { sel = i; st.focus(it[i]); st.setAuto(true); track.querySelectorAll('.cy-card').forEach(c => c.classList.toggle('on', +c.dataset.i === i));
    const p = it[i].p; let b = ov.querySelector('.cy-info'); if(!b){ b = document.createElement('div'); b.className = 'cy-info'; ov.appendChild(b); }
    b.innerHTML = `<div><b>${H(p.planNum)}</b> <small>${H(stLabel(p))}</small></div><div>${H([p.district, p.location].filter(Boolean).join(', '))}</div>
      <div class="muted">${it[i].fs.length ? `${it[i].fs.length} נפחים מתב"ע ${H(it[i].taba)}${it[i].scope === 'taba' ? ', כל התב"ע' : ''}, עד ${Math.round(it[i].h)} מ'` : 'בלי נפח במקור. המגרש בלבד'}</div>
      <button class="cy-go" data-enter="${p.id}">כניסה לתוכנית</button>`; };
  track.onclick = e => { const c = e.target.closest('.cy-card'); if(c) pick(+c.dataset.i); };
  ov.addEventListener('click', e => { const b = e.target.closest('[data-enter]'); if(!b) return; const id = +b.dataset.enter; close(); setTimeout(() => { try{ openProject(id); }catch(err){} }, 60); });
  strip.onmouseenter = () => { hover = true; }; strip.onmouseleave = () => { hover = false; last = performance.now(); };
  strip.addEventListener('wheel', e => { pos += e.deltaY || e.deltaX; e.preventDefault(); }, { passive:false });
  ov.querySelector('#cityPause').onclick = e => { const p = st.pause(!st.paused); e.target.textContent = p ? 'המשך' : 'עצירה'; };
  ov.querySelector('#cityHome').onclick = () => { sel = -1; st.home(); ov.querySelector('.cy-info')?.remove(); track.querySelectorAll('.cy-card.on').forEach(c => c.classList.remove('on')); };
  const roll = now => { if(!document.getElementById('cityIntro')) return; requestAnimationFrame(roll);
    const dt = now - last; last = now; if(!hover && !st.paused) pos += dt*.03;
    const half = track.scrollWidth/2; if(half > 0){ pos = ((pos % half) + half) % half; track.style.transform = `translateX(${-pos}px)`; } };
  requestAnimationFrame(roll);
  document.addEventListener('keydown', esc);
}
function esc(e){ if(e.key === 'Escape') close(); }
function close(){
  const ov = document.getElementById('cityIntro'); if(!ov) return;
  document.removeEventListener('keydown', esc);
  if(st){ st.dispose(); st = null; } ov.remove(); document.body.classList.remove('city-open');
  if(location.hash === '#city') history.replaceState(null, '', location.pathname + location.search);
}
window.openCity = open; window.closeCity = close;

function boot(){
  let skip = false; try{ skip = localStorage.getItem('ashdod_skip_city') === '1' || /[?&]nocity\b/.test(location.search); }catch(e){}
  const h = (location.hash || '').replace('#', '');
  if(h === 'city' || (!h && !skip)) setTimeout(open, 50);
  window.addEventListener('hashchange', () => { if(location.hash === '#city') open(); });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
