/* ══════════════════════════════════════════════════════════════════
   plans-process.js — מערכת ניהול התהליך (מפרט 03.11.2026):
   1. מועדים: מתוכנן מול בפועל, "התקיים / לא התקיים / מועד חלופי", היסטוריה.
   2. ארבעת שלבי העבודה בכל תוכנית: קלט, פעולות, פלט, סטטוס, מועדים, תיעוד.
   3. טבלת בדיקה לוועדה (שלב ג): מותר / מוצע / נדרש / תואם / הערות / מקור.
   4. ספריית ידע (מידע) ומאגר תוצרים מאושרים (תוצרים).
   5. חיפוש גלובלי עם תוצאות מקובצות.
   6. אנשי קשר: צוותים, WhatsApp, וניסוח כן לשליחה.
   כל הנתונים נשמרים על התוכנית עצמה (PERSIST_FIELDS ב-index.html) — מקור אחד לכל המסכים.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T = () => todayStr();
const isD = d => /^\d{4}-\d{2}-\d{2}/.test(String(d||''));
const d10 = d => String(d||'').slice(0,10);
const F = d => isD(d) ? fmtDate(d10(d)) : '—';
const dd = (a,b) => Math.round((new Date(d10(b)+'T00:00:00') - new Date(d10(a)+'T00:00:00'))/864e5);
const byId = id => plans.find(x => x.id === id);
const nowISO = () => new Date().toISOString();
// עריכה רק במצב עריכה, ולא לתפקידי צפייה (הנהלה) או ליזם — אותה חוקיות כמו בשאר האפליקציה
const canEdit = () => (typeof globalEdit!=='undefined' ? globalEdit : true) && !(typeof isManager==='function' && isManager()) && !(typeof isDeveloper==='function' && isDeveloper());
const save = p => { p.updatedAt = T(); savePlans(); if(typeof refreshAll==='function') refreshAll(); };

/* ══════════ 1. מועדים: מתוכנן, בפועל, היסטוריה ══════════
   שדה התאריך הקיים (forumArchitect / forumConsultants / datesPlan.committeePrep / committeeDate)
   הוא המועד המתוכנן העדכני. p.meet[key] מוסיף: outcome (held|missed), heldOn, summary, history[]. */
const MEET = [
  { key:'forumArchitect',   label:'פורום אדריכל העיר', stage:'a', get:p=>p.forumArchitect,   set:(p,v)=>{ p.forumArchitect=v; } },
  { key:'forumConsultants', label:'פורום יועצים',      stage:'b', get:p=>p.forumConsultants, set:(p,v)=>{ p.forumConsultants=v; } },
  { key:'committeePrep',    label:'הכנה לוועדה',        stage:'c', get:p=>p.datesPlan&&p.datesPlan.committeePrep, set:(p,v)=>{ if(!p.datesPlan)p.datesPlan={}; p.datesPlan.committeePrep=v; } },
  { key:'committeeDate',    label:'ועדה',               stage:'d', get:p=>p.committeeDate,    set:(p,v)=>{ p.committeeDate=v; } }
];
function meet(p, key){ if(!p.meet) p.meet = {}; if(!p.meet[key]) p.meet[key] = { history:[] }; return p.meet[key]; }
/** מצב מועד: none | planned | due (חלף, טרם סומן) | held | missed | est (אומדן אוטומטי) */
function meetState(p, m){
  const d = m.get(p); if(!isD(d)) return { st:'none' };
  const x = (p.meet && p.meet[m.key]) || {};
  if(x.outcome==='held') return { st:'held', d, x };
  // תוכנית היסטורית שהושלמה: המועד התקיים לפי סטטוס התוכנית
  if(!planIsActive(p) && d10(d) <= T()) return { st:'held', d, x, inferred:'לפי סטטוס התוכנית' };
  if(x.outcome==='missed') return { st:'missed', d, x };
  // ראיה קיימת באפליקציה: החלטת פורום שנרשמה, או אישור תוכנית היועצים
  if(d10(d) <= T()){
    if(m.key==='forumArchitect' && p.forumDecision && (p.forumDecision.approved || String(p.forumDecision.text||'').trim())) return { st:'held', d, x, inferred:'לפי החלטת הפורום שנרשמה' };
    if(m.key==='forumConsultants' && p.consultantsPlanApproved) return { st:'held', d, x, inferred:'לפי אישור תוכנית היועצים' };
  }
  if(d10(d) > T()) return { st: (p._est && p._est[m.key]) ? 'est' : 'planned', d, x };
  return { st:'due', d, x };
}
const MEET_LBL = { none:'לא נקבע', planned:'מתוכנן', est:'אומדן', due:'חלף, טרם סומן', held:'התקיים', missed:'לא התקיים' };
const MEET_CLS = { none:'mt-none', planned:'mt-plan', est:'mt-est', due:'mt-due', held:'mt-held', missed:'mt-miss' };
window.meetState = meetState; window.MEET = MEET;

window.meetHeld = function(id, key){
  const p = byId(id); const m = MEET.find(x=>x.key===key); if(!p||!m) return;
  const sumEl = document.getElementById('mtSum_'+id+'_'+key);
  const x = meet(p, key); x.outcome = 'held'; x.heldOn = d10(m.get(p)); x.summary = sumEl ? sumEl.value.trim() : (x.summary||''); x.at = nowISO();
  logAction(p, 'meeting', `${m.label} התקיים ב-${F(m.get(p))}${x.summary?': '+x.summary:''}`);
  save(p); rerender(p);
};
window.meetMissed = function(id, key){
  const p = byId(id); const m = MEET.find(x=>x.key===key); if(!p||!m) return;
  const x = meet(p, key); x.outcome = 'missed'; x.at = nowISO();
  logAction(p, 'meeting', `${m.label} שנקבע ל-${F(m.get(p))} לא התקיים. דורש מועד חלופי.`);
  save(p); rerender(p);
};
/** מועד חלופי: המועד הקודם נשמר בהיסטוריה, והשדה הקיים מתעדכן — כך כל המסכים מתעדכנים */
window.meetReschedule = function(id, key){
  const p = byId(id); const m = MEET.find(x=>x.key===key); if(!p||!m) return;
  const inp = document.getElementById('mtNew_'+id+'_'+key); const v = inp && inp.value;
  if(!isD(v)){ toast('בחרי תאריך חלופי'); return; }
  const x = meet(p, key), old = m.get(p);
  if(old) x.history.push({ date:d10(old), outcome:x.outcome||'', replacedAt:T(), note:'הוחלף במועד חלופי' });
  if(!x.orig && old) x.orig = d10(old);
  m.set(p, v); x.outcome = ''; x.summary = '';
  if(p._est) delete p._est[key];
  if(!p._userEdited) p._userEdited = {}; p._userEdited[key==='committeePrep'?'datesPlan.committeePrep':key] = 1;
  logAction(p, 'meeting', `${m.label}: מועד חלופי ${F(v)}${old?` (במקום ${F(old)})`:''}`);
  save(p); rerender(p);
};
window.meetReset = function(id, key){ const p = byId(id); if(!p) return; const x = meet(p,key); x.outcome=''; save(p); rerender(p); };

function meetRowHTML(p, m){
  const s = meetState(p, m), x = s.x || {};
  const late = s.st==='due' || s.st==='missed';
  const hist = (x.history||[]).length ? `<div class="mt-hist">היסטוריה: ${x.history.map(h=>`<s>${F(h.date)}</s>${h.outcome==='missed'?' (לא התקיים)':''}`).join(' · ')}</div>` : '';
  const sum = x.summary ? `<div class="mt-sum"><span class="pp-mono">סיכום</span> ${H(x.summary)}</div>` : '';
  const id = p.id, k = m.key;
  let acts = '';
  if(canEdit()){
    if(s.st==='due' || s.st==='missed' || s.st==='planned' || s.st==='est' || s.st==='none'){
      acts += `<div class="mt-acts">`;
      if(s.st==='due' || s.st==='planned'){
        acts += `<textarea id="mtSum_${id}_${k}" class="mt-in" rows="1" placeholder="סיכום הפגישה (לא חובה)"></textarea>
          <button class="btn btn-sm" onclick="meetHeld(${id},'${k}')">התקיים</button>`;
        if(s.st==='due') acts += `<button class="btn btn-ghost btn-sm" onclick="meetMissed(${id},'${k}')">לא התקיים</button>`;
      }
      acts += `<span class="mt-new"><input type="date" id="mtNew_${id}_${k}" class="mt-in"><button class="btn btn-ghost btn-sm" onclick="meetReschedule(${id},'${k}')">${s.st==='none'?'קביעת מועד':'מועד חלופי'}</button></span></div>`;
    } else if(s.st==='held' && !s.inferred){
      acts = `<div class="mt-acts"><button class="btn btn-ghost btn-sm" onclick="meetReset(${id},'${k}')">ביטול הסימון</button></div>`;
    }
  }
  return `<div class="mt-row ${MEET_CLS[s.st]}">
    <div class="mt-h"><b>${H(m.label)}</b> <span class="mt-st">${MEET_LBL[s.st]}${s.inferred?' ('+H(s.inferred)+')':''}</span></div>
    <div class="mt-d"><span class="pp-mono">מתוכנן</span> <b>${F(s.d)}</b>${x.orig&&x.orig!==d10(s.d)?` <span class="pp-mono">מקורי</span> ${F(x.orig)}`:''}
      ${s.st==='held'?` <span class="pp-mono">בפועל</span> <b>${F(x.heldOn||s.d)}</b>`:''}
      ${late?` <span class="mt-late">באיחור של <b>${dd(s.d,T())}</b> ימים</span>`:''}
      ${s.st==='est'?' <span class="mt-estn">חושב אוטומטית: חודש אחרי המועד הקודם. לא נקבע בפועל.</span>':''}</div>
    ${sum}${hist}${acts}</div>`;
}

