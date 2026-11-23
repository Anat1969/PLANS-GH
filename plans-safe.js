/* ══════════════════════════════════════════════════════════════════
   plans-safe.js: כל מה שעולה גם נשמר (ענת, 23.11.2026: "הבאתי תמונה, וכשריעננתי היא לא הופיעה").
   שתי תקלות נסגרות כאן, בלי לשנות את מנגנון השמירה הקיים:
   1. כשהענן לא זמין, תמונה נשמרת כטקסט ארוך בתוך הנתונים. localStorage קטן מדי, והשמירה נכשלה בשקט.
      עכשיו כל שמירה נכתבת גם ל-IndexedDB (מקום גדול). בטעינה, אם העותק שם חדש יותר, הוא משוחזר.
   2. בטעינה הענן דרס שינוי מקומי שעוד לא הגיע אליו (רענון מהיר, או ענן שנכשל).
      עכשיו תוכנית עם שינוי שלא סונכרן מסומנת, והענן לא דורס אותה: היא נדחפת לענן בהזדמנות הראשונה.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const DIRTY_KEY = 'ashdod_dirty_v1', NEED_KEY = 'ashdod_safe_need', DB = 'ashdod_plans_safe', STORE = 'kv';
let ready = false;   // עד שנבדק העותק שבמכשיר לא כותבים עליו: שמירות של תחילת הטעינה היו דורסות אותו
const say = m => { try{ toast(m); }catch(e){} };

/* ── IndexedDB: עותק מלא של הנתונים ── */
function idb(){ return new Promise((ok, no) => { try{ const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }catch(e){ no(e); } }); }
async function idbSet(k, v){ const d = await idb(); return new Promise((ok, no) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, k); t.oncomplete = ok; t.onerror = () => no(t.error); }); }
async function idbGet(k){ const d = await idb(); return new Promise((ok, no) => { const q = d.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); }

/* ── סימון תוכניות עם שינוי שעוד לא הגיע לענן ── */
function dirtyGet(){ try{ return new Set(JSON.parse(localStorage.getItem(DIRTY_KEY) || '[]')); }catch(e){ return new Set(); } }
function dirtyPut(set){ try{ localStorage.setItem(DIRTY_KEY, JSON.stringify([...set])); }catch(e){} }
function dirtyRecalc(recs){
  if(typeof _syncBase === 'undefined' || !_syncBase.size) return;         // עוד אין בסיס השוואה מהענן
  const set = new Set(); recs.forEach(r => { if(_syncBase.get(r.__key) !== JSON.stringify(r)) set.add(r.__key); }); dirtyPut(set);
}

let warned = false, idbTimer = null;
function afterSave(t0){
  let recs; try{ recs = buildPlanRecords(); }catch(e){ return; }
  const payload = { savedAt:new Date().toISOString(), plans:recs };
  if(!ready) return;
  clearTimeout(idbTimer); idbTimer = setTimeout(() => idbSet(STORAGE_KEY, payload).catch(() => {}), 250);   // עותק מלא, בלי מגבלת גודל
  try{ dirtyRecalc(recs); }catch(e){}
  // האם השמירה ל-localStorage באמת נכתבה? אם לא, מודיעים ושומרים לענן מיד
  try{ const s = localStorage.getItem(STORAGE_KEY) || '', at = Date.parse((s.match(/"savedAt":"([^"]+)"/) || [])[1] || 0);
    if(at >= t0 - 20){ localStorage.removeItem(NEED_KEY); }   // נכתב עכשיו: השמירה הרגילה הצליחה
    else { try{ localStorage.setItem(NEED_KEY, payload.savedAt); }catch(e){}   // סימן קטן: בטעינה הבאה משחזרים מהעותק הגדול
      if(!warned){ warned = true; say('הנתונים גדולים מהמקום הרגיל בדפדפן. הם נשמרים במקום גדול יותר במכשיר, וגם בענן'); }
      try{ cloudSaveNow(); }catch(e){} } }catch(e){}
}
/** משחזר לתוך plans את העותק המלא שנשמר במכשיר. נקרא רק כשהשמירה הרגילה נכשלה בפעם הקודמת */
function restore(payload){
  if(!payload || !Array.isArray(payload.plans)) return 0;
  const byKey = {}; plans.forEach(p => byKey[planKey(p)] = p); let n = 0;
  payload.plans.forEach(rec => { if(!rec || !rec.__key) return; const ex = byKey[rec.__key];
    if(ex){ let ch = false; PERSIST_FIELDS.forEach(f => { if(rec[f] !== undefined && JSON.stringify(ex[f]) !== JSON.stringify(rec[f])){ ex[f] = rec[f]; ch = true; } }); if(ch) n++; }
    else { const np = { ...rec, id:plans.length }; delete np.__key; plans.push(np); n++; } });
  if(n){ const d = dirtyGet(); payload.plans.forEach(r => r && r.__key && d.add(r.__key)); dirtyPut(d); }   // מה ששוחזר עוד לא בענן
  return n;
}
function refreshUI(){ try{ if(typeof applyFilters === 'function') applyFilters(); }catch(e){} try{ const a = document.querySelector('.page.active'); if(a && a.id === 'landing' && typeof renderLanding === 'function') renderLanding();
  if(a && a.id === 'projectPage' && typeof pj === 'function' && pj()){ const p = pj(); ['renderGraphicsTab','renderDocsTab','renderInfoTab'].forEach(f => { try{ if(typeof window[f] === 'function') window[f](p); }catch(e){} }); } }catch(e){} }

function boot(){
  if(typeof plans === 'undefined' || typeof savePlans !== 'function' || typeof mergeRemoteFields !== 'function' || typeof STORAGE_KEY === 'undefined') return setTimeout(boot, 40);
  const _save = window.savePlans; window.savePlans = function(){ const t0 = Date.now(), r = _save.apply(this, arguments); try{ afterSave(t0); }catch(e){} return r; };
  // הענן לא דורס תוכנית עם שינוי מקומי שעוד לא סונכרן
  const _merge = window.mergeRemoteFields; window.mergeRemoteFields = function(existing, remote){
    try{ if(remote && remote.__key && dirtyGet().has(remote.__key)) return; }catch(e){}
    return _merge.apply(this, arguments); };
  const _load = window.cloudLoad; if(typeof _load === 'function') window.cloudLoad = async function(){ const r = await _load.apply(this, arguments);
    try{ if(r === true && dirtyGet().size){ _cloudDirty = true; scheduleCloudSave(); } }catch(e){} return r; };
  const _push = window.cloudSaveNow; if(typeof _push === 'function') window.cloudSaveNow = async function(){ const r = await _push.apply(this, arguments);
    try{ dirtyRecalc(buildPlanRecords()); }catch(e){} return r; };
  // ביציאה מהדף: שמירה אחרונה, ודחיפה לענן בלי לחכות
  const flush = () => { try{ if(typeof _cloudDirty !== 'undefined' && _cloudDirty) window.cloudSaveNow(); }catch(e){} };
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') flush(); }); window.addEventListener('pagehide', flush);
  // שחזור מהעותק הגדול שבמכשיר, אם הוא חדש יותר
  const need = (() => { try{ return localStorage.getItem(NEED_KEY); }catch(e){ return null; } })();
  idbGet(STORAGE_KEY).then(p => { const n = need ? restore(p) : 0; ready = true;
    if(n){ refreshUI(); say(`שוחזרו ${n} תוכניות עם שינויים שנשמרו במכשיר`); try{ window.savePlans(); }catch(e){} } }).catch(() => { ready = true; });
}
const api = { restore, dirtyGet };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else { window.PlanSafe = api; boot(); }
})();
