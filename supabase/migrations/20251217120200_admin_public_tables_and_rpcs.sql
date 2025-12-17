-- Minimal public/admin tables + RPCs required to eliminate 404s and enable core UI.
-- Covers:
-- - stations + station_tracks + radio RPCs
-- - ads
-- - apps + games
-- - projects (seed CRFM)
-- - creator_tag_requests
-- - content_flags (with compatibility columns)

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Stations + station tracks
-- ------------------------------------------------------------

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  is_sign_in_station boolean not null default false,
  ad_interval_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.station_tracks (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  play_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint station_tracks_play_order_check check (play_order > 0)
);

create index if not exists idx_station_tracks_station_order
  on public.station_tracks (station_id, play_order asc);

alter table public.stations enable row level security;
alter table public.station_tracks enable row level security;

-- Stations: public read active; admin write.
drop policy if exists stations_select_public on public.stations;
create policy stations_select_public
  on public.stations for select
  using (is_active = true or is_admin_uid(auth.uid()));

drop policy if exists stations_admin_write on public.stations;
create policy stations_admin_write
  on public.stations for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

-- station_tracks: readable by anyone (for radio queue); write only admin.
drop policy if exists station_tracks_select_any on public.station_tracks;
create policy station_tracks_select_any
  on public.station_tracks for select
  using (true);

drop policy if exists station_tracks_admin_write on public.station_tracks;
create policy station_tracks_admin_write
  on public.station_tracks for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

-- RPC: return tracks for a station (used by UnauthenticatedRadio).
create or replace function public.get_active_station_tracks(
  p_station_id uuid,
  p_limit integer default 30
) returns table (
  id uuid,
  title text,
  creator_display_name text,
  cover_art_url text,
  audio_file_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    t.id,
    t.title,
    t.creator_display_name,
    t.cover_art_url,
    t.audio_file_url
  from public.station_tracks st
  join public.tracks t on t.id = st.track_id
  join public.stations s on s.id = st.station_id
  where st.station_id = p_station_id
    and coalesce(s.is_active, true) = true
    and coalesce(t.is_public, true) = true
  order by st.play_order asc, t.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 200));
end;
$$;

