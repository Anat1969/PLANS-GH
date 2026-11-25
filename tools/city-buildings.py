"""מבנים קיימים באשדוד מה-GIS העירוני (mapt_reka, שכבה 31 "מבנים פוליגונליים"), לאריחים של 500 מ'.
קריאה בלבד. הקואורדינטות בשרת הן רשת ישראל עם הדאטום, ולכן מוזזות מהרשת של האפליקציה 66 מ' מזרחה ו-41 מ' צפונה
(נבדק בעין מול רחובות העירייה, 25.11.2026). אין בשכבה גובה: הגובה סמלי לפי השטח, ומסומן כך.
שימוש: python3 tools/city-buildings.py <raw.json> geo/bld  (פלט: geo/bld/all.json, קובץ אחד)
raw.json: [[Layer, rings], ...] מתוך query עם where=OBJECTID>n (where=1=1 נחסם ב-WAF)."""
import json, sys, os, math
from shapely.geometry import Polygon
DX, DY, TILE = 66.0, 41.0, 500
CAT = {'2200': 0, '2201': 1, '2204': 2}          # מבנה, מבנה ציבור, בבנייה
def height(cat, a):
    if cat == 2: return 4
    if cat == 1: return 10
    return 6 if a < 150 else 9 if a < 400 else 15 if a < 900 else 21
raw = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
tiles = {}; n = 0
for L, rings in raw:
    if L not in CAT or not rings: continue
    r = rings[0]
    if len(r) < 4: continue
    p = Polygon([(x - DX, y - DY) for x, y in r])
    if not p.is_valid: p = p.buffer(0)
    if p.is_empty or p.area < 25 or p.geom_type != 'Polygon': continue
    p = p.simplify(0.35)
    c = p.centroid; tx, ty = int(c.x // TILE), int(c.y // TILE); ox, oy = tx*TILE, ty*TILE
    pts = list(p.exterior.coords)[:-1]
    flat = []
    for x, y in pts: flat += [round((x - ox)*10), round((y - oy)*10)]
    tiles.setdefault(f'{tx}_{ty}', []).append([CAT[L], height(CAT[L], p.area), flat]); n += 1
json.dump({ 'tile': TILE, 'count': n, 'src': 'gis.ashdod.muni.il mapt_reka/31, 25.11.2026', 'shift': [DX, DY],
  'height': 'סמלי לפי שטח הבניין: עד 150 מ"ר 6 מ\', עד 400 9 מ\', עד 900 15 מ\', מעל 21 מ\'. מבנה ציבור 10 מ\'. לא מדידה',
  'tiles': tiles }, open(f'{out}/all.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(n, len(tiles))
