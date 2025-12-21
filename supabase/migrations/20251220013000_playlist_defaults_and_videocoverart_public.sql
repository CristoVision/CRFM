-- Ensure playlist defaults + public read for videocoverart.

-- 1) Allow public reads for video cover art.
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects missing; skipping videocoverart policy.';
    return;
  end if;

  if not exists (
    select 1
    from pg_policies
    where policyname = 'videocoverart_select_public'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy videocoverart_select_public
      on storage.objects
      for select
      using (bucket_id = 'videocoverart');
  end if;
end $$;

-- 2) Ensure playlist_tracks exists (idempotent).
create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  order_in_playlist integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playlist_tracks_order_check check (order_in_playlist > 0)
);

create index if not exists idx_playlist_tracks_playlist_order
  on public.playlist_tracks (playlist_id, order_in_playlist asc);

create unique index if not exists uniq_playlist_tracks_playlist_track
  on public.playlist_tracks (playlist_id, track_id);

alter table public.playlist_tracks enable row level security;

drop policy if exists playlist_tracks_select_public_playlist on public.playlist_tracks;
create policy playlist_tracks_select_public_playlist
  on public.playlist_tracks for select
  using (
    exists (
      select 1
      from public.playlists p
      where p.id = playlist_tracks.playlist_id
        and (p.is_public = true or p.creator_id = auth.uid())
    )
  );

drop policy if exists playlist_tracks_write_owner_or_admin on public.playlist_tracks;
create policy playlist_tracks_write_owner_or_admin
  on public.playlist_tracks for all
  using (
    exists (
      select 1
      from public.playlists p
      where p.id = playlist_tracks.playlist_id
        and (p.creator_id = auth.uid() or is_admin_uid(auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.playlists p
      where p.id = playlist_tracks.playlist_id
        and (p.creator_id = auth.uid() or is_admin_uid(auth.uid()))
    )
  );

-- 3) Default playlists for every profile.
create or replace function public.ensure_default_playlists(p_user_id uuid)
returns void
language plpgsql
as $$
declare
  total_count integer;
  fav_count integer;
  missing integer;
  i integer;
begin
  if p_user_id is null then
    return;
  end if;
  if to_regclass('public.playlists') is null then
    raise notice 'playlists missing; skipping defaults.';
    return;
  end if;

  select count(*), count(*) filter (where is_favorites_playlist = true)
    into total_count, fav_count
  from public.playlists
  where creator_id = p_user_id;

  if fav_count = 0 then
    insert into public.playlists (creator_id, title, description, is_public, is_favorites_playlist)
    values (p_user_id, 'Favorites', 'Your saved favorites.', false, true);
  end if;

  missing := greatest(0, 3 - total_count - case when fav_count = 0 then 1 else 0 end);
  if missing > 0 then
    for i in 1..missing loop
      insert into public.playlists (creator_id, title, description, is_public, is_favorites_playlist)
      values (p_user_id, 'My Playlist ' || i, 'Personal playlist.', false, false);
    end loop;
  end if;
end;
$$;

create or replace function public.ensure_default_playlists_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.ensure_default_playlists(new.id);
  return new;
end;
$$;

drop trigger if exists trg_profiles_default_playlists on public.profiles;
create trigger trg_profiles_default_playlists
  after insert on public.profiles
  for each row
  execute function public.ensure_default_playlists_trigger();
