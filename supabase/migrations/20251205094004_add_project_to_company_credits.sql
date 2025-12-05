/*
  # Add Project Reference to Company Credits
  
  1. Changes
    - Add `project_id` column to `company_credits` table
    - Creates optional foreign key relationship to `projects` table
    - Allows credits to be linked to specific construction projects for tracking
  
  2. Purpose
    - Enable tracking of bank credits per project
    - Display credit balance and usage in Site Management project view
    - Support project-specific financial monitoring
*/

-- Add project_id column to company_credits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_credits' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE company_credits 
    ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_company_credits_project_id 
    ON company_credits(project_id);
  END IF;
END $$;