-- RPC: rebuild a station queue from random public tracks (admin only).
create or replace function public.refresh_station_random_tracks(
  p_station_id uuid,
  p_limit integer default 30
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 200));
begin
  if not is_admin_uid(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  delete from public.station_tracks where station_id = p_station_id;

  insert into public.station_tracks (station_id, track_id, play_order)
  select
    p_station_id,
    t.id,
    row_number() over (order by random())::int as play_order
  from public.tracks t
  where coalesce(t.is_public, true) = true
  order by random()
  limit v_limit;
end;
$$;

-- Admin helpers (used by Admin UI).
create or replace function public.rpc_admin_upsert_station(
  p_admin_id uuid,
  p_id uuid,
  p_name text,
  p_description text,
  p_is_active boolean,
  p_is_sign_in boolean,
  p_ad_interval_seconds integer
) returns public.stations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.stations;
begin
  if not is_admin_uid(p_admin_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.stations (name, description, is_active, is_sign_in_station, ad_interval_seconds)
    values (
      nullif(trim(p_name), ''),
      nullif(trim(p_description), ''),
      coalesce(p_is_active, true),
      coalesce(p_is_sign_in, false),
      greatest(0, coalesce(p_ad_interval_seconds, 0))
    )
    returning * into v_row;
  else
    update public.stations
      set name = nullif(trim(p_name), ''),
          description = nullif(trim(p_description), ''),
          is_active = coalesce(p_is_active, is_active),
          is_sign_in_station = coalesce(p_is_sign_in, is_sign_in_station),
          ad_interval_seconds = greatest(0, coalesce(p_ad_interval_seconds, ad_interval_seconds)),
          updated_at = now()
    where id = p_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.rpc_admin_delete_station(
  p_admin_id uuid,
  p_station_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not is_admin_uid(p_admin_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select name into v_name from public.stations where id = p_station_id;
  delete from public.station_tracks where station_id = p_station_id;
  delete from public.stations where id = p_station_id;

  return jsonb_build_object('id', p_station_id, 'name', v_name);
end;
$$;

-- ------------------------------------------------------------
-- 2) Ads (admin-managed; public read)
-- ------------------------------------------------------------

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  click_url text,
  audio_url text not null,
  image_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ads enable row level security;

drop policy if exists ads_select_any on public.ads;
create policy ads_select_any
  on public.ads for select
  using (true);

drop policy if exists ads_admin_write on public.ads;
create policy ads_admin_write
  on public.ads for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

create or replace function public.rpc_admin_upsert_ad(
  p_admin_id uuid,
  p_id uuid,
  p_name text,
  p_click_url text,
  p_audio_url text,
  p_image_url text,
  p_is_active boolean
) returns public.ads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ads;
begin
  if not is_admin_uid(p_admin_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.ads (name, click_url, audio_url, image_url, is_active)
    values (
      nullif(trim(p_name), ''),
      nullif(trim(p_click_url), ''),
      nullif(trim(p_audio_url), ''),
      nullif(trim(p_image_url), ''),
      coalesce(p_is_active, true)
    )
    returning * into v_row;
  else
    update public.ads
      set name = nullif(trim(p_name), ''),
          click_url = nullif(trim(p_click_url), ''),
          audio_url = nullif(trim(p_audio_url), ''),
          image_url = nullif(trim(p_image_url), ''),
          is_active = coalesce(p_is_active, is_active),
          updated_at = now()
    where id = p_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.rpc_admin_delete_ad(
  p_admin_id uuid,
  p_ad_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not is_admin_uid(p_admin_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select name into v_name from public.ads where id = p_ad_id;
  delete from public.ads where id = p_ad_id;
  return jsonb_build_object('id', p_ad_id, 'name', v_name);
end;
$$;

-- ------------------------------------------------------------
-- 3) Apps & Games (public listing + admin management)
-- ------------------------------------------------------------

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  media_url text,
  site_url text,
  is_public boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  media_url text,
  site_url text,
  is_public boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apps enable row level security;
alter table public.games enable row level security;

drop policy if exists apps_select_public on public.apps;
create policy apps_select_public
  on public.apps for select
  using (is_public = true or is_admin_uid(auth.uid()));

drop policy if exists apps_admin_write on public.apps;
create policy apps_admin_write
  on public.apps for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

drop policy if exists games_select_public on public.games;
create policy games_select_public
  on public.games for select
  using (is_public = true or is_admin_uid(auth.uid()));

drop policy if exists games_admin_write on public.games;
create policy games_admin_write
  on public.games for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

-- ------------------------------------------------------------
-- 4) Projects (seed CRFM so achievements UI can resolve project id)
-- ------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  description text,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists projects_select_authenticated on public.projects;
create policy projects_select_authenticated
  on public.projects for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

drop policy if exists projects_admin_write on public.projects;
create policy projects_admin_write
  on public.projects for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

insert into public.projects (code, name, description)
values
  ('CRFM', 'CRFM', 'CRFM platform'),
  ('DU_TCG_PR', 'DU TCG PR', 'DreamUniverse TCG PR')
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- 5) Creator tag requests
-- ------------------------------------------------------------

create table if not exists public.creator_tag_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_tags text[] not null default '{}',
  additional_info text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_tag_requests enable row level security;

drop policy if exists creator_tag_requests_select_scope on public.creator_tag_requests;
create policy creator_tag_requests_select_scope
  on public.creator_tag_requests for select
  using (auth.uid() = user_id or is_admin_uid(auth.uid()));

drop policy if exists creator_tag_requests_insert_self on public.creator_tag_requests;
create policy creator_tag_requests_insert_self
  on public.creator_tag_requests for insert
  with check (auth.uid() = user_id);

drop policy if exists creator_tag_requests_admin_update on public.creator_tag_requests;
create policy creator_tag_requests_admin_update
  on public.creator_tag_requests for update
  using (is_admin_uid(auth.uid()));

-- ------------------------------------------------------------
-- 6) Content flags (moderation) with compatibility columns
-- ------------------------------------------------------------

create table if not exists public.content_flags (
  id uuid primary key default gen_random_uuid(),

  -- canonical fields (used by some UI)
  content_type text,
  content_id uuid,

  -- compatibility fields used by AdminContentFlagsTab
  flagged_content_type text,
  flagged_content_id uuid,
  flag_reason text,

  flag_reason_category text,
  flag_description_text text,

  flagger_user_id uuid references auth.users(id) on delete set null,
  original_uploader_id uuid references auth.users(id) on delete set null,

  uploader_correction_notes text,
  admin_feedback text,
  status text not null default 'pending'
    check (status in ('pending','in_review','awaiting_review','resolved','rejected','action_needed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_flags_status_created
  on public.content_flags (status, created_at desc);

create index if not exists idx_content_flags_original_uploader
  on public.content_flags (original_uploader_id, created_at desc);

alter table public.content_flags enable row level security;

-- Keep both naming variants in sync.
create or replace function public._content_flags_sync()
returns trigger
language plpgsql
as $$
begin
  if new.flagged_content_type is null and new.content_type is not null then
    new.flagged_content_type := new.content_type;
  end if;
  if new.content_type is null and new.flagged_content_type is not null then
    new.content_type := new.flagged_content_type;
  end if;

  if new.flagged_content_id is null and new.content_id is not null then
    new.flagged_content_id := new.content_id;
  end if;
  if new.content_id is null and new.flagged_content_id is not null then
    new.content_id := new.flagged_content_id;
  end if;

  if new.flag_reason is null then
    new.flag_reason := nullif(coalesce(new.flag_reason_category, ''), '');
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_content_flags_sync on public.content_flags;
create trigger trg_content_flags_sync
before insert or update on public.content_flags
for each row execute procedure public._content_flags_sync();

-- Policies:
-- - Insert: authenticated users can flag.
-- - Select: admins, flagger, or original uploader.
-- - Update: admins; uploader can update correction notes on own items.
drop policy if exists content_flags_insert_any_auth on public.content_flags;
create policy content_flags_insert_any_auth
  on public.content_flags for insert
  with check (auth.role() = 'authenticated');

drop policy if exists content_flags_select_scope on public.content_flags;
create policy content_flags_select_scope
  on public.content_flags for select
  using (
    is_admin_uid(auth.uid())
    or flagger_user_id = auth.uid()
    or original_uploader_id = auth.uid()
  );

drop policy if exists content_flags_admin_update on public.content_flags;
create policy content_flags_admin_update
  on public.content_flags for update
  using (is_admin_uid(auth.uid()));

-- ------------------------------------------------------------
-- 7) Creators leaderboard RPC (missing → 404)
-- ------------------------------------------------------------

create or replace function public.get_top_creators_leaderboard(p_timeframe text default 'weekly')
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  bio text,
  is_verified_creator boolean,
  total_streams bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from timestamptz := public._lb_from_date(p_timeframe);
begin
  return query
  with creator_track_ids as (
    select t.uploader_id as creator_id, t.id as track_id
    from public.tracks t
    where coalesce(t.is_public, true) = true
  ),
  streams as (
    select cti.creator_id, count(*)::bigint as total_streams
    from public.track_streams ts
    join creator_track_ids cti on cti.track_id = ts.track_id
    where v_from is null or ts.streamed_at >= v_from
    group by cti.creator_id
  )
  select
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.bio,
    coalesce(p.is_verified_creator, false) as is_verified_creator,
    coalesce(s.total_streams, 0) as total_streams
  from public.profiles p
  left join streams s on s.creator_id = p.id
  where coalesce(p.is_public, true) = true
  order by coalesce(s.total_streams, 0) desc, p.created_at desc
  limit 20;
end;
$$;

