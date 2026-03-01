-- Run this in Supabase SQL Editor to fix:
-- 1. "function gen_random_bytes(integer) does not exist"
-- 2. 404 on admin_approve_registration_request
-- (Requires registration_requests table and admin_users to already exist from the main migration)
-- Uses only built-in PostgreSQL (no pgcrypto extension).

CREATE OR REPLACE FUNCTION admin_approve_registration_request(p_request_id UUID)
RETURNS TABLE (completion_token VARCHAR(255), token_expires_at TIMESTAMP WITH TIME ZONE, completion_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request registration_requests%ROWTYPE;
  v_token VARCHAR(255);
  v_expires TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '7 days';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT * INTO v_request FROM registration_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;

  -- Token without pgcrypto: 48 hex chars from built-in md5 + random
  v_token := substring(md5(random()::text || clock_timestamp()::text || p_request_id::text) from 1 for 48);

  UPDATE registration_requests
  SET status = 'approved', reviewed_at = NOW(), reviewed_by = auth.uid(),
      completion_token = v_token, token_expires_at = v_expires, updated_at = NOW()
  WHERE id = p_request_id;

  RETURN QUERY SELECT
    v_token,
    v_expires,
    ('/complete-signup?token=' || v_token)::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_approve_registration_request TO authenticated;
