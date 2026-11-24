#!/usr/bin/env python3
"""סקר העצים מנספח העצים הבוגרים של התב"ע (ענת, 24.11.2026: נאות ספיר, "גם את העצים שבסקר").

בשרטוט הפיתוח (4215-J-1) כבר יש טבעות בצבעי הסקר, אבל בלי משמעות ובלי כל השטח. הנספח (PDF וקטורי, 1:500) נותן את כל העצים,
וכל צבע הוא החלטה: לשימור, להעתקה או לכריתה. הכלי:
 1. מעגן את הנספח לשרטוט שכבר מעוגן (J-1), דרך קווי המגרשים (pgvul1) בשניהם: שלוש נקודות פתיחה ואז ICP. בלי קנה מידה מנוחש.
 2. אוסף את סמלי העצים מהשכבה Symbols לפי צבע המילוי, ומקבץ כל סמל (כ-80 חלקים) לנקודה אחת.
 3. כותב ל-model.json את obj.treeSurvey לפי סטטוס, ול-manifest.json את treeStatus: ספירה, מקור, שיטה, ועצים לשימור שנופלים
    בתוך בניין או בתוך קו המרתף (ממצא לחוות הדעת).
המשמעות של כל צבע בפרופיל (data/vector/<תיק>.json, treeAnnex.status), עם הנימוק. שימוש:
python3 tools/annex-trees.py --tik 1887 --annex <נספח עצים.pdf> --ref <4215-J-1.pdf>
"""
import os, json, math, re, argparse, collections
import numpy as np
import pymupdf as fitz
from scipy.spatial import cKDTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def seg_points(pdf, rx, xmax=None, step=2.0):
    pg = fitz.open(pdf)[0]; W = pg.rect.width; P = []
    for d in pg.get_drawings():
        if not re.search(rx, d.get('layer') or ''): continue
        for it in d['items']:
            if it[0] != 'l': continue
            a, b = np.array(it[1]), np.array(it[2])
            if xmax and a[0] > W*xmax: continue
            n = max(2, int(np.hypot(*(b-a))/step)); P += list(a + (b-a)*np.linspace(0, 1, n)[:, None])
    return np.array(P)

def similarity(X, Y):
    mx, my = X.mean(0), Y.mean(0); U, _, Vt = np.linalg.svd((X-mx).T @ (Y-my)); R = Vt.T @ U.T
    s = np.sum((Y-my)*((X-mx) @ R.T))/np.sum((X-mx)**2); return R, s, my - s*(mx @ R.T)

def register(A, B, pairs):
    """A: נקודות בנספח, B: בשרטוט המעוגן. pairs: [[x,y] בנספח, [x,y] בשרטוט] לפתיחה. ICP קטום (60% הקרובות)."""
    R, s, t = similarity(np.array([p[0] for p in pairs], float), np.array([p[1] for p in pairs], float))
    tB = cKDTree(B)
    for _ in range(80):
        d, i = tB.query((A @ R.T)*s + t); m = d < max(np.percentile(d, 60), .5)
        R2, s2, t2 = similarity(A[m], B[i[m]])
        if np.linalg.det(R2) < 0: break
        R, s, t = R2, s2, t2
    d, _ = tB.query((A @ R.T)*s + t)
    near = d[d < np.percentile(d, 60)]
    return R, s, t, float(np.median(near)), float(np.mean(d < 3))

def hexc(c): return '#%02x%02x%02x' % tuple(int(round(v*255)) for v in c[:3])

