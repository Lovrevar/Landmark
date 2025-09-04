/*
  # Add created_by field to tasks table

  1. Schema Changes
    - Add `created_by` column to `tasks` table to track who created each task
    - Set default value to 'director' for existing tasks
    - Allow tracking of task ownership for permission control

  2. Security
    - Maintains existing RLS policies
    - Enables proper permission control based on task creator

  3. Notes
    - This enables the director approval workflow for task completion
    - Users can update progress but only creators can mark tasks as completed
*/

-- Add created_by column to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tasks ADD COLUMN created_by text NOT NULL DEFAULT 'director';
  END IF;
END $$;