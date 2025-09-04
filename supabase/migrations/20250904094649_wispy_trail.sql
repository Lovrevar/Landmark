/*
  # Create work logs table for tracking daily subcontractor work

  1. New Tables
    - `work_logs`
      - `id` (uuid, primary key)
      - `subcontractor_id` (uuid, foreign key to subcontractors)
      - `date` (date)
      - `workers_count` (integer)
      - `work_description` (text)
      - `hours_worked` (integer)
      - `notes` (text, optional)
      - `photos` (text array, optional)
      - `created_by` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `work_logs` table
    - Add policy for authenticated users to access work logs
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

ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access work logs"
  ON work_logs
  FOR ALL
  TO authenticated
  USING (true);