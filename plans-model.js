/* ══════════════════════════════════════════════════════════════════
   plans-model.js: המודל התלת־ממדי של תוכנית הפיתוח (ענת, 23.11.2026).
   כל אלמנט נבנה מהגאומטריה הווקטורית של השרטוט (layers/<תיק>/model.json, מופק ב-tools/extract-model.py):
   משטחים עם מרקם (אספלט, ריצוף, דשא), קירות קומת הקרקע, עצים, עמודי תאורה, ספסלים, מכלים וכבאיות ברחבות הכיבוי.
   המודל ממוקם ברשת ישראל, ולכן השמש, הצל והמפה נכונים למקום.
   מה שאינו מהשרטוט מסומן כהנחה: גובה הבניינים (מספר הקומות) וכיוון הרוח.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ── מקרא: כל סוג אלמנט, הנושא שלו, הצבע וההסבר ── */
const KINDS = [
 { id:'plot', topic:'site', label:'הקו הכחול', color:'#1f5fd0', desc:'גבול התוכנית, כסרט כחול נמוך.' },
 { id:'lots', topic:'site', label:'גבולות מגרשים', color:'#6f8fd8', desc:'חלוקת המגרשים בתוך התוכנית.' },
 { id:'bline', topic:'site', label:'קו מרתף ודיפון', color:'#e08a1e', desc:'תחום החפירה מתחת לקרקע. קובע איפה אפשר לנטוע עץ באדמה עמוקה.' },
 { id:'bldline', topic:'site', label:'קו בניין', color:'#b01e1e', desc:'קו הבניין מעל הקרקע, מתשריט התב"ע המוצעת.' },
 { id:'front', topic:'build', label:'חזית מסחרית', color:'#84338a', desc:'החזית המסחרית שהתשריט מחייב. בקומת המסד היא זיגוג.' },
 { id:'wall', topic:'build', label:'קירות קומת הקרקע', color:'#e8e4da', desc:'הקירות והעמודים מתוכנית האדריכל, בגובה 4 מ\'.' },
 { id:'glass', topic:'build', label:'זיגוג וחזית מסחרית', color:'#8fc7dc', desc:'קירות המסך והחלונות: איפה הבניין פתוח לרחוב.' },
 { id:'door', topic:'build', label:'דלתות וכניסות', color:'#8a5a2b', desc:'פתחי הכניסה בקומת הקרקע.' },
 { id:'mass', topic:'build', label:'מסת הבניין (הנחה)', color:'#f4f2ec', desc:'נפח מעל קומת הקרקע, לפי מספר הקומות שבחרת. הגובה אינו מהשרטוט.' },
 { id:'asphalt', topic:'road', label:'כביש: אספלט', color:'#48484c', desc:'המיסעה מתוכנית התנועה.' },
 { id:'brt', topic:'road', label:'נתיב תחבורה ציבורית', color:'#b5653a', desc:'הנתיב הצבוע בשדרות הרצל.' },
 { id:'curb', topic:'road', label:'אבני שפה', color:'#cfcbc0', desc:'קו המפגש בין כביש למדרכה, מוגבה 15 ס"מ.' },
 { id:'paint', topic:'road', label:'סימון כביש', color:'#ffffff', desc:'קווי נתיבים, חיצים ואיי תנועה.' },
 { id:'ramp', topic:'park', label:'רמפה לחניון', color:'#77777c', desc:'הירידה לחניון התת־קרקעי.' },
 { id:'parking', topic:'park', label:'קווי חניה ורמפה', color:'#9a9a9a', desc:'מתאר מקומות החניה והרמפות.' },
 { id:'bike', topic:'bike', label:'שביל אופניים', color:'#3f8fb5', desc:'רצועת האופניים, בנפרד מהולכי הרגל.' },
 { id:'paving', topic:'walk', label:'ריצוף', color:'#d9cf9c', desc:'כל המשטחים המרוצפים. הגוון לפי סוג הריצוף בשרטוט.' },
 { id:'cross', topic:'walk', label:'מעברי חצייה', color:'#ffffff', desc:'איפה הולך הרגל חוצה את הכביש.' },
 { id:'stairs', topic:'walk', label:'מדרגות', color:'#5a5a5a', desc:'מדרגות בפיתוח ובמבנים: מכשול לרציפות נגישה.' },
 { id:'lowwall', topic:'level', label:'קירות פיתוח', color:'#b9a98c', desc:'קירות תומכים וקירות ישיבה, בגובה 90 ס"מ.' },
 { id:'fence', topic:'level', label:'גדרות ומעקות', color:'#55524c', desc:'גדרות ומעקות, בגובה 1.2 מ\'.' },
 { id:'green', topic:'green', label:'גינון', color:'#7fbf6a', desc:'שטחי הגינון והדשא: שטח מחלחל.' },
 { id:'gardenedge', topic:'green', label:'אבן גן', color:'#8f8a7a', desc:'תיחום הערוגות.' },
 { id:'treeNew', topic:'trees', label:'עץ מוצע', color:'#5c9a4a', desc:'עץ לנטיעה. קוטר הצמרת לפי השרטוט.' },
 { id:'treeOld', topic:'trees', label:'עץ קיים', color:'#3f7a3a', desc:'עץ שמופיע בשרטוט כקיים.' },
 { id:'treeSurvey', topic:'trees', label:'סימון סקר העצים', color:'#e63a00', desc:'טבעת בצבע הסימון של סקר העצים. המשמעות לפי מקרא הסקר.' },
 { id:'pergola', topic:'shade', label:'פרגולה', color:'#c9b08f', desc:'הצללה בנויה, בגובה 2.8 מ\'.' },
 { id:'deck', topic:'shade', label:'דק עץ', color:'#b08a5e', desc:'משטח עץ לשהייה.' },
 { id:'play', topic:'shade', label:'משטח משחק', color:'#f09a42', desc:'משטח גומי למתקני משחק.' },
 { id:'bench', topic:'shade', label:'ספסל', color:'#9a6b3a', desc:'ספסל במקום ובכיוון שבשרטוט.' },
 { id:'water', topic:'water', label:'קו מים קיים', color:'#1e73d8', desc:'ממפת המדידה: המצב הקיים, לא תכנון מוצע. מוצג מעל הקרקע כדי שייראה.' },
 { id:'sewer', topic:'water', label:'קו ביוב קיים', color:'#8a5a2b', desc:'ממפת המדידה: המצב הקיים, לא תכנון מוצע.' },
 { id:'drain', topic:'water', label:'ניקוז מוצע', color:'#27a3a3', desc:'קווי הניקוז מתוכנית הפיתוח.' },
 { id:'cover', topic:'water', label:'שוחות קיימות', color:'#3a3a3a', desc:'מכסי שוחות ממפת המדידה.' },
 { id:'lamp', topic:'power', label:'עמוד תאורה', color:'#f2c230', desc:'רובם עמודים קיימים בשדרות הרצל. בגובה 7 מ\', ובלילה הפנסים נדלקים.' },
 { id:'cabinet', topic:'power', label:'ארון תשתית קיים', color:'#6d7a6f', desc:'ארונות ממפת המדידה, בגובה 1.4 מ\'.' },
 { id:'trafo', topic:'power', label:'טרנספורמציה ותקשורת', color:'#c8c2b4', desc:'חדר טרנספורמציה, לפי שם השכבה בשרטוט.' },
 { id:'gas', topic:'power', label:'גז', color:'#d8a51e', desc:'קווי ומתקני גז.' },
 { id:'bin', topic:'waste', label:'מכלי מיחזור', color:'#2f7d5a', desc:'מכלים במקום שבשרטוט, לפי שכבת המיחזור.' },
 { id:'fire', topic:'fire', label:'רחבת כיבוי וכבאית', color:'#c8202a', desc:'כבאית באורך 9.5 מ\' עומדת בכל רחבה שסומנה.' },
 { id:'firemark', topic:'fire', label:'סימון הרחבות', color:'#e23b3b', desc:'הסימון האדום מהשרטוט.' },
 { id:'fireroute', topic:'fire', label:'מסלול רכב הכיבוי', color:'#e23b3b', desc:'רדיוסי הסיבוב והגישה.' }
 /* מתוכנית העמדה כתמונה (tools/siteplan-model.py, ענת 24.11.2026) */
 ,{ id:'phase', topic:'site', label:'גבול שלבי הביצוע', color:'#f08a1e', desc:'שלב א ושלב ב, מתוכנית ההעמדה.' }
 ,{ id:'entry', topic:'build', label:'כניסות למבנים', color:'#d8202a', desc:'כניסה ללובי, למסחר ולמבני הציבור, מהסימן בתוכנית ההעמדה.' }
 ,{ id:'plaza', topic:'shade', label:'רחבת שהייה', color:'#d9cdb0', desc:'משטחי ישיבה ושהייה בפארק, מהצבע בתוכנית ההעמדה. הערכה.' }
 ,{ id:'bikeRoom', topic:'bike', label:'חדרי אופניים ועגלות', color:'#b89ad8', desc:'בקומת הקרקע. מוצג על גג קומת הקרקע.' }
 ,{ id:'tech', topic:'power', label:'חדר טכני ואוורור', color:'#5fb8a8', desc:'אוורור החניון וחדר טכני בקומת הקרקע. מוצג על גג קומת הקרקע.' }
 ,{ id:'wasteLift', topic:'waste', label:'מעלית אשפה', color:'#2f7d5a', desc:'פיר האשפה של כל מגדל, מהסימן בתוכנית ההעמדה.' }
 ,{ id:'spot', topic:'level', label:'רומים', color:'#0b6b3a', desc:'מפלס הכניסה (שחור) ורומי הפיתוח (ירוק), במטרים מעל פני הים.' }
 /* מתוכנית פיתוח וקטורית בשמות שכבות אחרים (tools/vector-model.py) ומחוברת העיצוב (tools/drainage-from-page.py) */
 ,{ id:'fountain', topic:'shade', label:'אלמנט מים', color:'#5fa8c8', desc:'בריכת מים או מזרקה בפארק, מתוכנית הנוף.' }
 ,{ id:'firepath', topic:'fire', label:'מסלול הכבאית', color:'#e23b3b', desc:'רצועת התנועה של רכב הכיבוי, מתוכנית הבטיחות.' }
 ,{ id:'contour', topic:'level', label:'קווי גובה', color:'#8c7a5a', desc:'קווי הגובה של הפיתוח, מתוכנית הנוף.' }
 ,{ id:'manhole', topic:'water', label:'שוחות מי גשם', color:'#1e5fa8', desc:'שוחה עם רום מכסה ורום תחתית, מחוברת העיצוב.' }
 ,{ id:'wasteInlet', topic:'waste', label:'פתח פינוי פניאומטי', color:'#7a4a8a', desc:'פתח ההשלכה של מערכת האשפה הפניאומטית.' }
 ,{ id:'waterNew', topic:'water', label:'קו מים מוצע', color:'#5ab4e6', desc:'קווי המים החדשים והחיבורים למבנים, מחוברת העיצוב.' }
 ,{ id:'sewerNew', topic:'water', label:'קו ביוב מוצע', color:'#f08a1e', desc:'קווי הביוב החדשים והחיבורים למבנים, מחוברת העיצוב.' }
 ,{ id:'meter', topic:'water', label:'מד מים', color:'#2a6fb0', desc:'מד המים של כל חיבור, מחוברת העיצוב.' }
 ,{ id:'hydrant', topic:'fire', label:'הידרנט', color:'#d0202a', desc:'ברז כיבוי: קיים ממפת המדידה, ומוצע מחוברת העיצוב.' }
 ,{ id:'exPole', topic:'exist', label:'עמוד קיים', color:'#7d8288', desc:'עמודי חשמל ותאורה ממפת המדידה.' }
 ,{ id:'gasCab', topic:'power', label:'גז', color:'#d8a51e', desc:'נקודות הגז בשרטוט, וצוברי גז ממפת המדידה.' }
 /* תכנון רעיוני: תוכנית המתחם ומפת המדידה (tools/concept-model.py, ענת 24.11.2026) */
 ,{ id:'sport', topic:'shade', label:'מגרש ספורט', color:'#86b6de', desc:'מגרש כדורסל או ספורט, מתוכנית הפיתוח של המתחם.' },
 { id:'yard', topic:'shade', label:'חצר גן ילדים', color:'#c9c27a', desc:'החצר המגודרת של גן הילדים, מתוכנית הפיתוח.' },
 { id:'easement', topic:'walk', label:'זיקת הנאה למעבר', color:'#b8d43a', desc:'מעבר ציבורי להולכי רגל או לרכב בתוך המגרש, מתשריט התב"ע. הקווקוו הוא הסימון בתשריט.' },
 { id:'radius', topic:'site', label:'רדיוס מגבלות בנייה', color:'#d0202a', desc:'אזורי המגן של קידוח מי השתייה. בתוכם אסורים מגורים, מסחר ומבני ציבור.' },
 { id:'appBuild', topic:'build', label:'הבינוי המאושר בשאר המתחם', color:'#dcd9d1', desc:'הבניינים של תוכנית הפיתוח בשאר המתחם, בגובה המרבי של המגרש בטבלה 5. הקשר, הערכה.' },
 { id:'useShop', topic:'build', label:'מסחר בקומת הקרקע', color:'#b9cdf2', desc:'השימוש בקומת הקרקע, מנספח הבינוי.' },
 { id:'useLobby', topic:'build', label:'לובי', color:'#f6c6d6', desc:'הכניסה למגדל, מנספח הבינוי.' },
 { id:'usePublic', topic:'build', label:'מבני ציבור', color:'#eba996', desc:'גני ילדים ומעון, מנספח הבינוי.' },
 { id:'useClub', topic:'build', label:'מועדון דיירים', color:'#f1f2b0', desc:'שטח ציבורי לדיירים, מנספח הבינוי.' },
 { id:'exTree', topic:'exist', label:'עץ קיים', color:'#6f8f5a', desc:'ממפת המדידה, לפי הסימון "ע". קוטר הצמרת הנחה: 5 מ\'.' },
 { id:'exSurvey', topic:'exist', label:'מפת המדידה', color:'#8c8c8c', desc:'כל הקווים של מפת המדידה: אבני שפה, גדרות, קירות, מבנים ומדרגות.' },
 { id:'exBench', topic:'exist', label:'ספסל קיים', color:'#9a7b55', desc:'ממפת המדידה.' },
 { id:'exBin', topic:'exist', label:'אשפטון קיים', color:'#2f7d5a', desc:'ממפת המדידה.' },
 { id:'exSign', topic:'exist', label:'תמרור, רמזור ושלט', color:'#c0392b', desc:'ממפת המדידה.' }
 ,{ id:'exBuild', topic:'exist', label:'מבנה קיים להריסה', color:'#6a6a6a', desc:'מתאר ממפת הרקע העירונית. הגובה סמלי: 13 מ\'.' },
 { id:'rnParcel', topic:'renewal', label:'מגרשים לפי ייעוד', color:'#e0884a', desc:'תאי השטח מהתשריט, בצבע הייעוד.' },
 { id:'rnMass', topic:'renewal', label:'נפח לפי הזכויות', color:'#e8b93c', desc:'נפח לדוגמה מטבלה 5, מחולק לקומות. הערכה, לא תכנון הבינוי.' },
 { id:'facade', topic:'build', label:'חזיתות וקומות', color:'#e9e3d6', desc:'כשיש תוכניות קומה מהאדריכל: כל קומה מהשרטוט, עם החלונות והמרפסות שלה. גובה הקומות הוא הנחה. בלי תוכניות קומה: מגדל לפי התב"ע, להמחשה.' },
 { id:'under', topic:'park', label:'קומות מרתף וחניון', color:'#8d98a6', desc:'מספר הקומות מהוראות התוכנית. המתאר הוא גבול המגרש, וזו הנחה.' },
 { id:'rnEnvelope', topic:'renewal', label:'המעטפת המותרת', color:'#ffffff', desc:'השטח שבין קווי הבניין, עד הגובה המרבי.' }
];
/* מקרא הייעודים של התב"ע: אותם צבעים בכל התוכניות */
const ZONES = { residential:['מגורים', '#e8b93c'], mixed:['מגורים ומסחר', '#e0884a'], commerce:['מסחר', '#b6529c'], public:['מבני ציבור', '#a5673f'], open:['שטח פתוח', '#6fae5d'], road:['דרכים', '#a8a8a8'] };
// צבעי הייעוד מהתקן המשותף: משבצות המקרא של מבא"ת, כפי שנקראו מהתשריטים (data/urban-standard/legend-harvest.json)
if(typeof window !== 'undefined' && window.urbanStandard) window.urbanStandard().then(S => { if(S) Object.keys(ZONES).forEach(k => { ZONES[k][1] = S.landUseColor(k); }); });
const STATE_KINDS = { exist:['exBuild','treeOld','treeSurvey','water','sewer','cover','cabinet','lamp','exTree','exSurvey','exBench','exBin','exSign','exPole','hydrant'], renewal:['rnParcel','rnMass','rnEnvelope'] };
const KIND = Object.fromEntries(KINDS.map(k => [k.id, k]));

/* ── רשת ישראל החדשה ↔ WGS84 ── */
const G = { a:6378137, f:1/298.257222101, k0:1.0000067, lon0:(35+12/60+16.261/3600)*Math.PI/180, lat0:(31+44/60+3.817/3600)*Math.PI/180, FE:219529.584, FN:626907.39 };
G.e2 = G.f*(2-G.f); G.ep2 = G.e2/(1-G.e2);
function mer(p){ const e = G.e2; return G.a*((1-e/4-3*e*e/64-5*e*e*e/256)*p-(3*e/8+3*e*e/32+45*e*e*e/1024)*Math.sin(2*p)+(15*e*e/256+45*e*e*e/1024)*Math.sin(4*p)-(35*e*e*e/3072)*Math.sin(6*p)); }
function itm2wgs(E, N){
  const e = G.e2, M1 = mer(G.lat0)+(N-G.FN)/G.k0, mu = M1/(G.a*(1-e/4-3*e*e/64-5*e*e*e/256)), e1 = (1-Math.sqrt(1-e))/(1+Math.sqrt(1-e));
  const p1 = mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu)+(151*e1**3/96)*Math.sin(6*mu);
  const C1 = G.ep2*Math.cos(p1)**2, T1 = Math.tan(p1)**2, N1 = G.a/Math.sqrt(1-e*Math.sin(p1)**2), R1 = G.a*(1-e)/Math.pow(1-e*Math.sin(p1)**2, 1.5), D = (E-G.FE)/(N1*G.k0);
  const lat = p1-(N1*Math.tan(p1)/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*G.ep2)*D**4/24+(61+90*T1+298*C1+45*T1*T1-252*G.ep2-3*C1*C1)*D**6/720);
  const lon = G.lon0+(D-(1+2*T1+C1)*D**3/6+(5-2*C1+28*T1-3*C1*C1+8*G.ep2+24*T1*T1)*D**5/120)/Math.cos(p1);
  return [lat*180/Math.PI, lon*180/Math.PI];
}
function wgs2itm(latD, lonD){
  const lat = latD*Math.PI/180, lon = lonD*Math.PI/180, e = G.e2;
  const Nn = G.a/Math.sqrt(1-e*Math.sin(lat)**2), T = Math.tan(lat)**2, C = G.ep2*Math.cos(lat)**2, A = (lon-G.lon0)*Math.cos(lat), M = mer(lat), M0 = mer(G.lat0);
  const x = G.k0*Nn*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*G.ep2)*A**5/120);
  const y = G.k0*(M-M0+Nn*Math.tan(lat)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*G.ep2)*A**6/720));
  return [x+G.FE, y+G.FN];
}

/* ── מיקום השמש (נוסחאות SunCalc) ── */
function sunPos(date, lat, lng){
  const rad = Math.PI/180, d = date.valueOf()/86400000 - 0.5 + 2440588 - 2451545, M = rad*(357.5291+0.98560028*d);
  const C = rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M)), L = M+C+rad*102.9372+Math.PI, e = rad*23.4397;
  const dec = Math.asin(Math.sin(e)*Math.sin(L)), ra = Math.atan2(Math.sin(L)*Math.cos(e), Math.cos(L));
  const H = rad*(280.16+360.9856235*d) + rad*lng - ra, phi = rad*lat;
  return { alt: Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H)),
           az: Math.atan2(Math.sin(H), Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi)) + Math.PI };   // אזימוט מצפון, עם כיוון השעון
}
/** תאריך לפי שעון ישראל */
function ilDate(y, m, d, hour){
  const guess = new Date(Date.UTC(y, m-1, d, Math.floor(hour), Math.round((hour%1)*60)));
  let off = 2; try{ const s = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Jerusalem', hour:'numeric', hour12:false }).format(guess); off = ((+s) - guess.getUTCHours() + 24) % 24; }catch(e){}
  return new Date(guess.valueOf() - off*3600000);
}

/* ── מרקמים: מצוירים בקוד, בלי קבצים ── */
function tex(T, size, draw, repeatM){
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1/repeatM, 1/repeatM); t.anisotropy = 4; return t;
}
function noise(g, s, base, spread, n){ g.fillStyle = base; g.fillRect(0, 0, s, s);
  for(let i = 0; i < n; i++){ const v = Math.floor(Math.random()*spread); g.fillStyle = `rgba(${Math.random()<.5?0:255},${Math.random()<.5?0:255},${Math.random()<.5?0:255},${v/255})`; g.fillRect(Math.random()*s, Math.random()*s, 1+Math.random()*2, 1+Math.random()*2); } }
