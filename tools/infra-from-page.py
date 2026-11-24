#!/usr/bin/env python3
"""תשתיות מעמוד בחוברת העיצוב (ענת, 24.11.2026: נאות ספיר). העמוד: תמונה של התוכנית ב-1:500, ומעליה תוויות וקטוריות.

שימוש: python3 tools/infra-from-page.py <booklet.pdf> --tik 1887 --spec data/infra/1887.json [--debug <dir>]
הפרופיל (data/infra/<תיק>.json): לכל עמוד, נקודות פתיחה לעיגון (מרכזי מגרשים בפיקסלים ב-216 DPI), ומה לחלץ:
  pipes:  סוג → טווח צבע (HSV). קו מרכז (שלד) וקטעים ישרים (Hough). הקו הדק באותו צבע (קו מרתף, טקסט) נופל בפתיחה.
  labels: סוג → ביטוי על טקסט התווית. נקודה: קצה הצינור הקרוב (עד 12 מ'), אחרת התווית עצמה. מהשוחות נקראים N, TL, IL, D.
עיגון: קנה המידה ידוע מהעמוד. סיבוב והזזה: מנקודות הפתיחה, ואז כיול של קו המגרש האדום מול צלעות התב"ע.
הכול נכנס ל-model.json של התוכנית, ומה שלא היה במודל קודם מוחלף (לפי סוג).
"""
import sys, os, re, json, math, argparse, importlib.util
import numpy as np, cv2
import pymupdf as fitz
from scipy.optimize import minimize
from skimage.morphology import skeletonize

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_s = importlib.util.spec_from_file_location('sp', os.path.join(ROOT, 'tools/siteplan-model.py')); SP = importlib.util.module_from_spec(_s); _s.loader.exec_module(SP)

def hsvmask(H, S, V, r):
    h0, h1, s0, s1, v0, v1 = r
    hm = ((H >= h0) & (H <= h1)) if h0 <= h1 else ((H >= h0) | (H <= h1))
    return ((hm & (S >= s0) & (S <= s1) & (V >= v0) & (V <= v1))*255).astype(np.uint8)

