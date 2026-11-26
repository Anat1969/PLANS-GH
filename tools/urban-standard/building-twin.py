"""Builds data/building-twin.json: every building plan of this app, for the shared city twin in "מה נבנה סביבי".
The other direction of data/renewal-twin.json: there the renewal models come here, here the building plans go there.

Usage: python3 -I tools/urban-standard/building-twin.py <ashdod_plans.json> data/building-twin.json
  <ashdod_plans.json> = GET {SUPABASE}/rest/v1/ashdod_plans?select=plan_key,data->tik,data->planNum,data->change,
                        data->location,data->district,data->status,data->deleted  (public read, the fields shown on the public entry page)
Also reads data/city-models.json (detailed models, tools/city-models.py), data/city.json (TABA volumes by lot) and plans-geo.js.
Public fields only, like the entry page: number, district and lots, general status. No developer, dates or remarks.
Per plan the geometry and its source (provenance of the shared standard):
  model    -> 'plan'      the detailed model from the architect's drawings (floors.json), with floor blocks
  lots     -> 'computed'  TABA volumes of the plan's lots (plan_models, an estimate)
  xplan    -> 'plan'      the lot polygon from Xplan (official), with an estimated volume from table 5 ('estimate')
  municipal-> 'computed'  the lot from the city lots layer, matched by lot number near known plans on the TABA
  taba     -> 'computed'  no lot numbers (a compound name): the whole TABA area, outline only
  parcels  -> 'verified'  registered parcels (gush/helka) from the city GIS
  None                    no TABA model and no parcels: listed, shown nowhere on a map (a gap to close)
"""
import json, re, sys, datetime

src, out = sys.argv[1:3]
rows = json.load(open(src))
models = json.load(open('data/city-models.json'))['models']
city = json.load(open('data/city.json'))['taba']
geo = open('plans-geo.js', encoding='utf-8').read()
parcels = json.loads(re.search(r'window\.PLAN_PARCELS_BY_PLANNUM=(\{.*?\});\n', geo, re.S).group(1))
norm = lambda s: re.sub(r'[\s/\\-]+', '', str(s or ''))

def lot_list(loc):
    s = str(loc or '')
    m = re.search(r'(\d{1,4})\s*-\s*(\d{1,4})', s)
    if m and int(m.group(2)) - int(m.group(1)) < 30:
        return list(range(int(m.group(1)), int(m.group(2)) + 1))
    return [int(x) for x in re.findall(r'\d{1,4}', s)]

def status(s):
    s = str(s or '')
    return 'אושרה' if 'הושלם' in s else 'בטיפול' if re.search('בטיפול|דחוף|בהמתנה', s) else 'בהכנה'

def centroid(polys):
    pts = [p for poly in polys for p in poly[0]]
    return [round(sum(p[0] for p in pts) / len(pts), 6), round(sum(p[1] for p in pts) / len(pts), 6)] if pts else None


# ── lots for building plans whose TABA has no model in plan_models (downloaded 26.11.2026) ──
#   data/urban-standard/lots/<plan>.geojson: Xplan land-use layer of the Planning Administration (num = lot, mavat_name)
#   data/urban-standard/lots/municipal-old-tabas.geojson: the city lots layer, for old plans that are not in Xplan
#   data/urban-standard/extra-table5.json: floors, height and coverage read from table 5 of each plan's instructions
import os, math
XL = {}
for fn in os.listdir('data/urban-standard/lots'):
    d = json.load(open('data/urban-standard/lots/' + fn))
    for f in d['features']:
        pr = f['properties']; t = pr.get('pl_number') or pr.get('taba')
        XL.setdefault(norm(t), []).append({'num': str(pr.get('num')), 'use': pr.get('mavat_name') or pr.get('gis_use'),
            'src': 'municipal' if pr.get('gis_fid') else 'xplan', 'geom': f['geometry']})
TABA_FIX = {'603-03117784': '603-0317784'}   # a typo in the file (an extra 1); the instructions of 603-0317784 name this lot (22)
T5X = json.load(open('data/urban-standard/extra-table5.json'))['plans']
def ring_of(g):
    return g['coordinates'][0] if g['type'] == 'Polygon' else g['coordinates'][0][0]
def shrink(r, k):
    cx = sum(p[0] for p in r) / len(r); cy = sum(p[1] for p in r) / len(r)
    return [[round(cx + (p[0] - cx) * k, 7), round(cy + (p[1] - cy) * k, 7)] for p in r]
