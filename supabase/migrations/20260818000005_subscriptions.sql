-- NORAV V0.1 — Migration 0005: Subscription-ready data models (§17).
--
-- Data models only: NO payment provider, NO checkout, NO pricing is
-- implemented or invented in this milestone. Feature access is designed to
-- be entitlement-based instead of scattered `if user.isPaid` checks.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,          -- e.g. 'free', 'paid'
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create table public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  entitlement_key text not null,
  limit_value int,                        -- null = unlimited / boolean grant
  created_at timestamptz not null default now(),
  unique (plan_id, entitlement_key)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status public.subscription_status not null default 'active',
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_user on public.subscriptions (user_id);

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  user_id uuid not null references public.app_users (id) on delete cascade,
  amount_cents int check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'EUR',
  status public.payment_status not null default 'pending',
  provider text,                          -- future, e.g. 'stripe'
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_user on public.payments (user_id);

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- Resolved per-user feature grants. Application code checks entitlements —
-- never plan flags — for feature access (§17).
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  entitlement_key text not null,
  limit_value int,
  source_subscription_id uuid references public.subscriptions (id) on delete set null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entitlement_key)
);

create index idx_entitlements_user on public.entitlements (user_id);

create trigger trg_entitlements_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();
