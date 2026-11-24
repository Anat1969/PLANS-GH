#!/usr/bin/env python3
"""מודל מתוכנית פיתוח וקטורית (PDF עם שכבות) שהשכבות שלה בשמות אחרים, ושהגיליון שלה מסובב (ענת, 24.11.2026: נאות ספיר, 4215-J-1).

extract-model.py בנוי לשמות השכבות של אחד העם ולגיליון שמיושר לצפון. כאן כל ההבדלים בפרופיל (data/vector/<תיק>.json):
מסגרת השרטוט, קנה המידה, ולכל סוג אלמנט ביטוי על שם השכבה המלא. כך תוכנית חדשה צריכה פרופיל, לא קוד.

שימוש:  python3 tools/vector-model.py data/vector/1887.json <J-1.pdf> [--out layers/1887] [--no-images]

הזרימה:
 1. עיגון: קנה המידה מהשרטוט (1:250). הסיבוב וההזזה: מנקודות פתיחה (מרכזי מגרשים בצילום הגיליון), ואז כיול
    של קווי המגרשים שבשרטוט מול צלעות מגרשי התב"ע (מרחק לצלע, ממוצע קטום). בדיקה בלתי תלויה: הסיבוב מול רשת הצלבים של הגיליון.
 2. משטחים (מילוי), קווים ואובייקטים לפי הפרופיל, במטרים יחסית למרכז של המודל הקיים (e0, n0), כדי שחלקי הבניין
    והגבהים מהמצגת (siteplan-model.py) יישארו במקומם.
 3. מיזוג: מה שהשרטוט נותן מחליף את מה שחולץ מהתמונה. מה שאין בשרטוט נשאר מהתמונה (keepFromRaster).
 4. שכבות השרטוט כתמונות שקופות, לפי נושא, להשוואה מול המקור. שכבה בלי נושא נכנסת ל"שכבות נוספות", בשמה.
"""
import sys, os, re, json, math, argparse, collections, importlib.util, datetime
import numpy as np, cv2
import pymupdf as fitz
from scipy.optimize import minimize
from scipy.spatial import cKDTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_s = importlib.util.spec_from_file_location('sp', os.path.join(ROOT, 'tools/siteplan-model.py')); SP = importlib.util.module_from_spec(_s); _s.loader.exec_module(SP)
wgs2itm = SP.wgs2itm

# נושאי השכבות לתצוגת "שרטוט": לפי שם השכבה המלא. סדר = עדיפות
GROUPS = [
 ('fire',  'כיבוי אש ומסלול הכבאית', r'(Firetruck Route|keboy-ash|Simon-Kabaet)$'),
 ('trees', 'עצים: קיימים, לשימור ומוצעים', r'(Trees (planting|color|technical) plan|3D\$Trees|TREE STREET|Existing trees|TREES-SHIMUR|40-trees.*)'),
 ('green', 'גינון', r'(Planting hatch|Planting Line|40-evengan.*|40-tuff.*|Groundcover)'),
 ('shade', 'הצללה, ריהוט, משחק ומים', r'(Site furniture|EPDM|Hardscape General Hatches\$Water|PF_Play|Sports and play|Leisure|40-rihot.*|40-SAFSAL.*|40-elements.*)'),
 ('walk',  'ריצוף והולכי רגל', r'(Hardscape|40-ritsof.*|S-STRS.*)'),
 ('level', 'מפלסים, קווי גובה וקירות', r'(L-CONTOUR|L-SLOPE|Grading|AV-Miflas.*|GOVA|olwall.*|40-maake.*)'),
 ('bike',  'אופניים', r'(ofnayim|ofanaim|Ofnim)'),
 ('road',  'כבישים, סימון ותמרור', r'(tnua-tich|olcurb|OLLINE|Am-Paint|AM-Paint|AM-BRT|tamrur|0-tic)'),
 ('park',  'חניה ורמפות', r'(parking|PARKING|0-RAMP|TIMRUN|Shipua|MAAVARIM|0-TDM-AS)'),
 ('waste', 'אשפה ופינוי', r'(Waste Points|pneomati|bin_harisa)'),
 ('build', 'מבנים: קומת הקרקע', r'^(level karka-TDM\|.*|J-KARKA-H-F\|0-Xref-KARKA|0-Xref-B-.*|amud migdal)'),
 ('site',  'גבולות, מגרשים וזיקות', r'(pgvul1.*|pzikab1|likb|pcell|scellno.*|shlaviut|A-AREA.*)'),
 ('exist', 'מדידה ומבנים קיימים', r'(survey_20|0-XREF-Medida|CONTEXT\$2D\$Buildings)'),
]

