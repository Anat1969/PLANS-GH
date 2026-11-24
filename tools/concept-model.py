#!/usr/bin/env python3
"""מודל לתוכנית בשלב התכנון הרעיוני: מתשריט תב"ע וקטורי בתוך מצגת, ומההדמיות (ענת, 24.11.2026, תיק 1909, האיצטדיון).

כשאין עדיין תוכנית פיתוח עם שכבות, יש בדרך כלל מצגת: תשריט התב"ע המוצעת (וקטורי, עם מפת המדידה), סכמה והדמיות.
הכלי בונה ממנה את אותם קבצים של מודל רגיל, כך שמסך המודל עובד בלי שינוי:
  model.json    הקו הכחול, גבולות המגרשים, קווי הבניין, הקו התת־קרקעי, החזית המסחרית, קירות וזיגוג של קומת המסד,
                עצים ועמודים ממפת המדידה.
  floors.json   מגדלים לפי ההדמיה: במקום של המגדלים בתב"ע המאושרת, עם מספר הקומות שנספר בהדמיה (הערכה).
  renewal.json  התב"ע המאושרת מ-plan_models ("מה נבנה סביבי"): מה מותר היום.
  manifest.json ושכבות שרטוט (webp) שמצוירות מהגאומטריה המעוגנת, צפון למעלה.
  concept.json  העיגון, ההנחות והמקורות.

העיגון: הקו התת־קרקעי והקו הכחול של התשריט מול חלקות הגוש מה-GIS העירוני. חשוב: מבקשים מהשרת WGS84 (outSR=4326)
וממירים בנוסחה של האפליקציה. ב-EPSG:2039 של השרת הקואורדינטות מוזזות כ-66 מ' מזרחה ו-41 מ' צפונה ביחס לאפליקציה.

שימוש:  python3 tools/concept-model.py data/concept/1909.json <presentation.pdf> [--out layers/1909]
"""
import sys, os, re, json, math, argparse, urllib.request, urllib.parse, datetime, importlib.util
import numpy as np
import pymupdf
from scipy.spatial import cKDTree
from shapely.geometry import Polygon, LineString, Point, MultiLineString, box
from shapely.ops import unary_union, polygonize, linemerge, split
from shapely import affinity
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_s = importlib.util.spec_from_file_location('am', os.path.join(ROOT, 'tools', 'auto-model.py')); am = importlib.util.module_from_spec(_s); _s.loader.exec_module(am)
GIS = 'https://gis.ashdod.muni.il/arcgis/rest/services/' + urllib.parse.quote('גושים_וחלקות') + '/MapServer/1/query'
H = dict(ground=4.5, res=3.15, roof=3.4)                     # מ', הנחה: אותן הנחות של tools/extract-floors.py
dm = lambda v: int(round(v * 10))

def parcels_itm(gush):
    """חלקות הגוש, ברשת של האפליקציה (WGS84 מהשרת, ואז wgs2itm)"""
    q = GIS + '?' + urllib.parse.urlencode(dict(where=f'Gush={gush}', outFields='Gush,Helka', returnGeometry='true', outSR=4326, f='geojson'))
    fc = json.loads(urllib.request.urlopen(q, timeout=60).read())
    out = {}
    for f in fc['features']:
        g = f['geometry']; ring = g['coordinates'][0] if g['type'] == 'Polygon' else g['coordinates'][0][0]
        out[f['properties']['Helka']] = [am.wgs2itm(c[1], c[0]) for c in ring]
    return out

def segs(dr, st, clip):
    """קטעי קו של סגנון אחד (צבע ועובי), בקואורדינטות הדף (y למעלה)"""
    cols = [tuple(st['color'])] + ([tuple(st['alt'])] if st.get('alt') else [])
    out = []
    for x in dr:
        c = x.get('color')
        if not c or tuple(round(v, 2) for v in c) not in cols or round(x.get('width') or 0, 2) not in st['widths'] or x['rect'].x0 > clip: continue
        for it in x['items']:
            if it[0] == 'l': out.append(((it[1].x, -it[1].y), (it[2].x, -it[2].y)))
            elif it[0] == 'c': out.append(((it[1].x, -it[1].y), (it[4].x, -it[4].y)))
            elif it[0] == 'qu':
                u = it[1]; q = [(u.ul.x, -u.ul.y), (u.ur.x, -u.ur.y), (u.lr.x, -u.lr.y), (u.ll.x, -u.ll.y)]; out += [(q[i], q[(i+1) % 4]) for i in range(4)]
            elif it[0] == 're' and not st.get('noRect'):
                r = it[1]; q = [(r.x0, -r.y0), (r.x1, -r.y0), (r.x1, -r.y1), (r.x0, -r.y1)]; out += [(q[i], q[(i+1) % 4]) for i in range(4)]
    return out

def sample(sg, step):
    pts = []
    for a, b in sg:
        n = max(1, int(math.dist(a, b) / step)); pts += [(a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n) for k in range(n+1)]
    return np.array(pts)

