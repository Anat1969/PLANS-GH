#!/usr/bin/env node
// בדיקת קבלה: "איפה אנחנו עומדים?", מצב העבודה, והמערכת ברקע (ענת, 24.11.2026).
// הרצה: node tools/check-ops.js. עם OPS_SNAPSHOT=<קובץ> נבדקת גם ההתאמה מול נתוני אמת.
// הענן מדומה: כל בקשה ל-supabase.co נענית מהמתקן (fixture), וכתיבות נתפסות ולא יוצאות.
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const O = require(path.join(root, 'plans-ops-core.js'));
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fail++; };
const TODAY = '2026-11-24';

/* ── מתקן: ארבעה מצבים שמכסים את תרחישי הקבלה ── */
const fx = () => [
  { id:0, tik:'9001', planNum:'תב/9001', location:'מתחם א', status:'בטיפול', forumArchitect:'2026-09-01', forumConsultants:'2026-11-20', datesPlan:{ committeePrep:'2026-10-01' }, _est:{ committeePrep:1 },
    actionLog:[{ at:'2026-11-10', type:'doc', detail:'הופק טופס נתונים למילוי של האדריכל' }], meet:{ forumArchitect:{ outcome:'held', history:[] } }, __key:'9001__תב/9001' },
  { id:1, tik:'9002', planNum:'תב/9002', location:'מתחם ב', status:'בטיפול', forumArchitect:'2026-11-27', intent:{ text:'רחוב פעיל' }, __key:'9002__תב/9002',
    actionLog:[{ at:'2026-11-22', type:'doc', detail:'הופק טופס נתונים למילוי של האדריכל' }] },
  { id:2, tik:'9003', planNum:'תב/9003', status:'טרם עודכן', documents:[{ type:'', name:'פרוטוקול ועדה' }], __key:'9003__תב/9003' },
  { id:3, tik:'9004', planNum:'תב/9004', status:'הושלם', __key:'9004__תב/9004' }
];
const people = { '9001':[{ name:'אדר א', email:'a@x.il', type:'אדריכל' }], '9002':[{ name:'אדר ב', email:'b@x.il', type:'אדריכל' }] };
const cf = p => people[String(p.tik)] || [];

