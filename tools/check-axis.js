#!/usr/bin/env node
// בדיקת "ציר תוכניות" (plans-axis.js): הפונקציות הטהורות, מול רחוב סינתטי ומול שכבת הרחובות העירונית.
// הרצה: node tools/check-axis.js
const fs = require('fs');
const path = require('path');
const A = require('../plans-axis.js');

let fail = 0;
const ok = (c, msg) => { console.log((c ? '✓ ' : '✗ ') + msg); if(!c) fail++; };

// 1) רחוב סינתטי צפון־דרום, שני מקטעים (MultiLineString), באורך ~1.1 ק"מ
const synth = { type:'FeatureCollection', features:[
  { type:'Feature', properties:{ st_code:500, name:'שד בדיקה', hierarchy:1, quarter:'רובע א' },
    geometry:{ type:'LineString', coordinates:[[34.65,31.81],[34.65,31.805]] } },
  { type:'Feature', properties:{ st_code:500, name:'שד בדיקה', hierarchy:3, quarter:'רובע ב' },
    geometry:{ type:'MultiLineString', coordinates:[[[34.65,31.805],[34.65,31.80]]] } },
  { type:'Feature', properties:{ st_code:0, name:'סמטה', hierarchy:3 }, geometry:{ type:'LineString', coordinates:[[34.66,31.80],[34.661,31.80]] } },
  { type:'Feature', properties:{ st_code:1 }, geometry:{ type:'LineString', coordinates:[[34.67,31.80],[34.671,31.80]] } }
]};
const ax = A.buildAxes(synth);
ok(ax.size === 2, 'מקטעים מאוחדים לפי סמל רחוב, ובלי סמל לפי שם; בלי שם ובלי סמל לא נכנס (' + ax.size + ' צירים)');
const a = ax.get('c500');
ok(a && a.lines.length === 2 && a.rank === 1, 'הציר כולל את שני המקטעים, והדרגה הבולטת היא 1');
const m = 1/111320;                      // מעלה לכל מטר (רוחב גאוגרפי)
const lngM = 1/(111320*Math.cos(31.805*Math.PI/180));
const items = [
  { id:1, lat:31.801, lng:34.65 + 20*lngM },   // דרום, 20 מ'
  { id:2, lat:31.809, lng:34.65 - 50*lngM },   // צפון, 50 מ'
  { id:3, lat:31.805, lng:34.65 + 59*lngM },   // אמצע, 59 מ'
  { id:4, lat:31.807, lng:34.65 + 80*lngM }    // 80 מ': מחוץ לציר
];
const d1 = A.nearestOnAxis(a, items[0].lat, items[0].lng).d;
ok(Math.abs(d1 - 20) < 0.5, 'מרחק לקו הרחוב במטרים: ' + d1.toFixed(1) + ' (צפוי 20)');
const hits = A.plansOnAxis(a, items);
ok(hits.map(h => h.it.id).join(',') === '2,3,1', 'סדר לאורך הרחוב מצפון לדרום, ו-80 מ\' נשאר בחוץ: ' + hits.map(h => h.it.id).join(','));
ok(A.principal(a).from === 'צפון', 'רחוב צפון־דרום מסודר מצפון');
const ins = A.axisInsight(a, hits);
ok(/^\*\*3\*\* תוכניות לאורך שד בדיקה, /.test(ins) && ins.split(/\s+/).length <= 8, 'שורת תובנה עד 8 מילים: ' + ins);
ok(A.axisInsight(a, hits.slice(0,1)).includes('בחלק הצפוני'), 'תוכנית אחת בצפון: "בחלק הצפוני"');
const near = A.nearestAxis(ax, 31.803, 34.65 + 30*lngM);
ok(near && near.axis.key === 'c500' && Math.abs(near.d - 30) < 1, 'הרחוב הקרוב לתוכנית: ' + (near && near.axis.name));
ok(A.nearestAxis(ax, 31.83, 34.70) === null, 'אין רחוב בטווח 150 מ\': null');
ok(A.rankLabel(1) === 'שדרה ראשית' && A.rankLabel(2) === 'רחוב ראשי' && A.rankLabel(7) === 'לא מסווג', 'תוויות המידרג');
void m;

// 2) שכבת הרחובות העירונית
const fc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'geo', 'ashdod-streets.geojson'), 'utf8'));
ok(!fc.features.some(f => f.properties.hierarchy === 9), 'אין רצועות חניה (מידרג 9) בעותק');
const big = A.buildAxes(fc);
const herzl = [...big.values()].find(x => x.name === 'שד הרצל');
ok(herzl && herzl.rank === 1, 'שד הרצל קיים כשדרה ראשית (' + (herzl ? herzl.lines.length + ' מקטעים' : 'חסר') + ')');
console.log('  ' + fc.features.length + ' מקטעים, ' + big.size + ' צירים');

if(fail){ console.error(fail + ' בדיקות נכשלו'); process.exit(1); }
console.log('כל בדיקות הציר עברו');
