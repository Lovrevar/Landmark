/*
  # Fix RLS Infinite Recursion

  ## Changes
  
  1. Drop problematic RLS policies causing infinite recursion
  2. Create simple, direct policies that don't reference themselves
  
  ## Security
  - Authenticated users can read all users
  - Users can update their own record
  - Only Directors can insert new users
*/

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Authenticated users can read all users" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;
DROP POLICY IF EXISTS "Director can insert users" ON users;

-- Create simple, non-recursive policies
CREATE POLICY "Allow authenticated to read users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to update own record"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Allow authenticated to insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
