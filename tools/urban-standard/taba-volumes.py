"""Builds data/taba-volumes.json: approved TABAs that have no model in plan_models ("מה נבנה סביבי"), as volumes for the entry page.
Same compact format as data/renewal-twin.json: features = [plan index, stage, cat, base, top, ring as integer microdegree offsets].

Usage: python3 -I tools/urban-standard/taba-volumes.py data/taba-volumes.json
Sources (26.11.2026, ענת: "תשלים את התב"ע של המרינה", "חסרה התוכנית של רובע ז - תוספות בנייה, והמבנים הקיימים"):
  112/101/02/3, המרינה (מאושרת 2006): data/taba-docs/112_101_02_3/horaot.pdf, טבלת זכויות הבנייה - מצב מוצע (עמ' 11, סרוק, נקרא בעין).
     המגרשים: data/urban-standard/taba-lots/112-101-02-3-marina.geojson (שכבת המגרשים העירונית, שויכו לפי גוש, חלקה ושטח).
     הנפח: המגרש לפי התכסית, עד מספר הקומות בטבלה. גובה = קומת קרקע 4.5 מ' ועוד 3.3 מ' לקומה (הערכה).
  603-0595660, תוספת שטחי בנייה לדירות קיימות ברובע ז' (מאושרת): data/taba-docs/603-0595660/horaot.pdf.
     הקו הכחול מ-Xplan. המבנים הקיימים: data/urban-standard/taba-lots/603-0595660-buildings.json (מבני OSM במסד, קומות מ-OSM או לפי ייעוד).
     המצב המוצע: הרחבת הדירות עד 160 מ"ר (טבלה 5) וחדר על הגג לקומה העליונה (טבלה 5, הערה 3). במודל: המבנה מורחב ב-2.5 מ'
     לכל כיוון ועוד קומה אחת, רק במבני מגורים. הערכה: ההרחבה בפועל תלויה בכל בניין ובתוכנית הבינוי שהיא תנאי להיתר.
  התב"עות של תוכניות הבינוי, כל המגרשים (26.11.2026): 44/101/02/3 (ריביירה, סעיף 29 בהוראות הסרוקות), 603-0262121 (מגרש 18)
     ו-603-0735282 (מגרשי הציבור 240, 241). המגרשים: data/urban-standard/taba-lots/ (השכבה העירונית או Xplan שכבה 4).
     חסר: 603-1460740 (תוכנית בינוי 1888) בהפקדה, וההוראות לא ב-TabaSearch. 126/101/02/3 (1830), 3/124/03/3 (1841)
     ו-14/118/03/3 (1901) עוד לא נקראו. 47/101/02/3 (הנמל, 1902) בלי מגרשים.
"""
import json, sys, math
from shapely.geometry import shape, Polygon, MultiPolygon, mapping
from shapely.ops import unary_union

out = sys.argv[1]
LNG0, LAT0 = 34.60, 31.75
KX, KY = 111320 * math.cos(math.radians(31.8)), 110574
def flat(ring):
    r = list(ring)[:-1] if tuple(ring[0]) == tuple(ring[-1]) else list(ring)
    f = []
    for x, y in r:
        f += [round((x - LNG0) * 1e6), round((y - LAT0) * 1e6)]
    return f
def to_m(g):    # local metres around the shape, for buffers and areas
    c = g.centroid
    from shapely.affinity import affine_transform
    return affine_transform(g, [KX, 0, 0, KY, -c.x * KX, -c.y * KY]), (c.x, c.y)
def from_m(g, c):
    from shapely.affinity import affine_transform
    return affine_transform(g, [1 / KX, 0, 0, 1 / KY, c[0], c[1]])
def scaled(poly, k):   # the lot shrunk around its centre to k of its area (coverage), as in building-twin.py
    from shapely.affinity import scale
    s = math.sqrt(k)
    return scale(poly, s, s, origin='centroid')
def height(floors):
    return round(4.5 + 3.3 * (floors - 1), 1)

plans, info, feats, bnd = [], {}, [], []

