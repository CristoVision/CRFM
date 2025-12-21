-- Enrich top tracks leaderboard with album/creator artwork fallback.

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
    coalesce(
      case when t.cover_art_url ~* '\\.(mp4|webm|ogg|mov)$' then null else t.cover_art_url end,
      case when a.cover_art_url ~* '\\.(mp4|webm|ogg|mov)$' then null else a.cover_art_url end,
      p.avatar_url
    ) as cover_art_url,
    t.uploader_id,
    t.creator_display_name,
    coalesce(s.total_streams, 0) as total_streams
  from public.tracks t
  left join public.albums a on a.id = t.album_id
  left join public.profiles p on p.id = t.uploader_id
  left join streams s on s.track_id = t.id
  where coalesce(t.is_public, true) = true
  order by coalesce(s.total_streams, 0) desc, t.created_at desc
  limit 20;
end;
$$;
