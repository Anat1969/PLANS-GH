#!/usr/bin/env python3
"""הפקת מודל אוטומטית מתוכנית פיתוח (PDF עם שכבות) שהגיעה בטופס לאדריכל (ענת, 23.11.2026).

שימוש:
  python3 tools/auto-model.py --all                      כל התוכניות בענן שיש להן PDF עם שכבות ואין להן מודל (ה-Action)
  python3 tools/auto-model.py --tik 1913 --pdf plan.pdf  תוכנית אחת, מקובץ מקומי
  אפשרויות: --out <תיקייה> (ברירת מחדל: layers/<תיק>), --no-taba (בלי תב"ע: מודל משוער), --force

הזרימה, לכל תוכנית:
 1. קנה המידה: מהטקסט בדף ("1:250"). בלי טקסט: 250, ומסומן "הנחה".
 2. split-layers.py ו-extract-model.py הקיימים, בלי שינוי בלוגיקה שלהם. המודל נשמר יחסית למרכז שלו (e0, n0).
 3. התב"ע מ-plan_models ב-ASHDODMAP (קריאה בלבד) נכתבת ל-renewal.json.
 4. כיול: הזזה של המרכז, עד שהקו הכחול (plot) יושב על צלעות מגרשי התב"ע. מדד: הסטייה החציונית, כמו ב-check-layers.js.
    מתחת ל-0.5 מ': "מכויל". אחרת, או בלי תב"ע: "משוער", בעיגון הראשוני (מיקום התוכנית).
    הכמויות (שטחים, אורכים, ספירות) תלויות רק בקנה המידה, ולכן נכונות גם במודל משוער.
 5. auto.json עם הסטטוס, ורישום ב-layers/index.json.
"""
import sys, os, json, re, math, argparse, subprocess, tempfile, shutil, urllib.request, urllib.parse, datetime, collections
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SB = 'https://cbhexpybdggwzyakgagd.supabase.co'          # ASHDODMAP: תיקיית העירייה
KEY = 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3'   # מפתח ציבורי, קריאה בלבד
OK_MEDIAN = 0.5                                          # מ': סף "מכויל", כמו ב-CLAUDE.md
SCALES = (100, 200, 250, 500, 1000)

# ── רשת ישראל החדשה ↔ WGS84: אותן נוסחאות של plans-model.js ──
G = dict(a=6378137, f=1/298.257222101, k0=1.0000067, lon0=(35+12/60+16.261/3600)*math.pi/180, lat0=(31+44/60+3.817/3600)*math.pi/180, FE=219529.584, FN=626907.39)
G['e2'] = G['f']*(2-G['f']); G['ep2'] = G['e2']/(1-G['e2'])
def _mer(p):
    e = G['e2']; return G['a']*((1-e/4-3*e*e/64-5*e**3/256)*p-(3*e/8+3*e*e/32+45*e**3/1024)*math.sin(2*p)+(15*e*e/256+45*e**3/1024)*math.sin(4*p)-(35*e**3/3072)*math.sin(6*p))
def wgs2itm(lat_d, lon_d):
    lat, lon, e = lat_d*math.pi/180, lon_d*math.pi/180, G['e2']
    Nn = G['a']/math.sqrt(1-e*math.sin(lat)**2); T = math.tan(lat)**2; C = G['ep2']*math.cos(lat)**2; A = (lon-G['lon0'])*math.cos(lat)
    x = G['k0']*Nn*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*G['ep2'])*A**5/120)
    y = G['k0']*(_mer(lat)-_mer(G['lat0'])+Nn*math.tan(lat)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*G['ep2'])*A**6/720))
    return x+G['FE'], y+G['FN']

def get(url):
    req = urllib.request.Request(url, headers={'apikey': KEY, 'Authorization': 'Bearer '+KEY})
    with urllib.request.urlopen(req, timeout=120) as r: return r.read()
def rest(q): return json.loads(get(SB+'/rest/v1/'+q))
norm = lambda s: re.sub(r'[\s/\\-]', '', str(s or ''))

