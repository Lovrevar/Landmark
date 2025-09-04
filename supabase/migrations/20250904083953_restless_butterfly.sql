/*
  # Insert comprehensive dummy data for construction management system

  1. Projects
    - 4 construction projects with different statuses and budgets
  
  2. Tasks
    - Multiple tasks assigned to different users with upcoming deadlines
    - Tasks will appear on calendar
  
  3. Subcontractors
    - Various specialized contractors with different progress levels
  
  4. Apartments
    - Residential units with different statuses (available, reserved, sold)
  
  5. Invoices
    - Mix of paid and unpaid invoices
  
  6. Todos
    - Personal tasks for each user with due dates for calendar display
*/

-- Insert Projects
INSERT INTO projects (id, name, location, start_date, end_date, budget, investor, status) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Sunset Towers Residential Complex', 'Los Angeles, CA', '2024-03-01', '2025-12-31', 15000000.00, 'Pacific Investment Group', 'In Progress'),
('550e8400-e29b-41d4-a716-446655440002', 'Green Valley Office Park', 'Austin, TX', '2024-06-15', '2025-08-30', 8500000.00, 'Texas Development Corp', 'In Progress'),
('550e8400-e29b-41d4-a716-446655440003', 'Marina Bay Shopping Center', 'San Diego, CA', '2023-01-10', '2024-11-15', 12000000.00, 'Coastal Retail Partners', 'Completed'),
('550e8400-e29b-41d4-a716-446655440004', 'Tech Campus Phase 1', 'Seattle, WA', '2025-02-01', '2026-10-31', 22000000.00, 'Innovation Ventures LLC', 'Planning');

