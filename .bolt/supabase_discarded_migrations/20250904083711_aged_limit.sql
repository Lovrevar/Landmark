/*
  # Create dummy data for construction company

  1. Projects
    - 4 construction projects with realistic details
    - Different statuses and timelines
    - Varying budgets and locations

  2. Tasks
    - Multiple tasks per project
    - Assigned to different users
    - Various completion statuses

  3. Subcontractors
    - Different specialties (electrical, plumbing, etc.)
    - Various progress levels and costs

  4. Apartments
    - Multiple units per residential project
    - Different sizes, floors, and prices
    - Various sales statuses

  5. Invoices
    - Project-related expenses
    - Some paid, some pending
    - Realistic amounts and due dates

  6. Todos
    - Personal tasks for each user
    - Mix of completed and pending items
*/

-- Insert Projects
INSERT INTO projects (id, name, location, start_date, end_date, budget, investor, status) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Sunset Towers Residential Complex', 'Downtown Los Angeles, CA', '2024-01-15', '2025-12-31', 15000000.00, 'Pacific Investment Group', 'In Progress'),
('550e8400-e29b-41d4-a716-446655440002', 'Green Valley Office Park', 'Austin, TX', '2024-06-01', '2026-03-15', 8500000.00, 'Texas Development Corp', 'In Progress'),
('550e8400-e29b-41d4-a716-446655440003', 'Marina Bay Shopping Center', 'San Diego, CA', '2023-03-01', '2024-11-30', 12000000.00, 'Coastal Retail Ventures', 'Completed'),
('550e8400-e29b-41d4-a716-446655440004', 'Tech Campus Phase 1', 'Seattle, WA', '2025-02-01', '2026-08-31', 22000000.00, 'Innovation Partners LLC', 'Planning');

-- Insert Tasks
INSERT INTO tasks (project_id, name, description, assigned_to, deadline, status, progress) VALUES
-- Sunset Towers tasks
('550e8400-e29b-41d4-a716-446655440001', 'Foundation Excavation', 'Complete excavation and foundation work for towers A and B', 'supervisor', '2024-03-15', 'Completed', 100),
('550e8400-e29b-41d4-a716-446655440001', 'Steel Frame Installation', 'Install structural steel framework for both towers', 'supervisor', '2024-08-30', 'In Progress', 75),
('550e8400-e29b-41d4-a716-446655440001', 'Electrical Systems Planning', 'Design and plan electrical systems for residential units', 'director', '2024-12-01', 'In Progress', 60),
('550e8400-e29b-41d4-a716-446655440001', 'Unit Sales Marketing', 'Launch marketing campaign for pre-sales', 'salesperson', '2024-10-15', 'In Progress', 40),

-- Green Valley Office Park tasks
('550e8400-e29b-41d4-a716-446655440002', 'Site Preparation', 'Clear and prepare construction site', 'supervisor', '2024-07-15', 'Completed', 100),
('550e8400-e29b-41d4-a716-446655440002', 'Building A Construction', 'Complete construction of first office building', 'supervisor', '2025-01-31', 'In Progress', 45),
('550e8400-e29b-41d4-a716-446655440002', 'Parking Structure', 'Build multi-level parking garage', 'supervisor', '2025-06-30', 'Pending', 0),
('550e8400-e29b-41d4-a716-446655440002', 'Tenant Acquisition', 'Secure office space tenants', 'salesperson', '2025-08-01', 'Pending', 15),

-- Marina Bay Shopping Center tasks (completed project)
('550e8400-e29b-41d4-a716-446655440003', 'Retail Space Construction', 'Complete all retail spaces and common areas', 'supervisor', '2024-09-30', 'Completed', 100),
('550e8400-e29b-41d4-a716-446655440003', 'Store Lease Agreements', 'Finalize lease agreements with major retailers', 'salesperson', '2024-10-15', 'Completed', 100),
('550e8400-e29b-41d4-a716-446655440003', 'Final Inspections', 'Complete all building inspections and certifications', 'director', '2024-11-15', 'Completed', 100),

