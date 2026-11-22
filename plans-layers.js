/* ══════════════════════════════════════════════════════════════════
   plans-layers.js: "שכבות". תוכנית הפיתוח מפורקת לנושאים, בערימה תלת־ממדית (ענת, 22.11.2026).
   הרעיון: כל דרישה ברשימת הבדיקה היא הצלבה של שכבות. לחיצה על דרישה מציגה רק את השכבות שלה.
   - התמונות מופקות מהשכבות המקוריות של ה-PDF (AutoCAD), לא מניחוש לפי צבע: tools/split-layers.py.
   - "הכול" מציג את כל השכבות, "איפוס" מחזיר לבסיס, ולחיצה על שכבה מוסיפה אותה.
   - שתי שכבות בלבד: החפיפה ביניהן נצבעת באדום, ושטחה נמדד (הערכה מהשרטוט).
   - הערות כהנחיות: טקסט, הקלטה (הכתבה בעברית) וסימון "בוצע". נשמר על התוכנית בשדה layerReview.
   ══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const SETS = { '1913': { dir:'layers/1913', title:'אחד העם / הרצל: תוכנית פיתוח', date:'18.11.2026' } };

/* חמשת הנושאים של הנחיות ההגשה, ולכל דרישה: השכבות שמראות אותה */
const TOPICS = [
 { id:'facade', name:'חזיתות וחומריות', goal:'רווחה חברתית', color:'var(--ink)',
   hint:'חזיתות נבדקות בחזיתות ובהדמיות. כאן נקראים קו המבנה, הכניסות והחדרים הטכניים.',
   items:[ ['שפה אדריכלית אחידה',['build']], ['היררכיה בין בסיס, גוף וסיומת',['build']], ['שילוב מערכות טכניות באופן מוצנע',['build','power']],
     ['חומרי גמר עמידים',['build','walk']], ['מניעת חזרתיות מונוטונית',['build']], ['חזיתות הנצפות מהמרחב הציבורי',['build','road','walk']] ] },
 { id:'move', name:'תנועה, חניה ונגישות', goal:'רווחה חברתית · אפקטיביות תפעולית', color:'var(--teal)',
   items:[ ['הפרדה בטוחה בין הולכי רגל לרכב',['walk','road','park']], ['רציפות מסלולים נגישים',['walk','level']], ['מיקום כניסות ויציאות',['build','road','park']],
     ['תכנון חניה',['park','build']], ['שבילי אופניים',['bike','road']], ['גישה לרכב חירום ושירות',['fire','road']], ['אזורי פריקה וטעינה',['park','waste']] ] },
 { id:'land', name:'פיתוח, נוף והצללה', goal:'איכות סביבה · רווחה חברתית', color:'#3f7d3a',
   items:[ ['עצים קיימים ומוצעים',['trees']], ['הצללה אפקטיבית',['shade','trees','walk']], ['שטחי חלחול',['green','site']], ['ניהול נגר',['water','green','level']],
     ['אזורי גינון',['green']], ['חומרי ריצוף',['walk']], ['מפלסים',['level','build']], ['חיבור למרחב הציבורי',['walk','road','site']] ] },
 { id:'infra', name:'תשתיות ותפעול', goal:'אפקטיביות תפעולית', color:'var(--bronze)',
   items:[ ['אשפה',['waste','build']], ['חדרים טכניים',['build','power']], ['גמל מים וחיבורי תשתית',['water']], ['פילרים',['power','walk']], ['מתקני חשמל',['power']],
     ['ניקוז',['water','level']], ['מיזוג',['build']], ['גישה לתחזוקה',['road','park','waste']], ['מניעת מפגעים חזותיים ותפעוליים',['waste','power','walk']] ] },
 { id:'sust', name:'קיימות', goal:'איכות סביבה', color:'#5b4a8a',
   hint:'קיימות נבדקת בהצלבה: צל, עצים, גינון, ריצוף ותשתיות יחד.',
   items:[ ['הפחתת עומסי חום',['shade','trees','walk']], ['שימוש בצל טבעי ומלאכותי',['shade','trees']], ['בנייה ירוקה',['build','green']], ['חיסכון במים',['green','water']],
     ['חיסכון באנרגיה',['build','power']], ['חומרים עמידים',['walk','build']], ['תחזוקה ארוכת טווח',['green','waste','power']] ] }
];
const LAYER_TOPIC = { site:'base', anno:'base', build:'facade', road:'move', walk:'move', park:'move', bike:'move', fire:'move',
  level:'land', green:'land', trees:'land', shade:'land', water:'infra', power:'infra', waste:'infra' };
