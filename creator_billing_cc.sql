-- Creator billing via CrossCoins (CRFM)
-- Apply in Supabase SQL editor.
--
-- Adds:
-- - profiles.creator_unlimited_expires_at (prepaid unlimited uploads window, paid in CrossCoins)
-- - crfm_creator_billing_prices (server-side price list for CC purchases)
-- - RPCs:
--   - rpc_creator_purchase_unlimited_cc(plan)
--   - rpc_creator_purchase_upload_credit_cc(fee_type, quantity)
--
-- Notes:
-- - Prices default to inactive; set them explicitly before enabling CC purchases.
-- - Unlimited access is considered "active" when either:
--   - profiles.stripe_subscription_status in ('active','trialing'), OR
--   - profiles.creator_unlimited_expires_at > now()

alter table public.profiles
  add column if not exists creator_unlimited_expires_at timestamptz;

create table if not exists public.crfm_creator_billing_prices (
  key text primary key,
  price_cc numeric not null check (price_cc >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed known keys (inactive by default).
insert into public.crfm_creator_billing_prices (key, price_cc, is_active)
values
  ('unlimited_monthly', 0, false),
  ('unlimited_6mo', 0, false),
  ('unlimited_yearly', 0, false),
  ('upload_track_credit', 0, false),
  ('upload_album_credit', 0, false)
on conflict (key) do nothing;

create or replace function public.rpc_creator_purchase_unlimited_cc(
  p_plan text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_plan text := lower(coalesce(p_plan, ''));
  v_key text;
  v_days integer;
  v_price_cc numeric;
  v_new_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  if v_plan = 'monthly' then
    v_key := 'unlimited_monthly';
    v_days := 30;
  elsif v_plan = 'six_months' or v_plan = '6mo' or v_plan = 'sixmonths' then
    v_key := 'unlimited_6mo';
    v_days := 182;
  elsif v_plan = 'yearly' or v_plan = 'annual' then
    v_key := 'unlimited_yearly';
    v_days := 365;
  else
    raise exception 'invalid plan %', p_plan using errcode = '22000';
  end if;

  select price_cc
    into v_price_cc
  from public.crfm_creator_billing_prices
  where key = v_key and is_active = true
  for update;

  if v_price_cc is null or v_price_cc <= 0 then
    raise exception 'cc pricing not configured for %', v_key using errcode = '22000';
  end if;

  -- Debit wallet balance atomically.
  update public.profiles
  set wallet_balance = wallet_balance - v_price_cc
  where id = auth.uid()
    and wallet_balance >= v_price_cc;
  if not found then
    raise exception 'insufficient funds' using errcode = '22000';
  end if;

  update public.profiles
  set
    creator_upload_policy = 'subscription',
    creator_unlimited_expires_at = greatest(coalesce(creator_unlimited_expires_at, v_now), v_now) + make_interval(days => v_days),
    updated_at = v_now
  where id = auth.uid()
  returning creator_unlimited_expires_at into v_new_expires;

  -- Best-effort wallet history.
  begin
    insert into public.wallet_transactions (user_id, transaction_type, amount, description)
    values (auth.uid(), 'creator_unlimited_purchase', -v_price_cc, concat('Creator unlimited (', v_plan, ')'));
  exception when undefined_table or undefined_column then
    null;
  end;

  -- Best-effort billing event.
  begin
    insert into public.billing_events (user_id, event_type, gross_amount_cc, net_amount_cc, metadata)
    values (
      auth.uid(),
      'creator_unlimited_purchased',
      v_price_cc,
      v_price_cc,
      jsonb_build_object('plan', v_plan, 'days', v_days)
    );
  exception when undefined_table or undefined_column then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'plan', v_plan,
    'price_cc', v_price_cc,
    'expires_at', v_new_expires
  );
end;
$$;

comment on function public.rpc_creator_purchase_unlimited_cc is
  'Purchases prepaid unlimited uploads using wallet_balance (CrossCoins). Requires crfm_creator_billing_prices configured.';

create or replace function public.rpc_creator_purchase_upload_credit_cc(
  p_fee_type text,
  p_quantity integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_fee_type text := lower(coalesce(p_fee_type, ''));
  v_qty integer := coalesce(p_quantity, 1);
  v_key text;
  v_unit_price_cc numeric;
  v_total_cc numeric;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  if v_fee_type not in ('track', 'album') then
    raise exception 'invalid fee_type %', p_fee_type using errcode = '22000';
  end if;

  if v_qty <= 0 or v_qty > 100 then
    raise exception 'invalid quantity %', v_qty using errcode = '22000';
  end if;

  v_key := case when v_fee_type = 'track' then 'upload_track_credit' else 'upload_album_credit' end;

  select price_cc
    into v_unit_price_cc
  from public.crfm_creator_billing_prices
  where key = v_key and is_active = true
  for update;

  if v_unit_price_cc is null or v_unit_price_cc <= 0 then
    raise exception 'cc pricing not configured for %', v_key using errcode = '22000';
  end if;

  v_total_cc := round(v_unit_price_cc * v_qty, 2);

  -- Debit wallet balance atomically.
  update public.profiles
  set wallet_balance = wallet_balance - v_total_cc
  where id = auth.uid()
    and wallet_balance >= v_total_cc;
  if not found then
    raise exception 'insufficient funds' using errcode = '22000';
  end if;

  insert into public.creator_upload_fee_credits (user_id, fee_type, credits)
  values (auth.uid(), v_fee_type, v_qty)
  on conflict (user_id, fee_type) do update set
    credits = public.creator_upload_fee_credits.credits + v_qty,
    updated_at = now();

  -- Set a helpful default policy if still free.
  update public.profiles
  set
    creator_upload_policy = case when creator_upload_policy = 'free' then 'pay_per_upload' else creator_upload_policy end,
    updated_at = v_now
  where id = auth.uid();

  -- Best-effort wallet history.
  begin
    insert into public.wallet_transactions (user_id, transaction_type, amount, description)
    values (auth.uid(), 'creator_upload_credit_purchase', -v_total_cc, concat('Upload credits (', v_fee_type, ') x', v_qty));
  exception when undefined_table or undefined_column then
    null;
  end;

  -- Best-effort billing event.
  begin
    insert into public.billing_events (user_id, event_type, gross_amount_cc, net_amount_cc, metadata)
    values (
      auth.uid(),
      'creator_upload_credits_purchased',
      v_total_cc,
      v_total_cc,
      jsonb_build_object('fee_type', v_fee_type, 'quantity', v_qty, 'unit_price_cc', v_unit_price_cc)
    );
  exception when undefined_table or undefined_column then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'fee_type', v_fee_type,
    'quantity', v_qty,
    'total_cc', v_total_cc
  );
end;
$$;

comment on function public.rpc_creator_purchase_upload_credit_cc is
  'Purchases track/album upload credits using wallet_balance (CrossCoins). Requires crfm_creator_billing_prices configured.';

revoke all on function public.rpc_creator_purchase_unlimited_cc(text) from public;
grant execute on function public.rpc_creator_purchase_unlimited_cc(text) to authenticated;

revoke all on function public.rpc_creator_purchase_upload_credit_cc(text, integer) from public;
grant execute on function public.rpc_creator_purchase_upload_credit_cc(text, integer) to authenticated;

