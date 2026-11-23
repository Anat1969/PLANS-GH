/* ══════════════════════════════════════════════════════════════════
   plans-infra.js: תכנון רב תשתיות (ענת, 23.11.2026).
   ללמוד כל תשתית (מה היא צריכה, מה מיוחד בה, מה היא נותנת), להבין רתימה (1+1=3),
   ולנתח תוכנית בינוי: האם המענה התשתיתי אידיאלי, חסכוני, אפקטיבי ויעיל, ולנסח הנחיה לייעול.
   - INFRA: כרטיס לכל תשתית. SYNERGY: רתימות בין שתי תשתיות. RULES: ניתוח מול מה שנמדד במודל.
   - הדף #infra בספרייה. בפאנל המודל: "ניתוח ורתימות" בכל תחום (plans-layers.js).
   - מקור לכל כלל: הנחיות מרחביות 18, אוגדן, או "עיקרון מקצועי, לאימות". סף מספרי הוא הערכה, ומסומן כך.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const PRO = 'עיקרון מקצועי, לאימות';
/* disc: התחום במסך המודל, ומשם הצבע */
const INFRA = [
 { id:'water', name:'מים', disc:'water',
   need:'רצועה בצד המדרכה, מגוף וגמל מים נגישים, ומרחק מקווי ביוב.',
   special:'צנרת בלחץ: אפשר לעקוף מכשולים, אבל חייבים גישה לתחזוקה בלי לחפור גינה.',
   gives:'מי השקיה, ומי עיבוי מזגנים שאפשר לאסוף להשקיה.',
   rules:[['גמל המים בתוך קיר הפיתוח או הגדר, ולא כרכיב בודד במדרכה.', PRO], ['תוואי המים לא מתחת לבתי הגידול של העצים.', PRO]] },
 { id:'sewer', name:'ביוב', disc:'water',
   need:'שיפוע רציף, שוחות בקו ישר, ועומק.',
   special:'זרימה בגרביטציה: התוואי נקבע לפי שיפוע, ולכן הוא הראשון שמקבע את הקרקע.',
   gives:'כמעט כלום ישירות. הוא נותן תוואי שאחרים צריכים להתרחק ממנו.',
   rules:[['לתכנן את תוואי הביוב לפני העצים והגינות, ולא אחרי.', PRO]] },
 { id:'drain', name:'ניקוז ונגר', disc:'water',
   need:'שיפועי פני הקרקע, קולטנים, ומקום לעיכוב מים בשיא הגשם.',
   special:'הבעיה שלו היא שיא קצר. מה שמשהה את המים חצי שעה חוסך צנרת גדולה.',
   gives:'מים לעצים ולגינון, ושטח שהוא גם גינה וגם מאגר עיכוב.',
   rules:[['תכנון ניהול נגר עילי וניקוז המגרשים ייעשה לפי ההנחיות ודרישות אגף הניקוז.', 'הנחיות מרחביות 18, סעיף 2.2.7'], ['להטות את הריצוף אל הגינון ולא אל הקולטן.', PRO], ['ערוגה מושפלת קולטת יותר מערוגה מוגבהת.', PRO]] },
 { id:'power', name:'חשמל', disc:'power',
   need:'חדר טרנספורמציה, פילרים, ותוואי כבלים.',
   special:'הפילר הוא המפגע החזותי הנפוץ במדרכה.',
   gives:'גג החדר הטכני ומשטחי הצל יכולים לייצר חשמל.',
   rules:[['פילרים בתוך קיר פיתוח, גדר או נישה בבניין.', PRO], ['תוואי כבלים משותף לחשמל ולתקשורת, בתעלה אחת.', PRO]] },
 { id:'telecom', name:'תקשורת', disc:'power',
   need:'ארונות ותוואי צנרת.', special:'מתעדכנת מהר: צריך שרוולים רזרביים.', gives:'שרוולים רזרביים חוסכים חפירה עתידית לכולם.',
   rules:[['להניח שרוולים רזרביים בכל חציה של כביש.', PRO]] },
 { id:'gas', name:'גז', disc:'power',
   need:'מרחקי בטיחות ואוורור.', special:'אסור בחלל סגור, ולכן הוא תמיד בחזית חשופה.', gives:'מעט. הוא קובע מרחקים שאחרים צריכים לכבד.',
   rules:[['ארון הגז בחזית משנית ולא בכניסה הראשית.', PRO]] },
 { id:'light', name:'תאורה', disc:'power',
   need:'עמודים במרווח קבוע, וחיבור לרשת.', special:'היא הופכת את הרחוב לבטוח בלילה, ולכן היא תשתית חברתית.',
   gives:'סימון לילי של מסלולים, רחבות וכניסות.',
   rules:[['לתאם את מיקום העמודים עם הצמרות, כדי שהעץ לא יחסום את האור.', PRO], ['אין עמוד בתוך רחבת כיבוי.', PRO]] },
 { id:'waste', name:'אשפה', disc:'waste',
   need:'חדר אשפה, מסלול משאית, ומקום לעמידה בזמן הפינוי.', special:'המשאית כבדה וגדולה: היא קובעת רוחב ורדיוס.',
   gives:'מסלול מוקשח שיכול לשמש גם רכב חירום.',
   rules:[['מסלול משאית האשפה חופף למסלול הכבאית, ולא דרך נפרדת.', PRO], ['חדר האשפה סגור ומשולב בבניין, לא מכולה בחזית.', PRO]] },
 { id:'traffic', name:'תנועה וחניה', disc:'traffic',
   need:'מיסעה, רמפה לחניון, ומקומות פריקה.', special:'החניון התת־קרקעי קובע מה אפשר לשתול מעליו.',
   gives:'תקרת החניון, עם עומק אדמה, היא גינה ומאגר עיכוב מים.',
   rules:[['עומק אדמה מעל תקרת החניון שמאפשר עצים, ולא רק דשא.', PRO]] },
 { id:'walk', name:'הולכי רגל', disc:'walk',
   need:'מדרכה רציפה, בלי מכשולים ובלי מדרגות.', special:'הנגישות נמדדת ברצף: מכשול אחד שובר מסלול שלם.',
   gives:'ריצוף שיכול לחלחל, ושטח שיכול לשאת עצים.',
   rules:[['רצועת הליכה פנויה, ותשתיות ועצים ברצועה נפרדת לצידה.', PRO]] },
 { id:'bike', name:'אופניים', disc:'traffic',
   need:'שביל רציף ומופרד.', special:'רוכב רגיש לחום ולשיפוע יותר מהולך.', gives:'מעט ישירות. הוא נהנה מצל ומרציפות.',
   rules:[['שביל האופניים בצד המוצל של הרחוב.', PRO]] },
 { id:'trees', name:'עצים ונוף', disc:'land',
   need:'נפח אדמה, מים, ומרחק מתשתיות.', special:'הוא היחיד שגדל עם הזמן: ערכו עולה כל שנה.',
   gives:'צל, קירור, חלחול, ושיפור של כל תשתית שעוברת לידו.',
   rules:[['בית גידול רציף מתחת לריצוף, ולא בור בודד לכל עץ.', PRO], ['עצים קיימים בוגרים נשמרים לפני שנוטעים חדשים.', PRO]] },
 { id:'shade', name:'הצללה', disc:'land',
   need:'מבנה, או עץ, מעל מקום שהייה.', special:'צל מועיל רק בשעות החמות ובמקום שאנשים נמצאים בו.',
   gives:'משטח שאפשר להציב עליו פאנלים סולאריים.',
   rules:[['להעדיף צל של עץ, ולהשלים בפרגולה רק במקום שעץ לא יגדל.', PRO]] },
 { id:'fire', name:'כיבוי אש', disc:'fire',
   need:'רחבה של כ-12 על 6 מטר, מוקשחת, ומסלול גישה עם רדיוס.', special:'היא כמעט לא בשימוש, אבל חייבת להיות פנויה תמיד.',
   gives:'שטח מוקשח גדול שבשגרה יכול לשמש רחבה לשהייה.',
   rules:[['רחבת הכיבוי מרוצפת כרחבה ציבורית, ולא כאספלט.', PRO], ['אין בתוכה עמוד, עץ, ספסל או ערוגה מוגבהת.', PRO]] }
];
const SYNERGY = [
 { id:'drain-trees', a:'drain', b:'trees', name:'ערוגות קולטות נגר', how:'הריצוף מוטה אל ערוגות העצים, והן מושפלות מעט. מי הגשם משקים את העצים.', gain:'פחות עומס על הצנרת בשיא, השקיה בלי עלות, ועץ גדול יותר שנותן צל.' },
 { id:'trees-walk', a:'trees', b:'walk', name:'שדרה מעל מסלול ההליכה', how:'שורת עצים לאורך רצועת ההליכה, עם אדמה מבנית מתחת לריצוף.', gain:'מדרכה מוצלת, ריצוף שלא מתרומם, ורחוב שהולכים בו.' },
 { id:'shade-power', a:'shade', b:'power', name:'פרגולה סולארית', how:'פאנלים על הפרגולה במקום לוחות עץ.', gain:'צל לשהייה וחשמל לתאורה ולחדרים המשותפים.' },
 { id:'light-fire', a:'light', b:'fire', name:'התאורה מסמנת את מסלול הכיבוי', how:'העמודים בשולי מסלול הכבאית והרחבות, ולא בתוכם.', gain:'מסלול ברור בלילה, ובלי מכשול בדיוק במקום שצריך פנוי.' },
 { id:'light-trees', a:'light', b:'trees', name:'תיאום עמודים וצמרות', how:'העמודים בין העצים, והפנס מתחת לגובה הצמרת הבוגרת.', gain:'אור שלא נחסם, ובלי גיזום שמקטין את הצל.' },
 { id:'waste-fire', a:'waste', b:'fire', name:'מסלול אחד למשאית ולכבאית', how:'משאית האשפה ורכב החירום נוסעים באותה רצועה מוקשחת.', gain:'פחות שטח אטום, ויותר מקום לגינון.' },
 { id:'fire-walk', a:'fire', b:'walk', name:'רחבת הכיבוי היא רחבה ציבורית', how:'הרחבה מרוצפת כמו המדרכה, וסומנה רק בשוליים.', gain:'שטח ששימש רק לחירום הופך למקום שהייה.' },
 { id:'traffic-drain', a:'traffic', b:'drain', name:'גג החניון כגינה מעכבת', how:'עומק אדמה מעל תקרת החניון, עם שכבת ניקוז שמשהה מים.', gain:'גינה מעל החניון, ועיכוב של מי הגשם.' },
 { id:'power-telecom', a:'power', b:'telecom', name:'תוואי משותף לכבלים', how:'חשמל ותקשורת בתעלה אחת, ברצועה שאין בה עצים.', gain:'חפירה אחת, ורצועה פנויה לבתי גידול.' },
 { id:'power-walk', a:'power', b:'walk', name:'פילר בתוך קיר', how:'ארונות החשמל והתקשורת בתוך קיר הפיתוח.', gain:'מדרכה בלי מכשולים ובלי מפגע חזותי.' },
 { id:'water-trees', a:'water', b:'trees', name:'מי מזגנים להשקיה', how:'ניקוז העיבוי של המזגנים מחובר לגינון ולא לביוב.', gain:'מים להשקיה בקיץ, בדיוק כשצריך.' },
 { id:'bike-shade', a:'bike', b:'shade', name:'שביל אופניים בצל', how:'שביל האופניים בצד הרחוב שבו שורת העצים.', gain:'רכיבה נוחה בקיץ, ויותר רוכבים.' }
];
const INF = Object.fromEntries(INFRA.map(x => [x.id, x]));
const Q = ['אידיאלי', 'חסכוני', 'אפקטיבי', 'יעיל'];   // אידיאלי: עונה על הצורך. חסכוני: מקום וכסף. אפקטיבי: משיג את המטרה. יעיל: נרתם לתשתית אחרת
const N = n => Number(n||0).toLocaleString('he-IL');

