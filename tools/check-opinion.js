#!/usr/bin/env node
// בדיקת חוות הדעת (plans-opinion.js) בדפדפן: סדר הסעיפים א עד ו, וכל דרישות התכנון מופיעות, כולל "לא נבדק".
// הרצה: node tools/check-opinion.js  (דורש playwright. הענן לא נגיש בבדיקה: כל בקשה אליו נענית ריק)
const http = require('http'), fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const root = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fail++; };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if(e){ r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', /\.html$/.test(f) ? 'text/html' : /\.js$/.test(f) ? 'text/javascript' : 'application/json'); r.end(d); }); });
srv.listen(0, async () => {
  const port = srv.address().port, b = await chromium.launch(), pg = await b.newPage();
  await pg.route('**/*', r => r.request().url().startsWith('http://localhost:' + port) ? r.continue() : r.request().url().includes('supabase.co') ? r.fulfill({ status:200, body:'[]', contentType:'application/json' }) : r.abort());
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(`http://localhost:${port}/index.html?nocity`); await pg.waitForTimeout(5000);
  const r = await pg.evaluate(async () => { session = { role:'architect', tiks:[], at:Date.now() };
    const p = plans.find(p => String(p.tik) === '1912'); currentProjectId = p.id; try{ openProject(p.id, true); }catch(e){} try{ ppTab('opinion'); }catch(e){}
    renderOpinionTab(p); await new Promise(f => setTimeout(f, 2500)); renderOpinionTab(p);
    const g = [...document.querySelectorAll('#opinionDoc .op-grp-h')].map(x => x.textContent), s = t => [...document.querySelectorAll('#opinionDoc details.op-fold')].find(d => d.querySelector('summary').textContent.includes(t));
    const n = t => { const d = s(t); return d ? d.querySelectorAll('.ck-list li').length : -1; }, open = t => { const d = s(t); return d ? d.querySelectorAll('.ck-open').length : -1; };
    const tb = await fetch('data/taba/1912.json').then(r => r.json());
    return { g, taba:n('דרישות מהוראות התב'), expTaba:tb.requirements.length, todo:document.querySelectorAll('#opTodo').length, spatial:n('הנחיות מרחביות'), spatialOpen:open('הנחיות מרחביות'), sub:n('דרישות ההגשה'), lots:(s('טבלה 5') || document).querySelectorAll('.t5lotc').length, people:s('בעלי העניין').querySelectorAll('tbody tr').length,
      expSpatial:SPATIAL_GUIDELINES.length, expSub:(window.LAYER_TOPICS || []).reduce((a, t) => a + t.items.length, 0) }; });
  ok(r.g.map(x => x[0]).join('') === 'אבגדהו', 'סדר הקבוצות: ' + r.g.join(' | '));
  ok(r.spatial === r.expSpatial && r.spatialOpen === r.expSpatial, `כל ${r.expSpatial} ההנחיות המרחביות מופיעות, גם "לא נבדק"`);
  ok(r.sub === r.expSub && r.sub > 0, `כל ${r.expSub} דרישות ההגשה מופיעות`);
  ok(r.taba === r.expTaba && r.taba > 0, `כל ${r.expTaba} דרישות התב"ע של 1912 מופיעות`);
  ok(r.todo === 1, 'רשימת ההשלמות מופיעה פעם אחת');
  ok(r.lots === 20, `טבלה 5 של 1912: ${r.lots} מגרשים`);
  ok(r.people >= 2, `בעלי העניין: ${r.people}`);
  ok(!errs.length, 'בלי שגיאות בדף' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); srv.close();
  if(fail){ console.error(fail + ' בדיקות נכשלו'); process.exit(1); }
  console.log('כל בדיקות חוות הדעת עברו');
});