function textures(T){
  return {
    asphalt: tex(T, 256, (g, s) => noise(g, s, '#ffffff', 46, 5200), 4),
    paving: tex(T, 256, (g, s) => { noise(g, s, '#ffffff', 16, 900); g.strokeStyle = 'rgba(90,80,60,.35)'; g.lineWidth = 1.5;
      for(let i = 0; i <= 8; i++){ g.beginPath(); g.moveTo(0, i*s/8); g.lineTo(s, i*s/8); g.stroke(); }
      for(let r = 0; r < 8; r++) for(let i = 0; i <= 4; i++){ const x = (i + (r%2)*.5) * s/4; g.beginPath(); g.moveTo(x, r*s/8); g.lineTo(x, (r+1)*s/8); g.stroke(); } }, 3.2),
    grass: tex(T, 256, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); for(let i = 0; i < 4200; i++){ g.strokeStyle = `rgba(${20+Math.random()*40},${70+Math.random()*60},20,${.10+Math.random()*.22})`; const x = Math.random()*s, y = Math.random()*s; g.beginPath(); g.moveTo(x, y); g.lineTo(x+Math.random()*3-1.5, y-2-Math.random()*4); g.stroke(); } }, 5),
    wood: tex(T, 128, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); g.fillStyle = 'rgba(70,40,10,.35)'; for(let i = 0; i < 8; i++) g.fillRect(0, i*s/8, s, 2); }, 1.2),
    rubber: tex(T, 128, (g, s) => noise(g, s, '#ffffff', 26, 1500), 2)
  };
}