def ld(p): return json.load(open(p, encoding='utf8'))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('profile'); ap.add_argument('pdf'); ap.add_argument('--out'); ap.add_argument('--no-images', action='store_true')
    a = ap.parse_args(); PR = ld(a.profile); out = a.out or os.path.join(ROOT, 'layers', PR['tik'])
    base = ld(os.path.join(out, 'model.json')); rn = ld(os.path.join(out, 'renewal.json'))
    doc = fitz.open(a.pdf); page = doc[0]; dr = page.get_drawings()
    FR = fitz.Rect(*PR['frame']); inf = lambda q: FR.x0 <= q.x <= FR.x1 and FR.y0 <= q.y <= FR.y1
    K = PR['scale'] * 0.0254 / 72
    print('ציורים:', len(dr))

    # ── 1. עיגון ──
    G = PR['georef']; z = G['gcpZoom']
    cen = {}
    for pc in rn['parcels']:
        R = np.array([wgs2itm(q[1], q[0]) for q in pc['c']]); cen.setdefault(pc['lot'], []).append((R.mean(0), SP.area(R)))
    cen = {k: max(v, key=lambda x: x[1])[0] for k, v in cen.items()}
    src = np.array([(FR.x0 + x/z, FR.y0 + y/z) for _, x, y in G['gcp']]) * [K, -K]; dst = np.array([cen[l] for l, _, _ in G['gcp']])
    ma, md = src.mean(0), dst.mean(0); U, Sg, Vt = np.linalg.svd((dst-md).T @ (src-ma)); Rm = U @ Vt
    if np.linalg.det(Rm) < 0: Rm = U @ np.diag([1, -1]) @ Vt
    par = [math.atan2(Rm[1, 0], Rm[0, 0]), *(md - Rm @ ma)]
    sc = Sg.sum()/((src-ma)**2).sum()
    print(f'נקודות פתיחה: סיבוב {math.degrees(par[0]):.2f}°, יחס קנה מידה {sc:.3f} (קרוב ל-1 = קנה המידה נכון)')
    P = []
    for d in dr:
        if not re.search(G['lotLayer'], d.get('layer') or ''): continue
        for it in d['items']:
            if it[0] == 'l' and inf(it[1]) and inf(it[2]):
                p0, p1 = np.array(it[1]), np.array(it[2]); n = max(1, int(np.hypot(*(p1-p0))/3)); P += [p0 + (p1-p0)*k/n for k in range(n+1)]
    P = np.array(P)
    E = SP.edges(rn['parcels'], 0.25); EE0, NN0 = E.min(0) - 80; EE1, NN1 = E.max(0) + 80; RR = 0.1
    Wd, Hd = int((EE1-EE0)/RR), int((NN1-NN0)/RR); im = np.zeros((Hd, Wd), np.uint8)
    for e in E: im[int((NN1-e[1])/RR), int((e[0]-EE0)/RR)] = 255
    dt = cv2.distanceTransform(255-im, cv2.DIST_L2, 5) * RR
    def tr(q, th, tx, ty):
        c, s = math.cos(th), math.sin(th); x, y = q[:, 0]*K, -q[:, 1]*K
        return np.c_[c*x - s*y + tx, s*x + c*y + ty]
    def dist(par):
        Q = tr(P, *par); u = ((Q[:, 0]-EE0)/RR).astype(int); v = ((NN1-Q[:, 1])/RR).astype(int); ok = (u >= 0) & (v >= 0) & (u < Wd) & (v < Hd)
        return dt[v[ok], u[ok]], ok.mean()
    def cost(par, trim):
        d, okm = dist(par); return np.minimum(d, trim).mean() + 3*(1 - okm) if okm > .5 else 99
    for trim in (6, 3, 1.5, .75):
        par = list(minimize(lambda q: cost(q, trim), par, method='Nelder-Mead', options=dict(xatol=1e-4, fatol=1e-5, maxiter=3000,
              initial_simplex=[par, [par[0]+.003, par[1], par[2]], [par[0], par[1]+1, par[2]], [par[0], par[1], par[2]+1]])).x)
    d, _ = dist(par)
    cal = dict(rotDeg=round(math.degrees(par[0]), 3), median=round(float(np.median(d)), 2), within05=round(float((d < .5).mean()), 3), within1=round(float((d < 1).mean()), 3), points=int(len(d)))
    # בדיקה בלתי תלויה: רשת הצלבים של הגיליון. הסיבוב שלה, וההיסט שלה מכפולות של מרווח הרשת
    crs = [d_['rect'] for d_ in dr if (d_.get('layer') or '').endswith('IDAN_CROSS')]
    if crs:
        C = []
        for r in crs:
            c = np.array(((r.x0+r.x1)/2, (r.y0+r.y1)/2))
            if all(np.hypot(*(c-q)) > 3 for q in C): C.append(c)
        C = np.array(C); dd, ii = cKDTree(C).query(C, k=2); v = C[ii[:, 1]] - C
        step = float(np.median(dd[:, 1]))*K; gang = float(np.median(np.degrees(np.arctan2(-v[:, 1], v[:, 0])) % 90))
        rot = (cal['rotDeg']) % 90; cal['gridStep'] = round(step, 2); cal['gridRotDiff'] = round(min(abs(gang - (90 - rot) % 90), abs(gang - rot)), 2)
        Gc = tr(C, *par); off = Gc - np.round(Gc/round(step))*round(step); cal['gridOffset'] = [round(float(np.median(off[:, 0])), 2), round(float(np.median(off[:, 1])), 2)]
    print('כיול:', cal)
    e0, n0 = base['e0'], base['n0']
    th, tx, ty = par; c_, s_ = math.cos(th), math.sin(th)
    T = lambda p: (c_*p.x*K + s_*p.y*K + tx - e0, s_*p.x*K - c_*p.y*K + ty - n0)     # נקודת PDF → מטרים יחסית למרכז המודל

    # ── 2. חילוץ ──
    by = collections.defaultdict(list)
    for d_ in dr: by[d_.get('layer') or ''].append(d_)
    layers = lambda rx: [d_ for n, L in by.items() if re.search(rx, n) for d_ in L]
    def rings(d_):
        out_, cur = [], []
        def add(p):
            if cur and abs(cur[-1].x-p.x) < 1e-3 and abs(cur[-1].y-p.y) < 1e-3: return
            cur.append(p)
        def brk():
            nonlocal cur
            if len(cur) > 1: out_.append(cur)
            cur = []
        for it in d_['items']:
            k = it[0]
            if k == 'l':
                if cur and (abs(cur[-1].x-it[1].x) > .05 or abs(cur[-1].y-it[1].y) > .05): brk()
                add(it[1]); add(it[2])
            elif k == 'c':
                p0, p1, p2, p3 = it[1:5]
                if cur and (abs(cur[-1].x-p0.x) > .05 or abs(cur[-1].y-p0.y) > .05): brk()
                add(p0)
                for t in (.2, .4, .6, .8, 1.):
                    u = 1-t; add(fitz.Point(u**3*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t**3*p3.x, u**3*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t**3*p3.y))
            elif k == 're': brk(); r = it[1]; out_.append([r.tl, r.tr, r.br, r.bl, r.tl])
            elif k == 'qu': brk(); q = it[1]; out_.append([q.ul, q.ur, q.lr, q.ll, q.ul])
        brk(); return out_
    def area(r): return abs(sum(r[i][0]*r[(i+1) % len(r)][1] - r[(i+1) % len(r)][0]*r[i][1] for i in range(len(r))))/2
    def simp(r, tol=.04):
        o = [r[0]]
        for p in r[1:]:
            if abs(p[0]-o[-1][0]) > tol or abs(p[1]-o[-1][1]) > tol: o.append(p)
        return o
    flat = lambda r: [round(v*10) for p in r for v in p]
    hexc = lambda c: '#%02x%02x%02x' % tuple(int(round(v*255)) for v in c[:3])
    surf, lines, obj, topic = {}, {}, {}, {}
    MINA = dict(wall=.02, firepath=.002, pergola=.005, firemark=.01, play=.02)      # שטח מינימלי (מ"ר): קווקוו של מילוי מגיע במשולשים קטנים
    MINL = dict(fence=.1, curb=.3, paint=.3, stairs=.25, glass=.25, door=.25, fireroute=.6)
    for kind, tp, rx in PR['surf']:
        polys = []
        for d_ in layers(rx):
            if not d_.get('fill') or 'f' not in d_['type']: continue
            col = hexc(d_['fill'])
            if col == '#ffffff': continue
            for r in rings(d_):
                if not all(inf(p) for p in r): continue
                m = simp([T(p) for p in r])
                if len(m) > 2 and m[0] == m[-1]: m = m[:-1]
                if len(m) < 3 or area(m) < MINA.get(kind, .1): continue
                polys.append([col, flat(m)])
        if polys: surf[kind] = polys; topic[kind] = tp
    rawFire = None
    # קווקוו של מילוי (משולשים קטנים) → תחומים: רסטר של 10 ס"מ, סגירה במרחק הקווקוו, ופוליגון
    REG = dict(green=.8, paving=.8, firepath=.7, play=.4, firemark=.7, fountain=.3, pergola=.3)
    if surf:
        allv = np.array([v for L in surf.values() for _, f_ in L for v in f_]).reshape(-1, 2)/10; gx0, gy0 = allv.min(0) - 5; gx1, gy1 = allv.max(0) + 5
        GW, GH = int((gx1-gx0)/.1), int((gy1-gy0)/.1)
        toG = lambda f_: np.c_[(np.array(f_).reshape(-1, 2)[:, 0]/10 - gx0)/.1, (gy1 - np.array(f_).reshape(-1, 2)[:, 1]/10)/.1].astype(np.int32)
        for kind, cl in REG.items():
            if kind not in surf: continue
            mk = np.zeros((GH, GW), np.uint8); cols = collections.Counter()
            for c, f_ in surf[kind]: cv2.fillPoly(mk, [toG(f_)], 255); cols[c] += 1
            if kind == 'firepath': rawFire = mk.copy()
            k_ = int(cl/.1) | 1; mk = cv2.morphologyEx(mk, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_, k_)))
            col = cols.most_common(1)[0][0]
            surf[kind] = [[col, flat([(gx0 + x*.1, gy1 - y*.1) for x, y in P_])] for P_ in SP.polys(mk, .3 if kind in ('fountain', 'pergola', 'play') else 1.0, .15, .1)]
            if not surf[kind]: del surf[kind]
    for kind, tp, rx in PR['lines']:
        segs = []
        for d_ in layers(rx):
            if 's' not in d_['type']: continue
            for r in rings(d_):
                if not all(inf(p) for p in r): continue
                m = simp([T(p) for p in r], .08)
                if len(m) < 2: continue
                if sum(math.dist(m[i], m[i+1]) for i in range(len(m)-1)) < MINL.get(kind, .6): continue
                segs.append(flat(m))
        if segs: lines[kind] = segs; topic[kind] = tp
    O = PR['obj']
    def circles(rx, dmin, dmax):
        o = []
        for d_ in layers(rx):
            r = d_['rect']; w, h = r.width*K, r.height*K
            if not (dmin <= max(w, h) <= dmax) or not (.7 < w/max(h, 1e-6) < 1.43): continue
            p = fitz.Point((r.x0+r.x1)/2, (r.y0+r.y1)/2)
            if inf(p): o.append((*T(p), max(w, h)/2))
        return o
    def dedupe(items, link):
        items = sorted(items, key=lambda t: -t[2]); keep = []
        for x, y, r in items:
            if all(math.hypot(x-kx, y-ky) > link for kx, ky, _ in keep): keep.append((x, y, r))
        return keep
    def clusters(rx, link, fills=False):
        ds = []
        for d_ in layers(rx):
            if fills and 'f' not in d_['type']: continue
            Pp = [T(p) for r in rings(d_) for p in r if inf(p)]
            if Pp: ds.append(np.array(Pp))
        if not ds: return []
        cc = np.array([q.mean(0) for q in ds]); par_ = list(range(len(ds)))
        def find(i):
            while par_[i] != i: par_[i] = par_[par_[i]]; i = par_[i]
            return i
        for i, j in cKDTree(cc).query_pairs(link): par_[find(i)] = find(j)
        g = collections.defaultdict(list)
        for i in range(len(ds)): g[find(i)].append(ds[i])
        return [np.vstack(v) for v in g.values()]
    def obox(Pp):
        c = Pp.mean(0); _, _, vt = np.linalg.svd(Pp - c, full_matrices=False); q = (Pp - c) @ vt.T
        ln, wd = np.ptp(q[:, 0]), np.ptp(q[:, 1]); mid = c + vt.T @ np.array([(q[:, 0].max()+q[:, 0].min())/2, (q[:, 1].max()+q[:, 1].min())/2])
        return [round(float(mid[0]), 2), round(float(mid[1]), 2), round(float(ln), 2), round(float(wd), 2), round(math.atan2(vt[0][1], vt[0][0]), 3)]
    r2 = lambda L: [[round(x, 2), round(y, 2), round(r, 2)] for x, y, r in L]
    obj['treeNew'] = r2(dedupe(circles(O['treeNew'][0], O['treeNew'][1], O['treeNew'][2]), 1.2))
    obj['treeOld'] = r2(dedupe(circles(O['treeOld'][0], O['treeOld'][1], O['treeOld'][2]), 1.2))
    sv = collections.defaultdict(list)                      # סקר העצים: הצבע נשמר, המשמעות לפי מקרא הסקר
    for d_ in layers(O['treeSurvey']):
        if d_.get('fill') and 'f' in d_['type']:
            r = d_['rect']; p = fitz.Point((r.x0+r.x1)/2, (r.y0+r.y1)/2)
            if inf(p) and max(r.width, r.height)*K < 6: sv[hexc(d_['fill'])].append((*T(p), max(r.width, r.height)*K/2))
    obj['treeSurvey'] = [[c, r2(dedupe(v, 1.0))] for c, v in sv.items() if len(v) > 3]
    obj['bench'] = [b for b in (obox(Pp) for Pp in clusters(O['bench'][0], O['bench'][1], fills=True) if len(Pp) >= 4) if .8 <= b[2] <= 8 and b[3] <= 3]
    obj['bin'] = [obox(Pp) for Pp in clusters(O['bin'], 1.5) if len(Pp) >= 2]
    obj['wasteInlet'] = [[b[0], b[1]] for b in (obox(Pp) for Pp in clusters(O['wasteInlet'], .6) if len(Pp) >= 3) if b[2] <= 4]
    # רחבות כיבוי: מלבן עם איקס, שני אלכסונים שווים שנחתכים באמצע
    segs = []
    for d_ in layers(O['fire']):
        for it in d_['items']:
            if it[0] == 'l' and inf(it[1]) and inf(it[2]):
                p, q = T(it[1]), T(it[2]); Ln = math.dist(p, q)
                if 6 <= Ln <= 30: segs.append((p, q, Ln))
    def xpads(segs, tolM, tolL):
        out_ = []
        for i in range(len(segs)):
            for j in range(i+1, len(segs)):
                (p, q, L1), (s2, t, L2) = segs[i], segs[j]
                m1 = ((p[0]+q[0])/2, (p[1]+q[1])/2); m2 = ((s2[0]+t[0])/2, (s2[1]+t[1])/2)
                if math.dist(m1, m2) < tolM and abs(L1-L2) < tolL:
                    ang = abs(math.atan2(q[1]-p[1], q[0]-p[0]) - math.atan2(t[1]-s2[1], t[0]-s2[0])) % math.pi
                    if .25 < ang < math.pi-.25:
                        b = obox(np.array([p, q, s2, t]))
                        if 4 <= b[2] <= 24 and 2 <= b[3] <= 14 and all(math.hypot(b[0]-f[0], b[1]-f[1]) > 2 for f in out_): out_.append(b)
        return out_
    fire = xpads(segs, .3, .3)
    if not fire and rawFire is not None:   # הרחבות מצוירות ברצועות מילוי דקות (שכבת מסלול הכבאית): קווים ישרים ארוכים ברסטר של השכבה בלבד
        Lh = cv2.HoughLinesP(rawFire, 1, np.pi/720, 30, minLineLength=40, maxLineGap=12); hs = []
        for x1, y1, x2, y2 in (Lh.reshape(-1, 4) if Lh is not None else []):
            p, q = (gx0 + x1*.1, gy1 - y1*.1), (gx0 + x2*.1, gy1 - y2*.1); Ln = math.dist(p, q)
            if 6 <= Ln <= 30: hs.append((p, q, Ln))
        fire = xpads(hs, .8, 1.0); print('  רחבות כיבוי מרסטר מסלול הכבאית:', len(hs), 'קווים,', len(fire), 'רחבות')
    if not fire and surf.get('firemark'):     # בלי איקס רציף (קו מקווקו): הרחבה היא מלבן המילוי
        for Pp in [np.array(f_[1]).reshape(-1, 2)/10 for f_ in surf['firemark']]:
            b = obox(Pp)
            if 4 <= b[2] <= 24 and 2.5 <= b[3] <= 14 and all(math.hypot(b[0]-f[0], b[1]-f[1]) > 2 for f in fire): fire.append(b)
    obj['fire'] = fire
    obj = {k: v for k, v in obj.items() if v}
    for k in obj: topic[k] = {'treeNew': 'trees', 'treeOld': 'trees', 'treeSurvey': 'trees', 'bench': 'shade', 'bin': 'waste', 'wasteInlet': 'waste', 'fire': 'fire'}[k]
    print('משטחים:', {k: len(v) for k, v in surf.items()}); print('קווים:', {k: len(v) for k, v in lines.items()})
    print('אובייקטים:', {k: (sum(len(x[1]) for x in v) if k == 'treeSurvey' else len(v)) for k, v in obj.items()})

    # ── 3. מיזוג עם המודל הקיים ──
    keep = set(PR['keepFromRaster'])
    model = dict(base); model['surf'] = {k: v for k, v in base['surf'].items() if k in keep}; model['lines'] = {k: v for k, v in base['lines'].items() if k in keep}
    model['obj'] = {k: v for k, v in base['obj'].items() if k in keep}; model['topic'] = {k: v for k, v in base['topic'].items() if k in keep}
    for D, S_ in ((model['surf'], surf), (model['lines'], lines), (model['obj'], obj)): D.update(S_)
    if 'pavingRaster' in keep and base['surf'].get('paving'):   # שאר הריצוף מצויר בשרטוט בקווקוו בלבד: נשאר מהתמונה, כהערכה
        model['surf']['paving'] = base['surf']['paving'] + surf.get('paving', [])
    model['topic'].update(topic); model['scale'] = PR['scale']; model['lampNew'] = len(model['obj'].get('lamp', []))
    model['vector'] = dict(source=PR['source'], cal=cal)
    allp = np.array([v for L in model['surf'].values() for _, f in L for v in f]).reshape(-1, 2) / 10
    model['bbox'] = [round(float(v), 1) for v in (*allp.min(0), *allp.max(0))]
    json.dump(model, open(os.path.join(out, 'model.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))

    # ── 4. שכבות השרטוט כתמונות ──
    man = ld(os.path.join(out, 'manifest.json'))
    ui = doc.layer_ui_configs()
    if not a.no_images and ui:
        zoom = 1600 / FR.width; mat = fitz.Matrix(zoom, zoom); by_g = collections.defaultdict(list); other = []
        for u in ui:
            g = next((gid for gid, _, rx in GROUPS if re.search(rx, u['text'])), None)
            (by_g[g] if g else other).append(u)
        def render(nums):
            for u in ui: doc.set_layer_ui_config(u['number'], action=2)
            for n in nums: doc.set_layer_ui_config(n, action=0)
            pm = doc[0].get_pixmap(matrix=mat, clip=FR, alpha=True)
            return np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.h, pm.w, 4).copy()
        from PIL import Image
        recs = []
        for gid, label, _ in GROUPS + [('other', 'שכבות נוספות: טקסט, מידות, גיליון ופרטים', '')]:
            us = other if gid == 'other' else by_g.get(gid, [])
            if not us: continue
            arr = render([u['number'] for u in us]); ink = float((arr[..., 3] > 30).mean())
            if ink == 0: continue
            Image.fromarray(arr, 'RGBA').save(os.path.join(out, gid + '.webp'), quality=80, method=6)
            recs.append(dict(id=gid, name=label, file=gid + '.webp', ink=round(ink*100, 2), cad=sorted({u['text'].split('|')[-1] for u in us})))
            print(f'  {gid:6} {len(us):3} שכבות, כיסוי {ink*100:.2f}%')
        # נושא שאין לו שכבה בשרטוט הזה, אבל יש לו תוכן במודל (ניקוז מחוברת העיצוב, תאורה מהמצגת): מצויר מהמודל, במסגרת של השרטוט
        Wi, Hi = int(FR.width*zoom), int(FR.height*zoom); have = {r['id'] for r in recs}
        def topx(x, y):
            X, Y = x + e0 - tx, y + n0 - ty; return int(((c_*X + s_*Y)/K - FR.x0)*zoom), int(((s_*X - c_*Y)/K - FR.y0)*zoom)
        SYN = dict(water=('מים וניקוז: מחוברת העיצוב', (30, 115, 216)), power=('תאורה וחדר טכני: מהמצגת', (224, 168, 0)), bike=('חדרי אופניים: מהמצגת', (63, 143, 181)))
        for gid, (label, col) in SYN.items():
            if gid in have: continue
            ks = [k for k, t_ in model['topic'].items() if t_ == gid]
            if not ks: continue
            img = np.zeros((Hi, Wi, 4), np.uint8); rgba = (*col, 255)
            for k in ks:
                for f_ in model['lines'].get(k, []):
                    P_ = np.array(f_).reshape(-1, 2)/10; cv2.polylines(img, [np.array([topx(*q) for q in P_], np.int32)], False, rgba, 3, cv2.LINE_AA)
                for _, f_ in model['surf'].get(k, []):
                    P_ = np.array(f_).reshape(-1, 2)/10; cv2.fillPoly(img, [np.array([topx(*q) for q in P_], np.int32)], rgba)
                for o_ in model['obj'].get(k, []):
                    if isinstance(o_, list) and len(o_) >= 2 and isinstance(o_[0], (int, float)): cv2.circle(img, topx(o_[0], o_[1]), 6, rgba, -1, cv2.LINE_AA)
            ink = float((img[..., 3] > 30).mean())
            if ink == 0: continue
            Image.fromarray(img, 'RGBA').save(os.path.join(out, gid + '.webp'), quality=80, method=6)
            recs.append(dict(id=gid, name=label, file=gid + '.webp', ink=round(ink*100, 2), cad=[], drawn=True)); print(f'  {gid:6} מצויר מהמודל, כיסוי {ink*100:.2f}%')
        for u in ui: doc.set_layer_ui_config(u['number'], action=0)
        pm = doc[0].get_pixmap(matrix=mat, clip=FR, alpha=False); Image.frombytes('RGB', (pm.w, pm.h), pm.samples).save(os.path.join(out, 'full.webp'), quality=80, method=6)
        man.update(w=recs[0] and int(FR.width*zoom), h=int(FR.height*zoom), mPerPx=round(K/zoom, 5), cadTotal=len(ui), unassigned=[], layers=recs, source=PR['pdf'])
    man.update(vector=dict(source=PR['source'], cal=cal, pdf=PR['pdf']), scale=PR['scale'])
    present = set(model['topic'].values()); man['missing'] = [t for t in man.get('missing', []) if t not in present]   # מה שהשרטוט השלים כבר לא חסר
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    srcj = os.path.join(out, 'source.json'); sj = ld(srcj) if os.path.exists(srcj) else {}
    sj['vector'] = dict(made=datetime.date.today().isoformat(), pdf=PR['pdf'], source=PR['source'], calibration=cal, georef=G['method'],
                        kinds=sorted(list(surf) + list(lines) + list(obj)), keptFromImage=sorted(k for k in keep if k in base['surf'] or k in base['lines'] or k in base['obj']))
    json.dump(sj, open(srcj, 'w', encoding='utf8'), ensure_ascii=False, indent=1)

if __name__ == '__main__': main()
