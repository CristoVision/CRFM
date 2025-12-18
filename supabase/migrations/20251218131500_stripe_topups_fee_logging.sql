-- Log Stripe gross/fee/net for top-ups (transparency + accurate admin reporting)
-- Safe to run multiple times.

alter table public.stripe_topups
  add column if not exists currency text,
  add column if not exists amount_usd_cents integer,
  add column if not exists fee_usd_cents integer,
  add column if not exists net_usd_cents integer,
  add column if not exists charge_id text,
  add column if not exists balance_transaction_id text,
  add column if not exists fee_details jsonb;

-- Replace function with a version that supports optional USD/fee/net fields.
drop function if exists public.rpc_apply_stripe_topup(uuid, numeric, text, text, text);

create or replace function public.rpc_apply_stripe_topup(
  p_user_id uuid,
  p_amount_cc numeric,
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
  v_new_balance numeric;
begin
  if p_amount_cc is null or p_amount_cc <= 0 then
    raise exception 'amount_cc must be > 0' using errcode = '22000';
  end if;

  -- Idempotency: insert Stripe event once.
  insert into public.stripe_events (id, event_type)
  values (p_stripe_event_id, coalesce(p_event_type, 'payment_intent.succeeded'))
  on conflict (id) do nothing;

  -- Idempotency: one top-up per payment_intent_id.
  insert into public.stripe_topups (
    payment_intent_id,
    checkout_session_id,
    user_id,
    amount_cc,
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
    p_amount_cc,
    p_stripe_event_id,
    p_currency,
    p_amount_usd_cents,
    p_fee_usd_cents,
    p_net_usd_cents,
    p_charge_id,
    p_balance_transaction_id,
    p_fee_details
  );

  -- Credit wallet balance.
  update public.profiles
  set wallet_balance = coalesce(wallet_balance, 0) + p_amount_cc
  where id = p_user_id
  returning wallet_balance into v_new_balance;

  -- Best-effort transaction record (if wallet_transactions exists).
  begin
    insert into public.wallet_transactions (user_id, transaction_type, amount, description, details)
    values (
      p_user_id,
      'top-up',
      p_amount_cc,
      case
        when p_amount_usd_cents is null then 'Stripe top-up'
        else format('Stripe top-up ($%s)', to_char((p_amount_usd_cents::numeric / 100), 'FM999999990.00'))
      end,
      jsonb_build_object(
        'kind', 'stripe_topup',
        'payment_intent_id', p_payment_intent_id,
        'checkout_session_id', p_checkout_session_id,
        'stripe_event_id', p_stripe_event_id,
        'currency', p_currency,
        'amount_usd_cents', p_amount_usd_cents,
        'fee_usd_cents', p_fee_usd_cents,
        'net_usd_cents', p_net_usd_cents,
        'charge_id', p_charge_id,
        'balance_transaction_id', p_balance_transaction_id,
        'fee_details', p_fee_details
      )
    );
  exception when undefined_table then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'new_balance', v_new_balance
  );
end;
$$;

comment on function public.rpc_apply_stripe_topup is 'Apply a Stripe top-up idempotently, credit wallet_balance, and record gross/fee/net for transparency.';

