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
  const cpath = path.join(root, dir, 'concept.json'), concept = fs.existsSync(cpath) ? JSON.parse(fs.readFileSync(cpath, 'utf8')) : null;   // תכנון רעיוני (tools/concept-model.py)
  const miss = [...used].filter(id => !ids.includes(id));
  if(concept) ok(src.includes("'" + concept.tik + "': { dir:'" + dir + "'") && /concept:true/.test(src), dir + ': תכנון רעיוני, רשום עם concept:true (אין עדיין תוכנית פיתוח, ולכן אין שכבות לכל הדרישות)');
  else if(man.raster){ // תוכנית העמדה מתמונה: מה שאין בתמונה חייב להיות רשום כחסר, כדי שהמסך יאמר זאת
    const undeclared = miss.filter(id => !(man.missing||[]).includes(id));
    ok(!undeclared.length, dir + ': תמונה. ' + miss.length + ' שכבות שאין בתמונה רשומות כחסרות' + (undeclared.length ? ' (לא רשום: ' + undeclared.join(', ') + ')' : ''));
  } else ok(!miss.length, dir + ': כל שכבה שדרישה מפנה אליה קיימת' + (miss.length ? ' (חסר: ' + miss.join(', ') + ')' : ''));
  ok(!man.unassigned.length, dir + ': אין שכבות שרטוט לא משויכות');
  const m = JSON.parse(fs.readFileSync(path.join(root, dir, 'model.json'), 'utf8')), ms = P.measure(m);
  const unknown = [...Object.keys(m.surf), ...Object.keys(m.lines), ...Object.keys(m.obj)].filter(k => !P.KIND[k]);
  ok(!unknown.length, dir + ': כל סוג במודל מופיע במקרא' + (unknown.length ? ' (חסר: ' + unknown.join(', ') + ')' : ''));
  const [lat, lng] = P.itm2wgs(m.e0, m.n0), back = P.wgs2itm(lat, lng);
  ok(lat > 31.74 && lat < 31.85 && lng > 34.6 && lng < 34.72, dir + ': המודל ממוקם באשדוד (' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ')');
  ok(Math.hypot(back[0]-m.e0, back[1]-m.n0) < 0.05, dir + ': המרה לרשת ישראל ובחזרה מדויקת עד 5 ס"מ');
  if(man.raster) ok(ms.count.treeNew > 0 && ms.count.foot > 0 && ms.area.paving > 0 && (m.parts||[]).length > 0, dir + ': במודל יש עצים (' + ms.count.treeNew + '), מבנים (' + ms.count.foot + '), חלקי בניין (' + (m.parts||[]).length + ') וריצוף (' + ms.area.paving + ' מ"ר)');
  else if(concept){ ok(m.concept && m.lines.plot.length && m.lines.lots.length >= 2 && m.lines.bldline.length && m.foot.length, dir + ': במודל הרעיוני יש קו כחול, ' + m.lines.lots.length + ' מגרשים, קווי בניין ו-' + m.foot.length + ' מבנים בקומת הקרקע');
    const g = concept.georef; ok(g.median < 0.5 && g.plotMedian < 0.5, dir + ': התשריט מעוגן לחלקות הגוש ב-GIS העירוני (סטייה חציונית ' + g.median + " מ', הקו הכחול " + g.plotMedian + " מ')");
    const dA = Math.abs(concept.planArea.drawn/1000 - concept.planArea.stated)/concept.planArea.stated; ok(dA < 0.06, dir + ': שטח הקו הכחול ' + concept.planArea.drawn + ' מ"ר מול ' + concept.planArea.stated + ' דונם בתשריט (' + (dA*100).toFixed(1) + '%)'); }
  else ok(ms.count.treeNew > 0 && ms.count.fire > 0 && ms.area.paving > 0, dir + ': במודל יש עצים (' + ms.count.treeNew + '), רחבות כיבוי (' + ms.count.fire + ') וריצוף (' + ms.area.paving + ' מ"ר)');
  const rf = path.join(root, dir, 'renewal.json');
  if(fs.existsSync(rf)){ // התב"ע והשרטוט באותו מקום: קו הגבול שבשרטוט יושב על צלעות מגרשי התב"ע
    const rn = JSON.parse(fs.readFileSync(rf, 'utf8')), loc = c => { const [E, N] = P.wgs2itm(c[1], c[0]); return [E-m.e0, N-m.n0]; };
    const segs = []; rn.parcels.forEach(p => { const c = p.c.map(loc); c.forEach((a, i) => { const b = c[(i+1)%c.length]; segs.push([a[0], a[1], b[0], b[1]]); }); });
    const dseg = (p, s) => { const vx = s[2]-s[0], vy = s[3]-s[1], l = vx*vx+vy*vy || 1e-9; let t = ((p[0]-s[0])*vx+(p[1]-s[1])*vy)/l; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0]-s[0]-t*vx, p[1]-s[1]-t*vy); };
    const ds = []; (m.lines.plot||[]).forEach(f => { for(let i = 0; i < f.length; i += 2){ const p = [f[i]/10, f[i+1]/10]; ds.push(Math.min(...segs.map(g => dseg(p, g)))); } }); ds.sort((a, b) => a-b);
    if(man.raster){ const c = man.cal || {}; ok(c.within05 >= 0.8 && c.within1 >= 0.9, dir + ': התמונה מעוגנת למגרשי התב"ע (' + Math.round((c.within05||0)*100) + '% מהצלעות עד חצי מטר מהקו בתמונה, ' + Math.round((c.within1||0)*100) + '% עד מטר)'); }
    else if(concept) ok(ds.length > 20 && ds[ds.length >> 1] < 1.5, dir + ': הקו הכחול של התב"ע המוצעת קרוב למגרשי התב"ע המאושרת (סטייה חציונית ' + (ds[ds.length >> 1]||0).toFixed(2) + " מ'. מגרשי \"מה נבנה סביבי\" פחות מדויקים מה-GIS)");
    else ok(ds.length > 20 && ds[ds.length >> 1] < 0.5, dir + ': השרטוט מכויל למגרשי התב"ע (סטייה חציונית ' + (ds[ds.length >> 1]||0).toFixed(2) + " מ')");
    ok(rn.lots.filter(l => l.floors > 0).every(l => rn.massing.some(x => x.lot===l.lot)) && rn.massing.every(x => P.ZONES[x.cat]) && rn.parcels.every(x => P.ZONES[x.cat]), dir + ': לכל מגרש בתב"ע יש נפח וייעוד מהמקרא');
  }
  if(m.parts && fs.existsSync(rf)){ // חלקי בניין מהמצגת מול התב"ע: מספר הקומות והגובה. חריגה היא ממצא לחוות הדעת, לא תקלה
    const rn = JSON.parse(fs.readFileSync(rf, 'utf8')), over = m.parts.filter(p => { const L = rn.lots.find(l => l.lot === p.lot); return L && L.floors && p.floors > L.floors; });
    ok(m.parts.every(p => p.src && p.floors > 0 && p.top > 4), dir + ': לכל חלק בניין יש מקור, קומות וגובה (' + m.parts.length + ' חלקים)');
    console.log('  ממצא: ' + (over.length ? over.map(p => 'בניין ' + p.id + ' ' + p.floors + ' קומות, בתב"ע ' + rn.lots.find(l => l.lot === p.lot).floors).join('; ') : 'כל החלקים בתוך מספר הקומות של התב"ע'));
  }
  const ff = path.join(root, dir, 'floors.json');
  if(fs.existsSync(ff) && fs.existsSync(rf)){ // קומות מתוכניות האדריכל (tools/extract-floors.py): כל בניין בתוך המגרש שלו, ולא מעל הגובה של התב"ע
    const fd = JSON.parse(fs.readFileSync(ff, 'utf8')), rn = JSON.parse(fs.readFileSync(rf, 'utf8')), loc = c => { const [E, N] = P.wgs2itm(c[1], c[0]); return [E-m.e0, N-m.n0]; };
    const inR = (x, y, r) => { let c = false; for(let i = 0, j = r.length-1; i < r.length; j = i++){ const a = r[i], b = r[j]; if((a[1] > y) !== (b[1] > y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) c = !c; } return c; };
    const miss = fd.buildings.flatMap(b => b.floors.map(f => f.plan).concat(b.roof ? [b.roof.plan] : [], b.mech ? [b.mech.plan] : [])).filter(id => !fd.plans[id]);
    ok(!miss.length, dir + ': כל קומה מפנה לתוכנית קיימת (' + fd.buildings.length + ' בניינים, ' + Object.keys(fd.plans).length + ' תוכניות)');
    const out = [], high = [];
    fd.buildings.forEach(b => { const lot = rn.parcels.find(p => p.lot === b.fit.lot), r = lot && lot.c.map(loc), L = rn.lots.find(l => l.lot === b.fit.lot);
      const e = fd.plans[b.floors[0].plan].env; let n = 0, inside = 0;          // עד 1.5 מ' מעבר לקו המגרש: בליטה או זיז, לא שגיאת עיגון
      const dB = (x, y) => Math.min(...r.map((a, i) => { const c = r[(i+1)%r.length], vx = c[0]-a[0], vy = c[1]-a[1], l = vx*vx+vy*vy || 1e-9, t = Math.max(0, Math.min(1, ((x-a[0])*vx+(y-a[1])*vy)/l)); return Math.hypot(x-a[0]-t*vx, y-a[1]-t*vy); }));
      for(let i = 0; i < e.length; i += 2){ n++; if(r && (inR(e[i]/10, e[i+1]/10, r) || dB(e[i]/10, e[i+1]/10) < 1.5)) inside++; }
      if(inside/n < .9) out.push(b.id + ' ' + Math.round(inside/n*100) + '%');
      if(L && L.height && b.top > L.height) high.push(b.id + ' ' + b.top + '>' + L.height); });
    ok(!out.length, dir + ': כל בניין יושב בתוך המגרש שלו בתב"ע' + (out.length ? ' (חורג: ' + out.join(', ') + ')' : ''));
    if(concept){ const decl = concept.towers.map(t => String(t.lot)); ok(high.every(h => decl.includes(h.split(' ')[0])), dir + ': בניין שגבוה מהתב"ע המאושרת מוצהר כתוספת קומות של התב"ע המוצעת' + (high.length ? ' (' + high.join(', ') + ')' : '')); }
    else ok(!high.length, dir + ': אף בניין לא גבוה מהגובה המרבי בתב"ע' + (high.length ? ' (' + high.join(', ') + ')' : ''));
    ok(fd.buildings.filter(b => b.fit.median != null).every(b => b.fit.median < 0.6), dir + ': עיגון הקומות לקווי המגרש (סטייה חציונית ' + fd.buildings.filter(b => b.fit.median != null).map(b => b.id + ' ' + b.fit.median).join(', ') + " מ')");
    ok(fs.statSync(ff).size < 1.5e6, dir + ': floors.json ' + (fs.statSync(ff).size/1e3).toFixed(0) + 'KB');
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
