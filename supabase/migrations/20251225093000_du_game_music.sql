-- DU TCG PR game music playlist

create table if not exists public.game_music_tracks (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null default 'du_tcg_pr',
  track_id uuid not null references public.tracks(id) on delete cascade,
  is_active boolean not null default true,
  order_index integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_slug, track_id)
);

create index if not exists idx_game_music_tracks_game
  on public.game_music_tracks (game_slug, order_index);

alter table public.game_music_tracks enable row level security;

drop policy if exists game_music_tracks_select_auth on public.game_music_tracks;
create policy game_music_tracks_select_auth
  on public.game_music_tracks for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

drop policy if exists game_music_tracks_admin_write on public.game_music_tracks;
create policy game_music_tracks_admin_write
  on public.game_music_tracks for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));