-- Tech Campus tasks (planning phase)
('550e8400-e29b-41d4-a716-446655440004', 'Environmental Impact Study', 'Complete environmental assessment and permits', 'director', '2025-04-01', 'Pending', 25),
('550e8400-e29b-41d4-a716-446655440004', 'Architectural Design', 'Finalize building designs and blueprints', 'director', '2025-05-15', 'Pending', 10),
('550e8400-e29b-41d4-a716-446655440004', 'Contractor Selection', 'Select and contract primary construction teams', 'supervisor', '2025-06-01', 'Pending', 0);

-- Insert Subcontractors
INSERT INTO subcontractors (name, contact, job_description, progress, deadline, cost) VALUES
('Elite Electrical Solutions', 'mike@eliteelectrical.com', 'Complete electrical installation for Sunset Towers including wiring, panels, and smart home systems', 85, '2024-11-30', 450000.00),
('Premier Plumbing Co.', 'sarah@premierplumbing.com', 'Install all plumbing systems, fixtures, and water management for Green Valley Office Park', 60, '2025-02-28', 320000.00),
('Skyline HVAC Systems', 'david@skylinehvac.com', 'Design and install climate control systems for Marina Bay Shopping Center', 100, '2024-10-31', 280000.00),
('Mountain View Landscaping', 'lisa@mvlandscaping.com', 'Complete exterior landscaping and irrigation for all active projects', 40, '2025-03-31', 150000.00),
('Precision Concrete Works', 'john@precisionconcrete.com', 'Foundation and structural concrete work for Tech Campus Phase 1', 15, '2025-07-15', 680000.00),
('Advanced Security Systems', 'alex@advancedsecurity.com', 'Install comprehensive security systems including cameras, access control, and monitoring', 70, '2024-12-15', 95000.00);

-- Insert Apartments (for residential projects)
INSERT INTO apartments (project_id, number, floor, size_m2, price, status, buyer_name) VALUES
-- Sunset Towers apartments
('550e8400-e29b-41d4-a716-446655440001', '101', 1, 85.5, 650000.00, 'Sold', 'Jennifer Martinez'),
('550e8400-e29b-41d4-a716-446655440001', '102', 1, 92.3, 720000.00, 'Reserved', NULL),
('550e8400-e29b-41d4-a716-446655440001', '103', 1, 78.2, 580000.00, 'Available', NULL),
('550e8400-e29b-41d4-a716-446655440001', '201', 2, 85.5, 670000.00, 'Sold', 'Robert Chen'),
('550e8400-e29b-41d4-a716-446655440001', '202', 2, 92.3, 740000.00, 'Available', NULL),
('550e8400-e29b-41d4-a716-446655440001', '203', 2, 78.2, 600000.00, 'Reserved', NULL),
('550e8400-e29b-41d4-a716-446655440001', '301', 3, 110.7, 890000.00, 'Available', NULL),
('550e8400-e29b-41d4-a716-446655440001', '302', 3, 110.7, 890000.00, 'Available', NULL),
('550e8400-e29b-41d4-a716-446655440001', '401', 4, 125.4, 1050000.00, 'Available', NULL),
('550e8400-e29b-41d4-a716-446655440001', '402', 4, 125.4, 1050000.00, 'Available', NULL);

-- Insert Invoices
INSERT INTO invoices (project_id, amount, due_date, paid, subcontractor_id) VALUES
-- Sunset Towers invoices
('550e8400-e29b-41d4-a716-446655440001', 125000.00, '2024-09-15', true, (SELECT id FROM subcontractors WHERE name = 'Elite Electrical Solutions')),
('550e8400-e29b-41d4-a716-446655440001', 85000.00, '2024-10-30', false, (SELECT id FROM subcontractors WHERE name = 'Advanced Security Systems')),
('550e8400-e29b-41d4-a716-446655440001', 45000.00, '2024-11-15', false, NULL),

