#!/usr/bin/env python3
"""טבלה 5 (זכויות והוראות בנייה) מתוך הוראות התב"ע, לכל מגרש ולכל שימוש (ענת, 24.11.2026).

שימוש:  python3 tools/table5.py <horaot.pdf> <תיק> --taba "תמל/2022" [--pages 19,20] [--src "<מאיפה הקובץ>"]
הפלט:   data/table5/<תיק>.json. הטופס לאדריכל (plans-opinion.js) בונה ממנו בלוק לכל מגרש, עם המותר כבר בפנים.

הקריאה: find_tables של PyMuPDF. העברית יוצאת הפוכה, ולכן כל מילה עברית מתהפכת וסדר המילים מתהפך, והמספרים נשארים.
עמודה מזוהה לפי מילות הכותרת שלה ושל הכותרת שמעליה. "(2)" היא הפניה להערה בהוראות, ולא ערך.
אחרי הקריאה כל מגרש נבדק מול plan_models ב-ASHDODMAP (יח"ד, גובה, קומות, גודל מגרש). אי־התאמה נרשמת ב-check, ונבדקת מול העמוד.
שום ערך לא מומצא: תא שלא נקרא נשאר ריק, עם הערך הגולמי.
"""
import sys, os, re, json, argparse, datetime, urllib.request, urllib.parse
import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEB = re.compile('[א-ת]')

def fix(s):
    """טקסט מהטבלה: בכל שורה, כל מילה עברית מתהפכת (האותיות יוצאות הפוכות). סדר המילים והשורות נכון כבר בקובץ. מספרים נשארים"""
    lines = [l.strip() for l in (s or '').split('\n') if l.strip()]
    flip = lambda t: t[::-1].translate(str.maketrans('()', ')(')) if HEB.search(t) else t
    t = re.sub(r'\s+', ' ', ' '.join(' '.join(flip(t) for t in l.split()) for l in lines)).strip()
    for a, b in (('שטחציבורי', 'שטח ציבורי'), ('תעסוקהומסחר', 'תעסוקה ומסחר'), ('מבניםומוסדות', 'מבנים ומוסדות'), ('דרךמוצעת', 'דרך מוצעת')): t = t.replace(a, b)
    t = re.sub(r"(מגורים|מסחר|תעסוקה)([א-ת]')", r'\1 \2', t)
    return t

# עמודה: מפתח, שם לתצוגה, יחידה, ותנאי על הכותרת המלאה (אב + משנה), בלי רווחים: בקובץ המילים לפעמים צמודות ("קובנין")
COLS = [
 ('lot',        'תא שטח',                  '',    lambda h: ('תאישטח' in h or 'תאשטח' in h) and 'תכסית' not in h),
 ('use',        'שימוש',                   '',    lambda h: h.startswith('שימוש')),
 ('zone',       'ייעוד',                   '',    lambda h: h.startswith('יעוד') or h.startswith('ייעוד')),
 ('building',   'בניין',                   '',    lambda h: ('מקום' in h or 'בניין' in h or 'בנין' in h) and 'קובנ' not in h and 'שטחי' not in h),
 ('lotSize',    'גודל מגרש',               'מ"ר', lambda h: 'גודל' in h and 'מגרש' in h),
 ('mainAbove',  'עיקרי מעל הכניסה',        'מ"ר', lambda h: 'שטחי' in h and 'מעל' in h and 'עיקרי' in h),
 ('servAbove',  'שירות מעל הכניסה',        'מ"ר', lambda h: 'שטחי' in h and 'מעל' in h and ('שירות' in h or 'שרות' in h)),
 ('mainBelow',  'עיקרי מתחת לכניסה',       'מ"ר', lambda h: 'שטחי' in h and 'מתחת' in h and 'עיקרי' in h),
 ('servBelow',  'שירות מתחת לכניסה',       'מ"ר', lambda h: 'שטחי' in h and 'מתחת' in h and ('שירות' in h or 'שרות' in h)),
 ('total',      'סה"כ שטחי בנייה',         'מ"ר', lambda h: 'שטחי' in h and ('סה"כ' in h or not re.search('מעל|מתחת', h))),
 ('coverage',   'תכסית',                   '%',   lambda h: 'תכסית' in h),
 ('units',      'יח"ד',                    '',    lambda h: 'יח"ד' in h and 'צפיפות' not in h),   # "צפיפות יח"ד לדונם" היא עמודה אחרת (603-0346031)
 ('height',     'גובה מבנה',               'מ\'', lambda h: 'גובה' in h),
 ('floorsAbove','קומות מעל הכניסה',        '',    lambda h: 'קומות' in h and 'מעל' in h),
 ('floorsBelow','קומות מתחת לכניסה',       '',    lambda h: 'קומות' in h and 'מתחת' in h),
 ('front',      'קו בניין קדמי',           'מ\'', lambda h: 'קובנ' in h and 'קדמי' in h),
 ('back',       'קו בניין אחורי',          'מ\'', lambda h: 'קובנ' in h and 'אחורי' in h),
 ('sideL',      'קו בניין צידי שמאלי',     'מ\'', lambda h: 'קובנ' in h and 'שמאלי' in h),
 ('sideR',      'קו בניין צידי ימני',      'מ\'', lambda h: 'קובנ' in h and 'ימני' in h),
 ('balcony',    'מרפסות בנוסף לעיקרי',     'מ"ר', lambda h: 'מרפסות' in h),
]
LABEL = {k: (l, u) for k, l, u, _ in COLS}
NUMERIC = [k for k, *_ in COLS if k not in ('lot', 'use', 'zone', 'building')]

