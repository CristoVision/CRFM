-- CRFM bootstrap (new Supabase project)
-- Goal: recreate the minimum core tables + safe RLS so CRFM can run, then you can apply the feature SQL files in this repo.
--
-- Apply this FIRST in Supabase SQL editor on the new project.
-- Then apply (in order): upload_policies.sql, stripe_wallet.sql, stripe_creator_billing.sql, creator_billing_cc.sql, wallet_actions.sql, memberships_and_promo_codes.sql, etc.

create extension if not exists pgcrypto;

-- -------------------------
-- Core tables
-- -------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  full_name text,
  bio text,
  avatar_url text,
  wallet_balance numeric default 0,
  is_admin boolean default false,
  creator_tags text[],
  social_link_1 text,
  social_link_2 text,
  is_verified_creator boolean default false,
  signed_up_with_invite_code text,
  my_personal_invite_code text,
  discord_provider_id text,
  discord_username text,
  discord_avatar_url text,
  additional_emails text[],
  is_public boolean default true,
  birth_date date,
  gender text,
  country text,
  social_links jsonb,
  email text,
  total_xp bigint default 0,
  total_battles integer default 0,
  total_wins integer default 0,
  total_critical_hits integer default 0,
  total_creatures_domesticated integer default 0,
  creature_types_domesticated jsonb default '{}'::jsonb,
  achievement_notifications_enabled boolean not null default true,
  phone_number text,
  display_name text,
  role text default 'player',
  enable_achievement_notifications boolean not null default true
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  creator_display_name text not null,
  cover_art_url text,
  genre text,
  release_date date,
  is_public boolean not null default true,
  artwork_is_not_explicit boolean not null default false,
  artwork_ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  languages text[],
  total_royalty_percentage_allocated numeric default 0
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  creator_display_name text not null,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  audio_file_url text not null,
  genre text,
  stream_cost numeric not null default 1,
  is_public boolean not null default true,
  album_id uuid references public.albums(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_christian_nature boolean not null default false,
  is_instrumental boolean not null default false,
  ai_in_production boolean not null default false,
  ai_in_artwork boolean not null default false,
  ai_in_lyrics boolean not null default false,
  cover_art_url text,
  track_number_on_album integer,
  release_date date,
  languages text[],
  language text,
  total_royalty_percentage_allocated numeric default 0,
  lyrics_text text,
  lrc_file_path text,
  lyrics text,
  sub_genre text,
  track_number integer,
  audio_storage_key text
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  cover_art_url text,
  is_public boolean not null default false,
  is_favorites_playlist boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  languages text[]
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  storage_path text not null,
  cover_art_url text,
  language text,
  date_published timestamptz default now(),
  is_public boolean not null default true,
  creator_display_name text,
  cost_cc numeric not null default 0.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  playlist_id uuid references public.playlists(id) on delete set null,
  video_type text
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null,
  amount numeric not null,
  description text,
  related_track_id uuid references public.tracks(id) on delete set null,
  created_at timestamptz default now(),
  related_project_id uuid,
  related_prompt_id uuid,
  details jsonb not null default '{}'::jsonb
);

-- -------------------------
-- RLS (basic + safe defaults)
-- -------------------------

alter table public.profiles enable row level security;
alter table public.tracks enable row level security;
alter table public.albums enable row level security;
alter table public.playlists enable row level security;
alter table public.videos enable row level security;
alter table public.wallet_transactions enable row level security;

-- profiles
drop policy if exists profiles_select_public_or_own on public.profiles;
create policy profiles_select_public_or_own
  on public.profiles for select
  using (is_public = true or auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- tracks/albums/videos/playlists (public read when is_public)
drop policy if exists tracks_read_public on public.tracks;
create policy tracks_read_public on public.tracks for select using (is_public = true or auth.uid() = uploader_id);
drop policy if exists tracks_write_own on public.tracks;
create policy tracks_write_own on public.tracks for all using (auth.uid() = uploader_id) with check (auth.uid() = uploader_id);

drop policy if exists albums_read_public on public.albums;
create policy albums_read_public on public.albums for select using (is_public = true or auth.uid() = uploader_id);
drop policy if exists albums_write_own on public.albums;
create policy albums_write_own on public.albums for all using (auth.uid() = uploader_id) with check (auth.uid() = uploader_id);

drop policy if exists videos_read_public on public.videos;
create policy videos_read_public on public.videos for select using (is_public = true or auth.uid() = uploader_id);
drop policy if exists videos_write_own on public.videos;
create policy videos_write_own on public.videos for all using (auth.uid() = uploader_id) with check (auth.uid() = uploader_id);

drop policy if exists playlists_read_public on public.playlists;
create policy playlists_read_public on public.playlists for select using (is_public = true or auth.uid() = creator_id);
drop policy if exists playlists_write_own on public.playlists;
create policy playlists_write_own on public.playlists for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

-- wallet_transactions: users can only read their own rows (writes should be via RPC/service).
drop policy if exists wallet_transactions_read_own on public.wallet_transactions;
create policy wallet_transactions_read_own on public.wallet_transactions for select using (auth.uid() = user_id);

