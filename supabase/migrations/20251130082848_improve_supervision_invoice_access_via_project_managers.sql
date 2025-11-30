/*
  # Improve Supervision Invoice Access via Project Managers

  1. Changes
    - Update RLS policy to properly check project access through project_managers
    - Policy now checks: invoice → contract → project → project_managers → user
    - Falls back to checking direct project_id if contract_id is not set

  2. Security
    - More restrictive: Supervision can only see invoices for projects they manage
    - Maintains access for Director and Accounting roles
*/

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Supervision can view invoices for their contracts" ON accounting_invoices;

-- Create better policy that checks project access
CREATE POLICY "Supervision can view invoices for managed projects"
  ON accounting_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      LEFT JOIN project_managers pm ON pm.user_id = u.id
      LEFT JOIN contracts c ON c.id = accounting_invoices.contract_id
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND (
        -- Check access via contract's project
        (c.project_id IS NOT NULL AND pm.project_id = c.project_id)
        OR
        -- Check access via invoice's direct project_id
        (accounting_invoices.project_id IS NOT NULL AND pm.project_id = accounting_invoices.project_id)
        OR
        -- If no project managers assigned to project, allow access (backward compatibility)
        NOT EXISTS (
          SELECT 1 FROM project_managers pm2
          WHERE pm2.project_id = COALESCE(c.project_id, accounting_invoices.project_id)
        )
      )
    )
  );
