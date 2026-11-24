/* ══════════════════════════════════════════════════════════════════
   plans-layers.js: "שכבות". מצב פגישה לבחינת תוכנית הפיתוח, תחום אחרי תחום (ענת, 22-23.11.2026).
   הרעיון: כל יועץ מציג תחום אחד. המסך מציג רק את התחום שלו בתוך המודל, ושאר התוכנית נשארת כצל אפור.
   - מודל: plans-model.js, תלת־ממד ממשי מהגאומטריה של השרטוט, ממוקם על אשדוד, עם שמש, צל ורוח.
   - שרטוט: שכבות השרטוט המקוריות כתמונות שקופות (tools/split-layers.py), להשוואה מול המקור.
   - לכל תחום: מה נמדד בשרטוט, מקרא, הקונספט של היועץ (בהקלטה), והדרישות של הנחיות ההגשה עם הנחיה וסימון "בוצע".
   - הכול נשמר על התוכנית בשדה layerReview.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const SETS = { '1913': { dir:'layers/1913', title:'אחד העם / הרצל: תוכנית פיתוח', date:'18.11.2026', renewal:true },
  /* raster: אין תוכנית פיתוח וקטורית. המודל מתוכנית ההעמדה שבמצגת (תמונה), מעוגן אוטומטית למגרשי התב"ע (tools/siteplan-model.py) */
  '1887': { dir:'layers/1887', title:'הרצל - נאות ספיר: תוכנית העמדה', date:'24.11.2026', renewal:true, raster:true },
  '1911': { dir:'layers/1911', title:'מתחם הרב מימון, רובע ב\': תוכנית העמדה', date:'24.11.2026', renewal:true, raster:true },
  /* תכנון רעיוני: מתשריט התב"ע המוצעת שבמצגת ומההדמיות (tools/concept-model.py, ענת 24.11.2026). אין עדיין תוכנית פיתוח */
  '1909': { dir:'layers/1909', title:'מתחם צפוני, האיצטדיון: תכנון רעיוני', date:'06.07.2026', renewal:true, concept:true } };
window.LAYER_SETS = SETS;          // מקור אחד לרשימת התוכניות שיש להן מודל (גם ל-plans-infra.js)
/* מודלים שהופקו אוטומטית (tools/auto-model.py, ה-Action): layers/index.json. 1913 נשאר בקוד ככיול ידני.
   auto:'approx' = מיקום משוער: אין renewal.json, ולכן אין מעטפת, מצב התחדשות ובדיקת קווי בניין. הכמויות מדויקות. */
const SETS_READY = fetch('layers/index.json?t=' + Date.now()).then(r => r.ok ? r.json() : {}).then(x => { Object.entries(x || {}).forEach(([k, v]) => { if(!SETS[k] && v && v.dir) SETS[k] = v; }); }).catch(() => {});
window.LAYER_SETS_READY = SETS_READY;

/* הדרישות של הנחיות ההגשה, ולכל דרישה: השכבות שמראות אותה */
const TOPICS = [
 { id:'facade', name:'חזיתות וחומריות', color:'var(--ink)',
   items:[ ['שפה אדריכלית אחידה',['build']], ['היררכיה בין בסיס, גוף וסיומת',['build']], ['שילוב מערכות טכניות באופן מוצנע',['build','power']],
     ['חומרי גמר עמידים',['build','walk']], ['מניעת חזרתיות מונוטונית',['build']], ['חזיתות הנצפות מהמרחב הציבורי',['build','road','walk']] ] },
 { id:'move', name:'תנועה, חניה ונגישות', color:'var(--teal)',
   items:[ ['הפרדה בטוחה בין הולכי רגל לרכב',['walk','road','park']], ['רציפות מסלולים נגישים',['walk','level']], ['מיקום כניסות ויציאות',['build','road','park']],
     ['תכנון חניה',['park','build']], ['שבילי אופניים',['bike','road']], ['גישה לרכב חירום ושירות',['fire','road']], ['אזורי פריקה וטעינה',['park','waste']] ] },
 { id:'land', name:'פיתוח, נוף והצללה', color:'#3f7d3a',
   items:[ ['עצים קיימים ומוצעים',['trees']], ['הצללה אפקטיבית',['shade','trees','walk']], ['שטחי חלחול',['green','site']], ['ניהול נגר',['water','green','level']],
     ['אזורי גינון',['green']], ['חומרי ריצוף',['walk']], ['מפלסים',['level','build']], ['חיבור למרחב הציבורי',['walk','road','site']] ] },
 { id:'infra', name:'תשתיות ותפעול', color:'var(--bronze)',
   items:[ ['אשפה',['waste','build']], ['חדרים טכניים',['build','power']], ['גמל מים וחיבורי תשתית',['water']], ['פילרים',['power','walk']], ['מתקני חשמל',['power']],
     ['ניקוז',['water','level']], ['מיזוג',['build']], ['גישה לתחזוקה',['road','park','waste']], ['מניעת מפגעים חזותיים ותפעוליים',['waste','power','walk']] ] },
 { id:'sust', name:'קיימות', color:'#5b4a8a',
   items:[ ['הפחתת עומסי חום',['shade','trees','walk']], ['שימוש בצל טבעי ומלאכותי',['shade','trees']], ['בנייה ירוקה',['build','green']], ['חיסכון במים',['green','water']],
     ['חיסכון באנרגיה',['build','power']], ['חומרים עמידים',['walk','build']], ['תחזוקה ארוכת טווח',['green','waste','power']] ] }
];
const TOPIC_BY = Object.fromEntries(TOPICS.map(t => [t.id, t]));
window.LAYER_TOPICS = TOPICS;                // דרישות ההגשה לתוכנית הפיתוח: גם לחוות הדעת (plans-opinion.js)

/* התחומים של הפגישה: מי מציג, אילו שכבות, ומה שואלים */
const DISC = [
 { id:'arch', name:'אדריכלות', who:'אדריכל התוכנית', layers:['build','site'], ask:['facade.0','facade.2','facade.5','move.2','infra.1','infra.6','sust.2'] },
 { id:'traffic', name:'תנועה וחניה', who:'יועץ התנועה', layers:['road','park','bike'], ask:['move.0','move.2','move.3','move.4','move.6','infra.7'] },
 { id:'walk', name:'הולכי רגל ונגישות', who:'יועץ הנגישות', layers:['walk','level'], ask:['move.0','move.1','land.5','land.6','land.7','sust.5'] },
 { id:'land', name:'נוף, צל ושהייה', who:'אדריכל הנוף', layers:['trees','green','shade'], ask:['land.0','land.1','land.2','land.4','sust.0','sust.1','sust.6'] },
 { id:'water', name:'מים, ביוב וניקוז', who:'יועץ המים והניקוז', layers:['water','green'], ask:['land.3','infra.2','infra.5','sust.3'] },
 { id:'power', name:'חשמל, תאורה וגז', who:'יועץ החשמל', layers:['power'], ask:['infra.3','infra.4','infra.1','sust.4','infra.8'] },
 { id:'waste', name:'אשפה ותפעול', who:'יועץ האשפה והתברואה', layers:['waste','park'], ask:['infra.0','move.6','infra.7','infra.8'] },
 { id:'fire', name:'כיבוי אש וחירום', who:'יועץ הבטיחות', layers:['fire','road'], ask:['move.5'] },
 { id:'all', name:'הכול יחד', who:'סיכום הפגישה', layers:null, ask:null }
];
const DISC_COLOR = { arch:'#8a8478', traffic:'#48484c', walk:'#c9b96a', land:'#5c9a4a', water:'#1e73d8', power:'#e0a800', waste:'#2f7d5a', fire:'#c8202a', all:'#1a1a18' };
/* אייקונים קטנים בקו דק, במקום טקסט. לכל אחד יש שם בריחוף */
const ICON = { render:'<path d="M2 13l4-5 3 3 2-2 3 4z"/><circle cx="11" cy="4.5" r="1.6"/>', walk:'<circle cx="9" cy="2.6" r="1.3"/><path d="M8.5 5l-2 4 2.5 1.5L8 14M6.5 9L4.5 11.5M9 5.5l2.5 2 1.5-.5"/>', bird:'<path d="M2 11l6-3 6 3-6 3z"/><path d="M2 11V6l6-3 6 3v5"/>', top:'<rect x="3" y="3" width="10" height="10"/><circle cx="8" cy="8" r="1.3"/>',
  eye:'<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>', map:'<path d="M2 4l4-1.5 4 1.5 4-1.5v10L10 14l-4-1.5L2 14z"/><path d="M6 2.5v10M10 4v10"/>',
  play:'<path d="M5 3l8 5-8 5z"/>', stop:'<rect x="4" y="4" width="8" height="8"/>', wind:'<path d="M2 6h8a2 2 0 1 0-2-2"/><path d="M2 9.5h11a2 2 0 1 1-2 2"/><path d="M2 13h4"/>',
  facade:'<path d="M4 14V2h8v12"/><path d="M6.5 5h1M9 5h1M6.5 8h1M9 8h1M6.5 11h1M9 11h1"/>', env:'<rect x="2.5" y="2.5" width="11" height="11" stroke-dasharray="2.2 1.6"/>',
  under:'<path d="M1.5 5h13"/><path d="M4 5v8.5h8V5"/><path d="M4 9.2h8"/>', model:'<path d="M8 2l5.5 3v6L8 14l-5.5-3V5z"/><path d="M8 8l5.5-3M8 8L2.5 5M8 8v6"/>', draw:'<path d="M3 13l1-3.5L11 2.5l2.5 2.5-7 7z"/><path d="M9.5 4l2.5 2.5"/>' };
