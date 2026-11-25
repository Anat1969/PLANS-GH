# סכמת נתונים משותפת (הצעה)

**מצב: הצעה. לא הוחלה במסד.** היא מוסיפה טבלאות ולא משנה את הקיימות. ההחלה מחכה לאישור של ענת, כי זה שינוי במסד בייצור.

## 1. מזהים יציבים
| ישות | מזהה | דוגמה | הערה |
|---|---|---|---|
| תוכנית סטטוטורית (תב"ע) | `plan_number` מנורמל | `תמל/2023`, `603-0477232` | הקיים. נרמול: בלי רווחים |
| מתחם | `compound_id` (uuid) | | היום `plan_projects.id`. מתחם אחד יכול לחול על כמה תב"עות |
| תוכנית בינוי | `building_plan_id` = מספר תוכנית הבינוי | `תב/1815` | לא `tik`. תב"ע אחת, כמה תוכניות בינוי |
| מגרש | `lot_id` = `plan_number#lot` | `תמל/2023#3` | יציב כל עוד התב"ע לא משתנה |
| מבנה | `building_id` = `building_plan_id#letter` | `תב/1913#A` | |
| מודל | `model_id` (uuid) וגרסה | | כל בנייה מחדש היא גרסה חדשה |

## 2. ארבעה ממדי סטטוס (`STATUS` בתקן)
אין הסקה ביניהם. מודל מאושר אינו אישור תוכנית, ולהפך.
1. **סטטוטורי** (של התב"ע): קיים, בתכנון, בהפקדה, מאושרת, היתר, בביצוע, הושלם.
2. **טיפול בתוכנית הבינוי:** אין, בהכנה, בטיפול, אושרה.
3. **רמת פירוט:** קיים (גובה סמלי), נפח לפי התב"ע, תכנון רעיוני, מודל אדריכלי מפורט.
4. **אישור המודל:** גרסת עבודה, מודל מאושר, הערכה.

## 3. טבלאות מוצעות
```sql
-- מוסיף בלבד. דרך חזרה: drop table twin_model_versions, twin_links;
create table twin_links (            -- קשר תב"ע לתוכנית בינוי, אחד לרבים
  plan_number text not null,
  building_plan_id text not null,
  lots int[] not null default '{}',  -- המגרשים שתוכנית הבינוי מכסה. ריק = לא ידוע
  source text not null,              -- מאיפה השיוך (תיק, מסמך, ידני)
  updated_at timestamptz not null default now(),
  primary key (plan_number, building_plan_id)
);
create table twin_model_versions (
  model_id uuid primary key default gen_random_uuid(),
  subject text not null,             -- plan_number או building_plan_id
  lod text not null check (lod in ('existing','massing','concept','detailed')),
  approval text not null check (approval in ('working','approved','estimate')),
  statutory text,                    -- תמונת מצב של הסטטוס הסטטוטורי בעת הבנייה
  geometry jsonb not null,
  source text not null, source_date date,
  created_at timestamptz not null default now(),
  active boolean not null default false,     -- הגרסה המוצגת כברירת מחדל
  approved_at timestamptz, approved_by text  -- רק אישור מפורש ממלא את אלה
);
create unique index on twin_model_versions(subject) where active;
-- RLS: קריאה לכולם. כתיבה רק לתפקיד המורשה של כל אפליקציה.
```

## 4. כללי תצוגה שנגזרים מהסכמה
1. **החלפה בלי חפיפה:** מודל מפורט פעיל מחליף את נפח התב"ע רק במגרשים שהוא מכסה (`lots`). השאר נשאר. מומש היום בדף הכניסה לפי מרכז הנפח.
2. **גרסת עבודה לעולם לא כמודל סופי:** מוצגת רק כשבוחרים בה, עם התג "גרסת עבודה, לא מאושרת" וקו מקווקו עבה.
3. **מידע חסר לא מוצג כמאומת:** ערך בלי מקור מסומן "לבדיקה". נתון מעותק סטטי מציג את תאריך העדכון שלו.
4. **התנגשות עדכון:** כתיבה עם `updated_at` שנקרא. אם השתנה בינתיים, הכתיבה נדחית ומוצגת שגיאה (כמו `plans-safe.js` היום).

## 5. מעבר בין האפליקציות (מוצע)
פרמטר אחד בכתובת, זהה בשתיהן: `?cam=<lng>,<lat>,<zoom>,<bearing>,<pitch>&plan=<plan_number>`.
ב-Three.js הזום מומר למרחק המצלמה לפי גובה התצוגה, כך שאותו קנה מידה נשמר. עוד לא מומש.