/* ══════════ 2. ארבעת שלבי העבודה ══════════ */
const STAGES = [
  { k:'a', title:'שלב א: פורום אדריכל ותיאום ציפיות', meets:['forumArchitect'],
    input:['פרטי התוכנית והמיקום','מסמכי התב"ע הרלוונטיים','מצגת או תוכנית ראשונית מטעם היזם','הנחיות אדריכלית העיר'],
    city:['שליחת מסמך או מצגת הנחיות ליזם','קביעת שלושת המועדים: פורום אדריכל, פורום יועצים, הכנה לוועדה','תיעוד פגישות העבודה, ההערות והדרישות','מעקב אחר גרסאות והגשות חוזרות'],
    dev:['הגשת מצגת ותוכנית ראשונית','תיקון לפי הערות הפורום','הגשה חוזרת של גרסה מעודכנת'],
    output:['סיכומי פגישות','עקרונות תכנון מוסכמים','רשימת תיקונים','אישור מעבר לשלב ב'] },
  { k:'b', title:'שלב ב: פורום יועצים', meets:['forumConsultants'],
    input:['תוכנית מעודכנת','מצגת לפי תחומי היועצים','רשימת יועצים רלוונטיים'],
    city:['שיוך יועצים לפי תחום','הפצת החומרים ליועצים','קביעת פגישות','ריכוז דרישות היועצים','מעקב אחר תגובות, התנגדויות ותיקונים','תיעוד סיכומי הפגישות'],
    dev:['הגשת חוות דעת היועצים מטעם היזם','מענה לכל דרישה','הגשת גרסה מתואמת'],
    output:['טבלת דרישות מרוכזת','סיכומי יועצים','סטטוס מענה לכל דרישה','גרסת תוכנית מתואמת'] },
  { k:'c', title:'שלב ג: הכנה לוועדה', meets:['committeePrep'], review:true,
    input:['תוכנית בינוי ופיתוח מתואמת','חתכים וחזיתות','תוכניות קומות, גגות ומרתפים','הוראות התב"ע ומסמכי המדיניות','חוות דעת היועצים'],
    city:['בדיקה מובנית לפי טבלת הבדיקה','ריכוז רשימת הפערים','כתיבת חוות דעת אדריכלית העיר','ניסוח המלצה לוועדה','הכנת חבילת מסמכים לדיון'],
    dev:['השלמת נתונים חסרים בטבלת הבדיקה','תיקון אי־התאמות','הגשת חבילת המסמכים המלאה'],
    output:['טבלת בדיקה מלאה','רשימת פערים','חוות דעת אדריכלית העיר','נוסח המלצה לוועדה','חבילת מסמכים לדיון'] },
  { k:'d', title:'שלב ד: אישורים ותיעוד', meets:['committeeDate'], approval:true,
    input:['החלטת הוועדה','רשימת תנאים והשלמות','הגרסה הסופית מטעם היזם'],
    city:['קליטת החלטת הוועדה','תיעוד התנאים וההשלמות','מעקב אחר ביצוע התיקונים','אישור הגרסה הסופית','חתימה וסריקה של התוכנית','שמירת עותק מודפס ודיגיטלי','העברה למאגר התוצרים'],
    dev:['ביצוע התיקונים לפי התנאים','הגשת הגרסה הסופית לחתימה'],
    output:['תוכנית מאושרת','החלטה ותנאים','מסמכים חתומים','תאריך אישור','סטטוס סופי והיסטוריית טיפול'] }
];
const PSTATUS = ['טרם החל','בטיפול','ממתין ליזם','ממתין לעירייה','הושלם'];
function proc(p, k){ if(!p.proc) p.proc = {}; if(!p.proc[k]) p.proc[k] = { status:'', checks:{}, notes:[] }; return p.proc[k]; }

/** האם התוכנית מאושרת באמת: החלטת ועדה + תאריך אישור + חתימה + גרסה סופית. לא לפי סימון משימות. */
function approvalEvidence(p){
  const dec = (p.summary && p.summary.committeeDecision) || (p.opinion && p.opinion.recommendation) || '';
  const d = proc(p,'d');
  const ev = { decision: !!String(dec).trim(), decisionText: dec, approvalDate: isD(p.approvalDate) ? p.approvalDate : '',
               signDate: isD(p.signDate) ? p.signDate : '', finalVersion: !!d.finalVersion, scanned: !!d.scanned };
  ev.complete = ev.decision && !!ev.approvalDate && !!ev.signDate && ev.finalVersion;
  ev.missing = [ !ev.decision && 'החלטת ועדה', !ev.approvalDate && 'תאריך אישור', !ev.signDate && 'תאריך חתימה', !ev.finalVersion && 'אישור גרסה סופית' ].filter(Boolean);
  return ev;
}
window.approvalEvidence = approvalEvidence;

/** סטטוס מחושב מהנתונים (מוצג לצד הסטטוס שהוזן, כדי להפריד בין "מחושב" ל"הוזן") */
function computedStatus(p, st){
  if(!planIsActive(p) && p.status==='הושלם') return 'הושלם';
  if(st.approval){ const ev = approvalEvidence(p); if(ev.complete) return 'הושלם'; }
  const ms = st.meets.map(k => meetState(p, MEET.find(m=>m.key===k)));
  if(!st.approval && ms.every(s => s.st==='held')) return 'הושלם';
  const c = proc(p, st.k).checks || {};
  if(ms.some(s => s.st!=='none') || Object.values(c).some(Boolean)) return 'בטיפול';
  return 'טרם החל';
}

let _openStage = {};
window.procOpen = function(id, k){ _openStage[id] = k; const p = byId(id); rerender(p); };
window.procSetStatus = function(id, k, v){
  const p = byId(id); const st = STAGES.find(s=>s.k===k); if(!p||!st) return;
  if(v==='הושלם' && st.approval && !approvalEvidence(p).complete){
    toast('אי אפשר לסמן "הושלם": חסרים ' + approvalEvidence(p).missing.join(', ')); rerender(p); return;
  }
  const x = proc(p, k); const old = x.status; x.status = v;
  logAction(p, 'stage', `${st.title}: סטטוס "${old||'—'}" ← "${v}"`); save(p); rerender(p);
};
window.procCheck = function(id, k, item, on){ const p = byId(id); const x = proc(p,k); x.checks[item] = on ? T() : ''; save(p); };
window.procNote = function(id, k){
  const p = byId(id); const el = document.getElementById('prNote_'+id+'_'+k); const v = el && el.value.trim(); if(!v) return;
  proc(p,k).notes.push({ text:v, at:T(), by: (typeof projectRole!=='undefined' && projectRole==='city') ? 'אדריכלית העיר' : 'אדריכל היזם' });
  logAction(p, 'note', STAGES.find(s=>s.k===k).title + ': ' + v); save(p); rerender(p);
};
window.procFlag = function(id, f, on){
  const p = byId(id); const x = proc(p,'d'); x[f] = on ? T() : ''; logAction(p,'stage',`שלב ד: ${f==='finalVersion'?'גרסה סופית אושרה':f==='scanned'?'התוכנית נסרקה':'עותק מודפס נשמר'}${on?'':' (בוטל)'}`); save(p); rerender(p);
};
window.procSetDate = function(id, f){
  const p = byId(id); const el = document.getElementById('prDt_'+id+'_'+f); if(!el) return;
  p[f] = el.value; if(!p._userEdited) p._userEdited={}; p._userEdited[f]=1; logAction(p,'stage',`${f==='approvalDate'?'תאריך אישור':'תאריך חתימה'}: ${F(el.value)}`); save(p); rerender(p);
};

function listHTML(p, st, kind, items){
  const x = proc(p, st.k);
  return `<ul class="pr-list">${items.map((t,i)=>{ const key = kind+i, on = x.checks && x.checks[key];
    return `<li><label><input type="checkbox" ${on?'checked':''} ${canEdit()?'':'disabled'} onchange="procCheck(${p.id},'${st.k}','${key}',this.checked)"> <span>${H(t)}</span>${on?` <span class="pr-when">${F(on)}</span>`:''}</label></li>`; }).join('')}</ul>`;
}

