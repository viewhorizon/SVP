-- Seed Data para Demo/Testing del SPV
-- Ejecutar DESPUÉS de 20260318_spv_points_core.sql y 20260318_votes_table.sql

-- ============================================
-- USERS Demo (para Firebase auth)
-- ============================================
-- Nota: Estos usuarios deben existir también en Firebase Auth
-- ID de 36 caracteres para compatibilidad

INSERT INTO points_wallet (user_id, available_points, lifetime_points, last_ledger_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 120, 1200, NOW()),
  ('22222222-2222-2222-2222-222222222222', 75, 640, NOW()),
  ('33333333-3333-3333-3333-333333333333', 50, 300, NOW()),
  ('44444444-4444-4444-4444-444444444444', 200, 2500, NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- VOTOS Demo
-- ============================================
-- Votos de usuario 1 para diferentes actividades
INSERT INTO votes (vote_id, user_id, activity_id, request_id, event_id, points_generated, activity_scope, metadata, created_at)
VALUES
  ('v001', '11111111-1111-1111-1111-111111111111',
   'act-global-001', 'req001', 'evt001', 2, 'global',
   '{"activity_name": "Peluquerías Global"}',
   NOW() - INTERVAL '2 hours'),
  ('v002', '11111111-1111-1111-1111-111111111111',
   'act-local-001', 'req002', 'evt002', 3, 'local',
   '{"activity_name": "EligeStyle"}',
   NOW() - INTERVAL '5 hours'),
  ('v003', '11111111-1111-1111-1111-111111111111',
   'act-global-001', 'req003', 'evt003', 2, 'global',
   '{"activity_name": "Peluquerías Global"}',
   NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- Votos de usuario 2
INSERT INTO votes (vote_id, user_id, activity_id, request_id, event_id, points_generated, activity_scope, metadata, created_at)
VALUES
  ('v004', '22222222-2222-2222-2222-222222222222',
   'act-digital-001', 'req004', 'evt004', 4, 'digital',
   '{"activity_name": "Taller Online"}',
   NOW() - INTERVAL '3 hours'),
  ('v005', '22222222-2222-2222-2222-222222222222',
   'act-local-001', 'req005', 'evt005', 3, 'local',
   '{"activity_name": "EligeStyle"}',
   NOW() - INTERVAL '6 hours')
ON CONFLICT DO NOTHING;

-- ============================================
-- LEDGER ENTRIES (para correspondencia con puntos)
-- ============================================
INSERT INTO points_ledger (
  ledger_id, request_id, event_id, user_id, direction, operation_type,
  amount, balance_before, balance_after, activity_id, metadata, created_at
)
VALUES
  -- Usuario 1 - Ledger entries
  ('l001', 'req001', 'evt001', '11111111-1111-1111-1111-111111111111',
   'CREDIT', 'POINTS_GRANTED', 2, 118, 120, 'act-global-001',
   '{"domain_event": "VOTE_CAST", "points_event": "POINTS_GRANTED", "activityScope": "global"}',
   NOW() - INTERVAL '2 hours'),
  ('l002', 'req002', 'evt002', '11111111-1111-1111-1111-111111111111',
   'CREDIT', 'POINTS_GRANTED', 3, 115, 118, 'act-local-001',
   '{"domain_event": "VOTE_CAST", "points_event": "POINTS_GRANTED", "activityScope": "local"}',
   NOW() - INTERVAL '5 hours'),
  ('l003', 'req003', 'evt003', '11111111-1111-1111-1111-111111111111',
   'CREDIT', 'POINTS_GRANTED', 2, 110, 115, 'act-global-001',
   '{"domain_event": "VOTE_CAST", "points_event": "POINTS_GRANTED", "activityScope": "global"}',
   NOW() - INTERVAL '1 day'),
  ('l004', 'req011', 'evt011', '11111111-1111-1111-1111-111111111111',
   'CREDIT', 'POINTS_TRANSFERRED_IN', 5, 105, 110, NULL,
   '{"domain_event": "POINTS_TRANSFERRED_IN", "from_user": "22222222-2222-2222-2222-222222222222"}',
   NOW() - INTERVAL '12 hours'),
  ('l005', 'req021', 'evt021', '11111111-1111-1111-1111-111111111111',
   'DEBIT', 'POINTS_TRANSFERRED_OUT', 2, 103, 105, NULL,
   '{"domain_event": "POINTS_TRANSFERRED_OUT", "to_user": "33333333-3333-3333-3333-333333333333"}',
   NOW() - INTERVAL '8 hours'),

  -- Usuario 2 - Ledger entries
  ('l006', 'req004', 'evt004', '22222222-2222-2222-2222-222222222222',
   'CREDIT', 'POINTS_GRANTED', 4, 70, 74, 'act-digital-001',
   '{"domain_event": "VOTE_CAST", "points_event": "POINTS_GRANTED", "activityScope": "digital"}',
   NOW() - INTERVAL '3 hours'),
  ('l007', 'req005', 'evt005', '22222222-2222-2222-2222-222222222222',
   'CREDIT', 'POINTS_GRANTED', 3, 67, 70, 'act-local-001',
   '{"domain_event": "VOTE_CAST", "points_event": "POINTS_GRANTED", "activityScope": "local"}',
   NOW() - INTERVAL '6 hours'),
  ('l008', 'req021', 'evt021', '22222222-2222-2222-2222-222222222222',
   'CREDIT', 'POINTS_TRANSFERRED_IN', 2, 65, 67, NULL,
   '{"domain_event": "POINTS_TRANSFERRED_IN", "from_user": "11111111-1111-1111-1111-111111111111"}',
   NOW() - INTERVAL '8 hours'),
  ('l009', 'req011', 'evt011', '22222222-2222-2222-2222-222222222222',
   'DEBIT', 'POINTS_TRANSFERRED_OUT', 5, 60, 65, NULL,
   '{"domain_event": "POINTS_TRANSFERRED_OUT", "to_user": "11111111-1111-1111-1111-111111111111"}',
   NOW() - INTERVAL '12 hours'),

  -- Usuario 3 - Ledger entries
  ('l010', 'req021', 'evt021', '33333333-3333-3333-3333-333333333333',
   'CREDIT', 'POINTS_TRANSFERRED_IN', 2, 48, 50, NULL,
   '{"domain_event": "POINTS_TRANSFERRED_IN", "from_user": "11111111-1111-1111-1111-111111111111"}',
   NOW() - INTERVAL '8 hours'),

  -- Usuario 4 - Ledger entries (sin votos, solo transfers)
  ('l011', 'req031', 'evt031', '44444444-4444-4444-4444-444444444444',
   'CREDIT', 'POINTS_GRANTED', 10, 190, 200, NULL,
   '{"domain_event": "REWARD_GRANTED", "reason": "achievement_unlocked"}',
   NOW() - INTERVAL '1 day'),
  ('l012', 'req041', 'evt041', '44444444-4444-4444-4444-444444444444',
   'CREDIT', 'POINTS_TRANSFERRED_IN', 50, 140, 190, NULL,
   '{"domain_event": "POINTS_TRANSFERRED_IN", "from_user": "system"}',
   NOW() - INTERVAL '2 days')
ON CONFLICT (event_id) DO NOTHING;