const ic = n => `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const LAYER_NAME = { site:'גבולות', build:'מבנים', road:'כבישים', park:'חניה', bike:'אופניים', walk:'ריצוף והולכי רגל', level:'קירות וגדרות', green:'גינון', trees:'עצים', shade:'הצללה ושהייה', water:'מים וניקוז', power:'חשמל ותאורה', waste:'אשפה', fire:'כיבוי אש', anno:'טקסט', exist:'קיים', renewal:'התחדשות עירונית' };
/* שלושת המצבים של כל תוכנית: מה יש, מה מותר, מה מוצע */
const STATES = [ ['exist', 'קיים', 'מה יש היום'], ['renewal', 'התחדשות עירונית', 'מה מותר לפי התב"ע'], ['design', 'תוכנית בינוי ועיצוב', 'מה מוצע בפועל'] ];
const SEASONS = [ ['קיץ', 6, 21], ['סתיו', 9, 23], ['חורף', 12, 21], ['אביב', 3, 21] ];
/* כיוון הרוח לכל עונה: הערכה כללית לחוף הדרומי, לא נתון מדוד */
const WIND_BY_SEASON = [ [300, 'צפון־מערב, בריזת ים'], [320, 'צפון־מערב'], [90, 'מזרח'], [270, 'מערב'] ];

/* שלבי התוכנית, עם המועד שנקבע לכל אחד: אותו שדה שמזין את לוח השנה */
const STAGES = [ ['פורום אדריכל', p => p.forumArchitect], ['פורום יועצים', p => p.forumConsultants], ['הכנה לוועדה', p => (p.datesPlan||{}).committeePrep], ['חתימה ותיעוד', p => p.signDate] ];
function stageChips(){ const p = plan(); if(!p) return ''; const t = new Date().toISOString().slice(0, 10);
  const f = d => /^\d{4}-\d{2}-\d{2}/.test(String(d||'')) ? `${d.slice(8,10)}.${d.slice(5,7)}.${d.slice(2,4)}` : '';
  return STAGES.map((x, i) => { let d = ''; try{ d = x[1](p) || ''; }catch(e){} const past = d && String(d).slice(0, 10) < t;
    return `<button class="ly-stage-chip${past?' past':''}${d?'':' none'}" data-card="forums" title="מעבר לשלב בכרטיס התוכנית"><i>${i+1}</i>${H(x[0])}<b>${f(d) || 'לא נקבע'}</b></button>`; }).join(''); }
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N = n => Number(n||0).toLocaleString('he-IL');
const say = m => { try{ if(typeof toast==='function') toast(m); }catch(e){} };
const PM = () => window.PlanModel;

const S = { tik:null, man:null, model:null, meas:null, api:null, rn:null, state:'design', env:false, d:0, mode:'model', season:0, hour:15, floors:0, map:true, streets:false, fc:null, wind:false, fac:true, under:false, play:null, view:'home',
  off:new Set(), gap:0, zoom:1, px:0, py:0, rx:58, rz:-28, rec:null, recObj:null, open:new Set() };

/* ── נתונים: נשמרים על התוכנית ── */
function plan(){ try{ return plans.find(p => String(p.tik)===String(S.tik) && !p._deleted); }catch(e){ return null; } }
function canEdit(){ try{ return typeof isArchitect!=='function' || isArchitect(); }catch(e){ return true; } }
function review(){
  const p = plan(); let r;
  if(p){ if(!p.layerReview || typeof p.layerReview!=='object') p.layerReview = {}; r = p.layerReview; }
  else { if(!S._local){ try{ S._local = JSON.parse(localStorage.getItem('layerReview-'+S.tik)); }catch(e){} S._local = S._local || {}; } r = S._local; }
  r.items = r.items || {}; r.custom = r.custom || []; r.concept = r.concept || {}; return r;
}
function persist(){
  const p = plan();
  if(p){ p.updatedAt = new Date().toISOString(); try{ savePlans(); }catch(e){ console.warn('layers save', e); } }
  else { try{ localStorage.setItem('layerReview-'+S.tik, JSON.stringify(S._local)); }catch(e){} }
}
const today = () => { const d = new Date(), z = n => String(n).padStart(2,'0'); return `${z(d.getDate())}.${z(d.getMonth()+1)}.${d.getFullYear()}`; };
const itemOf = key => { const [t, i] = key.split('.'); return TOPIC_BY[t] && TOPIC_BY[t].items[+i]; };
function askKeys(disc){ return disc.ask || TOPICS.flatMap(t => t.items.map((_, i) => t.id+'.'+i)); }
function discCount(disc){ const r = review(), ks = askKeys(disc), cu = r.custom.filter(c => c.t===disc.id);
  return { done: ks.filter(k => r.items[k] && r.items[k].d).length + cu.filter(c => c.d).length, total: ks.length + cu.length }; }

/* ── מה נמדד בשרטוט, לכל תחום. הכול הערכה מהגאומטריה ── */
/* תוכנית העמדה כתמונה: רק מה שנמדד ממנה, ומה שחסר בה נאמר במפורש */
function rasterFacts(disc){
  const m = S.meas, a = m.area, c = m.count, man = S.man || {}, cal = man.cal || {}, e = man.elements || {}, bc = e.basementCal || {},
    none = t => `==אין בשקפים: ${t}==`, ask = 'לבקש מהאדריכל תוכנית פיתוח (PDF עם שכבות), דרך הטופס לאדריכל';
  switch(disc.id){
    case 'arch': { const fit = conform(), out = fit ? fit.reduce((s, r) => s+r.out, 0) : 0, tot = fit ? fit.reduce((s, r) => s+r.area, 0) : 0;
      return [`**${c.foot}** מבנים, קומת קרקע של כ-**${N(a.foot)}** מ"ר, ו-**${c.entry||0}** כניסות`,
        fit && fit.length ? (out > tot*0.02 ? `==כ-${N(out)} מ"ר מקומת הקרקע מחוץ לקווי הבניין של התב"ע== (הערכה, ${Math.round(out/tot*100)}%)` : `קומת הקרקע בתוך קווי הבניין של התב"ע (${fit.length} מגרשים, הערכה)`) : 'אין נתוני תב"ע להשוואה',
        spacingFact(), partsFact()].filter(Boolean); }
    case 'traffic': return [`מיסעה לפי מגרשי הדרך בתב"ע: כ-**${N(a.asphalt)}** מ"ר. **${e.ramps||0}** רמפות לחניון, כ-**${N(a.ramp)}** מ"ר`,
      e.under ? `קו המרתף משקף המרתף: כ-**${N(e.under)}** מ"ר, הערכה (עיגון: **${Math.round((bc.within05||0)*100)}%** מהצלעות עד חצי מטר)` : '',
      `חדרי אופניים ועגלות: כ-**${N(a.bikeRoom)}** מ"ר`, none('מקומות החניה, שבילי אופניים ופריקה וטעינה')].filter(Boolean);
    case 'walk': return [`ריצוף: כ-**${N(a.paving)}** מ"ר (כל מה שאינו מבנה, חצר, רחבה או דרך)`, `**${c.spot||0}** רומים, מהכניסות ועד שולי המגרש`, none('מדרגות, קירות פיתוח ושיפועי הנגישות')];
    case 'land': return [`**${c.treeNew}** עצים בתוכנית ההעמדה, ו-**${c.treeOld||0}** עצים קיימים מסקר העצים (מתוך כ-120 ממוספרים)`,
      `חצרות גן ומעון: כ-**${N(a.green)}** מ"ר. רחבות שהייה: כ-**${N(a.plaza)}** מ"ר`, '==עץ לשימור, להעתקה או לכריתה לא מסומן=='];
    case 'water': return [none('מים, ביוב וניקוז'), ask];
    case 'power': return [`**${c.lamp||0}** סימנים צהובים לאורך הדרכים, כנראה עמודי תאורה (הערכה)`, `חדר טכני ואוורור: כ-**${N(a.tech)}** מ"ר`, none('חדר טרנספורמציה, ארונות וקווי חשמל')];
    case 'waste': return [`**${c.wasteLift||0}** מעליות אשפה, אחת בכל מגדל`, none('חדר אשפה, דחסנית ומסלול משאית הפינוי'), ask];
    case 'fire': return [`**${c.fire||0}** רחבות כיבוי של כ-6 על 12 מ', ובכל אחת כבאית`, e.firePartial ? e.firePartial : '', none('מסלולי הגישה ורדיוסי הסיבוב')].filter(Boolean);
    default: return [`**${c.foot}** מבנים, **${c.treeNew + (c.treeOld||0)}** עצים, **${c.fire||0}** רחבות כיבוי, **${c.spot||0}** רומים`,
      `מקור: ${man.source}`, cal.within05 != null ? `מעוגן למגרשי התב"ע: **${Math.round(cal.within05*100)}%** מצלעות המגרשים עד חצי מטר מהקו בתמונה` : 'המודל ממוקם ברשת ישראל'];
  }
}
/* מרחקים בין מבנים (model.spacing) וחלקי בניין מהמצגת (model.parts) */
function spacingFact(){
  const sp = (S.model.spacing||[]).filter(x => x.need), bad = sp.filter(x => !x.ok), t = sp.filter(x => x.need === 18).sort((a, b) => a.d - b.d)[0];
  if(!sp.length) return '';
  return bad.length ? `==${bad.map(x => `${x.a}-${x.b} ${x.d} מ' (נדרש ${x.need})`).join(', ')}== (הערכה)`
    : `מרחקים בין מבנים תואמים להוראות${t ? `: בין מגדלים לפחות **${t.d}** מ' (נדרש 18)` : ''}, הערכה`;
}
function partsFact(){
  const p = S.model.parts||[], rn = S.rn, over = rn ? p.filter(x => { const L = rn.lots.find(l => l.lot === x.lot); return L && L.floors && x.floors > L.floors; }) : [];
  if(!p.length) return 'גובה הבניינים אינו בתמונה: החזיתות עולות לפי הקומות של התב"ע, להמחשה';
  const ids = [...new Set(over.map(x => x.id))];
  return ids.length ? `==${ids.join(', ')}: ${over[0].floors} קומות במצגת, ${rn.lots.find(l => l.lot === over[0].lot).floors} בטבלה 5== (לבירור: עד 2 קומות טכניות מותרות)`
    : `**${[...new Set(p.map(x => x.id))].length}** בניינים בגובה מהמצגת, בתוך מספר הקומות בתב"ע`;
}
/* תכנון רעיוני: מה יש בשלב הזה, ומה לבקש מכל יועץ לפורום. בלי מספרים של תוכנית פיתוח שעוד לא קיימת */
function conceptFacts(disc){
  const fl = S.fl || { buildings:[] }, rn = S.rn || { lots:[] }, c = S.meas.count, a = S.meas.area, l = S.meas.len, cf = S.concept || {}, dv = S.model.dev || null;
  const tw = fl.buildings, appr = rn.lots.filter(x => (cf.towerLots||[]).concat(cf.cancelled||[]).includes(x.lot) && x.floors >= 20);
  const NOPLAN = '==אין עדיין תוכנית פיתוח: שלב תכנון רעיוני==', DEV = dv ? `מתוכנית המתחם (עמ' ${dv.page})` : '';
  const mk = dv && dv.marks ? Object.entries(dv.marks).map(([k, v]) => `**${v}** ${k.replace('עץ ', '')}`).join(', ') : '';
  switch(disc.id){
    case 'arch': if(S.fl && S.fl.annex){ const tw2 = tw.filter(b => !String(b.id).startsWith('ציבור')), pub = tw.filter(b => String(b.id).startsWith('ציבור')), ax = S.model.annex || {}, H2 = ax.heights || {}, u = ax.uses || {};
        return [`**נספח הבינוי:** **${tw2.length}** מגדלים של **${tw2[0] ? tw2[0].total : ''}** קומות, גג ב-**${H2.roof}** מ' ומבנה הגג עד **${H2.top}** מ' (החתכים)`,
          `קומת קרקע של **${H2.ground}** מ': מסחר **${N(u.shop)}** מ"ר, לובי **${N(u.lobby)}**, מועדוני דיירים **${N(u.club)}**, ציבור **${N(u.public)}**`,
          pub.length ? `**${pub.length}** מבני ציבור (מגרשים ${pub.map(b => b.lot).join(', ')}), ${pub[0].floors.length} קומות מעל המסחר` : '',
          S.flAlt ? '==חלופת המצגת (07.2026) לא תואמת לתב"ע==: 3 מגדלים של כ-32 קומות. המתג "נספח הבינוי" מחליף ביניהן' : ''].filter(Boolean); }
      return [`**${tw.length}** מגדלים של כ-**${tw[0] ? tw[0].total : ''}** קומות (כ-**${tw[0] ? Math.round(tw[0].top) : ''}** מ'), מול **${appr.length}** מגדלים של **${appr[0] ? appr[0].floors : ''}** קומות (**${appr[0] ? appr[0].height : ''}** מ') בתב"ע המאושרת`,
      (cf.cancelled||[]).length ? `מגרש **${cf.cancelled.join(', ')}**: המגדל מבוטל, ובמקומו בניין מסחר וציבור נפרד עם גג ירוק` : '',
      `חזית מסחרית לפי התשריט: **${N(l.front)}** מ'`, (S.model.appBuild||[]).length ? `**${S.model.appBuild.length}** בניינים מאושרים בשאר המתחם, ${DEV}` : '',
      '==מספר הקומות נספר בהדמיה: הערכה==, לבדיקה מול הוראות התב"ע המוצעת'].filter(Boolean);
    case 'traffic': { const pk = (S.model.annex || {}).parking;
      if(pk) return [`**נספח התנועה:** **${N(pk.planned.car)}** חניות רכב מול **${N(pk.required.car)}** בתקן (${N(pk.required.carWithDisabled)} כולל נכים)`,
        `לפי מפלס: ${Object.entries(pk.byLevel).filter(([k, v]) => v.car).map(([k, v]) => `**${k}**: ${v.car}`).join(', ')}`,
        `אופניים **${N(pk.planned.bike)}**, אופנועים **${N(pk.planned.moto)}**, חניה תפעולית **${pk.planned.service}**`, `קווי חניה במרתף: **${N(l.parking)}** מ'`];
      return [dv ? `כבישים: כ-**${N(a.asphalt)}** מ"ר, ${DEV}` : '', `**${c.exSign||0}** תמרורים ורמזורים קיימים ממפת המדידה`, NOPLAN, 'לבקש תוכנית תנועה, חניה ורמפות'].filter(Boolean); }
    case 'walk': return [dv ? `ריצוף ומדרכות: כ-**${N(a.paving)}** מ"ר, ${DEV}` : '', `זיקות הנאה למעבר מהתשריט: **${N(l.easement)}** מ' של סימון`, 'לבקש מסלול נגיש רציף ומפלסים'].filter(Boolean);
    case 'land': return [dv ? `**${c.treeNew}** עצים מוצעים ו-**${N(a.green)}** מ"ר גינון, ${DEV}` : '', mk ? `סימון עצים: ${mk}` : '', `**${c.exTree||0}** עצים במפת המדידה`,
      dv ? `משחק **${N(a.play)}** מ"ר, ספורט **${N(a.sport)}** מ"ר, חצר גן ילדים **${N(a.yard)}** מ"ר` : ''].filter(Boolean);
    case 'water': return [`**${c.cover||0}** שוחות קיימות ממפת המדידה`, NOPLAN, 'לבקש תוכנית מים, ביוב וניקוז, ופתרון החדרה בשטח הגינון'];
    case 'power': return [`**${c.lamp}** עמודים ו-**${c.cabinet||0}** ארונות ממפת המדידה`, NOPLAN, 'לבקש מיקום חדר טרנספורמציה ופילרים כבר בשלב הבינוי'];
    case 'waste': return [`**${c.exBin||0}** אשפטונים קיימים ממפת המדידה`, NOPLAN, 'לבקש חדרי אשפה ומסלול פינוי'];
    case 'fire': return [NOPLAN, 'לבקש דרכי גישה ורחבות כיבוי לשלושת המגדלים'];
    case 'all': return [`תשריט התב"ע המוצעת מעוגן לחלקות הגוש (סטייה חציונית **${cf.median != null ? cf.median.toFixed(2) : '?'}** מ')`, dv ? `תוכנית המתחם מעוגנת לתאי השטח (סטייה **${dv.georef.median.toFixed(2)}** מ')` : '',
      `**${tw.length}** מגדלים, **${c.treeNew||0}** עצים מוצעים, **${c.exTree||0}** עצים ו-**${c.cover||0}** שוחות במפת המדידה`, 'המגדלים, המסד והגגות להמחשה, לפי ההדמיות'].filter(Boolean);
    default: return [NOPLAN, `מה לבקש מ${disc.who} לפורום: ${disc.ask ? disc.ask.map(k => (itemOf(k)||[''])[0]).filter(Boolean).slice(0, 3).join(', ') : ''}`];
  }
}
function facts(disc){
  if(S.model.concept) return conceptFacts(disc);
  if(S.man && S.man.raster) return rasterFacts(disc);
  const m = S.meas, a = m.area, c = m.count, l = m.len, man = S.man || {}, g = (man.layers||[]).find(x => x.id==='green');
  const pct = g && g.areaIn && man.siteArea ? Math.round(g.areaIn/man.siteArea*100) : null;
  switch(disc.id){
    case 'arch': { const fit = conform(), out = fit ? fit.reduce((s, r) => s+r.out, 0) : 0, tot = fit ? fit.reduce((s, r) => s+r.area, 0) : 0;
      return [`**${c.foot}** מבנים, קומת קרקע של כ-**${N(a.foot)}** מ"ר`,
        fit && fit.length ? (out > tot*0.02 ? `==כ-${N(out)} מ"ר מקומת הקרקע מחוץ לקווי הבניין של התב"ע== (הערכה, ${Math.round(out/tot*100)}%)` : `קומת הקרקע בתוך קווי הבניין של התב"ע (${fit.length} מגרשים, הערכה)`) : 'אין נתוני תב"ע להשוואה',
        `**${N(l.glass)}** מ' זיגוג בקומת הקרקע`, S.rn ? 'גובה הבניינים אינו בשרטוט: החזיתות עולות לפי הקומות של התב"ע, להמחשה' : 'גובה הבניינים אינו בשרטוט: בוחרים מספר קומות להטלת צל']; }
    case 'traffic': return [`מיסעה: כ-**${N(a.asphalt)}** מ"ר`, `שביל אופניים: כ-**${N(a.bike)}** מ"ר`, `רמפה לחניון: כ-**${N(a.ramp)}** מ"ר`];
    case 'walk': return [`ריצוף: כ-**${N(a.paving)}** מ"ר`, `קירות פיתוח: **${N(l.lowwall)}** מ'`, `מדרגות: **${N(l.stairs)}** מ' של קווי מדרגה`];
    case 'land': return [`**${c.treeNew}** עצים מוצעים, **${c.treeOld}** קיימים, **${c.treeSurvey}** סימוני סקר`, `גינון: כ-**${N(a.green)}** מ"ר${pct!=null?`, שהם כ-**${pct}%** מהשטח שבקו הכחול`:''}`, `**${c.bench}** ספסלים, פרגולות **${N(a.pergola)}** מ"ר, משחק **${N(a.play)}** מ"ר`];
    case 'water': return ['==בשרטוט אין שכבה של מים או ביוב מוצעים==', `מוצג המצב הקיים ממפת המדידה: מים **${N(l.water)}** מ', ביוב **${N(l.sewer)}** מ', **${c.cover}** שוחות`, `ניקוז מוצע: **${N(l.drain)}** מ' בלבד`];
    case 'power': return [`**${c.lamp}** עמודי תאורה, מהם **${S.model.lampNew||0}** מוצעים והשאר קיימים בשדרות הרצל`, `**${c.trafo}** חדרי טרנספורמציה, **${c.cabinet}** ארונות קיימים`, `גז: **${N(l.gas)}** מ' של קווים וסימונים`];
    case 'waste': return [`**${c.bin}** מכלי מיחזור`, '==לא זוהתה שכבה נפרדת לחדרי אשפה ולמסלול הפינוי==', 'כדאי לבקש מהיועץ לסמן את מסלול משאית הפינוי'];
    case 'fire': return [`**${c.fire}** רחבות כיבוי, ובכל אחת כבאית של 9.5 מ'`, `מסלולי גישה וסיבוב: **${N(l.fireroute)}** מ'`, 'לבדוק מול העצים והעמודים: האם הכבאית מגיעה לכל חזית'];
    default: return [`**${S.man.layers.length}** נושאים, מתוך **${S.man.cadTotal}** שכבות השרטוט`, `**${c.treeNew+c.treeOld}** עצים, **${c.lamp}** עמודי תאורה, **${c.bench}** ספסלים, **${c.fire}** רחבות כיבוי`, 'המודל ממוקם ברשת ישראל, ולכן הצל נכון למקום ולשעה'];
  }
}
const rich = s => H(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/==(.+?)==/g, '<mark class="ly-warn">$1</mark>');
/** חתך קומה: הקומה הגבוהה מכל הבניינים, ושם קצר למצב */
function flTop(){ return S.fl ? Math.max(...S.fl.buildings.map(b => b.floors.length)) : 0; }
function cutLabel(){ return S.cut ? `קומה ${S.cut}` : 'כל הבניין'; }
function kindMeasure(k){ const m = S.meas; if(m.count[k]!=null && m.count[k] > 0) return N(m.count[k]); if(k==='mass') return S.floors ? S.floors+' קומות' : 'כבוי'; if(k==='facade') return !S.fac ? 'כבוי' : S.fl ? S.fl.buildings.length+' בניינים, '+S.fl.buildings.reduce((a, b) => a + b.floors.length, 0)+' קומות' : 'מוצג'; if(k==='under') return S.under ? 'מוצג' : 'כבוי';
  if(m.area[k]) return N(m.area[k])+' מ"ר'; if(m.len[k]) return N(m.len[k])+' מ\''; return ''; }