def page_job(doc, pg, model, rn, dpi=216, scale=500, debug=None):
    page = doc[pg['page']-1]; z = dpi/72
    pix = page.get_pixmap(dpi=dpi); im = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, :3][:, :, ::-1].copy(); h, w = im.shape[:2]
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); H, S, V = [hsv[..., i].astype(int) for i in range(3)]
    pxm = dpi/0.0254/scale; ls = math.log(1/pxm)
    cen = {}
    for pc in rn['parcels']:
        R = np.array([SP.wgs2itm(q[1], q[0]) for q in pc['c']]); cen.setdefault(pc['lot'], []).append((R.mean(0), SP.area(R)))
    cen = {k: max(v, key=lambda x: x[1])[0] for k, v in cen.items()}
    G = [(int(g.split(':')[0]), tuple(map(float, g.split(':')[1].split(',')))) for g in pg['gcp'].split()]
    src = np.array([xy for _, xy in G])*[1, -1]/pxm; dst = np.array([cen[l] for l, _ in G])
    ma, md = src.mean(0), dst.mean(0); U, Sg, Vt = np.linalg.svd((dst-md).T @ (src-ma)); Rm = U @ Vt
    if np.linalg.det(Rm) < 0: Rm = U @ np.diag([1, -1]) @ Vt
    t = md - Rm @ ma; q = [t[0], t[1], math.atan2(Rm[1, 0], Rm[0, 0])]
    red = hsvmask(H, S, V, (172, 8, 150, 255, 150, 255)); dt = cv2.distanceTransform(255-red, cv2.DIST_L2, 5); E = SP.edges(rn['parcels'])
    def cost(v, trim):
        P = SP.app(SP.inv(SP.sim([v[0], v[1], v[2], ls])), E); ok = (P[:, 0] >= 2) & (P[:, 1] >= 2) & (P[:, 0] < w-2) & (P[:, 1] < h-2)
        return 99 if ok.mean() < .3 else np.minimum(dt[P[ok, 1].astype(int), P[ok, 0].astype(int)]/pxm, trim).mean()
    for trim in (8, 4, 2, 1):
        q = list(minimize(lambda v: cost(v, trim), q, method='Nelder-Mead', options=dict(xatol=1e-3, fatol=1e-5, maxiter=3000,
              initial_simplex=[q, [q[0]+2, q[1], q[2]], [q[0], q[1]+2, q[2]], [q[0], q[1], q[2]+.01]])).x)
    A = SP.sim([q[0], q[1], q[2], ls]); P = SP.app(SP.inv(A), E); ok = (P[:, 0] >= 2) & (P[:, 1] >= 2) & (P[:, 0] < w-2) & (P[:, 1] < h-2)
    dd = dt[P[ok, 1].astype(int), P[ok, 0].astype(int)]/pxm
    cal = dict(page=pg['page'], rotDeg=round(math.degrees(q[2]), 2), within05=round(float((dd < .5).mean()), 2), note='רק גבול התוכנית מסומן בקו אדום בעמוד, ולכן רק חלק מצלעות המגרשים נבדקות')
    print(f"עמ' {pg['page']} כיול:", cal)
    e0, n0 = model['e0'], model['n0']; toM = lambda x, y: tuple(float(v) for v in (SP.app(A, [[x, y]])[0] - [e0, n0]))
    out = dict(lines={}, obj={}, cal=cal)
    def onseg(c, s):
        (ax, ay), (bx, by) = s; vx, vy = bx-ax, by-ay; L2 = vx*vx+vy*vy or 1e-9; t_ = max(0, min(1, ((c[0]-ax)*vx+(c[1]-ay)*vy)/L2))
        return math.hypot(c[0]-ax-t_*vx, c[1]-ay-t_*vy) < .8
    allEnds = []
    for kind, r in (pg.get('pipes') or {}).items():
        m = hsvmask(H, S, V, r)
        ko = pg.get('open', 5); thick = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ko, ko))) if ko > 1 else m
        thick = cv2.morphologyEx(thick, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        sk = (skeletonize(thick > 0)*255).astype(np.uint8)
        Lh = cv2.HoughLinesP(sk, 1, np.pi/720, int(1.5*pxm), minLineLength=int(2.5*pxm), maxLineGap=int(1.0*pxm)); segs = []
        for x1, y1, x2, y2 in (Lh.reshape(-1, 4) if Lh is not None else []):
            p1, p2 = toM(x1, y1), toM(x2, y2); mid = ((p1[0]+p2[0])/2, (p1[1]+p2[1])/2)
            if not any(onseg(mid, s) and onseg(p1, s) and onseg(p2, s) for s in segs): segs.append((p1, p2))
        out['lines'][kind] = [[round(v*10) for p in s for v in p] for s in segs]; allEnds += [p for s in segs for p in s]
        print(f"  {kind}: {len(segs)} קטעים, {round(sum(math.dist(*s) for s in segs))} מ'")
        if debug:
            ov = im.copy(); ov[thick > 0] = (0, 0, 255); cv2.imwrite(os.path.join(debug, f"p{pg['page']}_{kind}.jpg"), cv2.resize(ov, (w//4, h//4)))
    blocks = [b for b in page.get_text('dict')['blocks'] if b['type'] == 0]
    txt = lambda b: ' '.join(s['text'] for l in b['lines'] for s in l['spans'])
    for kind, rx in (pg.get('labels') or {}).items():
        pts = []
        for b in blocks:
            T = txt(b)
            if not re.search(rx, T): continue
            x0, y0, x1, y1 = b['bbox']; near = [txt(c) for c in blocks if abs(c['bbox'][0]-x0) < 40 and 0 <= c['bbox'][1]-y0 < 60]; allT = ' '.join([T] + near)
            g = lambda r_: (re.search(r_, allT) or [None, None])[1]
            lx, ly = toM((x0+x1)/2*z, (y0+y1)/2*z); best = min(allEnds, key=lambda p: math.dist(p, (lx, ly))) if allEnds else None
            x, y = best if best and math.dist(best, (lx, ly)) < 12 else (lx, ly)
            if any(math.dist((x, y), q[:2]) < 1.0 for q in pts): continue
            pts.append([round(x, 2), round(y, 2), g(r'\b(N\d+)\b'), float(g(r'TL=([\d.]+)')) if g(r'TL=([\d.]+)') else None, float(g(r'IL=([\d.]+)')) if g(r'IL=([\d.]+)') else None, g(r'\bD(\d+)\b')])
        out['obj'][kind] = pts; print(f'  {kind}: {len(pts)} נקודות')
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('pdf'); ap.add_argument('--tik', required=True); ap.add_argument('--spec', required=True); ap.add_argument('--debug')
    a = ap.parse_args(); out = os.path.join(ROOT, 'layers', a.tik); spec = json.load(open(a.spec, encoding='utf8'))
    model = json.load(open(os.path.join(out, 'model.json'), encoding='utf8')); rn = json.load(open(os.path.join(out, 'renewal.json'), encoding='utf8'))
    doc = fitz.open(a.pdf); src = model.setdefault('sources', {}); topic = spec.get('topic', {})
    for pg in spec['pages']:
        r = page_job(doc, pg, model, rn, debug=a.debug)
        for k, v in r['lines'].items(): model['lines'][k] = v; model['topic'][k] = topic.get(k, 'water')
        for k, v in r['obj'].items():   # נקודה שכבר יש במודל (למשל הידרנט ממפת המדידה) לא נכפלת: מוסיפים רק מה שרחוק ממנה יותר מ-2 מ'
            old = [] if k in spec.get('replace', []) else [o for o in model['obj'].get(k, []) if not (isinstance(o, list) and len(o) > 2 and o[2] == 'page')]
            new = [q[:2] + ['page'] + q[3:] if k == 'hydrant' else q for q in v if all(math.hypot(q[0]-o[0], q[1]-o[1]) > 2 for o in old)]
            model['obj'][k] = old + new; model['topic'][k] = topic.get(k, 'water')
        src[f"page{pg['page']}"] = dict(cal=r['cal'], kinds=sorted(list(r['lines']) + list(r['obj'])), title=pg.get('title', ''))
    json.dump(model, open(os.path.join(out, 'model.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__': main()