function stagePanelHTML(p){
  const open = _openStage[p.id] = _openStage[p.id] || (STAGES.find(s => computedStatus(p,s)!=='הושלם') || STAGES[3]).k;
  const tabs = STAGES.map((s,i) => {
    const cs = computedStatus(p, s), es = proc(p, s.k).status;
    return `<button class="pr-tab${s.k===open?' on':''}" onclick="procOpen(${p.id},'${s.k}')">
      <span class="pr-n">${['א','ב','ג','ד'][i]}</span><span class="pr-t">${H(s.title.split(': ')[1])}</span>
      <span class="pr-s pr-s-${PSTATUS.indexOf(es||cs)}">${H(es||cs)}</span></button>`;
  }).join('<span class="pr-arrow" aria-hidden="true">←</span>');
  const st = STAGES.find(s=>s.k===open), x = proc(p, st.k), cs = computedStatus(p, st);
  const statusSel = canEdit()
    ? `<select onchange="procSetStatus(${p.id},'${st.k}',this.value)"><option value="">לפי המחושב (${H(cs)})</option>${PSTATUS.map(s=>`<option ${x.status===s?'selected':''}>${s}</option>`).join('')}</select>`
    : `<b>${H(x.status||cs)}</b>`;
  const meets = st.meets.map(k => meetRowHTML(p, MEET.find(m=>m.key===k))).join('');
  const notes = (x.notes||[]).slice().reverse().map(n=>`<li><span class="pr-when">${F(n.at)} · ${H(n.by||'')}</span> ${H(n.text)}</li>`).join('');
  const hist = (p.actionLog||[]).filter(a=>/stage|meeting|note|mail|wa/.test(a.type)).slice(-6).reverse()
    .map(a=>`<li><span class="pr-when">${F(a.at)} · ${H(a.by||'')}</span> ${H(a.detail)}</li>`).join('');
  let extra = '';
  if(st.review) extra = reviewGridHTML(p);
  if(st.approval){
    const ev = approvalEvidence(p);
    extra = `<div class="pr-appr ${ev.complete?'ok':'no'}">
      <h4>${ev.complete?'התוכנית מאושרת, חתומה ומתועדת':'התוכנית עדיין לא מאושרת סופית'}</h4>
      <div class="pr-ev">
        <div><span class="pp-mono">החלטת ועדה</span> ${ev.decision?`<b>${H(String(ev.decisionText).slice(0,140))}</b>`:'<span class="pr-miss">חסרה</span>'}</div>
        <div><span class="pp-mono">תאריך אישור</span> ${canEdit()?`<input type="date" id="prDt_${p.id}_approvalDate" value="${H(d10(p.approvalDate))}" onchange="procSetDate(${p.id},'approvalDate')">`:F(p.approvalDate)}</div>
        <div><span class="pp-mono">תאריך חתימה</span> ${canEdit()?`<input type="date" id="prDt_${p.id}_signDate" value="${H(d10(p.signDate))}" onchange="procSetDate(${p.id},'signDate')">`:F(p.signDate)}</div>
        <label><input type="checkbox" ${x.finalVersion?'checked':''} ${canEdit()?'':'disabled'} onchange="procFlag(${p.id},'finalVersion',this.checked)"> הגרסה הסופית אושרה ${x.finalVersion?`<span class="pr-when">${F(x.finalVersion)}</span>`:''}</label>
        <label><input type="checkbox" ${x.scanned?'checked':''} ${canEdit()?'':'disabled'} onchange="procFlag(${p.id},'scanned',this.checked)"> התוכנית החתומה נסרקה ${x.scanned?`<span class="pr-when">${F(x.scanned)}</span>`:''}</label>
        <label><input type="checkbox" ${x.printed?'checked':''} ${canEdit()?'':'disabled'} onchange="procFlag(${p.id},'printed',this.checked)"> עותק מודפס נשמר לפי הנוהל ${x.printed?`<span class="pr-when">${F(x.printed)}</span>`:''}</label>
      </div>
      ${ev.complete?'<div class="pr-ok">התוכנית מופיעה במאגר התוצרים המאושרים.</div>':`<div class="pr-miss">כדי להעביר למאגר התוצרים חסרים: <b>${H(ev.missing.join(', '))}</b>. סימון המשימות לבדו לא מאשר תוכנית.</div>`}
    </div>`;
  }
  return `<section class="pr-wrap" id="procPanel">
    <div class="pr-head"><h3>ארבעת שלבי העבודה</h3><span class="pp-src">הסטטוס המחושב נגזר מהמועדים ומהמסמכים. סטטוס שהוזן ידנית גובר עליו ומסומן כך.</span></div>
    <div class="pr-tabs">${tabs}</div>
    <div class="pr-body">
      <div class="pr-top"><h4>${H(st.title)}</h4><div class="pr-stat"><span class="pp-mono">סטטוס</span> ${statusSel} ${x.status?`<span class="pr-tag">הוזן ידנית</span>`:`<span class="pr-tag pr-tag-c">מחושב</span>`}</div></div>
      <div class="pr-grid">
        <div class="pr-col"><div class="pr-k">קלט: חומרים נדרשים</div>${listHTML(p, st, 'in', st.input)}</div>
        <div class="pr-col"><div class="pr-k">פעולות אדריכלית העיר</div>${listHTML(p, st, 'city', st.city)}</div>
        <div class="pr-col"><div class="pr-k">פעולות אדריכל היזם</div>${listHTML(p, st, 'dev', st.dev)}</div>
        <div class="pr-col"><div class="pr-k">פלט: התוצר לסיום השלב</div>${listHTML(p, st, 'out', st.output)}</div>
      </div>
      ${st.k==='a' && p.openDateIssue ? `<div class="mt-row mt-due"><div class="mt-h"><b>תאריך פתיחת התיק לא עקבי</b></div>
        <div class="mt-d">תאריך הפתיחה <b>${F(p.date)}</b> מאוחר מפורום אדריכל העיר <b>${F(p.openDateIssue)}</b>. כנראה תאריך הזנה ולא תאריך פתיחה. המערכת לא משנה אותו לבד.</div>
        ${canEdit()?`<div class="mt-acts"><button class="btn btn-sm" onclick="fixOpenDate(${p.id},'first')">עדכון לתאריך הפורום (${F(p.openDateIssue)})</button><span class="pp-src">או תיקון ידני בלשונית זיהוי הפרויקט.</span></div>`:''}</div>` : ''}
      <div class="pr-k">מועדים: מתוכנן, בפועל, איחור</div>${meets}
      ${st.k==='a'||st.k==='b'?`<div class="pr-links"><button class="btn btn-ghost btn-sm" onclick="gotoForumStation('${st.k==='a'?'forumArchitect':'forumConsultants'}','${st.k==='a'?'stage_1':'stage_2'}')">תחנת העבודה של ${st.k==='a'?'פורום אדריכל העיר':'פורום היועצים'}: החלטות, יועצים וגרסאות</button></div>`:''}
      ${extra}
      <div class="pr-doc">
        <div><div class="pr-k">תיעוד והערות</div>
          ${canEdit()?`<div class="pr-add"><input id="prNote_${p.id}_${st.k}" class="mt-in" placeholder="הערה, החלטה או סיכום פגישה"><button class="btn btn-sm" onclick="procNote(${p.id},'${st.k}')">הוספה</button></div>`:''}
          <ul class="pr-notes">${notes||'<li class="muted">אין הערות בשלב הזה.</li>'}</ul></div>
        <div><div class="pr-k">היסטוריית שינויים</div><ul class="pr-notes">${hist||'<li class="muted">אין פעולות מתועדות.</li>'}</ul></div>
      </div>
    </div></section>`;
}

/* ══════════ 3. טבלת בדיקה לוועדה ══════════ */
// t5 = שורה שמשותפת לטבלה 5 הקיימת (אותו נתון, מקור אחד)
const REVIEW = [
  ['זיהוי', [['גוש וחלקה'],['רובע'],['מספרי תוכניות חלות']]],
  ['ייעודים וזיקות', [['ייעוד','designation'],['זיקות הנאה']]],
  ['זכויות ובינוי', [['שטח עיקרי (מ"ר)','mainArea'],['תכסית (%)','coverage'],['מספר קומות','floors'],['גובה (מ\')','height'],['קו בניין קדמי (מ\')','setbackF'],['קו בניין אחורי (מ\')','setbackB'],['קו בניין צידי (מ\')','setbackS']]],
  ['יחידות דיור', [['מספר יחידות דיור','units'],['תמהיל דירות']]],
  ['חלחול וגינון', [['שטח חלחול'],['ריצוף וגינון']]],
  ['תנועה וחניה', [['תקן חניה','parking'],['הולכי רגל'],['אופניים']]],
  ['נגישות ובטיחות', [['נגישות'],['בטיחות אש ודרכי מילוט']]],
  ['תשתיות', [['תשתיות ומתקני שירות'],['פסולת ואצירה']]],
  ['מרחב', [['רציפות וחיבוריות'],['קומפוזיציה וחוויית המרחב']]],
  ['סביבה', [['הצללה'],['אנרגיה'],['נגר'],['רוחות']]],
  ['הנחיות ומדיניות', [['התאמה להנחיות המרחביות'],['התאמה לאוגדן העירוני']]]
];
const MATCH = [['','בחרי'],['ok','תואם'],['no','לא תואם'],['missing','נתון חסר'],['check','סטייה לבירור'],['na','לא רלוונטי']];
function rvRow(p, topic, sub, t5){
  if(!p.reviewGrid) p.reviewGrid = {};
  const id = topic+'|'+sub;
  const r = p.reviewGrid[id] || (p.reviewGrid[id] = { allowed:'', proposed:'', required:'', match:'', note:'', source:'' });
  if(t5){ if(typeof ensureTable5==='function') ensureTable5(p); const t = p.table5[t5] || {}; return { id, r, t, allowed: t.allowed||'', proposed: t.proposed||'', source: r.source || t.source || '' }; }
  return { id, r, allowed: r.allowed, proposed: r.proposed, source: r.source };
}
window.rvSet = function(pid, id, f, v){
  const p = byId(pid); if(!p) return;
  const [topic, sub] = id.split('|');
  const def = REVIEW.find(x=>x[0]===topic)[1].find(x=>x[0]===sub); const t5 = def && def[1];
  const r = p.reviewGrid[id];
  if(t5 && (f==='allowed' || f==='proposed')){ ensureTable5(p); p.table5[t5][f] = v; }
  else r[f] = v;
  // אין התאמה בלי מסמך תומך
  if(f==='match' && v==='ok' && !(r.source || (t5 && p.table5[t5].source))){ r.match = 'missing'; toast('"תואם" דורש מקור. סומן "נתון חסר" עד שיוזן מקור.'); }
  save(p); const el = document.getElementById('rvGaps_'+pid); if(el) el.outerHTML = gapsHTML(p);
  const row = document.querySelector(`[data-rv="${CSS.escape(id)}"]`); if(row && f==='match') row.className = 'rv-'+(r.match||'none');
};
function gapsHTML(p){
  const gaps = [];
  REVIEW.forEach(([topic, subs]) => subs.forEach(([sub, t5]) => { const x = rvRow(p, topic, sub, t5); const m = x.r.match;
    if(m==='no' || m==='missing' || m==='check') gaps.push({ topic, sub, m, note:x.r.note }); }));
  const lbl = { no:'אי־התאמה', missing:'נתון חסר', check:'סטייה לבירור' };
  const n = REVIEW.reduce((s,[,subs])=>s+subs.length,0);
  const done = REVIEW.reduce((s,[topic,subs])=>s+subs.filter(([sub,t5])=>rvRow(p,topic,sub,t5).r.match).length,0);
  return `<div id="rvGaps_${p.id}" class="rv-gaps"><div class="pr-k">רשימת פערים</div>
    <div class="pp-src">נבדקו <b>${done}</b> מתוך <b>${n}</b> שורות.</div>
    ${gaps.length?`<ol>${gaps.map(g=>`<li class="rv-g-${g.m}"><b>${H(lbl[g.m])}</b>: ${H(g.topic)}, ${H(g.sub)}${g.note?` · ${H(g.note)}`:''}</li>`).join('')}</ol>`:'<div class="muted">לא סומנו פערים.</div>'}</div>`;
}
function reviewGridHTML(p){
  const ed = canEdit();
  const inp = (pid,id,f,v) => ed ? `<input class="rv-in" value="${H(v)}" onchange="rvSet(${pid},'${H(id)}','${f}',this.value)">` : H(v||'—');
  const rows = REVIEW.map(([topic, subs]) => subs.map(([sub, t5], i) => {
    const x = rvRow(p, topic, sub, t5), m = x.r.match;
    return `<tr data-rv="${H(x.id)}" class="rv-${m||'none'}">
      ${i===0?`<th rowspan="${subs.length}" scope="rowgroup">${H(topic)}</th>`:''}
      <td>${H(sub)}${t5?'<span class="rv-t5" title="משותף לטבלה 5">טבלה 5</span>':''}</td>
      <td>${inp(p.id,x.id,'allowed',x.allowed)}</td><td>${inp(p.id,x.id,'proposed',x.proposed)}</td><td>${inp(p.id,x.id,'required',x.r.required)}</td>
      <td>${ed?`<select onchange="rvSet(${p.id},'${H(x.id)}','match',this.value)">${MATCH.map(([v,l])=>`<option value="${v}" ${m===v?'selected':''}>${l}</option>`).join('')}</select>`:H((MATCH.find(z=>z[0]===m)||['',''])[1]||'—')}</td>
      <td>${inp(p.id,x.id,'note',x.r.note)}</td><td>${inp(p.id,x.id,'source',x.source)}</td></tr>`;
  }).join('')).join('');
  return `<div class="rv-wrap"><div class="pr-k">טבלת בדיקה לוועדה</div>
    <div class="pp-src">"תואם" נשמר רק עם מקור (סעיף בהוראות, טבלה או נספח). שורות עם התווית "טבלה 5" משותפות לטבלה 5 בלשונית הבדיקה: עדכון במקום אחד מעדכן את שניהם.</div>
    <div class="rv-scroll"><table class="rv-table"><thead><tr><th>נושא</th><th>תת־נושא</th><th>מותר לפי תב"ע</th><th>מוצע</th><th>נדרש</th><th>תואם</th><th>הערות</th><th>מקור</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${gapsHTML(p)}
    <div class="pr-links"><button class="btn btn-ghost btn-sm" onclick="ppTab('opinion')">חוות דעת אדריכלית העיר ונוסח המלצה</button><button class="btn btn-ghost btn-sm" onclick="ppTab('docs')">חבילת המסמכים לדיון</button></div></div>`;
}