/* ── שלד ── */
function ensurePage(){
  if(document.getElementById('layers')) return;
  const ref = document.getElementById('timeline') || document.querySelector('.page');
  const pg = document.createElement('div'); pg.id = 'layers'; pg.className = 'page ly-page'; pg.innerHTML = '<div id="layersBody"></div>';
  ref.parentNode.insertBefore(pg, ref.nextSibling);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
}
const body = () => document.getElementById('layersBody');
async function open(tik){
  ensurePage();
  tik = String(tik || S.tik || Object.keys(SETS)[0]);
  try{ if(typeof isDeveloper==='function' && isDeveloper() && !(session.tiks||[]).includes(tik)){   // יזם רואה רק את התוכנית שלו
    body().innerHTML = '<div class="page-title">שכבות</div><p class="ly-empty">השכבות זמינות רק לתוכנית שלך.</p>'; return; } }catch(e){}
  if(!SETS[tik]) await SETS_READY;                       // קישור ישיר למודל שהופק אוטומטית: מחכים לרשימה
  if(!SETS[tik]){ body().innerHTML = `<div class="page-title">שכבות</div><p class="ly-empty">לתוכנית ${H(tik)} עוד לא הופקו שכבות.</p>`; return; }
  if(S.tik !== tik || !S.man){
    if(S.api){ S.api.dispose(); S.api = null; }
    S.tik = tik; S.man = null; S._local = null;
    body().innerHTML = '<p class="ly-empty">טוען את המודל…</p>';
    try{ const dir = SETS[tik].dir; [S.man, S.model] = await Promise.all([fetch(dir+'/manifest.json').then(r => r.json()), fetch(dir+'/model.json').then(r => r.json())]); S.meas = PM().measure(S.model);
      S.rn = SETS[tik].renewal ? await fetch(dir+'/renewal.json').then(r => r.json()).catch(() => null) : null; S.fit = null;
      S.fl = await fetch(dir+'/floors.json').then(r => r.ok ? r.json() : null).catch(() => null); S.cut = 0;   // תוכניות הקומה של האדריכל (tools/extract-floors.py)
      S.flMain = S.fl; S.flAlt = S.fl && S.fl.alternative ? await fetch(dir+'/'+S.fl.alternative).then(r => r.ok ? r.json() : null).catch(() => null) : null; S.useAlt = false;   // חלופה להשוואה (1909: רעיון המצגת מול נספח הבינוי)
      S.wk = await fetch(dir+'/walk.json').then(r => r.ok ? r.json() : null).catch(() => null); S.walk = false; S.render = false;   // מסלולי הליכה (tools/extract-walk.py)
      S.lv = await fetch(dir+'/levels.json').then(r => r.ok ? r.json() : null).catch(() => null);   // מפלסים, רמפות ונגישות (tools/extract-levels.py)   // תוכניות הקומה של האדריכל (tools/extract-floors.py)
      S.concept = S.model.concept ? await fetch(dir+'/concept.json').then(r => r.json()).then(c => ({ median:(c.georef||{}).median, cancelled:c.cancelled||[], towerLots:(c.towers||[]).map(x => x.lot), notes:c.notes||{} })).catch(() => ({})) : null;
      S.state = S.rn ? 'exist' : 'design'; }
    catch(e){ body().innerHTML = '<p class="ly-empty">המודל לא נטען. בדקי את החיבור ונסי שוב.</p>'; return; }
  }
  shell(); await setMode(S.mode); drawPanel();
}
function shell(){
  const set = SETS[S.tik];
  if(S.api){ S.api.dispose(); S.api = null; }
  body().innerHTML = `
  <div class="ly-head">
    <h1 class="ly-title">תיק <b>${H(S.tik)}</b> · ${H(set.title)}</h1>
    ${set.auto === 'approx' ? `<p class="ly-approx">מיקום משוער: הכמויות מדויקות, המיקום לא נבדק מול התב"ע</p>` : ''}
    ${set.raster ? `<p class="ly-approx">מתוכנית העמדה כתמונה: מבנים, עצים וריצוף הם הערכה. חסרה תוכנית פיתוח עם שכבות</p>` : ''}
    ${plan() ? `<nav class="ly-links" aria-label="שלבי התוכנית">${stageChips()}<button data-card="opinion" title="כרטיס התוכנית בפורמט של חוות הדעת לוועדה">חוות דעת</button></nav>` : ''}
    <div class="ly-states" id="lyStates" role="tablist" aria-label="מצב התוכנית"></div>
  </div>
  <div class="ly-steprow"><div class="ly-steps" id="lySteps" role="tablist" aria-label="תחומי הפגישה"></div>
    <div class="ly-nav"><button class="ly-b" data-step="-1">הקודם</button><button class="ly-b ly-next" data-step="1">הבא</button></div></div>
  <div class="ly-grid">
    <div class="ly-stage" id="lyStage">
      <div class="ly-view" id="lyView"></div>
      <div class="ly-over" id="lyOver"></div>
      <div class="ly-north" id="lyNorth" title="צפון"><i></i><b>צ</b></div>
      <div class="ly-credit" id="lyCredit"></div>
      <button class="ly-tour" id="lyTour" data-tourbtn="1" hidden><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="2.6" r="1.3"/><path d="M8.5 5l-2 4 2.5 1.5L8 14M6.5 9L4.5 11.5M9 5.5l2.5 2 1.5-.5"/></svg><span>טיול בפרויקט</span></button>
    </div>
    <div class="ly-tools" id="lyTools"></div>
    <aside class="ly-panel" id="lyPanel" aria-label="התחום הנוכחי"></aside>
  </div>`;
  bind();
}
function drawSteps(){
  const design = S.state==='design';
  document.getElementById('lyStates').innerHTML = STATES.filter(x => x[0]==='design' || S.rn).map(x => `<button role="tab" aria-selected="${x[0]===S.state}" class="${x[0]===S.state?'on':''}" data-state="${x[0]}" title="${H(x[2])}">${H(x[1])}</button>`).join('');
  document.querySelector('.ly-steprow').style.display = design ? '' : 'none';
  document.getElementById('lySteps').innerHTML = DISC.map((x, i) => { const c = discCount(x);
    return `<button role="tab" aria-selected="${i===S.d}" class="${i===S.d?'on':''}" data-disc="${i}" style="--dc:${DISC_COLOR[x.id]}"><u></u>${H(x.name)}<b>${c.done}/${c.total}</b></button>`; }).join('');
}
function drawTools(){
  const el = document.getElementById('lyTools'); if(!el) return;
  const seg = (name, list, cur) => `<span class="ly-seg">${list.map((t, i) => `<button data-${name}="${i}" class="${i===cur?'on':''}">${H(t)}</button>`).join('')}</span>`;
  const iseg = (name, list, cur) => `<span class="ly-seg">${list.map((t, i) => `<button data-${name}="${i}" class="ly-ib${i===cur?' on':''}" title="${H(t[1])}" aria-label="${H(t[1])}">${ic(t[0])}</button>`).join('')}</span>`;
  const tg = (name, on, icon, label, title) => `<button class="ly-tg ly-ib${on?' on':''}" data-${name}="1" title="${H(label + (title ? ': ' + title : ''))}" aria-label="${H(label)}" aria-pressed="${!!on}">${ic(icon)}</button>`;
  const hh = Math.floor(S.hour), mm = Math.round((S.hour%1)*60), design = S.state==='design', model = S.mode==='model';
  el.innerHTML = (design ? `<span class="ly-grp">${iseg('mode', [['model', 'מודל תלת־ממדי'], ['draw', 'השרטוט המקורי']], model?0:1)}</span>` : '')
    + (model ? `<span class="ly-grp">${iseg('view', [['bird', 'מעוף הציפור'], ['top', 'מבט על'], ['eye', 'גובה עיניים']], ['home','top','eye'].indexOf(S.view))}</span>
      <span class="ly-grp">${tg('map', S.map, 'map', 'מפה', 'מפת רחובות אפורה של אשדוד')}</span>
      <span class="ly-grp">${seg('season', SEASONS.map(x => x[0]), S.season)}
        <input type="range" id="lyHour" min="5" max="20" step="0.25" value="${S.hour}" aria-label="שעה"><output id="lyHourOut">${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}</output>
        ${tg('play', !!S.play, S.play ? 'stop' : 'play', S.play ? 'עצירה' : 'הנעת השמש', 'מהזריחה עד השקיעה')}</span>
      ${design ? `<span class="ly-grp">${tg('render', S.render, 'render', 'הדמיה', 'גימור ריאליסטי: בלי שכבות טכניות, עם שמיים, אובך וצל מגע')}${S.wk ? tg('walk', S.walk, 'walk', 'הליכה', 'בגובה העיניים, על השבילים. חצים: הולכים ובוחרים פנייה') : ''}</span>` : ''}
      <span class="ly-grp">${tg('wind', S.wind, 'wind', 'רוח', 'כיוון לפי העונה. הערכה כללית')}
        ${design && S.rn ? tg('fac', S.fac, 'facade', 'חזיתות וקומות', S.fl ? 'כל קומה מתוכניות האדריכל. גובה הקומות: הנחה' : 'מגדלים לפי הקומות של התב"ע. להמחשה') + tg('env', S.env, 'env', 'מעטפת התב"ע', 'המותר מעל המוצע') : ''}
        ${S.rn && S.state!=='exist' ? tg('under', S.under, 'under', 'תת־קרקע', 'קומות המרתף והחניון') : ''}
        ${design && S.flAlt ? `<button class="ly-tg${S.useAlt?' on':''}" data-alt="1" title="${S.useAlt ? 'מוצגת חלופת המצגת (07.2026): 3 מגדלים של כ-32 קומות, הערכה. לחיצה חוזרת לנספח הבינוי' : 'מוצג נספח הבינוי של התב&quot;ע. לחיצה מציגה את חלופת המצגת (07.2026)'}" aria-pressed="${S.useAlt}">${S.useAlt ? 'חלופת המצגת' : 'נספח הבינוי'}</button>` : ''}</span>
      ${design && S.fac && S.fl ? `<span class="ly-grp" title="חתך: הקומות שמעל מוסתרות, והקירות של הקומה מוצגים כמו בתוכנית"><b>חתך</b><input type="range" id="lyCut" min="0" max="${flTop()}" value="${S.cut||0}" aria-label="חתך קומה"><output id="lyCutOut">${cutLabel()}</output></span>` : ''}
      ${design && !S.rn ? `<span class="ly-grp"><b>קומות</b><input type="range" id="lyFloors" min="0" max="30" value="${S.floors}" aria-label="מספר קומות"><output id="lyFloorsOut">${S.floors||'בלי'}</output></span>` : ''}
      <span class="ly-mut" id="lySun"></span>`
    : `<span class="ly-grp"><b>הפרדה</b><input type="range" id="lyGap" min="0" max="110" value="${S.gap}"></span>`);
  const tb = document.getElementById('lyTour'); if(tb){ tb.hidden = !(S.wk && model); tb.classList.toggle('on', !!S.walk); tb.lastElementChild.textContent = S.walk ? 'יציאה מהטיול' : 'טיול בפרויקט'; }
  const cr = document.getElementById('lyCredit'); if(cr) cr.textContent = !model ? '' : S.streets ? 'רחובות: עיריית אשדוד' : S.map ? 'מפה: Esri, © OpenStreetMap' : '';
}
function sunNow(){ if(!S.api) return; const x = SEASONS[S.season], r = S.api.setSun(new Date().getFullYear(), x[1], x[2], S.hour), el = document.getElementById('lySun');
  const w = S.wind ? ` · רוח מ${WIND_BY_SEASON[S.season][1]} (הערכה)` : '';
  if(el) el.textContent = (r.day ? `גובה השמש ${Math.round(r.alt)}°, אזימוט ${Math.round(r.az)}°` : 'השמש מתחת לאופק: התאורה נדלקת') + w; }
function setHour(h){ S.hour = h; const o = document.getElementById('lyHourOut'), i = document.getElementById('lyHour');
  if(o) o.textContent = `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h%1)*60)).padStart(2,'0')}`; if(i) i.value = h; sunNow(); }
/** הנעה: השמש עוברת מ-05:00 עד 20:00 בכ-15 שניות */
function playSun(on){ if(S.play){ clearInterval(S.play); S.play = null; }
  if(on){ if(S.hour >= 19.9) setHour(5); let last = performance.now(); S.play = setInterval(() => { const now = performance.now(), dt = Math.min(.5, (now-last)/1000); last = now;   // שעה בשנייה, לפי הזמן שעבר בפועל
      if(!S.api || S.hour >= 20){ playSun(false); drawTools(); sunNow(); return; } setHour(Math.min(20, S.hour + dt)); }, 60); } }
/** שכבת הרחובות העירונית נטענת פעם אחת, רק כשצריך */
function loadStreets(){ if(S.fc || S._fcLoading) return; S._fcLoading = true;
  fetch('geo/ashdod-streets.geojson').then(r => r.json()).then(fc => { S.fc = fc; applyApi(); }).catch(() => { S._fcLoading = false; }); }
function applyApi(){ if(!S.api) return; if(S.streets && !S.fc) loadStreets(); S.api.setStreets(S.fc, S.streets); S.api.setMap(S.map && !S.streets); S.api.setWind(S.wind ? WIND_BY_SEASON[S.season][0] : null);
  S.api.setFacade(S.fac && S.state==='design' && !!S.rn); if(S.fl) S.api.setCut(S.fac ? S.cut : 0); S.api.setEnvelope(S.env); S.api.setUnder(S.under && S.state!=='exist'); S.api.setFloors(S.rn ? 0 : S.floors); }
/* ── הליכה: קונסולה במסך ומפה קטנה. ענת: "בלי לאבד אוריינטציה, בלי שיהיה קשה לנווט עם העכבר" ── */
function walkToggle(on){
  if(!S.api || S.mode !== 'model') return;
  if(on && !S.api.walkStart()) return; if(!on) S.api.walkStop();
  S.walk = on; if(on) S.render = true;
  const st = document.getElementById('lyStage'); let hud = document.getElementById('lyWalk');
  if(!on){ if(hud) hud.remove(); drawTools(); return; }
  if(!hud){ hud = document.createElement('div'); hud.id = 'lyWalk'; hud.className = 'ly-walk'; st.appendChild(hud); }
  const b = (cmd, label, path, title) => `<button data-wcmd="${cmd}" title="${H(title)}" aria-label="${H(title)}"><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>${label ? `<small>${H(label)}</small>` : ''}</button>`;
  hud.innerHTML = `<canvas class="ly-mini" id="lyMini" width="220" height="220" title="לחיצה על המפה: הולכים לשם"></canvas>
    <div class="ly-wpad">
      <div class="ly-winfo" id="lyWinfo">על השביל</div>
      <div class="ly-wkeys">
        ${b('right', 'ימינה', '<path d="M6 3l5 5-5 5"/>', 'פנייה ימינה בצומת, או מבט ימינה (חץ ימינה)')}
        <span>${b('fwd', 'קדימה', '<path d="M8 13V3M3.5 7.5L8 3l4.5 4.5"/>', 'הליכה קדימה, כל עוד לוחצים (חץ למעלה)')}${b('back', 'אחורה', '<path d="M4 6a4 4 0 1 1 1 5"/><path d="M4 2.5V6h3.5"/>', 'הסתובבות לאחור (חץ למטה)')}</span>
        ${b('left', 'שמאלה', '<path d="M10 3L5 8l5 5"/>', 'פנייה שמאלה בצומת, או מבט שמאלה (חץ שמאלה)')}
      </div>
      <div class="ly-wkeys">${(S.wk.stops||[]).length ? b('tour', 'סיור מודרך', '<path d="M3 13V3l5 3 5-3v10l-5-3z"/>', 'סיור לבד בכל התחנות: הכניסה, הבניינים והגינות. לחיצה נוספת עוצרת') : ''}${b('go', 'עד הצומת', '<path d="M5 3l8 5-8 5z"/>', 'הליכה רציפה עד הצומת הבא (רווח)')}${b('stop', 'עצירה', '<rect x="4" y="4" width="8" height="8"/>', 'עצירה (Esc)')}</div>
      <p class="ly-whelp">גרירה: הסתכלות סביב · לחיצה על הקרקע או על המפה: הולכים לשם</p>
    </div>`;
  const fwd = hud.querySelector('[data-wcmd="fwd"]');
  fwd.onpointerdown = ev => { ev.preventDefault(); S.api && S.api.walkCmd('fwd'); }; fwd.onpointerup = fwd.onpointerleave = () => S.api && S.api.walkCmd('fwdUp');
  const mini = document.getElementById('lyMini'); miniBase();
  mini.onclick = ev => { const r = mini.getBoundingClientRect(), m = S._mini; if(!m) return; const x = m.x0 + (ev.clientX - r.left)*m.k, y = m.y1 - (ev.clientY - r.top)*m.k; S.api && S.api.walkTo(x, y); };
  drawTools();
}
/** רקע המפה הקטנה: שטח ההליכה, הבניינים והשבילים. נבנה פעם אחת */
function miniBase(){
  const wk = S.wk, c = document.createElement('canvas'), N = 220; c.width = c.height = N; const g = c.getContext('2d');
  const x0 = wk.x0, y0 = wk.y0, x1 = wk.x0 + wk.nx*wk.res, y1 = wk.y0 + wk.ny*wk.res, k = Math.max(x1-x0, y1-y0)/N, X = x => (x - x0)/k, Y = y => (y1 - y)/k;
  g.fillStyle = '#f4f3ef'; g.fillRect(0, 0, N, N);
  let i = 0, v = 0; g.fillStyle = '#d9d4c7'; for(const run of wk.mask){ if(v){ for(let j = i; j < i + run; j++){ const cx = j % wk.nx, cy = Math.floor(j / wk.nx); g.fillRect(X(x0 + cx*wk.res), Y(y0 + (cy+1)*wk.res), wk.res/k + .4, wk.res/k + .4); } } i += run; v ^= 1; }
  g.fillStyle = 'rgba(70,70,70,.85)'; (S.model.foot||[]).forEach(f => { g.beginPath(); for(let q = 0; q < f.length; q += 2) g[q ? 'lineTo' : 'moveTo'](X(f[q]/10), Y(f[q+1]/10)); g.closePath(); g.fill(); });
  g.strokeStyle = 'rgba(17,153,142,.55)'; g.lineWidth = 1; wk.edges.forEach(e => { g.beginPath(); for(let q = 0; q < e.pts.length; q += 2) g[q ? 'lineTo' : 'moveTo'](X(e.pts[q]/10), Y(e.pts[q+1]/10)); g.stroke(); });
  g.font = '600 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  (wk.stops||[]).forEach((st, i) => { const q = wk.nodes[st.n], x = X(q[0]/10), y = Y(q[1]/10); g.fillStyle = '#11998e'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillText(String(i+1), x, y + .5); });   // תחנות הסיור
  S._mini = { c, x0, y1, k: k*N/220, X, Y };
}
let _wl = 0;
function walkHud(w){
  const now = performance.now(); if(w.moving && now - _wl < 90) return; _wl = now;   // בעצירה תמיד מעדכנים, כדי שהמיקום האחרון יוצג
  const mini = document.getElementById('lyMini'), m = S._mini; if(!mini || !m) return; const g = mini.getContext('2d');
  g.drawImage(m.c, 0, 0); const x = m.X(w.x), y = m.Y(w.y), a = -w.yaw;
  g.fillStyle = 'rgba(17,153,142,.22)'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 26, a - .55, a + .55); g.closePath(); g.fill();      // שדה הראייה
  g.fillStyle = '#11998e'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.stroke();
  const inf = document.getElementById('lyWinfo'); if(inf) inf.innerHTML = w.tour ? `<b>${H(w.tour)}</b>` : `<b>${H(w.info)}</b>${w.junction ? ' · צומת: ← → לבחירה' : ''}`;
  const tb = document.querySelector('[data-wcmd="tour"]'); if(tb) tb.classList.toggle('on', !!w.tour);
}
async function setMode(mode){
  S.mode = mode; const view = document.getElementById('lyView'); if(!view) return;
  if(S.walk){ S.walk = false; const h = document.getElementById('lyWalk'); if(h) h.remove(); }
  if(S.api){ S.api.dispose(); S.api = null; }
  view.innerHTML = ''; document.getElementById('lyNorth').style.display = mode==='model' ? '' : 'none';
  if(mode==='model'){
    try{ await PM().loadThree();
      S.api = PM().create(view, S.model, { capture: !!window._lyCapture, onMapError: () => { S.streets = true; applyApi(); drawTools(); sunNow(); },   // המפה לא נטענה: עוברים לרחובות העירייה שבאפליקציה
        onCamera: a => { const n = document.getElementById('lyNorth'); if(n) n.firstElementChild.style.transform = `rotate(${a}rad)`; }, onWalk: walkHud });
      if(S.wk) S.api.setWalkData(S.wk);
      if(S.lv) S.api.setLevels(S.lv); if(S.rn) S.api.setRenewal(S.rn); if(S.fl) S.api.setBuildings(S.fl); applyApi(); S.api.view(S.view); S.off.forEach(k => S.api.setKind(k, false));
    }catch(e){ console.warn('model', e); view.innerHTML = '<p class="ly-empty">המודל התלת־ממדי לא נטען בדפדפן הזה. אפשר לעבור ל"שרטוט".</p>'; }
  } else {
    view.innerHTML = '<div class="ly-world" id="lyWorld">' + S.man.layers.map(l => `<div class="ly-sheet" data-id="${l.id}"><img src="${SETS[S.tik].dir}/${l.file}" alt="${H(l.name)}" draggable="false" decoding="async"><span class="ly-tag">${H(l.name)}</span></div>`).join('') + '</div>';
  }
  drawTools(); applyDisc();
}
function applyDisc(){
  const disc = DISC[S.d]; drawSteps();
  const over = document.getElementById('lyOver'), st = STATES.find(x => x[0]===S.state);
  if(over) over.innerHTML = S.state==='design' ? `<b>${H(disc.name)}</b><span>${disc.layers ? disc.layers.map(l => H(LAYER_NAME[l])).join(' · ') : 'כל השכבות'}</span>` : `<b>${H(st[1])}</b><span>${H(st[2])}</span>`;
  if(S.mode==='model'){ if(S.api){ S.api.setState(S.state); S.api.setActive(S.state==='design' ? disc.layers : null); applyApi(); sunNow(); } }
  else drawSheets();
}
function drawSheets(){
  const st = document.getElementById('lyStage'), world = document.getElementById('lyWorld'); if(!world) return;
  const m = S.man, r = st.getBoundingClientRect(), disc = DISC[S.d], on = id => !disc.layers ? true : (disc.layers.includes(id) || id==='site');
  const h = Math.max(260, r.height*0.92), w = h*m.w/m.h, gap = S.gap, three = gap > 0, n = m.layers.filter(l => on(l.id)).length;
  st.style.setProperty('--w', w+'px'); st.style.setProperty('--h', h+'px');
  let fit = 1, lift = 0;
  if(three){ const rx = S.rx*Math.PI/180, rz = S.rz*Math.PI/180, fw = w*Math.abs(Math.cos(rz))+h*Math.abs(Math.sin(rz)), fh = (w*Math.abs(Math.sin(rz))+h*Math.abs(Math.cos(rz)))*Math.cos(rx), stack = gap*(n-1)*Math.sin(rx);
    fit = Math.min(1.7, Math.max(.45, Math.min(r.height*.9/(fh+stack), r.width*.92/fw))); lift = stack/2*fit; }
  st.style.setProperty('--glass', String(Math.min(.4, 1.1/Math.max(1, n))));
  world.style.transform = `translate(${S.px}px, ${S.py+lift}px) scale(${S.zoom*fit}) ` + (three ? `rotateX(${S.rx}deg) rotateZ(${S.rz}deg)` : '');
  let k = 0;
  m.layers.forEach(l => { const el = world.querySelector(`.ly-sheet[data-id="${l.id}"]`), v = on(l.id); el.classList.toggle('off', !v); el.classList.toggle('glass', three && gap > 8); if(v){ el.style.transform = `translateZ(${k*gap}px)`; k++; } });
}

/* ── הפאנל של התחום ── */
/* ── התאמה לתב"ע: כמה משטח קומת הקרקע המוצעת נמצא בתוך קווי הבניין. הערכה, בדגימה של מטר ── */
const pip = (p, r) => { let c = false; for(let i = 0, j = r.length-1; i < r.length; j = i++){ const a = r[i], b = r[j]; if((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) c = !c; } return c; };
function conform(){
  if(S.fit !== null && S.fit !== undefined) return S.fit;
  if(!S.rn || !S.model.foot){ return S.fit = false; }
  const loc = c => { const [E, N] = PM().wgs2itm(c[1], c[0]); return [E-S.model.e0, N-S.model.n0]; };
  const env = S.rn.massing.filter(f => f.kind==='envelope').map(f => ({ lot:f.lot, top:f.top, r:f.c.map(loc) })), rows = [];
  S.model.foot.forEach(f => { const r = []; for(let i = 0; i < f.length; i += 2) r.push([f[i]/10, f[i+1]/10]);
    const cx = r.reduce((s, p) => s+p[0], 0)/r.length, cy = r.reduce((s, p) => s+p[1], 0)/r.length, e = env.find(x => pip([cx, cy], x.r)); if(!e) return;
    let inn = 0, out = 0; const xs = r.map(p => p[0]), ys = r.map(p => p[1]);
    for(let x = Math.min(...xs); x <= Math.max(...xs); x++) for(let y = Math.min(...ys); y <= Math.max(...ys); y++){ if(!pip([x, y], r)) continue; if(pip([x, y], e.r)) inn++; else out++; }
    rows.push({ lot:e.lot, area:inn+out, out, top:e.top, floors:(S.rn.lots.find(l => l.lot===e.lot)||{}).floors }); });
  return S.fit = rows;
}
/** מעביר את זכויות התב"ע (טבלה 5) לעמודת "מותר" בטבלת הבדיקה של התוכנית. ממלא רק תא ריק, ורושם מקור */
function fillRights(){
  const p = plan(), rn = S.rn; if(!p || !rn) return say('התוכנית לא נמצאה בטבלה'); if(!canEdit()) return say('רק אדריכלית העיר מעדכנת');
  try{ if(typeof ensureTable5==='function') ensureTable5(p); }catch(e){} p.table5 = p.table5 || {}; p.reviewGrid = p.reviewGrid || {};
  const L = rn.lots, per = (f, u) => L.filter(l => l[f] != null && l[f] !== 0).map(l => `מגרש ${l.lot}: ${N(l[f])}${u||''}`).join(' · '), src = `${rn.plan}, הוראות התוכנית, טבלה 5, עמ' 17`;
  const rows = [ ['designation', 'ייעודים וזיקות|ייעוד', [...new Set(L.map(l => l.title))].join('; '), ''],
    ['mainArea', 'זכויות ובינוי|שטח עיקרי (מ"ר)', String(L.reduce((s, l) => s + (l.main||0), 0)), per('main')],
    ['coverage', 'זכויות ובינוי|תכסית (%)', String(Math.max(...L.map(l => l.coverage||0))), per('coverage', '%')],
    ['floors', 'זכויות ובינוי|מספר קומות', String(Math.max(...L.map(l => l.floors||0))), per('floors')],
    ['height', "זכויות ובינוי|גובה (מ')", String(Math.max(...L.map(l => l.height||0))), per('height', " מ'")],
    ['units', 'יחידות דיור|מספר יחידות דיור', String(rn.summary.units), per('units')] ];
  let done = 0, kept = 0;
  rows.forEach(([k, id, val, detail]) => { const t = p.table5[k] = p.table5[k] || {};
    if(String(t.allowed||'').trim()){ kept++; return; }
    t.allowed = val; t.source = t.source || src; const r = p.reviewGrid[id] = p.reviewGrid[id] || { allowed:'', proposed:'', required:'', match:'', note:'', source:'' };
    r.source = r.source || src; if(detail && !r.note) r.note = 'לפי מגרש: ' + detail; done++; });
  persist(); say(done ? `${done} שדות "מותר" מולאו מטבלה 5${kept ? `, ${kept} נשארו כפי שהיו` : ''}` : 'כל השדות כבר מלאים. לא שיניתי דבר'); drawPanel();
}
/** סעיף מקופל: כותרת ומספר, והתוכן נפתח בלחיצה. המצב נשמר בזמן העבודה */
const fold = (id, title, count, body) => `<details class="ly-fold" data-fold="${id}" ${S.open.has(id)?'open':''}><summary><span>${H(title)}</span>${count!=null && count!=='' ? `<b>${H(String(count))}</b>` : ''}</summary>${body}</details>`;
function drawStatePanel(el){
  const rn = S.rn, m = S.meas, K = PM().KIND, Z = PM().ZONES, ex = S.state==='exist';
  const kinds = PM().STATE_KINDS[S.state].filter(k => m.count[k] || m.len[k] || k.startsWith('rn') || k==='exBuild');
  const lg = k => `<button class="ly-lg${S.off.has(k)?' off':''}" data-kind="${k}"><i style="background:${K[k].color}"></i><span>${H(K[k].label)}<small>${H(K[k].desc)}</small></span><em>${H(k==='exBuild' ? String(rn.demolish.length) : kindMeasure(k))}</em></button>`;
  el.innerHTML = ex ? `
    <div class="ly-who">קיים · מפת המדידה ומפת הרקע העירונית</div><h2 class="ly-h">מה יש היום במתחם</h2>
    <p class="ly-lead"><b>${rn.demolish.length}</b> מבנים להריסה${S.model.concept ? `, <b>${m.count.exTree||0}</b> עצים קיימים` : m.count.treeOld != null ? `, <b>${m.count.treeOld}</b> עצים קיימים` : ''}</p>
    ${S.model.concept ? fold('exfacts', 'מה יש בשטח: מפת המדידה', 4, `<ul class="ly-facts"><li><b>${rn.demolish.length}</b> מבנים קיימים להריסה (מפת הרקע העירונית). 4 קומות לפי מפת המדידה</li>
      <li><b>${m.count.exTree||0}</b> עצים, <b>${m.count.cover||0}</b> שוחות, <b>${m.count.lamp||0}</b> עמודים, <b>${m.count.cabinet||0}</b> ארונות</li>
      <li><b>${m.count.exBench||0}</b> ספסלים, <b>${m.count.exBin||0}</b> אשפטונים, <b>${m.count.exSign||0}</b> תמרורים ורמזורים</li>
      <li>כל קווי המדידה: <b>${N(m.len.exSurvey)}</b> מ' (אבני שפה, גדרות, קירות ומבנים)</li></ul>`) : fold('exfacts', 'מה יש בשטח', S.man.raster ? 2 : 3, `<ul class="ly-facts"><li><b>${rn.demolish.length}</b> מבנים קיימים להריסה. הגובה סמלי, לא נמדד</li>
      ${S.man.raster ? `<li><mark class="ly-warn">אין מפת מדידה: עצים ותשתית קיימים לא ידועים</mark></li>` : `<li><b>${m.count.treeOld}</b> עצים קיימים ו-<b>${m.count.treeSurvey}</b> סימוני סקר</li>
      <li>תשתית קיימת: מים <b>${N(m.len.water)}</b> מ', ביוב <b>${N(m.len.sewer)}</b> מ', <b>${m.count.cover}</b> שוחות</li>`}</ul>`)}
    ${fold('legend', 'מקרא', kinds.length, `<div class="ly-legend">${kinds.map(lg).join('')}</div><p class="ly-src">${H(rn.sources.context)}.</p>`)}` : `
    <div class="ly-who">התחדשות עירונית · ${H(rn.plan)}</div><h2 class="ly-h">מה מותר ב${H(rn.title)}</h2>
    <p class="ly-lead"><b>${N(rn.summary.units)}</b> דירות, עד <b>${rn.summary.floorsMax}</b> קומות ו-<b>${rn.summary.heightMax}</b> מ'</p>
    ${fold('rights', 'הזכויות לפי מגרש: טבלה 5', rn.lots.length, `<table class="ly-tbl"><thead><tr><th>מגרש</th><th>ייעוד</th><th>דירות</th><th>קומות</th><th>גובה</th><th>עיקרי</th><th>מסחר</th></tr></thead><tbody>
      ${rn.lots.map(l => `<tr><td><b>${l.lot}</b></td><td><i style="background:${Z[l.cat][1]}"></i>${H(l.title)}</td><td>${l.units||''}</td><td>${l.floors}</td><td>${l.height ? l.height+" מ'" : ''}</td><td>${N(l.main)}</td><td>${l.commerce ? N(l.commerce) : ''}</td></tr>`).join('')}</tbody></table>
      ${canEdit() && plan() ? `<div class="ly-cfoot"><button class="ly-b" data-rights="1" title="ממלא רק תא ריק, ורושם את המקור">העברת הזכויות לחוות הדעת</button></div>` : ''}`)}
    ${fold('zones', 'מקרא הייעודים', Object.keys(Z).length, `<div class="ly-zones">${Object.values(Z).map(z => `<span><i style="background:${z[1]}"></i>${H(z[0])}</span>`).join('')}</div>`)}
    ${fold('legend', 'מה מוצג', kinds.length, `<div class="ly-legend">${kinds.map(lg).join('')}</div>`)}
    ${fold('src', 'מקור והסתייגות', '', `<p class="ly-src">${H(rn.note)}</p><p class="ly-src">${H(rn.sources.lots)}. ${H(rn.sources.rights)}. ${H(rn.source)}.</p>`)}`;
}
function drawPanel(){
  const el = document.getElementById('lyPanel'); if(!el) return;
  if(S.state!=='design' && S.rn) return drawStatePanel(el);
  const disc = DISC[S.d], r = review(), ed = canEdit(), SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = key => ed && SR ? `<button class="ly-mic${S.rec===key?' rec':''}" data-mic="${key}">${S.rec===key?'עצירה':'הקלטה'}</button>` : '';
  const kinds = PM().KINDS.filter(k => k.topic!=='exist' && k.topic!=='renewal' && (!disc.layers || disc.layers.includes(k.topic)) && (S.meas.count[k.id] || S.meas.area[k.id] || S.meas.len[k.id] || (k.id==='mass' && !S.rn) || (S.rn && (k.id==='facade' || k.id==='under'))));
  const qrow = (key, label, x, custom) => `<li class="ly-it${x&&x.d?' done':''}">
      <label class="ly-ck"><input type="checkbox" data-done="${key}" ${x&&x.d?'checked':''} ${ed?'':'disabled'}><span>בוצע</span></label>
      <span class="ly-lab">${H(label)}</span>${custom && ed ? `<button class="ly-x" data-del="${key}" aria-label="מחיקת ההנחיה">×</button>` : ''}
      ${custom ? '' : `<div class="ly-note"><textarea data-note="${key}" data-voice="${key}" rows="1" placeholder="הנחיה ליזם…" ${ed?'':'readonly'}>${H(x&&x.n||'')}</textarea>${micBtn(key)}</div>`}</li>`;
  let qs = '';
  if(disc.ask) qs = disc.ask.map(k => qrow(k, itemOf(k)[0], r.items[k])).join('');
  else qs = TOPICS.map(t => `<li class="ly-th" style="--c:${t.color}">${H(t.name)}</li>` + t.items.map((it, i) => qrow(t.id+'.'+i, it[0], r.items[t.id+'.'+i])).join('')).join('');
  const cust = r.custom.map((c, i) => ({ c, i })).filter(o => o.c.t===disc.id).map(o => qrow('c.'+o.i, o.c.n, o.c, true)).join('');
  el.innerHTML = `
    <div class="ly-who">${S.d+1} מתוך ${DISC.length} · ${H(disc.who)}</div>
    <h2 class="ly-h">${H(disc.name)}</h2>
    ${(f => `<p class="ly-lead">${rich(f[0])}</p>` + fold('facts', 'מה נמדד בשרטוט', f.length, `<ul class="ly-facts">${f.map(x => `<li>${rich(x)}</li>`).join('')}</ul>`))(facts(disc))}
    ${fold('concept', 'הקונספט של היועץ', r.concept[disc.id] ? 'נרשם' : '', `<div class="ly-note"><textarea data-concept="${disc.id}" data-voice="k:${disc.id}" rows="2" placeholder="מה היועץ מסביר על התכנון…" ${ed?'':'readonly'}>${H(r.concept[disc.id]||'')}</textarea>${micBtn('k:'+disc.id)}</div>`)}
    ${fold('legend', 'מקרא', kinds.length, `<div class="ly-legend">${kinds.map(k => `<button class="ly-lg${S.off.has(k.id)?' off':''}" data-kind="${k.id}" title="${H(k.desc)}"><i style="background:${k.color}"></i><span>${H(k.label)}<small>${H(k.desc)}</small></span><em>${H(kindMeasure(k.id))}</em></button>`).join('')}</div>`)}
    ${infraFold(disc, r, ed)}
    ${levelsFold(disc, ed)}
    ${fold('checks', 'מה בודקים', discCount(disc).done + '/' + discCount(disc).total, `<ol class="ly-items">${qs}${cust}</ol>
    ${ed ? `<div class="ly-add"><input id="lyNew" data-voice="new" type="text" placeholder="הנחיה נוספת בתחום…" aria-label="הנחיה נוספת">${micBtn('new')}<button class="ly-b" data-act="add">הוספה</button></div>` : ''}`)}

    <div class="ly-cfoot"><button class="ly-b" data-act="copy">העתקת הסיכום</button>
      ${plan() ? '' : '<small>התוכנית לא נמצאה בטבלה. הסיכום נשמר בדפדפן הזה בלבד.</small>'}</div>`;
  el.querySelectorAll('textarea').forEach(grow);
}
/** ניתוח ורתימות (plans-infra.js): ממצאים מול מה שנמדד, הנחיה לייעול, וסימון לכל רתימה */
/** מפלסים: הרמפות לחניון (תנועה) והפרשי הגובה בכניסות (נגישות), מ-levels.json. כל ערך עם מקור, וההערכות מסומנות */
function levelsFold(disc, ed){
  const lv = S.lv; if(!lv || !['traffic', 'walk', 'all'].includes(disc.id)) return '';
  const rows = [];
  if(disc.id !== 'walk') (lv.ramps||[]).forEach((r, i) => rows.push(`<li>רמפה לחניון: <b>${r.len}</b> מ', שיפוע <b>${Math.round(r.slope*100)}%</b>, עומק בסוף כ-<b>${r.depth}</b> מ' (הערכה)${r.under ? ', ונכנסת מתחת לבניין' : ''} <button class="ly-b" data-goramp="${i}">להראות</button></li>`));
  if(disc.id !== 'traffic') (lv.checks||[]).forEach((c, i) => rows.push(`<li>${H(c.text)}${ed ? ` <button class="ly-b" data-addlv="${i}">הוספה להנחיות</button>` : ''}</li>`));
  if(!rows.length) return '';
  return fold('levels', 'מפלסים ונגישות', rows.length, `<ul class="ly-facts">${rows.join('')}</ul><p class="ly-src">רומים: ${H(lv.src)}. ${H(lv.assume)}</p>`);
}
function infraFold(disc, r, ed){
  const PI = window.PlanInfra; if(!PI || !S.meas || S.model.concept) return '';   // תכנון רעיוני: אין עדיין תוכנית פיתוח לנתח
  /* מודל מתמונה: ממצא שתלוי בשכבה שחסרה במקור (מים), או בריצוף (שבתמונה הוא "כל השאר"), לא מוצג. בשאר המקור הוא הערכה מהתמונה */
  const rasterOk = f => !S.man.raster || (!(S.man.missing||[]).includes(f.disc) && !/ריצוף/.test(f.title));
  const fs = PI.analyze({ meas:S.meas, model:S.model, rn:S.rn }).filter(f => (disc.id==='all' || f.disc===disc.id) && rasterOk(f))
    .map(f => S.man.raster ? Object.assign({}, f, { basis:'מתוכנית ההעמדה (תמונה), הערכה' }) : f);
  const syns = PI.synergiesFor(disc.id === 'all' ? 'all' : disc.id); r.synergy = r.synergy || {};
  const have = new Set(r.custom.map(c => c.n)), gaps = fs.filter(f => f.ok===false).length;
  const ST = [['yes','קיים'], ['no','חסר'], ['na','לא רלוונטי']];
  const card = (f, i) => `<li class="ly-fi ${f.ok===false?'gap':f.ok?'ok':'opp'}"><div class="ly-fi-t">${H(f.title)}</div><div class="ly-fi-f">${rich(f.fact)} <small>${H(f.basis)}</small></div>
    ${f.hits.length ? `<div class="ly-fi-q">${PI.Q.map(q => `<span class="${f.hits.includes(q)?'on':''}">${q}</span>`).join('')}</div>` : ''}
    ${f.guide ? `<blockquote>${H(f.guide)}</blockquote>${ed ? (have.has(f.guide) ? '<small class="ly-fi-in">נוספה להנחיות</small>' : `<button class="ly-b ly-fi-add" data-addg="${i}">הוספה להנחיות</button>`) : ''}` : ''}</li>`;
  S._fs = fs;
  return fold('infra', 'ניתוח ורתימות', gaps ? gaps + ' לשיפור' : fs.length, `
    <ol class="ly-fis">${fs.map(card).join('') || '<li class="ly-src">אין ממצא לתחום הזה במה שנמדד.</li>'}</ol>
    ${syns.length ? `<div class="ly-sec">רתימות לבדיקה <small><a href="#infra">כל הרתימות</a></small></div>
    <ul class="ly-syn">${syns.map(s => `<li><b>${H(s.name)}</b><span>${H(s.gain)}</span><span class="ly-seg">${ST.map(([k, l]) => `<button class="${r.synergy[s.id]===k?'on':''}" data-synst="${s.id}|${k}" ${ed?'':'disabled'}>${l}</button>`).join('')}</span></li>`).join('')}</ul>` : ''}`);
}
function grow(t){ t.style.height = 'auto'; t.style.height = Math.min(160, t.scrollHeight+2)+'px'; }

