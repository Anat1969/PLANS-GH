/* ══════════════════════════════════════════════════════════════════
   plans-real.js: המחשה ראליסטית ליזם (ענת, 24.11.2026: "אנחנו לא משחקים בבובות. אני רוצה המחשה ראליסטית ליזם").
   נטען אחרי plans-model.js, ונבנה רק כשמדליקים "הדמיה" במצב תוכנית בינוי ועיצוב.
   1. חומרים: ריצוף, דשא ואספלט במרקם של 1024 פיקסלים עם מפת תבליט (normal map), מצוירים בקוד.
   2. קומת הקרקע: ויטרינות עם מסגרות, פס שילוט, ודלת כניסה עם גגון בכל סימן כניסה בשרטוט.
   3. עצים: גזע וענפים, וצמרת מאשכולות עלווה עם עלים נפרדים (alphaTest), בגוונים שונים.
   4. עמודי תאורה עירוניים, עם זרוע וראש לד.
   5. אנשים מפרקיים שהולכים על רשת השבילים (walk.json): רגליים וידיים בתנועה, בגדים ושיער בגוונים שונים. חלק עומדים.
   6. מכוניות: מרכב מעוגל, חלונות, גלגלים עם חישוקים ופנסים, בצבע מבריק (clearcoat).
   הכול להמחשה: הגיאומטריה של הפיתוח מהשרטוט, והמראה (חומרים, אנשים, מכוניות) אינו מהשרטוט.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const rnd = i => { const x = Math.sin(i*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };

/* ── מרקמים: צבע ותבליט מאותו ציור ── */
function canvas(n){ const c = document.createElement('canvas'); c.width = c.height = n; return c; }
/** מפת תבליט ממפת גובה (אפור): סובל, בקידוד של three */
function normalFrom(T, hc, k){
  const n = hc.width, src = hc.getContext('2d').getImageData(0, 0, n, n).data, out = canvas(n), og = out.getContext('2d'), im = og.createImageData(n, n), d = im.data;
  const H = (x, y) => src[(((y+n)%n)*n + ((x+n)%n))*4]/255;
  for(let y = 0; y < n; y++) for(let x = 0; x < n; x++){
    const dx = (H(x+1, y) - H(x-1, y))*k, dy = (H(x, y+1) - H(x, y-1))*k, l = Math.hypot(dx, dy, 1), i = (y*n + x)*4;
    d[i] = (-dx/l*.5 + .5)*255; d[i+1] = (dy/l*.5 + .5)*255; d[i+2] = (1/l*.5 + .5)*255; d[i+3] = 255; }
  og.putImageData(im, 0, 0); return out;
}
function wrapTex(T, c, meters, srgb){ const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1/meters, 1/meters); t.anisotropy = 8; if(srgb) t.encoding = T.sRGBEncoding; return t; }

