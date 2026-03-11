/*
  # Make apartment_id nullable in apartment_payments

  1. Changes
    - Alter `apartment_payments` table to make `apartment_id` nullable
    - This allows payments to be recorded for garage or storage only without requiring an apartment
  
  2. Reasoning
    - When a customer pays for multiple units (apartment, garage, storage) separately,
      we need to create individual payment records for each unit
    - Some payments may only be for garage or storage, so apartment_id should be optional
*/

ALTER TABLE apartment_payments 
ALTER COLUMN apartment_id DROP NOT NULL;
