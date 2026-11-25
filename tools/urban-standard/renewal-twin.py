"""Builds data/renewal-twin.json: the urban-renewal volumes of the shared city model ("מה נבנה סביבי",
table city_twin in ASHDODMAP), as the neutral grey background of the building-plans app.

Usage: python3 -I tools/urban-standard/renewal-twin.py <city_twin.json> data/renewal-twin.json
  <city_twin.json> = GET {SUPABASE}/rest/v1/city_twin?select=model,updated_at&id=eq.1 (public read).
Read-only: nothing is written to the database. Rerun after build_city_twin() in HITCHADSHUT.
Per feature: [plan_number index, stage, cat, base, top, ring as integer microdegree offsets].
"""
import json, sys
src, out = sys.argv[1:3]
row = json.load(open(src))
row = row[0] if isinstance(row, list) else row
m = row['model']
plans = sorted({f['properties'].get('plan_number') or '' for f in m['massing']['features']})
ix = {p: i for i, p in enumerate(plans)}
LNG0, LAT0 = 34.60, 31.75
feats = []
for f in m['massing']['features']:
    p, g = f['properties'], f['geometry']
    if p.get('kind') == 'envelope':
        continue
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        ring = poly[0]
        flat = []
        for x, y in ring[:-1] if ring[0] == ring[-1] else ring:
            flat += [round((x - LNG0) * 1e6), round((y - LAT0) * 1e6)]
        feats.append([ix[p.get('plan_number') or ''], p.get('stage') or '', p.get('cat') or '', round(p.get('base') or 0, 1), round(p.get('top') or 0, 1), flat])
info = {pl['plan_number']: {'title': pl.get('title'), 'stage': pl.get('stage'), 'status': pl.get('status')} for pl in m['plans']}
json.dump({'source': 'ASHDODMAP city_twin (מה נבנה סביבי), קריאה בלבד', 'city_twin_updated_at': row.get('updated_at'),
           'built_at': m.get('built_at'), 'origin': [LNG0, LAT0], 'scale': 1e-6, 'plans': plans,
           'info': {k: info.get(k) for k in plans}, 'features': feats}, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(feats)} volumes from {len(plans)} plans -> {out}')
