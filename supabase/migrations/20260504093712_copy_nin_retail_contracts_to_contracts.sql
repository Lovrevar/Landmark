/*
  # Copy Nin retail_contracts into contracts (link to existing subcontractors)

  ## Overview
  Inserts contracts on project Nin-retail mirroring retail_contracts on the Nin
  retail_project. Subcontractor rows for these suppliers already exist in prod
  (created Feb 2026 with the same UPPERCASE 'LAST FIRST' names as retail), so this
  migration only creates the missing contract rows — no subcontractor rows are
  inserted.

  Source retail_project: 'a6693eed-6ffa-4e45-8dc3-ae97d1369c09' (Nin)
  Destination project  : 'a822883e-b709-435b-81a5-9ddb8d89c843' (Nin-retail)
  Destination phase    : 'f37884bc-0214-480c-ad06-27b04e8c4579'

  ## Selection
  Every retail_contract on Nin whose supplier matches a subcontractor that does
  NOT already have a contract on Nin-retail (the 12 Peroš-family + Marija/Ante
  rows are skipped — they're already done manually).

  Matching is by normalized name key (uppercase, whitespace-collapsed,
  word-sorted) so 'PATRK ANTE' ↔ 'Ante Patrk' resolves correctly.

  When two subcontractors share a normalized key (currently only
  'JB IVANA BABURIĆ KATALINIĆ' has 2 rows), we pick the one with the most total
  contracts (tiebreak by oldest created_at). This deterministically selects
  6e5a1821-… (1 contract on Precko Zapad) over d41a7ff2-… (0 contracts).

  ## Mapping (per the existing transferred-12 pattern)
  - id              : new UUID
  - contract_number : 'CNT-YYYY-NNNN-RRRRRR'
                       NNNN = sequential after current max for the year
                       RRRRRR = random 6-digit
  - project_id      : 'a822883e-b709-435b-81a5-9ddb8d89c843'
  - phase_id        : 'f37884bc-0214-480c-ad06-27b04e8c4579'
  - subcontractor_id: matched by normalized name
  - job_description : 'k.č. (TBD)'           -- placeholder; fill manually
  - contract_amount : retail.contract_amount
  - base_amount     : retail.contract_amount -- triggers compute total_amount/vat_amount
  - vat_rate        : 0
  - budget_realized : 0                       -- reset (matches existing 12)
  - start_date      : retail.contract_date    -- NULL for the 19 with no contract_date
  - end_date        : NULL                    -- fill manually
  - status          : 'active'
  - signed          : false
  - notes           : COALESCE(retail.notes, '')
  - has_contract    : true
  - contract_type_id: 2 (Zemljište)
  - created_at      : now()

  ## Expected
  Verified on prod 2026-05-04: 37 rows will be inserted (47 distinct Nin
  suppliers - 11 already linked - 1 PEROŠ BRANKO already linked, then +2 for
  GRANCARIĆ SLAVICA and PEJAKOVIĆ MARKO each having 2 retail_contracts).

  Sequence base verified at CNT-2026-0044 → new contracts will use 0045..0081.

  ## Idempotency
  Re-running is safe: every newly-inserted contract puts its subcontractor into
  the exclusion set, so the second run inserts 0 rows.

  ## Triggers
  Two triggers fire on insert:
  - calculate_contract_vat_trigger: derives vat_amount/total_amount from
    base_amount + vat_rate. We set base_amount and vat_rate=0; total_amount
    comes out equal to base_amount.
  - update_subcontractor_contract_count_trigger: bumps
    subcontractors.active_contracts_count for each linked subcontractor.
*/

WITH
-- Pick one subcontractor per normalized name key (handles the JB IVANA dup)
chosen_subs AS (
  SELECT id, name, k FROM (
    SELECT
      s.id,
      s.name,
      array_to_string(
        ARRAY(SELECT unnest(string_to_array(upper(regexp_replace(trim(s.name), '[[:space:]]+', ' ', 'g')), ' ')) ORDER BY 1),
        ' '
      ) AS k,
      ROW_NUMBER() OVER (
        PARTITION BY array_to_string(
          ARRAY(SELECT unnest(string_to_array(upper(regexp_replace(trim(s.name), '[[:space:]]+', ' ', 'g')), ' ')) ORDER BY 1),
          ' '
        )
        ORDER BY (SELECT COUNT(*) FROM contracts c WHERE c.subcontractor_id = s.id) DESC,
                 s.created_at ASC
      ) AS rn
    FROM subcontractors s
    WHERE NOT EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.subcontractor_id = s.id
        AND c.project_id = 'a822883e-b709-435b-81a5-9ddb8d89c843'
    )
  ) ranked
  WHERE rn = 1
),

-- All retail_contracts on Nin whose supplier resolves to a chosen_sub
to_insert AS (
  SELECT
    rc.contract_amount,
    rc.contract_date,
    rc.notes,
    cs.id AS subcontractor_id,
    ROW_NUMBER() OVER (ORDER BY rc.contract_date NULLS LAST, rc.contract_number) AS rn
  FROM retail_contracts rc
  JOIN retail_project_phases rpp ON rpp.id = rc.phase_id
  JOIN retail_suppliers      rs  ON rs.id  = rc.supplier_id
  JOIN chosen_subs           cs  ON cs.k = array_to_string(
    ARRAY(SELECT unnest(string_to_array(upper(regexp_replace(trim(rs.name), '[[:space:]]+', ' ', 'g')), ' ')) ORDER BY 1),
    ' '
  )
  WHERE rpp.project_id = 'a6693eed-6ffa-4e45-8dc3-ae97d1369c09'
),

-- Sequence base for CNT-YYYY-NNNN-RRRRRR
seq AS (
  SELECT
    COALESCE(MAX(CAST(split_part(contract_number, '-', 3) AS integer)), 0) AS max_n,
    to_char(now(), 'YYYY') AS year_s
  FROM contracts
  WHERE contract_number LIKE 'CNT-' || to_char(now(), 'YYYY') || '-%'
)

INSERT INTO contracts (
  contract_number,
  project_id,
  phase_id,
  subcontractor_id,
  job_description,
  contract_amount,
  base_amount,
  vat_rate,
  budget_realized,
  start_date,
  end_date,
  status,
  signed,
  notes,
  has_contract,
  contract_type_id,
  created_at
)
SELECT
  'CNT-' || (SELECT year_s FROM seq) || '-'
        || lpad(((SELECT max_n FROM seq) + ti.rn)::text, 4, '0') || '-'
        || lpad((floor(random() * 900000)::int + 100000)::text, 6, '0'),
  'a822883e-b709-435b-81a5-9ddb8d89c843',
  'f37884bc-0214-480c-ad06-27b04e8c4579',
  ti.subcontractor_id,
  'k.č. (TBD)',
  ti.contract_amount,
  ti.contract_amount,
  0,
  0,
  ti.contract_date,
  NULL,
  'active',
  false,
  COALESCE(ti.notes, ''),
  true,
  2,
  now()
FROM to_insert ti;
