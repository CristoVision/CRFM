-- Referrals + Achievements schema required by the CRFM UI.
-- Fixes 404s for: referrals, achievements, user_achievements, project_seasons.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Referrals (InviteFriendsTab)
-- ------------------------------------------------------------

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  invite_code text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'canceled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists idx_referrals_inviter_created
  on public.referrals (inviter_user_id, created_at desc);

alter table public.referrals enable row level security;

drop policy if exists referrals_select_owner_or_admin on public.referrals;
create policy referrals_select_owner_or_admin
  on public.referrals for select
  using (inviter_user_id = auth.uid() or is_admin_uid(auth.uid()));

drop policy if exists referrals_insert_owner on public.referrals;
create policy referrals_insert_owner
  on public.referrals for insert
  with check (inviter_user_id = auth.uid());

drop policy if exists referrals_update_admin_only on public.referrals;
create policy referrals_update_admin_only
  on public.referrals for update
  using (is_admin_uid(auth.uid()));

-- ------------------------------------------------------------
-- 2) Project seasons (AdminAchievementsTab)
-- ------------------------------------------------------------

create table if not exists public.project_seasons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  pass_required boolean not null default false,
  pass_name text,
  created_at timestamptz not null default now(),
  unique (project_id, code)
);

alter table public.project_seasons enable row level security;

drop policy if exists project_seasons_select_authenticated on public.project_seasons;
create policy project_seasons_select_authenticated
  on public.project_seasons for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

drop policy if exists project_seasons_admin_write on public.project_seasons;
create policy project_seasons_admin_write
  on public.project_seasons for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

-- ------------------------------------------------------------
-- 3) Achievements + user_achievements
-- ------------------------------------------------------------

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  season_id uuid references public.project_seasons(id) on delete set null,
  name text not null,
  description text,
  icon_url text,
  is_milestone boolean not null default false,
  rarity text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  rewards jsonb not null default '[]'::jsonb,
  unlock_rules jsonb not null default '{}'::jsonb,
  active_from timestamptz,
  active_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_achievements_project
  on public.achievements (project_id, name);

alter table public.achievements enable row level security;

drop policy if exists achievements_select_authenticated on public.achievements;
create policy achievements_select_authenticated
  on public.achievements for select
  using (auth.role() = 'authenticated' or is_admin_uid(auth.uid()));

drop policy if exists achievements_admin_write on public.achievements;
create policy achievements_admin_write
  on public.achievements for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  season_id uuid references public.project_seasons(id) on delete set null,
  track_id uuid references public.tracks(id) on delete set null,
  unlocked_at timestamptz not null default now(),
  notified_followers boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create index if not exists idx_user_achievements_user_time
  on public.user_achievements (user_id, unlocked_at desc);

alter table public.user_achievements enable row level security;

drop policy if exists user_achievements_select_self_or_admin on public.user_achievements;
create policy user_achievements_select_self_or_admin
  on public.user_achievements for select
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

drop policy if exists user_achievements_update_self_or_admin on public.user_achievements;
create policy user_achievements_update_self_or_admin
  on public.user_achievements for update
  using (user_id = auth.uid() or is_admin_uid(auth.uid()))
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

-- Inserts should generally be server-side (service role / admin tooling).
drop policy if exists user_achievements_insert_admin on public.user_achievements;
create policy user_achievements_insert_admin
  on public.user_achievements for insert
  with check (is_admin_uid(auth.uid()));