/* ── פעולות ── */
function go(d){ if(S.state!=='design') return; S.d = (d + DISC.length) % DISC.length; stopRec(); applyDisc(); drawPanel(); document.getElementById('lyPanel').scrollTop = 0; }
function saveField(el){
  const r = review(), v = el.value.trim();
  if(el.dataset.note){ const k = el.dataset.note, x = r.items[k] = r.items[k] || {}; x.n = v; x.at = v ? today() : ''; if(!x.n && !x.d) delete r.items[k]; }
  else if(el.dataset.concept){ if(v) r.concept[el.dataset.concept] = v; else delete r.concept[el.dataset.concept]; }
  else return;
  persist();
}
function copyText(){
  const r = review(), out = [`סיכום בחינת תוכנית הפיתוח: תיק ${S.tik}, ${SETS[S.tik].title}`, today(), ''];
  let n = 0;
  DISC.forEach(d => {
    const rows = [];
    if(d.ask) d.ask.forEach(k => { const x = r.items[k]; if(x && x.n) rows.push(`${itemOf(k)[0]}: ${x.n}${x.d?' (בוצע)':''}`); });
    r.custom.filter(c => c.t===d.id).forEach(c => rows.push(`${c.n}${c.d?' (בוצע)':''}`));
    if(r.concept[d.id] || rows.length){ out.push(d.name); if(r.concept[d.id]) out.push('הקונספט: ' + r.concept[d.id]);
      rows.forEach((x, i) => out.push(`${i+1}. ${x}`)); out.push(''); n += rows.length + (r.concept[d.id] ? 1 : 0); }
  });
  const used = new Set(DISC.flatMap(d => d.ask || [])), rest = [];
  Object.keys(r.items).forEach(k => { if(!used.has(k) && r.items[k].n && itemOf(k)) rest.push(`${itemOf(k)[0]}: ${r.items[k].n}${r.items[k].d?' (בוצע)':''}`); });
  if(rest.length){ out.push('נוספות'); rest.forEach((x, i) => out.push(`${i+1}. ${x}`)); n += rest.length; }
  if(!n) return say('עוד אין מה להעתיק');
  const txt = out.join('\n').trim();
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => say(`הסיכום הועתק: ${n} שורות`), () => { window.prompt('העתקה:', txt); });
}
function stopRec(){ if(S.recObj){ try{ S.recObj.stop(); }catch(e){} } S.recObj = null; S.rec = null; }
function mic(key){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if(!SR) return;
  const same = S.rec===key; stopRec(); if(same){ markMic(); return; }
  const rec = new SR(); rec.lang = 'he-IL'; rec.continuous = true; rec.interimResults = false;
  rec.onresult = e => { let t = ''; for(let i = e.resultIndex; i < e.results.length; i++) if(e.results[i].isFinal) t += e.results[i][0].transcript;
    t = t.trim(); const el = document.querySelector(`[data-voice="${key}"]`); if(!t || !el) return;
    el.value = (el.value ? el.value.trim()+' ' : '') + t; if(el.tagName==='TEXTAREA') grow(el); saveField(el); };
  rec.onerror = e => say(e.error==='not-allowed' ? 'אין הרשאה למיקרופון' : 'ההקלטה נעצרה');
  rec.onend = () => { if(S.recObj===rec){ S.recObj = null; S.rec = null; markMic(); } };
  try{ rec.start(); S.recObj = rec; S.rec = key; markMic(); }catch(e){ say('ההקלטה לא התחילה'); }
}
function markMic(){ document.querySelectorAll('.ly-mic').forEach(b => { const on = b.dataset.mic===S.rec; b.classList.toggle('rec', on); b.textContent = on ? 'עצירה' : 'הקלטה'; }); }

