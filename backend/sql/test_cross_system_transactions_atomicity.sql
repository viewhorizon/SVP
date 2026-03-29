-- Manual regression test for points conversion atomicity.
-- Run inside a transaction-safe environment against a local dev DB.

BEGIN;

-- Replace with a real user id from your seed.
\set test_user_id '11111111-1111-1111-1111-111111111111'

-- Snapshot before.
SELECT user_id, available_points, lifetime_points
FROM points_wallet
WHERE user_id = :'test_user_id';

-- Attempt a conversion-like sequence with forced failure in saga write.
DO $$
DECLARE
  req_id uuid := gen_random_uuid();
BEGIN
  -- Debit from wallet through ledger mutation shape.
  INSERT INTO points_ledger (
    request_id, event_id, user_id, direction, operation_type,
    amount, balance_before, balance_after, metadata
  )
  SELECT
    req_id,
    gen_random_uuid(),
    w.user_id,
    'DEBIT',
    'POINTS_CONVERTED_TO_ITEM',
    5,
    w.available_points,
    w.available_points - 5,
    '{"test":"atomicity"}'::jsonb
  FROM points_wallet w
  WHERE w.user_id = :'test_user_id'
  FOR UPDATE;

  UPDATE points_wallet
    SET available_points = available_points - 5
  WHERE user_id = :'test_user_id';

  -- Force a failure similar to downstream saga error.
  RAISE EXCEPTION 'forced failure after debit before cross_system_transactions insert';
END $$;

-- Should not reach this statement when error is raised.
COMMIT;

-- Verify after rollback (run manually after the error).
-- SELECT user_id, available_points, lifetime_points FROM points_wallet WHERE user_id = :'test_user_id';
