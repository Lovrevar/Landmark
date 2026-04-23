-- Seed data for the Tasks module + calendar overlay testing.
-- Paste into Supabase SQL editor. Safe to re-run (uses ON CONFLICT DO NOTHING on titles).
--
-- Picks the first 3 users (by created_at) and first 2 projects (by name) from the local DB.
-- If you need specific users/projects, replace the CTEs below with fixed UUIDs.

WITH
  u AS (
    SELECT id, row_number() OVER (ORDER BY created_at) AS rn
    FROM users
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
      (title, description, created_by, due_date, due_time, status, priority,
       is_private, project_id, reminder_offsets, description_format)
    VALUES
      -- Overdue (10 days ago) — should render with red accent on calendar/list
      ('Prepare Q1 site inspection report',            '**Walkthrough notes** from the February visit.',
        (SELECT id FROM u1), CURRENT_DATE - 10, '09:00', 'todo',        'high',   FALSE, (SELECT id FROM p1), ARRAY[60, 1440], 'markdown'),

      ('Draft subcontractor change order #42',         'Waiting on supervisor sign-off.',
        (SELECT id FROM u1), CURRENT_DATE - 7,  NULL,    'in_progress', 'urgent', FALSE, (SELECT id FROM p1), ARRAY[1440],    'markdown'),

      ('Order reinforcement steel batch',              'Use supplier ArcelorMittal; PO template saved.',
        (SELECT id FROM u2), CURRENT_DATE - 5,  '14:30', 'todo',        'high',   FALSE, (SELECT id FROM p1), ARRAY[60],      'plain'),

      ('Close March accounts payable',                 'Split VAT lines per invoice before close.',
        (SELECT id FROM u2), CURRENT_DATE - 3,  NULL,    'in_progress', 'normal', FALSE, (SELECT id FROM p2), ARRAY[]::int[], 'markdown'),

      ('Update retail parcel map for parcels 12–18',   '',
        (SELECT id FROM u3), CURRENT_DATE - 2,  '11:00', 'todo',        'normal', FALSE, (SELECT id FROM p2), ARRAY[15, 60],  'plain'),

      -- Due today (mix of statuses)
      ('Sync with sales on apartment B-304 payment',   'Client asked for extended plan — approve?',
        (SELECT id FROM u1), CURRENT_DATE,      '10:00', 'todo',        'urgent', FALSE, (SELECT id FROM p1), ARRAY[15],      'plain'),

      ('Post weekly progress photos',                  'Upload after 16:00 light check.',
        (SELECT id FROM u2), CURRENT_DATE,      '17:00', 'todo',        'normal', FALSE, (SELECT id FROM p1), ARRAY[60],      'plain'),

      ('Review retail buyer KYC pack',                 '- Check ID expiry\n- Confirm proof of funds',
        (SELECT id FROM u3), CURRENT_DATE,      NULL,    'in_progress', 'high',   FALSE, (SELECT id FROM p2), ARRAY[1440],    'markdown'),

      ('Finalize TIC cost allocation for March',       '',
        (SELECT id FROM u1), CURRENT_DATE,      '15:00', 'done',        'normal', FALSE, (SELECT id FROM p1), ARRAY[]::int[], 'plain'),

      -- Tomorrow
      ('Call bank about drawdown schedule',            'Confirm next tranche timing.',
        (SELECT id FROM u2), CURRENT_DATE + 1,  '09:30', 'todo',        'high',   FALSE, (SELECT id FROM p1), ARRAY[60],      'plain'),

      ('Email investor update — March results',        'Template in /docs/investor-updates/',
        (SELECT id FROM u1), CURRENT_DATE + 1,  NULL,    'todo',        'normal', FALSE, (SELECT id FROM p2), ARRAY[1440],    'markdown'),

      -- Later this week
      ('Walkthrough of Block C — floors 3–5',          'Bring tablet for punch-list.',
        (SELECT id FROM u2), CURRENT_DATE + 3,  '10:00', 'todo',        'normal', FALSE, (SELECT id FROM p1), ARRAY[60, 2880], 'plain'),

      ('Renew scaffolding insurance policy',           '',
        (SELECT id FROM u3), CURRENT_DATE + 4,  NULL,    'todo',        'high',   FALSE, (SELECT id FROM p1), ARRAY[1440],    'plain'),

      ('Publish retail listing photos to website',     '~~Old set~~ replace with March reshoot.',
        (SELECT id FROM u1), CURRENT_DATE + 5,  '12:00', 'in_progress', 'low',    FALSE, (SELECT id FROM p2), ARRAY[60],      'markdown'),

      -- Next week
      ('Quarterly supervisor 1:1',                     '',
        (SELECT id FROM u1), CURRENT_DATE + 7,  '14:00', 'todo',        'low',    FALSE, (SELECT id FROM p1), ARRAY[1440, 2880], 'plain'),

      ('Reconcile petty cash for the site',            'Receipts in the shared drive.',
        (SELECT id FROM u2), CURRENT_DATE + 8,  NULL,    'todo',        'normal', FALSE, (SELECT id FROM p1), ARRAY[]::int[], 'plain'),

      ('Schedule safety training refresher',           '- Book hall\n- Send calendar invites\n- Order handouts',
        (SELECT id FROM u3), CURRENT_DATE + 10, '09:00', 'todo',        'high',   FALSE, (SELECT id FROM p1), ARRAY[2880],    'markdown'),

      ('Prepare retail profitability slide for board', '',
        (SELECT id FROM u1), CURRENT_DATE + 12, '16:00', 'todo',        'urgent', FALSE, (SELECT id FROM p2), ARRAY[1440, 2880], 'plain'),

      -- Done / completed
      ('Deploy accounting hotfix 1.8.3',               'Released Friday, no issues reported.',
        (SELECT id FROM u1), CURRENT_DATE - 14, '18:00', 'done',        'high',   FALSE, (SELECT id FROM p2), ARRAY[]::int[], 'plain'),

      ('Switch on site camera 4',                      '',
        (SELECT id FROM u2), CURRENT_DATE - 12, NULL,    'done',        'low',    FALSE, (SELECT id FROM p1), ARRAY[]::int[], 'plain'),

      ('Close quarterly investor report',              'Sent to all shareholders.',
        (SELECT id FROM u3), CURRENT_DATE - 20, NULL,    'done',        'normal', FALSE, (SELECT id FROM p2), ARRAY[]::int[], 'markdown'),

      -- Private tasks (only visible to their creator)
      ('[Private] Prep 1:1 talking points',            'Raise compensation review discussion.',
        (SELECT id FROM u1), CURRENT_DATE + 2,  '08:45', 'todo',        'normal', TRUE,  NULL,                ARRAY[60],      'plain'),

      ('[Private] Personal expense log — March',       '',
        (SELECT id FROM u2), CURRENT_DATE + 6,  NULL,    'in_progress', 'low',    TRUE,  NULL,                ARRAY[]::int[], 'plain'),

      ('[Private] Vacation request draft',             'Target: late May, 10 days.',
        (SELECT id FROM u3), CURRENT_DATE + 14, NULL,    'todo',        'low',    TRUE,  NULL,                ARRAY[1440],    'markdown'),

      -- No due_date (ambient backlog)
      ('Evaluate new project management plugin',       'Compare @tanstack vs. native solutions.',
        (SELECT id FROM u1), NULL,               NULL,    'todo',        'low',    FALSE, NULL,                ARRAY[]::int[], 'plain')
    ON CONFLICT DO NOTHING
    RETURNING id, title, created_by, is_private
  )

