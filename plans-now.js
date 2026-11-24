/* ══════════════════════════════════════════════════════════════════
   plans-now.js: "איפה אנחנו עומדים?" (ענת, 24.11.2026). מרכז העבודה היומי.
   הדף הוא תצוגה של הנתונים האמיתיים, לא מאגר נוסף: כל פריט מחושב ב-plans-ops-core.js
   מאותן תוכניות שכל המסכים קוראים, וכל החלטה נכתבת לאותם שדות (meet, status, actionLog).
   - שבע קומות: תמונת הבוקר, מחייב החלטה, מוכן לאישור, המערכת מטפלת, ממתינים, נערכים, נעשה.
   - "התחלת עבודה": רצף של ההחלטות והאישורים לפי עדיפות, בתוך מסגרת זמן, עם עצירה וחידוש.
   - קישור ישיר לכל פעולה, וכפתור חזרה צהוב ששומר את המקום ואת הרצף.
   - ניהול האוטומציות (השהיה, פרמטרים), היסטוריית השרת, זיכרון ומדדים: באזור משני מקופל.
   מצב המשתמשת (השהיות, דחיות, הסשן, הזיכרון) נשמר ב-ashdod_muni, בשורה ops_user.
   תוצאות השרת (Action מתוזמן) נקראות מהשורה ops_server. הדף לא כותב אליה.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const O = window.PlanOps; if(!O) return;
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const B = s => H(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const T = () => (typeof todayStr === 'function' ? todayStr() : O.todayIL());
const LS_USER = 'ashdod_ops_user', SS_RET = 'ashdod_ops_return', SS_SES = 'ashdod_ops_session';
let USER = { snooze:{}, delegated:{}, paused:{}, params:{}, memory:[], metrics:{}, lastVisit:'' };
let SERVER = null, SERVER_ERR = '', R = null, OPEN = {};

/* ══════════ מצב המשתמשת: מקומי וענן ══════════ */
function loadUserLocal(){ try{ const u = JSON.parse(localStorage.getItem(LS_USER) || 'null'); if(u) USER = Object.assign(USER, u); }catch(e){} }
function hdr(){ return (typeof SB_HEADERS !== 'undefined') ? SB_HEADERS : null; }
function sbUrl(){ return (typeof SB_URL !== 'undefined') ? SB_URL : ''; }
async function cloudRow(id){
  const h = hdr(); if(!h) throw new Error('אין חיבור לענן');
  const r = await fetch(sbUrl() + '/rest/v1/ashdod_muni?select=data,updated_at&id=eq.' + id, { headers:h });
  if(!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); return j[0] || null;
}
let _uTimer = null;
function saveUser(){
  USER.updatedAt = new Date().toISOString();
  try{ localStorage.setItem(LS_USER, JSON.stringify(USER)); }catch(e){}
  clearTimeout(_uTimer); _uTimer = setTimeout(async () => {
    const h = hdr(); if(!h) return;
    try{ const r = await fetch(sbUrl() + '/rest/v1/ashdod_muni?on_conflict=id', { method:'POST', headers:Object.assign({}, h, { Prefer:'resolution=merge-duplicates,return=minimal' }),
      body:JSON.stringify([{ id:'ops_user', data:USER, updated_at:USER.updatedAt }]) }); if(!r.ok) throw new Error('HTTP ' + r.status); }
    catch(e){ console.warn('ops_user save', e); if(typeof toast === 'function') toast('שמירת מצב העבודה לענן נכשלה. נשמר בדפדפן.'); }
  }, 600);
}
async function loadCloud(){
  try{ const u = await cloudRow('ops_user'); if(u && u.data && (!USER.updatedAt || String(u.data.updatedAt||'') > String(USER.updatedAt||''))){ USER = Object.assign(USER, u.data); try{ localStorage.setItem(LS_USER, JSON.stringify(USER)); }catch(e){} } }catch(e){}
  try{ const s = await cloudRow('ops_server'); SERVER = s && s.data || null; SERVER_ERR = SERVER ? '' : 'השרת עוד לא רץ'; }catch(e){ SERVER = null; SERVER_ERR = 'לא זמין: ' + e.message; }
}

/* ══════════ חישוב ══════════ */
const live = () => (typeof livePlans === 'function' ? livePlans() : plans.filter(p => !p._deleted));
function contactsFor(p){ try{ return (typeof projectContacts === 'function' ? projectContacts(p.tik) : []).map(c => ({ name:c.name, email:c.email, phone:c.phone, type:c.type, org:c.org||c.company })); }catch(e){ return []; } }
/* מטרת התב"ע מההוראות (data/taba/<תיק>.json), עם ציטוט ומקור. נטען פעם אחת לתוכניות בטיפול. */
const GOALS = {};
function goalFor(p){ return GOALS[String(p.tik)] || null; }
async function loadGoals(){
  const tiks = live().filter(O.isActive).map(p => String(p.tik)).filter(t => !(t in GOALS));
  await Promise.all(tiks.map(async t => { GOALS[t] = null; try{ const r = await fetch('data/taba/' + t + '.json'); if(!r.ok) return; const j = await r.json();
    if(j.purpose && j.purpose.text) GOALS[t] = { text:j.purpose.text, src:`מטרת ${j.taba || 'התב"ע'}${j.purpose.page ? ', עמ\' ' + j.purpose.page : ''} בהוראות` }; }catch(e){} }));
}
function compute(){ R = O.compute(live(), { today:T(), user:USER, contactsFor, goalFor, lastVisit:USER.lastVisit, ledger: SERVER && SERVER.ledger }); return R; }
const P = tik => plans.find(p => String(p.tik) === String(tik) && !p._deleted);

/* ══════════ ביצוע החלטות ופעולות המשך ══════════ */
const SRC = 'איפה אנחנו עומדים';
/** פעולת המשך שהמערכת ביצעה לבד: נרשמת ביומן התוכנית בשם "המערכת", עם המקור */
function sysLog(p, text){ if(typeof logAction === 'function') logAction(p, 'system', text, { by:'המערכת', src:SRC }); }
/** הפעולה האחרונה ביומן (שנרשמה ע"י הפונקציה הקיימת) מקבלת את המקור, כדי שיהיה ברור מאיפה הגיעה */
function tagLast(p, n){ const L = p && p.actionLog; if(!Array.isArray(L)) return; L.slice(-(n || 1)).forEach(a => { if(!a.src) a.src = SRC; }); }
/** תיעוד של כל החלטה, בשלוש שכבות (ענת, 24.11.2026: "אני לא רואה שאתה מתעד את השינוי"):
    1. יומן התוכנית (actionLog), עם מי, מתי ומאיפה. 2. ההחלטות של התוכנית (p.decisions), עם ההקשר וההמלצה. 3. הזיכרון המקצועי (ops_user.memory). */
