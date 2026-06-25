-- BULA AUDIT — Row Level Security policies

-- Helper: current user's email from auth
create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from auth.users where id = (select auth.uid())
$$;

-- Helper: company IDs the user can access
create or replace function public.accessible_company_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.companies where owner_email = public.current_user_email()
  union
  select company_id from public.team_members
  where user_email = public.current_user_email() and status = 'active'
$$;

-- Helper: is admin
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

-- ── Enable RLS ────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.backup_codes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.companies enable row level security;
alter table public.team_members enable row level security;
alter table public.receipts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_proofs enable row level security;

-- ── Profiles ────────────────────────────────────────────────────────────
create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));

create policy profiles_admin_select on public.profiles
  for select using ((select public.is_app_admin()));

create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── Companies ─────────────────────────────────────────────────────────
create policy companies_select on public.companies
  for select using (
    public.is_app_admin()
    or owner_email = public.current_user_email()
    or id in (select public.accessible_company_ids())
  );

create policy companies_insert on public.companies
  for insert with check (owner_email = public.current_user_email());

create policy companies_update on public.companies
  for update using (
    public.is_app_admin()
    or owner_email = public.current_user_email()
    or id in (
      select company_id from public.team_members
      where user_email = public.current_user_email()
        and status = 'active'
        and role in ('owner', 'manager')
    )
  );

-- ── Team members ──────────────────────────────────────────────────────
create policy team_members_select on public.team_members
  for select using (
    public.is_app_admin()
    or company_id in (select public.accessible_company_ids())
  );

create policy team_members_insert on public.team_members
  for insert with check (
    company_id in (
      select id from public.companies where owner_email = public.current_user_email()
    )
    or company_id in (
      select company_id from public.team_members
      where user_email = public.current_user_email()
        and status = 'active'
        and role in ('owner', 'manager')
    )
  );

create policy team_members_update on public.team_members
  for update using (
    public.is_app_admin()
    or company_id in (
      select id from public.companies where owner_email = public.current_user_email()
    )
    or company_id in (
      select company_id from public.team_members
      where user_email = public.current_user_email()
        and status = 'active'
        and role in ('owner', 'manager')
    )
  );

create policy team_members_delete on public.team_members
  for delete using (
    public.is_app_admin()
    or company_id in (
      select id from public.companies where owner_email = public.current_user_email()
    )
  );

-- ── Receipts ──────────────────────────────────────────────────────────
create policy receipts_select on public.receipts
  for select using (
    public.is_app_admin()
    or (deleted_at is null and company_id in (select public.accessible_company_ids()))
  );

create policy receipts_insert on public.receipts
  for insert with check (company_id in (select public.accessible_company_ids()));

create policy receipts_update on public.receipts
  for update using (company_id in (select public.accessible_company_ids()));

create policy receipts_delete on public.receipts
  for delete using (
    company_id in (
      select id from public.companies where owner_email = public.current_user_email()
    )
    or company_id in (
      select company_id from public.team_members
      where user_email = public.current_user_email()
        and status = 'active'
        and role in ('owner', 'manager')
    )
  );

-- ── Subscriptions & payment proofs ────────────────────────────────────
create policy subscriptions_all on public.subscriptions
  for all using (company_id in (select public.accessible_company_ids()))
  with check (company_id in (select public.accessible_company_ids()));

create policy payment_proofs_all on public.payment_proofs
  for all using (company_id in (select public.accessible_company_ids()))
  with check (company_id in (select public.accessible_company_ids()));

-- ── Conversations & messages ────────────────────────────────────────────
create policy conversations_own on public.conversations
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy messages_own on public.messages
  for all using (
    conversation_id in (select id from public.conversations where user_id = (select auth.uid()))
  )
  with check (
    conversation_id in (select id from public.conversations where user_id = (select auth.uid()))
  );

-- ── Audit logs (read for company members; insert via service role) ──────
create policy audit_logs_select on public.audit_logs
  for select using (
    public.is_app_admin()
    or company_id is null
    or company_id in (select public.accessible_company_ids())
  );

-- ── Backup codes ────────────────────────────────────────────────────────
create policy backup_codes_own on public.backup_codes
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
