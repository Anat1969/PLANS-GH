#!/usr/bin/env python3
"""מסלולי הליכה בגובה העיניים (ענת, 24.11.2026: "ללכת במסלולים מובנים במדרכות מסביב ובתוך המתחם, להיכנס למבנים
ולגנים, בלי לאבד אוריינטציה, בלי שיהיה קשה לנווט עם העכבר").

שימוש:  python3 tools/extract-walk.py --tik 1913 [--png <תמונת בדיקה>]
קלט:    layers/<תיק>/model.json (משטחים וקווים), layers/<תיק>/floors.json אם יש (שמות הבניינים)
פלט:    layers/<תיק>/walk.json

1. השטח שאפשר ללכת בו (רשת של חצי מטר): ריצוף, דק, משטח משחק, רחבות, שביל אופניים, גינון ומעברי חצייה,
   ובתוך קומת הקרקע של הבניינים: כל מה שאינו קיר. קירות, קירות פיתוח, גדרות, זיגוג, רמפות וכביש חוסמים.
   הכניסה לבניין היא דרך פתח בקיר (דלת), כמו בשרטוט.
2. רשת השבילים: שלד של השטח (skeletonize), אחרי כרסום של 35 ס"מ מהקצוות. צמתים: קצה, פיצול וחיבור.
   ענפים קצרים מ-2.5 מ' נחתכים. כל קטע מפושט לקו של 30 ס"מ.
3. אזורים עם שם, ל"איפה אני": בניין (לפי floors.json), גינה, רחבה.
"""
import os, json, math, argparse
import numpy as np
from shapely.geometry import Polygon, LineString, Point, MultiPolygon, box
from shapely.ops import unary_union
from shapely import vectorized

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = 0.5
WALK = ('paving', 'deck', 'play', 'plaza', 'bike', 'green')       # משטחים שאפשר ללכת עליהם
BLOCK_LINES = {'lowwall': .25, 'fence': .2, 'glass': .2}            # קווים שחוסמים, ועובי החסימה

def P(f): return Polygon([(f[i]/10, f[i+1]/10) for i in range(0, len(f), 2)]).buffer(0)
def Ls(f): return LineString([(f[i]/10, f[i+1]/10) for i in range(0, len(f), 2)])
def dm(v): return int(round(v*10))