function record(p, it, opt, res, val){
  const n = new Date(), time = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  const label = ((it.options || []).find(o => o.id === opt) || {}).label || ({ snooze:'לא היום', delegate:'האצלה' })[opt] || opt;
  const entry = { at:T(), time, by:(typeof actorName === 'function' ? actorName() : 'אדריכלית העיר'), src:SRC, kind:it.kind, key:it.key,
    question:it.title, choice:label, input: typeof val === 'string' ? val.slice(0, 300) : '', result:res, why:it.why || '', rec:it.rec || '' };
  if(p){ if(!Array.isArray(p.decisions)) p.decisions = []; p.decisions.push(Object.assign({ text:`${it.title}: ${label}. ${res}` }, entry)); }
  remember(it, `${it.title}: ${label}. ${res}`, { at:T(), time, choice:label });
  USER.journal = Array.isArray(USER.journal) ? USER.journal.slice(-200) : [];
  USER.journal.push(Object.assign({ tik:it.tik || '', plan:it.plan || '' }, entry));
}
function markDone(p, key, extra){ if(!p.opsDone) p.opsDone = {}; p.opsDone[key] = Object.assign({ at:T(), by:'אדריכלית העיר' }, extra || {}); }
function remember(it, text, extra){
  USER.memory = Array.isArray(USER.memory) ? USER.memory : [];
  USER.memory.push(Object.assign({ id:'m'+Date.now().toString(36), kind:it.kind, tik:it.tik || '', plan:it.plan || '', text, at:T(), src:'החלטה במצב עבודה', scope:'נקודתי', valid:true }, extra || {}));
}
function metric(k, n){ USER.metrics = USER.metrics || {}; USER.metrics[k] = (USER.metrics[k] || 0) + (n || 1); }
function hiddenField(id, tag, val){ let el = document.getElementById(id); if(!el){ el = document.createElement(tag); el.id = id; el.style.display = 'none'; document.body.appendChild(el); } el.value = val || ''; return el; }
function openMail(m){ const q = 'subject=' + encodeURIComponent(m.subject||'') + '&body=' + encodeURIComponent(m.body||''); location.href = 'mailto:' + encodeURIComponent(m.to||'').replace(/%2C/g, ',') + '?' + q; }

/** מבצע את האפשרות שנבחרה. מחזיר שורת סיכום של מה שבוצע, או null אם נכשל. */
function act(it, opt, val){
  const p = it.tik ? P(it.tik) : null, done = [];
  try{
    if(opt === 'held' && p){
      hiddenField(`mtSum_${p.id}_${it.meetKey}`, 'textarea', val);
      window.meetHeld(p.id, it.meetKey); tagLast(p);
      done.push('סומן "התקיים"');
      // תגובת שרשרת (אוטומטית מותנית): אומדן לשלב הבא שמוקדם מהפגישה הזו, או שחלף, מתעדכן
      const m = O.MEET.find(x => x.key === it.meetKey), nx = m && O.MEET.find(x => x.key === m.next);
      if(nx){ const cur = nx.get(p), est = p._est && p._est[nx.key];
        if(est && (!cur || cur <= it.date || cur < T())){ const sug = O.mondayAfter(it.date > T() ? it.date : T(), 21);
          window.MEET.find(x => x.key === nx.key).set(p, sug); p._est[nx.key] = 1;
          sysLog(p, `אומדן ${nx.label} עודכן ל-${O.fmt(sug)}, אחרי ${m.label}. זה אומדן, לא מועד שנקבע.`); done.push(`אומדן ${nx.label}: ${O.fmt(sug)}`); } }
      done.push('סיכום לצוות מוכן לאישורך');
    } else if((opt === 'missed' || opt === 'setdate') && p){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(val||'')){ toast('בחרי תאריך'); return null; }
      hiddenField(`mtNew_${p.id}_${it.meetKey}`, 'input', val);
      window.meetReschedule(p.id, it.meetKey); tagLast(p);
      done.push(`המועד נקבע ל-${O.fmt(val)}`, 'לוח השנה וציר הזמן עודכנו');
    } else if(opt === 'mail' && p){
      openMail(it.mail); markDone(p, it.baseKey || it.key, { kind:it.kind, to:it.mail.to });
      sysLog(p, `נפתחה טיוטה: ${it.mail.subject}${it.mail.to ? ' ('+it.mail.to+')' : ' (בלי נמען)'}`);
      if(typeof savePlans === 'function') savePlans(); done.push('נפתחה טיוטה', it.kind === 'reminder' ? `תזכורת נוספת תוכן בעוד ${R.params.reminderRepeatDays} ימים, אם אין תשובה` : 'נרשם ביומן');
    } else if(opt === 'skip' && p){ markDone(p, it.key, { skip:true }); if(typeof savePlans === 'function') savePlans(); done.push('סומן "לא נדרש"'); }
    else if(opt === 'intent' && p){
      const v = String(val||'').trim(); if(!v){ toast('כתבי משפט אחד'); return null; }
      p.intent = { text:v, at:T(), by:'אדריכלית העיר', src: v === it.suggest ? 'אושר מתוך התיק' : 'נוסח ידנית' };
      sysLog(p, 'המטרה התכנונית נשמרה: ' + v.slice(0, 120)); done.push('המטרה נשמרה בתיק ובזיכרון');
    } else if(opt === 'status'){
      const sel = val || {}; let n = 0;
      (it.plans || []).forEach(x => { const v = sel[x.tik]; const q = P(x.tik); if(!v || !q) return; q.status = v; q.updatedAt = T(); if(typeof logAction === 'function') logAction(q, 'status', `סטטוס נקבע: ${v}`, { src:SRC });
        if(!Array.isArray(q.decisions)) q.decisions = []; q.decisions.push({ at:T(), by:(typeof actorName === 'function' ? actorName() : 'אדריכלית העיר'), src:SRC, kind:'no_status', text:`סטטוס נקבע: ${v}`, rec:x.sug === v ? 'לפי ההמלצה' : 'שונה מההמלצה (' + x.sug + ')' }); n++; });
      if(!n){ toast('לא נבחר סטטוס'); return null; } if(typeof savePlans === 'function') savePlans(); done.push(`${n} סטטוסים נקבעו`);
    } else if(opt === 'snooze'){ USER.snooze[it.key] = O.addDays(T(), 1); done.push('נדחה למחר'); }
    else if(opt === 'delegate'){
      const c = val; if(!c || !c.email){ toast('בחרי איש קשר עם מייל'); return null; }
      openMail({ to:c.email, subject:`לטיפולך: ${it.title}`, body:`שלום ${c.name},\n\n${it.title}\n${it.why}\n\nההמלצה: ${it.rec||''}\n\nנודה לעדכון עד ${O.fmt(O.addDays(T(), 5))}.\n\nאדריכלית העיר, עיריית אשדוד` });
      USER.delegated[it.key] = { to:c.name, at:T() }; if(p) sysLog(p, `הואצל ל${c.name}: ${it.title}`); done.push(`הואצל ל${c.name}`, 'עובר ל"ממתינים לאחרים"');
    } else if(opt === 'heldAll' && p){
      (it.meetKeys || []).forEach(k => { hiddenField(`mtSum_${p.id}_${k}`, 'textarea', 'אושר שהתקיים, כי אבן דרך מאוחרת יותר כבר נקבעה'); window.meetHeld(p.id, k); tagLast(p); });
      done.push(`${(it.meetKeys || []).length} מועדים סומנו "התקיים"`);
    } else if(opt === 'contacts'){ navTo({ page:'contacts' }); return 'nav'; }
    else if(opt === 'prep' && p){ showPrep(p, it.meetKey); return 'nav'; }
    else if(opt === 'open'){ navTo(it.link); return 'nav'; }
    else return null;
  }catch(e){ console.warn('ops act', e); toast('הפעולה לא הושלמה: ' + e.message); return null; }
  try{ record(p, it, opt, done.join(' · '), val); if(p && typeof savePlans === 'function') savePlans(); }catch(e){ console.warn('ops record', e); }
  OPEN['tier:done'] = true;
  metric(opt === 'snooze' ? 'snoozed' : opt === 'delegate' ? 'delegated' : it.tier === 'approve' ? 'approved' : 'decided');
  metric('chain', Math.max(0, done.length - 1));
  saveUser();
  return done.join(' · ');
}

