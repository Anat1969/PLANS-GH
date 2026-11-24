#!/usr/bin/env python3
"""מפלסים: פני הקרקע, רמפות לחניון ובדיקת נגישות (ענת, 24.11.2026: "חיבורים חשובים בתוכנית פיתוח הם הרמפות
שיורדות למרתף ועולות לקומת קרקע. גם מדרגות, שינוי מפלסים").

שימוש:  python3 tools/extract-levels.py --tik 1913 [--png <תמונת בדיקה>]
קלט:    layers/<תיק>/model.json (משטחי הרמפה, רומים ב-obj.spot, קומת הקרקע ב-foot)
        data/levels/<תיק>.json, אם יש (רומים שנקראו מהמצגת, מפלס 0.00 של כל בניין, שיפוע הרמפה, ומקור לכל ערך)
פלט:    layers/<תיק>/levels.json

1. רומים: מהמודל (obj.spot: ffl הוא מפלס הכניסה לבניין, spot / hp / lp הם רומי פיתוח) ומקובץ הנתונים.
2. פני הקרקע: רשת של 2 מ'. בתוך קומת הקרקע של בניין הגובה קבוע, לפי מפלס 0.00 שלו (כמה בניינים באותה קומת קרקע: לפי הקרוב).
   מחוץ לבניינים: ממוצע משוקלל לפי מרחק (IDW, חזקה 2) מהרומים ומשולי הבניינים. זו הערכה בין רומים, לא מדידה.
   הגבהים יחסיים ל"מפלס הייחוס" (datum, החציון של הרומים), כדי שהמעבר לרקע העירוני יהיה קטן.
3. רמפות לחניון: משטח הרמפה מהמודל. הפתח הוא הצלע הקצרה שקרובה לכביש. הרצפה יורדת מהפתח: 2 מ' ישר,
   3.5 מ' בחצי שיפוע, ואחר כך השיפוע המלא (15% אם אין נתון אחר). בסוף: פתח למרתף תחת תקרה.
   העומק בסוף הרמפה מחושב, ולכן הוא הערכה.
4. בדיקת נגישות: לכל בניין, ההפרש בין מפלס 0.00 לרום הרחוב הקרוב. מעל 2 ס"מ נדרש מעבר נגיש:
   רמפה בשיפוע 1:12 לכל היותר, ומשטח ביניים אחרי 9 מ' (ת"י 1918). כאן רק האורך הנדרש, כהנחיה.
"""
import os, sys, json, math, argparse
import numpy as np
from shapely.geometry import Polygon, Point, LineString, MultiPolygon
from shapely.ops import unary_union, nearest_points
import shapely

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = 2.0

def P(f): return Polygon([(f[i]/10, f[i+1]/10) for i in range(0, len(f), 2)]).buffer(0)
def dm(v): return int(round(v*10))
def ring_dm(p): return [dm(c) for xy in list(p.exterior.coords)[:-1] for c in xy]

