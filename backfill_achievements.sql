-- Backfill achievements (CRFM & DU_TCG_PR)
-- Ejecuta en el editor SQL de Supabase. Asume que proyectos y logros ya existen.
DO $$
DECLARE
  v_crfm uuid;
  v_du uuid;
BEGIN
  SELECT id INTO v_crfm FROM projects WHERE code = 'CRFM' LIMIT 1;
  SELECT id INTO v_du   FROM projects WHERE code = 'DU_TCG_PR' LIMIT 1;
  IF v_crfm IS NULL THEN RAISE EXCEPTION 'No project CRFM'; END IF;
  IF v_du   IS NULL THEN RAISE EXCEPTION 'No project DU_TCG_PR'; END IF;

  -- Helpers: IDs de achievements por nombre+proyecto
  -- CRFM
  -- Streams totales >=1
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT tr.uploader_id, a.id, a.project_id, now(), false
  FROM track_streams ts
  JOIN tracks tr ON tr.id = ts.track_id
  JOIN achievements a ON a.name = 'First Steps' AND a.project_id = v_crfm
  GROUP BY tr.uploader_id, a.id, a.project_id
  HAVING COUNT(*) >= 1
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = tr.uploader_id AND ua.achievement_id = a.id
  );

  -- Streams totales >=50
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT tr.uploader_id, a.id, a.project_id, now(), false
  FROM track_streams ts
  JOIN tracks tr ON tr.id = ts.track_id
  JOIN achievements a ON a.name = 'Combo Starter' AND a.project_id = v_crfm
  GROUP BY tr.uploader_id, a.id, a.project_id
  HAVING COUNT(*) >= 50
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = tr.uploader_id AND ua.achievement_id = a.id
  );

  -- Stream 100 (totales >=100)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT tr.uploader_id, a.id, a.project_id, now(), false
  FROM track_streams ts
  JOIN tracks tr ON tr.id = ts.track_id
  JOIN achievements a ON a.name = 'Stream 100' AND a.project_id = v_crfm
  GROUP BY tr.uploader_id, a.id, a.project_id
  HAVING COUNT(*) >= 100
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = tr.uploader_id AND ua.achievement_id = a.id
  );

  -- Stream 1K (por track >=1000) guarda track_id
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed, track_id)
  SELECT tr.uploader_id, a.id, a.project_id, now(), false, tr.id
  FROM track_streams ts
  JOIN tracks tr ON tr.id = ts.track_id
  JOIN achievements a ON a.name = 'Stream 1K' AND a.project_id = v_crfm
  GROUP BY tr.uploader_id, tr.id, a.id, a.project_id
  HAVING COUNT(*) >= 1000
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = tr.uploader_id AND ua.achievement_id = a.id
  );

  -- Global Listener (streams desde >=3 países)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT tr.uploader_id, a.id, a.project_id, now(), false
  FROM track_streams ts
  JOIN tracks tr ON tr.id = ts.track_id
  JOIN achievements a ON a.name = 'Global Listener' AND a.project_id = v_crfm
  GROUP BY tr.uploader_id, a.id, a.project_id
  HAVING COUNT(DISTINCT ts.country) >= 3
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = tr.uploader_id AND ua.achievement_id = a.id
  );

  -- Upload Streak 5 (aprox: total uploads >=5)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT tr.uploader_id, a.id, a.project_id, now(), false
  FROM tracks tr
  JOIN achievements a ON a.name = 'Upload Streak 5' AND a.project_id = v_crfm
  GROUP BY tr.uploader_id, a.id, a.project_id
  HAVING COUNT(*) >= 5
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = tr.uploader_id AND ua.achievement_id = a.id
  );

  -- Playlist Builder (playlists públicas >=3)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT p.creator_id, a.id, a.project_id, now(), false
  FROM playlists p
  JOIN achievements a ON a.name = 'Playlist Builder' AND a.project_id = v_crfm
  WHERE p.is_public = true
  GROUP BY p.creator_id, a.id, a.project_id
  HAVING COUNT(*) >= 3
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = p.creator_id AND ua.achievement_id = a.id
  );

  -- Page Views 1K (page_views por creator_id)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pv.creator_id, a.id, a.project_id, now(), false
  FROM page_views pv
  JOIN achievements a ON a.name = 'Page Views 1K' AND a.project_id = v_crfm
  GROUP BY pv.creator_id, a.id, a.project_id
  HAVING COUNT(*) >= 1000
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pv.creator_id AND ua.achievement_id = a.id
  );

  -- Cross Coin Keeper (wallet_balance >= 100)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pr.id AS user_id, a.id, a.project_id, now(), false
  FROM profiles pr
  JOIN achievements a ON a.name = 'Cross Coin Keeper' AND a.project_id = v_crfm
  WHERE pr.wallet_balance >= 100
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pr.id AND ua.achievement_id = a.id
  );

  -- Bonded in Faith (facción bonds >=100)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pfb.user_id, a.id, a.project_id, now(), false
  FROM player_faction_bonds pfb
  JOIN achievements a ON a.name = 'Bonded in Faith' AND a.project_id = v_crfm
  GROUP BY pfb.user_id, a.id, a.project_id
  HAVING SUM(COALESCE(pfb.bond_amount,0)) >= 100
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pfb.user_id AND ua.achievement_id = a.id
  );

  -- Faithful Explorer (views >=100 usando page_views)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pv.creator_id, a.id, a.project_id, now(), false
  FROM page_views pv
  JOIN achievements a ON a.name = 'Faithful Explorer' AND a.project_id = v_crfm
  GROUP BY pv.creator_id, a.id, a.project_id
  HAVING COUNT(*) >= 100
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pv.creator_id AND ua.achievement_id = a.id
  );

  -- DU TCG PR — wins y colección
  -- First Duel Win: wins >=1 (player_trainer_stats)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pts.user_id, a.id, a.project_id, now(), false
  FROM player_trainer_stats pts
  JOIN achievements a ON a.name = 'First Duel Win' AND a.project_id = v_du
  WHERE pts.wins >= 1
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pts.user_id AND ua.achievement_id = a.id
  );

  -- Win 10
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pts.user_id, a.id, a.project_id, now(), false
  FROM player_trainer_stats pts
  JOIN achievements a ON a.name = 'Win 10' AND a.project_id = v_du
  WHERE pts.wins >= 10
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pts.user_id AND ua.achievement_id = a.id
  );

  -- Win Streak 5 (aprox: wins >=5)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pts.user_id, a.id, a.project_id, now(), false
  FROM player_trainer_stats pts
  JOIN achievements a ON a.name = 'Win Streak 5' AND a.project_id = v_du
  WHERE pts.wins >= 5
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pts.user_id AND ua.achievement_id = a.id
  );

  -- Collection 25 / 100 (player_creatures distintos)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pc.user_id, a.id, a.project_id, now(), false
  FROM (
    SELECT user_id, COUNT(DISTINCT creature_id) AS c
    FROM player_creatures
    GROUP BY user_id
  ) pc
  JOIN achievements a ON a.name = 'Collection 25' AND a.project_id = v_du
  WHERE pc.c >= 25
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pc.user_id AND ua.achievement_id = a.id
  );

  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pc.user_id, a.id, a.project_id, now(), false
  FROM (
    SELECT user_id, COUNT(DISTINCT creature_id) AS c
    FROM player_creatures
    GROUP BY user_id
  ) pc
  JOIN achievements a ON a.name = 'Collection 100' AND a.project_id = v_du
  WHERE pc.c >= 100
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pc.user_id AND ua.achievement_id = a.id
  );

  -- Creature Collector (>=10 únicos)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pc.user_id, a.id, a.project_id, now(), false
  FROM (
    SELECT user_id, COUNT(DISTINCT creature_id) AS c
    FROM player_creatures
    GROUP BY user_id
  ) pc
  JOIN achievements a ON a.name = 'Creature Collector' AND a.project_id = v_du
  WHERE pc.c >= 10
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pc.user_id AND ua.achievement_id = a.id
  );

  -- Trainer Rising (wins >=3)
  INSERT INTO user_achievements (user_id, achievement_id, project_id, unlocked_at, rewards_claimed)
  SELECT pts.user_id, a.id, a.project_id, now(), false
  FROM player_trainer_stats pts
  JOIN achievements a ON a.name = 'Trainer Rising' AND a.project_id = v_du
  WHERE pts.wins >= 3
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua WHERE ua.user_id = pts.user_id AND ua.achievement_id = a.id
  );
END$$;