-- Assignees: spread each non-private task across 1–3 users.
INSERT INTO task_assignees (task_id, user_id, acknowledged_at)
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
INSERT INTO task_assignees (task_id, user_id, acknowledged_at)
SELECT t.id, t.created_by, NOW()
FROM tasks t
WHERE t.is_private = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = t.created_by
  );

-- A handful of comments to exercise the thread + unread dot.
INSERT INTO task_comments (task_id, user_id, comment)
SELECT t.id, t.created_by, 'Kicking this off today — will update tomorrow.'
FROM tasks t
WHERE t.title = 'Draft subcontractor change order #42'
  AND NOT EXISTS (SELECT 1 FROM task_comments c WHERE c.task_id = t.id);

INSERT INTO task_comments (task_id, user_id, comment)
SELECT t.id, a.user_id, 'Can you cc me on the PO email?'
FROM tasks t
JOIN task_assignees a ON a.task_id = t.id
WHERE t.title = 'Order reinforcement steel batch'
  AND a.user_id <> t.created_by
LIMIT 1;

INSERT INTO task_comments (task_id, user_id, comment)
SELECT t.id, t.created_by, 'Done — closed the period, report attached in Cashflow.'
FROM tasks t
WHERE t.title = 'Finalize TIC cost allocation for March'
  AND NOT EXISTS (SELECT 1 FROM task_comments c WHERE c.task_id = t.id);

INSERT INTO task_comments (task_id, user_id, comment)
SELECT t.id, a.user_id, 'Great, thanks for the quick turnaround.'
FROM tasks t
JOIN task_assignees a ON a.task_id = t.id
WHERE t.title = 'Finalize TIC cost allocation for March'
  AND a.user_id <> t.created_by
LIMIT 1;
