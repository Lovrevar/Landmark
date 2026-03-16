/*
  # Create Retail Projects and Phases Structure

  ## Purpose
  Enable Retail profile users to manage land development projects with multiple phases:
  - Phase 1: Acquisition (stjecanje zemljišta)
  - Phase 2: Development (razvoj - geodet, arhitekt, projektant)
  - Phase 3: Sales (prodaja kupcima)

  ## New Tables

  1. **retail_projects** - Main projects
     - Basic project information
     - Land area, purchase price, location, plot number

  2. **retail_project_phases** - Project phases (1-5 flexible, default 3)
     - Links to project
     - Phase type: acquisition, development, sales
     - Order and budget allocation

  3. **retail_suppliers** - Suppliers for development phase
     - Geodet, Arhitekt, Projektant, etc.
     - Contact information

  4. **retail_contracts** - Contracts with suppliers (similar to subcontractor contracts)
     - Links to supplier and phase
     - Contract amount and budget realized
     - Status tracking

  5. **retail_contract_milestones** - Milestones for contracts
     - Breakdown of contract by customers (Lidl, Kaufland, Spar...)
     - Amount per milestone
     - Status: pending, approved, completed, paid

  ## Changes to Existing Tables

  1. **retail_sales** - Add phase_id to link sales to project phases

  ## Security
  - Enable RLS on all new tables
  - Authenticated users can manage all records

  ## Business Logic
  - Contracts budget_realized auto-calculated from milestone payments
  - Milestones similar to Site Management logic
*/

-- =====================================================
-- 1. RETAIL PROJECTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS retail_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  plot_number text NOT NULL,
  total_area_m2 numeric NOT NULL CHECK (total_area_m2 > 0),
  purchase_price numeric NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  price_per_m2 numeric GENERATED ALWAYS AS (
    CASE WHEN total_area_m2 > 0 THEN purchase_price / total_area_m2 ELSE 0 END
  ) STORED,
  status text NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'In Progress', 'Completed', 'On Hold')),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 2. RETAIL PROJECT PHASES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS retail_project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES retail_projects(id) ON DELETE CASCADE,
  phase_name text NOT NULL,
  phase_type text NOT NULL CHECK (phase_type IN ('acquisition', 'development', 'sales')),
  phase_order integer NOT NULL CHECK (phase_order >= 1 AND phase_order <= 5),
  budget_allocated numeric DEFAULT 0 CHECK (budget_allocated >= 0),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed')),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, phase_order)
);

-- =====================================================
-- 3. RETAIL SUPPLIERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS retail_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supplier_type text NOT NULL CHECK (supplier_type IN ('Geodet', 'Arhitekt', 'Projektant', 'Consultant', 'Other')),
  contact_person text,
  contact_phone text,
  contact_email text,
  oib text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 4. RETAIL CONTRACTS TABLE (similar to contracts in Site Management)
-- =====================================================
CREATE TABLE IF NOT EXISTS retail_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES retail_project_phases(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES retail_suppliers(id) ON DELETE RESTRICT,
  contract_number text NOT NULL,
  contract_amount numeric NOT NULL CHECK (contract_amount >= 0),
  budget_realized numeric NOT NULL DEFAULT 0 CHECK (budget_realized >= 0),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(contract_number)
);

-- =====================================================
-- 5. RETAIL CONTRACT MILESTONES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS retail_contract_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES retail_contracts(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES retail_customers(id) ON DELETE RESTRICT,
  milestone_name text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'paid')),
  due_date date,
  completed_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 6. ADD PHASE_ID TO RETAIL_SALES (existing table)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_sales' AND column_name = 'phase_id'
  ) THEN
    ALTER TABLE retail_sales ADD COLUMN phase_id uuid REFERENCES retail_project_phases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for phase_id
