-- ═══════════════════════════════════════════════════════════
--  RX VAULT — Auth & Role-Based Access Control Schema
--  Run this AFTER rxvault_complete_schema.sql
--  Supabase SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════

-- ─── EXTENSIONS ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════
--  TABLE: users
--  Global user accounts — exist outside clinic scope
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'staff'
                            CHECK (role IN ('superadmin','clinic_admin','staff')),
  is_active     BOOLEAN     DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
--  TABLE: clinic_staff
--  Links users to clinics with specific roles
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS clinic_staff (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   TEXT        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('admin','doctor','receptionist','pharmacist','viewer')),
  is_active   BOOLEAN     DEFAULT TRUE,
  assigned_by UUID        REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, user_id)
);

-- ═══════════════════════════════════════════════════════════
--  TABLE: user_sessions
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic_id    TEXT        REFERENCES clinics(id) ON DELETE SET NULL,
  token_hash   TEXT        NOT NULL,
  ip_address   TEXT,
  user_agent   TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
--  TABLE: audit_log
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id)    ON DELETE SET NULL,
  clinic_id   TEXT        REFERENCES clinics(id)  ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  table_name  TEXT,
  record_id   TEXT,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
--  INDEXES
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role          ON users(role);
CREATE INDEX IF NOT EXISTS idx_clinic_staff_clinic ON clinic_staff(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_staff_user   ON clinic_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user       ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires    ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_user          ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_clinic        ON audit_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_log(created_at DESC);

-- ═══════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_staff   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_users"        ON users;
DROP POLICY IF EXISTS "allow_all_clinic_staff" ON clinic_staff;
DROP POLICY IF EXISTS "allow_all_sessions"     ON user_sessions;
DROP POLICY IF EXISTS "allow_all_audit"        ON audit_log;

CREATE POLICY "allow_all_users"        ON users         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_clinic_staff" ON clinic_staff  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sessions"     ON user_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_audit"        ON audit_log     FOR ALL TO anon USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
--  HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════

-- Hash a password using bcrypt
CREATE OR REPLACE FUNCTION hash_password(plain_password TEXT)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT crypt(plain_password, gen_salt('bf', 10));
$$;

-- Verify password against its hash
CREATE OR REPLACE FUNCTION verify_password(plain_password TEXT, hashed TEXT)
RETURNS BOOLEAN LANGUAGE sql AS $$
  SELECT (crypt(plain_password, hashed) = hashed);
$$;

-- Login — returns user if credentials valid, updates last_login
CREATE OR REPLACE FUNCTION login_user(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  id        UUID,
  name      TEXT,
  email     TEXT,
  role      TEXT,
  is_active BOOLEAN
) LANGUAGE plpgsql AS $$
BEGIN
  -- Update last_login first
  UPDATE users
  SET last_login = NOW()
  WHERE LOWER(TRIM(users.email)) = LOWER(TRIM(p_email))
    AND verify_password(p_password, users.password_hash)
    AND users.is_active = TRUE;

  -- Return matching user
  RETURN QUERY
  SELECT u.id, u.name, u.email, u.role, u.is_active
  FROM users u
  WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(p_email))
    AND verify_password(p_password, u.password_hash)
    AND u.is_active = TRUE;
END;
$$;

-- Get clinics accessible to a user
CREATE OR REPLACE FUNCTION get_user_clinics(p_user_id UUID)
RETURNS TABLE (
  clinic_id   TEXT,
  clinic_name TEXT,
  clinic_logo TEXT,
  clinic_type TEXT,
  staff_role  TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users WHERE id = p_user_id AND role = 'superadmin'
  ) THEN
    -- SuperAdmin sees all clinics
    RETURN QUERY
    SELECT c.id, c.name, c.logo, c.type, 'superadmin'::TEXT
    FROM clinics c
    ORDER BY c.created_at;
  ELSE
    -- Others see only their assigned clinics
    RETURN QUERY
    SELECT c.id, c.name, c.logo, c.type, cs.role
    FROM clinic_staff cs
    JOIN clinics c ON cs.clinic_id = c.id
    WHERE cs.user_id   = p_user_id
      AND cs.is_active = TRUE
    ORDER BY c.name;
  END IF;
END;
$$;

-- Get all staff for a clinic
CREATE OR REPLACE FUNCTION get_clinic_staff(p_clinic_id TEXT)
RETURNS TABLE (
  user_id    UUID,
  name       TEXT,
  email      TEXT,
  role       TEXT,
  is_active  BOOLEAN,
  last_login TIMESTAMPTZ
) LANGUAGE sql AS $$
  SELECT u.id, u.name, u.email, cs.role, cs.is_active, u.last_login
  FROM clinic_staff cs
  JOIN users u ON cs.user_id = u.id
  WHERE cs.clinic_id = p_clinic_id
  ORDER BY cs.role, u.name;
$$;

