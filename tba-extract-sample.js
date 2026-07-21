/* ══════════════════════════════════════════════════════════════════════
   בדיקת חילוץ תב״ע — נתונים לדוגמה שחולצו ממסמך „נאות ספיר" (תמל/2024)
   חולץ מתוך 28 עמודי הוראות התכנית, ממופה לשדות האפליקציה הקיימים.
   מבנה JSON אחיד לשימוש עתידי. אין לשמור נתונים אלה ברשומות התוכניות —
   זהו מצב בדיקה בלבד.
   category  = קבוצת התצוגה בדף הבדיקה
   appField  = שם השדה באפליקציה (מפתח קיים) או תווית לתצוגה
   status    = נמצא | לא נמצא | דורש בדיקה
   confidence= גבוהה | בינונית | נמוכה
   ══════════════════════════════════════════════════════════════════════ */
window.TBA_EXTRACT_SAMPLE = {
  "planNumber": "תמל/2024",
  "planName": "התחדשות עירונית מתחם הרצל-נאות ספיר רובע ה' אשדוד",
  "sourceFile": "נאות ספיר.pdf",
  "extractionDate": "",
  "fields": [
    /* ── נתונים כלליים ── */
    { "category":"נתונים כלליים","appField":"planNumber · מספר תוכנית","value":"תמל/2024","unit":"","lot":"","landUse":"","sourceSection":"1.1","sourcePage":"3","sourceQuote":"מספר התכנית תמל/ 2024","confidence":"גבוהה","status":"נמצא" },
    { "category":"נתונים כלליים","appField":"planName · שם התכנית","value":"התחדשות עירונית מתחם הרצל-נאות ספיר רובע ה' אשדוד","unit":"","lot":"","landUse":"","sourceSection":"1.1","sourcePage":"3","sourceQuote":"התחדשות עירונית מתחם הרצל-נאות ספיר רובע ה' אשדוד","confidence":"גבוהה","status":"נמצא" },
    { "category":"נתונים כלליים","appField":"meta.projectType · סוג התכנית","value":"תכנית מועדפת לדיור","unit":"","lot":"","landUse":"","sourceSection":"1.4","sourcePage":"3","sourceQuote":"סוג התכנית תכנית מועדפת לדיור","confidence":"גבוהה","status":"נמצא" },
    { "category":"נתונים כלליים","appField":"district · רובע","value":"רובע ה'","unit":"","lot":"","landUse":"","sourceSection":"1.5.4","sourcePage":"4","sourceQuote":"שכונה רובע ה'","confidence":"גבוהה","status":"נמצא" },
    { "category":"נתונים כלליים","appField":"meta.area · שטח התכנית","value":"38.390","unit":"דונם","lot":"","landUse":"","sourceSection":"1.2","sourcePage":"3","sourceQuote":"שטח התכנית 38.390 דונם","confidence":"גבוהה","status":"נמצא" },
    { "category":"נתונים כלליים","appField":"lotArea · שטח התכנית (מ״ר)","value":"38390","unit":"מ״ר","lot":"","landUse":"","sourceSection":"3.2","sourcePage":"13","sourceQuote":"סה\"כ 38,390","confidence":"גבוהה","status":"נמצא" },
    { "category":"נתונים כלליים","appField":"meta.compound · מתחם","value":"הרצל-נאות ספיר","unit":"","lot":"","landUse":"","sourceSection":"1.5.2","sourcePage":"4","sourceQuote":"תחומה בין הרחובות רבי שלום שבזי ממזרח, שמואל הנגיד מצפון, שד' הרצל ממערב ורח' נאות ספיר מדרום","confidence":"גבוהה","status":"נמצא" },
    { "category":"נתונים כלליים","appField":"meta.block · גוש","value":"2067, 2068","unit":"","lot":"","landUse":"","sourceSection":"1.5.5","sourcePage":"4","sourceQuote":"מספר גוש 2067 / 2068 — מוסדר","confidence":"גבוהה","status":"נמצא" },
    { "category":"נתונים כלליים","appField":"meta.lot · חלקות","value":"50; 80-87,89,94,104-107","unit":"","lot":"","landUse":"","sourceSection":"1.5.5","sourcePage":"4","sourceQuote":"מספרי חלקות בשלמותן 80-87, 89, 94, 105-106 / בחלקן 104,107,50","confidence":"בינונית","status":"דורש בדיקה" },
    { "category":"נתונים כלליים","appField":"meta.address · כתובת/מיקום","value":"רובע ה', בין רבי שלום שבזי / שמואל הנגיד / הרצל / נאות ספיר","unit":"","lot":"","landUse":"","sourceSection":"1.5.2","sourcePage":"4","sourceQuote":"ממוקמת בחלקו הצפון-מערבי של רובע ה'","confidence":"גבוהה","status":"נמצא" },
    { "category":"נתונים כלליים","appField":"submitter · אדריכל עורך ראשי","value":"יגאל לוי (רישיון 82290)","unit":"","lot":"","landUse":"","sourceSection":"1.8.4","sourcePage":"8","sourceQuote":"אדריכל עורך ראשי יגאל לוי 82290","confidence":"גבוהה","status":"נמצא" },
    { "category":"נתונים כלליים","appField":"developer · יזם","value":"נופך התחדשות עירונית (נה) בע\"מ","unit":"","lot":"","landUse":"","sourceSection":"1.8.2","sourcePage":"8","sourceQuote":"נופך התחדשות עירונית (נה) בע\"מ","confidence":"גבוהה","status":"נמצא" },

    /* ── ייעודי קרקע ── */
    { "category":"ייעודי קרקע","appField":"meta.designation · ייעוד (מגורים)","value":"מגורים ה'","unit":"","lot":"1-6","landUse":"מגורים ה'","sourceSection":"3.1","sourcePage":"12","sourceQuote":"מגורים ה' — תאי שטח 1 - 6","confidence":"גבוהה","status":"נמצא" },
    { "category":"ייעודי קרקע","appField":"landUse · מבנים ומוסדות ציבור","value":"מבנים ומוסדות ציבור","unit":"","lot":"7,8","landUse":"מבנים ומוסדות ציבור","sourceSection":"3.1","sourcePage":"12","sourceQuote":"מבנים ומוסדות ציבור — 7, 8","confidence":"גבוהה","status":"נמצא" },
    { "category":"ייעודי קרקע","appField":"landUse · שטח ציבורי פתוח","value":"שטח ציבורי פתוח","unit":"","lot":"14,16-24","landUse":"שצ\"פ","sourceSection":"3.1","sourcePage":"12","sourceQuote":"שטח ציבורי פתוח — 14, 16 - 24","confidence":"גבוהה","status":"נמצא" },
    { "category":"ייעודי קרקע","appField":"landUse · דרך מאושרת/מוצעת","value":"דרך מאושרת (9,10,11) ודרך מוצעת (12,13,15)","unit":"","lot":"9-13,15","landUse":"דרך","sourceSection":"3.1","sourcePage":"12","sourceQuote":"דרך מאושרת 9,10,11 · דרך מוצעת 12,13,15","confidence":"גבוהה","status":"נמצא" },

    /* ── זכויות בנייה (טבלה 5) ── */
    { "category":"זכויות בנייה","appField":"table5.units.allowed · יח״ד (מוצע)","value":"900","unit":"יח״ד","lot":"1-6","landUse":"מגורים ה'","sourceSection":"2.1 / טבלה 5","sourcePage":"10","sourceQuote":"הקמת 900 יח\"ד חדשות במקומן","confidence":"גבוהה","status":"נמצא" },
    { "category":"זכויות בנייה","appField":"units · יח״ד מצב מאושר (להריסה)","value":"200","unit":"יח״ד","lot":"","landUse":"מגורים","sourceSection":"דברי הסבר","sourcePage":"2","sourceQuote":"9 מבני שיכון ובהם 200 יח\"ד","confidence":"גבוהה","status":"נמצא" },
    { "category":"זכויות בנייה","appField":"buildings · מספר מבנים","value":"9 (5 פשוטים + 4 מגדלים)","unit":"מבנים","lot":"1-6","landUse":"מגורים ה'","sourceSection":"2.1","sourcePage":"10","sourceQuote":"9 מבנים חדשים ב-5 מבנים פשוטים ו-4 מבנים רבי קומות","confidence":"גבוהה","status":"נמצא" },
    { "category":"זכויות בנייה","appField":"table5.designation.allowed · ייעוד","value":"מגורים ה' + חזית פעילה","unit":"","lot":"1-6","landUse":"מגורים ה'","sourceSection":"4.1.1","sourcePage":"14","sourceQuote":"מגורים / שימושים של 'חזית פעילה' בקומת הקרקע","confidence":"גבוהה","status":"נמצא" },
    { "category":"זכויות בנייה","appField":"unitMix · התפלגות יח״ד","value":"≥20% קטנות מאוד, ≥10% קטנות; דירה ממוצעת ≤95 מ״ר","unit":"","lot":"","landUse":"מגורים ה'","sourceSection":"הוראות טבלה 5 (א,ב)","sourcePage":"19","sourceQuote":"לפחות 20% מיחידות הדיור ... קטנות מאוד, ולפחות 10% ... קטנות / שטח דירה ממוצע לא יעלה על 95 מ\"ר","confidence":"גבוהה","status":"נמצא" },
    { "category":"זכויות בנייה","appField":"specialUses · דיוריות","value":"עד 15% מיח״ד מתאימות; ביח״ד ≥120 מ״ר","unit":"","lot":"","landUse":"מגורים ה'","sourceSection":"4.1.2(8) / הוראות טבלה 5(ט)","sourcePage":"14","sourceQuote":"תותר הקמת דיורית ביח\"ד ששטחה לא יפחת מ-120 מ\"ר","confidence":"בינונית","status":"נמצא" },

    /* ── שטחים עיקריים ושירות (טבלה 5 — מצב מוצע) ── */
    { "category":"שטחים עיקריים ושירות","appField":"mainArea · שטח עיקרי ת\"ש 1","value":"17264","unit":"מ״ר","lot":"1","landUse":"מגורים ה'","sourceSection":"טבלה 5 חלק א'","sourcePage":"17","sourceQuote":"מגורים ה' 1 — עיקרי מעל הכניסה 17264","confidence":"גבוהה","status":"נמצא" },
    { "category":"שטחים עיקריים ושירות","appField":"serviceArea · שטח שירות ת\"ש 1","value":"9020","unit":"מ״ר","lot":"1","landUse":"מגורים ה'","sourceSection":"טבלה 5 חלק א'","sourcePage":"17","sourceQuote":"מגורים ה' 1 — שירות מעל הכניסה 9020","confidence":"גבוהה","status":"נמצא" },
    { "category":"שטחים עיקריים ושירות","appField":"mainArea · סה\"כ שטחי בנייה ת\"ש 1","value":"38519","unit":"מ״ר","lot":"1","landUse":"מגורים ה'","sourceSection":"טבלה 5 חלק א'","sourcePage":"17","sourceQuote":"סה\"כ שטחי בניה 38519","confidence":"גבוהה","status":"נמצא" },
    { "category":"שטחים עיקריים ושירות","appField":"mainArea · מבני ציבור ת\"ש 8","value":"44315","unit":"מ״ר","lot":"8","landUse":"מבנים ומוסדות ציבור","sourceSection":"טבלה 5 חלק א'","sourcePage":"17","sourceQuote":"מבנים ומוסדות ציבור 8 — סה\"כ 44315","confidence":"בינונית","status":"נמצא" },
    { "category":"שטחים עיקריים ושירות","appField":"publicArea · סך מבני ציבור","value":"≈43600","unit":"מ״ר","lot":"7,8","landUse":"מבנים ומוסדות ציבור","sourceSection":"דברי הסבר","sourcePage":"2","sourceQuote":"העצמת זכויות ... לסך כולל של כ-43,600 מ\"ר","confidence":"בינונית","status":"דורש בדיקה" },
    { "category":"שטחים עיקריים ושירות","appField":"specialUses · מרפסות (בנוסף לעיקרי) ת\"ש 1","value":"2496","unit":"מ״ר","lot":"1","landUse":"מגורים ה'","sourceSection":"טבלה 5 חלק ב'","sourcePage":"19","sourceQuote":"מגורים ה' 1 — מרפסות 2496","confidence":"גבוהה","status":"נמצא" },
    { "category":"שטחים עיקריים ושירות","appField":"specialUses · חללים משותפים","value":"עד 150 מ״ר עיקרי לכל תא שטח","unit":"מ״ר","lot":"","landUse":"מגורים ה'","sourceSection":"הוראות טבלה 5(ג)","sourcePage":"19","sourceQuote":"תותר תוספת של עד 150 מ\"ר שטח עיקרי לכל תא שטח ... לחללים משותפים לרווחת הדיירים","confidence":"גבוהה","status":"נמצא" },

    /* ── גובה ומספר קומות ── */
    { "category":"גובה ומספר קומות","appField":"table5.floors.allowed · קומות (מגדל)","value":"30","unit":"קומות","lot":"1-4","landUse":"מגורים ה'","sourceSection":"טבלה 5 חלק א'","sourcePage":"17","sourceQuote":"מספר קומות מעל הכניסה הקובעת 30","confidence":"גבוהה","status":"נמצא" },
    { "category":"גובה ומספר קומות","appField":"floors · קומות טכניות (תוספת)","value":"עד 2","unit":"קומות","lot":"","landUse":"מגורים ה'","sourceSection":"הוראות טבלה 5(ד)","sourcePage":"19","sourceQuote":"תותר תוספת של עד שתי קומות טכניות מעבר למספר הקומות","confidence":"גבוהה","status":"נמצא" },
    { "category":"גובה ומספר קומות","appField":"table5.height.allowed · גובה מבנה","value":"109.5","unit":"מ׳ מעל הכניסה הקובעת","lot":"1-4","landUse":"מגורים ה'","sourceSection":"טבלה 5 חלק א'","sourcePage":"17","sourceQuote":"גובה מבנה מעל הכניסה הקובעת 109.5","confidence":"גבוהה","status":"נמצא" },
    { "category":"גובה ומספר קומות","appField":"height · גובה מרבי מעל פני הים","value":"138","unit":"מ׳ מעל הים","lot":"","landUse":"מגורים ה'","sourceSection":"הוראות טבלה 5(י)","sourcePage":"20","sourceQuote":"הגובה המרבי המותר עבור מבנים יהיה 138 מטר מעל פני הים","confidence":"גבוהה","status":"נמצא" },
    { "category":"גובה ומספר קומות","appField":"floors · מבנים פשוטים","value":"5","unit":"קומות","lot":"5,6","landUse":"מגורים ה'","sourceSection":"טבלה 5 חלק א'","sourcePage":"17","sourceQuote":"מגורים ה' 5/6 — מספר קומות 5, גובה 35.2","confidence":"בינונית","status":"נמצא" },

    /* ── תכסית ── */
    { "category":"תכסית","appField":"table5.coverage.allowed · תכסית מגדל טיפוסי","value":"≤750","unit":"מ״ר לקומה","lot":"1-4","landUse":"מגורים ה'","sourceSection":"4.1.2(7)","sourcePage":"14","sourceQuote":"תכסית הבנייה של קומה טיפוסית במגדל לא תעלה על 750 מ\"ר (לא כולל מרפסות)","confidence":"גבוהה","status":"נמצא" },
    { "category":"תכסית","appField":"coverage · תכסית חניון (חלקית)","value":"60-100","unit":"% מתא שטח","lot":"7,8,15-24","landUse":"","sourceSection":"טבלה 5 חלק א'","sourcePage":"17","sourceQuote":"תכסית (% מתא שטח) (2) 60 / (2) 100 / (2) 80","confidence":"בינונית","status":"דורש בדיקה" },

    /* ── קווי בניין ── */
    { "category":"קווי בניין","appField":"table5.setbackF/B/S.allowed · קווי בניין","value":"בהתאם למסומן בתשריט","unit":"מ׳","lot":"1-6","landUse":"מגורים ה'","sourceSection":"טבלה 5 חלק א' (1)","sourcePage":"17","sourceQuote":"קו בנין (1) — בהתאם למסומן בתשריט","confidence":"נמוכה","status":"דורש בדיקה" },
    { "category":"קווי בניין","appField":"setbackS · חריגה למרפסות","value":"עד 1.2 מ׳ מקו בניין","unit":"מ׳","lot":"1-4","landUse":"מגורים ה'","sourceSection":"4.1.2(12)","sourcePage":"14","sourceQuote":"תותר חריגה של עד 1.2 מ' מקו בניין ... לטובת מרפסות","confidence":"גבוהה","status":"נמצא" },

    /* ── צפיפות ── */
    { "category":"צפיפות","appField":"planningData · צפיפות (יח״ד/דונם)","value":"≈23.4 (900 יח״ד / 38.39 דונם)","unit":"יח״ד/דונם","lot":"","landUse":"מגורים ה'","sourceSection":"מחושב (2.1 + 1.2)","sourcePage":"3,10","sourceQuote":"900 יח\"ד על שטח תכנית 38.390 דונם — צפיפות מחושבת","confidence":"בינונית","status":"דורש בדיקה" },

    /* ── הוראות בינוי ── */
    { "category":"הוראות בינוי","appField":"aspects.operational · מרחקים בין מבנים","value":"מבנה פשוט 10 מ׳ (מרפסות 8 מ׳); בין מגדלים 18 מ׳","unit":"מ׳","lot":"","landUse":"מגורים ה'","sourceSection":"6.1(1)","sourcePage":"21","sourceQuote":"מרחק בין מבנה מגורים פשוט ... 10 מ' לפחות ... המרחק בין שני מגדלי מגורים יהיה 18 מ' לפחות","confidence":"גבוהה","status":"נמצא" },
    { "category":"הוראות בינוי","appField":"aspects.operational · חזית פעילה","value":"≥60% מאורך החזית לרחוב","unit":"%","lot":"1-4","landUse":"מגורים ה'","sourceSection":"6.1(2)","sourcePage":"21","sourceQuote":"שימושי החזית הפעילה ... לא יפחתו מ-60% מאורך החזית הפונה לרחוב","confidence":"גבוהה","status":"נמצא" },
    { "category":"הוראות בינוי","appField":"aspects.operational · גובה קומת קרקע","value":"4-6 מ׳","unit":"מ׳","lot":"","landUse":"מגורים ה'","sourceSection":"6.1(3)","sourcePage":"21","sourceQuote":"גובה קומת הקרקע יהיה בין 4 מ' ל-6 מ'","confidence":"גבוהה","status":"נמצא" },
    { "category":"הוראות בינוי","appField":"infra.coverage · גג ירוק","value":"חלק מהגג כגג ירוק לרווחת הדיירים","unit":"","lot":"","landUse":"מגורים ה'","sourceSection":"6.1(6)","sourcePage":"21","sourceQuote":"בגגות מבני מגורים פשוטים, חלק מהגג יפותח כגג ירוק לרווחת הדיירים","confidence":"בינונית","status":"נמצא" },

    /* ── חניה ── */
    { "category":"חניה","appField":"table5.parking.allowed · תקן חניה מגורים","value":"≤1:1 ליח״ד","unit":"מקום/יח״ד","lot":"","landUse":"מגורים ה'","sourceSection":"6.3(1)","sourcePage":"22","sourceQuote":"תקן החניה למגורים לא יעלה על 1:1 ליח\"ד","confidence":"גבוהה","status":"נמצא" },
    { "category":"חניה","appField":"parking.underground · חניה תת-קרקעית","value":"תת-קרקעית בלבד","unit":"","lot":"","landUse":"","sourceSection":"6.3(2)","sourcePage":"22","sourceQuote":"החניות עבור מגורים, מסחר והקצאות מבונות תהיינה תת קרקעיות בלבד","confidence":"גבוהה","status":"נמצא" },
    { "category":"חניה","appField":"parking · תקן אופניים","value":"מקום 1 לכל 30 מ״ר עיקרי","unit":"מקום/30מ״ר","lot":"","landUse":"מגורים ה'","sourceSection":"6.3(8)","sourcePage":"22","sourceQuote":"מקום חנייה אחד לכל 30 מ\"ר עיקרי למגורים","confidence":"גבוהה","status":"נמצא" },
    { "category":"חניה","appField":"parking.ev · הטענת רכב חשמלי","value":"הכנות תשתית להטענת רכב חשמלי","unit":"","lot":"","landUse":"","sourceSection":"6.3(7)","sourcePage":"22","sourceQuote":"בחניונים יבוצעו ההכנות הנדרשות להתקנת תשתית להטענת רכבים חשמליים","confidence":"בינונית","status":"נמצא" },

    /* ── שטחים ציבוריים ── */
    { "category":"שטחים ציבוריים","appField":"openArea · שצ\"פ (מצב מוצע)","value":"6218.88","unit":"מ״ר (16.20%)","lot":"14,16-24","landUse":"שצ\"פ","sourceSection":"3.2 טבלת שטחים","sourcePage":"13","sourceQuote":"שטח ציבורי פתוח 6,218.88 — 16.20%","confidence":"גבוהה","status":"נמצא" },
    { "category":"שטחים ציבוריים","appField":"publicArea · מבנים ומוסדות ציבור (מוצע)","value":"12322","unit":"מ״ר (32.10%)","lot":"7,8","landUse":"מבנים ומוסדות ציבור","sourceSection":"3.2 טבלת שטחים","sourcePage":"13","sourceQuote":"מבנים ומוסדות ציבור 12,322 — 32.10%","confidence":"גבוהה","status":"נמצא" },
    { "category":"שטחים ציבוריים","appField":"infra.shading · הצללת שצ\"פ","value":"מחצית משטח השצ\"פ מוצללת","unit":"","lot":"","landUse":"שצ\"פ","sourceSection":"4.3.2(3)","sourcePage":"16","sourceQuote":"השצ\"פ יתוכנן באופן שמחצית משטחו יוצלל ככל הניתן","confidence":"בינונית","status":"נמצא" },

    /* ── מסחר ותעסוקה ── */
    { "category":"מסחר ותעסוקה","appField":"commercialArea · שטחי מסחר","value":"≈1850","unit":"מ״ר","lot":"1-4","landUse":"מגורים ה' (חזית פעילה)","sourceSection":"דברי הסבר","sourcePage":"2","sourceQuote":"הפניית חזיתות פעילות ... הכוללות כ-1850 מ\"ר מסחר","confidence":"בינונית","status":"נמצא" },
    { "category":"מסחר ותעסוקה","appField":"commercialArea · מסחר נלווה ת\"ש 8","value":"≤15% מהשטח המותר לבנייה","unit":"%","lot":"8","landUse":"מבנים ומוסדות ציבור","sourceSection":"4.2.2(4)","sourcePage":"15","sourceQuote":"יתאפשר שימוש מסחר נלווה בשטח שאינו עולה על 15% מסך השטח המותר לבנייה","confidence":"גבוהה","status":"נמצא" },

    /* ── הנחיות עיצוביות ── */
    { "category":"הנחיות עיצוביות","appField":"summary · תדריך בינוי ופיתוח","value":"תדריך מילולי: עיצוב חזיתות, שערים, פילרים, מעקות, שילוט","unit":"","lot":"","landUse":"","sourceSection":"6.10","sourcePage":"25-26","sourceQuote":"קביעת הוראות מחייבות לעיצוב חזיתות הפונות אל הרחוב","confidence":"בינונית","status":"נמצא" },
    { "category":"הנחיות עיצוביות","appField":"aspects.experiential · בניין לשימור","value":"שימור חלקי מבנה (כיפה מערבית) בת\"ש 7","unit":"","lot":"7","landUse":"מבנים ומוסדות ציבור","sourceSection":"4.2.2(5)","sourcePage":"15","sourceQuote":"מבנה זה מיועד לשימור חלקי כאשר הכיפה המערבית מסומנת לשימור","confidence":"גבוהה","status":"נמצא" },

    /* ── תנאים להיתר ── */
    { "category":"תנאים להיתר","appField":"summary · תכנית בינוי ופיתוח","value":"תנאי להיתר: אישור תב\"ע בינוי ופיתוח 1:500","unit":"","lot":"","landUse":"","sourceSection":"6.9(1)","sourcePage":"24","sourceQuote":"תנאי להגשת בקשה להיתר ... אישור הוועדה המקומית ל'תכנית בינוי ופיתוח' בקנ\"מ 1:500","confidence":"גבוהה","status":"נמצא" },
    { "category":"תנאים להיתר","appField":"summary · בנייה ירוקה","value":"ת\"י 5281 ≥2 כוכבים","unit":"","lot":"","landUse":"","sourceSection":"6.5","sourcePage":"23","sourceQuote":"יעמדו בדרישות תקן ישראלי 5281 ... ברמה של שני כוכבים לפחות","confidence":"גבוהה","status":"נמצא" },
    { "category":"תנאים להיתר","appField":"summary · בטיחות טיסה","value":"מבנה >60 מ׳ — אישור משרד הביטחון","unit":"","lot":"","landUse":"","sourceSection":"6.11","sourcePage":"27","sourceQuote":"תנאי בהליך רישוי למבנה שגובהו עולה על 60 מטר ... בהתאם להנחיות משרד הבטחון","confidence":"גבוהה","status":"נמצא" },

    /* ── טבלאות הקצאה ואיזון ── */
    { "category":"טבלאות הקצאה ואיזון","appField":"—","value":"נספח טבלאות איזון והקצאה (71 עמ׳, מחייב) — אייל דנינו","unit":"","lot":"","landUse":"","sourceSection":"1.7 מסמכי התכנית","sourcePage":"6","sourceQuote":"טבלאות איזון והקצאה — מחייב — 71 — נספח לטבלאות הקצאה ואיזון","confidence":"גבוהה","status":"דורש בדיקה" },
    { "category":"טבלאות הקצאה ואיזון","appField":"— · איחוד וחלוקה","value":"איחוד/חלוקה ללא הסכמת בעלים","unit":"","lot":"","landUse":"","sourceSection":"1.4 / 6.14","sourcePage":"3","sourceQuote":"איחוד ו/או חלוקה ללא הסכמת כל הבעלים בכל תחום התכנית","confidence":"גבוהה","status":"נמצא" }
  ],
  "unmappedData": [
    { "label":"תכנון תלת-מימדי", "value":"מגרשים תלת-ממדיים בת\"ש 15,17,19,20,22,24 למיסעות בין חניונים", "sourcePage":"27", "sourceSection":"6.13", "note":"אין שדה ייעודי באפליקציה למגרשים תלת-מימדיים" },
    { "label":"ניהול מי נגר", "value":"נפח לניהול נגר לפי נספח ניהול הנגר; מחייב טבלת נפח (עמ' 24 בנספח)", "sourcePage":"23-24", "sourceSection":"6.7", "note":"טקסט הוראתי — אין שדה מספרי מתאים" },
    { "label":"שמירה על עצים בוגרים", "value":"סקר עצים 78 עמ' (מחייב); שינוי סיווג ≤10% (ציבור ≤20%)", "sourcePage":"7,24", "sourceSection":"6.8", "note":"אין שדה ייעודי; רלוונטי לנספח עצים" },
    { "label":"שלביות ביצוע", "value":"המגורים יבוצעו בד בבד עם מערכות התשתית, מוסדות הציבור והשצ\"פ", "sourcePage":"28", "sourceSection":"7.1", "note":"מתאים ל-summary.phasing כטקסט חופשי" },
    { "label":"קואורדינטות מרכז", "value":"X 166717 · Y 634228", "sourcePage":"4", "sourceSection":"1.5.1", "note":"lat/lng באפליקציה הם WGS84 — נדרשת המרה מרשת ישראל" },
    { "label":"זכות מעבר / זיקת הנאה", "value":"זיקות הנאה לציבור בחזיתות פעילות וקולונדה ברח' הרצל", "sourcePage":"27", "sourceSection":"6.12", "note":"חלקית ל-meta.easements; פירוט ללא שדה ייעודי" }
  ]
};
