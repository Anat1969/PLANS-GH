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
if(fail){ console.error(fail + ' בדיקות נכשלו'); process.exit(1); }
console.log('כל בדיקות התשתיות עברו');