def georef(src, parcels, mine):
    """הזזה, סיבוב וקנה מידה (ICP עם ממוצע קטום) של התשריט אל צלעות החלקות"""
    tgt = []
    for r in parcels.values():
        for i in range(len(r)-1): tgt += [tuple(p) for p in sample([(r[i], r[i+1])], 0.5)]
    tgt = np.array(tgt); T = cKDTree(tgt)
    def fit(P, Q, fs=None):
        mp, mq = P.mean(0), Q.mean(0); A, B = P-mp, Q-mq; U, S, Vt = np.linalg.svd(A.T @ B); D = np.eye(2); D[1, 1] = np.sign(np.linalg.det(Vt.T @ U.T)); R = Vt.T @ D @ U.T
        s = fs if fs else (S*np.diag(D)).sum()/(A**2).sum(); return s, R, mq - s*R @ mp
    sel = np.array([p for r in mine.values() for p in r]); best = None          # ההתחלה: החלקות של התוכנית. היעד: כל חלקות הגוש
    s0 = math.hypot(*np.ptp(sel, 0)) / math.hypot(*np.ptp(src, 0))
    for rot in np.linspace(-0.25, 0.25, 21):
        for ks in (0.92, 1.0, 1.08):
            s = s0*ks; R = np.array([[math.cos(rot), -math.sin(rot)], [math.sin(rot), math.cos(rot)]]); t = sel.mean(0) - s*R @ src.mean(0)
            for it in range(80):
                Y = (s*(R @ src.T)).T + t; d, i = T.query(Y); m = d <= max(np.percentile(d, 85), 0.3)
                s, R, t = fit(src[m], tgt[i[m]], None if it > 30 else s)
            d, _ = T.query((s*(R @ src.T)).T + t); sco = float(np.mean(np.minimum(d, 2)))
            if best is None or sco < best[0]: best = (sco, s, R, t, float(np.median(d)), float((d < 0.5).mean()))
    sco, s, R, t, med, inl = best
    return dict(scale=s, R=R.tolist(), t=t.tolist(), trimmed=round(sco, 3), median=round(med, 3), inliers=round(inl, 3), rot=round(math.degrees(math.atan2(R[1, 0], R[0, 0])), 3))

def no_holes(p):
    """פוליגון בלי חורים: חיתוך אנכי דרך כל חור, עד שאין חורים. הדפדפן ממלא חורים, ולכן לא שולחים אותם"""
    if not p.interiors: return [p]
    h = p.interiors[0]; x = Polygon(h).centroid.x; b = p.bounds
    out = []
    for half in (box(b[0]-1, b[1]-1, x, b[3]+1), box(x, b[1]-1, b[2]+1, b[3]+1)):
        q = p.intersection(half)
        for g in getattr(q, 'geoms', [q]):
            if isinstance(g, Polygon) and g.area > 0.5: out += no_holes(g)
    return out