const BASE = ['site','build'];
const TOPIC_BY = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const colorOf = id => (TOPIC_BY[LAYER_TOPIC[id]] || { color:'var(--ink-mute)' }).color;

const H = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N = n => Number(n).toLocaleString('he-IL');
const say = m => { try{ if(typeof toast==='function') toast(m); }catch(e){} };

const S = { tik:null, man:null, on:new Set(BASE), three:true, gap:46, rx:58, rz:-28, zoom:1, px:0, py:0,
  topic:'move', item:null, prev:null, hover:null, imgs:{}, rec:null };

/* ── נתונים: ההנחיות נשמרות על התוכנית ── */
function plan(){ try{ return plans.find(p => String(p.tik)===String(S.tik) && !p._deleted); }catch(e){ return null; } }
function canEdit(){ try{ return typeof isArchitect!=='function' || isArchitect(); }catch(e){ return true; } }
function review(){
  const p = plan();
  if(p){ if(!p.layerReview || typeof p.layerReview!=='object') p.layerReview = { items:{}, custom:[] };
    p.layerReview.items = p.layerReview.items || {}; p.layerReview.custom = p.layerReview.custom || []; return p.layerReview; }
  if(!S._local){ try{ S._local = JSON.parse(localStorage.getItem('layerReview-'+S.tik)) || null; }catch(e){} S._local = S._local || { items:{}, custom:[] }; }
  return S._local;
}
function persist(){
  const p = plan();
  if(p){ p.updatedAt = new Date().toISOString(); try{ savePlans(); }catch(e){ console.warn('layers save', e); } }
  else { try{ localStorage.setItem('layerReview-'+S.tik, JSON.stringify(S._local)); }catch(e){} }
}
const today = () => { const d = new Date(), z = n => String(n).padStart(2,'0'); return `${z(d.getDate())}.${z(d.getMonth()+1)}.${d.getFullYear()}`; };
function topicCount(t){
  const r = review(); let done = 0, notes = 0;
  t.items.forEach((_, i) => { const x = r.items[t.id+'.'+i]; if(x && x.d) done++; if(x && x.n) notes++; });
  r.custom.filter(c => c.t===t.id).forEach(c => { notes++; if(c.d) done++; });
  return { done, notes, total: t.items.length + r.custom.filter(c => c.t===t.id).length };
}

/* ── שלד הדף ── */
function ensurePage(){
  if(document.getElementById('layers')) return;
  const ref = document.getElementById('timeline') || document.querySelector('.page');
  const pg = document.createElement('div'); pg.id = 'layers'; pg.className = 'page ly-page'; pg.innerHTML = '<div id="layersBody"></div>';
  ref.parentNode.insertBefore(pg, ref.nextSibling);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
}
async function open(tik){
  ensurePage();
  tik = String(tik || S.tik || Object.keys(SETS)[0]);
  try{ if(typeof isDeveloper==='function' && isDeveloper() && !(session.tiks||[]).includes(tik)){   // יזם רואה רק את התוכנית שלו
    document.getElementById('layersBody').innerHTML = '<div class="page-title">שכבות</div><p class="ly-empty">השכבות זמינות רק לתוכנית שלך.</p>'; return; } }catch(e){}
  if(!SETS[tik]){ document.getElementById('layersBody').innerHTML = `<div class="page-title">שכבות</div><p class="ly-empty">לתוכנית ${H(tik)} עוד לא הופקו שכבות.</p>`; return; }
  if(S.tik !== tik || !S.man){
    S.tik = tik; S.man = null; S._local = null; S.imgs = {};
    document.getElementById('layersBody').innerHTML = '<p class="ly-empty">טוען את השכבות…</p>';
    try{ S.man = await (await fetch(SETS[tik].dir + '/manifest.json')).json(); }
    catch(e){ document.getElementById('layersBody').innerHTML = '<p class="ly-empty">השכבות לא נטענו. בדקי את החיבור ונסי שוב.</p>'; return; }
  }
  shell(); drawAll();
}
function shell(){
  const m = S.man, set = SETS[S.tik], g = m.layers.find(l => l.id==='green');
  const pct = g && g.areaIn && m.siteArea ? Math.round(g.areaIn / m.siteArea * 100) : null;
  document.getElementById('layersBody').innerHTML = `
  <div class="ly-head">
    <div><div class="page-title">תוכנית אחת, <b>${m.layers.length}</b> שכבות לבדיקה</div>
      <div class="ly-sub">תיק <b>${H(S.tik)}</b> · ${H(set.title)} · ${H(set.date)} · קנ"מ 1:${m.scale} · הופק מ-<b>${m.cadTotal}</b> שכבות השרטוט המקוריות${pct!=null?` · <mark>גינון: כ-${pct}% מהשטח שבקו הכחול</mark>`:''}</div></div>
    <div class="ly-bar" role="toolbar" aria-label="תצוגת השכבות">
      <button class="ly-b" data-act="all">הכול</button>
      <button class="ly-b" data-act="reset">איפוס</button>
      <button class="ly-b" data-act="mode" id="lyMode"></button>
      <label class="ly-gap">הפרדה <input type="range" id="lyGap" min="0" max="110" value="${S.gap}" aria-label="מרחק בין השכבות"></label>
    </div>
  </div>
  <div class="ly-grid">
    <aside class="ly-list" id="lyList" aria-label="שכבות"></aside>
    <div class="ly-stage" id="lyStage"><div class="ly-world" id="lyWorld"></div>
      <div class="ly-over" id="lyOver"></div>
      <div class="ly-zoom"><button data-z="1" aria-label="הגדלה">+</button><button data-z="-1" aria-label="הקטנה">−</button></div>
      <div class="ly-tip">גרירה: סיבוב · Shift וגרירה: הזזה · גלגלת: זום</div></div>
    <aside class="ly-check" id="lyCheck" aria-label="רשימת בדיקה"></aside>
  </div>`;
  const world = document.getElementById('lyWorld');
  world.innerHTML = m.layers.map(l => `<div class="ly-sheet" data-id="${l.id}" style="--c:${colorOf(l.id)}">
      <img src="${SETS[S.tik].dir}/${l.file}" alt="${H(l.name)}" draggable="false" decoding="async"><span class="ly-tag">${H(l.name)}</span></div>`).join('')
    + '<canvas class="ly-sheet ly-hit" id="lyHit" width="800" height="1207"></canvas>';
  world.querySelectorAll('img').forEach(im => { S.imgs[im.parentNode.dataset.id] = im; im.addEventListener('load', () => overlap()); });
  bind();
}