# ── התב"ע: plan_models (GeoJSON) למבנה של renewal.json ──
def taba(change):
    if not change: return None
    try: rows = rest('plan_models?select=plan_number,model,updated_at')
    except Exception as e: print('  plan_models לא נקרא:', e); return None
    row = next((r for r in rows if norm(r['plan_number']) == norm(change)), None)
    if not row: return None
    m = row['model'] or {}
    feats = lambda k: (m.get(k) or {}).get('features', []) if isinstance(m.get(k), dict) else []
    ring = lambda f: [p for p in (f['geometry']['coordinates'][0] if f['geometry']['type'] == 'Polygon' else f['geometry']['coordinates'][0][0])][:-1]
    parcels = [dict(lot=f['properties'].get('lot'), cat=f['properties'].get('cat', 'open'), c=ring(f)) for f in feats('parcels') if f.get('geometry')]
    if not parcels: return None
    cat = {p['lot']: p['cat'] for p in parcels}
    lots = []
    for L in m.get('lots') or []:
        g = lambda *ks: next((L[k] for k in ks if L.get(k) not in (None, '')), None)
        lots.append({k: v for k, v in dict(lot=L.get('lot'), below=g('floors_below'), title=g('title'), cat=cat.get(L.get('lot'), 'mixed'), units=g('units'),
            floors=g('floors_above'), height=g('height_m'), lotSize=g('lot_size'), main=g('main_above'), coverage=g('coverage_pct'),
            plate=g('floor_plate_m2'), commerce=g('commercial_main')).items() if v is not None})
    massing = [dict(**{k: f['properties'][k] for k in ('lot', 'kind', 'cat', 'base', 'top') if k in f['properties']}, c=ring(f)) for f in feats('massing') if f.get('geometry')]
    demolish = [dict(h=f['properties'].get('h', 10), c=ring(f)) for f in feats('demolish') if f.get('geometry')]
    hs = [l['height'] for l in lots if isinstance(l.get('height'), (int, float))]; fl = [l['floors'] for l in lots if isinstance(l.get('floors'), (int, float))]
    return dict(plan=row['plan_number'], title=row['plan_number'], source=f'עותק מ"מה נבנה סביבי" (plan_models), עדכון {str(row.get("updated_at"))[:10]}. נלקח אוטומטית {datetime.date.today():%d.%m.%Y}',
                sources=m.get('sources') or {}, note='הופק אוטומטית בהפקת המודל', summary=dict(units=sum(l.get('units') or 0 for l in lots if isinstance(l.get('units'), (int, float))),
                floorsMax=max(fl) if fl else None, heightMax=max(hs) if hs else None), lots=lots, parcels=parcels, massing=massing, demolish=demolish)

# ── כיול: הזזה בלבד (הרשת בשרטוט מיושרת לצפון) ──
def edges_itm(rn, step=0.25):
    """נקודות צפופות על צלעות מגרשי התב"ע, ברשת ישראל, וגם הצלעות עצמן"""
    P, S = [], []
    for p in rn['parcels']:
        c = [wgs2itm(lat, lon) for lon, lat in p['c']]
        for i in range(len(c)):
            a, b = c[i], c[(i+1) % len(c)]; S.append((*a, *b)); n = max(1, int(math.dist(a, b)/step))
            P += [(a[0]+(b[0]-a[0])*t/n, a[1]+(b[1]-a[1])*t/n) for t in range(n+1)]
    return np.array(P), np.array(S)
def seg_median(pts, S):
    """הסטייה החציונית: מרחק כל נקודה מהצלע הקרובה. אותו מדד של check-layers.js"""
    a, b = S[:, :2], S[:, 2:]; v = b - a; l = (v*v).sum(1); l[l == 0] = 1e-9
    d = []
    for p in pts:
        t = np.clip(((p - a)*v).sum(1)/l, 0, 1); d.append(np.sqrt(((a + v*t[:, None] - p)**2).sum(1)).min())
    return float(np.median(d))
def plot_points(model, k=1.0):
    f = [v for L in model['lines'].get('plot', []) for v in L]
    return np.array(f, float).reshape(-1, 2)/10*k
