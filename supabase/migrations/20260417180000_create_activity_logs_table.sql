-- Activity Logs table
-- Immutable audit trail for all user actions across the platform.
-- SELECT restricted to Director role; INSERT open to all authenticated users.
-- No UPDATE or DELETE policies — logs are permanent.

CREATE TABLE activity_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_role   text        NOT NULL,
  action      text        NOT NULL,
  entity      text        NOT NULL,
  entity_id   uuid,
  project_id  uuid        REFERENCES projects(id) ON DELETE SET NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes

CREATE INDEX idx_activity_logs_created_at
  ON activity_logs (created_at DESC);

CREATE INDEX idx_activity_logs_user_id
  ON activity_logs (user_id);

CREATE INDEX idx_activity_logs_action
  ON activity_logs (action text_pattern_ops);

CREATE INDEX idx_activity_logs_project_id
  ON activity_logs (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX idx_activity_logs_created_action
  ON activity_logs (created_at DESC, action);

-- RLS

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Director can select activity_logs"
  ON activity_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));

CREATE POLICY "Authenticated users can insert activity_logs"
  ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (true);
