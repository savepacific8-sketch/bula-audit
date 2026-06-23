-- Fix infinite recursion in team_members RLS policies.
-- Run in Supabase SQL Editor after migrations 1–4.

-- Owner check (companies table only — no recursion)
create or replace function public.user_owns_company(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company_id
      and c.owner_email = public.current_user_email()
  );
$$;

-- Active member check (reads team_members as definer — bypasses RLS)
create or replace function public.user_has_team_role(
  p_company_id text,
  p_roles text[] default array['owner', 'manager', 'staff', 'accountant']
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.company_id = p_company_id
      and tm.user_email = public.current_user_email()
      and tm.status = 'active'
      and tm.role = any (p_roles)
  );
$$;

-- Replace accessible_company_ids to avoid inline team_members in policies
create or replace function public.accessible_company_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.companies c
  where c.owner_email = public.current_user_email()
  union
  select tm.company_id from public.team_members tm
  where tm.user_email = public.current_user_email()
    and tm.status = 'active';
$$;

-- ── team_members policies (drop recursive ones) ───────────────────────
drop policy if exists team_members_select on public.team_members;
drop policy if exists team_members_insert on public.team_members;
drop policy if exists team_members_update on public.team_members;
drop policy if exists team_members_delete on public.team_members;

create policy team_members_select on public.team_members
  for select using (
    public.is_app_admin()
    or public.user_owns_company(company_id)
    or public.user_has_team_role(company_id)
  );

-- Onboarding: owner row right after company create (owner via companies only)
create policy team_members_insert on public.team_members
  for insert with check (
    public.user_owns_company(company_id)
    or public.user_has_team_role(company_id, array['owner', 'manager'])
  );

create policy team_members_update on public.team_members
  for update using (
    public.is_app_admin()
    or public.user_owns_company(company_id)
    or public.user_has_team_role(company_id, array['owner', 'manager'])
  );

create policy team_members_delete on public.team_members
  for delete using (
    public.is_app_admin()
    or public.user_owns_company(company_id)
  );

-- ── subscriptions: allow insert when user owns company (onboarding trial) ─
drop policy if exists subscriptions_all on public.subscriptions;

create policy subscriptions_select on public.subscriptions
  for select using (
    company_id in (select public.accessible_company_ids())
  );

create policy subscriptions_insert on public.subscriptions
  for insert with check (
    public.user_owns_company(company_id)
    or company_id in (select public.accessible_company_ids())
  );

create policy subscriptions_update on public.subscriptions
  for update using (
    company_id in (select public.accessible_company_ids())
  );

create policy subscriptions_delete on public.subscriptions
  for delete using (
    public.user_owns_company(company_id)
    or public.user_has_team_role(company_id, array['owner', 'manager'])
  );
