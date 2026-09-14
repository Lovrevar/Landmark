/*
  # ERP integration, phase 1 — reference data and code mappings

  Two kinds of table (see docs/erp-integration/SPEC.md §6 and §7):

  - **Imported code lists** — `erp.chart_of_accounts`, `erp.cost_centers`,
    `erp.partners`. Mirrors of 4D Wand's own registers, replaced wholesale on
    every import. Read-only to humans; the importer owns them.

  - **Mappings** — `erp.account_map`, `erp.cost_center_map`, `erp.partner_map`.
    These are *ours*: they say what each ERP code means in Cognilion terms.
    Maintained by hand through the Šifrarnici screen, so unlike everything else
    in this schema they get full CRUD policies for Director/Accounting.

  ## Why `erp.account_map.role` exists

  The export is a general ledger, so reconstructing an invoice means knowing
  what part each account plays in a posting. From the sample:

      2200   Dobavljači dobara            -> liability_supplier  (gross owed)
      4172   Voda i odvodnja              -> expense             (net)
      140011 Pretporez - 13%              -> vat_input           (VAT, rate 13)
      1000   Transakcijski račun          -> bank                (payments)
      1250   Potraživanja za predujmove   -> receivable_advance  (UFB)
      1400   Potraživanja za predporez    -> ignore              (PDV settlement)

  Without `role` the importer cannot tell the gross line from the net line, and
  every reconstructed total would be wrong. `role` is therefore the single most
  important column phase 3 depends on.

  `vat_rate` lives here too, because the export has no VAT-rate column at all —
  the rate is encoded in the account (140011 = 13%, 140012 = 25%). This is the
  rate the account *implies*, used to fill `vat_rate_1..4`. It is not used to
  recompute amounts; see DECISIONS.md D8.

  ## Why `erp.partner_map` is polymorphic

  A 4D Wand partner can resolve to any of seven Cognilion tables
  (subcontractors, retail_suppliers, office_suppliers, customers,
  retail_customers, banks, investors). Seven nullable FK columns with a
  one-of-seven CHECK would be honest but unusable in a UI; a (kind, id) pair
  costs referential integrity but keeps the mapping legible and the screen
  simple. The trade is deliberate — `entity_kind` is constrained, and a
  dangling `entity_id` surfaces at classification time as an unresolved
  partner, which is already a case the review queue must handle.

  ## Exposure

  `erp` is not in PostgREST's exposed schema list, so the browser cannot reach
  it. The three mapping tables — and only those — get `security_invoker` views
  in `public` so the Šifrarnici screen can read and write them under the
  caller's own RLS. Staging and code lists stay unreachable on purpose.
*/

-- Phase 0 named the spec's old path; it has since moved.
COMMENT ON SCHEMA erp IS
  'ERP (4D Wand) integration: import staging, code mappings and run bookkeeping. See docs/erp-integration/SPEC.md.';

-- ===========================================================================
-- 1. Imported code lists
-- ===========================================================================

