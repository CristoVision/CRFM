-- Creator finance overview (for Hub Monetization / wallet transparency)

create or replace function public.rpc_creator_finance_overview(p_days integer default 30)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_days integer := greatest(coalesce(p_days, 30), 1);
  v_since timestamptz := now() - make_interval(days => v_days);

  v_wallet_cc numeric := 0;
  v_withdrawable_cc numeric := 0;
  v_withdraw_pending_cc numeric := 0;
  v_withdraw_approved_cc numeric := 0;

  v_stream_earnings_cc numeric := 0;
  v_platform_fee_cc numeric := 0;

  v_track_credits integer := 0;
  v_album_credits integer := 0;

  v_sub_status text := null;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select
    coalesce(p.wallet_balance, 0),
    coalesce(p.withdrawable_balance, 0),
    p.stripe_subscription_status
  into v_wallet_cc, v_withdrawable_cc, v_sub_status
  from public.profiles p
  where p.id = auth.uid();

  begin
    select
      coalesce(sum(case when r.status in ('pending','processing') then r.amount else 0 end), 0),
      coalesce(sum(case when r.status = 'approved' then r.amount else 0 end), 0)
    into v_withdraw_pending_cc, v_withdraw_approved_cc
    from public.wallet_action_requests r
    where r.user_id = auth.uid()
      and r.action_type = 'withdraw';
  exception when undefined_table then
    v_withdraw_pending_cc := 0;
    v_withdraw_approved_cc := 0;
  end;

  begin
    select coalesce(sum(wt.amount), 0)
    into v_stream_earnings_cc
    from public.wallet_transactions wt
    where wt.user_id = auth.uid()
      and wt.transaction_type = 'stream_earning'
      and wt.created_at >= v_since;
  exception when undefined_table then
    v_stream_earnings_cc := 0;
  end;

  begin
    select coalesce(sum(pfe.platform_fee_cc), 0)
    into v_platform_fee_cc
    from public.platform_fee_events pfe
    where pfe.uploader_id = auth.uid()
      and pfe.created_at >= v_since;
  exception when undefined_table then
    v_platform_fee_cc := 0;
  end;

  begin
    select
      coalesce(max(case when c.fee_type = 'track' then c.credits end), 0)::integer,
      coalesce(max(case when c.fee_type = 'album' then c.credits end), 0)::integer
    into v_track_credits, v_album_credits
    from public.creator_upload_fee_credits c
    where c.user_id = auth.uid();
  exception when undefined_table then
    v_track_credits := 0;
    v_album_credits := 0;
  end;

  return jsonb_build_object(
    'window_days', v_days,
    'balances', jsonb_build_object(
      'wallet_cc', v_wallet_cc,
      'withdrawable_cc', v_withdrawable_cc,
      'withdraw_pending_cc', v_withdraw_pending_cc,
      'withdraw_approved_cc', v_withdraw_approved_cc
    ),
    'streams', jsonb_build_object(
      'earnings_cc_window', v_stream_earnings_cc,
      'platform_fee_cc_on_your_streams_window', v_platform_fee_cc
    ),
    'uploads', jsonb_build_object(
      'track_credits', v_track_credits,
      'album_credits', v_album_credits
    ),
    'subscription', jsonb_build_object(
      'stripe_subscription_status', v_sub_status
    )
  );
end;
$$;

comment on function public.rpc_creator_finance_overview(integer) is
  'Creator-only: balances + stream earnings window + upload credits for transparency in Hub.';

