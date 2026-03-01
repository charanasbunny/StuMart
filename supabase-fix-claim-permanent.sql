-- Permanent fix for complete-signup claim flow
-- Goals:
-- 1) Prevent orphaned auth users from getting stuck without students row
-- 2) Make claim_approved_registration idempotent
-- 3) Enforce email ownership match between auth user and approved request

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
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Normal client calls are authenticated; keep this guard for defense-in-depth.
  IF auth.uid() IS NOT NULL AND p_auth_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT u.email INTO v_auth_email
  FROM auth.users u
  WHERE u.id = p_auth_user_id;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  SELECT * INTO v_request
  FROM registration_requests
  WHERE completion_token = p_token
    AND status IN ('approved', 'completed');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid link. Ask admin for a new approval link.';
  END IF;

  -- Critical ownership check: token and logged-in auth email must match.
  IF lower(v_auth_email) != lower(v_request.email) THEN
    RAISE EXCEPTION 'This approval link does not belong to the signed-in email.';
  END IF;

  -- If student row already exists for this email, make operation idempotent.
  SELECT * INTO v_existing_student
  FROM students s
  WHERE lower(s.email) = lower(v_request.email)
  LIMIT 1;

  IF FOUND THEN
    -- Ensure row is linked to current auth user (repair old mismatches).
    IF v_existing_student.auth_user_id IS DISTINCT FROM p_auth_user_id THEN
      UPDATE students
      SET auth_user_id = p_auth_user_id,
          updated_at = NOW()
      WHERE pin_number = v_existing_student.pin_number;
    END IF;

    UPDATE student_pins
    SET status = 'registered',
        registered_user_id = p_auth_user_id,
        updated_at = NOW()
    WHERE student_pins.pin_number = v_existing_student.pin_number;

    UPDATE registration_requests
    SET status = 'completed',
        updated_at = NOW()
    WHERE registration_requests.id = v_request.id;

    RETURN QUERY
    SELECT v_existing_student.pin_number, v_existing_student.name, v_existing_student.email;
    RETURN;
  END IF;

  -- For first-time claim, pin must still be reserved for this request.
  SELECT * INTO v_pin_record
  FROM student_pins
  WHERE student_pins.pin_number = v_request.pin_number;

  IF NOT FOUND OR v_pin_record.status NOT IN ('pending_approval', 'registered') THEN
    RAISE EXCEPTION 'PIN no longer available for this request';
  END IF;

  -- If pin is already registered to another user, block.
  IF v_pin_record.status = 'registered'
     AND v_pin_record.registered_user_id IS NOT NULL
     AND v_pin_record.registered_user_id != p_auth_user_id THEN
    RAISE EXCEPTION 'PIN already registered by another account';
  END IF;

  INSERT INTO students (
    pin_number, name, email, joining_year, branch, year, section,
    auth_user_id, status, email_confirmed
  )
  VALUES (
    v_request.pin_number, v_request.name, v_request.email,
    v_request.joining_year, v_request.branch, v_request.year, v_request.section,
    p_auth_user_id, 'pending', FALSE
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

GRANT EXECUTE ON FUNCTION claim_approved_registration TO authenticated;

