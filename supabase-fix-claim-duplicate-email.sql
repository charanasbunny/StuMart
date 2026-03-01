-- Run this in Supabase SQL Editor to fix "duplicate key value violates unique constraint students_email_key"
-- when completing registration with an email that is already registered.
-- Updates claim_approved_registration to return a clear message instead of a DB error.

CREATE OR REPLACE FUNCTION claim_approved_registration(p_token VARCHAR(255), p_auth_user_id UUID)
RETURNS TABLE (pin_number VARCHAR(255), name VARCHAR(255), email VARCHAR(255))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request registration_requests%ROWTYPE;
  v_pin_record student_pins%ROWTYPE;
BEGIN
  IF p_auth_user_id IS NULL OR p_auth_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_request
  FROM registration_requests
  WHERE completion_token = p_token AND status = 'approved'
    AND (token_expires_at IS NULL OR token_expires_at > NOW());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired link. Ask admin for a new approval link.';
  END IF;

  SELECT * INTO v_pin_record FROM student_pins WHERE student_pins.pin_number = v_request.pin_number;
  IF NOT FOUND OR v_pin_record.status != 'pending_approval' THEN
    RAISE EXCEPTION 'PIN no longer available for this request';
  END IF;

  -- If this email is already registered, give a clear error (do not duplicate)
  IF EXISTS (SELECT 1 FROM students s WHERE s.email = v_request.email) THEN
    RAISE EXCEPTION 'This email is already registered. Please log in.';
  END IF;

  INSERT INTO students (pin_number, name, email, joining_year, branch, year, section, auth_user_id, status, email_confirmed)
  VALUES (
    v_request.pin_number, v_request.name, v_request.email,
    v_request.joining_year, v_request.branch, v_request.year, v_request.section,
    p_auth_user_id, 'pending', FALSE
  );

  UPDATE student_pins
  SET status = 'registered', registered_user_id = p_auth_user_id, updated_at = NOW()
  WHERE student_pins.pin_number = v_request.pin_number;

  UPDATE registration_requests
  SET status = 'completed', updated_at = NOW()
  WHERE registration_requests.id = v_request.id;

  RETURN QUERY SELECT v_request.pin_number, v_request.name, v_request.email;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_approved_registration TO authenticated;
