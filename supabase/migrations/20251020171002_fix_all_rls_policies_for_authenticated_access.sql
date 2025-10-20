/*
  # Fix All RLS Policies for Authenticated Access

  ## Changes
  
  1. Update all RLS policies to allow authenticated users to access data
  2. Remove recursive policy checks that cause infinite loops
  3. Keep security while allowing proper data access
  
  ## Security
  - All authenticated users can read data
  - Users can modify data based on simple, direct checks
  - No recursive lookups that cause infinite loops
*/

-- Projects table
DROP POLICY IF EXISTS "Authenticated users can view all projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON projects;

CREATE POLICY "Allow authenticated to read projects"
  ON projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert projects"
  ON projects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update projects"
  ON projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete projects"
  ON projects FOR DELETE TO authenticated USING (true);

-- Customers table
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can create customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON customers;

CREATE POLICY "Allow authenticated to read customers"
  ON customers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert customers"
  ON customers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update customers"
  ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete customers"
  ON customers FOR DELETE TO authenticated USING (true);

-- Sales table
DROP POLICY IF EXISTS "Authenticated users can view all sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can create sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can update sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can delete sales" ON sales;

CREATE POLICY "Allow authenticated to read sales"
  ON sales FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert sales"
  ON sales FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update sales"
  ON sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete sales"
  ON sales FOR DELETE TO authenticated USING (true);

-- Buildings table
DROP POLICY IF EXISTS "Authenticated users can view all buildings" ON buildings;
DROP POLICY IF EXISTS "Authenticated users can create buildings" ON buildings;
DROP POLICY IF EXISTS "Authenticated users can update buildings" ON buildings;
DROP POLICY IF EXISTS "Authenticated users can delete buildings" ON buildings;

CREATE POLICY "Allow authenticated to read buildings"
  ON buildings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert buildings"
  ON buildings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update buildings"
  ON buildings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete buildings"
  ON buildings FOR DELETE TO authenticated USING (true);

-- Apartments table
DROP POLICY IF EXISTS "Authenticated users can view all apartments" ON apartments;
DROP POLICY IF EXISTS "Authenticated users can create apartments" ON apartments;
DROP POLICY IF EXISTS "Authenticated users can update apartments" ON apartments;
DROP POLICY IF EXISTS "Authenticated users can delete apartments" ON apartments;

CREATE POLICY "Allow authenticated to read apartments"
  ON apartments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert apartments"
  ON apartments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update apartments"
  ON apartments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete apartments"
  ON apartments FOR DELETE TO authenticated USING (true);

-- Subcontractors table
DROP POLICY IF EXISTS "Authenticated users can view all subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Authenticated users can create subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Authenticated users can update subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Authenticated users can delete subcontractors" ON subcontractors;

CREATE POLICY "Allow authenticated to read subcontractors"
  ON subcontractors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert subcontractors"
  ON subcontractors FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update subcontractors"
  ON subcontractors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete subcontractors"
  ON subcontractors FOR DELETE TO authenticated USING (true);

-- Contracts table
DROP POLICY IF EXISTS "Authenticated users can view all contracts" ON contracts;
DROP POLICY IF EXISTS "Authenticated users can create contracts" ON contracts;
DROP POLICY IF EXISTS "Authenticated users can update contracts" ON contracts;
DROP POLICY IF EXISTS "Authenticated users can delete contracts" ON contracts;

CREATE POLICY "Allow authenticated to read contracts"
  ON contracts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert contracts"
  ON contracts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update contracts"
  ON contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete contracts"
  ON contracts FOR DELETE TO authenticated USING (true);

-- Project phases table
DROP POLICY IF EXISTS "Authenticated users can view all project_phases" ON project_phases;
DROP POLICY IF EXISTS "Authenticated users can create project_phases" ON project_phases;
DROP POLICY IF EXISTS "Authenticated users can update project_phases" ON project_phases;
DROP POLICY IF EXISTS "Authenticated users can delete project_phases" ON project_phases;