function bind(){
  const el = body(), st = document.getElementById('lyStage');
  el.onclick = e => {
    const b = e.target.closest('button, input[type=checkbox]'); if(!b) return; const d = b.dataset;
    if(d.card){ window.openPlanCard(d.card); return; }
    if(d.state){ S.state = d.state; stopRec(); if(S.state !== 'design'){ if(S.walk) walkToggle(false); if(S.render && S.api) S.api.setRender(false); } else if(S.render && S.api) S.api.setRender(true); if(S.state!=='design' && S.mode!=='model'){ setMode('model').then(drawPanel); return; } drawTools(); applyDisc(); drawPanel(); }   // המבט נשאר זהה בין המצבים
    else if(d.env){ S.env = !S.env; applyApi(); drawTools(); sunNow(); }
    else if(d.fac){ S.fac = !S.fac; applyApi(); drawTools(); sunNow(); }
    else if(d.alt){ S.useAlt = !S.useAlt; S.fl = S.useAlt ? S.flAlt : S.flMain; S.cut = 0; S.fac = true; setMode(S.mode).then(() => { drawPanel(); sunNow(); }); }   // נספח הבינוי מול חלופת המצגת: המודל נבנה מחדש באותו מבט
    else if(d.under){ S.under = !S.under; applyApi(); drawTools(); sunNow(); }
    else if(d.map){ S.map = !S.map; S.streets = false; applyApi(); drawTools(); sunNow(); }
    else if(d.play){ playSun(!S.play); drawTools(); sunNow(); }
    else if(d.rights) fillRights();
    else if(d.step) go(S.d + (+d.step));
    else if(d.disc) go(+d.disc);
    else if(d.mode){ setMode(d.mode==='0' ? 'model' : 'draw'); }
    else if(d.view){ S.view = ['home','top','eye'][+d.view]; if(S.api) S.api.view(S.view); drawTools(); sunNow(); }
    else if(d.season){ S.season = +d.season; applyApi(); drawTools(); sunNow(); }
    else if(d.render){ S.render = !S.render; if(S.api) S.api.setRender(S.render).then(() => { drawTools(); sunNow(); }); drawTools(); }
    else if(d.walk){ walkToggle(!S.walk); }
    else if(d.tourbtn){ // טיול מהכפתור הגדול: עוברים לתוכנית הבינוי, מדליקים חזיתות, ומתחילים מהכניסה
      if(S.walk){ walkToggle(false); return; }
      const go2 = () => { if(!S.fac && S.fl){ S.fac = true; } applyApi(); walkToggle(true); };
      if(S.state !== 'design'){ const sb = document.querySelector('[data-state="design"]'); if(sb) sb.click(); setTimeout(go2, 400); } else go2(); }
    else if(d.wcmd){ if(S.api) S.api.walkCmd(d.wcmd); }
    else if(d.wind){ S.wind = !S.wind; applyApi(); drawTools(); sunNow(); }
    else if(d.kind){ if(S.off.has(d.kind)) S.off.delete(d.kind); else S.off.add(d.kind); if(S.api) S.api.setKind(d.kind, !S.off.has(d.kind)); b.classList.toggle('off', S.off.has(d.kind)); }
    else if(d.mic) mic(d.mic);
    else if(d.act==='copy') copyText();
    else if(d.act==='add'){ const inp = document.getElementById('lyNew'), v = inp.value.trim(); if(!v) return inp.focus(); review().custom.push({ t:DISC[S.d].id, n:v, d:false, at:today() }); persist(); drawPanel(); drawSteps(); }
    else if(d.goramp != null){ if(S.mode !== 'model'){ setMode('model').then(() => S.api && S.api.viewRamp(+d.goramp)); } else if(S.api) S.api.viewRamp(+d.goramp); }
    else if(d.addlv){ const c = ((S.lv||{}).checks||[])[+d.addlv]; if(!c) return; review().custom.push({ t:'walk', n:c.text, d:false, at:today(), src:'מפלסים' }); persist(); drawPanel(); drawSteps(); }
    else if(d.addg){ const f = (S._fs||[])[+d.addg]; if(!f) return; review().custom.push({ t:DISC[S.d].id==='all' ? f.disc : DISC[S.d].id, n:f.guide, d:false, at:today(), src:'ניתוח רב תשתיות' }); persist(); drawPanel(); drawSteps(); }
    else if(d.synst){ const [id, k] = d.synst.split('|'), r = review(); r.synergy = r.synergy || {}; r.synergy[id] = r.synergy[id]===k ? '' : k; persist(); drawPanel(); }
    else if(d.del){ review().custom.splice(+d.del.split('.')[1], 1); persist(); drawPanel(); drawSteps(); }
    else if(d.done){ const r = review(), k = d.done;
      if(k.startsWith('c.')) r.custom[+k.split('.')[1]].d = b.checked; else { const x = r.items[k] = r.items[k] || {}; x.d = b.checked; if(!x.d && !x.n) delete r.items[k]; }
      persist(); b.closest('.ly-it').classList.toggle('done', b.checked); drawSteps(); }
  };
  el.onchange = e => { if(e.target.matches('textarea')) saveField(e.target); };
  el.addEventListener('toggle', e => { const d = e.target; if(!d.dataset || !d.dataset.fold) return; if(d.open) S.open.add(d.dataset.fold); else S.open.delete(d.dataset.fold); if(d.open) d.querySelectorAll('textarea').forEach(grow); }, true);
  el.oninput = e => { const t = e.target;
    if(t.matches('textarea')) grow(t);
    else if(t.id==='lyHour'){ playSun(false); setHour(+t.value); }
    else if(t.id==='lyCut'){ S.cut = +t.value; document.getElementById('lyCutOut').textContent = cutLabel(); if(S.api) S.api.setCut(S.cut); }
    else if(t.id==='lyFloors'){ S.floors = +t.value; document.getElementById('lyFloorsOut').textContent = S.floors || 'בלי'; if(S.api){ S.api.setFloors(S.floors); S.api.setActive(DISC[S.d].layers); } }
    else if(t.id==='lyGap'){ S.gap = +t.value; drawSheets(); } };
  el.onkeydown = e => { if(e.key==='Enter' && e.target.id==='lyNew'){ e.preventDefault(); el.querySelector('[data-act="add"]').click(); } };
  // בשרטוט: גרירה מזיזה (או מסובבת כשיש הפרדה), גלגלת מקרבת. במודל: הבקר של המודל
  let drag = null;
  st.onpointerdown = e => { if(S.mode!=='draw') return; drag = { x:e.clientX, y:e.clientY }; st.setPointerCapture(e.pointerId); };
  st.onpointermove = e => { if(!drag) return; const dx = e.clientX-drag.x, dy = e.clientY-drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if(S.gap > 0 && !e.shiftKey){ S.rz += dx*.35; S.rx = Math.min(82, Math.max(0, S.rx-dy*.3)); } else { S.px += dx; S.py += dy; } drawSheets(); };
  st.onpointerup = st.onpointercancel = () => { drag = null; };
  st.addEventListener('wheel', e => { if(S.mode!=='draw') return; e.preventDefault(); S.zoom = Math.min(8, Math.max(.4, S.zoom*(e.deltaY < 0 ? 1.12 : .89))); drawSheets(); }, { passive:false });
}

