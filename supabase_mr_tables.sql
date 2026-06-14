-- =============================================
-- MR (Medical Representative) tables for RxVault
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. mr_users: MR account registration
CREATE TABLE mr_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    company_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE mr_users ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (signup) and public reads (login)
CREATE POLICY "Allow anonymous insert" ON mr_users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous select" ON mr_users FOR SELECT TO anon USING (true);

-- 2. mr_clients: MR's client list (pharmacies, doctors, clinics)
CREATE TABLE mr_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mr_id UUID NOT NULL REFERENCES mr_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('pharmacy', 'doctor', 'clinic')),
    phone TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mr_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all" ON mr_clients FOR ALL TO anon USING (true) WITH CHECK (true);

-- 3. mr_visit_logs: MR visit records with sampled medicines
CREATE TABLE mr_visit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id TEXT NOT NULL,
    mr_id UUID NOT NULL REFERENCES mr_users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES mr_clients(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    medicines JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mr_visit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all" ON mr_visit_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. RPC function: generate MR visit ID (e.g. MVIS00001)
CREATE OR REPLACE FUNCTION gen_mr_visit_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(visit_id FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM mr_visit_logs
    WHERE visit_id LIKE 'MVIS%';
    
    RETURN 'MVIS' || LPAD(next_num::TEXT, 5, '0');
END;
$$;