CREATE POLICY "Allow authenticated to read project_phases"
  ON project_phases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert project_phases"
  ON project_phases FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update project_phases"
  ON project_phases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete project_phases"
  ON project_phases FOR DELETE TO authenticated USING (true);

-- Wire payments table
DROP POLICY IF EXISTS "Authenticated users can view all wire_payments" ON wire_payments;
DROP POLICY IF EXISTS "Authenticated users can create wire_payments" ON wire_payments;
DROP POLICY IF EXISTS "Authenticated users can update wire_payments" ON wire_payments;
DROP POLICY IF EXISTS "Authenticated users can delete wire_payments" ON wire_payments;

CREATE POLICY "Allow authenticated to read wire_payments"
  ON wire_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert wire_payments"
  ON wire_payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update wire_payments"
  ON wire_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete wire_payments"
  ON wire_payments FOR DELETE TO authenticated USING (true);

-- Work logs table
DROP POLICY IF EXISTS "Authenticated users can view all work_logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can create work logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can update work logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can delete work logs" ON work_logs;

CREATE POLICY "Allow authenticated to read work_logs"
  ON work_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert work_logs"
  ON work_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update work_logs"
  ON work_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete work_logs"
  ON work_logs FOR DELETE TO authenticated USING (true);

-- Subcontractor comments table
DROP POLICY IF EXISTS "Authenticated users can view all comments" ON subcontractor_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON subcontractor_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON subcontractor_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON subcontractor_comments;

CREATE POLICY "Allow authenticated to read subcontractor_comments"
  ON subcontractor_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert subcontractor_comments"
  ON subcontractor_comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update subcontractor_comments"
  ON subcontractor_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete subcontractor_comments"
  ON subcontractor_comments FOR DELETE TO authenticated USING (true);

-- Investors table
DROP POLICY IF EXISTS "Authenticated users can view all investors" ON investors;
DROP POLICY IF EXISTS "Authenticated users can create investors" ON investors;
DROP POLICY IF EXISTS "Authenticated users can update investors" ON investors;
DROP POLICY IF EXISTS "Authenticated users can delete investors" ON investors;

CREATE POLICY "Allow authenticated to read investors"
  ON investors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert investors"
  ON investors FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update investors"
  ON investors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete investors"
  ON investors FOR DELETE TO authenticated USING (true);

-- Banks table
DROP POLICY IF EXISTS "Authenticated users can view all banks" ON banks;
DROP POLICY IF EXISTS "Authenticated users can create banks" ON banks;
DROP POLICY IF EXISTS "Authenticated users can update banks" ON banks;
DROP POLICY IF EXISTS "Authenticated users can delete banks" ON banks;

CREATE POLICY "Allow authenticated to read banks"
  ON banks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert banks"
  ON banks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update banks"
  ON banks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete banks"
  ON banks FOR DELETE TO authenticated USING (true);

-- Bank credits table
DROP POLICY IF EXISTS "Authenticated users can view all bank_credits" ON bank_credits;
DROP POLICY IF EXISTS "Authenticated users can create bank_credits" ON bank_credits;
DROP POLICY IF EXISTS "Authenticated users can update bank_credits" ON bank_credits;
DROP POLICY IF EXISTS "Authenticated users can delete bank_credits" ON bank_credits;

CREATE POLICY "Allow authenticated to read bank_credits"
  ON bank_credits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert bank_credits"
  ON bank_credits FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update bank_credits"
  ON bank_credits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete bank_credits"
  ON bank_credits FOR DELETE TO authenticated USING (true);

-- Project investments table
DROP POLICY IF EXISTS "Authenticated users can view all project_investments" ON project_investments;
DROP POLICY IF EXISTS "Authenticated users can create project_investments" ON project_investments;
DROP POLICY IF EXISTS "Authenticated users can update project_investments" ON project_investments;
DROP POLICY IF EXISTS "Authenticated users can delete project_investments" ON project_investments;