function rerender(p){
  if(!p) return;
  const el = document.getElementById('procPanel');
  if(el && typeof currentProjectId!=='undefined' && currentProjectId===p.id){ el.outerHTML = stagePanelHTML(p); }
  const pg = document.querySelector('.page.active');
  if(pg && pg.id==='calendar' && typeof renderCalendar==='function') renderCalendar();
  if(pg && pg.id==='timeline' && typeof renderTimelinePage==='function') renderTimelinePage();
}
function patchProjectPage(){
  const orig = window.renderStageStrip; if(typeof orig!=='function') return;
  window.renderStageStrip = function(p){
    orig(p);
    try{
      const strip = document.getElementById('stageStrip'); if(!strip || !p) return;
      const old = document.getElementById('procPanel'); if(old) old.remove();
      strip.insertAdjacentHTML('afterend', stagePanelHTML(p));
    }catch(e){ console.warn('process panel', e); }
  };
}

/* ══════════ 4. לוח שנה: כל החודשים שבטווח המועדים ══════════ */
let calMode = 'range';
try{ calMode = localStorage.getItem('ashdod_cal_mode') || 'range'; }catch(e){}
window.setCalMode = function(m){ calMode = m; try{ localStorage.setItem('ashdod_cal_mode', m); }catch(e){} renderCalendar(); };
function calRange(){
  const t = T(); let lo = t.slice(0,7), hi = t.slice(0,7);
  livePlans().filter(planIsActive).forEach(p => MEET.forEach(m => { const d = m.get(p); if(isD(d)){ const ym = d10(d).slice(0,7); if(ym<lo) lo=ym; if(ym>hi) hi=ym; }
    ((p.meet&&p.meet[m.key]&&p.meet[m.key].history)||[]).forEach(h=>{ const ym=h.date.slice(0,7); if(ym<lo) lo=ym; }); }));
  const out = []; let [y,mo] = lo.split('-').map(Number); const [hy,hm] = hi.split('-').map(Number);
  while(y<hy || (y===hy && mo<=hm)){ out.push([y, mo-1]); mo++; if(mo>12){ mo=1; y++; } if(out.length>36) break; }
  return out;
}
function patchCalendar(){
  const orig = window.renderCalendar; if(typeof orig!=='function') return;
  // אירועים: מוסיפים מצב מועד (התקיים, חלף, אומדן) ואת המועדים המקוריים מההיסטוריה
  const origEvents = window.calEvents;
  window.calEvents = function(){
    const byDay = origEvents();
    Object.values(byDay).forEach(list => list.forEach(e => {
      const p = byId(e.pid); const key = e.stageKey==='committee' ? ((p.datesPlan&&p.datesPlan.committeePrep)?'committeePrep':'committeeDate') : e.stageKey;
      const m = MEET.find(x=>x.key===key); if(p && m){ const s = meetState(p, m); e.mst = s.st; }
    }));
    livePlans().filter(planIsActive).forEach(p => MEET.forEach(m => ((p.meet&&p.meet[m.key]&&p.meet[m.key].history)||[]).forEach(h => {
      (byDay[h.date] = byDay[h.date] || []).push({ pid:p.id, tik:p.tik, name:buildProjectTitle(p), stage:m.label+' (מועד מקורי שהוחלף)', stageKey:m.key, tab:'forums', color:'#b9b6ae', status:p.status, time:'', appr:'', mst:'moved' });
    })));
    return byDay;
  };
  window.renderCalendar = function(){
    const wrap = document.getElementById('calMonths'); if(!wrap) return;
    const head = document.querySelector('#calendar .cal-nav');
    if(head && !document.getElementById('calModeBar')){
      head.insertAdjacentHTML('afterbegin', `<span id="calModeBar" class="cal-modes"><button class="tl-chip" data-m="range" onclick="setCalMode('range')">טווח המועדים</button><button class="tl-chip" data-m="month" onclick="setCalMode('month')">חודש אחד</button></span>`);
    }
    document.querySelectorAll('#calModeBar .tl-chip').forEach(b => b.classList.toggle('on', b.dataset.m===calMode));
    document.querySelectorAll('#calendar .cal-nav > button').forEach(b => b.style.display = calMode==='range' ? 'none' : '');
    if(calMode!=='range') return orig();
    const ev = calEvents(), months = calRange();
    wrap.innerHTML = `<div class="cal-range-note">מוצגים <b>${months.length}</b> חודשים ברצף: מהמועד המוקדם ביותר של תוכנית בטיפול ועד המאוחר ביותר. מועד שהוחלף נשאר באפור.</div>
      <div class="cal-range">${months.map(([y,m]) => calMonthHTML(y, m, ev)).join('')}</div>`;
    const lg = document.getElementById('calLegend');
    if(lg) lg.innerHTML = CAL_STAGES.map(s=>`<span class="cal-lg"><i style="background:${s.color}"></i>${s.label}</span>`).join('')
      + '<span class="cal-lg"><i class="mt-lg mt-held"></i>התקיים</span><span class="cal-lg"><i class="mt-lg mt-due"></i>חלף, טרם סומן</span><span class="cal-lg"><i class="mt-lg mt-miss"></i>לא התקיים</span><span class="cal-lg"><i class="mt-lg mt-est"></i>אומדן</span><span class="cal-lg"><i style="background:#b9b6ae"></i>מועד שהוחלף</span>';
    const cur = wrap.querySelector('.cal-today'); if(cur) cur.closest('.cal-month').classList.add('cal-cur');
  };
  // תגית מצב על כל אירוע בלוח
  const origCell = window.calCellHTML;
  window.calCellHTML = function(y,m,d,events,outside){
    let html = origCell(y,m,d,events,outside);
    const ymd = y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    (events[ymd]||[]).forEach((e,i) => {
      if(!e.mst || e.mst==='planned') return;
      const tag = { held:'התקיים', due:'חלף, טרם סומן', missed:'לא התקיים', est:'אומדן', moved:'הוחלף' }[e.mst]; if(!tag) return;
      let n = -1; html = html.replace(/<span class="cal-chip-sub">/g, mt => (++n===i) ? `<span class="mt-chip ${MEET_CLS[e.mst]||'mt-moved'}">${tag}</span>`+mt : mt);
    });
    if(calMode==='range') html = html.replace(/(<span class="cal-chip-name">תב\/[^ <]+)[^<]*/g, '$1');
    return html;
  };
  // חלון האירוע: מצב המועד והפעולות (התקיים / לא התקיים / מועד חלופי)
  const origOpen = window.calOpenEvent;
  window.calOpenEvent = function(ymd, idx){
    origOpen(ymd, idx);
    const e = (calEvents()[ymd]||[])[idx]; if(!e) return; const p = byId(e.pid); if(!p) return;
    const key = e.stageKey==='committee' ? ((p.datesPlan&&p.datesPlan.committeePrep)?'committeePrep':'committeeDate') : e.stageKey;
    const m = MEET.find(x=>x.key===key); const pop = document.querySelector('.render-lightbox .cal-pop');
    if(m && pop && e.mst!=='moved') pop.querySelector('.cal-pop-acts').insertAdjacentHTML('beforebegin', `<div class="cal-meet">${meetRowHTML(p, m)}</div>`);
  };
}

