-- Add name parts to profiles and keep full_name compatible.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text,
  add column if not exists second_last_name text;

create or replace function public.build_full_name(
  p_first text,
  p_middle text,
  p_last text,
  p_second_last text
) returns text
language sql
stable
as $$
  select trim(
    regexp_replace(
      concat_ws(' ',
        nullif(trim(coalesce(p_first, '')), ''),
        nullif(trim(coalesce(p_middle, '')), ''),
        nullif(trim(coalesce(p_last, '')), ''),
        nullif(trim(coalesce(p_second_last, '')), '')
      ),
      '\\s+',
      ' ',
      'g'
    )
  );
$$;

-- Replace the signup trigger handler to populate name parts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text;
  v_middle text;
  v_last text;
  v_second_last text;
  v_full_name text;
  v_display_name text;
  v_username text;
begin
  v_first := nullif(coalesce(new.raw_user_meta_data->>'first_name', ''), '');
  v_middle := nullif(coalesce(new.raw_user_meta_data->>'middle_name', ''), '');
  v_last := nullif(coalesce(new.raw_user_meta_data->>'last_name', ''), '');
  v_second_last := nullif(coalesce(new.raw_user_meta_data->>'second_last_name', ''), '');

  v_full_name := nullif(coalesce(new.raw_user_meta_data->>'full_name', ''), '');
  if v_full_name is null then
    v_full_name := nullif(public.build_full_name(v_first, v_middle, v_last, v_second_last), '');
  end if;

  v_display_name := nullif(coalesce(new.raw_user_meta_data->>'display_name', ''), '');
  if v_display_name is null then
    v_display_name := v_full_name;
  end if;

  v_username := nullif(split_part(coalesce(new.email, ''), '@', 1), '');

  insert into public.profiles (
    id,
    email,
    username,
    first_name,
    middle_name,
    last_name,
    second_last_name,
    full_name,
    display_name,
    is_public,
    created_at,
    updated_at
  ) values (
    new.id,
    new.email,
    v_username,
    v_first,
    v_middle,
    v_last,
    v_second_last,
    coalesce(v_full_name, ''),
    v_display_name,
    true,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

