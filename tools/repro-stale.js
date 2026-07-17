#!/usr/bin/env node
// שחזור תרחיש "טאב מיושן": שלב 1 בונה localStorage ישן (ללא ענן, עם base64 מה-seeds);
// שלב 2 מריץ לקוח חדש עם אותו localStorage מול הענן האמיתי, ומתעד כל POST —
// כדי לוודא שהקוד החדש לא דוחף את המצב הישן על הענן. קריאה בלבד מהענן + לוג; שום כתיבה לא מבוצעת בפועל (dry-run על POST).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function buildSandbox(storageData, fetchImpl) {
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
  const sandbox = {
    console, fetch: fetchImpl, setTimeout, clearTimeout, setInterval, clearInterval,
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
  return sandbox;
}

const localFile = url => {
  const p = path.join(__dirname, '..', String(url).split('?')[0]);
  try { const data = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(data), text: async () => data }); }
  catch (e) { return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => '' }); }
};

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  /* ── שלב 1: לקוח "עתיק" — הענן חסום, seeds נטענים → localStorage עם base64 ── */
  const staleStorage = {};
  const offlineFetch = (url, opts) => {
    if (typeof url === 'string' && !/^(https?:|data:)/.test(url)) return localFile(url);
    return Promise.resolve({ ok: false, status: 503, json: async () => ({}), text: async () => '' }); // ענן חסום
  };
  const sb1 = buildSandbox(staleStorage, offlineFetch);
  vm.runInContext(js, sb1, { filename: 'phase1.js' });
  await sleep(4000); // טעינת seeds + נסיונות ענן כושלים
  vm.runInContext('savePlans()', sb1); // שמירה מקומית אחרי החלת ה-seeds (כמו עריכה כלשהי בלקוח הישן)
  await sleep(300);
  const snap = staleStorage['ashdod_plans_v1'] || '';
  const b64count = (snap.match(/data:image|data:application/g) || []).length;
  console.log('שלב 1: localStorage ישן נבנה — ' + Math.round(snap.length / 1024) + 'KB, ' + b64count + ' מופעי base64');
  if (!b64count) { console.error('✗ השחזור לא הצליח לבנות מצב ישן עם base64'); process.exit(1); }

  /* ── שלב 2: לקוח חדש עם ה-localStorage הישן, מול ענן סינתטי "אחרי מיגרציה"
        (הרשומות של שלב 1 כשכל base64 הוחלף ב-URL) — דטרמיניסטי לחלוטין ── */
  let urlSeq = 0;
  const snapRecords = JSON.parse(snap).plans;
  const cloudRows = snapRecords.map(rec => {
    const data = JSON.parse(JSON.stringify(rec).replace(/"data:[^"]{40,}"/g, () => '"https://slcpldoaaagkoozpbjsk.supabase.co/storage/v1/object/public/ashdod-docs/img/fake_' + (++urlSeq) + '.jpg"'));
    return { plan_key: rec.__key, data, updated_at: '2026-07-18T00:00:00.000Z' };
  });
  console.log('ענן סינתטי: ' + cloudRows.length + ' שורות, ' + urlSeq + ' תמונות שהומרו ל-URL');
  const pushes = [];
  const onlineFetch = (url, opts) => {
    if (typeof url === 'string' && !/^(https?:|data:)/.test(url)) return localFile(url);
    const u = String(url);
    if (opts && opts.method === 'POST' && u.includes('supabase')) {
      const body = String(opts.body || '');
      let rows = []; try { rows = JSON.parse(body); } catch (e) {}
      pushes.push({
        t: Date.now(), rows: rows.length,
        keys: rows.map(r => r.plan_key || r.id).slice(0, 8),
        base64: (body.match(/data:image|data:application/g) || []).length,
        kb: Math.round(body.length / 1024),
      });
      return Promise.resolve({ ok: true, status: 201, json: async () => ([]), text: async () => '' }); // dry-run
    }
    if (u.includes('/rest/v1/ashdod_plans')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => cloudRows, text: async () => '' });
    }
    if (u.includes('supabase')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ([]), text: async () => '' });
    }
    return fetch(url, opts);
  };
  const storage2 = { ...staleStorage };
  const sb2 = buildSandbox(storage2, onlineFetch);
  const t0 = Date.now();
  // הזרקת לוגים לנקודות המפתח כדי לראות את סדר האירועים המדויק
  const T = "(Date.now()-" + t0 + ")+'ms'";
  let js2 = "function __b64(){ try{ let n=0; plans.forEach(p=>{ const c=s=>{ if(typeof s==='string'&&s.startsWith('data:'))n++; }; c(p.devPlanImg);(p.areaImgs||[]).forEach(c);(Array.isArray(p.renders)?p.renders:(p.render?[p.render]:[])).forEach(c);(p.visuals||[]).forEach(v=>c(v.src));(p.harmonica||[]).forEach(h=>c(h.src)); }); return n; }catch(e){ return -1 } }\n" + js;
  js2 = js2.replace("function applySeedOpinions() {",
    "function applySeedOpinions() { console.log('[SEED-APPLY]', " + T + ", 'b64='+__b64());");
  js2 = js2.replace("    if (!Array.isArray(rows) || !rows.length) return false;\n    const byKey = {}; plans.forEach(p => byKey[planKey(p)] = p);\n    rows.forEach(({ plan_key, data: sp, updated_at }) => {",
    "    if (!Array.isArray(rows) || !rows.length) return false;\n    console.log('[LOAD]', " + T + ", 'rows='+rows.length, 'b64before='+__b64());\n    const byKey = {}; plans.forEach(p => byKey[planKey(p)] = p);\n    rows.forEach(({ plan_key, data: sp, updated_at }) => {");
  js2 = js2.replace("    setCloudStatus('ok', '☁ מסונכרן');\n    return true;",
    "    console.log('[LOAD-DONE]', " + T + ", 'b64after='+__b64());\n    setCloudStatus('ok', '☁ מסונכרן');\n    return true;");
  js2 = js2.replace("    const rows = changed.map(c => ({ plan_key: c.key, data: c.rec, updated_at: now }));",
    "    console.log('[SAVE]', " + T + ", 'changed='+changed.length, 'baseSize='+_syncBase.size, 'b64local='+__b64());\n    const rows = changed.map(c => ({ plan_key: c.key, data: c.rec, updated_at: now }));");
  vm.runInContext(js2, sb2, { filename: 'phase2.js' });
  await sleep(12000); // כל שרשרת האתחול + debounce + דחיפות
  const E = code => vm.runInContext(code, sb2);

  console.log('\nשלב 2: דחיפות שנרשמו (' + pushes.length + '):');
  pushes.forEach(p => console.log('  +' + ((p.t - t0) / 1000).toFixed(1) + 's · ' + p.rows + ' שורות · ' + p.base64 + ' base64 · ' + p.kb + 'KB · ' + p.keys.join(',')));

  const localState = E(`(function(){
    let b=0,u=0;
    plans.forEach(p=>{ const chk=s=>{ if(typeof s!=='string')return; if(s.startsWith('data:'))b++; else if(s.includes('/storage/v1/object/public/'))u++; };
      chk(p.devPlanImg);(p.areaImgs||[]).forEach(chk);
      (Array.isArray(p.renders)?p.renders:(p.render?[p.render]:[])).forEach(chk);
      (p.visuals||[]).forEach(v=>chk(v.src));(p.harmonica||[]).forEach(h=>chk(h.src)); });
    return {b,u};
  })()`);
  console.log('\nמצב מקומי סופי: ' + localState.b + ' base64 · ' + localState.u + ' URLs (מהענן)');

  const badPush = pushes.some(p => p.base64 > 0);
  console.log(badPush
    ? '\n✗ נמצאה דחיפת base64 — הלקוח המיושן עדיין דורס את הענן!'
    : '\n✓ אף דחיפה לא הכילה base64 — הקוד החדש מגן על הענן מלקוח מיושן');
  process.exit(badPush ? 1 : 0);
})().catch(e => { console.error('✗ שגיאה:', e); process.exit(1); });
