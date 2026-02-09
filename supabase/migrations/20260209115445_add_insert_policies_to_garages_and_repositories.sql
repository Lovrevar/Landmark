/*
  # Add INSERT Policies for Garages and Repositories

  ## Summary
  Adds missing INSERT policies to allow authenticated users to create garages and repositories.

  ## Changes
  1. Policies Added
    - `garages` table: INSERT policy for authenticated users
    - `repositories` table: INSERT policy for authenticated users

  ## Security
  - Only authenticated users can create garages and repositories
  - Policies use `USING (true)` for INSERT which means WITH CHECK (true)
*/

-- Add INSERT policy for garages
CREATE POLICY "Allow authenticated to insert garages"
  ON garages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add INSERT policy for repositories
CREATE POLICY "Allow authenticated to insert repositories"
  ON repositories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