/** ניתוח תוכנית מול מה שנמדד במודל. כל ממצא: תחום, תשתית, מה נמצא, מקור, מדדים שנפגעו, רתימה, והנחיה */
function analyze(ctx){
  const m = ctx.meas, md = ctx.model || {}, O = md.obj || {}, out = [];
  if(!m) return out;
  const a = m.area, l = m.len, c = m.count;
  const hard = (a.paving||0) + (a.asphalt||0);
  // 1. ניקוז מול משטחים אטומים
  if(hard > 500){ const per = (l.drain||0) / (hard/100);
    out.push(per < 1.5 ? { disc:'water', infra:'drain', ok:false, title:'ניקוז מוצע מועט מול שטח אטום גדול', fact:`ניקוז מוצע **${N(l.drain)}** מ' מול כ-**${N(hard)}** מ"ר ריצוף ואספלט, וכ-**${N(a.green)}** מ"ר גינון`, basis:'נמדד בשרטוט. הסף הוא הערכה', hits:['אידיאלי','יעיל'], syn:'drain-trees',
      guide:'יש להציג תוכנית ניקוז ונגר מוצעת. הריצוף יוטה אל ערוגות הגינון והעצים, והערוגות יהיו מושפלות, כך שמי הנגר ישקו את הצמחייה ויפחיתו את העומס על מערכת הניקוז.' }
      : { disc:'water', infra:'drain', ok:true, title:'יש תוכנית ניקוז מוצעת', fact:`ניקוז מוצע **${N(l.drain)}** מ'`, basis:'נמדד בשרטוט', hits:[], syn:'drain-trees', guide:'' }); }
  // 2. צל עצים מול ריצוף
  const can = arr => (arr||[]).reduce((s, t) => s + Math.PI*t[2]*t[2], 0), cn = can(O.treeNew), co = can(O.treeOld);
  if(a.paving){ const r = Math.round(cn / a.paving * 100);
    out.push(r < 40 ? { disc:'land', infra:'trees', ok:false, title:'צל העצים המוצעים נמוך ביחס לריצוף', fact:`צמרות העצים המוצעים כ-**${N(Math.round(cn))}** מ"ר, כ-**${r}%** מהריצוף`, basis:'הערכה לפי קוטר הצמרת בשרטוט', hits:['אפקטיבי'], syn:'trees-walk',
      guide:'יש להוסיף שורת עצים לאורך מסלולי ההליכה, עם בית גידול רציף מתחת לריצוף, עד שצמרות העצים בבגרותם יכסו לפחות 40% משטחי הריצוף.' }
      : { disc:'land', infra:'trees', ok:true, title:'צל העצים המוצעים טוב ביחס לריצוף', fact:`צמרות העצים המוצעים כ-**${N(Math.round(cn))}** מ"ר, כ-**${r}%** מהריצוף`, basis:'הערכה לפי קוטר הצמרת בשרטוט', hits:[], syn:'trees-walk', guide:'' }); }
  if(c.treeOld) out.push({ disc:'land', infra:'trees', ok:null, title:'עצים קיימים בתחום', fact:`**${c.treeOld}** עצים קיימים, צמרות כ-**${N(Math.round(co))}** מ"ר, ו-**${c.treeSurvey}** סימוני סקר`, basis:'נמדד בשרטוט', hits:['חסכוני'], syn:'trees-walk',
    guide:'יש לסמן בתוכנית אילו עצים קיימים נשמרים, נעתקים או נכרתים, בהתאם לסקר העצים, ולשמר עצים בוגרים במקום כשהדבר אפשרי.' });
  // 3. מכשולים בתוך רחבות הכיבוי
  const inPad = (p, b) => { const dx = p[0]-b[0], dy = p[1]-b[1], cs = Math.cos(-b[4]), sn = Math.sin(-b[4]); return Math.abs(dx*cs-dy*sn) < b[2]/2 && Math.abs(dx*sn+dy*cs) < b[3]/2; };
  const pads = O.fire || [], obs = [];
  pads.forEach((b, i) => { [['עמוד תאורה', O.lamp], ['עץ', [].concat(O.treeNew||[], O.treeOld||[])], ['ספסל', O.bench]].forEach(([nm, arr]) => { const k = (arr||[]).filter(p => inPad(p, b)).length; if(k) obs.push(`${k} ${nm} ברחבה ${i+1}`); }); });
  if(pads.length) out.push(obs.length ? { disc:'fire', infra:'fire', ok:false, title:'מכשול בתוך רחבת כיבוי', fact:obs.join(', '), basis:'נמדד בשרטוט: מיקום מול גבולות הרחבה', hits:['אידיאלי','אפקטיבי'], syn:'light-fire',
      guide:'יש להעתיק את המכשולים מתוך רחבות הכיבוי. עמודי התאורה יוצבו בשולי הרחבה ובשולי מסלול הכבאית, כך שיסמנו אותם בלילה ולא יחסמו אותם.' }
    : { disc:'fire', infra:'fire', ok:true, title:'רחבות הכיבוי פנויות', fact:`**${pads.length}** רחבות, בלי עמוד, עץ או ספסל בתוכן`, basis:'נמדד בשרטוט', hits:[], syn:'light-fire', guide:'' });
  if(pads.length) out.push({ disc:'fire', infra:'fire', ok:null, title:'רחבת הכיבוי יכולה להיות רחבה ציבורית', fact:`כ-**${N(Math.round(pads.reduce((s, b) => s + b[2]*b[3], 0)))}** מ"ר ברחבות`, basis:'הערכה', hits:['חסכוני','יעיל'], syn:'fire-walk',
    guide:'רחבות הכיבוי ירוצפו כחלק מהרחבה הציבורית ויסומנו בשוליהן בלבד, כך שישמשו לשהייה בשגרה וייוותרו פנויות לחירום.' });
  // 4. אשפה ומסלול פינוי
  out.push({ disc:'waste', infra:'waste', ok:false, title:'לא סומנו חדר אשפה ומסלול פינוי', fact:`**${c.bin||0}** מכלי מיחזור, ובלי שכבה של חדר אשפה או של מסלול משאית`, basis:'חסר נתון בשרטוט', hits:['אידיאלי','יעיל'], syn:'waste-fire',
    guide:'יש לסמן את חדרי האשפה ואת מסלול משאית הפינוי. המסלול יחפוף ככל האפשר למסלול רכב החירום, כדי לצמצם שטח אטום.' });
  // 5. חשמל: פילרים ותאורה מוצעת
  if(c.cabinet) out.push({ disc:'power', infra:'power', ok:null, title:'ארונות תשתית במרחב הציבורי', fact:`**${c.cabinet}** ארונות קיימים. מתוך **${c.lamp}** עמודי תאורה, ${(md.lampNew||0)===1 ? 'רק **אחד** מוצע' : `**${md.lampNew||0}** מוצעים`}`, basis:'נמדד בשרטוט', hits:['אידיאלי'], syn:'power-walk',
    guide:'ארונות החשמל והתקשורת החדשים ישולבו בקירות הפיתוח או בנישות בבניין. יש להציג תוכנית תאורה מוצעת לשטחים הפתוחים.' });
  // 6. פרגולות וחשמל
  if(a.pergola > 50) out.push({ disc:'land', infra:'shade', ok:null, title:'הפרגולות יכולות לייצר חשמל', fact:`כ-**${N(a.pergola)}** מ"ר פרגולות`, basis:'נמדד בשרטוט', hits:['יעיל'], syn:'shade-power',
    guide:'יש לבחון פרגולות סולאריות במקום הפרגולות המוצעות, לצל ולייצור חשמל לתאורה ולשטחים המשותפים.' });
  // 7. חלחול
  if(hard > 500){ const p = Math.round((a.green||0) / ((a.green||0) + (a.paving||0)) * 100);
    out.push({ disc:'walk', infra:'walk', ok:p >= 30, title:p >= 30 ? 'יחס טוב בין גינון לריצוף' : 'הריצוף גדול ביחס לגינון', fact:`גינון כ-**${p}%** מסך הגינון והריצוף`, basis:'נמדד בשרטוט. הסף הוא הערכה', hits:p >= 30 ? [] : ['אפקטיבי','יעיל'], syn:'drain-trees',
      guide:p >= 30 ? '' : 'יש להגדיל את שטחי הגינון, או לשלב ריצוף מחלחל ברצועות שאינן מסלול הליכה ראשי.' }); }
  // 8. תנועה: גג החניון
  if((ctx.rn && ctx.rn.lots || []).some(x => x.below)) out.push({ disc:'traffic', infra:'traffic', ok:null, title:'חניון תת־קרקעי מתחת לפיתוח', fact:`עד **${Math.max(...ctx.rn.lots.map(x => x.below||0))}** קומות מרתף, לפי הוראות התוכנית`, basis:'הוראות התוכנית', hits:['יעיל'], syn:'traffic-drain',
    guide:'יש להציג חתך של תקרת החניון עם עומק האדמה המתוכנן. העומק יאפשר נטיעת עצים ושכבת עיכוב למי נגר.' });
  return out;
}
function forDisc(d){ return d === 'all' ? INFRA.map(x => x.id) : INFRA.filter(x => x.disc === d).map(x => x.id); }
function synergiesFor(d){ const ids = new Set(forDisc(d)); return SYNERGY.filter(s => ids.has(s.a) || ids.has(s.b)); }

