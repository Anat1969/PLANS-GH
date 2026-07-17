-- ══════════════════════════════════════════════════════════════════
-- PLANS-GH · שלב ב' — הרשאות אמיתיות בצד השרת (RLS מלא)
-- ⚠ אל תריצו לפני שהקליינט עבר ל-Supabase Auth! הפעלת הקובץ הזה
--   חוסמת כתיבה אנונימית — הגרסה הנוכחית של האפליקציה תפסיק לשמור.
--   מיועד לספרינט "אימות אמיתי": משתמשים ב-auth.users + profiles,
--   ואז מריצים את הקובץ הזה. אידמפוטנטי.
--
-- מודל: profiles.role ∈ ('architect','manager','developer').
--   architect — כתיבה מלאה בכל הטבלאות.
--   manager   — קריאה בלבד.
--   developer — קריאה לכל; עדכון רק לשורות התוכניות שלו (plan_access).
-- ══════════════════════════════════════════════════════════════════

-- 1) טבלת פרופילים + שיוך תוכניות ליזמים
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'developer' check (role in ('architect','manager','developer')),
  display_name text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

create table if not exists public.plan_access (
  profile_id uuid references public.profiles(id) on delete cascade,
  plan_key text not null,
  primary key (profile_id, plan_key)
);
alter table public.plan_access enable row level security;

-- 2) עוזרי תפקיד — SECURITY DEFINER כדי לא להיכנס לרקורסיה אינסופית (42P17)
create or replace function public.is_architect()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'architect'
  );
$$;

create or replace function public.owns_plan(pk text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.plan_access
    where profile_id = (select auth.uid()) and plan_key = pk
  );
$$;

-- 3) profiles: כל מחובר רואה את הפרופיל שלו; אדריכלית מנהלת את כולם
drop policy if exists profiles_self_read   on public.profiles;
drop policy if exists profiles_arch_all    on public.profiles;
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_architect()));
create policy profiles_arch_all on public.profiles for all to authenticated
  using ((select public.is_architect())) with check ((select public.is_architect()));

-- plan_access: אדריכלית מנהלת; יזם רואה את השיוכים שלו
drop policy if exists pa_arch_all  on public.plan_access;
drop policy if exists pa_self_read on public.plan_access;
create policy pa_arch_all on public.plan_access for all to authenticated
  using ((select public.is_architect())) with check ((select public.is_architect()));
create policy pa_self_read on public.plan_access for select to authenticated
  using (profile_id = (select auth.uid()));

-- 4) החלפת מדיניות שלב א' במדיניות תפקידים
-- ashdod_plans
drop policy if exists plans_anon_select on public.ashdod_plans;
drop policy if exists plans_anon_upsert on public.ashdod_plans;
drop policy if exists plans_anon_update on public.ashdod_plans;
drop policy if exists plans_auth_read   on public.ashdod_plans;
drop policy if exists plans_arch_write  on public.ashdod_plans;
drop policy if exists plans_dev_update  on public.ashdod_plans;
create policy plans_auth_read on public.ashdod_plans for select to authenticated using (true);
create policy plans_arch_write on public.ashdod_plans for all to authenticated
  using ((select public.is_architect())) with check ((select public.is_architect()));
create policy plans_dev_update on public.ashdod_plans for update to authenticated
  using ((select public.owns_plan(plan_key))) with check ((select public.owns_plan(plan_key)));

-- ashdod_muni: קריאה לכולם; כתיבה — אדריכלית בלבד
drop policy if exists muni_anon_select on public.ashdod_muni;
drop policy if exists muni_anon_upsert on public.ashdod_muni;
drop policy if exists muni_anon_update on public.ashdod_muni;
drop policy if exists muni_auth_read   on public.ashdod_muni;
drop policy if exists muni_arch_write  on public.ashdod_muni;
create policy muni_auth_read on public.ashdod_muni for select to authenticated using (true);
create policy muni_arch_write on public.ashdod_muni for all to authenticated
  using ((select public.is_architect())) with check ((select public.is_architect()));

-- ashdod_shares: קריאה לכולם; כתיבה/מחיקה — אדריכלית בלבד
drop policy if exists shares_anon_select on public.ashdod_shares;
drop policy if exists shares_anon_upsert on public.ashdod_shares;
drop policy if exists shares_anon_update on public.ashdod_shares;
drop policy if exists shares_anon_delete on public.ashdod_shares;
drop policy if exists shares_auth_read   on public.ashdod_shares;
drop policy if exists shares_arch_write  on public.ashdod_shares;
create policy shares_auth_read on public.ashdod_shares for select to authenticated using (true);
create policy shares_arch_write on public.ashdod_shares for all to authenticated
  using ((select public.is_architect())) with check ((select public.is_architect()));

-- 5) Storage: קריאה ציבורית לתמונות/מסמכים; העלאה — מחוברים בלבד, ל-bucket הזה בלבד
drop policy if exists docs_public_read on storage.objects;
drop policy if exists docs_auth_write  on storage.objects;
create policy docs_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'ashdod-docs');
create policy docs_auth_write on storage.objects for insert to authenticated
  with check (bucket_id = 'ashdod-docs');

-- 6) בדיקת התוצאה
select schemaname, tablename, policyname, roles, cmd, qual is not null as has_qual
from pg_policies where schemaname in ('public','storage') order by tablename, policyname;

-- ── מטריצת בדיקה ידנית (psql, עם rollback — בטוח מול ייצור) ──
-- begin;
-- set local role anon;
-- update public.ashdod_plans set updated_at=now();     -- מצופה: UPDATE 0 / 42501
-- rollback;
-- begin;
-- set local role authenticated;
-- set local request.jwt.claims to '{"sub":"<developer-uuid>","role":"authenticated"}';
-- update public.ashdod_plans set updated_at=now() where plan_key='1714__';  -- רק אם משויך
-- rollback;
