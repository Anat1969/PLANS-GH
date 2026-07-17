-- ══════════════════════════════════════════════════════════════════
-- PLANS-GH · שלב א' — בסיס בטוח שאפשר להחיל היום, בלי לשבור את הקליינט
-- הדביקו את הקובץ כולו ב-Supabase Dashboard → SQL Editor → Run.
-- אידמפוטנטי: בטוח להריץ יותר מפעם אחת.
--
-- מה זה נותן: אילוצי הייחודיות שה-upsert של האפליקציה מניח, חסימת
-- DELETE שהאפליקציה לא צריכה (מגן מפני מחיקה המונית עם המפתח הציבורי),
-- וסגירת גישה לכל טבלה אחרת בפרויקט.
-- מה זה עוד לא נותן: הפרדת הרשאות בין אדריכלית/יזם/מנכ"ל — לזה צריך
-- שלב ב' (01_phase_b_rls.sql) יחד עם חיבור Supabase Auth בקליינט.
-- ══════════════════════════════════════════════════════════════════

-- 1) אילוצי ייחודיות שה-on_conflict של הקליינט תלוי בהם (אם חסרים — upsert נכשל)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ashdod_plans_plan_key_key') then
    alter table public.ashdod_plans add constraint ashdod_plans_plan_key_key unique (plan_key);
  end if;
exception when undefined_table then
  raise notice 'טבלת ashdod_plans לא קיימת — דלגו';
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ashdod_muni_id_key')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='ashdod_muni') then
    alter table public.ashdod_muni add constraint ashdod_muni_id_key unique (id);
  end if;
exception when others then null;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ashdod_shares_id_key')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='ashdod_shares') then
    alter table public.ashdod_shares add constraint ashdod_shares_id_key unique (id);
  end if;
exception when others then null;
end $$;

-- 2) RLS מופעל על שלוש הטבלאות, עם מדיניות שמשמרת את ההתנהגות הנוכחית
--    (קריאה/כתיבה עם המפתח הציבורי) אבל חוסמת DELETE על תוכניות —
--    האפליקציה אף פעם לא מוחקת שורות תוכנית, רק upsert.
alter table public.ashdod_plans  enable row level security;
alter table public.ashdod_muni   enable row level security;
alter table public.ashdod_shares enable row level security;

-- ניקוי מדיניות קודמת של הערכה הזו (אידמפוטנטיות)
drop policy if exists plans_anon_select on public.ashdod_plans;
drop policy if exists plans_anon_upsert on public.ashdod_plans;
drop policy if exists plans_anon_update on public.ashdod_plans;
drop policy if exists muni_anon_select  on public.ashdod_muni;
drop policy if exists muni_anon_upsert  on public.ashdod_muni;
drop policy if exists muni_anon_update  on public.ashdod_muni;
drop policy if exists shares_anon_all   on public.ashdod_shares;
drop policy if exists shares_anon_select on public.ashdod_shares;
drop policy if exists shares_anon_upsert on public.ashdod_shares;
drop policy if exists shares_anon_update on public.ashdod_shares;
drop policy if exists shares_anon_delete on public.ashdod_shares;

-- ashdod_plans: קריאה + insert/update. אין DELETE — נחסם מעכשיו.
create policy plans_anon_select on public.ashdod_plans for select to anon, authenticated using (true);
create policy plans_anon_upsert on public.ashdod_plans for insert to anon, authenticated with check (true);
create policy plans_anon_update on public.ashdod_plans for update to anon, authenticated using (true) with check (true);

-- ashdod_muni (אוגדן/מחשבונים/אנשי קשר/קודי גישה): אותו דבר, בלי DELETE.
create policy muni_anon_select on public.ashdod_muni for select to anon, authenticated using (true);
create policy muni_anon_upsert on public.ashdod_muni for insert to anon, authenticated with check (true);
create policy muni_anon_update on public.ashdod_muni for update to anon, authenticated using (true) with check (true);

-- ashdod_shares: לאפליקציה יש מחיקת שיתוף מפורשת — DELETE נשאר מותר כאן בלבד.
create policy shares_anon_select on public.ashdod_shares for select to anon, authenticated using (true);
create policy shares_anon_upsert on public.ashdod_shares for insert to anon, authenticated with check (true);
create policy shares_anon_update on public.ashdod_shares for update to anon, authenticated using (true) with check (true);
create policy shares_anon_delete on public.ashdod_shares for delete to anon, authenticated using (true);

-- 3) בדיקת מצב — הריצו ובחנו: אין policy עם qual=true על טבלה שלא ברשימה,
--    ואין מדיניות storage גלובלית בלי bucket_id.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','storage') order by tablename, policyname;
