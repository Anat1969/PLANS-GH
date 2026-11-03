/* ══════════════════════════════════════════════════════════════════
   plans-materials.js: כל החומרים של כל תוכנית במקום אחד, מסווגים לפי השם.
   סוגים: תב"ע, תשריט, חוות דעת, אישור פרוטוקול (החלטת ועדה), תוכנית, הדמיות, צילום אוויר, נספחים, גבול.
   מקורות:
   1. קבצי חוות הדעת שחולצו (seed-data.json): חוות דעת והחלטת ועדה.
   2. תמונות שחולצו מאותם קבצים (visuals-seed.json), מסווגות.
   3. מסמכים ותמונות שהועלו לתוכנית באפליקציה (documents, docsLib, visuals, renders).
   4. מסמכי התב"ע החלה מ"מה נבנה סביבי" (plan_media ב-ASHDODMAP): הוראות, תשריטים, נספחים, גבול.
   תיקון: visuals-seed ממוספר לפי מספר המסמך (כמו ה-seed), ולכן מיפוי לפי מספר התוכנית.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RN_SITE = 'https://ashdod-ma-nivne.vercel.app';
const RN_STORE = 'https://cbhexpybdggwzyakgagd.supabase.co/storage/v1/object/public/plan-media/';
const planNo = p => String((p && p.planNum) || '').replace(/\D/g,'');

const CATS = [
  { k:'taba',     l:'תב"ע: הוראות התוכנית', need:true },
  { k:'tashrit',  l:'תשריט',                 need:true },
  { k:'opinion',  l:'חוות דעת',              need:true },
  { k:'protocol', l:'אישור פרוטוקול',        need:true },
  { k:'plan',     l:'תוכנית בינוי ופיתוח',   need:true },
  { k:'render',   l:'הדמיות',                need:true },
  { k:'aerial',   l:'צילום אוויר ומצב קיים' },
  { k:'annex',    l:'נספחים' },
  { k:'boundary', l:'גבול התוכנית' },
  { k:'other',    l:'אחר' }
];
/** סיווג לפי השם: הכלל הראשון שמתאים */
const RULES = [
  ['protocol', /פרוטוקול|החלטת ועדה|החלטה|ישיבה|protocol/i],
  ['opinion',  /חוות.?דעת|opinion/i],
  ['annex',    /נספח|annex|תסקיר|שלביות/i],
  ['taba',     /הוראות|תקנון|תב"?ע|תבע|horaot|taba/i],
  ['tashrit',  /תשריט|tashrit/i],
  ['render',   /הדמי|render|מודל|visual/i],
  ['aerial',   /צילום|אוויר|אורתופוטו|תצ"?א|מצב קיים|aerial|existing|photo/i],
  ['boundary', /\.kml\b|גבול|kml/i],
  ['plan',     /בינוי|פיתוח|קומ|חתך|חזית|גג|מרתף|נוף|חניה|תנועה|floor|section|facade|landscape|binui|plan/i]
];
function classify(name){ const s = String(name||''); for(const [k, re] of RULES) if(re.test(s)) return k; return 'other'; }
const VIS_TO = { aerial:'aerial', existing:'aerial', render:'render', tashrit:'tashrit', binui:'plan', floor:'plan', section:'plan', facade:'plan', landscape:'plan', traffic:'plan', other:'other' };
window.classifyMaterial = classify;

/* ── תיקון: visuals-seed לפי מספר התוכנית ── */
function docToTik(doc){
  const skip = (typeof SEED_SKIP!=='undefined') ? SEED_SKIP : {};
  if(skip[doc]) return '';
  const byPlan = livePlans().find(p => planNo(p)===String(doc)); if(byPlan) return String(byPlan.tik);
  return '';
}
function patchVisualsSeed(){
  const orig = window.loadVisualsSeed; if(typeof orig!=='function') return;
  window.loadVisualsSeed = async function(){
    const seed = await orig.apply(this, arguments);
    if(seed && !seed._byTik){
      const out = {};
      Object.entries(seed.visuals||{}).forEach(([doc, imgs]) => { const t = docToTik(doc); if(t) out[t] = (out[t]||[]).concat(imgs); });
      seed.visuals = out; seed._byTik = true;
    }
    return seed;
  };
}
/** תמונות שכבר יובאו לתיק הלא נכון עוברות לתיק הנכון (לפי שם קובץ המקור) */
function fixImportedVisuals(){
  let n = 0;
  livePlans().forEach(p => (p.visuals||[]).slice().forEach(v => {
    const doc = (String(v.source||'').match(/תכנית בינוי (\d+)/)||[])[1]; if(!doc || doc===planNo(p)) return;
    const t = docToTik(doc); const q = t && livePlans().find(x => String(x.tik)===t);
    p.visuals = p.visuals.filter(x => x!==v);
    if(q){ if(!Array.isArray(q.visuals)) q.visuals = []; if(!q.visuals.some(x => x.title===v.title && x.cat===v.cat)) q.visuals.push(v); q.updatedAt = todayStr(); }
    p.updatedAt = todayStr(); n++;
  }));
  return n;
}

/* ── מסמכי התב"ע החלה מ"מה נבנה סביבי" ── */
let RN_MEDIA = (window.RN_MEDIA_SNAPSHOT || []).slice(), RN_MEDIA_LIVE = false;
const norm = s => String(s||'').replace(/[^0-9א-ת]/g,'');
function rnMediaFor(p){
  const rn = (typeof planRenewal==='function') ? planRenewal(p) : null;
  const keys = new Set([norm(p.change)]); if(rn) keys.add(norm(rn.r.n)); keys.delete('');
  return RN_MEDIA.filter(m => keys.has(norm(m.n)));
}
function rnHref(m){ return m.u ? RN_SITE + encodeURI(m.u) : (m.s ? RN_STORE + m.s.split('/').map(encodeURIComponent).join('/') : ''); }
async function syncMedia(){
  try{
    const key = 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3';
    const r = await fetch('https://cbhexpybdggwzyakgagd.supabase.co/rest/v1/plan_media?select=kind,caption,url,storage_path,plan_projects!inner(plan_number,published)&plan_projects.published=eq.true',
      { headers:{ apikey:key, Authorization:'Bearer '+key } });
    if(!r.ok) return;
    const rows = await r.json(); if(!Array.isArray(rows) || !rows.length) return;
    RN_MEDIA = rows.map(x => ({ n:x.plan_projects.plan_number, k:x.kind, c:x.caption, u:x.url, s:x.storage_path })); RN_MEDIA_LIVE = true;
  }catch(e){ /* העותק השמור מספיק */ }
}

/* ── איסוף החומרים של תוכנית ── */
function materials(p){
  const items = [];
  const add = (cat, o) => items.push({ cat, ...o });
  const sk = (typeof seedKey==='function') ? seedKey(p) : '';
  const op = sk && typeof SEED_OPINIONS!=='undefined' && SEED_OPINIONS[sk];
  if(op){
    if(op.text) add('opinion', { t:'חוות דעת אדריכלית העיר' + (op.committeeDate?`, ${fmtDate(op.committeeDate)}`:''), src:'קובץ חוות הדעת', act:`showPlanSource(${p.id})` });
    if(op.decision) add('protocol', { t:`החלטת ועדה${op.session?`, ישיבה ${op.session}`:''}${op.committeeDate?`, ${fmtDate(op.committeeDate)}`:''}: ${op.decision}`, src:'קובץ חוות הדעת', act:`showPlanSource(${p.id})` });
  }
  if(!op && p.opinion && String(p.opinion.description||'').trim()) add('opinion', { t:'חוות דעת (נכתבה באפליקציה)', src:'כרטיס התוכנית', act:`ppTab('opinion')` });
  if(!op && p.summary && String(p.summary.committeeDecision||'').trim()) add('protocol', { t:String(p.summary.committeeDecision).slice(0,120), src:'כרטיס התוכנית', act:`ppTab('opinion')` });
  (p.visuals||[]).forEach((v,i) => add(VIS_TO[v.cat] || classify(v.title), { t:v.title || 'תמונה', src:v.source ? 'חולץ מ'+String(v.source).replace(/\.DOC$/i,'') : 'הועלה', img:v.src, vi:i }));
  // תמונות מקובץ חוות הדעת שלא יובאו לתוכנית: נקראות ישירות מהקובץ, בלי להעתיק לנתונים השמורים
  const seedImgs = (window._visSeed && window._visSeed.visuals && window._visSeed.visuals[String(p.tik)]) || [];
  seedImgs.forEach(im => { if((p.visuals||[]).some(v => v.title===im.title && v.cat===im.cat)) return;
    add(VIS_TO[im.cat] || classify(im.title), { t:im.title || 'תמונה', src:'חולץ מ'+String(im.source||'קובץ חוות הדעת').replace(/\.DOC$/i,''), img:im.src }); });
  const rs = (p.renders && p.renders.length) ? p.renders : (p.render ? [p.render] : []);
  rs.forEach((r,i) => { if(!(p.visuals||[]).some(v => v.src===r) && !seedImgs.some(v => v.src===r)) add('render', { t:`הדמיה ${i+1}`, src:'קובץ חוות הדעת', img:r }); });
  (p.documents||[]).forEach(d => add(classify(d.type+' '+d.name), { t:d.name, src:'הועלה לתוכנית'+(d.date?`, ${fmtDate(d.date)}`:''), href:d.url }));
  const lib = p.docsLib || {};
  [].concat(lib.taba||[], lib.developer||[], ...Object.values(lib.byTopic||{})).forEach(d => { if(!d) return; const nm = d.name || d.title || '';
    add(classify(nm + ' ' + (d.type||'')), { t:nm || 'מסמך', src:'ספריית המסמכים', href:d.url || d.href || '' }); });
  // מייל: רק סוג, תאריך וקישור ל-Outlook (נפתח רק לבעלת התיבה). הקבצים נשארים במייל.
  ((window.MAIL_INDEX||{})[String(p.tik)] || []).forEach(m => add(m.cat || 'other',
    { t:`במייל, ${fmtDate(m.date)}${m.n>1?` (${m.n} קבצים)`:''}`, src:'תיבת הדואר של אדריכלית העיר. נפתח ב-Outlook', href:m.link, mail:true }));
  rnMediaFor(p).forEach(m => {
    const cat = m.k==='kml' ? 'boundary' : m.k==='render' ? 'render' : m.k==='video' ? 'render' : classify(m.c || m.u || m.s);
    add(cat, { t:(m.c || (m.k==='video'?'סרטון':'מסמך')) + ` (${m.n})`, src:'התב"ע החלה, מה נבנה סביבי', href:rnHref(m), ext:true });
  });
  return items;
}
window.planMaterials = materials;
function pendingSeedVisuals(p){ const s = window._visSeedCount || {}; const have = (p.visuals||[]).length; return Math.max(0, (s[String(p.tik)]||0) - have); }

/* ── תצוגה: פאנל "חומרי התוכנית" בכרטיס התוכנית ── */
window.matShowImg = function(pid, idx){
  const p = plans.find(x=>x.id===pid); const it = p && materials(p).filter(x=>x.img)[idx]; if(!it) return;
  const ov = document.createElement('div'); ov.className = 'render-lightbox'; ov.onclick = e => { if(e.target===ov || e.target.tagName==='BUTTON') ov.remove(); };
  ov.innerHTML = `<div class="mat-view"><img src="${H(it.img)}" alt="${H(it.t)}"><div class="mat-cap"><b>${H(it.t)}</b> <span class="pp-src">${H(it.src)}</span><button class="btn btn-ghost btn-sm">סגירה</button></div></div>`;
  document.body.appendChild(ov);
};
window.matImport = async function(pid){
  const p = plans.find(x=>x.id===pid); if(!p) return;
  let seed; try{ seed = await loadVisualsSeed(); }catch(e){ toast('קובץ התמונות לא נטען'); return; }
  const imgs = (seed.visuals||{})[String(p.tik)] || []; if(!Array.isArray(p.visuals)) p.visuals = [];
  let n = 0;
  imgs.forEach(im => { if(p.visuals.some(v => v.title===im.title && v.cat===im.cat)) return;
    p.visuals.push({ id:'v'+(p.visuals.length+1), src:im.src, cat:im.cat, title:im.title, note:'', source:im.source, page:im.page, order:p.visuals.length, conf:im.conf, addedAt:todayStr() }); n++; });
  p.updatedAt = todayStr(); savePlans(); toast(`נוספו ${n} תמונות לתוכנית`); renderPanel(p);
};
function panelHTML(p){
  const items = materials(p), by = {}; items.forEach(i => (by[i.cat] = by[i.cat] || []).push(i));
  const need = CATS.filter(c => c.need), have = need.filter(c => by[c.k]).length;
  const pend = pendingSeedVisuals(p);
  let imgIdx = -1; const idxOf = new Map(); items.filter(x=>x.img).forEach((x,i)=>idxOf.set(x,i));
  const row = c => {
    const list = by[c.k] || [];
    if(!list.length && !c.need) return '';
    return `<div class="mat-row${list.length?'':' mat-miss'}"><div class="mat-k">${H(c.l)} <b>${list.length || 'חסר'}</b></div>
      <div class="mat-items">${list.map(it => it.img
        ? `<button class="mat-thumb" title="${H(it.t)} · ${H(it.src)}" onclick="matShowImg(${p.id},${idxOf.get(it)})"><img src="${H(it.img)}" alt="${H(it.t)}" loading="lazy"></button>`
        : it.href ? `<a class="mat-doc${it.mail?' mat-mail':''}" href="${H(it.href)}" target="_blank" rel="noopener" title="${H(it.src)}">${H(it.t)}</a>`
        : it.act ? `<button class="mat-doc" onclick="${it.act}" title="${H(it.src)}">${H(it.t)}</button>`
        : `<span class="mat-doc">${H(it.t)}</span>`).join('')}</div></div>`;
  };
  return `<div id="matPanel" class="mat-wrap">
    ${CATS.map(row).join('')}
    <div class="pp-src">מקורות: קבצי חוות הדעת, מסמכים שהועלו, המייל שלך, ו"מה נבנה סביבי"${RN_MEDIA_LIVE?'':' (עותק 03.11.2026)'}. הסיווג לפי שם הקובץ.</div>
  </div>`;
}
function renderPanel(p){
  if(!p) return;
  const old = document.getElementById('matPanel');
  const html = panelHTML(p);
  const need = CATS.filter(c => c.need); const by = {}; materials(p).forEach(i => by[i.cat] = 1);
  const label = 'חומרי התוכנית'; const cnt = `${need.filter(c => by[c.k]).length}/${need.length} סוגים`;
  if(old){ old.outerHTML = html; const d = document.getElementById('matPanel').closest('details'); if(d) d.querySelector('summary').innerHTML = `<span>${label}</span><b>${cnt}</b>`; return; }
  const anchor = document.getElementById('procPanel') || document.getElementById('stageStrip'); if(!anchor) return;
  const d = document.createElement('details'); d.className = 'calm-fold mat-fold';
  d.innerHTML = `<summary><span>${label}</span><b>${cnt}</b></summary>${html}`;
  anchor.insertAdjacentElement('afterend', d);
}

/* ── מבט על: כל התוכניות מול סוגי החומרים ── */
window.matMatrix = function(){
  const L = livePlans().slice().sort((a,b) => String(b.tik).localeCompare(String(a.tik)));
  const need = CATS.filter(c => c.need);
  const rows = L.map(p => { const by = {}; materials(p).forEach(i => by[i.cat] = (by[i.cat]||0)+1);
    return `<tr onclick="this.closest('.render-lightbox').remove();openProject(${p.id})"><td><b>${H(p.planNum)}</b> <span class="muted">${H(p.location||'')}</span></td>${need.map(c => `<td class="${by[c.k]?'mx-ok':'mx-no'}">${by[c.k]||'—'}</td>`).join('')}</tr>`; }).join('');
  const full = L.filter(p => { const by = {}; materials(p).forEach(i => by[i.cat] = 1); return need.every(c => by[c.k]); }).length;
  const ov = document.createElement('div'); ov.className = 'render-lightbox'; ov.onclick = e => { if(e.target===ov) ov.remove(); };
  ov.innerHTML = `<div class="ver-modal" style="max-width:980px;width:94vw;max-height:88vh;display:flex;flex-direction:column">
    <h3>חומרי התוכניות: <b>${full}</b> מתוך <b>${L.length}</b> עם כל הסוגים</h3>
    <div class="rv-scroll" style="max-height:none;flex:1"><table class="rv-table mx-table"><thead><tr><th>תוכנית</th>${need.map(c=>`<th>${H(c.l)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="cal-pop-acts"><button class="btn btn-ghost btn-sm" onclick="this.closest('.render-lightbox').remove()">סגירה</button></div></div>`;
  document.body.appendChild(ov);
};

function patch(){
  patchVisualsSeed();
  const o = window.renderStageStrip;
  window.renderStageStrip = function(p){ o.apply(this, arguments); setTimeout(() => { try{ document.querySelectorAll('.mat-fold').forEach(x=>x.remove()); renderPanel(p); }catch(e){ console.warn('materials', e); } }, 0); };
  // כרטיס בספריית הידע
  const libCard = function(){
    const el = document.getElementById('libraryBody'); if(!el || el.querySelector('.lib-mat')) return;
    const n = livePlans().reduce((s,p) => s + materials(p).length, 0);
    el.querySelector('.lib-g')?.insertAdjacentHTML('beforebegin', `<div class="lib-grid" style="margin-top:12px"><div class="lib-card lib-mat" tabindex="0" role="button" onclick="matMatrix()"><div class="lib-t">חומרי התוכניות</div><div class="lib-d">תב"ע, תשריט, חוות דעת, פרוטוקול, תוכנית והדמיות, לכל תוכנית.</div><div class="lib-f"><span class="pp-src">${n} פריטים</span><span class="lib-ok lib-ok">מה חסר</span></div></div></div>`);
  };
  const _go = window.go; window.go = function(id){ const r = _go.apply(this, arguments); if(id==='library') setTimeout(libCard, 0); return r; };
  if((document.querySelector('.page.active')||{}).id==='library') libCard();
  // תיקון חד־פעמי: תמונות בתיק הלא נכון. וספירת התמונות שממתינות לייבוא
  try{ if(fixImportedVisuals()) savePlans(); }catch(e){}
  const _fx = window.fixDataIssues; if(typeof _fx==='function') window.fixDataIssues = function(){ let n = _fx.apply(this, arguments) || 0; try{ n += fixImportedVisuals(); }catch(e){} return n; };
  loadVisualsSeed().then(s => { window._visSeed = s; const c = {}; Object.entries(s.visuals||{}).forEach(([t, imgs]) => c[t] = imgs.length); window._visSeedCount = c;
    const p = (typeof pj==='function') && pj(); if(p && document.getElementById('matPanel')) renderPanel(p); }).catch(()=>{});
  syncMedia().then(() => { const p = (typeof pj==='function') && pj(); if(p && document.getElementById('matPanel')) renderPanel(p); });
}
function boot(){ if(typeof plans==='undefined' || typeof renderStageStrip!=='function' || typeof loadVisualsSeed!=='function') return setTimeout(boot, 60); patch(); }
boot();
})();
