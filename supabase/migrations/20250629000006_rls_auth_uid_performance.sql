-- Fix RLS performance: wrap auth.uid() as (select auth.uid()) so Postgres
-- evaluates it once per query, not once per row.
-- Run in Supabase SQL Editor (after migrations 1–5).

-- Helper functions (used by many policies)
create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from auth.users where id = (select auth.uid())
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  )
$$;

-- ── Profiles ────────────────────────────────────────────────────────────
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()) or public.is_app_admin());

create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── Conversations ───────────────────────────────────────────────────────
drop policy if exists conversations_own on public.conversations;

create policy conversations_own on public.conversations
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── Messages ──────────────────────────────────────────────────────────────
drop policy if exists messages_own on public.messages;

create policy messages_own on public.messages
  for all using (
    conversation_id in (
      select id from public.conversations where user_id = (select auth.uid())
    )
  )
  with check (
    conversation_id in (
      select id from public.conversations where user_id = (select auth.uid())
    )
  );

-- ── Backup codes ────────────────────────────────────────────────────────
drop policy if exists backup_codes_own on public.backup_codes;

create policy backup_codes_own on public.backup_codes
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
