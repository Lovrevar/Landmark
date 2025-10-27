/*
  # Create Payment Notifications System

  ## Summary
  This migration creates a comprehensive payment notification system for bank credit repayments.
  It includes tables for tracking payment schedules, triggers for automatic schedule generation,
  and functions to calculate payment due dates based on credit terms.

  ## New Tables

  ### payment_notifications
  - `id` (uuid, primary key) - Unique notification identifier
  - `bank_credit_id` (uuid, foreign key) - Reference to the bank credit
  - `bank_id` (uuid, foreign key) - Reference to the bank receiving payment
  - `due_date` (date) - When payment is due
  - `amount` (numeric) - Payment amount due
  - `status` (text) - Notification status: 'pending', 'completed', 'dismissed', 'overdue'
  - `notification_type` (text) - Type: 'first_payment', 'recurring', 'final_payment'
  - `payment_number` (integer) - Sequential payment number in the schedule
  - `dismissed_at` (timestamptz, nullable) - When notification was dismissed
  - `dismissed_by` (uuid, nullable) - User who dismissed notification
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Functions

  ### calculate_payment_schedule
  Generates a complete payment schedule for a bank credit based on:
  - Start date + grace period = first payment date
  - Repayment type (monthly/yearly) determines interval
  - Continues until maturity date or credit is fully repaid

  ### update_notification_status
  Automatically updates notification status:
  - Marks as 'overdue' when due_date has passed
  - Marks as 'completed' when payment is recorded

  ## Triggers

  ### generate_payment_schedule_on_credit_insert
  Automatically creates payment notifications when a new bank credit is added

  ### update_notifications_on_payment
  Updates notification status when a wire payment is recorded

  ## Security
  - Enable RLS on payment_notifications table
  - Add policies for authenticated users to:
    - SELECT all notifications
    - INSERT notifications (for system/triggers)
    - UPDATE notifications (to dismiss or mark completed)
    - DELETE notifications (cleanup)

  ## Indexes
  - Index on bank_credit_id for fast credit lookups
  - Index on bank_id for filtering by bank
  - Index on due_date for chronological queries
  - Index on status for filtering active notifications
  - Composite index on (due_date, status) for dashboard queries
*/

