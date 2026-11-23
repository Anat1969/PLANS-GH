#!/usr/bin/env node
// בדיקת "תכנון רב תשתיות" (plans-infra.js): כרטיסים, רתימות וכללי הניתוח.
// הרצה: node tools/check-infra.js
const PI = require('../plans-infra.js'), P = require('../plans-model.js');
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fail++; };
const DISCS = ['arch','traffic','walk','land','water','power','waste','fire'];
ok(PI.INFRA.every(x => x.need && x.special && x.gives && x.rules.length && x.rules.length <= 3 && x.rules.every(r => r[0] && r[1])), `לכל תשתית: צריכה, ייחוד, נתינה, ועד 3 כללי אצבע עם מקור (${PI.INFRA.length} תשתיות)`);
ok(PI.INFRA.every(x => DISCS.includes(x.disc)), 'כל תשתית שייכת לתחום של מסך המודל');
ok(PI.SYNERGY.every(s => PI.INF[s.a] && PI.INF[s.b] && s.a !== s.b && s.how && s.gain), `כל רתימה: שתי תשתיות שונות וקיימות, "איך" ו"מה מרוויחים" (${PI.SYNERGY.length} רתימות)`);
ok(new Set(PI.SYNERGY.map(s => [s.a, s.b].sort().join('|'))).size === PI.SYNERGY.length, 'אין שתי רתימות לאותו זוג');
const m = require('../layers/1913/model.json'), rn = require('../layers/1913/renewal.json'), fs = PI.analyze({ meas:P.measure(m), model:m, rn });
ok(fs.length > 0 && fs.every(f => DISCS.includes(f.disc) && PI.INF[f.infra] && f.title && f.fact && f.basis), `תיק 1913: ${fs.length} ממצאים, לכל אחד תחום, תשתית, ממצא ומקור`);
ok(fs.every(f => f.ok !== false || f.guide), 'לכל פער יש הנחיה לייעול');
ok(fs.every(f => !f.syn || PI.SYNERGY.some(s => s.id === f.syn)), 'כל ממצא מפנה לרתימה קיימת');
ok(fs.every(f => f.hits.every(h => PI.Q.includes(h))), 'המדדים הם מתוך ארבעה: ' + PI.Q.join(', '));
ok(fs.some(f => f.disc === 'fire' && f.ok === false && /עמוד תאורה/.test(f.fact)), 'תיק 1913: נמצא עמוד התאורה בתוך רחבת כיבוי');
// המבט העירוני
const R = PI.cityRollup, syn = id => r => r.syn.find(s => s.id === id);
const one = R([{ tik:1913, findings:fs, marks:{} }]);
ok(one.n === 1 && !one.syn.some(s => s.city) && syn('drain-trees')(one).no.length === 1, 'תוכנית אחת: הרתימה חסרה, אבל "מוקדם לקבוע" ולא הנחיה עירונית');
const bad = [{ syn:'drain-trees', ok:false, hits:['חסכוני'] }];
const two = R([{ tik:1, findings:bad }, { tik:2, findings:bad }, { tik:3, findings:[], marks:{ 'drain-trees':'yes' } }]);
ok(syn('drain-trees')(two).city && syn('drain-trees')(two).no.length === 2 && two.syn[0].id === 'drain-trees', 'חסרה ב-2 מתוך 3: הנחיה עירונית, בראש הרשימה');
ok(two.q['חסכוני'] === 2, 'ספירת המדדים לפי הממצאים שנפגעו');
const man = R([{ tik:1, findings:bad, marks:{ 'drain-trees':'yes' } }, { tik:2, findings:bad, marks:{ 'drain-trees':'na' } }]);
ok(syn('drain-trees')(man).no.length === 0 && !syn('drain-trees')(man).city, 'סימון ידני גובר על הניתוח');
const empty = R([{ tik:1, findings:[] }]);
ok(empty.syn.every(s => s.yes.length === 0 && s.open.length === 1), 'תוכנית בלי ממצא לרתימה: "לא נבדק", לא "קיים"');
if(fail){ console.error(fail + ' בדיקות נכשלו'); process.exit(1); }
console.log('כל בדיקות התשתיות עברו');
