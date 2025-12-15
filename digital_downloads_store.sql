-- CRFM Digital Downloads Store (apply in Supabase SQL editor)
-- Goals:
-- - Creators list digital downloads (tracks/albums/videos) with format-specific pricing in CrossCoins (CC)
-- - Purchases create entitlements (permanent or time-limited) and are logged for analytics/audit
-- - Download assets are stored in a PRIVATE bucket (recommended bucket_id: 'downloads')
-- - Storage access is enforced by RLS on storage.objects using entitlements + file path match
--
-- Notes:
-- - This script is idempotent (safe to re-run).
-- - Requires existing: public.profiles (wallet_balance), public.wallet_transactions (optional), public.billing_events (from memberships_and_promo_codes.sql).

-- =========================================================
-- 1) Tables
-- =========================================================

create table if not exists public.creator_store_products (
  id uuid primary key default uuid_generate_v4(),
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
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_store_products_sale_window_check check (
    sale_starts_at is null
    or sale_ends_at is null
    or sale_ends_at > sale_starts_at
  )
);

create index if not exists idx_creator_store_products_creator on public.creator_store_products(creator_id, created_at desc);
create unique index if not exists uniq_creator_store_products_creator_content on public.creator_store_products(creator_id, content_type, content_id);

comment on table public.creator_store_products is 'Creator digital download products mapped to a track/album/video.';

create table if not exists public.creator_store_formats (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.creator_store_products(id) on delete cascade,
  format text not null,
  price_cc numeric not null check (price_cc >= 0),
  entitlement_duration_days integer check (entitlement_duration_days is null or entitlement_duration_days > 0),
  is_active boolean not null default true,
  file_bucket text not null default 'downloads',
  file_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_store_formats_path_check check (length(file_path) > 0)
);

create index if not exists idx_creator_store_formats_product on public.creator_store_formats(product_id, created_at desc);
create unique index if not exists uniq_creator_store_formats_product_format_path on public.creator_store_formats(product_id, format, file_bucket, file_path);

comment on table public.creator_store_formats is 'Format-level pricing and storage path for a store product (mp3/wav/flac/mp4/etc).';

