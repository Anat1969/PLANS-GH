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
    # ── מפת המדידה: עצים (סימן "ע") ועמודים ──
    trees, lamps = [], []
    for w in page.get_text('words'):
        x0, y0, x1, y1, s = w[:5]
        if x0 > clip: continue
        if re.fullmatch(r'\)?\(?ע\)?\(?', s) and y1-y0 < 6: trees.append(L(itm(((x0+x1)/2, -(y0+y1)/2))))
        elif s in ('דומע', 'עמוד'): lamps.append(L(itm(((x0+x1)/2, -(y0+y1)/2))))
    def dedup(pts, d):
        o = []
        for p in pts:
            if all(math.dist(p, q) > d for q in o): o.append(p)
        return o
    trees = dedup(trees, 1.5); lamps = dedup(lamps, 2.0)
    print(f'מפת המדידה: {len(trees)} עצים, {len(lamps)} עמודים')

    flat = lambda g2: [v for q in g2.coords for v in (dm(q[0]), dm(q[1]))]
    closed = lambda p: [v for q in p.exterior.coords for v in (dm(q[0]), dm(q[1]))]
    gl = lambda sg: [flat(loc(l)) for l in sg]
    model = dict(e0=e0, n0=n0, scale=500,
        surf=dict(wall=[['#e8e4da', closed(q)] for q in walls_ext]),
        lines=dict(plot=[closed(loc(plot))], lots=[closed(loc(p)) for p in lots.values()], bldline=gl(lines(S['bldline'])), bline=gl(lines(S['bline'])),
                   glass=[flat(l) for l in glass], front=[flat(l) for l in (getattr(fr, 'geoms', [fr]) if fr is not None else [])]),
        obj=dict(treeOld=[[round(x, 2), round(y, 2), 2.5] for x, y in trees], lamp=[[round(x, 2), round(y, 2), 0.3] for x, y in lamps]),
        foot=[closed(q)[:-2] for q in foot], lampNew=0, concept=True)
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
    survey = lines(S['survey'])
    ink = {}
    ink['site'] = sheet('site', lambda g2: ([poly_line(g2, f, (31, 95, 208, 255), 6) for f in model['lines']['plot']], [poly_line(g2, f, (111, 143, 216, 255), 3) for f in model['lines']['lots']],
                                         [poly_line(g2, f, (0, 200, 160, 255), 2) for f in model['lines']['bline']], [poly_line(g2, f, (170, 0, 0, 255), 3) for f in model['lines']['bldline']]))
    ink['build'] = sheet('build', lambda g2: ([g2.polygon([px((f[i]/10, f[i+1]/10)) for i in range(0, len(f), 2)], fill=(232, 228, 218, 255), outline=(40, 40, 40, 255)) for f in model['foot']],
                                           [poly_line(g2, f, (130, 50, 140, 255), 7) for f in model['lines']['front']]))
    ink['trees'] = sheet('trees', lambda g2: [g2.ellipse([px((x-2.5, y+2.5)), px((x+2.5, y-2.5))], outline=(63, 122, 58, 255), width=3) for x, y, _ in model['obj']['treeOld']])
    ink['anno'] = sheet('anno', lambda g2: [g2.line([px(L(l.coords[0])), px(L(l.coords[1]))], fill=(70, 70, 70, 255), width=1) for l in survey])
    man = dict(tik=tik, title=C['title'], source=os.path.basename(a.pdf) + f', עמ\' {C["page"]}', scale=500, w=W, h=Hh, mPerPx=mpp, cadTotal=0, unassigned=[], concept=True,
               siteArea=round(plot.area), layers=[dict(id='site', name='גבולות, קווי בניין וקו תת־קרקעי', file='site.webp', ink=ink['site'], cad=[]),
                                                   dict(id='build', name='המסד והחזית המסחרית', file='build.webp', ink=ink['build'], cad=[]),
                                                   dict(id='trees', name='עצים ממפת המדידה', file='trees.webp', ink=ink['trees'], cad=[]),
                                                   dict(id='anno', name='מפת המדידה', file='anno.webp', ink=ink['anno'], cad=[])])
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    info = dict(tik=tik, plan=C['plan'], taba=C['taba'], source=C['source'], georef=g, parcels=C['parcels'], gush=C['gush'], lots={str(k): round(v.area) for k, v in lots.items()},
                buildLines={str(k): round(v.area) for k, v in bl.items()}, planArea=dict(drawn=round(plot.area), stated=C['planArea']), notes=C['notes'],
                towers=[dict(lot=b['lot'], floors=b['total'], top=b['top'], src=b['src']) for b in buildings], cancelled=C.get('cancelled', []))
    json.dump(info, open(os.path.join(out, 'concept.json'), 'w'), ensure_ascii=False, indent=1)
    print('נכתב:', out, '| מגדלים:', [(b['id'], b['total'], b['top']) for b in buildings], '| מסד:', [p['area'] for p in pods])

if __name__ == '__main__': main()
