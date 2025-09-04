/*
  # Create subcontractor comments table

  1. New Tables
    - `subcontractor_comments`
      - `id` (uuid, primary key)
      - `subcontractor_id` (uuid, foreign key to subcontractors)
      - `user_id` (uuid, foreign key to users)
      - `comment` (text)
      - `comment_type` (text) - 'completed', 'issue', 'general'
      - `created_at` (timestamp)

  2. Security
    - Disable RLS for authenticated access
    - Add foreign key constraints
*/

CREATE TABLE IF NOT EXISTS subcontractor_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  comment_type text DEFAULT 'general' CHECK (comment_type IN ('completed', 'issue', 'general')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subcontractor_comments DISABLE ROW LEVEL SECURITY;