/* ══════════ ניווט ישיר ושמירת הקשר ══════════ */
function navTo(link, fromSession){
  if(!link) return;
  try{ sessionStorage.setItem(SS_RET, JSON.stringify({ scroll:window.scrollY, open:OPEN, session: fromSession ? 1 : 0, at:Date.now() })); }catch(e){}
  closeMode(true);
  if(link.tik){ const p = P(link.tik); if(p){ openProject(p.id); if(link.tab) setTimeout(() => { try{ ppTabByName(link.tab); }catch(e){} }, 120); } }
  else if(link.page) go(link.page, typeof navBtn === 'function' ? navBtn(link.page) : null);
  setTimeout(backBtn, 50);
}
function backBtn(){
  let b = document.getElementById('opsBack'); const ret = (() => { try{ return JSON.parse(sessionStorage.getItem(SS_RET) || 'null'); }catch(e){ return null; } })();
  const cur = document.querySelector('.page.active'); const show = ret && cur && cur.id !== 'now';
  if(!b){ b = document.createElement('button'); b.id = 'opsBack'; b.className = 'ops-back no-print'; b.onclick = goBackNow; document.body.appendChild(b); }
  b.textContent = ret && ret.session ? 'חזרה לרצף העבודה' : 'חזרה ל"איפה אנחנו עומדים"'; b.hidden = !show;
}
function goBackNow(){
  let ret = null; try{ ret = JSON.parse(sessionStorage.getItem(SS_RET) || 'null'); sessionStorage.removeItem(SS_RET); }catch(e){}
  go('now', typeof navBtn === 'function' ? navBtn('now') : null);
  if(ret){ OPEN = ret.open || {}; render(); setTimeout(() => window.scrollTo({ top:ret.scroll || 0 }), 30); if(ret.session) resumeMode(); }
  backBtn();
}

