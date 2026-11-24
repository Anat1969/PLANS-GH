#!/usr/bin/env python3
"""מודל מתוכנית העמדה שהיא תמונה (ענת, 24.11.2026: נאות ספיר, תיק 1887).

הבעיה: לרוב התוכניות אין תוכנית פיתוח וקטורית עם שכבות. יש מצגת אדריכלות, ובה תוכנית העמדה כתמונה צבעונית.
הכלי הזה הופך את התמונה למודל באותו פורמט של extract-model.py, כדי שכל המסכים (שלושת המצבים, התחומים, הניתוח) יעבדו בלי שינוי.

שימוש:
  python3 tools/siteplan-model.py --tik 1887 --img siteplan.jpg --plan-models tmal2024.json --gcp "1:2025,285 2:1118,285 ..."
  --plan-models: שורת plan_models של התב"ע (ASHDODMAP, קריאה בלבד), כ-JSON עם lots ו-geo.
  --gcp: מגרש:x,y בפיקסלים של התמונה, למרכז המגרש בערך. רק לעיגון ראשוני; הכיול עצמו אוטומטי.

הזרימה:
 1. renewal.json מהתב"ע (אותו מבנה של auto-model.py).
 2. עיגון: דמיון (הזזה, סיבוב, קנה מידה) מנקודות המגרשים, ואז כיול לפי הקווים הכחולים של התמונה מול צלעות מגרשי התב"ע
    (מרחק לקו הכחול הקרוב, ממוצע קטום עד 3 מ'). המדד: הסטייה החציונית של צלעות המגרשים, במטרים.
 3. סיווג לפי צבע: מבנים (מסחר, לובי, ציבור, חדרי שירות), חצרות גן ומעון, חיפוי צמרות, וגזעי עצים.
 4. כבישים מהתב"ע (מגרשי הדרך), ריצוף: שאר תחום התוכנית. קווי מגרש ומעטפות מהתב"ע.
 5. model.json, manifest.json ושכבות שרטוט (webp) בצפון למעלה, ו-source.json עם המקור, הכיול וההנחות.
מה שנגזר מצבע הוא הערכה. גובה הבניינים: מהתב"ע (הנחה), עד שיגיעו חזיתות וחתכים.
"""
import sys, os, json, math, argparse, datetime, importlib.util
import numpy as np, cv2
from scipy.optimize import minimize

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_s = importlib.util.spec_from_file_location('am', os.path.join(ROOT, 'tools/auto-model.py')); AM = importlib.util.module_from_spec(_s); _s.loader.exec_module(AM)
wgs2itm = AM.wgs2itm
RES = 0.1                      # מ' לפיקסל בשכבות השרטוט (צפון למעלה)

