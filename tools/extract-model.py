#!/usr/bin/env python3
"""מחלץ מתוכנית פיתוח (PDF וקטורי מ-AutoCAD) מודל תלת־ממדי למסך "שכבות": plans-model.js.

שימוש:  python3 tools/extract-model.py <plan.pdf> <layers/תיק> --e0 166625 --x0 342.1 --n0 634550 --y0 150.1
דורש:   pip install pymupdf numpy scipy opencv-python-headless

עיגון: שני קווי רשת מהשרטוט (רשת ישראל החדשה). --x0 הוא מיקום הקו האנכי בדף (נקודות PDF) ו---e0 הקואורדינטה שלו,
--y0 ו---n0 אותו דבר לקו האופקי. הרשת בשרטוט מיושרת לצפון, ולכן אין סיבוב.

מה יוצא: model.json. משטחים (פוליגונים עם הצבע המקורי), קווים, ואובייקטים (עצים, עמודי תאורה, ספסלים,
רחבות כיבוי, מכלים, ארונות). כל הקואורדינטות במטרים, יחסית למרכז המגרש: x מזרחה, y צפונה.
זיהוי האובייקטים הוא לפי שם השכבה וצורת הסימון. מה שלא זוהה בביטחון לא נכנס.
"""
import sys, json, re, os, argparse, math, collections
import numpy as np
import pymupdf as fitz

def short(n): return (n or '').split('|')[-1].split('$0$')[-1]

