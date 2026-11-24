#!/usr/bin/env python3
"""הדמיות לדף הכניסה הציבורי (ענת, 24.11.2026): מ"מרחב מדבר", הדשבורד של אדריכלית העיר.
קורא את data/merhav-import.json, מוריד לכל תוכנית את ההדמיה הראשית (סוג "הדמיה", ואם אין, "הדמיה" בשם),
מקטין ל-640 פיקסלים, ושומר renders/<מספר תוכנית>.webp. העותק בריפו: הדף נטען מהר, לא תלוי באחסון של
"מרחב מדבר", ולא חושף כתובות אחסון. data/renders.json: מספר תוכנית -> קובץ, עם מקור, שם המסמך ותאריך.
שימוש: python3 tools/city-renders.py"""
import io, json, os, re, sys, urllib.request
from PIL import Image

root = os.path.join(os.path.dirname(__file__), '..')
D = json.load(open(os.path.join(root, 'data/merhav-import.json'), encoding='utf-8'))
os.makedirs(os.path.join(root, 'renders'), exist_ok=True)
IMG = re.compile(r'\.(png|jpe?g|webp)$', re.I)
# נבדק בעין (24.11.2026): מסמך מסוג "הדמיה" שאינו הדמיה
SKIP = {'1811': 'תוכנית קומה, לא הדמיה'}
out = {}
for key, rec in D['plans'].items():
    num = re.sub(r'\D', '', key)
    docs = [d for d in rec.get('docs', []) if IMG.search(d['url'].split('?')[0])]
    pick = next((d for d in docs if d.get('type') == 'הדמיה'), None) or next((d for d in docs if re.search(r'הדמי', d.get('name', ''))), None)
    if not num or not pick or num in SKIP: continue
    try:
        raw = urllib.request.urlopen(pick['url'], timeout=60).read()
        im = Image.open(io.BytesIO(raw)).convert('RGB')
    except Exception as e:
        print('נכשל', key, e, file=sys.stderr); continue
    if im.width > 640: im = im.resize((640, round(im.height * 640 / im.width)), Image.LANCZOS)
    path = f'renders/{num}.webp'
    im.save(os.path.join(root, path), 'WEBP', quality=78, method=6)
    out[num] = {'img': path, 'src': 'מרחב מדבר, הדשבורד של אדריכלית העיר', 'name': pick.get('name') or pick.get('type'), 'date': pick.get('date') or D.get('readAt')}
    print(key, path, os.path.getsize(os.path.join(root, path)) // 1024, 'KB')
json.dump({'read': D.get('readAt'), 'renders': out}, open(os.path.join(root, 'data/renders.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), 'הדמיות')
