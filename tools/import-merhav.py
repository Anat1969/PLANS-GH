#!/usr/bin/env python3
"""בונה את data/merhav-import.json: מה שיש באפליקציה "מרחב מדבר" (הדשבורד של אדריכלית העיר) על תוכניות הבינוי.

שימוש:  python3 tools/import-merhav.py <binui_projects.json> <project_attachments.json> <plans.json>
הקלט: ייצוא לקריאה בלבד של הטבלאות binui_projects ו-project_attachments מ"מרחב מדבר" (Supabase brvjdkvhhmiefwssjryc),
      ורשימת התוכניות כפי שהאפליקציה טוענת אותן (planNum לכל תוכנית).
השיוך: לפי מספר תוכנית הבינוי (תב/XXXX) שבשם הרשומה. בלי מספר: לפי התב"ע (תמל/2022 = תמל 2022).
הקובץ לא דורס דבר. plans-import.js ממלא ממנו רק שדה ריק, ומסמן אותו בכחול.
"""
import json, re, sys, os, datetime

def flat(details):
    out = {}
    for v in (details or {}).values():
        if isinstance(v, dict):
            for k, x in v.items():
                if str(x).strip(): out[k] = str(x).strip()
    return out

def pick(f, *keys):
    for k in keys:
        if f.get(k): return f[k]
    return ''

def iso(d):
    m = re.match(r'^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$', d or '')
    if not m: return ''
    try: return datetime.date(int(m[3]), int(m[2]), int(m[1])).isoformat()
    except ValueError: return ''

num = lambda s: (re.search(r'(1[6-9]\d\d)', str(s or '')) or [None, None])[1]
nz = lambda s: re.sub(r'[\s/]', '', str(s or ''))
JUNK = re.compile(r'^[0\-]+$|^1{3}-1+$|^חפא$')        # ערכי בדיקה ("רובע מיוחד" בדשבורד)

def main():
    B = json.load(open(sys.argv[1], encoding='utf8')); A = json.load(open(sys.argv[2], encoding='utf8')); P = json.load(open(sys.argv[3], encoding='utf8'))
    byNum = {}
    for p in P: byNum.setdefault(num(p.get('planNum')), []).append(p)
    att = {}
    for a in A:
        if a.get('project_type') == 'binui': att.setdefault(str(a['project_id']), []).append(a)
    out, skipped = {}, []
    for x in B:
        f = flat(x.get('details'))
        if any(JUNK.match(v) for v in f.values()) or not (f or x.get('note') or att.get(str(x['id']))):
            skipped.append(x['name']); continue
        n = num(x['name']) or num(pick(f, 'plan_detail', 'מספר_תוכנית_בינוי'))
        tgt = byNum.get(n) if n else None
        po = pick(f, 'plan_overall')
        if not tgt and po: tgt = [p for p in P if nz(p.get('change')) and nz(p.get('change')) == nz(po)]
        if not tgt: skipped.append(x['name']); continue
        fields = {}
        put = lambda k, v: v and fields.setdefault(k, v)
        put('developer', pick(f, 'developer', 'יזם'))
        put('submitter', pick(f, 'architect', 'אדריכל'))
        put('meta.archName', pick(f, 'architect', 'אדריכל'))
        put('meta.archPhone', pick(f, 'architect_phone', 'טלפון_אדריכל'))
        put('meta.archEmail', pick(f, 'architect_email', 'מייל_אדריכל'))
        put('meta.archAddress', pick(f, 'architect_address', 'כתובת_אדריכל'))
        put('meta.devPhone', pick(f, 'developer_phone', 'טלפון_יזם'))
        put('meta.devEmail', pick(f, 'developer_email', 'מייל_יזם'))
        put('meta.devAddress', pick(f, 'developer_address', 'כתובת_יזם'))
        put('meta.contactName', pick(f, 'manager', 'מנהל_פרויקט'))
        put('meta.contactPhone', pick(f, 'manager_phone', 'טלפון_מנהל_פרויקט'))
        put('meta.contactEmail', pick(f, 'manager_email', 'מייל_מנהל_פרויקט'))
        put('meta.address', pick(f, 'street'))
        put('meta.compound', pick(f, 'compound'))
        # "גוש" בדשבורד: מספר בן 4 ספרות הוא גוש. ערך אחר (601, "מנגו 4") הוא מגרש, ולא נכנס לשדה גוש
        blk, lot = pick(f, 'block', 'גוש'), pick(f, 'parcel', 'חלקה')
        if re.match(r'^\d{4}\b', blk):
            put('meta.block', blk)
            if lot: put('meta.lot', re.sub(r'^גוש\s*\d+\s*:\s*', '', lot))
            put('parcel', 'גוש ' + blk + (' חלקה ' + fields.get('meta.lot', '') if fields.get('meta.lot') else ''))
        elif blk: put('meta.plotsMm', blk)
        if po and not JUNK.match(po) and not (n and num(po) == n): put('meta.zoningPlan', po); put('change', po)
        put('meta.zoningDetailed', pick(f, 'מספר_תבע_מפורטת'))
        put('date', iso(pick(f, 'date')))
        note = (x.get('note') or '').strip()
        if note: put('projectDescription', note)
        if note and len(note) < 700: put('opinion.description', note)
        dept = {k: (v.get('quote') if isinstance(v, dict) else str(v)) for k, v in (x.get('consultant_notes') or {}).items() if v}
        docs, seen = [], set()
        img = x.get('images') or {}
        for k, label in (('tashrit', 'תשריט'), ('hadmaya', 'הדמיה'), ('tza', 'צילום אוויר')):
            if isinstance(img, dict) and img.get(k) and img[k] not in seen: seen.add(img[k]); docs.append({ 'name':label, 'type':label, 'url':img[k] })
        for a in att.get(str(x['id']), []):
            if a['file_url'] not in seen: seen.add(a['file_url']); docs.append({ 'name':a['name'], 'type':'', 'url':a['file_url'], 'date':str(a.get('created_at', ''))[:10] })
        rec = { 'mm':x['name'], 'mmId':x['id'], 'fields':fields, 'docs':docs }
        if dept: rec['dept'] = dept
        for p in tgt:
            key = p['planNum']
            if key in out: out[key]['fields'] = { **rec['fields'], **out[key]['fields'] }; out[key]['docs'] += [d for d in docs if d['url'] not in {y['url'] for y in out[key]['docs']}]
            else: out[key] = json.loads(json.dumps(rec))
    res = { 'source':'מרחב מדבר: הדשבורד של אדריכלית העיר', 'readAt':datetime.date.today().isoformat(), 'plans':out, 'notMatched':skipped }
    os.makedirs('data', exist_ok=True)
    json.dump(res, open('data/merhav-import.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    nf = sum(len(v['fields']) for v in out.values()); nd = sum(len(v['docs']) for v in out.values())
    print(f'{len(out)} תוכניות, {nf} ערכים, {nd} מסמכים. לא שויכו: {len(skipped)}'); print(' ', skipped)

if __name__ == '__main__': main()
