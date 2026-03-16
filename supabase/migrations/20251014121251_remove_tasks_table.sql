/*
  # Remove tasks table and related functionality

  This migration removes the tasks table from the database as task functionality
  has been removed from the application.

  ## Changes
  - Drop tasks table
  
  ## Notes
  - This is a destructive operation
  - Task data will be permanently deleted
*/

DROP TABLE IF EXISTS tasks CASCADE;