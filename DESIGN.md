# Design

מערכת עיצוב של אפליקציית תוכניות הבינוי — עיריית אשדוד. חד-קובץ (index.html), CSS vanilla, RTL בלבד.

## Colors

| Token | Value | Role |
|---|---|---|
| `--ink` | `#1a1a1a` | טקסט ראשי |
| `--paper` | `#faf9f7` | רקע עמוד |
| `--surface` | `#ffffff` | כרטיסים ומשטחים |
| `--stone` / `--fog` | `#e8e5df` / `#f2f0ec` | גבולות |
| `--muted` | `#6b6259` | טקסט משני |
| `--teal` | `#2A5F5F` | מותג ראשי, פעולות, קישורים |
| `--bordeaux` / `--bordeaux-deep` | `#7a1f2b` / `#5f1620` | זהות ממלכתית (כותרת כניסה, כפתור חזרה) |
| `--bronze` / `--bronze-gold` | `#9c7a3c` / `#C5A55A` | מבטא זהב (לוגו, הדגשות) |
| `--ok` / `--warn` / `--err` / `--info` | `#3d8b5e` / `#c47a20` / `#b84040` / `#3B8BD4` | סמנטיים |
| `--stage-1/2/3`, `--approved` | teal / `#5B4A8A` / `#C67B1C` / `#3D8B37` | שלבי תהליך |

כלל: בורדו/זהב הם מבטא ממלכתי, לא רקע. מספרים בטקסט ink; צבע רק כשהוא סמנטי (אדום=תקוע, ירוק=הושלם).

## Typography

- גוף וממשק: **Rubik** (`--sans`).
- כותרות תצוגה: **Frank Ruhl Libre** (`--display`) — כותרות עמוד, מספרי KPI.
- הכל RTL; אין display fonts בתוך רכיבי UI קטנים.

## Components

- `.btn` / `.btn-primary` (teal) / `.btn-ghost` / `.btn-sm` — כפתור אחיד בכל המערכת.
- `.pp-card` — כרטיס תוכן סטנדרטי. אין כרטיסים מקוננים.
- `.badge`, `.stage-badge`, `.date-status` — סטטוס תמיד מילה + צבע.
- Masthead כהה (charcoal) עם ניווט `#mainNav` — כפתורי nav מזוהים ב-`data-nav`.
- דשבורד הנהלה: `ex-*` (KPI strip מופרד בקווי hairline, לא כרטיסים; צנרת `ex-funnel` בצבעי שלבים; גרף קצב `ex-pace` בעמודות div).
- דף היזם: `dh-*` (hero עם progress bars, צעדים `dh-step`, מדריכים `dh-guide`, עשה/אל-תעשה `dh-rule-col`).
- מסך כניסה: `login-*` עם פס בורדו ממלכתי עליון.

## Interaction & Motion

- טרנזיציות 120–300ms, ease-out. אין אנימציות דקורטיביות.
- `:focus-visible` outline teal גלובלי; `prefers-reduced-motion` מכבה הכל.
- מצבי עריכה/נעילה: שדות נעולים `readOnly/disabled`; סעיף נעול מקבל `.sec-locked` + `.lock-banner`.

## Density

צפיפות לפי תפקיד: טבלאות צפופות לאדריכלית; דשבורד ההנהלה ודף היזם מרווחים (max-width 1000–1200px, ריווח 2rem).