CREATE INDEX IF NOT EXISTS idx_retail_sales_phase_id ON retail_sales(phase_id);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_retail_project_phases_project_id ON retail_project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_retail_project_phases_phase_type ON retail_project_phases(phase_type);
CREATE INDEX IF NOT EXISTS idx_retail_contracts_phase_id ON retail_contracts(phase_id);
CREATE INDEX IF NOT EXISTS idx_retail_contracts_supplier_id ON retail_contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_retail_contract_milestones_contract_id ON retail_contract_milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_retail_contract_milestones_customer_id ON retail_contract_milestones(customer_id);
CREATE INDEX IF NOT EXISTS idx_retail_contract_milestones_status ON retail_contract_milestones(status);

-- =====================================================
-- ENABLE RLS
-- =====================================================
ALTER TABLE retail_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_contract_milestones ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - retail_projects
-- =====================================================
CREATE POLICY "Authenticated users can view retail projects"
  ON retail_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert retail projects"
  ON retail_projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update retail projects"
  ON retail_projects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete retail projects"
  ON retail_projects FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- RLS POLICIES - retail_project_phases
-- =====================================================
CREATE POLICY "Authenticated users can view retail phases"
  ON retail_project_phases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert retail phases"
  ON retail_project_phases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update retail phases"
  ON retail_project_phases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete retail phases"
  ON retail_project_phases FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- RLS POLICIES - retail_suppliers
-- =====================================================
CREATE POLICY "Authenticated users can view retail suppliers"
  ON retail_suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert retail suppliers"
  ON retail_suppliers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update retail suppliers"
  ON retail_suppliers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete retail suppliers"
  ON retail_suppliers FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- RLS POLICIES - retail_contracts
-- =====================================================
CREATE POLICY "Authenticated users can view retail contracts"
  ON retail_contracts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert retail contracts"
  ON retail_contracts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update retail contracts"
  ON retail_contracts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete retail contracts"
  ON retail_contracts FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- RLS POLICIES - retail_contract_milestones
-- =====================================================
CREATE POLICY "Authenticated users can view retail milestones"
  ON retail_contract_milestones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert retail milestones"
  ON retail_contract_milestones FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update retail milestones"
  ON retail_contract_milestones FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete retail milestones"
  ON retail_contract_milestones FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- TRIGGERS - updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_retail_projects_updated_at ON retail_projects;
CREATE TRIGGER update_retail_projects_updated_at
  BEFORE UPDATE ON retail_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_retail_project_phases_updated_at ON retail_project_phases;
CREATE TRIGGER update_retail_project_phases_updated_at
  BEFORE UPDATE ON retail_project_phases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_retail_suppliers_updated_at ON retail_suppliers;
CREATE TRIGGER update_retail_suppliers_updated_at
  BEFORE UPDATE ON retail_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_retail_contracts_updated_at ON retail_contracts;
CREATE TRIGGER update_retail_contracts_updated_at
  BEFORE UPDATE ON retail_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_retail_contract_milestones_updated_at ON retail_contract_milestones;
CREATE TRIGGER update_retail_contract_milestones_updated_at
  BEFORE UPDATE ON retail_contract_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION: Auto-update contract budget_realized from milestones
-- =====================================================
CREATE OR REPLACE FUNCTION update_retail_contract_budget_realized()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id uuid;
  v_total_paid numeric;
BEGIN
  -- Get contract_id
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  -- Calculate total paid for milestones with status 'paid'
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM retail_contract_milestones
  WHERE contract_id = v_contract_id AND status = 'paid';

  -- Update contract budget_realized
  UPDATE retail_contracts
  SET budget_realized = v_total_paid
  WHERE id = v_contract_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for milestone changes
DROP TRIGGER IF EXISTS trigger_update_retail_contract_budget_on_milestone_change ON retail_contract_milestones;
CREATE TRIGGER trigger_update_retail_contract_budget_on_milestone_change
AFTER INSERT OR UPDATE OR DELETE ON retail_contract_milestones
FOR EACH ROW
EXECUTE FUNCTION update_retail_contract_budget_realized();
