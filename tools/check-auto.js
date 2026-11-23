#!/usr/bin/env node
// בדיקת ההפקה האוטומטית (tools/auto-model.py): הרישום ב-layers/index.json, הסטטוס, והכיול.
// הרצה: node tools/check-auto.js
// הבדיקה המלאה מול ה-PDF של 1913 (חוזר לעיגון הידני עד 10 ס"מ, ותב"ע שגויה לא "מכוילת") נמצאת ב-CLAUDE.md, כי ה-PDF לא בריפו.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'), P = require('../plans-model.js');
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fail++; };
// ההמרה לרשת ישראל ב-Python זהה לזו של plans-model.js
const pts = [[31.8017, 34.6475], [31.77, 34.62], [31.84, 34.68]];
const py = JSON.parse(cp.execFileSync('python3', ['-c', `import sys,json,importlib.util as u; s=u.spec_from_file_location('am', sys.argv[1]); m=u.module_from_spec(s); s.loader.exec_module(m); print(json.dumps([m.wgs2itm(a,b) for a,b in ${JSON.stringify(pts)}]))`, path.join(root, 'tools/auto-model.py')]).toString());
ok(pts.every((p, i) => { const j = P.wgs2itm(p[0], p[1]); return Math.hypot(j[0]-py[i][0], j[1]-py[i][1]) < 0.001; }), 'ההמרה לרשת ישראל זהה ב-Python וב-JS (עד מילימטר)');
const idx = JSON.parse(fs.readFileSync(path.join(root, 'layers/index.json'), 'utf8')), keys = Object.keys(idx);
ok(true, keys.length + ' מודלים אוטומטיים ב-layers/index.json');
for(const k of keys){
  const s = idx[k], dir = path.join(root, s.dir), has = f => fs.existsSync(path.join(dir, f));
  ok(/^layers\/\d+$/.test(s.dir) && has('model.json') && has('manifest.json') && has('auto.json'), k + ': יש מודל, שכבות ו-auto.json');
  const a = JSON.parse(fs.readFileSync(path.join(dir, 'auto.json'), 'utf8')), m = JSON.parse(fs.readFileSync(path.join(dir, 'model.json'), 'utf8'));
  ok(['calibrated', 'approx'].includes(a.status) && a.status === s.auto, k + ': הסטטוס ' + a.status + ' זהה ברישום');
  ok(a.status === 'approx' ? !has('renewal.json') && !s.renewal : has('renewal.json') && s.renewal && a.median < 0.5, k + (a.status === 'approx' ? ': משוער, בלי תב"ע ובלי מעטפת' : ': מכויל, סטייה ' + a.median + " מ'"));
  const [lat, lng] = P.itm2wgs(m.e0, m.n0); ok(lat > 31.74 && lat < 31.85 && lng > 34.6 && lng < 34.72, k + ': המודל באשדוד');
}
if(fail){ console.error(fail + ' בדיקות נכשלו'); process.exit(1); }
console.log('כל בדיקות ההפקה האוטומטית עברו');
