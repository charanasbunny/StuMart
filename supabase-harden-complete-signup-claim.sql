-- ============================================
-- Harden complete-signup + claim flow
-- ============================================
-- What this migration enforces:
-- 1) claim_approved_registration is strict and idempotent
-- 2) claim requires valid token + non-expired approval + matching auth email
-- 3) student_pins/students direct write access is admin-only (or via SECURITY DEFINER RPCs)
-- 4) admin approval/rejection RPC execute permissions are explicitly restricted

-- --------------------------------------------
-- Lock down direct table policies (student_pins)
-- --------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert PINs" ON student_pins;
DROP POLICY IF EXISTS "Authenticated users can update PINs" ON student_pins;
DROP POLICY IF EXISTS "Authenticated users can delete PINs" ON student_pins;
DROP POLICY IF EXISTS "Admins can manage PINs" ON student_pins;

CREATE POLICY "Admins can insert PINs"
  ON student_pins
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update PINs"
  ON student_pins
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete PINs"
  ON student_pins
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

-- --------------------------------------------
-- Lock down direct table policies (students)
-- --------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can delete student records" ON students;

CREATE POLICY "Admins can delete student records"
  ON students
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

-- --------------------------------------------
-- Harden claim_approved_registration
-- --------------------------------------------
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

  -- If request context is authenticated, enforce caller/user alignment.
  IF auth.uid() IS NOT NULL AND p_auth_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Auth user must exist and own the approved email.
  SELECT u.email
  INTO v_auth_email
  FROM auth.users u
  WHERE u.id = p_auth_user_id;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  -- Token must exist, be approved, and not expired.
  SELECT *
  INTO v_request
  FROM registration_requests
  WHERE completion_token = trim(p_token)
    AND status = 'approved'
    AND (token_expires_at IS NULL OR token_expires_at > NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    -- Idempotent success for already-completed token.
    SELECT *
    INTO v_request
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

  -- If student already exists for this request PIN, treat as idempotent claim.
  SELECT *
  INTO v_existing_student
  FROM students s
  WHERE s.pin_number = v_request.pin_number
  LIMIT 1;

  IF FOUND THEN
    -- Existing row must be compatible with this auth user.
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

  -- Prevent cross-linking when auth user already has another student row.
  IF EXISTS (SELECT 1 FROM students s WHERE s.auth_user_id = p_auth_user_id) THEN
    RAISE EXCEPTION 'This account is already linked to another student profile.';
  END IF;

  -- Ensure PIN can be claimed for this request.
  SELECT *
  INTO v_pin_record
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
    pin_number,
    name,
    email,
    joining_year,
    branch,
    year,
    section,
    auth_user_id,
    status,
    email_confirmed
  )
  VALUES (
    v_request.pin_number,
    v_request.name,
    v_request.email,
    v_request.joining_year,
    v_request.branch,
    v_request.year,
    v_request.section,
    p_auth_user_id,
    'pending',
    FALSE
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

-- --------------------------------------------
-- Ensure admin-only registration decision RPC execution
-- --------------------------------------------
REVOKE ALL ON FUNCTION admin_approve_registration_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_approve_registration_request(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION admin_approve_registration_request(UUID) TO authenticated;

REVOKE ALL ON FUNCTION admin_reject_registration_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_reject_registration_request(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION admin_reject_registration_request(UUID, TEXT) TO authenticated;

