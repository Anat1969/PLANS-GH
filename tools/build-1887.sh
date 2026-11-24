#!/bin/bash
# בניית המודל של נאות ספיר (1887) מכל המקורות, לפי הסדר. $1 = תיקייה עם קובצי המקור מהדרייב (שקפי המצגת כתמונות, ה-PDF מה-zip)
# 1. תוכנית ההעמדה מהמצגת (siteplan-model.py): עיגון, מבנים, חלקי בניין, שימושים, מרתף ועצי סקר
# 2. תוכנית הפיתוח הווקטורית 4215-J-1 (vector-model.py): כל שכבות הפיתוח ומפת המדידה
# 2א. נספח העצים הבוגרים של התב"ע (annex-trees.py): כל עצי הסקר עם סטטוס, וקו המרתף מתוכנית המרתף שבאותו גיליון. הקובץ: $D/annex/trees.pdf
# 3. חוברת העיצוב (infra-from-page.py): ניקוז, מים, ביוב, שוחות, הידרנטים ומדי מים
# 4. מפלסים והליכה, מהמודל הסופי
set -e; D="$1"; cd "$(dirname "$0")/.."
python3 -W ignore tools/siteplan-model.py --tik 1887 --img "$D/img/plan7_0.jpeg" --typical "$D/img/plan9_0.jpeg" --basement "$D/img/mazeget16_0.jpeg" \
  --spec data/siteplan/1887.json --plan-models "$D/pm2024.json" --title 'מתחם הרצל - נאות ספיר' \
  --src-name 'מצגת חזיתות נאות ספיר 19.07.2026, שקפים 7, 9, 10; מצגת אדריכלות 22.12.2025, שקף 16' \
  --gcp "$(python3 -c "import json;print(json.load(open('data/siteplan/1887.json'))['gcp'])")"
python3 -W ignore tools/vector-model.py data/vector/1887.json "$D/zip/x/4215-J-1.pdf"
python3 -W ignore tools/annex-trees.py --tik 1887 --annex "$D/annex/trees.pdf" --ref "$D/zip/x/4215-J-1.pdf"
python3 -W ignore tools/infra-from-page.py "$D/zip/x/חוברת עיצוב אשדוד נאות ספיר 05.10.2026.pdf" --tik 1887 --spec data/infra/1887.json
python3 -W ignore tools/extract-levels.py --tik 1887
python3 -W ignore tools/extract-walk.py --tik 1887
python3 -W ignore tools/floors-from-parts.py --tik 1887 --spec data/siteplan/1887.json --pdf "$D/zip/x/4215-J-1.pdf"