function pavingTex(T){
  const n = 1024, c = canvas(n), g = c.getContext('2d'), h = canvas(n), hg = h.getContext('2d');
  g.fillStyle = '#8f877a'; g.fillRect(0, 0, n, n); hg.fillStyle = '#000'; hg.fillRect(0, 0, n, n);
  const rows = 12, cols = 6, sh = n/rows, sw = n/cols, j = 3;               // אבני 33 על 67 ס"מ בהנחה חצי־חצי, על 4 מ'
  for(let r = 0; r < rows; r++) for(let k = -1; k < cols; k++){
    const x = k*sw + (r%2)*sw/2, y = r*sh, v = rnd(r*31 + k*7);
    const base = [[214, 205, 188], [201, 194, 180], [222, 214, 198], [190, 184, 172], [208, 198, 178]][Math.floor(v*5)], f = .92 + rnd(r*5 + k*13)*.12;
    g.fillStyle = `rgb(${base[0]*f|0},${base[1]*f|0},${base[2]*f|0})`; g.fillRect(x + j, y + j, sw - 2*j, sh - 2*j);
    for(let q = 0; q < 140; q++){ const a = rnd(r*1000 + k*97 + q); g.fillStyle = `rgba(${a < .5 ? '90,80,66' : '255,250,240'},${.05 + rnd(q + r)*.08})`; g.fillRect(x + j + rnd(q*3 + k)*(sw-2*j), y + j + rnd(q*5 + r)*(sh-2*j), 1 + rnd(q)*3, 1 + rnd(q+1)*2); }
    const gr = hg.createLinearGradient(x, y, x, y + sh); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(1, '#cfcfcf');
    hg.fillStyle = gr; hg.fillRect(x + j + 1, y + j + 1, sw - 2*j - 2, sh - 2*j - 2); }
  // בלאי: כתמים כהים רכים
  for(let q = 0; q < 40; q++){ const x = rnd(q*9)*n, y = rnd(q*11)*n, r = 30 + rnd(q)*90, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(70,60,50,.07)'); rg.addColorStop(1, 'rgba(70,60,50,0)'); g.fillStyle = rg; g.fillRect(x-r, y-r, 2*r, 2*r); }
  return { map:wrapTex(T, c, 4, true), normal:wrapTex(T, normalFrom(T, h, 2.2), 4) };
}
function grassTex(T){
  const n = 1024, c = canvas(n), g = c.getContext('2d'), h = canvas(n), hg = h.getContext('2d');
  g.fillStyle = '#4f7a2c'; g.fillRect(0, 0, n, n); hg.fillStyle = '#777'; hg.fillRect(0, 0, n, n);
  for(let q = 0; q < 60; q++){ const x = rnd(q*3)*n, y = rnd(q*7)*n, r = 60 + rnd(q)*160, rg = g.createRadialGradient(x, y, 0, x, y, r), w = rnd(q*13) < .5;
    rg.addColorStop(0, w ? 'rgba(150,160,70,.18)' : 'rgba(30,70,20,.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x-r, y-r, 2*r, 2*r); }
  for(let q = 0; q < 26000; q++){ const x = rnd(q*1.3)*n, y = rnd(q*2.7)*n, L = 6 + rnd(q*5.1)*12, a = -Math.PI/2 + (rnd(q*7.7) - .5)*.9, v = rnd(q*9.3);
    g.strokeStyle = v < .33 ? 'rgba(48,92,26,.7)' : v < .66 ? 'rgba(92,136,46,.65)' : 'rgba(132,166,72,.55)'; g.lineWidth = 1 + rnd(q)*1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a)*L, y + Math.sin(a)*L); g.stroke();
    hg.strokeStyle = `rgba(255,255,255,${.25 + v*.4})`; hg.lineWidth = 1.4; hg.beginPath(); hg.moveTo(x, y); hg.lineTo(x + Math.cos(a)*L, y + Math.sin(a)*L); hg.stroke(); }
  return { map:wrapTex(T, c, 3, true), normal:wrapTex(T, normalFrom(T, h, 3), 3) };
}
function asphaltTex(T){
  const n = 1024, c = canvas(n), g = c.getContext('2d'), h = canvas(n), hg = h.getContext('2d');
  g.fillStyle = '#76777a'; g.fillRect(0, 0, n, n); hg.fillStyle = '#808080'; hg.fillRect(0, 0, n, n);
  for(let q = 0; q < 50000; q++){ const x = rnd(q*1.1)*n, y = rnd(q*3.3)*n, v = rnd(q*5.5), s = 1 + rnd(q*7.7)*2.2;
    g.fillStyle = v < .5 ? `rgba(35,35,38,${.12 + v*.3})` : `rgba(170,168,160,${(v - .5)*.5})`; g.fillRect(x, y, s, s);
    hg.fillStyle = v < .5 ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.5)'; hg.fillRect(x, y, s, s); }
  for(let q = 0; q < 30; q++){ const x = rnd(q*17)*n, y = rnd(q*19)*n, r = 40 + rnd(q)*140, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(0,0,0,.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x-r, y-r, 2*r, 2*r); }
  return { map:wrapTex(T, c, 5, true), normal:wrapTex(T, normalFrom(T, h, 1.4), 5) };
}
/** ויטרינה: מפתח של 3.6 מ' על 4 מ'. זכוכית כהה עם השתקפות, מחיצות, פס שילוט ובסיס אבן */
function shopTex(T){
  const W = 512, H = 568, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), px = H/4;   // 142 פיקסלים למטר
  g.fillStyle = '#e4ddcf'; g.fillRect(0, 0, W, H);
  const top = H - 3.35*px, bot = H - .15*px;                                  // זכוכית מ-15 ס"מ עד 3.35 מ'
  const gl = g.createLinearGradient(0, top, 0, bot); gl.addColorStop(0, '#5b7487'); gl.addColorStop(.35, '#2f4252'); gl.addColorStop(1, '#22313c'); g.fillStyle = gl; g.fillRect(8, top, W-16, bot-top);
  // פנים החנות: תאורה חמה ומדפים מטושטשים
  const wg = g.createRadialGradient(W/2, top + 40, 10, W/2, top + 40, 260); wg.addColorStop(0, 'rgba(255,214,150,.45)'); wg.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = wg; g.fillRect(8, top, W-16, bot-top);
  for(let q = 0; q < 9; q++){ g.fillStyle = `rgba(${200 + rnd(q)*55|0},${170 + rnd(q+1)*60|0},${130 + rnd(q+2)*80|0},.18)`; g.fillRect(30 + rnd(q+3)*(W-120), top + 120 + rnd(q+4)*(bot-top-180), 40 + rnd(q+5)*80, 30 + rnd(q+6)*90); }
  // השתקפות שמיים באלכסון
  g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(40, top); g.lineTo(220, top); g.lineTo(90, bot); g.lineTo(8, bot); g.closePath(); g.fill();
  // מסגרות
  g.fillStyle = '#2b2d30'; g.fillRect(0, top-6, W, 10); g.fillRect(0, top, 10, bot-top); g.fillRect(W-10, top, 10, bot-top); g.fillRect(W/2-4, top, 8, bot-top); g.fillRect(0, top + .55*px, W, 6);
  g.fillRect(0, bot-4, W, 8);
  // פס השילוט ובסיס האבן
  g.fillStyle = '#cfc6b3'; g.fillRect(0, 0, W, top-6); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, top-14, W, 8); g.fillStyle = '#b9b0a0'; g.fillRect(0, bot+4, W, H-bot);
  const t = new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; t.wrapT = T.ClampToEdgeWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
}
function barkTex(T){ const c = canvas(256), g = c.getContext('2d'); g.fillStyle = '#5a4634'; g.fillRect(0, 0, 256, 256);
  for(let q = 0; q < 900; q++){ g.fillStyle = `rgba(${rnd(q) < .5 ? '30,22,15' : '140,120,95'},${.2 + rnd(q+1)*.3})`; g.fillRect(rnd(q*3)*256, rnd(q*5)*256, 1 + rnd(q*7)*3, 6 + rnd(q*9)*30); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2, 3); t.encoding = T.sRGBEncoding; return t; }
/** עלווה: אלפי עלים קטנים על רקע שקוף. הצורה הלא סדורה של האשכול נוצרת מהחורים (alphaTest) */
function leafTex(T){
  const n = 512, c = canvas(n), g = c.getContext('2d');
  for(let q = 0; q < 2600; q++){ const x = rnd(q*1.7)*n, y = rnd(q*2.9)*n, r = 5 + rnd(q*3.1)*7, a = rnd(q*4.3)*Math.PI, v = rnd(q*5.9);
    g.fillStyle = v < .3 ? '#2f5a22' : v < .6 ? '#3f7330' : v < .85 ? '#5b8c3a' : '#86ad55';
    g.beginPath(); g.ellipse(x, y, r, r*.45, a, 0, Math.PI*2); g.fill(); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2, 2); t.encoding = T.sRGBEncoding; return t; }

