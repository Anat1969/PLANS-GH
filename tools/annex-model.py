#!/usr/bin/env python3
"""המודל מנספח הבינוי של התב"ע (PDF וקטורי עם שכבות AutoCAD), בתוך מודל של תכנון רעיוני (ענת, 24.11.2026, תיק 1909).

נספח הבינוי של 603-1308642 הוא גיליון אחד ב-1:250 עם חמש תוכניות זו לצד זו: מרתף, קומת כניסה, שתי קומות טיפוסיות וגגות.
הכלי מחליף את מה שהיה הערכה מההדמיה בנתונים מהנספח:
  קומת הקרקע   השימושים לפי המילוי (מסחר, לובי, ציבור, מועדון דיירים), קירות וזיגוג בגובה קומת הקרקע מהחתך,
                 כניסות, ריצוף, גינון, עצים, אבני שפה, זיקות הנאה וקו הבניין התת־קרקעי.
  המגדלים       המתאר, החלונות, המרפסות והקירות מהקומה הטיפוסית, והגבהים מהחתכים (data/concept/<תיק>.json, annex.heights).
  מבני הציבור   מהמילוי של "ציבורי" בקומה הטיפוסית, בגובה שבחתך.
  המרתף         קו המרתף וקווי החניות.
העיגון: כל חמש התוכניות באותו גיליון ובאותו קנה מידה, ולכן עיגון אחד (הקו הכחול של הנספח מול הקו הכחול והמגרשים במודל)
והזזה של המסגרת. הסיבוב והשיקוף נמצאים בחיפוש, וקנה המידה קבוע (1:250).
המודל של המצגת (3 מגדלים של כ-32 קומות) נשמר ב-floors-concept.json, כחלופה להשוואה.

שימוש:  python3 tools/annex-model.py data/concept/1909.json <נספח בינוי-תוכניות.pdf>
"""
import sys, os, json, math, argparse, datetime, collections
import numpy as np
import pymupdf
from scipy.spatial import cKDTree
from shapely.geometry import Polygon, LineString, Point, box, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dm = lambda v: int(round(v * 10))
rgb = lambda c: tuple(round(v, 2) for v in c) if c else None

def segs(x):
    o = []
    for it in x['items']:
        if it[0] == 'l': o.append(((it[1].x, it[1].y), (it[2].x, it[2].y)))
        elif it[0] == 'c': o.append(((it[1].x, it[1].y), (it[4].x, it[4].y)))
        elif it[0] == 're': r = it[1]; q = [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]; o += [(q[i], q[(i+1) % 4]) for i in range(4)]
        elif it[0] == 'qu': u = it[1]; q = [(u.ul.x, u.ul.y), (u.ur.x, u.ur.y), (u.lr.x, u.lr.y), (u.ll.x, u.ll.y)]; o += [(q[i], q[(i+1) % 4]) for i in range(4)]
    return o

def rings_of(x):
    """הצורות של ציור סגור (מילוי). ציור אחד יכול להחזיק כמה תת־צורות: צורה חדשה מתחילה כשהקטע לא ממשיך את הקודם"""
    rings, cur = [], []
    for p, q in segs(x):
        if cur and math.dist(cur[-1], p) > 1e-3:
            rings.append(cur); cur = []
        if not cur: cur = [p]
        cur.append(q)
    if cur: rings.append(cur)
    return [r for r in rings if len(r) >= 3]

def ring_of(x):
    """הנקודות של ציור סגור (מילוי)"""
    pts = []
    for it in x['items']:
        if it[0] == 'l': pts += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
        elif it[0] == 'c': pts += [(it[1].x, it[1].y), (it[4].x, it[4].y)]
        elif it[0] == 're': r = it[1]; pts += [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]
        elif it[0] == 'qu': u = it[1]; pts += [(u.ul.x, u.ul.y), (u.ur.x, u.ur.y), (u.lr.x, u.lr.y), (u.ll.x, u.ll.y)]
    out = []
    for p in pts:
        if not out or math.dist(out[-1], p) > 1e-6: out.append(p)
    return out

