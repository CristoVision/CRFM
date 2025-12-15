-- RPC: claim_achievement_reward
-- Usage: select * from claim_achievement_reward('<achievement_id>');
-- Ensures user is logged in (auth.uid), upserts user_achievements, marks rewards_claimed, returns rewards payload.

create or replace function claim_achievement_reward(p_achievement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_ach record;
  v_now timestamptz := now();
  v_rewards jsonb := '[]'::jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select a.* into v_ach
  from achievements a
  where a.id = p_achievement_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'achievement_not_found');
  end if;

  v_rewards := coalesce(v_ach.rewards, '[]'::jsonb);

  insert into user_achievements (user_id, achievement_id, project_id, season_id, unlocked_at, rewards_claimed, claimed_at)
  values (v_user_id, p_achievement_id, v_ach.project_id, v_ach.season_id, v_now, true, v_now)
  on conflict (user_id, achievement_id)
  do update set rewards_claimed = true, claimed_at = excluded.claimed_at, project_id = excluded.project_id, season_id = excluded.season_id;

  return jsonb_build_object('ok', true, 'rewards', v_rewards);
end;
$$;

-- RLS helper (if needed) to allow update/insert by owner
-- policy example:
-- CREATE POLICY user_achievements_upsert_owner ON user_achievements
-- FOR INSERT WITH CHECK (user_id = auth.uid());
-- CREATE POLICY user_achievements_update_owner ON user_achievements
-- FOR UPDATE USING (user_id = auth.uid());
