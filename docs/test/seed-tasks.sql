-- Seed data for the Tasks module + calendar overlay testing.
-- Paste into Supabase SQL editor. Safe to re-run (uses ON CONFLICT DO NOTHING on titles).
--
-- Picks the first 3 users (by created_at) and first 2 projects (by name) from the local DB.
-- If you need specific users/projects, replace the CTEs below with fixed UUIDs.
-- NOTE: task user columns hold AUTH user ids (schema shared with the mobile task app),
-- hence auth_user_id below.

WITH
  u AS (
    SELECT auth_user_id AS id, row_number() OVER (ORDER BY created_at) AS rn
    FROM users
    WHERE auth_user_id IS NOT NULL
    LIMIT 3
  ),
  p AS (
    SELECT id, row_number() OVER (ORDER BY name) AS rn
    FROM projects
    LIMIT 2
  ),
  u1 AS (SELECT id FROM u WHERE rn = 1),
  u2 AS (SELECT id FROM u WHERE rn = 2),
  u3 AS (SELECT id FROM u WHERE rn = 3),
  p1 AS (SELECT id FROM p WHERE rn = 1),
  p2 AS (SELECT id FROM p WHERE rn = 2),
  inserted AS (
    INSERT INTO tasks
      (title, description, created_by, deadline, due_time, completed,
       is_private, project_id, description_format)
    VALUES
      -- Overdue (10 days ago) — should render with red accent on calendar/list
      ('Prepare Q1 site inspection report',            '**Walkthrough notes** from the February visit.',
        (SELECT id FROM u1), CURRENT_DATE - 10, '09:00', FALSE, FALSE, (SELECT id FROM p1), 'markdown'),

      ('Draft subcontractor change order #42',         'Waiting on supervisor sign-off.',
        (SELECT id FROM u1), CURRENT_DATE - 7,  NULL,    FALSE, FALSE, (SELECT id FROM p1), 'markdown'),

      ('Order reinforcement steel batch',              'Use supplier ArcelorMittal; PO template saved.',
        (SELECT id FROM u2), CURRENT_DATE - 5,  '14:30', FALSE, FALSE, (SELECT id FROM p1), 'plain'),

      ('Close March accounts payable',                 'Split VAT lines per invoice before close.',
        (SELECT id FROM u2), CURRENT_DATE - 3,  NULL,    FALSE, FALSE, (SELECT id FROM p2), 'markdown'),

      ('Update retail parcel map for parcels 12–18',   '',
        (SELECT id FROM u3), CURRENT_DATE - 2,  '11:00', FALSE, FALSE, (SELECT id FROM p2), 'plain'),

      -- Due today (mix of statuses)
      ('Sync with sales on apartment B-304 payment',   'Client asked for extended plan — approve?',
        (SELECT id FROM u1), CURRENT_DATE,      '10:00', FALSE, FALSE, (SELECT id FROM p1), 'plain'),

      ('Post weekly progress photos',                  'Upload after 16:00 light check.',
        (SELECT id FROM u2), CURRENT_DATE,      '17:00', FALSE, FALSE, (SELECT id FROM p1), 'plain'),

      ('Review retail buyer KYC pack',                 '- Check ID expiry\n- Confirm proof of funds',
        (SELECT id FROM u3), CURRENT_DATE,      NULL,    FALSE, FALSE, (SELECT id FROM p2), 'markdown'),

      ('Finalize TIC cost allocation for March',       '',
        (SELECT id FROM u1), CURRENT_DATE,      '15:00', TRUE, FALSE, (SELECT id FROM p1), 'plain'),

      -- Tomorrow
      ('Call bank about drawdown schedule',            'Confirm next tranche timing.',
        (SELECT id FROM u2), CURRENT_DATE + 1,  '09:30', FALSE, FALSE, (SELECT id FROM p1), 'plain'),

      ('Email investor update — March results',        'Template in /docs/investor-updates/',
        (SELECT id FROM u1), CURRENT_DATE + 1,  NULL,    FALSE, FALSE, (SELECT id FROM p2), 'markdown'),

      -- Later this week
      ('Walkthrough of Block C — floors 3–5',          'Bring tablet for punch-list.',
        (SELECT id FROM u2), CURRENT_DATE + 3,  '10:00', FALSE, FALSE, (SELECT id FROM p1), 'plain'),

      ('Renew scaffolding insurance policy',           '',
        (SELECT id FROM u3), CURRENT_DATE + 4,  NULL,    FALSE, FALSE, (SELECT id FROM p1), 'plain'),

      ('Publish retail listing photos to website',     '~~Old set~~ replace with March reshoot.',
        (SELECT id FROM u1), CURRENT_DATE + 5,  '12:00', FALSE, FALSE, (SELECT id FROM p2), 'markdown'),

      -- Next week
      ('Quarterly supervisor 1:1',                     '',
        (SELECT id FROM u1), CURRENT_DATE + 7,  '14:00', FALSE, FALSE, (SELECT id FROM p1), 'plain'),

      ('Reconcile petty cash for the site',            'Receipts in the shared drive.',
        (SELECT id FROM u2), CURRENT_DATE + 8,  NULL,    FALSE, FALSE, (SELECT id FROM p1), 'plain'),

      ('Schedule safety training refresher',           '- Book hall\n- Send calendar invites\n- Order handouts',
        (SELECT id FROM u3), CURRENT_DATE + 10, '09:00', FALSE, FALSE, (SELECT id FROM p1), 'markdown'),

      ('Prepare retail profitability slide for board', '',
        (SELECT id FROM u1), CURRENT_DATE + 12, '16:00', FALSE, FALSE, (SELECT id FROM p2), 'plain'),

      -- Done / completed
      ('Deploy accounting hotfix 1.8.3',               'Released Friday, no issues reported.',
        (SELECT id FROM u1), CURRENT_DATE - 14, '18:00', TRUE, FALSE, (SELECT id FROM p2), 'plain'),

      ('Switch on site camera 4',                      '',
        (SELECT id FROM u2), CURRENT_DATE - 12, NULL,    TRUE, FALSE, (SELECT id FROM p1), 'plain'),

      ('Close quarterly investor report',              'Sent to all shareholders.',
        (SELECT id FROM u3), CURRENT_DATE - 20, NULL,    TRUE, FALSE, (SELECT id FROM p2), 'markdown'),

      -- Private tasks (only visible to their creator)
      ('[Private] Prep 1:1 talking points',            'Raise compensation review discussion.',
        (SELECT id FROM u1), CURRENT_DATE + 2,  '08:45', FALSE, TRUE, NULL, 'plain'),

      ('[Private] Personal expense log — March',       '',
        (SELECT id FROM u2), CURRENT_DATE + 6,  NULL,    FALSE, TRUE, NULL, 'plain'),

      ('[Private] Vacation request draft',             'Target: late May, 10 days.',
        (SELECT id FROM u3), CURRENT_DATE + 14, NULL,    FALSE, TRUE, NULL, 'markdown'),

      -- No deadline (ambient backlog)
      ('Evaluate new project management plugin',       'Compare @tanstack vs. native solutions.',
        (SELECT id FROM u1), NULL,               NULL,    FALSE, FALSE, NULL, 'plain')
    ON CONFLICT DO NOTHING
    RETURNING id, title, created_by, is_private
  )

