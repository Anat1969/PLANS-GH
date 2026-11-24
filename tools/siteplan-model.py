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
def pal_mask(hsv, ranges):
    """מקרא צבעים מקובץ העובדות: רשימת טווחים [h0,s0,v0,h1,s1,v1], באיחוד. רשימה ריקה: אין צבע כזה בתמונה"""
    m = np.zeros(hsv.shape[:2], bool)
    for r in ranges: m |= cv2.inRange(hsv, tuple(r[:3]), tuple(r[3:])) > 0
    return m

def classes(im, pal=None):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); H, S, V = [hsv[..., i].astype(int) for i in range(3)]
    if pal:                                                                   # מקרא של המצגת הזו (spec.palette), במקום ברירת המחדל של 1887
        keys = ('salmon', 'cream', 'brown', 'lilac', 'teal', 'yard', 'canopy', 'trunk')
        return {k: (pal_mask(hsv, pal.get(k, [])).astype(np.uint8) * 255) for k in keys}
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

def ring_trees(im, pxm, smin=90, ringMin=0.6, inMax=0.75, outMax=0.45, rmin=1.3, rmax=4.5):
    """עצים כעיגולי צמרת ירוקים (1911: עיגול בקו ירוק, לפעמים עם לב אדום במרכז). Hough על המסכה הירוקה.
    נפסל: עיגול שהקו שלו לא ירוק ברובו, שהפנים שלו ירוק לגמרי (משוכה), או שהסביבה שלו ירוקה (דשא מקווקו). הערכה"""
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); H, S, V = [hsv[..., i].astype(int) for i in range(3)]
    green = (H >= 35) & (H <= 80) & (S >= smin) & (V >= 50) & (V <= 225); h, w = green.shape
    c = cv2.HoughCircles(cv2.GaussianBlur(green.astype(np.uint8)*255, (5, 5), 1.2), cv2.HOUGH_GRADIENT, dp=1, minDist=int(1.4*pxm), param1=100, param2=12,
                         minRadius=int(rmin*pxm), maxRadius=int(rmax*pxm))
    c = c[0] if c is not None else np.zeros((0, 3)); t = np.linspace(0, 2*np.pi, 48, endpoint=False); yy, xx = np.mgrid[-30:31, -30:31]; out = []
    def ring(x, y, rr):
        xs = (x + rr*np.cos(t)).astype(int); ys = (y + rr*np.sin(t)).astype(int); ok = (xs >= 0) & (ys >= 0) & (xs < w) & (ys < h)
        return green[ys[ok], xs[ok]].mean() if ok.sum() >= 40 else 0
    for x, y, r in c:
        best = max(ring(x, y, r + d) for d in (-1.5, -0.5, 0.5, 1.5))
        if best < ringMin: continue
        dd = (xx**2 + yy**2) <= (0.55*r)**2; X = xx[dd] + int(x); Y = yy[dd] + int(y); ok = (X >= 0) & (Y >= 0) & (X < w) & (Y < h)
        if green[Y[ok], X[ok]].mean() > inMax or np.mean([ring(x, y, f*r) for f in (1.45, 1.7)]) > outMax: continue
        out.append((float(x), float(y), float(r), best))
    out.sort(key=lambda q: -q[3]); keep = []
    for q in out:
        if all(math.hypot(q[0]-k[0], q[1]-k[1]) > max(q[2], k[2])*0.9 for k in keep): keep.append(q)
    return keep

def polys(mask, min_m2, eps_m, res=RES):
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); out = []
    for c in cs:
        if cv2.contourArea(c) * res * res < min_m2: continue
        c = cv2.approxPolyDP(c, eps_m/res, True).reshape(-1, 2)
        if len(c) >= 3: out.append(c.astype(float))
    return out

def area(P): P = np.asarray(P); return 0.5*abs(np.dot(P[:, 0], np.roll(P[:, 1], 1)) - np.dot(P[:, 1], np.roll(P[:, 0], 1)))