TRUNC = 2.0                                              # מ': ממוצע קטום. חציון לבד נופל להתאמה שגויה כשיש צלעות מקבילות (1913: 16 מ' הצידה, חציון 0.47)
def calibrate(model, rn, guess, scale0):
    """מחפש את ההזזה (וקנה המידה) שבהם הקו הכחול יושב על צלעות התב"ע.
    מחזיר dict: median, inliers (חלק הנקודות עד 0.5 מ'), ambiguous (מיקום אחר, רחוק מ-3 מ', עם ציון דומה), scale, e0, n0"""
    from scipy.spatial import cKDTree
    E, S = edges_itm(rn); tree = cKDTree(E)
    base = plot_points(model)
    if len(base) < 20: return None
    rng = np.random.default_rng(1)
    score = lambda Q: float(np.minimum(tree.query(Q)[0], TRUNC).mean())
    best = None
    for sc in [scale0] + [x for x in SCALES if x != scale0]:
        P = base*sc/scale0; smp = P[rng.choice(len(P), min(400, len(P)), replace=False)]
        mins = []                                                          # מינימומים מקומיים מהחיפוש הגס, לבדיקת עמימות
        for c0 in (np.array(guess, float), E.mean(0) - P.mean(0)):
            g = np.arange(-200, 202, 4.0); gx, gy = np.meshgrid(g, g); T = np.c_[gx.ravel(), gy.ravel()] + c0
            sc_ = np.array([score(smp + t) for t in T])
            for i in np.argsort(sc_)[:12]:
                c = T[i]
                for span, step in ((6, 0.5), (0.75, 0.05)):
                    gg = np.arange(-span, span+step/2, step); hx, hy = np.meshgrid(gg, gg); TT = np.c_[hx.ravel(), hy.ravel()] + c
                    c = TT[int(np.argmin([score(smp + t) for t in TT]))]
                mins.append((score(P + c), c))
        mins.sort(key=lambda x: x[0]); s0, c = mins[0]
        d = tree.query(P + c)[0]; med, inl = float(np.median(d)), float((d < 0.5).mean())
        rival = next((x for x in mins[1:] if np.hypot(*(x[1] - c)) > 3), None)
        amb = bool(rival and rival[0] < s0 * 1.5)
        cur = dict(median=med, inliers=inl, ambiguous=amb, scale=sc, e0=float(c[0]), n0=float(c[1]), score=s0)
        if best is None or cur['score'] < best['score']: best = cur
        if med < OK_MEDIAN and inl >= 0.8 and not amb: break             # קנה המידה הזה עובד: לא בודקים אחרים
    P = base*best['scale']/scale0 + [best['e0'], best['n0']]
    best['median'] = seg_median(P[::max(1, len(P)//600)], S)              # המדד המדויק, מול הצלעות עצמן
    return best
def calibrated(c): return bool(c) and c['median'] < OK_MEDIAN and c['inliers'] >= 0.8 and not c['ambiguous']

def detect_scale(pdf):
    import pymupdf as fitz
    txt = fitz.open(pdf)[0].get_text()
    hits = [int(x) for x in re.findall(r'1\s*:\s*(\d{3,4})\b', txt) if int(x) in SCALES]
    return (collections.Counter(hits).most_common(1)[0][0], 'מהדף') if hits else (250, 'הנחה: 1:250')

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: raise RuntimeError((r.stderr or r.stdout).strip()[-600:])
    return r.stdout

def build(tik, pdf, out, plan=None, use_taba=True, title=''):
    """מפיק תוכנית אחת. מחזיר את auto.json"""
    plan = plan or {}; os.makedirs(out, exist_ok=True)
    scale, scale_src = detect_scale(pdf)
    rn = taba(plan.get('change')) if use_taba else None
    # עיגון ראשוני: מיקום התוכנית
    guess, gsrc = None, ''
    if plan.get('lat') and plan.get('lng'): guess, gsrc = wgs2itm(float(plan['lat']), float(plan['lng'])), 'מיקום התוכנית בתיק'
    if not guess:
        try:
            geo = open(os.path.join(ROOT, 'plans-geo.js'), encoding='utf8').read()
            pp = json.loads(re.search(r'window\.PLAN_PARCELS_BY_PLANNUM=(\{.*?\});?\n', geo, re.S).group(1))
            c = (pp.get(re.sub(r'\D', '', str(plan.get('planNum') or tik))) or {}).get('c')
            if c: guess, gsrc = wgs2itm(c[0], c[1]), 'גוש וחלקה (plans-geo.js)'
        except Exception as e: print('  plans-geo:', e)
    if not guess and rn:
        E, _ = edges_itm(rn); guess, gsrc = tuple(E.mean(0)), 'מרכז מגרשי התב"ע'
    if not guess: guess, gsrc = wgs2itm(31.8014, 34.6435), 'מרכז אשדוד: אין מיקום לתוכנית'
    tmp = tempfile.mkdtemp()
    try:
        run([sys.executable, os.path.join(ROOT, 'tools', 'extract-model.py'), pdf, tmp, '--e0', '0', '--x0', '0', '--n0', '0', '--y0', '0', '--scale', str(scale)])
        model = json.load(open(os.path.join(tmp, 'model.json'), encoding='utf8'))
        cal = calibrate(model, rn, guess, scale) if rn else None
        status, med, why = 'approx', None, 'אין תב"ע עם מגרשים' if not rn else ''
        if calibrated(cal):
            med, sc, e0, n0 = cal['median'], cal['scale'], cal['e0'], cal['n0']; status = 'calibrated'
            if sc != scale:                                            # קנה מידה אחר מזה שבדף: מפיקים שוב בקנה המידה הנכון
                scale, scale_src = sc, 'נמצא בכיול מול התב"ע'
                run([sys.executable, os.path.join(ROOT, 'tools', 'extract-model.py'), pdf, tmp, '--e0', '0', '--x0', '0', '--n0', '0', '--y0', '0', '--scale', str(scale)])
                model = json.load(open(os.path.join(tmp, 'model.json'), encoding='utf8'))
        else:
            if cal:
                med = cal['median']
                why = 'יש יותר ממיקום אחד שמתאים' if cal['ambiguous'] else f'הקו הכחול לא יושב על מגרשי התב"ע (סטייה {med:.2f} מ\', {cal["inliers"]*100:.0f}% מהנקודות קרובות)'
            elif rn: why = 'אין בשרטוט קו כחול (שכבה 1801)'
            e0, n0 = guess
        model['e0'], model['n0'] = round(e0, 2), round(n0, 2)
        json.dump(model, open(os.path.join(out, 'model.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    finally: shutil.rmtree(tmp, ignore_errors=True)
    run([sys.executable, os.path.join(ROOT, 'tools', 'split-layers.py'), pdf, out, '--tik', str(tik), '--title', title, '--scale', str(scale)])
    if rn and status == 'calibrated': json.dump(rn, open(os.path.join(out, 'renewal.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    elif os.path.exists(os.path.join(out, 'renewal.json')): os.remove(os.path.join(out, 'renewal.json'))
    man = json.load(open(os.path.join(out, 'manifest.json'), encoding='utf8')); unk = man.get('unassigned', []); share = len(unk)/max(1, man.get('cadTotal', 1))
    auto = dict(status=status, why=why or None, median=None if med is None else round(med, 2), inliers=None if not cal else round(cal['inliers'], 2), scale=scale, scaleSource=scale_src, anchor=gsrc if status == 'approx' else 'כיול מול מגרשי התב"ע',
                taba=(rn or {}).get('plan'), unknownShare=round(share, 3), unknownLayers=unk[:20], at=datetime.date.today().isoformat(), pdf=os.path.basename(pdf))
    json.dump(auto, open(os.path.join(out, 'auto.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    return auto

def register(tik, rel, title, auto):
    f = os.path.join(ROOT, 'layers', 'index.json')
    idx = json.load(open(f, encoding='utf8')) if os.path.exists(f) else {}
    idx[str(tik)] = dict(dir=rel, title=title, date=datetime.date.today().strftime('%d.%m.%Y'), renewal=auto['status'] == 'calibrated', auto=auto['status'])
    json.dump(idx, open(f, 'w', encoding='utf8'), ensure_ascii=False, indent=1)

def cloud_jobs(force=False):
    """תוכניות בענן עם PDF עם שכבות מהטופס, שאין להן מודל, או שה-PDF חדש מהמודל"""
    rows = rest('ashdod_plans?select=plan_key,data'); jobs = []
    for r in rows:
        p = r.get('data') or {}; tik = str(p.get('tik') or r['plan_key'].split('__')[0])
        docs = [d for d in (p.get('documents') or []) if isinstance(d, dict) and d.get('layers') and d.get('url')]
        if not docs or not re.match(r'^\d+$', tik): continue
        d = sorted(docs, key=lambda x: str(x.get('date', '')))[-1]
        aj = os.path.join(ROOT, 'layers', tik, 'auto.json')
        if tik == '1913' and not force: continue                     # 1913 כויל ידנית
        if os.path.exists(aj) and not force and json.load(open(aj, encoding='utf8')).get('pdf') == d.get('name'): continue
        jobs.append((tik, d, p))
    return jobs

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--all', action='store_true'); ap.add_argument('--tik'); ap.add_argument('--pdf'); ap.add_argument('--out')
    ap.add_argument('--no-taba', action='store_true'); ap.add_argument('--change', default=''); ap.add_argument('--lat', type=float); ap.add_argument('--lng', type=float); ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    if a.tik and a.pdf:
        plan = dict(change=a.change, planNum=a.tik, lat=a.lat, lng=a.lng)
        auto = build(a.tik, a.pdf, a.out or os.path.join(ROOT, 'layers', a.tik), plan, not a.no_taba, f'תיק {a.tik}')
        print(json.dumps(auto, ensure_ascii=False, indent=1)); return
    if not a.all: ap.error('צריך --all, או --tik עם --pdf')
    jobs = cloud_jobs(a.force); print('תוכניות להפקה:', [j[0] for j in jobs])
    for tik, d, p in jobs:
        print(f'\n== תיק {tik}: {d.get("name")}')
        try:
            f = os.path.join(tempfile.mkdtemp(), 'plan.pdf'); open(f, 'wb').write(get(d['url']))
            title = ' / '.join(x for x in (p.get('district'), p.get('location')) if x) or f'תיק {tik}'
            title = f'{title}: תוכנית פיתוח'
            auto = build(tik, f, os.path.join(ROOT, 'layers', tik), p, True, title); auto['pdf'] = d.get('name'); json.dump(auto, open(os.path.join(ROOT, 'layers', tik, 'auto.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
            register(tik, f'layers/{tik}', title, auto); print(json.dumps(auto, ensure_ascii=False))
        except Exception as e:
            print('  נכשל:', e)                                            # תוכנית אחת שנכשלה לא עוצרת את האחרות

if __name__ == '__main__': main()
