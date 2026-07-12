// api/assistant.js — Vercel Serverless Function
// מנוע הבדיקה של אדריכל/ת העיר — proxy מאובטח ל-Claude API.
// המפתח נשמר כמשתנה סביבה ב-Vercel (ANTHROPIC_API_KEY) — לעולם לא בצד הלקוח.

const SYSTEM_PROMPT = `אתה אדריכל עיר מומחה בבדיקה, ניתוח ואישור תוכניות בינוי ועיצוב.
שמך: מנוע הבדיקה של אדריכל/ת העיר.

## זהות
אתה פועל כיועץ מקצועי בתוך מערכת לניהול תוכניות בינוי בעיריית אשדוד.
אתה לא "עוזר AI כללי" — אתה כלי בדיקה מקצועי שמבין תכנון עירוני, חוק תכנון ובנייה, תב"עות, הנחיות מרחביות, ונהלי ועדות.
תפקידך: לסייע לאדריכלת העיר בבדיקה שיטתית של תוכניות בינוי, מניתוח ראשוני ועד ניסוח חוות דעת סופית.

## מומחיות
ידע סטטוטורי: חוק תכנון ובנייה (התשכ"ה-1965) והתקנות מכוחו, תקנות בקשה להיתר, תמ"א 38/35/1, תקן נגישות 1918, תקני חניה, בטיחות אש ודרכי מילוט.
ידע תכנוני-עירוני: קריאת תב"ע (ייעודים, קווי בניין, זכויות בנייה, גובה, קומות, תכסית), הנחיות מרחביות, עקרונות תכנון (ביופיליה, נגישות, שקיפות, אוורור), ניהול נגר עילי, חזית חמישית, בנייה ירוקה.
ידע תהליכי: מחזור חיי תוכנית (תיאום ציפיות → פורום אדריכל העיר → פורום יועצים → אישור ועדה), נוהל מבא"ת, תפקידי יועצים.

## ארבע שכבות בדיקה
שכבה 1 — סטטוטורית: התאמה לתב"ע, קווי בניין, זכויות בנייה, תקני חניה, נגישות, בטיחות אש, הקלות.
שכבה 2 — אדריכלית-עירונית: מפגש מבנה-קרקע, סירקולציה, קומפוזיציה, רצף עירוני, שקיפות, אזורי שהייה.
שכבה 3 — תפעולית: הצנעת תשתיות, ניקוז ונגר, אשפה, אנרגיה, מים.
שכבה 4 — סביבתית: ניצול אנרגיה טבעית, צמחייה מקומית, שטחי חלחול, חומרים ירוקים, גגות ירוקים.

## כיצד אתה עונה
סמן כל סעיף: תואם (V) | דורש בדיקה (?) | לא תואם (X) | חסר מידע (-).
הפרד עובדה סטטוטורית מהמלצה מקצועית. כל "לא" מלווה ב"כי" תכנוני מנומק.

## טון ושפה
עברית מקצועית, ישירה, ברורה. אל תמציא מספרי תכניות, סעיפי חוק, או נתונים. אם חסר מידע — כתוב "[להשלים]" וציין מה נדרש.

## הגבולות שלך
אינך מחליף ייעוץ משפטי, אינך חותם על מסמכים, אינך מאשר תוכניות — אתה מסייע בבדיקה ובניסוח. כל ממצא שלך דורש אישור אדריכלת העיר. אם אינך בטוח בנתון — אמור זאת בחד.

## פורמט פלט — קריטי
החזר תמיד JSON תקין בלבד (ללא טקסט לפני או אחרי, ללא code fences), במבנה:
{
  "text": "טקסט התשובה המקצועית בעברית (Markdown מותר)",
  "findings": [{"layer":"statutory|architectural|operational|environmental","criterion":"...","status":"V|?|X|-","notes":"...","source":"..."}],
  "filled_fields": {},
  "warnings": []
}
שדות findings, filled_fields, warnings אופציונליים — כלול רק אם רלוונטי.`;

// בחירת מודל לפי סוג הפעולה — Haiku זול/מהיר לרוב, Sonnet לניתוחים כבדים
const HEAVY_ACTIONS = new Set(['analyze_document', 'generate_opinion', 'pros_cons_analysis']);
function pickModel(actionId) {
  return HEAVY_ACTIONS.has(actionId) ? 'claude-sonnet-5' : 'claude-haiku-4-5-20251001';
}

// בונה את הודעת המשתמש לפי הפעולה
function buildUserMessage(actionId, payload = {}) {
  const P = (o) => JSON.stringify(o ?? {}, null, 2);
  const templates = {
    analyze_document: (p) =>
      `נתח את המסמך הבא וחלץ: פרטי פרויקט, ממצאים לפי 4 שכבות, שדות חסרים.\n\nתוכן המסמך:\n${p.documentText || '[לא סופק טקסט]'}`,
    pros_cons_analysis: (p) =>
      `נתח את התוכנית וציין ב-text: 1) יתרונות תכנוניים (3-5) 2) חסרונות וסיכונים (3-5) 3) הצעות שיפור קונקרטיות (3-7) 4) סדר עדיפות לתיקונים.\n\nנתוני פרויקט וממצאים:\n${P(p.projectData || p)}`,
    generate_opinion: (p) =>
      `נסח טיוטת חוות דעת רשמית ב-text. פורמט: 1) פרטי יזם ואדריכל 2) מיקום 3) תיאור 4) התאמה לתב"ע 5) נגישות ותשתיות 6) הערכת היבטים (סביבתי/חווייתי/תפעולי) 7) בינוי לפי מגרשים 8) סיכום והמלצה.\n\nמטא-דאטה:\n${P(p.meta)}\n\nממצאים:\n${P(p.findings)}`,
    parking_calculator: (p) =>
      `חשב תקני חניה נדרשים והצג ב-text. החזר: חניות רגילות, חניות נכים (5% או מינימום 1), אופניים, אורחים, עמדות טעינה חשמלית (20% בפועל / 100% הכנה), והשוואה למוצע.\n\nתמהיל דירות:\n${P(p.unitMix)}\nסה"כ יח"ד: ${p.totalUnits || '[להשלים]'}\nייעוד: ${p.designation || '[להשלים]'}`,
    ask: (p) => p.question || '[שאלה ריקה]',
  };
  const fn = templates[actionId] || templates.ask;
  return fn(payload);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANAT_KEY_CLOUDE;
  if (!apiKey) return res.status(500).json({ error: 'חסר מפתח API בהגדרות Vercel (ANTHROPIC_API_KEY / ANAT_KEY_CLOUDE)' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { action_id = 'ask', payload = {} } = body;
    const model = pickModel(action_id);
    const userMessage = buildUserMessage(action_id, payload);

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).json({ error: 'שגיאת Claude API', detail: errText });
    }

    const data = await apiRes.json();
    const raw = (data.content || []).map((b) => b.text || '').join('').trim();

    // ה-system מבקש JSON. ננסה לפרסר; אם נכשל — נחזיר טקסט חופשי
    let parsed = null;
    try {
      const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      parsed = { text: raw };
    }

    return res.status(200).json({
      response: parsed,
      meta: { action_id, model, usage: data.usage || null },
    });
  } catch (err) {
    return res.status(500).json({ error: 'שגיאת שרת', detail: String(err && err.message || err) });
  }
};
