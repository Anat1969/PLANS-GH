# 📋 הנחיות התקנה - משתנים סביבה

## ברוכים הבאים לפרויקט! 👋

קובץ זה יסייע לך להגדיר את הפרויקט עבור פיתוח וע"ע קולabortion עם GitHub.

---

## שלב 1️⃣: קבל את ה-API Keys

### API Key של Anthropic (Claude)

1. כנס ל: **https://console.anthropic.com/**
2. התחבר עם החשבון שלך
3. עבור ל- **API Keys** בתפריט הצד
4. לחץ על **Create Key** וקבל מפתח חדש
5. **העתק את המפתח** (זה יוצג רק פעם אחת!)

### GitHub Personal Access Token (אופציונלי אבל מומלץ)

1. כנס ל: **https://github.com/settings/tokens**
2. לחץ על **Generate new token**
3. בחר **Fine-grained personal access token**
4. שם Token: `plans-gh-dev`
5. בחר הרשאות:
   - ✅ `repo` - גישה מלאה לריпוזיטוריז פרטיים
   - ✅ `read:user` - קריאת מידע חשבון
6. לחץ **Generate token** וקבל

---

## שלב 2️⃣: הגדר את קובץ .env מקומי

### בתיקייה הראשית של הפרויקט:

```bash
# 1. צור קובץ .env
cp .env.example .env

# 2. פתח את .env בעורך טקסט (VSCode, Sublime, וכו')
nano .env
# או
code .env
```

### מלא את המשתנים:

```env
# חובה - ללא זה לא תעבוד האפליקציה
ANTHROPIC_API_KEY=sk-ant-xxx-your-key-xxx

# גם משתנה חלופי (אם יש לך)
ANAT_KEY_CLOUDE=sk-ant-xxx-your-key-xxx

# לפיתוח מקומי
NODE_ENV=development

# GitHub (אופציונלי)
GITHUB_TOKEN=ghp_xxx-your-token-xxx
GITHUB_REPO=anat1969/plans-gh
GITHUB_BRANCH=claude/app-env-file-setup-ifgml7
```

### ⚠️ חשוב מאוד!

- **לעולם אל תדחוף `.env` ל-GitHub!**
- קובץ `.gitignore` כבר מגן עליו ✓
- שתף רק את `.env.example` עם חברים
- כל מפתח כנוס בקובץ `.env` חייב להישמר סודי

---

## שלב 3️⃣: הגדרות Vercel (עבור Deploy)

### אם אתה רוצה להריץ את האפליקציה ב-Vercel:

1. כנס ל: **https://vercel.com/dashboard**
2. בחר את הפרויקט `plans-gh`
3. עבור ל- **Settings → Environment Variables**
4. הוסף:
   - `ANTHROPIC_API_KEY` = `sk-ant-...`
5. ודא שהברנץ' צפוי: `claude/app-env-file-setup-ifgml7`
6. לחץ **Deploy** והכל יעבוד

---

## שלב 4️⃣: הרץ את הפרויקט בקומפיוטר שלך

### פיתוח מקומי:

```bash
# 1. התקן dependencies (אם עוד לא)
npm install

# 2. הרץ את dev server
npm run dev

# 3. פתח בדפדפן
# http://localhost:5173
```

### או עם Vercel CLI:

```bash
# 1. התקן Vercel CLI
npm i -g vercel

# 2. התחבר לחשבון
vercel login

# 3. קשור לפרויקט
vercel link

# 4. הור את env variables מ-Vercel
vercel env pull

# 5. הרץ locally
vercel dev
```

---

## שלב 5️⃣: GitHub Collaboration

### לעבודה משותפת עם החברה שלך:

```bash
# 1. עדכן את הברנץ' המשותף
git fetch origin
git checkout claude/app-env-file-setup-ifgml7

# 2. הרץ את הפרויקט עם המשתנים שלך
npm run dev

# 3. לפני commit - וודא שרק קבצי קוד נדחפים
git status  # וודא שאין .env!

# 4. Commit + Push
git add .
git commit -m "feature: description of your changes"
git push origin claude/app-env-file-setup-ifgml7
```

---

## 🐛 Troubleshooting

### ❌ שגיאה: "API key not found"
**פתרון:** וודא ש-`ANTHROPIC_API_KEY` מלא בקובץ `.env`

### ❌ שגיאה: "Cannot find module"
**פתרון:** הרץ `npm install` שוב

### ❌ Vercel Deploy נכשל
**פתרון:** 
1. בדוק ש-Environment Variables הוגדרו בדashboard
2. וודא ש-`ANTHROPIC_API_KEY` קיים
3. עדכן את הברנץ' הנכון

### ❌ GitHub Push נדחה
**פתרון:**
```bash
git pull origin claude/app-env-file-setup-ifgml7
# פתור conflicts אם יש
git push origin claude/app-env-file-setup-ifgml7
```

---

## 📚 קישורים שימושיים

| משהו | קישור |
|------|-------|
| 🤖 Claude Documentation | https://docs.anthropic.com/ |
| 🚀 Vercel Dashboard | https://vercel.com/dashboard |
| 🐙 GitHub Repository | https://github.com/anat1969/plans-gh |
| 🔑 Anthropic Console | https://console.anthropic.com/ |
| 🎯 GitHub Tokens | https://github.com/settings/tokens |

---

## ✅ בדיקת גמר

לפני שאתה מתחיל לעבודה:

- [ ] יש לך `ANTHROPIC_API_KEY`
- [ ] קובץ `.env` קיים בתיקייה הראשית
- [ ] `npm install` רץ בהצלחה
- [ ] `npm run dev` מתחיל בלי שגיאות
- [ ] דפדפן פתוח ל- `http://localhost:5173`
- [ ] החברה שלך יודעת את URL הRepository

---

## 💬 שאלות?

צור Issue ב-GitHub או בקש עזרה מהChief Developer.

**חפצים בהצלחה! 🚀**