def sample(a, b, st):
    n = max(1, int(math.dist(a, b) / st)); return [(a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n) for k in range(n+1)]

def no_holes(p):
    if not p.interiors: return [p]
    x = Polygon(p.interiors[0]).centroid.x; b = p.bounds; out = []
    for half in (box(b[0]-1, b[1]-1, x, b[3]+1), box(x, b[1]-1, b[2]+1, b[3]+1)):
        q = p.intersection(half)
        for g in getattr(q, 'geoms', [q]):
            if isinstance(g, Polygon) and g.area > 0.3: out += no_holes(g)
    return out

def polys_of(g):
    return [q for q in getattr(g, 'geoms', [g]) if isinstance(q, Polygon) and not q.is_empty]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('conf'); ap.add_argument('pdf'); ap.add_argument('--out', default='')
    a = ap.parse_args(); C = json.load(open(a.conf, encoding='utf8')); A = C['annex']; tik = str(C['tik'])
    out = a.out or os.path.join(ROOT, 'layers', tik)
    model = json.load(open(os.path.join(out, 'model.json')))
    K = A.get('scale', 250) * 0.0254 / 72
    page = pymupdf.open(a.pdf)[0]; dr = page.get_drawings()
    VP = A['viewports']; role = A['roles']
    inv = lambda v: [x for x in dr if VP[v][0]-150 <= x['rect'].y0 <= VP[v][1]+150]
    by = {v: collections.defaultdict(list) for v in range(len(VP))}
    for v in range(len(VP)):
        for x in inv(v): by[v][x.get('layer') or ''].append(x)
    print('ציורים בכל תוכנית:', [sum(len(L) for L in by[v].values()) for v in range(len(VP))])

    # ── עיגון: הקו הכחול של הנספח מול הקו הכחול והמגרשים של המודל (שכבר מעוגן ל-GIS). קנה מידה קבוע ──
    tgt = []
    for f in model['lines']['plot'] + model['lines']['lots']:
        r = [(f[i]/10, f[i+1]/10) for i in range(0, len(f), 2)]
        for i in range(len(r)-1): tgt += sample(r[i], r[i+1], 0.25)
    tgt = np.array(tgt); T = cKDTree(tgt); g0 = role['ground']
    src = np.array([q for L in A['anchorLayers'] for x in by[g0][L] for s_ in segs(x) for q in sample(s_[0], s_[1], 1.0)])
    R = np.array(A['init']['R']); t = np.array(A['init']['t'])
    for it in range(60):
        d, i = T.query((K*(R @ src.T)).T + t); mk = d <= max(np.percentile(d, 70), 0.2)
        P, Q = src[mk], tgt[i[mk]]; pp, qq = P.mean(0), Q.mean(0)
        U, S_, Vt = np.linalg.svd((K*(R @ (P-pp).T)).T.T @ (Q-qq)); dR = Vt.T @ U.T
        if np.linalg.det(dR) < 0: Vt[-1] *= -1; dR = Vt.T @ U.T
        R = dR @ R; t = qq - K*R @ pp
    d, _ = T.query((K*(R @ src.T)).T + t)
    geo = dict(median=round(float(np.median(d)), 3), within05=round(float((d < .5).mean()), 3), within1=round(float((d < 1).mean()), 3), mPerPt=round(K, 5))
    print('עיגון הנספח:', geo)
    if geo['median'] > 0.5: sys.exit('העיגון לא עבר')
    def tf(v):
        dy = VP[v][0] - VP[g0][0]; tv = t - K*R @ np.array([0, dy])
        return lambda p: tuple(K*(R @ np.array(p)) + tv)
    lots = {}
    for f in model['lines']['lots']:
        p = Polygon([(f[i]/10, f[i+1]/10) for i in range(0, len(f), 2)])
        lots[len(lots)] = p
    plot = Polygon([(model['lines']['plot'][0][i]/10, model['lines']['plot'][0][i+1]/10) for i in range(0, len(model['lines']['plot'][0]), 2)])
    concept = json.load(open(os.path.join(out, 'concept.json')))
    lot_no = {}   # מספר המגרש לכל פוליגון: לפי הגודל מ-concept.json
    for n, area in concept['lots'].items():
        k = min(lots, key=lambda k: abs(lots[k].area - area) + (1e6 if k in lot_no.values() else 0)); lot_no[int(n)] = k
    lotP = {n: lots[k] for n, k in lot_no.items()}
    which_lot = lambda pt: next((n for n, p in lotP.items() if p.buffer(0.5).contains(Point(pt))), None)

    def fills(v, layer, color=None):
        f = tf(v); out_ = []
        for x in by[v][layer]:
            if x['type'] not in ('f', 'fs') or (color and rgb(x.get('fill')) != tuple(color)): continue
            ps = [Polygon([f(p) for p in r]).buffer(0) for r in rings_of(x)]
            q = None
            for p in sorted(ps, key=lambda g: -g.area):            # זוגי־אי זוגי: צורה בתוך צורה היא חור
                q = p if q is None else (q.difference(p) if q.contains(p) else q.union(p))
            if q is not None and q.area > 0.05: out_.append(q)
        return out_
    def lines_of(v, layers, color=None, straight=False):
        f = tf(v); out_ = []
        for L in layers:
            for x in by[v][L]:
                if color and rgb(x.get('color')) != tuple(color): continue
                for p, q in (segs(x) if not straight else [(it[1], it[2]) for it in x['items'] if it[0] == 'l'] if True else []):
                    if straight: p, q = (p.x, p.y), (q.x, q.y)
                    if math.dist(p, q) > 1e-6: out_.append(LineString([f(p), f(q)]))
        return out_
    flat = lambda g: [v for q in g.coords for v in (dm(q[0]), dm(q[1]))]
    ring_dm = lambda p: [v for q in list(p.exterior.coords)[:-1] for v in (dm(q[0]), dm(q[1]))]
    closed = lambda p: [v for q in p.exterior.coords for v in (dm(q[0]), dm(q[1]))]

    # ── קומת הקרקע ──
    USES = A['uses']; uses = {}
    for k, (layer, hexc) in USES.items():
        uses[k] = unary_union(fills(g0, layer)).buffer(0.05).buffer(-0.05)
    gw = unary_union([l.buffer(0.18) for l in lines_of(g0, A['wallLayers'], straight=True)])   # קירות קומת הקרקע סוגרים את התאים הלבנים (מדרגות, חדרים טכניים)
    gw = unary_union([Polygon(q.exterior) for q in polys_of(gw.buffer(1.0).buffer(-1.0)) if Polygon(q.exterior).area > 20])
    ground = unary_union(list(uses.values()) + [gw])
    ground = unary_union([q.buffer(1.0, join_style=2).buffer(-1.0, join_style=2) for q in polys_of(ground) if q.area > 8])
    ground = unary_union([Polygon(q.exterior) for q in polys_of(ground)])
    shopL = unary_union([q.boundary for q in polys_of(uses.get('shop', Polygon()))])
    walls, glass = [], []
    for q in polys_of(ground):
        cs = list(q.simplify(0.1).exterior.coords)
        for i in range(len(cs)-1):
            sg = LineString([cs[i], cs[i+1]])
            if sg.length < .3: continue
            if not shopL.is_empty and sg.centroid.distance(shopL) < 0.4: glass.append(sg)
            else: walls.append(sg.buffer(0.15, cap_style=2))
    print('קומת קרקע:', {k: round(v.area) for k, v in uses.items()}, 'מבנים', len(polys_of(ground)), 'זיגוג', round(sum(g.length for g in glass)), 'מ\'')

    # פיתוח בתחום התוכנית: ריצוף, גינון, עצים, כניסות, אבני שפה, זיקות הנאה
    paving = unary_union([p for L, c in A['paving'] for p in fills(g0, L, c)]).difference(ground)
    greenL = lines_of(g0, A['greenHatch'])
    green = unary_union([l.buffer(0.7) for l in greenL]).buffer(-0.5).difference(ground) if greenL else Polygon()
    trees = []
    fT = tf(g0)
    for x in by[g0][A['treeLayer']]:
        r = x['rect']; w, h = r.width*K, r.height*K
        if not (1.0 < w < 12 and 1.0 < h < 12 and abs(w-h) < 1.5): continue
        c = fT(((r.x0+r.x1)/2, (r.y0+r.y1)/2))
        if all(math.dist(c, q[:2]) > 1.2 for q in trees): trees.append([round(c[0], 2), round(c[1], 2), round(max(w, h)/2, 2)])
    entries = []
    for x in by[g0][A['entryLayer']]:
        r = x['rect']
        if r.width*K > 4 or r.height*K > 4: continue
        c = fT(((r.x0+r.x1)/2, (r.y0+r.y1)/2))
        if all(math.dist(c, q) > 3 for q in entries): entries.append([round(c[0], 2), round(c[1], 2)])
    curbs = lines_of(g0, A['curbLayers'])
    ease = lines_of(g0, A['easementLayers'])
    print(f'פיתוח: ריצוף {round(paving.area)} מ"ר, גינון {round(green.area)} מ"ר, {len(trees)} עצים, {len(entries)} כניסות, אבני שפה {round(sum(l.length for l in curbs))} מ\'')

    # ── המרתף ──
    b0 = role['basement']
    bline = unary_union(fills(b0, A['basementLayer'])) if A.get('basementLayer') else Polygon()
    parking = lines_of(b0, A['parkingLayers'])
    print(f'מרתף: {round(bline.area)} מ"ר, קווי חניה {round(sum(l.length for l in parking))} מ\'')

    # ── המגדלים מהקומה הטיפוסית ──
    ty = role['typical']; Hh = A['heights']
    wallsL = lines_of(ty, A['wallLayers'], straight=True)          # בלי קשתות: אלה הדלתות
    wallU = unary_union([l.buffer(0.18) for l in wallsL])
    bodies = [Polygon(q.exterior).buffer(0.4, join_style=2).buffer(-0.4, join_style=2) for q in polys_of(wallU.buffer(2.0).buffer(-2.0)) if Polygon(q.exterior).area > 150]
    winL = lines_of(ty, A['windowLayers']); railL = lines_of(ty, A['railLayers'])
    balcP = [p for L in A['balconyLayers'] for p in fills(ty, L)]
    pubP = [p for p in fills(ty, A['publicLayer'])]
    plans, buildings = {}, []
    seen = set()
    for bi, env in enumerate(sorted(bodies, key=lambda q: -q.area)):
        env = env.buffer(1.5, join_style=2).buffer(-1.5, join_style=2).simplify(0.25)      # חזית חלקה: בלי שקעים קטנים וקשתות
        if env.geom_type != 'Polygon': env = max(polys_of(env), key=lambda q: q.area)
        lot = which_lot((env.centroid.x, env.centroid.y))
        if lot not in A['towerLots'] or lot in seen: continue                          # מגדל אחד למגרש: הגוף הגדול
        seen.add(lot)
        ec = list(env.exterior.coords); edges = [LineString([ec[i], ec[i+1]]) for i in range(len(ec)-1)]
        opens = []
        for w in winL:
            if w.length < 0.5 or w.centroid.distance(env.exterior) > 2.2: continue          # חלון בשקע (מרפסת פנימית) מוטל על החזית המוחלקת
            e = min(edges, key=lambda E: E.distance(w.centroid))
            p0, p1 = e.interpolate(e.project(Point(w.coords[0]))), e.interpolate(e.project(Point(w.coords[-1])))
            if p0.distance(p1) > 0.5: opens.append([dm(p0.x), dm(p0.y), dm(p1.x), dm(p1.y)])
        bal = [q for q in balcP if q.intersects(env.buffer(3)) and q.difference(env).area > 1]
        bal = [q.difference(env) for q in bal]; bal = [g for q in bal for g in polys_of(q) if g.area > 1]
        rails = [[dm(l.coords[0][0]), dm(l.coords[0][1]), dm(l.coords[-1][0]), dm(l.coords[-1][1])] for l in railL if l.distance(env) < 3 and l.length > 0.3]
        wpol = [g for g in polys_of(unary_union([l.buffer(0.12) for l in wallsL if env.buffer(0.5).contains(l.centroid)]).simplify(0.05)) for g in no_holes(g) if g.area > 0.05]
        mr = env.minimum_rotated_rectangle; xy = list(mr.exterior.coords); ang = math.atan2(xy[1][1]-xy[0][1], xy[1][0]-xy[0][0])
        cx, cy = env.centroid.x, env.centroid.y
        core = affinity.rotate(box(cx-4.5, cy-3.5, cx+4.5, cy+3.5), ang, use_radians=True, origin=(cx, cy))
        pid = f'A{lot}'
        plans[pid] = dict(name=f'מגרש {lot}: קומה טיפוסית (נספח הבינוי)', src='annex', area=round(env.area), env=ring_dm(env), open=opens, rail=rails,
                          balc=[ring_dm(q) for q in bal], walls=[ring_dm(q) for q in wpol], core=[ring_dm(core)])
        plans[pid+'R'] = dict(name=f'מגרש {lot}: גג', src='annex', env=ring_dm(env), core=[ring_dm(core)])
        fl = [dict(n=k, plan=pid, use='res', y=round(Hh['ground'] + (k-1)*Hh['floor'], 2), h=Hh['floor']) for k in range(1, Hh['floors']+1)]
        buildings.append(dict(id=str(lot), lot=lot, label=f'מגרש {lot} · {Hh["floors"]+1} קומות (נספח הבינוי)', src='נספח הבינוי: הקומה הטיפוסית. הגבהים מהחתכים',
                              floors=fl, top=Hh['roof'], roof=dict(plan=pid+'R', y=Hh['roof'], h=round(Hh['top']-Hh['roof'], 2)), total=Hh['floors']+1,
                              fit=dict(method='נספח הבינוי מעוגן לקו הכחול', lot=lot, median=geo['median'])))
        print(f'  מגדל במגרש {lot}: {round(env.area)} מ"ר, {len(opens)} פתחים, {len(bal)} מרפסות, {len(wpol)} קירות')
    for j, q in enumerate(polys_of(unary_union(pubP).buffer(0.3).buffer(-0.3))):
        if q.area < 30: continue
        lot = which_lot((q.centroid.x, q.centroid.y)); pid = f'P{j}'
        plans[pid] = dict(name=f'מגרש {lot}: מבנה ציבור', src='annex', area=round(q.area), env=ring_dm(q.simplify(0.1)), open=[], rail=[], balc=[], walls=[], core=[])
        fl = [dict(n=k, plan=pid, use='public', y=round(Hh['ground'] + (k-1)*Hh['public'], 2), h=Hh['public']) for k in range(1, Hh['publicFloors']+1)]
        buildings.append(dict(id=f'ציבור {lot}', lot=lot, label=f'מגרש {lot} · מבנה ציבור', src='נספח הבינוי: מילוי "ציבורי" בקומה הטיפוסית', floors=fl,
                              top=round(Hh['ground'] + Hh['publicFloors']*Hh['public'], 2), total=Hh['publicFloors']+1, fit=dict(method='נספח הבינוי', lot=lot, median=geo['median'])))
        print(f'  מבנה ציבור במגרש {lot}: {round(q.area)} מ"ר')

    # ── גג המסד: קומת הקרקע פחות המגדלים ומבני הציבור ──
    upper = unary_union([Polygon([(plans[b['floors'][0]['plan']]['env'][i]/10, plans[b['floors'][0]['plan']]['env'][i+1]/10) for i in range(0, len(plans[b['floors'][0]['plan']]['env']), 2)]) for b in buildings])
    pods = []
    for q in polys_of(ground):
        roof = q.difference(upper.buffer(0.02))
        rs = [g for r_ in polys_of(roof) if r_.area > 6 for g in no_holes(r_.simplify(0.05))]
        if not rs: continue
        gr = unary_union([g.buffer(-2.0, join_style=2).buffer(0.5) for g in rs])
        pods.append(dict(kind='garden', top=Hh['ground'] + 0.12, area=round(sum(g.area for g in rs)), roof=[ring_dm(g) for g in rs],
                         green=[ring_dm(g) for g2 in polys_of(gr) if g2.area > 6 for g in no_holes(g2)], edge=ring_dm(Polygon(q.exterior))))

    # ── כתיבה: מה שבתחום התוכנית מתחלף בנספח. מחוץ לו נשארים תוכנית המתחם ומפת המדידה ──
    inside = lambda f: plot.buffer(-0.5).contains(Polygon([(f[i]/10, f[i+1]/10) for i in range(0, len(f), 2)]).representative_point()) if len(f) >= 6 else False
    for k in list(model['surf']):
        if k in ('wall',): continue
        model['surf'][k] = [s_ for s_ in model['surf'][k] if not inside(s_[1])]
    surf_add = lambda kind, hexc, geom: model['surf'].setdefault(kind, []).extend([[hexc, ring_dm(g)] for p in polys_of(geom) for g in no_holes(p.simplify(0.08)) if g.area > 0.5])
    surf_add('paving', '#e9dfc9', paving.intersection(plot)); surf_add('green', '#86b46a', green.intersection(plot))
    for k, (layer, hexc) in USES.items(): surf_add('use' + k[0].upper() + k[1:], hexc, uses[k])
    model['surf']['wall'] = [['#e8e4da', ring_dm(w)] for w in walls]
    model['lines']['glass'] = [flat(g) for g in glass]
    model['lines']['curb'] = [flat(l) for l in curbs]
    model['lines']['easement'] = [flat(l) for l in ease] or model['lines'].get('easement', [])
    model['lines']['bline'] = [closed(q) for q in polys_of(bline)] or model['lines'].get('bline', [])
    model['lines']['parking'] = [flat(l) for l in parking]
    keepT = [q for q in model['obj'].get('treeNew', []) if not plot.contains(Point(q[0], q[1]))]
    model['obj']['treeNew'] = keepT + trees
    model['obj']['entry'] = entries
    model['foot'] = [ring_dm(q) for q in polys_of(ground)]
    model['wallH'] = Hh['ground']; model['glassH'] = round(Hh['ground'] - 0.4, 2)
    model['annex'] = dict(source=A['source'], georef=geo, uses={k: round(v.area) for k, v in uses.items()}, trees=len(trees), entries=len(entries),
                          towers=[b['lot'] for b in buildings if not b['id'].startswith('ציבור')], heights=Hh, parking=A.get('parking'))
    json.dump(model, open(os.path.join(out, 'model.json'), 'w'), separators=(',', ':'))
    # קומות המרתף מהחתכים: 4 קומות מתחת לתאי שטח המגדלים (בתב"ע המאושרת לא נקבע מספר)
    rp = os.path.join(out, 'renewal.json'); rn = json.load(open(rp))
    for L in rn['lots']:
        if L['lot'] in A['towerLots'] and not L.get('below'): L['below'] = len(Hh['basement'])
    rn['sources'] = dict(rn.get('sources') or {}, below=f"קומות המרתף: {len(Hh['basement'])}, מהחתכים בנספח הבינוי של 603-1308642. המתאר הוא גבול המגרש, הנחה")
    json.dump(rn, open(rp, 'w'), ensure_ascii=False, separators=(',', ':'))
    fp = os.path.join(out, 'floors.json')
    if os.path.exists(fp) and not os.path.exists(os.path.join(out, 'floors-concept.json')):
        old = json.load(open(fp))
        if old.get('concept'): json.dump(old, open(os.path.join(out, 'floors-concept.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    floors = dict(tik=tik, source=A['source'], made=datetime.date.today().isoformat(), annex=True,
                  assume=dict(heights=Hh, sections=A['sectionsNote'], public=f"גובה קומת ציבור {Hh['public']} מ': הנחה", podium='גג המסד: קומת הקרקע פחות המגדלים ומבני הציבור. הגינון על הגג להמחשה',
                              roof='מבנה הגג עד גובה החתך. המערכות על הגג להמחשה'),
                  buildings=buildings, plans=plans, podium=pods, alternative='floors-concept.json')
    json.dump(floors, open(fp, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('נכתב:', out, '| בניינים:', [(b['id'], b['total']) for b in buildings], '| גג מסד:', [p['area'] for p in pods])

if __name__ == '__main__': main()