-- Assignees: spread each non-private task across 1–3 users.
INSERT INTO task_assignees (task_id, assignee_id, acknowledged_at)
SELECT i.id, u.id, NULL
FROM inserted i
CROSS JOIN u
WHERE i.is_private = FALSE
  AND (
    (i.title LIKE 'Prepare Q1%'          AND u.rn IN (2, 3))
 OR (i.title LIKE 'Draft subcontractor%' AND u.rn = 2)
 OR (i.title LIKE 'Order reinforcement%' AND u.rn IN (1, 3))
 OR (i.title LIKE 'Close March%'         AND u.rn IN (1, 3))
 OR (i.title LIKE 'Update retail parcel%' AND u.rn IN (1, 2))
 OR (i.title LIKE 'Sync with sales%'     AND u.rn = 3)
 OR (i.title LIKE 'Post weekly%'         AND u.rn = 1)
 OR (i.title LIKE 'Review retail buyer%' AND u.rn IN (1, 2))
 OR (i.title LIKE 'Finalize TIC%'        AND u.rn = 2)
 OR (i.title LIKE 'Call bank%'           AND u.rn IN (1, 3))
 OR (i.title LIKE 'Email investor%'      AND u.rn = 2)
 OR (i.title LIKE 'Walkthrough of Block%' AND u.rn IN (1, 3))
 OR (i.title LIKE 'Renew scaffolding%'   AND u.rn = 2)
 OR (i.title LIKE 'Publish retail listing%' AND u.rn = 3)
 OR (i.title LIKE 'Quarterly supervisor%' AND u.rn IN (2, 3))
 OR (i.title LIKE 'Reconcile petty cash%' AND u.rn = 1)
 OR (i.title LIKE 'Schedule safety%'     AND u.rn IN (1, 2))
 OR (i.title LIKE 'Prepare retail profitability%' AND u.rn IN (2, 3))
 OR (i.title LIKE 'Deploy accounting%'   AND u.rn = 3)
 OR (i.title LIKE 'Switch on site camera%' AND u.rn = 1)
 OR (i.title LIKE 'Close quarterly investor%' AND u.rn IN (1, 2))
 OR (i.title LIKE 'Evaluate new%'        AND u.rn IN (2, 3))
  );

-- Private tasks: creator is their own sole assignee, auto-acknowledged.
INSERT INTO task_assignees (task_id, assignee_id, acknowledged_at)
SELECT t.id, t.created_by, NOW()
FROM tasks t
WHERE t.is_private = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.assignee_id = t.created_by
  );

-- A handful of comments to exercise the thread + unread dot.
INSERT INTO task_comments (task_id, user_id, comment)
SELECT t.id, t.created_by, 'Kicking this off today — will update tomorrow.'
FROM tasks t
WHERE t.title = 'Draft subcontractor change order #42'
  AND NOT EXISTS (SELECT 1 FROM task_comments c WHERE c.task_id = t.id);

INSERT INTO task_comments (task_id, user_id, comment)
SELECT t.id, a.assignee_id, 'Can you cc me on the PO email?'
FROM tasks t
JOIN task_assignees a ON a.task_id = t.id
WHERE t.title = 'Order reinforcement steel batch'
  AND a.assignee_id <> t.created_by
LIMIT 1;

INSERT INTO task_comments (task_id, user_id, comment)
SELECT t.id, t.created_by, 'Done — closed the period, report attached in Cashflow.'
FROM tasks t
WHERE t.title = 'Finalize TIC cost allocation for March'
  AND NOT EXISTS (SELECT 1 FROM task_comments c WHERE c.task_id = t.id);

INSERT INTO task_comments (task_id, user_id, comment)
SELECT t.id, a.assignee_id, 'Great, thanks for the quick turnaround.'
FROM tasks t
JOIN task_assignees a ON a.task_id = t.id
WHERE t.title = 'Finalize TIC cost allocation for March'
  AND a.assignee_id <> t.created_by
LIMIT 1;
