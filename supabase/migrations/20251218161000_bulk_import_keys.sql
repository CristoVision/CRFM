-- Bulk import idempotency keys for albums/tracks
-- Allows safe upsert for large libraries and future APIs.

alter table public.albums
  add column if not exists import_source text,
  add column if not exists import_key text;

alter table public.tracks
  add column if not exists import_source text,
  add column if not exists import_key text;

-- Unique per uploader + source + key (only when key is provided).
create unique index if not exists albums_import_key_uq
  on public.albums (uploader_id, import_source, import_key)
  where import_key is not null;

create unique index if not exists tracks_import_key_uq
  on public.tracks (uploader_id, import_source, import_key)
  where import_key is not null;