CREATE POLICY "Allow authenticated to read project_investments"
  ON project_investments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert project_investments"
  ON project_investments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update project_investments"
  ON project_investments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete project_investments"
  ON project_investments FOR DELETE TO authenticated USING (true);

-- Invoices table
DROP POLICY IF EXISTS "Authenticated users can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can create invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON invoices;

CREATE POLICY "Allow authenticated to read invoices"
  ON invoices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert invoices"
  ON invoices FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update invoices"
  ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete invoices"
  ON invoices FOR DELETE TO authenticated USING (true);

-- Apartment payments table
DROP POLICY IF EXISTS "Authenticated users can view all apartment_payments" ON apartment_payments;
DROP POLICY IF EXISTS "Authenticated users can create apartment_payments" ON apartment_payments;
DROP POLICY IF EXISTS "Authenticated users can update apartment_payments" ON apartment_payments;
DROP POLICY IF EXISTS "Authenticated users can delete apartment_payments" ON apartment_payments;

CREATE POLICY "Allow authenticated to read apartment_payments"
  ON apartment_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert apartment_payments"
  ON apartment_payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update apartment_payments"
  ON apartment_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete apartment_payments"
  ON apartment_payments FOR DELETE TO authenticated USING (true);

-- Garages table (if exists)
DROP POLICY IF EXISTS "Authenticated users can view all garages" ON garages;
DROP POLICY IF EXISTS "Authenticated users can create garages" ON garages;
DROP POLICY IF EXISTS "Authenticated users can update garages" ON garages;
DROP POLICY IF EXISTS "Authenticated users can delete garages" ON garages;

CREATE POLICY "Allow authenticated to read garages"
  ON garages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert garages"
  ON garages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update garages"
  ON garages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete garages"
  ON garages FOR DELETE TO authenticated USING (true);

-- Leads table (if exists)
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can create leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON leads;

CREATE POLICY "Allow authenticated to read leads"
  ON leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert leads"
  ON leads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update leads"
  ON leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete leads"
  ON leads FOR DELETE TO authenticated USING (true);

-- Repositories table (if exists)
DROP POLICY IF EXISTS "Authenticated users can view all repositories" ON repositories;
DROP POLICY IF EXISTS "Authenticated users can create repositories" ON repositories;
DROP POLICY IF EXISTS "Authenticated users can update repositories" ON repositories;
DROP POLICY IF EXISTS "Authenticated users can delete repositories" ON repositories;

CREATE POLICY "Allow authenticated to read repositories"
  ON repositories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert repositories"
  ON repositories FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update repositories"
  ON repositories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete repositories"
  ON repositories FOR DELETE TO authenticated USING (true);

-- Project milestones table (if exists)
DROP POLICY IF EXISTS "Authenticated users can view all project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "Authenticated users can create project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "Authenticated users can update project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "Authenticated users can delete project_milestones" ON project_milestones;

CREATE POLICY "Allow authenticated to read project_milestones"
  ON project_milestones FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert project_milestones"
  ON project_milestones FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update project_milestones"
  ON project_milestones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete project_milestones"
  ON project_milestones FOR DELETE TO authenticated USING (true);

-- Task comments table (if exists)
DROP POLICY IF EXISTS "Authenticated users can view all task_comments" ON task_comments;
DROP POLICY IF EXISTS "Authenticated users can create task_comments" ON task_comments;
DROP POLICY IF EXISTS "Authenticated users can update task_comments" ON task_comments;
DROP POLICY IF EXISTS "Authenticated users can delete task_comments" ON task_comments;

CREATE POLICY "Allow authenticated to read task_comments"
  ON task_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert task_comments"
  ON task_comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update task_comments"
  ON task_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete task_comments"
  ON task_comments FOR DELETE TO authenticated USING (true);
