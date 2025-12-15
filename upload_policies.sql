-- CRFM Upload Policies (apply in Supabase SQL editor)
-- Adds:
-- - profiles.creator_upload_policy (default policy for new uploads)
-- - tracks/albums/videos.upload_policy (per-item override; NULL = follow creator default)

do $$
begin
  -- -------------------------
  -- profiles.creator_upload_policy
  -- -------------------------
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists creator_upload_policy text not null default 'free';

    if not exists (
      select 1
      from pg_constraint
      where conname = 'profiles_creator_upload_policy_check'
        and conrelid = 'public.profiles'::regclass
    ) then
      alter table public.profiles
        add constraint profiles_creator_upload_policy_check
        check (creator_upload_policy in ('free', 'pay_per_upload', 'subscription'));
    end if;

    comment on column public.profiles.creator_upload_policy is
      'Default upload policy for the creator (free/pay_per_upload/subscription).';
  end if;

  -- -------------------------
  -- Per-content upload_policy (NULL = follow profiles.creator_upload_policy)
  -- -------------------------
  if to_regclass('public.tracks') is not null then
    alter table public.tracks
      add column if not exists upload_policy text;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'tracks_upload_policy_check'
        and conrelid = 'public.tracks'::regclass
    ) then
      alter table public.tracks
        add constraint tracks_upload_policy_check
        check (upload_policy is null or upload_policy in ('free', 'pay_per_upload', 'subscription'));
    end if;

    comment on column public.tracks.upload_policy is
      'Per-item upload policy override (NULL follows profiles.creator_upload_policy).';
  end if;

  if to_regclass('public.albums') is not null then
    alter table public.albums
      add column if not exists upload_policy text;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'albums_upload_policy_check'
        and conrelid = 'public.albums'::regclass
    ) then
      alter table public.albums
        add constraint albums_upload_policy_check
        check (upload_policy is null or upload_policy in ('free', 'pay_per_upload', 'subscription'));
    end if;

    comment on column public.albums.upload_policy is
      'Per-item upload policy override (NULL follows profiles.creator_upload_policy).';
  end if;

  if to_regclass('public.videos') is not null then
    alter table public.videos
      add column if not exists upload_policy text;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'videos_upload_policy_check'
        and conrelid = 'public.videos'::regclass
    ) then
      alter table public.videos
        add constraint videos_upload_policy_check
        check (upload_policy is null or upload_policy in ('free', 'pay_per_upload', 'subscription'));
    end if;

    comment on column public.videos.upload_policy is
      'Per-item upload policy override (NULL follows profiles.creator_upload_policy).';
  end if;
end $$;

