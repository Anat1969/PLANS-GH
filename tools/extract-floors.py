#!/usr/bin/env python3
"""קומות וחזיתות מתוכניות האדריכל (ענת, 23.11.2026: "להשלים את המודל התלת־ממדי של החזיתות והקומות").

שימוש:
  python3 tools/extract-floors.py --tik 1913 --src <תיקייה עם DWG/DXF ו-PDF> [--out layers/1913] [--png <תמונת בדיקה>]

הקלט: תוכניות קומה של כל בניין. שם הקובץ אומר את הבניין ואת הקומות:
  "BLD A- טיפוסית 5-21.dwg", "BLD D - קומה 19.dwg", "BLD C - קומת גג.dwg", "BLD A- ח-מכונות מעלית.dwg".
  DWG מומר ל-DXF עם dwg2dxf (LibreDWG). PDF של בניין (BUILDING B ...pdf) נקרא כשרטוט וקטורי, תוכנית ליד תוכנית,
  והקומות נקראות מהכותרת שמתחת לכל תוכנית ("טיפוסית ראשונה 01-08", "קומה 35").

לכל תוכנית קומה:
  env   המתאר החיצוני: הקירות, החלונות והדלתות, עם סגירה של הפתחים.
  open  הפתחים בחזית: קטעי המתאר שאין בהם קיר (חלון, ויטרינה, יציאה למרפסת).
  balc  המרפסות: מהמעקות בשרטוט (DWG) או מהמילוי שלהן (PDF), מחוץ למתאר.
  walls הקירות עצמם, לחתך הקומה.

עיגון למודל (רשת ישראל, יחסית ל-e0, n0 של model.json):
  DWG: קווי המגרש שבשרטוט (C-PROP-LINE) מותאמים לצלעות מגרשי התב"ע (renewal.json): סיבוב והזזה. מדד: סטייה חציונית.
  PDF בלי קווי מגרש: הסיבוב של הבניינים האחרים, והמתאר מותאם למעטפת הבניין בתב"ע (הערכה).

מה שאינו בשרטוט, ומסומן כך בקובץ (`assume`): גובה הקומות, גובה החלונות, וקומה שאין לה תוכנית (נלקחת מהקומה שמתחתיה).
"""
import sys, os, re, json, math, glob, argparse, subprocess, tempfile, importlib.util
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box
from shapely.ops import unary_union, polygonize
from shapely import affinity

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location('am', os.path.join(ROOT, 'tools', 'auto-model.py')); AM = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(AM)

# ── התוכנית: מה שידוע מהמצגת ומה שהוא הנחה ──
# השימושים: מצגת פורום היועצים 22.11.2026, עמ' 14 ו-16. הגבהים: הנחה (אין חתכים).
CONF = {
 '1913': {
  'src': 'פישר אלחנני אדריכלים, תוכניות קומה (DWG) ובניין B (PDF), ומצגת פורום יועצים 22.11.2026',
  'use': { 'A': { 1:'work', 2:'public', 3:'public', 4:'public' } },
  'base': { 'A': 22.00, 'B': 22.35, 'C': 22.45, 'D': 23.40 },       # מפלס 0.00 (מ' מעל הים), מהמצגת עמ' 17
  'total': { 'A': 35, 'B': 35, 'C': 9, 'D': 20 },                     # "קומות סה"כ" במצגת
  'lots': { 'A': 1, 'B': 2, 'C': 3, 'D': 3 },
 }
}
H = { 'ground': 4.5, 'res': 3.15, 'work': 4.0, 'public': 3.6, 'roof': 3.4, 'mech': 3.0 }   # מ', הנחה

