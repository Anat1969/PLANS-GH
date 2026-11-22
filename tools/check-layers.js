#!/usr/bin/env node
// בדיקת מסך "שכבות" (plans-layers.js): כל שכבה שדרישה מפנה אליה קיימת במניפסט, וכל קובץ שכבה קיים.
// הרצה: node tools/check-layers.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = fs.readFileSync(path.join(root, 'plans-layers.js'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fail++; };
const sets = [...src.matchAll(/dir:'(layers\/[^']+)'/g)].map(m => m[1]);
ok(sets.length > 0, sets.length + ' ערכות שכבות רשומות');
const used = new Set([...src.matchAll(/\['[^']+',\[([^\]]+)\]\]/g)].flatMap(m => m[1].replace(/'/g, '').split(',')));
const topicOf = Object.fromEntries([...src.match(/const LAYER_TOPIC = \{([\s\S]*?)\};/)[1].matchAll(/(\w+):'(\w+)'/g)].map(m => [m[1], m[2]]));
for(const dir of sets){
  const man = JSON.parse(fs.readFileSync(path.join(root, dir, 'manifest.json'), 'utf8')), ids = man.layers.map(l => l.id);
  ok(man.layers.every(l => fs.existsSync(path.join(root, dir, l.file))), dir + ': כל ' + ids.length + ' קובצי השכבות קיימים');
  const miss = [...used].filter(id => !ids.includes(id));
  ok(!miss.length, dir + ': כל שכבה שדרישה מפנה אליה קיימת' + (miss.length ? ' (חסר: ' + miss.join(', ') + ')' : ''));
  const noTopic = ids.filter(id => !topicOf[id]);
  ok(!noTopic.length, dir + ': לכל שכבה יש נושא' + (noTopic.length ? ' (בלי נושא: ' + noTopic.join(', ') + ')' : ''));
  ok(!man.unassigned.length, dir + ': אין שכבות שרטוט לא משויכות' + (man.unassigned.length ? ' (' + man.unassigned.length + ')' : ''));
  const big = man.layers.map(l => fs.statSync(path.join(root, dir, l.file)).size).reduce((a, b) => a + b, 0);
  ok(big < 6e6, dir + ': משקל השכבות ' + (big/1e6).toFixed(1) + 'MB');
}
if(/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(src)) ok(false, 'אין אמוג\'י בקובץ'); else ok(true, 'אין אמוג\'י בקובץ');
if(fail){ console.error(fail + ' בדיקות נכשלו'); process.exit(1); }
console.log('כל בדיקות השכבות עברו');
