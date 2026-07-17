#!/usr/bin/env node
// מיגרציה חד-פעמית על נתוני הייצור: כל תמונת base64 בתוך רשומות התוכניות בענן
// עולה ל-Supabase Storage ומוחלפת ב-URL. מריץ את migrateImagesToCloud של האפליקציה
// עצמה בסביבה מדומה — אותו קוד שרץ בדפדפן.
// בטיחות: לפני הכל מוודאים שה-bucket ציבורי (העלאת בדיקה + קריאת ה-URL); אחרת עוצרים.
// הרצה: node tools/migrate-images.js        (תצוגה מקדימה בלבד)
//        node tools/migrate-images.js --run  (ביצוע בפועל)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DO_RUN = process.argv.includes('--run');

/* ── סביבה מדומה (זהה ל-test-sync) ── */
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
const localFetch = (url, opts) => {
  if (typeof url === 'string' && !/^(https?:|data:)/.test(url)) {
    const p = path.join(__dirname, '..', String(url).split('?')[0]);
    try { const data = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(data), text: async () => data }); }
    catch (e) { return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => '' }); }
  }
  return fetch(url, opts);
};
const sandbox = {
  console, fetch: localFetch, setTimeout, clearTimeout, setInterval, clearInterval,
  URLSearchParams, Date, Math, JSON, Intl, Promise, Object, Array, String, Number, Boolean, RegExp, Map, Set, parseFloat, parseInt, isNaN, encodeURI, encodeURIComponent, decodeURIComponent, structuredClone,
  document: {
    getElementById: () => mockElement(), querySelector: () => mockElement(), querySelectorAll: () => [],
    createElement: () => mockElement(), addEventListener(){}, removeEventListener(){},
    body: mockElement(), activeElement: null, hidden: false,
  },
  localStorage: { getItem: k => (k in storageData ? storageData[k] : null), setItem: (k, v) => { storageData[k] = String(v); }, removeItem: k => { delete storageData[k]; } },
  navigator: { clipboard: { writeText: async () => {} } },
  location: { hash: '', hostname: 'localhost', pathname: '/', origin: 'http://localhost', reload(){} },
  history: { replaceState(){} },
  confirm: () => true, alert(){},
  addEventListener(){}, removeEventListener(){},
  matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
  getComputedStyle: () => ({ display: 'block', getPropertyValue: () => '' }),
  scrollTo(){}, print(){}, open(){},
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800,
  Image: class { set src(v){ if (this.onerror) setTimeout(() => this.onerror(), 0); } },
  FileReader: class { readAsDataURL(){ if (this.onload) setTimeout(() => this.onload({ target: { result: 'data:image/png;base64,x' } }), 0); } },
  Blob, requestAnimationFrame: cb => setTimeout(cb, 0),
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');
vm.runInContext(js, sandbox, { filename: 'index-inline.js' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const E = code => vm.runInContext(code, sandbox);

(async () => {
  // המתנה לטעינת ענן מלאה
  let tries = 0;
  while (E('_syncBase.size') === 0 && tries < 40) { await sleep(500); tries++; }
  tries = 0;
  while (E('_cloudDirty || _cloudBusy || !!_cloudTimer') && tries < 30) { await sleep(500); tries++; }
  console.log('נטענו ' + E('plans.length') + ' תוכניות מהענן');

  // ספירת תמונות מוטמעות
  const count = E(`(function(){
    const isData=s=>typeof s==='string'&&s.startsWith('data:');
    let n=0, bytes=0;
    plans.forEach(p=>{
      const add=s=>{ if(isData(s)){ n++; bytes+=s.length; } };
      add(p.devPlanImg); (p.areaImgs||[]).forEach(add);
      (Array.isArray(p.renders)?p.renders:(p.render?[p.render]:[])).forEach(add);
      (p.visuals||[]).forEach(v=>add(v.src)); (p.harmonica||[]).forEach(h=>add(h.src));
    });
    return {n, mb:(bytes/1048576).toFixed(1)};
  })()`);
  console.log('תמונות מוטמעות ברשומות: ' + count.n + ' (~' + count.mb + 'MB base64)');
  if (!count.n) { console.log('אין מה להעביר — הרשומות כבר נקיות.'); process.exit(0); }

  // בדיקת בטיחות: ה-bucket ציבורי? מעלים קובץ בדיקה זעיר וקוראים את ה-URL הציבורי
  const probe = await E(`(async function(){
    try{
      const blob = new Blob(['probe'], {type:'text/plain'});
      const p = await _storagePut(blob, 'img', 'migration_probe.txt');
      const url = docPublicUrl(p);
      const res = await fetch(url);
      const body = await res.text();
      return { ok: res.ok && body==='probe', url, status: res.status };
    }catch(e){ return { ok:false, err:String(e) }; }
  })()`);
  if (!probe.ok) {
    console.error('✗ ה-bucket אינו נגיש ציבורית (' + (probe.status || probe.err) + ') — המיגרציה בוטלה כדי לא לשבור תמונות.');
    process.exit(1);
  }
  console.log('✓ בדיקת bucket ציבורי עברה');

  if (!DO_RUN) { console.log('\nתצוגה מקדימה בלבד. להרצה בפועל: node tools/migrate-images.js --run'); process.exit(0); }

  // הרצת המיגרציה של האפליקציה עצמה (session אדריכלית; confirm=true בסביבה)
  E(`session = { role:'architect', at:new Date().toISOString() };`);
  console.log('מריץ migrateImagesToCloud() …');
  await E('migrateImagesToCloud()');

  // המתנה שהסנכרון של הרשומות המעודכנות יסתיים
  tries = 0;
  while (E('_cloudDirty || _cloudBusy || !!_cloudTimer') && tries < 60) { await sleep(1000); tries++; }

  // אימות: כמה base64 נשארו + דגימת URL
  const after = E(`(function(){
    const isData=s=>typeof s==='string'&&s.startsWith('data:');
    let n=0; const urls=[];
    plans.forEach(p=>{
      const chk=s=>{ if(isData(s)) n++; else if(typeof s==='string'&&s.includes('/storage/v1/object/public/')) urls.push(s); };
      chk(p.devPlanImg); (p.areaImgs||[]).forEach(chk);
      (Array.isArray(p.renders)?p.renders:(p.render?[p.render]:[])).forEach(chk);
      (p.visuals||[]).forEach(v=>chk(v.src)); (p.harmonica||[]).forEach(h=>chk(h.src));
    });
    return {remaining:n, urls:urls.length, sample:urls[0]||null};
  })()`);
  console.log('נותרו מוטמעות: ' + after.remaining + ' · הוחלפו ל-URL: ' + after.urls);
  if (after.sample) {
    const res = await fetch(after.sample);
    console.log((res.ok ? '✓' : '✗') + ' דגימת תמונה שהועלתה: HTTP ' + res.status);
  }
  // אימות מול הענן עצמו
  const cloudCheck = await E(`(async function(){
    const res = await fetch(SB_URL+'/rest/v1/'+SB_TABLE+'?select=data', {headers:SB_HEADERS});
    const rows = await res.json();
    let n=0; rows.forEach(({data})=>{ const s=JSON.stringify(data||{}); const m=s.match(/data:image\\\\?\\/|data:application\\\\?\\//g); if(m) n+=m.length; });
    return n;
  })()`);
  console.log('מופעי base64 שנותרו ברשומות הענן: ' + cloudCheck);
  console.log(after.remaining === 0 ? '\\n✓ המיגרציה הושלמה' : '\\n⚠ חלק מהתמונות לא הועברו — בדקו את הלוג');
  process.exit(0);
})().catch(e => { console.error('✗ שגיאה:', e); process.exit(1); });
