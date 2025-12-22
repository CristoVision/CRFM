-- DU TCG PR admin schema additions (trainers, battle pass, items, skills)

create extension if not exists "pgcrypto";

create or replace function public.du_is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = uid), false);
$$;

-- Trainers and teams
create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  bio text,
  region_id uuid references public.regions(id) on delete set null,
  faction_id uuid references public.factions(id) on delete set null,
  difficulty text,
  is_npc boolean not null default true,
  is_active boolean not null default true,
  avatar_url text,
  battle_music_config jsonb not null default jsonb_build_object('play_order','sequential','track_ids','[]'::jsonb),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_creatures (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  creature_id uuid not null references public.creatures(id) on delete cascade,
  stage_id uuid references public.creature_stages(id) on delete set null,
  level integer not null default 1,
  nickname text,
  variant_type text default 'normal',
  slot_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trainer_creatures_trainer_idx on public.trainer_creatures(trainer_id, slot_order);

create table if not exists public.trainer_battles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  outcome text not null,
  xp_earned integer default 0,
  cc_earned integer default 0,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

-- Battle pass
create table if not exists public.battle_passes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  season text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.battle_pass_tiers (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.battle_passes(id) on delete cascade,
  tier_number integer not null,
  title text,
  description text,
  reward_cc numeric,
  reward_item text,
  reward_type text,
  unlock_xp integer,
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists battle_pass_tiers_pass_idx on public.battle_pass_tiers(pass_id, tier_number);

-- Items + skills
create table if not exists public.du_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rarity text,
  icon_url text,
  effect_json jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.du_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  icon_url text,
  effect_json jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional page music config (simple per-page track assignment)
create table if not exists public.du_page_music_config (
  page_key text primary key,
  track_ids uuid[] default '{}',
  play_order text default 'sequential',
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- RLS policies
-- ------------------------------------------------------------

alter table public.trainers enable row level security;
alter table public.trainer_creatures enable row level security;
alter table public.trainer_battles enable row level security;
alter table public.battle_passes enable row level security;
alter table public.battle_pass_tiers enable row level security;
alter table public.du_items enable row level security;
alter table public.du_skills enable row level security;
alter table public.du_page_music_config enable row level security;

drop policy if exists trainers_select_public on public.trainers;
create policy trainers_select_public
  on public.trainers for select using (true);
drop policy if exists trainers_write_admin on public.trainers;
create policy trainers_write_admin
  on public.trainers for all using (public.du_is_admin(auth.uid())) with check (public.du_is_admin(auth.uid()));

drop policy if exists trainer_creatures_select_public on public.trainer_creatures;
create policy trainer_creatures_select_public
  on public.trainer_creatures for select using (true);
drop policy if exists trainer_creatures_write_admin on public.trainer_creatures;
create policy trainer_creatures_write_admin
  on public.trainer_creatures for all using (public.du_is_admin(auth.uid())) with check (public.du_is_admin(auth.uid()));

drop policy if exists trainer_battles_select_own on public.trainer_battles;
create policy trainer_battles_select_own
  on public.trainer_battles for select using (auth.uid() = user_id or public.du_is_admin(auth.uid()));
drop policy if exists trainer_battles_insert_own on public.trainer_battles;
create policy trainer_battles_insert_own
  on public.trainer_battles for insert with check (auth.uid() = user_id);

drop policy if exists battle_passes_select_public on public.battle_passes;
create policy battle_passes_select_public
  on public.battle_passes for select using (true);
drop policy if exists battle_passes_write_admin on public.battle_passes;
create policy battle_passes_write_admin
  on public.battle_passes for all using (public.du_is_admin(auth.uid())) with check (public.du_is_admin(auth.uid()));

drop policy if exists battle_pass_tiers_select_public on public.battle_pass_tiers;
create policy battle_pass_tiers_select_public
  on public.battle_pass_tiers for select using (true);
drop policy if exists battle_pass_tiers_write_admin on public.battle_pass_tiers;
create policy battle_pass_tiers_write_admin
  on public.battle_pass_tiers for all using (public.du_is_admin(auth.uid())) with check (public.du_is_admin(auth.uid()));

drop policy if exists du_items_select_public on public.du_items;
create policy du_items_select_public
  on public.du_items for select using (true);
drop policy if exists du_items_write_admin on public.du_items;
create policy du_items_write_admin
  on public.du_items for all using (public.du_is_admin(auth.uid())) with check (public.du_is_admin(auth.uid()));

drop policy if exists du_skills_select_public on public.du_skills;
create policy du_skills_select_public
  on public.du_skills for select using (true);
drop policy if exists du_skills_write_admin on public.du_skills;
create policy du_skills_write_admin
  on public.du_skills for all using (public.du_is_admin(auth.uid())) with check (public.du_is_admin(auth.uid()));

drop policy if exists du_page_music_select_public on public.du_page_music_config;
create policy du_page_music_select_public
  on public.du_page_music_config for select using (true);
drop policy if exists du_page_music_write_admin on public.du_page_music_config;
create policy du_page_music_write_admin
  on public.du_page_music_config for all using (public.du_is_admin(auth.uid())) with check (public.du_is_admin(auth.uid()));