def dev_plan(C, doc, rn, e0, n0, plotL, footL):
    """תוכנית הפיתוח כתמונה: עיגון לתאי השטח של התב"ע המאושרת דרך הקו הכחול, ומיון לפי צבעי המקרא"""
    import cv2
    D = C['devPlan']; page = doc[D['page']-1]
    xref = max(page.get_image_info(xrefs=True), key=lambda i: i['width']*i['height'])['xref']
    pix = pymupdf.Pixmap(doc, xref); pix = pymupdf.Pixmap(pymupdf.csRGB, pix) if pix.n > 3 else pix
    full = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[..., :3]
    k = pix.width/page.rect.width; cx0, cy0, cx1, cy1 = [int(v*k) for v in D['crop']]
    img = full[cy0:cy1, cx0:cx1].astype(np.int16)
    # עיגון: הקו הכחול (גבול התכנית וגבולות התאים) מול תאי השטח
    Rr, Gg, Bb = img[..., 0], img[..., 1], img[..., 2]
    blue = ((Bb > 180) & (Rr < 70) & (Gg > 60) & (Gg < 160)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(blue); big = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 400])
    ys, xs = np.nonzero(big); sel = np.random.default_rng(0).choice(len(xs), min(25000, len(xs)), replace=False)
    src = np.c_[xs[sel], -ys[sel]].astype(float)
    tgt = []
    for p in rn['parcels']:
        r = [np.array(am.wgs2itm(q[1], q[0])) - [e0, n0] for q in p['c']]
        for i in range(len(r)): a, b = r[i], r[(i+1) % len(r)]; m = max(1, int(np.linalg.norm(b-a)/0.4)); tgt += [a+(b-a)*j/m for j in range(m+1)]
    g = georef(src, {i: [tuple(q) for q in tgt[i:i+2]] for i in range(0, len(tgt)-1, 2)}, {0: [tuple(q) for q in tgt]})
    sc, R, t = g['scale'], np.array(g['R']), np.array(g['t'])
    print('  תוכנית הפיתוח מעוגנת:', {k2: g[k2] for k2 in ('median', 'inliers', 'trimmed')}, f'{sc:.3f} מ\' לפיקסל')
    toL = lambda x, y: tuple(sc*(R @ np.array([x, -y])) + t)
    inv = np.linalg.inv(sc*R)
    toPx = lambda q: (lambda v: (v[0], -v[1]))(inv @ (np.array(q) - t))
    bnd = unary_union([Polygon([np.array(am.wgs2itm(q[1], q[0])) - [e0, n0] for q in p['c']]).buffer(0.3) for p in rn['parcels']]).buffer(-0.3)
    H, W = img.shape[:2]
    def region(geom):
        m = np.zeros((H, W), np.uint8)
        for q in getattr(geom, 'geoms', [geom]):
            if isinstance(q, Polygon): cv2.fillPoly(m, [np.array([toPx(c) for c in q.exterior.coords], np.int32)], 1)
        return m.astype(bool)
    inside = region(bnd.buffer(1.0)); outside = {}
    dist = lambda rgb: np.sqrt(((img - np.array(rgb))**2).sum(-1))
    def to_polys(mask, eps=1.5, minA=4.0):
        cs, hi = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE); out = []
        if hi is None: return out
        for i, c in enumerate(cs):
            if hi[0][i][3] != -1 or len(c) < 3: continue
            ext = [toL(*p[0]) for p in cv2.approxPolyDP(c, eps, True)]
            holes = []; j = hi[0][i][2]
            while j != -1:
                hc = cv2.approxPolyDP(cs[j], eps, True)
                if len(hc) >= 3: holes.append([toL(*p[0]) for p in hc])
                j = hi[0][j][0]
            if len(ext) < 3: continue
            q = Polygon(ext, holes).buffer(0)
            for g2 in getattr(q, 'geoms', [q]):
                if isinstance(g2, Polygon) and g2.area >= minA: out += no_holes(g2.simplify(0.15))
        return out
    surf, build, used = {}, [], np.zeros((H, W), bool)
    asph = None
    # בניין עם הפנים שלו (ליבות ומדרגות בצבע כהה): לא אספלט
    bm = (dist(D['classes']['building']['rgb']) < D['classes']['building']['tol']).astype(np.uint8)
    cs, _ = cv2.findContours(cv2.morphologyEx(bm, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    bfill = np.zeros_like(bm); cv2.drawContours(bfill, [c for c in cs if cv2.contourArea(c) > 2000], -1, 1, -1); bfill = cv2.dilate(bfill, np.ones((7, 7), np.uint8)).astype(bool)
    for name, cl in sorted(D['classes'].items(), key=lambda kv: kv[0] != 'asphalt'):
        m = dist(cl['rgb']) < cl['tol']
        if cl.get('outside'): m &= region(bnd.buffer(cl['outside']))
        else: m &= inside
        if cl.get('nearAsphalt') and asph is not None: m &= cv2.dilate(asph.astype(np.uint8), np.ones((int(cl['nearAsphalt']/sc),)*2, np.uint8)).astype(bool)
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        if cl.get('open'): m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((cl['open'],)*2, np.uint8))
        m = m.astype(bool) & ~used; used |= m
        if name == 'asphalt': m &= ~bfill; asph = m
        ps = to_polys(m)
        if cl['kind'] == 'appBuild':                                 # הבינוי המאושר בשאר המתחם. במגרשים של התוכנית הוא מוחלף במגדלים
            for q in ps:
                if q.area < 25 or q.intersects(plotL.buffer(-1)): continue
                c = q.representative_point(); lot = next((p for p in rn['parcels'] if Polygon([np.array(am.wgs2itm(z[1], z[0])) - [e0, n0] for z in p['c']]).contains(c)), None)
                L0 = next((l for l in rn['lots'] if lot and l['lot'] == lot['lot']), {}) ; h0 = L0.get('height') or 12
                build.append([h0, [v for z in list(q.exterior.coords)[:-1] for v in (dm(z[0]), dm(z[1]))]])
            continue
        fp = unary_union(footL) if footL else None
        for q in ps:
            if fp is not None and cl['kind'] != 'asphalt': q2 = q.difference(fp.buffer(0.1))
            else: q2 = q
            for g2 in getattr(q2, 'geoms', [q2]):
                if isinstance(g2, Polygon) and g2.area > 2:
                    for g3 in no_holes(g2): surf.setdefault(cl['kind'], []).append([cl['hex'], [v for z in list(g3.exterior.coords)[:-1] for v in (dm(z[0]), dm(z[1]))]])
    # עצים מוצעים: עיגולים ירוקים כהים. מרכז לפי שיא של מרחק מהקצה
    tm = (dist(D['tree']['rgb']) < D['tree']['tol']) & inside
    tm = cv2.morphologyEx(tm.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    dt = cv2.distanceTransform(tm, cv2.DIST_L2, 5); minr = D['tree']['minR']/sc
    peaks = (dt >= minr) & (dt == cv2.dilate(dt, np.ones((int(minr*2)+1,)*2, np.float32)))
    trees = []
    for y, x in zip(*np.nonzero(peaks)):
        p = toL(x, y)
        if all(math.dist(p, q[:2]) > 1.6 for q in trees): trees.append([round(p[0], 2), round(p[1], 2), round(float(dt[y, x])*sc*1.15, 2)])
    # סימוני העצים: לכריתה, להעתקה ולשימור
    marks = []
    for hexc, (rgb, tol) in D['marks'].items():
        mm = ((dist(rgb) < tol) & inside).astype(np.uint8)
        n, lab, st, cen = cv2.connectedComponentsWithStats(mm); pts = []
        for i in range(1, n):
            a, w, h = st[i, cv2.CC_STAT_AREA], st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]
            if 12 <= a <= 900 and 4 <= w <= 45 and 4 <= h <= 45 and a > 0.25*w*h: p = toL(*cen[i]); pts.append([round(p[0], 2), round(p[1], 2)])
        if pts: marks.append([hexc, pts])
    info = dict(page=D['page'], title=D['title'], georef={k2: g[k2] for k2 in ('median', 'inliers', 'trimmed')}, mPerPx=round(sc, 4),
                areas={k2: round(sum(Polygon([(f[i]/10, f[i+1]/10) for i in range(0, len(f), 2)]).area for _, f in v)) for k2, v in surf.items()},
                trees=len(trees), marks={D['marksMeaning'][h]: len(p) for h, p in marks}, buildings=len(build))
    print('  תוכנית הפיתוח:', info['areas'], f'עצים {len(trees)}', info['marks'], f'מבנים מאושרים {len(build)}')
    return dict(surf=surf, trees=trees, marks=marks, build=build, info=info)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('conf'); ap.add_argument('pdf'); ap.add_argument('--out', default='')
    a = ap.parse_args(); C = json.load(open(a.conf, encoding='utf8')); tik = str(C['tik'])
    out = a.out or os.path.join(ROOT, 'layers', tik); os.makedirs(out, exist_ok=True)
    doc = pymupdf.open(a.pdf); page = doc[C['page']-1]; dr = page.get_drawings(); st = C['styles']; clip = C.get('clipX', 1e9)
    S = {k: segs(dr, v, clip) for k, v in st.items()}
    print('קטעים:', {k: len(v) for k, v in S.items()})

    # ── עיגון ──
    par = parcels_itm(C['gush']); mine = {h: par[h] for h in C['parcels'] if h in par}
    g = georef(sample(S['bline'], 0.5), par, mine)          # הקו התת־קרקעי צמוד לגבולות המגרשים; הקו הכחול נבדק אחר כך כבדיקה בלתי תלויה
    sc, R, t = g['scale'], np.array(g['R']), np.array(g['t'])
    itm = lambda p: tuple(sc*(R @ np.array(p)) + t)
    T = cKDTree(np.array([q for r in par.values() for i in range(len(r)-1) for q in sample([(r[i], r[i+1])], 0.25)]))
    dpl, _ = T.query(np.array([itm(p) for sgm in S['plot'] for p in sgm])); g['plotMedian'] = round(float(np.median(dpl)), 3)
    print('עיגון:', g)
    if g['median'] > 0.6 or g['plotMedian'] > 0.6: sys.exit('העיגון לא עבר: סטייה חציונית מעל 0.6 מ\'')

    # ── מגרשים ──
    lines = lambda sg: [LineString([itm(p), itm(q)]) for p, q in sg if math.dist(p, q) > 1e-6]
    def faces(ls, tol):
        """פוליגונים סגורים מקווים שלא נפגשים בדיוק (קו מקווקו, קצוות שלא נצמדו): החורים של הקווים המעובים"""
        u = unary_union(ls).buffer(tol, join_style=2)
        return [Polygon(h).buffer(tol, join_style=2) for g2 in getattr(u, 'geoms', [u]) for h in g2.interiors]
    plot = max(faces(lines(S['plot']), 0.25), key=lambda q: q.area)                         # הקו הכחול
    polys = [p for p in faces(lines(S['lots']) + lines(S['plot']), 0.2) if p.area > 60 and plot.buffer(0.5).contains(p)]
    e0, n0 = round(plot.centroid.x, 2), round(plot.centroid.y, 2)
    L = lambda q: (q[0]-e0, q[1]-n0)
    lab_map = lambda p: p; boxes = []
    if C.get('labelCopy'):                                         # התוויות בעותק אחר של התשריט: התאמה בין הריבועים של מספרי המגרשים
        lc = C['labelCopy']; box_c = lambda wd: sorted(((x['rect'].x0+x['rect'].x1)/2, -(x['rect'].y0+x['rect'].y1)/2) for x in dr
            if x.get('color') and tuple(round(v, 2) for v in x['color']) == tuple(lc['color']) and round(x.get('width') or 0, 2) == lc['from' if wd else 'to'] and x['items'][0][0] == 're')
        A, B = np.array(box_c(True)), np.array(box_c(False)); mp, mq = A.mean(0), B.mean(0); k = np.sqrt(((B-mq)**2).sum()/((A-mp)**2).sum())
        lab_map = lambda p: tuple(mq + k*(np.array(p)-mp)); print(f'  תוויות מעותק אחר: {len(A)} ריבועים, יחס {k:.3f}')
        boxes = [Point(itm(tuple(b))).buffer(2.5) for b in B]       # רק מספר שיושב בתוך ריבוע מספור הוא מספר מגרש
    labels = []
    for w in page.get_text('words'):
        x0, y0, x1, y1, s = w[:5]
        if re.fullmatch(r'\d{1,3}', s) and C['lotLabelSize'][0] <= y1-y0 <= C['lotLabelSize'][1]:
            pt = Point(itm(lab_map(((x0+x1)/2, -(y0+y1)/2))))
            if not C.get('labelCopy') or any(b.contains(pt) for b in boxes): labels.append((int(s), pt))
    lots = {}
    for p in sorted(polys, key=lambda q: q.area):
        lab = [n for n, pt in labels if p.contains(pt) and n not in lots]
        if lab: lots[lab[0]] = p
    rest = plot.difference(unary_union(list(lots.values())).buffer(0.3))           # מגרש שהקווים שלו לא נסגרו: השארית בתוך הקו הכחול
    for q in sorted(getattr(rest, 'geoms', [rest]), key=lambda q: -q.area):
        q = q.buffer(0.3).intersection(plot)
        lab = [n for n, pt in labels if q.contains(pt) and n not in lots]
        if q.area > 60 and lab: lots[lab[0]] = q
    print('מגרשים:', {k: round(v.area) for k, v in lots.items()}, 'הקו הכחול:', round(plot.area), 'מ"ר')

    # ── קווי בניין, לכל מגרש ──
    bl_polys = [p for p in faces(lines(S['bldline']), 0.6) if p.area > 40]
    bl = {}
    for n, lp in lots.items():
        c = [q for q in bl_polys if lp.buffer(0.5).contains(q.representative_point()) and q.intersection(lp).area > 0.6*q.area]
        if c: bl[n] = max(c, key=lambda q: q.area)
    front = linemerge(unary_union(lines(S['front'])))
    print('קווי בניין:', {k: round(v.area) for k, v in bl.items()}, 'חזית מסחרית:', round(front.length), 'מ\'')

    # ── התב"ע המאושרת ──
    rn = am.taba(C['taba']); towers_rn = {m['lot']: Polygon([am.wgs2itm(c[1], c[0]) for c in m['c']]) for m in rn['massing'] if m['kind'] == 'tower'}
    rn.update(title=C.get('tabaTitle') or C['taba'], note='התב"ע המאושרת: מה מותר היום. הנפח הוא הערכה: שטח הקומה הוא השטח מעל הקרקע בטבלה 5 חלקי מספר הקומות, בתוך קווי הבניין.',
              source=f'{C["taba"]}, עותק מ"מה נבנה סביבי" (plan_models). נלקח {datetime.date.today():%d.%m.%Y}')
    for d in rn['demolish']: d['h'] = 13
    rn['sources'] = dict(rn.get('sources') or {}, context=C['notes']['exist'])

    # ── מגדלים: במקום של המגדל המאושר, בצורה של ההדמיה ──
    loc = lambda geom: affinity.translate(geom, -e0, -n0)
    def tower_shape(poly):
        r = poly.minimum_rotated_rectangle; xy = list(r.exterior.coords)[:4]
        a = math.atan2(xy[1][1]-xy[0][1], xy[1][0]-xy[0][0]); cx, cy = r.centroid.x, r.centroid.y
        w = math.dist(xy[0], xy[1]); h = math.dist(xy[1], xy[2])
        mk = lambda ww, hh, rr: affinity.translate(affinity.rotate(box(-ww/2+rr, -hh/2+rr, ww/2-rr, hh/2-rr).buffer(rr, quad_segs=4), a, use_radians=True, origin=(0, 0)), cx, cy)
        outer = mk(w, h, min(5.0, min(w, h)/4)); env = mk(w-3.6, h-3.6, min(3.2, min(w, h)/5))
        return outer, env, a, (cx, cy), w, h
    ring_dm = lambda p: [v for q in list(p.exterior.coords)[:-1] for v in (dm(q[0]), dm(q[1]))]
    plans, buildings, foot, podium, walls_ext, glass = {}, [], [], [], [], []
    for T0 in C['towers']:
        n = T0['lot']; outer, env, ang, (cx, cy), w, h = tower_shape(loc(towers_rn[n]))
        ca, sa = math.cos(ang), math.sin(ang)
        diag = [LineString([(cx+ca*(sx*w)-sa*(sy*h), cy+sa*(sx*w)+ca*(sy*h)) for sx, sy in ((-1, -1), (1, 1))]), LineString([(cx+ca*(sx*w)-sa*(sy*h), cy+sa*(sx*w)+ca*(sy*h)) for sx, sy in ((-1, 1), (1, -1))])]
        ring = outer.difference(env)
        for dg in diag: ring = unary_union([q for g2 in getattr(ring, 'geoms', [ring]) for q in getattr(split(g2, dg), 'geoms', [g2])])
        balc = [q for q in getattr(ring, 'geoms', [ring]) if q.area > 1]
        ec = list(env.exterior.coords); opens = []
        for i in range(len(ec)-1):                                # פתחים: יציאה למרפסת כל 3.6 מ' בצלעות הישרות
            p, q = ec[i], ec[i+1]; Lg = math.dist(p, q)
            if Lg < 4: continue
            k = int(Lg // 3.6); off = (Lg - k*3.6)/2
            for j in range(k):
                t0, t1 = (off + j*3.6 + .5)/Lg, (off + j*3.6 + 3.1)/Lg
                opens.append([dm(p[0]+(q[0]-p[0])*t0), dm(p[1]+(q[1]-p[1])*t0), dm(p[0]+(q[0]-p[0])*t1), dm(p[1]+(q[1]-p[1])*t1)])
        oc = list(outer.exterior.coords); rail = [[dm(oc[i][0]), dm(oc[i][1]), dm(oc[i+1][0]), dm(oc[i+1][1])] for i in range(len(oc)-1)]
        core = affinity.rotate(box(cx-5, cy-4, cx+5, cy+4), ang, use_radians=True, origin=(cx, cy))
        wall = env.difference(env.buffer(-0.3))
        for dg in diag: wall = unary_union([q for g2 in getattr(wall, 'geoms', [wall]) for q in getattr(split(g2, dg), 'geoms', [g2])])
        pid = f'T{n}'
        plans[pid] = dict(name=f'מגרש {n}: קומה טיפוסית (להמחשה, מההדמיה)', src='concept', area=round(env.area), env=ring_dm(env), open=opens, rail=rail,
                          balc=[ring_dm(b) for b in balc], walls=[ring_dm(q) for q in getattr(wall, 'geoms', [wall]) if q.area > .05], core=[ring_dm(core)])
        plans[pid+'R'] = dict(name=f'מגרש {n}: גג', src='concept', env=ring_dm(env), core=[ring_dm(core)])
        fl = [dict(n=k, plan=pid, use='res', y=round(H['ground'] + (k-1)*H['res'], 2), h=H['res']) for k in range(1, T0['floors']+1)]
        top = round(H['ground'] + T0['floors']*H['res'], 2)
        # פס העץ האנכי של ההדמיה: באמצע כל אחת מהחזיתות הארוכות, מקו המרפסות ועד המעטפת
        fins = []
        for sgn in (-1, 1):
            if w >= h: px_, py_, fa = cx - sa*sgn*(h/2-0.9), cy + ca*sgn*(h/2-0.9), ang
            else: px_, py_, fa = cx + ca*sgn*(w/2-0.9), cy + sa*sgn*(w/2-0.9), ang + math.pi/2
            fins.append([round(px_, 2), round(py_, 2), round(fa, 4), 1.6, 2.2])
        buildings.append(dict(id=T0['id'], lot=n, fins=fins, finColor='#8a6a4a', label=f'מגרש {n} · {T0["floors"]+1} קומות (הערכה)', src=T0['src'], floors=fl, top=top, roof=dict(plan=pid+'R', y=top, h=H['roof']), total=T0['floors']+1,
                              fit=dict(method='המגדל של התב"ע המאושרת באותו מגרש', lot=n, median=None)))
        # המסד: בתחום קו הבניין, ולא יותר מ-50% מהמגרש (הערה 5 בטבלה 5 של התב"ע המאושרת)
        B = loc(bl[n]); lot_a = lots[n].area; pod = B
        if pod.area > 0.5*lot_a:
            lo, hi = 0.0, 30.0
            for _ in range(30):
                mid = (lo+hi)/2; q = B.intersection(outer.buffer(mid, join_style=2))
                lo, hi = (mid, hi) if q.area < 0.5*lot_a else (lo, mid)
            pod = B.intersection(outer.buffer(lo, join_style=2))
        pod = pod.union(outer).buffer(0)
        foot.append(pod); podium.append(('garden', pod, pod.difference(outer.buffer(0.02))))
    for P0 in C.get('pavilion', []):                               # בניין מסחר וציבור נפרד, במקום המגדל שבוטל, עם גג ירוק
        n = P0['lot']; B = loc(bl[n]); foot.append(B); podium.append(('garden', B, B))
    # קירות וזיגוג של קומת המסד: זיגוג במקום שהתשריט מסמן חזית מסחרית, קיר בשאר
    fr = loc(front) if not front.is_empty else None
    for f0 in foot:
        cs = list(f0.exterior.coords)
        for i in range(len(cs)-1):
            sgm = LineString([cs[i], cs[i+1]]);
            if sgm.length < .3: continue
            shop = fr is not None and sgm.centroid.distance(fr) < 1.2
            if shop: glass.append(sgm)
            else: walls_ext.append(sgm.buffer(0.15, cap_style=2))
    # ── מפת המדידה: כל סימון לפי התווית שלו. הטקסט נמצא בעותק המוגדל, ולכן ממופה כמו מספרי המגרשים ──
    SL = C.get('surveyLabels', {}); objs = {}
    for w in page.get_text('words'):
        x0, y0, x1, y1, s = w[:5]; s = s.strip('() ')
        s = next((k for k in SL if s == k or (len(k) > 1 and s.startswith(k) and not s.startswith(k + 'י'))), None)   # "שוחה23.73": התווית והגובה צמודים
        if not s: continue
        p = L(itm(((x0+x1)/2, -(y0+y1)/2)))                       # הטקסט של מפת המדידה בעותק הגלוי: בלי מיפוי (נבדק בעין על הדף)
        if math.hypot(*p) < C.get('surveyRadius', 220): objs.setdefault(SL[s], []).append(p)
    def dedup(pts, d):
        o = []
        for p in pts:
            if all(math.dist(p, q) > d for q in o): o.append(p)
        return o
    objs = {k: dedup(v, 1.0) for k, v in objs.items()}
    print('מפת המדידה:', {k: len(v) for k, v in objs.items()})

    # ── תוכנית הפיתוח של המתחם (תמונה): מעוגנת לתאי השטח של התב"ע המאושרת, וכל צבע במקרא הופך לשכבה ──
    dev = dev_plan(C, doc, rn, e0, n0, loc(plot), [loc(q) for q in foot]) if C.get('devPlan') else None

    flat = lambda g2: [v for q in g2.coords for v in (dm(q[0]), dm(q[1]))]
    closed = lambda p: [v for q in p.exterior.coords for v in (dm(q[0]), dm(q[1]))]
    gl = lambda sg: [flat(loc(l)) for l in sg]
    model = dict(e0=e0, n0=n0, scale=500,
        surf=dict(wall=[['#e8e4da', closed(q)] for q in walls_ext]),
        lines=dict(plot=[closed(loc(plot))], lots=[closed(loc(p)) for p in lots.values()], bldline=gl(lines(S['bldline'])), bline=gl(lines(S['bline'])),
                   glass=[flat(l) for l in glass], front=[flat(l) for l in (getattr(fr, 'geoms', [fr]) if fr is not None else [])]),
        obj=dict(exTree=[[round(x, 2), round(y, 2), 2.5] for x, y in objs.get('exTree', [])], lamp=[[round(x, 2), round(y, 2), 0.3] for x, y in objs.get('lamp', [])],
                 cover=[[round(x, 2), round(y, 2), 0.45] for x, y in objs.get('cover', [])], cabinet=[[round(x, 2), round(y, 2), 0.8, 0.45, 0] for x, y in objs.get('cabinet', [])],
                 exBench=[[round(x, 2), round(y, 2), 1.8, 0.5, 0] for x, y in objs.get('exBench', [])], exBin=[[round(x, 2), round(y, 2), 0.9, 0.9, 0] for x, y in objs.get('exBin', [])],
                 exSign=[[round(x, 2), round(y, 2), 0.1] for x, y in objs.get('exSign', [])]),
        foot=[closed(q)[:-2] for q in foot], lampNew=0, concept=True)
    near = lambda l: math.hypot(*L(l.coords[0])) < C.get('surveyRadius', 220)
    # קווי הקווקוו של זיקת ההנאה חתוכים ב-PDF רק בתצוגה, ולכן נחתכים כאן לתחום התוכנית
    model['lines'].update(easement=gl([q for l in lines(S['easement']) for q in getattr(l.intersection(plot.buffer(0.2)), 'geoms', [l.intersection(plot.buffer(0.2))]) if isinstance(q, LineString) and q.length > 0.3]),
                          radius=gl(lines(S['radius'])), exSurvey=gl([l for l in lines(S['survey']) if near(l)]))
    if dev:
        for k, v in dev['surf'].items(): model['surf'].setdefault(k, []).extend(v)
        model['obj']['treeNew'] = dev['trees']; model['obj']['treeSurvey'] = dev['marks']; model['appBuild'] = dev['build']; model['dev'] = dev['info']
    xs = [v/10 for f in model['lines']['plot'] for v in f[0::2]]; ys = [v/10 for f in model['lines']['plot'] for v in f[1::2]]
    model['bbox'] = [round(min(xs)-25, 1), round(min(ys)-25, 1), round(max(xs)+25, 1), round(max(ys)+25, 1)]
    json.dump(model, open(os.path.join(out, 'model.json'), 'w'), separators=(',', ':'))

    # גג המסד: מגורים מעל → גינה; הביתן → גג ירוק
    pods = []
    for kind, f0, roof in podium:
        rs = [q for q in getattr(roof, 'geoms', [roof]) if isinstance(q, Polygon) and q.area > 6]
        green = unary_union([q.buffer(-2.2, join_style=2).buffer(0.6) .intersection(q.buffer(-1.6)) for q in rs])
        pods.append(dict(kind=kind, area=round(sum(q.area for q in rs)), roof=[ring_dm(q) for q in rs],
                         green=[ring_dm(q) for q in getattr(green, 'geoms', [green]) if isinstance(q, Polygon) and q.area > 6], edge=ring_dm(Polygon(f0.exterior))))
    floors = dict(tik=tik, source=C['source'], made=datetime.date.today().isoformat(), concept=True,
                  assume=dict(heights=H, towers=C['notes']['towers'], floors=C['notes']['floors'], podium=C['notes']['podium'],
                              roof='על הגג: ליבה ומערכות, להמחשה', window="יציאה למרפסת כל 3.6 מ', להמחשה"),
                  buildings=buildings, plans=plans, podium=pods)
    json.dump(floors, open(os.path.join(out, 'floors.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(rn, open(os.path.join(out, 'renewal.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

    # ── שכבות שרטוט: מצוירות מהגאומטריה המעוגנת, צפון למעלה ──
    x0, y0, x1, y1 = model['bbox']; mpp = 0.12; W, Hh = int((x1-x0)/mpp), int((y1-y0)/mpp)
    px = lambda q: ((q[0]-x0)/mpp, (y1-q[1])/mpp)
    def sheet(name, draw):
        im = Image.new('RGBA', (W, Hh), (0, 0, 0, 0)); g2 = ImageDraw.Draw(im); draw(g2); im.save(os.path.join(out, name + '.webp'), quality=82)
        a = np.asarray(im)[:, :, 3]; return round(float((a > 0).mean()*100), 2)
    def poly_line(g2, flatv, col, wd):
        q = [px((flatv[i]/10, flatv[i+1]/10)) for i in range(0, len(flatv), 2)]
        if len(q) > 1: g2.line(q, fill=col, width=wd)
    survey = lines(S['survey']) + lines(S['dims']) + lines(S['special'])
    def polys(g2, kinds, col):
        for k in kinds:
            for hexc, f in model['surf'].get(k, []):
                c = tuple(int(hexc[i:i+2], 16) for i in (1, 3, 5)) + (235,) if col is None else col
                g2.polygon([px((f[i]/10, f[i+1]/10)) for i in range(0, len(f), 2)], fill=c)
    dots = lambda g2, lst, r, col, fill=False: [(g2.ellipse([px((o[0]-r, o[1]+r)), px((o[0]+r, o[1]-r))], fill=col if fill else None, outline=col, width=3)) for o in lst]
    ink = {}
    ink['site'] = sheet('site', lambda g2: ([poly_line(g2, f, (31, 95, 208, 255), 6) for f in model['lines']['plot']], [poly_line(g2, f, (111, 143, 216, 255), 3) for f in model['lines']['lots']],
                                         [poly_line(g2, f, (0, 200, 160, 255), 2) for f in model['lines']['bline']], [poly_line(g2, f, (170, 0, 0, 255), 3) for f in model['lines']['bldline']],
                                         [poly_line(g2, f, (208, 32, 42, 255), 3) for f in model['lines']['radius']]))
    ink['build'] = sheet('build', lambda g2: ([g2.polygon([px((f[i]/10, f[i+1]/10)) for i in range(0, len(f), 2)], fill=(200, 198, 192, 255), outline=(90, 90, 90, 255)) for h0, f in model.get('appBuild', [])],
                                           [g2.polygon([px((f[i]/10, f[i+1]/10)) for i in range(0, len(f), 2)], fill=(232, 228, 218, 255), outline=(40, 40, 40, 255)) for f in model['foot']],
                                           [poly_line(g2, f, (130, 50, 140, 255), 7) for f in model['lines']['front']]))
    ink['road'] = sheet('road', lambda g2: polys(g2, ['asphalt'], None))
    ink['walk'] = sheet('walk', lambda g2: (polys(g2, ['paving'], None), [poly_line(g2, f, (170, 205, 60, 255), 2) for f in model['lines']['easement']]))
    ink['green'] = sheet('green', lambda g2: polys(g2, ['green'], None))
    ink['shade'] = sheet('shade', lambda g2: polys(g2, ['play', 'sport', 'yard'], None))
    ink['trees'] = sheet('trees', lambda g2: (dots(g2, [(x, y) for x, y, r in model['obj'].get('treeNew', [])], 2.2, (60, 140, 50, 255)),
                                           [dots(g2, lst, 1.4, tuple(int(h[i:i+2], 16) for i in (1, 3, 5)) + (255,), True) for h, lst in model['obj'].get('treeSurvey', [])]))
    ink['water'] = sheet('water', lambda g2: dots(g2, model['obj']['cover'], 0.8, (40, 90, 200, 255), True))
    ink['power'] = sheet('power', lambda g2: (dots(g2, model['obj']['lamp'], 0.7, (220, 170, 0, 255), True), dots(g2, model['obj']['cabinet'], 0.8, (90, 110, 95, 255), True)))
    ink['waste'] = sheet('waste', lambda g2: dots(g2, model['obj']['exBin'], 0.9, (47, 125, 90, 255), True))
    ink['exist'] = sheet('exist', lambda g2: ([g2.line([px(L(l.coords[0])), px(L(l.coords[1]))], fill=(70, 70, 70, 255), width=1) for l in survey if near(l)],
                                           dots(g2, model['obj']['exTree'], 2.0, (63, 122, 58, 255))))
    NAMES = dict(site='גבולות, קווי בניין, קו תת־קרקעי ורדיוס הקידוח', build='המגדלים, המסד, החזית המסחרית, והבינוי המאושר בשאר המתחם', road='כבישים (תוכנית המתחם)',
                 walk='ריצוף, מדרכות וזיקות הנאה', green='גינון ודשא', shade='משחק, ספורט וחצר גן ילדים', trees='עצים מוצעים, ולכריתה, להעתקה ולשימור',
                 water='שוחות ממפת המדידה', power='עמודים וארונות ממפת המדידה', waste='אשפטונים ממפת המדידה', exist='מפת המדידה: קווים ועצים קיימים')
    man = dict(tik=tik, title=C['title'], source=os.path.basename(a.pdf) + f', עמ\' {C["page"]}' + (f' ו-{C["devPlan"]["page"]}' if dev else ''), scale=500, w=W, h=Hh, mPerPx=mpp, cadTotal=0, unassigned=[], concept=True,
               siteArea=round(plot.area), layers=[dict(id=k, name=NAMES[k], file=k + '.webp', ink=ink[k], cad=[]) for k in NAMES if ink[k] > 0])
    for old in ('anno.webp',):
        if os.path.exists(os.path.join(out, old)): os.remove(os.path.join(out, old))
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    info = dict(tik=tik, plan=C['plan'], taba=C['taba'], source=C['source'], georef=g, parcels=C['parcels'], gush=C['gush'], lots={str(k): round(v.area) for k, v in lots.items()},
                buildLines={str(k): round(v.area) for k, v in bl.items()}, planArea=dict(drawn=round(plot.area), stated=C['planArea']), notes=C['notes'],
                towers=[dict(lot=b['lot'], floors=b['total'], top=b['top'], src=b['src']) for b in buildings], cancelled=C.get('cancelled', []),
                survey={k: len(v) for k, v in objs.items()}, dev=dev['info'] if dev else None)
    json.dump(info, open(os.path.join(out, 'concept.json'), 'w'), ensure_ascii=False, indent=1)
    print('נכתב:', out, '| מגדלים:', [(b['id'], b['total'], b['top']) for b in buildings], '| מסד:', [p['area'] for p in pods])

if __name__ == '__main__': main()