create table if not exists public.creator_download_entitlements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.creator_store_products(id) on delete cascade,
  format_id uuid not null references public.creator_store_formats(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_creator_download_entitlements_user on public.creator_download_entitlements(user_id, purchased_at desc);
create index if not exists idx_creator_download_entitlements_creator on public.creator_download_entitlements(creator_id, purchased_at desc);
create unique index if not exists uniq_creator_download_entitlements_user_format_active
  on public.creator_download_entitlements(user_id, format_id)
  where status = 'active';

comment on table public.creator_download_entitlements is 'Purchase entitlements for private download access (format-specific).';

create table if not exists public.creator_store_discount_codes (
  code text primary key,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  discount_percent numeric not null check (discount_percent > 0 and discount_percent <= 100),
  product_id uuid references public.creator_store_products(id) on delete cascade,
  format_id uuid references public.creator_store_formats(id) on delete cascade,
  first_time_only boolean not null default false,
  expires_at timestamptz,
  max_uses integer not null default 100 check (max_uses > 0),
  usage_count integer not null default 0,
  max_uses_per_user integer not null default 1 check (max_uses_per_user > 0),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_store_discount_codes_usage_check check (usage_count <= max_uses),
  constraint creator_store_discount_codes_scope_check check (
    -- allow global creator code (both null) OR scoped to a product OR scoped to a format
    (product_id is null and format_id is null)
    or (product_id is not null and format_id is null)
    or (format_id is not null)
  )
);

create index if not exists idx_creator_store_discount_codes_creator on public.creator_store_discount_codes(creator_id, is_active, expires_at);

comment on table public.creator_store_discount_codes is 'Creator-managed discount codes for digital downloads (percent off).';

create table if not exists public.creator_store_discount_redemptions (
  id uuid primary key default uuid_generate_v4(),
  code text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.creator_store_products(id) on delete set null,
  format_id uuid references public.creator_store_formats(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  gross_amount_cc numeric,
  discount_percent numeric,
  discount_amount_cc numeric,
  charged_amount_cc numeric,
  entitlement_id uuid references public.creator_download_entitlements(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_creator_store_discount_redemptions_creator on public.creator_store_discount_redemptions(creator_id, redeemed_at desc);
create index if not exists idx_creator_store_discount_redemptions_code_user on public.creator_store_discount_redemptions(code, user_id);

comment on table public.creator_store_discount_redemptions is 'Immutable log of discount code use for download purchases.';

-- =========================================================
-- 2) RLS
-- =========================================================

alter table public.creator_store_products enable row level security;
alter table public.creator_store_formats enable row level security;
alter table public.creator_download_entitlements enable row level security;
alter table public.creator_store_discount_codes enable row level security;
alter table public.creator_store_discount_redemptions enable row level security;

do $$
begin
  -- Products: public can read active products (for listing); creators manage their own; admins manage all.
  if not exists (select 1 from pg_policies where polname = 'creator_store_products_select_active') then
    create policy creator_store_products_select_active on public.creator_store_products
      for select using (
        is_active = true
        and (sale_starts_at is null or sale_starts_at <= now())
        and (sale_ends_at is null or sale_ends_at >= now())
        and auth.role() in ('anon', 'authenticated')
      );
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_store_products_select_owner_or_admin') then
    create policy creator_store_products_select_owner_or_admin on public.creator_store_products
      for select using (auth.uid() = creator_id or is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_store_products_insert_owner') then
    create policy creator_store_products_insert_owner on public.creator_store_products
      for insert with check (auth.uid() = creator_id or is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_store_products_update_owner') then
    create policy creator_store_products_update_owner on public.creator_store_products
      for update using (auth.uid() = creator_id or is_admin_uid(auth.uid()));
  end if;

  -- Formats: public can read active formats for active products; creators manage their own.
  if not exists (select 1 from pg_policies where polname = 'creator_store_formats_select_active') then
    create policy creator_store_formats_select_active on public.creator_store_formats
      for select using (
        is_active = true
        and auth.role() in ('anon', 'authenticated')
        and exists (
          select 1
          from public.creator_store_products p
          where p.id = creator_store_formats.product_id
            and p.is_active = true
            and (p.sale_starts_at is null or p.sale_starts_at <= now())
            and (p.sale_ends_at is null or p.sale_ends_at >= now())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_store_formats_select_owner_or_admin') then
    create policy creator_store_formats_select_owner_or_admin on public.creator_store_formats
      for select using (
        exists (
          select 1 from public.creator_store_products p
          where p.id = creator_store_formats.product_id
            and (p.creator_id = auth.uid() or is_admin_uid(auth.uid()))
        )
      );
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_store_formats_insert_owner') then
    create policy creator_store_formats_insert_owner on public.creator_store_formats
      for insert with check (
        exists (
          select 1 from public.creator_store_products p
          where p.id = creator_store_formats.product_id
            and (p.creator_id = auth.uid() or is_admin_uid(auth.uid()))
        )
      );
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_store_formats_update_owner') then
    create policy creator_store_formats_update_owner on public.creator_store_formats
      for update using (
        exists (
          select 1 from public.creator_store_products p
          where p.id = creator_store_formats.product_id
            and (p.creator_id = auth.uid() or is_admin_uid(auth.uid()))
        )
      );
  end if;

  -- Entitlements: user sees own; creator sees purchases for their products (for analytics); admin sees all.
  if not exists (select 1 from pg_policies where polname = 'creator_download_entitlements_select_self_or_creator_or_admin') then
    create policy creator_download_entitlements_select_self_or_creator_or_admin on public.creator_download_entitlements
      for select using (
        auth.uid() = user_id
        or auth.uid() = creator_id
        or is_admin_uid(auth.uid())
      );
  end if;

  -- Discount codes: creators manage their own; admins manage all.
  if not exists (select 1 from pg_policies where polname = 'creator_store_discount_codes_select_owner_or_admin') then
    create policy creator_store_discount_codes_select_owner_or_admin on public.creator_store_discount_codes
      for select using (auth.uid() = creator_id or is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_store_discount_codes_insert_owner') then
    create policy creator_store_discount_codes_insert_owner on public.creator_store_discount_codes
      for insert with check (auth.uid() = creator_id or is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'creator_store_discount_codes_update_owner') then
    create policy creator_store_discount_codes_update_owner on public.creator_store_discount_codes
      for update using (auth.uid() = creator_id or is_admin_uid(auth.uid()));
  end if;

  -- Discount redemptions: user sees own; creator sees their own; admin sees all.
  if not exists (select 1 from pg_policies where polname = 'creator_store_discount_redemptions_select_self_or_creator_or_admin') then
    create policy creator_store_discount_redemptions_select_self_or_creator_or_admin on public.creator_store_discount_redemptions
      for select using (
        auth.uid() = user_id
        or auth.uid() = creator_id
        or is_admin_uid(auth.uid())
      );
  end if;
end $$;

-- =========================================================
-- 3) Billing events: add 'download_purchased'
-- =========================================================
do $$
declare
  v_constraint_name text;
begin
  if to_regclass('public.billing_events') is null then
    return;
  end if;

  -- Find and drop the existing CHECK constraint that validates billing_events.event_type.
  select c.conname
    into v_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'billing_events'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%event_type%'
    and pg_get_constraintdef(c.oid) ilike '%wallet_code_redeemed%'
  limit 1;

  if v_constraint_name is not null then
    execute format('alter table public.billing_events drop constraint %I', v_constraint_name);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'billing_events_event_type_check'
      and conrelid = 'public.billing_events'::regclass
  ) then
    alter table public.billing_events
      add constraint billing_events_event_type_check
      check (
        event_type in (
          'wallet_code_redeemed',
          'membership_granted',
          'membership_purchased',
          'download_purchased'
        )
      );
  end if;
end $$;

-- =========================================================
-- 4) RPC: purchase download format (wallet charge + entitlement)
-- =========================================================
create or replace function public.purchase_download_format(
  p_format_id uuid,
  p_code text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_user_id uuid := auth.uid();
  v_creator_id uuid;
  v_product_id uuid;
  v_product_title text;
  v_sale_starts timestamptz;
  v_sale_ends timestamptz;
  v_price_cc numeric;
  v_duration_days integer;
  v_discount_percent numeric := 0;
  v_discount_amount_cc numeric := 0;
  v_net_cc numeric := 0;
  v_code text;
  v_entitlement_id uuid;
  v_event_id uuid;
  v_expires_at timestamptz;
  v_uses_per_user integer;
begin
  if v_user_id is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select p.creator_id, p.id, p.title, p.sale_starts_at, p.sale_ends_at, f.price_cc, f.entitlement_duration_days
    into v_creator_id, v_product_id, v_product_title, v_sale_starts, v_sale_ends, v_price_cc, v_duration_days
  from public.creator_store_formats f
  join public.creator_store_products p on p.id = f.product_id
  where f.id = p_format_id
    and f.is_active = true
    and p.is_active = true
  for update;

  if v_product_id is null then
    raise exception 'format not available' using errcode = '22000';
  end if;

  if v_sale_starts is not null and v_sale_starts > v_now then
    raise exception 'sale not started' using errcode = '22000';
  end if;

  if v_sale_ends is not null and v_sale_ends < v_now then
    raise exception 'sale ended' using errcode = '22000';
  end if;

  v_net_cc := coalesce(v_price_cc, 0);
  if v_net_cc < 0 then
    raise exception 'invalid price' using errcode = '22000';
  end if;

  v_code := nullif(upper(trim(coalesce(p_code, ''))), '');

  -- Apply discount code (creator-managed)
  if v_code is not null then
    select discount_percent, max_uses_per_user
      into v_discount_percent, v_uses_per_user
    from public.creator_store_discount_codes c
    where c.code = v_code
      and c.creator_id = v_creator_id
      and c.is_active = true
      and (c.expires_at is null or c.expires_at > v_now)
      and c.usage_count < c.max_uses
      and (c.product_id is null or c.product_id = v_product_id)
      and (c.format_id is null or c.format_id = p_format_id)
    for update;

    if v_discount_percent is null then
      raise exception 'invalid or unavailable code' using errcode = '22000';
    end if;

    if coalesce(v_uses_per_user, 1) <= (
      select count(*) from public.creator_store_discount_redemptions
      where code = v_code and user_id = v_user_id
    ) then
      raise exception 'code already used' using errcode = '22000';
    end if;

    v_discount_amount_cc := round((v_net_cc * (v_discount_percent / 100.0))::numeric, 2);
    v_net_cc := greatest(v_net_cc - v_discount_amount_cc, 0);

    update public.creator_store_discount_codes
    set usage_count = usage_count + 1, updated_at = v_now
    where code = v_code;
  end if;

  -- Compute entitlement expiry if time-limited
  if v_duration_days is not null then
    v_expires_at := v_now + make_interval(days => v_duration_days);
  else
    v_expires_at := null;
  end if;

  -- Charge wallet (atomic guard)
  update public.profiles
  set wallet_balance = coalesce(wallet_balance, 0) - v_net_cc
  where id = v_user_id
    and coalesce(wallet_balance, 0) >= v_net_cc;

  if not found then
    raise exception 'insufficient funds' using errcode = '22000';
  end if;

  -- Wallet history (best-effort)
  begin
    insert into public.wallet_transactions (user_id, transaction_type, amount, description)
    values (
      v_user_id,
      'download_purchase',
      -v_net_cc,
      concat('Download purchase: ', coalesce(v_product_title, 'digital item'))
    );
  exception when undefined_table or undefined_column then
    null;
  end;

  -- Create entitlement (extend if already active)
  insert into public.creator_download_entitlements (
    user_id, creator_id, product_id, format_id, status, purchased_at, expires_at, metadata
  ) values (
    v_user_id, v_creator_id, v_product_id, p_format_id, 'active', v_now, v_expires_at, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict on constraint uniq_creator_download_entitlements_user_format_active
  do update set
    purchased_at = excluded.purchased_at,
    expires_at = greatest(coalesce(public.creator_download_entitlements.expires_at, excluded.expires_at), excluded.expires_at),
    metadata = public.creator_download_entitlements.metadata || excluded.metadata
  returning id into v_entitlement_id;

  -- Billing event (analytics/audit)
  insert into public.billing_events (
    user_id, event_type, creator_id, code, gross_amount_cc, discount_amount_cc, net_amount_cc, metadata
  ) values (
    v_user_id,
    'download_purchased',
    v_creator_id,
    v_code,
    v_price_cc,
    nullif(v_discount_amount_cc, 0),
    v_net_cc,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'store', 'downloads',
      'product_id', v_product_id,
      'format_id', p_format_id
    )
  )
  returning id into v_event_id;

  -- Discount redemption log
  if v_code is not null then
    insert into public.creator_store_discount_redemptions (
      code, user_id, creator_id, product_id, format_id,
      gross_amount_cc, discount_percent, discount_amount_cc, charged_amount_cc,
      entitlement_id, metadata
    ) values (
      v_code, v_user_id, v_creator_id, v_product_id, p_format_id,
      v_price_cc, v_discount_percent, v_discount_amount_cc, v_net_cc,
      v_entitlement_id, coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'entitlement_id', v_entitlement_id,
    'billing_event_id', v_event_id,
    'creator_id', v_creator_id,
    'product_id', v_product_id,
    'format_id', p_format_id,
    'gross_cc', v_price_cc,
    'discount_cc', v_discount_amount_cc,
    'net_cc', v_net_cc,
    'expires_at', v_expires_at
  );
end;
$$;

comment on function public.purchase_download_format is 'Charges wallet and grants private download entitlement for a product format.';

-- =========================================================
-- 5) Storage policies (PRIVATE bucket recommended: downloads)
-- =========================================================
-- IMPORTANT:
-- - Create a private bucket named 'downloads' in Supabase Storage.
-- - Upload files under a path that matches creator_store_formats.file_path.
-- - This policy grants read access only if user has an active entitlement.
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  -- Allow SELECT (download) for entitled users
  if not exists (select 1 from pg_policies where polname = 'downloads_bucket_select_entitled') then
    create policy downloads_bucket_select_entitled on storage.objects
      for select
      using (
        bucket_id = 'downloads'
        and exists (
          select 1
          from public.creator_download_entitlements e
          join public.creator_store_formats f on f.id = e.format_id
          where e.user_id = auth.uid()
            and e.status = 'active'
            and (e.expires_at is null or e.expires_at > now())
            and f.file_bucket = storage.objects.bucket_id
            and f.file_path = storage.objects.name
        )
      );
  end if;

  -- Allow creators to INSERT objects into downloads bucket under their own namespace (bucket stays private)
  -- Convention: file_path should start with '<creator_id>/' (e.g., 'aaaaaaaa-bbbb-.../productId/...')
  if not exists (select 1 from pg_policies where polname = 'downloads_bucket_insert_creator') then
    create policy downloads_bucket_insert_creator on storage.objects
      for insert
      with check (
        bucket_id = 'downloads'
        and auth.uid() is not null
        and storage.objects.name like (auth.uid()::text || '/%')
      );
  end if;

  -- Allow creators to UPDATE/DELETE their own objects (optional safety)
  if not exists (select 1 from pg_policies where polname = 'downloads_bucket_update_creator') then
    create policy downloads_bucket_update_creator on storage.objects
      for update
      using (
        bucket_id = 'downloads'
        and auth.uid() is not null
        and storage.objects.name like (auth.uid()::text || '/%')
      );
  end if;
  if not exists (select 1 from pg_policies where polname = 'downloads_bucket_delete_creator') then
    create policy downloads_bucket_delete_creator on storage.objects
      for delete
      using (
        bucket_id = 'downloads'
        and auth.uid() is not null
        and storage.objects.name like (auth.uid()::text || '/%')
      );
  end if;
end $$;