def georef(im, rn, cen, gcp, label='', blue_lo=(100, 90, 90)):
    """עיגון תמונה למגרשי התב"ע: דמיון מנקודות המגרשים, ואז כיול לפי הקווים הכחולים. מחזיר (A: תמונה→ITM, cal)"""
    h, w = im.shape[:2]
    G = [g.split(':') for g in gcp.split()]; G = [(int(l), tuple(map(float, xy.split(',')))) for l, xy in G]
    p0 = fit_sim([xy for _, xy in G], [cen[l] for l, _ in G]); r0 = [np.linalg.norm(app(sim(p0), [xy])[0] - cen[l]) for l, xy in G]
    blue = cv2.inRange(cv2.cvtColor(im, cv2.COLOR_BGR2HSV), blue_lo, (135, 255, 255)); dt = cv2.distanceTransform(255 - blue, cv2.DIST_L2, 5); E = edges(rn['parcels'])
    def inside(P): return (P[:, 0] >= 2) & (P[:, 1] >= 2) & (P[:, 0] < w-2) & (P[:, 1] < h-2)
    def cost(p, trim):
        P = app(inv(sim(p)), E); ok = inside(P)
        if ok.sum() < 0.3*len(E): return 1e3
        return np.minimum(dt[P[ok, 1].astype(int), P[ok, 0].astype(int)] * math.exp(p[3]), trim).mean() + 0.5*(1 - ok.mean())
    best = p0
    for trim in (6.0, 3.0, 1.5):
        best = list(minimize(lambda p: cost(p, trim), best, method='Nelder-Mead', options=dict(xatol=1e-3, fatol=1e-4, maxiter=4000,
                     initial_simplex=[best] + [list(np.array(best) + d) for d in np.diag([2.0, 2.0, 0.02, 0.02])])).x)
    P = app(inv(sim(best)), E); ok = inside(P); d = dt[P[ok, 1].astype(int), P[ok, 0].astype(int)] * math.exp(best[3])
    cal = dict(median=round(float(np.median(d)), 2), within05=round(float((d < 0.5).mean()), 2), within1=round(float((d < 1).mean()), 2),
               inside=round(float(ok.mean()), 2), pxPerM=round(1/math.exp(best[3]), 3), rotDeg=round(math.degrees(best[2]), 2), gcpMean=round(float(np.mean(r0)), 1))
    print(f'כיול {label}:', cal)
    return sim(best), cal

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tik', required=True); ap.add_argument('--img', required=True); ap.add_argument('--plan-models', required=True)
    ap.add_argument('--gcp', required=True); ap.add_argument('--title', default=''); ap.add_argument('--src-name', default='')
    ap.add_argument('--out'); ap.add_argument('--debug'); ap.add_argument('--typical'); ap.add_argument('--spec'); ap.add_argument('--basement')
    a = ap.parse_args(); out = a.out or os.path.join(ROOT, 'layers', a.tik); os.makedirs(out, exist_ok=True)
    SPEC = json.load(open(a.spec, encoding='utf8')) if a.spec else {}; PAL = SPEC.get('palette')
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
    blue = pal_mask(cv2.cvtColor(im, cv2.COLOR_BGR2HSV), PAL['blue']).astype(np.uint8)*255 if PAL and PAL.get('blue') else blue_mask(im); dt = cv2.distanceTransform(255 - blue, cv2.DIST_L2, 5)
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
    dd = d[d < 3]                                                              # הצלעות המצוירות: יש קו בתמונה עד 3 מ'. גבול מגרש שלא צויר בשקף לא נמדד
    cal['drawn'] = dict(share=round(float((d < 3).mean()), 2), within05=round(float((dd < 0.5).mean()), 2), within1=round(float((dd < 1).mean()), 2))
    print('כיול:', cal)

    # רשת צפון למעלה: תחום תוכנית העמדה + 10 מ'
    C = app(A, [[0, 0], [w, 0], [w, h], [0, h]]); E0, N0 = C.min(0) - 10; E1, N1 = C.max(0) + 10
    W, Hh = int((E1-E0)/RES), int((N1-N0)/RES)
    # מפיקסל ברשת (u,v) ל-ITM: E = E0 + u*RES, N = N1 - v*RES; ומשם לתמונה
    G2I = np.vstack([Ai, [0, 0, 1]]) @ np.array([[RES, 0, E0], [0, -RES, N1], [0, 0, 1]])
    warp = lambda img, interp=cv2.INTER_LINEAR, bv=0: cv2.warpAffine(img, G2I[:2], (W, Hh), flags=interp | cv2.WARP_INVERSE_MAP, borderValue=bv)
    imN = warp(im, bv=(255, 255, 255)); valid = warp(np.full((h, w), 255, np.uint8), cv2.INTER_NEAREST)
    K = {k: warp(v, cv2.INTER_NEAREST) for k, v in classes(im, PAL).items()}
    near0 = lambda m, k: cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
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
    TM = SPEC.get('trees') or {}
    if TM.get('dot'):                                                         # מרכז העץ הוא סימן צבעוני (למשל לב אדום בתוך עיגול הצמרת)
        n, lab, st, cc = cv2.connectedComponentsWithStats(pal_mask(hsvI, TM['dot']).astype(np.uint8)*255)
        a0, a1 = TM.get('dotPx', [4, 60])
        dots = np.array([cc[i] for i in range(1, n) if a0 <= st[i, 4] <= a1 and max(st[i, 2], st[i, 3]) <= 12] or np.zeros((0, 2)))
    else:
        n, lab, st, cc = cv2.connectedComponentsWithStats(((gI < 70)*255).astype(np.uint8))
        dots = np.array([cc[i] for i in range(1, n) if 4 <= st[i, 4] <= 40 and st[i, 2] <= 8 and st[i, 3] <= 8 and abs(st[i, 2]-st[i, 3]) <= 3 and st[i, 4] >= 0.45*st[i, 2]*st[i, 3]])
    circ = cv2.HoughCircles(cv2.medianBlur(gI, 3), cv2.HOUGH_GRADIENT, dp=1, minDist=12, param1=120, param2=22, minRadius=int(1.2*pxm), maxRadius=int(6*pxm))
    circ = circ[0] if circ is not None else np.zeros((0, 3))
    bldI = cv2.dilate(cv2.warpAffine(bldF, G2I[:2], (w, h), flags=cv2.INTER_NEAREST), np.ones((5, 5), np.uint8))   # מהרשת לתמונה
    H_, S_, V_ = [hsvI[..., i].astype(int) for i in range(3)]
    canI = ((H_ >= 35) & (H_ <= 85) & (S_ >= 30) & (V_ >= 60) & (V_ <= 200)) | ((S_ < 30) & (V_ >= 85) & (V_ <= 175))
    trees, src_r, treeDots = [], 0, []
    if TM.get('mode') == 'ring':
        for x, y, r, _ in ring_trees(im, pxm):
            if bldI[int(y), int(x)]: continue
            treeDots.append((x, y)); src_r += 1; gx, gy = app(inv(G2I[:2]), [[x, y]])[0]
            trees.append((gx, gy, round(min(5.0, max(1.2, r/pxm)), 2)))
        dots = []
        if TM.get('heart'):                                                   # לב אדום בתוך עיגול ירוק בהיר: גם עץ (עיגול שה-Hough החמיץ)
            gr = (H_ >= 35) & (H_ <= 80) & (S_ >= 60) & (V_ >= 50) & (V_ <= 235); tt = np.linspace(0, 2*np.pi, 40, endpoint=False)
            n_, lb_, st_, cc_ = cv2.connectedComponentsWithStats(pal_mask(hsvI, TM['heart']).astype(np.uint8)*255)
            for i in range(1, n_):
                if not (3 <= st_[i, 4] <= 60 and max(st_[i, 2], st_[i, 3]) <= 14): continue
                x, y = cc_[i]
                if bldI[int(y), int(x)] or any(math.hypot(x-q[0], y-q[1]) < 1.5*pxm for q in treeDots): continue
                bst = (0, 0)
                for rr in np.arange(1.2, 4.2, 0.25)*pxm:
                    xs = (x + rr*np.cos(tt)).astype(int); ys = (y + rr*np.sin(tt)).astype(int); ok = (xs >= 0) & (ys >= 0) & (xs < w) & (ys < h)
                    f = gr[ys[ok], xs[ok]].mean() if ok.sum() > 20 else 0
                    if f > bst[0]: bst = (f, rr)
                if bst[0] < 0.5: continue
                treeDots.append((x, y)); gx, gy = app(inv(G2I[:2]), [[x, y]])[0]; trees.append((gx, gy, round(min(5.0, max(1.2, bst[1]/pxm)), 2)))
    for x, y in dots:
        xi, yi = int(round(x)), int(round(y))
        if bldI[yi, xi]: continue
        if TM.get('dot'):                                                     # בלי עיגול צמרת סביב הסימן: זה לא עץ (כניסה, למשל)
            d = np.hypot(circ[:, 0]-x, circ[:, 1]-y) if len(circ) else np.array([99])
            if d.min() > TM.get('circTol', 5): continue
            treeDots.append((x, y)); r = float(circ[d.argmin(), 2])/pxm; src_r += 1
            gx, gy = app(inv(G2I[:2]), [[x, y]])[0]
            if any(math.hypot(gx-t[0], gy-t[1])*RES < 1.5 for t in trees): continue
            trees.append((gx, gy, round(min(5.0, max(1.2, r)), 2))); continue
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
        apt = pal_mask(hs, PAL['apt']) if PAL and PAL.get('apt') else ((H_ >= 35) & (H_ <= 70) & (S_ >= 70) & (V_ >= 200)) | ((H_ >= 15) & (H_ <= 32) & (S_ >= 90) & (V_ >= 200)) | \
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
                others = []
                if b.get('split'):                                           # במגרש גם בניין מרקמי: המגדל הוא רכיב הדירות הגדול, והשאר בניינים נפרדים
                    am = cv2.morphologyEx(apt & cv2.dilate(fm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
                    am = cv2.morphologyEx(am, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
                    if b.get('clip'):                                         # מגדל שנוגע בבניין שכן בקומה הטיפוסית: חיתוך לפי תחום שסומן בשקף (פיקסלים בתמונה)
                        cm = np.zeros_like(am); cv2.fillPoly(cm, [app(inv(G2I[:2]), np.array(b['clip'], float)).astype(np.int32)], 255)
                        am = cv2.morphologyEx(am & cm, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)) | cv2.morphologyEx(am & ~cv2.dilate(cm, np.ones((15, 15), np.uint8)), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
                    n_, lb_, st_, cc_ = cv2.connectedComponentsWithStats(am); order = sorted(range(1, n_), key=lambda i: -st_[i, 4])
                    if b.get('at'):                                           # המגדל: הרכיב שבו הגרעין שסומן בשקף (b.at, פיקסלים בתמונה)
                        gx_, gy_ = app(inv(G2I[:2]), [b['at']])[0]; k0 = lb_[int(gy_), int(gx_)] if 0 <= int(gy_) < Hh and 0 <= int(gx_) < W else 0
                        big = [i for i in order if st_[i, 4]*RES*RES >= 150] or order
                        if not k0 or st_[k0, 4]*RES*RES < 150: k0 = min(big, key=lambda i: math.hypot(cc_[i][0]-gx_, cc_[i][1]-gy_))
                        order = [k0] + [i for i in order if i != k0]
                    def comp(i):                                             # מתאר הדירות עצמו (לא המעטפת הקמורה): מגדל בצורת ר' או צלב
                        cs_, _ = cv2.findContours(((lb_ == i)*255).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                        return max(cs_, key=cv2.contourArea).reshape(-1, 2).astype(float)
                    hull = comp(order[0]); others = [comp(i) for i in order[1:] if st_[i, 4]*RES*RES >= 120]
                if b.get('wingRoof'):                                # יש אגף: המגדל הוא מה שבמבנה ואינו גג לבן בשקף 9
                    wr = cv2.morphologyEx(((S_ < 14) & (V_ >= 238)).astype(np.uint8)*255, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
                    tw = cv2.morphologyEx(fm & ~wr, cv2.MORPH_OPEN, np.ones((41, 41), np.uint8))
                    n_, lb, st_, _ = cv2.connectedComponentsWithStats(tw)
                    if n_ > 1:
                        k_ = 1 + int(np.argmax(st_[1:, 4])); cs_, _ = cv2.findContours(((lb == k_)*255).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                        hull = cv2.convexHull(cs_[0]).reshape(-1, 2).astype(float)
                tm = np.zeros_like(fm); cv2.fillPoly(tm, [hull.astype(np.int32)], 255)
                for k_, oh in enumerate(others):
                    cv2.fillPoly(tm, [oh.astype(np.int32)], 255); of = b.get('otherFloors', 10)
                    parts.append(dict(lot=b['lot'], id=f"{b['id']}{'אבגדהו'[k_]}", kind='mid', floors=of, top=round(g0 + (of-1)*res_h, 2),
                                      c=flat(toM(cv2.approxPolyDP(oh.astype(np.float32), 4, True).reshape(-1, 2))), src=b.get('otherSrc', b['src']) + '. מתאר מהקומה הטיפוסית (הערכה). גובה הקומות: הנחה'))
                top = round(b['roof'] - b['ground'], 2) if b.get('roof') else g0 + (b['floors']-1)*res_h   # גג מהחתכים, כשיש
                parts.append(dict(lot=b['lot'], id=b['id'], kind='tower', floors=b['floors'], top=round(top, 2), c=flat(toM(cv2.approxPolyDP(hull.astype(np.float32), 4, True).reshape(-1, 2))),
                                  src=b['src'] + '. מתאר המגדל משקף 9 (הערכה). גובה הקומות: הנחה'))
                if b.get('wingRoof') or b.get('wing'):
                    wing = cv2.morphologyEx(fm & ~cv2.dilate(tm, np.ones((11, 11), np.uint8)), cv2.MORPH_OPEN, np.ones((31, 31), np.uint8))
                    for P in polys(wing, 80, 0.4):
                        top = round(b['wingRoof'] - b['ground'], 2) if b.get('wingRoof') else round(b.get('wingTop', g0), 2)
                        parts.append(dict(lot=b['lot'], id=b['id'], kind='wing', floors=max(1, round((top - g0)/res_h) + 1), top=top, c=flat(toM(P)), src=b['src']))
            else:
                top = round(b['roof'] - b['ground'], 2) if b.get('roof') else round(g0 + (b['floors']-1)*res_h, 2)
                for j, i in enumerate(idx):
                    if area(foot[i])*RES*RES < b.get('minArea', 0): continue
                    parts.append(dict(lot=b['lot'], id=b['id'] + (b.get('suffix', 'אבגדהו')[j] if len(idx) > 1 else ''), kind='public' if b.get('public') else 'mid', floors=b['floors'], top=top, c=flat(toM(foot[i])),
                                      src=b['src'] + ('' if b.get('roof') else '. גובה הקומות: הנחה')))
        for pp in parts:                                                      # תיקון לחלק בניין אחד מקובץ העובדות (למשל גני ילדים בבניין נפרד)
            o = (spec.get('partOverride') or {}).get(pp['id'])
            if o: pp.update(floors=o['floors'], kind=o.get('kind', pp['kind']), top=round(g0 + (o['floors']-1)*fh.get('public' if o.get('kind') == 'public' else 'res', 3.15), 2), src=o['src'])
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
            if p['id'] == q['id'] or (p['kind'] in ('wing',) and q['lot'] == p['lot']) or (q['kind'] in ('wing',) and q['lot'] == p['lot']): continue
            d = round(float(dpoly(A_, B_)), 1); both_t = p['kind'] == q['kind'] == 'tower'; res = p['kind'] != 'public' and q['kind'] != 'public'
            SR = SPEC.get('spacingRules') or dict(tower=18, mixed=10, res=10)
            one_t = (p['kind'] == 'tower') != (q['kind'] == 'tower')
            need = SR['tower'] if both_t else (SR['mixed'] if one_t else SR['res']) if res else None
            if res and SR.get('lots') and p['lot'] == q['lot'] and str(p['lot']) in SR['lots']: need = SR['lots'][str(p['lot'])]
            if d < 45: spacing.append(dict(a=p['id'], b=q['id'], d=d, need=need, ok=None if need is None else d >= need))
    best_pair = {}
    for x in spacing:
        k = tuple(sorted((x['a'], x['b'])))
        if k not in best_pair or x['d'] < best_pair[k]['d']: best_pair[k] = x
    spacing = sorted(best_pair.values(), key=lambda x: x['d'])
    if spacing: print('מרחקים:', [(x['a'], x['b'], x['d'], x['need']) for x in spacing])

    # ── אלמנטים של הפיתוח (ענת, 24.11.2026: "כל האלמנטים, מופרדים לשכבות, ושלא חסר כלום") ──
    # מה שמזוהה לפי צבע מחולץ כאן. מה שמסומן בקווים דקים (רחבות כיבוי, רמפות, מעליות אשפה, רומים, קו השלבים) סומן בעין בקובץ העובדות.
    EL = (json.load(open(a.spec, encoding='utf8')) if a.spec else {}).get('elements', {})
    I2G = lambda P: app(inv(G2I[:2]), np.asarray(P, float))                     # פיקסל בתמונה → פיקסל ברשת
    mI = lambda P: toM(I2G(P))                                                  # פיקסל בתמונה → מטרים
    pxm = 1/math.exp(best[3]); hI = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); Hc, Sc, Vc = [hI[..., i].astype(int) for i in range(3)]
    bldI = cv2.warpAffine(bldF, G2I[:2], (w, h), flags=cv2.INTER_NEAREST)
    def blobs(mask, a0, a1):                                                    # מרכזי כתמים בגודל a0..a1 מ"ר, בתמונה
        n_, lb, st_, cc_ = cv2.connectedComponentsWithStats(mask.astype(np.uint8)*255)
        return [cc_[i] for i in range(1, n_) if a0 <= st_[i, 4]/pxm/pxm <= a1]
    ptm = lambda q: [round(float(v), 2) for v in mI([q])[0]]
    el = {}
    # כניסות: משולש אדום רווי
    red = pal_mask(hI, PAL['entry']) if PAL and PAL.get('entry') else (((Hc <= 8) | (Hc >= 172)) & (Sc > 170) & (Vc > 140))
    if treeDots:                                                              # סימני העצים באותו צבע לא נספרים ככניסות
        red = red.astype(np.uint8)
        for x, y in treeDots: cv2.circle(red, (int(x), int(y)), 6, 0, -1)
        red = red > 0
    if SPEC.get('entryCompact'):
        n_, lb_, st_, cc_ = cv2.connectedComponentsWithStats(red.astype(np.uint8)*255); red = np.zeros_like(red)
        for i in range(1, n_):
            if st_[i, 4] >= 0.35*st_[i, 2]*st_[i, 3] and max(st_[i, 2], st_[i, 3]) <= 2.5*pxm: red |= lb_ == i
    el['entry'] = [ptm(c) for c in blobs(red, *(SPEC.get('entryM2') or [0.25, 3.0]))]
    if treeDots:                                                              # סימן אדום במרכז עץ אינו כניסה
        TT = [(E0 + x*RES - e0, N1 - y*RES - n0) for x, y, _ in trees]
        el['entry'] = [q for q in el['entry'] if all(math.hypot(q[0]-t[0], q[1]-t[1]) > 1.6 for t in TT)]
    # עמודי תאורה: הסימן הצהוב מחוץ למבנים (בתוך המבנים הוא לא מזוהה, ונספר בנפרד)
    yel = pal_mask(hI, PAL['lamp']) if PAL and PAL.get('lamp') else (Hc >= 20) & (Hc <= 35) & (Sc > 140) & (Vc > 190)
    if SPEC.get('lampCompact'):                                               # בלי שברי קווים (קווי ההריסה הצהובים): כתם קומפקטי בלבד
        n_, lb_, st_, cc_ = cv2.connectedComponentsWithStats(yel.astype(np.uint8)*255); yel = np.zeros_like(yel)
        for i in range(1, n_):
            if st_[i, 4] >= 0.5*st_[i, 2]*st_[i, 3] and min(st_[i, 2], st_[i, 3]) >= 3 and max(st_[i, 2], st_[i, 3]) <= 2.2*pxm: yel |= lb_ == i
    yb = blobs(yel, 0.15, 3.0); inB = lambda c: bldI[min(h-1, int(c[1])), min(w-1, int(c[0]))] > 0
    el['lamp'] = [ptm(c) + [0] for c in yb if not inB(c)]; yellowInside = sum(1 for c in yb if inB(c))
    # חדרי אופניים ועגלות: הסגול בתוך המבנים
    bikeR = cv2.morphologyEx(K['lilac'] & bldF, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    # חדר טכני ואוורור: רכיב הטורקיז שמכיל את נקודת הזרע (המרפאה נשארת בניין)
    tealN = cv2.morphologyEx(cv2.morphologyEx(K['teal'] & bldF, cv2.MORPH_CLOSE, np.ones((31, 31), np.uint8)), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    techM = np.zeros_like(tealN); n_, lb, _, _ = cv2.connectedComponentsWithStats(tealN)
    for q in (EL.get('techSeeds') or {}).get('pts', []):
        gx, gy = I2G([q])[0].astype(int); win = lb[max(0, gy-10):gy+11, max(0, gx-10):gx+11].ravel(); win = win[win > 0]
        if len(win): techM |= ((lb == np.bincount(win).argmax())*255).astype(np.uint8)
    # רחבות שהייה: הבז' במרחב הפתוח (לא מבנה, לא חצר)
    beige = pal_mask(hI, PAL['plaza']) if PAL and 'plaza' in PAL else (Hc >= 14) & (Hc <= 30) & (Sc >= 20) & (Sc <= 48) & (Vc >= 178) & (Vc <= 218)
    plaza = cv2.morphologyEx(cv2.morphologyEx(warp((beige*255).astype(np.uint8), cv2.INTER_NEAREST), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))),
                             cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))) & site & ~near0(bldF, 11) & ~yard
    for Q in (EL.get('plazas') or {}).get('polys', []):                        # רחבות שהייה שסומנו בעין (ריצוף אפור, בלי צבע משלו)
        pm_ = np.zeros_like(plaza); cv2.fillPoly(pm_, [I2G(Q).astype(np.int32)], 255); plaza |= pm_ & site & ~bldF
    # מהקובץ: רחבות כיבוי, רמפות, מעליות אשפה, רומים, קו השלבים
    def pad(Q):
        Q = np.array(mI(Q)); e1, e2 = Q[1]-Q[0], Q[2]-Q[1]; L1, L2 = np.linalg.norm(e1), np.linalg.norm(e2)
        ax = e1 if L1 >= L2 else e2; c = Q.mean(0)
        return [round(float(c[0]), 2), round(float(c[1]), 2), round(float(max(L1, L2)), 2), round(float(min(L1, L2)), 2), round(math.atan2(ax[1], ax[0]), 3)], Q
    pads = [pad(Q) for Q in (EL.get('fire') or {}).get('pads', [])]
    el['fire'] = [p_[0] for p_ in pads]
    rampP = [np.array(Q, float) for Q in (EL.get('ramps') or {}).get('polys', [])]
    el['wasteLift'] = [ptm(q) for q in (EL.get('wasteLifts') or {}).get('pts', [])]
    el['spot'] = [ptm(q[:2]) + [q[2], q[3]] for q in (EL.get('spots') or {}).get('pts', [])]
    phase = (EL.get('phase') or {}).get('line')
    rampM = np.zeros((Hh, W), np.uint8)
    for Q in rampP: cv2.fillPoly(rampM, [I2G(Q).astype(np.int32)], 255)
    print(f"אלמנטים: כניסות {len(el['entry'])}, עמודי תאורה {len(el['lamp'])} (צהוב בתוך מבנים {yellowInside}), רחבות כיבוי {len(el['fire'])}, "
          f"רמפות {len(rampP)}, מעליות אשפה {len(el['wasteLift'])}, רומים {len(el['spot'])}, חדרי אופניים {int((bikeR>0).sum()*RES*RES)} מ\"ר, "
          f"טכני {int((techM>0).sum()*RES*RES)} מ\"ר, רחבות שהייה {int((plaza>0).sum()*RES*RES)} מ\"ר")

    # מרתף (שקף אחר, עיגון משלו): גבול המרתף ועצי הסקר הקיימים
    under, survey, bcal = [], [], None
    if a.basement:
        bs = json.load(open(a.spec, encoding='utf8'))['basement']; bi = cv2.imread(a.basement); bh, bw = bi.shape[:2]
        Ab, bcal = georef(bi, rn, cen, bs['gcp'], 'מרתף', blue_lo=(95, 40, 80))   # קווי המגרש דקים ודהויים בשקף הזה
        bH = cv2.cvtColor(bi, cv2.COLOR_BGR2HSV); bh_, bs_, bv_ = [bH[..., i].astype(int) for i in range(3)]
        B2G = np.array([[1/RES, 0, -E0/RES], [0, -1/RES, N1/RES]]) @ np.vstack([Ab, [0, 0, 1]])    # תמונת המרתף → רשת
        bwarp = lambda m: cv2.warpAffine(m, B2G, (W, Hh), flags=cv2.INTER_NEAREST)
        # המרתף: האפור של המעברים והחניות, והקווים האדומים של מקומות החניה. סגירה ומילוי
        park = (((bs_ < 30) & (bv_ >= 90) & (bv_ <= 215)) | (((bh_ <= 10) | (bh_ >= 160)) & (bs_ > 100) & (bv_ > 120))).astype(np.uint8)*255
        pm = cv2.morphologyEx(bwarp(park), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
        # השטח המקווקו (בלי מרתף) הוא השצ"פ שאין בו מגרש חניון תלת־ממדי. לפי הערה 3 בטבלה 5: רק בתאים 15, 17, 19, 20, 22, 24 יש מעבר בין מרתפים
        park3d = {l['lot'] for l in rn['lots'] if 'חניון' in str(l.get('title', ''))}; noB = np.zeros((Hh, W), np.uint8)
        for p_ in rn['parcels']:
            if p_['cat'] == 'open' and p_['lot'] not in park3d: cv2.fillPoly(noB, [itmpx([wgs2itm(c[1], c[0]) for c in p_['c']]).astype(np.int32)], 255)
        pm = cv2.morphologyEx(pm & ~noB, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))) & near0(site, 81)
        under = polys(pm, 400, 0.8)
        # עצי הסקר: סמל עץ כתום עם גזע חום כהה, ממוספר. הקוטר לא מסומן: 5 מ' (הנחה).
        # בתוך תחום המרתף הקווים האדומים של החניות דומים לסמל, ולכן עץ בתוך המרתף לא נספר
        stallR = (((bh_ <= 8) | (bh_ >= 160)) & (bs_ > 100) & (bv_ > 130)).astype(np.uint8)
        stallD = cv2.boxFilter(stallR.astype(np.float32), -1, (17, 17), normalize=False)        # כמה פיקסלים אדומים של חניות סביב
        tr = cv2.dilate((((bh_ >= 6) & (bh_ <= 22) & (bs_ > 140) & (bv_ > 50) & (bv_ < 220))*255).astype(np.uint8), np.ones((3, 3), np.uint8))
        brown = (bh_ >= 4) & (bh_ <= 25) & (bs_ > 90) & (bv_ < 105)
        n_, lb, st_, cc_ = cv2.connectedComponentsWithStats(tr)
        for i in range(1, n_):
            x_, y_, w_, h_, a_ = st_[i]
            if not (12 <= a_ <= 140 and w_ <= 14 and h_ <= 14 and max(w_, h_)/max(1, min(w_, h_)) <= 1.8): continue
            if brown[max(0, y_-2):y_+h_+2, max(0, x_-2):x_+w_+2].sum() < 4 or stallD[int(cc_[i][1]), int(cc_[i][0])] > 12: continue
            E_, N_ = app(Ab, [cc_[i]])[0]
            if any(math.hypot(E_-t[0], N_-t[1]) < 1.5 for t in survey): continue
            survey.append((E_, N_))
        print(f'מרתף: {len(under)} תחומים, {int(sum(area(P) for P in under)*RES*RES)} מ"ר; עצי סקר {len(survey)}')

    # משטחים
    surf = {}
    road = [p for p in rn['parcels'] if p['cat'] == 'road']
    surf['asphalt'] = [['#9a9a96', flat(toM(itmpx([wgs2itm(c[1], c[0]) for c in p['c']])))] for p in road]
    pav = site & ~bldF & ~rampM & ~plaza
    for p in road:
        m = np.zeros((Hh, W), np.uint8); cv2.fillPoly(m, [itmpx([wgs2itm(c[1], c[0]) for c in p['c']]).astype(np.int32)], 255); pav &= ~m
    surf['paving'] = [['#e6dfcc', flat(toM(P))] for P in polys(pav, 20, 0.5)]
    surf['green'] = [['#8add6e', flat(toM(P))] for P in polys(yard, 15, 0.4)]
    wallM = bldF & ~rampM
    surf['wall'] = [['#e8e4da', flat(toM(P))] for P in polys(wallM, 20, 0.4)]
    surf['ramp'] = [['#77777c', flat(toM(I2G(Q)))] for Q in rampP]
    surf['plaza'] = [['#d9cdb0', flat(toM(P))] for P in polys(plaza, 6, 0.4)]
    surf['bikeRoom'] = [['#cdb8e6', flat(toM(P))] for P in polys(bikeR, 6, 0.3)]
    surf['tech'] = [['#9fd9cf', flat(toM(P))] for P in polys(techM, 6, 0.3)]
    if SPEC.get('uses'):   # שימושי קומת הקרקע לפי הצבע בתוכנית ההעמדה: מסחר, לובי ומועדון, ציבור. הערכה
        for kind, key, col in (('useShop', 'salmon', '#f2b8a8'), ('useLobby', 'cream', '#f6e7b8'), ('usePublic', 'brown', '#d9a57a')):
            um = cv2.morphologyEx(K[key] & bldF, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
            P_ = polys(um, 8, .3)
            if P_: surf[kind] = [[col, flat(toM(P))] for P in P_]
    surf['firemark'] = [['#e23b3b', flat(Q.tolist())] for _, Q in pads]
    # קווים מהתב"ע: גבולות מגרשים וקווי בניין (מעטפות)
    ring_m = lambda C: [(e - e0, n - n0) for e, n in (wgs2itm(c[1], c[0]) for c in C)]
    closed = lambda R: flat(R + R[:1])
    lines = dict(plot=[closed(ring_m(p['c'])) for p in rn['parcels'] if p['lot'] in lotmask],
                 bldline=[closed(ring_m(m['c'])) for m in rn['massing'] if m['kind'] == 'envelope' and m['lot'] in lotmask])   # קווי הבניין של התב"ע
    if under: lines['bline'] = [closed(toM(P)) for P in under]                                                       # קו המרתף, משקף המרתף
    if phase: lines['phase'] = [flat(mI(phase))]
    if (EL.get('cross') or {}).get('segs'): lines['cross'] = [flat(mI(q)) for q in EL['cross']['segs']]          # מעברי חצייה, סימון בעין
    obj = dict(treeNew=[[round(E0 + x*RES - e0, 2), round(N1 - y*RES - n0, 2), round(r, 2)] for x, y, r in trees], **{k: v for k, v in el.items() if v})
    if survey: obj['treeOld'] = [[round(E_-e0, 2), round(N_-n0, 2), 2.5] for E_, N_ in survey]
    topic = dict(asphalt='road', paving='walk', green='green', wall='build', plot='site', bldline='site', bline='site', phase='site', ramp='park', plaza='shade',
                 bikeRoom='bike', tech='power', firemark='fire', entry='build', lamp='power', fire='fire', wasteLift='waste', spot='level', treeOld='trees', cross='walk', useShop='build', useLobby='build', usePublic='build')
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
    def dots(pts_img, r_m):
        m = np.zeros((Hh, W), np.uint8)
        for q in pts_img: g = I2G([q])[0]; cv2.circle(m, (int(g[0]), int(g[1])), int(r_m/RES), 255, -1)
        return m
    toImg = lambda P_m: [((x + e0 - E0)/RES, (N1 - (y + n0))/RES) for x, y in P_m]          # מטרים → רשת
    padM = np.zeros((Hh, W), np.uint8)
    for _, Q in pads: cv2.fillPoly(padM, [np.array(toImg(Q.tolist())).astype(np.int32)], 255)
    gridDots = lambda pts_m, r_m: (lambda m: ([cv2.circle(m, tuple(int(v) for v in toImg([q[:2]])[0]), int(r_m/RES), 255, -1) for q in pts_m], m)[1])(np.zeros((Hh, W), np.uint8))
    L += [('fire', 'רחבות כיבוי', near(padM, 9)),
          ('park', 'רמפות לחניון', near(rampM, 9)),
          ('bike', 'חדרי אופניים ועגלות', near(bikeR, 5)),
          ('power', 'תאורה וחדר טכני', near(techM, 5) | gridDots(el['lamp'], 1.2)),
          ('waste', 'מעליות אשפה', gridDots(el['wasteLift'], 2.5)),
          ('level', 'רומים', gridDots(el['spot'], 3.0)),
          ('shade', 'רחבות שהייה', near(plaza, 5))]
    layers = [dict(id=i, name=nm, file=i + '.webp', ink=layer(i, m), cad=[]) for i, nm, m in L]
    man = dict(tik=a.tik, title=a.title, source=a.src_name or os.path.basename(a.img), scale=None, w=W//2, h=Hh//2, mPerPx=RES*2,
               cadTotal=len(layers), unassigned=[], siteArea=int((site > 0).sum()*RES*RES), layers=layers, raster=True, cal=cal,
               findings=SPEC.get('findings', []), missingWhy=SPEC.get('missingWhy', {}), parking=SPEC.get('parking'), runoff=SPEC.get('runoff'),
               missing=SPEC.get('missing', ['water']),   # מה שאין בשקפים: נאמר במסך ונדרש מהאדריכל
               elements=dict(entries=len(el['entry']), lamps=len(el['lamp']), yellowInside=yellowInside, fire=len(el['fire']), firePartial=(EL.get('fire') or {}).get('partial', ''),
                             ramps=len(rampP), wasteLifts=len(el['wasteLift']), spots=len(el['spot']), bikeRoom=int((bikeR > 0).sum()*RES*RES), tech=int((techM > 0).sum()*RES*RES),
                             plaza=int((plaza > 0).sum()*RES*RES), under=int(sum(area(P) for P in under)*RES*RES), survey=len(survey), basementCal=bcal,
                             src={k: (EL.get(k) or {}).get('src', '') for k in ('fire', 'ramps', 'wasteLifts', 'techSeeds', 'phase', 'spots')}))
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
