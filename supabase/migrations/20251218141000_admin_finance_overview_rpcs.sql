-- Admin finance overview RPCs (income vs liabilities)
-- Safe defaults: requires admin via is_admin_uid(auth.uid()).

create or replace function public.rpc_admin_finance_overview(p_days integer default 30)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_days integer := greatest(coalesce(p_days, 30), 1);
  v_since timestamptz := now() - make_interval(days => v_days);

  v_wallet_total_cc numeric;
  v_withdrawable_total_cc numeric;

  v_withdraw_pending_cc numeric;
  v_withdraw_approved_cc numeric;

  v_topups_count bigint;
  v_topups_gross_cents bigint;
  v_topups_fee_cents bigint;
  v_topups_net_cents bigint;

  v_topups_count_all bigint;
  v_topups_gross_cents_all bigint;
  v_topups_fee_cents_all bigint;
  v_topups_net_cents_all bigint;

  v_platform_fee_cc numeric;
  v_streams_count bigint;
  v_stream_spend_cc numeric;

  v_membership_purchases_count bigint;
  v_membership_purchases_net_cc numeric;

  v_active_subscriptions bigint;
  v_upload_fee_track_count bigint;
  v_upload_fee_album_count bigint;

  v_topups_by_country jsonb;
  v_topups_by_city jsonb;
