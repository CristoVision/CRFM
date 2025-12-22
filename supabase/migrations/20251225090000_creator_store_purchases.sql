-- Marketplace purchases + wallet transfer (CC-based)

create table if not exists public.creator_store_purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.creator_store_products(id) on delete cascade,
  format_id uuid not null references public.creator_store_formats(id) on delete cascade,
  price_cc numeric not null,
  fee_cc numeric not null default 0,
  net_cc numeric not null default 0,
  quantity integer not null default 1,
  status text not null default 'completed' check (status in ('completed','refunded','canceled')),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_creator_store_purchases_buyer
  on public.creator_store_purchases (buyer_id, created_at desc);

create index if not exists idx_creator_store_purchases_creator
  on public.creator_store_purchases (creator_id, created_at desc);

alter table public.creator_store_purchases enable row level security;

drop policy if exists creator_store_purchases_select_scope on public.creator_store_purchases;
create policy creator_store_purchases_select_scope
  on public.creator_store_purchases for select
  using (buyer_id = auth.uid() or creator_id = auth.uid() or is_admin_uid(auth.uid()));

-- Inserts are via RPC only (no public insert policy).

create or replace function public.purchase_creator_store_item(
  p_format_id uuid,
  p_quantity integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_format record;
  v_total_cc numeric;
  v_fee_cc numeric;
  v_net_cc numeric;
  v_quantity integer;
  v_purchase_id uuid;
  v_now timestamptz := now();
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  v_quantity := coalesce(p_quantity, 1);
  if v_quantity < 1 then
    v_quantity := 1;
  end if;

  select
    f.id as format_id,
    f.product_id,
    f.price_cc,
    f.format,
    f.file_bucket,
    f.file_path,
    p.creator_id,
    p.is_active as product_active,
    p.is_public as product_public,
    p.sale_starts_at,
    p.sale_ends_at
  into v_format
  from public.creator_store_formats f
  join public.creator_store_products p on p.id = f.product_id
  where f.id = p_format_id
    and f.is_active = true;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'format_not_found');
  end if;

  if v_format.product_active is not true or v_format.product_public is not true then
    return jsonb_build_object('ok', false, 'reason', 'product_inactive');
  end if;

  if v_format.sale_starts_at is not null and v_format.sale_starts_at > v_now then
    return jsonb_build_object('ok', false, 'reason', 'sale_not_started');
  end if;

  if v_format.sale_ends_at is not null and v_format.sale_ends_at < v_now then
    return jsonb_build_object('ok', false, 'reason', 'sale_ended');
  end if;

  v_total_cc := (v_format.price_cc * v_quantity);
  v_fee_cc := round((v_total_cc * 0.03) + 1, 2);
  if v_fee_cc < 0 then
    v_fee_cc := 0;
  end if;
  v_net_cc := greatest(v_total_cc - v_fee_cc, 0);

  update public.profiles
    set wallet_balance = wallet_balance - v_total_cc
  where id = v_user_id
    and wallet_balance >= v_total_cc;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_funds');
  end if;

  update public.profiles
    set withdrawable_balance = coalesce(withdrawable_balance, 0) + v_net_cc
  where id = v_format.creator_id;

  insert into public.creator_store_purchases (
    buyer_id,
    creator_id,
    product_id,
    format_id,
    price_cc,
    fee_cc,
    net_cc,
    quantity,
    metadata
  ) values (
    v_user_id,
    v_format.creator_id,
    v_format.product_id,
    v_format.format_id,
    v_total_cc,
    v_fee_cc,
    v_net_cc,
    v_quantity,
    jsonb_build_object(
      'format', v_format.format,
      'file_bucket', v_format.file_bucket,
      'file_path', v_format.file_path,
      'fee_cc', v_fee_cc
    )
  ) returning id into v_purchase_id;

  begin
    insert into public.wallet_transactions (user_id, transaction_type, amount, description, details)
    values (
      v_user_id,
      'store_purchase',
      -v_total_cc,
      'Marketplace purchase',
      jsonb_build_object('purchase_id', v_purchase_id, 'product_id', v_format.product_id, 'format_id', v_format.format_id, 'fee_cc', v_fee_cc)
    );
  exception when undefined_table then
    null;
  end;

  begin
    insert into public.wallet_transactions (user_id, transaction_type, amount, description, details)
    values (
      v_format.creator_id,
      'store_sale',
      v_net_cc,
      'Marketplace sale',
      jsonb_build_object('purchase_id', v_purchase_id, 'product_id', v_format.product_id, 'format_id', v_format.format_id, 'fee_cc', v_fee_cc)
    );
  exception when undefined_table then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'purchase_id', v_purchase_id,
    'total_cc', v_total_cc,
    'fee_cc', v_fee_cc,
    'net_cc', v_net_cc
  );
end;
$$;

comment on function public.purchase_creator_store_item is 'Charge buyer CC balance for a creator store format, credit creator withdrawable balance, and log purchase.';
