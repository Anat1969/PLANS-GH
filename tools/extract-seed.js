#!/usr/bin/env node
// חילוץ חד-פעמי: מוציא את SEED_OPINIONS / SEED_FIELDS / SEED_RENDERS (~1MB)
// מתוך index.html אל seed-data.json, ומחליף את ההגדרות במשתנים ריקים שנטענים בריצה.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const lines = html.split('\n');

// איתור שלוש השורות
const idx = {};
['SEED_OPINIONS', 'SEED_FIELDS', 'SEED_RENDERS'].forEach(name => {
  idx[name] = lines.findIndex(l => l.startsWith('const ' + name + ' = {') || l.startsWith('const ' + name + ' ='));
  if (idx[name] < 0) { console.error('לא נמצא: ' + name); process.exit(1); }
});

// הערכת הערכים ב-sandbox נקי (כל אחת מהשורות היא ביטוי const שלם)
const sb = {};
vm.createContext(sb);
Object.keys(idx).forEach(name => {
  vm.runInContext(lines[idx[name]].replace(/^const /, 'globalThis.' + name + '_V = ').replace(name + ' =', ''), sb);
});
const data = {
  opinions: sb.SEED_OPINIONS_V || null,
  fields: sb.SEED_FIELDS_V || null,
  renders: sb.SEED_RENDERS_V || null,
};
if (!data.opinions || !data.fields || !data.renders) { console.error('החילוץ נכשל'); process.exit(1); }
console.log('opinions:', Object.keys(data.opinions).length, '· fields:', Object.keys(data.fields).length, '· renders:', Object.keys(data.renders).length);

fs.writeFileSync(path.join(root, 'seed-data.json'), JSON.stringify(data));
console.log('seed-data.json:', (fs.statSync(path.join(root, 'seed-data.json')).size / 1024).toFixed(0) + 'KB');

// החלפת השורות בהצהרות ריקות (נטענות ב-loadSeedData)
lines[idx.SEED_OPINIONS] = 'let SEED_OPINIONS = {}; // נטען מ-seed-data.json (חולץ מהקובץ להאצת הטעינה)';
lines[idx.SEED_FIELDS]   = 'let SEED_FIELDS = {};   // נטען מ-seed-data.json';
lines[idx.SEED_RENDERS]  = 'let SEED_RENDERS = {};  // נטען מ-seed-data.json';
fs.writeFileSync(htmlPath, lines.join('\n'));
console.log('index.html עכשיו:', (fs.statSync(htmlPath).size / 1024).toFixed(0) + 'KB');
