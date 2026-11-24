#!/usr/bin/env python3
"""קומות וחזיתות (floors.json) כשאין תוכניות קומה של האדריכל כקובץ שרטוט (ענת, 24.11.2026: נאות ספיר).

1913 קיבל floors.json מתוכניות הקומה ב-DWG (extract-floors.py), ו-1909 מנספח הבינוי. כאן הבסיס הוא חלקי הבניין שכבר במודל
(model.parts: מגדל, אגף, בניין מרקמי וציבור, מתוכנית הקומה הטיפוסית במצגת), והגבהים מהחתכים (data/siteplan/<תיק>.json, sections).
 - גרעין: פירי המעליות מהשרטוט הווקטורי (שכבת h-pir), בתוך כל חלק בניין. בלי פיר: מלבן במרכז (הנחה).
 - פתחים: לכל חזית, חלון בכל מפתח של 3.6 מ' (הנחה, עד שיגיעו חזיתות מהאדריכל). קומה טכנית: בלי פתחים.
 - הכול מסומן ב-assume. בדיקה: node tools/check-layers.js (כל בניין בתוך המגרש, לא מעל הגובה בתב"ע).
שימוש: python3 tools/floors-from-parts.py --tik 1887 --spec data/siteplan/1887.json [--pdf 4215-J-1.pdf --core-layer 'level karka-TDM\\|h-pir$']
"""
import os, json, math, argparse, re, datetime
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def ring(c): return np.array(c, float).reshape(-1, 2)/10
def area(P): return 0.5*abs(np.dot(P[:, 0], np.roll(P[:, 1], 1)) - np.dot(P[:, 1], np.roll(P[:, 0], 1)))
def inside(pt, P):
    x, y = pt; c = False
    for i in range(len(P)):
        a, b = P[i], P[i-1]
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1]) + a[0]: c = not c
    return c