def cell(raw):
    """ערך מספרי והערות. '(1)20361' = 20361 והערה 1. '1158 .' = 115.8 (נקודה עשרונית שנשברה). '(2)' = הערה בלבד"""
    s = re.sub(r'\s+', ' ', (raw or '').replace('\n', ' ')).strip()
    s = re.sub(r"[א-ת'\"]+", ' ', s)                          # בתא מספרי, אותיות באות רק מסימן המים ("מונה הדפסה") ושוברות את הסוגריים
    notes = re.findall(r'\(\s*(\d+)\s*\)', s); s2 = re.sub(r'\(\s*\d+\s*\)', ' ', s)
    m = re.search(r'(\d+)\s\.(?!\d)', s2)                      # "1158 ." → 115.8
    if m: v = float(m.group(1)[:-1] + '.' + m.group(1)[-1])
    else:
        nums = re.findall(r'\d+(?:\.\d+)?', s2.replace(',', ''))
        v = float(nums[0]) if len(nums) == 1 else None
    if v is not None and v == int(v): v = int(v)
    return v, notes, s

def headers(rows):
    """כמה שורות כותרת יש, והכותרת המלאה של כל עמודה. תא ממוזג: הכותרת ממשיכה לתאים הריקים שאחריו,
    אבל רק בתוך אותה כותרת אב (בשורה שמעליה), כדי שכותרת משנה לא תזלוג לעמודה של אב אחר"""
    n = 0
    for r in rows:
        if any(re.fullmatch(r'\d{1,4}', (c or '').strip()) for c in r[-4:]): break   # שורת נתונים: תא שטח מספרי
        n += 1
    hs = [[fix(c) for c in r] for r in rows[:n]]
    for j, row in enumerate(hs):
        for i in range(1, len(row)):
            same_parent = j == 0 or hs[j-1][i] == hs[j-1][i-1]
            if not row[i] and row[i-1] and same_parent and (j == 0 or rows[j][i] is None): row[i] = row[i-1]
    cols = [''.join(' '.join(dict.fromkeys(h[i] for h in hs if h[i])).split()) for i in range(len(rows[0]))]
    return n, cols

def parse(pdf, pages):
    d = pymupdf.open(pdf); out, head, colkeys, ncol = [], None, None, None
    for pg in pages:
        for tb in d[pg-1].find_tables().tables:
            if ncol and tb.col_count != ncol: continue
            rows = tb.extract(); ncol = ncol or tb.col_count
            n, cols = headers(rows)
            if n:                                              # עמוד עם כותרת: מיפוי העמודות
                colkeys = []
                for c in cols:
                    k = next((k for k, l, u, f in COLS if f(c)), None)
                    colkeys.append(k if k not in colkeys else None)
                head = cols
            if not colkeys: continue
            for r in rows[n:]:
                rec = dict(page=pg, raw={}, notes={})
                for i, c in enumerate(r):
                    k = colkeys[i] if i < len(colkeys) else None
                    if not k or not (c or '').strip(): continue
                    if k in ('use', 'zone', 'building'): rec[k] = fix(c)
                    elif k == 'lot':
                        m = re.search(r'\d+', c); rec['lot'] = m.group(0) if m else None
                    else:
                        v, notes, s = cell(c)
                        if v is not None: rec[k] = v
                        if notes: rec['notes'][k] = notes
                        if v is None and not notes and s.strip(): rec['raw'][k] = fix(s)
                if rec.get('lot'): out.append(rec)
    for r in out:
        r['total_row'] = 'סה"כ' in (r.get('building') or '')
        if not r.get('use') and not r['total_row']: r['use'] = r.get('zone') or ''   # מגרש עם ייעוד אחד: השימוש הוא הייעוד
        if not r['raw']: r.pop('raw')
        if not r['notes']: r.pop('notes')
    return out, head, colkeys

