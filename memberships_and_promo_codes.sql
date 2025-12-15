-- Memberships + promo codes (apply in Supabase SQL editor or psql)
-- Goals:
-- - Creator membership tiers purchasable with CrossCoins (wallet_balance)
-- - Secure, auditable promo codes (membership grants + membership discounts)
-- - No Edge Functions; all server-side logic via Postgres + RLS + SECURITY DEFINER RPCs

-- =========================
-- Tables
-- =========================

-- Creator-defined membership tiers (price + duration)
create table if not exists public.creator_membership_tiers (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  price_cc numeric not null check (price_cc >= 0),
  duration_days integer not null default 30 check (duration_days > 0),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_creator_membership_tiers_creator on public.creator_membership_tiers(creator_id);

-- User membership entitlements for a creator
create table if not exists public.creator_memberships (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tier_id uuid references public.creator_membership_tiers(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'canceled', 'expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  source_type text not null default 'purchase' check (source_type in ('purchase', 'promo_code', 'admin_grant')),
  source_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_creator_memberships_user on public.creator_memberships(user_id);
create index if not exists idx_creator_memberships_creator on public.creator_memberships(creator_id);

-- Only one active membership per creator/user (extend instead of duplicating)
create unique index if not exists uniq_creator_memberships_active
  on public.creator_memberships(creator_id, user_id)
  where status = 'active';

-- Promo codes: discounts and membership grants (wallet credit codes remain in wallet_redeem_codes)
create table if not exists public.promo_codes (
  code text primary key,
  code_type text not null check (code_type in ('membership_grant', 'membership_discount_percent')),
  creator_id uuid references public.profiles(id) on delete cascade,
  tier_id uuid references public.creator_membership_tiers(id) on delete set null,
  -- membership_grant
  grant_duration_days integer check (grant_duration_days is null or grant_duration_days > 0),
  -- membership_discount_percent
  discount_percent numeric check (discount_percent is null or (discount_percent > 0 and discount_percent <= 100)),
  first_time_only boolean not null default false,
  expires_at timestamptz,
  max_uses integer not null default 1 check (max_uses > 0),
  usage_count integer not null default 0,
  max_uses_per_user integer not null default 1 check (max_uses_per_user > 0),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_codes_usage_check check (usage_count <= max_uses),
  constraint promo_codes_kind_fields_check check (
    (code_type = 'membership_grant' and creator_id is not null and grant_duration_days is not null)
    or
    (code_type = 'membership_discount_percent' and discount_percent is not null)
  )
);

create index if not exists idx_promo_codes_creator on public.promo_codes(creator_id);
create index if not exists idx_promo_codes_active on public.promo_codes(is_active, expires_at);

-- Immutable redemption log (for audit + per-user use limits)
create table if not exists public.promo_code_redemptions (
  id uuid primary key default uuid_generate_v4(),
  code text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  redemption_type text not null check (redemption_type in ('wallet_credit', 'membership_grant', 'membership_purchase_discount')),
  creator_id uuid references public.profiles(id) on delete set null,
  tier_id uuid references public.creator_membership_tiers(id) on delete set null,
  wallet_amount_cc numeric,
  discount_percent numeric,
  discount_amount_cc numeric,
  charged_amount_cc numeric,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_promo_code_redemptions_code_user on public.promo_code_redemptions(code, user_id);

-- Wallet-code redemptions (for existing wallet_redeem_codes table)
create table if not exists public.wallet_code_redemptions (
  id uuid primary key default uuid_generate_v4(),
  code text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  amount_cc numeric not null check (amount_cc > 0),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists uniq_wallet_code_redemptions_code_user on public.wallet_code_redemptions(code, user_id);

-- Normalized billing/audit events (keeps your economics traceable over time)
create table if not exists public.billing_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'wallet_code_redeemed',
      'membership_granted',
      'membership_purchased'
    )
  ),
  creator_id uuid references public.profiles(id) on delete set null,
  tier_id uuid references public.creator_membership_tiers(id) on delete set null,
  code text,
  gross_amount_cc numeric,
  discount_amount_cc numeric,
  net_amount_cc numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_events_user on public.billing_events(user_id, created_at desc);
create index if not exists idx_billing_events_creator on public.billing_events(creator_id, created_at desc);

comment on table public.creator_membership_tiers is 'Creator-configurable tiers priced in CrossCoins.';
comment on table public.creator_memberships is 'User entitlements for creator memberships (extend instead of duplicating).';
comment on table public.promo_codes is 'Admin-managed promo codes (membership grants + membership discounts).';
comment on table public.promo_code_redemptions is 'Immutable log for promo code use (enforces per-user limits + audits).';
comment on table public.wallet_code_redemptions is 'Immutable log for wallet_redeem_codes redemptions (per-user uniqueness).';
comment on table public.billing_events is 'Auditable billing ledger for wallet codes and memberships.';

-- =========================
-- RLS
-- =========================
alter table public.creator_membership_tiers enable row level security;
alter table public.creator_memberships enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_code_redemptions enable row level security;
alter table public.wallet_code_redemptions enable row level security;
alter table public.billing_events enable row level security;

do $$
begin
  -- Membership tiers:
  -- - Anyone authenticated can read active tiers
  -- - Creator can manage their own tiers
  -- - Admin can manage all tiers
  if not exists (select 1 from pg_policies where polname = 'creator_membership_tiers_select_active') then
    create policy creator_membership_tiers_select_active on public.creator_membership_tiers
      for select using (is_active = true and auth.role() in ('anon', 'authenticated'));
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_membership_tiers_select_admin') then
    create policy creator_membership_tiers_select_admin on public.creator_membership_tiers
      for select using (is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_membership_tiers_creator_insert') then
    create policy creator_membership_tiers_creator_insert on public.creator_membership_tiers
      for insert with check (auth.uid() = creator_id or is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_membership_tiers_creator_update') then
    create policy creator_membership_tiers_creator_update on public.creator_membership_tiers
      for update using (auth.uid() = creator_id or is_admin_uid(auth.uid()));
  end if;

  -- Membership entitlements:
  if not exists (select 1 from pg_policies where polname = 'creator_memberships_select_self_or_creator_or_admin') then
    create policy creator_memberships_select_self_or_creator_or_admin on public.creator_memberships
      for select using (auth.uid() = user_id or auth.uid() = creator_id or is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_memberships_admin_update') then
    create policy creator_memberships_admin_update on public.creator_memberships
      for update using (is_admin_uid(auth.uid()));
  end if;

  -- Promo codes: admins only (users redeem via RPC)
  if not exists (select 1 from pg_policies where polname = 'promo_codes_admin_select') then
    create policy promo_codes_admin_select on public.promo_codes
      for select using (is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'promo_codes_admin_insert') then
    create policy promo_codes_admin_insert on public.promo_codes
      for insert with check (is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'promo_codes_admin_update') then
    create policy promo_codes_admin_update on public.promo_codes
      for update using (is_admin_uid(auth.uid()));
  end if;

  -- Redemption logs: self/admin read; inserts done via RPC (SECURITY DEFINER)
  if not exists (select 1 from pg_policies where polname = 'promo_code_redemptions_select_self_or_admin') then
    create policy promo_code_redemptions_select_self_or_admin on public.promo_code_redemptions
      for select using (auth.uid() = user_id or is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'wallet_code_redemptions_select_self_or_admin') then
    create policy wallet_code_redemptions_select_self_or_admin on public.wallet_code_redemptions
      for select using (auth.uid() = user_id or is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'billing_events_select_self_or_admin') then
    create policy billing_events_select_self_or_admin on public.billing_events
      for select using (auth.uid() = user_id or is_admin_uid(auth.uid()));
  end if;
end $$;

-- =========================
-- RPCs
-- =========================

-- Redeem a code (supports: wallet_redeem_codes credits + promo_codes membership grants)
create or replace function public.redeem_code(
  p_code text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_code text;
  v_wallet_amount numeric;
  v_now timestamptz := now();
  v_creator_id uuid;
  v_tier_id uuid;
  v_duration_days integer;
  v_max_uses_per_user integer;
  v_new_expiry timestamptz;
  v_membership_id uuid;
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  v_code := upper(trim(coalesce(p_code, '')));
  if length(v_code) = 0 then
    raise exception 'code required' using errcode = '22000';
  end if;

  -- 1) Try wallet credit codes (wallet_redeem_codes)
  select amount
    into v_wallet_amount
  from public.wallet_redeem_codes
  where code = v_code
    and is_active = true
    and (expires_at is null or expires_at > v_now)
    and usage_count < max_uses
  for update;

  if v_wallet_amount is not null then
    if exists (
      select 1 from public.wallet_code_redemptions
      where code = v_code and user_id = auth.uid()
    ) then
      raise exception 'code already used' using errcode = '22000';
    end if;

    update public.wallet_redeem_codes
    set usage_count = usage_count + 1, updated_at = v_now
    where code = v_code;

    insert into public.wallet_code_redemptions (code, user_id, amount_cc, metadata)
    values (v_code, auth.uid(), v_wallet_amount, coalesce(p_metadata, '{}'::jsonb));

    -- Wallet balance update
    update public.profiles
    set wallet_balance = coalesce(wallet_balance, 0) + v_wallet_amount
    where id = auth.uid();

    -- Wallet history (best-effort; if schema differs, redemption still succeeds)
    begin
      insert into public.wallet_transactions (user_id, transaction_type, amount, description)
      values (auth.uid(), 'wallet_code_redeem', v_wallet_amount, concat('Redeemed code ', v_code));
    exception when undefined_table or undefined_column then
      -- Ignore if wallet_transactions shape differs in a given deployment.
      null;
    end;

    insert into public.billing_events (user_id, event_type, code, gross_amount_cc, net_amount_cc, metadata)
    values (auth.uid(), 'wallet_code_redeemed', v_code, v_wallet_amount, v_wallet_amount, coalesce(p_metadata, '{}'::jsonb))
    returning id into v_event_id;

    return jsonb_build_object(
      'ok', true,
      'type', 'wallet_credit',
      'code', v_code,
      'amount_cc', v_wallet_amount,
      'billing_event_id', v_event_id
    );
  end if;

  -- 2) Try membership-grant promo codes (promo_codes)
  select creator_id, tier_id, grant_duration_days, max_uses_per_user
    into v_creator_id, v_tier_id, v_duration_days, v_max_uses_per_user
  from public.promo_codes
  where code = v_code
    and code_type = 'membership_grant'
    and is_active = true
    and (expires_at is null or expires_at > v_now)
    and usage_count < max_uses
  for update;

  if v_creator_id is null then
    raise exception 'invalid or unavailable code' using errcode = '22000';
  end if;

  if coalesce(v_max_uses_per_user, 1) <= (
    select count(*) from public.promo_code_redemptions
    where code = v_code and user_id = auth.uid()
  ) then
    raise exception 'code already used' using errcode = '22000';
  end if;

  update public.promo_codes
  set usage_count = usage_count + 1, updated_at = v_now
  where code = v_code;

  insert into public.billing_events (user_id, event_type, creator_id, tier_id, code, metadata)
  values (auth.uid(), 'membership_granted', v_creator_id, v_tier_id, v_code, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_event_id;

  -- Upsert/extend membership
  select id, expires_at
    into v_membership_id, v_new_expiry
  from public.creator_memberships
  where creator_id = v_creator_id and user_id = auth.uid() and status = 'active'
  for update;

  if v_membership_id is not null then
    if v_new_expiry is null then
      -- lifetime membership: no-op
      null;
    else
      update public.creator_memberships
      set expires_at = v_new_expiry + (make_interval(days => v_duration_days)),
          tier_id = coalesce(v_tier_id, tier_id),
          source_type = 'promo_code',
          source_code = v_code,
          updated_at = v_now
      where id = v_membership_id;
    end if;
  else
    v_new_expiry := v_now + (make_interval(days => v_duration_days));
    insert into public.creator_memberships (
      creator_id, user_id, tier_id, status, started_at, expires_at, source_type, source_code, metadata
    ) values (
      v_creator_id, auth.uid(), v_tier_id, 'active', v_now, v_new_expiry, 'promo_code', v_code,
      jsonb_build_object('billing_event_id', v_event_id)
    ) returning id into v_membership_id;
  end if;

  insert into public.promo_code_redemptions (
    code, user_id, redeemed_at, redemption_type, creator_id, tier_id, metadata
  ) values (
    v_code, auth.uid(), v_now, 'membership_grant', v_creator_id, v_tier_id, coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'ok', true,
    'type', 'membership_grant',
    'code', v_code,
    'creator_id', v_creator_id,
    'tier_id', v_tier_id,
    'duration_days', v_duration_days,
    'membership_id', v_membership_id,
    'billing_event_id', v_event_id
  );
end;
$$;

comment on function public.redeem_code is 'Redeems wallet credit codes and membership-grant promo codes securely (atomic, auditable).';

-- Purchase a creator membership using wallet_balance, optionally applying a discount code.
create or replace function public.purchase_creator_membership(
  p_creator_id uuid,
  p_tier_id uuid,
  p_code text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_code text := null;
  v_tier public.creator_membership_tiers%rowtype;
  v_price_cc numeric;
  v_discount_percent numeric := 0;
  v_code_creator_id uuid;
  v_code_first_time_only boolean;
  v_code_max_uses_per_user integer;
  v_discount_amount_cc numeric := 0;
  v_net_cc numeric;
  v_membership_id uuid;
  v_expires_at timestamptz;
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if p_creator_id is null or p_tier_id is null then
    raise exception 'creator_id and tier_id required' using errcode = '22000';
  end if;

  select *
    into v_tier
  from public.creator_membership_tiers
  where id = p_tier_id and creator_id = p_creator_id and is_active = true;

  if v_tier.id is null then
    raise exception 'tier not found' using errcode = '22000';
  end if;

  v_price_cc := coalesce(v_tier.price_cc, 0);

  if p_code is not null and length(trim(p_code)) > 0 then
    v_code := upper(trim(p_code));

    select discount_percent, creator_id, first_time_only, max_uses_per_user
      into v_discount_percent, v_code_creator_id, v_code_first_time_only, v_code_max_uses_per_user
    from public.promo_codes
    where code = v_code
      and code_type = 'membership_discount_percent'
      and is_active = true
      and (expires_at is null or expires_at > v_now)
      and usage_count < max_uses
      and (
        creator_id is null
        or creator_id = p_creator_id
      )
    for update;

    if v_discount_percent is null then
      raise exception 'invalid discount code' using errcode = '22000';
    end if;

    if coalesce(v_code_max_uses_per_user, 1) <= (
      select count(*) from public.promo_code_redemptions
      where code = v_code and user_id = auth.uid()
    ) then
      raise exception 'code already used' using errcode = '22000';
    end if;

    -- First-time-only guard: block if user has ever purchased for this creator
    if v_code_first_time_only then
      if exists (
        select 1 from public.billing_events
        where user_id = auth.uid()
          and creator_id = p_creator_id
          and event_type = 'membership_purchased'
      ) then
        raise exception 'discount only valid for first purchase' using errcode = '22000';
      end if;
    end if;

    v_discount_amount_cc := round(v_price_cc * (v_discount_percent / 100.0), 2);
  end if;

  v_net_cc := greatest(round(v_price_cc - v_discount_amount_cc, 2), 0);

  -- Deduct wallet balance atomically (requires profiles.wallet_balance)
  if v_net_cc > 0 then
    update public.profiles
    set wallet_balance = wallet_balance - v_net_cc
    where id = auth.uid() and wallet_balance >= v_net_cc;
    if not found then
      raise exception 'insufficient funds' using errcode = '22000';
    end if;
  end if;

  -- Extend or create membership
  select id, expires_at
    into v_membership_id, v_expires_at
  from public.creator_memberships
  where creator_id = p_creator_id and user_id = auth.uid() and status = 'active'
  for update;

  if v_membership_id is not null then
    if v_expires_at is null then
      -- lifetime membership: no-op
      null;
    else
      update public.creator_memberships
      set expires_at = greatest(v_expires_at, v_now) + (make_interval(days => v_tier.duration_days)),
          tier_id = p_tier_id,
          source_type = 'purchase',
          source_code = v_code,
          updated_at = v_now
      where id = v_membership_id;
    end if;
  else
    v_expires_at := v_now + (make_interval(days => v_tier.duration_days));
    insert into public.creator_memberships (
      creator_id, user_id, tier_id, status, started_at, expires_at, source_type, source_code, metadata
    ) values (
      p_creator_id, auth.uid(), p_tier_id, 'active', v_now, v_expires_at, 'purchase', v_code, '{}'::jsonb
    ) returning id into v_membership_id;
  end if;

  -- Wallet history (best-effort)
  if v_net_cc > 0 then
    begin
      insert into public.wallet_transactions (user_id, transaction_type, amount, description)
      values (auth.uid(), 'membership_purchase', -v_net_cc, concat('Membership purchase: ', v_tier.name));
    exception when undefined_table or undefined_column then
      null;
    end;
  end if;

  insert into public.billing_events (
    user_id, event_type, creator_id, tier_id, code, gross_amount_cc, discount_amount_cc, net_amount_cc, metadata
  ) values (
    auth.uid(), 'membership_purchased', p_creator_id, p_tier_id, v_code, v_price_cc, v_discount_amount_cc, v_net_cc,
    jsonb_build_object('tier_name', v_tier.name, 'duration_days', v_tier.duration_days)
  ) returning id into v_event_id;

  if v_code is not null then
    update public.promo_codes
    set usage_count = usage_count + 1, updated_at = v_now
    where code = v_code;

    insert into public.promo_code_redemptions (
      code, user_id, redeemed_at, redemption_type, creator_id, tier_id,
      discount_percent, discount_amount_cc, charged_amount_cc, metadata
    ) values (
      v_code, auth.uid(), v_now, 'membership_purchase_discount', p_creator_id, p_tier_id,
      v_discount_percent, v_discount_amount_cc, v_net_cc, coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'membership_id', v_membership_id,
    'creator_id', p_creator_id,
    'tier_id', p_tier_id,
    'gross_cc', v_price_cc,
    'discount_percent', v_discount_percent,
    'discount_cc', v_discount_amount_cc,
    'net_cc', v_net_cc,
    'billing_event_id', v_event_id
  );
end;
$$;

comment on function public.purchase_creator_membership is 'Purchases/extends a creator membership using wallet_balance; applies membership discount codes securely.';

-- Grant minimum execute privileges to authenticated users for the RPCs
revoke all on function public.redeem_code(text, jsonb) from public;
grant execute on function public.redeem_code(text, jsonb) to authenticated;

revoke all on function public.purchase_creator_membership(uuid, uuid, text, jsonb) from public;
grant execute on function public.purchase_creator_membership(uuid, uuid, text, jsonb) to authenticated;
