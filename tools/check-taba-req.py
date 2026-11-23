#!/usr/bin/env python3
"""בדיקת דרישות התב"ע (data/taba/<תיק>.json) מול הוראות התוכנית: כל ציטוט חייב להופיע במסמך, מילה במילה.

שימוש:  python3 tools/check-taba-req.py <horaot.pdf> data/taba/<תיק>.json
הנרמול: רווחים ושבירות שורה מאוחדים, ופיסוק וסוגריים מוסרים. מילים עבריות נבדקות גם הפוכות (בטבלאות ה-PDF העברית יוצאת הפוכה).
"""
import sys, re, json
import pymupdf

def norm(s):
    s = re.sub(r'[\s‏‎]+', ' ', s or '')
    s = re.sub(r'[.,:;"\'()\[\]\-–—׳״!?/\\]+', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def main():
    pdf, jf = sys.argv[1], sys.argv[2]
    d = pymupdf.open(pdf); full = norm(' '.join(p.get_text() for p in d))
    flipped = norm(' '.join(' '.join(w[::-1] if re.search('[א-ת]', w) else w for w in p.get_text().split()) for p in d))
    data = json.load(open(jf, encoding='utf8')); bad = []; items = []
    if data.get('purpose'): items.append(('purpose', data['purpose']))
    items += [('party ' + x.get('role', ''), x) for x in data.get('parties', [])]
    items += [(x.get('id', '?'), x) for x in data.get('requirements', [])]
    for k, x in items:
        q = norm(x.get('quote', ''))
        if len(q.split()) < 3: bad.append((k, 'ציטוט קצר מדי או חסר')); continue
        if q not in full and q not in flipped: bad.append((k, 'הציטוט לא נמצא במסמך: ' + q[:80]))
        if not x.get('section') or not x.get('page'): bad.append((k, 'חסר סעיף או עמוד'))
    reqs = data.get('requirements', [])
    print(f"{data.get('tik')}: {len(reqs)} דרישות, {len(data.get('parties', []))} בעלי עניין, מטרה: {'כן' if data.get('purpose') else 'לא'}")
    for k, why in bad: print('  ✗', k, why)
    if bad: sys.exit(1)
    print('  ✓ כל הציטוטים נמצאו במסמך')

if __name__ == '__main__': main()