def table_notes(pdf, pages):
    """הערות הטבלה ("הערות לטבלת זכויות..."): מספר ← נוסח. הטקסט בקובץ שבור לשורות, ולכן מחברים ומנקים"""
    d = pymupdf.open(pdf); txt = ''
    for pg in range(min(pages)-1, min(max(pages)+2, len(d))): txt += d[pg].get_text() + '\n'
    i = txt.find('הערות לטבלת')
    if i < 0: return {}
    body = txt[i:].split('\n', 1)[1] if '\n' in txt[i:] else ''
    parts = re.split(r'\)\s*(\d{1,2})\s*[:.\s]*\(', '\n' + body)
    out = {}
    for k in range(1, len(parts)-1, 2):
        t = re.sub(r'\s+', ' ', parts[k+1]).strip()
        t = re.split(r" '?\s*רובע |שם התכנית|\d+\.\d+ |עמוד \d", t)[0]                 # עד כותרת העמוד או הסעיף הבא
        out[parts[k]] = t[:300].strip(' .')
    return out

def plan_info(pdf):
    """סעיף 1.2 "שטח התכנית" (דונם) וסוג התכנית, מתחילת ההוראות"""
    d = pymupdf.open(pdf); out = {}
    for i in range(min(10, len(d))):
        t = d[i].get_text()
        m = re.search(r'1\.2\s*שטח התכנית\s*([\d.,]+)\s*דונם', t)
        if m and 'planArea' not in out: out.update(planArea=float(m.group(1).replace(',', '')), planAreaPage=i+1)
        m = re.search(r'סוג התכנית\s*\n\s*([^\n]+)', t)
        if m and 'planType' not in out: out['planType'] = m.group(1).strip()
    return out

def model_lots(taba):
    key = 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3'
    q = 'https://cbhexpybdggwzyakgagd.supabase.co/rest/v1/plan_models?select=model->lots&plan_number=eq.' + urllib.parse.quote(taba)
    try:
        rows = json.loads(urllib.request.urlopen(urllib.request.Request(q, headers={'apikey': key}), timeout=60).read())
        return rows[0]['lots'] if rows else []
    except Exception as e: print('plan_models:', e); return []

def check(rows, mlots):
    """כל מגרש מול plan_models: יח"ד (סכום), גובה, קומות מעל, גודל מגרש (המרבי בשורות המגרש)"""
    res = []
    for L in mlots:
        lot = str(L.get('lot')); rs = [r for r in rows if r['lot'] == lot and not r.get('total_row')]
        if not rs:                                             # שביל או דרך: אין לו זכויות בנייה, ולכן גם אין לו שורה בטבלה
            nil = not any(L.get(k) for k in ('units', 'height_m', 'floors_above', 'main_above'))
            res.append(dict(lot=lot, ok=nil, why='בלי זכויות בנייה' if nil else 'המגרש לא נמצא בטבלה')); continue
        got = dict(units=sum(r.get('units') or 0 for r in rs) or None, height=max([r['height'] for r in rs if 'height' in r] or [None], key=lambda x: x or 0),
                   floorsAbove=max([r['floorsAbove'] for r in rs if 'floorsAbove' in r] or [None], key=lambda x: x or 0), lotSize=max([r['lotSize'] for r in rs if 'lotSize' in r] or [None], key=lambda x: x or 0))
        want = dict(units=L.get('units'), height=L.get('height_m'), floorsAbove=L.get('floors_above'), lotSize=L.get('lot_size'))
        bad = {k: [got[k], want[k]] for k in want if want[k] not in (None, '') and got[k] is not None and abs(float(got[k]) - float(want[k])) > 0.6}
        res.append(dict(lot=lot, ok=not bad, diff=bad) if bad else dict(lot=lot, ok=True))
    return res

