#!/usr/bin/env python3
"""מפריד תוכנית פיתוח (PDF מ-AutoCAD עם שכבות) לנושאים, לשימוש במסך "שכבות" (plans-layers.js).

שימוש:  python3 tools/split-layers.py <plan.pdf> <layers/שם-תיקייה> [--tik 1913] [--title "..."] [--scale 250]
דורש:   pip install pymupdf pillow numpy scipy

מה יוצא: תמונה שקופה (webp) לכל נושא, ו-manifest.json עם שמות שכבות השרטוט שנכנסו לכל נושא
ועם מדידות שטח (הערכה מהפיקסלים, לפי קנה המידה).
השיוך נעשה לפי שם השכבה בשרטוט. שכבה שלא זוהתה נכנסת ל"לא משויך", ומדווחת בסוף הריצה.
"""
import sys, json, re, os, argparse
import numpy as np
import pymupdf as fitz
from PIL import Image

# סדר הערימה: מלמטה למעלה. לכל נושא: מזהה, שם, וכללי שיוך (ביטוי רגולרי על שם השכבה המלא).
GROUPS = [
 ('site',  'גבולות מגרש וקווי בניין', r'\|?(1801|1802|16\d\d|pcell|scellno.*|pgvul1|likb|pzikab1|PZIKAB2|hadpasa|olwall|0l-kav martef|0l-gvul-dipun|C-PROP-LINE|A-AREA-.*)$'),
 ('road',  'כבישים ותנועת רכב', r'(ol-asfalt|olcurb\d?|olline.*|OLLINE|oldim|oltext|olnom.*|OLNOM.*|OLLOGO1|OLZEVA1|ol-mabat|ol-idkun|olpit|srozeta|ol-ofnoa-l|\|(24228|28|73|26)|AM-(BRT|Curb.*|Dim|Future|Road Name|Bumper|tamrur.*|Tamrur.*|agbha|TA-Number|tahana|Amud|Paint.*)|Am-Paint|Am-shot|z-derech|24000-H|24501|0-tamrur|0-tic|0-DIM|0-HAT|0-PLAN-text|0-xref_.*|bez-(road|paint|dim|text|kir)|BEZ-SV.*|1KVISH|1EVEN-SAFA|40-even_safa|40-shlatim|40-tahana.*|40-elements tahana)$'),
 ('walk',  'הולכי רגל, ריצוף ונגישות', r'(0l-hatch ?rizuf|0l-htc-rizuf.*|ol-midr|ol-rizuf|KSM-S-rizuf.*|KSM-S-Bin|40-ritsof.*|AM-Ritsuf|0-ritzuf|0l-pasim|PASEI EATA|madregot|ghmadregot|0l-madregot|G-RIZ|GV-RIZUF|0l-Maachaz-Yad|0l-maake.*|1MAAKE|40-maake.*|knisa|delet|shaar)$'),
 ('green', 'גינון ושטחי חלחול', r'(0l-ginun|0l-hatch ginun.*|0l-htc-ginun.*|0l-htc-green|0l-midshaa|40-ginon.*|KSM-S-GARDEN.*|40-tuff|SIHIM|0l-even gan|1EVEN-GAN|40-evengan|KSM-L-EVNGAN|0-Even gan)$'),
 ('park',  'חניה, רמפות ופריקה', r'(C-PRKG.*|0l-htc-hanaya.*|bez-ramp|rampa|0l-hatch misaa|bez-level)$'),
 ('bike',  'אופניים', r'(ol-ofanaim.*|40-shvil ofnayim|40-ofanayim|AM-Ofnim|Am-bike|K-OFNAYIM\d|K-MITKAN-OF)$'),
 ('level', 'מפלסים, קירות וגדרות', r'(0l-gova|KSM-L-Miflas|KSM-L-Topo|KSM-L-KAVGOVA TEXT|TR_REG|0-govah|2604|0l-kir|1KIR-EVEN|40-wall|ggader|1GADER-RESHET|1TERACE_TOP)$'),
 ('build', 'מבנים: קומת הקרקע', r'(^biny-karka\|.*|\|(A-(WALL|GLAZ|DOOR|DETL|FLOR|GENM).*|S-(COLS|STRS).*|I-FURN|G-ANNO.*)|hatch mivne|1BATIM|G-KIR|G-GAG|GAGON|EX-WALL.*)$'),
 ('shade', 'הצללה, ריהוט ושהייה', r'(0l-hatch pergula|0l-pergula|pergula|h-skaka|0l-KIRUY-.*|0l-safsal.*|safsal|KSM-L-Safsal|40-SAFSAL.*|rihut|40-rihot.*|0l-playground|SHULHAN|kise|LA-ELEMENT|40-elements|0l-deck)$'),
 ('trees', 'עצים: קיימים ומוצעים', r'(0l-tree.*|be-tree-kayam|40-trees.*|KSM-L-TREE.*|2TREE_PT|0l-b-g-tree|shazap|SYMBOLS|KSM-L-Guma)$'),
 ('water', 'מים, ביוב וניקוז', r'(z-maim|Z-BIUV|2WATER_PT|mispur biuv|10-zaneret|10-qoter|S_WATER-.*|nikuz|NIKUZ|0l-nikuzim|sharvul|1COVER|1MAAVIR-GISHRON|\|ta)$'),
 ('power', 'חשמל, תאורה, תקשורת וגז', r'(2ELECT_PT|2TEURA_PT|TEU_AMUD.*|0l-light|KSM-L-Lighting|0l-trafo-ttk|S_ELEC-.*|amud|aron|argaz|2TELE_PT|TA TIKSHORET|b-tikshoret|S_PHONE-.*|gaz|0l-gaz|KSM-E KOR)$'),
 ('waste', 'אשפה ומיחזור', r'(PAH|0l-mihzur|tomeh)$'),
 ('fire',  'חירום וכיבוי אש', r'(kiboy ash|kib ash2|0-Fire expansion|0l-timron)$'),
 ('anno',  'טקסט, מידות וגיליון', r'(text|0l-te?xt|0TEXT|0l-dim.*|TR_ANOT.*|TR_GIL.*|0l-gilayon|l-gilayon|^0|Layer 1|0-LOGO1|MROZETA|tr_hetz|KSM-L-(TEXT|DIM|SIMON)|S_DETAIL-.*|M2801|2NEW_PT|2PNT_PRATIM|2LOCAL_PT|c251|0l-anana|Xref_Entity.*)$'),
]
# מה נמדד בשטח (מ"ר): מילויים בלבד, לא קווים
AREA = {
 'green': r'(0l-ginun|0l-hatch ginun.*|0l-htc-ginun.*|0l-htc-green|0l-midshaa|KSM-S-GARDEN.*|40-ginon)$',
 'walk':  r'(0l-hatch ?rizuf|0l-htc-rizuf.*|KSM-S-rizuf.*|ol-rizuf)$',
 'shade': r'(0l-hatch pergula|0l-deck|0l-playground)$',
}
CROP = (0.040, 0.027, 0.808, 0.975)   # מסגרת השרטוט בלי המקרא ובלי כותרת הגיליון (חלק מרוחב וגובה הדף)
SCALE = 250                            # קנה מידה 1:250