/* ── חיבור לאפליקציה ── */
/* כניסה לתוכנית שיש לה מודל פותחת קודם את המודל. הכרטיס נפתח מהקישורים שבראש המסך, או בחזרה אחורה */
let _openCard = null, _cardNow = false;
window.openPlanCard = function(gid){ const p = plan(); if(!p || !_openCard) return; _cardNow = true;
  try{ _openCard(p.id); if(gid==='opinion' || gid==='forums'){ if(typeof ppTab==='function') ppTab(gid); setTimeout(() => { const el = document.getElementById('panel-'+gid); if(el) el.scrollIntoView({ block:'start' }); }, 80); } else if(gid && typeof ppGo==='function') ppGo(gid); } finally { _cardNow = false; } };
function hookOpenProject(){
  _openCard = window.openProject; if(typeof _openCard !== 'function') return;
  window.openProject = function(id, isBack){
    let p = null; try{ p = plans.find(x => x.id === id); }catch(e){}
    let mine = true; try{ mine = !(typeof isDeveloper==='function' && isDeveloper()) || devOwns(p); }catch(e){}
    if(p && SETS[String(p.tik)] && !_cardNow && !isBack && mine){ try{ currentProjectId = id; }catch(e){} return window.openLayers(p.tik); }
    return _openCard.apply(this, arguments);
  };
}
window.openLayers = function(tik){ if(tik && String(tik)!==S.tik){ S.tik = String(tik); S.man = null; } window.go('layers', null); };
window.layersLinkHTML = function(p){
  const s = p && SETS[String(p.tik)]; if(!s) return '';
  return `<div class="mat-row"><div class="mat-k">מודל התוכנית</div><div class="mat-items"><button class="mat-doc" onclick="openLayers('${H(p.tik)}')">מודל תלת־ממדי ובחינה לפי תחום</button></div></div>`;
};
window.layerSets = SETS;
function hashTik(){ const h = (location.hash||'').slice(1); return h==='layers' ? '' : h.startsWith('layers=') ? h.slice(7) : null; }
function boot(){
  if(typeof plans==='undefined' || typeof window.go!=='function' || !document.querySelector('.page') || !window.PlanModel) return setTimeout(boot, 60);
  ensurePage(); hookOpenProject();
  const _go = window.go;
  window.go = function(id, btn, isBack){
    if(id!=='layers'){ stopRec(); playSun(false); if(S.api){ S.api.dispose(); S.api = null; } }
    _go(id, btn, isBack);
    if(id==='layers'){ open(S.tik); const want = '#layers=' + (S.tik || Object.keys(SETS)[0]); if(location.hash!==want) history.replaceState(null, '', want); }
  };
  const route = () => { const t = hashTik(); if(t!==null){ if(t && t!==S.tik){ S.tik = t; S.man = null; } window.go('layers', null); } };
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { if(!document.getElementById('layers').classList.contains('active') || !S.man) return; if(S.api) S.api.resize(); else drawSheets(); });
  document.addEventListener('keydown', e => { if(!document.getElementById('layers').classList.contains('active') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if(e.key==='ArrowLeft') go(S.d+1); else if(e.key==='ArrowRight') go(S.d-1); });
  route();
}

