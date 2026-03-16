/*
  # Update Retail Phase Types - Remove Acquisition, Add Construction

  ## Summary
  Updates retail project phases to reflect new business logic:
  - Remove "acquisition" (stjecanje zemljišta) phase type
  - Add "construction" (gradnja) phase type
  - New phase structure:
    - Phase 1: Development (Razvoj)
    - Phase 2: Construction (Gradnja)
    - Phase 3: Sales (Prodaja)

  ## Changes
  1. Drop and recreate CHECK constraint on retail_project_phases.phase_type
  2. Update existing acquisition phases to development (if any exist)

  ## Notes
  - Land acquisition is now handled through retail_land_plots table
  - Projects can be linked to land plots via land_plot_id
*/

-- =====================================================
-- Update existing 'acquisition' phases to 'development'
-- =====================================================
UPDATE retail_project_phases
SET phase_type = 'development'
WHERE phase_type = 'acquisition';

-- =====================================================
-- Drop old constraint and add new constraint
-- =====================================================
ALTER TABLE retail_project_phases 
  DROP CONSTRAINT IF EXISTS retail_project_phases_phase_type_check;

ALTER TABLE retail_project_phases 
  ADD CONSTRAINT retail_project_phases_phase_type_check 
  CHECK (phase_type IN ('development', 'construction', 'sales'));