def xls_check(path, rows):
    """טבלת הזכויות של תכנון זמין (HTML): כל שורה (תא שטח ושימוש) מול מה שנקרא מההוראות"""
    import html as H
    t = open(path, 'rb').read().decode('utf-8', 'replace'); got = []
    num = lambda s: (lambda m: float(m.group(0)) if m else None)(re.search(r'\d+(?:\.\d+)?', re.sub(r'\(\d+\)', '', s or '')))
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', t, re.S):
        c = [H.unescape(re.sub(r'<[^>]+>', '', x)).strip() for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)]
        if len(c) >= 16 and re.fullmatch(r'\d+', c[3] or '') and c[2] and not c[0].startswith('סך'):   # בלי שורת הסיכום
            got.append(dict(lot=c[3], use=c[2], lotSize=num(c[5]), mainAbove=num(c[6]), servAbove=num(c[7]), total=num(c[9]), coverage=num(c[11]), units=num(c[12]), height=num(c[14]), floorsAbove=num(c[15])))
    diff = []
    for g in got:
        r = next((r for r in rows if r['lot'] == g['lot'] and (r.get('use') or '').startswith(g['use'][:4])), None)
        if not r: diff.append(dict(lot=g['lot'], use=g['use'], why='לא נקרא מההוראות')); continue
        bad = {k: [r.get(k), v] for k, v in g.items() if k not in ('lot', 'use') and v is not None and r.get(k) is not None and abs(float(r[k]) - v) > 0.01}
        if bad: diff.append(dict(lot=g['lot'], use=g['use'], diff=bad))
    return dict(source=os.path.basename(path), rows=len(got), ok=bool(got) and not diff, diff=diff)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('pdf'); ap.add_argument('tik'); ap.add_argument('--taba', required=True)
    ap.add_argument('--pages', default=''); ap.add_argument('--src', default=''); ap.add_argument('--fixes', default='', help='קובץ JSON של תיקונים ידניים מול העמוד')
    ap.add_argument('--xls', default='', help='טבלת הזכויות של תכנון זמין (HTML בסיומת xls): בדיקה שנייה, כשאין לתב"ע plan_models')
    ap.add_argument('--lots', default='', help='רק המגרשים של תוכנית הבינוי, למשל 3,15,19,20,21')
    a = ap.parse_args()
    doc = pymupdf.open(a.pdf)
    if a.pages: pages = [int(x) for x in a.pages.split(',')]
    else:                                                      # מהעמוד הראשון של הטבלה, ברצף, כל עמוד שיש בו טבלה
        first = next(i for i, p in enumerate(doc) if ('טבלת זכויות' in p.get_text() or 'זכויות והוראות בניה' in p.get_text()) and p.find_tables().tables)
        pages = [first+1]
        ncol = doc[first].find_tables().tables[0].col_count       # אותה טבלה: אותו מספר עמודות. טבלה אחרת בעמוד הבא היא כבר לא טבלה 5
        while pages[-1] < len(doc) and any(t.col_count == ncol for t in doc[pages[-1]].find_tables().tables): pages.append(pages[-1]+1)
    rows, head, keys = parse(a.pdf, pages)
    ff = a.fixes or os.path.join(ROOT, 'data', 'table5', f'{a.tik}.fix.json')     # תיקונים ידניים, שנקראו מהעמוד
    fx = json.load(open(ff, encoding='utf8')) if os.path.exists(ff) else {}
    fixes = fx.get('cells', [])
    for r in fx.get('rows', []):                               # שורה שלא נקראה אוטומטית (עמוד המשך עם מבנה עמודות אחר), נקראה מצילום העמוד
        r = dict(r); r['lot'] = str(r['lot']); r.setdefault('total_row', False); r['fixed'] = {'row': fx.get('source', 'נקרא מהעמוד')}; rows.append(r)
    if a.lots: keep = set(a.lots.split(',')); rows = [r for r in rows if r['lot'] in keep]
    for f in fixes:                                            # תיקון ידני: {lot, use, key, value, why}
        r = next((r for r in rows if r['lot'] == str(f['lot']) and r.get('use') == f.get('use')), None)
        if r: r[f['key']] = f['value']; r.setdefault('fixed', {})[f['key']] = f['why']
    used = [k for k in NUMERIC if any(k in r or k in r.get('notes', {}) for r in rows)]
    notes = table_notes(a.pdf, pages); notes.update(fx.get('notes', {}))
    chk = check(rows, [L for L in model_lots(a.taba) if not a.lots or str(L.get('lot')) in a.lots.split(',')])
    xls = xls_check(a.xls, rows) if a.xls else None
    if xls: print('  מול טבלת תכנון זמין:', 'הכול תואם' if xls['ok'] else xls['diff'])
    out = dict(tik=str(a.tik), xls=xls, taba=a.taba, source=a.src or os.path.basename(a.pdf), pages=pages, **plan_info(a.pdf), readAt=datetime.date.today().isoformat(),
               lots=a.lots.split(',') if a.lots else None, columns=[dict(key=k, label=LABEL[k][0], unit=LABEL[k][1]) for k in used], notes=notes, rows=rows, check=chk, fixes=fixes, notesFixed=sorted(fx.get('notes', {}), key=int), fixSource=fx.get('source'))
    os.makedirs(os.path.join(ROOT, 'data', 'table5'), exist_ok=True)
    f = os.path.join(ROOT, 'data', 'table5', f'{a.tik}.json'); json.dump(out, open(f, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    lots = sorted({r['lot'] for r in rows}, key=lambda x: int(x))
    print(f'{a.tik}: {len(rows)} שורות, {len(lots)} מגרשים, עמודות: {", ".join(LABEL[k][0] for k in used)}')
    print('  הערות:', notes)
    print('  מיפוי עמודות:', [(h, k) for h, k in zip(head or [], keys or [])])
    bad = [c for c in chk if not c['ok']]; print('  מול plan_models:', 'הכול תואם' if not bad else bad)

if __name__ == '__main__': main()
