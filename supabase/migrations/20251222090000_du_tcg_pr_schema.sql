-- DU TCG PR core schema (tables + columns) for CRFM shared Supabase

-- ------------------------------------------------------------
-- 1) Add DU-specific columns to shared achievements tables
-- ------------------------------------------------------------

alter table if exists public.achievements
  add column if not exists criteria_json jsonb,
  add column if not exists reward_cc numeric,
  add column if not exists reward_item text;

alter table if exists public.user_achievements
  add column if not exists achievement_name text,
  add column if not exists description text,
  add column if not exists date_earned timestamptz;

-- ------------------------------------------------------------
-- 2) Master data tables (public read)
-- ------------------------------------------------------------

create table if not exists public.factions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color_hex text,
  icon_url text,
  slug text unique,
  motto text,
  alignment text,
  lore_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  island text,
  municipalities text[] default '{}',
  map_polygon jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_id uuid references public.regions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creatures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_type text,
  region text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creature_stages (
  id uuid primary key default gen_random_uuid(),
  creature_id uuid references public.creatures(id) on delete cascade,
  stage_name text,
  stage_order integer,
  stage_stats jsonb,
  image_url text,
  variant_type text,
  xp_required integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creature_stage_xp_thresholds (
  id uuid primary key default gen_random_uuid(),
  creature_id uuid references public.creatures(id) on delete cascade,
  stage_id uuid references public.creature_stages(id) on delete set null,
  xp_required integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.region_creatures (
  region_id uuid references public.regions(id) on delete cascade,
  creature_id uuid references public.creatures(id) on delete cascade,
  spawn_rate numeric,
  created_at timestamptz not null default now(),
  primary key (region_id, creature_id)
);

create table if not exists public.city_creatures (
  city_id uuid references public.cities(id) on delete cascade,
  creature_id uuid references public.creatures(id) on delete cascade,
  spawn_rate numeric,
  created_at timestamptz not null default now(),
  primary key (city_id, creature_id)
);

create table if not exists public.story_missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  region_id uuid references public.regions(id) on delete set null,
  order_in_story integer,
  unlock_requirements text,
  reward_cc numeric,
  reward_item text,
  mission_difficulty text,
  is_battle boolean,
  trainer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3) Player/state tables (user scoped)
-- ------------------------------------------------------------

create table if not exists public.player_creatures (
  user_id uuid not null references auth.users(id) on delete cascade,
  creature_id uuid not null references public.creatures(id) on delete cascade,
  current_stage_id uuid references public.creature_stages(id) on delete set null,
  nickname text,
  variant_type text,
  date_caught timestamptz,
  custom_stats jsonb,
  current_xp integer default 0,
  level integer,
  in_party boolean default false,
  party_slot integer,
  is_domesticated boolean default false,
  stats jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, creature_id)
);

create table if not exists public.player_mission_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.story_missions(id) on delete cascade,
  is_completed boolean default false,
  completed_at timestamptz,
  completion_date date,
  rewards jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);

create table if not exists public.player_faction_bonds (
  user_id uuid not null references auth.users(id) on delete cascade,
  faction text not null,
  bond_amount numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, faction)
);

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  player1_id uuid references auth.users(id) on delete set null,
  player2_id text,
  winner_id text,
  battle_log text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.player_trainer_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  trainer_id uuid not null,
  wins integer default 0,
  losses integer default 0,
  familiarity integer default 0,
  last_battle_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, trainer_id)
);

create table if not exists public.player_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  stat_key text not null,
  stat_value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, stat_key)
);

-- ------------------------------------------------------------
-- 4) Indexes
-- ------------------------------------------------------------

create index if not exists idx_story_missions_region on public.story_missions (region_id);
create index if not exists idx_creature_stages_creature on public.creature_stages (creature_id, stage_order);
create index if not exists idx_player_creatures_user on public.player_creatures (user_id);
create index if not exists idx_player_mission_progress_user on public.player_mission_progress (user_id);
create index if not exists idx_player_faction_bonds_user on public.player_faction_bonds (user_id);
create index if not exists idx_player_trainer_stats_user on public.player_trainer_stats (user_id);
create index if not exists idx_player_stats_user on public.player_stats (user_id);
create index if not exists idx_battles_player1 on public.battles (player1_id);

-- ------------------------------------------------------------
-- 5) RLS + Policies
-- ------------------------------------------------------------

-- Public read tables
alter table public.factions enable row level security;
alter table public.regions enable row level security;
alter table public.cities enable row level security;
alter table public.creatures enable row level security;
alter table public.creature_stages enable row level security;
alter table public.creature_stage_xp_thresholds enable row level security;
alter table public.region_creatures enable row level security;
alter table public.city_creatures enable row level security;
alter table public.story_missions enable row level security;

-- Select policies
 drop policy if exists factions_select_authenticated on public.factions;
create policy factions_select_authenticated
  on public.factions for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

 drop policy if exists regions_select_authenticated on public.regions;
create policy regions_select_authenticated
  on public.regions for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

 drop policy if exists cities_select_authenticated on public.cities;
create policy cities_select_authenticated
  on public.cities for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

 drop policy if exists creatures_select_authenticated on public.creatures;
create policy creatures_select_authenticated
  on public.creatures for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

 drop policy if exists creature_stages_select_authenticated on public.creature_stages;
create policy creature_stages_select_authenticated
  on public.creature_stages for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

 drop policy if exists creature_stage_xp_thresholds_select_authenticated on public.creature_stage_xp_thresholds;
