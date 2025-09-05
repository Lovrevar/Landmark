import { supabase } from '../lib/supabase'

export const createSalesTables = async () => {
  try {
    console.log('Creating sales tables...')

    // Create customers table
    const { error: customersError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS customers (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          surname text NOT NULL,
          email text NOT NULL UNIQUE,
          phone text,
          address text,
          bank_account text,
          id_number text UNIQUE,
          status text NOT NULL DEFAULT 'interested' CHECK (status IN ('buyer', 'interested', 'lead')),
          created_at timestamptz DEFAULT now()
        );

        ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

        CREATE POLICY IF NOT EXISTS "Authenticated users can access customers"
          ON customers
          FOR ALL
          TO authenticated
          USING (true)
          WITH CHECK (true);
      `
    })

    if (customersError) {
      console.error('Error creating customers table:', customersError)
      throw customersError
    }

    // Create sales table
    const { error: salesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS sales (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          apartment_id uuid REFERENCES apartments(id) ON DELETE CASCADE NOT NULL,
          customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
          sale_price numeric(15,2) NOT NULL DEFAULT 0,
          payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'credit', 'bank_loan', 'installments')),
          down_payment numeric(15,2) NOT NULL DEFAULT 0,
          total_paid numeric(15,2) NOT NULL DEFAULT 0,
          remaining_amount numeric(15,2) NOT NULL DEFAULT 0,
          next_payment_date date,
          monthly_payment numeric(15,2) DEFAULT 0,
          sale_date date NOT NULL,
          contract_signed boolean DEFAULT false,
          notes text DEFAULT '',
          created_at timestamptz DEFAULT now()
        );

        ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

        CREATE POLICY IF NOT EXISTS "Authenticated users can access sales"
          ON sales
          FOR ALL
          TO authenticated
          USING (true)
          WITH CHECK (true);
      `
    })

    if (salesError) {
      console.error('Error creating sales table:', salesError)
      throw salesError
    }

    // Create leads table
    const { error: leadsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS leads (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
          project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
          apartment_preferences text DEFAULT '',
          budget_range_min numeric(15,2) DEFAULT 0,
          budget_range_max numeric(15,2) DEFAULT 0,
          priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
          status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'viewing_scheduled', 'negotiating', 'closed')),
          last_contact_date date,
          next_follow_up date,
          notes text DEFAULT '',
          created_at timestamptz DEFAULT now()
        );

        ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

        CREATE POLICY IF NOT EXISTS "Authenticated users can access leads"
          ON leads
          FOR ALL
          TO authenticated
          USING (true)
          WITH CHECK (true);
      `
    })

    if (leadsError) {
      console.error('Error creating leads table:', leadsError)
      throw leadsError
    }

    console.log('All sales tables created successfully!')
    return true

  } catch (error) {
    console.error('Error creating sales tables:', error)
    return false
  }
}