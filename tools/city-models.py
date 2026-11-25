"""תוכניות הבינוי שיש להן מודל, לדף הכניסה (מצב "בינוי"): לכל בניין קטעים של קומות עם אותו מתאר, ב-WGS84.
המקור: layers/<תיק>/floors.json (המתאר של כל קומה) ו-model.json (e0, n0). ההמרה היא TM של האפליקציה (wgs2itm), בלי דאטום.
שימוש: python3 tools/city-models.py  (פלט: data/city-models.json)"""
import json, os, glob
from pyproj import Transformer
TM = "+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs"
inv = Transformer.from_crs(TM, "EPSG:4326", always_xy=True)
out = {}
for fp in sorted(glob.glob('layers/*/floors.json')):
    tik = fp.split('/')[1]; F = json.load(open(fp)); M = json.load(open(f'layers/{tik}/model.json')); e0, n0 = M['e0'], M['n0']
    P = F.get('plans', {}); bl = []
    for b in F.get('buildings', []):
        segs = []; cur = None
        for f in b.get('floors', []):
            pl = P.get(f.get('plan')) or {}; env = pl.get('env')
            if isinstance(env, str): env = json.loads(env)
            if not env or len(env) < 6: continue
            y0, y1 = f['y'], f['y'] + f['h']
            if cur and cur['plan'] == f['plan'] and abs(cur['y1'] - y0) < .05: cur['y1'] = y1; continue
            cur = { 'plan': f['plan'], 'y0': y0, 'y1': y1, 'env': env }; segs.append(cur)
        if not segs: continue
        S = []
        for c in segs:
            r = []
            for i in range(0, len(c['env']), 2):
                lng, lat = inv.transform(e0 + c['env'][i]/10, n0 + c['env'][i+1]/10); r.append([round(lng, 7), round(lat, 7)])
            S.append([r, round(c['y0'], 2), round(c['y1'], 2)])
        bl.append({ 'id': b.get('id'), 'label': b.get('label') or b.get('id'), 's': S })
    out[tik] = bl
json.dump({ 'src': 'layers/<תיק>/floors.json', 'models': out }, open('data/city-models.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print({k: len(v) for k, v in out.items()}, os.path.getsize('data/city-models.json'))
