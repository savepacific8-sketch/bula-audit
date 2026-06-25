-- Fix profiles RLS: avoid is_app_admin() in own-row policy (can cause policy recursion).
-- Run in Supabase SQL Editor after migrations 1–7.

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_admin_select on public.profiles;

create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));

create policy profiles_admin_select on public.profiles
  for select using ((select public.is_app_admin()));

create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Ensure signup trigger can insert profile (service role / trigger runs as definer)
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (id = (select auth.uid()));