# ── 112/101/02/3, המרינה ──
# מגרש -> (גוש, חלקה), קומות מעל הכניסה, תכסית, ייעוד. לפי עמ' 11 בהוראות; השיוך לחלקה לפי השטח בטבלה מול השטח בשכבה העירונית
MARINA = {
    '42': ([('2791', '3006'), ('2790', '3003')], 17, 50, 'hotel'),   # 7,440 מ"ר = 6,367 + 1,117
    '43': ([('2790', '3001')], 27, 50, 'hotel'),
    '44': ([('2791', '3022'), ('2790', '3007')], 32, 50, 'hotel'),   # 6,601 = 5,455 + 1,145
    '45': ([('2791', '3013')], 2, 88, 'hotel'),
    '46': ([('2791', '3010')], 2, 88, 'hotel'),
    '47': ([('2791', '3012')], 2, 88, 'hotel'),
    '48': ([('2791', '3011')], 2, 88, 'hotel'),
    '55': ([('2791', '10')], 23, 50, 'hotel'),                       # 6,997 בדיוק
    '50': ([('2791', '3003')], 6, 80, 'residential'),
    '51': ([('2791', '3007')], 6, 80, 'residential'),
    '52': ([('2791', '3008')], 6, 80, 'residential'),                # השכבה העירונית: מגרש 52
    '53': ([('2791', '3009')], 6, 80, 'residential'),
    '10': ([('2791', '11')], 18, 40, 'residential'),                 # 6,524 בדיוק
    '11': ([('2791', '12')], 18, 40, 'residential'),
    '12': ([('2791', '13')], 18, 40, 'residential'),
    '13': ([('2791', '14')], 18, 40, 'residential'),                 # לא בטבלה (6,832 כמו מגרש 12): המגדל החמישי בשורה, הערכה
    '14': ([('2791', '18')], 21, 40, 'residential'),                 # 6,112 בדיוק
    '54': ([('2791', '3014')], 23, 60, 'mixed'),                     # 7,206: 120 יח"ד ומסחר
    '5':  ([('2791', '3015')], 4, 50, 'public'),
    '31': ([('2791', '2005')], 4, 50, 'commerce'),                   # שירותי מרינה
    '33': ([('2790', '2001')], 4, 50, 'commerce'),
    '32': ([('2791', '38')], 1, 15.4, 'commerce'),                   # אזור משולב שצ"פ, חניה תת-קרקעית ומסחר
    '32א': ([('2791', '61')], 1, 40.1, 'commerce'),
}
L = json.load(open('data/urban-standard/taba-lots/112-101-02-3-marina.geojson'))
by = {(f['properties']['gush'], f['properties']['helka']): shape(f['geometry']) for f in L['features']}
pi = len(plans); plans.append('112/101/02/3')
info['112/101/02/3'] = {'title': 'המרינה', 'stage': 'approved', 'units': 676,
    'src': 'הוראות 112/101/02/3 (2006), טבלת זכויות בנייה - מצב מוצע, עמ\' 11. המגרשים מהשכבה העירונית. הנפח: תכסית וקומות לפי הטבלה, גובה 4.5 מ\' ועוד 3.3 מ\' לקומה (הערכה)',
    'missing': 'מגרש 40 (7,646 מ"ר, 6 קומות) לא נמצא בשכבה העירונית'}
lots = []
for lot, (hel, fl, cov, cat) in MARINA.items():
    g = unary_union([by[h] for h in hel if h in by])
    if g.is_empty:
        print('missing lot', lot); continue
    gm, c = to_m(g)
    gm = gm.buffer(0)
    body = scaled(gm.convex_hull if gm.geom_type == 'MultiPolygon' else gm, min(cov, 90) / 100)
    poly = from_m(body, c)
    feats.append([pi, 'approved', cat, 0, height(fl), flat(poly.exterior.coords)])
    lots.append(gm.buffer(0))
# הקו הכחול: אין קובץ דיגיטלי לתב"ע הישנה. הערכה: איחוד המגרשים בסגירה של 25 מ'
U = unary_union([by[h] for v in MARINA.values() for h in v[0] if h in by])
Um, c = to_m(U)
hull = Um.buffer(25).buffer(-25)
hull = max(hull.geoms, key=lambda p: p.area) if hull.geom_type == 'MultiPolygon' else hull
bnd.append([pi, 'approved', flat(from_m(hull, c).exterior.coords)])

