-- Create profiles automatically + add basic leaderboard RPCs.
-- Safe to run on a fresh project.

create extension if not exists pgcrypto;

-- -------------------------
-- Auto-create profiles on signup
-- -------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_display_name text;
  v_username text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
  v_display_name := nullif(coalesce(new.raw_user_meta_data->>'display_name', ''), '');
  if v_display_name is null then
    v_display_name := nullif(v_full_name, '');
  end if;
  v_username := split_part(coalesce(new.email, ''), '@', 1);

  insert into public.profiles (
    id,
    email,
    full_name,
    display_name,
    username,
    is_public,
    created_at,
    updated_at
  ) values (
    new.id,
    new.email,
    v_full_name,
    v_display_name,
    nullif(v_username, ''),
    true,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- -------------------------
-- Minimal stream/event tables used by leaderboards/analytics
-- -------------------------

create table if not exists public.track_streams (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  streamed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.track_streams enable row level security;
drop policy if exists track_streams_insert_any on public.track_streams;
create policy track_streams_insert_any on public.track_streams
  for insert with check (true);
drop policy if exists track_streams_select_service on public.track_streams;
create policy track_streams_select_service on public.track_streams
  for select using (auth.role() = 'service_role');

create index if not exists idx_track_streams_track_time on public.track_streams(track_id, streamed_at desc);

create table if not exists public.playlist_stream_events (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  listener_user_id uuid references auth.users(id) on delete set null,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.playlist_stream_events enable row level security;
drop policy if exists playlist_stream_events_insert_any on public.playlist_stream_events;
create policy playlist_stream_events_insert_any on public.playlist_stream_events
  for insert with check (true);
drop policy if exists playlist_stream_events_select_service on public.playlist_stream_events;
create policy playlist_stream_events_select_service on public.playlist_stream_events
  for select using (auth.role() = 'service_role');

create index if not exists idx_playlist_stream_events_playlist_time on public.playlist_stream_events(playlist_id, played_at desc);

-- -------------------------
-- Leaderboard RPCs (avoid client 404s)
-- These are SECURITY DEFINER so they can aggregate without exposing raw stream rows.
-- -------------------------

create or replace function public._lb_from_date(p_timeframe text)
returns timestamptz
language sql
stable
as $$
  select case lower(coalesce(p_timeframe, 'weekly'))
    when 'weekly' then now() - interval '7 days'
    when 'month' then now() - interval '30 days'
    when 'monthly' then now() - interval '30 days'
    when 'all' then null
    else now() - interval '7 days'
  end;
$$;

create or replace function public.get_top_tracks_leaderboard(p_timeframe text default 'weekly')
returns table (
  id uuid,
  title text,
  cover_art_url text,
  uploader_id uuid,
  creator_display_name text,
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
  with streams as (
    select ts.track_id, count(*)::bigint as total_streams
    from public.track_streams ts
    where v_from is null or ts.streamed_at >= v_from
    group by ts.track_id
  )
  select
    t.id,
    t.title,
    t.cover_art_url,
    t.uploader_id,
    t.creator_display_name,
    coalesce(s.total_streams, 0) as total_streams
  from public.tracks t
  left join streams s on s.track_id = t.id
  where coalesce(t.is_public, true) = true
  order by coalesce(s.total_streams, 0) desc, t.created_at desc
  limit 20;
end;
$$;

create or replace function public.get_top_playlists_leaderboard(p_timeframe text default 'weekly')
returns table (
  id uuid,
  title text,
  cover_art_url text,
  creator_id uuid,
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
  with streams as (
    select pse.playlist_id, count(*)::bigint as total_streams
    from public.playlist_stream_events pse
    where v_from is null or pse.played_at >= v_from
    group by pse.playlist_id
  )
  select
    p.id,
    p.title,
    p.cover_art_url,
    p.creator_id,
    coalesce(s.total_streams, 0) as total_streams
  from public.playlists p
  left join streams s on s.playlist_id = p.id
  where coalesce(p.is_public, false) = true
  order by coalesce(s.total_streams, 0) desc, p.created_at desc
  limit 20;
end;
$$;

create or replace function public.get_top_albums_leaderboard(p_timeframe text default 'weekly')
returns table (
  id uuid,
  title text,
  cover_art_url text,
  uploader_id uuid,
  creator_display_name text,
  total_streams bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Album leaderboard: fallback by recency until album-stream tracking is wired.
  return query
  select
    a.id,
    a.title,
    a.cover_art_url,
    a.uploader_id,
    a.creator_display_name,
    0::bigint as total_streams
  from public.albums a
  where coalesce(a.is_public, true) = true
  order by a.created_at desc
  limit 20;
end;
$$;

create or replace function public.get_top_music_videos_leaderboard(p_timeframe text default 'weekly')
returns table (
  id uuid,
  title text,
  cover_art_url text,
  uploader_id uuid,
  creator_display_name text,
  total_streams bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Music video leaderboard: fallback by recency until video-stream tracking is wired.
  return query
  select
    v.id,
    v.title,
    v.cover_art_url,
    v.uploader_id,
    v.creator_display_name,
    0::bigint as total_streams
  from public.videos v
  where coalesce(v.is_public, true) = true
    and (v.video_type is null or v.video_type = 'music_video')
  order by v.created_at desc
  limit 20;
end;
$$;

