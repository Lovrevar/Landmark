/*
  # Add Missing Foreign Key Indexes

  ## Security & Performance Enhancement
  
  Foreign keys without indexes can cause significant performance degradation on large tables.
  This migration adds indexes for all unindexed foreign keys identified by Supabase security scan.

  ## Changes
  
  ### Indexes Added:
  
  1. **accounting_invoices**
     - created_by
  
  2. **accounting_payments**
     - cesija_bank_account_id
     - cesija_company_id
     - company_bank_account_id
  
  3. **apartments**
     - building_id
     - garage_id
     - project_id
     - repository_id
  
  4. **bank_credits**
     - bank_id
     - project_id
  
  5. **buildings**
     - project_id
  
  6. **funding_payments**
     - bank_credit_id
     - created_by
     - project_investment_id
  
  7. **garages**
     - building_id
  
  8. **leads**
     - customer_id
     - project_id
  
  9. **old_invoices**
     - project_id
     - subcontractor_id
  
  10. **project_investments**
      - bank_id
      - investor_id
      - project_id
  
  11. **project_managers**
      - assigned_by
  
  12. **project_milestones**
      - project_id
  
  13. **repositories**
      - building_id
  
  14. **sales**
      - apartment_id
      - customer_id
  
  15. **subcontractor_comments**
      - subcontractor_id
      - user_id
  
  16. **task_comments**
      - user_id
  
  17. **work_logs**
      - phase_id
      - subcontractor_id
*/

-- accounting_invoices
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_created_by 
  ON accounting_invoices(created_by);

-- accounting_payments
CREATE INDEX IF NOT EXISTS idx_accounting_payments_cesija_bank_account_id 
  ON accounting_payments(cesija_bank_account_id);

CREATE INDEX IF NOT EXISTS idx_accounting_payments_cesija_company_id 
  ON accounting_payments(cesija_company_id);

CREATE INDEX IF NOT EXISTS idx_accounting_payments_company_bank_account_id 
  ON accounting_payments(company_bank_account_id);

-- apartments
CREATE INDEX IF NOT EXISTS idx_apartments_building_id 
  ON apartments(building_id);

CREATE INDEX IF NOT EXISTS idx_apartments_garage_id 
  ON apartments(garage_id);

CREATE INDEX IF NOT EXISTS idx_apartments_project_id 
  ON apartments(project_id);

CREATE INDEX IF NOT EXISTS idx_apartments_repository_id 
  ON apartments(repository_id);

-- bank_credits
CREATE INDEX IF NOT EXISTS idx_bank_credits_bank_id 
  ON bank_credits(bank_id);

CREATE INDEX IF NOT EXISTS idx_bank_credits_project_id 
  ON bank_credits(project_id);

-- buildings
CREATE INDEX IF NOT EXISTS idx_buildings_project_id 
  ON buildings(project_id);

-- funding_payments
CREATE INDEX IF NOT EXISTS idx_funding_payments_bank_credit_id 
  ON funding_payments(bank_credit_id);

CREATE INDEX IF NOT EXISTS idx_funding_payments_created_by 
  ON funding_payments(created_by);

CREATE INDEX IF NOT EXISTS idx_funding_payments_project_investment_id 
  ON funding_payments(project_investment_id);

-- garages
CREATE INDEX IF NOT EXISTS idx_garages_building_id 
  ON garages(building_id);

-- leads
CREATE INDEX IF NOT EXISTS idx_leads_customer_id 
  ON leads(customer_id);

CREATE INDEX IF NOT EXISTS idx_leads_project_id 
  ON leads(project_id);

-- old_invoices
CREATE INDEX IF NOT EXISTS idx_old_invoices_project_id 
  ON old_invoices(project_id);

CREATE INDEX IF NOT EXISTS idx_old_invoices_subcontractor_id 
  ON old_invoices(subcontractor_id);

-- project_investments
CREATE INDEX IF NOT EXISTS idx_project_investments_bank_id 
  ON project_investments(bank_id);

CREATE INDEX IF NOT EXISTS idx_project_investments_investor_id 
  ON project_investments(investor_id);

CREATE INDEX IF NOT EXISTS idx_project_investments_project_id 
  ON project_investments(project_id);

-- project_managers
CREATE INDEX IF NOT EXISTS idx_project_managers_assigned_by 
  ON project_managers(assigned_by);

-- project_milestones
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id 
  ON project_milestones(project_id);

-- repositories
CREATE INDEX IF NOT EXISTS idx_repositories_building_id 
  ON repositories(building_id);

-- sales
CREATE INDEX IF NOT EXISTS idx_sales_apartment_id 
  ON sales(apartment_id);

CREATE INDEX IF NOT EXISTS idx_sales_customer_id 
  ON sales(customer_id);

-- subcontractor_comments
CREATE INDEX IF NOT EXISTS idx_subcontractor_comments_subcontractor_id 
  ON subcontractor_comments(subcontractor_id);

CREATE INDEX IF NOT EXISTS idx_subcontractor_comments_user_id 
  ON subcontractor_comments(user_id);

-- task_comments
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id 
  ON task_comments(user_id);

-- work_logs
CREATE INDEX IF NOT EXISTS idx_work_logs_phase_id 
  ON work_logs(phase_id);

CREATE INDEX IF NOT EXISTS idx_work_logs_subcontractor_id 
  ON work_logs(subcontractor_id);
