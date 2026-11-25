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
