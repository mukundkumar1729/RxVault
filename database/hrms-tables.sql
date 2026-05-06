-- ════════════════════════════════════════════════════════════
--  HRMS DATABASE TABLES FOR RXVAULT
-- ════════════════════════════════════════════════════════════

-- LEAVE MANAGEMENT
CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL,
    staff_user_id UUID NOT NULL,
    year INTEGER NOT NULL,
    casual_leaves INTEGER DEFAULT 12,
    sick_leaves INTEGER DEFAULT 10,
    paid_leaves INTEGER DEFAULT 15,
    maternity_leaves INTEGER DEFAULT 90,
    paternity_leaves INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, staff_user_id, year)
);

CREATE TABLE IF NOT EXISTS staff_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL,
    staff_user_id UUID NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('casual', 'sick', 'paid', 'maternity', 'paternity', 'unpaid')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(5,2) NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_leaves_clinic_user ON staff_leaves(clinic_id, staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_status ON staff_leaves(status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_clinic_user_year ON leave_balances(clinic_id, staff_user_id, year);

-- SALARY / PAYROLL
CREATE TABLE IF NOT EXISTS salary_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL,
    component_name TEXT NOT NULL,
    component_type TEXT NOT NULL CHECK (component_type IN ('earning', 'deduction')),
    percentage NUMERIC(5,2),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, component_name)
);

CREATE TABLE IF NOT EXISTS staff_salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL,
    staff_user_id UUID NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    basic_salary NUMERIC(12,2) DEFAULT 20000,
    hra NUMERIC(12,2) DEFAULT 0,
    conveyance NUMERIC(12,2) DEFAULT 0,
    special_allowance NUMERIC(12,2) DEFAULT 0,
    pf_deduction NUMERIC(12,2) DEFAULT 0,
    tax_deduction NUMERIC(12,2) DEFAULT 0,
    other_deductions NUMERIC(12,2) DEFAULT 0,
    gross_salary NUMERIC(12,2) DEFAULT 0,
    net_salary NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paid')),
    processed_by UUID,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, staff_user_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_staff_salaries_clinic_user ON staff_salaries(clinic_id, staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_salaries_month_year ON staff_salaries(month, year);
CREATE INDEX IF NOT EXISTS idx_staff_salaries_status ON staff_salaries(status);

-- SEPARATION
CREATE TABLE IF NOT EXISTS staff_separations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL,
    staff_user_id UUID NOT NULL,
    separation_type TEXT NOT NULL CHECK (separation_type IN ('resignation', 'termination', 'retirement')),
    notice_period_days INTEGER DEFAULT 30,
    notice_start_date DATE,
    last_working_date DATE,
    reason TEXT,
    exit_interview_notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'serving_notice', 'completed', 'cancelled')),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_separations_clinic_user ON staff_separations(clinic_id, staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_separations_status ON staff_separations(status);

-- FULL & FINAL SETTLEMENT
CREATE TABLE IF NOT EXISTS staff_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL,
    staff_user_id UUID NOT NULL,
    separation_id UUID,
    final_salary_days INTEGER DEFAULT 0,
    unused_leaves_encashment NUMERIC(12,2) DEFAULT 0,
    outstanding_loans NUMERIC(12,2) DEFAULT 0,
    other_deductions NUMERIC(12,2) DEFAULT 0,
    total_settlement_amount NUMERIC(12,2) DEFAULT 0,
    settlement_date DATE,
    payment_mode TEXT DEFAULT 'bank_transfer' CHECK (payment_mode IN ('bank_transfer', 'cash', 'cheque')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid')),
    experience_letter BOOLEAN DEFAULT false,
    relieving_letter BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_settlements_clinic_user ON staff_settlements(clinic_id, staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_settlements_status ON staff_settlements(status);

-- PERFORMANCE APPRAISAL
CREATE TABLE IF NOT EXISTS appraisal_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appraisal_cycles_clinic ON appraisal_cycles(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_cycles_status ON appraisal_cycles(status);

CREATE TABLE IF NOT EXISTS appraisal_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL,
    staff_user_id UUID NOT NULL,
    goal_description TEXT NOT NULL,
    target TEXT,
    achievement TEXT,
    self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 5),
    manager_rating INTEGER CHECK (manager_rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appraisals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL,
    staff_user_id UUID NOT NULL,
    reviewer_user_id UUID,
    self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 5),
    self_comment TEXT,
    manager_rating INTEGER CHECK (manager_rating BETWEEN 1 AND 5),
    manager_comment TEXT,
    overall_rating NUMERIC(3,2),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'self_submitted', 'completed')),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cycle_id, staff_user_id)
);

ALTER TABLE appraisal_goals ADD CONSTRAINT fk_appraisal_goals_cycle FOREIGN KEY (cycle_id) REFERENCES appraisal_cycles(id) ON DELETE CASCADE;
ALTER TABLE appraisals ADD CONSTRAINT fk_appraisals_cycle FOREIGN KEY (cycle_id) REFERENCES appraisal_cycles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_appraisals_cycle_staff ON appraisals(cycle_id, staff_user_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_status ON appraisals(status);

-- DONE!