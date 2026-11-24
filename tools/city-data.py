#!/usr/bin/env python3
"""data/city.json: הנפחים של "המצב הסופי" לדף הכניסה (ענת, 24.11.2026).
הקלט: תוצאת שאילתה (קריאה בלבד) מ-plan_models ב-ASHDODMAP, רק מגדלים ומסדים (בלי המעטפת):
  select jsonb_agg(jsonb_build_object('pn',plan_number,'k',f->'properties'->>'kind','cat',f->'properties'->>'cat',
    'lot',f->'properties'->'lot','top',f->'properties'->'top','base',f->'properties'->'base','c',f->'geometry'->'coordinates'))
  from plan_models, jsonb_array_elements(model->'massing'->'features') f where f->'properties'->>'kind' in ('tower','podium');
שימוש: python3 tools/city-data.py <result.json|.txt> data/city.json [summary.json]
summary.json: select jsonb_object_agg(plan_number, model->'summary') from plan_models (קריאה בלבד).
  לכל תב"ע: מגרשים, קומות, גובה ויח"ד אחרי. משמש למשפט הציבורי בדף הכניסה. ערך 0 או ריק לא נכתב.
המפתח: מספר התב"ע אחרי נרמול (בלי רווחים ולוכסנים), כמו ב-plans-plus.js."""
import json, re, sys

def norm(s): return re.sub(r'[\s/\\-]+', '', str(s or ''))

raw = open(sys.argv[1], encoding='utf-8').read()
try: raw = json.loads(raw)['result']           # תוצאה שמורה של כלי השאילתה
except Exception: pass
i = raw.index('['); j = raw.rindex(']') + 1
data = json.loads(raw[i:j])
if data and isinstance(data[0], dict) and 'jsonb_agg' in data[0]: data = data[0]['jsonb_agg']
out = {}
for f in data:
    rings = f['c'] if f['c'] and isinstance(f['c'][0][0][0], (int, float)) else [r for poly in f['c'] for r in poly]
    ring = [[round(x, 6), round(y, 6)] for x, y in rings[0]]
    top, base = float(f.get('top') or 0), float(f.get('base') or 0)
    if top <= base or len(ring) < 4: continue
    out.setdefault(norm(f['pn']), {'n': f['pn'], 'f': []})['f'].append({'k': f['k'], 'cat': f.get('cat') or 'residential', 'lot': f.get('lot'), 'top': round(top, 1), 'base': round(base, 1), 'r': ring})
if len(sys.argv) > 3:
    S = json.load(open(sys.argv[3], encoding='utf-8'))
    for pn, sm in S.items():
        k = norm(pn); sm = {a: b for a, b in (sm or {}).items() if a in ('lots', 'floors_max', 'height_max', 'units_after') and b}
        if k in out and sm: out[k]['sum'] = sm
json.dump({'source': 'plan_models ב-ASHDODMAP ("מה נבנה סביבי"): מגדל ומסד לפי טבלה 5 ותשריט התב"ע. הנפח הוא הערכה, לא תוכנית הבינוי.', 'read': '2026-11-24', 'taba': out},
          open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'תב"עות', sum(len(v['f']) for v in out.values()), 'נפחים')
