

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can read user data" ON users;


-- Create a new policy that allows reading users for authentication
CREATE POLICY "Allow reading users for authentication"
  ON users
  FOR SELECT
  TO anon, authenticated
  USING (true);
;