def profile(s, slope):
    """ירידת הרצפה (מ') במרחק s מהפתח: 2 מ' ישר, 3.5 מ' בחצי שיפוע, ואז השיפוע המלא"""
    if s <= 2: return 0.0
    if s <= 5.5: return (s-2)*slope/2
    return 3.5*slope/2 + (s-5.5)*slope

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--tik', required=True); ap.add_argument('--png'); a = ap.parse_args()
    d = os.path.join(ROOT, 'layers', a.tik); m = json.load(open(os.path.join(d, 'model.json')))
    cf = os.path.join(ROOT, 'data', 'levels', a.tik + '.json'); conf = json.load(open(cf)) if os.path.exists(cf) else {}
    slope = conf.get('slope', 0.15)
    foot = [P(f) for f in m.get('foot', [])]
    road = unary_union([P(x[1]) for x in m['surf'].get('asphalt', [])] + [P(x[1]) for x in m['surf'].get('brt', [])]) if m['surf'].get('asphalt') else None

    # ── רמפות ──
    rr = unary_union([P(x[1]).buffer(0.06) for x in m['surf'].get('ramp', [])]).buffer(-0.06) if m['surf'].get('ramp') else Polygon()
    rr = sorted([g for g in getattr(rr, 'geoms', [rr]) if isinstance(g, Polygon) and g.area > 20], key=lambda g: g.area)
    ramps = []
    for i, g in enumerate(rr):
        g = g.buffer(0.4, join_style=2).buffer(-0.4, join_style=2).simplify(0.25)   # המילוי בשרטוט הוא מאות משולשים: מחליקים את השוליים, אחרת הקיר משונן
        mrr = list(g.minimum_rotated_rectangle.exterior.coords)[:4]
        sides = [(mrr[k], mrr[(k+1) % 4]) for k in range(4)]
        short = sorted(sides, key=lambda s: math.dist(*s))[:2]
        mid = lambda s: ((s[0][0]+s[1][0])/2, (s[0][1]+s[1][1])/2)
        # הפתח: הצלע הקצרה הקרובה לכביש. בלי כביש: הרחוקה מקומת הקרקע
        if road is not None and not road.is_empty: short.sort(key=lambda s: road.distance(Point(mid(s))))
        else: short.sort(key=lambda s: -min([f.distance(Point(mid(s))) for f in foot] or [0]))
        ent, far = short
        e0, e1 = mid(ent), mid(far); L = math.dist(e0, e1); ux, uy = (e1[0]-e0[0])/L, (e1[1]-e0[1])/L
        s_of = lambda x, y: max(0.0, min(L, (x-e0[0])*ux + (y-e0[1])*uy))
        # הרצפה: רצועות של מטר לאורך הציר, מפורקות למשולשים. לכל קודקוד המרחק מהפתח
        tris = []
        for k in range(int(math.ceil(L))):
            band = Polygon([(e0[0]+ux*k - uy*60, e0[1]+uy*k + ux*60), (e0[0]+ux*(k+1) - uy*60, e0[1]+uy*(k+1) + ux*60),
                            (e0[0]+ux*(k+1) + uy*60, e0[1]+uy*(k+1) - ux*60), (e0[0]+ux*k + uy*60, e0[1]+uy*k - ux*60)])
            piece = g.intersection(band)
            for q in getattr(piece, 'geoms', [piece]):
                if not isinstance(q, Polygon) or q.area < 0.01: continue
                for t in shapely.constrained_delaunay_triangles(q).geoms:
                    for x, y in list(t.exterior.coords)[:3]: tris += [dm(x), dm(y)]
        # הקירות: היקף הרמפה, בצפיפות של חצי מטר, בלי צלע הפתח
        entL = LineString(ent).buffer(0.4)
        wall = []
        c = list(g.exterior.coords)
        for p0, p1 in zip(c, c[1:]):
            n = max(1, int(math.dist(p0, p1)/0.5)); seg = []
            for j in range(n+1):
                x, y = p0[0]+(p1[0]-p0[0])*j/n, p0[1]+(p1[1]-p0[1])*j/n
                if entL.contains(Point(x, y)):
                    if len(seg) > 1: wall.append(seg)
                    seg = []; continue
                seg += [dm(x), dm(y)]
            if len(seg) > 3: wall.append(seg)
        depth = profile(L, slope)
                # התקרה: מהמקום שבו ציר הרמפה נכנס מתחת לקומת הקרקע, ולפחות 4 המטרים האחרונים (פתח המרתף)
        s_cover = L - 4.0
        for s in np.arange(2, L, 0.5):
            if any(f.buffer(-0.5).contains(Point(e0[0]+ux*s, e0[1]+uy*s)) for f in foot): s_cover = min(s_cover, s); break
        # תקרה רק איפה שיש מתחתיה גובה מעבר (2.4 מ'): לפני כן הרמפה פתוחה
        s_head = next((s for s in np.arange(0, L, 0.25) if profile(s, slope) >= 2.4), L)
        s_cover = min(max(s_cover, s_head), L - 4.0)
        under = any(f.buffer(0.5).intersects(Point(e1)) for f in foot)
        # שוליים סביב הרמפה בגובה הקרקע: רצועה של 2.2 מ' שסוגרת את המרווח בין הקיר לרשת פני הקרקע
        apron = g.buffer(2.2, join_style=2).difference(g); atris = []
        for q in getattr(apron, 'geoms', [apron]):
            if isinstance(q, Polygon) and q.area > 0.05:
                for t in shapely.constrained_delaunay_triangles(q).geoms:
                    for x, y in list(t.exterior.coords)[:3]: atris += [dm(x), dm(y)]
        far_seg = [dm(far[0][0]), dm(far[0][1]), dm(far[1][0]), dm(far[1][1])]
        half = Polygon([(e0[0]+ux*s_cover - uy*80, e0[1]+uy*s_cover + ux*80), (e0[0]+ux*(L+5) - uy*80, e0[1]+uy*(L+5) + ux*80),
                        (e0[0]+ux*(L+5) + uy*80, e0[1]+uy*(L+5) - ux*80), (e0[0]+ux*s_cover + uy*80, e0[1]+uy*s_cover - ux*80)])
        cov = g.intersection(half); ctris = []
        for q in getattr(cov, 'geoms', [cov]):
            if isinstance(q, Polygon) and q.area > 0.05:
                for t in shapely.constrained_delaunay_triangles(q).geoms:
                    for x, y in list(t.exterior.coords)[:3]: ctris += [dm(x), dm(y)]
        ramps.append({'i': i, 'area': round(g.area), 'len': round(L, 1), 'slope': slope, 'depth': round(depth, 2), 'cover': round(s_cover, 1), 'under': under,
                      'poly': ring_dm(g), 'e0': [dm(e0[0]), dm(e0[1])], 'u': [round(ux, 4), round(uy, 4)], 'ent': [dm(ent[0][0]), dm(ent[0][1]), dm(ent[1][0]), dm(ent[1][1])],
                      'far': far_seg, 'tris': tris, 'cover_tris': ctris, 'apron': atris, 'wall': wall, 'src': conf.get('slopeSrc', 'שיפוע 15%: הנחה')})
        print(f'רמפה {i}: {g.area:.0f} מ"ר, אורך {L:.1f} מ\', עומק בסוף {depth:.1f} מ\' (הערכה), תקרה מ-{s_cover:.1f} מ\'')

    # ── רומים ──
    spots = []
    for s in (m.get('obj', {}).get('spot') or []):
        spots.append({'at': [s[0], s[1]], 'z': s[2], 'kind': 'ffl' if s[3] == 'ffl' else ('street' if s[3] == 'street' else 'spot'), 'src': 'תוכנית ההעמדה (model.json)'})
    for f in conf.get('ffl', []): spots.append({'at': f['at'], 'z': f['z'], 'kind': 'ffl', 'name': f.get('name'), 'src': f['src']})
    for s in conf.get('spots', []):
        at = s.get('at')
        if at is None and 'rampEntry' in s:
            r = ramps[s['rampEntry']]; e = r['ent']; k = s.get('side', 0); x, y = e[2*k]/10, e[2*k+1]/10
            at = [round(x - r['u'][0]*1.5, 2), round(y - r['u'][1]*1.5, 2)]
        if at is None and 'rampEnd' in s:
            r = ramps[s['rampEnd']]; f = r['far']; x, y = (f[0]+f[2])/20, (f[1]+f[3])/20; b = s.get('beyond', 3)
            at = [round(x + r['u'][0]*b, 2), round(y + r['u'][1]*b, 2)]
        spots.append({'at': at, 'z': s['z'], 'kind': s.get('kind', 'spot'), 'src': s['src']})
    if not spots:
        print('אין רומים: פני קרקע שטוחים, רק הרמפות'); datum = 0.0
    else:
        datum = float(np.median([s['z'] for s in spots]))

    # ── אזורי בניין: כל קומת קרקע במפלס 0.00 של הבניין שבתוכה. כמה בניינים באותה קומת קרקע: לפי הקרוב ──
    ffl = [s for s in spots if s['kind'] == 'ffl']
    zones = []
    for f in foot:
        mine = [s for s in ffl if f.buffer(3).contains(Point(s['at']))]
        if not mine: continue
        if len(mine) == 1: zones.append((f, mine[0]['z'])); continue
        # חלוקה לפי הקרוב (וורונוי בתוך קומת הקרקע)
        from shapely.ops import voronoi_diagram
        from shapely.geometry import MultiPoint
        vor = voronoi_diagram(MultiPoint([s['at'] for s in mine]), envelope=f.buffer(50))
        for cell in vor.geoms:
            s = min(mine, key=lambda s: cell.distance(Point(s['at'])))
            part = f.intersection(cell)
            if not part.is_empty: zones.append((part, s['z']))

    # ── רשת פני הקרקע ──
    x0, y0, x1, y1 = m['bbox']; x0 -= 20; y0 -= 20; x1 += 20; y1 += 20
    nx, ny = int(math.ceil((x1-x0)/RES))+1, int(math.ceil((y1-y0)/RES))+1
    gx, gy = np.meshgrid(x0 + np.arange(nx)*RES, y0 + np.arange(ny)*RES)
    H = np.zeros_like(gx)
    if spots:
        pts = [(s['at'][0], s['at'][1], s['z']) for s in spots if s['kind'] != 'ffl']
        for zp, z in zones:                                   # שולי הבניין משתתפים בממוצע, כדי שהקרקע תגיע אליו בגובה שלו
            for geom in getattr(zp, 'geoms', [zp]):
                if isinstance(geom, Polygon):
                    b = geom.exterior
                    for t in np.arange(0, b.length, 4.0): q = b.interpolate(t); pts.append((q.x, q.y, z))
        if not pts: pts = [(s['at'][0], s['at'][1], s['z']) for s in spots]
        A = np.array(pts)
        d2 = (gx[..., None]-A[:, 0])**2 + (gy[..., None]-A[:, 1])**2 + 1.0
        w = 1/d2; H = (w*A[:, 2]).sum(-1)/w.sum(-1) - datum
        from shapely import vectorized
        for zp, z in zones: H[vectorized.contains(zp.buffer(0.6), gx, gy)] = z - datum
    # ── מדרגות בפיתוח: קווי שלח (שכבת המדרגות) מחוץ לבניינים, מקובצים לגרם. כל גרם: מלבן, מספר שלחים, וכיוון העלייה לפי פני הקרקע ──
    from shapely.geometry import LineString as LS
    tread = [LS([(f[i]/10, f[i+1]/10) for i in range(0, len(f), 2)]) for f in m['lines'].get('stairs', [])]
    fu = unary_union(foot) if foot else Polygon()
    inside = [l for l in tread if fu.buffer(0.3).contains(l)]; outside = [l for l in tread if not fu.buffer(0.3).contains(l)]
    flights = []
    U = unary_union([l.buffer(0.45) for l in outside]) if outside else Polygon()
    for cl in getattr(U, 'geoms', [U]):
        mine = [l for l in outside if cl.contains(l.centroid)]
        if len(mine) < 3: continue
        ang = [math.atan2(l.coords[-1][1]-l.coords[0][1], l.coords[-1][0]-l.coords[0][0]) % math.pi for l in mine]
        a0 = float(np.median(ang)); tx, ty = math.cos(a0), math.sin(a0); rx, ry = -ty, tx          # t: לאורך השלח, r: כיוון הגרם
        pts = np.array([c for l in mine for c in l.coords]); pr = pts @ [rx, ry]; pt = pts @ [tx, ty]
        n = len({round(v, 1) for v in [np.mean(np.array(l.coords) @ [rx, ry]) for l in mine]})
        r0, r1, t0, t1 = pr.min(), pr.max(), pt.min(), pt.max()
        c = lambda r, t: (rx*r + tx*t, ry*r + ty*t)
        rect = Polygon([c(r0, t0), c(r1, t0), c(r1, t1), c(r0, t1)])
        p0, p1 = c(r0, (t0+t1)/2), c(r1, (t0+t1)/2)
        flights.append({'poly': ring_dm(rect), 'n': n, 'a': [dm(p0[0]), dm(p0[1])], 'b': [dm(p1[0]), dm(p1[1])], 'w': round(t1-t0, 2)})
    has_stairs = 'stairs' in m['lines']
    print(f'מדרגות: {len(tread)} קווים, {len(inside)} בתוך הבניינים (חדרי מדרגות), גרמים בפיתוח: {len(flights)}')

    # ── בדיקת נגישות ──
    checks = []
    street = [s for s in spots if s['kind'] == 'street'] or [s for s in spots if s['kind'] != 'ffl']
    for s in ffl:
        if not street: break
        n = min(street, key=lambda q: math.dist(q['at'], s['at'])); dz = s['z'] - n['z']
        if abs(dz) < 0.02 or math.dist(n['at'], s['at']) > 60: continue          # רום רחוק מ-60 מ' אינו הרחוב של הכניסה
        ln = abs(dz)*12; land = int(ln // 9)
        fz = [z for z in zones if z[0].buffer(3).contains(Point(s['at']))]
        door = nearest_points(fz[0][0], Point(n['at']))[0] if fz else Point(s['at'])
        link = any(Point(f['a'][0]/10, f['a'][1]/10).distance(door) < 15 for f in flights)
        checks.append({'name': s.get('name') or 'כניסה', 'ffl': s['z'], 'at': [round(door.x, 2), round(door.y, 2)], 'link': link, 'street': n['z'], 'dz': round(dz, 2), 'dist': round(math.dist(n['at'], s['at']), 1),
                       'ramp': round(ln, 1), 'landings': land, 'steps': int(math.ceil(abs(dz)/0.16)),
                       'text': f"{s.get('name') or 'כניסה ברום ' + format(s['z'], '.2f')}: {'מעל' if dz > 0 else 'מתחת'} לרום {n['z']:.2f} הקרוב ב-{abs(dz):.2f} מ'. מעבר נגיש: רמפה של {ln:.1f} מ' לפחות (1:12)" + (f", עם {land} משטחי ביניים" if land else '') + f", או {int(math.ceil(abs(dz)/0.16))} מדרגות ומעלון." + ('' if link else (' בתוכנית הפיתוח אין מדרגות או רמפה בפיתוח ליד הכניסה.' if has_stairs else ' ' + conf.get('noStairsNote', 'מדרגות ורמפות בפיתוח לא זוהו, כי המודל נבנה מתמונה. לבדוק בתוכנית.')))})
    res = {'tik': a.tik, 'datum': round(datum, 2), 'res': RES, 'x0': round(x0, 2), 'y0': round(y0, 2), 'nx': nx, 'ny': ny,
           'h': [int(round(v*100)) for v in H.ravel()], 'spots': spots, 'ramps': ramps,
           'zones': [{'z': z, 'poly': ring_dm(p if isinstance(p, Polygon) else max(p.geoms, key=lambda q: q.area))} for p, z in zones if not p.is_empty],
           'checks': checks, 'notes': conf.get('notes', []), 'flights': flights, 'stairsIndoor': len(inside), 'src': conf.get('src', 'רומים מתוכנית ההעמדה'),
           'assume': 'פני הקרקע בין הרומים: ממוצע משוקלל לפי מרחק (הערכה). עומק הרמפה: לפי השיפוע והאורך (הערכה). קומת הקרקע של כל בניין במפלס 0.00 שלו.'}
    json.dump(res, open(os.path.join(d, 'levels.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'מפלס ייחוס {datum:.2f}, טווח {H.min():+.2f} עד {H.max():+.2f} מ\', רומים {len(spots)}, אזורי בניין {len(zones)}, בדיקות {len(checks)}')
    for c in checks: print(' ', c['text'])
    print('נכתב', os.path.join(d, 'levels.json'), round(os.path.getsize(os.path.join(d, 'levels.json'))/1024), 'KB')
    if a.png:
        try: import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        except ImportError: print('אין matplotlib: בלי תמונת בדיקה'); return
        fig = plt.figure(figsize=(10, 12)); ax = fig.gca(); ax.set_aspect('equal')
        im = ax.imshow(H + datum, origin='lower', extent=(x0, x0+(nx-1)*RES, y0, y0+(ny-1)*RES), cmap='terrain'); plt.colorbar(im)
        for f in foot: ax.plot(*f.exterior.xy, 'k-', lw=.8)
        for r in ramps: q = P(r['poly']); ax.fill(*q.exterior.xy, color='r', alpha=.6)
        for s in spots: ax.plot(*s['at'], 'o', color='k' if s['kind'] == 'ffl' else 'b'); ax.text(s['at'][0], s['at'][1], f"{s['z']:.2f}", fontsize=7)
        fig.savefig(a.png, dpi=70, bbox_inches='tight')

if __name__ == '__main__': main()
