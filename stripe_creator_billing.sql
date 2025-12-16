-- Stripe creator billing (subscriptions + upload fees)
-- Apply in Supabase SQL editor.
--
-- Creates:
-- - profiles.stripe_customer_id / stripe_subscription_id / stripe_subscription_status (optional convenience)
-- - creator_upload_fee_credits (track/album upload credits for pay-per-upload)
-- - stripe_creator_subscriptions (last known subscription per user)
-- - stripe_upload_fees (idempotent record of upload-fee payments)
-- - RPCs called by stripe-webhook:
--   - rpc_apply_stripe_creator_subscription
--   - rpc_apply_stripe_upload_fee

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text;

create table if not exists public.creator_upload_fee_credits (
  user_id uuid not null references auth.users(id) on delete cascade,
  fee_type text not null check (fee_type in ('track', 'album')),
  credits integer not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, fee_type)
);

create table if not exists public.stripe_creator_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null,
  price_id text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_upload_fees (
  payment_intent_id text primary key,
  checkout_session_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  fee_type text not null check (fee_type in ('track', 'album')),
  stripe_event_id text not null references public.stripe_events(id) on delete restrict,
  created_at timestamptz not null default now()
);

create or replace function public.rpc_apply_stripe_creator_subscription(
  p_user_id uuid,
  p_stripe_event_id text,
  p_subscription_id text,
  p_customer_id text,
  p_price_id text default null,
  p_status text default 'active'
) returns jsonb
language plpgsql
security definer
as $$
begin
  insert into public.stripe_events (id, event_type)
  values (p_stripe_event_id, 'checkout.session.completed')
  on conflict (id) do nothing;

  insert into public.stripe_creator_subscriptions (
    subscription_id, user_id, customer_id, price_id, status
  ) values (
    p_subscription_id, p_user_id, p_customer_id, p_price_id, p_status
  )
  on conflict (subscription_id) do update set
    status = excluded.status,
    price_id = excluded.price_id,
    updated_at = now();

  update public.profiles
  set
    stripe_customer_id = p_customer_id,
    stripe_subscription_id = p_subscription_id,
    stripe_subscription_status = p_status,
    creator_upload_policy = case when p_status in ('active', 'trialing') then 'subscription' else 'free' end
  where id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.rpc_apply_stripe_creator_subscription is
  'Upserts creator subscription metadata and enables subscription upload policy when active.';

create or replace function public.rpc_apply_stripe_upload_fee(
  p_user_id uuid,
  p_fee_type text,
  p_stripe_event_id text,
  p_payment_intent_id text,
  p_checkout_session_id text
) returns jsonb
language plpgsql
security definer
as $$
begin
  if p_fee_type not in ('track', 'album') then
    raise exception 'invalid fee_type %', p_fee_type using errcode = '22000';
  end if;

  insert into public.stripe_events (id, event_type)
  values (p_stripe_event_id, 'checkout.session.completed')
  on conflict (id) do nothing;

  insert into public.stripe_upload_fees (
    payment_intent_id, checkout_session_id, user_id, fee_type, stripe_event_id
  ) values (
    p_payment_intent_id, p_checkout_session_id, p_user_id, p_fee_type, p_stripe_event_id
  );

  insert into public.creator_upload_fee_credits (user_id, fee_type, credits)
  values (p_user_id, p_fee_type, 1)
  on conflict (user_id, fee_type) do update set
    credits = public.creator_upload_fee_credits.credits + 1,
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.rpc_apply_stripe_upload_fee is
  'Idempotently records an upload-fee payment and increments creator upload credits.';
