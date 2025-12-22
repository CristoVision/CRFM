alter table if exists public.creature_stages
  add column if not exists image_url_male text,
  add column if not exists image_url_female text;