/* ── גאומטריות ── */
/** אשכול עלווה: כדור מעוות ברעש, כך שאין שני אשכולות זהים במבט */
function blobGeo(T, seed){
  const g = new T.IcosahedronGeometry(1, 3), p = g.attributes.position, v = new T.Vector3();
  for(let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const k = 1 + .18*Math.sin(v.x*4.1 + seed) * Math.cos(v.y*3.7 - seed) + .1*Math.sin(v.z*7.3 + seed*2); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y*.82, v.z); }
  g.computeVertexNormals(); return g;
}
/** מכונית: גוף תחתון (פרופיל צד מוחלץ לרוחב, עם פינות מעוגלות), תא זכוכית צר יותר מעליו, וגג. y למעלה, אורך לאורך x */
const CAR = {
  sedan:{ body:[[-2.25, .3], [2.25, .3], [2.28, .66], [2.0, .84], [.9, .94], [-1.75, .98], [-2.25, .9]], cab:[[.9, .92], [.2, 1.38], [-1.0, 1.4], [-1.78, .96]], roof:[-.42, 1.41, 1.15], L:2.25 },
  suv:{ body:[[-2.3, .34], [2.3, .34], [2.33, .78], [2.02, 1.0], [.95, 1.08], [-2.22, 1.12], [-2.3, 1.0]], cab:[[.96, 1.06], [.5, 1.66], [-2.02, 1.68], [-2.18, 1.1]], roof:[-.78, 1.69, 2.5], L:2.3 } };
function prof(T, P, depth, bev){ const s = new T.Shape(); s.moveTo(P[0][0], P[0][1]); for(let i = 1; i < P.length; i++) s.lineTo(P[i][0], P[i][1]); s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled:bev > 0, bevelThickness:bev, bevelSize:bev, bevelSegments:3, steps:1 }); g.translate(0, 0, -depth/2); g.computeVertexNormals(); return g; }

