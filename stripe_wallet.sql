-- Stripe wallet integration (CRFM)
-- Run in Supabase SQL editor. This creates idempotent tables and an RPC to apply top-ups safely.

create table if not exists public.stripe_events (
  id text primary key,
  event_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_topups (
  payment_intent_id text primary key,
  checkout_session_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cc numeric not null check (amount_cc > 0),
  stripe_event_id text not null references public.stripe_events(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Optional: track what is withdrawable (creators only). Safe default is 0 for everyone.
alter table public.profiles
  add column if not exists withdrawable_balance numeric not null default 0;

-- RPC: apply a Stripe top-up (idempotent) and credit wallet_balance.
create or replace function public.rpc_apply_stripe_topup(
  p_user_id uuid,
  p_amount_cc numeric,
  p_stripe_event_id text,
  p_payment_intent_id text,
  p_checkout_session_id text
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
  values (p_stripe_event_id, 'checkout.session.completed')
  on conflict (id) do nothing;

  -- Idempotency: one top-up per payment_intent_id.
  insert into public.stripe_topups (
    payment_intent_id,
    checkout_session_id,
    user_id,
    amount_cc,
    stripe_event_id
  ) values (
    p_payment_intent_id,
    p_checkout_session_id,
    p_user_id,
    p_amount_cc,
    p_stripe_event_id
  );

  -- Credit wallet balance.
  update public.profiles
  set wallet_balance = coalesce(wallet_balance, 0) + p_amount_cc
  where id = p_user_id
  returning wallet_balance into v_new_balance;

  -- Best-effort transaction record (if wallet_transactions exists).
  begin
    insert into public.wallet_transactions (user_id, transaction_type, amount, description)
    values (p_user_id, 'purchase_coins', p_amount_cc, 'Stripe top-up');
  exception when undefined_table then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'new_balance', v_new_balance
  );
end;
$$;

comment on function public.rpc_apply_stripe_topup is 'Apply a Stripe top-up idempotently and credit wallet_balance.';

