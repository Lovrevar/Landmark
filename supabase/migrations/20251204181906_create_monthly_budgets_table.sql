/*
  # Create Monthly Budgets Table

  1. Purpose
    - Store monthly budget limits for financial planning
    - Track budget vs actual spending per month
    - Enable budget management and forecasting

  2. New Table
    - `monthly_budgets`
      - `id` (uuid, primary key)
      - `year` (integer) - Year for the budget
      - `month` (integer) - Month (1-12)
      - `budget_amount` (numeric) - Planned budget amount for the month
      - `notes` (text, optional) - Additional notes about the budget
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS
    - Only authenticated users can view budgets
    - Only authenticated users can manage budgets

  4. Constraints
    - Unique constraint on year + month combination
    - Check that month is between 1 and 12
*/

CREATE TABLE IF NOT EXISTS monthly_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  budget_amount numeric DEFAULT 0 NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_month CHECK (month >= 1 AND month <= 12),
  CONSTRAINT unique_year_month UNIQUE (year, month)
);

-- Enable RLS
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view budgets"
  ON monthly_budgets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert budgets"
  ON monthly_budgets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update budgets"
  ON monthly_budgets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete budgets"
  ON monthly_budgets FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_monthly_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_monthly_budgets_updated_at
  BEFORE UPDATE ON monthly_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_budgets_updated_at();

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_year_month ON monthly_budgets(year, month);