function build(ctx){
  const { T, scene, model, groups, hAt, graph } = ctx, sc = h => new T.Color(h).convertSRGBToLinear();
  const root = new T.Group(); root.name = 'real'; scene.add(root);
  const O = model.obj || {}, S = model.surf || {}, dummy = new T.Object3D(), m4 = new T.Matrix4(), q4 = new T.Quaternion(), v3 = new T.Vector3(), s3 = new T.Vector3(), e3 = new T.Euler();
  const inst = (geo, mat, n, o) => { const m = new T.InstancedMesh(geo, mat, n); m.castShadow = !o || o.cast !== false; m.receiveShadow = true; m.frustumCulled = false; root.add(m); return m; };

  /* 1. חומרים: מחליפים את המרקם של המשטחים. הצבע מהמרקם, בלי הגוון של סוג המשטח */
  const PV = pavingTex(T), GR = grassTex(T), AS = asphaltTex(T);
  const setMat = (kind, tx, rough, nscale) => { const g = groups[kind]; if(!g) return; g.traverse(x => { if(!x.isMesh) return; const m = x.userData.mat || x.material; if(!m || !m.isMeshStandardMaterial) return;
      m.map = tx.map; m.normalMap = tx.normal; m.normalScale = new T.Vector2(nscale, nscale); m.vertexColors = false; m.color.set('#ffffff'); m.roughness = rough; m.envMapIntensity = .35; m.needsUpdate = true; }); };
  ['asphalt', 'brt', 'ramp', 'bike'].forEach(k => setMat(k, AS, .93, .5)); ['paving', 'plaza', 'yard', 'deck'].forEach(k => setMat(k, PV, .78, .9)); setMat('green', GR, 1, .8);

  /* 2. קומת הקרקע: ויטרינות, פס שילוט ודלתות (רק במודל מתוכנית העמדה, שבו קומת הקרקע היא מתאר המבנה) */
  const doors = [];
  // במודל מהשרטוט הווקטורי (model.vector) surf.wall הוא קירות דקים, ולכן הוויטרינה נבנית על מתאר המבנה (model.foot)
  const WALLS = model.vector && (model.foot||[]).length ? model.foot.map(f => [null, f]) : S.wall;
  if(model.parts && WALLS){
    const shop = new T.MeshStandardMaterial({ map:shopTex(T), roughness:.32, metalness:.25, envMapIntensity:1.1, side:T.DoubleSide });
    const pos = [], uv = [], rings = [];
    WALLS.forEach(([, flat]) => { const r = []; for(let i = 0; i < flat.length; i += 2) r.push([flat[i]/10, flat[i+1]/10]); let A = 0; r.forEach((a, i) => { const b = r[(i+1)%r.length]; A += a[0]*b[1]-b[0]*a[1]; }); if(A < 0) r.reverse(); rings.push(r);
      let u = 0; r.forEach((a, i) => { const b = r[(i+1)%r.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]), u1 = u + L/3.6, h0 = hAt(a[0]-.0, a[1]), H = 4;
        const ox = (b[1]-a[1])/(L||1)*.02, oy = -(b[0]-a[0])/(L||1)*.02, ha = hAt(a[0]-ox*50, a[1]-oy*50), hb = hAt(b[0]-ox*50, b[1]-oy*50);   // גובה הרצפה: מבפנים
        pos.push(a[0]+ox, ha, -(a[1]+oy), b[0]+ox, hb, -(b[1]+oy), b[0]+ox, hb+H, -(b[1]+oy), a[0]+ox, ha, -(a[1]+oy), b[0]+ox, hb+H, -(b[1]+oy), a[0]+ox, ha+H, -(a[1]+oy));
        uv.push(u, 0, u1, 0, u1, 1, u, 0, u1, 1, u, 1); u = u1; }); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const shopMesh = new T.Mesh(g, shop); shopMesh.castShadow = shopMesh.receiveShadow = true; root.add(shopMesh);
    // דלת בכל סימן כניסה: על צלע המבנה הקרובה (עד 5 מ'), עם גגון
    (O.entry || []).forEach(p => { let best = null;
      rings.forEach(r => r.forEach((a, i) => { const b = r[(i+1)%r.length], vx = b[0]-a[0], vy = b[1]-a[1], l = vx*vx+vy*vy || 1e-9, t = Math.max(.08, Math.min(.92, ((p[0]-a[0])*vx+(p[1]-a[1])*vy)/l)), x = a[0]+t*vx, y = a[1]+t*vy, d = Math.hypot(p[0]-x, p[1]-y);
        if(L2(vx, vy) > 3 && (!best || d < best.d)) best = { d, x, y, ang:Math.atan2(vy, vx), nx:vy/Math.sqrt(l), ny:-vx/Math.sqrt(l) }; }));
      if(best && best.d < 5 && !doors.some(q => Math.hypot(q.x-best.x, q.y-best.y) < 4)) doors.push(Object.assign(best, { h:hAt(best.x - best.nx*.6, best.y - best.ny*.6) })); });
    const frameM = new T.MeshStandardMaterial({ color:sc('#2a2c2f'), roughness:.4, metalness:.6 }), dGlass = new T.MeshStandardMaterial({ color:sc('#1d2a33'), roughness:.05, metalness:.85, envMapIntensity:1.6 }), canM = new T.MeshStandardMaterial({ color:sc('#efece6'), roughness:.55 });
    const putD = (geo, mat, f) => { const m = inst(geo, mat, doors.length); doors.forEach((d, i) => { dummy.position.set(d.x + d.nx*.06, d.h, -(d.y + d.ny*.06)); dummy.rotation.set(0, d.ang, 0); dummy.scale.set(1, 1, 1); f(dummy, d); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); };
    if(doors.length){
      putD(new T.BoxGeometry(2.3, 2.75, .16), frameM, o => o.translateY(1.375));
      putD(new T.BoxGeometry(2.0, 2.55, .18), dGlass, o => o.translateY(1.3));
      putD(new T.BoxGeometry(.05, 2.5, .22), frameM, o => o.translateY(1.3));
      putD(new T.BoxGeometry(3.4, .16, 1.7), canM, o => { o.translateY(3.15); o.translateZ(.8); });         // גגון מעל הכניסה
      putD(new T.BoxGeometry(1.2, .05, .9), new T.MeshStandardMaterial({ color:'#fff4d6', emissive:'#fff1cc', emissiveIntensity:.6 }), o => { o.translateY(3.06); o.translateZ(.8); }); }
  }
  function L2(x, y){ return Math.hypot(x, y); }

  /* 3. עצים */
  const treesAll = [].concat(O.treeNew || [], O.treeOld || [], O.exTree || []);
  if(treesAll.length){
    const bark = new T.MeshStandardMaterial({ map:barkTex(T), roughness:.95, color:'#ffffff' }), leaf = leafTex(T);
    const leafM = new T.MeshStandardMaterial({ map:leaf, alphaTest:.5, side:T.DoubleSide, roughness:.82, color:'#ffffff' });
    const innerM = new T.MeshStandardMaterial({ color:sc('#2c4a22'), roughness:1 });      // ליבה כהה: אין "חורים" דרך כל העץ
    const BL = [blobGeo(T, 1.3), blobGeo(T, 4.1), blobGeo(T, 7.7)], trunk = new T.CylinderGeometry(.11, .19, 1, 9); trunk.translate(0, .5, 0);
    const br = new T.CylinderGeometry(.04, .08, 1, 6); br.translate(0, .5, 0);
    const Tn = treesAll.length, tr = inst(trunk, bark, Tn), brM = inst(br, bark, Tn*3), K = 7;
    const cl = BL.map(geo => inst(geo, leafM, Tn*K)), core = inst(new T.IcosahedronGeometry(1, 1), innerM, Tn), col = new T.Color(), cnt = [0, 0, 0];
    treesAll.forEach((t, i) => { const R = Math.max(1.4, Math.min(4.5, t[2] || 2.5)), hT = 2.2 + R*.55, x = t[0], y = t[1], h = hAt(x, y), lean = (rnd(i*3)-.5)*.08;
      dummy.position.set(x, h, -y); dummy.rotation.set(lean, rnd(i)*6, lean*.5); dummy.scale.set(1 + R*.12, hT + R*.4, 1 + R*.12); dummy.updateMatrix(); tr.setMatrixAt(i, dummy.matrix);
      for(let b = 0; b < 3; b++){ const a = rnd(i*7 + b)*6.28; dummy.position.set(x, h + hT*.8, -y); dummy.rotation.set(Math.cos(a)*.75, 0, Math.sin(a)*.75); dummy.scale.set(1, R*.9, 1); dummy.updateMatrix(); brM.setMatrixAt(i*3+b, dummy.matrix); }
      dummy.position.set(x, h + hT + R*.55, -y); dummy.rotation.set(0, 0, 0); dummy.scale.set(R*.72, R*.62, R*.72); dummy.updateMatrix(); core.setMatrixAt(i, dummy.matrix);
      for(let k = 0; k < K; k++){ const a = k/K*6.28 + rnd(i+k)*.8, rr = k === 0 ? 0 : R*(.45 + rnd(i*k+1)*.25), s = R*(k === 0 ? .78 : .5 + rnd(i*11+k)*.18), which = (i + k) % 3, j = cnt[which]++;
        dummy.position.set(x + Math.cos(a)*rr, h + hT + R*(k === 0 ? .95 : .35 + rnd(i*5+k)*.5), -(y + Math.sin(a)*rr)); dummy.rotation.set(rnd(k)*3, rnd(i+k*3)*6, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
        cl[which].setMatrixAt(j, dummy.matrix); col.setHSL(.24 + (rnd(i*13+k)-.5)*.05, .38 + rnd(i)*.15, .40 + (rnd(i*17+k)-.5)*.12); cl[which].setColorAt(j, col); } });
    cl.forEach((m, w) => { m.count = cnt[w]; if(m.instanceColor) m.instanceColor.needsUpdate = true; });
  }

  /* 4. עמודי תאורה */
  const lamps = O.lamp || [];
  if(lamps.length){ const pole = new T.MeshStandardMaterial({ color:sc('#3a3d41'), roughness:.45, metalness:.65 }), led = new T.MeshStandardMaterial({ color:'#f5f2ea', emissive:'#fff6dd', emissiveIntensity:.25 });
    const put = (geo, mat, f) => { const m = inst(geo, mat, lamps.length); lamps.forEach((l, i) => { const h = hAt(l[0], l[1]); dummy.position.set(l[0], h, -l[1]); dummy.rotation.set(0, rnd(i)*6.28, 0); dummy.scale.set(1, 1, 1); f(dummy, i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); };
    put(new T.CylinderGeometry(.06, .11, 6, 10), pole, o => o.translateY(3)); put(new T.CylinderGeometry(.16, .2, .5, 10), pole, o => o.translateY(.25));
    put(new T.BoxGeometry(1.4, .07, .08), pole, o => { o.translateY(5.95); o.translateX(.65); }); put(new T.BoxGeometry(.62, .1, .26), pole, o => { o.translateY(5.92); o.translateX(1.32); });
    put(new T.BoxGeometry(.54, .02, .2), led, o => { o.translateY(5.86); o.translateX(1.32); }); }

  /* 5. אנשים: מפרקיים, בתנועה על רשת השבילים */
  const WD = ctx.walkData(), people = [];
  const G = WD && WD.people && WD.people.length ? graph() : null;
  if(G){
    const nearestEdge = (x, y) => { let b = null; G.E.forEach(e => { for(let k = 1; k < e.p.length; k++){ const a = e.p[k-1], q = e.p[k], vx = q[0]-a[0], vy = q[1]-a[1], l = vx*vx+vy*vy || 1e-9, t = Math.max(0, Math.min(1, ((x-a[0])*vx+(y-a[1])*vy)/l)), d = Math.hypot(x-a[0]-t*vx, y-a[1]-t*vy);
      if(!b || d < b.d) b = { e:e.i, s:e.c[k-1] + t*Math.sqrt(l), d }; } }); return b; };
    WD.people.forEach((p, i) => { const x = p[0]/10, y = p[1]/10, ne = nearestEdge(x, y), walk = rnd(i*3) < .72;
      people.push({ e:ne ? ne.e : 0, s:ne ? ne.s : 0, dir:rnd(i*5) < .5 ? 1 : -1, v:walk ? 1.05 + rnd(i*7)*.45 : 0, ph:rnd(i*9)*6.28, side:(rnd(i*11)-.5)*1.1, x, y, yaw:p[2] || 0, sc:.92 + rnd(i*13)*.16, fem:rnd(i*17) < .5 }); });
    const n = people.length, skin = ['#f1c9a5', '#d9a77f', '#a8714f', '#6e4a34', '#e8b896'], tops = ['#2f4a6d', '#b8483b', '#e9e4d8', '#3e6b4a', '#c99a3a', '#6b5b8e', '#f4f4f0', '#262626', '#8a5a44', '#4f8fbf', '#7d2e46', '#cfd6dd'], pants = ['#1e2633', '#3b3b3f', '#5a4a3a', '#2b3d5a', '#c9c2b3', '#6f6a60'], hair = ['#1b1410', '#3a2618', '#6b4a2a', '#b08a52', '#8c8c8c'];
    const cloth = new T.MeshStandardMaterial({ color:'#ffffff', roughness:.88 }), skinM = new T.MeshStandardMaterial({ color:'#ffffff', roughness:.6 }), hairM = new T.MeshStandardMaterial({ color:'#ffffff', roughness:.7 }), shoeM = new T.MeshStandardMaterial({ color:sc('#1c1c1e'), roughness:.5 });
    const cap = (r, h, seg) => { const g = new T.CylinderGeometry(r, r*.92, h, seg || 10); return g; };
    const leg = cap(.075, .86); leg.translate(0, -.43, 0); const arm = cap(.048, .62, 8); arm.translate(0, -.31, 0);
    const torso = new T.CylinderGeometry(.17, .14, .62, 12); torso.scale(1, 1, .62); const hips = new T.CylinderGeometry(.155, .17, .2, 12); hips.scale(1, 1, .7);
    const head = new T.SphereGeometry(.105, 16, 12); head.scale(.92, 1.12, 1); const hairG = new T.SphereGeometry(.112, 14, 10, 0, Math.PI*2, 0, Math.PI*.55); hairG.scale(.95, 1.1, 1.04);
    const shoe = new T.BoxGeometry(.1, .07, .26); shoe.translate(0, -.86, .05); const hand = new T.SphereGeometry(.045, 8, 6); hand.translate(0, -.64, 0);
    const P = { legL:inst(leg, cloth, n), legR:inst(leg, cloth, n), shoeL:inst(shoe, shoeM, n), shoeR:inst(shoe, shoeM, n), hips:inst(hips, cloth, n), torso:inst(torso, cloth, n),
      armL:inst(arm, cloth, n), armR:inst(arm, cloth, n), handL:inst(hand, skinM, n), handR:inst(hand, skinM, n), head:inst(head, skinM, n), hair:inst(hairG, hairM, n) };
    const c = new T.Color(), setC = (m, i, hex) => m.setColorAt(i, c.set(hex).convertSRGBToLinear());
    people.forEach((p, i) => { const sk = skin[Math.floor(rnd(i*19)*skin.length)], tp = tops[Math.floor(rnd(i*23)*tops.length)], pt = pants[Math.floor(rnd(i*29)*pants.length)], hr = hair[Math.floor(rnd(i*31)*hair.length)];
      setC(P.legL, i, pt); setC(P.legR, i, pt); setC(P.hips, i, pt); setC(P.torso, i, tp); setC(P.armL, i, rnd(i*37) < .45 ? sk : tp); setC(P.armR, i, rnd(i*37) < .45 ? sk : tp);
      setC(P.handL, i, sk); setC(P.handR, i, sk); setC(P.head, i, sk); setC(P.hair, i, hr); });
    Object.values(P).forEach(m => { if(m.instanceColor) m.instanceColor.needsUpdate = true; });
    const at = (e, s) => { s = Math.max(0, Math.min(e.L, s)); let k = 1; while(k < e.c.length-1 && e.c[k] < s) k++; const t = (s - e.c[k-1])/((e.c[k]-e.c[k-1]) || 1), a = e.p[k-1], b = e.p[k]; return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, Math.atan2(b[1]-a[1], b[0]-a[0])]; };
    const base = new T.Matrix4(), loc = new T.Matrix4(), tmp = new T.Matrix4();
    const put = (m, i, ox, oy, oz, rx, s) => { loc.makeRotationX(rx || 0); loc.setPosition(ox, oy, oz); tmp.multiplyMatrices(base, loc); if(s !== undefined) tmp.scale(v3.set(s, s, s)); m.setMatrixAt(i, tmp); };
    ctx.stepLife = (dt, camX, camY, walking) => {
      people.forEach((p, i) => {
        if(p.v){ const e = G.E[p.e]; p.s += p.dir*p.v*dt;
          if(p.s > e.L || p.s < 0){ const node = p.s > e.L ? e.b : e.a, nx = G.adj[node].filter(o => o.e !== p.e), o = nx.length ? nx[Math.floor(rnd(i + p.s*13 + p.ph)*nx.length)] : { e:p.e, dir:-p.dir };
            p.e = o.e; p.dir = o.dir; p.s = o.dir > 0 ? 0 : G.E[o.e].L; }
          const q = at(G.E[p.e], p.s), ang = q[2] + (p.dir < 0 ? Math.PI : 0); p.yaw += (((ang - p.yaw + Math.PI*3) % (Math.PI*2)) - Math.PI)*Math.min(1, dt*6);
          p.x = q[0] - Math.sin(ang)*p.side; p.y = q[1] + Math.cos(ang)*p.side; p.ph += dt*p.v*5.4; }
        else p.ph += dt*.8;
        const hide = walking && Math.hypot(p.x - camX, p.y - camY) < 1.6, s = hide ? 0.0001 : p.sc, sw = p.v ? Math.sin(p.ph)*.5 : Math.sin(p.ph)*.02, bob = p.v ? Math.abs(Math.cos(p.ph))*.035 : 0;
        q4.setFromEuler(e3.set(0, p.yaw + Math.PI/2, 0)); base.compose(v3.set(p.x, hAt(p.x, p.y) + bob*s, -p.y), q4, s3.set(s, s, s));
        put(P.legL, i, -.085, .9, 0, sw); put(P.legR, i, .085, .9, 0, -sw); put(P.shoeL, i, -.085, .9, 0, sw); put(P.shoeR, i, .085, .9, 0, -sw);
        put(P.hips, i, 0, .95, 0); put(P.torso, i, 0, 1.33, 0); put(P.armL, i, -.215, 1.6, 0, -sw*.75); put(P.armR, i, .215, 1.6, 0, sw*.75);
        put(P.handL, i, -.215, 1.6, 0, -sw*.75); put(P.handR, i, .215, 1.6, 0, sw*.75); put(P.head, i, 0, 1.78, .01); put(P.hair, i, 0, 1.8, -.005); });
      Object.values(P).forEach(m => { m.instanceMatrix.needsUpdate = true; });
    };
    ctx.stepLife(0, 1e9, 1e9, false);
  }

  /* 6. מכוניות */
  const C = WD && WD.cars || [];
  if(C.length){
    const paint = new T.MeshStandardMaterial({ color:'#ffffff', roughness:.22, metalness:.6, envMapIntensity:1.5 });   // צבע מבריק. MeshPhysical (clearcoat) נכשל בגרסה המקומית של three
    const glass = new T.MeshStandardMaterial({ color:sc('#0f171d'), roughness:.04, metalness:.9, envMapIntensity:1.6 }), tire = new T.MeshStandardMaterial({ color:sc('#151515'), roughness:.85 }), rim = new T.MeshStandardMaterial({ color:sc('#7d8186'), roughness:.3, metalness:.8, envMapIntensity:.6 });
    const headM = new T.MeshStandardMaterial({ color:'#f6f6f2', emissive:'#ffffff', emissiveIntensity:.15, roughness:.1 }), tailM = new T.MeshStandardMaterial({ color:sc('#8e1010'), emissive:'#a01010', emissiveIntensity:.3, roughness:.2 });
    const cols = ['#f4f4f2', '#c9ccd1', '#1d1f22', '#5c6168', '#26365a', '#9b2b2b', '#e8e6df', '#3d4a3f', '#8a8f95', '#0f1012'];
    const kinds = [0, 1].map(suv => C.map((c, i) => ({ c, i })).filter(o => (rnd(o.i*7) < .3 ? 1 : 0) === suv));
    kinds.forEach((list, suv) => { if(!list.length) return; const n = list.length, D = suv ? CAR.suv : CAR.sedan;
      const body = inst(prof(T, D.body, 1.64, .08), paint, n), gl = inst(prof(T, D.cab, 1.46, .05), glass, n), roof = inst(new T.BoxGeometry(D.roof[2], .06, 1.4), paint, n);
      const hl = inst(new T.BoxGeometry(.08, .12, .38), headM, n*2), tl = inst(new T.BoxGeometry(.06, .12, .42), tailM, n*2);
      const tyre = new T.CylinderGeometry(.33, .33, .22, 18); tyre.rotateX(Math.PI/2); const rimG = new T.CylinderGeometry(.21, .21, .235, 12); rimG.rotateX(Math.PI/2);
      const ty = inst(tyre, tire, n*4), rm = inst(rimG, rim, n*4), col = new T.Color();
      list.forEach(({ c, i }, j) => { const x = c[0]/10, y = c[1]/10, a = c[2], h = hAt(x, y);
        dummy.position.set(x, h, -y); dummy.rotation.set(0, a, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); const M0 = dummy.matrix.clone();
        body.setMatrixAt(j, M0); gl.setMatrixAt(j, M0); loc(M0, D.roof[0], D.roof[1], 0, roof, j);
        col.set(cols[Math.floor(rnd(i*3)*cols.length)]).convertSRGBToLinear(); body.setColorAt(j, col); roof.setColorAt(j, col);
        [-1, 1].forEach((sd, k) => { loc(M0, D.L + .06, suv ? .82 : .7, sd*.6, hl, j*2+k); loc(M0, -D.L - .05, suv ? .9 : .78, sd*.62, tl, j*2+k); });
        [[1.42, .86], [1.42, -.86], [-1.38, .86], [-1.38, -.86]].forEach(([wx, wz], k) => { loc(M0, wx, .33, wz, ty, j*4+k); loc(M0, wx, .33, wz*1.005, rm, j*4+k); }); });
      [body, roof].forEach(m => { if(m.instanceColor) m.instanceColor.needsUpdate = true; }); });
    function loc(M0, x, y, z, m, i){ m4.makeTranslation(x, y, z); m4.premultiply(M0); m.setMatrixAt(i, m4); }
  }

  /* 7. רצף המרחב הציבורי (ענת, 24.11.2026: "החיבורים של הכבישים, המדרכות, רצף", "המפגש של הבניינים עם הקרקע") */
  const fin = new T.Group(); fin.name = 'finish'; root.add(fin);
  const ringsOf = list => (list || []).map(([, flat]) => { const r = []; for(let i = 0; i < flat.length; i += 2) r.push([flat[i]/10, flat[i+1]/10]); return r; });
  /** קצוות חיצוניים בלבד: צלע שמופיעה בשני משטחים היא תפר בתוך אותו משטח, לא שפה */
  const outerEdges = rings => { const m = new Map(), k = (a, b) => (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])) ? a.join() + '|' + b.join() : b.join() + '|' + a.join();
    rings.forEach(r => r.forEach((a, i) => { const b = r[(i+1)%r.length], kk = k(a, b), e = m.get(kk); if(e) e.c++; else m.set(kk, { a, b, c:1 }); })); return [...m.values()].filter(e => e.c === 1 && Math.hypot(e.b[0]-e.a[0], e.b[1]-e.a[1]) > .3); };
  const stoneM = new T.MeshStandardMaterial({ color:sc('#bdb8ae'), map:PV.map, roughness:.7 }), edgeM = new T.MeshStandardMaterial({ color:sc('#a9a59c'), roughness:.75 });
  const strip = (edges, w, h, mat, y0) => { if(!edges.length) return; const m = inst(new T.BoxGeometry(1, 1, 1), mat, edges.length);
    edges.forEach((e, i) => { const L = Math.hypot(e.b[0]-e.a[0], e.b[1]-e.a[1]), mx = (e.a[0]+e.b[0])/2, my = (e.a[1]+e.b[1])/2;
      dummy.position.set(mx, hAt(mx, my) + (y0 || 0) + h/2, -my); dummy.rotation.set(0, Math.atan2(e.b[1]-e.a[1], e.b[0]-e.a[0]), 0); dummy.scale.set(L + .02, h, w); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); fin.add(m); return m; };
  // אבן שפה לאורך כל קצה של כביש: 20 ס"מ רוחב, 15 ס"מ גובה. ואבן גן נמוכה סביב הגינון
  strip(outerEdges(ringsOf(S.asphalt)), .2, .15, stoneM);
  strip(outerEdges(ringsOf(S.green)), .1, .1, edgeM);
  // צל מגע: רצועה כהה ורכה סביב כל מבנה, מהקיר החוצה (במקום צל סביבתי, שבכרטיס מסך חלש יצר הילות)
  const feet = (model.foot || []).map(f => { const r = []; for(let i = 0; i < f.length; i += 2) r.push([f[i]/10, f[i+1]/10]); return r; });
  { const pos = [], col = [], W = 1.6;
    feet.forEach(r => { let A = 0; r.forEach((a, i) => { const b = r[(i+1)%r.length]; A += a[0]*b[1]-b[0]*a[1]; }); const sg = A > 0 ? 1 : -1;
      r.forEach((a, i) => { const b = r[(i+1)%r.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]); if(L < .2) return; const ox = (b[1]-a[1])/L*sg*W, oy = -(b[0]-a[0])/L*sg*W;
        const P = [[a[0], a[1], .42], [b[0], b[1], .42], [b[0]+ox, b[1]+oy, 0], [a[0]+ox, a[1]+oy, 0]];
        [0, 1, 2, 0, 2, 3].forEach(j => { const q = P[j]; pos.push(q[0], hAt(q[0] - ox*.3, q[1] - oy*.3) + .075, -q[1]); col.push(0, 0, 0, q[2]); }); }); });
    if(pos.length){ const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 4));
      const ao = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors:true, transparent:true, depthWrite:false, side:T.DoubleSide, polygonOffset:true, polygonOffsetFactor:-2 })); ao.renderOrder = 2; fin.add(ao); } }
  // צל רך מתחת לכל עץ: כתם מעגלי, כדי שהעץ "יושב" על הקרקע גם כשהשמש גבוהה
  if(treesAll.length){ const c = canvas(128), g = c.getContext('2d'), rg = g.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(0,0,0,.42)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    const pl = new T.PlaneGeometry(1, 1); pl.rotateX(-Math.PI/2); const m = inst(pl, new T.MeshBasicMaterial({ map:new T.CanvasTexture(c), transparent:true, depthWrite:false }), treesAll.length, { cast:false });
    treesAll.forEach((t, i) => { const R = Math.max(1.4, Math.min(4.5, t[2] || 2.5))*2.1; dummy.position.set(t[0], hAt(t[0], t[1]) + .08, -t[1]); dummy.rotation.set(0, 0, 0); dummy.scale.set(R, 1, R); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); m.renderOrder = 2; }
  // רמפות: אספלט על הרצפה ובטון חשוף בקירות. מדרגות: אבן, כדי ששינוי המפלס ייקרא
  const conc = (() => { const c = canvas(256), g = c.getContext('2d'); g.fillStyle = '#b9b5ad'; g.fillRect(0, 0, 256, 256); for(let q = 0; q < 5000; q++){ g.fillStyle = `rgba(${rnd(q) < .5 ? '80,78,72' : '235,232,225'},${.05 + rnd(q+3)*.1})`; g.fillRect(rnd(q*3)*256, rnd(q*7)*256, 2, 2); }
    g.strokeStyle = 'rgba(70,68,62,.35)'; g.lineWidth = 2; for(let i = 0; i <= 2; i++){ g.beginPath(); g.moveTo(0, i*128); g.lineTo(256, i*128); g.stroke(); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1/2.4, 1/1.2); t.encoding = T.sRGBEncoding; return t; })();
  const roleMat = { rampFloor:{ map:AS.map, normalMap:AS.normal, color:'#8a8b8e', roughness:.9 }, rampWall:{ map:conc, color:'#ffffff', roughness:.85 }, rampCap:{ map:conc, color:'#e6e2da', roughness:.8 }, stairs:{ map:PV.map, normalMap:PV.normal, color:'#f2ede2', roughness:.75 } };
  scene.traverse(x => { const m = x.isMesh && (x.userData.mat || x.material); const r = m && m.userData && roleMat[m.userData.role]; if(!r || !m.isMeshStandardMaterial) return;
    Object.assign(m, { map:r.map, normalMap:r.normalMap || null, roughness:r.roughness }); m.color.set(r.color); if(r.map !== AS.map) m.color.convertSRGBToLinear(); m.needsUpdate = true; });
  // רצף הקרקע: מה שלא מרוצף בשרטוט (חלל בין משטחים, שולי התוכנית) נראה כאבן בהירה ולא כלבן ריק
  const gm = ctx.ground && ctx.ground.material, saved = gm ? { map:gm.map, color:gm.color.clone(), normalMap:gm.normalMap } : null;
  const terr = ctx.terrain && ctx.terrain(), tsaved = terr ? { map:terr.material.map, color:terr.material.color.clone() } : null;
  const groundTex = PV.map.clone(); groundTex.needsUpdate = true; groundTex.repeat.set(1/4, 1/4);
  // uv במטרים לקרקע ולפני השטח (למישור של 2,400 מ' ה-uv הוא 0 עד 1, ולכן המרקם נמתח עד שלא נראה)
  [ctx.ground && ctx.ground.geometry, terr && terr.geometry].forEach(g => { if(!g || g.userData.uvM) return; const p = g.attributes.position, uv = new Float32Array(p.count*2), wl = new T.Vector3(), o = g === (ctx.ground && ctx.ground.geometry) ? ctx.ground : terr;
    o.updateMatrixWorld(true); for(let i = 0; i < p.count; i++){ wl.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); uv[2*i] = wl.x; uv[2*i+1] = -wl.z; } g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.userData.uvM = true; });
  // תאורה: שמיים קרירים מלמעלה ואור חם שמוחזר מהקרקע, ושמש מעט חזקה וחמה. הצל קשה יותר, ולכן שינויי המפלס נקראים
  const L0 = ctx.hemi ? { hs:ctx.hemi.color.clone(), hg:ctx.hemi.groundColor.clone(), hi:ctx.hemi.intensity, si:ctx.sun.intensity, sc:ctx.sun.color.clone(), fi:ctx.fill.intensity, ex:ctx.renderer.toneMappingExposure } : null;
  function setOn(on){
    if(gm){ if(on){ gm.map = groundTex; gm.color.set('#d9d3c6').convertSRGBToLinear(); } else { gm.map = saved.map; gm.color.copy(saved.color); } gm.needsUpdate = true; }
    if(terr){ if(on){ terr.material.map = groundTex; terr.material.color.set('#e2dccf').convertSRGBToLinear(); } else { terr.material.map = tsaved.map; terr.material.color.copy(tsaved.color); } terr.material.needsUpdate = true; }
    if(L0){ ctx.hemi.color.set(on ? '#cfe1f5' : L0.hs); ctx.hemi.groundColor.set(on ? '#9c8f78' : L0.hg); ctx.hemi.intensity = on ? .55 : L0.hi;
      ctx.sun.intensity = on ? 1.35 : L0.si; ctx.sun.color.set(on ? '#fff0d6' : L0.sc); ctx.fill.intensity = on ? .22 : L0.fi; ctx.renderer.toneMappingExposure = on ? .98 : L0.ex; }
    root.visible = !!on; }
  setOn(true);

  /* מה שהוחלף לא מוצג בהדמיה: העצים, העמודים והכניסות הישנים, ואנשים ומכוניות הפשוטים */
  ctx.hide(['treeNew', 'treeOld', 'exTree', 'lamp', 'entry']);
  return { root, setOn, people:people.length, doors:doors.length };
}

window.PlanReal = { build, version:'1125' };
})();