# ── 1. התב"ע: אותו מבנה של taba() ב-auto-model.py ──
def renewal_from(pm, title):
    geo = pm['geo']; meta = pm['meta']
    ring = lambda g: (g['coordinates'][0] if g['type'] == 'Polygon' else max(g['coordinates'], key=lambda P: len(P[0]))[0])[:-1]
    G = [dict(k=r['k'], pr=r['pr'], g=json.loads(r['g']) if isinstance(r['g'], str) else r['g']) for r in geo]
    parcels = [dict(lot=r['pr'].get('lot'), cat=r['pr'].get('cat', 'open'), c=ring(r['g'])) for r in G if r['k'] == 'parcels']
    cat = {p['lot']: p['cat'] for p in parcels}
    lots = []
    for L in meta.get('lots') or []:
        g = lambda *ks: next((L[k] for k in ks if L.get(k) not in (None, '')), None)
        lots.append({k: v for k, v in dict(lot=L.get('lot'), below=g('floors_below'), title=g('title'), cat=cat.get(L.get('lot'), 'mixed'), units=g('units'),
            floors=g('floors_above'), height=g('height_m') or None, lotSize=g('lot_size'), main=g('main_above'), coverage=g('coverage_pct'),
            plate=g('floor_plate_m2'), commerce=g('commercial_main')).items() if v is not None})
    massing = [dict(**{k: r['pr'][k] for k in ('lot', 'kind', 'cat', 'base', 'top') if k in r['pr']}, c=ring(r['g'])) for r in G if r['k'] == 'massing']
    demolish = [dict(h=r['pr'].get('h', 10), c=ring(r['g'])) for r in G if r['k'] == 'demolish']
    hs = [l['height'] for l in lots if l.get('height')]; fl = [l['floors'] for l in lots if l.get('floors')]
    src = meta.get('sources') or {}
    return dict(plan=pm.get('plan', ''), title=title, source=f'עותק מ"מה נבנה סביבי" (plan_models), עדכון {pm.get("updated", "")}. נלקח {datetime.date.today():%d.%m.%Y}',
        sources=dict(lots=src.get('lots', ''), rights=src.get('rights', ''), context=src.get('context', '')),
        note='הנפח הוא הערכה: שטח הקומה הוא השטח מעל הקרקע בטבלה 5 חלקי מספר הקומות, בתוך קווי הבניין. לא תכנון הבינוי.',
        summary=dict(units=sum(l.get('units') or 0 for l in lots), floorsMax=max(fl) if fl else None, heightMax=max(hs) if hs else None),
        lots=lots, parcels=parcels, massing=massing, demolish=demolish)

# ── 2. עיגון ──
def sim(p):                    # תמונה (x ימינה, y למטה) → ITM: [E,N] = t + s*R(θ)*[x,-y]
    tx, ty, th, ls = p; s = math.exp(ls); c, si = math.cos(th), math.sin(th)
    return np.array([[s*c, s*si, tx], [s*si, -s*c, ty]])
def inv(A):
    M = np.vstack([A, [0, 0, 1]]); return np.linalg.inv(M)[:2]
def app(A, P): P = np.asarray(P, float); return P @ A[:, :2].T + A[:, 2]

def fit_sim(src, dst):         # Umeyama, עם השתקפות של ציר y
    src = np.asarray(src, float) * [1, -1]; dst = np.asarray(dst, float)
    ms, md = src.mean(0), dst.mean(0); a, b = src-ms, dst-md
    U, S, Vt = np.linalg.svd(b.T @ a / len(src)); R = U @ Vt
    if np.linalg.det(R) < 0: R = U @ np.diag([1, -1]) @ Vt
    s = S.sum() / (a**2).sum() * len(src); th = math.atan2(R[1, 0], R[0, 0])
    t = md - s * R @ ms
    return [t[0], t[1], th, math.log(s)]

def edges(parcels, step=0.5):
    out = []
    for p in parcels:
        R = [wgs2itm(c[1], c[0]) for c in p['c']]
        for i in range(len(R)):
            a, b = np.array(R[i]), np.array(R[(i+1) % len(R)]); n = max(1, int(np.linalg.norm(b-a)/step))
            out += [a + (b-a)*k/n for k in range(n)]
    return np.array(out)

def blue_mask(im):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    return cv2.inRange(hsv, (100, 90, 90), (130, 255, 255))

