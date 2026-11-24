#!/usr/bin/env node
// בדיקת טבלה 5 לפי מגרש (data/table5/<תיק>.json, מ-tools/table5.py): מבנה, ערכים, והתאמה ל-plan_models.
// הרצה: node tools/check-table5.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'data', 'table5');
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fail++; };
const files = fs.readdirSync(dir).filter(f => /^\d+\.json$/.test(f));
ok(files.length > 0, files.length + ' טבלאות');
for(const f of files){
  const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), tik = t.tik, keys = new Set(t.columns.map(c => c.key));
  ok(t.taba && t.source && t.pages && t.pages.length, tik + ': יש תב"ע, מקור ועמודים (' + t.taba + ", עמ' " + t.pages.join(',') + ')');
  ok(t.rows.every(r => /^\d+$/.test(r.lot) && (r.total_row || r.use)), tik + ': לכל שורה מגרש ושימוש (' + t.rows.length + ' שורות, ' + new Set(t.rows.map(r => r.lot)).size + ' מגרשים)');
  const bad = t.rows.flatMap(r => Object.keys(r).filter(k => keys.has(k) && typeof r[k] !== 'number').map(k => r.lot + '.' + k));
  ok(!bad.length, tik + ': כל ערך מותר הוא מספר' + (bad.length ? ' (' + bad.slice(0, 5).join(', ') + ')' : ''));
  const refs = [...new Set(t.rows.flatMap(r => Object.values(r.notes || {}).flat()))], noText = refs.filter(n => !(t.notes || {})[n]);
  ok(!noText.length, tik + ': לכל הפניה להערה יש נוסח (' + refs.length + ' הערות)' + (noText.length ? ' חסר: ' + noText.join(',') : ''));
  ok(!t.rows.some(r => r.raw), tik + ': אין תא שלא נקרא');
  if(!t.check.length && t.xls) ok(t.xls.ok && t.xls.rows === t.rows.length, tik + ': כל ' + t.xls.rows + ' השורות תואמות לטבלת הזכויות של תכנון זמין (אין לתב"ע plan_models)');
  else ok(t.check.length > 0 && t.check.every(c => c.ok), tik + ': כל ' + t.check.length + ' המגרשים תואמים ל-plan_models (יח"ד, גובה, קומות, גודל מגרש)');
  const fx = path.join(dir, tik + '.fix.json');
  if(fs.existsSync(fx)){ const x = JSON.parse(fs.readFileSync(fx, 'utf8')); ok(!!x.source, tik + ': לתיקונים הידניים יש מקור (' + Object.keys(x.notes || {}).length + ' הערות, ' + (x.cells || []).length + ' תאים)'); }
}
if(fail){ console.error(fail + ' בדיקות נכשלו'); process.exit(1); }
console.log('כל בדיקות טבלה 5 עברו');
