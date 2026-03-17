-- ═══════════════════════════════════════════════════════════
--  RX VAULT — AI Search Schema (run after supabase_schema.sql)
--  Run this in Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- ─── Enable extensions ───────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy search (free tier)
CREATE EXTENSION IF NOT EXISTS vector;     -- semantic search (premium)

-- ─── Add plan column to clinics ──────────────────────────
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
-- plan values: 'free' | 'premium'

-- ─── Add Gemini API key column to clinics (premium only) ─
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS gemini_key TEXT DEFAULT '';

-- ─── Add embedding column to prescriptions (premium) ─────
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS embedding vector(768);
-- Note: Gemini text-embedding-004 outputs 768 dimensions

-- ═══════════════════════════════════════════════════════════
--  FREE TIER — pg_trgm fuzzy search indexes
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_presc_diag_trgm
  ON prescriptions USING gin(diagnosis gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_presc_notes_trgm
  ON prescriptions USING gin(notes gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_presc_patient_trgm
  ON prescriptions USING gin(patient_name gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════
--  PREMIUM TIER — pgvector semantic search index
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_presc_embedding
  ON prescriptions USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ═══════════════════════════════════════════════════════════
--  FREE TIER — Fuzzy search RPC function
--  Searches diagnosis + notes + patient_name using pg_trgm
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION search_similar_fuzzy(
  search_query  TEXT,
  p_clinic_id   TEXT,
  result_limit  INT DEFAULT 10,
  min_threshold FLOAT DEFAULT 0.1
)
RETURNS TABLE (
  id            TEXT,
  clinic_id     TEXT,
  patient_name  TEXT,
  diagnosis     TEXT,
  notes         TEXT,
  doctor_name   TEXT,
  date          TEXT,
  status        TEXT,
  type          TEXT,
  medicines     JSONB,
  similarity    FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    p.id,
    p.clinic_id,
    p.patient_name,
    p.diagnosis,
    p.notes,
    p.doctor_name,
    p.date,
    p.status,
    p.type,
    p.medicines,
    GREATEST(
      similarity(p.diagnosis,   search_query),
      similarity(p.notes,       search_query),
      similarity(p.patient_name, search_query)
    ) AS similarity
  FROM prescriptions p
  WHERE
    p.clinic_id = p_clinic_id
    AND (
      p.diagnosis    % search_query OR
      p.notes        % search_query OR
      p.patient_name % search_query OR
      p.diagnosis    ILIKE '%' || search_query || '%' OR
      p.notes        ILIKE '%' || search_query || '%'
    )
  ORDER BY similarity DESC
  LIMIT result_limit;
$$;

-- ═══════════════════════════════════════════════════════════
--  PREMIUM TIER — Semantic vector search RPC function
--  Uses cosine similarity on Gemini embeddings
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION search_similar_semantic(
  query_embedding vector(768),
  p_clinic_id     TEXT,
  result_limit    INT     DEFAULT 10,
  min_threshold   FLOAT   DEFAULT 0.7
)
RETURNS TABLE (
  id            TEXT,
  clinic_id     TEXT,
  patient_name  TEXT,
  diagnosis     TEXT,
  notes         TEXT,
  doctor_name   TEXT,
  date          TEXT,
  status        TEXT,
  type          TEXT,
  medicines     JSONB,
  similarity    FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    p.id,
    p.clinic_id,
    p.patient_name,
    p.diagnosis,
    p.notes,
    p.doctor_name,
    p.date,
    p.status,
    p.type,
    p.medicines,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM prescriptions p
  WHERE
    p.clinic_id = p_clinic_id
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) >= min_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT result_limit;
$$;

-- ═══════════════════════════════════════════════════════════
--  RLS policies for new columns
-- ═══════════════════════════════════════════════════════════
-- Already covered by existing allow_all policies.
-- No additional RLS needed.

-- ═══════════════════════════════════════════════════════════
--  VERIFY
-- ═══════════════════════════════════════════════════════════
-- After running, check with:
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_type = 'FUNCTION' AND routine_schema = 'public';
