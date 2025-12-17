-- Stripe upload enforcement (CRFM)
-- Apply in Supabase SQL editor.
--
-- Enforces creator upload gating server-side based on:
-- - profiles.creator_upload_policy: free | pay_per_upload | subscription
-- - profiles.stripe_subscription_status: active | trialing required for subscription
-- - creator_upload_fee_credits: consumed for pay-per-upload track/album inserts
--
-- Notes:
-- - Standalone track uploads consume `fee_type='track'` credits.
-- - Tracks inserted with a non-null `album_id` do NOT consume track credits (album creation consumes an album credit).
-- - Playlists + music videos are gated but do not consume credits (no Stripe prices defined yet).

-- Optional: prepaid unlimited window (CrossCoins). Safe to add even if unused.
alter table public.profiles
  add column if not exists creator_unlimited_expires_at timestamptz;

create or replace function public._crfm_is_active_subscription(p_status text)
returns boolean
language sql
stable
as $$
  select lower(coalesce(p_status, '')) in ('active', 'trialing');
$$;

create or replace function public._crfm_guard_upload(
  p_user_id uuid,
  p_kind text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy text;
  v_sub_status text;
  v_unlimited_expires_at timestamptz;
  v_has_any_credit boolean;
begin
  -- Allow service role / background jobs.
  if auth.role() = 'service_role' then
    return;
  end if;

  -- Require authenticated inserts and prevent spoofing uploader/creator.
  if auth.uid() is null then
    raise exception 'CRFM_UPLOAD_LOCKED: not authenticated' using errcode = '42501';
  end if;
  if p_user_id <> auth.uid() then
    raise exception 'CRFM_UPLOAD_LOCKED: user mismatch' using errcode = '42501';
  end if;

  select
    lower(coalesce(creator_upload_policy, 'free')),
    stripe_subscription_status,
    creator_unlimited_expires_at
    into v_policy, v_sub_status, v_unlimited_expires_at
  from public.profiles
  where id = p_user_id;

  v_policy := coalesce(v_policy, 'free');

  -- Active subscriptions always allow uploads (regardless of selected policy).
  if public._crfm_is_active_subscription(v_sub_status) or (v_unlimited_expires_at is not null and v_unlimited_expires_at > now()) then
    return;
  end if;

  if v_policy = 'free' then
    return;
  end if;

  if v_policy = 'subscription' then
    raise exception 'CRFM_UPLOAD_LOCKED: subscription inactive' using errcode = '42501';
  end if;

  if v_policy = 'pay_per_upload' then
    select exists (
      select 1
      from public.creator_upload_fee_credits c
      where c.user_id = p_user_id
        and c.fee_type in ('track', 'album')
        and c.credits > 0
    )
    into v_has_any_credit;

    if v_has_any_credit then
      return;
    end if;

    raise exception 'CRFM_UPLOAD_LOCKED: no credits' using errcode = '42501';
  end if;

  raise exception 'CRFM_UPLOAD_LOCKED: unknown policy %', v_policy using errcode = '42501';
end;
$$;

create or replace function public._crfm_consume_upload_credit(
  p_user_id uuid,
  p_fee_type text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return;
  end if;

  if auth.uid() is null or p_user_id <> auth.uid() then
    raise exception 'CRFM_UPLOAD_LOCKED: user mismatch' using errcode = '42501';
  end if;

  if p_fee_type not in ('track', 'album') then
    raise exception 'CRFM_UPLOAD_LOCKED: invalid fee_type %', p_fee_type using errcode = '22000';
  end if;

  update public.creator_upload_fee_credits
  set credits = credits - 1,
      updated_at = now()
  where user_id = p_user_id
    and fee_type = p_fee_type
    and credits > 0;

  if not found then
    raise exception 'CRFM_UPLOAD_LOCKED: insufficient credits' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.trg_enforce_track_upload_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy text;
  v_sub_status text;
  v_unlimited_expires_at timestamptz;
begin
  -- Allow service role / background jobs.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() is null or new.uploader_id <> auth.uid() then
    raise exception 'CRFM_UPLOAD_LOCKED: user mismatch' using errcode = '42501';
  end if;

  select
    lower(coalesce(creator_upload_policy, 'free')),
    stripe_subscription_status,
    creator_unlimited_expires_at
    into v_policy, v_sub_status, v_unlimited_expires_at
  from public.profiles
  where id = new.uploader_id;

  v_policy := coalesce(v_policy, 'free');

  if public._crfm_is_active_subscription(v_sub_status) or (v_unlimited_expires_at is not null and v_unlimited_expires_at > now()) then
    return new;
  end if;

  if v_policy = 'free' then
    return new;
  end if;

  if v_policy = 'subscription' then
    raise exception 'CRFM_UPLOAD_LOCKED: subscription inactive' using errcode = '42501';
  end if;

  if v_policy = 'pay_per_upload' then
    -- Album tracks are covered by the album credit.
    if new.album_id is not null then
      return new;
    end if;

    perform public._crfm_consume_upload_credit(new.uploader_id, 'track');
    return new;
  end if;

  raise exception 'CRFM_UPLOAD_LOCKED: unknown policy %', v_policy using errcode = '42501';
end;
$$;

create or replace function public.trg_enforce_album_upload_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy text;
  v_sub_status text;
  v_unlimited_expires_at timestamptz;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() is null or new.uploader_id <> auth.uid() then
    raise exception 'CRFM_UPLOAD_LOCKED: user mismatch' using errcode = '42501';
  end if;

  select
    lower(coalesce(creator_upload_policy, 'free')),
    stripe_subscription_status,
    creator_unlimited_expires_at
    into v_policy, v_sub_status, v_unlimited_expires_at
  from public.profiles
  where id = new.uploader_id;

  v_policy := coalesce(v_policy, 'free');

  if public._crfm_is_active_subscription(v_sub_status) or (v_unlimited_expires_at is not null and v_unlimited_expires_at > now()) then
    return new;
  end if;

  if v_policy = 'free' then
    return new;
  end if;

  if v_policy = 'subscription' then
    raise exception 'CRFM_UPLOAD_LOCKED: subscription inactive' using errcode = '42501';
  end if;

  if v_policy = 'pay_per_upload' then
    perform public._crfm_consume_upload_credit(new.uploader_id, 'album');
    return new;
  end if;

  raise exception 'CRFM_UPLOAD_LOCKED: unknown policy %', v_policy using errcode = '42501';
end;
$$;

create or replace function public.trg_enforce_video_upload_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Only gate music videos (other video types may exist).
  begin
    if new.video_type is distinct from 'music_video' then
      return new;
    end if;
  exception when undefined_column then
    -- If column doesn't exist, gate all rows.
    null;
  end;

  perform public._crfm_guard_upload(new.uploader_id, 'video');
  return new;
end;
$$;

create or replace function public.trg_enforce_playlist_upload_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  perform public._crfm_guard_upload(new.creator_id, 'playlist');
  return new;
end;
$$;

drop trigger if exists crfm_enforce_track_upload_policy on public.tracks;
create trigger crfm_enforce_track_upload_policy
before insert on public.tracks
for each row
execute function public.trg_enforce_track_upload_policy();

drop trigger if exists crfm_enforce_album_upload_policy on public.albums;
create trigger crfm_enforce_album_upload_policy
before insert on public.albums
for each row
execute function public.trg_enforce_album_upload_policy();

drop trigger if exists crfm_enforce_video_upload_policy on public.videos;
create trigger crfm_enforce_video_upload_policy
before insert on public.videos
for each row
execute function public.trg_enforce_video_upload_policy();

drop trigger if exists crfm_enforce_playlist_upload_policy on public.playlists;
create trigger crfm_enforce_playlist_upload_policy
before insert on public.playlists
for each row
execute function public.trg_enforce_playlist_upload_policy();
