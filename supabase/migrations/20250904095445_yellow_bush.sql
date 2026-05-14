

CREATE TABLE IF NOT EXISTS subcontractor_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  comment_type text DEFAULT 'general' CHECK (comment_type IN ('completed', 'issue', 'general')),
  created_at timestamptz DEFAULT now()
);


ALTER TABLE subcontractor_comments DISABLE ROW LEVEL SECURITY;
;