-- Change user password
CREATE OR REPLACE FUNCTION change_password(
  p_user_id    UUID,
  p_old_pass   TEXT,
  p_new_pass   TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT password_hash INTO v_hash FROM users WHERE id = p_user_id;
  IF v_hash IS NULL THEN RETURN FALSE; END IF;
  IF NOT verify_password(p_old_pass, v_hash) THEN RETURN FALSE; END IF;
  UPDATE users
  SET password_hash = hash_password(p_new_pass),
      updated_at    = NOW()
  WHERE id = p_user_id;
  RETURN TRUE;
END;
$$;

-- Reset password by admin (no old password needed)
CREATE OR REPLACE FUNCTION admin_reset_password(
  p_user_id  UUID,
  p_new_pass TEXT
)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE users
  SET password_hash = hash_password(p_new_pass),
      updated_at    = NOW()
  WHERE id = p_user_id;
$$;

-- ═══════════════════════════════════════════════════════════
--  SEED DATA — SUPERADMIN
-- ═══════════════════════════════════════════════════════════
--
--  Name     : RxVaultAdmin
--  Email    : admin@rxvault.in
--  Password : RxVault@2025
--  Role     : superadmin
--
--  ⚠️  IMPORTANT: Change the password after first login!
--  Run this to change:
--    SELECT admin_reset_password(
--      (SELECT id FROM users WHERE email = 'admin@rxvault.in'),
--      'YourNewPassword'
--    );
-- ═══════════════════════════════════════════════════════════
INSERT INTO users (name, email, password_hash, role, is_active)
VALUES (
  'RxVaultAdmin',
  'admin@rxvault.in',
  hash_password('RxVault@2025'),
  'superadmin',
  TRUE
)
ON CONFLICT (email) DO UPDATE
  SET name      = EXCLUDED.name,
      role      = EXCLUDED.role,
      is_active = EXCLUDED.is_active;

-- ═══════════════════════════════════════════════════════════
--  PERMISSIONS MATRIX (reference comment)
-- ═══════════════════════════════════════════════════════════
--
--  Action               | superadmin | admin | doctor | receptionist | pharmacist | viewer
--  ---------------------|------------|-------|--------|--------------|------------|-------
--  Create clinic        |     ✅     |  ❌   |   ❌   |      ❌      |     ❌     |  ❌
--  Delete clinic        |     ✅     |  ❌   |   ❌   |      ❌      |     ❌     |  ❌
--  Manage staff         |     ✅     |  ✅   |   ❌   |      ❌      |     ❌     |  ❌
--  Add doctor           |     ✅     |  ✅   |   ❌   |      ❌      |     ❌     |  ❌
--  Add prescription     |     ✅     |  ✅   |   ✅   |      ❌      |     ❌     |  ❌
--  Edit prescription    |     ✅     |  ✅   |   ✅   |      ❌      |     ❌     |  ❌
--  Delete prescription  |     ✅     |  ✅   |   ❌   |      ❌      |     ❌     |  ❌
--  Register patient     |     ✅     |  ✅   |   ✅   |      ✅      |     ❌     |  ❌
--  View prescriptions   |     ✅     |  ✅   |   ✅   |      ✅      |     ✅     |  ✅
--  View patients        |     ✅     |  ✅   |   ✅   |      ✅      |     ✅     |  ✅
--  Export data          |     ✅     |  ✅   |   ❌   |      ❌      |     ❌     |  ❌
--  View audit log       |     ✅     |  ✅   |   ❌   |      ❌      |     ❌     |  ❌

-- ═══════════════════════════════════════════════════════════
--  VERIFY — confirm superadmin was created
-- ═══════════════════════════════════════════════════════════
SELECT
  id,
  name,
  email,
  role,
  is_active,
  created_at
FROM users
WHERE role = 'superadmin';

-- Test login function works
SELECT * FROM login_user('admin@rxvault.in', 'RxVault@2025');

-- ═══════════════════════════════════════════════════════════
--  FUNCTION: create_staff_user
--  Creates a user account and returns their UUID
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_staff_user(
  p_name     TEXT,
  p_email    TEXT,
  p_password TEXT,
  p_role     TEXT DEFAULT 'staff'
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO users (name, email, password_hash, role, is_active)
  VALUES (
    TRIM(p_name),
    LOWER(TRIM(p_email)),
    hash_password(p_password),
    p_role,
    TRUE
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
-- ═══════════════════════════════════════════════════════════
--  RX VAULT — Auth Add-ons
--  Run this AFTER rxvault_auth_schema.sql
--  Adds: create_staff_user function
-- ═══════════════════════════════════════════════════════════

-- Create a new staff user (used when adding staff from the UI)
CREATE OR REPLACE FUNCTION create_staff_user(
  p_name     TEXT,
  p_email    TEXT,
  p_password TEXT,
  p_role     TEXT DEFAULT 'staff'
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if email already exists
  SELECT id INTO v_user_id
  FROM users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email));

  IF v_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Email already exists: %', p_email;
  END IF;

  -- Insert new user
  INSERT INTO users (name, email, password_hash, role, is_active)
  VALUES (
    TRIM(p_name),
    LOWER(TRIM(p_email)),
    hash_password(p_password),
    p_role,
    TRUE
  )
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

-- ─── Verify setup ─────────────────────────────────────────
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type   = 'FUNCTION'
ORDER BY routine_name;

-- ═══════════════════════════════════════════════════════════
--  RX VAULT — Fee Validity Column
--  Run in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Add last_fee_date column to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS last_fee_date TIMESTAMPTZ DEFAULT NULL;

-- Backfill: set last_fee_date = registered_at for existing patients
-- (their registration payment counts as the first fee)
UPDATE patients
SET last_fee_date = registered_at
WHERE last_fee_date IS NULL AND registered_at IS NOT NULL;

SELECT 'Done. Patients updated: ' || COUNT(*) FROM patients WHERE last_fee_date IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
--  RX VAULT — Pharmacy Module
--  Run in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Add dispense_date column to prescriptions
ALTER TABLE prescriptions
ADD COLUMN IF NOT EXISTS dispense_date TIMESTAMPTZ DEFAULT NULL;

-- Verify
SELECT COUNT(*) as total_prescriptions,
       COUNT(dispense_date) as dispensed
FROM prescriptions;