/* ══════════ 5. שרשרת המועדים: משלימה רק ריק, לא דורסת ══════════
   הבאג שתוקן: ensureForumChain דרס את פורום היועצים בכל טעינה (למשל 18.06 → 13.04),
   וכתב אומדן לשדה "ועדה" כאילו הוועדה כבר התקיימה. */
function patchChain(){
  window.ensureForumChain = function(p){
    if(!p || !planIsActive(p)) return false;
    let ch = false; if(!p._est) p._est = {};
    if(p.forumArchitect && !p.forumConsultants){ p.forumConsultants = mondayMonthAfter(p.forumArchitect); p._est.forumConsultants = 1; ch = true; }
    if(!p.datesPlan) p.datesPlan = { forum1:'', forum2:'', committeePrep:'', committee:'' };
    if(p.forumConsultants && !p.datesPlan.committeePrep && !p.committeeDate){ p.datesPlan.committeePrep = mondayMonthAfter(p.forumConsultants); p._est.committeePrep = 1; ch = true; }
    return ch;
  };
}
/** תיקון חד־פעמי לנתונים שהשרשרת הישנה דרסה. אידמפוטנטי. */
function repairChainDates(){
  let n = 0;
  livePlans().forEach(p => {
    if(!planIsActive(p)) return;
    const ue = k => p._userEdited && p._userEdited[k];
    const seed = (typeof SEED_FORUM_DATES!=='undefined') && SEED_FORUM_DATES[String(p.tik)];
    // 1. פורום יועצים שנדרס באומדן: מחזירים את המועד שנקבע (seed)
    if(seed && seed.forumConsultants && !ue('forumConsultants') && p.forumArchitect && p.forumConsultants === mondayMonthAfter(p.forumArchitect) && p.forumConsultants !== seed.forumConsultants){
      meet(p,'forumConsultants').history.push({ date:p.forumConsultants, outcome:'', replacedAt:T(), note:'אומדן אוטומטי שדרס את המועד שנקבע' });
      p.forumConsultants = seed.forumConsultants; n++;
    }
    // 2. "ועדה" שהוא בעצם אומדן של השרשרת: מעבירים להכנה לוועדה, ומרוקנים את שדה הוועדה
    const sk = (typeof seedKey==='function') ? seedKey(p) : '';
    const realCom = sk && SEED_OPINIONS[sk] && SEED_OPINIONS[sk].committeeDate;
    if(p.committeeDate && !ue('committeeDate') && !realCom){
      const fcs = [p.forumConsultants, mondayMonthAfter(p.forumArchitect||''), seed && seed.forumConsultants].filter(Boolean);
      if(fcs.some(fc => p.committeeDate === mondayMonthAfter(fc))){
        if(!p.datesPlan) p.datesPlan = {};
        if(!p.datesPlan.committeePrep && p.forumConsultants){ p.datesPlan.committeePrep = mondayMonthAfter(p.forumConsultants); if(!p._est) p._est={}; p._est.committeePrep = 1; }
        meet(p,'committeeDate').history.push({ date:p.committeeDate, outcome:'', replacedAt:T(), note:'אומדן אוטומטי נרשם בטעות כמועד ועדה' });
        p.committeeDate = ''; n++;
      }
    }
    // 3. תאריך פתיחה מאוחר מאבן הדרך הראשונה: לא ממציאים תאריך, מסמנים לבירור
    const first = [p.forumArchitect, p.forumConsultants].filter(isD).sort()[0];
    const issue = (isD(p.date) && first && d10(p.date) > d10(first)) ? first : '';
    if((p.openDateIssue||'') !== issue){ p.openDateIssue = issue; n++; }
  });
  return n;
}
window.repairChainDates = repairChainDates;
window.fixOpenDate = function(id, mode){
  const p = byId(id); if(!p) return;
  if(mode==='first' && p.openDateIssue){
    const old = p.date; p.date = p.openDateIssue;
    const dt = new Date(p.date+'T00:00:00'); p.year = dt.getFullYear(); p.month = (typeof HE_MONTHS_FULL!=='undefined') ? HE_MONTHS_FULL[dt.getMonth()] : p.month;
    if(!p._userEdited) p._userEdited = {}; p._userEdited.date = 1;
    logAction(p, 'stage', `תאריך פתיחה תוקן מ-${F(old)} ל-${F(p.date)} (מועד פורום אדריכל העיר)`);
    p.openDateIssue = ''; save(p);
  }
  if(typeof openProject==='function') openProject(id);
};