# ── 3. סיווג ──
def classes(im):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); H, S, V = [hsv[..., i].astype(int) for i in range(3)]
    salmon = ((H <= 10) | (H >= 170)) & (S > 70) & (V > 170)                 # מסחר
    cream = (H >= 15) & (H <= 35) & (S >= 18) & (S <= 75) & (V > 225)       # לובי ומועדון
    brown = (H >= 8) & (H <= 22) & (S >= 70) & (S <= 170) & (V >= 140) & (V <= 235)  # ציבור: גנים, מעון, בית כנסת
    lilac = (H >= 120) & (H <= 165) & (S >= 12) & (S <= 60) & (V > 205)      # חדרי אופניים ועגלות
    teal = (H >= 75) & (H <= 100) & (S >= 15) & (S <= 60) & (V > 200)        # מרפאה, אוורור
    yard = (H >= 50) & (H <= 70) & (S >= 60) & (V > 190)                     # חצרות גן ומעון
    canopy = (H >= 35) & (H <= 85) & (S >= 35) & (V >= 60) & (V <= 175)      # צמרות
    trunk = (H >= 0) & (H <= 20) & (S >= 90) & (V >= 50) & (V <= 150)        # גזע: נקודה חומה כהה במרכז הצמרת
    m = lambda a: (a.astype(np.uint8) * 255)
    return dict(salmon=m(salmon), cream=m(cream), brown=m(brown), lilac=m(lilac), teal=m(teal), yard=m(yard), canopy=m(canopy), trunk=m(trunk))

def polys(mask, min_m2, eps_m, res=RES):
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); out = []
    for c in cs:
        if cv2.contourArea(c) * res * res < min_m2: continue
        c = cv2.approxPolyDP(c, eps_m/res, True).reshape(-1, 2)
        if len(c) >= 3: out.append(c.astype(float))
    return out