/* ── ציור ── */
function drawAll(){ drawList(); drawStage(); drawCheck(); }
function visible(){ return S.man.layers.filter(l => S.on.has(l.id)); }
function drawList(){
  const m = S.man, groups = [['base','בסיס']].concat(TOPICS.filter(t => t.id!=='sust').map(t => [t.id, t.name]));
  document.getElementById('lyList').innerHTML = groups.map(([gid, gname]) => {
    const ls = m.layers.filter(l => LAYER_TOPIC[l.id]===gid); if(!ls.length) return '';
    return `<div class="ly-g">${H(gname)}</div>` + ls.map(l => `<button class="ly-row${S.on.has(l.id)?' on':''}" data-layer="${l.id}" style="--c:${colorOf(l.id)}"
        aria-pressed="${S.on.has(l.id)}" title="${l.cad.length} שכבות שרטוט: ${H(l.cad.slice(0,14).join(', '))}${l.cad.length>14?'…':''}">
        <i></i><span>${H(l.name)}</span>${l.areaIn?`<em>${N(l.areaIn)} מ"ר</em>`:''}</button>`).join('');
  }).join('') + `<div class="ly-foot">${S.on.size} מתוך ${m.layers.length} מוצגות. לחיצה מוסיפה או מסירה, לחיצה כפולה מבודדת.</div>`;
}
function drawStage(){
  const st = document.getElementById('lyStage'), world = document.getElementById('lyWorld'); if(!st) return;
  const m = S.man, r = st.getBoundingClientRect(), vis = visible();
  const h = Math.max(260, r.height * (S.three ? 0.9 : 0.94)), w = h * m.w / m.h;
  const gap = S.three ? S.gap : 0, n = vis.length;
  st.style.setProperty('--w', w+'px'); st.style.setProperty('--h', h+'px');
  // התאמה למסך: הערימה כולה (גובה המישור המוטה ועוד המרווחים) נכנסת לבמה
  let fit = 1, lift = 0;
  if(S.three){
    const rx = S.rx*Math.PI/180, rz = S.rz*Math.PI/180, fw = w*Math.abs(Math.cos(rz)) + h*Math.abs(Math.sin(rz)), fh = (w*Math.abs(Math.sin(rz)) + h*Math.abs(Math.cos(rz))) * Math.cos(rx);
    const stack = gap * (n-1) * Math.sin(rx);
    fit = Math.min(1.7, Math.max(0.45, Math.min(r.height*0.9 / (fh + stack), r.width*0.92 / fw)));
    lift = stack / 2 * fit;
  }
  st.style.setProperty('--glass', String(Math.min(0.4, 1.1 / Math.max(1, n))));
  world.style.transform = `translate(${S.px}px, ${S.py + lift}px) scale(${S.zoom * fit}) ` + (S.three ? `rotateX(${S.rx}deg) rotateZ(${S.rz}deg)` : '');
  let k = 0;
  m.layers.forEach(l => {
    const el = world.querySelector(`.ly-sheet[data-id="${l.id}"]`), on = S.on.has(l.id);
    el.classList.toggle('off', !on); el.classList.toggle('dim', !!S.hover && S.hover!==l.id && on); el.classList.toggle('glass', S.three && gap > 8);
    if(on){ el.style.transform = `translateZ(${k*gap}px)`; k++; }
  });
  const hit = document.getElementById('lyHit'); hit.style.transform = `translateZ(${Math.max(0,k-1)*gap + 1}px)`;
  const mb = document.getElementById('lyMode'); mb.textContent = S.three ? 'מבט על' : 'תלת־ממד'; mb.title = S.three ? 'מעבר לתוכנית שטוחה' : 'מעבר לערימה תלת־ממדית';
  st.classList.toggle('flat', !S.three);
  overlap();
}
/* חפיפה בין שתי שכבות: נצבעת באדום, ושטחה נמדד מהפיקסלים */
function overlap(){
  const cv = document.getElementById('lyHit'), over = document.getElementById('lyOver'); if(!cv) return;
  const ctx = cv.getContext('2d'), vis = visible().filter(l => l.id!=='site' && l.id!=='anno');
  ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.add('off'); over.innerHTML = '';
  const it = S.item ? TOPIC_BY[S.item.t].items[S.item.i] : null;
  if(it) over.innerHTML = `<b>${H(it[0])}</b><span>${vis.map(l => H(l.name)).join(' × ')}</span>`;
  if(vis.length !== 2) return;
  const [a, b] = vis.map(l => S.imgs[l.id]); if(!a || !b || !a.complete || !b.complete || !a.naturalWidth || !b.naturalWidth) return;
  try{
    ctx.save(); if('filter' in ctx) ctx.filter = 'blur(1.5px)';
    ctx.drawImage(a, 0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'source-in'; ctx.drawImage(b, 0, 0, cv.width, cv.height); ctx.restore();
    const d = ctx.getImageData(0, 0, cv.width, cv.height), px = d.data; let c = 0;
    for(let i = 0; i < px.length; i += 4){ if(px[i+3] > 70){ px[i] = 200; px[i+1] = 30; px[i+2] = 40; px[i+3] = 215; c++; } else px[i+3] = 0; }
    ctx.putImageData(d, 0, 0);
    const m2 = c * Math.pow(S.man.mPerPx * S.man.w / cv.width, 2);
    if(c > 12){ cv.classList.remove('off');
      over.innerHTML += `<span class="ly-red">באדום: ${H(vis[0].name)} פוגש ${H(vis[1].name)}${m2 >= 5 ? `, כ-${N(Math.round(m2))} מ"ר (הערכה)` : ''}</span>`; }
    else over.innerHTML += '<span>בין שתי השכבות אין חפיפה בשרטוט.</span>';
  }catch(e){ /* דפדפן שלא מאפשר קריאת פיקסלים: מוותרים על הסימון */ }
}
function drawCheck(){
  const el = document.getElementById('lyCheck'); if(!el) return;
  const r = review(), t = TOPIC_BY[S.topic], ed = canEdit(), SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const row = (key, label, x, layers, custom) => {
    const act = S.item && S.item.key===key, has = x && x.n;
    return `<li class="ly-it${act?' act':''}${x&&x.d?' done':''}" data-key="${key}">
      <label class="ly-ck" title="בוצע"><input type="checkbox" data-done="${key}" ${x&&x.d?'checked':''} ${ed?'':'disabled'}><span>בוצע</span></label>
      <button class="ly-lab" data-item="${key}" ${layers?'':'disabled'} title="${layers?'הצגת השכבות של הדרישה':''}">${H(label)}</button>
      ${custom && ed ? `<button class="ly-x" data-del="${key}" aria-label="מחיקת ההנחיה">×</button>` : ''}
      ${custom ? '' : (act || has) ? `<div class="ly-note"><textarea data-note="${key}" rows="${act?3:1}" placeholder="הנחיה ליזם…" ${ed?'':'readonly'}>${H(x&&x.n||'')}</textarea>
        ${ed && SR && act ? `<button class="ly-mic${S.rec===key?' rec':''}" data-mic="${key}">${S.rec===key?'עצירה':'הקלטה'}</button>` : ''}
        ${x&&x.at ? `<small>${H(x.at)}</small>` : ''}</div>` : ''}
    </li>`;
  };
  const cust = r.custom.map((c, i) => ({ c, i })).filter(o => o.c.t===t.id);
  el.innerHTML = `
    <div class="ly-tabs" role="tablist">${TOPICS.map(x => { const c = topicCount(x);
      return `<button role="tab" aria-selected="${x.id===S.topic}" class="${x.id===S.topic?'on':''}" data-topic="${x.id}" style="--c:${x.color}">${H(x.name)}<b>${c.done}/${c.total}</b></button>`; }).join('')}</div>
    <div class="ly-goal" style="--c:${t.color}">${H(t.goal)}</div>
    ${t.hint ? `<p class="ly-hint">${H(t.hint)}</p>` : ''}
    <ol class="ly-items">${t.items.map((it, i) => row(t.id+'.'+i, it[0], r.items[t.id+'.'+i], it[1])).join('')}
      ${cust.map(o => row('c.'+o.i, o.c.n, o.c, null, true)).join('')}</ol>
    ${ed ? `<div class="ly-add"><input id="lyNew" type="text" placeholder="הנחיה נוספת בנושא…" aria-label="הנחיה נוספת">
      ${SR ? `<button class="ly-mic${S.rec==='new'?' rec':''}" data-mic="new">${S.rec==='new'?'עצירה':'הקלטה'}</button>` : ''}<button class="ly-b" data-act="add">הוספה</button></div>` : ''}
    <div class="ly-cfoot"><button class="ly-b" data-act="copy">העתקת ההנחיות</button>${SR||!ed?'':'<small>הקלטה זמינה ב-Chrome.</small>'}
      ${plan() ? '' : '<small>התוכנית לא נמצאה בטבלה. ההנחיות נשמרות בדפדפן הזה בלבד.</small>'}</div>`;
}

/* ── פעולות ── */
function setItem(key){
  if(S.item && S.item.key===key){ S.on = new Set(S.prev || BASE); S.item = null; S.prev = null; }
  else { const [t, i] = key.split('.'); const it = TOPIC_BY[t] && TOPIC_BY[t].items[+i]; if(!it) return;
    if(!S.item) S.prev = [...S.on]; S.item = { key, t, i:+i }; S.on = new Set(it[1].filter(id => S.man.layers.some(l => l.id===id))); }
  drawAll();
}
function toggleLayer(id, solo){
  S.item = null; S.prev = null;
  if(solo) S.on = new Set([id]); else if(S.on.has(id)) S.on.delete(id); else S.on.add(id);
  drawAll();
}
function setNote(key, text){
  const r = review(); const x = r.items[key] = r.items[key] || {};
  x.n = text.trim(); x.at = x.n ? today() : ''; if(!x.n && !x.d) delete r.items[key]; persist();
}
function copyText(){
  const r = review(), out = [`הנחיות אדריכלית העיר לתוכנית הפיתוח: תיק ${S.tik}, ${SETS[S.tik].title}`, ''];
  let n = 0;
  TOPICS.forEach(t => {
    const rows = [];
    t.items.forEach((it, i) => { const x = r.items[t.id+'.'+i]; if(x && x.n) rows.push(`${it[0]}: ${x.n}${x.d?' (בוצע)':''}`); });
    r.custom.filter(c => c.t===t.id).forEach(c => rows.push(`${c.n}${c.d?' (בוצע)':''}`));
    if(rows.length){ out.push(t.name); rows.forEach((x, i) => out.push(`${i+1}. ${x}`)); out.push(''); n += rows.length; }
  });
  if(!n) return say('עוד אין הנחיות להעתקה');
  const txt = out.join('\n').trim();
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => say(`${n} הנחיות הועתקו`), () => { window.prompt('העתקה:', txt); });
}
function mic(key){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if(!SR) return;
  if(S.recObj){ const same = S.rec===key; try{ S.recObj.stop(); }catch(e){} S.recObj = null; S.rec = null; if(same){ drawCheck(); return; } }
  const rec = new SR(); rec.lang = 'he-IL'; rec.continuous = true; rec.interimResults = false;
  rec.onresult = e => {
    let t = ''; for(let i = e.resultIndex; i < e.results.length; i++) if(e.results[i].isFinal) t += e.results[i][0].transcript;
    t = t.trim(); if(!t) return;
    if(key==='new'){ const inp = document.getElementById('lyNew'); if(inp) inp.value = (inp.value ? inp.value+' ' : '') + t; }
    else { const ta = document.querySelector(`textarea[data-note="${key}"]`); const v = ((ta ? ta.value : '') + ' ' + t).trim(); if(ta) ta.value = v; setNote(key, v); }
  };
  rec.onerror = e => { say(e.error==='not-allowed' ? 'אין הרשאה למיקרופון' : 'ההקלטה נעצרה'); };
  rec.onend = () => { if(S.recObj===rec){ S.recObj = null; S.rec = null; const keep = document.getElementById('lyNew'); const v = keep ? keep.value : ''; drawCheck(); const k2 = document.getElementById('lyNew'); if(k2) k2.value = v; } };
  try{ rec.start(); S.recObj = rec; S.rec = key; const keep = document.getElementById('lyNew'); const v = keep ? keep.value : ''; drawCheck(); const k2 = document.getElementById('lyNew'); if(k2) k2.value = v; }
  catch(e){ say('ההקלטה לא התחילה'); }
}
function bind(){
  const body = document.getElementById('layersBody'), st = document.getElementById('lyStage');
  body.onclick = e => {
    const b = e.target.closest('button, input[type=checkbox]'); if(!b) return;
    const d = b.dataset;
    if(d.act==='all'){ S.item = null; S.on = new Set(S.man.layers.map(l => l.id)); drawAll(); }
    else if(d.act==='reset'){ Object.assign(S, { item:null, prev:null, on:new Set(BASE), rx:58, rz:-28, zoom:1, px:0, py:0, gap:46 }); document.getElementById('lyGap').value = 46; drawAll(); }
    else if(d.act==='mode'){ S.three = !S.three; S.px = S.py = 0; drawStage(); }
    else if(d.act==='copy') copyText();
    else if(d.act==='add'){ const inp = document.getElementById('lyNew'), v = inp.value.trim(); if(!v) return inp.focus();
      review().custom.push({ t:S.topic, n:v, d:false, at:today() }); persist(); drawCheck(); }
    else if(d.z){ S.zoom = Math.min(6, Math.max(0.4, S.zoom * (d.z==='1' ? 1.25 : 0.8))); drawStage(); }
    else if(d.layer){ toggleLayer(d.layer, e.detail >= 2); }
    else if(d.topic){ S.topic = d.topic; drawCheck(); }
    else if(d.item){ setItem(d.item); }
    else if(d.mic){ mic(d.mic); }
    else if(d.del){ review().custom.splice(+d.del.split('.')[1], 1); persist(); drawCheck(); }
    else if(d.done){ const r = review(), k = d.done;
      if(k.startsWith('c.')) r.custom[+k.split('.')[1]].d = b.checked;
      else { const x = r.items[k] = r.items[k] || {}; x.d = b.checked; if(!x.d && !x.n) delete r.items[k]; }
      persist(); drawCheck(); }
  };
  body.onchange = e => { const k = e.target.dataset && e.target.dataset.note; if(k){ setNote(k, e.target.value); drawCheck(); } };
  body.onkeydown = e => { if(e.key==='Enter' && e.target.id==='lyNew'){ e.preventDefault(); body.querySelector('[data-act="add"]').click(); } };
  document.getElementById('lyGap').oninput = e => { S.gap = +e.target.value; if(!S.three){ S.three = true; } drawStage(); };
  const list = document.getElementById('lyList');
  list.onmouseover = e => { const r = e.target.closest('[data-layer]'); const id = r && S.on.has(r.dataset.layer) ? r.dataset.layer : null; if(id!==S.hover){ S.hover = id; drawStage(); } };
  list.onmouseleave = () => { if(S.hover){ S.hover = null; drawStage(); } };
  // גרירה: סיבוב בתלת־ממד, הזזה במבט על או עם Shift
  let drag = null;
  st.onpointerdown = e => { if(e.target.closest('button')) return; drag = { x:e.clientX, y:e.clientY, pan: e.shiftKey || !S.three || e.button===2 }; st.setPointerCapture(e.pointerId); st.classList.add('grab'); };
  st.onpointermove = e => { if(!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if(drag.pan){ S.px += dx; S.py += dy; } else { S.rz += dx * 0.35; S.rx = Math.min(82, Math.max(0, S.rx - dy * 0.3)); }
    drawStage(); };
  st.onpointerup = st.onpointercancel = () => { drag = null; st.classList.remove('grab'); };
  st.oncontextmenu = e => e.preventDefault();
  st.onwheel = e => { e.preventDefault(); S.zoom = Math.min(6, Math.max(0.4, S.zoom * (e.deltaY < 0 ? 1.12 : 0.89))); drawStage(); };
}

/* ── חיבור לאפליקציה ── */
window.openLayers = function(tik){ if(tik) S.tik = String(tik) === S.tik ? S.tik : (S.man = null, String(tik)); window.go('layers', null); };
window.layersLinkHTML = function(p){
  const s = p && SETS[String(p.tik)]; if(!s) return '';
  return `<div class="mat-row"><div class="mat-k">שכבות התוכנית</div><div class="mat-items"><button class="mat-doc" onclick="openLayers('${H(p.tik)}')">פירוק תוכנית הפיתוח לשכבות</button></div></div>`;
};
window.layerSets = SETS;
function hashTik(){ const h = (location.hash||'').slice(1); return h==='layers' ? '' : h.startsWith('layers=') ? h.slice(7) : null; }
function boot(){
  if(typeof plans==='undefined' || typeof window.go!=='function' || !document.querySelector('.page')) return setTimeout(boot, 60);
  ensurePage();
  const _go = window.go;
  window.go = function(id, btn, isBack){
    if(id!=='layers' && S.recObj){ try{ S.recObj.stop(); }catch(e){} }
    _go(id, btn, isBack);
    if(id==='layers'){ open(S.tik); const want = '#layers=' + (S.tik || Object.keys(SETS)[0]); if(location.hash!==want) history.replaceState(null, '', want); }
  };
  const route = () => { const t = hashTik(); if(t!==null){ if(t && t!==S.tik){ S.tik = t; S.man = null; } window.go('layers', null); } };
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { if(document.getElementById('layers').classList.contains('active') && S.man) drawStage(); });
  route();
}

const CSS = `
.ly-page{max-width:none !important;padding-bottom:0 !important}
.ly-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:10px}
.ly-head .page-title{margin:0 !important}
.ly-sub{color:var(--muted);font-size:13px;margin-top:4px}
.ly-sub b{color:var(--ink)} .ly-sub mark{background:#fff3a8;color:var(--ink);padding:0 4px}
.ly-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ly-b{border:0 !important;background:#f1f0ec !important;color:var(--ink) !important;padding:8px 14px !important;font:600 13px var(--sans) !important;border-radius:0 !important;cursor:pointer;box-shadow:0 1px 0 rgba(0,0,0,.14);transition:transform .12s,background .12s}
.ly-b:hover{background:var(--ink) !important;color:#fff !important;transform:translateY(-1px)}
.ly-gap{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink-soft);padding-inline-start:8px}
.ly-gap input{width:130px;accent-color:var(--ink)}
.ly-grid{display:grid;grid-template-columns:232px minmax(0,1fr) 350px;gap:14px;height:calc(100vh - 232px);min-height:440px}
.ly-list,.ly-check{overflow:auto;min-height:0}
.ly-g{font-size:11.5px;font-weight:700;color:var(--ink-mute);margin:10px 0 3px}
.ly-g:first-child{margin-top:0}
.ly-row{display:flex;align-items:center;gap:8px;width:100%;border:0 !important;background:none !important;padding:6px 6px !important;text-align:start;font:400 13.5px var(--sans) !important;color:var(--ink-mute) !important;cursor:pointer;border-radius:0 !important}
.ly-row i{flex:none;width:12px;height:12px;background:#fff;box-shadow:inset 0 0 0 1.5px var(--c)}
.ly-row.on{color:var(--ink) !important;font-weight:600 !important;background:#f6f5f1 !important}
.ly-row.on i{background:var(--c)}
.ly-row:hover{background:#eeede8 !important}
.ly-row span{flex:1}
.ly-row em{font-style:normal;font-size:11px;color:var(--muted);font-weight:400}
.ly-foot{font-size:11.5px;color:var(--muted);margin-top:10px;line-height:1.5}
.ly-stage{position:relative;overflow:hidden;background:#fafaf8;perspective:2600px;display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;user-select:none;
  background-image:linear-gradient(#ecebe6 1px,transparent 1px),linear-gradient(90deg,#ecebe6 1px,transparent 1px);background-size:40px 40px}
.ly-stage.grab{cursor:grabbing}
.ly-world{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.ly-stage.grab .ly-world,.ly-stage.grab .ly-sheet{transition:none}
.ly-sheet{position:absolute;width:var(--w);height:var(--h);left:calc(var(--w) / -2);top:calc(var(--h) / -2);transition:transform .5s cubic-bezier(.2,.7,.2,1),opacity .25s;pointer-events:none}
.ly-sheet img{width:100%;height:100%;display:block}
.ly-sheet.glass{background:rgba(255,255,255,var(--glass,.3));box-shadow:0 0 0 1px color-mix(in srgb,var(--c) 45%,transparent)}
.ly-sheet.off{opacity:0;visibility:hidden}
.ly-sheet.dim{opacity:.12}
.ly-hit{mix-blend-mode:multiply}
.ly-tag{position:absolute;inset-inline-start:0;bottom:100%;background:var(--c);color:#fff;font:600 22px var(--sans);padding:4px 12px;white-space:nowrap;display:none}
.ly-sheet.glass .ly-tag{display:block}
.ly-over{position:absolute;inset-inline-start:12px;top:10px;display:flex;flex-direction:column;gap:3px;font-size:13px;color:var(--ink-soft);max-width:60%;pointer-events:none}
.ly-over b{font-size:15px;color:var(--ink)}
.ly-over span,.ly-over b{background:rgba(255,255,255,.88);padding:1px 6px;width:fit-content}
.ly-red{color:#b3202a !important;font-weight:600}
.ly-zoom{position:absolute;inset-inline-end:10px;bottom:10px;display:flex;flex-direction:column;gap:4px}
.ly-zoom button{width:32px;height:32px;border:0;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);font:600 18px var(--sans);cursor:pointer;color:var(--ink)}
.ly-zoom button:hover{background:var(--ink);color:#fff}
.ly-tip{position:absolute;inset-inline-start:12px;bottom:10px;font-size:11.5px;color:var(--ink-mute);pointer-events:none}
.ly-tabs{display:flex;flex-wrap:wrap;gap:4px}
.ly-tabs button{border:0 !important;background:#f1f0ec !important;color:var(--ink-soft) !important;padding:6px 9px !important;font:400 12.5px var(--sans) !important;cursor:pointer;border-radius:0 !important;display:flex;gap:6px;align-items:center}
.ly-tabs button b{font-size:11px;color:var(--muted);font-weight:400}
.ly-tabs button.on{background:var(--c) !important;color:#fff !important;font-weight:600 !important}
.ly-tabs button.on b{color:rgba(255,255,255,.8)}
.ly-goal{font-size:12px;color:var(--c);font-weight:600;margin:10px 0 2px}
.ly-hint{font-size:12.5px;color:var(--muted);margin:2px 0 6px;line-height:1.5}
.ly-items{list-style:none;margin:6px 0 0;padding:0;counter-reset:ly}
.ly-it{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:2px 8px;padding:7px 4px;box-shadow:inset 0 -1px 0 #ecebe6}
.ly-it.act{background:#f6f5f1;box-shadow:inset -3px 0 0 var(--ink)}
.ly-ck{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);cursor:pointer;padding-top:3px}
.ly-ck input{width:16px;height:16px;accent-color:#2f7d3a;margin:0}
.ly-lab{border:0 !important;background:none !important;padding:2px 0 !important;text-align:start;font:400 14px var(--sans) !important;color:var(--ink) !important;cursor:pointer;line-height:1.4}
.ly-lab:not(:disabled):hover{text-decoration:underline}
.ly-lab:disabled{cursor:default}
.ly-it.done .ly-lab{color:var(--muted) !important;text-decoration:line-through}
.ly-x{border:0;background:none;color:var(--ink-mute);font-size:16px;cursor:pointer;padding:0 4px}
.ly-note{grid-column:2 / -1;display:grid;grid-template-columns:1fr auto;gap:4px 6px;align-items:start}
.ly-note textarea,.ly-add input{width:100%;border:0;background:#fff;box-shadow:inset 0 0 0 1px #dcdad3;padding:6px 8px;font:400 13px var(--sans);color:var(--ink);resize:vertical;border-radius:0;box-sizing:border-box}
.ly-note textarea:focus,.ly-add input:focus{outline:2px solid var(--teal);outline-offset:0}
.ly-note small{grid-column:1 / -1;font-size:11px;color:var(--ink-mute)}
.ly-mic{border:0;background:#f1f0ec;color:var(--ink);font:600 12px var(--sans);padding:7px 10px;cursor:pointer}
.ly-mic.rec{background:#b3202a;color:#fff;animation:lyrec 1.2s infinite}
@keyframes lyrec{50%{opacity:.55}}
.ly-add{display:flex;gap:6px;margin-top:10px}
.ly-cfoot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0 8px}
.ly-cfoot small{font-size:11.5px;color:var(--muted)}
.ly-empty{color:var(--muted);padding:40px 0}
@media (max-width:1100px){.ly-grid{grid-template-columns:200px minmax(0,1fr);height:auto}.ly-stage{height:62vh}.ly-check{grid-column:1 / -1}}
@media (max-width:700px){.ly-grid{grid-template-columns:1fr}.ly-stage{height:58vh;order:-1}.ly-list{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}.ly-g,.ly-foot{grid-column:1 / -1}.ly-tip{display:none}.ly-gap input{width:90px}}
@media (prefers-reduced-motion:reduce){.ly-world,.ly-sheet{transition:none}.ly-mic.rec{animation:none}}
`;
boot();
})();
