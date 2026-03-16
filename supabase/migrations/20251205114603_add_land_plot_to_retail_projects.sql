/*
  # Add Land Plot Connection to Retail Projects

  ## Summary
  Connect retail projects to land plots (zemljišta) to enable automatic data population
  and better tracking of which land plots are used in which projects.

  ## Changes

  1. **retail_projects table modifications**
     - Add `land_plot_id` (uuid, nullable, foreign key → retail_land_plots)
     - Add unique constraint on `land_plot_id` to enforce 1:1 relationship
     - Rename conceptually: `purchase_price` remains but represents project budget
     - Add index on `land_plot_id` for faster lookups

  2. **Security**
     - No changes to RLS policies needed (already configured)

  3. **Business Logic**
     - One land plot can only be used in one project (1:1 relationship)
     - When land plot is selected, project will auto-populate:
       * plot_number (broj čestice)
       * location (lokacija)
       * Calculated budget suggestion based on land plot price
     - Project area (total_area_m2) remains manual input (may be partial land use)

  ## Important Notes
  - `purchase_price` field now represents project budget (budžet projekta)
  - `land_plot_id` is nullable to support projects without linked land plots
  - Unique constraint ensures one land plot = one project maximum
*/

-- =====================================================
-- 1. ADD land_plot_id TO retail_projects
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_projects' AND column_name = 'land_plot_id'
  ) THEN
    ALTER TABLE retail_projects 
    ADD COLUMN land_plot_id uuid REFERENCES retail_land_plots(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- 2. ADD UNIQUE CONSTRAINT (1:1 relationship)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_land_plot_per_project'
  ) THEN
    ALTER TABLE retail_projects 
    ADD CONSTRAINT unique_land_plot_per_project UNIQUE (land_plot_id);
  END IF;
END $$;

-- =====================================================
-- 3. CREATE INDEX for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_retail_projects_land_plot_id 
ON retail_projects(land_plot_id);

-- =====================================================
-- 4. ADD COMMENT for clarity
-- =====================================================
COMMENT ON COLUMN retail_projects.purchase_price IS 'Project budget (budžet projekta) - guiding star for spending';
COMMENT ON COLUMN retail_projects.land_plot_id IS 'Connected land plot - one plot can only be used in one project (1:1)';
