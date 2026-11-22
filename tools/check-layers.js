#!/usr/bin/env node
// בדיקת מסך "שכבות" (plans-layers.js, plans-model.js): קבצים, הפניות, עיגון למפה וחישוב השמש.
// הרצה: node tools/check-layers.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = fs.readFileSync(path.join(root, 'plans-layers.js'), 'utf8');
const P = require('../plans-model.js');
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fail++; };
const sets = [...src.matchAll(/dir:'(layers\/[^']+)'/g)].map(m => m[1]);
ok(sets.length > 0, sets.length + ' ערכות שכבות רשומות');
const used = new Set([...src.matchAll(/\['[^']+',\[([^\]]+)\]\]/g)].flatMap(m => m[1].replace(/'/g, '').split(',')));
const topics = {}; let cur = null;
for(const m of src.matchAll(/\{ id:'(\w+)', name:'[^']+', color:|\['[^']+',\[[^\]]+\]\]/g)){ if(m[1]){ cur = m[1]; topics[cur] = 0; } else if(cur) topics[cur]++; }
const asks = [...src.matchAll(/ask:\[([^\]]+)\]/g)].flatMap(m => m[1].replace(/'/g, '').split(','));
const badAsk = asks.filter(k => { const [t, i] = k.split('.'); return !(topics[t] > +i); });
ok(!badAsk.length, 'כל דרישה שתחום מפנה אליה קיימת' + (badAsk.length ? ' (שגוי: ' + badAsk.join(', ') + ')' : ' (' + asks.length + ' הפניות)'));
const names = new Set([...src.match(/const LAYER_NAME = \{([^}]+)\}/)[1].matchAll(/(\w+):'/g)].map(m => m[1]));
ok(P.KINDS.every(k => names.has(k.topic)), 'לכל סוג במקרא יש שכבה מוכרת');
ok(P.KINDS.every(k => k.label && k.desc && /^#[0-9a-f]{6}$/.test(k.color)), 'לכל סוג במקרא יש שם, הסבר וצבע (' + P.KINDS.length + ' סוגים)');
for(const dir of sets){
  const man = JSON.parse(fs.readFileSync(path.join(root, dir, 'manifest.json'), 'utf8')), ids = man.layers.map(l => l.id);
  ok(man.layers.every(l => fs.existsSync(path.join(root, dir, l.file))), dir + ': כל ' + ids.length + ' קובצי השכבות קיימים');
  const miss = [...used].filter(id => !ids.includes(id));
  ok(!miss.length, dir + ': כל שכבה שדרישה מפנה אליה קיימת' + (miss.length ? ' (חסר: ' + miss.join(', ') + ')' : ''));
  ok(!man.unassigned.length, dir + ': אין שכבות שרטוט לא משויכות');
  const m = JSON.parse(fs.readFileSync(path.join(root, dir, 'model.json'), 'utf8')), ms = P.measure(m);
  const unknown = [...Object.keys(m.surf), ...Object.keys(m.lines), ...Object.keys(m.obj)].filter(k => !P.KIND[k]);
  ok(!unknown.length, dir + ': כל סוג במודל מופיע במקרא' + (unknown.length ? ' (חסר: ' + unknown.join(', ') + ')' : ''));
  const [lat, lng] = P.itm2wgs(m.e0, m.n0), back = P.wgs2itm(lat, lng);
  ok(lat > 31.74 && lat < 31.85 && lng > 34.6 && lng < 34.72, dir + ': המודל ממוקם באשדוד (' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ')');
  ok(Math.hypot(back[0]-m.e0, back[1]-m.n0) < 0.05, dir + ': המרה לרשת ישראל ובחזרה מדויקת עד 5 ס"מ');
  ok(ms.count.treeNew > 0 && ms.count.fire > 0 && ms.area.paving > 0, dir + ': במודל יש עצים (' + ms.count.treeNew + '), רחבות כיבוי (' + ms.count.fire + ') וריצוף (' + ms.area.paving + ' מ"ר)');
  const rf = path.join(root, dir, 'renewal.json');
  if(fs.existsSync(rf)){ // התב"ע והשרטוט באותו מקום: קו הגבול שבשרטוט יושב על צלעות מגרשי התב"ע
    const rn = JSON.parse(fs.readFileSync(rf, 'utf8')), loc = c => { const [E, N] = P.wgs2itm(c[1], c[0]); return [E-m.e0, N-m.n0]; };
    const segs = []; rn.parcels.forEach(p => { const c = p.c.map(loc); c.forEach((a, i) => { const b = c[(i+1)%c.length]; segs.push([a[0], a[1], b[0], b[1]]); }); });
    const dseg = (p, s) => { const vx = s[2]-s[0], vy = s[3]-s[1], l = vx*vx+vy*vy || 1e-9; let t = ((p[0]-s[0])*vx+(p[1]-s[1])*vy)/l; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0]-s[0]-t*vx, p[1]-s[1]-t*vy); };
    const ds = []; (m.lines.plot||[]).forEach(f => { for(let i = 0; i < f.length; i += 2){ const p = [f[i]/10, f[i+1]/10]; ds.push(Math.min(...segs.map(g => dseg(p, g)))); } }); ds.sort((a, b) => a-b);
    ok(ds.length > 20 && ds[ds.length >> 1] < 0.5, dir + ': השרטוט מכויל למגרשי התב"ע (סטייה חציונית ' + (ds[ds.length >> 1]||0).toFixed(2) + " מ')");
    ok(rn.lots.every(l => rn.massing.some(x => x.lot===l.lot)) && rn.massing.every(x => P.ZONES[x.cat]) && rn.parcels.every(x => P.ZONES[x.cat]), dir + ': לכל מגרש בתב"ע יש נפח וייעוד מהמקרא');
  }
  const big = fs.statSync(path.join(root, dir, 'model.json')).size + man.layers.reduce((s, l) => s + fs.statSync(path.join(root, dir, l.file)).size, 0);
  ok(big < 7e6, dir + ': משקל ' + (big/1e6).toFixed(1) + 'MB');
}
const noon = P.sunPos(P.ilDate(2026, 6, 21, 12.7), 31.8, 34.65), eve = P.sunPos(P.ilDate(2026, 12, 21, 16), 31.8, 34.65);
ok(noon.alt*180/Math.PI > 78 && Math.abs(noon.az*180/Math.PI - 180) < 12, 'שמש: 21.6 בצהריים גבוהה ובדרום (' + (noon.alt*180/Math.PI).toFixed(0) + '°)');
ok(eve.alt*180/Math.PI > 2 && eve.alt*180/Math.PI < 12 && eve.az > Math.PI, 'שמש: 21.12 ב-16:00 נמוכה ובדרום־מערב (' + (eve.alt*180/Math.PI).toFixed(0) + '°)');
const all = src + fs.readFileSync(path.join(root, 'plans-model.js'), 'utf8');
ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(all), 'אין אמוג\'י בקבצים');
if(fail){ console.error(fail + ' בדיקות נכשלו'); process.exit(1); }
console.log('כל בדיקות השכבות עברו');