# ── שמות קבצים → בניין וקומות ──
def parse_name(name):
    n = name.replace('‏', '').replace('‎', '')
    m = re.search(r'(?:BLD|BUILDING)\s*-?\s*([A-Z])\b', n)
    if not m: return None
    b = m.group(1)
    if 'מכונות' in n: return b, 'mech', []
    if 'גג' in n: return b, 'roof', []
    rest = re.sub(r'\d{4}\.\d\d\.\d\d', '', n[m.end():])           # בלי תאריך
    r = re.search(r'(\d+)\s*-\s*(\d+)', rest)
    if r: a, z = int(r.group(1)), int(r.group(2)); return b, 'floor', list(range(min(a, z), max(a, z)+1))
    r = re.findall(r'\d+', rest)
    if r and 'קומ' in rest: return b, 'floor', [int(r[-1])]
    return b, 'sheet', []

# ── DXF ──
def dxf_geom(path):
    import ezdxf
    from ezdxf import path as P
    from ezdxf.disassemble import recursive_decompose
    doc = ezdxf.readfile(path); out = {'wall': [], 'hatch': [], 'glaz': [], 'rail': [], 'prop': [], 'flor': []}
    LAY = {'A-WALL': 'wall', 'A-GLAZ': 'glaz', 'A-DOOR': 'glaz', 'A-FLOR-HRAL': 'rail', 'C-PROP-LINE': 'prop', 'A-FLOR': 'flor'}
    for e in recursive_decompose(doc.modelspace()):
        L = e.dxf.layer
        if e.dxftype() == 'HATCH' and L in ('A-WALL-PATT', 'A-WALL'):
            for bp in P.from_hatch(e):
                pts = [(p.x/100, p.y/100) for p in bp.flattening(2)]
                if len(pts) >= 3:
                    pg = Polygon(pts).buffer(0)
                    if pg.area > 0.005: out['hatch'].append(pg)
            continue
        k = LAY.get(L)
        if not k or e.dxftype() in ('MTEXT', 'TEXT', 'DIMENSION', 'HATCH'): continue
        try: pts = [(p.x/100, p.y/100) for p in P.make_path(e).flattening(2)]     # ס"מ → מ'
        except Exception: continue
        if len(pts) >= 2: out[k].append(LineString(pts))
    return out