/* ── מבט עירוני: כל התוכניות שנותחו יחד (ענת, 23.11.2026) ──
   results: [{ tik, findings, marks }]. רק תוכנית עם מודל נכנסת לכאן: בלי מדידה אין ציון.
   לכל רתימה, בכל תוכנית: סימון ידני (yes, no, na) גובר. אחרת ממצא עם הרתימה: ok:false = חסר, ok:true = קיים. אחרת: לא נבדק.
   הנחיה עירונית: חסרה ברוב התוכניות שנבדקו, ובלפחות 2. תוכנית אחת היא לא דפוס. */
const CITY_MIN = 2;
function cityRollup(results){
  const syn = SYNERGY.map(s => { const c = { id:s.id, name:s.name, how:s.how, gain:s.gain, no:[], yes:[], na:[], open:[] };
    results.forEach(r => { const m = (r.marks || {})[s.id], fs = (r.findings || []).filter(f => f.syn === s.id);
      const st = m === 'yes' || m === 'no' || m === 'na' ? m : fs.some(f => f.ok === false) ? 'no' : fs.some(f => f.ok === true) ? 'yes' : 'open';
      c[st].push(String(r.tik)); });
    const checked = c.no.length + c.yes.length;
    c.city = c.no.length >= CITY_MIN && c.no.length > checked / 2;
    return c; }).sort((x, y) => y.no.length - x.no.length || y.yes.length - x.yes.length);
  const q = Object.fromEntries(Q.map(k => [k, 0]));
  results.forEach(r => (r.findings || []).forEach(f => { if(f.ok === false) (f.hits || []).forEach(h => { if(h in q) q[h]++; }); }));
  return { n:results.length, syn, q };
}

