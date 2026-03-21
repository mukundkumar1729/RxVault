-- ═══════════════════════════════════════════════════════════
--  RX VAULT — High Priority Features Schema (FINAL)
--  Run in Supabase → SQL Editor
--  Creates: appointments, invoices, vitals tables
-- ═══════════════════════════════════════════════════════════

-- ─── 1. APPOINTMENTS / QUEUE ─────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id            TEXT        PRIMARY KEY DEFAULT ('appt_' || extract(epoch from now())::bigint::text || '_' || substr(md5(random()::text),1,4)),
  clinic_id     TEXT        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_name  TEXT        NOT NULL,
  patient_phone TEXT        DEFAULT '',
  doctor_name   TEXT        DEFAULT '',
  appt_date     DATE        NOT NULL,
  appt_time     TIME        DEFAULT NULL,
  token_no      INTEGER     DEFAULT 1,
  status        TEXT        DEFAULT 'waiting'
                CHECK (status IN ('waiting','in-room','done','cancelled')),
  visit_type    TEXT        DEFAULT 'consultation'
                CHECK (visit_type IN ('consultation','follow-up','emergency','procedure')),
  notes         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appt_clinic_date ON appointments(clinic_id, appt_date);
CREATE INDEX IF NOT EXISTS idx_appt_status      ON appointments(status);

-- ─── 2. INVOICES / BILLING ───────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id             TEXT        PRIMARY KEY DEFAULT ('inv_' || extract(epoch from now())::bigint::text || '_' || substr(md5(random()::text),1,4)),
  clinic_id      TEXT        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  invoice_no     TEXT        NOT NULL,
  patient_name   TEXT        NOT NULL,
  doctor_name    TEXT        DEFAULT '',
  invoice_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  items_json     TEXT        DEFAULT '[]',
  total_amount   NUMERIC     DEFAULT 0,
  payment_method TEXT        DEFAULT 'Cash',
  status         TEXT        DEFAULT 'unpaid'
                 CHECK (status IN ('paid','unpaid','cancelled')),
  paid_at        TIMESTAMPTZ DEFAULT NULL,
  notes          TEXT        DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_clinic   ON invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_inv_patient  ON invoices(patient_name);
CREATE INDEX IF NOT EXISTS idx_inv_status   ON invoices(status);

-- ─── 3. VITAL SIGNS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitals (
  id            TEXT        PRIMARY KEY DEFAULT ('vit_' || extract(epoch from now())::bigint::text || '_' || substr(md5(random()::text),1,4)),
  clinic_id     TEXT        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_name  TEXT        NOT NULL,
  bp_systolic   NUMERIC     DEFAULT NULL,
  bp_diastolic  NUMERIC     DEFAULT NULL,
  pulse         NUMERIC     DEFAULT NULL,
  temperature   NUMERIC     DEFAULT NULL,
  weight        NUMERIC     DEFAULT NULL,
  height        NUMERIC     DEFAULT NULL,
  spo2          NUMERIC     DEFAULT NULL,
  sugar_fasting NUMERIC     DEFAULT NULL,
  sugar_pp      NUMERIC     DEFAULT NULL,
  sugar_random  NUMERIC     DEFAULT NULL,
  blood_sugar   NUMERIC     DEFAULT NULL,  -- legacy alias
  notes         TEXT        DEFAULT '',
  recorded_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vitals_clinic   ON vitals(clinic_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient  ON vitals(patient_name);
CREATE INDEX IF NOT EXISTS idx_vitals_date     ON vitals(recorded_at DESC);

-- ─── RLS ─────────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_appointments" ON appointments;
DROP POLICY IF EXISTS "allow_all_invoices"     ON invoices;
DROP POLICY IF EXISTS "allow_all_vitals"       ON vitals;

CREATE POLICY "allow_all_appointments" ON appointments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_invoices"     ON invoices     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_vitals"       ON vitals       FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── VERIFY ──────────────────────────────────────────────
SELECT table_name, 'created ✅' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('appointments','invoices','vitals')
ORDER BY table_name;
