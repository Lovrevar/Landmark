/*
  # Clean Up Duplicate RLS Policies

  ## Security & Clarity Enhancement
  
  Multiple permissive policies for the same action create confusion and potential security gaps.
  This migration consolidates duplicate policies into single, clear policies per action.

  ## Strategy
  
  For each table with multiple permissive policies:
  1. Drop all duplicate policies
  2. Keep or create one consolidated policy that covers all necessary access patterns

  ## Changes
  
  Affected tables with multiple permissive policies:
  - apartments (5 policy sets)
  - bank_credits (4 policy sets)
  - banks (4 policy sets)
  - buildings (2 policy sets)
  - contracts (2 policy sets)
  - customers (4 policy sets)
  - garages (2 policy sets)
  - investors (4 policy sets)
  - leads (4 policy sets)
  - old_invoices (4 policy sets)
  - project_investments (4 policy sets)
  - project_milestones (4 policy sets)
  - project_phases (4 policy sets)
  - projects (4 policy sets)
  - repositories (2 policy sets)
  - sales (4 policy sets)
  - subcontractor_comments (2 policy sets)
  - task_comments (4 policy sets)
  - users (1 duplicate SELECT policy)
*/

-- ================================================================
-- APARTMENTS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete apartments" ON apartments;
DROP POLICY IF EXISTS "Allow authenticated to insert apartments" ON apartments;
DROP POLICY IF EXISTS "Allow authenticated to read apartments" ON apartments;
DROP POLICY IF EXISTS "Allow authenticated to update apartments" ON apartments;
DROP POLICY IF EXISTS "Authenticated users can insert apartments" ON apartments;
DROP POLICY IF EXISTS "Authenticated users can read apartments" ON apartments;

-- Keep only: "Authenticated users can access apartments"

-- ================================================================
-- BANK_CREDITS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete bank_credits" ON bank_credits;
DROP POLICY IF EXISTS "Allow authenticated to insert bank_credits" ON bank_credits;
DROP POLICY IF EXISTS "Allow authenticated to read bank_credits" ON bank_credits;
DROP POLICY IF EXISTS "Allow authenticated to update bank_credits" ON bank_credits;
DROP POLICY IF EXISTS "Authenticated users can delete bank credits" ON bank_credits;
DROP POLICY IF EXISTS "Authenticated users can insert bank credits" ON bank_credits;
DROP POLICY IF EXISTS "Authenticated users can read bank credits" ON bank_credits;
DROP POLICY IF EXISTS "Authenticated users can update bank credits" ON bank_credits;

-- Keep only: "Authenticated users can access bank credits"

-- ================================================================
-- BANKS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete banks" ON banks;
DROP POLICY IF EXISTS "Allow authenticated to insert banks" ON banks;
DROP POLICY IF EXISTS "Allow authenticated to read banks" ON banks;
DROP POLICY IF EXISTS "Allow authenticated to update banks" ON banks;
DROP POLICY IF EXISTS "Authenticated users can insert banks" ON banks;
DROP POLICY IF EXISTS "Authenticated users can read banks" ON banks;

-- Keep only: "Authenticated users can access banks"

-- ================================================================
-- BUILDINGS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to insert buildings" ON buildings;
DROP POLICY IF EXISTS "Allow authenticated to read buildings" ON buildings;
DROP POLICY IF EXISTS "Authenticated users can insert buildings" ON buildings;
DROP POLICY IF EXISTS "Authenticated users can read buildings" ON buildings;

-- Keep only: "Authenticated users can view buildings"

-- ================================================================
-- CONTRACTS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to insert contracts" ON contracts;
DROP POLICY IF EXISTS "Allow authenticated to read contracts" ON contracts;
DROP POLICY IF EXISTS "Authenticated users can insert contracts" ON contracts;

-- Keep only: "Authenticated users can read contracts"

-- ================================================================
-- CUSTOMERS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated to insert customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated to read customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated to update customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can read customers" ON customers;

-- Keep only: "Authenticated users can access customers"

-- ================================================================
-- GARAGES - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to insert garages" ON garages;
DROP POLICY IF EXISTS "Allow authenticated to read garages" ON garages;
DROP POLICY IF EXISTS "Authenticated users can insert garages" ON garages;
DROP POLICY IF EXISTS "Authenticated users can read garages" ON garages;

-- Keep only: "Authenticated users can view garages"

-- ================================================================
-- INVESTORS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete investors" ON investors;
DROP POLICY IF EXISTS "Allow authenticated to insert investors" ON investors;
DROP POLICY IF EXISTS "Allow authenticated to read investors" ON investors;
DROP POLICY IF EXISTS "Allow authenticated to update investors" ON investors;
DROP POLICY IF EXISTS "Authenticated users can delete investors" ON investors;
DROP POLICY IF EXISTS "Authenticated users can insert investors" ON investors;
DROP POLICY IF EXISTS "Authenticated users can read investors" ON investors;

