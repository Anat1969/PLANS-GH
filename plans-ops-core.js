/* ══════════════════════════════════════════════════════════════════
   plans-ops-core.js: מנוע העבודה האוטונומי (ענת, 24.11.2026).
   "המערכת מנהלת את העבודה. אני מנהלת את ההחלטות."
   קובץ טהור, בלי DOM: אותו קוד רץ בדפדפן (plans-now.js) ובשרת (tools/ops-engine.mjs).
   כך יש מקור אמת אחד לכללים, והדף והשרת לא יכולים לסתור זה את זה.
   הקלט: מערך התוכניות כפי שהוא נשמר (ashdod_plans.data), היום, ומצב המשתמשת (ops_user).
   הפלט: פריטי עבודה מסווגים לשבע קומות, ברמת אוטונומיה, עם ציון עדיפות, נרטיב והקשר.
   לוגיקה דטרמיניסטית בלבד: תאריכים, סטטוסים, תלויות, כפילויות. אין כאן קריאה למודל.
   ══════════════════════════════════════════════════════════════════ */
(function(root){
'use strict';

const LEVEL = { 1:'אוטונומית', 2:'אוטונומית מותנית', 3:'טעונה אישור', 4:'טעונה החלטה', 5:'ידנית' };
const TIERS = [
  ['decide',   'מחייב את החלטתי',  'החלטות שרק את יכולה לקבל'],
  ['approve',  'מוכן לאישורך',     'תוצרים שהמערכת כבר הכינה'],
  ['system',   'המערכת מטפלת',     'פעולות אוטומטיות בביצוע או בתזמון'],
  ['waiting',  'ממתינים לאחרים',   'חומרים ומענים שטרם התקבלו'],
  ['upcoming', 'נערכים להמשך',     'פגישות, מועדים והכנות'],
  ['done',     'מה כבר נעשה',      'סיפור ההתקדמות']
];
const DONE_STATUSES = ['הושלם','אושר סופית','בוטל','נסגר','תוכנית נסגרה','סגור'];
const NO_STATUS = ['','טרם עודכן'];
const MEET = [
  { key:'forumArchitect',   label:'פורום אדריכל העיר', next:'forumConsultants', get:p => p.forumArchitect },
  { key:'forumConsultants', label:'פורום יועצים',      next:'committeePrep',    get:p => p.forumConsultants },
  { key:'committeePrep',    label:'הכנה לוועדה',        next:'committeeDate',    get:p => p.datesPlan && p.datesPlan.committeePrep },
  { key:'committeeDate',    label:'ועדה',               next:'',                 get:p => p.committeeDate }
];
/* ברירות המחדל של הפרמטרים. ענת יכולה לשנות כל אחד במסך האוטומציות (ops_user.params). */
const PARAMS = { formReminderDays:7, reminderRepeatDays:5, prepLeadDays:3, upcomingDays:14, staleDays:21, summaryDays:7 };

/* ── עזרי תאריך (בלי Date.now: היום נכנס מבחוץ, כדי שהשרת והבדיקות יהיו דטרמיניסטיים) ── */
const isD = d => /^\d{4}-\d{2}-\d{2}/.test(String(d||''));
const d10 = d => String(d||'').slice(0, 10);
const days = (a, b) => Math.round((Date.parse(d10(b)+'T00:00:00Z') - Date.parse(d10(a)+'T00:00:00Z')) / 864e5);
const addDays = (d, n) => { const t = new Date(Date.parse(d10(d)+'T00:00:00Z') + n*864e5); return t.toISOString().slice(0, 10); };
const fmt = d => isD(d) ? d10(d).split('-').reverse().join('.') : '';
/** יום שני הקרוב, לפחות n ימים אחרי d. כך מוצע מועד שהוא יום עבודה של הפורומים. */
function mondayAfter(d, n){ let t = addDays(d, n); while(new Date(t+'T00:00:00Z').getUTCDay() !== 1) t = addDays(t, 1); return t; }
function todayIL(){
  try{ return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Jerusalem', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
  catch(e){ return new Date().toISOString().slice(0, 10); }
}

const isActive = p => !p._deleted && !DONE_STATUSES.includes(p.status) && !NO_STATUS.includes(p.status || '');
const noStatus = p => !p._deleted && NO_STATUS.includes(p.status || '');
const planName = p => { const t = p.planNum ? (String(p.planNum).includes('תב') ? p.planNum : 'תב/'+p.planNum) : 'תב/'+p.tik; return [t, p.location].filter(Boolean).join(' · '); };
/** המטרה: שאושרה > מטרת התב"ע מההוראות (data/taba) > תיאור התיק. "תוכנית בינוי" לבד אינו מטרה. */
function goalOf(p, ctx){
  if(p.intent && String(p.intent.text||'').trim()) return { text:p.intent.text, src:'מטרה שאושרה', ok:1 };
  const t = ctx && ctx.goalFor ? ctx.goalFor(p) : null; if(t && t.text) return { text:t.text, src:t.src || 'מטרת התב"ע' };
  const d = String(p.projectDescription || '').trim(); if(d.length > 20) return { text:d, src:'תיאור הפרויקט בתיק' };
  const q = String(p.purpose || '').trim(); if(q.length > 20) return { text:q, src:'שדה המטרה בתיק' };
  return { text:'', src:'לא מתועדת' };
}
const lastLog = p => (Array.isArray(p.actionLog) ? p.actionLog : []).filter(a => a && isD(a.at)).sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-1)[0];

/** מצב מועד. תואם ל-meetState שב-plans-process.js (נבדק ב-tools/check-ops.js מול נתוני אמת). */
function meetState(p, m, today){
  const d = m.get(p); if(!isD(d)) return { st:'none' };
  const x = (p.meet && p.meet[m.key]) || {};
  if(x.outcome === 'held') return { st:'held', d:d10(d), x };
  if(x.outcome === 'missed') return { st:'missed', d:d10(d), x };
  if(d10(d) <= today){
    if(m.key === 'forumArchitect' && p.forumDecision && (p.forumDecision.approved || String(p.forumDecision.text||'').trim())) return { st:'held', d:d10(d), x, inferred:1 };
    if(m.key === 'forumConsultants' && p.consultantsPlanApproved) return { st:'held', d:d10(d), x, inferred:1 };
  }
  if(d10(d) > today) return { st: (p._est && p._est[m.key]) ? 'est' : 'planned', d:d10(d), x };
  return { st:'due', d:d10(d), x };
}
const opsDone = (p, k) => (p.opsDone && p.opsDone[k]) || null;

/* ══════════ ציון עדיפות ══════════
   שמונה גורמים, כל אחד שקוף (נשמר ב-why.score כדי שענת תראה למה פריט עלה ראשון). */
const IMPACT = { meet_implied:5, meet_due:9, date_conflict:6, no_next:7, no_status:4, form_waiting:6, reminder:6, summary:5, intent:3, completions:7, no_contact:5, prep:6, stale:4, upcoming:2 };
function score(it, today){
  const f = {};
  f.urgency  = it.due ? Math.max(0, Math.min(10, 10 - days(today, it.due))) : 2;   // מועד שחלף או קרוב
  f.impact   = IMPACT[it.kind] || 3;
  f.blocking = it.blocks ? 6 : 0;                                                     // חוסם שלב
  f.commit   = it.commitment ? 3 : 0;                                                 // התחייבות כלפי גורם אחר
  f.spread   = Math.min(4, (it.affects || 1) - 1);                                    // השלכה על כמה תוכניות
  f.defer    = it.deferCost || 0;                                                     // מה קורה אם דוחים
  f.needsMe  = it.tier === 'decide' ? 3 : it.tier === 'approve' ? 2 : 0;
  f.effort   = -Math.min(3, Math.floor((it.minutes || 3) / 10));                      // קצר קודם, במעט
  const s = Object.values(f).reduce((a, b) => a + b, 0);
  return { s, f };
}

/* ══════════ הגלאים: מה צריך לקרות, ומה היה צריך לקרות ולא קרה ══════════
   כל גלאי מחזיר פריט עם מפתח יציב (key). המפתח מונע כפילות: אותו פריט לא נוצר פעמיים,
   ופעולה שבוצעה (opsDone[key]) לא מוצגת שוב עד שהמצב משתנה מהותית (מפתח חדש). */
function planItems(p, ctx){
  const T = ctx.today, P = ctx.params, out = [], tik = String(p.tik), nm = planName(p);
  const people = ctx.contactsFor ? ctx.contactsFor(p) : [];
  const mail = people.filter(c => c.email);
  const owner = (mail.find(c => /אדריכל/.test(c.type||'')) || mail[0] || people[0] || null);
  const ownerTxt = owner ? owner.name + (owner.type ? ' ('+owner.type+')' : '') : '';
  const add = it => { it.tik = tik; it.plan = nm; it.pid = p.id; out.push(it); };
  const ms = MEET.map(m => ({ m, s: meetState(p, m, T) }));

  // 1. מועד שחלף ולא סומן: החלטה. רק המועד האחרון שחלף; הקודמים נכנסים להקשר, כדי לא להציף.
  // אומדן אוטומטי שחלף אינו פגישה שהייתה צריכה להתקיים: הוא לא נשאל, ומטופל בגלאי סדר המועדים
  // מועד שחלף לפני אבן דרך שכבר התקיימה או שנקבע לה מועד: כנראה התקיים (הערכה). לא שואלים עליו כהחלטה נפרדת,
  // אלא מבקשים אישור אחד לכולם. אחרת כל סימון מעלה את המועד הקודם, ונקבעים מועדים חלופיים בסדר הפוך (1912, 24.11.2026).
  const dueAll = ms.filter(x => x.s.st === 'due' && !(p._est && p._est[x.m.key]));
  const lastSet = ms.reduce((k, x, i) => (x.s.st === 'held' || x.s.st === 'planned') ? i : k, -1);
  const implied = dueAll.filter(x => ms.indexOf(x) < lastSet);
  const due = dueAll.filter(x => ms.indexOf(x) > lastSet).sort((a, b) => a.s.d.localeCompare(b.s.d));
  if(implied.length){
    const later = ms[lastSet];
    add({ key:`meet_implied:${tik}:${implied.map(x => x.m.key + '@' + x.s.d).join(',')}`, kind:'meet_implied', tier:'approve', level:3, minutes:1,
      meetKeys: implied.map(x => x.m.key),
      title:`לאשר ש${implied.map(x => x.m.label).join(' ו')} ${implied.length > 1 ? 'התקיימו' : 'התקיים'}`,
      why:`${later.m.label} ${later.s.st === 'held' ? 'התקיים ב-' : 'נקבע ל-'}${fmt(later.s.d)}, ולכן ${implied.map(x => x.m.label + ' (' + fmt(x.s.d) + ')').join(' ו')} כנראה ${implied.length > 1 ? 'התקיימו' : 'התקיים'}. זו הערכה, ולכן נדרש אישורך.`,
      prepared:'סימון "התקיים" לכל אחד, עם המועד שבתיק.',
      rec:'לאשר. אם אחד מהם לא התקיים, לפתוח את התוכנית ולסמן אותו בנפרד.',
      after:'הסימון יירשם ביומן התוכנית ובהחלטות, עם המקור "אושר מתוך איפה אנחנו עומדים".',
      options:[{ id:'heldAll', label: implied.length > 1 ? 'אישור: התקיימו' : 'אישור: התקיים', primary:1 }, { id:'open', label:'לסימון בנפרד' }],
      link:{ tik, tab:'process' }, src:'הערכה: אבן דרך מאוחרת יותר כבר נקבעה' });
  }
  if(due.length){
    const last = due[due.length - 1], earlier = due.slice(0, -1);
    add({ key:`meet_due:${tik}:${last.m.key}:${last.s.d}`, kind:'meet_due', tier:'decide', level:4, due:last.s.d, blocks:true, deferCost:3, minutes:2,
      meetKey:last.m.key, date:last.s.d,
      title:`${last.m.label}: האם התקיים?`,
      why:`המועד (${fmt(last.s.d)}) חלף לפני ${days(last.s.d, T)} ימים, ואין סימון. בלי הסימון התוכנית לא מתקדמת, והמועד הבא לא נקבע.`,
      context: earlier.length ? `גם ${earlier.map(x => x.m.label+' ('+fmt(x.s.d)+')').join(' ו-')} לא סומנו. סימון האחרון מספיק כדי להתקדם.` : '',
      prepared:'דף הכנה לסיכום: מה הוחלט, מה התחייבו, ומה המועד הבא.',
      rec:`אם הפגישה התקיימה: "התקיים", עם שורה של סיכום. אם לא: מועד חלופי. מוצע ${fmt(mondayAfter(T, 7))}.`,
      after:'אתעד את ההחלטה, אעדכן את השלב, אכין סיכום לצוות לאישורך, ואציע את המועד הבא.',
      options:[{ id:'held', label:'התקיים', input:'summary', primary:1 }, { id:'missed', label:'לא התקיים, מועד חלופי', input:'date', suggest:mondayAfter(T, 7) }],
      link:{ tik, tab:'process' }, src:'נתון: תאריך בתיק, בלי סימון' });
  }

  // 2. אין מועד לאבן הדרך הבאה אחרי אבן דרך שהתקיימה
  const held = ms.filter(x => x.s.st === 'held');
  const lastHeld = held[held.length - 1];
  if(lastHeld && lastHeld.m.next){
    const nx = ms.find(x => x.m.key === lastHeld.m.next);
    if(nx && nx.s.st === 'none'){
      const sug = mondayAfter(lastHeld.s.d > T ? lastHeld.s.d : T, 21);
      add({ key:`no_next:${tik}:${nx.m.key}`, kind:'no_next', tier:'decide', level:4, due:addDays(lastHeld.s.d, 14), blocks:true, deferCost:2, minutes:1,
        meetKey:nx.m.key, title:`לקבוע מועד ל${nx.m.label}`,
        why:`${lastHeld.m.label} התקיים ב-${fmt(lastHeld.s.d)}, ואין יעד לשלב הבא.`,
        rec:`מוצע ${fmt(sug)} (יום שני, שלושה שבועות קדימה).`, after:'אעדכן את לוח השנה וציר הזמן, ואכין הזמנה לצוות לאישורך.',
        options:[{ id:'setdate', label:'קביעת המועד', input:'date', suggest:sug, primary:1 }],
        link:{ tik, tab:'process' }, src:'נתון: סימון "התקיים" בלי מועד הבא' });
    }
  }

  // 3. סדר מועדים הפוך: אומדן שמוקדם מאבן דרך שכבר נקבעה
  for(let i = 1; i < ms.length; i++){
    const a = ms[i-1], b = ms[i];
    if(isD(a.s.d) && isD(b.s.d) && b.s.d < a.s.d){
      const est = p._est && p._est[b.m.key];
      add({ key:`date_conflict:${tik}:${b.m.key}:${b.s.d}`, kind:'date_conflict', tier: est ? 'system' : 'decide', level: est ? 2 : 4, due:'', minutes:1,
        title:`${b.m.label} (${fmt(b.s.d)}) מוקדם מ${a.m.label} (${fmt(a.s.d)})`,
        why: est ? 'המועד הוא אומדן אוטומטי שנוצר לפני שהמועד הקודם נדחה.' : 'שני מועדים שנקבעו בסדר הפוך. אחד מהם שגוי.',
        rec: est ? `כשתסמני ש${a.m.label} התקיים, אציע מועד חדש אחריו.` : 'לבדוק איזה מועד נכון ולתקן.',
        condition: est ? `תנאי: סימון "${a.m.label}" כהתקיים` : '',
        options: est ? [] : [{ id:'open', label:'לתיקון המועד', primary:1 }],
        link:{ tik, tab:'process' }, src: est ? 'הערכה: אומדן אוטומטי' : 'נתון: שני מועדים בתיק' });
      break;
    }
  }

  // 4. טופס לאדריכל שהופק ולא חזר
  const formLog = (p.actionLog || []).filter(a => /טופס נתונים/.test(a.detail||'') && isD(a.at)).sort((x, y) => String(x.at).localeCompare(String(y.at))).slice(-1)[0];
  const back = p.archForm && isD(p.archForm.receivedAt) && formLog && d10(p.archForm.receivedAt) >= d10(formLog.at);
  if(formLog && !back){
    const age = days(formLog.at, T), sentKey = `reminder:${tik}:${d10(formLog.at)}`, sent = opsDone(p, sentKey);
    const remindOn = sent ? addDays(d10(sent.at), P.reminderRepeatDays) : addDays(formLog.at, P.formReminderDays);
    if(T >= remindOn){
      add({ key: sentKey + (sent ? ':'+d10(sent.at) : ''), baseKey:sentKey, kind:'reminder', tier:'approve', level:3, due:remindOn, commitment:true, deferCost:2, minutes:1,
        title:`תזכורת לאדריכל: הטופס של ${nm} עוד לא חזר`,
        why:`הטופס הופק ב-${fmt(formLog.at)}, לפני ${age} ימים${sent ? ', ותזכורת נשלחה ב-'+fmt(sent.at) : ''}. בלעדיו אין "מבוקש" בטבלה 5 ואין תוכנית פיתוח למודל.`,
        prepared: owner && owner.email ? `טיוטת מייל ל${ownerTxt}, עם הטופס המצורף ובקשה להחזיר עד ${fmt(addDays(T, 5))}.` : 'טיוטת מייל. לא נמצא מייל של האדריכל במאגר: הנמען ריק.',
        rec:'לאשר ולשלוח.', after:`אתעד שנשלחה תזכורת, ואם הטופס לא יחזור עד ${fmt(addDays(T, P.reminderRepeatDays))} אכין תזכורת נוספת.`,
        mail:{ to: owner && owner.email || '', subject:`תוכנית בינוי ${nm}: הטופס לאדריכל`,
          body:`שלום${owner ? ' '+owner.name : ''},\n\nבהמשך לטופס הנתונים לתוכנית ${nm} שנשלח ב-${fmt(formLog.at)}, נבקש להחזיר אותו מלא, עם תוכנית הפיתוח כ-PDF עם שכבות, עד ${fmt(addDays(T, 5))}.\n\nתודה,\nאדריכלית העיר, עיריית אשדוד` },
        options:[{ id:'mail', label:'פתיחת הטיוטה', primary:1 }, { id:'snooze', label:'מחר' }],
        link:{ tik, tab:'opinion' }, src:'נתון: יומן הפעולות' });
    } else {
      add({ key:`form_waiting:${tik}:${d10(formLog.at)}`, kind:'form_waiting', tier:'waiting', level:2, due:remindOn, minutes:0,
        title:`טופס האדריכל של ${nm}`, who: ownerTxt || 'אדריכל התוכנית',
        why:`הופק ב-${fmt(formLog.at)}. ממתין ${age} ימים.`, rec:`אם לא יחזור עד ${fmt(remindOn)}, אכין תזכורת לאישורך.`,
        condition:`תנאי: הטופס לא נקלט עד ${fmt(remindOn)}`, link:{ tik, tab:'opinion' }, src:'נתון: יומן הפעולות' });
    }
  }

  // 5. פגישה שהתקיימה ולא נשלח סיכום לצוות
  const recent = held.filter(x => !x.s.inferred && days(x.s.d, T) <= P.summaryDays && days(x.s.d, T) >= 0).slice(-1)[0];
  if(recent){
    const k = `summary:${tik}:${recent.m.key}:${recent.s.d}`;
    if(!opsDone(p, k)) add({ key:k, kind:'summary', tier:'approve', level:3, due:addDays(recent.s.d, 3), commitment:true, minutes:2,
      title:`סיכום ${recent.m.label} לצוות`,
      why:`הפגישה התקיימה ב-${fmt(recent.s.d)}. סיכום בכתב הוא המקור להתחייבויות.`,
      prepared:`טיוטה מהסיכום שנרשם${recent.s.x && recent.s.x.summary ? '' : ' (לא נרשם סיכום: הטיוטה כוללת רק את המועד הבא)'}, ל-${mail.length} נמענים.`,
      rec:'לעבור, לתקן ולשלוח.', after:'אתעד שנשלח, ואעקוב אחרי ההתחייבויות שבסיכום.',
      mail:{ to: mail.map(c => c.email).join(','), subject:`סיכום ${recent.m.label}: ${nm}`,
        body:`שלום,\n\nסיכום ${recent.m.label} מ-${fmt(recent.s.d)}, תוכנית ${nm}:\n\n${(recent.s.x && recent.s.x.summary) || '[להשלים: מה הוחלט]'}\n\n${(() => { const nx = ms.find(x => x.m.key === recent.m.next); return nx && isD(nx.s.d) ? 'המועד הבא: '+nx.m.label+', '+fmt(nx.s.d)+'.' : 'המועד הבא ייקבע בהמשך.'; })()}\n\nאדריכלית העיר, עיריית אשדוד` },
      options:[{ id:'mail', label:'פתיחת הטיוטה', primary:1 }, { id:'skip', label:'לא נדרש' }],
      link:{ tik, tab:'process' }, src:'נתון: סימון "התקיים"' });
  }

  // 6. מטרה לא מתועדת: בלי מטרה אי אפשר לבדוק התאמה בין כוונה לביצוע
  if(!(p.intent && String(p.intent.text||'').trim())){
    const g = goalOf(p, ctx), sug = g.text;
    add({ key:`intent:${tik}`, kind:'intent', tier:'approve', level:3, minutes:1,
      title:`המטרה התכנונית של ${nm}`,
      why:'כל בדיקה של גרסה חדשה נמדדת מול המטרה. היא לא מתועדת.',
      prepared: sug ? `הצעה (${g.src}): "${sug.slice(0, 240)}"` : 'אין בתיק תיאור שאפשר להציע ממנו. נדרש משפט אחד שלך.',
      rec: sug ? 'לאשר או לנסח מחדש במשפט אחד.' : 'לכתוב משפט אחד: מה התוכנית צריכה להשיג במרחב.',
      after:'המטרה תופיע בראש הסיפור של התוכנית ובדף ההכנה לכל פגישה.',
      suggest:sug, options:[{ id:'intent', label:'אישור המטרה', input:'text', suggest:sug, primary:1 }, { id:'snooze', label:'מחר' }],
      link:{ tik, tab:'info' }, src: sug ? 'הצעה: ' + g.src : 'חסר' });
  }

  // 7. תוכנית בטיפול בלי איש קשר עם מייל: אין למי לפנות
  if(!mail.length) add({ key:`no_contact:${tik}`, kind:'no_contact', tier:'decide', level:5, minutes:3,
    title:`אין איש קשר עם מייל ל${nm}`,
    why:'תזכורות, סיכומים והשלמות לא יגיעו לאף אחד.', rec:'לשייך אדריכל ויזם מהמאגר.',
    after:'מעתה התזכורות והסיכומים יוכנו עם הנמען.', options:[{ id:'contacts', label:'לאנשי הקשר', primary:1 }],
    link:{ page:'contacts' }, src:'נתון: מאגר אנשי הקשר' });

  // 8. פגישה קרובה: הכנה מראש
  ms.filter(x => (x.s.st === 'planned' || x.s.st === 'est') && days(T, x.s.d) <= P.upcomingDays).forEach(x => {
    const lead = days(T, x.s.d) <= P.prepLeadDays;
    add({ key:`prep:${tik}:${x.m.key}:${x.s.d}`, kind: lead ? 'prep' : 'upcoming', tier: lead ? 'approve' : 'upcoming', level: lead ? 3 : 1,
      due:x.s.d, minutes: lead ? 5 : 0, meetKey:x.m.key, date:x.s.d,
      title:`${x.m.label}, ${fmt(x.s.d)}${x.s.st === 'est' ? ' (אומדן)' : ''}`,
      why: lead ? `בעוד ${days(T, x.s.d)} ימים. דף ההכנה מוכן.` : `בעוד ${days(T, x.s.d)} ימים.`,
      prepared: lead ? 'דף הכנה: מה להשיג, משתתפים, החלטות קודמות, חומרים שחסרים ושאלות.' : '',
      rec: lead ? 'לעבור על דף ההכנה.' : `דף ההכנה יוכן ${P.prepLeadDays} ימים לפני.`,
      options: lead ? [{ id:'prep', label:'לדף ההכנה', primary:1 }] : [], link:{ tik, tab:'process' }, src:'נתון: מועד בתיק' });
  });

  // 9. תוכנית שלא זזה
  const ll = lastLog(p), lastAt = [ll && ll.at, p.updatedAt].filter(isD).map(d10).sort().slice(-1)[0];
  if(lastAt && days(lastAt, T) > P.staleDays && !out.some(i => i.tier === 'decide'))
    add({ key:`stale:${tik}:${lastAt}`, kind:'stale', tier:'waiting', level:2, minutes:0, title:`${nm}: אין תנועה ${days(lastAt, T)} ימים`,
      who: ownerTxt || 'לא ידוע', why:`הפעולה האחרונה ב-${fmt(lastAt)}.`, rec:'אם אין צפי, לברר עם האדריכל.', link:{ tik }, src:'נתון: יומן הפעולות' });

  // פעולה שבוצעה, נדחתה עד תאריך או הואצלה: לא מוצגת שוב (אלא אם המפתח השתנה)
  return out.filter(it => {
    const done = opsDone(p, it.key); if(done) return false;
    const sn = ctx.user.snooze && ctx.user.snooze[it.key]; if(sn && sn > T) return false;
    const dl = ctx.user.delegated && ctx.user.delegated[it.key];
    if(dl){ it.tier = 'waiting'; it.who = dl.to; it.why = `הואצל ב-${fmt(dl.at)}. ` + it.why; it.options = []; }
    return true;
  });
}

/** פריטים שחוצים תוכניות */
function crossItems(plans, ctx){
  const out = [], nos = plans.filter(noStatus);
  if(nos.length){
    const k = 'no_status:' + nos.map(p => p.tik).sort().join(',');
    if(!((ctx.user.snooze || {})[k] > ctx.today)) out.push({ key:k, kind:'no_status', tier:'decide', level:4, minutes: nos.length, affects:nos.length,
      title:`${nos.length} תוכניות בלי סטטוס`,
      why:'הן לא נספרות בשום מסך: לא בטיפול, לא מאושרות. ייתכן שחלקן אושרו מזמן.',
      context: nos.map(p => planName(p) + ((p.documents || []).some(d => /פרוטוקול|החלטה/.test((d.name||'')+(d.type||''))) ? ': יש פרוטוקול ועדה בתיק' : '')).join('\n'),
      rec:'תוכנית עם פרוטוקול ועדה בתיק: כנראה "הושלם" (הערכה). השאר: "בטיפול".',
      after:'הסטטוס יירשם ביומן, והתוכנית תיכנס למסכים המתאימים.',
      plans: nos.map(p => ({ tik:String(p.tik), pid:p.id, name:planName(p), sug: (p.documents || []).some(d => /פרוטוקול|החלטה/.test((d.name||'')+(d.type||''))) ? 'הושלם' : 'בטיפול' })),
      options:[{ id:'status', label:'קביעת הסטטוס', input:'status', primary:1 }, { id:'snooze', label:'מחר' }],
      link:{ page:'table' }, src:'נתון: שדה הסטטוס' });
  }
  return out;
}

/** מה כבר נעשה: מיומן הפעולות של כל התוכניות ומהרצות השרת */
function doneItems(plans, ctx, n){
  const all = [];
  plans.forEach(p => (p.actionLog || []).forEach(a => { if(isD(a.at) && days(a.at, ctx.today) <= 14) all.push({ tik:String(p.tik), plan:planName(p), at:d10(a.at), time:a.time || '', text:String(a.detail || a.type).replace(/^\[מערכת\]\s*/, ''), by:a.by || '', src:a.src || '', sys:/^\[מערכת\]/.test(a.detail||'') || a.by === 'המערכת' }); }));
  return all.sort((a, b) => (b.at + b.time).localeCompare(a.at + a.time)).slice(0, n || 20);
}

/* ══════════ הסיפור של כל תוכנית: שבעה חלקים ══════════ */
function story(p, items, ctx){
  const T = ctx.today, ll = lastLog(p), ms = MEET.map(m => ({ m, s: meetState(p, m, T) }));
  const held = ms.filter(x => x.s.st === 'held').slice(-1)[0];
  const dueReal = ms.filter(x => x.s.st === 'due' && !(p._est && p._est[x.m.key])).slice(-1)[0];
  const next = dueReal || ms.find(x => ['planned','est'].includes(x.s.st)) || ms.find(x => x.s.st === 'none' && (!held || MEET.indexOf(x.m) > MEET.indexOf(held.m)));
  const g = goalOf(p, ctx);
  const mine = items.filter(i => i.tik === String(p.tik)), top = mine[0];
  return {
    goal: g.text, goalSrc: g.ok ? g.src : g.text ? g.src + ', טרם אושרה' : 'לא מתועדת',
    last: ll ? `${fmt(ll.at)}: ${ll.detail || ll.type}` : held ? `${held.m.label} התקיים ב-${fmt(held.s.d)}` : 'לא תועדה פעולה',
    change: held ? `השלב האחרון שהושלם: ${held.m.label}.` : 'עוד לא הושלם שלב.',
    now: next ? `${next.m.label}: ${({planned:'נקבע ל-',est:'אומדן ',due:'חלף ב-',none:'לא נקבע'})[next.s.st]}${next.s.d ? fmt(next.s.d) : ''}${next.s.st === 'due' ? ', לא סומן' : ''}` : 'כל אבני הדרך מאחור',
    next: top ? top.title : 'אין פעולה פתוחה',
    owner: top ? (top.tier === 'waiting' ? (top.who || 'גורם אחר') : top.tier === 'system' ? 'המערכת' : 'את') : '',
    after: top ? (top.after || top.rec || '') : ''
  };
}

/* ══════════ רישום האוטומציות: מה רץ, איפה, ומה חסום ══════════
   runsOn: server = Action מתוזמן ב-GitHub, רץ גם כשהאפליקציה סגורה. browser = רץ כשהדף פתוח.
   blocked: יכולת שאינה פעילה, עם הסיבה המדויקת. לא מציגים הצלחה מדומה. */
const AUTOMATIONS = [
  { id:'scan', name:'סריקת התוכניות', runsOn:'server', level:1, trigger:'מועד קבוע: כל שעתיים, 06:00 עד 22:00', condition:'תמיד',
    sources:'ashdod_plans, אנשי הקשר (ashdod_muni)', permissions:'קריאה; כתיבה רק לשורה ops_server', actions:'מריץ את כל הגלאים, מחשב עדיפויות ושומר תמונת מצב',
    expected:'תמונת מצב עדכנית גם כשהאפליקציה סגורה', verify:'חותמת הרצה ומספר הפריטים בשורה ops_server', onFail:'3 ניסיונות, ואז רישום הכשל בהיסטוריה וכשל של ה-Action', repeat:'בהרצה הבאה' },
  { id:'missed', name:'מה שלא קרה', runsOn:'server', level:1, trigger:'אי־התקיימות אירוע צפוי', condition:'מועד חלף בלי סימון, טופס שלא חזר, שלב בלי מועד',
    sources:'מועדים ויומן הפעולות', permissions:'קריאה', actions:'מזהה, רושם מתי זוהה לראשונה, ומעלה להחלטה רק את האחרון בכל תוכנית',
    expected:'אין מועד שחלף בשקט', verify:'רשומה ב-ledger עם תאריך זיהוי', onFail:'כמו הסריקה', repeat:'כל הרצה, בלי כפילות' },
  { id:'reminder', name:'תזכורת לטופס שלא חזר', runsOn:'server', level:3, trigger:'מועד יחסי: ימים אחרי הפקת הטופס', param:'formReminderDays',
    condition:'הטופס לא נקלט', sources:'יומן הפעולות, archForm, אנשי הקשר', permissions:'הכנה בלבד', actions:'מכין טיוטת מייל עם נמען מאומת מהמאגר',
    expected:'תזכורת מוכנה לאישור', verify:'opsDone בתוכנית אחרי פתיחת הטיוטה', onFail:'בלי נמען: הטיוטה נפתחת בלי נמען ונאמר זאת', repeat:'כל reminderRepeatDays ימים',
    blocked:'שליחה אוטומטית: אין חיבור מורשה לתיבת הדואר של העירייה מהשרת. כל תזכורת נפתחת כטיוטה לאישורך.' },
  { id:'prep', name:'הכנה לפגישה', runsOn:'server', level:1, trigger:'מועד יחסי: ימים לפני פגישה', param:'prepLeadDays', condition:'יש מועד בתיק',
    sources:'התיק, יומן הפעולות, המסמכים, אנשי הקשר', permissions:'קריאה', actions:'מרכיב דף הכנה', expected:'דף הכנה מוכן', verify:'הפריט "דף ההכנה מוכן"', onFail:'הדף מסמן מה חסר', repeat:'לכל פגישה' },
  { id:'chain', name:'תגובת שרשרת אחרי החלטה', runsOn:'browser', level:2, trigger:'השלמת פעולה', condition:'החלטה נרשמה במצב עבודה או בדף',
    sources:'התיק', permissions:'כתיבה לתוכנית (אותה הרשאה של העריכה)', actions:'תיעוד, יומן, זיכרון, סיכום לצוות לאישור, הצעת המועד הבא',
    expected:'אין צורך לחזור על אותה החלטה', verify:'opsDone עם המפתח', onFail:'הודעה ונשאר במשימה', repeat:'לא חוזר: מפתח יציב' },
  { id:'model', name:'מודל מתוכנית פיתוח שהגיעה', runsOn:'server', level:1, trigger:'קבלת מסמך: PDF עם שכבות בטופס', condition:'PDF חדש',
    sources:'ashdod_plans, ashdod-docs', permissions:'קריאה; כתיבה ל-layers/ בריפו', actions:'מפיק מודל ומכייל (auto-model.yml)', expected:'מודל במסך המודל', verify:'auto.json: מכויל או משוער', onFail:'"משוער" עם סיבה', repeat:'כל 3 שעות' },
  { id:'weekly', name:'סיכום שבועי', runsOn:'server', level:1, trigger:'מועד קבוע: ראשון בבוקר', condition:'תמיד', sources:'כל התוכניות', permissions:'קריאה',
    actions:'מנסח את סיפור השבוע: מה נסגר, מה תקוע ומה בשבוע הבא', expected:'טקסט מוכן להעתקה', verify:'ops_server.weekly', onFail:'כמו הסריקה', repeat:'שבועי' },
  { id:'status', name:'סטטוס התב"ע מול מינהל התכנון', runsOn:'server', level:1, trigger:'כל הרצה של המערכת ברקע', condition:'תב"ע עם מספר 603-...',
    sources:'plan_projects, ashdod_plans, Xplan (שכבת הקווים הכחולים)', permissions:'קריאה בלבד', actions:'משווה מאושרת או בתכנון בין המסד לבין Xplan, ומסמן תוכנית בינוי מאושרת על תב"ע שלא אושרה',
    expected:'פער מוצג בתמונת הבוקר, והתיקון באישור', verify:'ops_server.statusCheck', onFail:'הבדיקה הקודמת נשארת, עם השגיאה', repeat:'כל שעתיים' },
  { id:'inbox', name:'קליטת מיילים', runsOn:'server', level:2, trigger:'קבלת מייל', condition:'מייל מגורם בתוכנית', sources:'תיבת הדואר של אדריכלית העיר',
    permissions:'קריאה לתיבה', actions:'שיוך לתוכנית ועדכון "ממתינים לאחרים"', expected:'תשובה שהגיעה מורידה פריט', verify:'—', onFail:'—', repeat:'—',
    blocked:'אין חיבור מורשה מהשרת לתיבת Outlook של העירייה. כיום רק אינדקס לקריאה בלבד (mail-index.js), שנבנה ידנית.' },
  { id:'calendar', name:'התאמה ליומן', runsOn:'browser', level:2, trigger:'תחילת עבודה', condition:'חיבור ליומן', sources:'יומן העירייה', permissions:'קריאה ליומן',
    actions:'התאמת רצף העבודה לזמן הפנוי', expected:'—', verify:'—', onFail:'—', repeat:'—',
    blocked:'אין חיבור מורשה ליומן העירייה. בחרי מסגרת זמן ידנית (5 עד 60 דקות).' }
];

/* ══════════ הפעולה המרכזית ══════════ */
function compute(plans, opts){
  opts = opts || {};
  const user = Object.assign({ snooze:{}, delegated:{}, paused:{}, params:{} }, opts.user || {});
  const ctx = { today: opts.today || todayIL(), params: Object.assign({}, PARAMS, user.params || {}), user, contactsFor: opts.contactsFor, goalFor: opts.goalFor };
  const live = plans.filter(p => p && !p._deleted);
  const active = live.filter(isActive);
  let items = [];
  active.forEach(p => { try{ items = items.concat(planItems(p, ctx)); }catch(e){ items.push({ key:'err:'+p.tik, kind:'err', tier:'system', level:1, tik:String(p.tik), title:'שגיאה בגלאי', why:String(e.message||e) }); } });
  items = items.concat(crossItems(live, ctx));
  // אוטומציה מושהית: הפריטים שלה לא נוצרים (רק אלה שהיא אחראית להם)
  const pausedKinds = { reminder:'reminder', form_waiting:'reminder', prep:'prep', upcoming:'prep', meet_due:'missed', no_next:'missed', stale:'missed' };
  items = items.filter(it => !(pausedKinds[it.kind] && user.paused[pausedKinds[it.kind]]));
  // תקדימים מהזיכרון: החלטה מאותו סוג בתוכנית אחרת
  const mem = Array.isArray(user.memory) ? user.memory : [];
  items.forEach(it => {
    const sc = score(it, ctx.today); it.score = sc.s; it.factors = sc.f; it.levelName = LEVEL[it.level];
    const pr = mem.filter(m => m.kind === it.kind && String(m.tik) !== String(it.tik) && m.valid !== false).slice(-1)[0];
    if(pr) it.precedent = `${fmt(pr.at)}, ${pr.plan || 'תב/'+pr.tik}: ${pr.text}`;
  });
  // כל פעולה פעם אחת: מפתח יחיד
  const seen = new Set(); items = items.filter(it => !seen.has(it.key) && seen.add(it.key));
  items.sort((a, b) => b.score - a.score || String(a.due||'9').localeCompare(String(b.due||'9')));
  const tiers = {}; TIERS.forEach(([k]) => tiers[k] = items.filter(i => i.tier === k));
  tiers.done = doneItems(live, ctx);
  const focus = items.filter(i => i.tier === 'decide' || i.tier === 'approve').slice(0, 3);
  const stories = {}; active.forEach(p => { stories[p.tik] = story(p, items, ctx); });
  return { today:ctx.today, params:ctx.params, items, tiers, focus, stories, morning: morning(live, active, items, tiers, ctx, opts), counts: counts(items, tiers, active) };
}
function counts(items, tiers, active){ const c = { active:active.length, total:items.length }; TIERS.forEach(([k]) => c[k] = (tiers[k]||[]).length); return c; }

/** תמונת הבוקר: מה השתנה ומה חשוב היום, בשלוש עד חמש שורות */
function morning(live, active, items, tiers, ctx, opts){
  const since = opts.lastVisit && isD(opts.lastVisit) ? d10(opts.lastVisit) : addDays(ctx.today, -7);
  const changed = doneItems(live, ctx, 99).filter(d => d.at >= since);
  const firstSeen = opts.ledger || {};
  const fresh = items.filter(i => firstSeen[i.key] && d10(firstSeen[i.key].first) >= since && i.tier !== 'done');
  const L = [];
  L.push(changed.length ? `מאז ${fmt(since)} נרשמו **${changed.length}** פעולות, האחרונה: ${changed[0].plan}, ${changed[0].text}.` : `מאז ${fmt(since)} לא נרשמה פעולה באף תוכנית.`);
  if(fresh.length) L.push(fresh.length === 1 ? 'המערכת זיהתה דבר **אחד** חדש שלא קרה או שצריך החלטה.' : `המערכת זיהתה **${fresh.length}** דברים חדשים שלא קרו או שצריכים החלטה.`);
  const d = tiers.decide.length, a = tiers.approve.length;
  L.push(d || a ? `היום: **${d}** החלטות שרק את יכולה לקבל, ו-**${a}** תוצרים מוכנים לאישורך.` : 'היום אין שום דבר שמחייב אותך. המערכת ממשיכה לעקוב.');
  const w = tiers.waiting.length; if(w) L.push(w === 1 ? 'דבר **אחד** ממתין לאחרים. המערכת תזכיר כשיגיע המועד.' : `**${w}** דברים ממתינים לאחרים. המערכת תזכיר כשיגיע המועד.`);
  const up = items.filter(i => i.kind === 'prep' || i.kind === 'upcoming');
  L.push(up.length ? `פגישה קרובה: ${up[0].plan}, ${up[0].title}.` : `אין פגישה ב-${ctx.params.upcomingDays} הימים הקרובים.`);
  const head = d ? `${d === 1 ? 'החלטה אחת' : d+' החלטות'} מעכבות ${new Set(tiers.decide.map(i => i.tik).filter(Boolean)).size} תוכניות` : a ? `${a} תוצרים מחכים לאישור` : 'אין החלטה שמחכה לך היום';
  return { head, lines:L, since };
}

/* ══════════ דף הכנה לפגישה ══════════ */
const REQUIRED_DOCS = [['תב"ע', /תב"?ע|הוראות/], ['תשריט', /תשריט/], ['תוכנית בינוי ופיתוח', /בינוי|פיתוח/], ['הדמיות', /הדמי/]];
function meetingPrep(p, meetKey, items, ctx){
  const T = ctx.today, m = MEET.find(x => x.key === meetKey) || MEET[0], s = meetState(p, m, T);
  const people = ctx.contactsFor ? ctx.contactsFor(p) : [];
  const prevHeld = MEET.map(x => ({ x, s: meetState(p, x, T) })).filter(y => y.s.st === 'held' && y.s.d < (s.d || T)).slice(-1)[0];
  const since = prevHeld ? prevHeld.s.d : '';
  const docs = (p.documents || []).map(d => (d.type||'')+' '+(d.name||''));
  const goal = { forumArchitect:'להגיע לעקרונות תכנון מוסכמים ולרשימת תיקונים, ולקבוע את פורום היועצים.',
    forumConsultants:'לקבל מכל יועץ דרישה בכתב, לוודא מענה לכל דרישה קודמת, ולקבוע את ההכנה לוועדה.',
    committeePrep:'לסגור את כל ההשלמות ולגבש המלצה לוועדה.', committeeDate:'החלטת ועדה ברורה, עם תנאים.' }[m.key];
  const mine = items.filter(i => i.tik === String(p.tik) && (i.tier === 'decide' || i.tier === 'approve'));
  return {
    title:`${m.label}: ${planName(p)}`, date:s.d || '', est: s.st === 'est', goal,
    intent: goalOf(p, ctx).text, intentSrc: goalOf(p, ctx).src,
    people: people.map(c => c.name + (c.type ? ' ('+c.type+')' : '') + (c.org ? ', '+c.org : '')),
    decisionsBefore: [].concat(p.forumDecision && p.forumDecision.text ? ['פורום אדריכל: '+p.forumDecision.text] : [],
      (Array.isArray(p.decisions) ? p.decisions : []).map(d => fmt(d.at)+': '+d.text)),
    sinceThen: (p.actionLog || []).filter(a => !since || d10(a.at) >= since).map(a => fmt(a.at)+': '+(a.detail || a.type)).slice(-8),
    received: REQUIRED_DOCS.filter(([, re]) => docs.some(d => re.test(d))).map(r => r[0]),
    missing: REQUIRED_DOCS.filter(([, re]) => !docs.some(d => re.test(d))).map(r => r[0]),
    open: mine.map(i => i.title),
    questions: [].concat(
      REQUIRED_DOCS.filter(([, re]) => !docs.some(d => re.test(d))).map(r => `מתי יוגש ${r[0]}?`),
      p.archForm ? [] : ['מתי יחזור הטופס לאדריכל, עם תוכנית הפיתוח כ-PDF עם שכבות?'],
      ['מה המועד לשלב הבא?']),
    rec: 'לסיים את הפגישה עם החלטה כתובה ומועד לשלב הבא. בלעדיהם הפגישה לא מקדמת.'
  };
}

/** חילוץ מסיכום פגישה (דטרמיניסטי): החלטות, התחייבויות ופעולות המשך. מודל AI אינו נדרש כאן. */
function parseSummary(text){
  const lines = String(text||'').split(/\n|(?<=\.)\s+/).map(s => s.trim()).filter(Boolean);
  const dec = lines.filter(l => /הוחלט|החלטה|מאושר|אושר|סוכם/.test(l));
  const com = lines.filter(l => !dec.includes(l) && /יגיש|יעביר|ישלח|יתקן|ישלים|באחריות|עד ה?-?\d|עד תאריך|יש להגיש|נדרש/.test(l));
  const dates = (String(text).match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/g) || []);
  return { decisions:dec, commitments:com, dates };
}

/** תגובת שרשרת: אילו פעולות המשך מותרות אחרי החלטה. מחזיר רשימה; הדפדפן מבצע. */
function chainFor(it, opt){
  if(it.kind === 'meet_due' && opt === 'held') return ['תיעוד ההחלטה ביומן', 'שמירת הסיכום בזיכרון התוכנית', 'סיכום לצוות מוכן לאישורך', 'הצעת מועד לשלב הבא', 'עדכון דף המעקב'];
  if(it.kind === 'meet_due' && opt === 'missed') return ['המועד המקורי נשמר בהיסטוריה', 'המועד החלופי נכנס ללוח השנה ולציר הזמן', 'עדכון דף המעקב'];
  if(it.kind === 'no_next') return ['המועד נכנס ללוח השנה ולציר הזמן', 'דף הכנה יוכן לפני הפגישה', 'עדכון דף המעקב'];
  if(it.kind === 'reminder') return ['נרשם "נפתחה טיוטה" ביומן', 'תזכורת נוספת תוכן אם אין תשובה', 'עדכון דף המעקב'];
  if(it.kind === 'summary') return ['נרשם ביומן', 'ההתחייבויות נכנסות למעקב', 'עדכון דף המעקב'];
  if(it.kind === 'intent') return ['המטרה נשמרת בתיק ובזיכרון', 'מופיעה בכל דף הכנה ובבדיקת התאמה'];
  if(it.kind === 'meet_implied') return ['הסימון נרשם ביומן התוכנית ובהחלטות', 'עדכון דף המעקב'];
  if(it.kind === 'no_status') return ['הסטטוס נרשם ביומן', 'התוכנית נכנסת למסכים המתאימים'];
  return ['עדכון דף המעקב'];
}

/** הצעות לשיפור תהליך: פעולה ידנית שחוזרת (שלב ה). */
function learn(plans, ctx){
  const T = ctx.today, cnt = {};
  plans.forEach(p => (p.actionLog || []).forEach(a => { if(!isD(a.at) || days(a.at, T) > 60) return;
    const k = /נפתחה טיוטה/.test(a.detail||'') ? 'draft' : /מועד חלופי/.test(a.detail||'') ? 'resched' : /טופס נתונים/.test(a.detail||'') ? 'form' : null;
    if(k) cnt[k] = (cnt[k] || 0) + 1; }));
  const P = [];
  if((cnt.draft||0) >= 3) P.push({ id:'auto_send', now:`${cnt.draft} טיוטות נפתחו ידנית ב-60 יום`, proposed:'שליחה אוטומטית של תזכורות לפי תבנית מאושרת', saving:`כ-${cnt.draft*2} דקות בחודשיים (הערכה)`, risk:'מייל שיוצא בלי עין אנושית', need:'חיבור מורשה לתיבת הדואר של העירייה (חסום היום)' });
  if((cnt.resched||0) >= 3) P.push({ id:'auto_resched', now:`${cnt.resched} מועדים חלופיים ב-60 יום`, proposed:'הצעת מועד חלופי אוטומטית לפי לוח הפורומים', saving:'דקה לכל דחייה (הערכה)', risk:'התנגשות עם פגישה שלא ביומן', need:'חיבור ליומן' });
  if((cnt.form||0) >= 2) P.push({ id:'auto_form', now:`${cnt.form} טפסים הופקו ידנית`, proposed:'הפקת הטופס אוטומטית כשנקבע פורום יועצים, לאישורך', saving:'2 דקות לטופס (הערכה)', risk:'טופס לפני שהתב"ע עודכנה', need:'אין: אפשר לבנות' });
  return P;
}

const api = { goalOf, LEVEL, TIERS, MEET, PARAMS, AUTOMATIONS, compute, meetState, meetingPrep, parseSummary, chainFor, learn, story, score, isActive, planName, todayIL, addDays, mondayAfter, fmt, days };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.PlanOps = api;
})(typeof window !== 'undefined' ? window : globalThis);
