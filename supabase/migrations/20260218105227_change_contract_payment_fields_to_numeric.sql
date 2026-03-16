/*
  # Change contract payment fields from date to numeric

  ## Summary
  The payment schedule fields on the apartments table (kapara_10_posto,
  rata_1_ab_konstrukcija_30, rata_2_postava_stolarije_20,
  rata_3_obrtnicki_radovi_20, rata_4_uporabna_20, kredit_etaziranje_90)
  were previously storing dates. They are being changed to store monetary
  amounts (EUR) instead.

  ## Changes
  - Drop old date columns
  - Add new numeric columns with the same names to store EUR amounts

  ## Notes
  - Existing date data will be lost (columns are dropped and recreated)
  - New columns use NUMERIC(12,2) to store currency amounts
*/

ALTER TABLE apartments
  DROP COLUMN IF EXISTS kapara_10_posto,
  DROP COLUMN IF EXISTS rata_1_ab_konstrukcija_30,
  DROP COLUMN IF EXISTS rata_2_postava_stolarije_20,
  DROP COLUMN IF EXISTS rata_3_obrtnicki_radovi_20,
  DROP COLUMN IF EXISTS rata_4_uporabna_20,
  DROP COLUMN IF EXISTS kredit_etaziranje_90;

ALTER TABLE apartments
  ADD COLUMN IF NOT EXISTS kapara_10_posto NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS rata_1_ab_konstrukcija_30 NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS rata_2_postava_stolarije_20 NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS rata_3_obrtnicki_radovi_20 NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS rata_4_uporabna_20 NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS kredit_etaziranje_90 NUMERIC(12,2);