-- Keep only: "Authenticated users can access investors"

-- ================================================================
-- LEADS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated to insert leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated to read leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated to update leads" ON leads;

-- Keep only: "Authenticated users can access leads"

-- ================================================================
-- OLD_INVOICES - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete invoices" ON old_invoices;
DROP POLICY IF EXISTS "Allow authenticated to insert invoices" ON old_invoices;
DROP POLICY IF EXISTS "Allow authenticated to read invoices" ON old_invoices;
DROP POLICY IF EXISTS "Allow authenticated to update invoices" ON old_invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON old_invoices;
DROP POLICY IF EXISTS "Authenticated users can read invoices" ON old_invoices;

-- Keep only: "Authenticated users can access invoices"

-- ================================================================
-- PROJECT_INVESTMENTS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete project_investments" ON project_investments;
DROP POLICY IF EXISTS "Allow authenticated to insert project_investments" ON project_investments;
DROP POLICY IF EXISTS "Allow authenticated to read project_investments" ON project_investments;
DROP POLICY IF EXISTS "Allow authenticated to update project_investments" ON project_investments;
DROP POLICY IF EXISTS "Authenticated users can delete project investments" ON project_investments;
DROP POLICY IF EXISTS "Authenticated users can insert project investments" ON project_investments;
DROP POLICY IF EXISTS "Authenticated users can read project investments" ON project_investments;
DROP POLICY IF EXISTS "Authenticated users can update project investments" ON project_investments;

-- Keep only: "Authenticated users can access project investments"

-- ================================================================
-- PROJECT_MILESTONES - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "Allow authenticated to insert project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "Allow authenticated to read project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "Allow authenticated to update project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "Authenticated users can delete project milestones" ON project_milestones;
DROP POLICY IF EXISTS "Authenticated users can insert project milestones" ON project_milestones;
DROP POLICY IF EXISTS "Authenticated users can read project milestones" ON project_milestones;
DROP POLICY IF EXISTS "Authenticated users can update project milestones" ON project_milestones;

-- Keep only: "Authenticated users can access project milestones"

-- ================================================================
-- PROJECT_PHASES - Clean up duplicates (keep role-based policies)
-- ================================================================

DROP POLICY IF EXISTS "Authenticated users can access project phases" ON project_phases;
DROP POLICY IF EXISTS "Authenticated users can delete project phases" ON project_phases;
DROP POLICY IF EXISTS "Authenticated users can insert project phases" ON project_phases;
DROP POLICY IF EXISTS "Authenticated users can read project phases" ON project_phases;
DROP POLICY IF EXISTS "Authenticated users can update project phases" ON project_phases;

-- Keep only: Role-based Director/Supervision policies already optimized

-- ================================================================
-- PROJECTS - Clean up duplicates (keep role-based policies)
-- ================================================================

DROP POLICY IF EXISTS "Authenticated users can access projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can read projects" ON projects;

-- Keep only: Role-based Director/Supervision policies already optimized

-- ================================================================
-- REPOSITORIES - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to insert repositories" ON repositories;
DROP POLICY IF EXISTS "Allow authenticated to read repositories" ON repositories;
DROP POLICY IF EXISTS "Authenticated users can insert repositories" ON repositories;
DROP POLICY IF EXISTS "Authenticated users can read repositories" ON repositories;

-- Keep only: "Authenticated users can view repositories"

-- ================================================================
-- SALES - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete sales" ON sales;
DROP POLICY IF EXISTS "Allow authenticated to insert sales" ON sales;
DROP POLICY IF EXISTS "Allow authenticated to read sales" ON sales;
DROP POLICY IF EXISTS "Allow authenticated to update sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can insert sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can read sales" ON sales;

-- Keep only: "Authenticated users can access sales"

-- ================================================================
-- SUBCONTRACTOR_COMMENTS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to insert subcontractor_comments" ON subcontractor_comments;
DROP POLICY IF EXISTS "Allow authenticated to read subcontractor_comments" ON subcontractor_comments;

-- Keep only: "Authenticated users can insert subcontractor comments"
--            "Authenticated users can read subcontractor comments"

-- ================================================================
-- TASK_COMMENTS - Clean up duplicates
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to delete task_comments" ON task_comments;
DROP POLICY IF EXISTS "Allow authenticated to insert task_comments" ON task_comments;
DROP POLICY IF EXISTS "Allow authenticated to read task_comments" ON task_comments;
DROP POLICY IF EXISTS "Allow authenticated to update task_comments" ON task_comments;

-- Keep only: "Allow all operations on task_comments"

-- ================================================================
-- USERS - Clean up duplicate SELECT policy
-- ================================================================

DROP POLICY IF EXISTS "Allow authenticated to read users" ON users;

-- Keep only: "Allow reading users for authentication"