const CSS = `
.ly-page{max-width:none !important;padding-bottom:0 !important}
.ly-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:-6px 0 6px}
.ly-title{font:400 14px var(--sans);color:var(--ink-soft);margin:0;white-space:nowrap}
.ly-approx{margin:0;font-size:12.5px;color:#8a5a00;background:#fff3d6;padding:2px 8px;white-space:nowrap}
@media (max-width:700px){.ly-approx{white-space:normal}}
.ly-title b{color:var(--ink);font-weight:600}
.ly-nav{display:flex;gap:3px;flex:none}
.ly-steprow{display:flex;gap:6px;align-items:stretch;margin-bottom:6px}
.ly-steprow .ly-steps{flex:1;min-width:0;margin-bottom:0}
.ly-states{margin-inline-start:auto}
.ly-links{display:flex;gap:3px;flex-wrap:wrap}
.ly-stage-chip{display:inline-flex;align-items:center;gap:5px;border:0 !important;background:#f6f5f1 !important;color:var(--ink) !important;font:400 12px var(--sans) !important;padding:4px 8px !important;cursor:pointer;border-radius:0 !important;box-shadow:inset 0 -2px 0 var(--teal)}
.ly-stage-chip i{font-style:normal;font-size:10.5px;color:var(--ink-mute)}
.ly-stage-chip b{font-weight:600;font-variant-numeric:tabular-nums}
.ly-stage-chip.past{box-shadow:inset 0 -2px 0 #c9c6bd;color:var(--ink-soft) !important}
.ly-stage-chip.none b{font-weight:400;color:var(--ink-mute)}
.ly-fold{box-shadow:inset 0 -1px 0 #e4e2dc}
.ly-fis{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.ly-fi{padding:8px 10px;background:#f6f5f1;box-shadow:inset -3px 0 0 #9a9890}
.ly-fi.gap{box-shadow:inset -3px 0 0 #c8202a}.ly-fi.ok{box-shadow:inset -3px 0 0 #2f7d3a}.ly-fi.opp{box-shadow:inset -3px 0 0 #e0a800}
.ly-fi-t{font:600 13.5px var(--sans);color:var(--ink)}
.ly-fi-f{font-size:12.5px;color:var(--ink-soft);margin-top:2px;line-height:1.5}.ly-fi-f b{color:var(--ink)}.ly-fi-f small{color:var(--ink-mute);font-size:11px}
.ly-fi-q{display:flex;gap:3px;margin-top:5px}.ly-fi-q span{font-size:10.5px;padding:1px 6px;background:#fff;color:var(--ink-mute)}.ly-fi-q span.on{background:#fde3e0;color:#9b1c1c;font-weight:600}
.ly-fi blockquote{margin:6px 0 4px;padding:5px 8px;background:#fff;font-size:12.5px;line-height:1.55;color:var(--ink);box-shadow:inset -2px 0 0 var(--teal)}
.ly-fi-add{padding:3px 10px !important;font-size:11.5px !important}.ly-fi-in{font-size:11px;color:#2f7d3a}
.ly-syn{list-style:none;margin:0;padding:0}.ly-syn li{display:grid;grid-template-columns:1fr auto;gap:1px 8px;padding:5px 2px;box-shadow:inset 0 -1px 0 #ecebe6;font-size:12.5px}
.ly-syn b{font-weight:600}.ly-syn span:nth-child(2){grid-column:1;color:var(--muted);font-size:11.5px}.ly-syn .ly-seg{grid-row:1 / 3;grid-column:2;align-self:center}
.ly-fold > summary{display:flex;justify-content:space-between;align-items:center;gap:8px;list-style:none;cursor:pointer;padding:9px 4px;font:600 13.5px var(--sans);color:var(--ink)}
.ly-fold > summary::-webkit-details-marker{display:none}
.ly-fold > summary::before{content:"+";font-weight:400;color:var(--ink-mute);width:12px}
.ly-fold[open] > summary::before{content:"−"}
.ly-fold > summary span{flex:1}
.ly-fold > summary b{font-weight:400;font-size:12px;color:var(--ink-soft);font-variant-numeric:tabular-nums}
.ly-fold > summary:hover{background:#f6f5f1}
.ly-fold[open]{padding-bottom:10px}
.ly-lead{font-size:14px;color:var(--ink-soft);line-height:1.5;margin:0 0 8px}
.ly-lead b{color:var(--ink)}
.ly-links button{border:0 !important;background:none !important;color:var(--teal) !important;font:400 13px var(--sans) !important;padding:4px 8px !important;cursor:pointer;border-radius:0 !important;box-shadow:inset 0 -1px 0 currentColor}
.ly-links button:hover{background:var(--teal-pale) !important}
.ly-b{border:0 !important;background:#f1f0ec !important;color:var(--ink) !important;padding:4px 12px !important;font:600 12.5px var(--sans) !important;border-radius:0 !important;cursor:pointer;box-shadow:0 1px 0 rgba(0,0,0,.14);transition:transform .12s,background .12s}
.ly-b:hover{background:var(--ink) !important;color:#fff !important;transform:translateY(-1px)}
.ly-next{background:var(--ink) !important;color:#fff !important}
.ly-states{display:flex;gap:2px}
.ly-states button{border:0 !important;background:#f1f0ec !important;padding:6px 14px !important;cursor:pointer;border-radius:0 !important;font:400 13.5px var(--sans) !important;color:var(--ink-soft) !important}
.ly-states button.on{background:var(--ink) !important;color:#fff !important;font-weight:600 !important}
.ly-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
.ly-tbl th{font-weight:600;color:var(--ink-mute);text-align:start;padding:3px 4px;font-size:11.5px}
.ly-tbl td{padding:5px 4px;box-shadow:inset 0 -1px 0 #ecebe6;font-variant-numeric:tabular-nums;vertical-align:top}
.ly-tbl i,.ly-zones i{display:inline-block;width:11px;height:11px;margin-inline-end:5px;vertical-align:-1px}
.ly-zones{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px}
.ly-src{font-size:11.5px;color:var(--muted);line-height:1.5;margin:14px 0}
.ly-steps{display:flex;gap:2px;overflow-x:auto;margin-bottom:6px}
.ly-steps button{flex:1 0 auto;display:flex;align-items:center;gap:7px;border:0 !important;background:#f6f5f1 !important;color:var(--ink-soft) !important;padding:5px 9px !important;font:400 12.5px var(--sans) !important;cursor:pointer;border-radius:0 !important;white-space:nowrap}
.ly-steps button u{width:10px;height:10px;background:var(--dc);flex:none;text-decoration:none}
.ly-steps button b{font-size:11px;font-weight:400;color:var(--muted);margin-inline-start:auto}
.ly-steps button.on{background:var(--dc) !important;color:#fff !important;font-weight:600 !important}
.ly-steps button.on u{background:#fff}
.ly-steps button.on b{color:rgba(255,255,255,.85)}
.ly-grid{display:grid;grid-template-columns:minmax(0,1fr) 372px;grid-template-rows:minmax(0,1fr) auto;gap:6px 12px;height:calc(100vh - 176px);min-height:440px}
.ly-stage{position:relative;overflow:hidden;background:#f4f3ef;touch-action:none;user-select:none;min-height:0;grid-column:1;grid-row:1}
.ly-panel{grid-column:2;grid-row:1 / 3}
.ly-view{position:absolute;inset:0;perspective:2600px;display:flex;align-items:center;justify-content:center}
.pm-canvas{width:100%;height:100%;display:block;cursor:grab}
.ly-world{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}
.ly-sheet{position:absolute;width:var(--w);height:var(--h);left:calc(var(--w) / -2);top:calc(var(--h) / -2);pointer-events:none}
.ly-sheet img{width:100%;height:100%;display:block}
.ly-sheet.glass{background:rgba(255,255,255,var(--glass,.3));box-shadow:0 0 0 1px rgba(31,92,88,.4)}
.ly-sheet.off{display:none}
.ly-tag{position:absolute;inset-inline-start:0;bottom:100%;background:var(--teal);color:#fff;font:600 22px var(--sans);padding:4px 12px;white-space:nowrap;display:none}
.ly-sheet.glass .ly-tag{display:block}
.ly-over{position:absolute;inset-inline-start:8px;top:8px;display:flex;gap:6px;align-items:baseline;pointer-events:none;background:rgba(255,255,255,.88);padding:2px 8px}
.ly-over b{font-size:14px;color:var(--ink)} .ly-over span{font-size:11.5px;color:var(--ink-soft)}
.ly-credit{position:absolute;inset-inline-start:8px;bottom:4px;font-size:10px;color:var(--ink-soft);background:rgba(255,255,255,.7);padding:0 4px;pointer-events:none}
.ly-north{position:absolute;inset-inline-end:8px;top:8px;width:36px;height:36px;background:rgba(255,255,255,.92);box-shadow:0 1px 3px rgba(0,0,0,.2);border-radius:50%;pointer-events:none}
.ly-north i{position:absolute;inset:0;display:block}
.ly-north i::before{content:"";position:absolute;left:50%;top:3px;margin-left:-6px;border:6px solid transparent;border-bottom:13px solid #c8202a;border-top:0}
.ly-north b{position:absolute;left:0;right:0;bottom:1px;text-align:center;font-size:10px;color:var(--ink)}
.ly-tools{grid-column:1;grid-row:2;display:flex;flex-wrap:wrap;align-items:center;gap:3px 10px;font-size:11px;color:var(--ink-mute);opacity:.92}

.ly-grp{display:inline-flex;align-items:center;gap:4px}
.ly-walk{position:absolute;inset-inline-end:8px;bottom:8px;display:flex;gap:8px;align-items:flex-end;pointer-events:none}
.ly-walk>*{pointer-events:auto}
.ly-mini{width:180px;height:180px;background:#f4f3ef;box-shadow:0 2px 10px rgba(0,0,0,.25);cursor:crosshair}
.ly-wpad{background:rgba(255,255,255,.94);box-shadow:0 2px 10px rgba(0,0,0,.2);padding:8px;display:flex;flex-direction:column;gap:6px;align-items:center;max-width:240px}
.ly-winfo{font-size:12.5px;color:var(--ink-soft);text-align:center} .ly-winfo b{color:var(--ink)}
.ly-wkeys{display:flex;gap:4px;align-items:center} .ly-wkeys>span{display:flex;flex-direction:column;gap:4px}
.ly-wkeys button{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:58px;padding:5px 6px !important;border:0 !important;background:#eeede8 !important;color:var(--ink) !important;cursor:pointer;border-radius:0 !important}
.ly-wkeys button:active,.ly-wkeys button:hover{background:var(--ink) !important;color:#fff !important}
.ly-wkeys small{font-size:10.5px}
.ly-whelp{margin:0;font-size:10.5px;color:var(--ink-mute);text-align:center;line-height:1.35}
.pm-canvas.pm-walk{cursor:crosshair}
.ly-tour{position:absolute;inset-inline-start:8px;bottom:24px;display:flex;align-items:center;gap:7px;padding:9px 14px !important;border:0 !important;background:#11998e !important;color:#fff !important;font:600 14px var(--sans) !important;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25);border-radius:0 !important;z-index:3}
.ly-tour:hover{background:#0c7d74 !important} .ly-tour.on{background:var(--ink) !important}
.ly-wkeys button.on{background:#11998e !important;color:#fff !important}
.pm-canvas.pm-render{filter:saturate(1.14) contrast(1.07) brightness(.98)}
.pm-render-wrap::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,transparent 58%,rgba(20,24,28,.30) 100%)}
@media (max-width:760px){.ly-mini{width:120px;height:120px}.ly-whelp{display:none}}
.ly-ib{display:inline-flex !important;align-items:center;justify-content:center;width:24px;height:22px;padding:0 !important}
.ly-ib svg{display:block}
.ly-grp b{color:var(--ink-soft);font-size:10.5px;font-weight:600}
.ly-tools input[type=range]{width:96px;accent-color:var(--ink);height:14px}
.ly-tools output{font-variant-numeric:tabular-nums;color:var(--ink);font-weight:600;min-width:36px}
.ly-mut{color:var(--ink-mute);font-size:11.5px}
.ly-seg{display:inline-flex;gap:2px}
.ly-seg button,.ly-tg{border:0 !important;background:#eeede8 !important;color:var(--ink-soft) !important;padding:2px 7px !important;font:400 11px var(--sans) !important;cursor:pointer;border-radius:0 !important}
.ly-seg button.on,.ly-tg.on{background:var(--ink) !important;color:#fff !important;font-weight:600 !important}
.ly-panel{overflow:auto;min-height:0;padding-inline-end:4px}
.ly-who{font-size:12px;color:var(--teal);font-weight:600}
.ly-h{font:600 20px var(--sans);margin:2px 0 6px;color:var(--ink)}
.ly-facts{list-style:none;margin:0 0 4px;padding:0;font-size:13.5px;line-height:1.55;color:var(--ink-soft)}
.ly-facts li{padding:3px 0;box-shadow:inset 0 -1px 0 #ecebe6}
.ly-facts b{color:var(--ink)}
.ly-warn{background:#fde3e0;color:#9b1c1c;padding:0 4px;font-weight:600}
.ly-sec{font-size:12px;font-weight:700;color:var(--ink);margin:14px 0 5px;display:flex;justify-content:space-between;align-items:baseline}
.ly-sec small{font-weight:400;color:var(--ink-mute);font-size:11.5px}
.ly-legend{display:grid;gap:2px}
.ly-lg{display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:start;border:0 !important;background:none !important;padding:5px 4px !important;text-align:start;cursor:pointer;border-radius:0 !important;font:400 13.5px var(--sans) !important;color:var(--ink) !important}
.ly-lg:hover{background:#f6f5f1 !important}
.ly-lg i{width:16px;height:16px;margin-top:2px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}
.ly-lg small{display:block;font-size:11.5px;color:var(--muted);line-height:1.4}
.ly-lg em{font-style:normal;font-size:12px;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap}
.ly-lg.off{opacity:.38}
.ly-items{list-style:none;margin:0;padding:0}
.ly-it{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:3px 8px;padding:7px 2px;box-shadow:inset 0 -1px 0 #ecebe6}
.ly-th{font-size:11.5px;font-weight:700;color:var(--c);padding:10px 2px 2px}
.ly-ck{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);cursor:pointer;padding-top:2px}
.ly-ck input{width:16px;height:16px;accent-color:#2f7d3a;margin:0}
.ly-lab{font-size:14px;color:var(--ink);line-height:1.4}
.ly-it.done .ly-lab{color:var(--muted);text-decoration:line-through}
.ly-x{border:0;background:none;color:var(--ink-mute);font-size:16px;cursor:pointer;padding:0 4px}
.ly-it .ly-note{grid-column:2 / -1}
.ly-note{display:grid;grid-template-columns:1fr auto;gap:4px 6px;align-items:start}
.ly-note textarea,.ly-add input{width:100%;border:0;background:#fff;box-shadow:inset 0 0 0 1px #dcdad3;padding:6px 8px;font:400 13px var(--sans);color:var(--ink);resize:none;border-radius:0;box-sizing:border-box;overflow:hidden}
.ly-note textarea:focus,.ly-add input:focus{outline:2px solid var(--teal);outline-offset:0}
.ly-mic{border:0;background:#f1f0ec;color:var(--ink);font:600 12px var(--sans);padding:7px 10px;cursor:pointer}
.ly-mic.rec{background:#b3202a;color:#fff;animation:lyrec 1.2s infinite}
@keyframes lyrec{50%{opacity:.55}}
.ly-add{display:flex;gap:6px;margin-top:10px}
.ly-cfoot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0 10px}
.ly-cfoot small{font-size:11.5px;color:var(--muted)}
.ly-empty{color:var(--muted);padding:40px 16px}
@media (max-width:1000px){.ly-grid{grid-template-columns:1fr;grid-template-rows:auto;height:auto}.ly-stage{height:62vh}.ly-panel{grid-column:1;grid-row:auto}}
@media (prefers-reduced-motion:reduce){.ly-mic.rec{animation:none}}
`;
boot();
})();