-- Green Valley Office Park invoices
('550e8400-e29b-41d4-a716-446655440002', 95000.00, '2024-08-31', true, (SELECT id FROM subcontractors WHERE name = 'Premier Plumbing Co.')),
('550e8400-e29b-41d4-a716-446655440002', 67000.00, '2024-12-01', false, (SELECT id FROM subcontractors WHERE name = 'Mountain View Landscaping')),

-- Marina Bay Shopping Center invoices (completed project)
('550e8400-e29b-41d4-a716-446655440003', 280000.00, '2024-10-31', true, (SELECT id FROM subcontractors WHERE name = 'Skyline HVAC Systems')),
('550e8400-e29b-41d4-a716-446655440003', 35000.00, '2024-11-30', true, NULL),

-- Tech Campus invoices
('550e8400-e29b-41d4-a716-446655440004', 25000.00, '2025-01-15', false, NULL),
('550e8400-e29b-41d4-a716-446655440004', 102000.00, '2025-03-01', false, (SELECT id FROM subcontractors WHERE name = 'Precision Concrete Works'));

-- Insert Todos for each user
INSERT INTO todos (user_id, title, description, completed, due_date) VALUES
-- Director todos
((SELECT id FROM users WHERE username = 'director'), 'Review Q4 Budget Reports', 'Analyze quarterly financial performance across all projects', false, '2024-10-15'),
((SELECT id FROM users WHERE username = 'director'), 'Board Meeting Preparation', 'Prepare presentation for monthly board meeting', true, '2024-09-20'),
((SELECT id FROM users WHERE username = 'director'), 'Tech Campus Permits', 'Follow up on environmental permits for Seattle project', false, '2024-10-30'),
((SELECT id FROM users WHERE username = 'director'), 'Staff Performance Reviews', 'Complete annual performance reviews for department heads', false, '2024-11-30'),

-- Accountant todos
((SELECT id FROM users WHERE username = 'accountant'), 'Process Contractor Payments', 'Review and process pending subcontractor invoices', false, '2024-10-10'),
((SELECT id FROM users WHERE username = 'accountant'), 'Tax Documentation', 'Prepare quarterly tax filings and documentation', true, '2024-09-30'),
((SELECT id FROM users WHERE username = 'accountant'), 'Budget Variance Analysis', 'Analyze budget vs actual spending for active projects', false, '2024-10-20'),
((SELECT id FROM users WHERE username = 'accountant'), 'Insurance Renewal', 'Review and renew project insurance policies', false, '2024-11-15'),

-- Salesperson todos
((SELECT id FROM users WHERE username = 'salesperson'), 'Sunset Towers Open House', 'Organize weekend open house for available units', false, '2024-10-12'),
((SELECT id FROM users WHERE username = 'salesperson'), 'Client Follow-ups', 'Follow up with potential buyers from last weeks showings', true, '2024-10-05'),
((SELECT id FROM users WHERE username = 'salesperson'), 'Marketing Materials Update', 'Update brochures and website with latest unit availability', false, '2024-10-18'),
((SELECT id FROM users WHERE username = 'salesperson'), 'Broker Relationships', 'Meet with top real estate brokers to discuss partnerships', false, '2024-10-25'),

-- Supervisor todos
((SELECT id FROM users WHERE username = 'supervisor'), 'Safety Inspection', 'Conduct weekly safety inspection at all active sites', false, '2024-10-08'),
((SELECT id FROM users WHERE username = 'supervisor'), 'Equipment Maintenance', 'Schedule maintenance for construction equipment', true, '2024-10-01'),
((SELECT id FROM users WHERE username = 'supervisor'), 'Subcontractor Coordination', 'Coordinate schedules between electrical and plumbing teams', false, '2024-10-15'),
((SELECT id FROM users WHERE username = 'supervisor'), 'Material Delivery Schedule', 'Confirm delivery schedules for next weeks materials', false, '2024-10-11');