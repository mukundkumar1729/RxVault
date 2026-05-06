-- DISABLE RLS POLICIES FOR HRMS TABLES
-- Run this in Supabase SQL Editor to fix the insert error

-- Disable RLS on all HRMS tables (temporarily for development)
ALTER TABLE leave_balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leaves DISABLE ROW LEVEL SECURITY;
ALTER TABLE salary_components DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_salaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_separations DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_settlements DISABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_cycles DISABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE appraisals DISABLE ROW LEVEL SECURITY;

-- Or alternatively, create permissive policies:
-- Uncomment below if you want to keep RLS but allow all operations:

-- CREATE POLICY "Allow all inserts staff_leaves" ON staff_leaves FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow all inserts staff_salaries" ON staff_salaries FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow all inserts staff_separations" ON staff_separations FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow all inserts staff_settlements" ON staff_settlements FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow all inserts appraisal_cycles" ON appraisal_cycles FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow all inserts appraisals" ON appraisals FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow all inserts appraisal_goals" ON appraisal_goals FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow all inserts leave_balances" ON leave_balances FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow all inserts salary_components" ON salary_components FOR INSERT WITH CHECK (true);

-- UPDATE policies:
-- CREATE POLICY "Allow all updates staff_leaves" ON staff_leaves FOR UPDATE USING (true);
-- CREATE POLICY "Allow all updates staff_salaries" ON staff_salaries FOR UPDATE USING (true);
-- CREATE POLICY "Allow all updates staff_separations" ON staff_separations FOR UPDATE USING (true);
-- CREATE POLICY "Allow all updates staff_settlements" ON staff_settlements FOR UPDATE USING (true);
-- CREATE POLICY "Allow all updates appraisal_cycles" ON appraisal_cycles FOR UPDATE USING (true);
-- CREATE POLICY "Allow all updates appraisals" ON appraisals FOR UPDATE USING (true);
-- CREATE POLICY "Allow all updates appraisal_goals" ON appraisal_goals FOR UPDATE USING (true);
-- CREATE POLICY "Allow all updates leave_balances" ON leave_balances FOR UPDATE USING (true);
-- CREATE POLICY "Allow all updates salary_components" ON salary_components FOR UPDATE USING (true);

-- SELECT policies:
-- CREATE POLICY "Allow all select staff_leaves" ON staff_leaves FOR SELECT USING (true);
-- CREATE POLICY "Allow all select staff_salaries" ON staff_salaries FOR SELECT USING (true);
-- CREATE POLICY "Allow all select staff_separations" ON staff_separations FOR SELECT USING (true);
-- CREATE POLICY "Allow all select staff_settlements" ON staff_settlements FOR SELECT USING (true);
-- CREATE POLICY "Allow all select appraisal_cycles" ON appraisal_cycles FOR SELECT USING (true);
-- CREATE POLICY "Allow all select appraisals" ON appraisals FOR SELECT USING (true);
-- CREATE POLICY "Allow all select appraisal_goals" ON appraisal_goals FOR SELECT USING (true);
-- CREATE POLICY "Allow all select leave_balances" ON leave_balances FOR SELECT USING (true);
-- CREATE POLICY "Allow all select salary_components" ON salary_components FOR SELECT USING (true);

SELECT 'RLS policies disabled for HRMS tables' as result;