# ── 603-0595660, רובע ז', תוספת שטחי בנייה לדירות קיימות ──
pi = len(plans); plans.append('603-0595660')
Z = json.load(open('data/urban-standard/taba-lots/603-0595660-buildings.json'))['buildings']
blue = shape(json.load(open('data/urban-standard/taba-lots/603-0595660-blue.geojson'))['features'][0]['geometry'])
bnd.append([pi, 'approved', flat(blue.exterior.coords)])
n = 0
for b in Z:
    if not str(b.get('z') or '').startswith('מגורים'):
        continue
    g = shape({'type': 'Polygon', 'coordinates': b['g']}) if isinstance(b['g'][0][0][0], (int, float)) else shape({'type': 'MultiPolygon', 'coordinates': b['g']})
    gm, c = to_m(g)
    if gm.area < 60:
        continue
    big = gm.buffer(2.5, join_style=2)
    big = max(big.geoms, key=lambda p: p.area) if big.geom_type == 'MultiPolygon' else big
    fl = int(b.get('f') or 4)
    feats.append([pi, 'approved', 'residential', 0, round(3.0 * (fl + 1), 1), flat(from_m(big, c).exterior.coords)])
    n += 1
info['603-0595660'] = {'title': 'תוספת שטחי בנייה לדירות קיימות ברובע ז\'', 'stage': 'approved', 'units': None,
    'src': 'הוראות 603-0595660: הרחבה עד 160 מ"ר לדירה וחדר על הגג לקומה העליונה, בלי תוספת יח"ד. במודל: כל מבנה מגורים קיים מורחב ב-2.5 מ\' ועוד קומה (הערכה). המבנים מ-OSM, הקומות לפי ייעוד (הערכה)',
    'buildings': n}

# ── התב"עות של תוכניות הבינוי, כל המגרשים (ענת, 26.11.2026: "בהתאם להמלצה") ──
# לכל מגרש: מקור הגאומטריה, קומות, תכסית (או אחוזי בנייה חלקי קומות), ייעוד ומקור. גובה = 4.5 מ' ועוד 3.3 מ' לקומה, אלא אם נקבע בטבלה
def add_plan(pn, title, units, src, lots, geom_of, bnd_from=None):
    pi = len(plans); plans.append(pn)
    info[pn] = {'title': title, 'stage': 'approved', 'units': units, 'src': src}
    allg = []
    for lot, (key, fl, cov, cat, h, ref) in lots.items():
        g = unary_union([geom_of(k) for k in key if geom_of(k) is not None])
        if g.is_empty:
            print(pn, 'missing lot', lot); continue
        allg.append(g)
        gm, c = to_m(g); gm = gm.buffer(0)
        body = scaled(gm.convex_hull if gm.geom_type == 'MultiPolygon' else gm, min(cov, 90) / 100)
        feats.append([pi, 'approved', cat, 0, h or height(fl), flat(from_m(body, c).exterior.coords)])
    if bnd_from is not None:
        bnd.append([pi, 'approved', flat(bnd_from.exterior.coords)])
    elif allg:
        U = unary_union(allg); Um, c = to_m(U); hull = Um.buffer(25).buffer(-25)
        hull = max(hull.geoms, key=lambda p: p.area) if hull.geom_type == 'MultiPolygon' else hull
        bnd.append([pi, 'approved', flat(from_m(hull, c).exterior.coords)])

def by_helka(path):
    D = {(f['properties']['gush'], f['properties']['helka']): shape(f['geometry']) for f in json.load(open(path))['features']}
    return lambda k: D.get(k)
def by_num(path):
    D = {}
    for f in json.load(open(path))['features']:
        D.setdefault(str(f['properties']['num']), []).append(shape(f['geometry']))
    return lambda k: unary_union(D[k]) if k in D else None

