/*
  # Create work logs table

  1. New Tables
    - `work_logs`
      - `id` (uuid, primary key)
      - `subcontractor_id` (uuid, foreign key to subcontractors)
      - `date` (date)
      - `workers_count` (integer, default 1)
      - `work_description` (text)
      - `hours_worked` (integer, default 8)
      - `notes` (text, optional)
      - `photos` (text array, optional)
      - `created_by` (text)
      - `created_at` (timestamp)
  2. Security
    - RLS is disabled for `work_logs` table to allow all operations
*/

CREATE TABLE IF NOT EXISTS work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  date date NOT NULL,
  workers_count integer NOT NULL DEFAULT 1,
  work_description text NOT NULL,
  hours_worked integer NOT NULL DEFAULT 8,
  notes text DEFAULT '',
  photos text[] DEFAULT '{}',
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS for work_logs table to allow all operations
ALTER TABLE work_logs DISABLE ROW LEVEL SECURITY;