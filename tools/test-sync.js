#!/usr/bin/env node
// רתמת בדיקה headless לשכבת הסנכרון: טוענת את כל הסקריפט של index.html
// עם DOM מדומה, ומאמתת מול Supabase האמיתי:
//   1. אתחול בסיסי סנכרון מהענן (cloudLoad)
//   2. "אין שינויים" → לא נדחף כלום
//   3. עריכה מקומית אחת → נדחפת שורה אחת בלבד (לא כל ה-40)
//   4. עדכון מרחוק (משתמש אחר) → cloudRefresh ממזג אותו פנימה
//   5. עריכה מקומית שטרם נדחפה לא נדרסת ע"י רענון מרחוק
// הרצה: node tools/test-sync.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ── DOM מדומה מינימלי ── */
function mockElement() {
  const el = {
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    style: {}, dataset: {},
    setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
    addEventListener(){}, removeEventListener(){},
    appendChild(){}, prepend(){}, remove(){}, insertBefore(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    focus(){}, blur(){}, click(){},
    getContext(){ return new Proxy({}, { get: () => () => {} }); },
    getBoundingClientRect(){ return { width: 300, height: 150, top: 0, left: 0 }; },
    scrollIntoView(){},
    innerHTML: '', textContent: '', value: '', id: '', className: '',
    offsetWidth: 300, offsetHeight: 150, children: [], parentElement: null,
    closest(){ return null; },
  };
  return el;
}
const storageData = {};
const localStorageShim = {
  getItem: k => (k in storageData ? storageData[k] : null),
  setItem: (k, v) => { storageData[k] = String(v); },
  removeItem: k => { delete storageData[k]; },
};
const documentShim = {
  getElementById: () => mockElement(),
  querySelector: () => mockElement(),
  querySelectorAll: () => [],
  createElement: () => mockElement(),
  addEventListener(){}, removeEventListener(){},
  body: mockElement(),
  activeElement: null,
  hidden: false,
};
const sandbox = {
  console, fetch, setTimeout, clearTimeout, setInterval, clearInterval,
  URLSearchParams, Date, Math, JSON, Intl, Promise, Object, Array, String, Number, Boolean, RegExp, Map, Set, parseFloat, parseInt, isNaN, encodeURI, encodeURIComponent, decodeURIComponent, structuredClone,
  document: documentShim,
  localStorage: localStorageShim,
  navigator: { clipboard: { writeText: async () => {} } },
  location: { hash: '', hostname: 'localhost', pathname: '/', origin: 'http://localhost', reload(){} },
  history: { replaceState(){} },
  confirm: () => true,
  alert(){},
  addEventListener(){}, removeEventListener(){},
  matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
  getComputedStyle: () => ({ display: 'block', getPropertyValue: () => '' }),
  scrollTo(){}, print(){}, open(){},
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800,
  Image: class { set src(v){ if (this.onerror) setTimeout(() => this.onerror(), 0); } },
  FileReader: class { readAsDataURL(){ if (this.onload) setTimeout(() => this.onload({ target: { result: 'data:image/png;base64,x' } }), 0); } },
  Blob: class {},
  requestAnimationFrame: cb => setTimeout(cb, 0),
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

/* ── טעינת הסקריפט ── */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
const js = m.map(x => x[1]).join('\n');
try {
  vm.runInContext(js, sandbox, { filename: 'index-inline.js' });
} catch (e) {
  console.error('✗ טעינת הסקריפט נכשלה בסביבה המדומה:', e.message);
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// גישה לגלובלים לקסיקליים (let/const) של האפליקציה — דרך הרצה בתוך הקונטקסט
const E = code => vm.runInContext(code, sandbox);

(async () => {
  let pass = 0, fail = 0;
  const check = (name, cond) => { if (cond) { pass++; console.log('✓ ' + name); } else { fail++; console.error('✗ ' + name); } };
  const SB = { url: E('SB_URL'), key: E('SB_KEY'), table: E('SB_TABLE') };
  const sbHeaders = { apikey: SB.key, Authorization: 'Bearer ' + SB.key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };

  // המתנה ל-initCloud (רץ ב-INIT)
  let tries = 0;
  while (E('_syncBase.size') === 0 && tries < 40) { await sleep(500); tries++; }
  check('cloudLoad אתחל בסיסי סנכרון (' + E('_syncBase.size') + ' תוכניות)', E('_syncBase.size') >= 30);
  check('חותמות ענן נטענו', E('_remoteStamp.size') >= 30);

  // המתנה שסנכרון-ההתחלה (initCloud→savePlans) יסתיים
  tries = 0;
  while (E('_cloudDirty || _cloudBusy || !!_cloudTimer') && tries < 30) { await sleep(500); tries++; }

  // יירוט דחיפות: עוטפים את fetch של הקונטקסט
  E(`window.__pushed = null;
     window.__realFetch = fetch;
     fetch = function(url, opts){
       if (String(url).includes('ashdod_plans?on_conflict') && opts && opts.body) {
         try { window.__pushed = JSON.parse(opts.body).length; } catch(e){}
       }
       return window.__realFetch.apply(this, arguments);
     };`);

  // 2) אין שינויים → אין דחיפה
  await E('cloudSaveNow()');
  check('ללא שינויים — לא נדחפה אף שורה', E('window.__pushed') === null);

  // 3) עריכה מקומית אחת → דחיפת שורה אחת
  const rec0 = E(`JSON.parse(JSON.stringify(buildPlanRecords().find(r=>r.__key.startsWith('1880'))))`);
  E(`plans.find(p=>String(p.tik)==='1880').purpose = 'SYNC-TEST-' + Date.now(); savePlans();`);
  await sleep(2500); // debounce 1.5s + רשת
  tries = 0; while (E('_cloudBusy || !!_cloudTimer') && tries < 20) { await sleep(300); tries++; }
  check('עריכה אחת — נדחפה שורה אחת בלבד (נדחפו: ' + E('window.__pushed') + ')', E('window.__pushed') === 1);

  // 4) עדכון "ממשתמש אחר" → cloudRefresh ממזג
  const rec1 = E(`JSON.parse(JSON.stringify(buildPlanRecords().find(r=>r.__key.startsWith('1880'))))`);
  const remote = { ...rec1, projectDescription: 'REMOTE-MERGE-TEST' };
  const pushRes = await fetch(SB.url + '/rest/v1/' + SB.table + '?on_conflict=plan_key', {
    method: 'POST', headers: sbHeaders,
    body: JSON.stringify([{ plan_key: rec1.__key, data: remote, updated_at: new Date().toISOString() }]),
  });
  check('סימולציית עריכה מרחוק הצליחה', pushRes.ok);
  await E('cloudRefresh()');
  check('cloudRefresh מיזג עדכון מרחוק', E(`plans.find(p=>String(p.tik)==='1880').projectDescription`) === 'REMOTE-MERGE-TEST');

  // 5) עריכה מקומית שטרם נדחפה מנצחת רענון מרחוק
  E(`plans.find(p=>String(p.tik)==='1880').location = 'LOCAL-WINS-TEST'; savePlans();`);
  const remote2 = { ...remote, location: 'REMOTE-SHOULD-LOSE' };
  await fetch(SB.url + '/rest/v1/' + SB.table + '?on_conflict=plan_key', {
    method: 'POST', headers: sbHeaders,
    body: JSON.stringify([{ plan_key: rec1.__key, data: remote2, updated_at: new Date().toISOString() }]),
  });
  await E('cloudRefresh()');
  check('עריכה מקומית ממתינה לא נדרסה ע"י רענון', E(`plans.find(p=>String(p.tik)==='1880').location`) === 'LOCAL-WINS-TEST');

  // ── שחזור: החזרת השדות המקוריים ודחיפתם לענן ──
  E(`const __p = plans.find(p=>String(p.tik)==='1880');
     __p.purpose = ${JSON.stringify(rec0.purpose || '')};
     __p.projectDescription = ${JSON.stringify(rec0.projectDescription || '')};
     __p.location = ${JSON.stringify(rec0.location || '')};
     savePlans();`);
  await sleep(2500);
  tries = 0; while (E('_cloudBusy || !!_cloudTimer || _cloudDirty') && tries < 20) { await sleep(300); tries++; }
  const verify = await fetch(SB.url + '/rest/v1/' + SB.table + '?select=data&plan_key=eq.' + encodeURIComponent(rec1.__key), {
    headers: { apikey: SB.key, Authorization: 'Bearer ' + SB.key },
  });
  const rows = await verify.json();
  const cloudNow = rows[0] && rows[0].data;
  check('שחזור: הענן חזר לערכים המקוריים',
    !!cloudNow && cloudNow.location === (rec0.location || '') && (cloudNow.projectDescription || '') === (rec0.projectDescription || '') && cloudNow.purpose === (rec0.purpose || ''));

  console.log('\n' + (fail ? ('✗ ' + fail + ' בדיקות נכשלו · ' + pass + ' עברו') : ('✓ כל ' + pass + ' הבדיקות עברו')));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('✗ שגיאת הרצה:', e); process.exit(1); });
