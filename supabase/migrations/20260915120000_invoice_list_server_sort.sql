-- Sorts the Cashflow invoice list on the server, so a sort covers every matching invoice
-- instead of only the 100 rows already loaded.
--
-- THE BUG
--
-- `get_filtered_invoices` pages with OFFSET/LIMIT in a fixed `issue_date DESC, id` order. The
-- "Dospijeće" and "Broj" column headers then re-sorted that one page in the browser. Page 1 sorted
-- by due date was "the 100 most recently issued invoices, in due-date order" — not the 100 invoices
-- due soonest — and page 2 restarted the ordering from scratch.
--
-- THE CHANGE
--
-- Two parameters are appended, both DEFAULTed:
--
--   p_sort_field text DEFAULT NULL    -- 'due_date' | 'invoice_number'; anything else = default order
--   p_sort_dir   text DEFAULT 'asc'   -- 'asc' | 'desc'; anything else = default order
--
-- Both are whitelisted through CASE branches in ORDER BY — there is no dynamic SQL, so no value of
-- either can reach the query text. When no branch matches, every CASE yields NULL, all rows tie,
-- and the order falls through to the original `issue_date DESC, id`. That trailing key also stays
-- behind every user sort as a tie-breaker, which is what keeps OFFSET paging deterministic.
--
-- Both sort columns are NOT NULL on accounting_invoices, so NULL placement never occurs in
-- practice; NULLS LAST is spelled out for both directions anyway so it is a decision, not an
-- accident of the DESC default (which would be NULLS FIRST).
--
-- Invoice numbers sort naturally ("INV-2" before "INV-10"), matching the
-- `localeCompare(..., { numeric: true })` the browser used. That needs an ICU collation with
-- numeric ordering (`kn`), created here.
--
-- WHY DROP + CREATE, NOT AN OVERLOAD
--
-- CREATE OR REPLACE cannot change an argument list. Adding an 8-argument function beside the
-- 6-argument one would leave two candidates that BOTH match a call naming only the original six
-- arguments (the new one via its defaults), and PostgREST refuses such a call as ambiguous
-- (PGRST203) — that would break every browser still running the old bundle. With the old signature
-- dropped there is exactly one function, and an old client's 6-named-argument call resolves to it
-- with the default (unsorted) order, i.e. exactly what it got before. Migrations run in one
-- transaction, so there is no window where the RPC is missing.
--
-- WHAT DOES NOT CHANGE
--
-- The return table, the joins, the WHERE clause, LANGUAGE plpgsql SECURITY DEFINER and the
-- search_path are copied unchanged from 20260518110001_deprecate_remaining_unused_tables.sql.
-- The security model is deliberately untouched: this function is SECURITY DEFINER with no role
-- check, so it reads accounting_invoices past RLS. That is a known, separate issue and is not
-- widened or narrowed here.
--
-- Dropping a function drops its grants. The repo has never issued explicit grants on this
-- function (the baseline dump carries none), so it has always run on Postgres/Supabase defaults;
-- the recreated function gets the same defaults. The GRANT at the bottom only restates what those
-- defaults already give `authenticated` (the role the browser calls it as) and `service_role`, so
-- the list cannot silently stop loading if a project's default privileges differ. It grants
-- nothing new, and nothing is revoked — `anon`/PUBLIC keep whatever the defaults give them, as
-- before.
--
-- HOW IT IS BUILT
--
-- `DISTINCT ON (ai.issue_date, ai.id)` requires the ORDER BY of its own SELECT to start with those
-- expressions, so a user sort cannot go there. The original SELECT (with its DISTINCT ON and inner
-- ORDER BY) is therefore wrapped unchanged as subquery `fi`, and the user sort, OFFSET and LIMIT are
-- applied to the outer query.
--
-- The outer query references columns only as `fi.<column>`. In plpgsql every RETURNS TABLE column
-- (id, due_date, invoice_number, issue_date, ...) is also an OUT variable, and an unqualified
-- `due_date` would fail as ambiguous. `fi` must not be `sub`, which the inner query already uses
-- for subcontractors. `SELECT fi.*` returns the inner column list, which is the RETURNS TABLE list
-- in the same order.