begin
  if auth.uid() is null or not public.is_admin_uid(auth.uid()) then
    raise exception 'admin required' using errcode = '42501';
  end if;

  select
    coalesce(sum(p.wallet_balance), 0),
    coalesce(sum(p.withdrawable_balance), 0)
  into v_wallet_total_cc, v_withdrawable_total_cc
  from public.profiles p;

  begin
    select
      coalesce(sum(case when r.status in ('pending','processing') then r.amount else 0 end), 0),
      coalesce(sum(case when r.status = 'approved' then r.amount else 0 end), 0)
    into v_withdraw_pending_cc, v_withdraw_approved_cc
    from public.wallet_action_requests r
    where r.action_type = 'withdraw';
  exception when undefined_table then
    v_withdraw_pending_cc := 0;
    v_withdraw_approved_cc := 0;
  end;

  select
    count(*)::bigint,
    coalesce(sum(st.amount_usd_cents), 0)::bigint,
    coalesce(sum(st.fee_usd_cents), 0)::bigint,
    coalesce(sum(st.net_usd_cents), 0)::bigint
  into v_topups_count, v_topups_gross_cents, v_topups_fee_cents, v_topups_net_cents
  from public.stripe_topups st
  where st.created_at >= v_since;

  select
    count(*)::bigint,
    coalesce(sum(st.amount_usd_cents), 0)::bigint,
    coalesce(sum(st.fee_usd_cents), 0)::bigint,
    coalesce(sum(st.net_usd_cents), 0)::bigint
  into v_topups_count_all, v_topups_gross_cents_all, v_topups_fee_cents_all, v_topups_net_cents_all
  from public.stripe_topups st;

  begin
    select
      coalesce(sum(pfe.platform_fee_cc), 0),
      count(*)::bigint
    into v_platform_fee_cc, v_streams_count
    from public.platform_fee_events pfe
    where pfe.created_at >= v_since;
  exception when undefined_table then
    v_platform_fee_cc := 0;
    v_streams_count := 0;
  end;

  begin
    select coalesce(sum(-wt.amount), 0)
    into v_stream_spend_cc
    from public.wallet_transactions wt
    where wt.transaction_type = 'stream_purchase'
      and wt.created_at >= v_since;
  exception when undefined_table then
    v_stream_spend_cc := 0;
  end;

  begin
    select
      count(*)::bigint,
      coalesce(sum(be.net_amount_cc), 0)
    into v_membership_purchases_count, v_membership_purchases_net_cc
    from public.billing_events be
    where be.event_type = 'membership_purchased'
      and be.created_at >= v_since;
  exception when undefined_table then
    v_membership_purchases_count := 0;
    v_membership_purchases_net_cc := 0;
  end;

  select count(*)::bigint
  into v_active_subscriptions
  from public.stripe_creator_subscriptions scs
  where lower(coalesce(scs.status, '')) in ('active', 'trialing');

  select
    coalesce(sum(case when suf.fee_type = 'track' then 1 else 0 end), 0)::bigint,
    coalesce(sum(case when suf.fee_type = 'album' then 1 else 0 end), 0)::bigint
  into v_upload_fee_track_count, v_upload_fee_album_count
  from public.stripe_upload_fees suf
  where suf.created_at >= v_since;

  select coalesce(
    jsonb_agg(jsonb_build_object('country', x.country, 'count', x.cnt) order by x.cnt desc),
    '[]'::jsonb
  )
  into v_topups_by_country
  from (
    select
      coalesce(nullif(st.fee_details->'billing_details'->'address'->>'country', ''), 'unknown') as country,
      count(*)::bigint as cnt
    from public.stripe_topups st
    where st.created_at >= v_since
    group by 1
  ) x;

  select coalesce(
    jsonb_agg(jsonb_build_object('city', x.city, 'country', x.country, 'count', x.cnt) order by x.cnt desc),
    '[]'::jsonb
  )
  into v_topups_by_city
  from (
    select
      coalesce(nullif(st.fee_details->'billing_details'->'address'->>'city', ''), 'unknown') as city,
      coalesce(nullif(st.fee_details->'billing_details'->'address'->>'country', ''), 'unknown') as country,
      count(*)::bigint as cnt
    from public.stripe_topups st
    where st.created_at >= v_since
    group by 1, 2
  ) x;

  return jsonb_build_object(
    'window_days', v_days,
    'liabilities', jsonb_build_object(
      'wallet_total_cc', v_wallet_total_cc,
      'withdrawable_total_cc', v_withdrawable_total_cc,
      'withdraw_requests_pending_cc', v_withdraw_pending_cc,
      'withdraw_requests_approved_cc', v_withdraw_approved_cc
    ),
    'topups', jsonb_build_object(
      'count_window', v_topups_count,
      'gross_usd_cents_window', v_topups_gross_cents,
      'fee_usd_cents_window', v_topups_fee_cents,
      'net_usd_cents_window', v_topups_net_cents,
      'count_all', v_topups_count_all,
      'gross_usd_cents_all', v_topups_gross_cents_all,
      'fee_usd_cents_all', v_topups_fee_cents_all,
      'net_usd_cents_all', v_topups_net_cents_all,
      'by_country_window', v_topups_by_country,
      'by_city_window', v_topups_by_city
    ),
    'streams', jsonb_build_object(
      'count_window', v_streams_count,
      'platform_fee_cc_window', v_platform_fee_cc,
      'spend_cc_window', v_stream_spend_cc
    ),
    'memberships', jsonb_build_object(
      'purchases_count_window', v_membership_purchases_count,
      'purchases_net_cc_window', v_membership_purchases_net_cc
    ),
    'creator_billing', jsonb_build_object(
      'active_subscriptions', v_active_subscriptions,
      'upload_fee_track_count_window', v_upload_fee_track_count,
      'upload_fee_album_count_window', v_upload_fee_album_count
    )
  );
end;
$$;

comment on function public.rpc_admin_finance_overview(integer) is
  'Admin-only: totals for liabilities (wallet/withdrawable) and Stripe top-ups gross/fee/net, plus basic creator billing counts.';

create or replace function public.rpc_admin_wallet_holders(p_limit integer default 50)
returns table (
  user_id uuid,
  username text,
  full_name text,
  wallet_balance numeric,
  withdrawable_balance numeric,
  is_verified_creator boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.username,
    p.full_name,
    coalesce(p.wallet_balance, 0) as wallet_balance,
    coalesce(p.withdrawable_balance, 0) as withdrawable_balance,
    coalesce(p.is_verified_creator, false) as is_verified_creator,
    p.created_at
  from public.profiles p
  order by coalesce(p.wallet_balance, 0) desc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

comment on function public.rpc_admin_wallet_holders(integer) is
  'Admin-only: list of users ordered by wallet_balance for auditing and support.';