def rle(bits):
    out, cur, n = [], 0, 0
    for b in bits:
        if b == cur: n += 1
        else: out.append(n); cur, n = b, 1
    out.append(n); return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--tik', required=True); ap.add_argument('--png'); a = ap.parse_args()
    d = os.path.join(ROOT, 'layers', a.tik); m = json.load(open(os.path.join(d, 'model.json')))
    fp = os.path.join(d, 'floors.json'); fl = json.load(open(fp)) if os.path.exists(fp) else None
    S, L = m['surf'], m['lines']
    foot = [P(f) for f in m.get('foot', [])]
    walk = unary_union([P(x[1]).buffer(0.08) for k in WALK for x in S.get(k, [])])
    # מעברי חצייה: הקווים של מעבר החצייה מגדירים רצועה. המלבן החוסם של כל קבוצה
    cr = [Ls(f) for f in L.get('cross', [])]
    if cr:
        cu = unary_union([l.buffer(1.2) for l in cr])
        walk = walk.union(unary_union([g.minimum_rotated_rectangle for g in getattr(cu, 'geoms', [cu]) if g.area > 4]))
    walls = unary_union([P(x[1]) for x in S.get('wall', [])]) if S.get('wall') else Polygon()
    inside = unary_union(foot).difference(walls.buffer(0.12)) if foot else Polygon()
    walk = walk.difference(unary_union(foot).buffer(-0.05)) if foot else walk          # המעטפת של הבניין שייכת לבניין, לא לריצוף
    walk = walk.union(inside)
    block = [walls.buffer(0.1)]
    for k, w in BLOCK_LINES.items():
        for f in L.get(k, []): block.append(Ls(f).buffer(w))
    block += [P(x[1]).buffer(0.2) for x in S.get('ramp', [])]
    for k in ('treeNew', 'treeOld', 'exTree', 'lamp'):                  # גזעי עצים ועמודי תאורה: עוקפים אותם, לא עוברים דרכם
        block += [Point(t[0], t[1]).buffer(0.75 if k != 'lamp' else 0.4) for t in (m.get('obj', {}).get(k) or [])]
    walk = walk.difference(unary_union(block))
    # הרשת
    x0, y0, x1, y1 = walk.bounds; x0 -= 2; y0 -= 2
    nx, ny = int((x1-x0)/RES)+3, int((y1-y0)/RES)+3
    gx, gy = np.meshgrid(x0 + (np.arange(nx)+.5)*RES, y0 + (np.arange(ny)+.5)*RES)
    mask = vectorized.contains(walk, gx, gy)
    from skimage.morphology import skeletonize, binary_erosion, binary_opening, remove_small_objects, disk
    mask = binary_opening(mask, disk(1))                   # רצועה צרה מ-1.5 מ' היא לא מעבר
    mask = remove_small_objects(mask, 60)                   # איים קטנים מ-15 מ"ר נמחקים
    core = binary_erosion(mask, disk(1))
    sk = skeletonize(core)
    # ── גרף מהשלד ──
    ys, xs = np.nonzero(sk); on = set(zip(ys.tolist(), xs.tolist()))
    nb = lambda p: [(p[0]+dy, p[1]+dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (p[0]+dy, p[1]+dx) in on]
    deg = {p: len(nb(p)) for p in on}
    nodes = {p for p in on if deg[p] != 2}
    # צמתים צמודים מתמזגים לאחד
    seen, rep = set(), {}
    for p in nodes:
        if p in seen: continue
        grp, st = [], [p]
        while st:
            q = st.pop()
            if q in seen: continue
            seen.add(q); grp.append(q); st += [r for r in nb(q) if r in nodes and r not in seen]
        c = grp[0]
        for q in grp: rep[q] = c
    edges, used = [], set()
    for p in nodes:
        for q in nb(p):
            if q in nodes and rep.get(q) == rep[p]: continue
            if (p, q) in used: continue
            path = [p, q]; prev, cur = p, q
            while cur not in nodes:
                nxt = [r for r in nb(cur) if r != prev and r not in path[-3:]]
                if not nxt: break
                prev, cur = cur, nxt[0]; path.append(cur)
            used.add((p, path[1])); used.add((cur, path[-2]))
            if cur not in nodes: continue
            a_, b_ = rep[p], rep[cur]
            edges.append((a_, b_, path))
    # הסרת כפילויות וענפים קצרים
    def xy(p): return (x0 + (p[1]+.5)*RES, y0 + (p[0]+.5)*RES)
    uniq = {}
    for a_, b_, path in edges:
        ls = LineString([xy(p) for p in path])
        key = (min(a_, b_), max(a_, b_), round(ls.length))
        if key not in uniq: uniq[key] = (a_, b_, ls)
    E = list(uniq.values())
    for _ in range(3):
        dg = {}
        for a_, b_, ls in E: dg[a_] = dg.get(a_, 0)+1; dg[b_] = dg.get(b_, 0)+1
        E = [(a_, b_, ls) for a_, b_, ls in E if not ((dg[a_] == 1 or dg[b_] == 1) and ls.length < 2.5) and a_ != b_]
    ids = {}
    for a_, b_, _ in E:
        for p in (a_, b_):
            if p not in ids: ids[p] = len(ids)
    nodes_out = [None]*len(ids)
    for p, i in ids.items(): x, y = xy(p); nodes_out[i] = [dm(x), dm(y)]
    edges_out = []
    for a_, b_, ls in E:
        s = ls.simplify(0.3)
        pts = [c for xy_ in s.coords for c in (dm(xy_[0]), dm(xy_[1]))]
        edges_out.append({'a': ids[a_], 'b': ids[b_], 'len': round(ls.length, 1), 'pts': pts})
    # ── אזורים עם שם ──
    zones = []
    if fl:
        for b in fl['buildings']:
            e = fl['plans'][b['floors'][0]['plan']]['env']; c = Polygon([(e[i]/10, e[i+1]/10) for i in range(0, len(e), 2)]).representative_point()
            f = next((f for f in foot if f.buffer(1).contains(c)), None)
            if f is None: continue
            same = next((z for z in zones if z.get('_f') is f), None)          # שני בניינים על אותה קומת קרקע (C ו-D): שם אחד לשניהם
            if same: same['name'] = same['name'].replace('בניין ', 'בניינים ') + f' ו-{b["id"]}'; continue
            zones.append({'name': f'בניין {b["id"]}', 'kind': 'in', '_f': f, 'poly': [dm(v) for xy_ in list(f.simplify(.3).exterior.coords)[:-1] for v in xy_]})
    for z in zones: z.pop('_f', None)
    if not zones and m.get('parts'):                                    # מודל מתוכנית העמדה: שם הבניין מחלקי הבניין (parts) שבתוך כל מבנה
        for f in foot:
            ids = sorted({pt['id'] for pt in m['parts'] if f.buffer(1).contains(Polygon([(pt['c'][i]/10, pt['c'][i+1]/10) for i in range(0, len(pt['c']), 2)]).buffer(0).representative_point())})
            if ids: zones.append({'name': ('בניין ' if len(ids) == 1 else 'בניינים ') + ' ו-'.join(ids), 'kind': 'in', 'poly': [dm(v) for xy_ in list(f.simplify(.3).exterior.coords)[:-1] for v in xy_]})
    gr = unary_union([P(x[1]).buffer(0.3) for x in S.get('green', [])]).buffer(-0.3)
    for g in sorted([g for g in getattr(gr, 'geoms', [gr]) if g.area > 80], key=lambda g: -g.area)[:8]:
        zones.append({'name': 'גינה', 'kind': 'garden', 'poly': [dm(v) for xy_ in list(g.simplify(.5).exterior.coords)[:-1] for v in xy_]})
    res = {'tik': a.tik, 'res': RES, 'x0': round(x0, 2), 'y0': round(y0, 2), 'nx': nx, 'ny': ny, 'mask': rle(mask.ravel().astype(int).tolist()),
           'nodes': nodes_out, 'edges': edges_out, 'zones': zones,
           'src': 'מהשרטוט: ריצוף, דק, גינון, מעברי חצייה ושבילים, ובתוך קומת הקרקע מה שאינו קיר. רשת השבילים היא ציר האמצע של השטח (חישוב), לא שבילים מסומנים.'}
    json.dump(res, open(os.path.join(d, 'walk.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    tot = sum(e['len'] for e in edges_out)
    print(f'שטח הליכה {mask.sum()*RES*RES:.0f} מ"ר, צמתים {len(nodes_out)}, קטעים {len(edges_out)}, אורך כולל {tot:.0f} מ\', אזורים {len(zones)}')
    print('נכתב', os.path.join(d, 'walk.json'), round(os.path.getsize(os.path.join(d, 'walk.json'))/1024), 'KB')
    if a.png:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        fig = plt.figure(figsize=(10, 13)); ax = fig.gca(); ax.set_aspect('equal')
        ax.imshow(mask, origin='lower', extent=(x0, x0+nx*RES, y0, y0+ny*RES), cmap='Greys', alpha=.35)
        for f in foot: ax.plot(*f.exterior.xy, 'b-', lw=.8)
        for e in edges_out: p = e['pts']; ax.plot([v/10 for v in p[0::2]], [v/10 for v in p[1::2]], 'r-', lw=1)
        for n in nodes_out: ax.plot(n[0]/10, n[1]/10, 'k.', ms=3)
        fig.savefig(a.png, dpi=70, bbox_inches='tight')

if __name__ == '__main__': main()