SURF = [  # סוג משטח, נושא, ביטוי על שם השכבה
 ('asphalt', 'road',  r'^(ol-asfalt|bez-road)$'),
 ('brt',     'road',  r'^AM-BRT$'),
 ('ramp',    'park',  r'^0l-hatch misaa$'),
 ('paving',  'walk',  r'^(0l-hatch rizuf|0l-htc-rizuf.*|ol-rizuf|KSM-S-rizuf.*|0-ritzuf|AM-Ritsuf|40-ritsof.*)$'),
 ('green',   'green', r'^(0l-ginun|0l-hatch ginun.*|0l-htc-ginun.*|0l-htc-green|0l-midshaa|KSM-S-GARDEN.*|40-ginon.*)$'),
 ('bike',    'bike',  r'^(ol-ofanaim.*|40-shvil ofnayim|AM-Ofnim)$'),
 ('play',    'shade', r'^0l-playground$'),
 ('deck',    'shade', r'^0l-deck$'),
 ('pergola', 'shade', r'^(0l-hatch pergula|h-skaka)$'),
 ('wall',    'build', r'^(A-WALL-PATT.*|S-COLS)$'),
 ('firemark','fire',  r'^(kiboy ash|kib ash2|0l-timron|0-Fire expansion)$'),
]
LINES = [
 ('plot',   'site',  r'^1801$', True),
 ('lots',   'site',  r'^(1802|pgvul1)$'),
 ('bline',  'site',  r'^(0l-kav martef|0l-gvul-dipun)$'),
 ('curb',   'road',  r'^(olcurb\d?|AM-Curb.*|1EVEN-SAFA|40-even_safa)$'),
 ('paint',  'road',  r'^(olline.*|Am-Paint|AM-Paint.*|bez-paint)$'),
 ('cross',  'walk',  r'^(0l-pasim|PASEI EATA)$'),
 ('lowwall','level', r'^(0l-kir|1KIR-EVEN|40-wall|bez-kir)$'),
 ('fence',  'level', r'^(ggader|1GADER-RESHET|0l-maake.*|1MAAKE)$'),
 ('stairs', 'walk',  r'^(madregot|0l-madregot|ghmadregot|S-STRS)$'),
 ('glass',  'build', r'^A-GLAZ.*$'),
 ('door',   'build', r'^A-DOOR$'),
 ('parking','park',  r'^(C-PRKG.*|bez-ramp|rampa)$'),
 ('water',  'water', r'^z-maim$', True),
 ('sewer',  'water', r'^Z-BIUV$', True),
 ('drain',  'water', r'^(nikuz|NIKUZ|0l-nikuzim)$'),
 ('gas',    'power', r'^(gaz|0l-gaz)$'),
 ('fireroute','fire', r'^(kiboy ash|kib ash2|0-Fire expansion)$'),
 ('gardenedge','green', r'^(0l-even gan|1EVEN-GAN|40-evengan|KSM-L-EVNGAN)$'),
]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('pdf'); ap.add_argument('out')
    for k in ('e0', 'x0', 'n0', 'y0'): ap.add_argument('--'+k, type=float, required=True)
    ap.add_argument('--scale', type=float, default=250)
    a = ap.parse_args()
    K = a.scale * 0.0254 / 72                       # מטר לנקודת PDF
    doc = fitz.open(a.pdf); page = doc[0]
    dr = page.get_drawings()
    E = lambda x: a.e0 + (x - a.x0) * K
    Nn = lambda y: a.n0 - (y - a.y0) * K
    by = collections.defaultdict(list); bysurvey = collections.defaultdict(list)
    for d in dr:
        # מפת המדידה (x-med) מתארת את המצב הקיים. היא נכנסת רק לסוגים שמסומנים "קיים"
        (bysurvey if (d.get('layer') or '').startswith('x-med-') else by)[short(d.get('layer'))].append(d)
    def layers(rx, survey=False):
        src = bysurvey if survey else by
        return [d for n, L in src.items() if re.search(rx, n) for d in L]

    # מרכז המגרש: מרכז הקו הכחול (שכבה 1801), בתוך מסגרת השרטוט
    R = page.rect; fx0, fy0, fx1, fy1 = R.width*0.040, R.height*0.027, R.width*0.808, R.height*0.975
    pts = [p for d in bysurvey.get('1801', []) for it in d['items'] if it[0] == 'l' for p in (it[1], it[2]) if fx0 < p.x < fx1 and fy0 < p.y < fy1]
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2; cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    E0, N0 = E(cx), Nn(cy)
    T = lambda p: (E(p.x) - E0, Nn(p.y) - N0)
    inframe = lambda p: fx0 <= p.x <= fx1 and fy0 <= p.y <= fy1

    def rings(d):
        """מפרק ציור למסלולים רציפים (בנקודות PDF)"""
        out = []; cur = []
        def add(p):
            if cur and abs(cur[-1].x-p.x) < 1e-3 and abs(cur[-1].y-p.y) < 1e-3: return
            cur.append(p)
        def brk():
            nonlocal cur
            if len(cur) > 1: out.append(cur)
            cur = []
        for it in d['items']:
            k = it[0]
            if k == 'l':
                if cur and (abs(cur[-1].x-it[1].x) > 0.05 or abs(cur[-1].y-it[1].y) > 0.05): brk()
                add(it[1]); add(it[2])
            elif k == 'c':
                p0, p1, p2, p3 = it[1:5]
                if cur and (abs(cur[-1].x-p0.x) > 0.05 or abs(cur[-1].y-p0.y) > 0.05): brk()
                add(p0)
                for t in (0.2, 0.4, 0.6, 0.8, 1.0):
                    u = 1-t; add(fitz.Point(u**3*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t**3*p3.x, u**3*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t**3*p3.y))
            elif k == 're':
                brk(); r = it[1]; out.append([r.tl, r.tr, r.br, r.bl, r.tl])
            elif k == 'qu':
                brk(); q = it[1]; out.append([q.ul, q.ur, q.lr, q.ll, q.ul])
        brk(); return out
    def area(r): return abs(sum(r[i][0]*r[(i+1) % len(r)][1] - r[(i+1) % len(r)][0]*r[i][1] for i in range(len(r)))) / 2
    def simp(r, tol=0.04):
        o = [r[0]]
        for p in r[1:]:
            if abs(p[0]-o[-1][0]) > tol or abs(p[1]-o[-1][1]) > tol: o.append(p)
        return o
    flat = lambda r: [round(v*10) for p in r for v in p]          # דצימטרים, מספרים שלמים
    hexc = lambda c: '#%02x%02x%02x' % tuple(int(round(v*255)) for v in c[:3])

    model = dict(e0=round(E0, 2), n0=round(N0, 2), scale=a.scale, surf={}, lines={}, obj={}, topic={})
    # ── משטחים ──
    for kind, topic, rx in SURF:
        polys = []
        for d in layers(rx):
            if not d.get('fill') or 'f' not in d['type']: continue
            c = hexc(d['fill'])
            if kind != 'wall' and c == '#ffffff': continue
            for r in rings(d):
                if not any(inframe(p) for p in r): continue
                m = simp([T(p) for p in r])
                if len(m) > 2 and m[0] == m[-1]: m = m[:-1]
                if len(m) < 3 or area(m) < (0.02 if kind == 'wall' else 0.15): continue
                polys.append([c, flat(m)])
        if polys: model['surf'][kind] = polys; model['topic'][kind] = topic
    # ── קווים ──
    for kind, topic, rx, *sv in LINES:
        segs = []
        for d in layers(rx, bool(sv)):
            if 's' not in d['type'] or (kind == 'lots' and d['type'] != 's'): continue   # בגבולות: קו טהור בלבד, לא שולי מילוי
            for r in rings(d):
                if not any(inframe(p) for p in r): continue
                m = simp([T(p) for p in r], 0.08)
                if len(m) < 2: continue
                L = sum(math.dist(m[i], m[i+1]) for i in range(len(m)-1))
                if L < (0.25 if kind in ('stairs', 'glass', 'door') else 0.6): continue
                segs.append(flat(m))
        if segs: model['lines'][kind] = segs; model['topic'][kind] = topic

    # ── אובייקטים ──
    def circles(rx, dmin, dmax, need_curve=True, survey=False):
        """סימונים עגולים: מרכז ורדיוס במטרים"""
        out = []
        for d in layers(rx, survey):
            r = d['rect']; w, h = r.width*K, r.height*K
            if not (dmin <= max(w, h) <= dmax) or not (0.7 < w/max(h, 1e-6) < 1.43): continue
            kinds = {i[0] for i in d['items']}
            if need_curve and 'c' not in kinds and len(d['items']) < 8: continue
            p = fitz.Point((r.x0+r.x1)/2, (r.y0+r.y1)/2)
            if inframe(p): out.append((*T(p), max(w, h)/2))
        return out
    def dedupe(items, link):
        """מאחד סימונים שמרכזם קרוב: נשאר הגדול"""
        items = sorted(items, key=lambda t: -t[2]); keep = []
        for x, y, r in items:
            if all(math.hypot(x-kx, y-ky) > link for kx, ky, _ in keep): keep.append((x, y, r))
        return keep
    def clusters(rx, link, fills_only=False, strokes_only=False, survey=False):
        """קבוצות של ציורים סמוכים: נקודות הקבוצה"""
        from scipy.spatial import cKDTree
        ds = []
        for d in layers(rx, survey):
            if fills_only and 'f' not in d['type']: continue
            if strokes_only and 'f' in d['type']: continue
            P = [T(p) for r in rings(d) for p in r if inframe(p)]
            if P: ds.append(np.array(P))
        if not ds: return []
        cen = np.array([p.mean(0) for p in ds]); tree = cKDTree(cen); par = list(range(len(ds)))
        def find(i):
            while par[i] != i: par[i] = par[par[i]]; i = par[i]
            return i
        for i, j in tree.query_pairs(link): par[find(i)] = find(j)
        g = collections.defaultdict(list)
        for i in range(len(ds)): g[find(i)].append(ds[i])
        return [np.vstack(v) for v in g.values()]
    def obox(P):
        """מלבן מכוון: מרכז, אורך, רוחב, זווית"""
        c = P.mean(0); u, s, vt = np.linalg.svd(P - c, full_matrices=False); ax = vt[0]; q = (P - c) @ vt.T
        ln, wd = q[:, 0].max()-q[:, 0].min(), q[:, 1].max()-q[:, 1].min()
        mid = c + vt.T @ np.array([(q[:, 0].max()+q[:, 0].min())/2, (q[:, 1].max()+q[:, 1].min())/2])
        return [round(float(mid[0]), 2), round(float(mid[1]), 2), round(float(ln), 2), round(float(wd), 2), round(math.atan2(ax[1], ax[0]), 3)]
    r2 = lambda L: [[round(x, 2), round(y, 2), round(r, 2)] for x, y, r in L]

    O = model['obj']
    O['treeNew'] = r2(dedupe(circles(r'^(0l-tree.*|KSM-L-TREE.*|shazap)$', 2.2, 14), 1.6))
    O['treeOld'] = r2(dedupe(circles(r'^(be-tree-kayam|40-trees.*)$', 2.2, 14), 1.6))
    # סקר העצים: סימונים צבעוניים. הצבע נשמר כמו שהוא, המשמעות לפי מקרא הסקר
    sv = collections.defaultdict(list)
    for d in layers(r'^SYMBOLS$'):
        if d.get('fill') and 'f' in d['type']:
            r = d['rect']; p = fitz.Point((r.x0+r.x1)/2, (r.y0+r.y1)/2)
            if inframe(p) and max(r.width, r.height)*K < 4: sv[hexc(d['fill'])].append((*T(p), max(r.width, r.height)*K/2))
    O['treeSurvey'] = [[c, r2(dedupe(v, 1.5))] for c, v in sv.items() if c not in ('#ffffff', '#000000') and len(v) > 3]
    O['lamp'] = r2(dedupe(circles(r'^(TEU_AMUD.*|0l-light|KSM-L-Lighting)$', 0.25, 1.6), 1.2))
    model['lampNew'] = len(dedupe(circles(r'^(0l-light|KSM-L-Lighting)$', 0.25, 1.6), 1.2))   # כמה מהם מוצעים, ולא קיימים ברחוב
    O['bench'] = [obox(P) for P in clusters(r'^(0l-safsal.*|KSM-L-Safsal|40-SAFSAL.*|safsal)$', 0.9) if len(P) >= 4]
    O['bench'] = [b for b in O['bench'] if 1.0 <= b[2] <= 4.5 and b[3] <= 1.6]
    O['bin'] = [obox(P) for P in clusters(r'^0l-mihzur$', 0.5) if len(P) >= 4]
    O['bin'] = [b for b in O['bin'] if 0.5 <= b[2] <= 4 and b[3] >= 0.4]
    O['cabinet'] = [obox(P) for P in clusters(r'^aron$', 0.3, survey=True) if len(P) >= 4]
    O['trafo'] = [obox(P) for P in clusters(r'^0l-trafo-ttk$', 3.0) if len(P) >= 4]
    O['cover'] = r2(dedupe(circles(r'^(1COVER|ta|mispur biuv)$', 0.4, 1.6, need_curve=False, survey=True), 0.8))
    # רחבות כיבוי אש: מלבן עם איקס. שני אלכסונים שנחתכים באמצע מגדירים את המלבן
    segs = []
    for d in layers(r'^(kiboy ash|kib ash2|0-Fire expansion)$'):
        for it in d['items']:
            if it[0] == 'l' and inframe(it[1]):
                p, q = T(it[1]), T(it[2]); L = math.dist(p, q)
                if 6 <= L <= 22: segs.append((p, q, L))
    fire = []
    for i in range(len(segs)):
        for j in range(i+1, len(segs)):
            (p, q, L1), (s, t, L2) = segs[i], segs[j]
            m1 = ((p[0]+q[0])/2, (p[1]+q[1])/2); m2 = ((s[0]+t[0])/2, (s[1]+t[1])/2)
            if math.dist(m1, m2) < 0.25 and abs(L1-L2) < 0.25:
                ang = abs(math.atan2(q[1]-p[1], q[0]-p[0]) - math.atan2(t[1]-s[1], t[0]-s[0])) % math.pi
                if 0.25 < ang < math.pi-0.25:
                    b = obox(np.array([p, q, s, t]))
                    if 4 <= b[2] <= 20 and 2 <= b[3] <= 12 and all(math.hypot(b[0]-f[0], b[1]-f[1]) > 2 for f in fire): fire.append(b)
    O['fire'] = fire
    # מסת המבנים: סגירה של קירות קומת הקרקע למתאר אחד לכל מבנה
    try:
        import cv2
        res = 0.25; W = model['surf'].get('wall', [])
        if W:
            A = np.array([v for _, f in W for v in f]).reshape(-1, 2) / 10
            x0, y0 = A.min(0) - 5; x1, y1 = A.max(0) + 5
            img = np.zeros((int((y1-y0)/res), int((x1-x0)/res)), np.uint8)
            for _, f in W:
                P = (np.array(f).reshape(-1, 2)/10 - [x0, y0]) / res
                cv2.fillPoly(img, [P.astype(np.int32)], 255)
            k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))            # סגירה של 5 מ'
            img = cv2.morphologyEx(img, cv2.MORPH_CLOSE, k)
            cs, _ = cv2.findContours(img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            foot = []
            for c in cs:
                if cv2.contourArea(c) * res * res < 120: continue
                c = cv2.approxPolyDP(c, 0.6/res, True).reshape(-1, 2)
                foot.append(flat([(float(p[0])*res + x0, float(p[1])*res + y0) for p in c]))
            model['foot'] = foot
    except ImportError:
        print('בלי opencv: לא חושבה מסת המבנים')
    # תחום המודל
    allp = np.array([v for L in model['surf'].values() for _, f in L for v in f]).reshape(-1, 2) / 10
    model['bbox'] = [round(float(v), 1) for v in (*allp.min(0), *allp.max(0))]
    os.makedirs(a.out, exist_ok=True)
    json.dump(model, open(os.path.join(a.out, 'model.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    print('מרכז (רשת ישראל):', model['e0'], model['n0'], '| תחום:', model['bbox'])
    for k, v in model['surf'].items(): print(f'  משטח {k:9} {len(v):5} פוליגונים')
    for k, v in model['lines'].items(): print(f'  קו   {k:10} {len(v):5}')
    for k, v in O.items(): print(f'  אובייקט {k:10} {len(v) if k != "treeSurvey" else sum(len(x[1]) for x in v):4}')
    print('  מבנים:', len(model.get('foot', [])), '| גודל הקובץ:', round(os.path.getsize(os.path.join(a.out, 'model.json'))/1e6, 2), 'MB')

if __name__ == '__main__': main()