def to_dxf(src_dir, tmp):
    files = []
    for f in sorted(glob.glob(os.path.join(src_dir, '*.dwg')) + glob.glob(os.path.join(src_dir, '*.dxf'))):
        base = os.path.splitext(os.path.basename(f))[0]
        if f.endswith('.dxf'): files.append((base, f)); continue
        if os.path.exists(os.path.join(src_dir, base+'.dxf')): continue
        o = os.path.join(tmp, base+'.dxf')
        subprocess.run(['dwg2dxf', '-y', '-o', o, f], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
        if os.path.exists(o): files.append((base, o))
    return files

# ── PDF (בניין בלי DWG): תוכניות זו ליד זו, קירות כמילוי צבעוני ──
PT = 0.0254/72                  # מ' לנקודה בדף
def pdf_plans(path):
    import fitz
    page = fitz.open(path)[0]
    txt = page.get_text('text'); sc = re.search(r'1\s*:\s*(\d+)', txt); scale = int(sc.group(1)) if sc else 100
    k = PT*scale
    words = page.get_text('words')
    # כותרות: "קומה 35", "טיפוסית ראשונה 01-08". מספר הקומה הוא המילה שלפני "קומה"/"טיפוסית" באותה שורה.
    rows = {}
    for w in words:
        if w[1] > page.rect.height*0.85: rows.setdefault(round(w[1]/4), []).append(w)
    titles = []
    for row in rows.values():
        row.sort(key=lambda w: w[0])
        for i, w in enumerate(row):
            if w[4] in ('קומה', 'טיפוסית') and i > 0:
                for j in (i-1, i-2):
                    m = re.fullmatch(r'(\d+)(?:-(\d+))?', row[j][4]) if j >= 0 else None
                    if not m: continue
                    a = int(m.group(1)); z = int(m.group(2) or a)
                    if not any(abs(t[0]-row[j][0]) < 300 for t in titles):
                        titles.append((row[j][0], list(range(a, z+1)), ' '.join(x[4] for x in row[j:i+3] if not re.fullmatch(r'[-:\d]+', x[4]) or x is row[j])))
                    break
    titles.sort()
    WALL = {(0.0, 0.5, 1.0), (1.0, 0.0, 0.0), (0.0, 0.0, 0.0)}; BALC = (0.87, 0.87, 1.0)
    fills = []
    for d in page.get_drawings():
        f = d.get('fill')
        if not f: continue
        c = tuple(round(x, 2) for x in f)
        kind = 'wall' if c in WALL else 'balc' if c == BALC else None
        if not kind: continue
        pts = []
        for it in d['items']:
            if it[0] == 're': r = it[1]; pts = [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]; break
            if it[0] == 'qu': q = it[1]; pts = [(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]; break
            if it[0] == 'l': pts += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
        if len(pts) < 3: continue
        pg = Polygon(pts).buffer(0)
        if pg.area <= 0: continue
        fills.append((kind, pg))
    # תוכנית = הקירות שבין כותרת לכותרת (הכותרת בפינה הימנית התחתונה של התוכנית)
    plans = []
    xs = [t[0] for t in titles]
    for i, (x, fl, name) in enumerate(titles):
        lo = xs[i-1] + 60 if i else -1e9; hi = x + 260
        sel = [(kd, g) for kd, g in fills if lo < g.centroid.x < hi and g.centroid.y < page.rect.height*0.95]
        conv = lambda g: affinity.scale(affinity.translate(g, 0, -page.rect.height), k, -k, origin=(0, 0))
        plans.append({'floors': fl, 'name': name,
                      'wall': [conv(g) for kd, g in sel if kd == 'wall'], 'balc': [conv(g) for kd, g in sel if kd == 'balc']})
    return plans, scale

def raster(polys, x0, y0, W, Hh, px=0.1):
    from shapely import vectorized
    xs = x0 + (np.arange(W)+.5)*px; ys = y0 + (np.arange(Hh)+.5)*px; X, Y = np.meshgrid(xs, ys)
    return vectorized.contains(unary_union(polys), X, Y).astype(float)

def align_plans(plans):
    """התוכניות בגיליון יושבות זו ליד זו. כל תוכנית מוזזת אל התוכנית הנמוכה, לפי ההתאמה הטובה של הקירות (מתאם צולב)."""
    ref = min(plans, key=lambda p: p['floors'][0]); px = 0.1
    def box_of(p): return unary_union(p['wall']).bounds
    rb = box_of(ref)
    for p in plans:
        if p is ref: continue
        b = box_of(p)
        W = int(max(rb[2]-rb[0], b[2]-b[0])/px) + 64; Hh = int(max(rb[3]-rb[1], b[3]-b[1])/px) + 64
        A = raster(ref['wall'], rb[0]-3, rb[1]-3, W, Hh, px); B = raster(p['wall'], b[0]-3, b[1]-3, W, Hh, px)
        F = np.fft.irfft2(np.fft.rfft2(A, s=(2*Hh, 2*W)) * np.conj(np.fft.rfft2(B, s=(2*Hh, 2*W))), s=(2*Hh, 2*W))
        iy, ix = np.unravel_index(np.argmax(F), F.shape)
        if iy > Hh: iy -= 2*Hh
        if ix > W: ix -= 2*W
        dx = (rb[0]-3) - (b[0]-3) + ix*px; dy = (rb[1]-3) - (b[1]-3) + iy*px
        p['wall'] = [affinity.translate(g, dx, dy) for g in p['wall']]; p['balc'] = [affinity.translate(g, dx, dy) for g in p['balc']]
        p['shift'] = (round(dx, 2), round(dy, 2))

# ── גאומטריה של תוכנית קומה ──
def largest(g):
    if isinstance(g, Polygon): return g
    return max(getattr(g, 'geoms', []), key=lambda p: p.area, default=Polygon())

def plan_geom(walls_line, hatches, glaz, rails, wall_polys=None, balc_polys=None, close=0.9):
    solid = unary_union(([l.buffer(0.04, cap_style=2) for l in walls_line] if walls_line else []) + (hatches or []) + (wall_polys or []))
    if solid.is_empty: return None
    big = unary_union([solid] + [l.buffer(0.06) for l in glaz])
    env = largest(big.buffer(close, join_style=2).buffer(-close, join_style=2))
    if env.is_empty or env.area < 30: return None
    env = Polygon(env.exterior).simplify(0.06)
    # פתחים: לאורך המתאר, נקודה שמאחוריה (10 ס"מ פנימה) אין קיר
    sol = solid.buffer(0.03); opens = []
    ring = list(env.exterior.coords)
    sgn = 1 if env.exterior.is_ccw else -1
    for a, b in zip(ring, ring[1:]):
        L = math.dist(a, b)
        if L < 0.6: continue
        dx, dy = (b[0]-a[0])/L, (b[1]-a[1])/L; nx, ny = -dy*sgn, dx*sgn      # פנימה
        n = int(L/0.1); run = None
        for i in range(n+1):
            t = i/n*L; p = Point(a[0]+dx*t+nx*0.1, a[1]+dy*t+ny*0.1)
            hole = not sol.contains(p)
            if hole and run is None: run = t
            if (not hole or i == n) and run is not None:
                t1 = t
                if t1-run >= 0.5: opens.append((a[0]+dx*run, a[1]+dy*run, a[0]+dx*t1, a[1]+dy*t1))
                run = None
    # מרפסות
    balc = []
    if balc_polys:
        for g in balc_polys:
            g = g.difference(env.buffer(0.02))
            for p in getattr(g, 'geoms', [g]):
                if p.area > 1.0: balc.append(p.simplify(0.05))
    elif rails:
        R = unary_union(rails)
        faces = polygonize(unary_union([R, env.exterior]))
        for f in faces:
            if f.area < 1.2 or f.area > 70 or env.buffer(-0.05).contains(f.representative_point()): continue
            if f.exterior.length / max(f.area, .1) > 6: continue
            if f.buffer(0.05).intersection(R).length < 1.0: continue
            if f.distance(env) > 0.1: continue
            balc.append(f.simplify(0.05))
    balc = [b for b in balc if b.is_valid and not b.is_empty]
    # מעקה: היקף המרפסת, חוץ מהצלע שצמודה לבניין
    rail = []
    for b in balc:
        for p in getattr(b, 'geoms', [b]):
            c = list(p.exterior.coords)
            for a, z in zip(c, c[1:]):
                mid = Point((a[0]+z[0])/2, (a[1]+z[1])/2)
                if mid.distance(env) > 0.12 and math.dist(a, z) > 0.2: rail.append((a[0], a[1], z[0], z[1]))
    walls = solid.intersection(env.buffer(0.05)).simplify(0.03)
    walls = [p for p in getattr(walls, 'geoms', [walls]) if isinstance(p, Polygon) and p.area > 0.04]
    return {'env': env, 'open': opens, 'balc': balc, 'rail': rail, 'walls': walls}

# ── עיגון ──
def samples(lines, step=0.5):
    out = []
    for l in lines:
        c = list(l.coords)
        for a, b in zip(c, c[1:]):
            L = math.dist(a, b); n = max(1, int(L/step))
            out += [(a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n) for i in range(n+1)]
    return np.array(out)

def tf_pts(p, x):
    th, tx, ty = x; c, s = math.cos(th), math.sin(th)
    return np.c_[p[:, 0]*c - p[:, 1]*s + tx, p[:, 0]*s + p[:, 1]*c + ty]

def tf_geom(g, x):
    th, tx, ty = x
    return affinity.translate(affinity.rotate(g, th, origin=(0, 0), use_radians=True), tx, ty)

def fit_prop(pts, lot_poly, th0):
    from scipy.optimize import minimize
    bnd = lot_poly.exterior; sub = pts[::3]
    def cost(x):
        q = tf_pts(sub, x); return float(np.mean(np.minimum([bnd.distance(Point(*p)) for p in q], 3)**2))
    lc = np.array(lot_poly.centroid.coords[0]); cx, cy = pts.mean(0); best = None
    for dth in np.radians(np.arange(-8, 8.1, 2)):
        th = th0+dth; c, s = math.cos(th), math.sin(th); base = [th, lc[0]-(cx*c-cy*s), lc[1]-(cx*s+cy*c)]
        for dx in range(-30, 31, 5):
            for dy in range(-30, 31, 5):
                x = [base[0], base[1]+dx, base[2]+dy]; v = cost(x)
                if best is None or v < best[0]: best = (v, x)
    r = minimize(cost, best[1], method='Nelder-Mead', options={'xatol': 1e-4, 'fatol': 1e-7, 'maxiter': 5000})
    d = np.array([bnd.distance(Point(*p)) for p in tf_pts(pts, r.x)])
    return list(map(float, r.x)), float(np.median(d)), float(np.mean(d < 0.5))

def fit_shape(poly, target, th0):
    """מתאר הקומה מול מעטפת הבניין בתב"ע: סיבוב סביב th0 (ובכפולות של 90°), והזזה. מדד: חפיפה (IoU)."""
    from scipy.optimize import minimize
    c0 = np.array(poly.centroid.coords[0]); tc = np.array(target.centroid.coords[0])
    def place(x): return tf_geom(poly, x)
    def cost(x):
        g = place(x); u = g.union(target).area; return 1 - g.intersection(target).area/u if u else 1
    best = None
    for q in range(4):
        for dth in np.radians(np.arange(-4, 4.1, 1)):
            th = th0 + q*math.pi/2 + dth; c, s = math.cos(th), math.sin(th)
            x = [th, tc[0]-(c0[0]*c-c0[1]*s), tc[1]-(c0[0]*s+c0[1]*c)]; v = cost(x)
            if best is None or v < best[0]: best = (v, x)
    r = minimize(cost, best[1], method='Nelder-Mead', options={'xatol': 1e-3, 'fatol': 1e-6, 'maxiter': 3000})
    return list(map(float, r.x)), 1-float(r.fun)

def no_holes(p, depth=0):
    """קיר שמקיף חלל: חיתוך דרך כל חור, עד שאין חורים. כך כל חלק הוא מצולע פשוט, שהדפדפן מפרק למשולשים בלי טעות."""
    from shapely.ops import split
    if not p.interiors or depth > 8: return [Polygon(p.exterior)] if p.area > 0.04 else []
    c = p.interiors[0].centroid; b = p.bounds
    line = LineString([(c.x, b[1]-1), (c.x, b[3]+1)]) if depth % 2 == 0 else LineString([(b[0]-1, c.y), (b[2]+1, c.y)])
    out = []
    for q in split(p, line).geoms:
        if isinstance(q, Polygon) and q.area > 0.01: out += no_holes(q, depth+1)
    return out

# ── הפלט ──
dm = lambda v: int(round(v*10))
def ring_dm(p): return [dm(c) for xy in list(p.exterior.coords)[:-1] for c in xy]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--tik', required=True); ap.add_argument('--src', required=True)
    ap.add_argument('--out'); ap.add_argument('--png'); a = ap.parse_args()
    out = a.out or os.path.join(ROOT, 'layers', a.tik); conf = CONF.get(a.tik, {})
    model = json.load(open(os.path.join(out, 'model.json'))); rn = json.load(open(os.path.join(out, 'renewal.json')))
    loc = lambda c: (AM.wgs2itm(c[1], c[0])[0]-model['e0'], AM.wgs2itm(c[1], c[0])[1]-model['n0'])
    lots = {p['lot']: Polygon([loc(c) for c in p['c']]) for p in rn['parcels']}
    envs = {m['lot']: Polygon([loc(c) for c in m['c']]) for m in rn['massing'] if m['kind'] == 'tower'}
    foot = [Polygon([(f[i]/10, f[i+1]/10) for i in range(0, len(f), 2)]).buffer(0) for f in model['foot']]

    raw = {}     # בניין → רשימת תוכניות
    with tempfile.TemporaryDirectory() as tmp:
        for base, f in to_dxf(a.src, tmp):
            p = parse_name(base)
            if not p: print('דילוג (שם לא מזוהה):', base); continue
            b, kind, fl = p; g = dxf_geom(f)
            raw.setdefault(b, []).append({'name': base, 'kind': kind, 'floors': fl, 'src': 'dwg', **g})
            print(f'DWG {b} {kind} {fl[:1]}..{fl[-1:]} קירות {len(g["wall"])} מעקות {len(g["rail"])}')
    for f in sorted(glob.glob(os.path.join(a.src, '*.pdf'))):
        p = parse_name(os.path.basename(f))
        if not p or p[0] in raw: continue
        plans, scale = pdf_plans(f)
        align_plans(plans)
        for pl in plans:
            raw.setdefault(p[0], []).append({'name': os.path.basename(f)[:-4] + ' · ' + pl['name'], 'kind': 'floor', 'floors': pl['floors'], 'src': 'pdf', 'scale': scale,
                                             'wall': [], 'hatch': [], 'glaz': [], 'rail': [], 'prop': [], 'flor': [], 'wpoly': pl['wall'], 'bpoly': pl['balc']})
        print(f'PDF {p[0]} 1:{scale} תוכניות {[pl["floors"][0] for pl in plans]}')

    # עיגון: קודם הבניינים עם קווי מגרש. בניינים באותו מגרש (C ו-D) משורטטים באותה מערכת צירים, ולכן מעוגנים יחד.
    fits = {}; ths = []; groups = {}
    for b in sorted(raw):
        if sum(len(r['prop']) for r in raw[b]) >= 3: groups.setdefault(conf.get('lots', {}).get(b, b), []).append(b)
    for key, bs in groups.items():
        props = [l for b in bs for r in raw[b] for l in r['prop']]
        cands = [key] if key in lots else [k for k, v in lots.items() if v.area > 500]
        best = None
        for L in cands:
            x, med, inl = fit_prop(samples(props), lots[L], math.radians(59.3))
            if best is None or med < best[1]: best = (x, med, inl, L)
        for b in bs: fits[b] = {'x': best[0], 'method': 'קווי המגרש מול התב"ע', 'lot': best[3], 'median': round(best[1], 2), 'inliers': round(best[2], 2)}
        ths.append(best[0][0]); print(f'עיגון {"+".join(bs)}: מגרש {best[3]}, סיבוב {math.degrees(best[0][0]):.2f}°, סטייה חציונית {best[1]:.2f} מ\'')

    plans = {}; buildings = []
    for b in sorted(raw):
        recs = raw[b]; geo = {}
        for r in recs:
            g = plan_geom(r['wall'], r['hatch'], r['glaz'], r['rail'], r.get('wpoly'), r.get('bpoly'), close=1.2 if r['src'] == 'pdf' else 0.9)
            if g: geo[r['name']] = (r, g)
        if b not in fits:
            low = min((v for v in geo.values() if v[0]['kind'] == 'floor'), key=lambda v: v[0]['floors'][0])
            lot = conf.get('lots', {}).get(b); tgt = envs.get(lot) or lots.get(lot)
            th0 = float(np.mean(ths)) if ths else 0.0
            x, iou = fit_shape(low[1]['env'], tgt, th0)
            fits[b] = {'x': x, 'method': 'המתאר מול מעטפת הבניין בתב"ע (הערכה)', 'lot': lot, 'iou': round(iou, 2)}
            print(f'עיגון {b}: לפי מעטפת התב"ע, חפיפה {iou:.2f}, סיבוב {math.degrees(x[0]):.2f}°')
        x = fits[b]['x']
        levels = {}; roof = mech = None
        for name, (r, g) in geo.items():
            pid = f'{b}{len(plans)}'
            G = {k: [tf_geom(p, x) for p in g[k]] for k in ('balc', 'walls')}
            env = tf_geom(g['env'], x)
            op = [tuple(tf_pts(np.array([[o[0], o[1]], [o[2], o[3]]]), x).ravel()) for o in g['open']]
            rl = [tuple(tf_pts(np.array([[o[0], o[1]], [o[2], o[3]]]), x).ravel()) for o in g['rail']]
            plans[pid] = {'name': name, 'src': r['src'], 'area': round(env.area), 'env': ring_dm(env),
                          'open': [[dm(v) for v in o] for o in op], 'rail': [[dm(v) for v in o] for o in rl],
                          'balc': [ring_dm(p) for p in G['balc']], 'walls': [ring_dm(q) for p in G['walls'] for q in no_holes(p)]}
            if r['kind'] in ('roof', 'mech'):          # על הגג: החדרים הסגורים (יציאה, מעליות, חדרים טכניים) והתאים הסולאריים, מהשרטוט
                W = unary_union(g['walls']) if g['walls'] else Polygon()
                rooms = [Polygon(h) for q in getattr(W, 'geoms', [W]) if isinstance(q, Polygon) for h in q.interiors]
                rooms = [q for q in rooms if 2 < q.area < 150]
                if r['kind'] == 'mech': rooms.append(g['env'])
                core = unary_union([q.buffer(0.25, join_style=2) for q in rooms]) if rooms else Polygon()
                plans[pid]['core'] = [ring_dm(tf_geom(c, x)) for c0 in getattr(core, 'geoms', [core]) if isinstance(c0, Polygon) and c0.area > 3 for c in no_holes(c0.simplify(0.05))]
                pv = [p0 for p0 in polygonize(unary_union(r['flor'])) if 0.4 < p0.area < 20 and p0.minimum_rotated_rectangle.area < p0.area*1.15] if r['flor'] and r['kind'] == 'roof' else []
                pv = [p0 for p0 in pv if max(p0.bounds[2]-p0.bounds[0], p0.bounds[3]-p0.bounds[1]) > 2.2*min(p0.bounds[2]-p0.bounds[0], p0.bounds[3]-p0.bounds[1]) and g['env'].buffer(8).contains(p0)]
                plans[pid]['pv'] = [ring_dm(tf_geom(p0, x)) for p0 in pv]
                print(f'  גג {b} {r["kind"]}: חדרים {len(plans[pid]["core"])}, תאים סולאריים {len(pv)}')
            if r['kind'] == 'roof': roof = pid
            elif r['kind'] == 'mech': mech = pid
            else:
                for f in r['floors']: levels[f] = pid
        if not levels: continue
        top = max(levels); use = conf.get('use', {}).get(b, {}); floors = []; y = H['ground']
        for n in range(1, top+1):
            pid = levels.get(n); filled = pid is None
            below = filled and not any(k < n for k in levels)                   # מתחת לתוכנית הנמוכה: אותו מתאר, בלי מרפסות
            if filled: pid = levels[max(k for k in levels if k < n)] if not below else levels[min(levels)]
            u = use.get(n, 'res'); h = H[u]
            floors.append({'n': n, 'plan': pid, 'use': u, 'y': round(y, 2), 'h': h, **({'filled': True} if filled else {}), **({'bare': True} if below else {})}); y += h
        bl = {'id': b, 'fit': {k: v for k, v in fits[b].items() if k != 'x'}, 'rot': round(math.degrees(x[0]), 3), 'floors': floors, 'top': round(y, 2)}
        if roof: bl['roof'] = {'plan': roof, 'y': round(y, 2), 'h': H['roof']}
        if mech: bl['mech'] = {'plan': mech, 'y': round(y + (H['roof'] if roof else 0), 2), 'h': H['mech']}
        if conf.get('base', {}).get(b) is not None: bl['base'] = conf['base'][b]
        if conf.get('total', {}).get(b): bl['total'] = conf['total'][b]
        buildings.append(bl)
        print(f'בניין {b}: {len(floors)} קומות, גובה {y:.1f} מ\', קומות בלי תוכנית: {[f["n"] for f in floors if f.get("filled")]}')

    # גג המסד (החזית החמישית של קומת הקרקע): קומת הקרקע מתוכנית הפיתוח, פחות המגדלים שעולים ממנה.
    # הגג מכסה גם את הקולונדה, כי העמודים בתוך המתאר. הגינון על הגג: רצועה פנימית, להמחשה (במצגת: "גג דיירים משותף").
    towers = unary_union([Polygon([(e[i]/10, e[i+1]/10) for i in range(0, len(e), 2)]).buffer(0) for b in buildings for e in [plans[b['floors'][0]['plan']]['env']]])
    podium = []
    for f in foot:
        roof = f.difference(towers.buffer(0.02)).buffer(-0.01).buffer(0.01)
        under = f.intersects(towers)
        for q in getattr(roof, 'geoms', [roof]):
            if not isinstance(q, Polygon) or q.area < 6: continue
            green = q.buffer(-2.2, join_style=2).buffer(0.6, join_style=1).intersection(q.buffer(-1.6)) if under else Polygon()
            podium.append({'kind': 'garden' if under else 'roof', 'area': round(q.area),
                           'roof': [ring_dm(r) for r in no_holes(q.simplify(0.05))],
                           'green': [ring_dm(r) for g in getattr(green, 'geoms', [green]) if isinstance(g, Polygon) and g.area > 6 for r in no_holes(g.simplify(0.1))],
                           'edge': ring_dm(Polygon(q.exterior).simplify(0.05))})
    print('גג המסד:', [(x['kind'], x['area']) for x in podium])

    res = {'tik': a.tik, 'source': conf.get('src', ''), 'made': __import__('datetime').date.today().isoformat(),
           'assume': {'heights': H, 'window': 'גובה החלונות: מ-0.9 מ\' (ויטרינה ויציאה למרפסת: מ-0.1 מ\') עד 0.35 מ\' מתחת לתקרה',
                      'filled': 'קומה בלי תוכנית: התוכנית של הקומה שמתחתיה',
                      'podium': 'גג המסד: קומת הקרקע מתוכנית הפיתוח פחות המגדלים. הגינון והריצוף על הגג להמחשה',
                      'roof': 'על גגות המגדלים: מבני היציאה מתוכנית הגג. מערכות, קולטים ותאים סולאריים להמחשה',
                      'work': 'קומות תעסוקה וציבור בלי תוכנית: המתאר הטיפוסי עם קיר מסך, להמחשה'},
           'buildings': buildings, 'plans': plans, 'podium': podium}
    json.dump(res, open(os.path.join(out, 'floors.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('נכתב', os.path.join(out, 'floors.json'), round(os.path.getsize(os.path.join(out, 'floors.json'))/1024), 'KB')
    if a.png: preview(res, lots, foot, envs, a.png)

def preview(res, lots, foot, envs, png):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig = plt.figure(figsize=(11, 13)); ax = fig.gca(); ax.set_aspect('equal')
    for p in lots.values(): ax.plot(*p.exterior.xy, color='#c9b458', lw=.6)
    for p in foot: ax.plot(*p.exterior.xy, color='#1f5fd6', lw=1.4)
    for p in envs.values(): ax.plot(*p.exterior.xy, color='#888', lw=.8, ls='--')
    R = lambda f: (f[0::2] + [f[0]], f[1::2] + [f[1]])
    for b in res['buildings']:
        pl = res['plans'][b['floors'][-1]['plan']]; lo = res['plans'][b['floors'][0]['plan']]
        for pp, col in ((lo, '#d64545'), (pl, '#222')):
            xs, ys = R(pp['env']); ax.plot([v/10 for v in xs], [v/10 for v in ys], color=col, lw=1)
            for bb in pp['balc']: xs, ys = R(bb); ax.fill([v/10 for v in xs], [v/10 for v in ys], color='#9b7bd6', alpha=.5)
            for o in pp['open']: ax.plot([o[0]/10, o[2]/10], [o[1]/10, o[3]/10], color='#16a3c9', lw=2.2)
        e = res['plans'][b['floors'][0]['plan']]['env']; ax.text(sum(e[0::2])/len(e)*2/10, sum(e[1::2])/len(e)*2/10, b['id'], fontsize=16)
    fig.savefig(png, dpi=80, bbox_inches='tight')

if __name__ == '__main__': main()