def inside(pt, P):
    x, y = pt; c = False
    for i in range(len(P)):
        a, b = P[i], P[i-1]
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1]) + a[0]: c = not c
    return c

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--tik', required=True); ap.add_argument('--annex', required=True); ap.add_argument('--ref', required=True)
    ap.add_argument('--profile'); a = ap.parse_args()
    prof = json.load(open(a.profile or os.path.join(ROOT, 'data', 'vector', f'{a.tik}.json'), encoding='utf8'))['treeAnnex']
    out = os.path.join(ROOT, 'layers', a.tik)
    model = json.load(open(os.path.join(out, 'model.json'), encoding='utf8'))
    man = json.load(open(os.path.join(out, 'manifest.json'), encoding='utf8'))
    # 1. עיגון: הנספח אל דף השרטוט המעוגן, ומשם לרשת ישראל דרך xf של המודל
    A = seg_points(a.annex, prof['lotLayer'], prof.get('xmax')); B = seg_points(a.ref, prof['refLotLayer'])
    R, s, t, med, frac = register(A, B, prof['pairs'])
    th, tx, ty, K = model['vector']['xf']; e0, n0 = model['e0'], model['n0']; c_, s_ = math.cos(th), math.sin(th)
    def toM(p):
        x, y = (np.array(p) @ R.T)*s + t
        return (c_*x*K + s_*y*K + tx - e0, s_*x*K - c_*y*K + ty - n0)
    rot = math.degrees(math.atan2(R[1, 0], R[0, 0]))
    print(f'עיגון: קנה מידה {s:.4f} מול השרטוט, סיבוב {rot:.2f}°, סטייה חציונית {med*K:.2f} מ\', {frac:.0%} מהנקודות עד {3*K:.2f} מ\'')
    # 2. סמלים לפי צבע. כל סמל עשוי עשרות חלקים: קיבוץ ברדיוס של 7 יחידות דף
    pg = fitz.open(a.annex)[0]; W = pg.rect.width; xmax = prof.get('xmax') or 1
    frag = collections.defaultdict(list)
    for d in pg.get_drawings():
        if d.get('layer') != prof.get('symLayer', 'Symbols') or not d.get('fill'): continue
        h = hexc(d['fill'])
        if h not in prof['status']: continue
        r = d['rect']; cx, cy = (r.x0+r.x1)/2, (r.y0+r.y1)/2
        if cx < W*xmax: frag[h].append((cx, cy))
    groups, pts = {}, []
    for h, F in frag.items():
        F = np.array(F); par = list(range(len(F)))
        def find(i):
            while par[i] != i: par[i] = par[par[i]]; i = par[i]
            return i
        for i, j in cKDTree(F).query_pairs(7): par[find(i)] = find(j)
        cl = collections.defaultdict(list)
        for i in range(len(F)): cl[find(i)].append(F[i])
        C = [np.mean(v, 0) for v in cl.values() if len(v) >= prof.get('minFrag', 40)]
        st = prof['status'][h]; L = [[round(x, 2), round(y, 2), 1.0] for x, y in (toM(c) for c in C)]
        groups[st['id']] = dict(hex=st['color'], label=st['label'], list=L, why=st.get('why', ''))
        pts += [(st['id'], p) for p in L]
    # 3. קו המרתף מתוכנית המרתף שבאותו גיליון (החצי הימני): אותו קנה מידה וסיבוב, הזזה בלבד. ההזזה מהעצים, שמצוירים בשני החצאים
    ring = lambda c: np.array(c, float).reshape(-1, 2)/10
    bsrc = None
    if prof.get('basement'):
        import cv2
        from PIL import Image, ImageDraw
        bp = prof['basement']; x0, x1 = W*xmax, W*bp.get('xmax', .9)
        right = collections.defaultdict(list)
        for d in pg.get_drawings():
            if d.get('layer') == prof.get('symLayer', 'Symbols') and d.get('fill') and hexc(d['fill']) in prof['status']:
                r = d['rect']; cx = (r.x0+r.x1)/2
                if x0 <= cx < x1: right[hexc(d['fill'])].append((cx, (r.y0+r.y1)/2))
        diffs = []
        for h in right:
            R_, L_ = np.array(right[h]), np.array(frag[h])
            for p in R_[::25]: diffs += list(np.round(p - L_))
        u, n = np.unique(np.array(diffs), axis=0, return_counts=True); off = u[n.argmax()]
        print('הזזה בין תוכנית הקרקע לתוכנית המרתף בגיליון:', off, 'יחידות דף, תמיכה', n.max())
        res = bp.get('px', 1.0); X0, Y0 = x0, 0; Wd, Hd = int((x1-x0)/res)+1, int(pg.rect.height/res)+1
        im = Image.new('L', (Wd, Hd), 0); dr_ = ImageDraw.Draw(im)
        for d in pg.get_drawings():
            if not re.search(bp['layers'], d.get('layer') or ''): continue
            pts_ = []
            for it in d['items']:
                if it[0] == 'l': pts_ += [it[1], it[2]]
                elif it[0] == 're': r = it[1]; pts_ += [r.tl, r.tr, r.br, r.bl]
                elif it[0] == 'qu': pts_ += list(it[1])
                elif it[0] == 'c': pts_ += [it[1], it[4]]
            pts_ = [((p.x-X0)/res, (p.y-Y0)/res) for p in pts_ if x0 <= p.x < x1]
            if len(pts_) >= 3: dr_.polygon(pts_, fill=255)
            elif len(pts_) == 2: dr_.line(pts_, fill=255, width=2)
        mk = np.array(im); per_m = 1/(s*K*res)                   # פיקסלים למטר
        k_ = int(round(bp.get('closeM', 3.0)*per_m)) | 1
        mk = cv2.morphologyEx(mk, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_, k_)))
        cs, hi = cv2.findContours(mk, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        minA = bp.get('minAreaM2', 400)*per_m**2; minHole = bp.get('minHoleM2', 300)*per_m**2
        rings, outer, holes = [], 0.0, 0.0
        for i, c in enumerate(cs):
            A_ = cv2.contourArea(c); isHole = hi[0][i][3] >= 0
            if A_ < (minHole if isHole else minA): continue
            if isHole and cv2.contourArea(cs[hi[0][i][3]]) < minA: continue
            c = cv2.approxPolyDP(c, .3*per_m, True).reshape(-1, 2)
            P_ = [toM((x*res + X0 - off[0], y*res + Y0 - off[1])) for x, y in c]; P_.append(P_[0])
            rings.append([int(round(v*10)) for q in P_ for v in q])
            if isHole: holes += A_/per_m**2
            else: outer += A_/per_m**2
        model['lines']['bline'] = rings
        bsrc = dict(source=bp.get('source', prof['source']), rings=len(rings), area=int(outer - holes), holes=int(holes), layers=bp['layers'], offset=[float(off[0]), float(off[1])])
        print(f'קו המרתף: {len(rings)} טבעות, {outer-holes:,.0f} מ"ר (חללים {holes:,.0f} מ"ר)')
    # 4. עצים לשימור בתוך בניין או בתוך קו המרתף (זוגי־אי זוגי על כל הטבעות, כך שחלל בתוך המרתף נשאר בחוץ)
    foots = [ring(c) for c in model.get('foot', [])]
    bl = [ring(c) for c in model['lines'].get('bline', []) if len(c) >= 8]
    bl = [P for P in bl if np.hypot(*(P[0]-P[-1])) < 2]
    inBl = lambda p: sum(inside(p, P) for P in bl) % 2 == 1
    conf = collections.Counter(); byBl = collections.Counter()
    for sid, p in pts:
        if bl and inBl(p[:2]): byBl[sid] += 1
        if sid != 'preserve': continue
        if any(inside(p[:2], F) for F in foots): conf['building'] += 1
        elif bl and inBl(p[:2]): conf['basement'] += 1
    model['obj']['treeSurvey'] = [[g['hex'], g['list'], g['label']] for g in groups.values()]
    json.dump(model, open(os.path.join(out, 'model.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    cnt = {k: len(g['list']) for k, g in groups.items()}
    man['treeStatus'] = dict(source=prof['source'], counts=cnt, total=sum(cnt.values()),
                             legend=[dict(id=k, label=g['label'], color=g['hex'], why=g['why']) for k, g in groups.items()],
                             cal=dict(scaleRatio=round(s, 4), rotDeg=round(rot, 2), median=round(med*K, 2), within=round(frac, 2), ref=prof['refName']),
                             conflicts=dict(conf), inBasement=dict(byBl), basementLine=len(bl) > 0, basement=bsrc)
    F = [f for f in man.get('findings', []) if f.get('src') != 'treeAnnex']
    if conf:
        F.append(dict(src='treeAnnex', st='no', t='עצים לשימור בתוך תחום הבנייה',
                      sub='מנספח העצים הבוגרים: ' + ' ו-'.join(x for x in [f"{conf['building']} עצים לשימור בתוך קומת הקרקע" if conf.get('building') else '', f"{conf['basement']} {'עץ' if conf['basement'] == 1 else 'עצים'} לשימור בתוך קו המרתף (הערכה, לפי העיגון)" if conf.get('basement') else ''] if x),
                      note='עץ לשימור מעל מרתף או בתוך בניין לא ישרוד. לבקש מהאדריכל ומיועץ הנוף ליישב: העתקה, שינוי קו המרתף, או בית גידול מעל התקרה עם עומק אדמה'))
    man['findings'] = F
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('עצים:', cnt, 'סה"כ', sum(cnt.values()), '| לשימור בתוך בנייה:', dict(conf), '| קו מרתף סגור:', len(bl))

if __name__ == '__main__': main()
