/*
  # Insert Demo User Accounts

  1. Demo Users
    - `director` with password `pass123` and role `Director`
    - `accountant` with password `pass123` and role `Accounting`
    - `salesperson` with password `pass123` and role `Sales`
    - `supervisor` with password `pass123` and role `Supervision`

  2. Purpose
    - Provides working demo accounts for testing the application
    - Allows immediate login without manual user creation
    - Supports all four role types defined in the system
*/

INSERT INTO users (username, password, role) VALUES
  ('director', 'pass123', 'Director'),
  ('accountant', 'pass123', 'Accounting'),
  ('salesperson', 'pass123', 'Sales'),
  ('supervisor', 'pass123', 'Supervision')
ON CONFLICT (username) DO NOTHING;