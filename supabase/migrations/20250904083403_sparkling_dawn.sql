/*
  # Fix users table RLS policy for authentication

  1. Security Changes
    - Drop existing restrictive RLS policy on users table
    - Add new policy that allows reading user data for authentication purposes
    - Maintain security by only allowing SELECT operations

  This change is necessary because the current policy requires authentication
  to read user data, but we need to read user data to authenticate.
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can read user data" ON users;

-- Create a new policy that allows reading users for authentication
CREATE POLICY "Allow reading users for authentication"
  ON users
  FOR SELECT
  TO anon, authenticated
  USING (true);