create policy creature_stage_xp_thresholds_select_authenticated
  on public.creature_stage_xp_thresholds for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

 drop policy if exists region_creatures_select_authenticated on public.region_creatures;
create policy region_creatures_select_authenticated
  on public.region_creatures for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

 drop policy if exists city_creatures_select_authenticated on public.city_creatures;
create policy city_creatures_select_authenticated
  on public.city_creatures for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

 drop policy if exists story_missions_select_authenticated on public.story_missions;
create policy story_missions_select_authenticated
  on public.story_missions for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

-- Admin write policies for master tables
 drop policy if exists factions_admin_write on public.factions;
create policy factions_admin_write
  on public.factions for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

 drop policy if exists regions_admin_write on public.regions;
create policy regions_admin_write
  on public.regions for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

 drop policy if exists cities_admin_write on public.cities;
create policy cities_admin_write
  on public.cities for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

 drop policy if exists creatures_admin_write on public.creatures;
create policy creatures_admin_write
  on public.creatures for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

 drop policy if exists creature_stages_admin_write on public.creature_stages;
create policy creature_stages_admin_write
  on public.creature_stages for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

 drop policy if exists creature_stage_xp_thresholds_admin_write on public.creature_stage_xp_thresholds;
create policy creature_stage_xp_thresholds_admin_write
  on public.creature_stage_xp_thresholds for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

 drop policy if exists region_creatures_admin_write on public.region_creatures;
create policy region_creatures_admin_write
  on public.region_creatures for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

 drop policy if exists city_creatures_admin_write on public.city_creatures;
create policy city_creatures_admin_write
  on public.city_creatures for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

 drop policy if exists story_missions_admin_write on public.story_missions;
create policy story_missions_admin_write
  on public.story_missions for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

-- Player tables
alter table public.player_creatures enable row level security;
alter table public.player_mission_progress enable row level security;
alter table public.player_faction_bonds enable row level security;
alter table public.battles enable row level security;
alter table public.player_trainer_stats enable row level security;
alter table public.player_stats enable row level security;

 drop policy if exists player_creatures_select_self on public.player_creatures;
create policy player_creatures_select_self
  on public.player_creatures for select
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_creatures_insert_self on public.player_creatures;
create policy player_creatures_insert_self
  on public.player_creatures for insert
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_creatures_update_self on public.player_creatures;
create policy player_creatures_update_self
  on public.player_creatures for update
  using (user_id = auth.uid() or is_admin_uid(auth.uid()))
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_creatures_delete_self on public.player_creatures;
create policy player_creatures_delete_self
  on public.player_creatures for delete
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_mission_progress_select_self on public.player_mission_progress;
create policy player_mission_progress_select_self
  on public.player_mission_progress for select
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_mission_progress_insert_self on public.player_mission_progress;
create policy player_mission_progress_insert_self
  on public.player_mission_progress for insert
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_mission_progress_update_self on public.player_mission_progress;
create policy player_mission_progress_update_self
  on public.player_mission_progress for update
  using (user_id = auth.uid() or is_admin_uid(auth.uid()))
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_mission_progress_delete_self on public.player_mission_progress;
create policy player_mission_progress_delete_self
  on public.player_mission_progress for delete
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_faction_bonds_select_self on public.player_faction_bonds;
create policy player_faction_bonds_select_self
  on public.player_faction_bonds for select
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_faction_bonds_insert_self on public.player_faction_bonds;
create policy player_faction_bonds_insert_self
  on public.player_faction_bonds for insert
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_faction_bonds_update_self on public.player_faction_bonds;
create policy player_faction_bonds_update_self
  on public.player_faction_bonds for update
  using (user_id = auth.uid() or is_admin_uid(auth.uid()))
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_faction_bonds_delete_self on public.player_faction_bonds;
create policy player_faction_bonds_delete_self
  on public.player_faction_bonds for delete
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_trainer_stats_select_self on public.player_trainer_stats;
create policy player_trainer_stats_select_self
  on public.player_trainer_stats for select
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_trainer_stats_insert_self on public.player_trainer_stats;
create policy player_trainer_stats_insert_self
  on public.player_trainer_stats for insert
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_trainer_stats_update_self on public.player_trainer_stats;
create policy player_trainer_stats_update_self
  on public.player_trainer_stats for update
  using (user_id = auth.uid() or is_admin_uid(auth.uid()))
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_trainer_stats_delete_self on public.player_trainer_stats;
create policy player_trainer_stats_delete_self
  on public.player_trainer_stats for delete
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_stats_select_self on public.player_stats;
create policy player_stats_select_self
  on public.player_stats for select
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_stats_insert_self on public.player_stats;
create policy player_stats_insert_self
  on public.player_stats for insert
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_stats_update_self on public.player_stats;
create policy player_stats_update_self
  on public.player_stats for update
  using (user_id = auth.uid() or is_admin_uid(auth.uid()))
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists player_stats_delete_self on public.player_stats;
create policy player_stats_delete_self
  on public.player_stats for delete
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

 drop policy if exists battles_select_self on public.battles;
create policy battles_select_self
  on public.battles for select
  using (player1_id = auth.uid() or player2_id = auth.uid()::text or is_admin_uid(auth.uid()));

 drop policy if exists battles_insert_self on public.battles;
create policy battles_insert_self
  on public.battles for insert
  with check (player1_id = auth.uid() or is_admin_uid(auth.uid()));
