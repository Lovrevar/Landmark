/*
  # Add milestone tracking to wire payments

  1. Changes
    - Add `milestone_id` column to `wire_payments` table
    - Foreign key to `subcontractor_milestones` table
    - Nullable to support both milestone-based and manual payments
    - Add index for performance

  2. Notes
    - Existing payments will have NULL milestone_id (manual payments)
    - New payments can optionally be linked to milestones
    - When a payment is linked to a milestone, the milestone status is updated
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wire_payments' AND column_name = 'milestone_id'
  ) THEN
    ALTER TABLE wire_payments ADD COLUMN milestone_id uuid REFERENCES subcontractor_milestones(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_wire_payments_milestone_id ON wire_payments(milestone_id);
  END IF;
END $$;