/* ══════════ 6. ספריית ידע ומאגר תוצרים ══════════ */
const LIB = [
  { g:'הנחיות ומדיניות עירונית', items:[
    { t:'הנחיות להגשת תוכנית בינוי ועיצוב', d:'תהליך האישור, לוחות זמנים וחומרי ההגשה.', src:'עיריית אשדוד, אדריכלית העיר', go:'guidelines', ok:'פנימי' },
    { t:'הנחיות מרחביות, מהדורה 18', d:'פרקים, סעיפים וחיפוש לפי מילת מפתח.', src:'עיריית אשדוד', go:'spatial', pdf:'source-spatial18.pdf', ok:'פנימי' },
    { t:'אוגדן דרישות העירייה', d:'דרישות כל אגף לתוכנית בינוי ועיצוב.', src:'אוגדן עיריית אשדוד, 30.06.2025', go:'muni', pdf:'source-aoggdan.pdf', ok:'פנימי' } ]},
  { g:'חקיקה ותוכניות סטטוטוריות', items:[
    { t:'חוק התכנון והבנייה, התשכ"ה-1965', d:'המסגרת הסטטוטורית לתוכניות ולהיתרים.', src:'ספר החוקים', url:'', ok:'טעון השלמה' },
    { t:'מבא"ת: מערכת התכנון הארצית', d:'הוראות, תשריטים ונספחים של כל תב"ע.', src:'מינהל התכנון', url:'https://mavat.iplan.gov.il', ok:'לא נבדק מכאן' } ]},
  { g:'מפות ו-GIS', items:[
    { t:'GIS עיריית אשדוד: גושים וחלקות', d:'שכבת החלקות הרשומות. ממנה ממוקמות התוכניות במפה.', src:'עיריית אשדוד', url:'https://gis.ashdod.muni.il/arcgis/rest/services', ok:'נבדק 02.11.2026' },
    { t:'מפת התוכניות באפליקציה', d:'כל תוכנית במגרש שלה, עם מקרא דיוק.', src:'האפליקציה', go:'map', ok:'פנימי' },
    { t:'govmap: המפה הממשלתית', d:'גושים, חלקות ותצלומי אוויר ארציים.', src:'המרכז למיפוי ישראל', url:'https://www.govmap.gov.il', ok:'לא נבדק מכאן' } ]},
  { g:'מחשבונים וכלי עזר', items:[
    { t:'מחשבונים לתהליך האישור', d:'חניה, שטחים ותקנים, עם מקור לכל כלל.', src:'האפליקציה', go:'calchub', ok:'פנימי' },
    { t:'ציר זמן ושלבים', d:'משך כל שלב מול חציון העיר.', src:'האפליקציה', go:'timeline', ok:'פנימי' } ]},
  { g:'אפליקציות עירוניות', items:[
    { t:'מה נבנה סביבי: התחדשות עירונית', d:'מתחמי ההתחדשות, מודל תלת־ממדי, שמש וצל.', src:'עיריית אשדוד', url:'https://ashdod-ma-nivne.vercel.app', ok:'מסונכרן' },
    { t:'אתר עיריית אשדוד', d:'האתר הרשמי של העירייה.', src:'עיריית אשדוד', url:'https://www.ashdod.muni.il', ok:'לא נבדק מכאן' } ]}
];
const OK_CLS = { 'פנימי':'lib-ok', 'מסונכרן':'lib-ok', 'נבדק 02.11.2026':'lib-ok', 'לא נבדק מכאן':'lib-unk', 'טעון השלמה':'lib-miss' };
function renderLibrary(){
  const el = document.getElementById('libraryBody'); if(!el) return;
  el.innerHTML = `<div class="page-title">ספריית ידע תכנוני</div>
    <div class="page-subtitle">כל המקורות במקום אחד. לכל כרטיס מקור וסטטוס אימות. קישור שלא אומת מסומן, ואין כתובות מומצאות.</div>
    ${LIB.map(g => `<h3 class="lib-g">${H(g.g)}</h3><div class="lib-grid">${g.items.map(c => {
      const act = c.go ? `onclick="go('${c.go}',navBtn('${c.go}'))"` : (c.url ? `onclick="window.open('${H(c.url)}','_blank','noopener')"` : '');
      return `<div class="lib-card${act?'':' lib-dis'}" ${act} ${act?'tabindex="0" role="link"':''}>
        <div class="lib-t">${H(c.t)}</div><div class="lib-d">${H(c.d)}</div>
        <div class="lib-f"><span class="pp-src">${H(c.src)}</span><span class="lib-ok ${OK_CLS[c.ok]||''}">${H(c.ok)}</span></div>
        ${c.pdf?`<a class="lib-pdf" href="${H(c.pdf)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">מסמך המקור (PDF)</a>`:''}
        ${c.url?`<div class="lib-url" dir="ltr">${H(c.url.replace(/^https?:\/\//,''))}</div>`:''}
      </div>`; }).join('')}</div>`).join('')}`;
}
let outF = { district:'', year:'', type:'', q:'' };
window.setOutF = function(k, v){ outF[k] = v; renderOutputs(); };
function outputItems(){
  const out = [];
  livePlans().forEach(p => {
    const ev = approvalEvidence(p);
    const dec = ev.decisionText, yr = (p.committeeDate||p.approvalDate||p.date||'').slice(0,4);
    const base = { p, district:p.district, year:yr };
    if(ev.complete) out.push({ ...base, type:'תוכנית מאושרת וחתומה', date:p.signDate, text:`אושרה ${F(p.approvalDate)}, נחתמה ${F(p.signDate)}` });
    if(ev.decision && (!planIsActive(p) || isD(p.committeeDate) && d10(p.committeeDate) <= T()))
      out.push({ ...base, type:'החלטת ועדה', date:p.committeeDate, text:String(dec).slice(0,160) });
    (p.documents||[]).filter(d => /חתום|סופי|מאושר|סרוק/.test(String(d.type)+' '+String(d.name))).forEach(d =>
      out.push({ ...base, type:'מסמך חתום או סופי', date:d.date, text:d.name, url:d.url }));
    if(p.opinion && p.opinion.recommendation && !planIsActive(p))
      out.push({ ...base, type:'חוות דעת סופית', date:p.opinion.savedAt||p.committeeDate, text:String(p.opinion.recommendation).slice(0,160) });
  });
  return out;
}
function renderOutputs(){
  const el = document.getElementById('outputsBody'); if(!el) return;
  const all = outputItems();
  const list = all.filter(o => (!outF.district || o.district===outF.district) && (!outF.year || o.year===outF.year) && (!outF.type || o.type===outF.type)
    && (!outF.q || [o.p.planNum,o.p.tik,o.p.location,o.text].join(' ').includes(outF.q)));
  const opts = (k, arr) => [...new Set(arr)].filter(Boolean).sort().map(v=>`<option ${outF[k]===v?'selected':''}>${H(v)}</option>`).join('');
  const done = livePlans().filter(p=>!planIsActive(p)).length, noProd = livePlans().filter(p=>!planIsActive(p) && !all.some(o=>o.p===p)).length;
  el.innerHTML = `<div class="page-title">מאגר תוצרים מאושרים</div>
    <div class="page-subtitle">רק תוצר עם ראיה: החלטת ועדה שהתקבלה, תוכנית שאושרה ונחתמה, מסמך שסומן חתום או סופי. טיוטות לא מוצגות.</div>
    <div class="tl-insight"><mark><b>${list.length}</b> תוצרים מתועדים</mark></div>
    <div class="tl-explain">${noProd?`<span class="tl-bad">ל-<b>${noProd}</b> מתוך <b>${done}</b> תוכניות שהושלמו אין תוצר מתועד במערכת.</span> כדי להוסיף: החלטת ועדה בכרטיס התוכנית, או מסמך מסוג "חתום".`:'לכל תוכנית שהושלמה יש תוצר מתועד.'}</div>
    <div class="out-f">
      <input class="out-q" placeholder="חיפוש בתוצרים: מספר תוכנית, מגרש, נוסח" value="${H(outF.q)}" oninput="setOutF('q',this.value)">
      <select onchange="setOutF('district',this.value)"><option value="">כל הרובעים</option>${opts('district', all.map(o=>o.district))}</select>
      <select onchange="setOutF('year',this.value)"><option value="">כל השנים</option>${opts('year', all.map(o=>o.year))}</select>
      <select onchange="setOutF('type',this.value)"><option value="">כל סוגי התוצרים</option>${opts('type', all.map(o=>o.type))}</select>
    </div>
    <div class="tbl-wrap"><table class="track-table"><thead><tr><th>תוכנית</th><th>רובע</th><th>סוג תוצר</th><th>תאריך</th><th>תוכן</th></tr></thead><tbody>
    ${list.sort((a,b)=>String(b.date||'').localeCompare(a.date||'')).map(o=>`<tr onclick="openProject(${o.p.id})" style="cursor:pointer"><td><b>${H(o.p.planNum)}</b><div class="muted">${H(o.p.location||'')}</div></td><td>${H(o.district)}</td><td>${H(o.type)}</td><td>${F(o.date)}</td><td>${H(o.text)}${o.url?` <a href="${H(o.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">פתיחה</a>`:''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">אין תוצרים בסינון הזה.</td></tr>'}
    </tbody></table></div>`;
}
window.renderLibrary = renderLibrary; window.renderOutputs = renderOutputs;

/* ══════════ 7. חיפוש גלובלי מקובץ ══════════ */
function heMatch(text, q){
  const t = String(text||'').toLowerCase(), s = q.toLowerCase().trim(); if(!s) return false;
  if(/^\d+$/.test(s)) return t.includes(s);
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|[\\s"'(\\-/,.])([הובכלמש]{0,2})${esc}`).test(t) || (s.length > 3 && t.includes(s));
}
function searchAll(q){
  const P = livePlans().filter(p => heMatch([p.planNum,p.tik,p.projectName,p.location,p.district,p.developer,p.submitter,p.change,p.parcel,(p.meta&&p.meta.archName)].join(' '), q)).slice(0,8);
  const C = (typeof contacts!=='undefined'?contacts:[]).filter(c => heMatch([c.name,c.org,c.title,c.type,c.phone,c.email].join(' '), q)).slice(0,6);
  const D = []; livePlans().forEach(p => (p.documents||[]).forEach(d => { if(heMatch(d.name, q)) D.push({ p, d }); }));
  const N = []; livePlans().forEach(p => (p.notes||[]).forEach(n => { if(heMatch(n.text||n.body||'', q)) N.push({ p, n }); }));
  return { P, C, D:D.slice(0,5), N:N.slice(0,5) };
}
function patchSearch(){
  const inp = document.getElementById('globalSearch'); if(!inp) return;
  inp.setAttribute('oninput', ''); inp.setAttribute('autocomplete','off'); inp.setAttribute('aria-label','חיפוש בכל המערכת');
  inp.placeholder = 'חיפוש: תוכנית, רחוב, יזם, איש קשר';
  const bar = inp.closest('.search-bar'); bar.style.position = 'relative';
  bar.insertAdjacentHTML('beforeend', '<button class="gs-x" type="button" aria-label="ניקוי החיפוש" hidden>×</button><div class="gs-pop" role="listbox" hidden></div>');
  const pop = bar.querySelector('.gs-pop'), x = bar.querySelector('.gs-x');
  const close = () => { pop.hidden = true; };
  const draw = () => {
    const q = inp.value.trim(); x.hidden = !q;
    if(q.length < 2){ close(); return; }
    const r = searchAll(q);
    const sec = (t, arr, fn) => arr.length ? `<div class="gs-h">${t} <span class="tl-n">${arr.length}</span></div>${arr.map(fn).join('')}` : '';
    const html = sec('תוכניות', r.P, p => `<button class="gs-i" onclick="openProject(${p.id})"><b>${H(p.planNum)}</b> ${H(p.district)} · ${H(p.location||'')}<span class="gs-s">${H(p.developer||p.submitter||'')}</span></button>`)
      + sec('אנשי קשר', r.C, c => `<button class="gs-i" onclick="gsContact('${H(c.name)}')"><b>${H(c.name)}</b> ${H(c.type||'')}<span class="gs-s">${H(c.org||'')}</span></button>`)
      + sec('מסמכים', r.D, o => `<button class="gs-i" onclick="openProject(${o.p.id});setTimeout(()=>ppTab('docs'),80)"><b>${H(o.d.name)}</b><span class="gs-s">${H(o.p.planNum)}</span></button>`)
      + sec('הערות', r.N, o => `<button class="gs-i" onclick="openProject(${o.p.id})"><b>${H(String(o.n.text||o.n.body||'').slice(0,60))}</b><span class="gs-s">${H(o.p.planNum)}</span></button>`);
    pop.innerHTML = html || `<div class="gs-none">אין תוצאות ל"${H(q)}". Enter מחפש בטבלת התוכניות.</div>`;
    pop.hidden = false;
  };
  inp.addEventListener('input', draw);
  inp.addEventListener('focus', () => { inp.select(); draw(); });
  inp.addEventListener('keydown', e => {
    if(e.key==='Escape'){ inp.value=''; draw(); inp.blur(); }
    if(e.key==='Enter'){ close(); if(typeof globalSearchFn==='function') globalSearchFn(inp.value); }
  });
  x.addEventListener('click', () => { inp.value=''; draw(); inp.focus(); });
  document.addEventListener('click', e => { if(!bar.contains(e.target)) close(); });
  pop.addEventListener('click', e => { if(e.target.closest('.gs-i')) close(); });
}
window.gsContact = function(name){ if(typeof contactView!=='undefined'){ contactView.q = name; } go('contacts', navBtn('contacts')); };

/* ══════════ 8. אנשי קשר: צוותים, WhatsApp, תיקון שיוך ══════════ */
const TEAM_OF = { 'יזם':'צוות היזם','אדריכל':'צוות היזם','מנהל פרויקט':'צוות היזם','עורך בקשה':'צוות היזם','יועץ':'יועצים','גורם עירייה':'צוות העירייה','גורם מאשר':'צוות העירייה' };
window.contactTeam = c => (c && c.team) || TEAM_OF[c && c.type] || 'גורמים נוספים';
/** טלפון ישראלי → wa.me (972...). מחזיר '' כשאין מספר נייד תקין */
function waNum(ph){ let d = String(ph||'').replace(/\D/g,''); if(d.startsWith('972')) d = d.slice(3); if(d.startsWith('0')) d = d.slice(1); return /^5\d{8}$/.test(d) ? '972'+d : ''; }
window.waNum = waNum;
window.waOpen = function(phone, text, cid){
  const n = waNum(phone); if(!n){ toast('אין מספר נייד תקין לאיש הקשר'); return; }
  window.open('https://wa.me/'+n+'?text='+encodeURIComponent(text||''), '_blank', 'noopener');
  toast('נפתחה הודעה ב-WhatsApp לעריכה. השליחה מתבצעת שם, בידייך.');
  const c = (contacts||[]).find(x=>x.id===cid); const p = c && c.plans && plans.find(q=>String(q.tik)===String(c.plans[0]));
  if(p) logAction(p, 'wa', 'נפתחה טיוטת WhatsApp ל'+c.name+' (השליחה לא אומתה)');
};
/** בחירה מרובה: WhatsApp לא תומך בשליחה קבוצתית מקישור. מוצגת רשימה, ופותחים לכל אחד בנפרד. */
window.bulkWhatsApp = function(){
  const sel = (contacts||[]).filter(c => contactView.selected[c.id]);
  if(!sel.length){ toast('בחרי אנשי קשר'); return; }
  const ov = document.createElement('div'); ov.className='render-lightbox'; ov.onclick = e => { if(e.target===ov) ov.remove(); };
  ov.innerHTML = `<div class="cal-pop" style="max-width:560px"><h3>הודעת WhatsApp ל-${sel.length} אנשי קשר</h3>
    <div class="pp-src">שליחה קבוצתית דורשת אינטגרציה מורשית של WhatsApp Business, שאינה מחוברת. כל כפתור פותח צ'אט אישי עם ההודעה לעריכה. האפליקציה לא יודעת אם ההודעה נשלחה.</div>
    <textarea id="waBulkText" rows="4" class="mt-in" style="width:100%">שלום רב,\n</textarea>
    <ul class="pr-notes">${sel.map(c => `<li>${H(c.name)} <span class="muted">${H(c.org||'')}</span> ${waNum(c.phone)?`<button class="btn btn-sm" onclick="waOpen('${H(c.phone)}',document.getElementById('waBulkText').value,'${H(c.id)}');this.textContent='נפתח';this.disabled=true">פתיחה</button>`:'<span class="pr-miss">אין נייד</span>'}</li>`).join('')}</ul>
    <div class="cal-pop-acts"><button class="btn btn-ghost btn-sm" onclick="this.closest('.render-lightbox').remove()">סגירה</button></div></div>`;
  document.body.appendChild(ov);
};
/** תיקון: אנשי הקשר מקבצי חוות הדעת שויכו לפי מספר המסמך (תב/XXXX) כאילו היה מספר התיק */
function fixContactPlans(){
  if(typeof contacts==='undefined' || !contacts.length) return 0;
  const map = {}; livePlans().forEach(p => { const pn = String(p.planNum||'').replace(/\D/g,''); if(pn && pn!==String(p.tik)) map[pn] = String(p.tik); });
  const skip = (typeof SEED_SKIP!=='undefined') ? SEED_SKIP : {};
  let n = 0;
  contacts.forEach(c => {
    if(!c.real || c._plansFixed) return;
    const docs = (c.sources||[]).map(s => (String(s).match(/תכנית בינוי (\d+)/)||[])[1]).filter(Boolean);
    if(!docs.length) return;
    const fixed = [...new Set(docs.filter(d => !skip[d]).map(d => map[d] || (livePlans().some(p=>String(p.tik)===d && String(p.planNum).replace(/\D/g,'')===d) ? d : '')).filter(Boolean))];
    const manual = (c.plans||[]).filter(t => !docs.includes(String(t)));
    const next = [...new Set([...fixed, ...manual])];
    if(JSON.stringify(next) !== JSON.stringify(c.plans||[])){ c.plans = next; n++; }
    c._plansFixed = 1;
  });
  if(n && typeof saveContacts==='function') saveContacts();
  return n;
}
window.fixContactPlans = fixContactPlans;
function patchContacts(){
  const orig = window.renderContactsPage; if(typeof orig!=='function') return;
  const _fc = window.filteredContacts;
  if(typeof _fc==='function') window.filteredContacts = function(){ const l = _fc.apply(this, arguments); return contactView.team ? l.filter(c => contactTeam(c)===contactView.team) : l; };
  window.renderContactsPage = function(){
    try{ fixContactPlans(); }catch(e){}
    orig();
    const el = document.getElementById('contactsBody'); if(!el) return;
    // חיפוש חופשי: רכיב בולט ונפרד מהסינון
    const s = document.getElementById('contactSearch');
    if(s && !s.closest('.ct-search')){
      const box = document.createElement('div'); box.className = 'ct-search';
      box.innerHTML = '<label for="contactSearch" class="pr-k">חיפוש חופשי</label>';
      const caret = s.value.length; s.parentNode.insertBefore(box, s.parentNode.firstChild); box.appendChild(s);
      s.placeholder = 'שם, חברה, תפקיד, טלפון או דוא"ל'; if(document.activeElement!==s && contactView.q){ s.focus(); s.setSelectionRange(caret, caret); }
      const tb = el.querySelector('.contacts-toolbar'); if(tb){ tb.insertAdjacentHTML('afterbegin','<span class="pr-k ct-fl">סינון ומיון</span>'); tb.parentNode.insertBefore(box, tb); }
    }
    // צוותים: סינון לפי צוות
    const tb = el.querySelector('.contacts-toolbar');
    if(tb && !tb.querySelector('.ct-team')){
      const teams = ['צוות היזם','צוות העירייה','יועצים','גורמים נוספים'];
      tb.insertAdjacentHTML('beforeend', `<span class="ct-team">${teams.map(t=>`<button class="tl-chip${contactView.team===t?' on':''}" onclick="contactView.team=contactView.team==='${t}'?'':'${t}';renderContactsPage()">${t} <span class="tl-n">${contacts.filter(c=>contactTeam(c)===t).length}</span></button>`).join('')}</span>`);
    }
    // WhatsApp לכל איש קשר, ופעולת קבוצה כנה
    el.querySelectorAll('a.c-ico[href^="tel:"], a.c-link[href^="tel:"]').forEach(a => {
      if(a.nextElementSibling && a.nextElementSibling.classList.contains('c-wa')) return;
      const ph = a.getAttribute('href').slice(4); if(!waNum(ph)) return;
      a.insertAdjacentHTML('afterend', ` <a class="c-ico c-wa" href="javascript:void 0" onclick="waOpen('${H(ph)}','שלום רב,\\n','')">WhatsApp</a>`);
    });
    const bulk = el.querySelector('.contacts-bulk');
    if(bulk && !bulk.querySelector('.ct-wa')) bulk.insertAdjacentHTML('beforeend', '<button class="btn btn-ghost btn-xs ct-wa" onclick="bulkWhatsApp()">WhatsApp לנבחרים</button>');
  };
  // ניסוח כן: mailto פותח טיוטה. לא "נשלח".
  const origSend = window.mailPrepareSend;
  if(typeof origSend==='function') window.mailPrepareSend = function(planId){
    const p = byId(planId); const before = p && (p.actionLog||[]).length;
    origSend(planId);
    if(p && p.actionLog && p.actionLog.length > before){ const a = p.actionLog[p.actionLog.length-1]; if(a && /^נשלח מייל/.test(a.detail)){ a.detail = a.detail.replace(/^נשלח מייל/, 'נפתחה טיוטת מייל בלקוח הדואר (השליחה לא אומתה)'); savePlans(); } }
  };
}


/* ══════════ 9. מפה: רחובות, חיפוש, רובע, שמירת מיקום, וכישלון גלוי ══════════
   בסיס: CARTO Voyager (OpenStreetMap), עם שמות רחובות בשכבה נפרדת. אם האריחים נכשלים: מעבר
   אוטומטי ל-OpenStreetMap הרגיל. חיפוש כתובת: Nominatim, רק בלחיצה (מדיניות השימוש: עד בקשה בשנייה). */
const MAP_VIEW_KEY = 'ashdod_map_view_v1';
function mapNote(html, bad){
  let n = document.getElementById('mapNote');
  if(!n){ const side = document.querySelector('#map .g2 > div:last-child'); if(!side) return; n = document.createElement('div'); n.id = 'mapNote'; side.prepend(n); }
  n.className = 'map-note' + (bad ? ' bad' : ''); n.innerHTML = html;
}
function patchMapPlus(){
  const _init = window.initMap;
  let leafletWait = 0;
  window.initMap = function(){
    if(typeof L === 'undefined'){
      if(++leafletWait > 40){ const m = document.getElementById('gis-map'); if(m) m.innerHTML = '<div class="map-fail"><b>המפה לא נטענה.</b><br>ספריית המפות (Leaflet) לא הגיעה מהשרת cdnjs.cloudflare.com. בדקו את החיבור לרשת ורעננו את הדף.</div>'; return; }
      return setTimeout(window.initMap, 200);
    }
    _init();
    try{
      // בסיס עם רחובות
      gisMap.eachLayer(l => { if(l._url && /light_nolabels|light_only_labels/.test(l._url)) gisMap.removeLayer(l); });
      const base = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', { maxZoom:20, attribution:'© OpenStreetMap © CARTO' });
      const labels = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', { maxZoom:20, pane:'shadowPane' });
      const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' });
      base.addTo(gisMap).bringToBack(); labels.addTo(gisMap); gisLayers.roads = labels;
      const roadsName = document.querySelector('.layer-toggle[data-layer=roads]'); if(roadsName){ roadsName.classList.add('on'); const nm = roadsName.parentNode.querySelector('.layer-name'); if(nm) nm.textContent = 'שמות רחובות'; }
      let errs = 0, loaded = 0, switched = false;
      base.on('tileload', () => { loaded++; });
      base.on('tileerror', () => {
        if(switched || ++errs < 6 || loaded > 4) return;
        switched = true; gisMap.removeLayer(base); gisMap.removeLayer(labels); osm.addTo(gisMap).bringToBack(); gisLayers.roads = L.layerGroup();
        mapNote('מפת הבסיס CARTO לא נטענה, ולכן עברנו ל-OpenStreetMap. שמות הרחובות כלולים בה.', false);
      });
      osm.on('tileerror', () => { if(++errs > 14) mapNote('<b>אריחי המפה לא נטענים.</b> התוכניות מוצגות, אבל בלי רקע. בדקו את החיבור לרשת.', true); });
      L.control.layers({ 'מפת רחובות (CARTO)': base, 'OpenStreetMap': osm }, null, { position:'topleft' }).addTo(gisMap);
      // שמירת מיקום וזום
      let saved = null; try{ saved = JSON.parse(localStorage.getItem(MAP_VIEW_KEY)||'null'); }catch(e){}
      if(saved && saved.c && saved.z) setTimeout(() => gisMap.setView(saved.c, saved.z), 30);
      gisMap.on('moveend', () => { try{ const c = gisMap.getCenter(); localStorage.setItem(MAP_VIEW_KEY, JSON.stringify({ c:[+c.lat.toFixed(5), +c.lng.toFixed(5)], z:gisMap.getZoom() })); }catch(e){} });
    }catch(e){ console.warn('map plus', e); mapNote('שגיאה בהגדרת המפה: '+H(e.message), true); }
  };
  // חיפוש ורובע בראש הטור הצדדי
  const side = document.querySelector('#map .g2 > div:last-child');
  if(side && !document.getElementById('mapSearch')){
    const dists = [...new Set(livePlans().map(p=>p.district).filter(Boolean))].sort();
    side.insertAdjacentHTML('afterbegin', `<div class="map-find">
      <label class="pr-k" for="mapSearch">חיפוש במפה</label>
      <div class="map-q"><input id="mapSearch" placeholder="מספר תוכנית, רחוב או כתובת" autocomplete="off" onkeydown="if(event.key==='Enter')mapFind(this.value)"><button class="btn btn-sm" onclick="mapFind(document.getElementById('mapSearch').value)">חיפוש</button></div>
      <div id="mapFindRes" class="map-res"></div>
      <select id="mapDistrict" onchange="mapDistrict(this.value)"><option value="">התמקדות ברובע</option>${dists.map(d=>`<option>${H(d)}</option>`).join('')}</select>
    </div>`);
  }
}
let _mapPin = null;
window.mapFind = async function(q){
  q = String(q||'').trim(); const res = document.getElementById('mapFindRes'); if(!q || !res) return;
  const num = q.replace(/\D/g,'');
  const hit = livePlans().filter(p => (num && (String(p.tik)===num || String(p.planNum).replace(/\D/g,'')===num)) || (!num && heMatch([p.location,p.projectName,p.district].join(' '), q)));
  if(hit.length){
    res.innerHTML = hit.slice(0,6).map(p => `<button class="gs-i" onclick="mapFocusPlan(${p.id})"><b>${H(p.planNum)}</b> ${H(p.location||'')}</button>`).join('');
    if(hit.length===1) mapFocusPlan(hit[0].id);
    return;
  }
  res.innerHTML = '<div class="muted">מחפש כתובת…</div>';
  try{
    const u = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=he&bounded=1&viewbox=34.58,31.86,34.72,31.73&q=' + encodeURIComponent(q + ', אשדוד');
    const r = await fetch(u, { headers:{ 'Accept':'application/json' } }); if(!r.ok) throw new Error('HTTP '+r.status);
    const rows = await r.json();
    res.innerHTML = rows.length ? rows.map(x => `<button class="gs-i" onclick="mapGo(${+x.lat},${+x.lon},'${H(String(x.display_name).split(',').slice(0,2).join(','))}')">${H(String(x.display_name).split(',').slice(0,3).join(','))}</button>`).join('')
      : `<div class="muted">לא נמצאה כתובת "${H(q)}" באשדוד.</div>`;
    if(rows.length===1) mapGo(+rows[0].lat, +rows[0].lon, String(rows[0].display_name).split(',')[0]);
  }catch(e){ res.innerHTML = `<div class="pr-miss">חיפוש הכתובת נכשל (${H(e.message)}). אפשר לחפש לפי מספר תוכנית.</div>`; }
};
window.mapGo = function(lat, lng, label){
  if(typeof gisMap==='undefined' || !gisMap) return;
  gisMap.setView([lat, lng], 17);
  if(_mapPin) gisMap.removeLayer(_mapPin);
  _mapPin = L.circleMarker([lat,lng], { radius:7, color:'#1a1a18', weight:2, fillColor:'#fff', fillOpacity:1 }).bindTooltip(H(label||''), { permanent:true, direction:'top' }).addTo(gisMap);
};
window.mapFocusPlan = function(id){
  const p = byId(id); const g = p && typeof planGeo==='function' && planGeo(p); if(!g) return;
  if(typeof statusFilter!=='undefined' && statusFilter!=='all' && p.status!==statusFilter && typeof setStatusFilter==='function') setStatusFilter('all');
  mapGo(g.lat, g.lng, `${p.planNum} · ${p.location||''}${['parcel','compound','user'].includes(g.prec)?'':' (מיקום משוער)'}`);
};
window.mapDistrict = function(d){
  if(!d || typeof gisMap==='undefined') return;
  const pts = livePlans().filter(p=>p.district===d).map(p=>planGeo(p)).filter(Boolean).map(g=>[g.lat,g.lng]);
  if(pts.length) gisMap.fitBounds(pts, { padding:[40,40], maxZoom:16 });
};


/* ══════════ 10. דף הבית: חזון, תהליך ושלושה אזורים ══════════ */
function homeZonesHTML(){
  const L_ = livePlans(), act = L_.filter(planIsActive);
  const outs = outputItems().length, ct = (typeof contacts!=='undefined') ? contacts.length : 0;
  const due = act.reduce((n,p)=>n+MEET.filter(m=>['due','missed'].includes(meetState(p,m).st)).length,0);
  const libN = LIB.reduce((n,g)=>n+g.items.length,0);
  const z = (k, t, d, links) => `<div class="zone zone-${k}"><div class="zone-k">${t}</div><p>${d}</p>
    <div class="zone-l">${links.map(([id,lbl,n])=>`<button onclick="go('${id}',navBtn('${id}'))"><span>${lbl}</span>${n!=null?`<b>${n}</b>`:''}</button>`).join('')}</div></div>`;
  return `<section class="home-zones" id="homeZones">
    <div class="hz-vision">
      <div class="pr-k">מה זה תוכנית בינוי ועיצוב</div>
      <p><b>תוכנית בינוי ועיצוב</b> מפרטת את העמדת הבניינים, הפיתוח והעיצוב במגרש, בהתאם לתב"ע.</p>
      <p>הבדיקה העירונית מוודאת התאמה לתב"ע, להנחיות המרחביות ולאוגדן, לפני הדיון בוועדה.</p>
      <ol class="hz-steps">${STAGES.map((st,i)=>`<li><span class="pr-n">${['א','ב','ג','ד'][i]}</span>${H(st.title.split(': ')[1])}</li>`).join('<li class="hz-ar" aria-hidden="true">←</li>')}</ol>
      <div class="hz-val"><span><b>לאדריכלית העיר:</b> מה דורש טיפול היום.</span><span><b>לצוות:</b> מקור אחד לכל מועד ומסמך.</span><span><b>ליזם:</b> מה להביא ומתי.</span></div>
    </div>
    ${z('proc','תהליך: שולחן העבודה','התוכניות הפעילות, המועדים והמשימות.',[['table','תוכניות פעילות',act.length],['timeline','שלבים ומועדים',due?due+' באיחור':null],['calendar','לוח שנה',null],['map','מפה',null],['contacts','רשימת קשר',ct],['notes','הערות וסיכומים',null]])}
    ${z('info','מידע: ספריית הידע','הנחיות, חקיקה, מפות ומחשבונים, עם מקור לכל פריט.',[['library','ספריית ידע',libN],['guidelines','הנחיות להגשה',null],['spatial','הנחיות מרחביות',null],['muni','אוגדן העירייה',null],['calchub','מחשבונים',null]])}
    ${z('out','תוצרים: המאגר המאושר','רק תוצר עם ראיה: החלטה, אישור וחתימה.',[['outputs','מאגר תוצרים',outs],['shares','חוות דעת ודיווחים',null]])}
  </section>`;
}
function patchHomeZones(){
  const _rl = window.renderLanding; if(typeof _rl!=='function') return;
  window.renderLanding = function(){
    _rl.apply(this, arguments);
    try{
      const old = document.getElementById('homeZones'); if(old) old.remove();
      const qc = document.querySelector('#landing .quick-cards'); if(qc){ qc.style.display='none'; qc.insertAdjacentHTML('beforebegin', homeZonesHTML()); }
    }catch(e){ console.warn('home zones', e); }
  };
  const pg = document.querySelector('.page.active'); if(pg && pg.id==='landing') window.renderLanding();
}

/* ══════════ חיבור ══════════ */
function patchNav(){
  const _go = window.go;
  window.go = function(id, btn, isBack){ _go(id, btn, isBack);
    if(id==='library') renderLibrary(); if(id==='outputs') renderOutputs();
    if(['library','outputs'].includes(id) && ('#'+id)!==location.hash) history.replaceState(null,'','#'+id);
  };
  const _r = window.routeFromHash;
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if(h==='library'||h==='outputs') window.go(h, navBtn(h)); });
}
function boot(){
  if(typeof plans==='undefined' || typeof renderStageStrip!=='function'){ return setTimeout(boot, 50); }
  const _agm = window.applyGlobalMode;
  if(typeof _agm==='function') window.applyGlobalMode = function(){ _agm.apply(this, arguments); try{ const p = (typeof pj==='function') && pj(); if(p && document.getElementById('procPanel')) rerender(p); }catch(e){} };
  patchChain(); patchProjectPage(); patchCalendar(); patchContacts(); patchSearch(); patchNav(); patchMapPlus(); patchHomeZones();
  // תיקוני מועדים: אחרי ה-seed ואחרי הענן (הענן גובר, ולכן מתקנים שוב אחריו)
  const _fx = window.fixDataIssues;
  if(typeof _fx==='function') window.fixDataIssues = function(){ let n = _fx.apply(this, arguments) || 0; try{ n += repairChainDates(); }catch(e){ console.warn('chain repair', e); } return n; };
  try{ if(repairChainDates()) savePlans(); }catch(e){}
  const h = location.hash.slice(1); if(h==='library'||h==='outputs') window.go(h, navBtn(h));
}
boot();
})();