/* ── גאומטריה ── */
function ring2(flat){ const o = []; for(let i = 0; i < flat.length; i += 2) o.push([flat[i]/10, flat[i+1]/10]); return o; }
/** משטחים שטוחים: כל פוליגון משולש ומאוחד לגאומטריה אחת, עם צבע לכל קודקוד */
function flatGeo(T, polys, y, tint){
  const pos = [], uv = [], col = [], c = new T.Color();
  for(const [hex, flat] of polys){
    const r = ring2(flat), v = r.map(p => new T.Vector2(p[0], p[1]));
    let tris; try{ tris = T.ShapeUtils.triangulateShape(v, []); }catch(e){ continue; }
    c.set(hex); const k = tint; const cr = 1-k+k*c.r, cg = 1-k+k*c.g, cb = 1-k+k*c.b;
    for(const t of tris) for(const i of [t[0], t[2], t[1]]){ pos.push(r[i][0], y, -r[i][1]); uv.push(r[i][0], r[i][1]); col.push(cr, cg, cb); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  const nr = new Float32Array(pos.length); for(let i = 1; i < nr.length; i += 3) nr[i] = 1; g.setAttribute('normal', new T.BufferAttribute(nr, 3)); return g;
}
/** הרמה לגובה: פאה עליונה ודפנות */
function extrudeGeo(T, rings, y0, h){
  const pos = [];
  for(const r of rings){
    const v = r.map(p => new T.Vector2(p[0], p[1])); let tris; try{ tris = T.ShapeUtils.triangulateShape(v, []); }catch(e){ continue; }
    for(const t of tris) for(const i of [t[0], t[2], t[1]]) pos.push(r[i][0], y0+h, -r[i][1]);
    const ccw = T.ShapeUtils.isClockWise(v) ? -1 : 1;
    for(let i = 0; i < r.length; i++){ const a = r[i], b = r[(i+1)%r.length]; const [p, q] = ccw > 0 ? [a, b] : [b, a];
      pos.push(p[0], y0, -p[1], q[0], y0, -q[1], q[0], y0+h, -q[1], p[0], y0, -p[1], q[0], y0+h, -q[1], p[0], y0+h, -p[1]); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
/** סרט אנכי לאורך קווים: קירות, גדרות, אבני שפה */
function ribbonGeo(T, lines, y0, h){
  const pos = [];
  for(const flat of lines){ const r = ring2(flat);
    for(let i = 0; i < r.length-1; i++){ const a = r[i], b = r[i+1];
      pos.push(a[0], y0, -a[1], b[0], y0, -b[1], b[0], y0+h, -b[1], a[0], y0, -a[1], b[0], y0+h, -b[1], a[0], y0+h, -a[1]); } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
function lineGeo(T, lines, y){
  const pos = [];
  for(const flat of lines){ const r = ring2(flat); for(let i = 0; i < r.length-1; i++) pos.push(r[i][0], y, -r[i][1], r[i+1][0], y, -r[i+1][1]); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); return g;
}
function polyArea(flat){ let s = 0; const n = flat.length/2; for(let i = 0; i < n; i++){ const j = (i+1)%n; s += flat[2*i]*flat[2*j+1] - flat[2*j]*flat[2*i+1]; } return Math.abs(s)/200; }
function lineLen(flat){ let s = 0; for(let i = 0; i < flat.length-2; i += 2) s += Math.hypot(flat[i+2]-flat[i], flat[i+3]-flat[i+1]); return s/10; }

/** מדידות מהמודל: שטחים במ"ר, אורכים במטרים ומספר אובייקטים. הכול הערכה מהשרטוט */
function measure(m){
  const out = { area:{}, len:{}, count:{} };
  for(const k in m.surf) out.area[k] = Math.round(m.surf[k].reduce((s, p) => s + polyArea(p[1]), 0));
  for(const k in m.lines) out.len[k] = Math.round(m.lines[k].reduce((s, f) => s + lineLen(f), 0));
  for(const k in m.obj) out.count[k] = k==='treeSurvey' ? m.obj[k].reduce((s, x) => s + x[1].length, 0) : m.obj[k].length;
  out.area.foot = Math.round((m.foot||[]).reduce((s, f) => s + polyArea(f), 0)); out.count.foot = (m.foot||[]).length;
  return out;
}

function create(el, model, opts){
  const T = window.THREE, TX = textures(T), groups = {}, center = itm2wgs(model.e0, model.n0);
  let LV = null, terrainM = null, LVr = [];     // מפלסים: מוגדרים לפני כל בנייה, כי add() מרים לפי הקרקע
  const renderer = new T.WebGLRenderer({ antialias:true, preserveDrawingBuffer:!!(opts && opts.capture) });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .94; el.appendChild(renderer.domElement); renderer.domElement.className = 'pm-canvas';
  const scene = new T.Scene(); scene.background = new T.Color('#eef2f5');
  const cam = new T.PerspectiveCamera(38, 1, 0.5, 3000);
  const ctl = new T.OrbitControls(cam, renderer.domElement); ctl.maxPolarAngle = Math.PI/2 - 0.02; ctl.minDistance = 4; ctl.maxDistance = 900; ctl.enableDamping = true; ctl.dampingFactor = 0.12;
  // חוזה האינטראקציה המשותף (standard/urban-standard.mjs): שמאלי הזזה, ימני סיבוב והטיה, גלגלת סביב הסמן, מקלדת כשהמודל בפוקוס
  let stdUI = null; if(window.urbanStandard) window.urbanStandard().then(S => { if(dead || !S) return; stdUI = S.applyOrbit(ctl, cam, renderer.domElement, T, { changed:() => draw(), reset:() => view('home'), enabled:() => !W }); });
  const hemi = new T.HemisphereLight('#ffffff', '#a9a498', 0.5); scene.add(hemi);
  const fill = new T.DirectionalLight('#cfe0ff', .38); fill.position.set(-200, 120, 200); scene.add(fill);   // אור מילוי קריר מהצד שמול השמש: חזית בצל לא נראית שטוחה
  const sun = new T.DirectionalLight('#fff4e0', 1.0); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left:-190, right:190, top:190, bottom:-190, near:10, far:900 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4; scene.add(sun, sun.target);

  let envTex = null;
  { // שמיים פשוטים כמפת סביבה: נותנים לזכוכית במה להשתקף
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#4f8fd0'); gr.addColorStop(.46, '#cfe4f5'); gr.addColorStop(.5, '#f3f6f8'); gr.addColorStop(.54, '#b8b0a0'); gr.addColorStop(1, '#8a8478'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    for(let i = 0; i < 26; i++){ const x = Math.random()*512, y = 40 + Math.random()*70, r = 14 + Math.random()*34, cg = g.createRadialGradient(x, y, 0, x, y, r);   // עננים רכים: השתקפות חיה בזכוכית
      cg.addColorStop(0, 'rgba(255,255,255,.55)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = cg; g.fillRect(x-r, y-r, 2*r, 2*r); }
    { const sg = g.createRadialGradient(360, 70, 0, 360, 70, 60); sg.addColorStop(0, 'rgba(255,248,225,.95)'); sg.addColorStop(1, 'rgba(255,248,225,0)'); g.fillStyle = sg; g.fillRect(300, 10, 120, 120); }
    const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding;
    const pm = new T.PMREMGenerator(renderer); envTex = scene.environment = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose(); }
  const M = { std:(o) => new T.MeshStandardMaterial(Object.assign({ roughness:.92, metalness:0, side:T.DoubleSide, envMapIntensity:.22 }, o)) };
  const ghost = M.std({ color:'#dedcd6', transparent:true, opacity:.5 });
  const add = (kind, obj, o) => { const g = groups[kind] || (groups[kind] = Object.assign(new T.Group(), { name:kind })); if(!g.parent) scene.add(g);
    obj.traverse(x => { if(x.isMesh){ x.castShadow = !!(o && o.cast); x.receiveShadow = !(o && o.noReceive); x.userData.mat = x.material; x.userData.solid = !!(o && o.solid); } if(x.isLineSegments) x.userData.mat = x.material; });
    g.add(obj); if(LV) lift(obj, kind); return obj; };
  const addG = (...a) => add(...a);

  // קרקע ומפה
  const ground = new T.Mesh(new T.PlaneGeometry(2400, 2400), M.std({ color:'#cfcabd' })); ground.rotation.x = -Math.PI/2; ground.position.y = -0.06; ground.receiveShadow = true; scene.add(ground);
  ground.material.depthWrite = false; ground.renderOrder = -2;      // הקרקע מצוירת ראשונה ובלי עומק: רמפה שיורדת מתחת לה נראית
  // הקשר עירוני: רחובות אשדוד עם שמות, משכבת הרחובות של העירייה. בלי שירות חיצוני ובלי מפתח
  const streetG = new T.Group(); streetG.visible = false; scene.add(streetG); let streetsBuilt = false, streetsOn = false;
  function setStreets(fc, on){
    streetsOn = !!on;
    if(fc && !streetsBuilt){ streetsBuilt = true;
      const loc = c => { const [E, N] = wgs2itm(c[1], c[0]); return [E-model.e0, N-model.n0]; }, R = 520, pos = [], best = {};
      for(const f of fc.features){ const g = f.geometry, pr = f.properties || {}, w = (pr.hierarchy === 1 ? 15 : pr.hierarchy === 2 ? 10 : 6.5) / 2;
        for(const l of (g.type === 'LineString' ? [g.coordinates] : g.coordinates)){ const pts = l.map(loc);
          for(let i = 0; i < pts.length-1; i++){ const a = pts[i], b = pts[i+1]; if(Math.hypot(a[0], a[1]) > R && Math.hypot(b[0], b[1]) > R) continue;
            const len = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, nx = -(b[1]-a[1])/len*w, ny = (b[0]-a[0])/len*w;
            pos.push(a[0]+nx, 0, -(a[1]+ny), a[0]-nx, 0, -(a[1]-ny), b[0]-nx, 0, -(b[1]-ny), a[0]+nx, 0, -(a[1]+ny), b[0]-nx, 0, -(b[1]-ny), b[0]+nx, 0, -(b[1]+ny));
            const mid = [(a[0]+b[0])/2, (a[1]+b[1])/2], d = Math.hypot(mid[0], mid[1]);       // שם אחד לכל רחוב: על המקטע הארוך שקרוב למגרש
            if(pr.name && d < 330){ const score = len - d*.15; if(!best[pr.name] || score > best[pr.name].score) best[pr.name] = { score, mid }; } } } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); const nr = new Float32Array(pos.length); for(let i = 1; i < nr.length; i += 3) nr[i] = 1; g.setAttribute('normal', new T.BufferAttribute(nr, 3));
      const m = new T.Mesh(g, M.std({ color:'#857f74' })); m.position.y = -0.035; m.receiveShadow = true; streetG.add(m);
      for(const name in best){ const c = document.createElement('canvas'); c.width = 512; c.height = 80; const x = c.getContext('2d'); x.font = '600 40px sans-serif'; const tw = Math.min(500, x.measureText(name).width + 28);
        x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect((512-tw)/2, 8, tw, 64); x.fillStyle = '#1a1a18'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillText(name, 256, 42);
        const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), fog:false })); sp.scale.set(44, 6.9, 1); sp.position.set(best[name].mid[0], 9, -best[name].mid[1]); streetG.add(sp); } }
    updGround();
  }
  /* מפת רקע אפורה: Esri World Topo Map, בלי מפתח. כל אריח מומר לגווני אפור, כדי שהצבע יישאר לתוכנית עצמה */
  const mapG = new T.Group(); mapG.visible = false; scene.add(mapG); let mapBuilt = false, mapOn = false, mapFail = 0;
  const satG = new T.Group(); satG.visible = false; scene.add(satG); let satBuilt = false, satOn = false;   // לוויין: Esri World Imagery, בצבע
  function loadMap(sat){
    const G0 = sat ? satG : mapG; if(sat) satBuilt = true; else mapBuilt = true; const z = sat ? 19 : 18, n = 2**z, [x0, y0, x1, y1] = model.bbox, pad = 300;
    const sw = itm2wgs(model.e0+x0-pad, model.n0+y0-pad), ne = itm2wgs(model.e0+x1+pad, model.n0+y1+pad);
    const tx = lon => Math.floor((lon+180)/360*n), ty = lat => Math.floor((1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*n);
    const lonOf = x => x/n*360-180, latOf = y => Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
    const loc = (lat, lon) => { const [E, N] = wgs2itm(lat, lon); return [E-model.e0, N-model.n0]; };
    for(let X = tx(sw[1]); X <= tx(ne[1]); X++) for(let Y = ty(ne[0]); Y <= ty(sw[0]); Y++){
      const a = loc(latOf(Y), lonOf(X)), b = loc(latOf(Y), lonOf(X+1)), c = loc(latOf(Y+1), lonOf(X+1)), d = loc(latOf(Y+1), lonOf(X));
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([a[0],0,-a[1], d[0],0,-d[1], c[0],0,-c[1], a[0],0,-a[1], c[0],0,-c[1], b[0],0,-b[1]], 3));
      g.setAttribute('uv', new T.Float32BufferAttribute([0,1, 0,0, 1,0, 0,1, 1,0, 1,1], 2));
      const mat = new T.MeshBasicMaterial({ color:'#ffffff', side:T.DoubleSide, transparent:true, opacity:0, depthWrite:false }), mesh = new T.Mesh(g, mat); mesh.position.y = -0.03; mesh.renderOrder = -1; G0.add(mesh);
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { const cv = document.createElement('canvas'); cv.width = im.naturalWidth || 256; cv.height = im.naturalHeight || 256; const x = cv.getContext('2d');
        if('filter' in x && !sat) x.filter = 'grayscale(1)'; x.drawImage(im, 0, 0);
        const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 8; mat.map = t; mat.opacity = 1; mat.needsUpdate = true; draw(); };
      im.onerror = () => { mapFail++; if(mapFail === 3 && opts && opts.onMapError) opts.onMapError(); };
      im.src = `https://server.arcgisonline.com/ArcGIS/rest/services/${sat ? 'World_Imagery' : 'World_Topo_Map'}/MapServer/tile/${z}/${Y}/${X}`;
    }
  }
  /** רקע: 'map' מפה אפורה, 'sat' לוויין, אחרת בלי (המבנים הקיימים תמיד מוצגים). true נשאר מפה, לתאימות */
  function setMap(on){ mapOn = on === true || on === 'map'; satOn = on === 'sat'; if(mapOn && !mapBuilt) loadMap(false); if(satOn && !satBuilt) loadMap(true); updGround(); }

  /* הקשר עירוני: המבנים הקיימים מה-GIS העירוני (geo/bld, tools/city-buildings.py), עד 480 מ' מהמרכז. הגובה סמלי, לפי השטח.
     מבנה שמרכזו בתוך מגרשי התוכנית (הקו הכחול) מוצג רק במצב "קיים": אלה המבנים שנהרסים */
  const ctxG = new T.Group(); scene.add(ctxG); let ctxIn = null, ctxBuilt = false;
  async function loadCtx(){ if(ctxBuilt) return; ctxBuilt = true;
    try{ const ix = await (await fetch('geo/bld/all.json?v=1125')).json(), TL = ix.tile, R = 480, E = model.e0, Nn = model.n0;
      const keys = Object.keys(ix.tiles).filter(k => { const [tx, ty] = k.split('_').map(Number), cx = tx*TL + TL/2 - E, cy = ty*TL + TL/2 - Nn; return Math.abs(cx) < R + TL && Math.abs(cy) < R + TL; });
      const rings = ((model.lines && model.lines.plot) || []).map(f => { const r = []; for(let i = 0; i < f.length; i += 2) r.push([f[i]/10, f[i+1]/10]); return r; })
        .filter(r => { let A = 0; r.forEach((a, i) => { const b = r[(i+1)%r.length]; A += a[0]*b[1] - b[0]*a[1]; }); return Math.abs(A)/2 > 50; });
      const inside = (x, y) => rings.some(r => { let c = false; for(let i = 0, j = r.length-1; i < r.length; j = i++){ const a = r[i], b = r[j]; if((a[1] > y) !== (b[1] > y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1]) + a[0]) c = !c; } return c; });
      const acc = [{ p:[], n:[], c:[] }, { p:[], n:[], c:[] }], COLS = [[.86, .85, .82], [.93, .86, .72], [.80, .80, .78]], roofK = .9;
      for(const k of keys){ const arr = ix.tiles[k];
        const [tx, ty] = k.split('_').map(Number), ox = tx*TL - E, oy = ty*TL - Nn;
        for(const [cat, h, flat] of arr){ const r = []; for(let i = 0; i < flat.length; i += 2) r.push([ox + flat[i]/10, oy + flat[i+1]/10]);
          let mx = 0, my = 0; r.forEach(q => { mx += q[0]; my += q[1]; }); mx /= r.length; my /= r.length; if(Math.hypot(mx, my) > R) continue;
          const A = acc[inside(mx, my) ? 1 : 0], col = COLS[cat] || COLS[0];
          let ar = 0; r.forEach((a, i) => { const b = r[(i+1)%r.length]; ar += a[0]*b[1] - b[0]*a[1]; }); if(ar < 0) r.reverse();
          r.forEach((a, i) => { const b = r[(i+1)%r.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, nx = (b[1]-a[1])/L, ny = -(b[0]-a[0])/L;
            A.p.push(a[0], 0, -a[1], b[0], 0, -b[1], b[0], h, -b[1], a[0], 0, -a[1], b[0], h, -b[1], a[0], h, -a[1]);
            for(let q = 0; q < 6; q++){ A.n.push(nx, 0, -ny); A.c.push(col[0], col[1], col[2]); } });
          const tri = T.ShapeUtils.triangulateShape(r.map(q => new T.Vector2(q[0], q[1])), []);
          tri.forEach(t => t.forEach(ix2 => { const q = r[ix2]; A.p.push(q[0], h, -q[1]); A.n.push(0, 1, 0); A.c.push(col[0]*roofK, col[1]*roofK, col[2]*roofK); })); } }
      const mk = A => { if(!A.p.length) return null; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(A.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(A.n, 3));
        const c = new T.Float32BufferAttribute(A.c, 3); for(let i = 0; i < c.count; i++){ const cc = new T.Color(c.getX(i), c.getY(i), c.getZ(i)).convertSRGBToLinear(); c.setXYZ(i, cc.r, cc.g, cc.b); } g.setAttribute('color', c);
        const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors:true, roughness:.92 })); m.castShadow = m.receiveShadow = true; m.userData.ctx = true; ctxG.add(m); return m; };
      mk(acc[0]); ctxIn = mk(acc[1]); updCtx(); }catch(e){ console.warn('ctx', e); } }
  function updCtx(){ if(ctxIn) ctxIn.visible = state === 'exist'; ctxG.visible = !underOn; draw(); }
  const shadowCatch = new T.Mesh(new T.PlaneGeometry(1400, 1400), new T.ShadowMaterial({ opacity:.34, depthWrite:false })); shadowCatch.rotation.x = -Math.PI/2; shadowCatch.position.y = .135; shadowCatch.receiveShadow = true; shadowCatch.renderOrder = 3; scene.add(shadowCatch);
  function updGround(){ mapG.visible = mapOn && !underOn && !ground.userData.render;   // בהדמיה אין מפת רקע: הרחובות נבנים כאספלט (plans-real.js)
    satG.visible = satOn && !underOn && !ground.userData.render; if(ctxG) ctxG.visible = !underOn;
    streetG.visible = streetsOn && !underOn && !ground.userData.render; ground.visible = !underOn; shadowCatch.visible = !underOn; if(terrainM) terrainM.visible = !underOn; draw(); }

  // משטחים
  const outlineM = new T.LineBasicMaterial({ color:'#2a2a28', transparent:true, opacity:.5 });
  function rimGeo(polys, y){ const seen = new Map(), key = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? a+'|'+b : b+'|'+a;
    for(const [, flat] of polys){ const n = flat.length/2; for(let i = 0; i < n; i++){ const a = [flat[2*i], flat[2*i+1]], j = (i+1)%n, b = [flat[2*j], flat[2*j+1]], k = key(a, b), e = seen.get(k); if(e) e.c++; else seen.set(k, { a, b, c:1 }); } }
    const pos = []; seen.forEach(e => { if(e.c === 1) pos.push(e.a[0]/10, y, -e.a[1]/10, e.b[0]/10, y, -e.b[1]/10); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); return g; }
  const S = model.surf, surf = (kind, y, mat, tint) => { if(!S[kind]) return; add(kind, new T.Mesh(flatGeo(T, S[kind], y, tint||0), mat), { noReceive:true });
    const ln = new T.LineSegments(rimGeo(S[kind], y + .012), outlineM); ln.userData.rim = true; groups[kind].add(ln); };
  surf('asphalt', .00, M.std({ color:KIND.asphalt.color, map:TX.asphalt, vertexColors:true, roughness:.97 }));
  surf('brt', .012, M.std({ color:KIND.brt.color, map:TX.asphalt, vertexColors:true }));
  surf('ramp', .02, M.std({ color:KIND.ramp.color, map:TX.asphalt, vertexColors:true }));
  surf('paving', .035, M.std({ color:'#efe6c4', map:TX.paving, vertexColors:true, roughness:.85 }), .55);
  surf('bike', .05, M.std({ color:KIND.bike.color, map:TX.asphalt, vertexColors:true }));
  surf('play', .06, M.std({ color:KIND.play.color, map:TX.rubber, vertexColors:true }));
  surf('deck', .07, M.std({ color:KIND.deck.color, map:TX.wood, vertexColors:true }));
  surf('green', .085, M.std({ color:'#9fd07f', map:TX.grass, vertexColors:true, roughness:1 }), .5);
  surf('firemark', .10, M.std({ color:KIND.firemark.color, transparent:true, opacity:.75 }));
  surf('fountain', .09, M.std({ color:KIND.fountain.color, roughness:.1, metalness:.2 })); surf('firepath', .11, M.std({ color:KIND.firepath.color, transparent:true, opacity:.35 }));
  surf('plaza', .06, M.std({ color:KIND.plaza.color, map:TX.paving, vertexColors:true, roughness:.9 }));
  surf('bikeRoom', 4.03, M.std({ color:KIND.bikeRoom.color })); surf('tech', 4.03, M.std({ color:KIND.tech.color }));
  ['useShop', 'useLobby', 'usePublic', 'useClub'].forEach((k, i) => surf(k, .11 + i*.004, M.std({ color:'#ffffff', vertexColors:true, roughness:.7 }), 1));   // רצפת קומת הקרקע לפי השימוש
  surf('sport', .062, M.std({ color:'#ffffff', map:TX.rubber, vertexColors:true, roughness:.8 }), 1); surf('yard', .058, M.std({ color:'#ffffff', map:TX.paving, vertexColors:true }), 1);
  // הבינוי המאושר בשאר המתחם (תכנון רעיוני): נפח בהיר בגובה המרבי של המגרש
  if(model.appBuild && model.appBuild.length){
    model.appBuild.forEach(b => { const eg = extrudeGeo(T, [ring2(b[1])], 0, b[0]); add('appBuild', new T.Mesh(eg, M.std({ color:KIND.appBuild.color, roughness:.85, transparent:true, opacity:.92 })), { cast:true, solid:true });
      groups.appBuild.add(new T.LineSegments(new T.EdgesGeometry(eg, 35), outlineM)); }); }
  if(S.wall){ const wg = extrudeGeo(T, S.wall.map(p => ring2(p[1])), 0, model.wallH || 4); add('wall', new T.Mesh(wg, M.std({ color:KIND.wall.color, roughness:.8 })), { cast:true, solid:true });
    groups.wall.add(new T.LineSegments(new T.EdgesGeometry(wg, 35), outlineM)); }
  if(S.pergola){ const rs = S.pergola.map(p => ring2(p[1]));
    add('pergola', new T.Mesh(extrudeGeo(T, rs, 2.8, .16), M.std({ color:KIND.pergola.color, map:TX.wood, transparent:true, opacity:.9, side:T.DoubleSide })), { cast:true, solid:true });
    const posts = []; rs.forEach(r => r.forEach(p => { if(posts.every(q => Math.hypot(q[0]-p[0], q[1]-p[1]) > 3)) posts.push(p); }));
    const pm = new T.InstancedMesh(new T.BoxGeometry(.14, 2.8, .14), M.std({ color:'#7a6a55' }), posts.length), o = new T.Object3D();
    posts.forEach((p, i) => { o.position.set(p[0], 1.4, -p[1]); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); }); add('pergola', pm, { cast:true, solid:true }); }

  // קווים
  const L = model.lines;
  const rib = (kind, y0, h, mat, o) => { if(L[kind]) add(kind, new T.Mesh(ribbonGeo(T, L[kind], y0, h), mat), o); };
  const lin = (kind, y, color) => { if(L[kind]) add(kind, new T.LineSegments(lineGeo(T, L[kind], y), new T.LineBasicMaterial({ color }))); };
  rib('plot', 0, .3, new T.MeshBasicMaterial({ color:KIND.plot.color, transparent:true, opacity:.55, side:T.DoubleSide, depthWrite:false }), { noReceive:true });
  lin('plot', .32, KIND.plot.color); lin('lots', .13, KIND.lots.color); lin('bline', .14, KIND.bline.color); lin('bldline', .15, KIND.bldline.color); lin('front', .17, KIND.front.color); lin('easement', .09, KIND.easement.color); lin('radius', .2, KIND.radius.color); lin('exSurvey', .015, KIND.exSurvey.color);
  rib('curb', 0, .15, M.std({ color:KIND.curb.color, side:T.DoubleSide })); lin('paint', .03, '#ffffff'); lin('cross', .05, '#ffffff'); lin('parking', .05, '#f1f1f1');
  rib('lowwall', 0, .9, M.std({ color:KIND.lowwall.color, side:T.DoubleSide }), { cast:true, solid:true });
  rib('fence', 0, 1.2, M.std({ color:KIND.fence.color, side:T.DoubleSide, transparent:true, opacity:.45 }), { solid:true });
  lin('stairs', .12, KIND.stairs.color); lin('gardenedge', .11, KIND.gardenedge.color);
  rib('glass', 0, model.glassH || 3.7, M.std({ color:KIND.glass.color, side:T.DoubleSide, transparent:true, opacity:.5, roughness:.15, metalness:.2 }), { solid:true });
  rib('door', 0, 2.2, M.std({ color:KIND.door.color, side:T.DoubleSide }), { solid:true });
  rib('water', .1, .22, new T.MeshBasicMaterial({ color:KIND.water.color, side:T.DoubleSide }), { noReceive:true });
  rib('sewer', .1, .22, new T.MeshBasicMaterial({ color:KIND.sewer.color, side:T.DoubleSide }), { noReceive:true });
  rib('drain', .1, .22, new T.MeshBasicMaterial({ color:KIND.drain.color, side:T.DoubleSide }), { noReceive:true });
  rib('waterNew', .1, .22, new T.MeshBasicMaterial({ color:KIND.waterNew.color, side:T.DoubleSide }), { noReceive:true });
  rib('sewerNew', .1, .22, new T.MeshBasicMaterial({ color:KIND.sewerNew.color, side:T.DoubleSide }), { noReceive:true });
  rib('gas', .1, .22, new T.MeshBasicMaterial({ color:KIND.gas.color, side:T.DoubleSide }), { noReceive:true });
  lin('fireroute', .16, KIND.fireroute.color);  lin('phase', .2, KIND.phase.color); lin('contour', .14, KIND.contour.color);

  // אובייקטים
  const O = model.obj, dummy = new T.Object3D();
  const inst = (kind, geo, mat, list, place, o) => { if(!list || !list.length) return; const m = new T.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { place(dummy, it, i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); add(kind, m, Object.assign({ cast:true, solid:true }, o)); return m; };
  const rnd = i => { const x = Math.sin(i*127.1)*43758.5453; return x - Math.floor(x); };
  function trees(kind, list, leaf){
    const trunkH = t => 2.0 + Math.min(3.2, t[2]*0.45);
    inst(kind, new T.CylinderGeometry(.12, .2, 1, 7), M.std({ color:'#6b4a2e' }), list, (d, t) => { const h = trunkH(t); d.position.set(t[0], h/2, -t[1]); d.scale.set(1+t[2]*.12, h, 1+t[2]*.12); });
    const leafM = M.std({ color:'#ffffff', roughness:1, transparent:true, opacity:.84 }), ico = new T.IcosahedronGeometry(1, 2);   // צמרת עגולה ורכה, לא מחודדת leafM.userData.leaf = true;
    const base = new T.Color(leaf), tint = (m, seed) => { if(!m) return; const c = new T.Color(); for(let i = 0; i < m.count; i++){ const v = rnd(i*7+seed); c.copy(base).offsetHSL((v-.5)*.05, (v-.5)*.12, (rnd(i*3+seed)-.5)*.12); m.setColorAt(i, c); } m.instanceColor.needsUpdate = true; };
    // צמרת משלושה גושים בגוונים שונים: כל עץ שונה מעט מהשכן שלו
    tint(inst(kind, ico, leafM, list, (d, t, i) => { const r = Math.max(1.1, t[2]); d.position.set(t[0], trunkH(t)+r*.55, -t[1]); d.scale.set(r, r*.78, r); d.rotation.y = rnd(i)*6; }), 1);
    tint(inst(kind, ico, leafM, list, (d, t, i) => { const r = Math.max(1.1, t[2])*.62, a = rnd(i+9)*6.28; d.position.set(t[0]+Math.cos(a)*r*.7, trunkH(t)+r*1.5, -t[1]+Math.sin(a)*r*.7); d.scale.set(r, r*.8, r); }), 2);
    tint(inst(kind, ico, leafM, list, (d, t, i) => { const r = Math.max(1.1, t[2])*.55, a = rnd(i+19)*6.28 + 2.4; d.position.set(t[0]+Math.cos(a)*r*.9, trunkH(t)+r*1.1, -t[1]+Math.sin(a)*r*.9); d.scale.set(r, r*.75, r); d.rotation.y = rnd(i+4)*6; }), 3);
  }
  trees('treeNew', O.treeNew, KIND.treeNew.color); trees('treeOld', O.treeOld, KIND.treeOld.color); trees('exTree', O.exTree, KIND.exTree.color);
  (O.treeSurvey||[]).forEach(([hex, list]) => inst('treeSurvey', new T.RingGeometry(.55, .95, 20), new T.MeshBasicMaterial({ color:hex, side:T.DoubleSide }), list, (d, t) => { d.position.set(t[0], .2, -t[1]); d.rotation.x = -Math.PI/2; }, { cast:false, noReceive:true }));
  const lampHead = new T.MeshStandardMaterial({ color:'#fff6cf', emissive:'#ffd66b', emissiveIntensity:0 });
  inst('lamp', new T.CylinderGeometry(.07, .1, 7, 8), M.std({ color:'#5f6368', metalness:.5, roughness:.5 }), O.lamp, (d, t) => d.position.set(t[0], 3.5, -t[1]));
  inst('lamp', new T.BoxGeometry(1.3, .07, .1), M.std({ color:'#5f6368' }), O.lamp, (d, t, i) => { d.position.set(t[0], 6.95, -t[1]); d.rotation.y = rnd(i)*6.28; d.translateX(.6); });
  inst('lamp', new T.SphereGeometry(.2, 10, 8), lampHead, O.lamp, (d, t, i) => { d.position.set(t[0], 6.85, -t[1]); d.rotation.y = rnd(i)*6.28; d.translateX(1.15); }, { cast:false });
  const box = (kind, list, h, mat, y, k) => inst(kind, new T.BoxGeometry(1, 1, 1), mat, list, (d, b) => { d.position.set(b[0], (y||0)+h/2, -b[1]); d.rotation.y = b[4]; d.scale.set(Math.max(.3, b[2]*(k||1)), h, Math.max(.3, b[3]*(k||1))); });
  const wood = M.std({ color:KIND.bench.color, map:TX.wood });
  box('bench', O.bench, .08, wood, .42); inst('bench', new T.BoxGeometry(1, .5, .07), wood, O.bench, (d, b) => { d.position.set(b[0], .72, -b[1]); d.rotation.y = b[4]; d.scale.set(b[2], 1, 1); d.translateZ(Math.max(.18, b[3]/2-.05)); });
  inst('bench', new T.BoxGeometry(1, .42, .4), M.std({ color:'#8d8a84' }), O.bench, (d, b) => { d.position.set(b[0], .21, -b[1]); d.rotation.y = b[4]; d.scale.set(Math.max(.4, b[2]*.82), 1, 1); });
  box('bin', O.bin, 1.25, M.std({ color:KIND.bin.color }), 0, .9); box('cabinet', O.cabinet, 1.4, M.std({ color:KIND.cabinet.color }));
  box('trafo', O.trafo, 2.6, M.std({ color:KIND.trafo.color }));
  box('exBench', O.exBench, .45, M.std({ color:KIND.exBench.color, map:TX.wood })); box('exBin', O.exBin, 1.1, M.std({ color:KIND.exBin.color }));
  inst('exSign', new T.CylinderGeometry(.04, .04, 2.6, 6), M.std({ color:'#7d8288', metalness:.5 }), O.exSign, (d, t) => d.position.set(t[0], 1.3, -t[1]));
  inst('exSign', new T.CylinderGeometry(.35, .35, .05, 16), M.std({ color:KIND.exSign.color }), O.exSign, (d, t) => { d.position.set(t[0], 2.45, -t[1]); d.rotation.x = Math.PI/2; });
  inst('cover', new T.CylinderGeometry(1, 1, .03, 18), M.std({ color:KIND.cover.color, metalness:.4 }), O.cover, (d, t) => { d.position.set(t[0], .12, -t[1]); d.scale.set(Math.max(.3, t[2]), 1, Math.max(.3, t[2])); }, { cast:false });
  // כבאית בכל רחבת כיבוי
  (O.fire||[]).forEach(b => {
    const g = new T.Group(), red = M.std({ color:KIND.fire.color, roughness:.5 }), dark = M.std({ color:'#22252a' }), len = Math.min(9.5, b[2]-.6), w = 2.5;
    const part = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    part(new T.BoxGeometry(len*.68, 1.9, w), red, -len*.16, 1.75, 0); part(new T.BoxGeometry(len*.26, 2.2, w), red, len*.33, 1.75, 0);
    part(new T.BoxGeometry(len*.2, .8, w+.02), M.std({ color:'#bfe0ee', roughness:.2 }), len*.36, 2.25, 0);
    part(new T.BoxGeometry(len*.82, .22, .7), M.std({ color:'#c9ccd1', metalness:.5 }), -len*.1, 2.95, 0); part(new T.BoxGeometry(len*.98, .25, w+.04), M.std({ color:'#f3f3f3' }), 0, 1.0, 0);
    part(new T.BoxGeometry(.5, .2, 1.4), new T.MeshStandardMaterial({ color:'#2a6fe0', emissive:'#2a6fe0', emissiveIntensity:.6 }), len*.33, 2.95, 0);
    [-.34, -.22, .32].forEach(k => [-1, 1].forEach(s => { const wh = part(new T.CylinderGeometry(.52, .52, .4, 14), dark, len*k, .52, s*(w/2-.1)); wh.rotation.x = Math.PI/2; }));
    g.position.set(b[0], 0, -b[1]); g.rotation.y = b[4]; add('fire', g, { cast:true, solid:true });
  });
  // כניסות, מעליות אשפה ורומים (תוכנית העמדה כתמונה)
  inst('entry', new T.ConeGeometry(.55, 1.1, 3), M.std({ color:KIND.entry.color }), O.entry, (d, t) => d.position.set(t[0], .55, -t[1]));
  box('wasteLift', (O.wasteLift||[]).map(t => [t[0], t[1], 1.6, 1.6, 0]), 4.8, M.std({ color:KIND.wasteLift.color }));
  inst('manhole', new T.CylinderGeometry(.6, .6, .06, 16), M.std({ color:KIND.manhole.color, metalness:.4 }), O.manhole, (d, t) => d.position.set(t[0], .14, -t[1]), { cast:false });
  inst('wasteInlet', new T.CylinderGeometry(.35, .35, 1.0, 12), M.std({ color:KIND.wasteInlet.color }), O.wasteInlet, (d, t) => d.position.set(t[0], .5, -t[1]));
  inst('hydrant', new T.CylinderGeometry(.13, .16, .8, 10), M.std({ color:KIND.hydrant.color }), O.hydrant, (d, t) => d.position.set(t[0], .4, -t[1]));
  box('meter', O.meter && O.meter.map(t => [t[0], t[1], .5, .4, 0]), .25, M.std({ color:KIND.meter.color }));
  box('gasCab', O.gasCab, 1.0, M.std({ color:KIND.gasCab.color }));
  inst('exPole', new T.CylinderGeometry(.09, .12, 8, 7), M.std({ color:KIND.exPole.color, metalness:.4 }), O.exPole, (d, t) => d.position.set(t[0], 4, -t[1]));
  (O.spot||[]).forEach(t => { if(typeof document === 'undefined') return; const c = document.createElement('canvas'); c.width = 160; c.height = 44; const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,.88)'; x.fillRect(0, 0, 160, 44); x.fillStyle = t[3] === 'ffl' ? '#1a1a18' : KIND.spot.color; x.font = 'bold 26px IBM Plex Sans, Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText((t[3] === 'hp' ? 'HP ' : t[3] === 'lp' ? 'LP ' : '') + Number(t[2]).toFixed(2), 80, 23);
    const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:false })); sp.scale.set(4.4, 1.2, 1); sp.position.set(t[0], t[3] === 'ffl' ? 5.4 : 1.6, -t[1]); add('spot', sp, {}); });
  // מסת הבניינים: רק כשנבחר מספר קומות
  const massMat = M.std({ color:KIND.mass.color, transparent:true, opacity:.9, roughness:.7 }); let massMesh = null;
  function setFloors(n){ if(massMesh){ groups.mass.remove(massMesh); massMesh.geometry.dispose(); massMesh = null; }
    if(n > 0 && model.foot && model.foot.length){ massMesh = add('mass', new T.Mesh(extrudeGeo(T, model.foot.map(ring2), 4, n*3.1), massMat), { cast:true, solid:true }); applyActive(); }
    draw(); }

  // שמש
  const sunBall = new T.Mesh(new T.SphereGeometry(7, 20, 14), new T.MeshBasicMaterial({ color:'#ffc93c', fog:false })); scene.add(sunBall);
  const pathLine = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color:'#e6a700', fog:false })); scene.add(pathLine);
  let sunState = null;
  let sunArgs = null;
  function setSun(y, m, d, hour){
    const s = sunPos(ilDate(y, m, d, hour), center[0], center[1]), R = 330, dir = a => new T.Vector3(Math.sin(a.az)*Math.cos(a.alt), Math.sin(a.alt), -Math.cos(a.az)*Math.cos(a.alt));
    const v = dir(s); sun.position.copy(v).multiplyScalar(R); sun.target.position.set(0, 0, 0); sunBall.position.copy(v).multiplyScalar(R+30);
    sunArgs = [y, m, d, hour]; const up = Math.max(0, Math.sin(s.alt)), day = s.alt > 0, lit = s.alt < 3*Math.PI/180;   // התאורה נדלקת בדמדומים, מעט לפני השקיעה
    sun.intensity = day ? .55 + 1.35*Math.min(1, up*2.2) : 0; hemi.intensity = day ? .5 + .1*up : .12; sunBall.visible = day;
    const sky = new T.Color(day ? '#eef2f5' : '#20283a').lerp(new T.Color('#f6d9b0'), day ? Math.max(0, .5-up*2.2) : 0); scene.background = sky;
    lampHead.emissiveIntensity = lit ? 2.4 : 0; setNight(lit); skySun(v, day); scene.environment = day ? envTex : null;   // בלילה אין השתקפות שמיים: החזיתות כהות והחלונות המוארים בולטים
    fill.position.set(-v.x*R, Math.max(60, v.y*R*.4), -v.z*R); fill.intensity = day ? .2 : .05;
    const pts = []; for(let h = 4; h <= 21; h += .25){ const p = sunPos(ilDate(y, m, d, h), center[0], center[1]); if(p.alt > 0) pts.push(dir(p).multiplyScalar(R+30)); }
    pathLine.geometry.setFromPoints(pts); sunState = { alt:s.alt*180/Math.PI, az:(s.az*180/Math.PI+360)%360, day, lit };
    if(rl && rl.setTime) rl.setTime(sunState.alt);   // ההמחשה הראליסטית: אור ערב, פנסים, ויטרינות ופנסי מכוניות
    draw(); return sunState;
  }

  // רוח: פסים נעים בכיוון שנבחר (הכיוון הוא הנחה, לא מדידה)
  const windG = new T.Group(); windG.visible = false; scene.add(windG); let windDir = null, windT = 0;
  { const mat = new T.MeshBasicMaterial({ color:'#1f7fd6', transparent:true, opacity:.8, fog:false }), shaft = new T.BoxGeometry(1, .35, .35), head = new T.ConeGeometry(1.1, 3.2, 10); head.rotateZ(-Math.PI/2);
    for(let i = 0; i < 110; i++){ const g = new T.Group(), L = 9 + rnd(i)*9, a = new T.Mesh(shaft, mat), h = new T.Mesh(head, mat); a.scale.x = L; h.position.x = L/2 + 1.4; g.add(a, h);
      g.userData = { o:rnd(i+3)*520, y:2.5 + rnd(i+5)*rnd(i+11)*70, s:rnd(i+7)*460-230 }; windG.add(g); } }
  function setWind(deg){ windDir = deg; windG.visible = deg != null; if(deg != null) loop(); else draw(); }
  function stepWind(dt){ if(windDir == null) return; windT += dt*26; const a = (windDir+180)*Math.PI/180, dx = Math.sin(a), dz = -Math.cos(a);   // הרוח נושבת מהכיוון שנבחר
    windG.children.forEach(m => { const t = ((windT + m.userData.o) % 520) - 260; m.position.set(dx*t - dz*m.userData.s, m.userData.y, dz*t + dx*m.userData.s); m.rotation.y = Math.atan2(-dz, dx); }); }

  // תצוגה: שכבות פעילות, רפאים לשאר
  let active = null, state = 'design', envOn = false; const kindOff = new Set();
  const solidOn = (g, v) => { g.visible = v; g.traverse(x => { if(x.isMesh && x.userData.mat){ x.material = x.userData.mat; x.castShadow = v && x.userData.solid; } }); };
  function applyActive(){
    for(const k in groups){ const g = groups[k];
      if(state !== 'design'){ solidOn(g, (STATE_KINDS[state].includes(k) && !kindOff.has(k)) || (k==='under' && underOn && state==='renewal')); continue; }
      if(k==='rnParcel' || k==='rnMass' || (KIND[k] && KIND[k].topic==='exist')){ g.visible = false; continue; }   // מפת המדידה רק במצב "קיים"
      if(k==='rnEnvelope'){ solidOn(g, envOn); continue; }
      if(k==='under'){ solidOn(g, underOn); continue; }
      if(k==='facade'){ solidOn(g, facOn && !kindOff.has(k)); continue; }
      const on = !kindOff.has(k) && (!active || active.has(KIND[k].topic));
      const off = kindOff.has(k), ctx = ['asphalt','paving','green','wall','brt','bike','ramp'].includes(k);
      g.visible = on || (!off && ctx);
      g.traverse(x => { if(x.isMesh && x.userData.mat){ x.material = on ? x.userData.mat : ghost; x.castShadow = on && x.userData.solid; } });
    }
    renderFix(); draw();
  }
  function setActive(set){ active = set ? new Set(set) : null; applyActive(); }
  function setKind(k, on){ if(on) kindOff.delete(k); else kindOff.add(k); applyActive(); }
  function setState(st){ state = st; applyActive(); updCtx(); if(rl) rl.root.visible = renderOn && state === 'design'; if(lifeG) lifeG.visible = renderOn && state === 'design'; }
  function setEnvelope(on){ envOn = !!on; applyActive(); }

  /* התחדשות עירונית (נפחים לפי הזכויות) ומצב קיים. הנתונים ב-WGS84, ומומרים לרשת ישראל */
  /* חזיתות להמחשה (תוכנית בינוי ועיצוב): מעל קומת הקרקע שבשרטוט עולה מגדל לפי הקומות והגובה של התב"ע.
     שטח הקומה לפי טבלה 5. החלונות, המרפסות והחיפוי הם המחשה, ולא מהשרטוט. */
  let rnData = null, facOn = false, underOn = false, facBuilt = false, underBuilt = false;
  const locLL = c => { const [E, N] = wgs2itm(c[1], c[0]); return [E-model.e0, N-model.n0]; };
  const pip = (p, r) => { let c = false; for(let i = 0, j = r.length-1; i < r.length; j = i++){ const a = r[i], b = r[j]; if((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) c = !c; } return c; };
  function facadeTex(wall, frame, glass, big){
    const mk = draw2 => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; draw2(c.getContext('2d')); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t; };
    const win = big ? [18, 30, 220, 178] : [34, 44, 188, 150];      // חלון בתוך מפתח אחד של קומה אחת
    const map = mk(g => { g.fillStyle = wall; g.fillRect(0, 0, 256, 256); for(let i = 0; i < 900; i++){ g.fillStyle = `rgba(0,0,0,${Math.random()*.035})`; g.fillRect(Math.random()*256, Math.random()*256, 3, 2); }
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, 248, 256, 8); g.fillStyle = frame; g.fillRect(win[0]-5, win[1]-5, win[2]+10, win[3]+10);
      const gr = g.createLinearGradient(0, win[1], 0, win[1]+win[3]); gr.addColorStop(0, glass[0]); gr.addColorStop(1, glass[1]); g.fillStyle = gr; g.fillRect(...win);
      g.fillStyle = frame; g.fillRect(win[0]+win[2]/2-2, win[1], 4, win[3]); if(big) g.fillRect(win[0], win[1]+win[3]*.62, win[2], 4); });
    map.encoding = T.sRGBEncoding;
    const orm = mk(g => { g.fillStyle = 'rgb(0,225,0)'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgb(0,18,255)'; g.fillRect(...win); });   // G: חספוס, B: מתכתיות. החלון חלק ומשתקף
    return new T.MeshStandardMaterial({ map, roughnessMap:orm, metalnessMap:orm, roughness:1, metalness:1, envMapIntensity:1.15, side:T.DoubleSide });
  }
  function buildFacades(){
    facBuilt = true; if(!rnData || !model.foot) return;
    const lots = Object.fromEntries(rnData.lots.map(l => [l.lot, l])), parcels = rnData.parcels.map(p => ({ lot:p.lot, r:p.c.map(locLL) }));
    const mats = { res:facadeTex('#e9e3d6', '#55595e', ['#5f7f9c', '#9fc0d8'], false), pub:facadeTex('#c9b9a2', '#4a4640', ['#547186', '#a5c2d2'], true) };
    const slabM = M.std({ color:'#f1eee7', roughness:.6 }), railM = new T.MeshStandardMaterial({ color:'#bfe1ee', transparent:true, opacity:.38, roughness:.05, metalness:.6, envMapIntensity:1.3, side:T.DoubleSide });
    const roofM = M.std({ color:'#c9c5bb' }), slabs = [], rails = [], bay = 3.6;
    /* parts (תוכנית העמדה מתמונה, tools/siteplan-model.py): מגדל ואגף לכל בניין, עם מספר הקומות והגובה מהמצגת. בלי parts: המבנה מוקטן לשטח הקומה בתב"ע */
    const items = model.parts && model.parts.length ? model.parts.map(p => ({ f:p.c, part:p })) : model.foot.map(f => ({ f }));
    items.forEach(({ f, part }) => {
      let r = ring2(f); const cx = r.reduce((s2, p) => s2+p[0], 0)/r.length, cy = r.reduce((s2, p) => s2+p[1], 0)/r.length, pc = parcels.find(p => pip([cx, cy], p.r)),
        lot = part ? Object.assign({}, lots[part.lot] || {}, { cat: part.kind === 'public' ? 'public' : 'residential' }) : pc && lots[pc.lot];
      if(!part && (!lot || !lot.floors)) return;
      let A = 0; for(let i = 0; i < r.length; i++){ const a = r[i], b = r[(i+1)%r.length]; A += a[0]*b[1]-b[0]*a[1]; } if(A < 0) r = r.slice().reverse(); A = Math.abs(A)/2;
      const k = !part && lot.plate ? Math.min(1, Math.sqrt(lot.plate/A)) : 1; r = r.map(p => [cx+(p[0]-cx)*k, cy+(p[1]-cy)*k]);
      const y0 = 4, n = part ? Math.max(1, part.floors - 1) : lot.floors - 1, fh = part ? (part.top - y0)/n : (lot.height || lot.floors*3.3)/lot.floors, y1 = y0 + n*fh, pos = [], uv = [];
      let u = 0;
      for(let i = 0; i < r.length; i++){ const a = r[i], b = r[(i+1)%r.length], len = Math.hypot(b[0]-a[0], b[1]-a[1]), nb = Math.max(1, Math.round(len/bay)), u1 = u + nb;
        pos.push(a[0], y0, -a[1], b[0], y0, -b[1], b[0], y1, -b[1], a[0], y0, -a[1], b[0], y1, -b[1], a[0], y1, -a[1]); uv.push(u, 0, u1, 0, u1, n, u, 0, u1, n, u, n); u = u1;
        if(len < 9 || lot.cat === 'public') continue;                // מרפסות: בכל מפתח שני, בחזיתות הארוכות
        const dx = (b[0]-a[0])/len, dy = (b[1]-a[1])/len, ox = dy, oy = -dx, ang = Math.atan2(dy, dx);
        for(let j = 0; j < nb; j += 2) for(let fl = 0; fl < n; fl++){ const t = (j+.5)/nb, px = a[0]+(b[0]-a[0])*t, py = a[1]+(b[1]-a[1])*t, y = y0 + fl*fh;
          slabs.push([px+ox*.8, y+.09, py+oy*.8, ang]); rails.push([px+ox*1.55, y+.7, py+oy*1.55, ang]); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      add('facade', new T.Mesh(g, lot.cat === 'public' ? mats.pub : mats.res), { cast:true, solid:true });
      { const ep = []; r.forEach((a, i) => { const b = r[(i+1)%r.length]; ep.push(a[0], y0, -a[1], a[0], y1, -a[1], a[0], y1+1.1, -a[1], b[0], y1+1.1, -b[1], a[0], y0, -a[1], b[0], y0, -b[1]); });
        const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.Float32BufferAttribute(ep, 3)); groups.facade.add(new T.LineSegments(eg, outlineM)); }
      add('facade', new T.Mesh(flatGeo(T, [['#ffffff', r.flatMap(p => [p[0]*10, p[1]*10])]], y1, 0), roofM), { cast:true, solid:true });
      add('facade', new T.Mesh(ribbonGeo(T, [r.concat([r[0]]).flatMap(p => [p[0]*10, p[1]*10])], y1, 1.1), roofM), { cast:true, solid:true });
      const core = new T.Mesh(new T.BoxGeometry(Math.sqrt(A)*k*.3, 3, Math.sqrt(A)*k*.22), roofM); core.position.set(cx, y1+1.5, -cy); add('facade', core, { cast:true, solid:true });
    });
    const place = (list, geo, mat) => inst('facade', geo, mat, list, (d, t) => { d.position.set(t[0], t[1], -t[2]); d.rotation.y = t[3]; }, { cast:false });
    place(slabs, new T.BoxGeometry(3.1, .18, 1.6), slabM); place(rails, new T.BoxGeometry(3.1, 1.05, .05), railM);
  }
  /* הקומות והחזיתות מתוכניות האדריכל (floors.json, tools/extract-floors.py, ענת 23.11.2026).
     כל קומה במקום ובגובה שלה: המתאר, החלונות והיציאות למרפסת לפי הפתחים בשרטוט, מרפסות עם מעקה זכוכית, וגג עם מבני היציאה.
     גובה הקומות והחלונות: הנחה (אין חתכים). חתך קומה: הקומות שמעליה מוסתרות, והקירות שלה מוצגים כמו בתוכנית, בשחור. */
  let fd = null, cut = 0, real = null, cutObj = [];
  function setBuildings(d){ fd = d && d.buildings && d.buildings.length ? d : null; }
  const USE_WALL = { res:'#e2d8c6', work:'#d6dadd', public:'#e0d6e6' };   // אבן גיר חמה; הפסים הלבנים של התקרות נותנים את קצב הקומות
  const SPANDREL = { work:'#7d8790', public:'#8f7f9c' };          // קיר המסך: פס אטום בצבע השימוש (תעסוקה אפור, ציבור סגול, כמו במצגת)
  let nightOn = false; const nightObjs = [], sc = h => new T.Color(h).convertSRGBToLinear();   // צבע כפי שנראה במסך (החומרים כאן ליניאריים)
  /* חיפוי: לוחות אבן בהירה של 1.2 על 1.05 מ', עם מישק דק. מצויר בקוד */
  function cladTex(){
    const t = tex(T, 256, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
      for(let i = 0; i < 2600; i++){ const v = Math.random(); g.fillStyle = `rgba(${v < .5 ? '120,110,95' : '255,255,250'},${.04 + Math.random()*.06})`; g.fillRect(Math.random()*s, Math.random()*s, 1 + Math.random()*3, 1 + Math.random()*2); }
      g.fillStyle = 'rgba(60,55,48,.30)'; g.fillRect(0, 0, s, 3); g.fillRect(0, 0, 3, s); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 3, s, 1); }, 1);
    t.repeat.set(1/1.2, 1/1.05); t.encoding = T.sRGBEncoding; return t; }
  function gravelTex(){ const t = tex(T, 256, (g, s) => noise(g, s, '#ffffff', 60, 9000), 1.6); t.encoding = T.sRGBEncoding; return t; }
  function buildReal(){
    const P = fd.plans, prep = {}, col = new T.Color(), hash = (x, y, z) => { const v = Math.sin(x*12.9898 + y*78.233 + z*37.719)*43758.5453; return v - Math.floor(v); };
    const inR = (x, y, r) => { let c = false; for(let i = 0, j = r.length-1; i < r.length; j = i++){ const a = r[i], b = r[j]; if((a[1] > y) !== (b[1] > y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) c = !c; } return c; };
    const dEdge = (x, y, r) => { let d = 1e9; r.forEach((a, i) => { const b = r[(i+1)%r.length], vx = b[0]-a[0], vy = b[1]-a[1], l = vx*vx+vy*vy || 1e-9, t = Math.max(0, Math.min(1, ((x-a[0])*vx+(y-a[1])*vy)/l)); d = Math.min(d, Math.hypot(x-a[0]-t*vx, y-a[1]-t*vy)); }); return d; };
    function plan(id){ if(prep[id]) return prep[id]; const p = P[id], r = ring2(p.env); let A = 0; r.forEach((a, i) => { const b = r[(i+1)%r.length]; A += a[0]*b[1]-b[0]*a[1]; });
      const out = A > 0 ? 1 : -1, balc = (p.balc||[]).map(ring2); let u = 0;
      const edges = r.map((a, i) => { const b = r[(i+1)%r.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1e-6, e = { a, b, L, u, ux:(b[0]-a[0])/L, uy:(b[1]-a[1])/L, op:[] }; u += L; return e; });
      (p.open||[]).forEach(o => { const x0 = o[0]/10, y0 = o[1]/10, x1 = o[2]/10, y1 = o[3]/10, mx = (x0+x1)/2, my = (y0+y1)/2; let e = null, bd = .3;
        edges.forEach(E => { const t = (mx-E.a[0])*E.ux + (my-E.a[1])*E.uy, d = Math.abs(-(mx-E.a[0])*E.uy + (my-E.a[1])*E.ux); if(t > -.1 && t < E.L+.1 && d < bd){ bd = d; e = E; } });
        if(!e) return; let t0 = (x0-e.a[0])*e.ux + (y0-e.a[1])*e.uy, t1 = (x1-e.a[0])*e.ux + (y1-e.a[1])*e.uy; if(t0 > t1) [t0, t1] = [t1, t0];
        t0 = Math.max(.15, t0); t1 = Math.min(e.L-.15, t1); if(t1-t0 < .4) return;
        const door = balc.some(b => inR(mx + e.uy*out*.7, my - e.ux*out*.7, b));       // מאחורי הפתח מרפסת: יציאה, מהרצפה
        e.op.push([t0, t1, door]); });
      edges.forEach(e => e.op.sort((p, q) => p[0]-q[0]));
      return prep[id] = { r, edges, out, balc, rail:(p.rail||[]).map(s => s.map(v => v/10)), walls:(p.walls||[]).map(w => [ring2(w)]), core:(p.core||[]).map(ring2), pv:(p.pv||[]).map(ring2) };
    }
    const mk = () => ({ pos:[], col:[], uv:[] });
    // קיר אנכי: uv במטרים לאורך הקיר ובגובה, כדי שלוחות החיפוי יתחברו מסביב לפינות
    const quad = (A, ax, ay, bx, by, y0, y1, c, u0 = 0, u1 = 0) => { A.pos.push(ax, y0, -ay, bx, y0, -by, bx, y1, -by, ax, y0, -ay, bx, y1, -by, ax, y1, -ay);
      if(c) for(let i = 0; i < 6; i++) A.col.push(c.r, c.g, c.b); A.uv.push(u0, y0, u1, y0, u1, y1, u0, y0, u1, y1, u0, y1); };
    const cap = (A, r, y, c) => { let tris; try{ tris = T.ShapeUtils.triangulateShape(r.map(p => new T.Vector2(p[0], p[1])), []); }catch(e){ return; }
      for(const t of tris) for(const i of [t[0], t[2], t[1]]){ A.pos.push(r[i][0], y, -r[i][1]); if(c) A.col.push(c.r, c.g, c.b); A.uv.push(r[i][0], r[i][1]); } };
    const ring = (A, r, y0, y1, c) => { let u = 0; r.forEach((a, i) => { const b = r[(i+1)%r.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]); quad(A, a[0], a[1], b[0], b[1], y0, y1, c, u, u+L); u += L; }); };
    const prism = (A, r, y0, y1, c) => { cap(A, r, y1, c); cap(A, r, y0, c); ring(A, r, y0, y1, c); };
    const clad = cladTex(), gravel = gravelTex();
    const glassM = new T.MeshStandardMaterial({ color:'#2c4252', roughness:.04, metalness:.88, envMapIntensity:1.7, side:T.DoubleSide });
    const cwM = new T.MeshStandardMaterial({ color:'#3c5466', roughness:.05, metalness:.8, envMapIntensity:1.6, side:T.DoubleSide });
    const frameM = M.std({ color:'#34373c', roughness:.45, metalness:.5, envMapIntensity:.6 });
    const railM = new T.MeshStandardMaterial({ color:'#cfe6ef', transparent:true, opacity:.5, roughness:.04, metalness:.5, envMapIntensity:1.4, side:T.DoubleSide, depthWrite:false });
    const wallM = M.std({ vertexColors:true, map:clad, roughness:.78, envMapIntensity:.35 }), slabM = M.std({ color:'#fbfaf6', roughness:.6, envMapIntensity:.4 });
    const roofM = M.std({ color:sc('#a29d92'), map:gravel, roughness:1 }), handM = new T.LineBasicMaterial({ color:'#2e3135' });
    const litM = new T.MeshBasicMaterial({ vertexColors:true, side:T.DoubleSide });
    const geo = A => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(A.pos, 3)); if(A.col.length) g.setAttribute('color', new T.Float32BufferAttribute(A.col, 3));
      if(A.uv && A.uv.length === A.pos.length/3*2) g.setAttribute('uv', new T.Float32BufferAttribute(A.uv, 2)); g.computeVertexNormals(); return g; };
    const LIT = ['#f0ae55', '#f6c27a', '#e39a42', '#fbd596'].map(h => new T.Color(h));
    real = fd.buildings.map(b => {
      const W = mk(), G = mk(), CW = mk(), F = mk(), S = mk(), R = mk(), Hd = mk(), L = mk(), roof = mk(), ends = { W:[0], G:[0], CW:[0], F:[0], S:[0], R:[0], Hd:[0], L:[0] };
      // מסגרת לפתח: ארבעה פסים דקים במישור הזכוכית, ומחיצה באמצע לפתח רחב
      const frame = (ax, ay, bx, by, nx, ny, y0, y1, w) => { const ex = (bx-ax)/w, ey = (by-ay)/w, fw = .07, ox = ax+nx*.98, oy = ay+ny*.98, px = bx+nx*.98, py = by+ny*.98;
        quad(F, ox, oy, ox+ex*fw, oy+ey*fw, y0, y1); quad(F, px-ex*fw, py-ey*fw, px, py, y0, y1);
        quad(F, ox, oy, px, py, y0, y0+fw); quad(F, ox, oy, px, py, y1-fw, y1);
        const n = Math.max(1, Math.round(w/1.4)); for(let i = 1; i < n; i++){ const t = w*i/n; quad(F, ox+ex*(t-.03), oy+ey*(t-.03), ox+ex*(t+.03), oy+ey*(t+.03), y0, y1); } };
      const lit = (ax, ay, bx, by, nx, ny, y0, y1, seed) => { if(hash(ax, ay, y0 + seed) > .55) return; const c = LIT[Math.floor(hash(ay, y0, ax)*LIT.length)];
        quad(L, ax+nx*.9, ay+ny*.9, bx+nx*.9, by+ny*.9, y0, y1, c); };
      b.floors.forEach((f, k) => {
        const p = plan(f.plan), y = f.y, top = y + f.h - .3, t = k === 0 ? y - 4 : .3, curtain = f.use !== 'res'; col.set(USE_WALL[f.use] || USE_WALL.res).convertSRGBToLinear();   // צבעי קודקוד הם ליניאריים
        // תקרה / רצפה: המתאר והמרפסות. דופן התקרה היא פס הקומה הלבן בחזית
        cap(S, p.r, y); cap(S, p.r, y - t); ring(S, p.r, y - t, y);
        if(!f.bare) p.balc.forEach(bc => prism(S, bc, y - .3, y));
        p.edges.forEach(e => { const nx = -e.uy*p.out*.14, ny = e.ux*p.out*.14, P2 = t2 => [e.a[0] + e.ux*t2, e.a[1] + e.uy*t2];
          if(curtain){ // קיר מסך: זכוכית לכל האורך, מחיצות כל 1.5 מ', ופס אטום בצבע השימוש מתחת לתקרה
            const [ax, ay] = P2(0), [bx, by] = P2(e.L), sp = new T.Color(SPANDREL[f.use] || SPANDREL.work).convertSRGBToLinear();
            quad(CW, ax, ay, bx, by, y, top - .55); quad(W, ax, ay, bx, by, top - .55, top, sp, e.u, e.u + e.L);
            if(e.L > .5) frame(ax, ay, bx, by, -nx*.4, -ny*.4, y, top - .55, e.L);
            lit(ax, ay, bx, by, -nx*.5, -ny*.5, y + .02, top - .58, 7); return; }
          let s = 0;
          const solid = (u0, u1) => { if(u1-u0 < .01) return; const [ax, ay] = P2(u0), [bx, by] = P2(u1); quad(W, ax, ay, bx, by, y, top, col, e.u + u0, e.u + u1); };
          e.op.forEach(([u0, u1, door]) => { if(u0 < s) u0 = s; if(u1 <= u0) return; solid(s, u0);
            // פתח: אדן, זכוכית שקועה 14 ס"מ, משקוף, דפנות ומסגרת. יציאה למרפסת מהרצפה
            const sill = door && !f.bare ? y + .04 : y + .9, head = top - .3, [ax, ay] = P2(u0), [bx, by] = P2(u1);
            quad(W, ax, ay, bx, by, y, sill, col, e.u + u0, e.u + u1); quad(W, ax, ay, bx, by, head, top, col, e.u + u0, e.u + u1);
            quad(G, ax+nx, ay+ny, bx+nx, by+ny, sill, head);
            quad(W, ax, ay, ax+nx, ay+ny, sill, head, col); quad(W, bx, by, bx+nx, by+ny, sill, head, col);
            const sl = [[ax, ay], [bx, by], [bx+nx, by+ny], [ax+nx, ay+ny]]; cap(W, sl, sill, col); cap(W, sl, head, col);
            frame(ax, ay, bx, by, nx, ny, sill, head, u1 - u0); lit(ax, ay, bx, by, nx, ny, sill, head, 1);
            s = u1; });
          solid(s, e.L); });
        if(!f.bare) p.rail.forEach(s2 => { quad(R, s2[0], s2[1], s2[2], s2[3], y, y + 1.1); Hd.pos.push(s2[0], y + 1.1, -s2[1], s2[2], y + 1.1, -s2[3], s2[0], y + .02, -s2[1], s2[2], y + .02, -s2[3]); });
        for(const kk in ends) ends[kk].push(({ W, G, CW, F, S, R, Hd, L })[kk].pos.length/3);
      });
      /* החזית החמישית: גג בחצץ, מעקה בחיפוי עם קופינג, מבני היציאה מתוכנית הגג עם גג משלהם, ומערכות על הגג (להמחשה) */
      const last = plan(b.floors[b.floors.length-1].plan), ty = b.top, roofTop = mk(), equip = [], pv = [];
      col.set(USE_WALL.res).convertSRGBToLinear(); cap(roofTop, last.r, ty + .02); cap(S, last.r, ty - .3);
      ring(roof, last.r, ty - .3, ty + 1.1, col);
      { const inner = last.r.map(q => q); const cx = inner.reduce((a, q) => a+q[0], 0)/inner.length, cy = inner.reduce((a, q) => a+q[1], 0)/inner.length;
        ring(roof, inner.map(q => [q[0] + (cx-q[0])*.0, q[1] + (cy-q[1])*.0]), ty + 1.1, ty + 1.18, new T.Color('#d9d4c9').convertSRGBToLinear()); }
      const cores = (b.roof ? plan(b.roof.plan).core : []).concat(b.mech ? plan(b.mech.plan).core : []);
      if(b.roof) plan(b.roof.plan).core.forEach(c => { prism(roof, c, ty, ty + b.roof.h, col); cap(roofTop, c, ty + b.roof.h + .02); });
      if(b.mech) plan(b.mech.plan).core.forEach(c => { prism(roof, c, b.mech.y, b.mech.y + b.mech.h, col); cap(roofTop, c, b.mech.y + b.mech.h + .02); });
      // תאים סולאריים מתוכנית הגג (השכבה A-FLOR), במקום ובכיוון שבשרטוט, בשיפוע של 15°. בלי שרטוט: רשת להמחשה
      const realPv = (b.roof ? plan(b.roof.plan).pv : []).map(r => { const cx = r.reduce((a, q) => a+q[0], 0)/r.length, cy = r.reduce((a, q) => a+q[1], 0)/r.length;
        let L = 0, ang = 0, W2 = 1e9; r.forEach((a, i) => { const q = r[(i+1)%r.length], l = Math.hypot(q[0]-a[0], q[1]-a[1]); if(l > L){ L = l; ang = Math.atan2(q[1]-a[1], q[0]-a[0]); } if(l > .2) W2 = Math.min(W2, l); });
        return [cx, ty, cy, L, W2, ang]; });
      { // מערכות על הגג: מעבים קרוב לליבה, ותאים סולאריים בשאר הגג. רשת של 1.6 מ', הרחק מהמעקה ומהליבה
        const xs = last.r.map(q => q[0]), ys = last.r.map(q => q[1]);
        for(let x = Math.min(...xs) + 1; x < Math.max(...xs); x += 1.6) for(let yy = Math.min(...ys) + 1; yy < Math.max(...ys); yy += 2.2){
          if(!inR(x, yy, last.r) || dEdge(x, yy, last.r) < 1.6) continue;
          const dc = cores.length ? Math.min(...cores.map(c => inR(x, yy, c) ? 0 : dEdge(x, yy, c))) : 9; if(dc < 1.2) continue;
          if(dc < 2.6){ if(equip.length < 14) equip.push([x, ty, yy]); } else if(dc > 4.2 && !realPv.length) pv.push([x, ty, yy]); } }
      const ms = { W:new T.Mesh(geo(W), wallM), G:new T.Mesh(geo(G), glassM), CW:new T.Mesh(geo(CW), cwM), F:new T.Mesh(geo(F), frameM), S:new T.Mesh(geo(S), slabM), R:new T.Mesh(geo(R), railM),
        Hd:new T.LineSegments(geo(Hd), handM), L:new T.Mesh(geo(L), litM), roof:new T.Group() };
      ms.Hd.userData.keep = true;   // מעקה המרפסת נשאר גם בהדמיה: זה בטיחות, לא קו טכני
      ms.roof.add(new T.Mesh(geo(roof), wallM), new T.Mesh(geo(roofTop), roofM));
      for(const kk of ['W', 'G', 'CW', 'F', 'S', 'roof']) add('facade', ms[kk], { cast:true, solid:true }); add('facade', ms.R, { solid:true, noReceive:true }); add('facade', ms.Hd); add('facade', ms.L);
      ms.L.visible = nightOn; nightObjs.push(ms.L);
      const ac = inst('facade', new T.BoxGeometry(1.1, .95, 1.1), M.std({ color:'#d6d6d2', roughness:.6, metalness:.2 }), equip, (d, q) => d.position.set(q[0], q[1] + .5, -q[2]));
      const pvm = inst('facade', new T.BoxGeometry(1.0, .05, 1.7), new T.MeshStandardMaterial({ color:sc('#1f2d4a'), roughness:.3, metalness:.3, envMapIntensity:.5 }), pv, (d, q) => { d.position.set(q[0], q[1] + .55, -q[2]); d.rotation.set(-.26, 0, 0); });
      const pvr = inst('facade', new T.BoxGeometry(1, .05, 1), new T.MeshStandardMaterial({ color:sc('#1f2d4a'), roughness:.3, metalness:.3, envMapIntensity:.5 }), realPv, (d, q) => { d.position.set(q[0], q[1] + .45, -q[2]); d.rotation.set(0, q[5], 0); d.rotateX(-.26); d.scale.set(q[3], 1, q[4]*.96); });
      // פס אנכי לכל גובה המגדל (תכנון רעיוני: "fins" ב-floors.json, מההדמיה). מוסתר בחתך, כמו הגג
      const fins = b.fins && b.fins.length ? inst('facade', new T.BoxGeometry(1, 1, 1), M.std({ color:sc(b.finColor || '#8a6a4a'), roughness:.55, envMapIntensity:.5 }), b.fins,
        (d, q) => { d.position.set(q[0], (4.0 + ty + 1.2)/2, -q[1]); d.rotation.set(0, q[2], 0); d.scale.set(q[3], ty + 1.2 - 4.0, q[4]); }) : null;
      ms.equip = [ac, pvm, pvr, fins].filter(Boolean);
      // שם הבניין מעל הגג
      const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.94)'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#1a1a18'; x.font = '600 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      x.fillText(b.label || `בניין ${b.id} · ${b.floors.length} קומות`, 256, 50); const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:false })); sp.scale.set(30, 5.6, 1);
      sp.position.set(last.r.reduce((s2, q) => s2+q[0], 0)/last.r.length, ty + 12, -last.r.reduce((s2, q) => s2+q[1], 0)/last.r.length); add('facade', sp);
      return { b, ms, ends, sp, plan };
    });
    buildPodium(); applyCut();
  }
  /* גג המסד: קומת הקרקע מקבלת תקרה (4.0 עד 4.5 מ'), שמכסה גם את הקולונדה, עם פס חזית לבן ומעקה זכוכית.
     על הגג: ריצוף וערוגות מוגבהות עם עצים קטנים, להמחשה ("גג דיירים משותף" במצגת). מבנה בלי מגדל: גג חצץ. */
  function buildPodium(){
    const pods = fd.podium || []; if(!pods.length) return;
    const add = (k, o, opt) => { o.userData.liftMode = 'vertex'; return addG(k, o, opt); };   // כמה קומות קרקע במפלסים שונים באותה רשת: כל קודקוד בגובה שלו
    const S = { pos:[], col:[], uv:[] }, Pv = { pos:[], col:[], uv:[] }, Gr = { pos:[], col:[], uv:[] }, Pl = { pos:[], col:[], uv:[] }, Rv = { pos:[], col:[], uv:[] }, Rl = { pos:[], col:[], uv:[] }, Hd = [], shrubs = [];
    const quad = (A, ax, ay, bx, by, y0, y1, u0 = 0, u1 = 0) => { A.pos.push(ax, y0, -ay, bx, y0, -by, bx, y1, -by, ax, y0, -ay, bx, y1, -by, ax, y1, -ay); A.uv.push(u0, y0, u1, y0, u1, y1, u0, y0, u1, y1, u0, y1); };
    const cap = (A, r, y) => { let tris; try{ tris = T.ShapeUtils.triangulateShape(r.map(p => new T.Vector2(p[0], p[1])), []); }catch(e){ return; } for(const t of tris) for(const i of [t[0], t[2], t[1]]){ A.pos.push(r[i][0], y, -r[i][1]); A.uv.push(r[i][0], r[i][1]); } };
    const ring = (A, r, y0, y1) => { let u = 0; r.forEach((a, i) => { const b = r[(i+1)%r.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]); quad(A, a[0], a[1], b[0], b[1], y0, y1, u, u+L); u += L; }); };
    const rnd = i => { const x = Math.sin(i*127.1)*43758.5453; return x - Math.floor(x); };
    pods.forEach((pd, j) => {
      const z = (pd.top || 4.52) - 4.52;                                                  // גובה המסד: 4.5 מ' כברירת מחדל, או מהחתך (1909: 6.4 מ')
      pd.roof.forEach(f => { const r = ring2(f); cap(S, r, 4.0+z); cap(pd.kind === 'garden' ? Pv : Rv, r, 4.52+z); });
      const e = ring2(pd.edge); ring(S, e, 3.55+z, 4.52+z);                                  // פס החזית של המסד: קורה לבנה מעל העמודים
      if(pd.kind === 'garden'){ ring(Rl, e, 4.52+z, 5.62+z); e.forEach((a, i) => { const b = e[(i+1)%e.length]; Hd.push(a[0], 5.62+z, -a[1], b[0], 5.62+z, -b[1]); });
        (pd.green||[]).forEach((g, gi) => { const r = ring2(g); cap(Gr, r, 4.98+z); ring(Pl, r, 4.52+z, 4.98+z);
          const xs = r.map(q => q[0]), ys = r.map(q => q[1]);
          for(let i = 0; i < 40; i++){ const x = Math.min(...xs) + rnd(j*97+gi*13+i)*(Math.max(...xs)-Math.min(...xs)), y = Math.min(...ys) + rnd(j*31+gi*7+i+.5)*(Math.max(...ys)-Math.min(...ys));
            let c = false; for(let a = 0, b = r.length-1; a < r.length; b = a++){ const p = r[a], q = r[b]; if((p[1] > y) !== (q[1] > y) && x < (q[0]-p[0])*(y-p[1])/(q[1]-p[1])+p[0]) c = !c; }
            if(c && shrubs.every(s => Math.hypot(s[0]-x, s[1]-y) > 2.6)) shrubs.push([x, y, .7 + rnd(i+gi)*.9, z]); } }); }
    });
    const g = A => { const q = new T.BufferGeometry(); q.setAttribute('position', new T.Float32BufferAttribute(A.pos, 3)); if(A.uv.length) q.setAttribute('uv', new T.Float32BufferAttribute(A.uv, 2)); q.computeVertexNormals(); return q; };
    add('facade', new T.Mesh(g(S), M.std({ color:'#fbfaf6', roughness:.6 })), { cast:true, solid:true });
    add('facade', new T.Mesh(g(Pv), M.std({ color:sc('#d9cfb8'), map:TX.paving, roughness:.85 })), { cast:false, solid:true });
    add('facade', new T.Mesh(g(Rv), M.std({ color:sc('#a29d92'), map:gravelTex(), roughness:1 })), { cast:false, solid:true });
    add('facade', new T.Mesh(g(Gr), M.std({ color:sc('#7aa35a'), map:TX.grass, roughness:1 })), { cast:false, solid:true });
    add('facade', new T.Mesh(g(Pl), M.std({ color:sc('#bdb3a0'), roughness:.8 })), { cast:true, solid:true });
    add('facade', new T.Mesh(g(Rl), new T.MeshStandardMaterial({ color:'#cfe6ef', transparent:true, opacity:.32, roughness:.04, metalness:.5, side:T.DoubleSide, depthWrite:false })), { noReceive:true });
    { const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(Hd, 3)); add('facade', new T.LineSegments(lg, new T.LineBasicMaterial({ color:'#2e3135' }))); }
    inst('facade', new T.IcosahedronGeometry(1, 1), M.std({ color:sc('#4f7f3a'), roughness:.95 }), shrubs, (d, q) => { d.position.set(q[0], 4.98 + (q[3]||0) + q[2]*.8, -q[1]); d.scale.set(q[2], q[2]*.85, q[2]); });
  }
  /** לילה: חלונות מוארים (כמחצית, בגוונים חמים), כמו בתמונה של העיר בערב */
  function setNight(on){ nightOn = on; nightObjs.forEach(o => o.visible = on); }
  /** חתך קומה: 0 = כל הבניין */
  function applyCut(){
    if(!real) return; cutObj.forEach(o => { o.parent && o.parent.remove(o); o.geometry && o.geometry.dispose(); }); cutObj = [];
    const pocheM = new T.MeshBasicMaterial({ color:'#1f1f22', side:T.DoubleSide }), sideM = M.std({ color:'#fbfaf7', roughness:.9 });
    real.forEach(({ b, ms, ends, sp, plan }) => {
      const n = b.floors.length, k = cut ? Math.min(cut, n) : n;
      const range = (m, e) => m.geometry.setDrawRange(0, e);
      range(ms.S, ends.S[k]); range(ms.R, ends.R[k]); range(ms.Hd, ends.Hd[k]);
      for(const kk of ['W', 'G', 'CW', 'F', 'L']) range(ms[kk], ends[kk][cut ? k-1 : k]);
      ms.roof.visible = !cut || cut >= n + 1; ms.equip.forEach(o => o.visible = ms.roof.visible); sp.visible = !cut;
      if(!cut || cut > n) return;
      const f = b.floors[k-1], p = plan(f.plan), top = [], side = [];
      p.walls.forEach(w => { const all = [].concat(...w); let tris = [];      // קיר עם חלל בתוכו: המתאר והחורים
        try{ tris = T.ShapeUtils.triangulateShape(w[0].map(q => new T.Vector2(q[0], q[1])), w.slice(1).map(h => h.map(q => new T.Vector2(q[0], q[1])))); }catch(e){}
        for(const t of tris) for(const i of [t[0], t[2], t[1]]) top.push(all[i][0], f.y + 2.4, -all[i][1]);
        w.forEach(r => r.forEach((a, i) => { const c = r[(i+1)%r.length]; side.push(a[0], f.y, -a[1], c[0], f.y, -c[1], c[0], f.y+2.4, -c[1], a[0], f.y, -a[1], c[0], f.y+2.4, -c[1], a[0], f.y+2.4, -a[1]); })); });
      const g1 = new T.BufferGeometry(); g1.setAttribute('position', new T.Float32BufferAttribute(top, 3)); g1.computeVertexNormals();
      const g2 = new T.BufferGeometry(); g2.setAttribute('position', new T.Float32BufferAttribute(side, 3)); g2.computeVertexNormals();
      cutObj.push(add('facade', new T.Mesh(g1, pocheM), { cast:true, solid:true }), add('facade', new T.Mesh(g2, sideM), { cast:true, solid:true }));
    });
    draw();
  }
  function setCut(n){ cut = Math.max(0, n|0); if(facOn && fd && !facBuilt){ facBuilt = true; buildReal(); } applyCut(); applyActive(); }
  function setFacade(on){ facOn = !!on; if(facOn && !facBuilt){ if(fd){ facBuilt = true; buildReal(); } else buildFacades(); } applyActive(); }
  /* קומות המרתף והחניון: מספר הקומות מהוראות התוכנית. המתאר הוא גבול המגרש, וזו הנחה */
  function buildUnder(){
    underBuilt = true; if(!rnData) return; const fl = r => r.flatMap(p => [Math.round(p[0]*10), Math.round(p[1]*10)]);
    const slabM = M.std({ color:'#8d98a6' }), wallM = new T.MeshBasicMaterial({ color:'#5d6b7c', transparent:true, opacity:.22, side:T.DoubleSide, depthWrite:false }), lineM = new T.LineBasicMaterial({ color:'#2f3a48' });
    rnData.lots.filter(l => l.below).forEach(l => { const pc = rnData.parcels.find(p => p.lot === l.lot); if(!pc) return; const r = pc.c.map(locLL), closed = fl(r.concat([r[0]]));
      for(let i = 1; i <= l.below; i++){ add('under', new T.Mesh(flatGeo(T, [['#ffffff', fl(r)]], -3.1*i, 0), slabM)); add('under', new T.LineSegments(lineGeo(T, [closed], -3.1*i + .03), lineM)); }
      add('under', new T.Mesh(ribbonGeo(T, [closed], -3.1*l.below, 3.1*l.below), wallM), { noReceive:true });
      const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.94)'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#1a1a18'; x.font = '600 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      x.fillText(`מגרש ${l.lot} · ${l.below} קומות מרתף`, 256, 50); const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:false })); sp.scale.set(30, 5.6, 1);
      sp.position.set(r.reduce((s2, p) => s2+p[0], 0)/r.length, 6, -r.reduce((s2, p) => s2+p[1], 0)/r.length); add('under', sp); });
  }
  const FLAT = ['asphalt','brt','ramp','paving','bike','play','deck','green','firemark','rnParcel'];
  function setUnder(on){ underOn = !!on; if(underOn && !underBuilt) buildUnder();
    FLAT.forEach(k => groups[k] && groups[k].traverse(x => { const m = x.userData.mat; if(!x.isMesh || !m) return; if(m.userData.op == null){ m.userData.op = m.opacity; m.userData.tr = m.transparent; }
      m.transparent = underOn || m.userData.tr; m.opacity = underOn ? .16 : m.userData.op; m.depthWrite = !underOn; m.needsUpdate = true; }));
    updGround(); applyActive(); }
  function setRenewal(rn){
    rnData = rn;
    const loc = c => { const [E, N] = wgs2itm(c[1], c[0]); return [E-model.e0, N-model.n0]; }, fl = r => r.flatMap(p => [Math.round(p[0]*10), Math.round(p[1]*10)]);
    const lots = Object.fromEntries((rn.lots||[]).map(l => [l.lot, l]));
    add('rnParcel', new T.Mesh(flatGeo(T, rn.parcels.map(p => [(ZONES[p.cat]||ZONES.road)[1], fl(p.c.map(loc))]), .02, 1), M.std({ vertexColors:true, transparent:true, opacity:.92 })));
    add('rnParcel', new T.LineSegments(lineGeo(T, rn.parcels.map(p => { const r = p.c.map(loc); return fl(r.concat([r[0]])); }), .06), new T.LineBasicMaterial({ color:'#3a3a3a' })));
    const edge = new T.LineBasicMaterial({ color:'#2b2b2b', transparent:true, opacity:.45 }), envEdge = new T.LineBasicMaterial({ color:'#5b6470' });
    (rn.massing||[]).forEach(f => {
      const r = f.c.map(loc), lot = lots[f.lot] || {}, closed = fl(r.concat([r[0]]));
      if(f.kind==='envelope'){
        add('rnEnvelope', new T.Mesh(extrudeGeo(T, [r], f.base, f.top-f.base), new T.MeshBasicMaterial({ color:'#ffffff', transparent:true, opacity:.16, side:T.DoubleSide, depthWrite:false })), { noReceive:true });
        const pos = []; r.forEach(p => pos.push(p[0], f.base, -p[1], p[0], f.top, -p[1])); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        add('rnEnvelope', new T.LineSegments(g, envEdge)); add('rnEnvelope', new T.LineSegments(lineGeo(T, [closed], f.top), envEdge)); return; }
      add('rnMass', new T.Mesh(extrudeGeo(T, [r], f.base, f.top-f.base), M.std({ color:(ZONES[f.cat]||ZONES.residential)[1], roughness:.75 })), { cast:true, solid:true });
      // קווי הקומות: גובה קומה לפי הגובה המרבי חלקי מספר הקומות בטבלה 5
      const fh = lot.floors ? (lot.height || f.top) / lot.floors : 3.3, lines = []; for(let y = f.base + fh; y < f.top - .2; y += fh) lines.push(y);
      const pos = []; lines.forEach(y => { for(let i = 0; i < r.length; i++){ const a = r[i], b = r[(i+1)%r.length]; pos.push(a[0], y, -a[1], b[0], y, -b[1]); } });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); add('rnMass', new T.LineSegments(g, edge));
      if(f.kind==='tower'){ const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.94)'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#1a1a18'; x.font = '600 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
        x.fillText(`מגרש ${f.lot} · ${lot.floors||''} קומות`, 256, 50); const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:false })); sp.scale.set(34, 6.4, 1);
        sp.position.set(r.reduce((s, p) => s+p[0], 0)/r.length, f.top + 7, -r.reduce((s, p) => s+p[1], 0)/r.length); add('rnMass', sp); }
    });
    (rn.demolish||[]).forEach(d => add('exBuild', new T.Mesh(extrudeGeo(T, [d.c.map(loc)], 0, d.h || 13), M.std({ color:KIND.exBuild.color })), { cast:true, solid:true }));
    applyActive();
  }

  /* ── מפלסים (layers/<תיק>/levels.json, tools/extract-levels.py, ענת 24.11.2026) ──
     פני הקרקע לפי הרומים: כל משטח, קו ועצם עולים לגובה הקרקע במקומם. בניין עולה כגוש אחד, במפלס 0.00 שלו.
     רמפה לחניון: רצפה שיורדת מהפתח בשיפוע שבתוכנית, קירות תמך ומעקה, ובסוף פתח למרתף תחת תקרה. */
  const inRing = (x, y, r) => { let c = false; for(let i = 0, j = r.length-1; i < r.length; j = i++){ const a = r[i], b = r[j]; if((a[1] > y) !== (b[1] > y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) c = !c; } return c; };
  const RIGID = new Set(['facade', 'rnMass', 'rnEnvelope', 'exBuild', 'under']);
  function hAt(x, y){ if(!LV) return 0; const i = Math.max(0, Math.min(LV.nx-1.001, (x-LV.x0)/LV.res)), j = Math.max(0, Math.min(LV.ny-1.001, (y-LV.y0)/LV.res)), i0 = Math.floor(i), j0 = Math.floor(j), fi = i-i0, fj = j-j0, h = LV.h, n = LV.nx;
    return ((h[j0*n+i0]*(1-fi) + h[j0*n+i0+1]*fi)*(1-fj) + (h[(j0+1)*n+i0]*(1-fi) + h[(j0+1)*n+i0+1]*fi)*fj)/100; }
  const _v = new T.Vector3(), _m = new T.Matrix4(), _p = new T.Vector3(), _q = new T.Quaternion(), _s = new T.Vector3();
  function lift(obj, kind){
    obj.traverse(o => {
      if(o.userData.lifted) return; o.userData.lifted = true; if(o.userData.noLift) return;
      o.updateMatrixWorld(true);
      if(o.isSprite){ o.getWorldPosition(_v); o.position.y += hAt(_v.x, -_v.z); return; }
      if(o.isInstancedMesh){ for(let i = 0; i < o.count; i++){ o.getMatrixAt(i, _m); _m.decompose(_p, _q, _s); _p.y += hAt(_p.x, -_p.z); _m.compose(_p, _q, _s); o.setMatrixAt(i, _m); } o.instanceMatrix.needsUpdate = true; return; }
      if(!(o.isMesh || o.isLine || o.isLineSegments) || !o.geometry || !o.geometry.attributes.position) return;
      const rigid = RIGID.has(kind) && o.userData.liftMode !== 'vertex';
      if(rigid){ o.geometry.computeBoundingBox(); o.geometry.boundingBox.getCenter(_v).applyMatrix4(o.matrixWorld); o.position.y += hAt(_v.x, -_v.z); return; }
      const pa = o.geometry.attributes.position, mw = o.matrixWorld;
      for(let i = 0; i < pa.count; i++){ _v.fromBufferAttribute(pa, i).applyMatrix4(mw); pa.setY(i, pa.getY(i) + hAt(_v.x, -_v.z)); }
      if(o.isLineSegments && LVr.length) for(let i = 0; i + 1 < pa.count; i += 2){ _v.fromBufferAttribute(pa, i).add(_p.fromBufferAttribute(pa, i+1)).multiplyScalar(.5);   // קו שחוצה רמפה מוסתר: הוא היה מרחף מעל החפירה
        if(LVr.some(r => inRing(_v.x, -_v.z, r))){ pa.setXYZ(i+1, pa.getX(i), pa.getY(i), pa.getZ(i)); } }
      pa.needsUpdate = true; o.geometry.computeBoundingSphere(); o.geometry.computeBoundingBox(); });
  }
  function setLevels(lv){
    if(!lv || LV) return; LV = lv;
    const sc = h => new T.Color(h).convertSRGBToLinear(), r2 = f => ring2(f), inP = (x, y, r) => { let c = false; for(let i = 0, j = r.length-1; i < r.length; j = i++){ const a = r[i], b = r[j]; if((a[1] > y) !== (b[1] > y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) c = !c; } return c; };
    const ramps = (lv.ramps||[]).map(r => ({ ...r, ring:r2(r.poly), e0:[r.e0[0]/10, r.e0[1]/10] }));
    LVr = ramps.map(r => r.ring);
    { let mn = 0; for(const v of lv.h) mn = Math.min(mn, v/100); shadowCatch.position.y = mn - .15; }   // קולט הצל מתחת לקרקע הנמוכה
    // 1. כל מה שכבר נבנה עולה לגובה הקרקע
    for(const k in groups) groups[k].children.slice().forEach(o => lift(o, k));
    const nearRing = (x, y, r, d) => r.some((a, i) => { const b = r[(i+1)%r.length], vx = b[0]-a[0], vy = b[1]-a[1], l = vx*vx+vy*vy || 1e-9, t = Math.max(0, Math.min(1, ((x-a[0])*vx+(y-a[1])*vy)/l)); return Math.hypot(x-a[0]-t*vx, y-a[1]-t*vy) < d; });
    // 2. בסיס קרקע: רשת לפי הרומים, עם חור ברמפות ושוליים שיורדים לרקע
    { const pos = [], n = lv.nx, H = (i, j) => lv.h[j*n+i]/100 - .03, X = i => lv.x0 + i*lv.res, Y = j => lv.y0 + j*lv.res;
      for(let j = 0; j < lv.ny-1; j++) for(let i = 0; i < n-1; i++){
        const cx = X(i) + lv.res/2, cy = Y(j) + lv.res/2; if(ramps.some(r => inP(cx, cy, r.ring) || nearRing(cx, cy, r.ring, 1.6))) continue;   // ליד רמפה: השוליים שלה סוגרים
        pos.push(X(i), H(i, j), -Y(j), X(i+1), H(i+1, j), -Y(j), X(i+1), H(i+1, j+1), -Y(j+1), X(i), H(i, j), -Y(j), X(i+1), H(i+1, j+1), -Y(j+1), X(i), H(i, j+1), -Y(j+1)); }
      const edge = (a, b) => pos.push(a[0], a[1], -a[2], b[0], b[1], -b[2], b[0], -.06, -b[2], a[0], a[1], -a[2], b[0], -.06, -b[2], a[0], -.06, -a[2]);
      for(let i = 0; i < n-1; i++){ edge([X(i), H(i, 0), Y(0)], [X(i+1), H(i+1, 0), Y(0)]); edge([X(i), H(i, lv.ny-1), Y(lv.ny-1)], [X(i+1), H(i+1, lv.ny-1), Y(lv.ny-1)]); }
      for(let j = 0; j < lv.ny-1; j++){ edge([X(0), H(0, j), Y(j)], [X(0), H(0, j+1), Y(j+1)]); edge([X(n-1), H(n-1, j), Y(j)], [X(n-1), H(n-1, j+1), Y(j+1)]); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      terrainM = new T.Mesh(g, M.std({ color:'#cfcabd', roughness:1 })); terrainM.receiveShadow = true; scene.add(terrainM); }
    // 3. רמפות לחניון
    const rampSurf = groups.ramp; if(rampSurf) rampSurf.children.forEach(o => { if(o.isMesh) o.visible = false; });   // המשטח השטוח של השרטוט מוחלף ברמפה עצמה
    const floorM = M.std({ color:sc('#5d5e62'), map:TX.asphalt, roughness:.95 }), wallM = M.std({ color:sc('#bdb7ac'), roughness:.9 }), capM = M.std({ color:sc('#d7d1c4'), roughness:.8 });
    floorM.userData.role = 'rampFloor'; wallM.userData.role = 'rampWall'; capM.userData.role = 'rampCap';   // לגימור בהדמיה (plans-real.js)
    const darkM = new T.MeshBasicMaterial({ color:'#16171a', side:T.DoubleSide }), paintM = new T.LineBasicMaterial({ color:'#f4f1e6' }), railM = new T.LineBasicMaterial({ color:'#3a3d42' });
    ramps.forEach(r => {
      const g0 = hAt(r.e0[0], r.e0[1]), sOf = (x, y) => Math.max(0, Math.min(r.len, (x-r.e0[0])*r.u[0] + (y-r.e0[1])*r.u[1]));
      const drop = s => s <= 2 ? 0 : s <= 5.5 ? (s-2)*r.slope/2 : 3.5*r.slope/2 + (s-5.5)*r.slope, fy = (x, y) => g0 - drop(sOf(x, y));
      const F = [], W = [], C = [], K = [], Rl = [], Pt = [];
      const Ap = []; for(let i = 0; i < (r.apron||[]).length; i += 6){ const p = [0, 2, 4].map(k => [r.apron[i+k]/10, r.apron[i+k+1]/10]); for(const q of [p[0], p[2], p[1]]) Ap.push(q[0], hAt(q[0], q[1]) - .015, -q[1]); }
      for(let i = 0; i < r.tris.length; i += 6){ const p = [[r.tris[i], r.tris[i+1]], [r.tris[i+2], r.tris[i+3]], [r.tris[i+4], r.tris[i+5]]].map(q => [q[0]/10, q[1]/10]);
        for(const q of [p[0], p[2], p[1]]) F.push(q[0], fy(q[0], q[1]) + .02, -q[1]); }
      // קירות תמך: מהרצפה עד פני הקרקע, ומעליהם מעקה בטון של מטר, רק איפה שהרמפה עמוקה
      r.wall.forEach(w => { for(let i = 0; i + 3 < w.length; i += 2){ const ax = w[i]/10, ay = w[i+1]/10, bx = w[i+2]/10, by = w[i+3]/10;
        const fa = fy(ax, ay), fb = fy(bx, by), ga = hAt(ax, ay), gb = hAt(bx, by), deep = g0 - Math.min(fa, fb) > .25, sa = sOf(ax, ay), cov = sa >= r.cover;
        W.push(ax, fa, -ay, bx, fb, -by, bx, gb, -by, ax, fa, -ay, bx, gb, -by, ax, ga, -ay);
        if(deep && !cov){ W.push(ax, ga, -ay, bx, gb, -by, bx, gb + 1, -by, ax, ga, -ay, bx, gb + 1, -by, ax, ga + 1, -ay); Rl.push(ax, ga + 1.02, -ay, bx, gb + 1.02, -by); } } });
      // תקרה מעל הקטע העמוק, ופתח כהה אל המרתף בסוף
      for(let i = 0; i < r.cover_tris.length; i += 6){ const p = [[r.cover_tris[i], r.cover_tris[i+1]], [r.cover_tris[i+2], r.cover_tris[i+3]], [r.cover_tris[i+4], r.cover_tris[i+5]]].map(q => [q[0]/10, q[1]/10]);
        for(const q of [p[0], p[2], p[1]]) C.push(q[0], hAt(q[0], q[1]) + .04, -q[1]); for(const q of [p[0], p[1], p[2]]) C.push(q[0], hAt(q[0], q[1]) - .4, -q[1]); }
      { const f = r.far.map(v => v/10), fa = fy(f[0], f[1]), fb = fy(f[2], f[3]);
        K.push(f[0], fa, -f[1], f[2], fb, -f[3], f[2], hAt(f[2], f[3]) - .4, -f[3], f[0], fa, -f[1], f[2], hAt(f[2], f[3]) - .4, -f[3], f[0], hAt(f[0], f[1]) - .4, -f[1]); }
      // חצים לבנים על הרצפה, בכיוון הירידה
      [.35, .7].forEach(t => { const s = r.len*t, cx = r.e0[0] + r.u[0]*s, cy = r.e0[1] + r.u[1]*s, nx = -r.u[1], ny = r.u[0], tip = [cx + r.u[0]*1.2, cy + r.u[1]*1.2];
        for(const sd of [-1, 1]){ const b = [cx + nx*sd*.9, cy + ny*sd*.9]; Pt.push(b[0], fy(b[0], b[1]) + .05, -b[1], tip[0], fy(tip[0], tip[1]) + .05, -tip[1]); }
        const tail = [cx - r.u[0]*1.6, cy - r.u[1]*1.6]; Pt.push(tail[0], fy(tail[0], tail[1]) + .05, -tail[1], tip[0], fy(tip[0], tip[1]) + .05, -tip[1]); });
      const geo = (a, line) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(a, 3)); if(!line){ const uv = []; for(let i = 0; i < a.length; i += 3) uv.push(a[i], a[i+2]); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); } return g; };
      const mk = (o, opt) => { o.userData.lifted = true; return add('ramp', o, opt); };
      if(Ap.length) mk(new T.Mesh(geo(Ap), M.std({ color:sc('#d8d2c2'), map:TX.paving, roughness:.9 })), { solid:true });
      mk(new T.Mesh(geo(F), floorM), { solid:true }); mk(new T.Mesh(geo(W), wallM), { cast:true, solid:true }); if(C.length) mk(new T.Mesh(geo(C), capM), { cast:true, solid:true });
      mk(new T.Mesh(geo(K), darkM)); { const ar = new T.LineSegments(geo(Pt, true), paintM); ar.userData.keep = true; mk(ar); } if(Rl.length){ const rr = new T.LineSegments(geo(Rl, true), railM); rr.userData.keep = true; mk(rr); }
      // שלט: שיפוע ועומק
      const c = document.createElement('canvas'); c.width = 600; c.height = 92; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.94)'; x.fillRect(0, 0, 600, 92);
      x.fillStyle = '#1a1a18'; x.font = '600 38px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      x.fillText(`רמפה לחניון · ${Math.round(r.slope*100)}% · עומק ${r.depth.toFixed(1)} מ'`, 300, 48);
      const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:false })); sp.scale.set(9, 1.4, 1);
      const m0 = [r.e0[0] - r.u[0]*2, r.e0[1] - r.u[1]*2]; sp.position.set(m0[0], g0 + 3.2, -m0[1]); mk(sp, {});   // השלט בפתח הרמפה, מעל המדרכה
    });
    // 4. מדרגות בפיתוח: גרם לפי קווי השלח, מהקרקע הנמוכה לגבוהה. רום כל שלח לפי פני הקרקע בשני הקצוות
    { const stM = M.std({ color:sc('#cfc6b4'), roughness:.85 }), A = []; stM.userData.role = 'stairs';
      (lv.flights||[]).forEach(f => { const a = [f.a[0]/10, f.a[1]/10], b = [f.b[0]/10, f.b[1]/10], za = hAt(...a), zb = hAt(...b), up = zb >= za, lo = up ? a : b, hi = up ? b : a, z0 = Math.min(za, zb), z1 = Math.max(za, zb, z0 + .15*f.n);
        const ux = hi[0]-lo[0], uy = hi[1]-lo[1], L = Math.hypot(ux, uy) || 1, nx = -uy/L*f.w/2, ny = ux/L*f.w/2, rise = (z1-z0)/f.n;
        for(let k = 0; k < f.n; k++){ const t0 = k/f.n, t1 = (k+1)/f.n, p0 = [lo[0]+ux*t0, lo[1]+uy*t0], p1 = [lo[0]+ux*t1, lo[1]+uy*t1], y = z0 + rise*(k+1);
          const r = [[p0[0]-nx, p0[1]-ny], [p1[0]-nx, p1[1]-ny], [p1[0]+nx, p1[1]+ny], [p0[0]+nx, p0[1]+ny]];
          [[0, 1, 2], [0, 2, 3]].forEach(t => t.forEach(i => A.push(r[i][0], y, -r[i][1])));
          r.forEach((q, i) => { const w = r[(i+1)%4]; A.push(q[0], z0, -q[1], w[0], z0, -w[1], w[0], y, -w[1], q[0], z0, -q[1], w[0], y, -w[1], q[0], y, -q[1]); }); } });
      if(A.length){ const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(A, 3)); g.computeVertexNormals(); const o = new T.Mesh(g, stM); o.userData.lifted = true; add('stairs', o, { cast:true, solid:true }); } }
    // 5. כניסה בלי חיבור: עמוד אדום בגובה ההפרש ליד הכניסה, ושלט. מה שחסר בתוכנית נראה במקום
    (lv.checks||[]).filter(c => !c.link && c.at && Math.abs(c.dz) >= .15).forEach(c => { const x = c.at[0], y = c.at[1], top = hAt(x, y), bot = top - Math.abs(c.dz);
      const post = new T.Mesh(new T.CylinderGeometry(.12, .12, Math.abs(c.dz) + .02, 12), new T.MeshBasicMaterial({ color:'#c8202a' })); post.position.set(x, (top+bot)/2, -y); post.userData.lifted = true; add('spot', post);
      const ring = new T.Mesh(new T.RingGeometry(.9, 1.15, 32), new T.MeshBasicMaterial({ color:'#c8202a', side:T.DoubleSide, transparent:true, opacity:.85, depthWrite:false })); ring.rotation.x = -Math.PI/2; ring.position.set(x, top + .06, -y); ring.userData.lifted = true; add('spot', ring);
      const cv = document.createElement('canvas'); cv.width = 520; cv.height = 92; const q = cv.getContext('2d'); q.fillStyle = 'rgba(255,255,255,.95)'; q.fillRect(0, 0, 520, 92); q.fillStyle = '#c8202a'; q.fillRect(0, 0, 10, 92);
      q.fillStyle = '#1a1a18'; q.font = '600 34px sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.direction = 'rtl'; q.fillText(`הפרש ${Math.abs(c.dz).toFixed(2)} מ' · אין חיבור בפיתוח`, 265, 48);
      const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(cv), depthTest:false })); sp.scale.set(8, 1.42, 1); sp.position.set(x, top + 2.6, -y); sp.userData.lifted = true; add('spot', sp, {}); });
    // 6. רומים שנקראו מהמצגת (רומים מתוכנית ההעמדה כבר מוצגים מהמודל)
    (lv.spots||[]).filter(t => !/model\.json/.test(t.src||'')).forEach(t => { const c = document.createElement('canvas'); c.width = 170; c.height = 44; const x = c.getContext('2d');
      x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(0, 0, 170, 44); x.fillStyle = t.kind === 'ffl' ? '#1a1a18' : '#0b6b3a'; x.font = 'bold 26px IBM Plex Sans, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText((t.kind === 'ffl' ? '±0.00=' : '') + t.z.toFixed(2), 85, 24); const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:false }));
      sp.scale.set(t.kind === 'ffl' ? 5.4 : 4.4, 1.2, 1); sp.position.set(t.at[0], (t.z - lv.datum) + (t.kind === 'ffl' ? 5.4 : 1.6), -t.at[1]); sp.userData.lifted = true; add('spot', sp, {}); });
    applyActive(); updGround();
  }

  // מצלמה
  const [bx0, by0, bx1, by1] = model.bbox;
  /** מבט אל רמפה: מעל המדרכה שמול הפתח, אל תוך הירידה */
  function viewRamp(i){ if(!LV || !LV.ramps || !LV.ramps.length) return; const r = LV.ramps[((i|0) % LV.ramps.length + LV.ramps.length) % LV.ramps.length], e = [r.e0[0]/10, r.e0[1]/10], g = hAt(e[0], e[1]);
    const m = [e[0] + r.u[0]*r.len*.5, e[1] + r.u[1]*r.len*.5], side = [-r.u[1], r.u[0]], D = Math.max(16, r.len*.8);
    // מהצד, מלמעלה: רואים את כל הירידה ואת השיפוע. בוחרים את הצד שאין בו בניין קרוב
    const free = sd => { const p = [m[0] + side[0]*sd*D*.6, m[1] + side[1]*sd*D*.6]; return !(model.foot||[]).some(f => inRing(p[0], p[1], ring2(f))); }, sd = free(1) ? 1 : -1;
    cam.position.set(m[0] + side[0]*sd*D*.75 - r.u[0]*D*.35, g + D*.7, -(m[1] + side[1]*sd*D*.75 - r.u[1]*D*.35)); ctl.target.set(m[0], g - r.depth*.5, -m[1]); ctl.update(); draw(); }
  function view(name){
    const R = Math.max(bx1-bx0, by1-by0);
    if(name==='top'){ cam.position.set(0, R*1.7, 0.01); ctl.target.set(0, 0, 0); }
    else if(name==='eye'){ // גובה עיניים: עומדים על הריצוף הקרוב למרכז, ומביטים צפונה לאורך המגרש
      const obs = [].concat(O.treeNew||[], O.treeOld||[], O.lamp||[], (O.bench||[]).map(b => [b[0], b[1]]));
      (S.wall||[]).forEach(p => obs.push([p[1][0]/10, p[1][1]/10])); (L.lowwall||[]).forEach(f => { for(let i = 0; i < f.length; i += 6) obs.push([f[i]/10, f[i+1]/10]); });
      let best = [0, 0], bs = -1;
      (S.paving||[]).forEach(p => { const r = ring2(p[1]), cx = r.reduce((s, q) => s+q[0], 0)/r.length, cy = r.reduce((s, q) => s+q[1], 0)/r.length; if(Math.hypot(cx, cy) > 70) return;
        let d = 14; for(const o of obs){ const dd = Math.hypot(o[0]-cx, o[1]-cy); if(dd < d) d = dd; } if(d > bs){ bs = d; best = [cx, cy]; } });
      const dl = Math.hypot(best[0], best[1]) || 1;
      cam.position.set(best[0], 1.65, -best[1]); ctl.target.set(best[0] - best[0]/dl*25, 2.2, -best[1] + best[1]/dl*25); }
    else { cam.position.set(-R*.8, R*.72, R*1.0); ctl.target.set(15, 30, 0); }   // אותו מבט בכל המצבים, רחוק מספיק לנפחים הגבוהים
    ctl.update(); draw();
  }

  /* ── הדמיה (ענת, 24.11.2026: "גימור ראליסטי למבנים ולסביבה, כמו הדמיה של יזם ללקוח") ──
     מסתירה את כל השכבות הטכניות (קו כחול, סימוני כיבוי, צנרת, שלטים וקווי מתאר), מציגה את כל התחומים בצבע,
     ומוסיפה שמיים ואובך, ופילטר צבע (רוויה, ניגודיות ווינייטה) ב-CSS. צל מגע (SAO) ועיבוד תמונה נוסו: הילות שחורות ושטיפה לבנה בכרטיסי מסך חלשים, ולכן הוסרו. */
  let renderOn = false, fxBuilt = false, sky = null; const composer = null;
  const RENDER_HIDE = new Set(['plot', 'waterNew', 'sewerNew', 'meter', 'lots', 'bline', 'fireroute', 'firemark', 'fire', 'treeSurvey', 'water', 'sewer', 'drain', 'gas', 'cover', 'cabinet', 'spot', 'rnEnvelope', 'stairs', 'parking', 'mass', 'bldline', 'phase', 'radius', 'easement', 'exSurvey']);
  function buildFx(){
    fxBuilt = true;
    // שמיים: מעבר מכחול בזנית לאובך בהיר באופק, והילה סביב השמש. בצבעים ליניאריים, כי הם עוברים את מחשבת הצבע
    const lc = h => new T.Color(h);   // בלי מחשבת צבע: הצבע יוצא כמו שהוא
    sky = new T.Mesh(new T.SphereGeometry(2400, 32, 16), new T.ShaderMaterial({ side:T.BackSide, depthWrite:false, fog:false,
      uniforms:{ gnd:{ value:lc('#d4d9db') }, top:{ value:lc('#5d93c9') }, mid:{ value:lc('#a9c8e2') }, hor:{ value:lc('#e6ecef') }, sunDir:{ value:new T.Vector3(0, 1, 0) }, sunCol:{ value:lc('#fff2d6') } },
      vertexShader:'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
      fragmentShader:`uniform vec3 gnd, top, mid, hor, sunDir, sunCol; varying vec3 vD;
        void main(){ float h = max(vD.y, 0.0); vec3 c = mix(hor, mid, smoothstep(0.0, 0.12, h)); c = mix(c, top, smoothstep(0.12, 0.6, h));
          float s = max(dot(normalize(vD), normalize(sunDir)), 0.0); c += sunCol*(pow(s, 600.0)*6.0 + pow(s, 12.0)*.25); if(vD.y < 0.0) c = mix(hor, gnd, smoothstep(0.0, -0.08, vD.y)); gl_FragColor = vec4(c, 1.0); }` }));
    sky.visible = false; scene.add(sky);
    if(lastSun) skySun(lastSun.v, lastSun.day);
  }
  let lastSun = null;
  /* שמיים לפי גובה השמש: יום, דמדומים (אופק כתום, זנית כחולה עמוקה) ולילה. הגוונים להמחשה */
  const SKY = { day:['#5d93c9', '#a9c8e2', '#e6ecef', '#fff2d6', '#c9d3da', '#d4d9db'], dusk:['#2f4a7e', '#b08a95', '#f2a463', '#ffad5e', '#a99a99', '#34333a'], night:['#060a16', '#0f1830', '#24304a', '#000000', '#161e2e', '#0b0e14'] };   // אחרון: הקרקע מתחת לאופק
  function skySun(v, day){ lastSun = { v:v.clone(), day }; if(!sky) return; const U = sky.material.uniforms; U.sunDir.value.copy(v);
    const alt = Math.asin(Math.max(-1, Math.min(1, v.y)))*180/Math.PI, sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); };
    const t1 = sm(12, 0, alt), t2 = sm(0, -9, alt), c = i => new T.Color(SKY.day[i]).lerp(new T.Color(SKY.dusk[i]), t1).lerp(new T.Color(SKY.night[i]), t2);
    U.top.value.copy(c(0)); U.mid.value.copy(c(1)); U.hor.value.copy(c(2)); U.sunCol.value.copy(c(3)); U.gnd.value.copy(c(5)); if(scene.fog && renderOn) scene.fog.color.copy(c(4));
    if(renderOn) scene.background = c(2); }
  function renderFix(){
    if(!renderOn) return;
    for(const k in groups){ const g = groups[k]; if(state !== 'design') continue;
      if(RENDER_HIDE.has(k) || (rl && realHide.has(k))){ g.visible = false; continue; }
      if(KIND[k] && KIND[k].topic === 'exist' || k === 'rnParcel' || k === 'rnMass' || k === 'under') continue;
      if(k === 'facade' && !facOn) continue;
      if(!kindOff.has(k)) g.visible = true;
      g.traverse(x => { if(x.isMesh && x.userData.mat){ x.material = x.userData.mat; x.castShadow = !!x.userData.solid; } }); }
    // שלטים וקווי מתאר נעלמים: נשאר רק מה שנבנה
    scene.traverse(x => { if(x.isSprite && x !== sunBall && !x.userData.keep) x.visible = false; if((x.isLineSegments || x.isLine) && !x.userData.keep) x.visible = false; });   // בהדמיה אין קווים טכניים: רק מה שנבנה
  }
  function setRender(on){
    renderOn = !!on;
    const go = () => {
      if(renderOn && !fxBuilt) buildFx();
      if(sky) sky.visible = renderOn; sunBall.visible = !renderOn && !!(lastSun && lastSun.day); pathLine.visible = !renderOn;
      scene.fog = renderOn ? new T.Fog('#c9d3da', 700, 2600) : null; if(renderOn && lastSun) skySun(lastSun.v, lastSun.day);
      groups && Object.values(groups).forEach(g => g.traverse(x => { const m = x.material; if(m && m.userData && m.userData.leaf){ m.transparent = !renderOn; m.opacity = renderOn ? 1 : .84; m.needsUpdate = true; } }));
      if(!renderOn) scene.traverse(x => { if((x.isSprite || x.isLineSegments || x.isLine) && !x.userData.keep) x.visible = true; });
      if(rl && rl.setOn) rl.setOn(renderOn); else if(!renderOn && sunArgs) setSun(...sunArgs);
      if(renderOn && state === 'design' && !rl && window.PlanReal){ try{ buildReal2(); }catch(e){ console.warn('real', e); rl = null; } }   // המחשה ראליסטית (plans-real.js)
      if(renderOn && !lifeG && !rl) buildLife(); if(lifeG) lifeG.visible = renderOn && state === 'design'; if(rl) rl.root.visible = renderOn && state === 'design';
      renderer.domElement.classList.toggle('pm-render', renderOn); el.classList.toggle('pm-render-wrap', renderOn);   // פילטר צבע ווינייטה ב-CSS
      applyActive(); draw(); };
    go(); return Promise.resolve();
  }

  /* ── הליכה בגובה העיניים (walk.json, tools/extract-walk.py) ──
     הולכים על רשת השבילים: ↑ הולכים, ↓ מסתובבים, ← → בוחרים פנייה בצומת (או מסובבים את המבט), רווח: הליכה ועצירה בצומת הבא.
     גרירה: הסתכלות סביב, והמבט חוזר לכיוון ההליכה. לחיצה על הקרקע או על המפה הקטנה: הולכים לשם לבד, במסלול הקצר. */
  let WD = null, W = null, WG = null;   // רשת ההליכה, מצב ההולך, והגרף
  function setWalkData(d){ WD = d; WG = null; }
  function graph(){
    if(WG || !WD) return WG; const N = WD.nodes.map(n => [n[0]/10, n[1]/10]);
    const E = WD.edges.map((e, i) => { const p = []; for(let k = 0; k < e.pts.length; k += 2) p.push([e.pts[k]/10, e.pts[k+1]/10]); const c = [0]; for(let k = 1; k < p.length; k++) c.push(c[k-1] + Math.hypot(p[k][0]-p[k-1][0], p[k][1]-p[k-1][1]));
      // הקצה הקרוב לצומת a הוא תחילת הקו
      if(Math.hypot(p[0][0]-N[e.a][0], p[0][1]-N[e.a][1]) > Math.hypot(p[p.length-1][0]-N[e.a][0], p[p.length-1][1]-N[e.a][1])){ p.reverse(); const L = c[c.length-1]; c.reverse(); for(let k = 0; k < c.length; k++) c[k] = L - c[k]; }
      return { i, a:e.a, b:e.b, p, c, L:c[c.length-1] || .01 }; });
    const adj = N.map(() => []); E.forEach(e => { adj[e.a].push({ e:e.i, dir:1 }); adj[e.b].push({ e:e.i, dir:-1 }); });
    return WG = { N, E, adj };
  }
  const at = (e, s) => { s = Math.max(0, Math.min(e.L, s)); let k = 1; while(k < e.c.length-1 && e.c[k] < s) k++; const t = (s - e.c[k-1])/((e.c[k]-e.c[k-1]) || 1); return [e.p[k-1][0] + (e.p[k][0]-e.p[k-1][0])*t, e.p[k-1][1] + (e.p[k][1]-e.p[k-1][1])*t]; };
  function nearest(x, y){ const G = graph(); let best = null;
    G.E.forEach(e => { for(let k = 1; k < e.p.length; k++){ const a = e.p[k-1], b = e.p[k], vx = b[0]-a[0], vy = b[1]-a[1], l = vx*vx+vy*vy || 1e-9, t = Math.max(0, Math.min(1, ((x-a[0])*vx+(y-a[1])*vy)/l)), d = Math.hypot(x-a[0]-t*vx, y-a[1]-t*vy);
      if(!best || d < best.d) best = { e:e.i, s:e.c[k-1] + t*Math.sqrt(l), d }; } }); return best; }
  const angOf = (e, dir, s) => { const a = at(e, s), b = at(e, s + dir*2.5); return Math.atan2(b[1]-a[1], b[0]-a[0]); };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // היציאות מצומת: בלי הקטע שהגענו ממנו. לכל יציאה זווית יחסית לכיוון ההליכה
  function exits(node, fromE, heading){ const G = graph();
    return G.adj[node].filter(o => o.e !== fromE || G.adj[node].length === 1).map(o => { const e = G.E[o.e], s0 = o.dir > 0 ? 0 : e.L; return { ...o, s0, rel:wrap(angOf(e, o.dir, s0) - heading) }; }).sort((p, q) => q.rel - p.rel); }
  const walkM = { arrow:null, sel:null };
  let arrows = null, arrowNode = -1, keyH = null, ptr = null;
  function walkStart(){
    if(!WD) return false; const G = graph(); if(!G.E.length) return false;
    const st0 = (WD.stops||[])[0], sp = st0 ? G.N[st0.n] : null, n = sp ? nearest(sp[0], sp[1]) : nearest(ctl.target.x, -ctl.target.z), e = G.E[n.e], dir = 1;   // מתחילים בכניסה מהרחוב
    W = { e:n.e, s:n.s, dir, yawNow:angOf(e, dir, n.s), yaw:angOf(e, dir, n.s), look:0, pitch:-.04, h:hAt(...at(e, n.s)) + 1.65, fwd:false, auto:false, route:null, pref:0, stopAt:-1, info:'' };
    ctl.enabled = false; cam.fov = 62; cam.near = .15; cam.updateProjectionMatrix(); showTrail(true);
    if(!arrows){ arrows = new T.Group(); scene.add(arrows); walkM.arrow = new T.MeshBasicMaterial({ color:'#ffffff', transparent:true, opacity:.85, depthWrite:false, side:T.DoubleSide }); walkM.sel = new T.MeshBasicMaterial({ color:'#11998e', transparent:true, opacity:.95, depthWrite:false, side:T.DoubleSide }); }
    keyH = ev => { if(!W || /INPUT|TEXTAREA|SELECT/.test((ev.target||{}).tagName||'')) return; const k = ev.key, down = ev.type === 'keydown';
      if(['ArrowUp', 'w', 'W'].includes(k)){ W.fwd = down; if(down) W.route = null; }
      else if(down && ['ArrowDown', 's', 'S'].includes(k)) walkCmd('back');
      else if(down && ['ArrowLeft', 'a', 'A'].includes(k)) walkCmd('left');
      else if(down && ['ArrowRight', 'd', 'D'].includes(k)) walkCmd('right');
      else if(down && k === ' ') walkCmd('go');
      else if(down && k === 'Escape') walkCmd('stop');
      else return; ev.preventDefault(); draw(); };
    window.addEventListener('keydown', keyH); window.addEventListener('keyup', keyH);
    const dom = renderer.domElement;
    ptr = { down:ev => { ptr.p = [ev.clientX, ev.clientY, ev.clientX, ev.clientY]; dom.setPointerCapture(ev.pointerId); },
      move:ev => { if(!ptr.p || !W) return; const dx = ev.clientX - ptr.p[2], dy = ev.clientY - ptr.p[3]; ptr.p[2] = ev.clientX; ptr.p[3] = ev.clientY;
        W.look -= dx*.0045; W.pitch = Math.max(-1.1, Math.min(.9, W.pitch - dy*.0035)); draw(); },
      up:ev => { if(!ptr.p) return; const moved = Math.hypot(ev.clientX - ptr.p[0], ev.clientY - ptr.p[1]); ptr.p = null; if(moved < 6) pick(ev); } };
    dom.addEventListener('pointerdown', ptr.down); dom.addEventListener('pointermove', ptr.move); dom.addEventListener('pointerup', ptr.up);
    dom.classList.add('pm-walk'); setRender(true); draw(); return true;
  }
  /* המסלולים על הקרקע: רצועה בהירה בטורקיז לאורך כל השבילים, ועמוד עם שם בכל תחנה של הסיור. רק בזמן ההליכה */
  let trail = null;
  function showTrail(on){
    if(on && !trail && WD){ const G = graph(), pos = [], w = .28;
      G.E.forEach(e => { for(let k = 1; k < e.p.length; k++){ const a = e.p[k-1], b = e.p[k], L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, nx = -(b[1]-a[1])/L*w, ny = (b[0]-a[0])/L*w, ha = hAt(a[0], a[1]) + .05, hb = hAt(b[0], b[1]) + .05;
        pos.push(a[0]+nx, ha, -(a[1]+ny), b[0]+nx, hb, -(b[1]+ny), b[0]-nx, hb, -(b[1]-ny), a[0]+nx, ha, -(a[1]+ny), b[0]-nx, hb, -(b[1]-ny), a[0]-nx, ha, -(a[1]-ny)); } });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      trail = new T.Group(); const rib = new T.Mesh(g, new T.MeshBasicMaterial({ color:'#19b3a5', transparent:true, opacity:.42, depthWrite:false, side:T.DoubleSide, fog:false })); rib.renderOrder = 4; rib.userData.keep = true; trail.add(rib);
      (WD.stops||[]).forEach((st, i) => { const q = G.N[st.n], h = hAt(q[0], q[1]);
        const pole = new T.Mesh(new T.CylinderGeometry(.04, .04, 2.5, 8), new T.MeshBasicMaterial({ color:'#11998e' })); pole.position.set(q[0], h + 1.25, -q[1]); trail.add(pole);
        const c = document.createElement('canvas'); c.width = 512; c.height = 84; const x = c.getContext('2d'); x.fillStyle = '#11998e'; x.fillRect(0, 0, 512, 84); x.fillStyle = '#fff'; x.font = '600 36px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
        x.fillText(`${i+1}. ${st.name}`, 256, 44); const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:true, fog:false })); sp.scale.set(2.6, .43, 1); sp.position.set(q[0], h + 2.75, -q[1]); sp.userData.keep = true; trail.add(sp); });
      scene.add(trail); }
    if(trail) trail.visible = !!on; draw(); }
  /* אנשים ומכוניות להדמיה (walk.json: על השבילים, בנתיב שליד אבן השפה ובחניות). להמחשה בלבד, לא מהשרטוט */
  let lifeG = null, rl = null; const realHide = new Set(), realCtx = {};
  /* המחשה ראליסטית (plans-real.js): חומרים, ויטרינות ודלתות, עצים, עמודי תאורה, אנשים בתנועה ומכוניות. נבנית פעם אחת, כשמדליקים הדמיה */
  function buildReal2(){ Object.assign(realCtx, { T, scene, model, groups, hAt, graph, walkData:() => WD, hide:ks => ks.forEach(k => realHide.add(k)), ground, terrain:() => terrainM, renderer, sun, hemi, fill, levels:() => LV, mapG, wgs2itm, updGround, resun:() => { if(sunArgs) setSun(...sunArgs); } });
    rl = window.PlanReal.build(realCtx); if(sunState && rl.setTime) rl.setTime(sunState.alt); renderFix(); draw(); }
  function buildLife(){
    if(!WD || !(WD.people || WD.cars)) return; lifeG = new T.Group(); scene.add(lifeG);
    const r = i => { const v = Math.sin(i*91.7)*43758.5453; return v - Math.floor(v); }, col = new T.Color(), o = new T.Object3D();
    const mesh = (geo, mat, n, fill) => { const m = new T.InstancedMesh(geo, mat, n); for(let i = 0; i < n; i++){ fill(o, i, col); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, col); } m.instanceMatrix.needsUpdate = true; if(m.instanceColor) m.instanceColor.needsUpdate = true; m.castShadow = true; m.receiveShadow = true; lifeG.add(m); return m; };
    const P = WD.people || [], TOP = ['#2f4a6d', '#b8483b', '#e8e2d4', '#3e6b4a', '#d9a441', '#6b5b8e', '#f2f2ee', '#262626', '#8a5a44', '#4f8fbf'], LEG = ['#1e2633', '#3b3b3f', '#5a4a3a', '#2b3d5a', '#c9c2b3'], SKIN = ['#f1c9a5', '#d9a77f', '#a8714f', '#6e4a34', '#e8b896'];
    const pm = M.std({ color:'#ffffff', roughness:.85 });
    const place = (o2, p, i, y, k) => { const s = .92 + r(p[3])*.16, x = p[0]/10, z = p[1]/10, h = hAt(x, z); o2.position.set(x, h + y*s, -z); o2.rotation.set(0, p[2] + Math.PI/2, 0); o2.scale.setScalar(s*(k||1)); };
    if(P.length){
      mesh(new T.BoxGeometry(.32, .84, .2), pm, P.length, (o2, i, c) => { place(o2, P[i], i, .42); c.set(LEG[Math.floor(r(P[i][3]+1)*LEG.length)]).convertSRGBToLinear(); });
      mesh(new T.CylinderGeometry(.19, .16, .64, 10), pm, P.length, (o2, i, c) => { place(o2, P[i], i, 1.16); c.set(TOP[Math.floor(r(P[i][3]+2)*TOP.length)]).convertSRGBToLinear(); });
      mesh(new T.SphereGeometry(.115, 12, 10), pm, P.length, (o2, i, c) => { place(o2, P[i], i, 1.6); c.set(SKIN[Math.floor(r(P[i][3]+3)*SKIN.length)]).convertSRGBToLinear(); }); }
    const C = WD.cars || [], CAR = ['#f4f4f2', '#c9ccd1', '#1d1f22', '#5c6168', '#26365a', '#9b2b2b', '#e8e6df', '#3d4a3f'];
    if(C.length){ const cm = M.std({ color:'#ffffff', roughness:.35, metalness:.55, envMapIntensity:1 }), gm = new T.MeshStandardMaterial({ color:'#1b232b', roughness:.08, metalness:.8, envMapIntensity:1.3 }), wm = M.std({ color:'#1a1a1a', roughness:.9 });
      const cp = (o2, c, y, fwd) => { const x = c[0]/10, z = c[1]/10, h = hAt(x, z); o2.position.set(x + Math.cos(c[2])*(fwd||0), h + y, -(z + Math.sin(c[2])*(fwd||0))); o2.rotation.set(0, c[2] + Math.PI/2, 0); o2.scale.set(1, 1, 1); };
      mesh(new T.BoxGeometry(1.8, .66, 4.35), cm, C.length, (o2, i, c) => { cp(o2, C[i], .6); c.set(CAR[Math.floor(r(C[i][3])*CAR.length)]).convertSRGBToLinear(); });
      mesh(new T.BoxGeometry(1.6, .52, 2.2), gm, C.length, (o2, i, c) => { cp(o2, C[i], 1.18, -.25); c.set('#ffffff'); });
      const W4 = []; C.forEach(c => [[-.82, 1.35], [.82, 1.35], [-.82, -1.35], [.82, -1.35]].forEach(q => W4.push([c, q])));
      mesh(new T.CylinderGeometry(.33, .33, .24, 14), wm, W4.length, (o2, i, c) => { const [car, q] = W4[i], x = car[0]/10, z = car[1]/10, h = hAt(x, z), a = car[2];
        const ux = Math.cos(a), uy = Math.sin(a), sx = -uy, sy = ux; o2.position.set(x + ux*q[1] + sx*q[0], h + .33, -(z + uy*q[1] + sy*q[0])); o2.rotation.set(0, a + Math.PI/2, Math.PI/2); o2.scale.set(1, 1, 1); c.set('#ffffff'); }); }
    lifeG.visible = renderOn;
  }
  function walkStop(){ if(!W) return; W = null; if(arrows) arrows.clear(); arrowNode = -1;
    window.removeEventListener('keydown', keyH); window.removeEventListener('keyup', keyH);
    const dom = renderer.domElement; if(ptr){ dom.removeEventListener('pointerdown', ptr.down); dom.removeEventListener('pointermove', ptr.move); dom.removeEventListener('pointerup', ptr.up); }
    dom.classList.remove('pm-walk'); showTrail(false); ctl.enabled = true; cam.fov = 38; cam.near = .5; cam.updateProjectionMatrix(); view('home'); }
  /** פקודה מהמקלדת או מהכפתורים */
  function walkCmd(c){ if(!W) return; const G = graph(), e = G.E[W.e];
    if(c === 'tour'){ if(W.tour){ W.tour = null; W.route = null; draw(); return; } const st = WD.stops||[]; if(!st.length) return;
      // מתחילים מהתחנה הקרובה, וממשיכים לפי הסדר
      const p0 = at(e, W.s); let i0 = 0, bd = 1e9; st.forEach((q, i) => { const d = Math.hypot(G.N[q.n][0]-p0[0], G.N[q.n][1]-p0[1]); if(d < bd){ bd = d; i0 = i; } });
      const stops = st.slice(i0).concat(st.slice(0, i0)), q = G.N[stops[0].n]; walkTo(q[0], q[1]); W.tour = { stops, i:0, wait:3.2 }; draw(); return; }
    if(c !== 'tour' && W.tour && c !== 'fwdUp'){ W.tour = null; }
    if(c === 'fwd'){ W.fwd = true; W.route = null; } else if(c === 'fwdUp') W.fwd = false;
    else if(c === 'stop'){ W.fwd = false; W.auto = false; W.route = null; }
    else if(c === 'go'){ W.auto = !W.auto; W.route = null; W.stopAt = -1; }
    else if(c === 'back'){ W.dir = -W.dir; W.yaw = wrap(W.yaw + Math.PI); W.look = 0; W.route = null; W.pref = 0; }
    else if(c === 'left' || c === 'right'){
      const node = W.dir > 0 ? e.b : e.a, rem = W.dir > 0 ? e.L - W.s : W.s, ex = node >= 0 && rem < 9 ? exits(node, W.e, W.yaw) : [];
      if(ex.length > 1){ W.pref = c === 'left' ? 1 : -1; arrowNode = -1; }                // בצומת: בוחרים יציאה, והחץ שלה נצבע
      else W.look += (c === 'left' ? 1 : -1)*Math.PI/5; }                             // באמצע שביל: מסובבים את המבט
    draw(); }
  /** קפיצה: מעבר מיידי לנקודה על הרשת, בלי הליכה (תחנה במפה הקטנה) */
  function walkJump(x, y){ if(!W) return false; const G = graph(), t = nearest(x, y); if(!t) return false;
    W.e = t.e; W.s = t.s; W.route = null; W.tour = null; W.fwd = false; W.auto = false; W.look = 0; draw(); return true; }
  /** הליכה אוטומטית לנקודה: המסלול הקצר ברשת (דייקסטרה) */
  function walkTo(x, y){ if(!W) return; const G = graph(), t = nearest(x, y); if(!t || t.d > 25) return false;
    const e0 = G.E[W.e], dist = new Map(), prev = new Map(), q = [];
    const push = (n, d, p) => { if(dist.has(n) && dist.get(n) <= d) return; dist.set(n, d); prev.set(n, p); q.push([d, n]); };
    push(e0.a, W.s, null); push(e0.b, e0.L - W.s, null);
    while(q.length){ q.sort((p, r) => p[0]-r[0]); const [d, n] = q.shift(); if(d > dist.get(n)) continue; G.adj[n].forEach(o => { const e = G.E[o.e], m = o.dir > 0 ? e.b : e.a; push(m, d + e.L, { n, e:o.e, dir:o.dir }); }); }
    const et = G.E[t.e], ca = (dist.get(et.a) ?? 1e9) + t.s, cb = (dist.get(et.b) ?? 1e9) + et.L - t.s;
    if(t.e === W.e && Math.abs(t.s - W.s) < Math.min(ca, cb)){ W.route = { steps:[], end:{ e:t.e, s:t.s } }; W.dir = t.s >= W.s ? 1 : -1; }
    else { let n = ca <= cb ? et.a : et.b; if(!Number.isFinite(dist.get(n))) return false; const steps = [];
      while(prev.get(n)){ const p = prev.get(n); steps.unshift({ e:p.e, dir:p.dir }); n = p.n; }
      W.dir = n === e0.b ? 1 : -1; steps.push({ e:t.e, dir:ca <= cb ? 1 : -1 }); W.route = { steps, end:{ e:t.e, s:t.s } }; }
    W.fwd = false; W.auto = false; W.look = 0; W.tour = null; draw(); return true; }
  const ray = new T.Raycaster();
  function pick(ev){ const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera({ x:(ev.clientX-r.left)/r.width*2-1, y:-(ev.clientY-r.top)/r.height*2+1 }, cam);
    const ha = arrows ? ray.intersectObjects(arrows.children, false)[0] : null;
    if(ha){ W.pref = ha.object.userData.rel; W.auto = true; arrowNode = -1; draw(); return; }
    const hits = ray.intersectObjects(scene.children, true).filter(h => h.object.visible && h.object.isMesh && h.object !== sky && h.distance < 400);
    if(hits[0]) walkTo(hits[0].point.x, -hits[0].point.z); }
  function chooseExit(node){ const G = graph(), ex = exits(node, W.e, angOf(G.E[W.e], W.dir, W.dir > 0 ? G.E[W.e].L : 0));
    if(!ex.length) return null; if(ex.length === 1) return ex[0];
    if(W.pref > 0) return ex[0]; if(W.pref < 0) return ex[ex.length-1];               // הכי שמאלה / הכי ימינה
    return ex.slice().sort((p, q) => Math.abs(p.rel) - Math.abs(q.rel))[0]; }          // בלי בחירה: הכי ישר
  function stepWalk(dt){
    if(!W) return false; const G = graph(); let e = G.E[W.e], moved = false;
    const go = W.fwd || W.auto || W.route;
    if(go){ let d = (W.route ? 1.9 : 1.5)*dt; moved = true;
      for(let guard = 0; guard < 6 && d > 0; guard++){
        if(W.route && W.route.steps.length === 0 && W.e === W.route.end.e){ const r = W.route.end.s - W.s; if(Math.abs(r) <= d){ W.s = W.route.end.s; W.route = null; d = 0; break; } W.dir = r > 0 ? 1 : -1; }
        const rem = W.dir > 0 ? e.L - W.s : W.s;
        if(d < rem){ W.s += W.dir*d; d = 0; break; }
        W.s = W.dir > 0 ? e.L : 0; d -= rem; const node = W.dir > 0 ? e.b : e.a;
        let nx = null;
        if(W.route && W.route.steps.length){ const st = W.route.steps.shift(); nx = { e:st.e, dir:st.dir, s0:st.dir > 0 ? 0 : G.E[st.e].L }; if(G.E[st.e].a !== node && G.E[st.e].b !== node) nx = null; }
        if(!nx){ const ex = exits(node, W.e, W.yaw);
          if(!ex.length){ W.fwd = W.auto = false; W.route = null; break; }                // סוף השביל
          if(ex.length > 1 && W.auto && !W.pref && !W.route){ W.auto = false; break; }     // הליכה ברווח נעצרת בצומת, כדי לבחור
          nx = chooseExit(node); W.pref = 0; }
        W.e = nx.e; W.dir = nx.dir; W.s = nx.s0; e = G.E[W.e]; arrowNode = -1; } }
    // המצלמה: על השביל, בגובה העיניים מעל הקרקע, ומביטה קדימה לאורך השביל
    const p = at(e, W.s), target = angOf(e, W.dir, W.s);
    if(go) W.yaw = wrap(W.yaw + wrap(target - W.yaw)*Math.min(1, dt*4));
    if(go) W.look *= Math.exp(-dt*1.6);
    W.yawNow = W.yaw + W.look;
    const hNow = hAt(p[0], p[1]) + 1.65; W.h += (hNow - W.h)*Math.min(1, dt*6);
    cam.position.set(p[0], W.h, -p[1]);
    const cp = Math.cos(W.pitch); cam.lookAt(p[0] + Math.cos(W.yawNow)*cp*10, W.h + Math.sin(W.pitch)*10, -(p[1] + Math.sin(W.yawNow)*cp*10));
    // חצים בצומת הקרוב: לכל יציאה חץ על הקרקע, והנבחרת בטורקיז
    const node = W.dir > 0 ? e.b : e.a, rem = W.dir > 0 ? e.L - W.s : W.s;
    if(arrows){ const ex = rem < 14 ? exits(node, W.e, angOf(e, W.dir, W.dir > 0 ? e.L : 0)) : [];
      const key = ex.length > 1 ? node*10 + (W.pref + 1) : -1;
      if(key !== arrowNode){ arrowNode = key; arrows.clear();
        if(ex.length > 1){ const sel = chooseExit(node), shape = new T.Shape([[0, -.35], [1.3, -.35], [1.3, -.75], [2.3, 0], [1.3, .75], [1.3, .35], [0, .35]].map(q => new T.Vector2(q[0], q[1]))), geo = new T.ShapeGeometry(shape);
          ex.forEach(o => { const E2 = G.E[o.e], a = at(E2, o.s0), b = at(E2, o.s0 + o.dir*3.2), ang = Math.atan2(b[1]-a[1], b[0]-a[0]), m = new T.Mesh(geo, sel && sel.e === o.e ? walkM.sel : walkM.arrow);
            m.rotation.set(-Math.PI/2, 0, ang); m.position.set(a[0] + Math.cos(ang)*1.2, hAt(a[0], a[1]) + .06, -(a[1] + Math.sin(ang)*1.2)); m.userData.rel = o.rel > .35 ? 1 : o.rel < -.35 ? -1 : 0; m.renderOrder = 5; arrows.add(m); }); } } }
    // איפה אני: בתוך בניין, בגינה, או ליד הבניין הקרוב
    let info = ''; for(const z of WD.zones||[]){ if(!z._r) z._r = ring2(z.poly); if(inRing(p[0], p[1], z._r)){ info = z.kind === 'in' ? 'בתוך ' + z.name : 'ב' + z.name; break; } }
    if(!info){ let bd = 14; (WD.zones||[]).filter(z => z.kind === 'in').forEach(z => { const r = z._r || (z._r = ring2(z.poly));
      r.forEach((a, i) => { const q = r[(i+1)%r.length], vx = q[0]-a[0], vy = q[1]-a[1], l = vx*vx+vy*vy || 1e-9, t = Math.max(0, Math.min(1, ((p[0]-a[0])*vx+(p[1]-a[1])*vy)/l)), dd = Math.hypot(p[0]-a[0]-t*vx, p[1]-a[1]-t*vy);
        if(dd < bd){ bd = dd; info = 'ליד ' + z.name; } }); }); }
    if(!info) info = 'על השביל';
    // סיור מודרך: בכל תחנה עוצרים, מסתכלים סביב לאט, וממשיכים לתחנה הבאה
    let tourOn = false;
    if(W.tour){ tourOn = true; const T2 = W.tour;
      if(!W.route && !W.fwd){ T2.wait -= dt; W.look += dt*.45;
        if(T2.wait <= 0){ T2.i++; if(T2.i >= T2.stops.length){ W.tour = null; } else { const q = G.N[T2.stops[T2.i].n]; walkTo(q[0], q[1]); W.tour = T2; T2.wait = 3.2; } } } }
    const tinfo = W.tour ? `תחנה ${W.tour.i + 1} מתוך ${W.tour.stops.length}: ${W.tour.stops[W.tour.i].name}` : '';
    if(opts && opts.onWalk) opts.onWalk({ x:p[0], y:p[1], yaw:W.yawNow, info, tour:tinfo, moving:!!go || tourOn, junction:!W.tour && rem < 14 && exits(node, W.e, W.yaw).length > 1 });
    return go || tourOn || Math.abs(W.look) > .002 || Math.abs(hNow - W.h) > .01;
  }

  // ציור לפי צורך
  let raf = 0, last = 0, dead = false;
  function frame(t){ raf = 0; if(dead) return; const raw = (t-last)/1000 || 0, dt = Math.min(.1, raw); last = t; stepWind(dt); const walking = stepWalk(Math.min(.3, raw)), moving = W ? false : ctl.update(), lifeOn = !!(rl && rl.root.visible && realCtx.stepLife);
    if(lifeOn) realCtx.stepLife(Math.min(.25, raw), cam.position.x, -cam.position.z, !!W);   // הליכה לפי הזמן שעבר באמת, גם במחשב איטי
    renderer.render(scene, cam);
    if(opts && opts.onCamera) opts.onCamera(W ? -W.yawNow - Math.PI/2 : Math.atan2(cam.position.x-ctl.target.x, cam.position.z-ctl.target.z));
    if(windDir != null || moving || walking || lifeOn) loop(); }
  function loop(){ if(!raf && !dead) raf = requestAnimationFrame(frame); }
  function draw(){ loop(); }
  ctl.addEventListener('change', draw);
  function resize(){ const r = el.getBoundingClientRect(); if(r.width < 10) return; renderer.setSize(r.width, r.height, false); cam.aspect = r.width/r.height; cam.updateProjectionMatrix(); draw(); }
  resize(); view('home');
  if(window._pmDebug) window._pm = { cam, ctl, draw, groups, walkTo, walkCmd, get W(){ return W; } };       // בדיקה בלבד
  const getCam = () => ({ p:cam.position.toArray().map(v => +v.toFixed(2)), t:ctl.target.toArray().map(v => +v.toFixed(2)) });
  function setCam(v){ if(W) walkStop(); cam.position.fromArray(v.p); ctl.target.fromArray(v.t); ctl.update(); draw(); }
  loadCtx();
  /** מדדי ציור לבדיקת ביצועים (tools/check-work-modes.cjs): קריאות ציור, משולשים, גאומטריות ומרקמים בפריים האחרון */
  function stats(){ const i = renderer.info; return { calls:i.render.calls, triangles:i.render.triangles, geometries:i.memory.geometries, textures:i.memory.textures, programs:(i.programs||[]).length }; }
  return { stats, walkJump, getCam, setCam, setActive, setKind, setSun, setFloors, setWind, setState, setEnvelope, setRenewal, setFacade, setBuildings, setCut, setUnder, setLevels, viewRamp, setRender, setWalkData, walkStart, walkStop, walkCmd, walkTo, view, resize, center, groups,
    setStreets, setMap,
    dispose(){ dead = true; if(stdUI) stdUI.unbind(); walkStop(); cancelAnimationFrame(raf); ctl.dispose(); renderer.dispose(); renderer.domElement.remove(); } };
}

/** טעינת הספרייה התלת־ממדית רק כשצריך */
let loading = null;
function loadThree(){
  if(window.THREE && window.THREE.OrbitControls) return Promise.resolve();
  if(loading) return loading;
  const js = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.head.appendChild(s); });
  return loading = js('vendor/three.min.js').then(() => js('vendor/OrbitControls.js'));
}
const api = { KINDS, KIND, ZONES, STATE_KINDS, create, loadThree, measure, itm2wgs, wgs2itm, sunPos, ilDate };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else window.PlanModel = api;
})();