-- Create payment_notifications table
CREATE TABLE IF NOT EXISTS payment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_credit_id uuid REFERENCES bank_credits(id) ON DELETE CASCADE NOT NULL,
  bank_id uuid REFERENCES banks(id) ON DELETE CASCADE NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed', 'overdue')),
  notification_type text NOT NULL DEFAULT 'recurring' CHECK (notification_type IN ('first_payment', 'recurring', 'final_payment')),
  payment_number integer NOT NULL DEFAULT 1,
  dismissed_at timestamptz,
  dismissed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view all payment notifications"
  ON payment_notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert payment notifications"
  ON payment_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payment notifications"
  ON payment_notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete payment notifications"
  ON payment_notifications FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_notifications_bank_credit_id ON payment_notifications(bank_credit_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_bank_id ON payment_notifications(bank_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_due_date ON payment_notifications(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_status ON payment_notifications(status);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_due_status ON payment_notifications(due_date, status);

-- Function to generate payment schedule for a bank credit
CREATE OR REPLACE FUNCTION generate_payment_schedule(credit_id uuid)
RETURNS void AS $$
DECLARE
  credit_record RECORD;
  first_payment_date date;
  current_payment_date date;
  payment_counter integer := 1;
  total_payments integer;
  interval_type text;
BEGIN
  SELECT * INTO credit_record
  FROM bank_credits
  WHERE id = credit_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  first_payment_date := credit_record.start_date + (credit_record.grace_period || ' months')::interval;

  IF credit_record.repayment_type = 'monthly' THEN
    interval_type := '1 month';
    IF credit_record.maturity_date IS NOT NULL THEN
      total_payments := EXTRACT(YEAR FROM AGE(credit_record.maturity_date, first_payment_date)) * 12 +
                       EXTRACT(MONTH FROM AGE(credit_record.maturity_date, first_payment_date));
    ELSE
      total_payments := 120;
    END IF;
  ELSE
    interval_type := '1 year';
    IF credit_record.maturity_date IS NOT NULL THEN
      total_payments := EXTRACT(YEAR FROM AGE(credit_record.maturity_date, first_payment_date));
    ELSE
      total_payments := 10;
    END IF;
  END IF;

  DELETE FROM payment_notifications WHERE bank_credit_id = credit_id;

  current_payment_date := first_payment_date;
  
  WHILE payment_counter <= total_payments AND 
        (credit_record.maturity_date IS NULL OR current_payment_date <= credit_record.maturity_date) LOOP
    
    INSERT INTO payment_notifications (
      bank_credit_id,
      bank_id,
      due_date,
      amount,
      status,
      notification_type,
      payment_number
    ) VALUES (
      credit_id,
      credit_record.bank_id,
      current_payment_date,
      credit_record.monthly_payment,
      'pending',
      CASE 
        WHEN payment_counter = 1 THEN 'first_payment'
        WHEN payment_counter = total_payments THEN 'final_payment'
        ELSE 'recurring'
      END,
      payment_counter
    );

    current_payment_date := current_payment_date + interval_type::interval;
    payment_counter := payment_counter + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update overdue notifications
CREATE OR REPLACE FUNCTION update_overdue_notifications()
RETURNS void AS $$
BEGIN
  UPDATE payment_notifications
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending' 
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to generate payment schedule when new credit is inserted
CREATE OR REPLACE FUNCTION trigger_generate_payment_schedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM generate_payment_schedule(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_payment_schedule_on_credit_insert ON bank_credits;
CREATE TRIGGER generate_payment_schedule_on_credit_insert
  AFTER INSERT ON bank_credits
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_payment_schedule();

-- Trigger to update payment schedule when credit is updated
CREATE OR REPLACE FUNCTION trigger_update_payment_schedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount != OLD.amount OR 
     NEW.interest_rate != OLD.interest_rate OR
     NEW.start_date != OLD.start_date OR
     NEW.maturity_date != OLD.maturity_date OR
     NEW.grace_period != OLD.grace_period OR
     NEW.repayment_type != OLD.repayment_type OR
     NEW.monthly_payment != OLD.monthly_payment THEN
    PERFORM generate_payment_schedule(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_payment_schedule_on_credit_update ON bank_credits;
CREATE TRIGGER update_payment_schedule_on_credit_update
  AFTER UPDATE ON bank_credits
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_payment_schedule();

-- Trigger to mark notifications as completed when payment is recorded
CREATE OR REPLACE FUNCTION trigger_mark_notification_completed()
RETURNS TRIGGER AS $$
DECLARE
  target_notification_id uuid;
BEGIN
  SELECT id INTO target_notification_id
  FROM payment_notifications
  WHERE bank_credit_id IN (
    SELECT id FROM bank_credits WHERE bank_id = NEW.bank_id
  )
  AND status IN ('pending', 'overdue')
  ORDER BY due_date ASC
  LIMIT 1;
  
  IF target_notification_id IS NOT NULL THEN
    UPDATE payment_notifications
    SET status = 'completed', updated_at = now()
    WHERE id = target_notification_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mark_notification_completed_on_payment ON bank_credit_payments;
CREATE TRIGGER mark_notification_completed_on_payment
  AFTER INSERT ON bank_credit_payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_mark_notification_completed();

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_payment_notifications_updated_at ON payment_notifications;
CREATE TRIGGER update_payment_notifications_updated_at
  BEFORE UPDATE ON payment_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Generate schedules for all existing active credits
DO $$
DECLARE
  credit_rec RECORD;
BEGIN
  FOR credit_rec IN SELECT id FROM bank_credits WHERE status = 'active' LOOP
    PERFORM generate_payment_schedule(credit_rec.id);
  END LOOP;
END $$;