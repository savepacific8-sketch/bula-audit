-- Restore EXECUTE on RLS helper functions for the authenticated role.
-- Migration #7 revoked these to block PostgREST /rpc calls, but PostgreSQL
-- also requires EXECUTE when the same functions appear inside RLS policies.
-- Run in Supabase SQL Editor after migration #7.

grant execute on function public.current_user_email() to authenticated;
grant execute on function public.accessible_company_ids() to authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.user_owns_company(text) to authenticated;
grant execute on function public.user_has_team_role(text, text[]) to authenticated;

-- Keep blocked for anonymous (not logged in)
revoke all on function public.current_user_email() from anon;
revoke all on function public.accessible_company_ids() from anon;
revoke all on function public.is_app_admin() from anon;
revoke all on function public.user_owns_company(text) from anon;
revoke all on function public.user_has_team_role(text, text[]) from anon;