CREATE COLLATION IF NOT EXISTS public.natural_numeric (provider = icu, locale = 'und-u-kn-true');

DROP FUNCTION IF EXISTS public.get_filtered_invoices(text, text, uuid, text, integer, integer);

CREATE FUNCTION public.get_filtered_invoices(
  p_invoice_type text    DEFAULT 'ALL'::text,
  p_status       text    DEFAULT 'ALL'::text,
  p_company_id   uuid    DEFAULT NULL::uuid,
  p_search_term  text    DEFAULT NULL::text,
  p_offset       integer DEFAULT 0,
  p_limit        integer DEFAULT 100,
  p_sort_field   text    DEFAULT NULL::text,
  p_sort_dir     text    DEFAULT 'asc'::text
) RETURNS TABLE(
  id uuid, invoice_type text, invoice_number text,
  company_id uuid, company_name text,
  supplier_id uuid, supplier_name text,
  customer_id uuid, customer_name text, customer_surname text,
  investor_id uuid, investor_name text,
  bank_id uuid, bank_name text,
  project_id uuid, project_name text,
  contract_id uuid, contract_number text, contract_job_description text,
  office_supplier_id uuid, office_supplier_name text,
  retail_supplier_id uuid, retail_supplier_name text,
  retail_customer_id uuid, retail_customer_name text,
  retail_project_id uuid, retail_project_name text,
  retail_contract_id uuid, retail_contract_number text,
  invoice_category text, category text, description text,
  issue_date date, due_date date,
  base_amount numeric, base_amount_1 numeric, base_amount_2 numeric,
  base_amount_3 numeric, base_amount_4 numeric,
  vat_rate numeric, vat_rate_1 numeric, vat_rate_2 numeric,
  vat_rate_3 numeric, vat_rate_4 numeric,
  vat_amount numeric, vat_amount_1 numeric, vat_amount_2 numeric,
  vat_amount_3 numeric, vat_amount_4 numeric,
  total_amount numeric, paid_amount numeric, remaining_amount numeric,
  status text, company_bank_account_id uuid, bank_credit_id uuid,
  retail_milestone_id uuid, approved boolean, reference_number text, iban text,
  apartment_id uuid, milestone_id uuid, refund_id bigint, refund_name text,
  created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT fi.*
  FROM (
    SELECT DISTINCT ON (ai.issue_date, ai.id)
      ai.id,
      ai.invoice_type,
      ai.invoice_number,
      ai.company_id,
      ac.name AS company_name,
      ai.supplier_id,
      sub.name AS supplier_name,
      ai.customer_id,
      c.name    AS customer_name,
      c.surname AS customer_surname,
      ai.investor_id,
      NULL::text AS investor_name,  -- investors table moved to `deprecated`
      ai.bank_id,
      bk.name AS bank_name,
      ai.project_id,
      p.name  AS project_name,
      ai.contract_id,
      co.contract_number,
      co.job_description AS contract_job_description,
      ai.office_supplier_id,
      os.name AS office_supplier_name,
      ai.retail_supplier_id,
      rs.name AS retail_supplier_name,
      ai.retail_customer_id,
      rc.name AS retail_customer_name,
      ai.retail_project_id,
      rp.name AS retail_project_name,
      ai.retail_contract_id,
      rco.contract_number AS retail_contract_number,
      ai.invoice_category,
      ai.category,
      ai.description,
      ai.issue_date,
      ai.due_date,
      ai.base_amount, ai.base_amount_1, ai.base_amount_2, ai.base_amount_3, ai.base_amount_4,
      ai.vat_rate,    ai.vat_rate_1,    ai.vat_rate_2,    ai.vat_rate_3,    ai.vat_rate_4,
      ai.vat_amount,  ai.vat_amount_1,  ai.vat_amount_2,  ai.vat_amount_3,  ai.vat_amount_4,
      ai.total_amount, ai.paid_amount, ai.remaining_amount,
      ai.status,
      ai.company_bank_account_id,
      ai.bank_credit_id,
      ai.retail_milestone_id,
      ai.approved,
      ai.reference_number,
      ai.iban,
      ai.apartment_id,
      ai.milestone_id,
      ai.refund_id,
      ref.name AS refund_name,
      ai.created_at,
      ai.updated_at
    FROM accounting_invoices ai
    LEFT JOIN accounting_companies      ac  ON ai.company_id          = ac.id
    LEFT JOIN subcontractors            sub ON ai.supplier_id         = sub.id
    LEFT JOIN customers                 c   ON ai.customer_id         = c.id
    LEFT JOIN banks                     bk  ON ai.bank_id             = bk.id
    LEFT JOIN projects                  p   ON ai.project_id          = p.id
    LEFT JOIN contracts                 co  ON ai.contract_id         = co.id
    LEFT JOIN office_suppliers          os  ON ai.office_supplier_id  = os.id
    LEFT JOIN retail_suppliers          rs  ON ai.retail_supplier_id  = rs.id
    LEFT JOIN retail_customers          rc  ON ai.retail_customer_id  = rc.id
    LEFT JOIN retail_projects           rp  ON ai.retail_project_id   = rp.id
    LEFT JOIN retail_contracts          rco ON ai.retail_contract_id  = rco.id
    LEFT JOIN accounting_invoices_refund ref ON ai.refund_id          = ref.id
    WHERE
      (
        p_invoice_type = 'ALL'
        OR ai.invoice_type = p_invoice_type
        OR (p_invoice_type IN ('INCOMING', 'OUTGOING') AND ai.invoice_type LIKE p_invoice_type || '_%')
      )
      AND (
        p_status = 'ALL'
        OR (p_status = 'UNPAID'             AND ai.status = 'UNPAID')
        OR (p_status = 'PAID'               AND ai.status = 'PAID')
        OR (p_status = 'PARTIALLY_PAID'     AND ai.status = 'PARTIALLY_PAID')
        OR (p_status = 'UNPAID_AND_PARTIAL' AND ai.status IN ('UNPAID', 'PARTIALLY_PAID'))
      )
      AND (p_company_id IS NULL OR ai.company_id = p_company_id)
      AND (
        p_search_term IS NULL
        OR ai.invoice_number ILIKE '%' || p_search_term || '%'
        OR ai.category       ILIKE '%' || p_search_term || '%'
        OR ai.description    ILIKE '%' || p_search_term || '%'
        OR rs.name           ILIKE '%' || p_search_term || '%'
        OR os.name           ILIKE '%' || p_search_term || '%'
        OR sub.name          ILIKE '%' || p_search_term || '%'
        OR c.name            ILIKE '%' || p_search_term || '%'
        OR c.surname         ILIKE '%' || p_search_term || '%'
        OR rc.name           ILIKE '%' || p_search_term || '%'
        OR bk.name           ILIKE '%' || p_search_term || '%'
        OR ac.name           ILIKE '%' || p_search_term || '%'
        OR ref.name          ILIKE '%' || p_search_term || '%'
        OR rp.name           ILIKE '%' || p_search_term || '%'
      )
    ORDER BY ai.issue_date DESC, ai.id
  ) AS fi
  ORDER BY
    CASE WHEN p_sort_field = 'due_date' AND p_sort_dir = 'asc'
         THEN fi.due_date END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'due_date' AND p_sort_dir = 'desc'
         THEN fi.due_date END DESC NULLS LAST,
    (CASE WHEN p_sort_field = 'invoice_number' AND p_sort_dir = 'asc'
          THEN fi.invoice_number END) COLLATE public.natural_numeric ASC NULLS LAST,
    (CASE WHEN p_sort_field = 'invoice_number' AND p_sort_dir = 'desc'
          THEN fi.invoice_number END) COLLATE public.natural_numeric DESC NULLS LAST,
    fi.issue_date DESC,
    fi.id
  OFFSET p_offset
  LIMIT  p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_invoices(text, text, uuid, text, integer, integer, text, text)
  TO authenticated, service_role;
