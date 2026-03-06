-- =========================================================
-- Add student ID card upload to registration requests
-- Supports image or PDF upload during student registration.
-- =========================================================

-- 1) Add columns on registration_requests
ALTER TABLE registration_requests
  ADD COLUMN IF NOT EXISTS student_id_card_url TEXT,
  ADD COLUMN IF NOT EXISTS student_id_card_path TEXT,
  ADD COLUMN IF NOT EXISTS student_id_card_mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS student_id_card_file_name TEXT;

-- 2) Create/ensure public storage bucket for student ID cards
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-id-cards', 'student-id-cards', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 3) Storage policies
DROP POLICY IF EXISTS "Public can upload student id cards" ON storage.objects;
DROP POLICY IF EXISTS "Public can read student id cards" ON storage.objects;

CREATE POLICY "Public can upload student id cards"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'student-id-cards'
  AND name LIKE 'requests/%'
);

CREATE POLICY "Public can read student id cards"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'student-id-cards');

-- 4) Extend submit_registration_request to save uploaded file details
-- Drop old overload (without ID-card params) to avoid RPC ambiguity
DROP FUNCTION IF EXISTS submit_registration_request(
  VARCHAR,
  VARCHAR,
  VARCHAR,
  INTEGER,
  VARCHAR,
  INTEGER,
  VARCHAR
);

CREATE OR REPLACE FUNCTION submit_registration_request(
  p_pin_number VARCHAR(255),
  p_name VARCHAR(255),
  p_email VARCHAR(255),
  p_joining_year INTEGER,
  p_branch VARCHAR(50),
  p_year INTEGER,
  p_section VARCHAR(10),
  p_student_id_card_url TEXT DEFAULT NULL,
  p_student_id_card_path TEXT DEFAULT NULL,
  p_student_id_card_mime_type VARCHAR(100) DEFAULT NULL,
  p_student_id_card_file_name TEXT DEFAULT NULL
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

  IF p_student_id_card_url IS NULL OR length(trim(p_student_id_card_url)) = 0 THEN
    RAISE EXCEPTION 'Student ID card upload is required';
  END IF;

  SELECT * INTO v_pin_record FROM student_pins WHERE student_pins.pin_number = trim(p_pin_number);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN not found';
  END IF;
  IF v_pin_record.status != 'available' THEN
    RAISE EXCEPTION 'This PIN is not available (status: %)', v_pin_record.status;
  END IF;

  INSERT INTO registration_requests (
    pin_number, name, email, joining_year, branch, year, section, status,
    student_id_card_url, student_id_card_path, student_id_card_mime_type, student_id_card_file_name
  ) VALUES (
    trim(p_pin_number), trim(p_name), v_email, p_joining_year, trim(p_branch), p_year, trim(p_section), 'pending',
    trim(p_student_id_card_url), p_student_id_card_path, p_student_id_card_mime_type, p_student_id_card_file_name
  )
  RETURNING id INTO v_request_id;

  UPDATE student_pins
  SET status = 'pending_approval', updated_at = NOW()
  WHERE student_pins.pin_number = trim(p_pin_number);

  RETURN QUERY SELECT v_request_id, 'Registration request submitted. Wait for admin approval.'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_registration_request(
  VARCHAR,
  VARCHAR,
  VARCHAR,
  INTEGER,
  VARCHAR,
  INTEGER,
  VARCHAR,
  TEXT,
  TEXT,
  VARCHAR,
  TEXT
) TO anon;

GRANT EXECUTE ON FUNCTION submit_registration_request(
  VARCHAR,
  VARCHAR,
  VARCHAR,
  INTEGER,
  VARCHAR,
  INTEGER,
  VARCHAR,
  TEXT,
  TEXT,
  VARCHAR,
  TEXT
) TO authenticated;