# 44/101/02/3, ריביירה (תוכניות בינוי 1736, 1802, 1832). סעיף 29 בהוראות הסרוקות, עמ' 7. אחוזי הבנייה (120%) חלקי הקומות = התכסית של המגדל
R = by_helka('data/urban-standard/taba-lots/44-101-02-3-riviera.geojson')
add_plan('44/101/02/3', 'ריביירה, מלונאות ונופש', None,
    'הוראות 44/101/02/3, סעיף 29 (טבלת זכויות ומגבלות בנייה, עמ\' 7, סרוק). המגרשים מהשכבה העירונית לפי גוש, חלקה ושטח. מלונות: 10 קומות ו-120%, ולכן תכסית של 12% (הערכה)', {
    '1-2/א': ([('2002', '3006')], 10, 12, 'hotel', None, 'מגרש 1, 16.5 ד\', 10 קומות, 120%'),
    '1-2/ב': ([('2002', '3008')], 10, 12, 'hotel', None, 'מגרש 2, 10 קומות, 120%'),
    '3':     ([('2003', '3004')], 10, 12, 'hotel', None, '12.0 ד\', 10 קומות, 120%'),
    '4':     ([('2003', '3003')], 10, 12, 'hotel', None, '8.0 ד\', 10 קומות, 120%'),
    '5':     ([('2003', '3001')], 10, 12, 'hotel', None, '6.0 ד\', 10 קומות, 120%'),
    '6':     ([('2002', '3003')], 2, 35, 'hotel', None, 'אכסון ונופש מיוחד, 53.0 ד\', 2 קומות, תכסית 35%'),
    '7':     ([('2003', '3012'), ('2002', '3009')], 2, 35, 'hotel', None, '55.0 ד\', 2 קומות, 35% (בשכבה 48.9 ד\' בשתי חלקות)'),
    '8':     ([('2003', '3005')], 2, 32, 'commerce', None, 'פתוח שפת ים א\', 2 קומות'),
    '9':     ([('2003', '3007')], 2, 32, 'commerce', None, 'פתוח שפת ים א\', 2 קומות'),
    'ספורט': ([('2002', '3002'), ('2002', '3007'), ('2003', '3010')], 1, 12, 'open', 6, 'שטח ספורט 78 ד\', קומה אחת, 12%'),
}, R)

# 603-0262121, מגרש 18 מגורים ותיירות, רובע ט"ו (תוכנית בינוי 1714). טבלה 5, עמ' 14: מגורים 17 קומות ו-60 מ', מלונאות 20 קומות ו-78 מ'
X1 = by_num('data/urban-standard/taba-lots/603-0262121-xplan.geojson')
g18 = X1('18')
if g18 is not None:
    from shapely.geometry import box
    gm, c = to_m(g18); x0, y0, x1, y1 = gm.bounds; mx = (x0 + x1) / 2
    halves = [gm.intersection(box(x0, y0, mx, y1)), gm.intersection(box(mx, y0, x1, y1))]   # שני מגדלים: חצי למגורים וחצי למלון (הערכה)
    pi = len(plans); plans.append('603-0262121')
    info['603-0262121'] = {'title': 'מגרש 18, מגורים ותיירות, רובע ט"ו', 'stage': 'approved', 'units': 109,
        'src': 'הוראות 603-0262121, טבלה 5 (עמ\' 14): מגורים 17 קומות, 60 מ\', תכסית 13.71%, 109 יח"ד. מלונאות 20 קומות, 78 מ\', 46.29%, 234 יחידות אירוח. מיקום שני המגדלים במגרש: הערכה'}
    for half, (cat, h, cov) in zip(halves, [('residential', 60, 13.71 * 2), ('hotel', 78, 46.29 * 2 * .5)]):
        half = half if half.geom_type == 'Polygon' else max(half.geoms, key=lambda p: p.area)
        feats.append([pi, 'approved', cat, 0, h, flat(from_m(scaled(half, min(cov, 70) / 100), c).exterior.coords)])
    bnd.append([pi, 'approved', flat(g18.exterior.coords if g18.geom_type == 'Polygon' else g18.geoms[0].exterior.coords)])

# 603-0735282 (תוכניות בינוי 1730, 1824): מגרשי הציבור 240, 241. טבלה 5: 4 קומות ו-19 מ', 6 קומות ו-25 מ', תכסית 70%
X2 = by_num('data/urban-standard/taba-lots/603-0735282-xplan.geojson')
add_plan('603-0735282', 'מבני ציבור במתחם', None, 'הוראות 603-0735282, טבלה 5: מגרש 240 4 קומות ו-19 מ\', מגרש 241 6 קומות ו-25 מ\', תכסית 70%. המגרשים מ-Xplan. מגרשי המגורים 141 ו-142 מצוירים מתוכניות הבינוי', {
    '240': (['240'], 4, 70, 'public', 19, ''),
    '241': (['241'], 6, 70, 'public', 25, ''),
}, X2)

json.dump({'source': 'tools/urban-standard/taba-volumes.py', 'built': '2026-11-26', 'origin': [LNG0, LAT0], 'scale': 1e-6,
           'plans': plans, 'info': info, 'features': feats, 'boundaries': bnd}, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(feats)} volumes, {len(bnd)} boundaries -> {out}', {p: sum(1 for f in feats if plans[f[0]] == p) for p in plans})