/* ══════════ 1. המנוע (Node) ══════════ */
{
  const r = O.compute(fx(), { today:TODAY, contactsFor:cf });
  const k = r.items.map(i => i.key);
  ok(new Set(k).size === k.length, 'כל פריט מופיע פעם אחת (מפתח יחיד)');
  const md = r.items.find(i => i.kind === 'meet_due' && i.tik === '9001');
  ok(md && md.meetKey === 'forumConsultants', 'מועד שחלף: נשאל על האחרון שאינו אומדן (פורום יועצים, לא ההכנה המשוערת)');
  ok(md && md.level === 4 && md.tier === 'decide', 'מועד שחלף: טעון החלטה');
  ok(r.items.some(i => i.kind === 'date_conflict' && i.tier === 'system' && i.level === 2), 'אומדן מוקדם מהמועד הקודם: המערכת מטפלת, אוטונומית מותנית');
  const rem = r.items.find(i => i.kind === 'reminder');
  ok(rem && rem.tik === '9001' && rem.mail.to === 'a@x.il' && rem.tier === 'approve', 'טופס שלא חזר 14 ימים: תזכורת מוכנה לאישור, לנמען מאומת מהמאגר');
  ok(r.items.some(i => i.kind === 'form_waiting' && i.tik === '9002' && i.tier === 'waiting'), 'טופס בן יומיים: ממתינים לאחרים, עם מועד התזכורת');
  ok(r.items.some(i => i.kind === 'prep' && i.tik === '9002' && i.tier === 'approve'), 'פגישה בעוד 3 ימים: דף הכנה מוכן');
  ok(r.items.some(i => i.kind === 'no_status' && i.plans.length === 1 && i.plans[0].sug === 'הושלם'), 'תוכנית בלי סטטוס עם פרוטוקול: מוצעת "הושלם"');
  ok(!r.items.some(i => i.tik === '9004'), 'תוכנית שהושלמה לא מייצרת משימות');
  ok(r.focus.length <= 3 && r.focus.every(i => i.tier === 'decide' || i.tier === 'approve'), 'בראש הדף עד שלוש פעולות, רק החלטות ואישורים');
  ok(r.items.every((x, i, a) => !i || a[i-1].score >= x.score), 'הסדר לפי ציון העדיפות');
  ok(r.items.every(i => i.factors && 'urgency' in i.factors && 'effort' in i.factors), 'ציון שקוף: שמונה גורמים לכל פריט');
  ok(r.stories['9001'] && r.stories['9001'].next && r.stories['9001'].owner, 'סיפור לכל תוכנית: הפעולה הבאה והאחראי');

  // אחרי פעולה: לא חוזר; דחייה; האצלה; השהיית אוטומציה
  const P2 = fx(); P2[0].opsDone = { [rem.baseKey]: { at:TODAY } };
  const r2 = O.compute(P2, { today:TODAY, contactsFor:cf });
  ok(!r2.items.some(i => i.kind === 'reminder' && i.tik === '9001') && r2.items.some(i => i.kind === 'form_waiting' && i.tik === '9001'), 'אחרי פתיחת התזכורת: יורדת מאישורים ועוברת להמתנה, בלי כפילות');
  const r2b = O.compute(P2, { today:O.addDays(TODAY, 5), contactsFor:cf });
  ok(r2b.items.some(i => i.kind === 'reminder' && i.tik === '9001' && i.key !== rem.key), 'אין תשובה 5 ימים: תזכורת חוזרת, במפתח חדש');
  const r3 = O.compute(fx(), { today:TODAY, contactsFor:cf, user:{ snooze:{ [md.key]: O.addDays(TODAY, 1) } } });
  ok(!r3.items.some(i => i.key === md.key), 'דחייה למחר: לא מוצג היום');
  const r4 = O.compute(fx(), { today:TODAY, contactsFor:cf, user:{ delegated:{ [md.key]:{ to:'אדר א', at:TODAY } } } });
  ok(r4.items.find(i => i.key === md.key).tier === 'waiting', 'האצלה: עובר ל"ממתינים לאחרים"');
  const r5 = O.compute(fx(), { today:TODAY, contactsFor:cf, user:{ paused:{ reminder:true } } });
  ok(!r5.items.some(i => i.kind === 'reminder' || i.kind === 'form_waiting'), 'אוטומציה מושהית: לא מייצרת פריטים');
  const calm = O.compute([fx()[3]], { today:TODAY });
  ok(calm.items.length === 0 && calm.focus.length === 0 && /אין החלטה/.test(calm.morning.head), 'אין פעולה שמחייבת: נאמר במפורש, בלי משימות מלאכותיות');
  const ps = O.parseSummary('הוחלט לאשר את החזית. האדריכל יגיש חתכים עד 10.12.2026. סוכם על מועד ועדה.');
  ok(ps.decisions.length === 2 && ps.commitments.length === 1 && ps.dates.length === 1, 'חילוץ מסיכום פגישה: 2 החלטות, התחייבות ותאריך');
  const prep = O.meetingPrep(fx()[1], 'forumArchitect', r.items, { today:TODAY, contactsFor:cf });
  ok(prep.goal && prep.people.length === 1 && prep.missing.includes('תשריט') && prep.intent === 'רחוב פעיל', 'דף הכנה: מטרה, משתתפים, חומרים חסרים ומטרת התוכנית');
  ok(O.AUTOMATIONS.every(a => a.trigger && a.verify && a.onFail && a.permissions), 'כל אוטומציה מוגדרת: טריגר, הרשאות, אימות וטיפול בכשל');
  ok(O.AUTOMATIONS.filter(a => a.blocked).every(a => /אין חיבור/.test(a.blocked)), 'יכולת חסומה מוצגת עם הסיבה, בלי הצלחה מדומה');
}