def extra_lots(rec):
    L = XL.get(norm(TABA_FIX.get(rec['taba'], rec['taba'])))
    if not L:
        return False
    want = [str(x) for x in rec['lots']]
    hit = [l for l in L if l['num'] in want]
    if not hit and L[0]['src'] == 'xplan' and len(L) == 1:   # a TABA of one lot: the number in the file is a name ("מנגו 4"), not a lot
        hit = L
    if not hit and L[0]['src'] == 'xplan' and not want:   # no lot in the file: the residential lots of the TABA (outline only, no volume)
        hit = [l for l in L if 'מגורים' in (l['use'] or '')]
    if not hit:
        return False
    src = hit[0]['src']
    rec.update(source=src, prov='plan' if src == 'xplan' else 'computed',
               geometry={'type': 'MultiPolygon', 'coordinates': [[ring_of(l['geom'])] for l in hit]},
               lot_uses=sorted({l['use'] for l in hit if l['use']}))
    t5 = T5X.get(TABA_FIX.get(rec['taba'], rec['taba']).replace(' ', '')) or {}
    est = []
    for l in hit:
        v = t5.get(l['num'])
        if not v:
            continue
        k = math.sqrt(min(v['coverage_pct'], 70) / 100)   # footprint = coverage of the lot (cap 70%: a podium of 93% is not the tower)
        est.append({'lot': l['num'], 'cat': v['cat'], 'base': 0, 'top': v['height_m'], 'floors': v['floors'], 'r': shrink(ring_of(l['geom']), k), 'ref': v['ref']})
    if est:
        rec['estimate'] = est   # computed volume: lot x coverage, to the table 5 height. Not the building plan's design
    return True

plans, seen = [], set()
for r in sorted(rows, key=lambda r: str(r.get('planNum'))):
    if r.get('deleted'):
        continue
    num = re.sub(r'\s+', '', str(r.get('planNum') or ''))
    if not num or num in seen:
        continue
    seen.add(num)
    tik, digits = str(r.get('tik')), re.sub(r'\D', '', num)
    rec = {'plan_number': num, 'tik': tik, 'taba': (r.get('change') or '').strip() or None, 'status': status(r.get('status')),
           'lots': lot_list(r.get('location'))}
    # מקום: רובע ומספרי מגרשים בלבד. שדה המיקום בתיק כולל לפעמים שם של יזם או חברה ("רותם פלדות - תדהר"), ולכן הטקסט שלו לא יוצא
    rec['place'] = ', '.join(x for x in [r.get('district'), ('מגרש ' + ', '.join(map(str, rec['lots']))) if rec['lots'] else None] if x) or None
    m = models.get(tik)
    if m:   # the detailed model: footprint = the lowest block of each building
        polys = [[b['s'][0][0]] for b in m if b.get('s')]
        rec.update(source='model', prov='plan', geometry={'type': 'MultiPolygon', 'coordinates': polys},
                   model=[{'id': b['id'], 'label': b.get('label'), 's': b['s']} for b in m])
    else:
        t = city.get(norm(rec['taba']))
        fs = [f for f in (t['f'] if t else []) if int(f.get('lot') or -1) in rec['lots']]
        if fs:
            rec.update(source='lots', prov='computed', geometry={'type': 'MultiPolygon', 'coordinates': [[f['r']] for f in fs]},
                       volumes=[{'lot': f['lot'], 'cat': f.get('cat'), 'base': f.get('base', 0), 'top': f.get('top'), 'r': f['r']} for f in fs])
        elif t and t['f']:   # a lot name instead of numbers (a whole compound): the TABA area. Outline only, the volumes are already in the city twin
            rec.update(source='taba', prov='computed', geometry={'type': 'MultiPolygon', 'coordinates': [[f['r']] for f in t['f']]})
        elif digits in parcels and parcels[digits].get('g'):
            g = parcels[digits]['g']
            rec.update(source='parcels', prov='verified', geometry=g)
        elif extra_lots(rec):   # official lots: Xplan (online plans) or the municipal lots layer (old scanned plans)
            pass
        else:
            rec.update(source=None, prov=None, geometry=None)
    if rec.get('geometry'):
        rec['center'] = centroid(rec['geometry']['coordinates'] if rec['geometry']['type'] == 'MultiPolygon' else [rec['geometry']['coordinates']])
    plans.append(rec)

json.dump({'source': 'PLANS-GH (תוכניות בינוי): ashdod_plans, data/city-models.json, data/city.json, plans-geo.js',
           'built': datetime.date.today().isoformat(), 'app': 'https://anat1969.github.io/PLANS-GH/', 'plans': plans},
          open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(f"{len(plans)} plans -> {out}:", dict(Counter(p['source'] for p in plans)))
