-- Stripe creator revenue logging (upload fees + subscription invoice payments)
-- Adds gross/fee/net USD for better admin accounting.

alter table public.stripe_upload_fees
  add column if not exists currency text,
  add column if not exists amount_usd_cents integer,
  add column if not exists fee_usd_cents integer,
  add column if not exists net_usd_cents integer,
  add column if not exists charge_id text,
  add column if not exists balance_transaction_id text,
  add column if not exists fee_details jsonb;

create table if not exists public.stripe_subscription_payments (
  invoice_id text primary key,
  subscription_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text,
  payment_intent_id text,
  charge_id text,
  balance_transaction_id text,
  currency text,
  amount_usd_cents integer,
  fee_usd_cents integer,
  net_usd_cents integer,
  stripe_event_id text not null references public.stripe_events(id) on delete restrict,
  status text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);

-- Replace upload fee RPC with optional revenue fields; credits only increment once per payment_intent_id.
drop function if exists public.rpc_apply_stripe_upload_fee(uuid, text, text, text, text);

create or replace function public.rpc_apply_stripe_upload_fee(
  p_user_id uuid,
  p_fee_type text,
  p_stripe_event_id text,
  p_payment_intent_id text,
  p_checkout_session_id text,
  p_event_type text default null,
  p_currency text default null,
  p_amount_usd_cents integer default null,
  p_fee_usd_cents integer default null,
  p_net_usd_cents integer default null,
  p_charge_id text default null,
  p_balance_transaction_id text default null,
  p_fee_details jsonb default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_inserted boolean := false;
begin
  if p_fee_type not in ('track', 'album') then
    raise exception 'invalid fee_type %', p_fee_type using errcode = '22000';
  end if;

  insert into public.stripe_events (id, event_type)
  values (p_stripe_event_id, coalesce(p_event_type, 'checkout.session.completed'))
  on conflict (id) do nothing;

  with upsert as (
    insert into public.stripe_upload_fees (
      payment_intent_id,
      checkout_session_id,
      user_id,
      fee_type,
      stripe_event_id,
      currency,
      amount_usd_cents,
      fee_usd_cents,
      net_usd_cents,
      charge_id,
      balance_transaction_id,
      fee_details
    ) values (
      p_payment_intent_id,
      p_checkout_session_id,
      p_user_id,
      p_fee_type,
      p_stripe_event_id,
      p_currency,
      p_amount_usd_cents,
      p_fee_usd_cents,
      p_net_usd_cents,
      p_charge_id,
      p_balance_transaction_id,
      p_fee_details
    )
    on conflict (payment_intent_id) do update set
      checkout_session_id = excluded.checkout_session_id,
      currency = coalesce(excluded.currency, public.stripe_upload_fees.currency),
      amount_usd_cents = coalesce(excluded.amount_usd_cents, public.stripe_upload_fees.amount_usd_cents),
      fee_usd_cents = coalesce(excluded.fee_usd_cents, public.stripe_upload_fees.fee_usd_cents),
      net_usd_cents = coalesce(excluded.net_usd_cents, public.stripe_upload_fees.net_usd_cents),
      charge_id = coalesce(excluded.charge_id, public.stripe_upload_fees.charge_id),
      balance_transaction_id = coalesce(excluded.balance_transaction_id, public.stripe_upload_fees.balance_transaction_id),
      fee_details = coalesce(excluded.fee_details, public.stripe_upload_fees.fee_details),
      stripe_event_id = excluded.stripe_event_id,
      created_at = public.stripe_upload_fees.created_at
    returning (xmax = 0) as inserted
  )
  select inserted into v_inserted from upsert;

  if v_inserted then
    insert into public.creator_upload_fee_credits (user_id, fee_type, credits)
    values (p_user_id, p_fee_type, 1)
    on conflict (user_id, fee_type) do update set
      credits = public.creator_upload_fee_credits.credits + 1,
      updated_at = now();

    update public.profiles
    set creator_upload_policy = case when creator_upload_policy = 'free' then 'pay_per_upload' else creator_upload_policy end
    where id = p_user_id;
  end if;

  return jsonb_build_object('ok', true, 'inserted', v_inserted);
end;
$$;

comment on function public.rpc_apply_stripe_upload_fee is
  'Idempotently records an upload-fee payment (with gross/fee/net when available) and increments creator upload credits once.';

-- Apply subscription invoice payments (revenue) for reporting.
create or replace function public.rpc_apply_stripe_subscription_payment(
  p_user_id uuid,
  p_subscription_id text,
  p_customer_id text,
  p_invoice_id text,
  p_stripe_event_id text,
  p_payment_intent_id text default null,
  p_charge_id text default null,
  p_balance_transaction_id text default null,
  p_currency text default null,
  p_amount_usd_cents integer default null,
  p_fee_usd_cents integer default null,
  p_net_usd_cents integer default null,
  p_status text default null,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null,
  p_fee_details jsonb default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_inserted boolean := false;
begin
  insert into public.stripe_events (id, event_type)
  values (p_stripe_event_id, 'invoice.payment_succeeded')
  on conflict (id) do nothing;

  with upsert as (
    insert into public.stripe_subscription_payments (
      invoice_id,
      subscription_id,
      user_id,
      customer_id,
      payment_intent_id,
      charge_id,
      balance_transaction_id,
      currency,
      amount_usd_cents,
      fee_usd_cents,
      net_usd_cents,
      stripe_event_id,
      status,
      period_start,
      period_end
    ) values (
      p_invoice_id,
      p_subscription_id,
      p_user_id,
      p_customer_id,
      p_payment_intent_id,
      p_charge_id,
      p_balance_transaction_id,
      p_currency,
      p_amount_usd_cents,
      p_fee_usd_cents,
      p_net_usd_cents,
      p_stripe_event_id,
      p_status,
      p_period_start,
      p_period_end
    )
    on conflict (invoice_id) do update set
      payment_intent_id = coalesce(excluded.payment_intent_id, public.stripe_subscription_payments.payment_intent_id),
      charge_id = coalesce(excluded.charge_id, public.stripe_subscription_payments.charge_id),
      balance_transaction_id = coalesce(excluded.balance_transaction_id, public.stripe_subscription_payments.balance_transaction_id),
      currency = coalesce(excluded.currency, public.stripe_subscription_payments.currency),
      amount_usd_cents = coalesce(excluded.amount_usd_cents, public.stripe_subscription_payments.amount_usd_cents),
      fee_usd_cents = coalesce(excluded.fee_usd_cents, public.stripe_subscription_payments.fee_usd_cents),
      net_usd_cents = coalesce(excluded.net_usd_cents, public.stripe_subscription_payments.net_usd_cents),
      status = coalesce(excluded.status, public.stripe_subscription_payments.status),
      period_start = coalesce(excluded.period_start, public.stripe_subscription_payments.period_start),
      period_end = coalesce(excluded.period_end, public.stripe_subscription_payments.period_end),
      stripe_event_id = excluded.stripe_event_id
    returning (xmax = 0) as inserted
  )
  select inserted into v_inserted from upsert;

  -- Store fee_details in the related topups table only; subscription payments keep it in a minimal table for now.
  -- We keep p_fee_details for future extension without schema changes.
  return jsonb_build_object('ok', true, 'inserted', v_inserted);
end;
$$;

comment on function public.rpc_apply_stripe_subscription_payment is
  'Admin reporting: records subscription invoice payments idempotently (gross/fee/net) for Stripe creator subscriptions.';

