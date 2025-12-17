-- Wallet actions + admin controls (apply in Supabase SQL editor or psql)
-- - Table: wallet_action_requests (user-submitted add_funds/withdraw/redeem_code)
-- - Table: wallet_methods (admin-managed payment/payout methods)
-- - Table: wallet_redeem_codes (admin-managed promo/gift codes)
-- - RPC: request_wallet_action (safe insert with guardrails)

-- Helper used across CRFM policies/RPCs.
-- Uses profiles.is_admin and works even when RLS is enabled (SECURITY DEFINER).
create or replace function public.is_admin_uid(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = p_uid), false);
$$;

create table if not exists public.wallet_action_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    action_type text not null check (action_type in ('add_funds', 'withdraw', 'redeem_code')),
    amount numeric,
    code text,
    metadata jsonb default '{}'::jsonb,
    status text not null default 'pending' check (status in ('pending', 'processing', 'approved', 'rejected')),
    requested_at timestamptz not null default now(),
    processed_at timestamptz,
    processed_by uuid references auth.users(id),
    admin_notes text,
    constraint wallet_action_amount_check check (
        (action_type = 'redeem_code' and amount is null)
        or (action_type <> 'redeem_code' and amount is not null and amount > 0)
    )
);

create table if not exists public.wallet_methods (
    id uuid primary key default gen_random_uuid(),
    method_type text not null check (method_type in ('add_funds', 'withdraw')),
    name text not null,
    provider text,
    instructions text,
    is_active boolean not null default true,
    config jsonb default '{}'::jsonb,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.wallet_redeem_codes (
    code text primary key,
    amount numeric not null check (amount > 0),
    expires_at timestamptz,
    max_uses integer not null default 1 check (max_uses > 0),
    usage_count integer not null default 0,
    is_active boolean not null default true,
    metadata jsonb default '{}'::jsonb,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint wallet_redeem_codes_usage check (usage_count <= max_uses)
);

comment on table public.wallet_action_requests is 'User-submitted wallet actions; processed server-side only.';
comment on table public.wallet_methods is 'Admin-managed list of allowed add_funds / withdraw methods.';
comment on table public.wallet_redeem_codes is 'Admin-created promo/gift codes; validated server-side.';

alter table public.wallet_action_requests enable row level security;
alter table public.wallet_methods enable row level security;
alter table public.wallet_redeem_codes enable row level security;

-- Policies: users can insert/read their own requests; only admins manage others
do $$
begin
    if not exists (
        select 1 from pg_policies
        where policyname = 'wallet_action_requests_select_self_or_admin'
    ) then
        create policy wallet_action_requests_select_self_or_admin on public.wallet_action_requests
        for select using (auth.uid() = user_id or is_admin_uid(auth.uid()));
    end if;

    if not exists (
        select 1 from pg_policies
        where policyname = 'wallet_action_requests_insert_self'
    ) then
        create policy wallet_action_requests_insert_self on public.wallet_action_requests
        for insert with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where policyname = 'wallet_action_requests_admin_update'
    ) then
        create policy wallet_action_requests_admin_update on public.wallet_action_requests
        for update using (is_admin_uid(auth.uid()));
    end if;
end $$;

-- Policies: wallet_methods editable by admins; readable by authenticated users
do $$
begin
    if not exists (
        select 1 from pg_policies
        where policyname = 'wallet_methods_select_any'
    ) then
        create policy wallet_methods_select_any on public.wallet_methods
        for select using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));
    end if;

    if not exists (
        select 1 from pg_policies
        where policyname = 'wallet_methods_admin_insert'
    ) then
        create policy wallet_methods_admin_insert on public.wallet_methods
        for insert with check (is_admin_uid(auth.uid()));
    end if;

    if not exists (
        select 1 from pg_policies
        where policyname = 'wallet_methods_admin_update'
    ) then
        create policy wallet_methods_admin_update on public.wallet_methods
        for update using (is_admin_uid(auth.uid()));
    end if;
end $$;

-- Policies: redeem codes only visible/manageable by admins
do $$
begin
    if not exists (
        select 1 from pg_policies
        where policyname = 'wallet_redeem_codes_admin_select'
    ) then
        create policy wallet_redeem_codes_admin_select on public.wallet_redeem_codes
        for select using (is_admin_uid(auth.uid()));
    end if;

    if not exists (
        select 1 from pg_policies
        where policyname = 'wallet_redeem_codes_admin_insert'
    ) then
        create policy wallet_redeem_codes_admin_insert on public.wallet_redeem_codes
        for insert with check (is_admin_uid(auth.uid()));
    end if;

    if not exists (
        select 1 from pg_policies
        where policyname = 'wallet_redeem_codes_admin_update'
    ) then
        create policy wallet_redeem_codes_admin_update on public.wallet_redeem_codes
        for update using (is_admin_uid(auth.uid()));
    end if;
end $$;

-- RPC to insert requests safely (enforces user/admin ownership)
create or replace function public.request_wallet_action(
    p_user_id uuid,
    p_action_type text,
    p_amount numeric default null,
    p_code text default null,
    p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
    v_id uuid;
begin
    if auth.uid() is null then
        raise exception 'auth required' using errcode = '42501';
    end if;

    if auth.uid() <> p_user_id and not is_admin_uid(auth.uid()) then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    if p_action_type not in ('add_funds', 'withdraw', 'redeem_code') then
        raise exception 'invalid action type %', p_action_type using errcode = '22000';
    end if;

    if p_action_type <> 'redeem_code' and (p_amount is null or p_amount <= 0) then
        raise exception 'amount must be > 0 for %', p_action_type using errcode = '22000';
    end if;

    if p_action_type = 'redeem_code' and (p_code is null or length(trim(p_code)) = 0) then
        raise exception 'code required for redeem_code' using errcode = '22000';
    end if;

    insert into public.wallet_action_requests (
        user_id, action_type, amount, code, metadata, status
    ) values (
        p_user_id, p_action_type, p_amount, p_code, coalesce(p_metadata, '{}'::jsonb), 'pending'
    )
    returning id into v_id;

    return v_id;
end;
$$;

comment on function public.request_wallet_action is 'Inserts a wallet action request with ownership/validation checks.';