CREATE TABLE IF NOT EXISTS erp.chart_of_accounts (
  account_code   text PRIMARY KEY,
  name           text        NOT NULL,
  active         boolean     NOT NULL DEFAULT true,
  import_run_id  uuid REFERENCES erp.import_runs(id) ON DELETE SET NULL,
  imported_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE erp.chart_of_accounts IS
  'Mirror of the 4D Wand kontni plan. Replaced wholesale on import; never edited by hand.';

CREATE TABLE IF NOT EXISTS erp.cost_centers (
  code           text PRIMARY KEY,
  name           text        NOT NULL,
  active         boolean     NOT NULL DEFAULT true,
  import_run_id  uuid REFERENCES erp.import_runs(id) ON DELETE SET NULL,
  imported_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE erp.cost_centers IS
  'Mirror of the 4D Wand mjesta troska. ⚠️ Inert until accounting actually books cost centres — the field is empty in every posting sampled so far. See OPEN_QUESTIONS.md Q1.';

CREATE TABLE IF NOT EXISTS erp.partners (
  kom_id         integer PRIMARY KEY,
  name           text        NOT NULL,
  oib            text,
  partner_type   text,
  address        text,
  iban           text,
  email          text,
  phone          text,
  active         boolean     NOT NULL DEFAULT true,
  import_run_id  uuid REFERENCES erp.import_runs(id) ON DELETE SET NULL,
  imported_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE erp.partners IS
  'Mirror of the 4D Wand komitenti register. The GL export identifies partners only by kom_id, so without this feed no invoice can be attributed to a supplier. See OPEN_QUESTIONS.md Q2.';
COMMENT ON COLUMN erp.partners.oib IS
  'Nullable: the GL export carries no OIB. Used to seed erp.partner_map; kom_id is the join key thereafter.';

CREATE INDEX IF NOT EXISTS idx_erp_partners_oib ON erp.partners (oib) WHERE oib IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_partners_name ON erp.partners (lower(name));

-- ===========================================================================
-- 2. Mappings — hand-maintained
-- ===========================================================================

CREATE TABLE IF NOT EXISTS erp.account_map (
  account_code        text PRIMARY KEY,
  role                text NOT NULL DEFAULT 'unclassified'
                        CHECK (role IN (
                          'unclassified',
                          'liability_supplier',
                          'liability_customer',
                          'liability_other',
                          'receivable_advance',
                          'expense',
                          'vat_input',
                          'vat_output',
                          'bank',
                          'ignore'
                        )),
  invoice_category_id uuid REFERENCES public.invoice_categories(id) ON DELETE SET NULL,
  vat_rate            numeric,
  bank_id             uuid REFERENCES public.banks(id) ON DELETE SET NULL,
  notes               text,
  updated_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- A VAT account without its rate cannot fill vat_rate_1..4.
  CONSTRAINT erp_account_map_vat_rate_required
    CHECK (role NOT IN ('vat_input', 'vat_output') OR vat_rate IS NOT NULL),
  -- A bank account posting has to say which bank, or payments cannot be placed.
  CONSTRAINT erp_account_map_bank_required
    CHECK (role <> 'bank' OR bank_id IS NOT NULL)
);

COMMENT ON COLUMN erp.account_map.role IS
  'What part this account plays in a posting. Drives invoice reconstruction — see the migration header. Defaults to unclassified so a newly imported account is visibly unmapped rather than silently wrong.';
COMMENT ON COLUMN erp.account_map.vat_rate IS
  'The rate this account implies (140011 -> 13). Fills vat_rate_1..4. NOT used to recompute amounts: the posted base/VAT split does not always match the nominal rate. See DECISIONS.md D8.';

CREATE INDEX IF NOT EXISTS idx_erp_account_map_role ON erp.account_map (role);
CREATE INDEX IF NOT EXISTS idx_erp_account_map_unmapped
  ON erp.account_map (account_code) WHERE role = 'unclassified';

CREATE TABLE IF NOT EXISTS erp.cost_center_map (
  cost_center_code   text PRIMARY KEY,
  project_id         uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  retail_project_id  uuid REFERENCES public.retail_projects(id) ON DELETE CASCADE,
  notes              text,
  updated_by         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- Exactly one target: a cost centre is one project or one retail project.
  CONSTRAINT erp_cost_center_map_one_target
    CHECK (num_nonnulls(project_id, retail_project_id) = 1)
);

COMMENT ON TABLE erp.cost_center_map IS
  'Cost centre -> project. ⚠️ Inert until accounting books cost centres (OPEN_QUESTIONS.md Q1). Kept because it is the intended route to automatic project assignment.';

CREATE TABLE IF NOT EXISTS erp.partner_map (
  kom_id       integer PRIMARY KEY,
  entity_kind  text NOT NULL
                 CHECK (entity_kind IN (
                   'subcontractor',
                   'retail_supplier',
                   'office_supplier',
                   'customer',
                   'retail_customer',
                   'bank',
                   'investor'
                 )),
  entity_id    uuid NOT NULL,
  notes        text,
  updated_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE erp.partner_map IS
  '4D Wand partner -> Cognilion entity. Polymorphic by deliberate trade-off; see the migration header. entity_kind also decides invoice_type (SPEC.md §7.1).';

CREATE INDEX IF NOT EXISTS idx_erp_partner_map_entity ON erp.partner_map (entity_kind, entity_id);

-- ---------------------------------------------------------------------------
-- Keep updated_at honest on the hand-maintained tables.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION erp.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_erp_account_map_touch ON erp.account_map;
CREATE TRIGGER trg_erp_account_map_touch
  BEFORE UPDATE ON erp.account_map
  FOR EACH ROW EXECUTE FUNCTION erp.touch_updated_at();

DROP TRIGGER IF EXISTS trg_erp_cost_center_map_touch ON erp.cost_center_map;
CREATE TRIGGER trg_erp_cost_center_map_touch
  BEFORE UPDATE ON erp.cost_center_map
  FOR EACH ROW EXECUTE FUNCTION erp.touch_updated_at();

DROP TRIGGER IF EXISTS trg_erp_partner_map_touch ON erp.partner_map;
CREATE TRIGGER trg_erp_partner_map_touch
  BEFORE UPDATE ON erp.partner_map
  FOR EACH ROW EXECUTE FUNCTION erp.touch_updated_at();

-- ===========================================================================
-- 3. RLS
-- ===========================================================================
-- Code lists: read-only for Director/Accounting, written by the importer as
-- service role. Mappings: full CRUD for the same two roles — they are the
-- point of the Šifrarnici screen.

ALTER TABLE erp.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.cost_centers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.partners          ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.account_map       ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.cost_center_map   ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.partner_map       ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  gate constant text :=
    'EXISTS (SELECT 1 FROM public.users WHERE users.auth_user_id = auth.uid() AND users.role IN (''Director'', ''Accounting''))';
BEGIN
  -- Read-only code lists.
  FOREACH t IN ARRAY ARRAY['chart_of_accounts', 'cost_centers', 'partners'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Director and Accounting can read %1$s" ON erp.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Director and Accounting can read %1$s" ON erp.%1$I FOR SELECT TO authenticated USING (%2$s)',
      t, gate);
  END LOOP;

  -- Hand-maintained mappings: full access.
  FOREACH t IN ARRAY ARRAY['account_map', 'cost_center_map', 'partner_map'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Director and Accounting manage %1$s" ON erp.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Director and Accounting manage %1$s" ON erp.%1$I FOR ALL TO authenticated USING (%2$s) WITH CHECK (%2$s)',
      t, gate);
  END LOOP;
END $$;

GRANT SELECT ON erp.chart_of_accounts, erp.cost_centers, erp.partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.account_map, erp.cost_center_map, erp.partner_map TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA erp TO service_role;

-- ===========================================================================
-- 4. public views, so the browser can reach the erp schema
-- ===========================================================================
-- security_invoker: the view runs as the caller, so the RLS above applies
-- rather than the view owner's rights. Without it these views would be a hole
-- straight through the role gate.
--
-- The three mapping views are deliberately PLAIN — one table, no joins, no
-- expressions — because that is what makes a view auto-updatable in Postgres.
-- A join here would silently turn the Šifrarnici screen read-only: writes
-- would fail at runtime with "cannot insert into view". The screen joins the
-- code lists client-side instead, which is trivial at these row counts.

-- ---- code lists: read-only ----

CREATE OR REPLACE VIEW public.erp_chart_of_accounts WITH (security_invoker = true) AS
  SELECT account_code, name, active, imported_at FROM erp.chart_of_accounts;

CREATE OR REPLACE VIEW public.erp_cost_centers WITH (security_invoker = true) AS
  SELECT code, name, active, imported_at FROM erp.cost_centers;

CREATE OR REPLACE VIEW public.erp_partners WITH (security_invoker = true) AS
  SELECT kom_id, name, oib, partner_type, address, iban, email, phone, active, imported_at
    FROM erp.partners;

-- ---- mappings: writable ----

CREATE OR REPLACE VIEW public.erp_account_map WITH (security_invoker = true) AS
  SELECT account_code, role, invoice_category_id, vat_rate, bank_id,
         notes, updated_by, updated_at, created_at
    FROM erp.account_map;

CREATE OR REPLACE VIEW public.erp_cost_center_map WITH (security_invoker = true) AS
  SELECT cost_center_code, project_id, retail_project_id,
         notes, updated_by, updated_at, created_at
    FROM erp.cost_center_map;

CREATE OR REPLACE VIEW public.erp_partner_map WITH (security_invoker = true) AS
  SELECT kom_id, entity_kind, entity_id,
         notes, updated_by, updated_at, created_at
    FROM erp.partner_map;

-- ---- what still needs mapping: read-only, joins fine here ----

CREATE OR REPLACE VIEW public.erp_unmapped_codes WITH (security_invoker = true) AS
  SELECT 'account'::text AS kind, coa.account_code AS code, coa.name, coa.active
    FROM erp.chart_of_accounts coa
    LEFT JOIN erp.account_map m ON m.account_code = coa.account_code
   WHERE m.account_code IS NULL OR m.role = 'unclassified'
  UNION ALL
  SELECT 'cost_center', cc.code, cc.name, cc.active
    FROM erp.cost_centers cc
    LEFT JOIN erp.cost_center_map m ON m.cost_center_code = cc.code
   WHERE m.cost_center_code IS NULL
  UNION ALL
  SELECT 'partner', p.kom_id::text, p.name, p.active
    FROM erp.partners p
    LEFT JOIN erp.partner_map m ON m.kom_id = p.kom_id
   WHERE m.kom_id IS NULL;

GRANT SELECT ON public.erp_chart_of_accounts, public.erp_cost_centers,
                public.erp_partners, public.erp_unmapped_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.erp_account_map, public.erp_cost_center_map, public.erp_partner_map TO authenticated;
