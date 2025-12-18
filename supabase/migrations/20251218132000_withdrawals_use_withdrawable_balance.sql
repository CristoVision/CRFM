-- Ensure withdrawals can only be requested against withdrawable (royalties) balance.
-- Prevents withdrawing top-ups and avoids Stripe-negative scenarios.

create or replace function public.request_wallet_action(
  p_user_id uuid,
  p_action_type text,
  p_amount numeric default null,
  p_code text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_withdrawable numeric;
  v_pending numeric;
  v_available numeric;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  if auth.uid() <> p_user_id and not is_admin_uid(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_action_type not in ('add_funds', 'withdraw', 'redeem_code') then
    raise exception 'invalid action type %', p_action_type using errcode = '22000';
  end if;

  if p_action_type <> 'redeem_code' and (p_amount is null or p_amount <= 0) then
    raise exception 'amount must be > 0 for %', p_action_type using errcode = '22000';
  end if;

  if p_action_type = 'redeem_code' and (p_code is null or length(trim(p_code)) = 0) then
    raise exception 'code required for redeem_code' using errcode = '22000';
  end if;

  -- Server-side guardrail: withdrawals must be backed by withdrawable (royalties) balance only.
  if p_action_type = 'withdraw' then
    select coalesce(p.withdrawable_balance, 0)
      into v_withdrawable
      from public.profiles p
      where p.id = p_user_id;

    select coalesce(sum(r.amount), 0)
      into v_pending
      from public.wallet_action_requests r
      where r.user_id = p_user_id
        and r.action_type = 'withdraw'
        and r.status in ('pending', 'processing');

    v_available := greatest(v_withdrawable - v_pending, 0);
    if p_amount > v_available then
      raise exception 'withdrawal exceeds withdrawable balance' using errcode = '22000';
    end if;
  end if;

  insert into public.wallet_action_requests (user_id, action_type, amount, code, metadata, status)
  values (p_user_id, p_action_type, p_amount, p_code, coalesce(p_metadata, '{}'::jsonb), 'pending')
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.request_wallet_action is 'Insert wallet action request with ownership/validation; withdrawals are limited to withdrawable_balance (royalties).';

