-- DU TCG PR tutorial achievement + reward

do $$
declare
  v_project uuid;
begin
  select id into v_project from public.projects where code = 'DU_TCG_PR' limit 1;
  if v_project is null then
    raise notice 'DU_TCG_PR project not found; skipping tutorial achievement seed.';
    return;
  end if;

  if exists (
    select 1 from public.achievements where project_id = v_project and name = 'Tutorial Complete'
  ) then
    update public.achievements
      set description = 'Complete the DU TCG PR starter tutorial.',
          reward_cc = 10,
          criteria_json = jsonb_build_object('event', 'tutorial_complete'),
          rewards = jsonb_build_array(jsonb_build_object('type', 'cc', 'amount', 10)),
          is_milestone = true
      where project_id = v_project and name = 'Tutorial Complete';
  else
    insert into public.achievements (project_id, name, description, reward_cc, criteria_json, rewards, is_milestone)
    values (
      v_project,
      'Tutorial Complete',
      'Complete the DU TCG PR starter tutorial.',
      10,
      jsonb_build_object('event', 'tutorial_complete'),
      jsonb_build_array(jsonb_build_object('type', 'cc', 'amount', 10)),
      true
    );
  end if;
end $$;

create or replace function public.complete_du_tutorial()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_project_id uuid;
  v_achievement_id uuid;
  v_reward_cc numeric := 10;
  v_exists boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select id into v_project_id from public.projects where code = 'DU_TCG_PR' limit 1;
  select id, coalesce(reward_cc, 10) into v_achievement_id, v_reward_cc
  from public.achievements
  where project_id = v_project_id and name = 'Tutorial Complete'
  limit 1;

  if v_achievement_id is null then
    return jsonb_build_object('ok', false, 'reason', 'achievement_missing');
  end if;

  select true into v_exists
  from public.user_achievements
  where user_id = v_user_id and achievement_id = v_achievement_id
  limit 1;

  if v_exists then
    return jsonb_build_object('ok', true, 'already_completed', true, 'reward_cc', 0);
  end if;

  insert into public.user_achievements (user_id, achievement_id, project_id, unlocked_at, notified_followers)
  values (v_user_id, v_achievement_id, v_project_id, now(), false)
  on conflict (user_id, achievement_id) do nothing;

  update public.profiles
  set wallet_balance = coalesce(wallet_balance, 0) + v_reward_cc
  where id = v_user_id;

  begin
    insert into public.wallet_transactions (user_id, transaction_type, amount, description, details)
    values (
      v_user_id,
      'reward',
      v_reward_cc,
      'DU tutorial reward',
      jsonb_build_object('achievement_id', v_achievement_id)
    );
  exception when undefined_table then
    null;
  end;

  return jsonb_build_object('ok', true, 'reward_cc', v_reward_cc);
end;
$$;

comment on function public.complete_du_tutorial is 'Awards the DU tutorial achievement and 10 CC to the authenticated user.';
