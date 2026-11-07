# Balance

אפליקציה לניהול הכסף הזמין של משק בית: כמה נשאר לבזבז החודש, יעד שבועי, וקופות להוצאות גדולות.
אפליקציית ווב (PWA) שמתקינים על מסך הבית, עם Supabase מאחוריה. הכול על תוכניות חינמיות.

- מסמך תכנון: `docs/superpowers/specs/2026-11-06-balance-design.md`
- חלוקה לתוכניות: `docs/superpowers/plans/2026-11-06-balance-roadmap.md`

## פיתוח מקומי

```bash
npm install
npm test
npm run dev
```

בלי `.env.local` האפליקציה נטענת אבל כל קריאה לשרת נכשלת. בדיקות ההרשאות במסד (`tests/sql`) רצות
על PGlite, בלי Docker ובלי חשבון Supabase.

## הקמה בפעם הראשונה

1. **פרויקט Supabase:** בלוח הבקרה של Supabase יוצרים פרויקט חדש בשם `balance` (תוכנית Free מאפשרת
   שני פרויקטים פעילים). מעתיקים את ה-Project URL ואת ה-anon key לקובץ `.env.local` לפי `.env.example`.
2. **המסד:**
   ```bash
   npx supabase login
   npx supabase init
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   `supabase/tests/auth-stub.sql` משמש רק לבדיקות ולא נדחף.
3. **GitHub Pages:** כל דחיפה ל-`main` בונה ומעלה את האתר דרך `.github/workflows/deploy.yml`
   (הבדיקות רצות קודם). הכתובת: `https://shayh20-cmd.github.io/Balance/`. כתובת הפרויקט והמפתח
   הציבורי נמצאים ב-`.env.production`; הם ציבוריים מעצם הגדרתם, וההרשאות נאכפות במסד.
4. **הגדרות התחברות ב-Supabase:** ב-Authentication → URL Configuration מגדירים את Site URL לכתובת
   של GitHub Pages ומוסיפים אותה ל-Redirect URLs. ספק המייל נשאר פעיל.
   ב-Authentication → Email Templates → Magic Link מוסיפים לגוף המייל את הקוד:
   `<p>או הקלידו את הקוד: {{ .Token }}</p>`. באייפון הקישור נפתח ב-Safari ולא באפליקציה המותקנת,
   ולכן הכניסה מהאפליקציה עוברת דרך הקוד.
5. **רשימת היתר:** ב-SQL Editor:
   ```sql
   insert into allowlist values ('your@email.com');
   ```
   מי שמוזמן מתוך האפליקציה (הגדרות → הזמנת משתתף) נכנס לרשימה אוטומטית.

## פריסה של גרסה חדשה

דוחפים ל-`main`. GitHub Actions מריץ את הבדיקות, בונה ומעלה.

שינוי במסד: קובץ חדש ב-`supabase/migrations/` ואז `npx supabase db push`.
