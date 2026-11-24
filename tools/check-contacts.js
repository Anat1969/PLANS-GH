#!/usr/bin/env node
// בדיקה: אנשי קשר בלי כפילות, אייקונים במקום כפתורים, הצעות מהמודל לדרישות התב"ע, השלבים בטור והאפליקציות בספרייה.
// הרצה: node tools/check-contacts.js. הענן לא נגיש: כל בקשה אליו נענית ריק.
const http = require('http'), fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const root = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fail++; };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if(e){ r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', /\.html$/.test(f) ? 'text/html' : /\.js$/.test(f) ? 'text/javascript' : /\.css$/.test(f) ? 'text/css' : 'application/json'); r.end(d); }); });
srv.listen(0, async () => {
  const port = srv.address().port, b = await chromium.launch({ args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }), pg = await b.newPage({ viewport:{ width:1440, height:900 } });
  await pg.route('**/*', r => r.request().url().startsWith('http://localhost:' + port) ? r.continue() : r.request().url().includes('supabase.co') ? r.fulfill({ status:200, body:'[]', contentType:'application/json' }) : r.abort());
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try{ localStorage.setItem('ashdod_session_v2', JSON.stringify({ role:'architect', at:new Date().toISOString() })); }catch(e){} });
  await pg.goto(`http://localhost:${port}/index.html?nocity`); await pg.waitForTimeout(7000);
  const r = await pg.evaluate(async () => {
    session = { role:'architect', tiks:[], at:Date.now() }; document.getElementById('loginOverlay')?.classList.remove('open');
    const nm = s => String(s||'').replace(/[\s"'׳״.,-]+/g, '');
    const out = {};
    // 1. בעלי העניין מהתב"ע: בלי כפילות
    out.gil = contacts.filter(c => nm(c.name) === 'גילמינסטר').length;
    out.gilPlans = (contacts.find(c => nm(c.name) === 'גילמינסטר') || {}).plans || [];
    out.parse = window._parseParty('גיל מינסטר, גיל מינסטר אדריכלים (עורך ראשי, אדריכל)');
    // 2. אייקונים
    go('contacts', navBtn('contacts')); contactView.mode = 'cards'; renderContactsPage(); await new Promise(f => setTimeout(f, 300));
    const box = document.getElementById('contactsBody');
    out.textBtns = [...box.querySelectorAll('button, a')].filter(e => ['עריכה','מחק','חיוג','מייל'].includes(e.textContent.trim())).length;
    out.icons = box.querySelectorAll('.ic-btn').length; out.titled = [...box.querySelectorAll('.ic-btn')].every(e => e.title);
    // 3. טופס: שם קיים ממלא את הפרטים, והשמירה לא יוצרת רשומה חדשה
    const ex = contacts.find(c => c.name && c.phone && c.email); out.ex = ex && ex.name;
    const n0 = contacts.length; contactEdit('');
    const inp = document.getElementById('cf_name'); inp.value = ex.name; inp.dispatchEvent(new Event('change'));
    out.filledPhone = document.getElementById('cf_phone').value === ex.phone; out.note = !document.querySelector('.cf-match').hidden;
    contactSave(''); out.added = contacts.length - n0;
    // 4. ספרייה ושלבים
    go('library', navBtn('library')); await new Promise(f => setTimeout(f, 200));
    out.apps = document.querySelectorAll('#libraryBody .lib-fold .lib-card').length;
    go('landing', navBtn('landing')); await new Promise(f => setTimeout(f, 300));
    const hz = document.querySelector('.hz-steps'); out.col = hz ? getComputedStyle(hz).flexDirection : 'none';
    // 5. הצעות מהמודל (1913)
    const p = plans.find(p => String(p.tik) === '1913'); p.tabaChecks = {}; p.tabaSugNo = {};
    currentProjectId = p.id; try{ openProject(p.id, true); }catch(e){} try{ ppTab('opinion'); }catch(e){}
    renderOpinionTab(p); await new Promise(f => setTimeout(f, 5000));
    out.sug = document.querySelectorAll('#opinionDoc .ck-sug').length;
    const okB = document.querySelector('#opinionDoc [data-sg$="|ok"]'); const id1 = okB && okB.dataset.sg.split('|')[0]; okB && okB.click(); await new Promise(f => setTimeout(f, 400));
    out.okSaved = !!(id1 && p.tabaChecks[id1] && p.tabaChecks[id1].src === 'מודל');
    const xB = document.querySelector('#opinionDoc [data-sg$="|x"]'); const id2 = xB && xB.dataset.sg.split('|')[0]; xB && xB.click(); await new Promise(f => setTimeout(f, 400));
    out.xSaved = !!(id2 && !p.tabaChecks[id2] && p.tabaSugNo[id2]);
    out.sug2 = document.querySelectorAll('#opinionDoc .ck-sug').length;
    return out; });
  ok(r.gil === 1, `"גיל מינסטר" במאגר פעם אחת (${r.gil}), עם התוכניות ${r.gilPlans.join(', ')}`);
  ok(r.parse.name === 'גיל מינסטר' && r.parse.org === 'גיל מינסטר אדריכלים', `פירוק בעל עניין: ${JSON.stringify(r.parse)}`);
  ok(r.textBtns === 0 && r.icons > 0 && r.titled, `אנשי קשר: ${r.icons} אייקונים, ${r.textBtns} כפתורי טקסט, לכל אייקון שם`);
  ok(r.filledPhone && r.note, `שם קיים בטופס (${r.ex}) ממלא את הטלפון ומציג "נמצא במאגר"`);
  ok(r.added === 0, `השמירה עדכנה את הרשומה הקיימת (${r.added} רשומות חדשות)`);
  ok(r.apps === 19, `בספרייה ${r.apps} אפליקציות קשורות`);
  ok(r.col === 'column', `השלבים בדף הבית בטור (${r.col})`);
  ok(r.sug > 0, `1913: ${r.sug} הצעות מהמודל`);
  ok(r.okSaved, 'אישור הצעה נשמר עם המקור "מודל"');
  ok(r.xSaved && r.sug2 === r.sug - 2, `דחייה לא נכנסת לסימון, וההצעה יורדת (${r.sug} → ${r.sug2})`);
  ok(!errs.length, 'בלי שגיאות בדף' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); srv.close();
  if(fail){ console.error(fail + ' בדיקות נכשלו'); process.exit(1); }
  console.log('כל הבדיקות עברו');
});
