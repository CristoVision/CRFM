-- Analytics tables used by the frontend:
-- - content_view_events (logContentView)
-- - track_streams extra columns (logTrackPlay)
-- - get_overall_stats_for_creator RPC (Creator Hub overview)

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Extend track_streams to match analytics payload
-- ------------------------------------------------------------

alter table public.track_streams
  add column if not exists is_paid boolean not null default false,
  add column if not exists amount_creator_cents integer not null default 0,
  add column if not exists amount_org_cents integer not null default 0,
  add column if not exists currency_code char(3) not null default 'USD',
  add column if not exists source text,
  add column if not exists client_session_id text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists play_ms integer not null default 0,
  add column if not exists completed boolean not null default false;

-- ------------------------------------------------------------
-- 2) content_view_events table + RLS (insert-any; read via RPC/service role)
-- ------------------------------------------------------------

create table if not exists public.content_view_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  session_id text not null,
  resource_type text not null,
  resource_id uuid,
  path text,
  referrer text,
  country text,
  city text,
  ip_hash text,
  user_agent_hash text,
  source text,
  medium text,
  campaign text
);

create index if not exists idx_content_view_events_type_time
  on public.content_view_events (resource_type, created_at desc);

create index if not exists idx_content_view_events_resource_time
  on public.content_view_events (resource_id, created_at desc);

alter table public.content_view_events enable row level security;

drop policy if exists content_view_events_insert_any on public.content_view_events;
create policy content_view_events_insert_any
  on public.content_view_events for insert
  with check (true);

drop policy if exists content_view_events_select_service on public.content_view_events;
create policy content_view_events_select_service
  on public.content_view_events for select
  using (auth.role() = 'service_role');

-- ------------------------------------------------------------
-- 3) Overview stats RPC (used by Creator Hub → Analytics overview)
-- Expected frontend fields:
-- - total_plays
-- - unique_listeners_count
-- - total_views
-- ------------------------------------------------------------

create or replace function public.get_overall_stats_for_creator(
  p_creator_id uuid,
  start_ts date,
  end_ts date
) returns table (
  total_plays bigint,
  unique_listeners_count bigint,
  total_views bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_creator_id is null then
    raise exception 'p_creator_id is required' using errcode = '22000';
  end if;

  v_start := start_ts::timestamptz;
  v_end := (end_ts::timestamptz + interval '1 day');

  return query
  with creator_tracks as (
    select t.id
    from public.tracks t
    where t.uploader_id = p_creator_id
  ),
  creator_albums as (
    select a.id
    from public.albums a
    where a.uploader_id = p_creator_id
  ),
  creator_playlists as (
    select p.id
    from public.playlists p
    where p.creator_id = p_creator_id
  ),
  plays as (
    select
      count(*)::bigint as total_plays,
      count(distinct ts.user_id)::bigint as unique_listeners_count
    from public.track_streams ts
    join creator_tracks ct on ct.id = ts.track_id
    where ts.streamed_at >= v_start and ts.streamed_at < v_end
  ),
  views as (
    select count(*)::bigint as total_views
    from public.content_view_events cve
    where cve.created_at >= v_start and cve.created_at < v_end
      and (
        (cve.resource_type = 'creator_card' and cve.resource_id = p_creator_id)
        or (cve.resource_type = 'track_card' and exists (select 1 from creator_tracks ct where ct.id = cve.resource_id))
        or (cve.resource_type = 'album' and exists (select 1 from creator_albums ca where ca.id = cve.resource_id))
        or (cve.resource_type = 'playlist' and exists (select 1 from creator_playlists cp where cp.id = cve.resource_id))
      )
  )
  select
    coalesce(plays.total_plays, 0) as total_plays,
    coalesce(plays.unique_listeners_count, 0) as unique_listeners_count,
    coalesce(views.total_views, 0) as total_views
  from plays
  cross join views;
end;
$$;

