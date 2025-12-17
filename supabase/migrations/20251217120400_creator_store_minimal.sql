-- Minimal Digital Downloads Store tables required by CreatorDownloadsManager.
-- (Products + Formats + Discount Codes) using pgcrypto/gen_random_uuid.

create extension if not exists pgcrypto;

create table if not exists public.creator_store_products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('track', 'album', 'video')),
  content_id uuid not null,
  title text not null,
  description text,
  license_text text,
  artist_message text,
  is_active boolean not null default true,
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_store_products_sale_window_check check (
    sale_starts_at is null
    or sale_ends_at is null
    or sale_ends_at > sale_starts_at
  )
);

create index if not exists idx_creator_store_products_creator
  on public.creator_store_products (creator_id, created_at desc);

create unique index if not exists uniq_creator_store_products_creator_content
  on public.creator_store_products (creator_id, content_type, content_id);

create table if not exists public.creator_store_formats (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.creator_store_products(id) on delete cascade,
  format text not null,
  price_cc numeric not null check (price_cc >= 0),
  entitlement_duration_days integer check (entitlement_duration_days is null or entitlement_duration_days > 0),
  is_active boolean not null default true,
  file_bucket text not null default 'downloads',
  file_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_store_formats_path_check check (length(file_path) > 0)
);

create index if not exists idx_creator_store_formats_product
  on public.creator_store_formats (product_id, created_at desc);

create unique index if not exists uniq_creator_store_formats_product_format_path
  on public.creator_store_formats (product_id, format, file_bucket, file_path);

create table if not exists public.creator_store_discount_codes (
  code text primary key,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  discount_percent numeric not null check (discount_percent > 0 and discount_percent <= 100),
  product_id uuid references public.creator_store_products(id) on delete cascade,
  format_id uuid references public.creator_store_formats(id) on delete cascade,
  expires_at timestamptz,
  max_uses integer not null default 100 check (max_uses > 0),
  usage_count integer not null default 0,
  max_uses_per_user integer not null default 1 check (max_uses_per_user > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_store_discount_codes_usage_check check (usage_count <= max_uses)
);

create index if not exists idx_creator_store_discount_codes_creator
  on public.creator_store_discount_codes (creator_id, created_at desc);

alter table public.creator_store_products enable row level security;
alter table public.creator_store_formats enable row level security;
alter table public.creator_store_discount_codes enable row level security;

-- Products: creators/admin can read/manage their rows.
drop policy if exists creator_store_products_select_owner_or_admin on public.creator_store_products;
create policy creator_store_products_select_owner_or_admin
  on public.creator_store_products for select
  using (auth.uid() = creator_id or is_admin_uid(auth.uid()));

drop policy if exists creator_store_products_write_owner_or_admin on public.creator_store_products;
create policy creator_store_products_write_owner_or_admin
  on public.creator_store_products for all
  using (auth.uid() = creator_id or is_admin_uid(auth.uid()))
  with check (auth.uid() = creator_id or is_admin_uid(auth.uid()));

-- Formats: readable/writable if you own the parent product (or admin).
drop policy if exists creator_store_formats_select_owner_or_admin on public.creator_store_formats;
create policy creator_store_formats_select_owner_or_admin
  on public.creator_store_formats for select
  using (
    exists (
      select 1
      from public.creator_store_products p
      where p.id = creator_store_formats.product_id
        and (p.creator_id = auth.uid() or is_admin_uid(auth.uid()))
    )
  );

drop policy if exists creator_store_formats_write_owner_or_admin on public.creator_store_formats;
create policy creator_store_formats_write_owner_or_admin
  on public.creator_store_formats for all
  using (
    exists (
      select 1
      from public.creator_store_products p
      where p.id = creator_store_formats.product_id
        and (p.creator_id = auth.uid() or is_admin_uid(auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.creator_store_products p
      where p.id = creator_store_formats.product_id
        and (p.creator_id = auth.uid() or is_admin_uid(auth.uid()))
    )
  );

-- Discount codes: creators/admin manage their rows.
drop policy if exists creator_store_discount_codes_select_owner_or_admin on public.creator_store_discount_codes;
create policy creator_store_discount_codes_select_owner_or_admin
  on public.creator_store_discount_codes for select
  using (auth.uid() = creator_id or is_admin_uid(auth.uid()));

drop policy if exists creator_store_discount_codes_write_owner_or_admin on public.creator_store_discount_codes;
create policy creator_store_discount_codes_write_owner_or_admin
  on public.creator_store_discount_codes for all
  using (auth.uid() = creator_id or is_admin_uid(auth.uid()))
  with check (auth.uid() = creator_id or is_admin_uid(auth.uid()));

