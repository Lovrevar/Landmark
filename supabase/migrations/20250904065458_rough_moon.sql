/*
# Create users table with role-based access

1. New Tables
   - `users`
     - `id` (uuid, primary key)
     - `username` (text, unique)
     - `password` (text, plain text as requested)
     - `role` (text, one of: Director, Accounting, Sales, Supervision)
     - `created_at` (timestamp)

2. Security
   - Enable RLS on `users` table
   - Add policy for authenticated users to read user data

3. Sample Data
   - Insert sample users for each role for testing
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('Director', 'Accounting', 'Sales', 'Supervision')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read user data"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert sample users for testing
INSERT INTO users (username, password, role) VALUES 
  ('director', 'pass123', 'Director'),
  ('accountant', 'pass123', 'Accounting'),
  ('salesperson', 'pass123', 'Sales'),
  ('supervisor', 'pass123', 'Supervision');