/* ══════════ 2. השרת (Node, בלי כתיבה) ══════════ */
{
  const tmp = path.join(require('os').tmpdir(), 'ops-fx.json'), out = path.join(require('os').tmpdir(), 'ops-out.json');
  fs.writeFileSync(tmp, JSON.stringify(fx().map(d => ({ d }))));
  let log = ''; try{ log = execFileSync('node', [path.join(root, 'tools/ops-engine.mjs'), '--from', tmp, '--today', TODAY, '--out', out], { encoding:'utf8' }); }catch(e){ log = String(e.stdout || e.message); }
  const d = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  ok(d.lastRun && d.lastRun.status === 'ok' && d.digest.length > 0 && Object.keys(d.ledger).length === d.digest.length, 'מנוע השרת: הרצה, תמונת מצב ויומן זיהוי');
  ok(d.weekly && /סיכום שבועי/.test(d.weekly.text), 'מנוע השרת: סיכום שבועי');
  ok(/בלי כתיבה/.test(log), 'מנוע השרת: מצב בדיקה לא כותב לענן');
}

/* ══════════ 3. הדף בדפדפן ══════════ */
let chromium; try{ ({ chromium } = require('playwright')); }catch(e){ console.log('Playwright לא מותקן: דילוג על בדיקות הדפדפן'); process.exit(fail ? 1 : 0); }
const snap = process.env.OPS_SNAPSHOT ? JSON.parse(fs.readFileSync(process.env.OPS_SNAPSHOT, 'utf8')).map(r => ({ plan_key:r.k, data:r.d, updated_at:r.u })) : null;
const rows = snap || fx().map(d => ({ plan_key:d.__key, data:d, updated_at:'2026-11-23T00:00:00Z' }));
const contactsRow = [{ data:{ contacts:[{ id:'c1', name:'אדר א', email:'a@x.il', type:'אדריכל', plans:['9001'] }, { id:'c2', name:'אדר ב', email:'b@x.il', type:'אדריכל', plans:['9002'] }] }, updated_at:'' }];
const serverRow = [{ data:{ lastRun:{ at:'2026-11-24T06:41:00Z', status:'ok' }, runs:[{ at:'2026-11-24T06:41:00Z', status:'ok', plans:4, items:9, newItems:2, ms:300, attempts:1 }, { at:'2026-11-24T04:41:00Z', status:'fail', error:'HTTP 503', attempts:3 }], ledger:{ a:{}, b:{} } }, updated_at:'' }];
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if(e){ r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', /\.html$/.test(f) ? 'text/html' : /\.js$/.test(f) ? 'text/javascript' : /\.css$/.test(f) ? 'text/css' : 'application/json'); r.end(d); }); });
srv.listen(0, async () => {
  const port = srv.address().port, b = await chromium.launch();
  const run = async (vp, role, opts) => {
    opts = opts || {};
    const pg = await b.newPage({ viewport:vp }), posts = [], errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**/*', r => { const u = r.request().url();
      if(u.startsWith('http://localhost:' + port)) return r.continue();
      if(u.includes('supabase.co')){
        if(r.request().method() !== 'GET'){ posts.push({ u, body:r.request().postData() || '' }); return r.fulfill({ status:201, body:'' }); }
        if(opts.down) return r.fulfill({ status:503, body:'down' });
        if(u.includes('ashdod_plans')) return r.fulfill({ status:200, body:JSON.stringify(rows), contentType:'application/json' });
        if(u.includes('id=eq.contacts')) return r.fulfill({ status:200, body:JSON.stringify(snap ? [] : contactsRow), contentType:'application/json' });
        if(u.includes('id=eq.ops_server')) return r.fulfill({ status:200, body:JSON.stringify(serverRow), contentType:'application/json' });
        return r.fulfill({ status:200, body:'[]', contentType:'application/json' });
      }
      return r.abort(); });
    await pg.addInitScript(role => { try{ localStorage.setItem('ashdod_tour_v1', '1'); localStorage.setItem('ashdod_session_v2', JSON.stringify({ role, at:new Date().toISOString() })); }catch(e){} }, role);
    await pg.goto(`http://localhost:${port}/index.html?nocity`); await pg.waitForTimeout(6500);
    await pg.evaluate(role => { session = { role, tiks:[], at:Date.now() }; document.getElementById('loginOverlay')?.classList.remove('open'); document.getElementById('tourOverlay')?.remove(); if(typeof contacts !== 'undefined' && !contacts.length && window.__fxc) contacts.push(...window.__fxc); }, role);
    if(!snap) await pg.evaluate(c => { if(typeof contacts !== 'undefined' && !contacts.some(x => x.id === 'c1')) contacts.push(...c); }, contactsRow[0].data.contacts);
    await pg.evaluate(() => go('now', navBtn('now'))); await pg.waitForTimeout(900);
    return { pg, posts, errs };
  };

  // 3א. מחשב, אדריכלית
  { const { pg, posts, errs } = await run({ width:1440, height:900 }, 'architect');
    const s = await pg.evaluate(() => {
      const nav = [...document.querySelectorAll('#mainNav button[data-nav]')].filter(b => !b.dataset.more && b.offsetParent).map(b => b.dataset.nav);
      const keys = [...document.querySelectorAll('#nowBody .nw-row')].map(e => e.dataset.k);
      return { nav, keys, h1:document.querySelector('#nowBody h1').textContent, tiers:document.querySelectorAll('#nowBody .nw-tier').length, focus:document.querySelectorAll('.nw-focus .nw-row').length,
        srv:document.querySelector('.nw-srv').textContent, hash:location.hash, morning:document.querySelector('.nw-morning').innerText };
    });
    ok(s.nav[0] === 'landing' && s.nav[1] === 'now', 'הדף מופיע בסרגל מיד אחרי הדף הראשי');
    ok(s.h1 === 'איפה אנחנו עומדים?' && s.hash === '#now', 'כותרת הדף וכתובת ישירה #now');
    ok(s.tiers === 7 && /תמונת הבוקר/.test(s.morning), 'שבע קומות: תמונת הבוקר ועוד שש, וסיפור לכל תוכנית');
    ok(s.focus >= 1 && s.focus <= 3, `בראש הדף ${s.focus} פעולות (עד שלוש)`);
    ok(new Set(s.keys).size === s.keys.length, 'כל פעולה מופיעה פעם אחת בדף');
    if(!snap){
      ok(/בדיקה אחרונה ברקע/.test(s.srv), 'מוצגת הבדיקה האחרונה של המערכת ברקע');
      // מצב עבודה: החלטה מבצעת פעולות המשך
      await pg.evaluate(() => { NowPage.budget(30); NowPage.start(); }); await pg.waitForTimeout(300);
      const m1 = await pg.evaluate(() => ({ open:!!document.getElementById('nwMode'), title:document.querySelector('#nwMode h2').textContent, why:!!document.querySelector('#nwMode .nw-why'), rec:!!document.querySelector('#nwMode .nw-rec'), chain:!!document.querySelector('#nwMode .nw-after') }));
      ok(m1.open && m1.why && m1.rec && m1.chain, `מצב עבודה: "${m1.title}" עם למה עכשיו, המלצה ומה יקרה אחרי`);
      const k = await pg.evaluate(() => { const it = NowPage._compute().items.find(i => i.kind === 'meet_due' && i.tik === '9001'); return it.key; });
      await pg.evaluate(() => NowPage.close());
      const after = await pg.evaluate(k => {
        const it = NowPage._compute().items.find(i => i.key === k);
        const res = NowPage._act(it, 'held', 'הוחלט לאשר את פורום היועצים. האדריכל יגיש חתכים עד 10.12.2026');
        const p = plans.find(x => String(x.tik) === '9001'), r = NowPage._compute();
        return { res, outcome:p.meet.forumConsultants.outcome, log:p.actionLog.map(a => a.detail).join(' | '), still:r.items.some(i => i.key === k),
          summary:r.items.some(i => i.kind === 'summary' && i.tik === '9001'), est:p.datesPlan.committeePrep, dec:(p.decisions || []).length, mem:(NowPage._user().memory || []).length };
      }, k);
      ok(after.outcome === 'held' && !after.still, 'החלטה "התקיים": נרשמה בתיק, והפריט ירד');
      ok(/פורום יועצים התקיים/.test(after.log) && after.dec === 1 && after.mem >= 1, 'תגובת שרשרת: יומן, החלטה בתיק וזיכרון');
      ok(after.summary, 'תגובת שרשרת: סיכום לצוות מוכן לאישור');
      ok(after.est > '2026-11-24' && /\[מערכת\] אומדן הכנה לוועדה/.test(after.log), `תגובת שרשרת: אומדן ההכנה לוועדה עודכן ל-${after.est}, ומסומן כאומדן`);
      // ניווט ישיר וחזרה צהובה
      await pg.evaluate(() => { const it = NowPage._compute().items.find(i => i.kind === 'reminder'); NowPage.go(it.key); }); await pg.waitForTimeout(500);
      const nb = await pg.evaluate(() => { const b = document.getElementById('opsBack'); return { page:document.querySelector('.page.active').id, shown:b && !b.hidden, bg:b && getComputedStyle(b).backgroundColor }; });
      ok(nb.page === 'projectPage' && nb.shown && nb.bg === 'rgb(255, 212, 0)', 'קישור ישיר לתוכנית, וכפתור חזרה צהוב');
      await pg.click('#opsBack'); await pg.waitForTimeout(400);
      ok(await pg.evaluate(() => document.querySelector('.page.active').id === 'now' && document.getElementById('opsBack').hidden), 'החזרה מחזירה לדף, והכפתור נעלם');
      // השהיית אוטומציה נשמרת לענן
      await pg.evaluate(() => NowPage.pause('reminder')); await pg.waitForTimeout(900);
      ok(posts.some(p => /ops_user/.test(p.body) && /"reminder":true/.test(p.body)), 'השהיית אוטומציה נשמרת לענן (ops_user)');
      ok(!posts.some(p => /ops_server/.test(p.body)), 'הדף לא כותב לשורת השרת');
      await pg.screenshot({ path:path.join(require('os').tmpdir(), 'ops-desktop.png'), fullPage:false });
    }
    ok(!errs.length, 'בלי שגיאות דף' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
    await pg.close(); }

  // 3ב. נייד: בלי גלילה לרוחב
  { const { pg } = await run({ width:390, height:844 }, 'architect');
    const w = await pg.evaluate(() => ({ sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth }));
    ok(w.sw <= w.cw + 1, `נייד 390: בלי גלילה לרוחב (${w.sw}/${w.cw})`);
    await pg.screenshot({ path:path.join(require('os').tmpdir(), 'ops-mobile.png') }); await pg.close(); }

  // 3ג. הנהלה: צפייה בלבד
  { const { pg } = await run({ width:1440, height:900 }, 'manager');
    ok(await pg.evaluate(() => !document.querySelector('.nw-go')), 'הנהלה: אין "התחלת עבודה"'); await pg.close(); }

  // 3ד. הענן לא זמין: נאמר, בלי הצלחה מדומה
  { const { pg } = await run({ width:1440, height:900 }, 'architect', { down:true });
    ok(await pg.evaluate(() => /לא זמין|לא רץ|לא נבדק/.test(document.querySelector('.nw-srv').textContent)), 'שרת לא זמין: מוצג במפורש'); await pg.close(); }

  await b.close(); srv.close();
  console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nכל הבדיקות עברו'); process.exit(fail ? 1 : 0);
});