def short(n): return n.split('|')[-1].split('$0$')[-1]

def classify(name):
    for gid, _, rx in GROUPS:
        if re.search(rx, name): return gid
    return None

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('pdf'); ap.add_argument('out')
    ap.add_argument('--tik', default=''); ap.add_argument('--title', default=''); ap.add_argument('--width', type=int, default=1600); ap.add_argument('--scale', type=float, default=SCALE)
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    doc = fitz.open(a.pdf); ui = doc.layer_ui_configs()
    if not ui: sys.exit('בקובץ אין שכבות שרטוט. צריך PDF שיוצא מ-AutoCAD עם שכבות.')
    page = doc[0]; R = page.rect
    clip = fitz.Rect(R.width*CROP[0], R.height*CROP[1], R.width*CROP[2], R.height*CROP[3])
    zoom = a.width / clip.width; mat = fitz.Matrix(zoom, zoom)
    m_per_px = (1/72*0.0254*a.scale) / zoom          # מטר לפיקסל
    by = {}; un = []
    for u in ui:
        g = classify(u['text'])
        (by.setdefault(g, []) if g else un).append(u)
    def render(nums):
        for u in ui: doc.set_layer_ui_config(u['number'], action=2)
        for n in nums: doc.set_layer_ui_config(n, action=0)
        pm = doc[0].get_pixmap(matrix=mat, clip=clip, alpha=True)
        return np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.h, pm.w, 4).copy()
    # הקו הכחול: מסכת פנים המגרש (שכבה 1801), למדידת שטחים בתוכו
    blue = [u['number'] for u in ui if short(u['text']) == '1801']
    inside = None
    if blue:
        from PIL import ImageDraw, ImageFilter
        al = Image.fromarray(((render(blue)[..., 3] > 10)*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
        wall = np.array(al) > 0; wall[:8, :] = wall[-8:, :] = wall[:, :8] = wall[:, -8:] = True   # שולי הגיליון סוגרים קו שיוצא מהמסגרת
        ys, xs = np.where(np.array(al) > 0)
        from scipy import ndimage
        lab, _ = ndimage.label(~wall)                                                           # אזורים סגורים בין הקווים
        inside = lab == lab[int(ys.mean()), int(xs.mean())]                                     # האזור שבמרכז הקו
        print("פנים הקו הכחול:", round(float(inside.mean()), 3))
        if inside.mean() < 0.02 or inside.mean() > 0.8: inside = None
    out = []; H = W = 0
    for gid, label, _ in GROUPS:
        us = by.get(gid, [])
        if not us: continue
        arr = render([u['number'] for u in us]); H, W = arr.shape[:2]
        if gid == 'site': arr[(arr[..., :3].min(-1) > 235)] = 0     # מילוי לבן של מדידה: שקוף
        ink = float((arr[..., 3] > 30).mean())
        if ink == 0: continue
        Image.fromarray(arr, 'RGBA').save(os.path.join(a.out, gid+'.webp'), quality=82, method=6)
        rec = dict(id=gid, name=label, file=gid+'.webp', ink=round(ink*100, 2), cad=sorted({short(u['text']) for u in us}))
        if gid in AREA:
            nums = [u['number'] for u in us if re.search(AREA[gid], u['text'])]
            if nums:
                m = render(nums)[..., 3] > 60
                rec['area'] = round(float(m.sum())*m_per_px**2)
                if inside is not None: rec['areaIn'] = round(float((m & inside).sum())*m_per_px**2)
        out.append(rec); print(f'{gid:6} {len(us):3} שכבות  כיסוי {ink*100:5.2f}%  {rec.get("area","")}')
    # תמונת התוכנית המלאה, כמו שהוגשה (להשוואה)
    for u in ui: doc.set_layer_ui_config(u['number'], action=0)
    pm = doc[0].get_pixmap(matrix=mat, clip=clip, alpha=False)
    Image.frombytes('RGB', (pm.w, pm.h), pm.samples).save(os.path.join(a.out, 'full.webp'), quality=80, method=6)
    man = dict(tik=a.tik, title=a.title, source=os.path.basename(a.pdf), scale=a.scale, w=W, h=H, mPerPx=round(m_per_px, 5),
               cadTotal=len(ui), unassigned=sorted({short(u['text']) for u in un}), layers=out)
    if inside is not None: man['siteArea'] = round(float(inside.sum())*m_per_px**2)
    json.dump(man, open(os.path.join(a.out, 'manifest.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('לא משויך:', man['unassigned']); print('שטח בתוך הקו הכחול (הערכה):', man.get('siteArea'), 'מ"ר')

if __name__ == '__main__': main()