def area(P): P = np.asarray(P); return 0.5*abs(np.dot(P[:, 0], np.roll(P[:, 1], 1)) - np.dot(P[:, 1], np.roll(P[:, 0], 1)))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tik', required=True); ap.add_argument('--img', required=True); ap.add_argument('--plan-models', required=True)
    ap.add_argument('--gcp', required=True); ap.add_argument('--title', default=''); ap.add_argument('--src-name', default='')
    ap.add_argument('--out'); ap.add_argument('--debug'); ap.add_argument('--typical'); ap.add_argument('--spec')
    a = ap.parse_args(); out = a.out or os.path.join(ROOT, 'layers', a.tik); os.makedirs(out, exist_ok=True)
    pm = json.load(open(a.plan_models, encoding='utf8'))
    rn = renewal_from(pm, a.title or pm.get('plan', ''))
    im = cv2.imread(a.img); h, w = im.shape[:2]

    # עיגון ראשוני מנקודות המגרשים (מרכז המסה של כל מגרש בתב"ע)
    cen = {}
    for p in rn['parcels']:
        R = np.array([wgs2itm(c[1], c[0]) for c in p['c']]); cen.setdefault(p['lot'], []).append((R.mean(0), area(R)))
    cen = {k: max(v, key=lambda x: x[1])[0] for k, v in cen.items()}
    G = [g.split(':') for g in a.gcp.split()]; G = [(int(l), tuple(map(float, xy.split(',')))) for l, xy in G]
    p0 = fit_sim([xy for _, xy in G], [cen[l] for l, _ in G])
    r0 = [np.linalg.norm(app(sim(p0), [xy])[0] - cen[l]) for l, xy in G]
    print(f'עיגון ראשוני: {len(G)} מגרשים, קנה מידה {1/math.exp(p0[3]):.2f} פיקסלים למטר, סטייה ממוצעת {np.mean(r0):.1f} מ\'')

    # כיול: צלעות המגרשים מול הקווים הכחולים בתמונה. רק צלעות בתוך התמונה נספרות
    blue = blue_mask(im); dt = cv2.distanceTransform(255 - blue, cv2.DIST_L2, 5)
    E = edges([p for p in rn['parcels']])
    def cost(p, trim=3.0):
        A = inv(sim(p)); P = app(A, E); ok = (P[:, 0] >= 2) & (P[:, 1] >= 2) & (P[:, 0] < w-2) & (P[:, 1] < h-2)
        if ok.sum() < 0.3*len(E): return 1e3
        d = dt[P[ok, 1].astype(int), P[ok, 0].astype(int)] * math.exp(p[3])   # במטרים
        return np.minimum(d, trim).mean() + 0.5*(1 - ok.mean())
    best = p0
    for trim in (6.0, 3.0, 1.5):
        r = minimize(lambda p: cost(p, trim), best, method='Nelder-Mead', options=dict(xatol=1e-3, fatol=1e-4, maxiter=4000,
                     initial_simplex=[best] + [list(np.array(best) + d) for d in np.diag([2.0, 2.0, 0.02, 0.02])]))
        best = list(r.x)
    A = sim(best); Ai = inv(A); P = app(Ai, E); ok = (P[:, 0] >= 2) & (P[:, 1] >= 2) & (P[:, 0] < w-2) & (P[:, 1] < h-2)
    d = dt[P[ok, 1].astype(int), P[ok, 0].astype(int)] * math.exp(best[3])
    cal = dict(median=round(float(np.median(d)), 2), within05=round(float((d < 0.5).mean()), 2), within1=round(float((d < 1).mean()), 2),
               inside=round(float(ok.mean()), 2), pxPerM=round(1/math.exp(best[3]), 3), rotDeg=round(math.degrees(best[2]), 2), gcpMean=round(float(np.mean(r0)), 1))
    print('כיול:', cal)

    # רשת צפון למעלה: תחום תוכנית העמדה + 10 מ'
    C = app(A, [[0, 0], [w, 0], [w, h], [0, h]]); E0, N0 = C.min(0) - 10; E1, N1 = C.max(0) + 10
    W, Hh = int((E1-E0)/RES), int((N1-N0)/RES)
    # מפיקסל ברשת (u,v) ל-ITM: E = E0 + u*RES, N = N1 - v*RES; ומשם לתמונה
    G2I = np.vstack([Ai, [0, 0, 1]]) @ np.array([[RES, 0, E0], [0, -RES, N1], [0, 0, 1]])
    warp = lambda img, interp=cv2.INTER_LINEAR, bv=0: cv2.warpAffine(img, G2I[:2], (W, Hh), flags=interp | cv2.WARP_INVERSE_MAP, borderValue=bv)
    imN = warp(im, bv=(255, 255, 255)); valid = warp(np.full((h, w), 255, np.uint8), cv2.INTER_NEAREST)
    K = {k: warp(v, cv2.INTER_NEAREST) for k, v in classes(im).items()}
    if a.debug: cv2.imwrite(a.debug, imN)
    e0, n0 = round((E0+E1)/2, 2), round((N0+N1)/2, 2)
    toM = lambda P: [(E0 + x*RES - e0, (N1 - y*RES) - n0) for x, y in P]          # פיקסל ברשת → מטרים יחסית למרכז
    flat = lambda P: [int(round(v*10)) for q in P for v in q]
    itmpx = lambda R: np.array([((e-E0)/RES, (N1-n)/RES) for e, n in R])           # ITM → פיקסל ברשת

    # תחום התוכנית: איחוד המגרשים שהתמונה מכסה (חוץ ממגרש בלי כיסוי, כמו מגרש 8)
    lotmask = {}
    for p in rn['parcels']:
        R = [wgs2itm(c[1], c[0]) for c in p['c']]; m = np.zeros((Hh, W), np.uint8); cv2.fillPoly(m, [itmpx(R).astype(np.int32)], 255)
        cov = (valid[m > 0] > 0).mean() if (m > 0).any() else 0
        if cov > 0.85: lotmask[p['lot']] = cv2.bitwise_or(lotmask.get(p['lot'], m*0), m)
    site = np.zeros((Hh, W), np.uint8)
    for m in lotmask.values(): site |= m
    cats = {p['lot']: p['cat'] for p in rn['parcels']}

    # מבנים: איחוד צבעי הבינוי, סגירה של 1.5 מ' ומילוי חורים (גרעין, מדרגות וטקסט בתוך הבניין)
    bld = K['salmon'] | K['cream'] | K['brown'] | K['lilac'] | K['teal']
    bld = cv2.morphologyEx(bld, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    bld = cv2.morphologyEx(bld, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    bldF = np.zeros_like(bld); cs, _ = cv2.findContours(bld, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); cv2.drawContours(bldF, cs, -1, 255, -1)
    bldF &= site
    yard = cv2.morphologyEx(K['yard'] & site & ~bldF, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    foot = [P for P in polys(bldF, 60, 0.4)]
    # כל מבנה שייך למגרש שבו רוב שטחו
    def lot_of(P):
        m = np.zeros((Hh, W), np.uint8); cv2.fillPoly(m, [P.astype(np.int32)], 255); best_l, best_a = None, 0
        for l, lm in lotmask.items():
            a_ = int(((m > 0) & (lm > 0)).sum())
            if a_ > best_a: best_l, best_a = l, a_
        return best_l
    footLots = [lot_of(P) for P in foot]

    # עצים, בתמונה המקורית: נקודה שחורה קטנה (מרכז העץ) בתוך עיגול צמרת ירוק או אפור.
    # רדיוס: עיגול Hough שמרכזו עד 4 פיקסלים מהנקודה, אחרת 2.5 מ' (הנחה). עץ בתוך מבנה נפסל.
    pxm = 1/math.exp(best[3]); gI = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY); hsvI = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    n, lab, st, cc = cv2.connectedComponentsWithStats(((gI < 70)*255).astype(np.uint8))
    dots = np.array([cc[i] for i in range(1, n) if 4 <= st[i, 4] <= 40 and st[i, 2] <= 8 and st[i, 3] <= 8 and abs(st[i, 2]-st[i, 3]) <= 3 and st[i, 4] >= 0.45*st[i, 2]*st[i, 3]])
    circ = cv2.HoughCircles(cv2.medianBlur(gI, 3), cv2.HOUGH_GRADIENT, dp=1, minDist=12, param1=120, param2=22, minRadius=int(1.2*pxm), maxRadius=int(6*pxm))
    circ = circ[0] if circ is not None else np.zeros((0, 3))
    bldI = cv2.dilate(cv2.warpAffine(bldF, G2I[:2], (w, h), flags=cv2.INTER_NEAREST), np.ones((5, 5), np.uint8))   # מהרשת לתמונה
    H_, S_, V_ = [hsvI[..., i].astype(int) for i in range(3)]
    canI = ((H_ >= 35) & (H_ <= 85) & (S_ >= 30) & (V_ >= 60) & (V_ <= 200)) | ((S_ < 30) & (V_ >= 85) & (V_ <= 175))
    trees, src_r = [], 0
    for x, y in dots:
        xi, yi = int(round(x)), int(round(y))
        if bldI[yi, xi]: continue
        ang = np.linspace(0, 2*np.pi, 16, endpoint=False); rr = 0.6*pxm
        ring = [canI[int(yi + rr*math.sin(t)), int(xi + rr*math.cos(t))] for t in ang if 0 <= yi + rr*math.sin(t) < h and 0 <= xi + rr*math.cos(t) < w]
        if len(ring) < 12 or np.mean(ring) < 0.6: continue
        d = np.hypot(circ[:, 0]-x, circ[:, 1]-y) if len(circ) else np.array([99])
        r = float(circ[d.argmin(), 2])/pxm if d.min() <= 4 else 2.5; src_r += d.min() <= 4
        gx, gy = app(inv(G2I[:2]), [[x, y]])[0]
        if any(math.hypot(gx-t[0], gy-t[1])*RES < 1.5 for t in trees): continue
        trees.append((gx, gy, round(min(5.0, max(1.2, r)), 2)))
    can = cv2.morphologyEx(K['canopy'], cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))

    # חלקי בניין (מגדל ואגף) מתוכנית הקומה הטיפוסית, באותה מסגרת של תוכנית ההעמדה (אותו מיקום בשקף).
    # מגדל: המעטפת הקמורה של צבעי הדירות בתוך המבנה. אגף: שאר המבנה. הגבהים מקובץ העובדות (data/siteplan/<תיק>.json).
    parts, spacing = [], []
    if a.typical and a.spec:
        spec = json.load(open(a.spec, encoding='utf8')); fh = spec.get('floorHeights', {}); g0 = fh.get('ground', 4.5)
        ti = cv2.resize(cv2.imread(a.typical), (w, h), interpolation=cv2.INTER_LINEAR); tN = warp(ti, bv=(255, 255, 255))
        hs = cv2.cvtColor(tN, cv2.COLOR_BGR2HSV); H_, S_, V_ = [hs[..., i].astype(int) for i in range(3)]
        apt = ((H_ >= 35) & (H_ <= 70) & (S_ >= 70) & (V_ >= 200)) | ((H_ >= 15) & (H_ <= 32) & (S_ >= 90) & (V_ >= 200)) | \
              ((H_ >= 15) & (H_ <= 35) & (S_ >= 25) & (V_ >= 225)) | ((H_ >= 8) & (H_ <= 20) & (S_ >= 60) & (V_ >= 170))
        apt = cv2.morphologyEx((apt*255).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        for b in spec['buildings']:
            idx = [i for i, l in enumerate(footLots) if l == b['lot']]
            if not idx: print('  אין מבנה במגרש', b['lot']); continue
            fm = np.zeros((Hh, W), np.uint8)
            for i in idx: cv2.fillPoly(fm, [foot[i].astype(np.int32)], 255)
            res_h = fh.get('public' if b.get('public') else 'res', 3.15)
            if b['floors'] > 12:                                     # מגדל ואולי אגף
                pts = cv2.findNonZero(apt & cv2.dilate(fm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))))
                if pts is None: print('  לא נמצא מגדל במגרש', b['lot']); continue
                hull = cv2.convexHull(pts).reshape(-1, 2).astype(float)
                if b.get('wingRoof'):                                # יש אגף: המגדל הוא מה שבמבנה ואינו גג לבן בשקף 9
                    wr = cv2.morphologyEx(((S_ < 14) & (V_ >= 238)).astype(np.uint8)*255, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
                    tw = cv2.morphologyEx(fm & ~wr, cv2.MORPH_OPEN, np.ones((41, 41), np.uint8))
                    n_, lb, st_, _ = cv2.connectedComponentsWithStats(tw)
                    if n_ > 1:
                        k_ = 1 + int(np.argmax(st_[1:, 4])); cs_, _ = cv2.findContours(((lb == k_)*255).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                        hull = cv2.convexHull(cs_[0]).reshape(-1, 2).astype(float)
                tm = np.zeros_like(fm); cv2.fillPoly(tm, [hull.astype(np.int32)], 255)
                top = g0 + (b['floors']-1)*res_h
                parts.append(dict(lot=b['lot'], id=b['id'], kind='tower', floors=b['floors'], top=round(top, 2), c=flat(toM(cv2.approxPolyDP(hull.astype(np.float32), 4, True).reshape(-1, 2))),
                                  src=b['src'] + '. מתאר המגדל משקף 9 (הערכה). גובה הקומות: הנחה'))
                if b.get('wingRoof'):
                    wing = cv2.morphologyEx(fm & ~cv2.dilate(tm, np.ones((11, 11), np.uint8)), cv2.MORPH_OPEN, np.ones((31, 31), np.uint8))
                    for P in polys(wing, 80, 0.4):
                        top = round(b['wingRoof'] - b['ground'], 2)
                        parts.append(dict(lot=b['lot'], id=b['id'], kind='wing', floors=max(1, round((top - g0)/res_h) + 1), top=top, c=flat(toM(P)), src=b['src']))
            else:
                top = round(b['roof'] - b['ground'], 2) if b.get('roof') else round(g0 + (b['floors']-1)*res_h, 2)
                for i in idx:
                    parts.append(dict(lot=b['lot'], id=b['id'], kind='public' if b.get('public') else 'mid', floors=b['floors'], top=top, c=flat(toM(foot[i])),
                                      src=b['src'] + ('' if b.get('roof') else '. גובה הקומות: הנחה')))
        print('חלקי בניין:', [(p['id'], p['kind'], p['floors'], p['top'], int(area(np.array(p['c']).reshape(-1, 2)/10))) for p in parts])

    # מרחקים בין מבנים מהמודל, מול הוראות התב"ע (בתמל/2024, 6.1.1: מגדל-מגדל 18 מ', מגורים-מגורים 10 מ'). הערכה מהתמונה
    def dpoly(A, B):
        ds = lambda p, a_, b_: np.linalg.norm(p - a_ - np.clip(((p-a_) @ (b_-a_)) / max((b_-a_) @ (b_-a_), 1e-9), 0, 1) * (b_-a_))
        f = lambda X, Y: min(ds(q, Y[i], Y[(i+1) % len(Y)]) for q in X for i in range(len(Y)))
        return min(f(A, B), f(B, A))
    spacing = []
    PP = [(p, np.array(p['c']).reshape(-1, 2)/10) for p in parts]
    for i in range(len(PP)):
        for j in range(i+1, len(PP)):
            (p, A_), (q, B_) = PP[i], PP[j]
            if p['id'] == q['id']: continue
            d = round(float(dpoly(A_, B_)), 1); both_t = p['kind'] == q['kind'] == 'tower'; res = p['kind'] != 'public' and q['kind'] != 'public'
            need = 18 if both_t else 10 if res else None
            if d < 45: spacing.append(dict(a=p['id'], b=q['id'], d=d, need=need, ok=None if need is None else d >= need))
    best_pair = {}
    for x in spacing:
        k = tuple(sorted((x['a'], x['b'])))
        if k not in best_pair or x['d'] < best_pair[k]['d']: best_pair[k] = x
    spacing = sorted(best_pair.values(), key=lambda x: x['d'])
    if spacing: print('מרחקים:', [(x['a'], x['b'], x['d'], x['need']) for x in spacing])

    # משטחים
    surf = {}
    road = [p for p in rn['parcels'] if p['cat'] == 'road']
    surf['asphalt'] = [['#9a9a96', flat(toM(itmpx([wgs2itm(c[1], c[0]) for c in p['c']])))] for p in road]
    pav = site & ~bldF
    for p in road:
        m = np.zeros((Hh, W), np.uint8); cv2.fillPoly(m, [itmpx([wgs2itm(c[1], c[0]) for c in p['c']]).astype(np.int32)], 255); pav &= ~m
    surf['paving'] = [['#e6dfcc', flat(toM(P))] for P in polys(pav, 20, 0.5)]
    surf['green'] = [['#8add6e', flat(toM(P))] for P in polys(yard, 15, 0.4)]
    surf['wall'] = [['#e8e4da', flat(toM(P))] for P in foot]
    # קווים מהתב"ע: גבולות מגרשים וקווי בניין (מעטפות)
    ring_m = lambda C: [(e - e0, n - n0) for e, n in (wgs2itm(c[1], c[0]) for c in C)]
    closed = lambda R: flat(R + R[:1])
    lines = dict(plot=[closed(ring_m(p['c'])) for p in rn['parcels'] if p['lot'] in lotmask],
                 bline=[closed(ring_m(m['c'])) for m in rn['massing'] if m['kind'] == 'envelope' and m['lot'] in lotmask])
    obj = dict(treeNew=[[round(E0 + x*RES - e0, 2), round(N1 - y*RES - n0, 2), round(r, 2)] for x, y, r in trees])
    topic = dict(asphalt='road', paving='walk', green='green', wall='build', plot='site', bline='site')
    allp = np.array([v for L in surf.values() for _, f in L for v in f]).reshape(-1, 2) / 10
    model = dict(e0=e0, n0=n0, scale=None, surf=surf, lines=lines, obj=obj, topic=topic,
                 foot=[flat(toM(P)) for P in foot], footLot=footLots, parts=parts, spacing=spacing if parts else [], bbox=[round(float(v), 1) for v in (*allp.min(0), *allp.max(0))])
    json.dump(model, open(os.path.join(out, 'model.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(rn, open(os.path.join(out, 'renewal.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))

    # שכבות שרטוט: התמונה המעוגנת, מפוצלת לפי הסיווג (רקע שקוף)
    crop = lambda m: m
    def layer(name, mask):
        rgba = cv2.cvtColor(imN, cv2.COLOR_BGR2BGRA); rgba[..., 3] = np.where(mask > 0, 255, 0).astype(np.uint8)
        small = cv2.resize(rgba, (W//2, Hh//2), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(out, name + '.webp'), small, [cv2.IMWRITE_WEBP_QUALITY, 82]); return round(float((mask > 0).mean()*100), 2)
    near = lambda m, k: cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    blueN = warp(blue, cv2.INTER_NEAREST); siteD = near(site, 41)
    L = [('site', 'גבולות מגרש וקווי בניין', near(blueN, 3) & siteD),
         ('build', 'מבנים', near(bldF, 5)),
         ('green', 'חצרות וגינון', near(yard, 5)),
         ('trees', 'עצים', near(can, 3) & ~bldF & valid & siteD),
         ('walk', 'ריצוף והולכי רגל', pav & ~near(can, 3) & ~yard),
         ('road', 'כבישים', siteD & valid & ~site)]
    layers = [dict(id=i, name=nm, file=i + '.webp', ink=layer(i, m), cad=[]) for i, nm, m in L]
    man = dict(tik=a.tik, title=a.title, source=a.src_name or os.path.basename(a.img), scale=None, w=W//2, h=Hh//2, mPerPx=RES*2,
               cadTotal=len(layers), unassigned=[], siteArea=int((site > 0).sum()*RES*RES), layers=layers, raster=True, cal=cal,
               missing=['park', 'bike', 'level', 'shade', 'water', 'power', 'waste', 'fire'])  # אין בתוכנית העמדה צבעונית: נאמר במסך ונדרש מהאדריכל
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    src = dict(tik=a.tik, made=datetime.date.today().isoformat(), image=a.src_name or os.path.basename(a.img), method='siteplan-model.py: תמונה מעוגנת לתב"ע',
               calibration=cal, status='calibrated' if cal['median'] < 0.5 and cal['within1'] >= 0.8 else 'approx',
               counts=dict(buildings=len(foot), buildingArea=int(sum(area(P) for P in foot)*RES*RES), yards=len(surf['green']), trees=len(trees),
                           lotsCovered=sorted(lotmask)),
               assume=dict(buildings='מתאר המבנים: מהצבע בתוכנית ההעמדה, הערכה. סגירה של 1.5 מ\' ומילוי חורים.',
                           trees=f'עצים: נקודת מרכז בתוך עיגול צמרת. הקוטר מעיגול הצמרת ({src_r} עצים), ובשאר 5 מ\' (הנחה). עד 10 מ\'. עץ ירוק ועץ אפור לא מובחנים. הערכה.',
                           paving='ריצוף: כל תחום המגרשים שאינו מבנה, חצר או דרך. הערכה.',
                           heights='גובה המבנים מעל קומת הקרקע: מהתב"ע (קומות וגובה מרבי), הנחה עד שיגיעו חזיתות וחתכים.'))
    json.dump(src, open(os.path.join(out, 'source.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(f'מבנים {len(foot)} ({src["counts"]["buildingArea"]} מ"ר), חצרות {len(surf["green"])}, עצים {len(trees)}, מגרשים {sorted(lotmask)}')
    print('מבנה לפי מגרש:', [(l, int(area(P)*RES*RES)) for l, P in zip(footLots, foot)])

if __name__ == '__main__': main()
