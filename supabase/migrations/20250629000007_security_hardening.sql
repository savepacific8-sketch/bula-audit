-- Security hardening for Supabase Database Linter warnings.
-- Run in Supabase SQL Editor after migrations 1–6.

-- ── 1. set_updated_at: pin search_path ────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ── 2. RLS helpers: not callable via PostgREST /rpc (still used in policies) ─
revoke all on function public.current_user_email() from public, anon, authenticated;
revoke all on function public.accessible_company_ids() from public, anon, authenticated;
revoke all on function public.is_app_admin() from public, anon, authenticated;
revoke all on function public.user_owns_company(text) from public, anon, authenticated;
revoke all on function public.user_has_team_role(text, text[]) from public, anon, authenticated;

grant execute on function public.current_user_email() to service_role;
grant execute on function public.accessible_company_ids() to service_role;
grant execute on function public.is_app_admin() to service_role;
grant execute on function public.user_owns_company(text) to service_role;
grant execute on function public.user_has_team_role(text, text[]) to service_role;

-- ── 3. Trigger-only functions: block direct RPC ─────────────────────────
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Supabase platform helper (if present)
do $$
begin
  revoke all on function public.rls_auto_enable() from public, anon, authenticated;
exception
  when undefined_function then null;
end $$;
