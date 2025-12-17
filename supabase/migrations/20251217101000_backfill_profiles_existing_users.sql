-- Backfill profiles for users created before the `on_auth_user_created` trigger existed.
-- Safe to run multiple times.

insert into public.profiles (
  id,
  email,
  full_name,
  display_name,
  username,
  is_public,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  nullif(coalesce(u.raw_user_meta_data->>'display_name', ''), ''),
  nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
  true,
  now(),
  now()
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