-- Insert Tasks with upcoming deadlines for calendar
INSERT INTO tasks (id, project_id, name, description, assigned_to, deadline, status, progress) VALUES
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Foundation Inspection', 'Complete foundation inspection for Building A', 'supervisor', '2025-01-15', 'In Progress', 75),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Electrical Rough-in', 'Install electrical wiring for floors 1-5', 'supervisor', '2025-01-20', 'Pending', 0),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'HVAC Installation', 'Install HVAC systems in office buildings', 'supervisor', '2025-01-25', 'In Progress', 40),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'Budget Review Meeting', 'Quarterly budget review with stakeholders', 'director', '2025-01-18', 'Pending', 0),
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', 'Sales Report Preparation', 'Prepare monthly sales report for residential units', 'salesperson', '2025-01-22', 'In Progress', 60),
('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'Final Invoice Processing', 'Process final invoices for completed project', 'accountant', '2025-01-16', 'Pending', 0),
('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440004', 'Site Survey', 'Conduct detailed site survey for new campus', 'supervisor', '2025-01-30', 'Pending', 0),
('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001', 'Plumbing Inspection', 'Inspect plumbing systems in residential units', 'supervisor', '2025-02-05', 'Pending', 0),
('660e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440002', 'Landscaping Design Review', 'Review and approve landscaping designs', 'director', '2025-02-10', 'Pending', 0),
('660e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001', 'Unit Showings', 'Conduct showings for potential buyers', 'salesperson', '2025-02-15', 'Pending', 0);

-- Insert Subcontractors
INSERT INTO subcontractors (id, name, contact, job_description, progress, deadline, cost) VALUES
('770e8400-e29b-41d4-a716-446655440001', 'Elite Electrical Solutions', 'john@eliteelectrical.com', 'Complete electrical installation for all residential units', 65, '2025-03-15', 450000.00),
('770e8400-e29b-41d4-a716-446655440002', 'Premier Plumbing Co', 'mike@premierplumbing.com', 'Install plumbing systems and fixtures', 80, '2025-02-28', 320000.00),
('770e8400-e29b-41d4-a716-446655440003', 'Climate Control HVAC', 'sarah@climatecontrol.com', 'HVAC installation and ventilation systems', 45, '2025-04-10', 680000.00),
('770e8400-e29b-41d4-a716-446655440004', 'GreenScape Landscaping', 'tom@greenscape.com', 'Landscaping and outdoor area development', 30, '2025-05-20', 180000.00),
('770e8400-e29b-41d4-a716-446655440005', 'Solid Foundation Concrete', 'lisa@solidfoundation.com', 'Concrete work and foundation reinforcement', 90, '2025-01-31', 520000.00),
('770e8400-e29b-41d4-a716-446655440006', 'SecureGuard Systems', 'david@secureguard.com', 'Security system installation and monitoring setup', 25, '2025-06-15', 95000.00);

-- Insert Apartments
INSERT INTO apartments (id, project_id, number, floor, size_m2, price, status, buyer_name) VALUES
('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'A101', 1, 85.50, 425000.00, 'Sold', 'Jennifer Martinez'),
('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'A102', 1, 92.30, 465000.00, 'Available', NULL),
('880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'A201', 2, 78.20, 395000.00, 'Reserved', 'Michael Chen'),
('880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'A202', 2, 88.75, 445000.00, 'Sold', 'Sarah Johnson'),
('880e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', 'A301', 3, 95.60, 485000.00, 'Available', NULL),
('880e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', 'A302', 3, 82.40, 415000.00, 'Available', NULL),
('880e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', 'B101', 1, 105.20, 525000.00, 'Sold', 'Robert Williams'),
('880e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001', 'B102', 1, 98.80, 495000.00, 'Reserved', 'Emily Davis'),
('880e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440001', 'B201', 2, 110.50, 555000.00, 'Available', NULL),
('880e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001', 'B202', 2, 87.90, 440000.00, 'Sold', 'James Thompson');

-- Insert Invoices
INSERT INTO invoices (id, project_id, amount, due_date, paid, subcontractor_id) VALUES
('990e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 125000.00, '2025-01-20', false, '770e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 85000.00, '2025-01-15', true, '770e8400-e29b-41d4-a716-446655440002'),
('990e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 95000.00, '2025-01-25', false, '770e8400-e29b-41d4-a716-446655440003'),
('990e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 45000.00, '2025-02-01', false, '770e8400-e29b-41d4-a716-446655440004'),
('990e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 180000.00, '2024-12-15', true, '770e8400-e29b-41d4-a716-446655440005'),
('990e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440002', 32000.00, '2025-01-30', true, '770e8400-e29b-41d4-a716-446655440006'),
('990e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', 67000.00, '2024-12-20', true, NULL),
('990e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440004', 150000.00, '2025-02-15', false, NULL),
('990e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440002', 78000.00, '2025-01-10', true, '770e8400-e29b-41d4-a716-446655440001');

-- Insert Todos for each user with calendar dates
-- Director todos
INSERT INTO todos (user_id, title, description, completed, due_date) VALUES
((SELECT id FROM users WHERE username = 'director'), 'Review Q1 Budget Reports', 'Analyze quarterly budget performance across all projects', false, '2025-01-17'),
((SELECT id FROM users WHERE username = 'director'), 'Board Meeting Preparation', 'Prepare presentation for monthly board meeting', false, '2025-01-24'),
((SELECT id FROM users WHERE username = 'director'), 'Strategic Planning Session', 'Plan company strategy for next quarter', false, '2025-02-03'),
((SELECT id FROM users WHERE username = 'director'), 'Site Visit - Sunset Towers', 'Conduct monthly site inspection', false, '2025-01-28'),
((SELECT id FROM users WHERE username = 'director'), 'Review Safety Protocols', 'Update and review safety protocols across all sites', true, '2025-01-10');

-- Accountant todos
INSERT INTO todos (user_id, title, description, completed, due_date) VALUES
((SELECT id FROM users WHERE username = 'accountant'), 'Process Monthly Invoices', 'Review and process all pending invoices', false, '2025-01-19'),
((SELECT id FROM users WHERE username = 'accountant'), 'Tax Document Preparation', 'Prepare quarterly tax documents', false, '2025-01-31'),
((SELECT id FROM users WHERE username = 'accountant'), 'Expense Report Analysis', 'Analyze project expense reports for budget variance', false, '2025-01-26'),
((SELECT id FROM users WHERE username = 'accountant'), 'Audit Preparation', 'Prepare documents for annual audit', false, '2025-02-07'),
((SELECT id FROM users WHERE username = 'accountant'), 'Payroll Processing', 'Process bi-weekly payroll for all employees', true, '2025-01-12');

-- Salesperson todos
INSERT INTO todos (user_id, title, description, completed, due_date) VALUES
((SELECT id FROM users WHERE username = 'salesperson'), 'Client Follow-up Calls', 'Follow up with potential apartment buyers', false, '2025-01-21'),
((SELECT id FROM users WHERE username = 'salesperson'), 'Marketing Material Update', 'Update brochures and marketing materials', false, '2025-01-29'),
((SELECT id FROM users WHERE username = 'salesperson'), 'Open House Event', 'Organize open house for Sunset Towers', false, '2025-02-01'),
((SELECT id FROM users WHERE username = 'salesperson'), 'Sales Report Compilation', 'Compile monthly sales performance report', false, '2025-02-05'),
((SELECT id FROM users WHERE username = 'salesperson'), 'CRM Database Update', 'Update customer relationship management database', true, '2025-01-08');

-- Supervisor todos
INSERT INTO todos (user_id, title, description, completed, due_date) VALUES
((SELECT id FROM users WHERE username = 'supervisor'), 'Safety Inspection Round', 'Conduct weekly safety inspection of all active sites', false, '2025-01-23'),
((SELECT id FROM users WHERE username = 'supervisor'), 'Subcontractor Meeting', 'Weekly coordination meeting with all subcontractors', false, '2025-01-27'),
((SELECT id FROM users WHERE username = 'supervisor'), 'Quality Control Check', 'Perform quality control inspection on completed work', false, '2025-02-04'),
((SELECT id FROM users WHERE username = 'supervisor'), 'Equipment Maintenance', 'Schedule maintenance for construction equipment', false, '2025-02-08'),
((SELECT id FROM users WHERE username = 'supervisor'), 'Progress Report Update', 'Update project progress reports for all active projects', true, '2025-01-11');