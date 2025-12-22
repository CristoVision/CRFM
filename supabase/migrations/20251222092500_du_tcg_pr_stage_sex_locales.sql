-- DU TCG PR: add stage metadata + creature locales + player creature sex

alter table if exists public.creatures
  add column if not exists name_locales jsonb,
  add column if not exists is_starter boolean not null default false,
  add column if not exists rarity text,
  add column if not exists sexes text[] not null default '{male,female}';

alter table if exists public.player_creatures
  add column if not exists sex text;

alter table if exists public.creature_stages
  add column if not exists stage_key text,
  add column if not exists faction_slug text,
  add column if not exists is_shiny boolean not null default false;
