-- Compatibility + relationship fixes for the new Supabase project.
-- Purpose:
-- - Stop PostgREST 400s caused by missing columns used by the frontend selects.
-- - Add FK relationships so embedded selects like `profiles(...)` work.
-- - Create join tables required by the UI (playlist_tracks).

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Missing columns referenced by the frontend
-- ------------------------------------------------------------

-- Tracks: UI selects `video_cover_art_url` + `is_explicit_content`.
alter table public.tracks
  add column if not exists video_cover_art_url text,
  add column if not exists is_explicit_content boolean not null default false;

-- Albums/Playlists: UI selects `video_cover_art_url`.
alter table public.albums
  add column if not exists video_cover_art_url text;

alter table public.playlists
  add column if not exists video_cover_art_url text;

-- ------------------------------------------------------------
-- 2) Join table: playlist_tracks (required by Playlist detail pages)
-- ------------------------------------------------------------

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

-- Public can read playlist tracks only for public playlists.
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

-- Playlist owners/admins can manage their playlists.
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

-- ------------------------------------------------------------
-- 3) Add FK relationships so PostgREST embedded selects work:
--    - playlists(..., profiles(...))
--    - videos(..., profiles(...))
--    - (optional) tracks/albums embed profiles in some views
--
-- We keep existing auth.users FKs and add "shadow" FKs to profiles.
-- Mark them NOT VALID to avoid failing if older rows lack profiles.
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tracks_uploader_id_profiles_fkey'
  ) then
    alter table public.tracks
      add constraint tracks_uploader_id_profiles_fkey
      foreign key (uploader_id) references public.profiles(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'albums_uploader_id_profiles_fkey'
  ) then
    alter table public.albums
      add constraint albums_uploader_id_profiles_fkey
      foreign key (uploader_id) references public.profiles(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'playlists_creator_id_profiles_fkey'
  ) then
    alter table public.playlists
      add constraint playlists_creator_id_profiles_fkey
      foreign key (creator_id) references public.profiles(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'videos_uploader_id_profiles_fkey'
  ) then
    alter table public.videos
      add constraint videos_uploader_id_profiles_fkey
      foreign key (uploader_id) references public.profiles(id)
      on delete cascade
      not valid;
  end if;
end $$;

