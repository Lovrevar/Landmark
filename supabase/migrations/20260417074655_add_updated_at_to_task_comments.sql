/*
  # Add updated_at column to task_comments

  1. Changes
    - Adds `updated_at` timestamptz column to `task_comments` with default now()
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_comments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE task_comments ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;