/* ══════════ רינדור ══════════ */
const TIER_NUM = { decide:'02', approve:'03', system:'04', waiting:'05', upcoming:'06', done:'07' };
function chip(it){
  const d = it.due ? `<span class="nw-due${it.due < R.today ? ' late' : ''}">${it.due < R.today ? 'באיחור ' + O.days(it.due, R.today) + ' ימים' : O.fmt(it.due)}</span>` : '';
  return `${d}<span class="nw-lv nw-lv${it.level}" title="רמת אוטונומיה">${H(it.levelName)}</span>`;
}
function storyHTML(tik){
  const s = R.stories[tik]; if(!s) return '';
  return `<dl class="nw-story">
    <dt>ההקשר והמטרה</dt><dd>${H(s.goal || 'לא מתועדת')} <small>${H(s.goalSrc)}</small></dd>
    <dt>הפעולה האחרונה</dt><dd>${H(s.last)}</dd>
    <dt>מה השתנה</dt><dd>${H(s.change)}</dd>
    <dt>המצב עכשיו</dt><dd>${H(s.now)}</dd>
    <dt>הפעולה הבאה</dt><dd><b>${H(s.next)}</b></dd>
    <dt>באחריות</dt><dd>${H(s.owner)}</dd>
    <dt>מה ייגזר ממנה</dt><dd>${H(s.after)}</dd></dl>`;
}
function itemBody(it, inMode){
  const fx = it.factors ? Object.entries(it.factors).filter(([, v]) => v).map(([k, v]) => `${({urgency:'דחיפות',impact:'השפעה',blocking:'חוסם',commit:'התחייבות',spread:'תוכניות נוספות',defer:'מחיר דחייה',needsMe:'דורש אותך',effort:'משך'})[k]} ${v > 0 ? '+' : ''}${v}`).join(' · ') : '';
  return `<div class="nw-body">
    <p class="nw-why"><span>למה עכשיו</span>${H(it.why)}</p>
    ${it.context ? `<p class="nw-ctx"><span>הקשר</span>${H(it.context).replace(/\n/g, '<br>')}</p>` : ''}
    ${it.prepared ? `<p class="nw-prep"><span>מה הכנתי</span>${H(it.prepared)}</p>` : ''}
    ${it.condition ? `<p class="nw-ctx"><span>תנאי</span>${H(it.condition)}</p>` : ''}
    ${it.precedent ? `<p class="nw-ctx"><span>תקדים</span>${H(it.precedent)}</p>` : ''}
    ${it.rec ? `<p class="nw-rec"><span>ההמלצה</span><b>${H(it.rec)}</b></p>` : ''}
    ${(it.options && it.options.length) ? optionsHTML(it, inMode) : ''}
    ${it.after && !inMode ? `<p class="nw-after"><span>אחרי ההחלטה</span>${H(it.after)}</p>` : ''}
    ${it.tik && !inMode ? `<details class="nw-sfold"><summary>הסיפור של התוכנית</summary>${storyHTML(it.tik)}</details>` : ''}
    <p class="nw-meta">${H(it.src || '')}${fx ? ' · עדיפות ' + it.score + ': ' + H(fx) : ''}</p></div>`;
}
function optionsHTML(it, inMode){
  const k = H(it.key), id = 'o' + Math.abs(hash(it.key));
  const opts = it.options.map(o => {
    let inp = '';
    if(o.input === 'summary') inp = `<textarea id="${id}_${o.id}" rows="2" placeholder="שורה של סיכום: מה הוחלט, מה המועד הבא"></textarea>`;
    if(o.input === 'date') inp = `<input type="date" id="${id}_${o.id}" value="${H(o.suggest||'')}">`;
    if(o.input === 'text') inp = `<textarea id="${id}_${o.id}" rows="2">${H(o.suggest||'')}</textarea>`;
    if(o.input === 'status') inp = `<div class="nw-st" id="${id}_${o.id}">${(it.plans||[]).map(x => `<label>${H(x.name)} <select data-tik="${H(x.tik)}"><option value="">—</option>${['הושלם','בטיפול','בהמתנה','בוטל'].map(v => `<option${v === x.sug ? ' selected' : ''}>${v}</option>`).join('')}</select></label>`).join('')}<small>מסומן מראש לפי ההמלצה. אפשר לשנות.</small></div>`;
    return `<div class="nw-opt">${inp}<button class="btn${o.primary ? ' btn-primary' : ' btn-ghost'} btn-sm" onclick="NowPage.do('${k}','${o.id}','${id}_${o.id}')">${H(o.label)}</button></div>`;
  }).join('');
  const people = it.tik ? contactsFor(P(it.tik) || {}).filter(c => c.email) : [];
  const extra = `<div class="nw-opt nw-sec">
    ${it.link ? `<button class="btn btn-ghost btn-sm" onclick="NowPage.go('${k}')">${it.link.tab ? 'לעריכה במקום' : 'למסך'}</button>` : ''}
    ${!it.options.some(o => o.id === 'snooze') ? `<button class="btn btn-ghost btn-sm" onclick="NowPage.do('${k}','snooze')">לא היום</button>` : ''}
    ${people.length ? `<select id="${id}_dl"><option value="">האצלה ל...</option>${people.map((c, i) => `<option value="${i}">${H(c.name)}</option>`).join('')}</select><button class="btn btn-ghost btn-sm" onclick="NowPage.do('${k}','delegate','${id}_dl')">האצלה</button>` : ''}</div>`;
  return `<div class="nw-opts">${opts}${extra}</div>`;
}
function hash(s){ let h = 0; for(const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
function rowHTML(it, big){
  const open = OPEN[it.key];
  return `<li class="nw-row${big ? ' big' : ''}${open ? ' open' : ''}" data-k="${H(it.key)}">
    <button class="nw-line" onclick="NowPage.toggle('${H(it.key)}')"><span class="nw-t">${H(it.title)}</span>${it.plan && !it.title.includes(it.plan) ? `<span class="nw-pl">${H(it.plan)}</span>` : ''}${it.who ? `<span class="nw-pl">${H(it.who)}</span>` : ''}${chip(it)}</button>
    ${open ? itemBody(it) : ''}</li>`;
}
function serverLine(){
  if(!SERVER) return `<span class="nw-srv off">המערכת ברקע: ${H(SERVER_ERR || 'לא נבדק')}</span>`;
  const l = SERVER.lastRun || {}, t = l.at ? new Date(l.at) : null;
  const when = t ? t.toLocaleString('he-IL', { timeZone:'Asia/Jerusalem', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
  return `<span class="nw-srv${l.status === 'ok' ? '' : ' off'}">בדיקה אחרונה ברקע: <b>${when}</b>${l.status === 'ok' ? '' : ', נכשלה'}</span>`;
}
function render(){
  const box = document.getElementById('nowBody'); if(!box) return;
  if(typeof isDeveloper === 'function' && isDeveloper()){ box.innerHTML = '<div class="nw"><h1>איפה אנחנו עומדים?</h1><p>הדף הזה שייך לאדריכלית העיר.</p></div>'; return; }
  compute();
  const focusKeys = new Set(R.focus.map(i => i.key));
  const todayLog = R.tiers.done.filter(d => d.at === R.today);
  if(OPEN['tier:done'] === undefined && todayLog.length) OPEN['tier:done'] = true;
  const ro = typeof isManager === 'function' && isManager();
  const ses = readSession();
  const tiers = O.TIERS.map(([k, name, sub]) => {
    const list = k === 'done' ? R.tiers.done : R.tiers[k].filter(i => !focusKeys.has(i.key));
    const body = k === 'done'
      ? (list.length ? `<ul class="nw-log">${list.map(d => `<li><span>${O.fmt(d.at)}${d.time ? ' ' + H(d.time) : ''}</span> ${H(d.plan)}: ${H(d.text)} <small class="${d.sys ? 'sys' : 'who'}">${H(d.sys ? 'המערכת' : (d.by || 'לא ידוע'))}${d.src ? ' · ' + H(d.src) : ''}</small></li>`).join('')}</ul>` : '<p class="nw-empty">לא נרשמה פעולה בשבועיים האחרונים.</p>')
      : (list.length ? `<ul class="nw-list">${list.map(i => rowHTML(i)).join('')}</ul>` : `<p class="nw-empty">${k === 'decide' ? 'אין החלטה נוספת שמחכה לך.' : k === 'approve' ? 'אין תוצר נוסף שמחכה לאישור.' : k === 'upcoming' ? `אין פגישה ב-${R.params.upcomingDays} הימים הקרובים.` : 'אין.'}</p>`);
    const n = k === 'done' ? list.length : list.length;
    return `<details class="nw-tier nw-${k}"${OPEN['tier:'+k] ? ' open' : ''} ontoggle="NowPage.tier('${k}',this.open)"><summary><span class="nw-num">${TIER_NUM[k]}</span><span class="nw-tn">${H(name)}</span><small>${H(sub)}</small><b>${n}</b></summary>${body}</details>`;
  }).join('');
  const stories = Object.keys(R.stories).map(tik => { const s = R.stories[tik], p = P(tik);
    return `<li><b>${H(O.planName(p))}</b>. ${H(s.goal ? 'המטרה: '+s.goal.slice(0, 90)+(s.goal.length > 90 ? '…' : '')+'. ' : '')}${H(s.last)}. ${H(s.now)}. <b>הבא: ${H(s.next)}</b> (${H(s.owner)}).</li>`; }).join('');
  box.innerHTML = `<div class="nw">
    <header class="nw-head">
      <div><h1>איפה אנחנו עומדים?</h1><p class="nw-insight">${H(R.morning.head)}</p>${serverLine()}</div>
      ${ro ? '' : `<div class="nw-start">
        <div class="nw-budget" role="radiogroup" aria-label="מסגרת זמן">${[5, 15, 30, 60].map(m => `<button class="${(USER.budget || 15) === m ? 'on' : ''}" onclick="NowPage.budget(${m})">${m} דק'</button>`).join('')}</div>
        <button class="btn btn-primary nw-go" onclick="NowPage.start()">${ses && ses.queue && ses.idx < ses.queue.length ? 'המשך העבודה' : 'התחלת עבודה'}</button></div>`}
    </header>
    <section class="nw-morning"><span class="nw-num">01</span><div><h2>תמונת הבוקר</h2>${R.morning.lines.map(l => `<p>${B(l)}</p>`).join('')}${todayLog.length ? `<p>${B(`היום תועדו **${todayLog.length}** פעולות: ${todayLog.filter(d => !d.sys).length} שלך ו-${todayLog.filter(d => d.sys).length} של המערכת. הפירוט ב"מה כבר נעשה".`)}</p>` : ''}</div></section>
    <section class="nw-focus"><h2>${R.focus.length ? 'שלוש הפעולות החשובות' : 'אין פעולה שמחייבת אותך'}</h2>
      ${R.focus.length ? `<ul class="nw-list">${R.focus.map(i => rowHTML(i, true)).join('')}</ul>` : '<p class="nw-empty">המערכת ממשיכה לעקוב, ותעדכן כשמשהו ידרוש אותך.</p>'}</section>
    ${tiers}
    <details class="nw-tier nw-stories"${OPEN['tier:stories'] ? ' open' : ''} ontoggle="NowPage.tier('stories',this.open)"><summary><span class="nw-num">·</span><span class="nw-tn">הסיפור של כל תוכנית בטיפול</span><b>${Object.keys(R.stories).length}</b></summary><ul class="nw-stl">${stories}</ul></details>
    ${adminHTML()}
  </div>`;
}

/* ══════════ אזור ניהול משני: אוטומציות, השרת, זיכרון, מדדים, הצעות ══════════ */
function adminHTML(){
  const ro = typeof isManager === 'function' && isManager();
  const auto = O.AUTOMATIONS.map(a => {
    const paused = USER.paused[a.id], st = a.blocked ? 'חסום' : paused ? 'מושהה' : 'פעיל';
    const prm = a.param ? `<label class="nw-prm">${a.param === 'formReminderDays' ? 'ימים עד תזכורת' : 'ימי הכנה לפני פגישה'} <input type="number" min="1" max="60" value="${R.params[a.param]}" ${ro ? 'disabled' : ''} onchange="NowPage.param('${a.param}',this.value)"></label>` : '';
    return `<tr class="${a.blocked ? 'blk' : paused ? 'psd' : ''}"><td><b>${H(a.name)}</b><details><summary>פירוט</summary>
      <p><span>טריגר</span>${H(a.trigger)}</p><p><span>תנאי</span>${H(a.condition)}</p><p><span>מקורות</span>${H(a.sources)}</p><p><span>הרשאות</span>${H(a.permissions)}</p>
      <p><span>פעולות</span>${H(a.actions)}</p><p><span>תוצאה צפויה</span>${H(a.expected)}</p><p><span>אימות</span>${H(a.verify)}</p><p><span>כשל</span>${H(a.onFail)}</p><p><span>חוזר</span>${H(a.repeat)}</p></details></td>
      <td>${a.runsOn === 'server' ? 'שרת' : 'דפדפן'}</td><td>${H(O.LEVEL[a.level])}</td><td><span class="nw-ast">${st}</span>${a.blocked ? `<small>${H(a.blocked)}</small>` : ''}${prm}</td>
      <td>${a.blocked || ro ? '' : `<button class="btn btn-ghost btn-sm" onclick="NowPage.pause('${a.id}')">${paused ? 'הפעלה' : 'השהיה'}</button>`}</td></tr>`;
  }).join('');
  const runs = (SERVER && SERVER.runs || []).slice(-8).reverse();
  const runsHTML = runs.length ? `<ul class="nw-log">${runs.map(r => `<li><span>${new Date(r.at).toLocaleString('he-IL', { timeZone:'Asia/Jerusalem', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span> ${r.status === 'ok' ? 'הצליחה' : r.status === 'skip' ? 'דולגה (הרצה כפולה)' : 'נכשלה: ' + H(r.error || '')}${r.status === 'ok' ? `, ${r.plans} תוכניות, ${r.items} פריטים, ${r.newItems || 0} חדשים, ${r.ms} מ"ש` : ''}${r.attempts > 1 ? `, ${r.attempts} ניסיונות` : ''}</li>`).join('')}</ul>` : `<p class="nw-empty">${H(SERVER_ERR || 'אין הרצות')}</p>`;
  const allRuns = SERVER && SERVER.runs || [], okRuns = allRuns.filter(r => r.status === 'ok').length;
  const M = USER.metrics || {}, detected = SERVER && SERVER.ledger ? Object.keys(SERVER.ledger).length : null;
  const prepared = R.items.filter(i => i.tier === 'approve' || i.tier === 'system').length;
  const saved = (M.approved || 0) * 4 + (M.decided || 0) * 3 + (M.chain || 0) * 2;
  const metrics = `<table class="nw-met"><tr><th>מדד</th><th>ערך</th><th>סוג</th></tr>
    <tr><td>הרצות של המערכת ברקע</td><td>${allRuns.length ? `${allRuns.length}, הצליחו ${okRuns} (${Math.round(okRuns*100/allRuns.length)}%)` : '—'}</td><td>נמדד</td></tr>
    <tr><td>פריטים שזוהו אוטומטית מאז ההפעלה</td><td>${detected == null ? '—' : detected}</td><td>נמדד</td></tr>
    <tr><td>החלטות ואישורים במצב עבודה</td><td>${(M.decided || 0) + (M.approved || 0)}</td><td>נמדד</td></tr>
    <tr><td>פעולות המשך שבוצעו לבד אחרי החלטה</td><td>${M.chain || 0}</td><td>נמדד</td></tr>
    <tr><td>האצלות ודחיות</td><td>${(M.delegated || 0)} · ${(M.snoozed || 0)}</td><td>נמדד</td></tr>
    <tr><td>תוצרים מוכנים כרגע (טיוטות, דפי הכנה, אומדנים)</td><td>${prepared}</td><td>נמדד</td></tr>
    <tr><td>זמן עבודה שנחסך</td><td>כ-${saved} דקות</td><td>הערכה: 4 דק' לאישור, 3 להחלטה, 2 לפעולת המשך</td></tr>
    <tr><td>עלות הפעלה</td><td>0 ₪</td><td>GitHub Actions ו-Supabase בתוכנית החינמית. אין קריאה למודל AI.</td></tr></table>`;
  const mem = (USER.memory || []).slice(-12).reverse();
  const memHTML = mem.length ? `<ul class="nw-mem">${mem.map(m => `<li class="${m.valid === false ? 'off' : ''}"><span>${O.fmt(m.at)}</span> ${H(m.plan || '')}: ${H(m.text)} <small>${H(m.scope)} · ${H(m.src)}</small>
      ${ro ? '' : `<button class="btn btn-ghost btn-sm" onclick="NowPage.mem('${m.id}','valid')">${m.valid === false ? 'החזרה לתוקף' : 'לא בתוקף'}</button>${m.scope === 'נקודתי' ? `<button class="btn btn-ghost btn-sm" onclick="NowPage.mem('${m.id}','policy')">להפוך למדיניות</button>` : ''}`}</li>`).join('')}</ul>` : '<p class="nw-empty">הזיכרון מתמלא מכל החלטה במצב עבודה: מה הוחלט, מתי, ובאיזו תוכנית.</p>';
  const L = O.learn(live(), { today:T() });
  const learnHTML = L.length ? `<ul class="nw-mem">${L.map(x => `<li><b>${H(x.proposed)}</b><br><small>היום: ${H(x.now)} · חיסכון: ${H(x.saving)} · סיכון: ${H(x.risk)} · נדרש: ${H(x.need)}</small></li>`).join('')}</ul>` : '<p class="nw-empty">עוד לא זוהתה פעולה ידנית שחוזרת מספיק כדי להפוך לאוטומציה.</p>';
  const weekly = SERVER && SERVER.weekly ? `<details><summary>הסיכום השבועי מהשרת</summary><pre class="nw-pre">${H(SERVER.weekly.text)}</pre><button class="btn btn-ghost btn-sm" onclick="NowPage.copyWeekly()">העתקה</button></details>` : '';
  return `<details class="nw-admin"${OPEN['tier:admin'] ? ' open' : ''} ontoggle="NowPage.tier('admin',this.open)"><summary>ניהול: אוטומציות, הרצות, זיכרון ומדדים</summary>
    <h3>האוטומציות</h3><div class="nw-scroll"><table class="nw-auto"><tr><th>אוטומציה</th><th>רצה ב</th><th>רמה</th><th>מצב</th><th></th></tr>${auto}</table></div>
    <h3>המערכת ברקע</h3>${runsHTML}${weekly}
    <h3>מדדים</h3>${metrics}
    <h3>הזיכרון המקצועי</h3>${memHTML}
    <h3>הצעות לשיפור תהליך</h3>${learnHTML}</details>`;
}

/* ══════════ מצב עבודה רציף ══════════ */
function readSession(){ try{ return JSON.parse(localStorage.getItem(SS_SES) || 'null'); }catch(e){ return null; } }
function writeSession(s){ try{ s ? localStorage.setItem(SS_SES, JSON.stringify(s)) : localStorage.removeItem(SS_SES); }catch(e){} USER.session = s || null; saveUser(); }
function start(){
  compute(); const budget = USER.budget || 15; let t = 0;
  const q = R.items.filter(i => (i.tier === 'decide' || i.tier === 'approve') && i.options && i.options.length).filter(i => { const m = Math.max(1, i.minutes || 2); if(t + m > budget && t > 0) return false; t += m; return true; }).map(i => i.key);
  if(!q.length){ toast('אין כרגע החלטה או אישור שמחכים לך.'); return; }
  writeSession({ queue:q, idx:0, budget, startedAt:new Date().toISOString(), done:[] }); resumeMode();
}
function resumeMode(){ const s = readSession(); if(!s || !s.queue) return start(); drawMode(); }
function closeMode(keep){ const m = document.getElementById('nwMode'); if(m) m.remove(); if(!keep) render(); }
function drawMode(msg){
  const s = readSession(); if(!s) return; compute();
  while(s.idx < s.queue.length && !R.items.find(i => i.key === s.queue[s.idx])) s.idx++;
  let m = document.getElementById('nwMode'); if(!m){ m = document.createElement('div'); m.id = 'nwMode'; m.className = 'nw-mode'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); document.body.appendChild(m); }
  const used = Math.round((Date.now() - Date.parse(s.startedAt)) / 60000);
  if(s.idx >= s.queue.length){
    writeSession(null);
    m.innerHTML = `<div class="nw-mbox"><h2>סיימנו</h2><p>${s.done.length ? `<b>${s.done.length}</b> פעולות, ב-${used} דקות.` : 'לא בוצעה פעולה.'}</p>${s.done.length ? `<ul class="nw-log">${s.done.map(d => `<li>${H(d)}</li>`).join('')}</ul>` : ''}<p>${R.tiers.decide.length + R.tiers.approve.length ? `נשארו ${R.tiers.decide.length + R.tiers.approve.length} פריטים לפעם הבאה.` : 'אין עוד החלטה שמחכה לך.'}</p><button class="btn" onclick="NowPage.close()">חזרה לדף</button></div>`;
    return;
  }
  const it = R.items.find(i => i.key === s.queue[s.idx]);
  m.innerHTML = `<div class="nw-mbox">
    <div class="nw-mtop"><span><b>${s.idx + 1}</b> מתוך ${s.queue.length} · ${used} מתוך ${s.budget} דקות</span>
      <span><button class="btn btn-ghost btn-sm" onclick="NowPage.next()">דילוג</button><button class="btn btn-ghost btn-sm" onclick="NowPage.pauseMode()">עצירה</button></span></div>
    ${msg ? `<p class="nw-ok">${H(msg)}</p>` : ''}
    <p class="nw-mplan">${H(it.plan || '')}</p><h2>${H(it.title)}</h2>
    ${itemBody(it, true)}
    <p class="nw-after"><span>מה יקרה אחרי</span>${O.chainFor(it, (it.options[0] || {}).id).map(H).join(' · ')}</p>
    ${it.tik ? `<details class="nw-sfold"><summary>הסיפור של התוכנית</summary>${storyHTML(it.tik)}</details>` : ''}</div>`;
  m.querySelector('textarea, input, select, button.btn:not(.btn-ghost)')?.focus();
}

/* ══════════ ממשק לכפתורים ══════════ */
const find = k => R && R.items.find(i => i.key === k);
window.NowPage = {
  toggle(k){ OPEN[k] = !OPEN[k]; render(); },
  tier(k, open){ OPEN['tier:'+k] = open; },
  budget(m){ USER.budget = m; saveUser(); render(); },
  start, close(){ closeMode(); },
  next(){ const s = readSession(); if(!s) return; s.idx++; writeSession(s); drawMode(); },
  pauseMode(){ closeMode(); toast('הרצף נעצר. "המשך העבודה" יחזיר לאותה נקודה.'); },
  go(k){ const it = find(k); if(it) navTo(it.link, !!document.getElementById('nwMode')); },
  do(k, opt, elId){
    const it = find(k); if(!it) return;
    const el = elId && document.getElementById(elId); let val = el ? el.value : '';
    if(opt === 'status' && el){ val = {}; el.querySelectorAll('select').forEach(s => { if(s.value) val[s.dataset.tik] = s.value; }); }
    if(opt === 'delegate'){ const ppl = contactsFor(P(it.tik) || {}).filter(c => c.email); val = el && el.value !== '' ? ppl[+el.value] : null; }
    const inMode = !!document.getElementById('nwMode');
    const res = act(it, opt, val); if(res == null || res === 'nav') return;
    if(inMode){ const s = readSession(); if(s){ s.done.push(`${it.plan ? it.plan + ': ' : ''}${it.title}: ${res}`); s.idx++; writeSession(s); drawMode('בוצע ותועד ביומן התוכנית ובהחלטות: ' + res); } }
    else { toast('בוצע ותועד: ' + res); OPEN[k] = false; render(); }
  },
  pause(id){ USER.paused[id] = !USER.paused[id]; saveUser(); render(); },
  param(k, v){ const n = Math.max(1, Math.min(60, +v || 0)); USER.params[k] = n; saveUser(); render(); },
  mem(id, what){ const m = (USER.memory || []).find(x => x.id === id); if(!m) return;
    if(what === 'valid') m.valid = m.valid === false;
    if(what === 'policy'){ if(!confirm('להפוך את ההחלטה הנקודתית למדיניות שתוצע בכל התוכניות?')) return; m.scope = 'מדיניות'; m.approvedAt = T(); }
    saveUser(); render(); },
  copyWeekly(){ try{ navigator.clipboard.writeText(SERVER.weekly.text); toast('הועתק'); }catch(e){} },
  _compute: () => compute(), _act: act, _user: () => USER
};

/* ══════════ דף ההכנה לפגישה ══════════ */
function showPrep(p, key){
  compute(); const x = O.meetingPrep(p, key, R.items, { today:T(), contactsFor, goalFor });
  const L = (a, e) => a && a.length ? `<ul>${a.map(s => `<li>${H(s)}</li>`).join('')}</ul>` : `<p class="nw-empty">${e}</p>`;
  let m = document.getElementById('nwMode'); if(!m){ m = document.createElement('div'); m.id = 'nwMode'; m.className = 'nw-mode'; document.body.appendChild(m); }
  m.innerHTML = `<div class="nw-mbox nw-prepbox">
    <div class="nw-mtop"><span>דף הכנה · ${H(O.fmt(x.date))}${x.est ? ' (אומדן)' : ''}</span><span><button class="btn btn-ghost btn-sm" onclick="window.print()">הדפסה</button><button class="btn btn-ghost btn-sm" onclick="NowPage.close()">סגירה</button></span></div>
    <h2>${H(x.title)}</h2>
    <p class="nw-rec"><span>מה אני צריכה להשיג בפגישה הזו</span><b>${H(x.goal)}</b></p>
    <p class="nw-ctx"><span>המטרה של התוכנית</span>${H(x.intent || 'לא מתועדת')} <small>${H(x.intentSrc)}</small></p>
    <h3>משתתפים</h3>${L(x.people, 'לא שויכו אנשי קשר לתוכנית.')}
    <h3>החלטות קודמות</h3>${L(x.decisionsBefore, 'לא נרשמו החלטות.')}
    <h3>מה נעשה מאז</h3>${L(x.sinceThen, 'לא נרשמה פעולה מאז הפגישה הקודמת.')}
    <h3>חומרים</h3><p>התקבלו: ${H(x.received.join(', ') || 'אין')}. <b>חסרים: ${H(x.missing.join(', ') || 'אין')}</b>.</p>
    <h3>פתוח</h3>${L(x.open, 'אין החלטה פתוחה.')}
    <h3>שאלות להעלאה</h3>${L(x.questions, '')}
    <p class="nw-rec"><span>המלצה</span>${H(x.rec)}</p>
    <h3>אחרי הפגישה</h3><textarea id="nwSum" rows="4" placeholder="הדבקת הסיכום או התמלול"></textarea>
    <button class="btn btn-sm" onclick="NowPage.afterMeet(${p.id},'${key}')">חילוץ החלטות והתחייבויות</button><div id="nwSumOut"></div></div>`;
}
window.NowPage.afterMeet = function(pid, key){
  const p = plans.find(x => x.id === pid), t = (document.getElementById('nwSum') || {}).value || ''; if(!p || !t.trim()) return;
  const r = O.parseSummary(t);
  if(!Array.isArray(p.decisions)) p.decisions = [];
  r.decisions.forEach(d => p.decisions.push({ at:T(), text:d, src:'סיכום פגישה' }));
  if(!Array.isArray(p.notes)) p.notes = [];
  r.commitments.forEach(c => p.notes.push({ id:'n'+Date.now().toString(36)+Math.random().toString(36).slice(2, 5), tag:'לטיפול', text:c, at:new Date().toISOString(), by:'אדריכלית העיר', src:'סיכום פגישה' }));
  sysLog(p, `סיכום ${(O.MEET.find(m => m.key === key) || {}).label || 'פגישה'} נקלט: ${r.decisions.length} החלטות, ${r.commitments.length} התחייבויות`);
  if(typeof savePlans === 'function') savePlans();
  document.getElementById('nwSumOut').innerHTML = `<p class="nw-ok">נשמרו ${r.decisions.length} החלטות (בזיכרון התוכנית) ו-${r.commitments.length} התחייבויות (בהערות "לטיפול").</p>
    ${r.decisions.length ? `<h3>החלטות</h3><ul>${r.decisions.map(s => `<li>${H(s)}</li>`).join('')}</ul>` : ''}${r.commitments.length ? `<h3>התחייבויות</h3><ul>${r.commitments.map(s => `<li>${H(s)}</li>`).join('')}</ul>` : ''}
    ${r.decisions.length + r.commitments.length ? '' : '<p class="nw-empty">לא זוהו שורות של החלטה ("הוחלט", "סוכם") או התחייבות ("יגיש", "עד"). אפשר לסמן ידנית בדף התוכנית.</p>'}`;
};

/* ══════════ עיצוב: אותה שפה (IBM Plex, מרובע, צבע רק עם תפקיד) ══════════ */
const CSS = `
#now .nw{max-width:1180px;margin:0 auto;padding:18px 16px 40px}
.nw-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;padding-bottom:12px;box-shadow:inset 0 -2px 0 var(--ink)}
.nw-head h1{font-size:30px;margin:0;font-weight:700;letter-spacing:-.01em}
.nw-insight{font-size:19px;margin:4px 0 2px;font-weight:600}.nw-insight::before{content:"";display:inline-block;width:10px;height:10px;background:var(--marker);margin-inline-end:8px}
.nw-srv{font-size:12.5px;color:var(--ink-mute)}.nw-srv.off{color:var(--warn)}
.nw-start{display:flex;gap:8px;align-items:center}.nw-budget{display:flex;background:var(--fog)}.nw-budget button{border:0;background:transparent;padding:8px 10px;font:inherit;font-size:13px;cursor:pointer}.nw-budget button.on{background:var(--ink);color:#fff}
.nw-go{font-size:16px;padding:10px 22px;white-space:nowrap}.nw-budget button{white-space:nowrap}
.nw-num{font-family:var(--mono);font-size:12px;color:var(--ink-mute);min-width:22px}
.nw-morning{display:flex;gap:12px;padding:14px 0;box-shadow:inset 0 -1px 0 var(--rule)}.nw-morning h2,.nw-focus h2{font-size:15px;margin:0 0 6px}.nw-morning p{margin:2px 0;font-size:15px;line-height:1.55}
.nw-focus{padding:14px 0 8px}
.nw-list{list-style:none;margin:0;padding:0}.nw-row{box-shadow:inset 0 -1px 0 var(--rule)}
.nw-line{display:flex;gap:10px;align-items:baseline;width:100%;background:none;border:0;padding:9px 4px;font:inherit;text-align:start;cursor:pointer;flex-wrap:wrap}.nw-line:hover{background:var(--fog)}
.nw-t{font-weight:600;font-size:15px}.nw-row.big .nw-t{font-size:17px}.nw-pl{color:var(--ink-soft);font-size:13px}
.nw-due{font-size:12px;font-family:var(--mono);margin-inline-start:auto}.nw-due.late{color:var(--err);font-weight:600}
.nw-lv{font-size:11px;padding:1px 6px;background:var(--fog);color:var(--ink-soft)}.nw-due+.nw-lv{margin-inline-start:0}.nw-line>.nw-lv:first-of-type{margin-inline-start:auto}
.nw-lv4,.nw-lv5{background:#1a1a18;color:#fff}.nw-lv3{background:var(--marker);color:var(--ink)}
.nw-body{padding:4px 4px 12px 4px;font-size:14px;line-height:1.55}.nw-body p{margin:4px 0}
.nw-body p>span:first-child,.nw-story dt,.nw-mbox p>span:first-child{display:inline-block;min-width:96px;font-size:12px;color:var(--ink-mute);font-weight:600;margin-inline-end:8px}
.nw-rec b{background:linear-gradient(transparent 55%,var(--marker) 55%)}
.nw-opts{display:flex;flex-direction:column;gap:6px;margin:8px 0;padding:10px;background:var(--fog)}
.nw-opt{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.nw-opt textarea{flex:1;min-width:220px;font:inherit;font-size:14px;padding:6px;border:0;background:#fff}
.nw-opt input,.nw-opt select{font:inherit;font-size:13px;padding:5px;border:0;background:#fff}
.nw-st{display:flex;flex-direction:column;gap:4px;flex:1}.nw-st label{display:flex;justify-content:space-between;gap:8px;font-size:13px}
.nw-sec{padding-top:6px;box-shadow:inset 0 1px 0 var(--rule)}
.nw-meta{font-size:11.5px;color:var(--ink-mute)}
.nw-sfold summary,.nw-admin summary,.nw-tier summary{cursor:pointer}
.nw-story{display:grid;grid-template-columns:120px 1fr;gap:2px 10px;margin:6px 0;font-size:13.5px}.nw-story dd{margin:0}.nw-story small{color:var(--ink-mute)}
.nw-tier{box-shadow:inset 0 -1px 0 var(--rule)}.nw-tier>summary{display:flex;gap:10px;align-items:baseline;padding:11px 4px;list-style:none}.nw-tier>summary::-webkit-details-marker{display:none}
.nw-tn{font-weight:700;font-size:15px}.nw-tier summary small{color:var(--ink-mute);font-size:12.5px}.nw-tier summary b{margin-inline-start:auto;font-family:var(--mono)}
.nw-decide>summary b{color:var(--err)}.nw-empty{color:var(--ink-mute);font-size:13.5px;margin:4px 0 12px}
.nw-log{list-style:none;margin:0 0 10px;padding:0;font-size:13.5px}.nw-log li{padding:3px 0}.nw-log span{font-family:var(--mono);font-size:12px;color:var(--ink-mute);margin-inline-end:6px}.nw-log small{padding:0 5px;font-size:11.5px}.nw-log small.sys{background:var(--teal-pale);color:var(--teal)}.nw-log small.who{background:var(--fog);color:var(--ink-soft)}
.nw-stl{margin:0 0 12px;padding-inline-start:18px;font-size:14px;line-height:1.6}
.nw-admin{margin-top:22px;font-size:13.5px}.nw-admin>summary{font-weight:600;color:var(--ink-soft);padding:8px 0}.nw-admin h3{font-size:14px;margin:16px 0 6px}
.nw-scroll{overflow-x:auto}.nw-auto,.nw-met{width:100%;border-collapse:collapse}.nw-auto td,.nw-auto th,.nw-met td,.nw-met th{text-align:start;padding:6px;box-shadow:inset 0 -1px 0 var(--rule);vertical-align:top}
.nw-auto th,.nw-met th{font-size:12px;color:var(--ink-mute)}.nw-auto details p{margin:2px 0}.nw-auto details span{display:inline-block;min-width:80px;color:var(--ink-mute);font-size:12px}
.nw-auto small{display:block;color:var(--warn);font-size:12px;max-width:340px}.nw-auto tr.psd .nw-ast{color:var(--ink-mute)}.nw-auto tr.blk .nw-ast{color:var(--warn);font-weight:600}.nw-ast{font-weight:600;color:var(--ok)}
.nw-prm{display:block;font-size:12px;margin-top:4px}.nw-prm input{width:52px;margin-inline-start:6px;border:0;background:var(--fog);padding:3px}
.nw-mem{list-style:none;padding:0;margin:0}.nw-mem li{padding:4px 0;box-shadow:inset 0 -1px 0 var(--rule)}.nw-mem li.off{opacity:.5;text-decoration:line-through}.nw-mem small{color:var(--ink-mute)}.nw-mem span{font-family:var(--mono);font-size:12px;color:var(--ink-mute)}
.nw-pre{white-space:pre-wrap;font:inherit;background:var(--fog);padding:10px}
.nw-mode{position:fixed;inset:0;background:rgba(26,26,24,.45);z-index:3000;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:4vh 12px}
.nw-mbox{background:#fff;max-width:760px;width:100%;padding:20px 24px 24px;box-shadow:0 12px 40px rgba(0,0,0,.25)}
.nw-mbox h2{font-size:22px;margin:2px 0 8px}.nw-mbox h3{font-size:14px;margin:14px 0 4px}
.nw-mtop{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--ink-soft);padding-bottom:8px;box-shadow:inset 0 -1px 0 var(--rule);margin-bottom:10px}.nw-mtop .btn{margin-inline-start:6px}
.nw-mplan{font-size:13px;color:var(--ink-mute);margin:0}.nw-ok{background:#e6f2ea;color:#2f6b45;padding:6px 10px;font-size:13.5px}
.nw-prepbox textarea{width:100%;font:inherit;padding:8px;border:0;background:var(--fog);margin:4px 0}
.ops-back{position:fixed;bottom:18px;inset-inline-start:18px;z-index:2500;background:#ffd400;color:#1a1a18;border:0;font:inherit;font-weight:700;font-size:14px;padding:11px 18px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.ops-back:hover{background:#ffe45c}.ops-back[hidden]{display:none}
@media (max-width:640px){.nw-budget button{padding:8px 7px}.nw-go{padding:10px 14px}.nw-head h1{font-size:24px}.nw-story{grid-template-columns:1fr}.nw-start{width:100%;justify-content:space-between}.nw-mbox{padding:14px}}
@media print{.nw-mode{position:static;background:none;padding:0}.nw-mtop .btn,.ops-back{display:none}}
`;

/* ══════════ חיבור לאפליקציה ══════════ */
function ensure(){
  if(!document.getElementById('now')){
    const ref = document.getElementById('landing'); const pg = document.createElement('div'); pg.id = 'now'; pg.className = 'page'; pg.innerHTML = '<div id="nowBody"></div>';
    ref.parentNode.insertBefore(pg, ref.nextSibling);
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  }
  if(!document.querySelector('#mainNav button[data-nav="now"]')){
    const home = document.querySelector('#mainNav button[data-nav="landing"]'); const b = document.createElement('button');
    b.dataset.nav = 'now'; b.textContent = 'איפה אנחנו עומדים'; b.onclick = function(){ go('now', this); }; home.insertAdjacentElement('afterend', b);
  }
  if(typeof PAGE_LABELS !== 'undefined') PAGE_LABELS.now = '"איפה אנחנו עומדים"';
}
function boot(){
  if(typeof window.go !== 'function' || typeof plans === 'undefined' || !document.getElementById('landing') || !document.getElementById('mainNav')) return setTimeout(boot, 60);
  loadUserLocal(); ensure();
  const _go = window.go; window.go = function(id){ const r = _go.apply(this, arguments);
    if(id === 'now'){ render(); if(location.hash !== '#now') history.replaceState(null, '', '#now'); Promise.all([loadCloud(), loadGoals()]).then(() => { if(document.getElementById('now').classList.contains('active')) render(); }); USER.lastVisitPending = 1; }
    else if(USER.lastVisitPending){ USER.lastVisit = T(); delete USER.lastVisitPending; saveUser(); }
    setTimeout(backBtn, 0); return r; };
  const _op = window.openProject; if(typeof _op === 'function') window.openProject = function(){ const r = _op.apply(this, arguments); setTimeout(backBtn, 0); return r; };
  const route = () => { if(location.hash === '#now') window.go('now', document.querySelector('#mainNav button[data-nav="now"]')); };
  window.addEventListener('hashchange', route); setTimeout(route, 450);
  loadCloud();
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && document.getElementById('nwMode')) NowPage.pauseMode(); });
}
boot();
})();
