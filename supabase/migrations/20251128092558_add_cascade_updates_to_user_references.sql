/*
  # Add ON UPDATE CASCADE to User Foreign Keys

  1. Problem
    - Foreign keys referencing users.id don't have ON UPDATE CASCADE
    - This prevents us from updating user IDs to sync with auth.users
    
  2. Solution
    - Drop and recreate foreign key constraints with ON UPDATE CASCADE
    - This allows user ID updates to propagate to all related tables
    
  3. Tables affected
    - project_managers
    - Any other tables with user_id foreign keys
*/

-- First, find all foreign keys pointing to users table
DO $$
DECLARE
    fk_record RECORD;
BEGIN
    FOR fk_record IN 
        SELECT 
            tc.table_name,
            tc.constraint_name,
            kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'users'
            AND tc.table_schema = 'public'
    LOOP
        -- Drop the old constraint
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',
            fk_record.table_name,
            fk_record.constraint_name
        );
        
        -- Recreate with ON UPDATE CASCADE
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE',
            fk_record.table_name,
            fk_record.constraint_name,
            fk_record.column_name
        );
    END LOOP;
END $$;
