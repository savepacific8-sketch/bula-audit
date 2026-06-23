-- BULA AUDIT — Supabase (PostgreSQL) schema
-- Run via Supabase CLI or SQL Editor after creating a project.

-- Extensions
create extension if not exists "pgcrypto";

-- ── Profiles (extends auth.users) ─────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  current_company_id text,
  current_company_role text check (
    current_company_role is null
    or current_company_role in ('owner', 'manager', 'staff', 'accountant')
  ),
  totp_secret text,
  totp_enabled boolean not null default false,
  totp_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (email);
create index profiles_current_company_idx on public.profiles (current_company_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2FA backup codes ──────────────────────────────────────────────────
create table public.backup_codes (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null unique,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index backup_codes_user_id_idx on public.backup_codes (user_id);

-- ── Audit log ─────────────────────────────────────────────────────────
create table public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.profiles (id) on delete set null,
  user_email text,
  action text not null,
  entity text,
  entity_id text,
  company_id text,
  ip text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_user_id_idx on public.audit_logs (user_id);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_company_id_idx on public.audit_logs (company_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at);

-- ── AI conversations ──────────────────────────────────────────────────
create table public.conversations (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles (id) on delete cascade,
  agent_id text not null,
  title text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_id_idx on public.conversations (user_id);
create index conversations_agent_id_idx on public.conversations (agent_id);

create table public.messages (
  id text primary key default gen_random_uuid()::text,
  conversation_id text not null references public.conversations (id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at);

-- ── Companies ─────────────────────────────────────────────────────────
create table public.companies (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  tin text,
  business_type text,
  phone text,
  email text,
  address text,
  vat_registered boolean not null default false,
  vat_rate double precision not null default 12.5,
  owner_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_owner_email_idx on public.companies (owner_email);

-- ── Team members ──────────────────────────────────────────────────────
create table public.team_members (
  id text primary key default gen_random_uuid()::text,
  company_id text not null references public.companies (id) on delete cascade,
  user_email text not null,
  user_name text,
  role text not null check (role in ('owner', 'manager', 'staff', 'accountant')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_email)
);

create index team_members_company_id_idx on public.team_members (company_id);
create index team_members_user_email_idx on public.team_members (user_email);

-- ── Receipts ──────────────────────────────────────────────────────────
create table public.receipts (
  id text primary key default gen_random_uuid()::text,
  company_id text not null references public.companies (id) on delete cascade,
  photo_url text not null,
  document_url text,
  document_name text,
  supplier_name text,
  supplier_tin text,
  receipt_number text,
  receipt_date date,
  due_date date,
  currency text default 'FJD',
  subtotal double precision,
  vat_type text not null default 'inclusive',
  vat_rate double precision,
  vat_amount double precision,
  total_amount double precision,
  payment_method text,
  payment_status text not null default 'unpaid',
  category text,
  item_lines jsonb,
  ai_confidence double precision,
  ai_missing_fields jsonb,
  status text not null default 'pending',
  notes text,
  uploaded_by text,
  reviewed_by text,
  reviewed_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index receipts_company_id_idx on public.receipts (company_id);
create index receipts_uploaded_by_idx on public.receipts (uploaded_by);
create index receipts_receipt_date_idx on public.receipts (receipt_date);
create index receipts_deleted_at_idx on public.receipts (deleted_at);

-- ── Subscriptions ─────────────────────────────────────────────────────
create table public.subscriptions (
  id text primary key default gen_random_uuid()::text,
  company_id text not null references public.companies (id) on delete cascade,
  plan text not null,
  billing_cycle text not null default 'monthly',
  status text not null default 'trial',
  start_date timestamptz,
  end_date timestamptz,
  next_payment_date timestamptz,
  amount_due double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_company_id_idx on public.subscriptions (company_id);

-- ── Payment proofs ────────────────────────────────────────────────────
create table public.payment_proofs (
  id text primary key default gen_random_uuid()::text,
  company_id text not null references public.companies (id) on delete cascade,
  subscription_id text references public.subscriptions (id) on delete set null,
  proof_url text not null,
  proof_filename text,
  payment_method text not null,
  amount_paid double precision not null,
  payment_date timestamptz,
  reference_number text,
  status text not null default 'pending',
  reviewed_by text,
  reviewed_date timestamptz,
  review_notes text,
  submitted_by text,
  plan_requested text,
  billing_cycle_requested text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_proofs_company_id_idx on public.payment_proofs (company_id);
create index payment_proofs_subscription_id_idx on public.payment_proofs (subscription_id);

-- FK from profiles to companies (nullable)
alter table public.profiles
  add constraint profiles_current_company_fk
  foreign key (current_company_id) references public.companies (id) on delete set null;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger team_members_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();
create trigger receipts_updated_at before update on public.receipts
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger payment_proofs_updated_at before update on public.payment_proofs
  for each row execute function public.set_updated_at();
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();
