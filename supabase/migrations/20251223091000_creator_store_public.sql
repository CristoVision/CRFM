alter table if exists public.creator_store_products
  add column if not exists is_public boolean not null default true;

update public.creator_store_products
  set is_public = true
  where is_public is null;

drop policy if exists creator_store_products_select_public on public.creator_store_products;
create policy creator_store_products_select_public
  on public.creator_store_products for select
  using (
    is_active = true
    and is_public = true
    and (sale_starts_at is null or sale_starts_at <= now())
    and (sale_ends_at is null or sale_ends_at >= now())
  );

drop policy if exists creator_store_formats_select_public on public.creator_store_formats;
create policy creator_store_formats_select_public
  on public.creator_store_formats for select
  using (
    exists (
      select 1
      from public.creator_store_products p
      where p.id = creator_store_formats.product_id
        and p.is_active = true
        and p.is_public = true
        and (p.sale_starts_at is null or p.sale_starts_at <= now())
        and (p.sale_ends_at is null or p.sale_ends_at >= now())
    )
  );
