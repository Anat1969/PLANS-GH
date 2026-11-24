#!/usr/bin/env python3
"""ניקוז מי גשם מעמוד בחוברת העיצוב (ענת, 24.11.2026: נאות ספיר, עמ' 15, "נגר ניקוז וביוב | ניקוז מי גשם").

העמוד: תמונה של התוכנית בקנה מידה 1:500, ומעליה תוויות וקטוריות של השוחות (N, TL, IL, H, D).
 1. עיגון: קנה המידה ידוע מהעמוד. הסיבוב וההזזה מנקודות פתיחה (מרכזי מגרשים), ואז כיול של קו המגרש האדום מול צלעות התב"ע.
 2. צינורות: הצבע הסגול־כחול של הקווים, רק קווים עבים (קו המרתף והטקסט באותו צבע דקים יותר), קטעים ישרים (Hough).
 3. שוחות: כל תווית "שוחה מי גשם" עם המספר והרומים. המיקום: קצה הצינור הקרוב לתווית, עד 12 מ' (הערכה). בלי צינור קרוב: התווית עצמה.
הכול נכנס ל-model.json של התוכנית: lines.drain (ניקוז מוצע), obj.manhole (שוחות עם רומים).
שימוש: python3 tools/drainage-from-page.py <booklet.pdf> --page 15 --tik 1887 --gcp "<lot:x,y ...>" (פיקסלים בעמוד ב-216 DPI)
"""
import sys, os, re, json, math, argparse, importlib.util
import numpy as np, cv2
import pymupdf as fitz
from scipy.optimize import minimize

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_s = importlib.util.spec_from_file_location('sp', os.path.join(ROOT, 'tools/siteplan-model.py')); SP = importlib.util.module_from_spec(_s); _s.loader.exec_module(SP)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('pdf'); ap.add_argument('--page', type=int, required=True); ap.add_argument('--tik', required=True)
    ap.add_argument('--gcp', required=True); ap.add_argument('--scale', type=float, default=500); ap.add_argument('--dpi', type=int, default=216); ap.add_argument('--debug')
    a = ap.parse_args(); out = os.path.join(ROOT, 'layers', a.tik)
    model = json.load(open(os.path.join(out, 'model.json'), encoding='utf8')); rn = json.load(open(os.path.join(out, 'renewal.json'), encoding='utf8'))
    doc = fitz.open(a.pdf); page = doc[a.page-1]; z = a.dpi/72
    pix = page.get_pixmap(dpi=a.dpi); im = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, :3][:, :, ::-1].copy(); h, w = im.shape[:2]
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); H, S, V = [hsv[..., i].astype(int) for i in range(3)]
    # ── עיגון ──
    pxm = a.dpi/0.0254/a.scale; ls = math.log(1/pxm)
    cen = {}
    for pc in rn['parcels']:
        R = np.array([SP.wgs2itm(q[1], q[0]) for q in pc['c']]); cen.setdefault(pc['lot'], []).append((R.mean(0), SP.area(R)))
    cen = {k: max(v, key=lambda x: x[1])[0] for k, v in cen.items()}
    G = [(int(g.split(':')[0]), tuple(map(float, g.split(':')[1].split(',')))) for g in a.gcp.split()]
    src = np.array([xy for _, xy in G])*[1, -1]/pxm; dst = np.array([cen[l] for l, _ in G])
    ma, md = src.mean(0), dst.mean(0); U, Sg, Vt = np.linalg.svd((dst-md).T @ (src-ma)); Rm = U @ Vt
    if np.linalg.det(Rm) < 0: Rm = U @ np.diag([1, -1]) @ Vt
    t = md - Rm @ ma; q = [t[0], t[1], math.atan2(Rm[1, 0], Rm[0, 0])]
    red = ((((H < 8) | (H > 172)) & (S > 150) & (V > 150))*255).astype(np.uint8); dt = cv2.distanceTransform(255-red, cv2.DIST_L2, 5); E = SP.edges(rn['parcels'])
    def cost(v, trim):
        P = SP.app(SP.inv(SP.sim([v[0], v[1], v[2], ls])), E); ok = (P[:, 0] >= 2) & (P[:, 1] >= 2) & (P[:, 0] < w-2) & (P[:, 1] < h-2)
        return 99 if ok.mean() < .3 else np.minimum(dt[P[ok, 1].astype(int), P[ok, 0].astype(int)]/pxm, trim).mean()
    for trim in (8, 4, 2, 1):
        q = list(minimize(lambda v: cost(v, trim), q, method='Nelder-Mead', options=dict(xatol=1e-3, fatol=1e-5, maxiter=3000,
              initial_simplex=[q, [q[0]+2, q[1], q[2]], [q[0], q[1]+2, q[2]], [q[0], q[1], q[2]+.01]])).x)
    A = SP.sim([q[0], q[1], q[2], ls]); P = SP.app(SP.inv(A), E); ok = (P[:, 0] >= 2) & (P[:, 1] >= 2) & (P[:, 0] < w-2) & (P[:, 1] < h-2)
    dd = dt[P[ok, 1].astype(int), P[ok, 0].astype(int)]/pxm
    cal = dict(rotDeg=round(math.degrees(q[2]), 2), within05=round(float((dd < .5).mean()), 2), note='רק גבול התוכנית מסומן בקו אדום בעמוד, ולכן רק חלק מצלעות המגרשים נבדקות')
    print('כיול:', cal)
    e0, n0 = model['e0'], model['n0']; toM = lambda x, y: tuple(float(v) for v in (SP.app(A, [[x, y]])[0] - [e0, n0]))
    # ── צינורות ──
    pm = (((H >= 110) & (H < 145) & (S > 35) & (S < 200) & (V > 120))*255).astype(np.uint8)
    thick = cv2.morphologyEx(pm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    thick = cv2.morphologyEx(thick, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    from skimage.morphology import skeletonize          # קו מרכז אחד לכל צינור, בלי כפילויות של שני צידי הקו העבה
    sk = (skeletonize(thick > 0)*255).astype(np.uint8)
    Lh = cv2.HoughLinesP(sk, 1, np.pi/720, int(1.5*pxm), minLineLength=int(2.5*pxm), maxLineGap=int(1.0*pxm))
    segs = []
    for x1, y1, x2, y2 in (Lh.reshape(-1, 4) if Lh is not None else []):
        p1, p2 = toM(x1, y1), toM(x2, y2)
        mid = ((p1[0]+p2[0])/2, (p1[1]+p2[1])/2)
        def onseg(c, s):    # נקודה על קטע קיים (עד 0.8 מ'): הקטע כפול
            (ax, ay), (bx, by) = s; vx, vy = bx-ax, by-ay; L2 = vx*vx+vy*vy or 1e-9; t_ = max(0, min(1, ((c[0]-ax)*vx+(c[1]-ay)*vy)/L2))
            return math.hypot(c[0]-ax-t_*vx, c[1]-ay-t_*vy) < .8
        if not any(onseg(mid, s) and onseg(p1, s) and onseg(p2, s) for s in segs): segs.append((p1, p2))
    # ── שוחות מהתוויות ──
    blocks = [b for b in page.get_text('dict')['blocks'] if b['type'] == 0]
    txt = lambda b: ' '.join(s['text'] for l in b['lines'] for s in l['spans'])
    labels = []
    for b in blocks:
        T = txt(b)
        if 'שוחה' not in T: continue
        x0, y0, x1, y1 = b['bbox']; near = [txt(c) for c in blocks if abs(c['bbox'][0]-x0) < 40 and 0 <= c['bbox'][1]-y0 < 60]
        allT = ' '.join([T] + near)
        g = lambda rx: (re.search(rx, allT) or [None, None])[1]
        labels.append(dict(id=g(r'\b(N\d+)\b'), tl=g(r'TL=([\d.]+)'), il=g(r'IL=([\d.]+)'), depth=g(r'H=([\d.]+)'), d=g(r'\bD(\d+)\b'), at=((x0+x1)/2*z, (y0+y1)/2*z)))
    ends = [p for s in segs for p in s]; mh = []
    for L in labels:
        lx, ly = toM(*L['at']); best = min(ends, key=lambda p: math.dist(p, (lx, ly))) if ends else None
        x, y = best if best and math.dist(best, (lx, ly)) < 12 else (lx, ly)
        mh.append([round(x, 2), round(y, 2), L['id'], float(L['tl']) if L['tl'] else None, float(L['il']) if L['il'] else None, L['d']])
    flat = lambda r: [round(v*10) for p in r for v in p]
    model['lines']['drain'] = [flat([s[0], s[1]]) for s in segs]; model['topic']['drain'] = 'water'
    model['obj']['manhole'] = mh; model['topic']['manhole'] = 'water'
    model.setdefault('sources', {})['drain'] = dict(page=a.page, cal=cal, pipes=len(segs), manholes=len(mh), note='ניקוז מי גשם מחוברת העיצוב. מיקום השוחה: קצה הצינור הקרוב לתווית (הערכה)')
    json.dump(model, open(os.path.join(out, 'model.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    print(f'צינורות {len(segs)} ({round(sum(math.dist(*s) for s in segs))} מ\'), שוחות {len(mh)}: {[m[2] for m in mh]}')
    if a.debug:
        ov = im.copy()
        for s in segs:
            pa = [tuple(int(v) for v in SP.app(SP.inv(A), [[p[0]+e0, p[1]+n0]])[0]) for p in s]; cv2.line(ov, pa[0], pa[1], (0, 0, 255), 6)
        for m_ in mh:
            pa = tuple(int(v) for v in SP.app(SP.inv(A), [[m_[0]+e0, m_[1]+n0]])[0]); cv2.circle(ov, pa, 18, (0, 160, 0), 5)
        cv2.imwrite(a.debug, cv2.resize(ov[700:3800, 1300:5200], (1300, 1033)))

if __name__ == '__main__': main()