D = lambda P: [int(round(v*10)) for q in P for v in q]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--tik', required=True); ap.add_argument('--spec', required=True)
    ap.add_argument('--pdf'); ap.add_argument('--core-layer', default=r'level karka-TDM\|h-pir$')
    a = ap.parse_args(); out = os.path.join(ROOT, 'layers', a.tik)
    model = json.load(open(os.path.join(out, 'model.json'), encoding='utf8')); spec = json.load(open(a.spec, encoding='utf8'))
    rn = json.load(open(os.path.join(out, 'renewal.json'), encoding='utf8'))
    fh = spec['floorHeights']; g0, rh = fh.get('ground', 4.5), fh.get('res', 3.15); sec = spec.get('sections', {})
    shafts = []
    if a.pdf and model.get('vector', {}).get('xf'):
        import pymupdf as fitz
        th, tx, ty, K = model['vector']['xf']; e0, n0 = model['e0'], model['n0']; c_, s_ = math.cos(th), math.sin(th)
        T = lambda x, y: (c_*x*K + s_*y*K + tx - e0, s_*x*K - c_*y*K + ty - n0)
        for d in fitz.open(a.pdf)[0].get_drawings():
            if not re.search(a.core_layer, d.get('layer') or '') or not d.get('fill'): continue
            r = d['rect']
            if max(r.width, r.height)*K > 6: continue
            shafts.append([T(r.x0, r.y0), T(r.x1, r.y0), T(r.x1, r.y1), T(r.x0, r.y1)])
        print('פירים מהשרטוט:', len(shafts))
    plans, buildings = {}, []
    bspec = {b['id']: b for b in spec['buildings']}
    for i, p in enumerate(model.get('parts', [])):
        P = ring(p['c']); b = bspec.get(p['id'], {}); pid = f"{p['id']}{i}"
        # גרעין: הפירים שבתוך החלק, המעטפת הקמורה שלהם. בלי פיר: מלבן 7 על 9 מ' במרכז (הנחה)
        S_ = [np.array(s) for s in shafts if inside(np.mean(s, 0), P)]
        if S_:
            Q = np.vstack(S_); cx, cy = Q.mean(0); w_, h_ = max(4, np.ptp(Q[:, 0]) + 1), max(4, np.ptp(Q[:, 1]) + 1); coreSrc = f'{len(S_)} פירים מהשרטוט'
        else: cx, cy = P.mean(0); w_, h_ = 7, 9; coreSrc = 'הנחה'
        core = [[cx-w_/2, cy-h_/2], [cx+w_/2, cy-h_/2], [cx+w_/2, cy+h_/2], [cx-w_/2, cy+h_/2]]
        # פתחים: חלון של 1.8 מ' בכל מפתח של 3.6 מ' לאורך כל צלע (הנחה)
        opens = []
        for k in range(len(P)):
            a_, b_ = P[k], P[(k+1) % len(P)]; L = float(np.hypot(*(b_-a_)))
            n = int(L // 3.6)
            for j in range(n):
                t0, t1 = (j*3.6 + .9)/L, (j*3.6 + 2.7)/L
                opens.append(D([a_ + (b_-a_)*t0, a_ + (b_-a_)*t1]))
        # קירות לחתך: רצועה של 0.3 מ' לאורך כל צלע
        cen = P.mean(0); walls = []
        for k in range(len(P)):
            a_, b_ = P[k], P[(k+1) % len(P)]; ia, ib = a_ + (cen-a_)/max(np.hypot(*(cen-a_)), 1e-6)*.3, b_ + (cen-b_)/max(np.hypot(*(cen-b_)), 1e-6)*.3
            walls.append(D([a_, b_, ib, ia]))
        plans[pid] = dict(name=f"בניין {p['id']}: {dict(tower='מגדל', wing='אגף', mid='בניין מרקמי', public='מבנה ציבור')[p['kind']]}", src='parts',
                          area=int(area(P)), env=D(P), open=opens, rail=[], balc=[], walls=walls)
        plans[pid + 'R'] = dict(name=f"בניין {p['id']}: גג", src='parts', area=int(area(P)), env=D(P), open=[], rail=[], balc=[], walls=walls, core=[D(core)], coreSrc=coreSrc)
        # הקומות: קרקע מהשרטוט (קירות קומת הקרקע), ומעליה קומות מגורים. קומה טכנית לפי החתך
        use = 'public' if p['kind'] == 'public' else 'res'; h1 = fh.get('public', 3.6) if use == 'public' else rh
        top = p['top']; n = max(1, int(round((top - g0)/h1)))
        techAt = None
        if p['kind'] == 'tower' and p.get('techFloors'):
            m_ = re.search(r'בין (\d+) ל-(\d+)', str((sec.get(p['id']) or sec.get('A') or {}).get('techFloor', '')))
            techAt = int(m_.group(1)) + 1 if m_ else None
        floors = []
        for k in range(n):
            y = g0 + k*h1
            if y + h1 > top + .5: break
            fl = dict(n=k+1, plan=pid, use=use, y=round(y, 2), h=round(h1, 2))
            if techAt and k+1 == techAt: fl.update(use='work', bare=True, tech=True)
            floors.append(fl)
        lot = p['lot']; L5 = next((l for l in rn['lots'] if l['lot'] == lot), {})
        buildings.append(dict(id=pid, lot=lot, label=f"בניין {p['id']} · {len(floors)+1} קומות", src=p.get('src', ''), floors=floors,
                              top=round(floors[-1]['y'] + floors[-1]['h'], 2) if floors else g0, roof=dict(plan=pid + 'R', y=round(floors[-1]['y'] + floors[-1]['h'], 2) if floors else g0, h=3.0),
                              total=len(floors)+1, fit=dict(method='חלקי הבניין מתוכנית הקומה הטיפוסית במצגת, מעוגנת לתב"ע', lot=lot)))
    fd = dict(tik=a.tik, source='חלקי הבניין במודל (תוכנית הקומה הטיפוסית במצגת), גבהים מהחתכים בחוברת העיצוב, גרעינים מהשרטוט 4215-J-1', made=datetime.date.today().isoformat(),
              assume=dict(heights=dict(ground=g0, res=rh, public=fh.get('public', 3.6)), sections=fh.get('note', ''),
                          window="חלון של 1.8 מ' בכל מפתח של 3.6 מ' לאורך כל חזית: הנחה, עד שיגיעו חזיתות", balc='מרפסות: אין עדיין תוכנית מרפסות כשרטוט, ולכן לא מוצגות',
                          core='הגרעין: המעטפת של פירי המעליות שבשרטוט. בלי פיר: מלבן במרכז (הנחה)', tech='קומה טכנית: לפי החתך, בלי פתחים'),
              buildings=buildings, plans=plans)
    json.dump(fd, open(os.path.join(out, 'floors.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    print('בניינים:', [(b['id'], b['total'], b['top']) for b in buildings])

if __name__ == '__main__': main()
