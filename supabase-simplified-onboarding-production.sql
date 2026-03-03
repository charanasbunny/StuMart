-- =========================================================
-- Simplified onboarding (production-ready)
-- =========================================================
-- Model:
-- - Admin approval email is the only email in onboarding
-- - Supabase email confirmation dependency removed from flow
-- - Token validity = 10 days
-- - claim_approved_registration runs immediately after password signup

-- ---------------------------------------------------------
-- Safety / consistency constraints
-- ---------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_auth_user_id_unique
  ON students(auth_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_pins_registered_user_id_unique
  ON student_pins(registered_user_id)
  WHERE registered_user_id IS NOT NULL;

-- ---------------------------------------------------------
-- RLS hardening for lifecycle tables
-- ---------------------------------------------------------
ALTER TABLE student_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert PINs" ON student_pins;
DROP POLICY IF EXISTS "Authenticated users can update PINs" ON student_pins;
DROP POLICY IF EXISTS "Authenticated users can delete PINs" ON student_pins;
DROP POLICY IF EXISTS "Admins can manage PINs" ON student_pins;
DROP POLICY IF EXISTS "Admins can insert PINs" ON student_pins;
DROP POLICY IF EXISTS "Admins can update PINs" ON student_pins;
DROP POLICY IF EXISTS "Admins can delete PINs" ON student_pins;

CREATE POLICY "Admins can insert PINs"
  ON student_pins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update PINs"
  ON student_pins FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete PINs"
  ON student_pins FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can delete student records" ON students;
DROP POLICY IF EXISTS "Admins can delete student records" ON students;

CREATE POLICY "Admins can delete student records"
  ON students FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------
-- Admin approval with 10-day token
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_approve_registration_request(p_request_id UUID)
RETURNS TABLE (completion_token VARCHAR(255), token_expires_at TIMESTAMP WITH TIME ZONE, completion_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request registration_requests%ROWTYPE;
  v_token VARCHAR(255);
  v_expires TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '10 days';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT * INTO v_request
  FROM registration_requests
  WHERE id = p_request_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;

  -- 48-char cryptographic random token (requires pgcrypto in Supabase).
  v_token := encode(gen_random_bytes(24), 'hex');

  UPDATE registration_requests
  SET status = 'approved',
      reviewed_at = NOW(),
      reviewed_by = auth.uid(),
      completion_token = v_token,
      token_expires_at = v_expires,
      updated_at = NOW()
  WHERE id = p_request_id;

  RETURN QUERY
  SELECT v_token, v_expires, ('/complete-signup?token=' || v_token)::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION admin_approve_registration_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_approve_registration_request(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION admin_approve_registration_request(UUID) TO authenticated;

REVOKE ALL ON FUNCTION admin_reject_registration_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_reject_registration_request(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION admin_reject_registration_request(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------
-- Strict + idempotent claim function (single active version)
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS claim_approved_registration(VARCHAR(255), UUID);

CREATE OR REPLACE FUNCTION claim_approved_registration(p_token VARCHAR(255), p_auth_user_id UUID)
RETURNS TABLE (pin_number VARCHAR(255), name VARCHAR(255), email VARCHAR(255))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request registration_requests%ROWTYPE;
  v_pin_record student_pins%ROWTYPE;
  v_existing_student students%ROWTYPE;
  v_auth_email TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Missing completion token';
  END IF;
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing auth user id';
  END IF;

  IF auth.uid() IS NOT NULL AND p_auth_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT u.email INTO v_auth_email
  FROM auth.users u
  WHERE u.id = p_auth_user_id;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  -- primary claim path: approved + not expired
  SELECT * INTO v_request
  FROM registration_requests
  WHERE completion_token = trim(p_token)
    AND status = 'approved'
    AND (token_expires_at IS NULL OR token_expires_at > NOW())
  LIMIT 1;

  -- idempotent path: already completed token
  IF NOT FOUND THEN
    SELECT * INTO v_request
    FROM registration_requests
    WHERE completion_token = trim(p_token)
      AND status = 'completed'
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or expired link. Ask admin for a new approval link.';
    END IF;
  END IF;

  IF lower(v_auth_email) != lower(v_request.email) THEN
    RAISE EXCEPTION 'This approval link does not belong to the signed-up email.';
  END IF;

  -- idempotent: same PIN already linked to same auth user
  SELECT * INTO v_existing_student
  FROM students s
  WHERE s.pin_number = v_request.pin_number
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_student.auth_user_id IS DISTINCT FROM p_auth_user_id THEN
      RAISE EXCEPTION 'This registration is already linked to another account.';
    END IF;

    UPDATE student_pins
    SET status = 'registered',
        registered_user_id = p_auth_user_id,
        updated_at = NOW()
    WHERE student_pins.pin_number = v_request.pin_number;

    UPDATE registration_requests
    SET status = 'completed',
        updated_at = NOW()
    WHERE registration_requests.id = v_request.id;

    RETURN QUERY
    SELECT v_existing_student.pin_number, v_existing_student.name, v_existing_student.email;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM students s WHERE s.auth_user_id = p_auth_user_id) THEN
    RAISE EXCEPTION 'This account is already linked to another student profile.';
  END IF;

  SELECT * INTO v_pin_record
  FROM student_pins
  WHERE student_pins.pin_number = v_request.pin_number
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN not found for this request';
  END IF;

  IF v_pin_record.status NOT IN ('pending_approval', 'registered') THEN
    RAISE EXCEPTION 'PIN no longer available for this request';
  END IF;

  IF v_pin_record.status = 'registered'
     AND v_pin_record.registered_user_id IS NOT NULL
     AND v_pin_record.registered_user_id != p_auth_user_id THEN
    RAISE EXCEPTION 'PIN already registered by another account';
  END IF;

  INSERT INTO students (
    pin_number, name, email, joining_year, branch, year, section,
    auth_user_id, status, email_confirmed, email_confirmed_at
  )
  VALUES (
    v_request.pin_number, v_request.name, v_request.email,
    v_request.joining_year, v_request.branch, v_request.year, v_request.section,
    p_auth_user_id, 'active', TRUE, NOW()
  );

  UPDATE student_pins
  SET status = 'registered',
      registered_user_id = p_auth_user_id,
      updated_at = NOW()
  WHERE student_pins.pin_number = v_request.pin_number;

  UPDATE registration_requests
  SET status = 'completed',
      updated_at = NOW()
  WHERE registration_requests.id = v_request.id;

  RETURN QUERY
  SELECT v_request.pin_number, v_request.name, v_request.email;
END;
$$;

REVOKE ALL ON FUNCTION claim_approved_registration(VARCHAR, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_approved_registration(VARCHAR, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION claim_approved_registration(VARCHAR, UUID) TO authenticated;

