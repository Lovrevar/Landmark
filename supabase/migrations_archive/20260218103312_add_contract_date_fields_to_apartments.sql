/*
  # Add Contract Date Fields to Apartments

  ## Summary
  Adds optional contract and payment schedule date fields to the apartments table.
  These fields track the pre-contract signing date and instalment/credit payment milestones.

  ## New Columns
  - `datum_potpisa_predugovora` (date, nullable) - Date the pre-contract was signed
  - `contract_payment_type` (text, nullable) - Either 'credit' or 'installments'
  - `kapara_10_posto` (date, nullable) - 10% deposit payment date (both types)
  - `rata_1_ab_konstrukcija_30` (date, nullable) - 1st installment: AB construction 30% (installments only)
  - `rata_2_postava_stolarije_20` (date, nullable) - 2nd installment: window installation 20% (installments only)
  - `rata_3_obrtnicki_radovi_20` (date, nullable) - 3rd installment: craft works 20% (installments only)
  - `rata_4_uporabna_20` (date, nullable) - 4th installment: occupancy permit 20% (installments only)
  - `kredit_etaziranje_90` (date, nullable) - Credit: cadastral subdivision 90% or less (credit only)

  ## Notes
  - All fields are nullable — contract info is optional per apartment
  - No RLS changes needed (inherits existing apartment policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'datum_potpisa_predugovora'
  ) THEN
    ALTER TABLE apartments ADD COLUMN datum_potpisa_predugovora date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'contract_payment_type'
  ) THEN
    ALTER TABLE apartments ADD COLUMN contract_payment_type text CHECK (contract_payment_type IN ('credit', 'installments'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'kapara_10_posto'
  ) THEN
    ALTER TABLE apartments ADD COLUMN kapara_10_posto date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'rata_1_ab_konstrukcija_30'
  ) THEN
    ALTER TABLE apartments ADD COLUMN rata_1_ab_konstrukcija_30 date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'rata_2_postava_stolarije_20'
  ) THEN
    ALTER TABLE apartments ADD COLUMN rata_2_postava_stolarije_20 date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'rata_3_obrtnicki_radovi_20'
  ) THEN
    ALTER TABLE apartments ADD COLUMN rata_3_obrtnicki_radovi_20 date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'rata_4_uporabna_20'
  ) THEN
    ALTER TABLE apartments ADD COLUMN rata_4_uporabna_20 date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'kredit_etaziranje_90'
  ) THEN
    ALTER TABLE apartments ADD COLUMN kredit_etaziranje_90 date;
  END IF;
END $$;
