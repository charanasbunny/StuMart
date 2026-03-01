-- ============================================
-- Migration: Admin-verified registration flow
-- Run this after your existing schema.
-- Flow: User submits details + PIN → Admin approves/rejects → User completes signup with password
-- ============================================

-- 1. Allow student_pins to have status 'pending_approval' (request submitted, awaiting admin)
ALTER TABLE student_pins DROP CONSTRAINT IF EXISTS student_pins_status_check;
ALTER TABLE student_pins ADD CONSTRAINT student_pins_status_check
  CHECK (status IN ('available', 'pending_approval', 'registered', 'blocked'));

-- 2. Table: registration requests (before any auth account exists)
CREATE TABLE IF NOT EXISTS registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_number VARCHAR(255) NOT NULL REFERENCES student_pins(pin_number) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  joining_year INTEGER NOT NULL,
  branch VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL,
  section VARCHAR(10) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES admin_users(auth_user_id),
  rejection_reason TEXT,
  completion_token VARCHAR(255) UNIQUE,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_registration_requests_status ON registration_requests(status);
CREATE INDEX idx_registration_requests_pin_number ON registration_requests(pin_number);
CREATE INDEX idx_registration_requests_email ON registration_requests(email);
CREATE UNIQUE INDEX idx_registration_requests_pin_pending_approved
  ON registration_requests(pin_number) WHERE status IN ('pending', 'approved');

ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a request (anon); only admins can list/approve/reject
CREATE POLICY "Anyone can insert registration request"
  ON registration_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all registration requests"
  ON registration_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins can update registration requests"
  ON registration_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid()));

-- (Complete-signup page uses get_approved_request_by_token RPC, not direct table read)

-- 3. Submit registration request (no auth required)
CREATE OR REPLACE FUNCTION submit_registration_request(
  p_pin_number VARCHAR(255),
  p_name VARCHAR(255),
  p_email VARCHAR(255),
  p_joining_year INTEGER,
  p_branch VARCHAR(50),
  p_year INTEGER,
  p_section VARCHAR(10)
)
RETURNS TABLE (request_id UUID, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin_record student_pins%ROWTYPE;
  v_request_id UUID;
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF trim(p_pin_number) IS NULL OR trim(p_name) IS NULL OR v_email IS NULL OR
     p_joining_year IS NULL OR trim(p_branch) IS NULL OR p_year IS NULL OR trim(p_section) IS NULL THEN
    RAISE EXCEPTION 'All fields are required';
  END IF;

  SELECT * INTO v_pin_record FROM student_pins WHERE student_pins.pin_number = trim(p_pin_number);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN not found';
  END IF;
  IF v_pin_record.status != 'available' THEN
    RAISE EXCEPTION 'This PIN is not available (status: %)', v_pin_record.status;
  END IF;

  -- One pending/approved request per PIN is enforced by unique index
  INSERT INTO registration_requests (
    pin_number, name, email, joining_year, branch, year, section, status
  ) VALUES (
    trim(p_pin_number), trim(p_name), v_email, p_joining_year, trim(p_branch), p_year, trim(p_section), 'pending'
  )
  RETURNING id INTO v_request_id;

  UPDATE student_pins
  SET status = 'pending_approval', updated_at = NOW()
  WHERE student_pins.pin_number = trim(p_pin_number);

  RETURN QUERY SELECT v_request_id, 'Registration request submitted. Wait for admin approval.'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_registration_request TO anon;
GRANT EXECUTE ON FUNCTION submit_registration_request TO authenticated;

-- 4. Admin: list pending requests
CREATE OR REPLACE FUNCTION get_registration_requests(p_status VARCHAR(50) DEFAULT 'pending')
RETURNS SETOF registration_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;
  RETURN QUERY
  SELECT * FROM registration_requests
  WHERE registration_requests.status = p_status
  ORDER BY requested_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_registration_requests TO authenticated;

-- 5. Admin: approve request (generates completion token and URL)
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

-- 6. Admin: reject request (releases PIN back to available)
CREATE OR REPLACE FUNCTION admin_reject_registration_request(p_request_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin VARCHAR(255);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT pin_number INTO v_pin FROM registration_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;

  UPDATE registration_requests
  SET status = 'rejected', reviewed_at = NOW(), reviewed_by = auth.uid(), rejection_reason = p_reason, updated_at = NOW()
  WHERE id = p_request_id;

  UPDATE student_pins SET status = 'available', updated_at = NOW() WHERE student_pins.pin_number = v_pin;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reject_registration_request TO authenticated;

-- 7. Get approved request by token (for complete-signup page, anon)
CREATE OR REPLACE FUNCTION get_approved_request_by_token(p_token VARCHAR(255))
RETURNS TABLE (
  id UUID, pin_number VARCHAR(255), name VARCHAR(255), email VARCHAR(255),
  joining_year INTEGER, branch VARCHAR(50), year INTEGER, section VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.pin_number, r.name, r.email, r.joining_year, r.branch, r.year, r.section
  FROM registration_requests r
  WHERE r.completion_token = p_token
    AND r.status = 'approved'
    AND (r.token_expires_at IS NULL OR r.token_expires_at > NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION get_approved_request_by_token TO anon;
GRANT EXECUTE ON FUNCTION get_approved_request_by_token TO authenticated;

-- 8. Claim approved registration: create student record and link PIN (called after user signs up with password)
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
