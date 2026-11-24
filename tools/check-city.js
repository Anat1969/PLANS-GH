#!/usr/bin/env node
// בדיקת דף הכניסה (plans-city.js): כל תוכנית במקום, נפחים תקינים, השמש זזה, הקרוסלה והמעבר לתוכנית.
// הרצה: node tools/check-city.js [תיקייה לצילומים]. אריחי המפה מוחלפים באפור, והענן לא נגיש.
const http = require('http'), fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const root = path.join(__dirname, '..'), shots = process.argv[2];
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fail++; };
// נתונים: כל נפח בתוך אשדוד, וגובה חיובי
const D = JSON.parse(fs.readFileSync(path.join(root, 'data/city.json'), 'utf8'));
let bad = 0, n = 0; Object.values(D.taba).forEach(t => t.f.forEach(f => { n++; if(!(f.top > f.base) || f.r.some(([x, y]) => x < 34.55 || x > 34.75 || y < 31.70 || y > 31.88)) bad++; }));
ok(n > 0 && !bad, `${n} נפחים ב-${Object.keys(D.taba).length} תב"עות, כולם באשדוד ועם גובה`);
const GRAY = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN4+O7NfwAJRwPg3+d5DwAAAABJRU5ErkJggg==', 'base64');
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if(e){ r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', /\.html$/.test(f) ? 'text/html' : /\.js$/.test(f) ? 'text/javascript' : /\.css$/.test(f) ? 'text/css' : 'application/json'); r.end(d); }); });
srv.listen(0, async () => {
  const port = srv.address().port, b = await chromium.launch({ args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for(const vp of [{ width:1440, height:900, tag:'1440' }, { width:390, height:844, tag:'390' }]){
    const pg = await b.newPage({ viewport:{ width:vp.width, height:vp.height } });
    await pg.route('**/*', r => { const u = r.request().url(); if(u.startsWith('http://localhost:' + port)) return r.continue();
      if(u.includes('arcgisonline')) return r.fulfill({ status:200, body:GRAY, contentType:'image/png', headers:{ 'Access-Control-Allow-Origin':'*' } });
      if(u.includes('supabase.co')) return r.fulfill({ status:200, body:'[]', contentType:'application/json' }); return r.abort(); });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(`http://localhost:${port}/index.html`); await pg.waitForSelector('#cityIntro .cy-card', { timeout:40000 }).catch(() => {});
    const a = await pg.evaluate(() => ({ cards:document.querySelectorAll('#cityIntro .cy-card').length, canvas:!!document.querySelector('#cityScene canvas'), clock:document.getElementById('cityClock').textContent,
      sub:document.getElementById('citySub').textContent, thumbs:document.querySelectorAll('#cityIntro .cy-img img').length, plans:livePlans().length }));
    ok(a.canvas, `${vp.tag}: הסצנה מצוירת`);
    ok(a.cards > 0 && a.cards % 2 === 0, `${vp.tag}: בקרוסלה ${a.cards/2} תוכניות (מתוך ${a.plans}). ${a.sub}`);
    ok(a.thumbs === a.cards, `${vp.tag}: לכל כרטיס הדמיה או תמונת נפחים`);
    const rr = await pg.evaluate(() => [...document.querySelectorAll('#cityIntro .cy-img img')].filter(i => /renders\//.test(i.getAttribute('src'))).length / 2);
    ok(rr >= 15, `${vp.tag}: ${rr} כרטיסים עם הדמיה אמיתית מ"מרחב מדבר"`);
    if(shots) await pg.screenshot({ path:path.join(shots, `city-${vp.tag}-a.png`) });
    await pg.waitForTimeout(9000);
    const c2 = await pg.evaluate(() => document.getElementById('cityClock').textContent);
    ok(c2 !== a.clock, `${vp.tag}: השעון זז: ${a.clock} → ${c2}`);
    if(shots) await pg.screenshot({ path:path.join(shots, `city-${vp.tag}-b.png`) });
    await pg.$eval('#cityIntro .cy-card', e => e.click()); await pg.waitForTimeout(1800);
    ok(await pg.$('#cityIntro .cy-info'), `${vp.tag}: לחיצה על כרטיס מציגה את התוכנית`);
    if(shots) await pg.screenshot({ path:path.join(shots, `city-${vp.tag}-c.png`) });
    await pg.$eval('#cityIntro .cy-info [data-enter]', e => e.click()); await pg.waitForTimeout(800);
    ok(!(await pg.$('#cityIntro')), `${vp.tag}: "כניסה לתוכנית" סוגר את דף הכניסה`);
    // קישור ישיר לתוכנית, משפט ציבורי, שיתוף, ובלי פרטים פנימיים
    await pg.goto(`http://localhost:${port}/index.html#city=1913`); await pg.waitForSelector('#cityIntro .cy-info', { timeout:40000 }).catch(() => {});
    await pg.waitForTimeout(800);
    const d = await pg.evaluate(() => { const b = document.querySelector('#cityIntro .cy-info'); return { t:b ? b.textContent : '', say:b ? b.querySelector('.cy-say').textContent : '' }; });
    ok(/1913/.test(d.t) && /יח"ד/.test(d.say), `${vp.tag}: #city=1913 נפתח ממוקד, עם משפט: ${d.say}`);
    await pg.$eval('#cityShare', e => e.click()); await pg.waitForTimeout(400);
    const sh = await pg.evaluate(() => window._cityShared || '');
    ok(/#city=1913$|#city$/.test(sh), `${vp.tag}: שיתוף: ${sh}`);
    const txt = await pg.evaluate(() => document.getElementById('cityIntro').textContent);
    ok(!/דמרי|רבייב|איבריקה|ספיר התחדשות|\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}/.test(txt), `${vp.tag}: בדף הציבורי אין יזם ואין תאריך`);
    ok(!errs.length, `${vp.tag}: בלי שגיאות בדף` + (errs.length ? ': ' + errs[0] : ''));
    await pg.close();
  }
  await b.close(); srv.close();
  if(fail){ console.error(fail + ' בדיקות נכשלו'); process.exit(1); }
  console.log('כל בדיקות דף הכניסה עברו');
});
