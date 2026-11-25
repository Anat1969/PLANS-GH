#!/usr/bin/env node
// מצבי העבודה של המודל (תכנוני, אדריכלי, חווייתי): ביצועים, אי־שינוי הגאומטריה, וצילומי גובה עיניים.
// הרצה: node tools/check-work-modes.cjs [תיק=1913] [--before] [--shots <תיקייה>]
//   --before: מודד את המצב הקיים (בלי מצבי עבודה) ושומר כ"לפני" ב-data/urban-standard/perf-<תיק>.json.
// הענן חסום בבדיקה (תשובה ריקה), וכך גם אריחי מפה חיצוניים: הרקע הוא המבנים הקיימים מהקובץ המקומי.
// כרטיס המסך מדומה (swiftshader): מספר הפריימים לשנייה הוא יחסי בלבד. קריאות ציור ומשולשים אינם תלויים בחומרה.
const http = require('http'), fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const root = path.join(__dirname, '..'), args = process.argv.slice(2);
const tik = args.find(a => /^\d+$/.test(a)) || '1913', before = args.includes('--before');
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fail++; };
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.geojson':'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if(e){ r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); r.end(d); }); });
srv.listen(0, async () => {
  const port = srv.address().port, b = await chromium.launch({ args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const pg = await b.newPage({ viewport:{ width:1440, height:900 } });
  await pg.route('**/*', r => r.request().url().startsWith('http://localhost:' + port) ? r.continue() : r.request().url().includes('supabase.co') ? r.fulfill({ status:200, body:'[]', contentType:'application/json' }) : r.abort());
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try{ localStorage.setItem('ashdod_session_v2', JSON.stringify({ role:'architect', at:new Date().toISOString() })); localStorage.setItem('ashdod_tour_v1', JSON.stringify({ architect:1, manager:1, developer:1 })); }catch(e){} });
  await pg.goto(`http://localhost:${port}/index.html?nocity`); await pg.waitForTimeout(6000);
  const t0 = Date.now();
  await pg.evaluate(t => { session = { role:'architect', tiks:[], at:Date.now() }; document.getElementById('loginOverlay')?.classList.remove('open'); window.openLayers(t); }, tik);
  await pg.waitForFunction(() => { const S = window._lyState && window._lyState(); return S && S.api && S.mode === 'model'; }, null, { timeout:120000 });
  await pg.waitForTimeout(1500);
  const loadMs = Date.now() - t0;
  const settle = ms => pg.waitForTimeout(ms);
  // מדידה אחת: פריימים ל-3 שניות (המודל מצייר לפי דרישה, ולכן מבקשים ציור בכל פריים), קריאות ציור וזיכרון
  const sample = () => pg.evaluate(async () => {
    const S = window._lyState(), api = S.api; let n = 0; const t = performance.now();
    await new Promise(res => { const f = () => { n++; api.setSun(new Date().getFullYear(), 6, 21, S.hour); if(performance.now() - t < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const st = api.stats(), mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null;
    return Object.assign(st, { fps:+(n / ((performance.now() - t) / 1000)).toFixed(1), heapMB:mem });
  });
  const snap = async name => { if(!shots) return; fs.mkdirSync(shots, { recursive:true }); const bx = await pg.locator('#lyStage').boundingBox(); await pg.screenshot({ path:path.join(shots, `${tik}-${name}.png`), clip:bx, timeout:60000 }); };
  const res = { tik, date:new Date().toISOString().slice(0, 10), loadMs, env:'Chromium headless, swiftshader, 1440x900', modes:{} };
  // מבט עיניים אחד לכל המצבים: המצלמה נשמרת
  // מקטע הרחוב של הפיילוט: התחנה הראשונה בסיור ("הכניסה מהרחוב"), בגובה 1.65 מ', מבט אל הבניינים. בלי סיור: מבט העיניים של המודל
  const wk = (() => { try{ return JSON.parse(fs.readFileSync(path.join(root, 'layers', tik, 'walk.json'), 'utf8')); }catch(e){ return null; } })();
  // ...ומבט אל הבניין הקרוב (מרכז המתאר בקומת הקרקע, floors.json), בגובה 10 מ'
  const fl = (() => { try{ return JSON.parse(fs.readFileSync(path.join(root, 'layers', tik, 'floors.json'), 'utf8')); }catch(e){ return null; } })();
  const cents = fl ? fl.buildings.map(b => { const e = fl.plans[b.floors[0].plan].env; let x = 0, y = 0; for(let i = 0; i < e.length; i += 2){ x += e[i]; y += e[i+1]; } return [x/(e.length/2)/10, y/(e.length/2)/10]; }) : [];
  // מבט עיניים של הולך רגל: המצלמה של מצב ההליכה בתחנה הראשונה ("הכניסה מהרחוב"), 1.65 מ' מעל פני הקרקע, מבט לאורך המדרכה.
  // אותה מצלמה לכל המצבים. (walkJump מקבל קואורדינטות ולא מספר תחנה: walkStart כבר מתחיל בתחנה הראשונה)
  let eye = await pg.evaluate(async () => { const api = window._lyState().api; if(!api.walkStart()) return null;
    await new Promise(r => setTimeout(r, 4000)); const c = api.getCam(); api.walkStop(); return c && Number.isFinite(c.p[0]) ? c : null; });
  if(!eye) eye = await pg.evaluate(() => { const S = window._lyState(); S.api.view('eye'); return S.api.getCam(); });
  // מבט שני מאותה נקודה: אל הבניין הקרוב (חזית וקומת קרקע). רק לצילום, בלי בדיקת מצלמה
  const near = eye && cents.length ? cents.slice().sort((a, b) => Math.hypot(a[0]-eye.p[0], a[1]+eye.p[2]) - Math.hypot(b[0]-eye.p[0], b[1]+eye.p[2]))[0] : null;
  // נסיגה של 25 מ' לאחור מהבניין, לצד השני של הרחוב, כדי שהחזית וקומת הקרקע ייכנסו לפריים
  const face = near ? (() => { const dx = eye.p[0] - near[0], dy = -eye.p[2] - near[1], d = Math.hypot(dx, dy) || 1, x = eye.p[0] + dx/d*25, y = -eye.p[2] + dy/d*25;
    return { p:[+x.toFixed(2), eye.p[1], +(-y).toFixed(2)], t:[+near[0].toFixed(2), +(eye.p[1] + 12).toFixed(2), +(-near[1]).toFixed(2)] }; })() : null;
  await pg.evaluate(c => window._lyState().api.setCam(c), eye); eye = await pg.evaluate(() => window._lyState().api.getCam());
  console.log("מצלמה:", JSON.stringify(eye));
  const setCam = () => pg.evaluate(c => window._lyState().api.setCam(c), eye);
  if(before){
    for(const [name, render, hour] of [['design', false, 12], ['render', true, 12], ['render-night', true, 20.3]]){
      await pg.evaluate(async ([render, hour]) => { const S = window._lyState(); S.render = render; S.hour = hour; await S.api.setRender(render); }, [render, hour]);
      await setCam(); await settle(1500); res.modes[name] = await sample(); await snap('before-' + name);
      console.log(name, JSON.stringify(res.modes[name]));
    }
  } else {
    const has = await pg.evaluate(() => typeof window._lyState().api.setWork === 'function');
    ok(has, 'במודל יש מצבי עבודה (setWork)');
    // אי־שינוי: המודל והמדידות זהים בכל מצב, והמצלמה נשמרת
    const g0 = await pg.evaluate(() => window._lyState().api.sourceHash());
    for(const [name, illus, hour] of [['planning', true, 12], ['architectural', true, 12], ['experiential', true, 12], ['experiential-night', true, 20.3], ['experiential-no-illus', false, 12]]){
      const mode = name.split('-')[0];
      await pg.evaluate(async ([mode, illus, hour]) => { const S = window._lyState(); S.hour = hour; await window._lyWork(mode); S.api.setIllus(illus); }, [mode, illus, hour]);
      await setCam(); await settle(1500);
      const cam = await pg.evaluate(() => window._lyState().api.getCam());
      res.modes[name] = await sample(); await snap(name);
      if(face && shots){ await pg.evaluate(c => window._lyState().api.setCam(c), face); await settle(1200); await snap(name + '-facade'); await setCam(); }
      const g = await pg.evaluate(() => window._lyState().api.sourceHash());
      ok(g === g0, `${name}: המודל והמדידות זהים (${g})`);
      ok(JSON.stringify(cam) === JSON.stringify(eye), `${name}: המצלמה נשמרה`);
      console.log(name, JSON.stringify(res.modes[name]));
    }
    // מקור לכל רכיב: אין קבוצה בלי תיוג, וההמחשה ניתנת לכיבוי
    const pv = await pg.evaluate(() => window._lyState().api.provenance());
    ok(pv.untagged.length === 0, `לכל שכבה יש מקור (${pv.tagged} מתויגות${pv.untagged.length ? ', חסר: ' + pv.untagged.join(', ') : ''})`);
    ok(pv.illusVisibleWhenOff === 0, 'כיבוי ההמחשה מסתיר את כל רכיבי ההמחשה');
    // הגאומטריה של המצב התכנוני היא אותה גאומטריה של המודל האדריכלי (אותו מתאר ואותם גבהים)
    const bb = await pg.evaluate(() => window._lyState().api.planMassCheck());
    ok(bb && bb.maxDiff < 0.05, `המצב התכנוני על אותה גאומטריה: סטייה מרבית בתיבות התוחמות ${bb ? bb.maxDiff.toFixed(3) : '-'} מ' (${bb ? bb.n : 0} בניינים)`);
  }
  ok(errs.length === 0, 'בלי שגיאות בדף' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  const file = path.join(root, 'data/urban-standard', `perf-${tik}.json`), prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  prev[before ? 'before' : 'after'] = res; fs.writeFileSync(file, JSON.stringify(prev, null, 1));
  console.log(`טעינה: ${loadMs} מ"ש. נשמר: ${path.relative(root, file)}`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
});