/* ── הדף #infra ── */
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COL = id => { const c = { arch:'#8a8478', traffic:'#48484c', walk:'#c9b96a', land:'#5c9a4a', water:'#1e73d8', power:'#e0a800', waste:'#2f7d5a', fire:'#c8202a' }; return c[(INF[id]||{}).disc] || '#1a1a18'; };
let pick = 'drain-trees';
function render(){
  const el = document.getElementById('infraBody'); if(!el) return;
  const syn = (x, y) => SYNERGY.find(s => (s.a === x && s.b === y) || (s.a === y && s.b === x));
  const sel = SYNERGY.find(s => s.id === pick) || SYNERGY[0];
  el.innerHTML = `
  <h1 class="if-title">תשתית אחת נרתמת לטובת אחרת</h1>
  <p class="if-lead">בכל ריבוע צבעוני: שתי תשתיות שביחד נותנות ערך שלישי.</p>
  <details class="if-city" id="ifCity"${CITY.open ? ' open' : ''}><summary>בכל התוכניות <b>${CITY.data ? CITY.data.roll.n + ' נותחו' : ''}</b></summary><div id="ifCityBody">${CITY.data ? cityHTML(CITY.data) : '<p class="if-src">טוען…</p>'}</div></details>
  <div class="if-grid">
    <div class="if-mx-wrap"><table class="if-mx" aria-label="מטריצת רתימות"><thead><tr><th></th>${INFRA.map(x => `<th><span style="--c:${COL(x.id)}">${H(x.name)}</span></th>`).join('')}</tr></thead><tbody>
      ${INFRA.map((r, i) => `<tr><th style="--c:${COL(r.id)}">${H(r.name)}</th>${INFRA.map((c, j) => { if(i === j) return '<td class="if-self"></td>'; const s = syn(r.id, c.id);
        return s ? `<td><button class="if-cell${s.id===pick?' on':''}" data-syn="${s.id}" title="${H(s.name)}" style="--a:${COL(s.a)};--b:${COL(s.b)}" aria-label="${H(s.name)}"></button></td>` : '<td></td>'; }).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="if-pick">
      <div class="if-pair"><i style="background:${COL(sel.a)}"></i>${H(INF[sel.a].name)} <b>+</b> <i style="background:${COL(sel.b)}"></i>${H(INF[sel.b].name)}</div>
      <h2>${H(sel.name)}</h2>
      <dl><dt>איך</dt><dd>${H(sel.how)}</dd><dt>1+1=3</dt><dd><mark>${H(sel.gain)}</mark></dd></dl>
      <div class="if-sub">מה כל אחת מביאה</div>
      ${[sel.a, sel.b].map(id => `<p><b style="color:${COL(id)}">${H(INF[id].name)}:</b> ${H(INF[id].gives)}</p>`).join('')}
      <p class="if-src">הרתימות הן ${PRO}. בכל תוכנית בודקים אותן במסך המודל, בשורה "ניתוח ורתימות".</p>
    </div>
  </div>
  <h2 class="if-h2">כל תשתית</h2>
  <div class="if-cards">${INFRA.map(x => `<details class="if-card" style="--c:${COL(x.id)}"><summary><i></i>${H(x.name)}<b>${SYNERGY.filter(s => s.a === x.id || s.b === x.id).length} רתימות</b></summary>
    <dl><dt>מה היא צריכה</dt><dd>${H(x.need)}</dd><dt>מה מיוחד בה</dt><dd>${H(x.special)}</dd><dt>מה היא נותנת</dt><dd>${H(x.gives)}</dd>
    <dt>כללי אצבע</dt><dd><ol>${x.rules.map(r => `<li>${H(r[0])} <small>${H(r[1])}</small></li>`).join('')}</ol></dd></dl></details>`).join('')}</div>`;
  el.onclick = e => { const b = e.target.closest('[data-syn]'); if(b){ pick = b.dataset.syn; render(); return; }
    const o = e.target.closest('[data-open]'); if(o){ try{ openProject(+o.dataset.open); }catch(err){} return; }
    if(e.target.closest('[data-citycopy]')) copyCity(); };
  const d = document.getElementById('ifCity');
  d.ontoggle = () => { CITY.open = d.open; if(d.open && !CITY.data) cityScan().then(x => { CITY.data = x; render(); }).catch(err => { console.warn('infra city', err); }); };
  if(CITY.open && !CITY.data) d.ontoggle();
}
/* ── המבט העירוני בדף ── */
const CITY = { open:false, data:null };
const plansAll = () => (typeof livePlans === 'function' ? livePlans() : []).filter(p => !/^(1111|2222)$/.test(String(p.tik)));
const tag = p => { const ap = ((window.LAYER_SETS || {})[String(p.tik)] || {}).auto === 'approx';
  return `<button class="if-tik${ap ? ' approx' : ''}" data-open="${p.id}" title="${H([p.district, p.location, ap && 'מיקום משוער'].filter(Boolean).join(', '))}">${H(p.planNum || p.tik)}</button>`; };
async function cityScan(){
  try{ await window.LAYER_SETS_READY; }catch(e){}
  const sets = window.LAYER_SETS || {}, PM = window.PlanModel, all = plansAll();
  const hasPlanDoc = p => { try{ return typeof window.planMaterials === 'function' && window.planMaterials(p).some(x => x.cat === 'plan'); }catch(e){ return false; } };
  const done = all.filter(p => sets[String(p.tik)]), rest = all.filter(p => !sets[String(p.tik)]);
  const vec = rest.filter(p => (p.documents || []).some(d => d && d.layers)), rest2 = rest.filter(p => !vec.includes(p));
  const ready = rest2.filter(hasPlanDoc), none = rest2.filter(p => !ready.includes(p));
  const results = [];
  for(const p of done){ const dir = sets[String(p.tik)].dir;
    try{ const m = await fetch(dir + '/model.json').then(r => r.json()); const rn = sets[String(p.tik)].renewal ? await fetch(dir + '/renewal.json').then(r => r.json()).catch(() => null) : null;
      results.push({ tik:p.tik, findings:analyze({ meas:PM.measure(m), model:m, rn }), marks:(p.layerReview || {}).synergy || {} }); }catch(e){ console.warn('infra city ' + p.tik, e); } }
  return { done, vec, ready, none, roll:cityRollup(results) };
}
function cityHTML(x){
  const r = x.roll, early = r.n < CITY_MIN, ln = a => a.length ? a.join(', ') : '';
  const city = r.syn.filter(s => s.city);
  return `<div class="if-cov">
      <div><b>${x.done.length}</b> נותחו<span>${x.done.map(tag).join('')}</span></div>
      ${x.vec.length ? `<div><b>${x.vec.length}</b> התקבל PDF עם שכבות: מוכן להפקת מודל<span>${x.vec.map(tag).join('')}</span></div>` : ''}
      <div><b>${x.ready.length}</b> יש תוכנית פיתוח כתמונה או במייל. לניתוח צריך את ה-PDF המקורי מהאדריכל<span>${x.ready.map(tag).join('')}</span></div>
      <div><b>${x.none.length}</b> אין תוכנית פיתוח במערכת<span>${x.none.map(tag).join('')}</span></div></div>
    ${early ? `<p class="if-note">נותחה ${r.n === 1 ? 'תוכנית אחת' : 'אף תוכנית'}. הנחיה עירונית נקבעת רק מ-${CITY_MIN} תוכניות ומעלה, כי תוכנית אחת היא לא דפוס.</p>` : ''}
    <table class="if-ct"><thead><tr><th>רתימה</th><th>חסר</th><th>קיים</th><th>לא נבדק</th></tr></thead><tbody>
      ${r.syn.map(s => `<tr class="${s.city ? 'on' : ''}"><td>${H(s.name)}${s.city ? '<small>הנחיה עירונית</small>' : s.no.length ? '<small>מוקדם לקבוע</small>' : ''}</td><td title="${H(ln(s.no))}">${s.no.length || ''}</td><td title="${H(ln(s.yes))}">${s.yes.length || ''}</td><td>${s.open.length + s.na.length || ''}</td></tr>`).join('')}</tbody></table>
    <div class="if-q">${Q.map(k => `<span><b>${r.q[k]}</b> ${k}</span>`).join('')}<em>ממצאים שפוגעים בכל מדד</em></div>
    <button class="if-copy" data-citycopy>העתקת ההנחיה העירונית${city.length ? ` (${city.length})` : ''}</button>`;
}
function cityText(x){
  const r = x.roll, city = r.syn.filter(s => s.city), L = [];
  L.push('הנחיה עירונית: תכנון רב תשתיות בתוכניות הבינוי', `נותחו ${r.n} תוכניות.`, '');
  if(city.length) city.forEach((s, i) => L.push(`${i + 1}. ${s.name}: ${s.how}`, `   מה מרוויחים: ${s.gain}`, `   חסרה ב-${s.no.length} מתוך ${s.no.length + s.yes.length} תוכניות שנבדקו.`));
  else L.push(`עדיין אין הנחיה עירונית: רתימה נקבעת כהנחיה כשהיא חסרה ברוב התוכניות שנבדקו, ובלפחות ${CITY_MIN}.`);
  const nm = a => a.map(p => p.planNum || p.tik).join(', ') || 'אין';
  if(x.vec.length) L.push('', 'התקבל PDF עם שכבות, מוכן להפקת מודל: ' + nm(x.vec));
  L.push('', 'לבקש מהאדריכל את ה-PDF המקורי של תוכנית הפיתוח (יש תמונה או מייל): ' + nm(x.ready), 'אין תוכנית פיתוח במערכת: ' + nm(x.none));
  return L.join('\n');
}
function copyCity(){ if(!CITY.data) return; const t = cityText(CITY.data);
  const done = () => { try{ toast('ההנחיה העירונית הועתקה'); }catch(e){} };
  try{ navigator.clipboard.writeText(t).then(done, () => { prompt('העתקה', t); }); }catch(e){ prompt('העתקה', t); } }
const CSS = `
#infra{max-width:none !important}
.if-title{font:600 26px var(--sans);margin:0 0 4px}
.if-lead{color:var(--ink-soft);font-size:14px;margin:0 0 14px;max-width:820px}
.if-grid{display:grid;grid-template-columns:minmax(0,auto) minmax(300px,1fr);gap:18px;align-items:start}
.if-mx-wrap{overflow:auto;max-width:100%}
.if-mx{border-collapse:collapse;font-size:11.5px}
.if-mx thead th{height:92px;vertical-align:bottom;padding:0 1px}
.if-mx thead th span{writing-mode:vertical-rl;transform:rotate(180deg);display:inline-block;white-space:nowrap;box-shadow:inset 2px 0 0 var(--c);padding:2px 0;color:var(--ink-soft)}
.if-mx tbody th{text-align:start;font-weight:400;white-space:nowrap;padding:0 8px 0 4px;color:var(--ink-soft);box-shadow:inset -3px 0 0 var(--c)}
.if-mx td{width:24px;height:24px;padding:1px;box-shadow:inset 0 0 0 .5px #e4e2dc}
.if-self{background:#f1f0ec}
.if-cell{width:22px;height:22px;border:0;padding:0;cursor:pointer;background:linear-gradient(135deg,var(--a) 50%,var(--b) 50%);opacity:.75;border-radius:0}
.if-cell:hover,.if-cell.on{opacity:1;outline:2px solid #1a1a18;outline-offset:1px}
.if-pick{background:#f6f5f1;padding:14px 18px}
.if-pair{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--ink-soft)}
.if-pair i{width:10px;height:10px;display:inline-block}
.if-pick h2{font:600 20px var(--sans);margin:6px 0 8px}
.if-pick dl{margin:0}.if-pick dt{font:700 12px var(--sans);color:var(--ink-mute);margin-top:8px}.if-pick dd{margin:2px 0 0;font-size:14px;line-height:1.55}
.if-pick mark{background:#fff3a8;color:var(--ink);padding:0 3px}
.if-sub{font:700 12px var(--sans);color:var(--ink-mute);margin:12px 0 2px}
.if-pick p{margin:3px 0;font-size:13.5px;line-height:1.5}
.if-src{font-size:11.5px !important;color:var(--muted);margin-top:10px !important}
.if-h2{font:600 17px var(--sans);margin:22px 0 6px}
.if-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:4px 14px}
.if-card{box-shadow:inset 0 -1px 0 #e4e2dc}
.if-card summary{display:flex;align-items:center;gap:8px;cursor:pointer;list-style:none;padding:8px 2px;font:600 14px var(--sans)}
.if-card summary::-webkit-details-marker{display:none}
.if-card summary i{width:11px;height:11px;background:var(--c)}
.if-card summary b{margin-inline-start:auto;font:400 12px var(--sans);color:var(--ink-mute)}
.if-card dl{margin:0 0 10px}.if-card dt{font:700 11.5px var(--sans);color:var(--ink-mute);margin-top:6px}.if-card dd{margin:1px 0 0;font-size:13.5px;line-height:1.5}
.if-card ol{margin:2px 0 0;padding-inline-start:18px}.if-card small{color:var(--muted);font-size:11px}
.if-city{border-top:1px solid var(--line,#ddd);border-bottom:1px solid var(--line,#ddd);margin:0 0 16px;max-width:980px}
.if-city>summary{cursor:pointer;list-style:none;padding:9px 2px;font:600 15px var(--sans);display:flex;gap:8px}
.if-city>summary::-webkit-details-marker{display:none}.if-city>summary b{font-weight:400;color:var(--ink-mute)}
.if-cov{display:grid;gap:6px;margin:4px 0 10px;font-size:13.5px}.if-cov b{font-size:16px;margin-inline-end:4px}
.if-cov span{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px}
.if-tik{border:0 !important;background:#f1f0ec !important;color:var(--ink) !important;font:400 12px var(--sans) !important;padding:2px 6px !important;border-radius:0 !important;cursor:pointer}
.if-tik.approx{box-shadow:inset 0 0 0 1px #8a8478;outline:1px dashed #8a8478;outline-offset:-3px}
.if-tik:hover{background:var(--ink) !important;color:#fff !important}
.if-note{font-size:12.5px;color:var(--ink-soft);margin:0 0 8px}
.if-ct{border-collapse:collapse;font-size:13px;width:100%;max-width:640px}.if-ct th{font:600 11.5px var(--sans);color:var(--ink-mute);text-align:start;padding:3px 6px}
.if-ct td{padding:4px 6px;border-top:1px solid #eeede8}.if-ct td:nth-child(n+2),.if-ct th:nth-child(n+2){text-align:center;font-variant-numeric:tabular-nums;width:52px}
.if-ct td:nth-child(2){color:#c8202a;font-weight:600}.if-ct td small{display:block;font-size:11.5px;color:var(--ink-mute)}
.if-ct tr.on td{background:#fff3a8}.if-ct tr.on small{color:var(--ink);font-weight:600}
.if-q{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;margin:10px 0;font-size:13px}.if-q b{font-size:16px}.if-q em{font-style:normal;font-size:12px;color:var(--ink-mute)}
.if-copy{margin:0 0 12px}
@media (max-width:900px){.if-grid{grid-template-columns:1fr}}
`;
function ensurePage(){
  if(document.getElementById('infra')) return;
  const ref = document.getElementById('library') || document.querySelector('.page'); const pg = document.createElement('div'); pg.id = 'infra'; pg.className = 'page'; pg.innerHTML = '<div id="infraBody"></div>';
  ref.parentNode.insertBefore(pg, ref.nextSibling); const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
}
function boot(){
  if(typeof window.go !== 'function' || !document.querySelector('.page')) return setTimeout(boot, 60);
  ensurePage();
  const _go = window.go; window.go = function(id){ const r = _go.apply(this, arguments); if(id === 'infra'){ render(); if(location.hash !== '#infra') history.replaceState(null, '', '#infra'); } return r; };
  const route = () => { if(location.hash === '#infra') window.go('infra', null); };
  window.addEventListener('hashchange', route); setTimeout(route, 400);
}
const api = { INFRA, SYNERGY, Q, analyze, forDisc, synergiesFor, INF, cityRollup, CITY_MIN };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else { window.PlanInfra = api; boot(); }
})();
