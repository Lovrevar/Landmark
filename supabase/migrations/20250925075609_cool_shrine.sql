/*
  # Create project_milestones table for tracking project progress

  1. New Tables
    - `project_milestones`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `name` (text, milestone description)
      - `due_date` (date, nullable)
      - `completed` (boolean, default false)
      - `order_index` (integer, for custom ordering)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `project_milestones` table
    - Add policy for authenticated users to access project milestones
*/

CREATE TABLE IF NOT EXISTS project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  due_date date,
  completed boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access project milestones"
  ON project_milestones
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);