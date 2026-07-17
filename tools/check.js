#!/usr/bin/env node
// בדיקת תקינות לפני commit: תחביר + כפילויות שמות ברמת האפליקציה.
// שתי התנגשויות שמות (_val, renderSpatial) כבר שברו פיצ'רים בעבר — הסקריפט הזה סוגר את המחלקה הזו.
// הרצה: node tools/check.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
const js = blocks.map(b => b[1]).join('\n');
const tmp = path.join(require('os').tmpdir(), 'plans-gh-check.js');
fs.writeFileSync(tmp, js);

let failed = false;

// 1) תחביר
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  console.log('✓ תחביר JS תקין (' + blocks.length + ' בלוק סקריפט)');
} catch (e) {
  failed = true;
  console.error('✗ שגיאת תחביר:\n' + String(e.stderr));
}

// 2) כפילויות שמות פונקציות ומשתנים גלובליים
const fnNames = {};
for (const m of js.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) fnNames[m[1]] = (fnNames[m[1]] || 0) + 1;
const varNames = {};
for (const m of js.matchAll(/^(?:let|var|const)\s+([A-Za-z_$][\w$]*)\s*[=;]/gm)) varNames[m[1]] = (varNames[m[1]] || 0) + 1;
const dupFns = Object.entries(fnNames).filter(([, n]) => n > 1);
const dupVars = Object.entries(varNames).filter(([, n]) => n > 1);
if (dupFns.length || dupVars.length) {
  failed = true;
  if (dupFns.length) console.error('✗ פונקציות מוכרזות פעמיים (המאוחרת דורסת בשקט!): ' + dupFns.map(([k, n]) => k + '×' + n).join(', '));
  if (dupVars.length) console.error('✗ משתנים גלובליים מוכרזים פעמיים: ' + dupVars.map(([k, n]) => k + '×' + n).join(', '));
} else {
  console.log('✓ אין כפילויות שמות (' + Object.keys(fnNames).length + ' פונקציות)');
}

// 3) תחביר של פונקציית ה-API
try {
  execFileSync(process.execPath, ['--check', path.join(root, 'api', 'assistant.js')], { stdio: 'pipe' });
  console.log('✓ api/assistant.js תקין');
} catch (e) {
  failed = true;
  console.error('✗ api/assistant.js: ' + String(e.stderr));
}

process.exit(failed ? 1 : 0);
