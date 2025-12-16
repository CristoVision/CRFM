-- CRFM Streams: charge listener + distribute royalties (contributors + platform fee)
-- Apply in Supabase SQL editor.
--
-- Prereqs:
-- - upload_policies.sql (profiles.creator_upload_policy + tracks.upload_policy)
-- - stripe_wallet.sql (profiles.withdrawable_balance)
-- - Tables expected: profiles(wallet_balance), tracks(stream_cost,uploader_id,upload_policy), stream_sessions,
--   wallet_transactions, content_contributions
--
-- Policy:
-- - free upload policy => CRFM fee = 10% of stream_cost (creators receive 90%)
-- - subscription / pay_per_upload => CRFM fee = 0% (creators receive 100%)
-- - Contributor splits use content_contributions.royalty_share_percent (sum to 100%).
--   If invitees exist without contributor_id, their share is temporarily assigned to the uploader until claimed.

create table if not exists public.platform_fee_events (
  id uuid primary key default gen_random_uuid(),
  listener_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  upload_policy text,
  stream_cost_cc numeric not null,
  platform_fee_cc numeric not null,
  client_session_id text,
  stripe_event_id text,
  created_at timestamptz not null default now()
);

create or replace function public.start_or_resume_stream(
  p_track_id uuid,
  p_user_id uuid,
  p_client_session_id text,
  p_position_seconds integer default 0
) returns jsonb
language plpgsql
security definer
as $function$
declare
  v_now timestamptz := now();
  v_session public.stream_sessions;
  v_listener_balance numeric;
  v_track record;
  v_policy text;
  v_fee_pct numeric;
  v_cost numeric;
  v_creator_pool numeric;
  v_platform_fee numeric;
  v_alloc_sum numeric := 0;
  v_total_credited numeric := 0;
  v_remainder numeric := 0;
  v_uploader_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  if auth.uid() <> p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  if p_track_id is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_params');
  end if;

  if p_client_session_id is null or length(trim(p_client_session_id)) = 0 then
    p_client_session_id := gen_random_uuid()::text;
  end if;

  -- Load track + uploader.
  select
    t.id,
    t.uploader_id,
    t.stream_cost,
    t.upload_policy
  into v_track
  from public.tracks t
  where t.id = p_track_id;

  if v_track.id is null then
    return jsonb_build_object('ok', false, 'reason', 'track_not_found');
  end if;

  v_uploader_id := v_track.uploader_id;
  v_cost := coalesce(v_track.stream_cost, 0.50);

  if v_cost <= 0 then
    -- Free track: no billing needed, but still keep session updated for resume.
    insert into public.stream_sessions(user_id, track_id, client_session_id, last_seen_at, last_position_seconds)
    values (p_user_id, p_track_id, p_client_session_id, v_now, greatest(coalesce(p_position_seconds,0),0))
    on conflict (user_id, track_id, client_session_id)
    do update set
      last_seen_at = excluded.last_seen_at,
      last_position_seconds = greatest(public.stream_sessions.last_position_seconds, excluded.last_position_seconds);
    return jsonb_build_object('ok', true, 'charged', false, 'reason', 'free_stream');
  end if;

  -- UPSERT session and lock it for idempotency.
  insert into public.stream_sessions(user_id, track_id, client_session_id, last_seen_at, last_position_seconds)
  values (p_user_id, p_track_id, p_client_session_id, v_now, greatest(coalesce(p_position_seconds,0),0))
  on conflict (user_id, track_id, client_session_id)
  do update set
    last_seen_at = excluded.last_seen_at,
    last_position_seconds = greatest(public.stream_sessions.last_position_seconds, excluded.last_position_seconds)
  returning * into v_session;

  select * into v_session
  from public.stream_sessions
  where id = v_session.id
  for update;

  if v_session.charged then
    return jsonb_build_object('ok', true, 'charged', false, 'session_id', v_session.id, 'reason', 'already_charged');
  end if;

  -- Lock listener balance (source of truth).
  select coalesce(p.wallet_balance, 0)
  into v_listener_balance
  from public.profiles p
  where p.id = p_user_id
  for update;

  if v_listener_balance < v_cost then
    return jsonb_build_object('ok', false, 'charged', false, 'session_id', v_session.id, 'reason', 'insufficient_funds');
  end if;

  -- Determine upload policy (track override or creator default).
  v_policy := v_track.upload_policy;
  if v_policy is null then
    select p.creator_upload_policy into v_policy
    from public.profiles p
    where p.id = v_uploader_id;
  end if;
  v_policy := coalesce(v_policy, 'free');

  -- Platform fee: only on free policy (10%).
  v_fee_pct := case when v_policy = 'free' then 0.10 else 0 end;
  v_platform_fee := round(v_cost * v_fee_pct, 2);
  v_creator_pool := round(v_cost - v_platform_fee, 2);

  if v_creator_pool < 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_creator_pool');
  end if;

  -- Build allocations from contributors (only rows with contributor_id).
  create temporary table if not exists tmp_stream_alloc (
    contributor_id uuid not null,
    pct numeric not null,
    amount_cc numeric not null default 0
  ) on commit drop;
  truncate table tmp_stream_alloc;

  insert into tmp_stream_alloc (contributor_id, pct)
  select
    cc.contributor_id,
    cc.royalty_share_percent
  from public.content_contributions cc
  where cc.content_type = 'track'
    and cc.content_id = p_track_id
    and cc.contributor_id is not null
    and cc.royalty_share_percent > 0;

  select coalesce(sum(pct), 0) into v_alloc_sum from tmp_stream_alloc;

  if v_alloc_sum > 100.0001 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_split_over_100');
  end if;

  if v_alloc_sum = 0 then
    insert into tmp_stream_alloc (contributor_id, pct) values (v_uploader_id, 100);
    v_alloc_sum := 100;
  elsif v_alloc_sum < 99.9999 then
    -- Assign any missing percent (including invitees without accounts) to uploader until claimed.
    insert into tmp_stream_alloc (contributor_id, pct) values (v_uploader_id, 100 - v_alloc_sum);
    v_alloc_sum := 100;
  end if;

  -- Compute amounts (2 decimals) and ensure exact total by assigning remainder to uploader.
  update tmp_stream_alloc
  set amount_cc = round((pct / 100.0) * v_creator_pool, 2);

  select coalesce(sum(amount_cc), 0) into v_total_credited from tmp_stream_alloc;
  v_remainder := round(v_creator_pool - v_total_credited, 2);

  if v_remainder <> 0 then
    update tmp_stream_alloc
    set amount_cc = amount_cc + v_remainder
    where contributor_id = v_uploader_id;
  end if;

  -- Debit listener.
  update public.profiles
  set wallet_balance = coalesce(wallet_balance, 0) - v_cost
  where id = p_user_id;

  -- Credit contributors (spendable + withdrawable from streams).
  update public.profiles p
  set
    wallet_balance = coalesce(p.wallet_balance, 0) + a.amount_cc,
    withdrawable_balance = coalesce(p.withdrawable_balance, 0) + a.amount_cc
  from tmp_stream_alloc a
  where p.id = a.contributor_id;

  -- Ledger entries (best-effort).
  begin
    insert into public.wallet_transactions(user_id, amount, transaction_type, description, related_track_id, created_at)
    values (p_user_id, -v_cost, 'stream_purchase', 'Charge for streaming', p_track_id, v_now);

    insert into public.wallet_transactions(user_id, amount, transaction_type, description, related_track_id, created_at)
    select a.contributor_id, a.amount_cc, 'stream_earning', 'Stream earning', p_track_id, v_now
    from tmp_stream_alloc a
    where a.amount_cc <> 0;
  exception when undefined_table then
    null;
  end;

  -- Track platform fee for reporting (fee may be 0).
  insert into public.platform_fee_events (
    listener_id, track_id, uploader_id, upload_policy, stream_cost_cc, platform_fee_cc, client_session_id, created_at
  ) values (
    p_user_id, p_track_id, v_uploader_id, v_policy, v_cost, v_platform_fee, p_client_session_id, v_now
  );

  update public.stream_sessions
  set charged = true
  where id = v_session.id;

  return jsonb_build_object(
    'ok', true,
    'charged', true,
    'session_id', v_session.id,
    'stream_cost_cc', v_cost,
    'upload_policy', v_policy,
    'platform_fee_cc', v_platform_fee,
    'creator_pool_cc', v_creator_pool
  );
end
$function$;

comment on function public.start_or_resume_stream(uuid,uuid,text,integer) is
  'Charges listener once per (user,track,client_session_id), applies platform fee based on upload policy, and distributes creator pool by content_contributions splits.';
