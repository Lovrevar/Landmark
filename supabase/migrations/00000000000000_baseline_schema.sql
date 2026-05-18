-- Baseline migration: captures prod's complete public-schema state as of the
-- migration-history reconciliation. This is the single source of truth for
-- fresh-environment replay.
--
-- All 302 pre-existing migrations (Sept 2025 - April 2026) are preserved in
-- the directory and registry with their original version numbers, but their
-- content has been replaced with no-op comments since the baseline supersedes
-- them. The original SQL for each is preserved in git history.
--
-- Generated via: pg_dump --schema-only --no-owner --no-privileges --schema=public

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.9 (Ubuntu 17.9-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: calculate_contract_vat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_contract_vat() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
-- Calculate VAT amount based on base amount and rate
NEW.vat_amount := ROUND(NEW.base_amount * NEW.vat_rate / 100, 2);

-- Calculate total amount
NEW.total_amount := NEW.base_amount + NEW.vat_amount;

-- Keep contract_amount in sync with total_amount for backward compatibility
NEW.contract_amount := NEW.total_amount;

RETURN NEW;
END;
$$;


--
-- Name: calculate_invoice_amounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_invoice_amounts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
-- Calculate VAT amounts for each rate
NEW.vat_amount_1 := ROUND(COALESCE(NEW.base_amount_1, 0) * 0.25, 2);
NEW.vat_amount_2 := ROUND(COALESCE(NEW.base_amount_2, 0) * 0.13, 2);
NEW.vat_amount_3 := 0; -- 0% VAT is always 0
NEW.vat_amount_4 := ROUND(COALESCE(NEW.base_amount_4, 0) * 0.05, 2);

-- Calculate total amount as sum of all four (base + VAT) amounts
NEW.total_amount := 
(COALESCE(NEW.base_amount_1, 0) + COALESCE(NEW.vat_amount_1, 0)) +
(COALESCE(NEW.base_amount_2, 0) + COALESCE(NEW.vat_amount_2, 0)) +
(COALESCE(NEW.base_amount_3, 0) + COALESCE(NEW.vat_amount_3, 0)) +
(COALESCE(NEW.base_amount_4, 0) + COALESCE(NEW.vat_amount_4, 0));

-- Update legacy fields for backward compatibility
-- Set base_amount to sum of all base amounts
NEW.base_amount := 
COALESCE(NEW.base_amount_1, 0) + 
COALESCE(NEW.base_amount_2, 0) + 
COALESCE(NEW.base_amount_3, 0) +
COALESCE(NEW.base_amount_4, 0);

-- Set vat_amount to sum of all VAT amounts
NEW.vat_amount := 
COALESCE(NEW.vat_amount_1, 0) + 
COALESCE(NEW.vat_amount_2, 0) + 
COALESCE(NEW.vat_amount_3, 0) +
COALESCE(NEW.vat_amount_4, 0);

-- Calculate remaining amount
NEW.remaining_amount := COALESCE(NEW.total_amount, 0) - COALESCE(NEW.paid_amount, 0);

RETURN NEW;
END;
$$;


--
-- Name: check_subcontractor_budget_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_subcontractor_budget_integrity() RETURNS TABLE(contract_id uuid, contract_number text, budget_planned numeric, budget_realized numeric, calculated_realized numeric, difference numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
RETURN QUERY
SELECT 
c.id as contract_id,
c.contract_number,
c.budget_planned,
c.budget_realized,
COALESCE(SUM(ai.base_amount), 0) as calculated_realized,
c.budget_realized - COALESCE(SUM(ai.base_amount), 0) as difference
FROM contracts c
LEFT JOIN accounting_invoices ai ON ai.contract_id = c.id
GROUP BY c.id, c.contract_number, c.budget_planned, c.budget_realized
HAVING c.budget_realized != COALESCE(SUM(ai.base_amount), 0);
END;
$$;


--
-- Name: count_invoices_with_search(text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_invoices_with_search(p_invoice_type text DEFAULT 'ALL'::text, p_status text DEFAULT 'ALL'::text, p_company_id uuid DEFAULT NULL::uuid, p_search_term text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
v_count bigint;
BEGIN
SELECT COUNT(DISTINCT ai.id)
INTO v_count
FROM accounting_invoices ai
LEFT JOIN retail_suppliers rs ON ai.retail_supplier_id = rs.id
LEFT JOIN office_suppliers os ON ai.office_supplier_id = os.id
LEFT JOIN contracts co ON ai.contract_id = co.id
LEFT JOIN subcontractors s ON co.subcontractor_id = s.id
LEFT JOIN customers c ON ai.customer_id = c.id
LEFT JOIN retail_customers rc ON ai.retail_customer_id = rc.id
LEFT JOIN investors inv ON ai.investor_id = inv.id
LEFT JOIN banks b ON ai.bank_id = b.id
WHERE
(p_invoice_type = 'ALL' OR ai.invoice_type = p_invoice_type)
AND (
p_status = 'ALL'
OR (p_status = 'UNPAID' AND ai.status = 'UNPAID')
OR (p_status = 'PAID' AND ai.status = 'PAID')
OR (p_status = 'PARTIALLY_PAID' AND ai.status = 'PARTIALLY_PAID')
OR (p_status = 'UNPAID_AND_PARTIAL' AND ai.status IN ('UNPAID', 'PARTIALLY_PAID'))
)
AND (p_company_id IS NULL OR ai.company_id = p_company_id)
AND (
p_search_term IS NULL
OR ai.invoice_number ILIKE '%' || p_search_term || '%'
OR ai.category ILIKE '%' || p_search_term || '%'
OR ai.description ILIKE '%' || p_search_term || '%'
OR rs.name ILIKE '%' || p_search_term || '%'
OR os.name ILIKE '%' || p_search_term || '%'
OR s.name ILIKE '%' || p_search_term || '%'
OR c.name ILIKE '%' || p_search_term || '%'
OR c.surname ILIKE '%' || p_search_term || '%'
OR rc.name ILIKE '%' || p_search_term || '%'
OR inv.name ILIKE '%' || p_search_term || '%'
OR b.name ILIKE '%' || p_search_term || '%'
);

RETURN v_count;
END;
$$;


--
-- Name: fix_subcontractor_budget_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fix_subcontractor_budget_integrity() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
UPDATE contracts c
SET budget_realized = COALESCE(
(SELECT SUM(base_amount) 
FROM accounting_invoices 
WHERE contract_id = c.id), 
0
);
END;
$$;


--
-- Name: generate_payment_schedule(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_payment_schedule(investment_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
schedule_item jsonb;
notification_date date;
BEGIN
FOR schedule_item IN 
SELECT jsonb_array_elements(payment_schedule) 
FROM project_investments 
WHERE id = investment_id
LOOP
notification_date := (schedule_item->>'date')::date;

INSERT INTO payment_notifications (
project_investment_id,
due_date,
amount,
status
) VALUES (
investment_id,
notification_date,
(schedule_item->>'amount')::numeric,
'pending'
);
END LOOP;
END;
$$;


--
-- Name: get_activity_logs(uuid, text, text, text, timestamp with time zone, timestamp with time zone, uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_activity_logs(p_user_id uuid DEFAULT NULL::uuid, p_action_prefix text DEFAULT NULL::text, p_severity text DEFAULT NULL::text, p_search_term text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_project_id uuid DEFAULT NULL::uuid, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, user_id uuid, username text, user_role text, action text, entity text, entity_id uuid, project_id uuid, project_name text, metadata jsonb, ip_address text, created_at timestamp with time zone, total_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only Director may read activity logs
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Director role required';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.user_id,
    u.username,
    al.user_role,
    al.action,
    al.entity,
    al.entity_id,
    al.project_id,
    p.name        AS project_name,
    al.metadata,
    al.ip_address,
    al.created_at,
    COUNT(*) OVER() AS total_count
  FROM activity_logs al
  JOIN users u ON u.id = al.user_id
  LEFT JOIN projects p ON p.id = al.project_id
  WHERE
    (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_action_prefix IS NULL OR al.action LIKE p_action_prefix || '.%')
    AND (p_severity IS NULL OR al.metadata->>'severity' = p_severity)
    AND (p_date_from IS NULL OR al.created_at >= p_date_from)
    AND (p_date_to IS NULL OR al.created_at <= p_date_to)
    AND (p_project_id IS NULL OR al.project_id = p_project_id)
    AND (
      p_search_term IS NULL
      OR p_search_term = ''
      OR al.action ILIKE '%' || p_search_term || '%'
      OR al.entity ILIKE '%' || p_search_term || '%'
      OR u.username ILIKE '%' || p_search_term || '%'
      OR al.metadata::text ILIKE '%' || p_search_term || '%'
    )
  ORDER BY al.created_at DESC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;


--
-- Name: get_apartment_payments(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_apartment_payments(apartment_uuid uuid) RETURNS TABLE(id uuid, payment_date date, amount numeric, payment_method text, description text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
RETURN QUERY
SELECT 
ap.id,
ap.payment_date,
ap.amount,
ap.payment_method,
ap.description,
ap.created_at
FROM accounting_payments ap
INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ai.customer_id IN (
SELECT customer_id FROM sales WHERE apartment_id = apartment_uuid
)
ORDER BY ap.payment_date DESC;
END;
$$;


--
-- Name: get_bank_credit_payments(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_bank_credit_payments(credit_uuid uuid) RETURNS TABLE(id uuid, payment_date date, amount numeric, payment_method text, description text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
RETURN QUERY
SELECT 
id,
payment_date,
amount,
'Bank Transfer'::text as payment_method,
notes as description,
created_at
FROM funding_payments
WHERE bank_credit_id = credit_uuid
ORDER BY payment_date DESC;
END;
$$;


--
-- Name: get_busy_blocks(uuid[], timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_busy_blocks(p_user_ids uuid[], p_from timestamp with time zone, p_to timestamp with time zone) RETURNS TABLE(user_id uuid, start_at timestamp with time zone, end_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT DISTINCT ep.user_id, e.start_at, e.end_at
  FROM calendar_events e
  JOIN calendar_event_participants ep ON ep.event_id = e.id
  WHERE e.busy = true
    AND ep.user_id = ANY(p_user_ids)
    AND e.start_at < p_to
    AND e.end_at   > p_from
  UNION
  SELECT e.created_by, e.start_at, e.end_at
  FROM calendar_events e
  WHERE e.busy = true
    AND e.created_by = ANY(p_user_ids)
    AND e.start_at < p_to
    AND e.end_at   > p_from;
$$;


--
-- Name: get_event_creator(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_event_creator(p_event_id uuid) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
SELECT created_by FROM calendar_events WHERE id = p_event_id;
$$;


--
-- Name: get_filtered_invoices(text, text, uuid, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_filtered_invoices(p_invoice_type text DEFAULT 'ALL'::text, p_status text DEFAULT 'ALL'::text, p_company_id uuid DEFAULT NULL::uuid, p_search_term text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 100) RETURNS TABLE(id uuid, invoice_type text, invoice_number text, company_id uuid, company_name text, supplier_id uuid, supplier_name text, customer_id uuid, customer_name text, customer_surname text, investor_id uuid, investor_name text, bank_id uuid, bank_name text, project_id uuid, project_name text, contract_id uuid, contract_number text, contract_job_description text, office_supplier_id uuid, office_supplier_name text, retail_supplier_id uuid, retail_supplier_name text, retail_customer_id uuid, retail_customer_name text, retail_project_id uuid, retail_project_name text, retail_contract_id uuid, retail_contract_number text, invoice_category text, category text, description text, issue_date date, due_date date, base_amount numeric, base_amount_1 numeric, base_amount_2 numeric, base_amount_3 numeric, base_amount_4 numeric, vat_rate numeric, vat_rate_1 numeric, vat_rate_2 numeric, vat_rate_3 numeric, vat_rate_4 numeric, vat_amount numeric, vat_amount_1 numeric, vat_amount_2 numeric, vat_amount_3 numeric, vat_amount_4 numeric, total_amount numeric, paid_amount numeric, remaining_amount numeric, status text, company_bank_account_id uuid, bank_credit_id uuid, retail_milestone_id uuid, approved boolean, reference_number text, iban text, apartment_id uuid, milestone_id uuid, refund_id bigint, refund_name text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
RETURN QUERY
SELECT DISTINCT ON (ai.issue_date, ai.id)
ai.id,
ai.invoice_type,
ai.invoice_number,
ai.company_id,
ac.name AS company_name,
ai.supplier_id,
sub.name AS supplier_name,
ai.customer_id,
c.name AS customer_name,
c.surname AS customer_surname,
ai.investor_id,
inv.name AS investor_name,
ai.bank_id,
bk.name AS bank_name,
ai.project_id,
p.name AS project_name,
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
ai.base_amount,
ai.base_amount_1,
ai.base_amount_2,
ai.base_amount_3,
ai.base_amount_4,
ai.vat_rate,
ai.vat_rate_1,
ai.vat_rate_2,
ai.vat_rate_3,
ai.vat_rate_4,
ai.vat_amount,
ai.vat_amount_1,
ai.vat_amount_2,
ai.vat_amount_3,
ai.vat_amount_4,
ai.total_amount,
ai.paid_amount,
ai.remaining_amount,
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
LEFT JOIN accounting_companies ac ON ai.company_id = ac.id
LEFT JOIN subcontractors sub ON ai.supplier_id = sub.id
LEFT JOIN customers c ON ai.customer_id = c.id
LEFT JOIN investors inv ON ai.investor_id = inv.id
LEFT JOIN banks bk ON ai.bank_id = bk.id
LEFT JOIN projects p ON ai.project_id = p.id
LEFT JOIN contracts co ON ai.contract_id = co.id
LEFT JOIN office_suppliers os ON ai.office_supplier_id = os.id
LEFT JOIN retail_suppliers rs ON ai.retail_supplier_id = rs.id
LEFT JOIN retail_customers rc ON ai.retail_customer_id = rc.id
LEFT JOIN retail_projects rp ON ai.retail_project_id = rp.id
LEFT JOIN retail_contracts rco ON ai.retail_contract_id = rco.id
LEFT JOIN accounting_invoices_refund ref ON ai.refund_id = ref.id
WHERE
(
p_invoice_type = 'ALL'
OR ai.invoice_type = p_invoice_type
OR (p_invoice_type IN ('INCOMING', 'OUTGOING') AND ai.invoice_type LIKE p_invoice_type || '_%')
)
AND (
p_status = 'ALL'
OR (p_status = 'UNPAID' AND ai.status = 'UNPAID')
OR (p_status = 'PAID' AND ai.status = 'PAID')
OR (p_status = 'PARTIALLY_PAID' AND ai.status = 'PARTIALLY_PAID')
OR (p_status = 'UNPAID_AND_PARTIAL' AND ai.status IN ('UNPAID', 'PARTIALLY_PAID'))
)
AND (p_company_id IS NULL OR ai.company_id = p_company_id)
AND (
p_search_term IS NULL
OR ai.invoice_number ILIKE '%' || p_search_term || '%'
OR ai.category ILIKE '%' || p_search_term || '%'
OR ai.description ILIKE '%' || p_search_term || '%'
OR rs.name ILIKE '%' || p_search_term || '%'
OR os.name ILIKE '%' || p_search_term || '%'
OR sub.name ILIKE '%' || p_search_term || '%'
OR c.name ILIKE '%' || p_search_term || '%'
OR c.surname ILIKE '%' || p_search_term || '%'
OR rc.name ILIKE '%' || p_search_term || '%'
OR inv.name ILIKE '%' || p_search_term || '%'
OR bk.name ILIKE '%' || p_search_term || '%'
OR ac.name ILIKE '%' || p_search_term || '%'
OR ref.name ILIKE '%' || p_search_term || '%'
OR rp.name ILIKE '%' || p_search_term || '%'
)
ORDER BY ai.issue_date DESC, ai.id
OFFSET p_offset
LIMIT p_limit;
END;
$$;


--
-- Name: get_investor_payments(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_investor_payments(investor_uuid uuid) RETURNS TABLE(id uuid, payment_date date, amount numeric, payment_method text, description text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
RETURN QUERY
SELECT 
id,
payment_date,
amount,
'Bank Transfer'::text as payment_method,
notes as description,
created_at
FROM funding_payments
WHERE project_investment_id IN (
SELECT id FROM project_investments WHERE investor_id = investor_uuid
)
ORDER BY payment_date DESC;
END;
$$;


--
-- Name: get_invoice_statistics(text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_invoice_statistics(p_invoice_type text DEFAULT 'ALL'::text, p_status text DEFAULT 'ALL'::text, p_company_id uuid DEFAULT NULL::uuid, p_search_term text DEFAULT NULL::text) RETURNS TABLE(filtered_count bigint, filtered_unpaid_sum numeric, total_unpaid_sum numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
RETURN QUERY
WITH filtered AS (
SELECT ai.*
FROM accounting_invoices ai
LEFT JOIN contracts co ON co.id = ai.contract_id
LEFT JOIN subcontractors sc ON co.subcontractor_id = sc.id
LEFT JOIN customers cu ON cu.id = ai.customer_id
LEFT JOIN office_suppliers os ON os.id = ai.office_supplier_id
LEFT JOIN retail_suppliers rs ON rs.id = ai.retail_supplier_id
LEFT JOIN retail_customers rc ON rc.id = ai.retail_customer_id
LEFT JOIN investors i ON i.id = ai.investor_id
LEFT JOIN banks b ON b.id = ai.bank_id
LEFT JOIN accounting_companies c ON c.id = ai.company_id
WHERE
(
p_invoice_type = 'ALL'
OR ai.invoice_type = p_invoice_type
OR (p_invoice_type IN ('INCOMING', 'OUTGOING') AND ai.invoice_type LIKE p_invoice_type || '_%')
)
AND (
p_status = 'ALL'
OR (p_status = 'UNPAID' AND ai.status = 'UNPAID')
OR (p_status = 'PAID' AND ai.status = 'PAID')
OR (p_status = 'PARTIALLY_PAID' AND ai.status = 'PARTIALLY_PAID')
OR (
p_status = 'UNPAID_AND_PARTIAL'
AND ai.status IN ('UNPAID', 'PARTIALLY_PAID')
)
)
AND (p_company_id IS NULL OR ai.company_id = p_company_id)
AND (
p_search_term IS NULL
OR p_search_term = ''
OR (
LOWER(ai.invoice_number) LIKE '%' || LOWER(p_search_term) || '%'
OR LOWER(ai.category) LIKE '%' || LOWER(p_search_term) || '%'
OR LOWER(ai.description) LIKE '%' || LOWER(p_search_term) || '%'
OR LOWER(sc.name) LIKE '%' || LOWER(p_search_term) || '%'
OR LOWER(cu.name || ' ' || cu.surname) LIKE '%' || LOWER(p_search_term) || '%'
OR LOWER(os.name) LIKE '%' || LOWER(p_search_term) || '%'
OR LOWER(rs.name) LIKE '%' || LOWER(p_search_term) || '%'
OR LOWER(rc.name) LIKE '%' || LOWER(p_search_term) || '%'
OR LOWER(i.name) LIKE '%' || LOWER(p_search_term) || '%'
OR LOWER(b.name) LIKE '%' || LOWER(p_search_term) || '%'
OR LOWER(c.name) LIKE '%' || LOWER(p_search_term) || '%'
)
)
),
totals AS (
SELECT
COUNT(*) AS filtered_count,
COALESCE(
SUM(remaining_amount)
FILTER (WHERE status IN ('UNPAID', 'PARTIALLY_PAID')),
0
) AS filtered_unpaid_sum
FROM filtered
),
all_unpaid AS (
SELECT
COALESCE(SUM(remaining_amount), 0) AS total_unpaid_sum
FROM accounting_invoices
WHERE status IN ('UNPAID', 'PARTIALLY_PAID')
AND (
p_invoice_type = 'ALL'
OR (p_invoice_type = 'INCOMING' AND invoice_type LIKE 'INCOMING_%')
OR (p_invoice_type = 'OUTGOING' AND invoice_type LIKE 'OUTGOING_%')
OR (p_invoice_type NOT IN ('ALL', 'INCOMING', 'OUTGOING') AND invoice_type LIKE split_part(p_invoice_type, '_', 1) || '_%')
)
)
SELECT
t.filtered_count,
t.filtered_unpaid_sum,
a.total_unpaid_sum
FROM totals t
CROSS JOIN all_unpaid a;
END;
$$;


--
-- Name: get_subcontractor_payments(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_subcontractor_payments(subcontractor_uuid uuid) RETURNS TABLE(payment_id uuid, payment_amount numeric, payment_date date, invoice_description text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
RETURN QUERY
SELECT 
ap.id as payment_id,
ap.base_amount as payment_amount,
ap.payment_date,
ai.description as invoice_description
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ai.subcontractor_id = subcontractor_uuid
ORDER BY ap.payment_date DESC;
END;
$$;


--
-- Name: get_subcontractor_payments(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_subcontractor_payments(p_subcontractor_id uuid, p_project_id uuid) RETURNS TABLE(id uuid, payment_date date, amount numeric, description text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
RETURN QUERY
SELECT 
wp.id,
wp.payment_date,
wp.amount,
wp.description
FROM wire_payments wp
INNER JOIN subcontractor_milestones sm ON wp.milestone_id = sm.id
INNER JOIN contracts c ON sm.contract_id = c.id
WHERE c.subcontractor_id = p_subcontractor_id
AND c.project_id = p_project_id
ORDER BY wp.payment_date DESC;
END;
$$;


--
-- Name: get_task_creator(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_task_creator(p_task_id uuid) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
SELECT created_by FROM tasks WHERE id = p_task_id;
$$;


--
-- Name: handle_disbursed_credit_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_disbursed_credit_balance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
IF NEW.disbursed_to_account = true AND NEW.disbursed_to_bank_account_id IS NOT NULL THEN
UPDATE company_bank_accounts
SET current_balance = current_balance + NEW.amount
WHERE id = NEW.disbursed_to_bank_account_id;

NEW.used_amount         := NEW.amount;
NEW.outstanding_balance := NEW.amount;
END IF;

RETURN NEW;
END;
$$;


--
-- Name: handle_disbursed_credit_balance_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_disbursed_credit_balance_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
-- Ako se briše kredit koji je bio isplaćen na račun, umanji stanje računa
IF OLD.disbursed_to_account = true AND OLD.disbursed_to_bank_account_id IS NOT NULL THEN
UPDATE company_bank_accounts
SET current_balance = current_balance - OLD.amount
WHERE id = OLD.disbursed_to_bank_account_id;
END IF;

RETURN OLD;
END;
$$;


--
-- Name: handle_disbursed_credit_balance_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_disbursed_credit_balance_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
v_repaid numeric;
BEGIN
-- Toggled ON: full amount is now deployed
IF OLD.disbursed_to_account = false AND NEW.disbursed_to_account = true AND NEW.disbursed_to_bank_account_id IS NOT NULL THEN
UPDATE company_bank_accounts
SET current_balance = current_balance + NEW.amount
WHERE id = NEW.disbursed_to_bank_account_id;

SELECT COALESCE(SUM(ap.amount), 0)
INTO v_repaid
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ai.invoice_type = 'INCOMING_BANK'
AND ai.bank_credit_id = NEW.id;

NEW.used_amount         := NEW.amount;
NEW.outstanding_balance := NEW.amount - v_repaid;
END IF;

-- Toggled OFF: revert bank balance, clear used_amount and outstanding_balance
IF OLD.disbursed_to_account = true AND NEW.disbursed_to_account = false AND OLD.disbursed_to_bank_account_id IS NOT NULL THEN
UPDATE company_bank_accounts
SET current_balance = current_balance - OLD.amount
WHERE id = OLD.disbursed_to_bank_account_id;

NEW.used_amount         := 0;
NEW.outstanding_balance := 0;
END IF;

RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
new_username TEXT;
BEGIN
-- Generate username from email or metadata
new_username := COALESCE(
NEW.raw_user_meta_data->>'username', 
SPLIT_PART(NEW.email, '@', 1)
);

-- Insert into public.users with generated username
-- If auth_user_id already exists, update the record
INSERT INTO public.users (auth_user_id, username, email, role, created_at)
VALUES (
NEW.id,
new_username,
NEW.email,
COALESCE(NEW.raw_app_meta_data->>'role', 'Sales')::TEXT,
NOW()
)
ON CONFLICT (auth_user_id) DO UPDATE
SET 
email = EXCLUDED.email,
username = EXCLUDED.username,
role = EXCLUDED.role;

RETURN NEW;
EXCEPTION
WHEN OTHERS THEN
-- Log error but don't fail authentication
RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
RETURN NEW;
END;
$$;


--
-- Name: is_chat_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_chat_participant(p_conversation_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
SELECT EXISTS (
SELECT 1 FROM chat_participants
WHERE conversation_id = p_conversation_id
AND user_id = p_user_id
);
$$;


--
-- Name: is_event_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_event_participant(p_event_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
SELECT EXISTS (
SELECT 1 FROM calendar_event_participants
WHERE event_id = p_event_id AND user_id = p_user_id
);
$$;


--
-- Name: is_task_assignee(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_task_assignee(p_task_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
SELECT EXISTS (
SELECT 1 FROM task_assignees
WHERE task_id = p_task_id AND user_id = p_user_id
);
$$;


--
-- Name: recalculate_balances_on_loan_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_balances_on_loan_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
v_account_id uuid;
v_reset_at timestamptz;
BEGIN
IF TG_OP = 'INSERT' THEN
-- Recalculate from_bank_account (money went out)
v_account_id := NEW.from_bank_account_id;
SELECT balance_reset_at INTO v_reset_at FROM company_bank_accounts WHERE id = v_account_id;
UPDATE company_bank_accounts
SET current_balance = initial_balance
+ COALESCE(
(SELECT SUM(
CASE
WHEN ai.invoice_type IN (
'OUTGOING_SALES','OUTGOING_OFFICE','OUTGOING_SUPPLIER',
'OUTGOING_BANK','OUTGOING_RETAIL_DEVELOPMENT','OUTGOING_RETAIL_CONSTRUCTION'
) THEN ap.amount
WHEN ai.invoice_type IN (
'INCOMING_SUPPLIER','INCOMING_OFFICE','INCOMING_INVESTMENT',
'INCOMING_BANK','INCOMING_BANK_EXPENSES'
) THEN -ap.amount
ELSE 0
END
)
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ap.company_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(ap.amount)
FROM accounting_payments ap
WHERE ap.cesija_bank_account_id = v_account_id
AND ap.is_cesija = true
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.from_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
)
+ COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.to_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
),
updated_at = now()
WHERE id = v_account_id;

-- Recalculate to_bank_account (money came in)
v_account_id := NEW.to_bank_account_id;
SELECT balance_reset_at INTO v_reset_at FROM company_bank_accounts WHERE id = v_account_id;
UPDATE company_bank_accounts
SET current_balance = initial_balance
+ COALESCE(
(SELECT SUM(
CASE
WHEN ai.invoice_type IN (
'OUTGOING_SALES','OUTGOING_OFFICE','OUTGOING_SUPPLIER',
'OUTGOING_BANK','OUTGOING_RETAIL_DEVELOPMENT','OUTGOING_RETAIL_CONSTRUCTION'
) THEN ap.amount
WHEN ai.invoice_type IN (
'INCOMING_SUPPLIER','INCOMING_OFFICE','INCOMING_INVESTMENT',
'INCOMING_BANK','INCOMING_BANK_EXPENSES'
) THEN -ap.amount
ELSE 0
END
)
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ap.company_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(ap.amount)
FROM accounting_payments ap
WHERE ap.cesija_bank_account_id = v_account_id
AND ap.is_cesija = true
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.from_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
)
+ COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.to_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
),
updated_at = now()
WHERE id = v_account_id;

RETURN NEW;
END IF;

IF TG_OP = 'DELETE' THEN
-- Recalculate from_bank_account (money went out)
v_account_id := OLD.from_bank_account_id;
SELECT balance_reset_at INTO v_reset_at FROM company_bank_accounts WHERE id = v_account_id;
UPDATE company_bank_accounts
SET current_balance = initial_balance
+ COALESCE(
(SELECT SUM(
CASE
WHEN ai.invoice_type IN (
'OUTGOING_SALES','OUTGOING_OFFICE','OUTGOING_SUPPLIER',
'OUTGOING_BANK','OUTGOING_RETAIL_DEVELOPMENT','OUTGOING_RETAIL_CONSTRUCTION'
) THEN ap.amount
WHEN ai.invoice_type IN (
'INCOMING_SUPPLIER','INCOMING_OFFICE','INCOMING_INVESTMENT',
'INCOMING_BANK','INCOMING_BANK_EXPENSES'
) THEN -ap.amount
ELSE 0
END
)
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ap.company_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(ap.amount)
FROM accounting_payments ap
WHERE ap.cesija_bank_account_id = v_account_id
AND ap.is_cesija = true
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.from_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
)
+ COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.to_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
),
updated_at = now()
WHERE id = v_account_id;

-- Recalculate to_bank_account (money came in)
v_account_id := OLD.to_bank_account_id;
SELECT balance_reset_at INTO v_reset_at FROM company_bank_accounts WHERE id = v_account_id;
UPDATE company_bank_accounts
SET current_balance = initial_balance
+ COALESCE(
(SELECT SUM(
CASE
WHEN ai.invoice_type IN (
'OUTGOING_SALES','OUTGOING_OFFICE','OUTGOING_SUPPLIER',
'OUTGOING_BANK','OUTGOING_RETAIL_DEVELOPMENT','OUTGOING_RETAIL_CONSTRUCTION'
) THEN ap.amount
WHEN ai.invoice_type IN (
'INCOMING_SUPPLIER','INCOMING_OFFICE','INCOMING_INVESTMENT',
'INCOMING_BANK','INCOMING_BANK_EXPENSES'
) THEN -ap.amount
ELSE 0
END
)
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ap.company_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(ap.amount)
FROM accounting_payments ap
WHERE ap.cesija_bank_account_id = v_account_id
AND ap.is_cesija = true
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.from_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
)
+ COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.to_bank_account_id = v_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
),
updated_at = now()
WHERE id = v_account_id;

RETURN OLD;
END IF;

RETURN NULL;
END;
$$;


--
-- Name: recalculate_bank_credit_fields(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_bank_credit_fields(p_credit_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_used   numeric;
  v_repaid numeric;
BEGIN
  IF p_credit_id IS NULL THEN
    RETURN;
  END IF;

  -- used_amount: money deployed FROM this credit line (unchanged)
  --   Path A: direct credit_id on payment (credit allocation / direct supplier payment)
  --   Path B: cesija_credit_id on payment (cesija / assignment path)
  --   Path C: payments against OUTGOING_BANK invoices linked to this credit
  --   UNION to deduplicate payment ids that may appear in multiple paths
  SELECT COALESCE(SUM(ap.amount), 0)
  INTO v_used
  FROM accounting_payments ap
  WHERE ap.id IN (
    SELECT id FROM accounting_payments WHERE credit_id = p_credit_id
    UNION
    SELECT id FROM accounting_payments WHERE cesija_credit_id = p_credit_id
    UNION
    SELECT ap2.id
    FROM accounting_payments ap2
    JOIN accounting_invoices ai ON ap2.invoice_id = ai.id
    WHERE ai.invoice_type = 'OUTGOING_BANK'
      AND ai.bank_credit_id = p_credit_id
  );

  -- repaid_amount: base amount (ex-VAT) paid back to the lender
  -- Using ap.amount * (base_amount / total_amount) to extract the ex-VAT portion.
  -- When fully paid: ap.amount = total_amount → result equals base_amount exactly.
  SELECT COALESCE(SUM(
    ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0))
  ), 0)
  INTO v_repaid
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.invoice_type = 'INCOMING_BANK'
    AND ai.bank_credit_id = p_credit_id
    AND ai.total_amount > 0;

  UPDATE bank_credits
  SET
    used_amount         = v_used,
    repaid_amount       = v_repaid,
    outstanding_balance = v_used - v_repaid
  WHERE id = p_credit_id;
END;
$$;


--
-- Name: replace_document_associations(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_document_associations(p_document_id uuid, p_associations jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  DELETE FROM document_associations WHERE document_id = p_document_id;

  IF p_associations IS NOT NULL AND jsonb_array_length(p_associations) > 0 THEN
    INSERT INTO document_associations (document_id, entity_type, entity_id)
    SELECT p_document_id,
           a->>'entityType',
           (a->>'entityId')::uuid
    FROM jsonb_array_elements(p_associations) a;
  END IF;
END;
$$;


--
-- Name: reset_milestone_status_on_invoice_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_milestone_status_on_invoice_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
IF TG_OP = 'DELETE' THEN
IF OLD.milestone_id IS NOT NULL THEN
UPDATE subcontractor_milestones
SET status = 'pending'
WHERE id = OLD.milestone_id;
END IF;
RETURN OLD;
ELSIF TG_OP = 'UPDATE' THEN
IF OLD.milestone_id IS DISTINCT FROM NEW.milestone_id THEN
IF OLD.milestone_id IS NOT NULL THEN
UPDATE subcontractor_milestones
SET status = 'pending'
WHERE id = OLD.milestone_id;
END IF;
END IF;
RETURN NEW;
END IF;
RETURN NEW;
END;
$$;


--
-- Name: reset_retail_milestone_on_invoice_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_retail_milestone_on_invoice_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
-- Reset milestone to pending if invoice is deleted and it was paid
IF OLD.retail_milestone_id IS NOT NULL AND OLD.status = 'PAID' THEN
UPDATE retail_contract_milestones
SET 
status = 'pending',
completed_date = NULL,
updated_at = now()
WHERE id = OLD.retail_milestone_id;
END IF;

RETURN OLD;
END;
$$;


--
-- Name: sync_bank_credit_on_invoice_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_bank_credit_on_invoice_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
IF OLD.bank_credit_id IS NOT NULL
AND OLD.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK', 'INCOMING_BANK_EXPENSES') THEN
PERFORM recalculate_bank_credit_fields(OLD.bank_credit_id);
END IF;
END IF;

IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
IF NEW.bank_credit_id IS NOT NULL
AND NEW.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK', 'INCOMING_BANK_EXPENSES') THEN
PERFORM recalculate_bank_credit_fields(NEW.bank_credit_id);
END IF;
END IF;

RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: sync_bank_credit_on_payment_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_bank_credit_on_payment_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
v_credit_id      uuid;
v_bank_credit_id uuid;
BEGIN
IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
IF OLD.credit_id IS NOT NULL THEN
PERFORM recalculate_bank_credit_fields(OLD.credit_id);
END IF;
IF OLD.cesija_credit_id IS NOT NULL THEN
PERFORM recalculate_bank_credit_fields(OLD.cesija_credit_id);
END IF;
IF OLD.invoice_id IS NOT NULL THEN
SELECT ai.bank_credit_id INTO v_bank_credit_id
FROM accounting_invoices ai
WHERE ai.id = OLD.invoice_id
AND ai.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK', 'INCOMING_BANK_EXPENSES');
IF v_bank_credit_id IS NOT NULL THEN
PERFORM recalculate_bank_credit_fields(v_bank_credit_id);
END IF;
END IF;
END IF;

IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
IF NEW.credit_id IS NOT NULL THEN
PERFORM recalculate_bank_credit_fields(NEW.credit_id);
END IF;
IF NEW.cesija_credit_id IS NOT NULL THEN
PERFORM recalculate_bank_credit_fields(NEW.cesija_credit_id);
END IF;
IF NEW.invoice_id IS NOT NULL THEN
SELECT ai.bank_credit_id INTO v_bank_credit_id
FROM accounting_invoices ai
WHERE ai.id = NEW.invoice_id
AND ai.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK', 'INCOMING_BANK_EXPENSES');
IF v_bank_credit_id IS NOT NULL THEN
PERFORM recalculate_bank_credit_fields(v_bank_credit_id);
END IF;
END IF;
END IF;

RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: trigger_generate_payment_schedule(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_generate_payment_schedule() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
IF NEW.payment_schedule IS NOT NULL AND jsonb_array_length(NEW.payment_schedule) > 0 THEN
PERFORM generate_payment_schedule(NEW.id);
END IF;
RETURN NEW;
END;
$$;


--
-- Name: trigger_mark_notification_completed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_mark_notification_completed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
UPDATE payment_notifications
SET status = 'completed'
WHERE project_investment_id = NEW.project_investment_id
AND due_date <= NEW.payment_date
AND status = 'pending';

RETURN NEW;
END;
$$;


--
-- Name: trigger_update_payment_schedule(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_update_payment_schedule() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
IF NEW.payment_schedule IS DISTINCT FROM OLD.payment_schedule THEN
DELETE FROM payment_notifications WHERE project_investment_id = NEW.id;

IF NEW.payment_schedule IS NOT NULL AND jsonb_array_length(NEW.payment_schedule) > 0 THEN
PERFORM generate_payment_schedule(NEW.id);
END IF;
END IF;
RETURN NEW;
END;
$$;


--
-- Name: update_accounting_payments_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_accounting_payments_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$$;


--
-- Name: update_bank_balance_for_investment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bank_balance_for_investment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
-- On INSERT: If disbursed to account, increase bank balance
IF TG_OP = 'INSERT' AND NEW.disbursed_to_account = TRUE AND NEW.disbursed_to_bank_account_id IS NOT NULL THEN
UPDATE company_bank_accounts
SET balance = balance + NEW.amount
WHERE id = NEW.disbursed_to_bank_account_id;
END IF;

-- On UPDATE: Handle changes in disbursement status or amount
IF TG_OP = 'UPDATE' THEN
-- If disbursement status changed from false to true
IF (OLD.disbursed_to_account = FALSE OR OLD.disbursed_to_account IS NULL) AND NEW.disbursed_to_account = TRUE THEN
UPDATE company_bank_accounts
SET balance = balance + NEW.amount
WHERE id = NEW.disbursed_to_bank_account_id;
END IF;

-- If disbursement status changed from true to false
IF OLD.disbursed_to_account = TRUE AND (NEW.disbursed_to_account = FALSE OR NEW.disbursed_to_account IS NULL) THEN
UPDATE company_bank_accounts
SET balance = balance - OLD.amount
WHERE id = OLD.disbursed_to_bank_account_id;
END IF;

-- If still disbursed but amount changed
IF OLD.disbursed_to_account = TRUE AND NEW.disbursed_to_account = TRUE AND OLD.amount != NEW.amount THEN
UPDATE company_bank_accounts
SET balance = balance - OLD.amount + NEW.amount
WHERE id = NEW.disbursed_to_bank_account_id;
END IF;

-- If still disbursed but bank account changed
IF OLD.disbursed_to_account = TRUE AND NEW.disbursed_to_account = TRUE 
AND OLD.disbursed_to_bank_account_id != NEW.disbursed_to_bank_account_id THEN
-- Decrease old account
UPDATE company_bank_accounts
SET balance = balance - OLD.amount
WHERE id = OLD.disbursed_to_bank_account_id;

-- Increase new account
UPDATE company_bank_accounts
SET balance = balance + NEW.amount
WHERE id = NEW.disbursed_to_bank_account_id;
END IF;
END IF;

-- On DELETE: If was disbursed, decrease bank balance
IF TG_OP = 'DELETE' AND OLD.disbursed_to_account = TRUE AND OLD.disbursed_to_bank_account_id IS NOT NULL THEN
UPDATE company_bank_accounts
SET balance = balance - OLD.amount
WHERE id = OLD.disbursed_to_bank_account_id;
END IF;

IF TG_OP = 'DELETE' THEN
RETURN OLD;
ELSE
RETURN NEW;
END IF;
END;
$$;


--
-- Name: update_bank_in_accounting_companies(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bank_in_accounting_companies() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
UPDATE accounting_companies
SET name = NEW.name
WHERE bank_id = NEW.id;

RETURN NEW;
END;
$$;


--
-- Name: update_company_bank_account_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_company_bank_account_balance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
v_company_bank_account_id uuid;
v_cesija_bank_account_id uuid;
v_reset_at timestamptz;
v_cesija_reset_at timestamptz;
BEGIN
IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
v_company_bank_account_id := NEW.company_bank_account_id;
v_cesija_bank_account_id := NEW.cesija_bank_account_id;

IF v_company_bank_account_id IS NOT NULL THEN
SELECT balance_reset_at INTO v_reset_at
FROM company_bank_accounts
WHERE id = v_company_bank_account_id;

UPDATE company_bank_accounts
SET current_balance = initial_balance
+ COALESCE(
(SELECT SUM(
CASE
WHEN ai.invoice_type IN (
'OUTGOING_SALES',
'OUTGOING_OFFICE',
'OUTGOING_SUPPLIER',
'OUTGOING_BANK',
'OUTGOING_RETAIL_DEVELOPMENT',
'OUTGOING_RETAIL_CONSTRUCTION'
) THEN ap.amount
WHEN ai.invoice_type IN (
'INCOMING_SUPPLIER',
'INCOMING_OFFICE',
'INCOMING_INVESTMENT',
'INCOMING_BANK',
'INCOMING_BANK_EXPENSES'
) THEN -ap.amount
ELSE 0
END
)
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ap.company_bank_account_id = v_company_bank_account_id
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(ap.amount)
FROM accounting_payments ap
WHERE ap.cesija_bank_account_id = v_company_bank_account_id
AND ap.is_cesija = true
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.from_bank_account_id = v_company_bank_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
)
+ COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.to_bank_account_id = v_company_bank_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
),
updated_at = now()
WHERE id = v_company_bank_account_id;
END IF;

IF v_cesija_bank_account_id IS NOT NULL THEN
SELECT balance_reset_at INTO v_cesija_reset_at
FROM company_bank_accounts
WHERE id = v_cesija_bank_account_id;

UPDATE company_bank_accounts
SET current_balance = initial_balance
+ COALESCE(
(SELECT SUM(
CASE
WHEN ai.invoice_type IN (
'OUTGOING_SALES',
'OUTGOING_OFFICE',
'OUTGOING_SUPPLIER',
'OUTGOING_BANK',
'OUTGOING_RETAIL_DEVELOPMENT',
'OUTGOING_RETAIL_CONSTRUCTION'
) THEN ap.amount
WHEN ai.invoice_type IN (
'INCOMING_SUPPLIER',
'INCOMING_OFFICE',
'INCOMING_INVESTMENT',
'INCOMING_BANK',
'INCOMING_BANK_EXPENSES'
) THEN -ap.amount
ELSE 0
END
)
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ap.company_bank_account_id = v_cesija_bank_account_id
AND (v_cesija_reset_at IS NULL OR ap.payment_date >= v_cesija_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(ap.amount)
FROM accounting_payments ap
WHERE ap.cesija_bank_account_id = v_cesija_bank_account_id
AND ap.is_cesija = true
AND (v_cesija_reset_at IS NULL OR ap.payment_date >= v_cesija_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.from_bank_account_id = v_cesija_bank_account_id
AND (v_cesija_reset_at IS NULL OR cl.loan_date >= v_cesija_reset_at::date)
), 0
)
+ COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.to_bank_account_id = v_cesija_bank_account_id
AND (v_cesija_reset_at IS NULL OR cl.loan_date >= v_cesija_reset_at::date)
), 0
),
updated_at = now()
WHERE id = v_cesija_bank_account_id;
END IF;
END IF;

IF TG_OP = 'DELETE' THEN
v_company_bank_account_id := OLD.company_bank_account_id;
v_cesija_bank_account_id := OLD.cesija_bank_account_id;

IF v_company_bank_account_id IS NOT NULL THEN
SELECT balance_reset_at INTO v_reset_at
FROM company_bank_accounts
WHERE id = v_company_bank_account_id;

UPDATE company_bank_accounts
SET current_balance = initial_balance
+ COALESCE(
(SELECT SUM(
CASE
WHEN ai.invoice_type IN (
'OUTGOING_SALES',
'OUTGOING_OFFICE',
'OUTGOING_SUPPLIER',
'OUTGOING_BANK',
'OUTGOING_RETAIL_DEVELOPMENT',
'OUTGOING_RETAIL_CONSTRUCTION'
) THEN ap.amount
WHEN ai.invoice_type IN (
'INCOMING_SUPPLIER',
'INCOMING_OFFICE',
'INCOMING_INVESTMENT',
'INCOMING_BANK',
'INCOMING_BANK_EXPENSES'
) THEN -ap.amount
ELSE 0
END
)
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ap.company_bank_account_id = v_company_bank_account_id
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(ap.amount)
FROM accounting_payments ap
WHERE ap.cesija_bank_account_id = v_company_bank_account_id
AND ap.is_cesija = true
AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.from_bank_account_id = v_company_bank_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
)
+ COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.to_bank_account_id = v_company_bank_account_id
AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
), 0
),
updated_at = now()
WHERE id = v_company_bank_account_id;
END IF;

IF v_cesija_bank_account_id IS NOT NULL THEN
SELECT balance_reset_at INTO v_cesija_reset_at
FROM company_bank_accounts
WHERE id = v_cesija_bank_account_id;

UPDATE company_bank_accounts
SET current_balance = initial_balance
+ COALESCE(
(SELECT SUM(
CASE
WHEN ai.invoice_type IN (
'OUTGOING_SALES',
'OUTGOING_OFFICE',
'OUTGOING_SUPPLIER',
'OUTGOING_BANK',
'OUTGOING_RETAIL_DEVELOPMENT',
'OUTGOING_RETAIL_CONSTRUCTION'
) THEN ap.amount
WHEN ai.invoice_type IN (
'INCOMING_SUPPLIER',
'INCOMING_OFFICE',
'INCOMING_INVESTMENT',
'INCOMING_BANK',
'INCOMING_BANK_EXPENSES'
) THEN -ap.amount
ELSE 0
END
)
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ap.company_bank_account_id = v_cesija_bank_account_id
AND (v_cesija_reset_at IS NULL OR ap.payment_date >= v_cesija_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(ap.amount)
FROM accounting_payments ap
WHERE ap.cesija_bank_account_id = v_cesija_bank_account_id
AND ap.is_cesija = true
AND (v_cesija_reset_at IS NULL OR ap.payment_date >= v_cesija_reset_at::date)
), 0
)
- COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.from_bank_account_id = v_cesija_bank_account_id
AND (v_cesija_reset_at IS NULL OR cl.loan_date >= v_cesija_reset_at::date)
), 0
)
+ COALESCE(
(SELECT SUM(cl.amount)
FROM company_loans cl
WHERE cl.to_bank_account_id = v_cesija_bank_account_id
AND (v_cesija_reset_at IS NULL OR cl.loan_date >= v_cesija_reset_at::date)
), 0
),
updated_at = now()
WHERE id = v_cesija_bank_account_id;
END IF;

RETURN OLD;
END IF;

RETURN NEW;
END;
$$;


--
-- Name: update_contract_budget_realized(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contract_budget_realized() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
v_contract_id uuid;
v_total_paid numeric;
BEGIN
IF TG_OP = 'DELETE' THEN
SELECT contract_id INTO v_contract_id
FROM accounting_invoices
WHERE id = OLD.invoice_id;
ELSE
SELECT contract_id INTO v_contract_id
FROM accounting_invoices
WHERE id = NEW.invoice_id;
END IF;

IF v_contract_id IS NOT NULL THEN
SELECT COALESCE(SUM(ap.amount), 0) INTO v_total_paid
FROM accounting_payments ap
INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ai.contract_id = v_contract_id;

UPDATE contracts
SET budget_realized = v_total_paid
WHERE id = v_contract_id;
END IF;

IF TG_OP = 'DELETE' THEN
RETURN OLD;
ELSE
RETURN NEW;
END IF;
END;
$$;


--
-- Name: update_contract_total_invoices(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contract_total_invoices() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
v_contract_id uuid;
v_total_invoices numeric;
BEGIN
-- Get contract_id from the invoice
IF TG_OP = 'DELETE' THEN
v_contract_id := OLD.contract_id;
ELSE
v_contract_id := NEW.contract_id;
END IF;

-- Only proceed if invoice has a contract_id
IF v_contract_id IS NOT NULL THEN
-- Calculate total invoices amount for this contract (sum of all invoice total_amounts with VAT)
SELECT COALESCE(SUM(total_amount), 0) INTO v_total_invoices
FROM accounting_invoices
WHERE contract_id = v_contract_id;

-- Update the contract's total_invoices_amount
UPDATE contracts
SET total_invoices_amount = v_total_invoices
WHERE id = v_contract_id;
END IF;

-- Return appropriate row based on operation
IF TG_OP = 'DELETE' THEN
RETURN OLD;
ELSE
RETURN NEW;
END IF;
END;
$$;


--
-- Name: update_contracts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contracts_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


--
-- Name: update_credit_allocation_used_amount(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_credit_allocation_used_amount() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
IF TG_OP = 'INSERT' THEN
IF NEW.credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) + NEW.amount
WHERE id = NEW.credit_allocation_id;
END IF;

IF NEW.cesija_credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) - NEW.amount
WHERE id = NEW.cesija_credit_allocation_id;
END IF;

RETURN NEW;
ELSIF TG_OP = 'DELETE' THEN
IF OLD.credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) - OLD.amount
WHERE id = OLD.credit_allocation_id;
END IF;

IF OLD.cesija_credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) + OLD.amount
WHERE id = OLD.cesija_credit_allocation_id;
END IF;

RETURN OLD;
END IF;

RETURN NULL;
END;
$$;


--
-- Name: update_credit_allocation_used_amount_from_invoice(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_credit_allocation_used_amount_from_invoice() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
-- INSERT: add invoice amount to allocation used_amount
IF TG_OP = 'INSERT' THEN
IF NEW.invoice_type = 'OUTGOING_BANK' AND NEW.credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) + NEW.total_amount,
updated_at  = now()
WHERE id = NEW.credit_allocation_id;
END IF;
RETURN NEW;
END IF;

-- DELETE: subtract invoice amount from allocation used_amount
IF TG_OP = 'DELETE' THEN
IF OLD.invoice_type = 'OUTGOING_BANK' AND OLD.credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = GREATEST(0, COALESCE(used_amount, 0) - OLD.total_amount),
updated_at  = now()
WHERE id = OLD.credit_allocation_id;
END IF;
RETURN OLD;
END IF;

-- UPDATE: handle amount changes and/or allocation reassignment
IF TG_OP = 'UPDATE' THEN
-- Remove contribution from old allocation
IF OLD.invoice_type = 'OUTGOING_BANK' AND OLD.credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = GREATEST(0, COALESCE(used_amount, 0) - OLD.total_amount),
updated_at  = now()
WHERE id = OLD.credit_allocation_id;
END IF;

-- Add contribution to new allocation
IF NEW.invoice_type = 'OUTGOING_BANK' AND NEW.credit_allocation_id IS NOT NULL THEN
UPDATE credit_allocations
SET used_amount = COALESCE(used_amount, 0) + NEW.total_amount,
updated_at  = now()
WHERE id = NEW.credit_allocation_id;
END IF;

RETURN NEW;
END IF;

RETURN NULL;
END;
$$;


--
-- Name: update_invoice_payment_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_invoice_payment_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
total_paid decimal(15,2);
invoice_total decimal(15,2);
new_status text;
target_invoice_id uuid;
BEGIN
-- Get the invoice ID from NEW or OLD
target_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

-- Get total paid amount for the invoice
SELECT COALESCE(SUM(amount), 0)
INTO total_paid
FROM accounting_payments
WHERE invoice_id = target_invoice_id;

-- Get invoice total amount
SELECT total_amount
INTO invoice_total
FROM accounting_invoices
WHERE id = target_invoice_id;

-- Determine new status
IF total_paid = 0 THEN
new_status := 'UNPAID';
ELSIF total_paid >= invoice_total THEN
new_status := 'PAID';
ELSE
new_status := 'PARTIALLY_PAID';
END IF;

-- Update invoice with RLS bypass (SECURITY DEFINER as postgres)
UPDATE accounting_invoices
SET
paid_amount = total_paid,
remaining_amount = total_amount - total_paid,
status = new_status,
updated_at = now()
WHERE id = target_invoice_id;

RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_milestone_status_on_payment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_milestone_status_on_payment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
v_invoice_id uuid;
v_milestone_id uuid;
v_total_paid numeric;
v_total_amount numeric;
BEGIN
IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
v_invoice_id := NEW.invoice_id;
ELSIF TG_OP = 'DELETE' THEN
v_invoice_id := OLD.invoice_id;
END IF;

SELECT milestone_id, total_amount
INTO v_milestone_id, v_total_amount
FROM accounting_invoices
WHERE id = v_invoice_id;

IF v_milestone_id IS NOT NULL THEN
SELECT COALESCE(SUM(amount), 0)
INTO v_total_paid
FROM accounting_payments
WHERE invoice_id = v_invoice_id;

IF v_total_paid >= v_total_amount THEN
UPDATE subcontractor_milestones
SET status = 'paid',
paid_date = CURRENT_DATE
WHERE id = v_milestone_id;
ELSIF v_total_paid > 0 THEN
UPDATE subcontractor_milestones
SET status = 'completed',
paid_date = NULL
WHERE id = v_milestone_id;
ELSE
UPDATE subcontractor_milestones
SET status = 'pending',
paid_date = NULL
WHERE id = v_milestone_id;
END IF;
END IF;

IF TG_OP = 'DELETE' THEN
RETURN OLD;
ELSE
RETURN NEW;
END IF;
END;
$$;


--
-- Name: update_monthly_budgets_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_monthly_budgets_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$$;


--
-- Name: update_overdue_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_overdue_notifications() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
UPDATE payment_notifications
SET status = 'overdue'
WHERE status = 'pending'
AND due_date < CURRENT_DATE;
END;
$$;


--
-- Name: update_retail_contract_budget_realized(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_retail_contract_budget_realized() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
v_retail_contract_id UUID;
v_total_paid NUMERIC := 0;
BEGIN
IF TG_OP = 'DELETE' THEN
SELECT retail_contract_id INTO v_retail_contract_id
FROM accounting_invoices
WHERE id = OLD.invoice_id;
ELSE
SELECT retail_contract_id INTO v_retail_contract_id
FROM accounting_invoices
WHERE id = NEW.invoice_id;
END IF;

IF v_retail_contract_id IS NOT NULL THEN
SELECT COALESCE(SUM(ap.amount), 0) INTO v_total_paid
FROM accounting_payments ap
JOIN accounting_invoices ai ON ap.invoice_id = ai.id
WHERE ai.retail_contract_id = v_retail_contract_id;

UPDATE retail_contracts
SET budget_realized = v_total_paid,
updated_at = now()
WHERE id = v_retail_contract_id;
END IF;

IF TG_OP = 'DELETE' THEN
RETURN OLD;
ELSE
RETURN NEW;
END IF;
END;
$$;


--
-- Name: update_retail_contract_budget_realized_from_payments(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_retail_contract_budget_realized_from_payments() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
v_retail_contract_id UUID;
v_total_paid_base NUMERIC := 0;
v_invoice RECORD;
BEGIN
-- Get retail_contract_id from the invoice
IF TG_OP = 'DELETE' THEN
SELECT retail_contract_id INTO v_retail_contract_id
FROM accounting_invoices
WHERE id = OLD.invoice_id;
ELSE
SELECT retail_contract_id INTO v_retail_contract_id
FROM accounting_invoices
WHERE id = NEW.invoice_id;
END IF;

-- Only proceed if invoice has a retail_contract_id
IF v_retail_contract_id IS NOT NULL THEN
-- Calculate total paid (base amount without VAT) for this retail contract
-- For each invoice, calculate: (total_paid / total_amount) * base_amount
FOR v_invoice IN
SELECT 
ai.id,
ai.base_amount,
ai.total_amount,
COALESCE(SUM(ap.amount), 0) as total_paid
FROM accounting_invoices ai
LEFT JOIN accounting_payments ap ON ap.invoice_id = ai.id
WHERE ai.retail_contract_id = v_retail_contract_id
GROUP BY ai.id, ai.base_amount, ai.total_amount
LOOP
-- Calculate proportional base amount paid
IF v_invoice.total_amount > 0 THEN
v_total_paid_base := v_total_paid_base + 
((v_invoice.total_paid / v_invoice.total_amount) * v_invoice.base_amount);
END IF;
END LOOP;

-- Update the retail contract's budget_realized with base amounts only
UPDATE retail_contracts
SET budget_realized = v_total_paid_base,
updated_at = now()
WHERE id = v_retail_contract_id;
END IF;

-- Return appropriate row based on operation
IF TG_OP = 'DELETE' THEN
RETURN OLD;
ELSE
RETURN NEW;
END IF;
END;
$$;


--
-- Name: update_retail_contract_total_invoices(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_retail_contract_total_invoices() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
v_retail_contract_id uuid;
v_total_invoices numeric;
BEGIN
-- Get retail_contract_id from the invoice
IF TG_OP = 'DELETE' THEN
v_retail_contract_id := OLD.retail_contract_id;
ELSE
v_retail_contract_id := NEW.retail_contract_id;
END IF;

-- Only proceed if invoice has a retail_contract_id
IF v_retail_contract_id IS NOT NULL THEN
-- Calculate total invoices amount for this retail contract
SELECT COALESCE(SUM(total_amount), 0) INTO v_total_invoices
FROM accounting_invoices
WHERE retail_contract_id = v_retail_contract_id;

-- Update the retail contract's total_invoices_amount
UPDATE retail_contracts
SET total_invoices_amount = v_total_invoices
WHERE id = v_retail_contract_id;
END IF;

-- Return appropriate row based on operation
IF TG_OP = 'DELETE' THEN
RETURN OLD;
ELSE
RETURN NEW;
END IF;
END;
$$;


--
-- Name: update_retail_milestone_status_on_payment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_retail_milestone_status_on_payment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
-- If invoice is paid and has a retail milestone
IF NEW.status = 'PAID' AND NEW.retail_milestone_id IS NOT NULL THEN
UPDATE retail_contract_milestones
SET 
status = 'paid',
completed_date = CURRENT_DATE,
updated_at = now()
WHERE id = NEW.retail_milestone_id;
END IF;

-- If invoice was paid but is now unpaid/partial
IF (OLD.status = 'PAID' AND NEW.status != 'PAID') 
AND NEW.retail_milestone_id IS NOT NULL THEN
UPDATE retail_contract_milestones
SET 
status = 'pending',
completed_date = NULL,
updated_at = now()
WHERE id = NEW.retail_milestone_id;
END IF;

RETURN NEW;
END;
$$;


--
-- Name: update_subcontractor_contract_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_subcontractor_contract_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
IF TG_OP = 'INSERT' THEN
UPDATE subcontractors
SET active_contracts_count = COALESCE(active_contracts_count, 0) + 1
WHERE id = NEW.subcontractor_id;
ELSIF TG_OP = 'DELETE' THEN
UPDATE subcontractors
SET active_contracts_count = GREATEST(0, COALESCE(active_contracts_count, 0) - 1)
WHERE id = OLD.subcontractor_id;
END IF;

IF TG_OP = 'DELETE' THEN
RETURN OLD;
ELSE
RETURN NEW;
END IF;
END;
$$;


--
-- Name: update_subcontractor_milestones_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_subcontractor_milestones_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$$;


--
-- Name: update_wire_payments_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_wire_payments_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


--
-- Name: update_work_logs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_work_logs_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


--
-- Name: user_has_project_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_project_access(p_project_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
-- Directors have access to all projects
IF EXISTS (
SELECT 1
FROM public.users
WHERE auth_user_id = auth.uid()
AND role = 'Director'
) THEN
RETURN TRUE;
END IF;

-- Supervision users have access to assigned projects
IF EXISTS (
SELECT 1
FROM public.users u
INNER JOIN public.project_managers pm ON pm.user_id = u.id
WHERE u.auth_user_id = auth.uid()
AND u.role = 'Supervision'
AND pm.project_id = p_project_id
) THEN
RETURN TRUE;
END IF;

RETURN FALSE;
END;
$$;


--
-- Name: user_has_project_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_project_access(user_uuid uuid, proj_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
user_role_var text;
BEGIN
SELECT role INTO user_role_var FROM users WHERE id = user_uuid;

IF user_role_var IN ('Director', 'Investment', 'Sales', 'Accounting') THEN
RETURN true;
END IF;

IF user_role_var = 'Supervision' THEN
RETURN EXISTS (
SELECT 1 FROM project_managers 
WHERE user_id = user_uuid AND project_id = proj_id
);
END IF;

RETURN false;
END;
$$;


--
-- Name: validate_refinancing_entity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_refinancing_entity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
IF NEW.allocation_type = 'refinancing' THEN
IF NEW.refinancing_entity_type = 'company' THEN
IF NOT EXISTS (SELECT 1 FROM accounting_companies WHERE id = NEW.refinancing_entity_id) THEN
RAISE EXCEPTION 'Referenced company does not exist';
END IF;
ELSIF NEW.refinancing_entity_type = 'bank' THEN
IF NOT EXISTS (SELECT 1 FROM banks WHERE id = NEW.refinancing_entity_id) THEN
RAISE EXCEPTION 'Referenced bank does not exist';
END IF;
END IF;
END IF;

RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounting_companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    oib text NOT NULL,
    initial_balance numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: accounting_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_type text NOT NULL,
    company_id uuid NOT NULL,
    supplier_id uuid,
    customer_id uuid,
    invoice_number text NOT NULL,
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date NOT NULL,
    base_amount numeric DEFAULT 0 NOT NULL,
    vat_rate numeric DEFAULT 0 NOT NULL,
    vat_amount numeric DEFAULT 0 NOT NULL,
    total_amount numeric DEFAULT 0 NOT NULL,
    category text NOT NULL,
    project_id uuid,
    description text DEFAULT ''::text,
    status text DEFAULT 'UNPAID'::text NOT NULL,
    paid_amount numeric DEFAULT 0 NOT NULL,
    remaining_amount numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    apartment_id uuid,
    bank_credit_id uuid,
    investment_id uuid,
    milestone_id uuid,
    invoice_category text NOT NULL,
    investor_id uuid,
    bank_id uuid,
    contract_id uuid,
    office_supplier_id uuid,
    company_bank_account_id uuid,
    retail_project_id uuid,
    retail_contract_id uuid,
    retail_supplier_id uuid,
    retail_customer_id uuid,
    retail_milestone_id uuid,
    base_amount_1 numeric DEFAULT 0 NOT NULL,
    vat_rate_1 numeric DEFAULT 25 NOT NULL,
    vat_amount_1 numeric DEFAULT 0 NOT NULL,
    base_amount_2 numeric DEFAULT 0 NOT NULL,
    vat_rate_2 numeric DEFAULT 13 NOT NULL,
    vat_amount_2 numeric DEFAULT 0 NOT NULL,
    base_amount_3 numeric DEFAULT 0 NOT NULL,
    vat_rate_3 numeric DEFAULT 0 NOT NULL,
    vat_amount_3 numeric DEFAULT 0 NOT NULL,
    base_amount_4 numeric DEFAULT 0 NOT NULL,
    vat_rate_4 numeric DEFAULT 5 NOT NULL,
    vat_amount_4 numeric DEFAULT 0 NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    reference_number text,
    iban text,
    refund_id bigint,
    credit_allocation_id uuid,
    CONSTRAINT accounting_invoices_base_amount_check CHECK ((base_amount >= (0)::numeric)),
    CONSTRAINT accounting_invoices_invoice_category_check CHECK ((invoice_category = ANY (ARRAY['SUBCONTRACTOR'::text, 'OFFICE'::text, 'APARTMENT'::text, 'CUSTOMER'::text, 'BANK_CREDIT'::text, 'INVESTOR'::text, 'MISCELLANEOUS'::text, 'GENERAL'::text, 'RETAIL'::text]))),
    CONSTRAINT accounting_invoices_invoice_type_check CHECK ((invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'INCOMING_INVESTMENT'::text, 'INCOMING_OFFICE'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text, 'OUTGOING_SUPPLIER'::text, 'OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text, 'OUTGOING_BANK'::text]))),
    CONSTRAINT accounting_invoices_paid_amount_check CHECK ((paid_amount >= (0)::numeric)),
    CONSTRAINT accounting_invoices_remaining_amount_check CHECK ((remaining_amount >= (0)::numeric)),
    CONSTRAINT accounting_invoices_status_check CHECK ((status = ANY (ARRAY['UNPAID'::text, 'PARTIALLY_PAID'::text, 'PAID'::text]))),
    CONSTRAINT accounting_invoices_total_amount_check CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT accounting_invoices_vat_amount_check CHECK ((vat_amount >= (0)::numeric)),
    CONSTRAINT accounting_invoices_vat_rate_check CHECK ((vat_rate = ANY (ARRAY[(0)::numeric, (13)::numeric, (25)::numeric]))),
    CONSTRAINT check_invoice_entity_type CHECK ((((invoice_type = 'INCOMING_SUPPLIER'::text) AND ((supplier_id IS NOT NULL) OR (retail_supplier_id IS NOT NULL)) AND (customer_id IS NULL) AND (retail_customer_id IS NULL) AND (office_supplier_id IS NULL) AND (investor_id IS NULL) AND (bank_id IS NULL)) OR ((invoice_type = 'OUTGOING_SUPPLIER'::text) AND ((supplier_id IS NOT NULL) OR (retail_supplier_id IS NOT NULL) OR (bank_id IS NOT NULL)) AND (customer_id IS NULL) AND (retail_customer_id IS NULL) AND (office_supplier_id IS NULL) AND (investor_id IS NULL)) OR ((invoice_type = 'OUTGOING_SALES'::text) AND ((customer_id IS NOT NULL) OR (retail_customer_id IS NOT NULL)) AND (supplier_id IS NULL) AND (retail_supplier_id IS NULL) AND (office_supplier_id IS NULL) AND (investor_id IS NULL) AND (bank_id IS NULL)) OR ((invoice_type = 'INCOMING_INVESTMENT'::text) AND ((investor_id IS NOT NULL) OR (bank_id IS NOT NULL)) AND (supplier_id IS NULL) AND (retail_supplier_id IS NULL) AND (customer_id IS NULL) AND (retail_customer_id IS NULL) AND (office_supplier_id IS NULL)) OR ((invoice_type = 'INCOMING_OFFICE'::text) AND (office_supplier_id IS NOT NULL) AND (supplier_id IS NULL) AND (retail_supplier_id IS NULL) AND (customer_id IS NULL) AND (retail_customer_id IS NULL) AND (investor_id IS NULL) AND (bank_id IS NULL)) OR ((invoice_type = 'OUTGOING_OFFICE'::text) AND (office_supplier_id IS NOT NULL) AND (supplier_id IS NULL) AND (retail_supplier_id IS NULL) AND (customer_id IS NULL) AND (retail_customer_id IS NULL) AND (investor_id IS NULL) AND (bank_id IS NULL)) OR ((invoice_type = 'OUTGOING_BANK'::text) AND (bank_id IS NOT NULL) AND (supplier_id IS NULL) AND (retail_supplier_id IS NULL) AND (customer_id IS NULL) AND (retail_customer_id IS NULL) AND (office_supplier_id IS NULL) AND (investor_id IS NULL)) OR ((invoice_type = 'INCOMING_BANK'::text) AND (bank_id IS NOT NULL) AND (supplier_id IS NULL) AND (retail_supplier_id IS NULL) AND (customer_id IS NULL) AND (retail_customer_id IS NULL) AND (office_supplier_id IS NULL) AND (investor_id IS NULL)) OR ((invoice_type = 'INCOMING_BANK_EXPENSES'::text) AND (bank_id IS NOT NULL) AND (supplier_id IS NULL) AND (retail_supplier_id IS NULL) AND (customer_id IS NULL) AND (retail_customer_id IS NULL) AND (office_supplier_id IS NULL) AND (investor_id IS NULL)))),
    CONSTRAINT check_paid_amounts CHECK ((paid_amount <= total_amount)),
    CONSTRAINT check_remaining_amount CHECK ((remaining_amount = (total_amount - paid_amount)))
);


--
-- Name: COLUMN accounting_invoices.milestone_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.milestone_id IS 'Optional link to a subcontractor milestone. When invoice is paid, milestone status is automatically updated to paid.';


--
-- Name: COLUMN accounting_invoices.retail_project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.retail_project_id IS 'Reference to retail_projects for retail invoices';


--
-- Name: COLUMN accounting_invoices.retail_contract_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.retail_contract_id IS 'Reference to retail_contracts (phases) for retail invoices';


--
-- Name: COLUMN accounting_invoices.retail_supplier_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.retail_supplier_id IS 'Reference to retail_suppliers for retail project invoices';


--
-- Name: COLUMN accounting_invoices.retail_customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.retail_customer_id IS 'Reference to retail_customers for retail project invoices';


--
-- Name: COLUMN accounting_invoices.base_amount_1; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.base_amount_1 IS 'Base amount subject to 25% VAT rate';


--
-- Name: COLUMN accounting_invoices.vat_amount_1; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.vat_amount_1 IS 'Calculated VAT amount at 25% rate';


--
-- Name: COLUMN accounting_invoices.base_amount_2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.base_amount_2 IS 'Base amount subject to 13% VAT rate';


--
-- Name: COLUMN accounting_invoices.vat_amount_2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.vat_amount_2 IS 'Calculated VAT amount at 13% rate';


--
-- Name: COLUMN accounting_invoices.base_amount_3; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.base_amount_3 IS 'Base amount subject to 0% VAT rate';


--
-- Name: COLUMN accounting_invoices.vat_amount_3; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.vat_amount_3 IS 'Calculated VAT amount at 0% rate (always 0)';


--
-- Name: COLUMN accounting_invoices.base_amount_4; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.base_amount_4 IS 'Base amount subject to 5% VAT rate';


--
-- Name: COLUMN accounting_invoices.vat_amount_4; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_invoices.vat_amount_4 IS 'Calculated VAT amount at 5% rate';


--
-- Name: accounting_invoices_refund; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_invoices_refund (
    id bigint NOT NULL,
    name text NOT NULL
);


--
-- Name: accounting_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(15,2) NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    description text DEFAULT ''::text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    company_bank_account_id uuid,
    is_cesija boolean DEFAULT false,
    cesija_company_id uuid,
    cesija_bank_account_id uuid,
    payment_source_type text DEFAULT 'bank_account'::text,
    credit_id uuid,
    cesija_credit_id uuid,
    credit_allocation_id uuid,
    cesija_credit_allocation_id uuid,
    CONSTRAINT accounting_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT accounting_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['WIRE'::text, 'CASH'::text, 'CHECK'::text, 'CARD'::text]))),
    CONSTRAINT accounting_payments_payment_source_type_check CHECK ((payment_source_type = ANY (ARRAY['bank_account'::text, 'credit'::text, 'kompenzacija'::text, 'gotovina'::text])))
);


--
-- Name: COLUMN accounting_payments.is_cesija; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_payments.is_cesija IS 'Indicates if this is a cesija payment (one company paying for another)';


--
-- Name: COLUMN accounting_payments.cesija_company_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_payments.cesija_company_id IS 'The company that is actually making the payment (if cesija)';


--
-- Name: COLUMN accounting_payments.cesija_bank_account_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounting_payments.cesija_bank_account_id IS 'The bank account used for cesija payment';


--
-- Name: accounting_refund_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.accounting_invoices_refund ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.accounting_refund_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_role text NOT NULL,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id uuid,
    project_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: apartment_garages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apartment_garages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    apartment_id uuid NOT NULL,
    garage_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: apartment_repositories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apartment_repositories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    apartment_id uuid NOT NULL,
    repository_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: apartments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apartments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    number text NOT NULL,
    floor integer NOT NULL,
    size_m2 numeric(8,2) NOT NULL,
    price numeric(15,2) NOT NULL,
    status text DEFAULT 'Available'::text NOT NULL,
    buyer_name text,
    created_at timestamp with time zone DEFAULT now(),
    building_id uuid,
    price_per_m2 numeric DEFAULT 0,
    ulaz text,
    tip_stana text,
    sobnost integer,
    povrsina_otvoreno numeric,
    povrsina_ot_sa_koef numeric,
    datum_potpisa_predugovora date,
    contract_payment_type text,
    kapara_10_posto numeric(12,2),
    rata_1_ab_konstrukcija_30 numeric(12,2),
    rata_2_postava_stolarije_20 numeric(12,2),
    rata_3_obrtnicki_radovi_20 numeric(12,2),
    rata_4_uporabna_20 numeric(12,2),
    kredit_etaziranje_90 numeric(12,2),
    CONSTRAINT apartments_contract_payment_type_check CHECK ((contract_payment_type = ANY (ARRAY['credit'::text, 'installments'::text]))),
    CONSTRAINT apartments_status_check CHECK ((status = ANY (ARRAY['Available'::text, 'Reserved'::text, 'Sold'::text])))
);


--
-- Name: bank_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_id uuid,
    project_id uuid,
    credit_type text NOT NULL,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    interest_rate numeric(5,2) DEFAULT 0,
    start_date date NOT NULL,
    maturity_date date,
    outstanding_balance numeric(15,2) DEFAULT 0,
    monthly_payment numeric(15,2) DEFAULT 0,
    status text DEFAULT 'active'::text,
    purpose text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    usage_expiration_date date,
    grace_period integer DEFAULT 0,
    credit_seniority text DEFAULT 'senior'::text,
    repayment_type text DEFAULT 'monthly'::text,
    principal_repayment_type text,
    interest_repayment_type text,
    company_id uuid,
    credit_name text DEFAULT ''::text NOT NULL,
    used_amount numeric(15,2) DEFAULT 0,
    repaid_amount numeric(15,2) DEFAULT 0,
    disbursed_to_account boolean DEFAULT false,
    disbursed_to_bank_account_id uuid,
    CONSTRAINT bank_credits_credit_seniority_check CHECK ((credit_seniority = ANY (ARRAY['junior'::text, 'senior'::text]))),
    CONSTRAINT bank_credits_credit_type_check CHECK ((credit_type = ANY (ARRAY['term_loan'::text, 'line_of_credit'::text, 'construction_loan'::text, 'bridge_loan'::text, 'equity'::text]))),
    CONSTRAINT bank_credits_interest_repayment_type_check CHECK ((interest_repayment_type = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'biyearly'::text, 'yearly'::text]))),
    CONSTRAINT bank_credits_principal_repayment_type_check CHECK ((principal_repayment_type = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'biyearly'::text, 'yearly'::text]))),
    CONSTRAINT bank_credits_repayment_type_check CHECK ((repayment_type = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT bank_credits_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paid'::text, 'defaulted'::text]))),
    CONSTRAINT check_disbursed_account_consistency CHECK (((disbursed_to_account = false) OR (disbursed_to_account IS NULL) OR ((disbursed_to_account = true) AND (disbursed_to_bank_account_id IS NOT NULL))))
);


--
-- Name: COLUMN bank_credits.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bank_credits.amount IS 'Total credit limit or disbursed amount';


--
-- Name: COLUMN bank_credits.outstanding_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bank_credits.outstanding_balance IS 'Automatically calculated: used_amount - repaid_amount. used_amount driven by OUTGOING_BANK invoice payments, repaid_amount by INCOMING_BANK invoice payments.';


--
-- Name: COLUMN bank_credits.used_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bank_credits.used_amount IS 'Amount drawn/spent paying invoices via this credit';


--
-- Name: COLUMN bank_credits.repaid_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bank_credits.repaid_amount IS 'Amount repaid to the bank';


--
-- Name: COLUMN bank_credits.disbursed_to_account; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bank_credits.disbursed_to_account IS 'Označava da li je kredit isplaćen direktno na bankovni račun firme. Ako je true, ceo iznos kredita se dodaje na saldo računa.';


--
-- Name: COLUMN bank_credits.disbursed_to_bank_account_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bank_credits.disbursed_to_bank_account_id IS 'Referenca na company_bank_accounts tabelu. Označava na koji račun je kredit isplaćen ako je disbursed_to_account = true.';


--
-- Name: banks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_person text,
    contact_email text,
    contact_phone text,
    total_credit_limit numeric(15,2) DEFAULT 0,
    outstanding_debt numeric(15,2) DEFAULT 0,
    available_funds numeric(15,2) DEFAULT 0,
    interest_rate numeric(5,2) DEFAULT 0,
    relationship_start date,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: buildings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buildings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    total_floors integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: calendar_event_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_event_exceptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    original_start_at timestamp with time zone NOT NULL,
    override_start_at timestamp with time zone,
    override_end_at timestamp with time zone,
    override_title text,
    is_cancelled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_event_exceptions_check CHECK ((is_cancelled OR (override_start_at IS NOT NULL))),
    CONSTRAINT calendar_event_exceptions_check1 CHECK (((override_end_at IS NULL) OR (override_start_at IS NULL) OR (override_end_at > override_start_at)))
);


--
-- Name: calendar_event_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_event_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    response text DEFAULT 'pending'::text NOT NULL,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_event_participants_response_check CHECK ((response = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    created_by uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    event_type text DEFAULT 'meeting'::text NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    all_day boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid,
    recurrence text,
    reminder_offsets integer[] DEFAULT '{}'::integer[] NOT NULL,
    busy boolean DEFAULT true NOT NULL,
    CONSTRAINT calendar_events_event_type_check CHECK ((event_type = ANY (ARRAY['meeting'::text, 'personal'::text, 'deadline'::text, 'reminder'::text]))),
    CONSTRAINT chk_calendar_events_end_after_start CHECK ((end_at > start_at))
);


--
-- Name: calendar_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    occurrence_start_at timestamp with time zone NOT NULL,
    offset_minutes integer NOT NULL,
    title text NOT NULL,
    body text,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_occurrence_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_occurrence_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    original_start_at timestamp with time zone NOT NULL,
    response text NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_occurrence_responses_response_check CHECK ((response = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);


--
-- Name: calendar_reminder_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_reminder_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    offset_minutes integer NOT NULL,
    occurrence_start_at timestamp with time zone NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    is_group boolean DEFAULT false NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    file_url text,
    file_name text,
    file_size bigint,
    file_type text
);


--
-- Name: chat_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    tax_id text,
    vat_id text,
    address text,
    city text,
    postal_code text,
    country text DEFAULT 'Hrvatska'::text,
    bank_account text,
    bank_name text,
    contact_person text,
    contact_email text,
    contact_phone text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: company_bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    bank_name text NOT NULL,
    account_number text,
    initial_balance numeric DEFAULT 0 NOT NULL,
    current_balance numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    balance_reset_at timestamp with time zone
);


--
-- Name: company_loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_loans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_company_id uuid NOT NULL,
    from_bank_account_id uuid NOT NULL,
    to_company_id uuid NOT NULL,
    to_bank_account_id uuid NOT NULL,
    amount numeric NOT NULL,
    loan_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT company_loans_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: company_statistics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.company_statistics AS
 SELECT c.id,
    c.name,
    c.oib,
    c.initial_balance,
    c.created_at,
    COALESCE(ba_stats.total_balance, (0)::numeric) AS total_bank_balance,
    COALESCE(ba_stats.accounts_count, (0)::bigint) AS bank_accounts_count,
    COALESCE(cr_stats.available, (0)::numeric) AS total_credits_available,
    COALESCE(cr_stats.credits_count, (0)::bigint) AS credits_count,
    count(DISTINCT
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_INVESTMENT'::text, 'OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text])) THEN inv.id
            ELSE NULL::uuid
        END) AS total_income_invoices,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_INVESTMENT'::text, 'OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text])) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_amount,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_INVESTMENT'::text, 'OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_paid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_INVESTMENT'::text, 'OUTGOING_SALES'::text, 'OUTGOING_OFFICE'::text])) THEN inv.remaining_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_income_unpaid,
    count(DISTINCT
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'OUTGOING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text, 'OUTGOING_BANK'::text])) THEN inv.id
            ELSE NULL::uuid
        END) AS total_expense_invoices,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'OUTGOING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text, 'OUTGOING_BANK'::text])) THEN inv.total_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_expense_amount,
    (COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'OUTGOING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text, 'OUTGOING_BANK'::text])) THEN inv.paid_amount
            ELSE (0)::numeric
        END), (0)::numeric) + COALESCE(cesija_stats.cesija_paid, (0)::numeric)) AS total_expense_paid,
    COALESCE(sum(
        CASE
            WHEN (inv.invoice_type = ANY (ARRAY['INCOMING_SUPPLIER'::text, 'OUTGOING_SUPPLIER'::text, 'INCOMING_OFFICE'::text, 'INCOMING_BANK'::text, 'INCOMING_BANK_EXPENSES'::text, 'OUTGOING_BANK'::text])) THEN inv.remaining_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_expense_unpaid
   FROM ((((public.accounting_companies c
     LEFT JOIN LATERAL ( SELECT sum(company_bank_accounts.current_balance) AS total_balance,
            count(*) AS accounts_count
           FROM public.company_bank_accounts
          WHERE (company_bank_accounts.company_id = c.id)) ba_stats ON (true))
     LEFT JOIN LATERAL ( SELECT sum((bank_credits.amount - bank_credits.used_amount)) AS available,
            count(*) AS credits_count
           FROM public.bank_credits
          WHERE (bank_credits.company_id = c.id)) cr_stats ON (true))
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(ap.amount), (0)::numeric) AS cesija_paid
           FROM public.accounting_payments ap
          WHERE ((ap.cesija_company_id = c.id) AND (ap.is_cesija = true))) cesija_stats ON (true))
     LEFT JOIN public.accounting_invoices inv ON ((inv.company_id = c.id)))
  GROUP BY c.id, c.name, c.oib, c.initial_balance, c.created_at, ba_stats.total_balance, ba_stats.accounts_count, cr_stats.available, cr_stats.credits_count, cesija_stats.cesija_paid;


--
-- Name: contract_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_types (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_number text,
    project_id uuid NOT NULL,
    phase_id uuid,
    subcontractor_id uuid NOT NULL,
    job_description text NOT NULL,
    contract_amount numeric(15,2) DEFAULT 0 NOT NULL,
    budget_realized numeric(15,2) DEFAULT 0 NOT NULL,
    start_date date,
    end_date date,
    status text DEFAULT 'draft'::text,
    terms text DEFAULT ''::text,
    signed boolean DEFAULT false,
    signed_date date,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    has_contract boolean DEFAULT true NOT NULL,
    contract_type_id integer DEFAULT 0 NOT NULL,
    base_amount numeric DEFAULT 0,
    vat_rate numeric DEFAULT 0,
    vat_amount numeric DEFAULT 0,
    total_amount numeric DEFAULT 0,
    total_invoices_amount numeric DEFAULT 0 NOT NULL,
    CONSTRAINT contracts_budget_realized_check CHECK ((budget_realized >= (0)::numeric)),
    CONSTRAINT contracts_contract_amount_check CHECK ((contract_amount >= (0)::numeric)),
    CONSTRAINT contracts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'terminated'::text]))),
    CONSTRAINT contracts_vat_rate_check CHECK ((vat_rate = ANY (ARRAY[(0)::numeric, (5)::numeric, (13)::numeric, (25)::numeric])))
);


--
-- Name: COLUMN contracts.has_contract; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contracts.has_contract IS 'Indicates if subcontractor has a formal contract. If false, contract_amount may be 0/NULL and budget is tracked via invoices only.';


--
-- Name: credit_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    credit_id uuid NOT NULL,
    project_id uuid,
    allocated_amount numeric DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    used_amount numeric DEFAULT 0 NOT NULL,
    allocation_type text DEFAULT 'project'::text,
    refinancing_entity_type text,
    refinancing_entity_id uuid,
    CONSTRAINT credit_allocations_allocation_type_check CHECK ((allocation_type = ANY (ARRAY['project'::text, 'opex'::text, 'refinancing'::text]))),
    CONSTRAINT credit_allocations_refinancing_entity_type_check CHECK (((refinancing_entity_type IS NULL) OR (refinancing_entity_type = ANY (ARRAY['company'::text, 'bank'::text])))),
    CONSTRAINT credit_allocations_type_consistency_check CHECK ((((allocation_type = 'project'::text) AND (project_id IS NOT NULL) AND (refinancing_entity_id IS NULL)) OR ((allocation_type = 'opex'::text) AND (project_id IS NULL) AND (refinancing_entity_id IS NULL)) OR ((allocation_type = 'refinancing'::text) AND (refinancing_entity_type IS NOT NULL) AND (refinancing_entity_id IS NOT NULL) AND (project_id IS NULL))))
);


--
-- Name: customer_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_number_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    surname text NOT NULL,
    email text NOT NULL,
    phone text,
    address text,
    bank_account text,
    id_number text,
    status text DEFAULT 'interested'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    customer_number integer DEFAULT nextval('public.customer_number_seq'::regclass) NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb,
    last_contact_date timestamp with time zone,
    backed_out_reason text,
    notes text DEFAULT ''::text,
    priority text DEFAULT 'warm'::text,
    CONSTRAINT customers_priority_check CHECK ((priority = ANY (ARRAY['hot'::text, 'warm'::text, 'cold'::text]))),
    CONSTRAINT customers_status_check CHECK ((status = ANY (ARRAY['buyer'::text, 'interested'::text, 'lead'::text])))
);


--
-- Name: document_associations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_associations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    CONSTRAINT document_associations_entity_type_check CHECK ((entity_type = ANY (ARRAY['project'::text, 'phase'::text, 'subcontractor'::text, 'contract'::text, 'unit'::text, 'customer'::text, 'credit'::text, 'company'::text])))
);


--
-- Name: document_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name_hr text NOT NULL,
    parent_id uuid,
    path text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    required_associations jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_size integer DEFAULT 0 NOT NULL,
    mime_type text,
    category_id uuid,
    source text DEFAULT 'app_upload'::text NOT NULL,
    description text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    search_text tsvector,
    CONSTRAINT documents_source_check CHECK ((source = ANY (ARRAY['app_upload'::text, 'legacy_subcontractor'::text, 'accounting_sync'::text, 'filesystem_scan'::text])))
);


--
-- Name: funding_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funding_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investor_id uuid,
    bank_id uuid,
    project_investment_id uuid,
    bank_credit_id uuid,
    amount numeric DEFAULT 0 NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_type text DEFAULT 'principal'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT funding_payment_recipient CHECK ((((investor_id IS NOT NULL) AND (bank_id IS NULL)) OR ((investor_id IS NULL) AND (bank_id IS NOT NULL))))
);


--
-- Name: garages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid NOT NULL,
    number text NOT NULL,
    floor integer DEFAULT 0 NOT NULL,
    size_m2 numeric DEFAULT 0 NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'Available'::text NOT NULL,
    buyer_name text,
    created_at timestamp with time zone DEFAULT now(),
    price_per_m2 numeric DEFAULT 0,
    CONSTRAINT garages_status_check CHECK ((status = ANY (ARRAY['Available'::text, 'Reserved'::text, 'Sold'::text])))
);


--
-- Name: hidden_approved_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hidden_approved_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    hidden_at timestamp with time zone DEFAULT now() NOT NULL,
    hidden_by uuid
);


--
-- Name: investors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'individual'::text,
    contact_person text,
    contact_email text,
    contact_phone text,
    total_invested numeric(15,2) DEFAULT 0,
    expected_return numeric(5,2) DEFAULT 0,
    investment_start date,
    risk_profile text DEFAULT 'moderate'::text,
    preferred_sectors text DEFAULT ''::text,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT investors_risk_profile_check CHECK ((risk_profile = ANY (ARRAY['conservative'::text, 'moderate'::text, 'aggressive'::text]))),
    CONSTRAINT investors_type_check CHECK ((type = ANY (ARRAY['individual'::text, 'institutional'::text, 'fund'::text, 'government'::text])))
);


--
-- Name: invoice_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    project_id uuid NOT NULL,
    apartment_preferences text DEFAULT ''::text,
    budget_range_min numeric(15,2) DEFAULT 0 NOT NULL,
    budget_range_max numeric(15,2) DEFAULT 0 NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    last_contact_date date,
    next_follow_up date,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT leads_priority_check CHECK ((priority = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'viewing_scheduled'::text, 'negotiating'::text, 'closed'::text])))
);


--
-- Name: monthly_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    budget_amount numeric DEFAULT 0 NOT NULL,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_month CHECK (((month >= 1) AND (month <= 12)))
);


--
-- Name: office_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.office_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact text,
    email text,
    address text,
    tax_id text,
    vat_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: old_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.old_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    due_date date NOT NULL,
    paid boolean DEFAULT false,
    subcontractor_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_totals_by_category; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.payment_totals_by_category WITH (security_invoker='on') AS
 SELECT invoice_category,
    invoice_type,
    project_id,
    count(DISTINCT id) AS invoice_count,
    sum(total_amount) AS total_invoiced,
    sum(paid_amount) AS total_paid,
    sum(remaining_amount) AS total_remaining
   FROM public.accounting_invoices ai
  GROUP BY invoice_category, invoice_type, project_id;


--
-- Name: project_investments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_investments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    investor_id uuid,
    bank_id uuid,
    investment_type text DEFAULT 'equity'::text,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    percentage_stake numeric(5,2) DEFAULT 0,
    expected_return numeric(5,2) DEFAULT 0,
    investment_date date NOT NULL,
    maturity_date date,
    status text DEFAULT 'active'::text,
    terms text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    mortgages_insurance numeric(15,2) DEFAULT 0,
    notes text DEFAULT ''::text,
    usage_expiration_date date,
    grace_period integer DEFAULT 0,
    credit_seniority text DEFAULT 'senior'::text,
    payment_schedule text DEFAULT 'yearly'::text,
    disbursed_to_account boolean DEFAULT false,
    disbursed_to_bank_account_id uuid,
    CONSTRAINT check_disbursed_account_consistency CHECK ((((disbursed_to_account = true) AND (disbursed_to_bank_account_id IS NOT NULL)) OR ((disbursed_to_account = false) OR (disbursed_to_account IS NULL)))),
    CONSTRAINT project_investments_credit_seniority_check CHECK ((credit_seniority = ANY (ARRAY['junior'::text, 'senior'::text]))),
    CONSTRAINT project_investments_investment_type_check CHECK ((investment_type = ANY (ARRAY['equity'::text, 'loan'::text, 'grant'::text, 'bond'::text, 'Operation Cost Loan'::text, 'Refinancing Loan'::text]))),
    CONSTRAINT project_investments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'defaulted'::text])))
);


--
-- Name: COLUMN project_investments.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_investments.project_id IS 'Project reference - nullable because some investments (refinancing, operation costs) are not tied to specific projects';


--
-- Name: COLUMN project_investments.investment_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_investments.investment_type IS 'Type of investment: equity, loan, grant, bond, Operation Cost Loan (operativni troškovi), Refinancing Loan (refinanciranje kredita)';


--
-- Name: project_managers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_managers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now(),
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    due_date date,
    completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_phases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    phase_number integer NOT NULL,
    phase_name text NOT NULL,
    budget_allocated numeric(15,2) DEFAULT 0,
    budget_used numeric(15,2) DEFAULT 0,
    start_date date,
    end_date date,
    status text DEFAULT 'planning'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_phases_status_check CHECK ((status = ANY (ARRAY['planning'::text, 'active'::text, 'completed'::text, 'on_hold'::text])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    budget numeric(15,2) DEFAULT 0 NOT NULL,
    investor text,
    status text DEFAULT 'Planning'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT projects_status_check CHECK ((status = ANY (ARRAY['Planning'::text, 'In Progress'::text, 'Completed'::text, 'On Hold'::text])))
);


--
-- Name: repositories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repositories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid NOT NULL,
    number text NOT NULL,
    floor integer DEFAULT 0 NOT NULL,
    size_m2 numeric DEFAULT 0 NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'Available'::text NOT NULL,
    buyer_name text,
    created_at timestamp with time zone DEFAULT now(),
    price_per_m2 numeric DEFAULT 0,
    CONSTRAINT repositories_status_check CHECK ((status = ANY (ARRAY['Available'::text, 'Reserved'::text, 'Sold'::text])))
);


--
-- Name: retail_contract_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retail_contract_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    milestone_name text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    due_date date,
    completed_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    milestone_number integer DEFAULT 1 NOT NULL,
    percentage numeric DEFAULT 0 NOT NULL,
    description text DEFAULT ''::text,
    CONSTRAINT retail_contract_milestones_percentage_check CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric))),
    CONSTRAINT retail_contract_milestones_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: COLUMN retail_contract_milestones.milestone_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_contract_milestones.milestone_number IS 'Sequential number for ordering milestones';


--
-- Name: COLUMN retail_contract_milestones.percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_contract_milestones.percentage IS 'Percentage of contract amount (0-100)';


--
-- Name: COLUMN retail_contract_milestones.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_contract_milestones.description IS 'Description of milestone deliverables';


--
-- Name: retail_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retail_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phase_id uuid NOT NULL,
    supplier_id uuid,
    contract_number text NOT NULL,
    contract_amount numeric NOT NULL,
    budget_realized numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    start_date date,
    end_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    land_area_m2 numeric,
    contract_date date,
    customer_id uuid,
    building_surface_m2 numeric(10,2),
    total_surface_m2 numeric(10,2),
    price_per_m2 numeric(10,2),
    has_contract boolean DEFAULT true NOT NULL,
    total_invoices_amount numeric DEFAULT 0 NOT NULL,
    CONSTRAINT retail_contracts_budget_realized_check CHECK ((budget_realized >= (0)::numeric)),
    CONSTRAINT retail_contracts_contract_amount_check CHECK ((contract_amount >= (0)::numeric)),
    CONSTRAINT retail_contracts_land_area_m2_check CHECK ((land_area_m2 > (0)::numeric)),
    CONSTRAINT retail_contracts_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Completed'::text, 'Cancelled'::text]))),
    CONSTRAINT retail_contracts_supplier_or_customer_check CHECK ((((supplier_id IS NOT NULL) AND (customer_id IS NULL)) OR ((supplier_id IS NULL) AND (customer_id IS NOT NULL))))
);


--
-- Name: COLUMN retail_contracts.land_area_m2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_contracts.land_area_m2 IS 'Area of land in m² (used for acquisition phase contracts)';


--
-- Name: COLUMN retail_contracts.contract_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_contracts.contract_date IS 'Date when contract was signed';


--
-- Name: COLUMN retail_contracts.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_contracts.customer_id IS 'Customer ID for sales phase contracts (Phase 3)';


--
-- Name: COLUMN retail_contracts.building_surface_m2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_contracts.building_surface_m2 IS 'Površina objekta/prostora u m² (building/retail space surface area)';


--
-- Name: COLUMN retail_contracts.total_surface_m2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_contracts.total_surface_m2 IS 'Ukupna površina u m² (total surface including parking, storage, etc.)';


--
-- Name: COLUMN retail_contracts.price_per_m2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_contracts.price_per_m2 IS 'Cijena po m² (calculated: contract_amount / total_surface_m2)';


--
-- Name: COLUMN retail_contracts.has_contract; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_contracts.has_contract IS 'Indicates whether this is a formal contract (true) or just tracking without contract (false). When false, contract_amount can be 0 and no invoices are required.';


--
-- Name: retail_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retail_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_phone text,
    contact_email text,
    oib text,
    address text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: retail_land_plots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retail_land_plots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_first_name text NOT NULL,
    owner_last_name text NOT NULL,
    plot_number text NOT NULL,
    total_area_m2 numeric NOT NULL,
    purchased_area_m2 numeric NOT NULL,
    price_per_m2 numeric NOT NULL,
    total_price numeric GENERATED ALWAYS AS ((purchased_area_m2 * price_per_m2)) STORED,
    payment_date date,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    location text,
    CONSTRAINT retail_land_plots_check CHECK (((purchased_area_m2 > (0)::numeric) AND (purchased_area_m2 <= total_area_m2))),
    CONSTRAINT retail_land_plots_payment_status_check CHECK ((payment_status = ANY (ARRAY['paid'::text, 'pending'::text, 'partial'::text]))),
    CONSTRAINT retail_land_plots_price_per_m2_check CHECK ((price_per_m2 >= (0)::numeric)),
    CONSTRAINT retail_land_plots_total_area_m2_check CHECK ((total_area_m2 > (0)::numeric))
);


--
-- Name: retail_project_phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retail_project_phases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    phase_name text NOT NULL,
    phase_type text NOT NULL,
    phase_order integer NOT NULL,
    budget_allocated numeric DEFAULT 0,
    status text DEFAULT 'Pending'::text NOT NULL,
    start_date date,
    end_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT retail_project_phases_budget_allocated_check CHECK ((budget_allocated >= (0)::numeric)),
    CONSTRAINT retail_project_phases_phase_order_check CHECK (((phase_order >= 1) AND (phase_order <= 5))),
    CONSTRAINT retail_project_phases_phase_type_check CHECK ((phase_type = ANY (ARRAY['development'::text, 'construction'::text, 'sales'::text]))),
    CONSTRAINT retail_project_phases_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'In Progress'::text, 'Completed'::text])))
);


--
-- Name: retail_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retail_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text NOT NULL,
    plot_number text NOT NULL,
    total_area_m2 numeric NOT NULL,
    purchase_price numeric DEFAULT 0 NOT NULL,
    price_per_m2 numeric GENERATED ALWAYS AS (
CASE
    WHEN (total_area_m2 > (0)::numeric) THEN (purchase_price / total_area_m2)
    ELSE (0)::numeric
END) STORED,
    status text DEFAULT 'Planning'::text NOT NULL,
    start_date date,
    end_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    land_plot_id uuid,
    CONSTRAINT retail_projects_purchase_price_check CHECK ((purchase_price >= (0)::numeric)),
    CONSTRAINT retail_projects_status_check CHECK ((status = ANY (ARRAY['Planning'::text, 'In Progress'::text, 'Completed'::text, 'On Hold'::text]))),
    CONSTRAINT retail_projects_total_area_m2_check CHECK ((total_area_m2 > (0)::numeric))
);


--
-- Name: COLUMN retail_projects.purchase_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_projects.purchase_price IS 'Project budget (budžet projekta) - guiding star for spending';


--
-- Name: COLUMN retail_projects.land_plot_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.retail_projects.land_plot_id IS 'Connected land plot - one plot can only be used in one project (1:1)';


--
-- Name: retail_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retail_sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    land_plot_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    sale_area_m2 numeric NOT NULL,
    sale_price_per_m2 numeric NOT NULL,
    total_sale_price numeric GENERATED ALWAYS AS ((sale_area_m2 * sale_price_per_m2)) STORED,
    payment_deadline date NOT NULL,
    paid_amount numeric DEFAULT 0 NOT NULL,
    remaining_amount numeric GENERATED ALWAYS AS (((sale_area_m2 * sale_price_per_m2) - paid_amount)) STORED,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    contract_number text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    phase_id uuid,
    CONSTRAINT retail_sales_paid_amount_check CHECK ((paid_amount >= (0)::numeric)),
    CONSTRAINT retail_sales_payment_status_check CHECK ((payment_status = ANY (ARRAY['paid'::text, 'pending'::text, 'partial'::text, 'overdue'::text]))),
    CONSTRAINT retail_sales_sale_area_m2_check CHECK ((sale_area_m2 > (0)::numeric)),
    CONSTRAINT retail_sales_sale_price_per_m2_check CHECK ((sale_price_per_m2 >= (0)::numeric))
);


--
-- Name: retail_supplier_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retail_supplier_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: retail_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retail_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_person text,
    contact_phone text,
    contact_email text,
    oib text,
    address text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    supplier_type_id uuid NOT NULL
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    apartment_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    sale_price numeric(15,2) DEFAULT 0 NOT NULL,
    payment_method text DEFAULT 'bank_loan'::text NOT NULL,
    down_payment numeric(15,2) DEFAULT 0 NOT NULL,
    total_paid numeric(15,2) DEFAULT 0 NOT NULL,
    remaining_amount numeric(15,2) DEFAULT 0 NOT NULL,
    next_payment_date date,
    monthly_payment numeric(15,2) DEFAULT 0 NOT NULL,
    sale_date date DEFAULT CURRENT_DATE NOT NULL,
    contract_signed boolean DEFAULT false NOT NULL,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sales_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'credit'::text, 'bank_loan'::text, 'installments'::text])))
);


--
-- Name: subcontractor_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontractor_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subcontractor_id uuid NOT NULL,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    comment_type text DEFAULT 'general'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subcontractor_comments_comment_type_check CHECK ((comment_type = ANY (ARRAY['completed'::text, 'issue'::text, 'general'::text])))
);


--
-- Name: subcontractor_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontractor_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size integer DEFAULT 0 NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    uploaded_by uuid,
    subcontractor_id uuid NOT NULL
);


--
-- Name: subcontractor_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontractor_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    milestone_number integer NOT NULL,
    milestone_name text NOT NULL,
    description text DEFAULT ''::text,
    percentage numeric(5,2) NOT NULL,
    due_date date,
    status text DEFAULT 'pending'::text NOT NULL,
    completed_date date,
    paid_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subcontractor_milestones_percentage_check CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric))),
    CONSTRAINT subcontractor_milestones_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'paid'::text])))
);


--
-- Name: TABLE subcontractor_milestones; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subcontractor_milestones IS 'Payment milestones for specific contracts. Each milestone represents a payment installment tied to a contract.';


--
-- Name: COLUMN subcontractor_milestones.contract_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subcontractor_milestones.contract_id IS 'References the specific contract (from contracts table) this milestone belongs to';


--
-- Name: subcontractors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontractors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    financed_by_type text,
    financed_by_investor_id uuid,
    financed_by_bank_id uuid,
    completed_at timestamp with time zone,
    active_contracts_count integer DEFAULT 0,
    notes text DEFAULT ''::text,
    CONSTRAINT subcontractors_financed_by_type_check CHECK ((financed_by_type = ANY (ARRAY['investor'::text, 'bank'::text]))),
    CONSTRAINT subcontractors_funder_type_consistency_check CHECK ((((financed_by_type IS NULL) AND (financed_by_investor_id IS NULL) AND (financed_by_bank_id IS NULL)) OR ((financed_by_type = 'investor'::text) AND (financed_by_investor_id IS NOT NULL) AND (financed_by_bank_id IS NULL)) OR ((financed_by_type = 'bank'::text) AND (financed_by_bank_id IS NOT NULL) AND (financed_by_investor_id IS NULL)))),
    CONSTRAINT subcontractors_single_funder_check CHECK ((((financed_by_investor_id IS NULL) AND (financed_by_bank_id IS NULL)) OR ((financed_by_investor_id IS NOT NULL) AND (financed_by_bank_id IS NULL)) OR ((financed_by_investor_id IS NULL) AND (financed_by_bank_id IS NOT NULL))))
);


--
-- Name: TABLE subcontractors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subcontractors IS 'Master list of subcontractor companies. Contract details are in contracts table.';


--
-- Name: task_assignees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_assignees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    size_bytes bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_reminder_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_reminder_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    offset_min integer NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    created_by uuid NOT NULL,
    due_date date,
    due_time time without time zone,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid,
    reminder_offsets integer[] DEFAULT '{}'::integer[] NOT NULL,
    description_format text DEFAULT 'markdown'::text NOT NULL,
    CONSTRAINT tasks_description_format_check CHECK ((description_format = ANY (ARRAY['markdown'::text, 'plain'::text]))),
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text])))
);


--
-- Name: tic_cost_structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tic_cost_structures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investor_name text DEFAULT 'RAVNICE CITY D.O.O.'::text NOT NULL,
    document_date date DEFAULT CURRENT_DATE NOT NULL,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    project_id uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    auth_user_id uuid,
    email text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Sales'::text, 'Supervision'::text, 'Investment'::text])))
);


--
-- Name: work_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subcontractor_id uuid NOT NULL,
    date date NOT NULL,
    work_description text NOT NULL,
    notes text DEFAULT ''::text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    contract_id uuid,
    project_id uuid,
    phase_id uuid,
    status text,
    blocker_details text,
    updated_at timestamp with time zone DEFAULT now(),
    color text DEFAULT 'blue'::text,
    CONSTRAINT work_logs_status_check CHECK ((status = ANY (ARRAY['work_finished'::text, 'in_progress'::text, 'blocker'::text, 'quality_issue'::text, 'waiting_materials'::text, 'weather_delay'::text])))
);


--
-- Name: accounting_companies accounting_companies_oib_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_companies
    ADD CONSTRAINT accounting_companies_oib_key UNIQUE (oib);


--
-- Name: accounting_companies accounting_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_companies
    ADD CONSTRAINT accounting_companies_pkey PRIMARY KEY (id);


--
-- Name: accounting_invoices accounting_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_pkey PRIMARY KEY (id);


--
-- Name: accounting_payments accounting_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_payments
    ADD CONSTRAINT accounting_payments_pkey PRIMARY KEY (id);


--
-- Name: accounting_invoices_refund accounting_refund_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices_refund
    ADD CONSTRAINT accounting_refund_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: apartment_garages apartment_garages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartment_garages
    ADD CONSTRAINT apartment_garages_pkey PRIMARY KEY (id);


--
-- Name: apartment_garages apartment_garages_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartment_garages
    ADD CONSTRAINT apartment_garages_unique UNIQUE (apartment_id, garage_id);


--
-- Name: apartment_repositories apartment_repositories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartment_repositories
    ADD CONSTRAINT apartment_repositories_pkey PRIMARY KEY (id);


--
-- Name: apartment_repositories apartment_repositories_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartment_repositories
    ADD CONSTRAINT apartment_repositories_unique UNIQUE (apartment_id, repository_id);


--
-- Name: apartments apartments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartments
    ADD CONSTRAINT apartments_pkey PRIMARY KEY (id);


--
-- Name: bank_credits bank_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_credits
    ADD CONSTRAINT bank_credits_pkey PRIMARY KEY (id);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (id);


--
-- Name: buildings buildings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_pkey PRIMARY KEY (id);


--
-- Name: calendar_event_exceptions calendar_event_exceptions_event_id_original_start_at_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_exceptions
    ADD CONSTRAINT calendar_event_exceptions_event_id_original_start_at_key UNIQUE (event_id, original_start_at);


--
-- Name: calendar_event_exceptions calendar_event_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_exceptions
    ADD CONSTRAINT calendar_event_exceptions_pkey PRIMARY KEY (id);


--
-- Name: calendar_event_participants calendar_event_participants_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_participants
    ADD CONSTRAINT calendar_event_participants_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: calendar_event_participants calendar_event_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_participants
    ADD CONSTRAINT calendar_event_participants_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: calendar_notifications calendar_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_notifications
    ADD CONSTRAINT calendar_notifications_pkey PRIMARY KEY (id);


--
-- Name: calendar_occurrence_responses calendar_occurrence_responses_event_id_user_id_original_sta_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_occurrence_responses
    ADD CONSTRAINT calendar_occurrence_responses_event_id_user_id_original_sta_key UNIQUE (event_id, user_id, original_start_at);


--
-- Name: calendar_occurrence_responses calendar_occurrence_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_occurrence_responses
    ADD CONSTRAINT calendar_occurrence_responses_pkey PRIMARY KEY (id);


--
-- Name: calendar_reminder_sends calendar_reminder_sends_event_id_user_id_offset_minutes_occ_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_reminder_sends
    ADD CONSTRAINT calendar_reminder_sends_event_id_user_id_offset_minutes_occ_key UNIQUE (event_id, user_id, offset_minutes, occurrence_start_at);


--
-- Name: calendar_reminder_sends calendar_reminder_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_reminder_sends
    ADD CONSTRAINT calendar_reminder_sends_pkey PRIMARY KEY (id);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_participants chat_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: chat_participants chat_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_bank_accounts company_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_bank_accounts
    ADD CONSTRAINT company_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: company_loans company_loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_loans
    ADD CONSTRAINT company_loans_pkey PRIMARY KEY (id);


--
-- Name: subcontractor_documents contract_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_documents
    ADD CONSTRAINT contract_documents_pkey PRIMARY KEY (id);


--
-- Name: contract_types contract_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_types
    ADD CONSTRAINT contract_types_name_key UNIQUE (name);


--
-- Name: contract_types contract_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_types
    ADD CONSTRAINT contract_types_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_number_key UNIQUE (contract_number);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: credit_allocations credit_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_allocations
    ADD CONSTRAINT credit_allocations_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_number_key UNIQUE (customer_number);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: document_associations document_associations_document_id_entity_type_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_associations
    ADD CONSTRAINT document_associations_document_id_entity_type_entity_id_key UNIQUE (document_id, entity_type, entity_id);


--
-- Name: document_associations document_associations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_associations
    ADD CONSTRAINT document_associations_pkey PRIMARY KEY (id);


--
-- Name: document_categories document_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_code_key UNIQUE (code);


--
-- Name: document_categories document_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: funding_payments funding_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_payments
    ADD CONSTRAINT funding_payments_pkey PRIMARY KEY (id);


--
-- Name: garages garages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garages
    ADD CONSTRAINT garages_pkey PRIMARY KEY (id);


--
-- Name: hidden_approved_invoices hidden_approved_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hidden_approved_invoices
    ADD CONSTRAINT hidden_approved_invoices_pkey PRIMARY KEY (id);


--
-- Name: investors investors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investors
    ADD CONSTRAINT investors_pkey PRIMARY KEY (id);


--
-- Name: invoice_categories invoice_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_categories
    ADD CONSTRAINT invoice_categories_name_key UNIQUE (name);


--
-- Name: invoice_categories invoice_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_categories
    ADD CONSTRAINT invoice_categories_pkey PRIMARY KEY (id);


--
-- Name: old_invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.old_invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: monthly_budgets monthly_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_budgets
    ADD CONSTRAINT monthly_budgets_pkey PRIMARY KEY (id);


--
-- Name: office_suppliers office_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_suppliers
    ADD CONSTRAINT office_suppliers_pkey PRIMARY KEY (id);


--
-- Name: project_investments project_investments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_investments
    ADD CONSTRAINT project_investments_pkey PRIMARY KEY (id);


--
-- Name: project_managers project_managers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_managers
    ADD CONSTRAINT project_managers_pkey PRIMARY KEY (id);


--
-- Name: project_managers project_managers_user_id_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_managers
    ADD CONSTRAINT project_managers_user_id_project_id_key UNIQUE (user_id, project_id);


--
-- Name: project_milestones project_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_pkey PRIMARY KEY (id);


--
-- Name: project_phases project_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_phases
    ADD CONSTRAINT project_phases_pkey PRIMARY KEY (id);


--
-- Name: project_phases project_phases_project_id_phase_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_phases
    ADD CONSTRAINT project_phases_project_id_phase_number_key UNIQUE (project_id, phase_number);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: repositories repositories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repositories
    ADD CONSTRAINT repositories_pkey PRIMARY KEY (id);


--
-- Name: retail_contract_milestones retail_contract_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_contract_milestones
    ADD CONSTRAINT retail_contract_milestones_pkey PRIMARY KEY (id);


--
-- Name: retail_contracts retail_contracts_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_contracts
    ADD CONSTRAINT retail_contracts_contract_number_key UNIQUE (contract_number);


--
-- Name: retail_contracts retail_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_contracts
    ADD CONSTRAINT retail_contracts_pkey PRIMARY KEY (id);


--
-- Name: retail_customers retail_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_customers
    ADD CONSTRAINT retail_customers_pkey PRIMARY KEY (id);


--
-- Name: retail_land_plots retail_land_plots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_land_plots
    ADD CONSTRAINT retail_land_plots_pkey PRIMARY KEY (id);


--
-- Name: retail_project_phases retail_project_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_project_phases
    ADD CONSTRAINT retail_project_phases_pkey PRIMARY KEY (id);


--
-- Name: retail_project_phases retail_project_phases_project_id_phase_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_project_phases
    ADD CONSTRAINT retail_project_phases_project_id_phase_order_key UNIQUE (project_id, phase_order);


--
-- Name: retail_projects retail_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_projects
    ADD CONSTRAINT retail_projects_pkey PRIMARY KEY (id);


--
-- Name: retail_sales retail_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_sales
    ADD CONSTRAINT retail_sales_pkey PRIMARY KEY (id);


--
-- Name: retail_supplier_types retail_supplier_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_supplier_types
    ADD CONSTRAINT retail_supplier_types_name_key UNIQUE (name);


--
-- Name: retail_supplier_types retail_supplier_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_supplier_types
    ADD CONSTRAINT retail_supplier_types_pkey PRIMARY KEY (id);


--
-- Name: retail_suppliers retail_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_suppliers
    ADD CONSTRAINT retail_suppliers_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: subcontractor_comments subcontractor_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_comments
    ADD CONSTRAINT subcontractor_comments_pkey PRIMARY KEY (id);


--
-- Name: subcontractor_milestones subcontractor_milestones_contract_milestone_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_milestones
    ADD CONSTRAINT subcontractor_milestones_contract_milestone_unique UNIQUE (contract_id, milestone_number);


--
-- Name: subcontractor_milestones subcontractor_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_milestones
    ADD CONSTRAINT subcontractor_milestones_pkey PRIMARY KEY (id);


--
-- Name: subcontractors subcontractors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractors
    ADD CONSTRAINT subcontractors_pkey PRIMARY KEY (id);


--
-- Name: task_assignees task_assignees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_pkey PRIMARY KEY (id);


--
-- Name: task_assignees task_assignees_task_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_task_id_user_id_key UNIQUE (task_id, user_id);


--
-- Name: task_attachments task_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_reminder_sends task_reminder_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_reminder_sends
    ADD CONSTRAINT task_reminder_sends_pkey PRIMARY KEY (id);


--
-- Name: task_reminder_sends task_reminder_sends_task_id_offset_min_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_reminder_sends
    ADD CONSTRAINT task_reminder_sends_task_id_offset_min_key UNIQUE (task_id, offset_min);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tic_cost_structures tic_cost_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tic_cost_structures
    ADD CONSTRAINT tic_cost_structures_pkey PRIMARY KEY (id);


--
-- Name: hidden_approved_invoices unique_hidden_invoice; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hidden_approved_invoices
    ADD CONSTRAINT unique_hidden_invoice UNIQUE (invoice_id);


--
-- Name: retail_projects unique_land_plot_per_project; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_projects
    ADD CONSTRAINT unique_land_plot_per_project UNIQUE (land_plot_id);


--
-- Name: monthly_budgets unique_year_month; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_budgets
    ADD CONSTRAINT unique_year_month UNIQUE (year, month);


--
-- Name: users users_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: work_logs work_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_pkey PRIMARY KEY (id);


--
-- Name: idx_accounting_companies_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_companies_name ON public.accounting_companies USING btree (name);


--
-- Name: idx_accounting_invoices_apartment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_apartment_id ON public.accounting_invoices USING btree (apartment_id) WHERE (apartment_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_approved ON public.accounting_invoices USING btree (approved);


--
-- Name: idx_accounting_invoices_bank_credit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_bank_credit_id ON public.accounting_invoices USING btree (bank_credit_id) WHERE (bank_credit_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_bank_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_bank_id ON public.accounting_invoices USING btree (bank_id) WHERE (bank_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_company ON public.accounting_invoices USING btree (company_id);


--
-- Name: idx_accounting_invoices_company_bank_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_company_bank_account_id ON public.accounting_invoices USING btree (company_bank_account_id);


--
-- Name: idx_accounting_invoices_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_company_id ON public.accounting_invoices USING btree (company_id);


--
-- Name: idx_accounting_invoices_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_company_status ON public.accounting_invoices USING btree (company_id, status);


--
-- Name: idx_accounting_invoices_company_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_company_type ON public.accounting_invoices USING btree (company_id, invoice_type);


--
-- Name: idx_accounting_invoices_contract_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_contract_id ON public.accounting_invoices USING btree (contract_id);


--
-- Name: idx_accounting_invoices_credit_allocation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_credit_allocation_id ON public.accounting_invoices USING btree (credit_allocation_id) WHERE (credit_allocation_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_customer ON public.accounting_invoices USING btree (customer_id);


--
-- Name: idx_accounting_invoices_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_customer_id ON public.accounting_invoices USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_customer_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_customer_project ON public.accounting_invoices USING btree (customer_id, project_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_due_date ON public.accounting_invoices USING btree (due_date);


--
-- Name: idx_accounting_invoices_investment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_investment_id ON public.accounting_invoices USING btree (investment_id) WHERE (investment_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_investor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_investor_id ON public.accounting_invoices USING btree (investor_id) WHERE (investor_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_invoice_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_invoice_type ON public.accounting_invoices USING btree (invoice_type);


--
-- Name: idx_accounting_invoices_issue_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_issue_date ON public.accounting_invoices USING btree (issue_date DESC);


--
-- Name: idx_accounting_invoices_milestone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_milestone_id ON public.accounting_invoices USING btree (milestone_id);


--
-- Name: idx_accounting_invoices_office_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_office_supplier ON public.accounting_invoices USING btree (office_supplier_id);


--
-- Name: idx_accounting_invoices_office_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_office_supplier_id ON public.accounting_invoices USING btree (office_supplier_id) WHERE (office_supplier_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_project_id_fkey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_project_id_fkey ON public.accounting_invoices USING btree (project_id) WHERE (project_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_refund_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_refund_id ON public.accounting_invoices USING btree (refund_id);


--
-- Name: idx_accounting_invoices_retail_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_retail_contract ON public.accounting_invoices USING btree (retail_contract_id);


--
-- Name: idx_accounting_invoices_retail_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_retail_customer ON public.accounting_invoices USING btree (retail_customer_id);


--
-- Name: idx_accounting_invoices_retail_milestone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_retail_milestone ON public.accounting_invoices USING btree (retail_milestone_id);


--
-- Name: idx_accounting_invoices_retail_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_retail_project ON public.accounting_invoices USING btree (retail_project_id);


--
-- Name: idx_accounting_invoices_retail_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_retail_supplier ON public.accounting_invoices USING btree (retail_supplier_id);


--
-- Name: idx_accounting_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_status ON public.accounting_invoices USING btree (status);


--
-- Name: idx_accounting_invoices_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_supplier_id ON public.accounting_invoices USING btree (supplier_id) WHERE (supplier_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_supplier_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_supplier_project ON public.accounting_invoices USING btree (supplier_id, project_id) WHERE (supplier_id IS NOT NULL);


--
-- Name: idx_accounting_invoices_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_invoices_type ON public.accounting_invoices USING btree (invoice_type);


--
-- Name: idx_accounting_payments_cesija_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_payments_cesija_company_id ON public.accounting_payments USING btree (cesija_company_id) WHERE (cesija_company_id IS NOT NULL);


--
-- Name: idx_accounting_payments_cesija_credit_allocation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_payments_cesija_credit_allocation_id ON public.accounting_payments USING btree (cesija_credit_allocation_id);


--
-- Name: idx_accounting_payments_cesija_credit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_payments_cesija_credit_id ON public.accounting_payments USING btree (cesija_credit_id);


--
-- Name: idx_accounting_payments_cesija_flag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_payments_cesija_flag ON public.accounting_payments USING btree (cesija_company_id, is_cesija) WHERE (is_cesija = true);


--
-- Name: idx_accounting_payments_company_bank_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_payments_company_bank_account_id ON public.accounting_payments USING btree (company_bank_account_id) WHERE (company_bank_account_id IS NOT NULL);


--
-- Name: idx_accounting_payments_created_by_fkey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_payments_created_by_fkey ON public.accounting_payments USING btree (created_by);


--
-- Name: idx_accounting_payments_credit_allocation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_payments_credit_allocation_id ON public.accounting_payments USING btree (credit_allocation_id);


--
-- Name: idx_accounting_payments_credit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_payments_credit_id ON public.accounting_payments USING btree (credit_id);


--
-- Name: idx_accounting_payments_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_payments_invoice_id ON public.accounting_payments USING btree (invoice_id);


--
-- Name: idx_accounting_payments_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_payments_payment_date ON public.accounting_payments USING btree (payment_date);


--
-- Name: idx_activity_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_action ON public.activity_logs USING btree (action text_pattern_ops);


--
-- Name: idx_activity_logs_created_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_action ON public.activity_logs USING btree (created_at DESC, action);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_project_id ON public.activity_logs USING btree (project_id) WHERE (project_id IS NOT NULL);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_bank_credits_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_credits_company_id ON public.bank_credits USING btree (company_id);


--
-- Name: idx_bank_credits_disbursed_bank_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_credits_disbursed_bank_account ON public.bank_credits USING btree (disbursed_to_bank_account_id) WHERE (disbursed_to_bank_account_id IS NOT NULL);


--
-- Name: idx_bank_credits_disbursed_to_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_credits_disbursed_to_account ON public.bank_credits USING btree (disbursed_to_account) WHERE (disbursed_to_account = true);


--
-- Name: idx_calendar_event_exceptions_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_event_exceptions_event ON public.calendar_event_exceptions USING btree (event_id);


--
-- Name: idx_calendar_events_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_creator ON public.calendar_events USING btree (created_by);


--
-- Name: idx_calendar_events_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_project ON public.calendar_events USING btree (project_id);


--
-- Name: idx_calendar_events_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_range ON public.calendar_events USING btree (start_at, end_at);


--
-- Name: idx_calendar_events_recurring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_recurring ON public.calendar_events USING btree (created_by) WHERE (recurrence IS NOT NULL);


--
-- Name: idx_calendar_events_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_start ON public.calendar_events USING btree (start_at);


--
-- Name: idx_calendar_notifications_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_notifications_event ON public.calendar_notifications USING btree (event_id);


--
-- Name: idx_calendar_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_notifications_user_unread ON public.calendar_notifications USING btree (user_id, created_at DESC) WHERE (acknowledged_at IS NULL);


--
-- Name: idx_calendar_reminder_sends_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_reminder_sends_lookup ON public.calendar_reminder_sends USING btree (event_id, occurrence_start_at);


--
-- Name: idx_chat_messages_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_conversation_created ON public.chat_messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_chat_participants_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_participants_conversation ON public.chat_participants USING btree (conversation_id);


--
-- Name: idx_chat_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_participants_user ON public.chat_participants USING btree (user_id);


--
-- Name: idx_company_bank_accounts_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_bank_accounts_company_id ON public.company_bank_accounts USING btree (company_id);


--
-- Name: idx_contracts_contract_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_contract_type_id ON public.contracts USING btree (contract_type_id);


--
-- Name: idx_contracts_phase_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_phase_id ON public.contracts USING btree (phase_id);


--
-- Name: idx_contracts_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_project_id ON public.contracts USING btree (project_id);


--
-- Name: idx_contracts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_status ON public.contracts USING btree (status);


--
-- Name: idx_contracts_subcontractor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_subcontractor_id ON public.contracts USING btree (subcontractor_id);


--
-- Name: idx_credit_allocations_credit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_allocations_credit_id ON public.credit_allocations USING btree (credit_id);


--
-- Name: idx_credit_allocations_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_allocations_project_id ON public.credit_allocations USING btree (project_id);


--
-- Name: idx_credit_allocations_refinancing_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_allocations_refinancing_entity ON public.credit_allocations USING btree (refinancing_entity_id, refinancing_entity_type);


--
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- Name: idx_document_associations_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_associations_document_id ON public.document_associations USING btree (document_id);


--
-- Name: idx_document_associations_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_associations_entity ON public.document_associations USING btree (entity_type, entity_id);


--
-- Name: idx_document_categories_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_categories_parent_id ON public.document_categories USING btree (parent_id);


--
-- Name: idx_documents_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_category_id ON public.documents USING btree (category_id);


--
-- Name: idx_documents_search_text; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_search_text ON public.documents USING gin (search_text);


--
-- Name: idx_documents_uploaded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_uploaded_at ON public.documents USING btree (uploaded_at DESC);


--
-- Name: idx_event_participants_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_participants_event ON public.calendar_event_participants USING btree (event_id);


--
-- Name: idx_event_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_participants_user ON public.calendar_event_participants USING btree (user_id, acknowledged_at);


--
-- Name: idx_funding_payments_bank_id_fkey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funding_payments_bank_id_fkey ON public.funding_payments USING btree (bank_id) WHERE (bank_id IS NOT NULL);


--
-- Name: idx_funding_payments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funding_payments_date ON public.funding_payments USING btree (payment_date DESC);


--
-- Name: idx_funding_payments_investor_id_fkey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funding_payments_investor_id_fkey ON public.funding_payments USING btree (investor_id) WHERE (investor_id IS NOT NULL);


--
-- Name: idx_hidden_approved_invoices_hidden_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hidden_approved_invoices_hidden_at ON public.hidden_approved_invoices USING btree (hidden_at DESC);


--
-- Name: idx_hidden_approved_invoices_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hidden_approved_invoices_invoice_id ON public.hidden_approved_invoices USING btree (invoice_id);


--
-- Name: idx_investments_disbursed_bank_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investments_disbursed_bank_account ON public.project_investments USING btree (disbursed_to_bank_account_id);


--
-- Name: idx_monthly_budgets_year_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monthly_budgets_year_month ON public.monthly_budgets USING btree (year, month);


--
-- Name: idx_occurrence_responses_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occurrence_responses_event ON public.calendar_occurrence_responses USING btree (event_id);


--
-- Name: idx_occurrence_responses_user_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occurrence_responses_user_start ON public.calendar_occurrence_responses USING btree (user_id, original_start_at);


--
-- Name: idx_office_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_suppliers_name ON public.office_suppliers USING btree (name);


--
-- Name: idx_project_managers_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_managers_project_id ON public.project_managers USING btree (project_id);


--
-- Name: idx_project_managers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_managers_user_id ON public.project_managers USING btree (user_id);


--
-- Name: idx_retail_contract_milestones_contract_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_contract_milestones_contract_id ON public.retail_contract_milestones USING btree (contract_id);


--
-- Name: idx_retail_contract_milestones_milestone_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_contract_milestones_milestone_number ON public.retail_contract_milestones USING btree (contract_id, milestone_number);


--
-- Name: idx_retail_contract_milestones_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_contract_milestones_status ON public.retail_contract_milestones USING btree (status);


--
-- Name: idx_retail_contracts_contract_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_contracts_contract_date ON public.retail_contracts USING btree (contract_date);


--
-- Name: idx_retail_contracts_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_contracts_customer_id ON public.retail_contracts USING btree (customer_id);


--
-- Name: idx_retail_contracts_phase_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_contracts_phase_id ON public.retail_contracts USING btree (phase_id);


--
-- Name: idx_retail_contracts_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_contracts_supplier_id ON public.retail_contracts USING btree (supplier_id);


--
-- Name: idx_retail_land_plots_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_land_plots_payment_status ON public.retail_land_plots USING btree (payment_status);


--
-- Name: idx_retail_land_plots_plot_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_land_plots_plot_number ON public.retail_land_plots USING btree (plot_number);


--
-- Name: idx_retail_project_phases_phase_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_project_phases_phase_type ON public.retail_project_phases USING btree (phase_type);


--
-- Name: idx_retail_project_phases_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_project_phases_project_id ON public.retail_project_phases USING btree (project_id);


--
-- Name: idx_retail_projects_land_plot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_projects_land_plot_id ON public.retail_projects USING btree (land_plot_id);


--
-- Name: idx_retail_sales_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_sales_customer_id ON public.retail_sales USING btree (customer_id);


--
-- Name: idx_retail_sales_land_plot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_sales_land_plot_id ON public.retail_sales USING btree (land_plot_id);


--
-- Name: idx_retail_sales_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_sales_payment_status ON public.retail_sales USING btree (payment_status);


--
-- Name: idx_retail_sales_phase_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_sales_phase_id ON public.retail_sales USING btree (phase_id);


--
-- Name: idx_retail_suppliers_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retail_suppliers_type_id ON public.retail_suppliers USING btree (supplier_type_id);


--
-- Name: idx_sales_apartment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_apartment_id ON public.sales USING btree (apartment_id);


--
-- Name: idx_sales_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_customer_id ON public.sales USING btree (customer_id);


--
-- Name: idx_subcontractor_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontractor_comments_user_id ON public.subcontractor_comments USING btree (user_id);


--
-- Name: idx_subcontractor_documents_contract_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontractor_documents_contract_id ON public.subcontractor_documents USING btree (contract_id);


--
-- Name: idx_subcontractor_documents_subcontractor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontractor_documents_subcontractor_id ON public.subcontractor_documents USING btree (subcontractor_id);


--
-- Name: idx_subcontractor_milestones_contract_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontractor_milestones_contract_id ON public.subcontractor_milestones USING btree (contract_id);


--
-- Name: idx_subcontractor_milestones_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontractor_milestones_status ON public.subcontractor_milestones USING btree (status);


--
-- Name: idx_subcontractors_financed_by_bank_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontractors_financed_by_bank_id ON public.subcontractors USING btree (financed_by_bank_id) WHERE (financed_by_bank_id IS NOT NULL);


--
-- Name: idx_subcontractors_financed_by_investor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontractors_financed_by_investor_id ON public.subcontractors USING btree (financed_by_investor_id) WHERE (financed_by_investor_id IS NOT NULL);


--
-- Name: idx_subcontractors_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontractors_name ON public.subcontractors USING btree (name);


--
-- Name: idx_task_assignees_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignees_task ON public.task_assignees USING btree (task_id);


--
-- Name: idx_task_assignees_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignees_user ON public.task_assignees USING btree (user_id, acknowledged_at);


--
-- Name: idx_task_attachments_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_attachments_task ON public.task_attachments USING btree (task_id);


--
-- Name: idx_task_comments_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_comments_task_id ON public.task_comments USING btree (task_id);


--
-- Name: idx_task_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_comments_user_id ON public.task_comments USING btree (user_id);


--
-- Name: idx_task_reminder_sends_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_reminder_sends_task ON public.task_reminder_sends USING btree (task_id);


--
-- Name: idx_tasks_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_created_by ON public.tasks USING btree (created_by);


--
-- Name: idx_tasks_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due_date ON public.tasks USING btree (due_date);


--
-- Name: idx_tasks_due_date_nonnull; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due_date_nonnull ON public.tasks USING btree (due_date) WHERE (due_date IS NOT NULL);


--
-- Name: idx_tasks_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_project_id ON public.tasks USING btree (project_id);


--
-- Name: idx_tic_cost_structures_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tic_cost_structures_created_at ON public.tic_cost_structures USING btree (created_at DESC);


--
-- Name: idx_tic_cost_structures_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tic_cost_structures_created_by ON public.tic_cost_structures USING btree (created_by);


--
-- Name: idx_tic_cost_structures_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tic_cost_structures_project_id ON public.tic_cost_structures USING btree (project_id);


--
-- Name: idx_work_logs_contract_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_logs_contract_id ON public.work_logs USING btree (contract_id);


--
-- Name: idx_work_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_logs_date ON public.work_logs USING btree (date);


--
-- Name: idx_work_logs_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_logs_project_id ON public.work_logs USING btree (project_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: contracts calculate_contract_vat_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER calculate_contract_vat_trigger BEFORE INSERT OR UPDATE OF base_amount, vat_rate ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.calculate_contract_vat();


--
-- Name: accounting_invoices reset_milestone_status_on_invoice_change_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reset_milestone_status_on_invoice_change_trigger BEFORE DELETE OR UPDATE OF status ON public.accounting_invoices FOR EACH ROW EXECUTE FUNCTION public.reset_milestone_status_on_invoice_change();


--
-- Name: accounting_invoices trg_sync_bank_credit_on_invoice; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_bank_credit_on_invoice AFTER INSERT OR DELETE OR UPDATE ON public.accounting_invoices FOR EACH ROW EXECUTE FUNCTION public.sync_bank_credit_on_invoice_change();


--
-- Name: accounting_payments trg_sync_bank_credit_on_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_bank_credit_on_payment AFTER INSERT OR DELETE OR UPDATE ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION public.sync_bank_credit_on_payment_change();


--
-- Name: accounting_payments trg_update_accounting_payments_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_accounting_payments_timestamp BEFORE UPDATE ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION public.update_accounting_payments_updated_at();


--
-- Name: accounting_payments trg_update_contract_budget_realized; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_contract_budget_realized AFTER INSERT OR DELETE OR UPDATE ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION public.update_contract_budget_realized();


--
-- Name: accounting_invoices trg_update_contract_total_invoices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_contract_total_invoices AFTER INSERT OR DELETE OR UPDATE OF total_amount, contract_id ON public.accounting_invoices FOR EACH ROW EXECUTE FUNCTION public.update_contract_total_invoices();


--
-- Name: accounting_payments trg_update_invoice_on_payment_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_invoice_on_payment_change AFTER INSERT OR DELETE OR UPDATE ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_status();


--
-- Name: accounting_invoices trg_update_retail_contract_total_invoices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_retail_contract_total_invoices AFTER INSERT OR DELETE OR UPDATE OF total_amount, retail_contract_id ON public.accounting_invoices FOR EACH ROW EXECUTE FUNCTION public.update_retail_contract_total_invoices();


--
-- Name: accounting_invoices trigger_calculate_invoice_amounts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_invoice_amounts BEFORE INSERT OR UPDATE ON public.accounting_invoices FOR EACH ROW EXECUTE FUNCTION public.calculate_invoice_amounts();


--
-- Name: bank_credits trigger_disbursed_credit_balance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_disbursed_credit_balance BEFORE INSERT ON public.bank_credits FOR EACH ROW EXECUTE FUNCTION public.handle_disbursed_credit_balance();


--
-- Name: bank_credits trigger_disbursed_credit_balance_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_disbursed_credit_balance_delete BEFORE DELETE ON public.bank_credits FOR EACH ROW EXECUTE FUNCTION public.handle_disbursed_credit_balance_delete();


--
-- Name: bank_credits trigger_disbursed_credit_balance_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_disbursed_credit_balance_update BEFORE UPDATE ON public.bank_credits FOR EACH ROW WHEN ((old.disbursed_to_account IS DISTINCT FROM new.disbursed_to_account)) EXECUTE FUNCTION public.handle_disbursed_credit_balance_update();


--
-- Name: project_investments trigger_generate_payment_schedule_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_payment_schedule_trigger AFTER INSERT ON public.project_investments FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_payment_schedule();


--
-- Name: funding_payments trigger_mark_notification_completed_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_mark_notification_completed_trigger AFTER INSERT ON public.funding_payments FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_notification_completed();


--
-- Name: company_loans trigger_recalculate_balances_on_loan_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_recalculate_balances_on_loan_change AFTER INSERT OR DELETE ON public.company_loans FOR EACH ROW EXECUTE FUNCTION public.recalculate_balances_on_loan_change();


--
-- Name: accounting_invoices trigger_reset_retail_milestone_on_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_reset_retail_milestone_on_delete BEFORE DELETE ON public.accounting_invoices FOR EACH ROW EXECUTE FUNCTION public.reset_retail_milestone_on_invoice_delete();


--
-- Name: accounting_invoices trigger_update_allocation_from_outgoing_bank_invoice; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_allocation_from_outgoing_bank_invoice AFTER INSERT OR DELETE OR UPDATE ON public.accounting_invoices FOR EACH ROW EXECUTE FUNCTION public.update_credit_allocation_used_amount_from_invoice();


--
-- Name: banks trigger_update_bank_in_accounting_companies; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_bank_in_accounting_companies AFTER UPDATE ON public.banks FOR EACH ROW WHEN ((old.name IS DISTINCT FROM new.name)) EXECUTE FUNCTION public.update_bank_in_accounting_companies();


--
-- Name: accounting_payments trigger_update_credit_allocation_used_amount; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_credit_allocation_used_amount AFTER INSERT OR DELETE ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION public.update_credit_allocation_used_amount();


--
-- Name: project_investments trigger_update_payment_schedule_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_payment_schedule_trigger AFTER UPDATE ON public.project_investments FOR EACH ROW EXECUTE FUNCTION public.trigger_update_payment_schedule();


--
-- Name: accounting_payments trigger_update_retail_contract_budget_on_payment_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_retail_contract_budget_on_payment_delete AFTER DELETE ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION public.update_retail_contract_budget_realized_from_payments();


--
-- Name: accounting_payments trigger_update_retail_contract_budget_on_payment_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_retail_contract_budget_on_payment_insert AFTER INSERT ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION public.update_retail_contract_budget_realized_from_payments();


--
-- Name: accounting_payments trigger_update_retail_contract_budget_on_payment_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_retail_contract_budget_on_payment_update AFTER UPDATE ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION public.update_retail_contract_budget_realized_from_payments();


--
-- Name: accounting_invoices trigger_update_retail_milestone_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_retail_milestone_status AFTER UPDATE OF status ON public.accounting_invoices FOR EACH ROW EXECUTE FUNCTION public.update_retail_milestone_status_on_payment();


--
-- Name: accounting_payments update_bank_account_balance_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bank_account_balance_trigger AFTER INSERT OR DELETE OR UPDATE ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION public.update_company_bank_account_balance();


--
-- Name: project_investments update_bank_balance_for_investment_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bank_balance_for_investment_trigger AFTER INSERT OR DELETE OR UPDATE ON public.project_investments FOR EACH ROW EXECUTE FUNCTION public.update_bank_balance_for_investment();


--
-- Name: contracts update_contracts_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contracts_updated_at_trigger BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_contracts_updated_at();


--
-- Name: document_categories update_document_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_document_categories_updated_at BEFORE UPDATE ON public.document_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: accounting_payments update_milestone_status_on_payment_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_milestone_status_on_payment_trigger AFTER INSERT OR DELETE OR UPDATE ON public.accounting_payments FOR EACH ROW EXECUTE FUNCTION public.update_milestone_status_on_payment();


--
-- Name: monthly_budgets update_monthly_budgets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_monthly_budgets_updated_at BEFORE UPDATE ON public.monthly_budgets FOR EACH ROW EXECUTE FUNCTION public.update_monthly_budgets_updated_at();


--
-- Name: retail_contract_milestones update_retail_contract_milestones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_retail_contract_milestones_updated_at BEFORE UPDATE ON public.retail_contract_milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: retail_contracts update_retail_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_retail_contracts_updated_at BEFORE UPDATE ON public.retail_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: retail_customers update_retail_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_retail_customers_updated_at BEFORE UPDATE ON public.retail_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: retail_land_plots update_retail_land_plots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_retail_land_plots_updated_at BEFORE UPDATE ON public.retail_land_plots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: retail_project_phases update_retail_project_phases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_retail_project_phases_updated_at BEFORE UPDATE ON public.retail_project_phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: retail_projects update_retail_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_retail_projects_updated_at BEFORE UPDATE ON public.retail_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: retail_sales update_retail_sales_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_retail_sales_updated_at BEFORE UPDATE ON public.retail_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: retail_supplier_types update_retail_supplier_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_retail_supplier_types_updated_at BEFORE UPDATE ON public.retail_supplier_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: retail_suppliers update_retail_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_retail_suppliers_updated_at BEFORE UPDATE ON public.retail_suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contracts update_subcontractor_contract_count_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subcontractor_contract_count_trigger AFTER INSERT OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_subcontractor_contract_count();


--
-- Name: subcontractor_milestones update_subcontractor_milestones_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subcontractor_milestones_updated_at_trigger BEFORE UPDATE ON public.subcontractor_milestones FOR EACH ROW EXECUTE FUNCTION public.update_subcontractor_milestones_updated_at();


--
-- Name: work_logs update_work_logs_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_work_logs_updated_at_trigger BEFORE UPDATE ON public.work_logs FOR EACH ROW EXECUTE FUNCTION public.update_work_logs_updated_at();


--
-- Name: credit_allocations validate_refinancing_entity_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_refinancing_entity_trigger BEFORE INSERT OR UPDATE ON public.credit_allocations FOR EACH ROW EXECUTE FUNCTION public.validate_refinancing_entity();


--
-- Name: accounting_invoices accounting_invoices_apartment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_apartment_id_fkey FOREIGN KEY (apartment_id) REFERENCES public.apartments(id) ON DELETE RESTRICT;


--
-- Name: accounting_invoices accounting_invoices_bank_credit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_bank_credit_id_fkey FOREIGN KEY (bank_credit_id) REFERENCES public.bank_credits(id) ON DELETE RESTRICT;


--
-- Name: accounting_invoices accounting_invoices_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE SET NULL;


--
-- Name: accounting_invoices accounting_invoices_company_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_company_bank_account_id_fkey FOREIGN KEY (company_bank_account_id) REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL;


--
-- Name: accounting_invoices accounting_invoices_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.accounting_companies(id) ON DELETE SET NULL;


--
-- Name: accounting_invoices accounting_invoices_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: accounting_invoices accounting_invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: accounting_invoices accounting_invoices_credit_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_credit_allocation_id_fkey FOREIGN KEY (credit_allocation_id) REFERENCES public.credit_allocations(id) ON DELETE SET NULL;


--
-- Name: accounting_invoices accounting_invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: accounting_invoices accounting_invoices_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.project_investments(id) ON DELETE RESTRICT;


--
-- Name: accounting_invoices accounting_invoices_investor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.investors(id);


--
-- Name: accounting_invoices accounting_invoices_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.subcontractor_milestones(id) ON DELETE SET NULL;


--
-- Name: accounting_invoices accounting_invoices_office_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_office_supplier_id_fkey FOREIGN KEY (office_supplier_id) REFERENCES public.office_suppliers(id) ON DELETE RESTRICT;


--
-- Name: accounting_invoices accounting_invoices_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: accounting_invoices accounting_invoices_refund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_refund_id_fkey FOREIGN KEY (refund_id) REFERENCES public.accounting_invoices_refund(id) ON DELETE SET NULL;


--
-- Name: accounting_invoices accounting_invoices_retail_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_retail_contract_id_fkey FOREIGN KEY (retail_contract_id) REFERENCES public.retail_contracts(id) ON DELETE CASCADE;


--
-- Name: accounting_invoices accounting_invoices_retail_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_retail_customer_id_fkey FOREIGN KEY (retail_customer_id) REFERENCES public.retail_customers(id) ON DELETE CASCADE;


--
-- Name: accounting_invoices accounting_invoices_retail_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_retail_milestone_id_fkey FOREIGN KEY (retail_milestone_id) REFERENCES public.retail_contract_milestones(id) ON DELETE SET NULL;


--
-- Name: accounting_invoices accounting_invoices_retail_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_retail_project_id_fkey FOREIGN KEY (retail_project_id) REFERENCES public.retail_projects(id) ON DELETE CASCADE;


--
-- Name: accounting_invoices accounting_invoices_retail_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_retail_supplier_id_fkey FOREIGN KEY (retail_supplier_id) REFERENCES public.retail_suppliers(id) ON DELETE CASCADE;


--
-- Name: accounting_invoices accounting_invoices_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_invoices
    ADD CONSTRAINT accounting_invoices_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.subcontractors(id) ON DELETE RESTRICT;


--
-- Name: accounting_payments accounting_payments_cesija_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_payments
    ADD CONSTRAINT accounting_payments_cesija_bank_account_id_fkey FOREIGN KEY (cesija_bank_account_id) REFERENCES public.company_bank_accounts(id);


--
-- Name: accounting_payments accounting_payments_cesija_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_payments
    ADD CONSTRAINT accounting_payments_cesija_company_id_fkey FOREIGN KEY (cesija_company_id) REFERENCES public.accounting_companies(id);


--
-- Name: accounting_payments accounting_payments_cesija_credit_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_payments
    ADD CONSTRAINT accounting_payments_cesija_credit_allocation_id_fkey FOREIGN KEY (cesija_credit_allocation_id) REFERENCES public.credit_allocations(id) ON DELETE SET NULL;


--
-- Name: accounting_payments accounting_payments_cesija_credit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_payments
    ADD CONSTRAINT accounting_payments_cesija_credit_id_fkey FOREIGN KEY (cesija_credit_id) REFERENCES public.bank_credits(id) ON DELETE SET NULL;


--
-- Name: accounting_payments accounting_payments_company_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_payments
    ADD CONSTRAINT accounting_payments_company_bank_account_id_fkey FOREIGN KEY (company_bank_account_id) REFERENCES public.company_bank_accounts(id);


--
-- Name: accounting_payments accounting_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_payments
    ADD CONSTRAINT accounting_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: accounting_payments accounting_payments_credit_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_payments
    ADD CONSTRAINT accounting_payments_credit_allocation_id_fkey FOREIGN KEY (credit_allocation_id) REFERENCES public.credit_allocations(id) ON DELETE SET NULL;


--
-- Name: accounting_payments accounting_payments_credit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_payments
    ADD CONSTRAINT accounting_payments_credit_id_fkey FOREIGN KEY (credit_id) REFERENCES public.bank_credits(id) ON DELETE SET NULL;


--
-- Name: accounting_payments accounting_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_payments
    ADD CONSTRAINT accounting_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.accounting_invoices(id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: apartment_garages apartment_garages_apartment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartment_garages
    ADD CONSTRAINT apartment_garages_apartment_id_fkey FOREIGN KEY (apartment_id) REFERENCES public.apartments(id) ON DELETE CASCADE;


--
-- Name: apartment_garages apartment_garages_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartment_garages
    ADD CONSTRAINT apartment_garages_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(id) ON DELETE CASCADE;


--
-- Name: apartment_repositories apartment_repositories_apartment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartment_repositories
    ADD CONSTRAINT apartment_repositories_apartment_id_fkey FOREIGN KEY (apartment_id) REFERENCES public.apartments(id) ON DELETE CASCADE;


--
-- Name: apartment_repositories apartment_repositories_repository_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartment_repositories
    ADD CONSTRAINT apartment_repositories_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES public.repositories(id) ON DELETE CASCADE;


--
-- Name: apartments apartments_building_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartments
    ADD CONSTRAINT apartments_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE CASCADE;


--
-- Name: apartments apartments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apartments
    ADD CONSTRAINT apartments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: bank_credits bank_credits_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_credits
    ADD CONSTRAINT bank_credits_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE CASCADE;


--
-- Name: bank_credits bank_credits_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_credits
    ADD CONSTRAINT bank_credits_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.accounting_companies(id) ON DELETE SET NULL;


--
-- Name: bank_credits bank_credits_disbursed_to_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_credits
    ADD CONSTRAINT bank_credits_disbursed_to_bank_account_id_fkey FOREIGN KEY (disbursed_to_bank_account_id) REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL;


--
-- Name: bank_credits bank_credits_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_credits
    ADD CONSTRAINT bank_credits_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: buildings buildings_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: calendar_event_exceptions calendar_event_exceptions_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_exceptions
    ADD CONSTRAINT calendar_event_exceptions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_event_participants calendar_event_participants_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_participants
    ADD CONSTRAINT calendar_event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_event_participants calendar_event_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_participants
    ADD CONSTRAINT calendar_event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: calendar_notifications calendar_notifications_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_notifications
    ADD CONSTRAINT calendar_notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_notifications calendar_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_notifications
    ADD CONSTRAINT calendar_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_occurrence_responses calendar_occurrence_responses_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_occurrence_responses
    ADD CONSTRAINT calendar_occurrence_responses_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_occurrence_responses calendar_occurrence_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_occurrence_responses
    ADD CONSTRAINT calendar_occurrence_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_reminder_sends calendar_reminder_sends_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_reminder_sends
    ADD CONSTRAINT calendar_reminder_sends_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_reminder_sends calendar_reminder_sends_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_reminder_sends
    ADD CONSTRAINT calendar_reminder_sends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_conversations chat_conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: chat_messages chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: chat_participants chat_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_participants chat_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: company_bank_accounts company_bank_accounts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_bank_accounts
    ADD CONSTRAINT company_bank_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.accounting_companies(id) ON DELETE CASCADE;


--
-- Name: company_loans company_loans_from_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_loans
    ADD CONSTRAINT company_loans_from_bank_account_id_fkey FOREIGN KEY (from_bank_account_id) REFERENCES public.company_bank_accounts(id) ON DELETE CASCADE;


--
-- Name: company_loans company_loans_from_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_loans
    ADD CONSTRAINT company_loans_from_company_id_fkey FOREIGN KEY (from_company_id) REFERENCES public.accounting_companies(id) ON DELETE CASCADE;


--
-- Name: company_loans company_loans_to_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_loans
    ADD CONSTRAINT company_loans_to_bank_account_id_fkey FOREIGN KEY (to_bank_account_id) REFERENCES public.company_bank_accounts(id) ON DELETE CASCADE;


--
-- Name: company_loans company_loans_to_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_loans
    ADD CONSTRAINT company_loans_to_company_id_fkey FOREIGN KEY (to_company_id) REFERENCES public.accounting_companies(id) ON DELETE CASCADE;


--
-- Name: subcontractor_documents contract_documents_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_documents
    ADD CONSTRAINT contract_documents_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: subcontractor_documents contract_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_documents
    ADD CONSTRAINT contract_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_contract_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_type_id_fkey FOREIGN KEY (contract_type_id) REFERENCES public.contract_types(id);


--
-- Name: contracts contracts_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.project_phases(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE CASCADE;


--
-- Name: credit_allocations credit_allocations_credit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_allocations
    ADD CONSTRAINT credit_allocations_credit_id_fkey FOREIGN KEY (credit_id) REFERENCES public.bank_credits(id) ON DELETE CASCADE;


--
-- Name: credit_allocations credit_allocations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_allocations
    ADD CONSTRAINT credit_allocations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: document_associations document_associations_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_associations
    ADD CONSTRAINT document_associations_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_categories document_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.document_categories(id) ON DELETE RESTRICT;


--
-- Name: documents documents_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.document_categories(id) ON DELETE SET NULL;


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: project_investments fk_investment_disbursed_bank_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_investments
    ADD CONSTRAINT fk_investment_disbursed_bank_account FOREIGN KEY (disbursed_to_bank_account_id) REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL;


--
-- Name: funding_payments funding_payments_bank_credit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_payments
    ADD CONSTRAINT funding_payments_bank_credit_id_fkey FOREIGN KEY (bank_credit_id) REFERENCES public.bank_credits(id) ON DELETE SET NULL;


--
-- Name: funding_payments funding_payments_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_payments
    ADD CONSTRAINT funding_payments_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE CASCADE;


--
-- Name: funding_payments funding_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_payments
    ADD CONSTRAINT funding_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: funding_payments funding_payments_investor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_payments
    ADD CONSTRAINT funding_payments_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.investors(id) ON DELETE CASCADE;


--
-- Name: funding_payments funding_payments_project_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_payments
    ADD CONSTRAINT funding_payments_project_investment_id_fkey FOREIGN KEY (project_investment_id) REFERENCES public.project_investments(id) ON DELETE SET NULL;


--
-- Name: garages garages_building_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garages
    ADD CONSTRAINT garages_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE CASCADE;


--
-- Name: hidden_approved_invoices hidden_approved_invoices_hidden_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hidden_approved_invoices
    ADD CONSTRAINT hidden_approved_invoices_hidden_by_fkey FOREIGN KEY (hidden_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: hidden_approved_invoices hidden_approved_invoices_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hidden_approved_invoices
    ADD CONSTRAINT hidden_approved_invoices_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.accounting_invoices(id) ON DELETE CASCADE;


--
-- Name: old_invoices invoices_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.old_invoices
    ADD CONSTRAINT invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: old_invoices invoices_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.old_invoices
    ADD CONSTRAINT invoices_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE SET NULL;


--
-- Name: leads leads_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: leads leads_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_investments project_investments_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_investments
    ADD CONSTRAINT project_investments_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE SET NULL;


--
-- Name: project_investments project_investments_investor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_investments
    ADD CONSTRAINT project_investments_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.investors(id) ON DELETE SET NULL;


--
-- Name: project_investments project_investments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_investments
    ADD CONSTRAINT project_investments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_managers project_managers_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_managers
    ADD CONSTRAINT project_managers_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_managers project_managers_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_managers
    ADD CONSTRAINT project_managers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_managers project_managers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_managers
    ADD CONSTRAINT project_managers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_milestones project_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_phases project_phases_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_phases
    ADD CONSTRAINT project_phases_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: repositories repositories_building_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repositories
    ADD CONSTRAINT repositories_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE CASCADE;


--
-- Name: retail_contract_milestones retail_contract_milestones_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_contract_milestones
    ADD CONSTRAINT retail_contract_milestones_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.retail_contracts(id) ON DELETE CASCADE;


--
-- Name: retail_contracts retail_contracts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_contracts
    ADD CONSTRAINT retail_contracts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.retail_customers(id) ON DELETE CASCADE;


--
-- Name: retail_contracts retail_contracts_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_contracts
    ADD CONSTRAINT retail_contracts_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.retail_project_phases(id) ON DELETE CASCADE;


--
-- Name: retail_contracts retail_contracts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_contracts
    ADD CONSTRAINT retail_contracts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.retail_suppliers(id) ON DELETE CASCADE;


--
-- Name: retail_project_phases retail_project_phases_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_project_phases
    ADD CONSTRAINT retail_project_phases_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.retail_projects(id) ON DELETE CASCADE;


--
-- Name: retail_projects retail_projects_land_plot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_projects
    ADD CONSTRAINT retail_projects_land_plot_id_fkey FOREIGN KEY (land_plot_id) REFERENCES public.retail_land_plots(id) ON DELETE SET NULL;


--
-- Name: retail_sales retail_sales_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_sales
    ADD CONSTRAINT retail_sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.retail_customers(id) ON DELETE RESTRICT;


--
-- Name: retail_sales retail_sales_land_plot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_sales
    ADD CONSTRAINT retail_sales_land_plot_id_fkey FOREIGN KEY (land_plot_id) REFERENCES public.retail_land_plots(id) ON DELETE CASCADE;


--
-- Name: retail_sales retail_sales_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_sales
    ADD CONSTRAINT retail_sales_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.retail_project_phases(id) ON DELETE SET NULL;


--
-- Name: retail_suppliers retail_suppliers_supplier_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retail_suppliers
    ADD CONSTRAINT retail_suppliers_supplier_type_id_fkey FOREIGN KEY (supplier_type_id) REFERENCES public.retail_supplier_types(id);


--
-- Name: sales sales_apartment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_apartment_id_fkey FOREIGN KEY (apartment_id) REFERENCES public.apartments(id) ON DELETE CASCADE;


--
-- Name: sales sales_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: subcontractor_comments subcontractor_comments_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_comments
    ADD CONSTRAINT subcontractor_comments_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE CASCADE;


--
-- Name: subcontractor_comments subcontractor_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_comments
    ADD CONSTRAINT subcontractor_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: subcontractor_documents subcontractor_documents_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_documents
    ADD CONSTRAINT subcontractor_documents_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE CASCADE;


--
-- Name: subcontractor_milestones subcontractor_milestones_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_milestones
    ADD CONSTRAINT subcontractor_milestones_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: subcontractors subcontractors_financed_by_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractors
    ADD CONSTRAINT subcontractors_financed_by_bank_id_fkey FOREIGN KEY (financed_by_bank_id) REFERENCES public.banks(id) ON DELETE SET NULL;


--
-- Name: subcontractors subcontractors_financed_by_investor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractors
    ADD CONSTRAINT subcontractors_financed_by_investor_id_fkey FOREIGN KEY (financed_by_investor_id) REFERENCES public.investors(id) ON DELETE SET NULL;


--
-- Name: task_assignees task_assignees_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_assignees task_assignees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_comments task_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_reminder_sends task_reminder_sends_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_reminder_sends
    ADD CONSTRAINT task_reminder_sends_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: tic_cost_structures tic_cost_structures_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tic_cost_structures
    ADD CONSTRAINT tic_cost_structures_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tic_cost_structures tic_cost_structures_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tic_cost_structures
    ADD CONSTRAINT tic_cost_structures_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: users users_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: work_logs work_logs_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: work_logs work_logs_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.project_phases(id) ON DELETE SET NULL;


--
-- Name: work_logs work_logs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: work_logs work_logs_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE CASCADE;


--
-- Name: old_invoices Accounting roles can insert old_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Accounting roles can insert old_invoices" ON public.old_invoices FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: old_invoices Accounting roles can update old_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Accounting roles can update old_invoices" ON public.old_invoices FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: invoice_categories Admins can manage invoice categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage invoice categories" ON public.invoice_categories TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'director'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'director'::text)))));


--
-- Name: task_comments Allow all operations on task_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on task_comments" ON public.task_comments USING (true) WITH CHECK (true);


--
-- Name: buildings Allow authenticated to delete buildings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to delete buildings" ON public.buildings FOR DELETE TO authenticated USING (true);


--
-- Name: garages Allow authenticated to delete garages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to delete garages" ON public.garages FOR DELETE TO authenticated USING (true);


--
-- Name: repositories Allow authenticated to delete repositories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to delete repositories" ON public.repositories FOR DELETE TO authenticated USING (true);


--
-- Name: subcontractor_comments Allow authenticated to delete subcontractor_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to delete subcontractor_comments" ON public.subcontractor_comments FOR DELETE TO authenticated USING (true);


--
-- Name: buildings Allow authenticated to insert buildings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to insert buildings" ON public.buildings FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: garages Allow authenticated to insert garages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to insert garages" ON public.garages FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: repositories Allow authenticated to insert repositories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to insert repositories" ON public.repositories FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: users Allow authenticated to insert users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to insert users" ON public.users FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: buildings Allow authenticated to update buildings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to update buildings" ON public.buildings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: garages Allow authenticated to update garages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to update garages" ON public.garages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: repositories Allow authenticated to update repositories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to update repositories" ON public.repositories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: subcontractor_comments Allow authenticated to update subcontractor_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to update subcontractor_comments" ON public.subcontractor_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: users Allow reading users for authentication; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow reading users for authentication" ON public.users FOR SELECT TO anon, authenticated USING (true);


--
-- Name: users Allow users to update own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to update own record" ON public.users FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: apartments Authenticated users can access apartments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access apartments" ON public.apartments TO authenticated USING (true);


--
-- Name: bank_credits Authenticated users can access bank credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access bank credits" ON public.bank_credits TO authenticated USING (true);


--
-- Name: banks Authenticated users can access banks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access banks" ON public.banks TO authenticated USING (true);


--
-- Name: customers Authenticated users can access customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access customers" ON public.customers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: investors Authenticated users can access investors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access investors" ON public.investors TO authenticated USING (true);


--
-- Name: old_invoices Authenticated users can access invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access invoices" ON public.old_invoices TO authenticated USING (true);


--
-- Name: leads Authenticated users can access leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access leads" ON public.leads TO authenticated USING (true) WITH CHECK (true);


--
-- Name: project_investments Authenticated users can access project investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access project investments" ON public.project_investments TO authenticated USING (true);


--
-- Name: project_milestones Authenticated users can access project milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access project milestones" ON public.project_milestones TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sales Authenticated users can access sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access sales" ON public.sales TO authenticated USING (true) WITH CHECK (true);


--
-- Name: company_loans Authenticated users can create company loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create company loans" ON public.company_loans FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: chat_conversations Authenticated users can create conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create conversations" ON public.chat_conversations FOR INSERT TO authenticated WITH CHECK ((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: credit_allocations Authenticated users can create credit allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create credit allocations" ON public.credit_allocations FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: apartment_garages Authenticated users can delete apartment garages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete apartment garages" ON public.apartment_garages FOR DELETE TO authenticated USING (true);


--
-- Name: apartment_repositories Authenticated users can delete apartment repositories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete apartment repositories" ON public.apartment_repositories FOR DELETE TO authenticated USING (true);


--
-- Name: monthly_budgets Authenticated users can delete budgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete budgets" ON public.monthly_budgets FOR DELETE TO authenticated USING (true);


--
-- Name: accounting_companies Authenticated users can delete companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete companies" ON public.accounting_companies FOR DELETE TO authenticated USING (true);


--
-- Name: company_loans Authenticated users can delete company loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete company loans" ON public.company_loans FOR DELETE TO authenticated USING (true);


--
-- Name: credit_allocations Authenticated users can delete credit allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete credit allocations" ON public.credit_allocations FOR DELETE TO authenticated USING (true);


--
-- Name: retail_customers Authenticated users can delete customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete customers" ON public.retail_customers FOR DELETE TO authenticated USING (true);


--
-- Name: document_associations Authenticated users can delete document_associations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete document_associations" ON public.document_associations FOR DELETE TO authenticated USING (true);


--
-- Name: document_categories Authenticated users can delete document_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete document_categories" ON public.document_categories FOR DELETE TO authenticated USING (true);


--
-- Name: documents Authenticated users can delete documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete documents" ON public.documents FOR DELETE TO authenticated USING (true);


--
-- Name: funding_payments Authenticated users can delete funding payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete funding payments" ON public.funding_payments FOR DELETE TO authenticated USING (true);


--
-- Name: retail_land_plots Authenticated users can delete land plots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete land plots" ON public.retail_land_plots FOR DELETE TO authenticated USING (true);


--
-- Name: subcontractor_milestones Authenticated users can delete milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete milestones" ON public.subcontractor_milestones FOR DELETE TO authenticated USING (true);


--
-- Name: accounting_payments Authenticated users can delete payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete payments" ON public.accounting_payments FOR DELETE TO authenticated USING (true);


--
-- Name: accounting_invoices_refund Authenticated users can delete refunds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete refunds" ON public.accounting_invoices_refund FOR DELETE TO authenticated USING (true);


--
-- Name: retail_contracts Authenticated users can delete retail contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete retail contracts" ON public.retail_contracts FOR DELETE TO authenticated USING (true);


--
-- Name: retail_contract_milestones Authenticated users can delete retail milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete retail milestones" ON public.retail_contract_milestones FOR DELETE TO authenticated USING (true);


--
-- Name: retail_project_phases Authenticated users can delete retail phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete retail phases" ON public.retail_project_phases FOR DELETE TO authenticated USING (true);


--
-- Name: retail_projects Authenticated users can delete retail projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete retail projects" ON public.retail_projects FOR DELETE TO authenticated USING (true);


--
-- Name: retail_suppliers Authenticated users can delete retail suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete retail suppliers" ON public.retail_suppliers FOR DELETE TO authenticated USING (true);


--
-- Name: retail_sales Authenticated users can delete sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete sales" ON public.retail_sales FOR DELETE TO authenticated USING (true);


--
-- Name: subcontractor_documents Authenticated users can delete subcontractor documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete subcontractor documents" ON public.subcontractor_documents FOR DELETE TO authenticated USING (true);


--
-- Name: retail_supplier_types Authenticated users can delete supplier types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete supplier types" ON public.retail_supplier_types FOR DELETE TO authenticated USING (true);


--
-- Name: hidden_approved_invoices Authenticated users can hide invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can hide invoices" ON public.hidden_approved_invoices FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: activity_logs Authenticated users can insert activity_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert activity_logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: apartment_garages Authenticated users can insert apartment garages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert apartment garages" ON public.apartment_garages FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: apartment_repositories Authenticated users can insert apartment repositories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert apartment repositories" ON public.apartment_repositories FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: monthly_budgets Authenticated users can insert budgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert budgets" ON public.monthly_budgets FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: accounting_companies Authenticated users can insert companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert companies" ON public.accounting_companies FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: contract_types Authenticated users can insert contract types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert contract types" ON public.contract_types FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (lower(users.role) = ANY (ARRAY['director'::text, 'admin'::text, 'project_manager'::text, 'supervision'::text]))))));


--
-- Name: retail_customers Authenticated users can insert customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert customers" ON public.retail_customers FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: document_associations Authenticated users can insert document_associations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert document_associations" ON public.document_associations FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: document_categories Authenticated users can insert document_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert document_categories" ON public.document_categories FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: funding_payments Authenticated users can insert funding payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert funding payments" ON public.funding_payments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: retail_land_plots Authenticated users can insert land plots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert land plots" ON public.retail_land_plots FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: subcontractor_milestones Authenticated users can insert milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert milestones" ON public.subcontractor_milestones FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: accounting_payments Authenticated users can insert payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert payments" ON public.accounting_payments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: accounting_invoices_refund Authenticated users can insert refunds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert refunds" ON public.accounting_invoices_refund FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: retail_contracts Authenticated users can insert retail contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert retail contracts" ON public.retail_contracts FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: retail_contract_milestones Authenticated users can insert retail milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert retail milestones" ON public.retail_contract_milestones FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: retail_project_phases Authenticated users can insert retail phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert retail phases" ON public.retail_project_phases FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: retail_projects Authenticated users can insert retail projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert retail projects" ON public.retail_projects FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: retail_suppliers Authenticated users can insert retail suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert retail suppliers" ON public.retail_suppliers FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: retail_sales Authenticated users can insert sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert sales" ON public.retail_sales FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: subcontractor_comments Authenticated users can insert subcontractor comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert subcontractor comments" ON public.subcontractor_comments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: retail_supplier_types Authenticated users can insert supplier types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert supplier types" ON public.retail_supplier_types FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: contracts Authenticated users can read contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read contracts" ON public.contracts FOR SELECT TO authenticated USING (true);


--
-- Name: invoice_categories Authenticated users can read invoice categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read invoice categories" ON public.invoice_categories FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: subcontractor_comments Authenticated users can read subcontractor comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read subcontractor comments" ON public.subcontractor_comments FOR SELECT TO authenticated USING (true);


--
-- Name: hidden_approved_invoices Authenticated users can unhide invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can unhide invoices" ON public.hidden_approved_invoices FOR DELETE TO authenticated USING (true);


--
-- Name: apartment_garages Authenticated users can update apartment garages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update apartment garages" ON public.apartment_garages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: apartment_repositories Authenticated users can update apartment repositories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update apartment repositories" ON public.apartment_repositories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: monthly_budgets Authenticated users can update budgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update budgets" ON public.monthly_budgets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: accounting_companies Authenticated users can update companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update companies" ON public.accounting_companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: contract_types Authenticated users can update contract types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update contract types" ON public.contract_types FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (lower(users.role) = ANY (ARRAY['director'::text, 'admin'::text, 'project_manager'::text, 'supervision'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (lower(users.role) = ANY (ARRAY['director'::text, 'admin'::text, 'project_manager'::text, 'supervision'::text]))))));


--
-- Name: credit_allocations Authenticated users can update credit allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update credit allocations" ON public.credit_allocations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: retail_customers Authenticated users can update customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update customers" ON public.retail_customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: document_categories Authenticated users can update document_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update document_categories" ON public.document_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: documents Authenticated users can update documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update documents" ON public.documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: funding_payments Authenticated users can update funding payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update funding payments" ON public.funding_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: retail_land_plots Authenticated users can update land plots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update land plots" ON public.retail_land_plots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: subcontractor_milestones Authenticated users can update milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update milestones" ON public.subcontractor_milestones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: accounting_payments Authenticated users can update payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update payments" ON public.accounting_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: accounting_invoices_refund Authenticated users can update refunds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update refunds" ON public.accounting_invoices_refund FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: retail_contracts Authenticated users can update retail contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update retail contracts" ON public.retail_contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: retail_contract_milestones Authenticated users can update retail milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update retail milestones" ON public.retail_contract_milestones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: retail_project_phases Authenticated users can update retail phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update retail phases" ON public.retail_project_phases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: retail_projects Authenticated users can update retail projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update retail projects" ON public.retail_projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: retail_suppliers Authenticated users can update retail suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update retail suppliers" ON public.retail_suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: retail_sales Authenticated users can update sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update sales" ON public.retail_sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: retail_supplier_types Authenticated users can update supplier types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update supplier types" ON public.retail_supplier_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: documents Authenticated users can upload documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can upload documents" ON public.documents FOR INSERT TO authenticated WITH CHECK ((auth.uid() = uploaded_by));


--
-- Name: subcontractor_documents Authenticated users can upload subcontractor documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can upload subcontractor documents" ON public.subcontractor_documents FOR INSERT TO authenticated WITH CHECK ((auth.uid() = uploaded_by));


--
-- Name: accounting_payments Authenticated users can view all payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all payments" ON public.accounting_payments FOR SELECT TO authenticated USING (true);


--
-- Name: apartment_garages Authenticated users can view apartment garages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view apartment garages" ON public.apartment_garages FOR SELECT TO authenticated USING (true);


--
-- Name: apartment_repositories Authenticated users can view apartment repositories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view apartment repositories" ON public.apartment_repositories FOR SELECT TO authenticated USING (true);


--
-- Name: monthly_budgets Authenticated users can view budgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view budgets" ON public.monthly_budgets FOR SELECT TO authenticated USING (true);


--
-- Name: buildings Authenticated users can view buildings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view buildings" ON public.buildings FOR SELECT TO authenticated USING (true);


--
-- Name: accounting_companies Authenticated users can view companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view companies" ON public.accounting_companies FOR SELECT TO authenticated USING (true);


--
-- Name: company_loans Authenticated users can view company loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view company loans" ON public.company_loans FOR SELECT TO authenticated USING (true);


--
-- Name: contract_types Authenticated users can view contract types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view contract types" ON public.contract_types FOR SELECT TO authenticated USING (true);


--
-- Name: credit_allocations Authenticated users can view credit allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view credit allocations" ON public.credit_allocations FOR SELECT TO authenticated USING (true);


--
-- Name: retail_customers Authenticated users can view customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view customers" ON public.retail_customers FOR SELECT TO authenticated USING (true);


--
-- Name: document_associations Authenticated users can view document_associations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view document_associations" ON public.document_associations FOR SELECT TO authenticated USING (true);


--
-- Name: document_categories Authenticated users can view document_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view document_categories" ON public.document_categories FOR SELECT TO authenticated USING (true);


--
-- Name: documents Authenticated users can view documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view documents" ON public.documents FOR SELECT TO authenticated USING (true);


--
-- Name: funding_payments Authenticated users can view funding payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view funding payments" ON public.funding_payments FOR SELECT TO authenticated USING (true);


--
-- Name: garages Authenticated users can view garages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view garages" ON public.garages FOR SELECT TO authenticated USING (true);


--
-- Name: hidden_approved_invoices Authenticated users can view hidden invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view hidden invoices" ON public.hidden_approved_invoices FOR SELECT TO authenticated USING (true);


--
-- Name: retail_land_plots Authenticated users can view land plots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view land plots" ON public.retail_land_plots FOR SELECT TO authenticated USING (true);


--
-- Name: subcontractor_milestones Authenticated users can view milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view milestones" ON public.subcontractor_milestones FOR SELECT TO authenticated USING (true);


--
-- Name: accounting_invoices_refund Authenticated users can view refunds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view refunds" ON public.accounting_invoices_refund FOR SELECT TO authenticated USING (true);


--
-- Name: repositories Authenticated users can view repositories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view repositories" ON public.repositories FOR SELECT TO authenticated USING (true);


--
-- Name: retail_contracts Authenticated users can view retail contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view retail contracts" ON public.retail_contracts FOR SELECT TO authenticated USING (true);


--
-- Name: retail_contract_milestones Authenticated users can view retail milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view retail milestones" ON public.retail_contract_milestones FOR SELECT TO authenticated USING (true);


--
-- Name: retail_project_phases Authenticated users can view retail phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view retail phases" ON public.retail_project_phases FOR SELECT TO authenticated USING (true);


--
-- Name: retail_projects Authenticated users can view retail projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view retail projects" ON public.retail_projects FOR SELECT TO authenticated USING (true);


--
-- Name: retail_suppliers Authenticated users can view retail suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view retail suppliers" ON public.retail_suppliers FOR SELECT TO authenticated USING (true);


--
-- Name: retail_sales Authenticated users can view sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view sales" ON public.retail_sales FOR SELECT TO authenticated USING (true);


--
-- Name: subcontractor_documents Authenticated users can view subcontractor documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view subcontractor documents" ON public.subcontractor_documents FOR SELECT TO authenticated USING (true);


--
-- Name: subcontractors Authenticated users can view subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view subcontractors" ON public.subcontractors FOR SELECT TO authenticated USING (true);


--
-- Name: retail_supplier_types Authenticated users can view supplier types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view supplier types" ON public.retail_supplier_types FOR SELECT TO authenticated USING (true);


--
-- Name: work_logs Authenticated users can view work logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view work logs" ON public.work_logs FOR SELECT TO authenticated USING (true);


--
-- Name: calendar_notifications CalendarNotifications: recipient can delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CalendarNotifications: recipient can delete" ON public.calendar_notifications FOR DELETE TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_notifications CalendarNotifications: recipient can update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CalendarNotifications: recipient can update" ON public.calendar_notifications FOR UPDATE TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))) WITH CHECK ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_notifications CalendarNotifications: recipient can view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CalendarNotifications: recipient can view" ON public.calendar_notifications FOR SELECT TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: chat_conversations Conversation creator can delete conversation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Conversation creator can delete conversation" ON public.chat_conversations FOR DELETE TO authenticated USING ((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: chat_conversations Conversation creator can update conversation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Conversation creator can update conversation" ON public.chat_conversations FOR UPDATE TO authenticated USING ((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))) WITH CHECK ((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: companies Director and Accounting can insert companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Accounting can insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: accounting_invoices Director and Accounting can insert invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Accounting can insert invoices" ON public.accounting_invoices FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: office_suppliers Director and Accounting can insert office suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Accounting can insert office suppliers" ON public.office_suppliers FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: companies Director and Accounting can update companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Accounting can update companies" ON public.companies FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: accounting_invoices Director and Accounting can update invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Accounting can update invoices" ON public.accounting_invoices FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: office_suppliers Director and Accounting can update office suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Accounting can update office suppliers" ON public.office_suppliers FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: companies Director and Accounting can view all companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Accounting can view all companies" ON public.companies FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: accounting_invoices Director and Accounting can view all invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Accounting can view all invoices" ON public.accounting_invoices FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: office_suppliers Director and Accounting can view all office suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Accounting can view all office suppliers" ON public.office_suppliers FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text]))))));


--
-- Name: project_phases Director and Supervision can insert project_phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Supervision can insert project_phases" ON public.project_phases FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text]))))));


--
-- Name: work_logs Director and Supervision can insert work_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Supervision can insert work_logs" ON public.work_logs FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text]))))));


--
-- Name: project_phases Director and Supervision can update project_phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Supervision can update project_phases" ON public.project_phases FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text]))))));


--
-- Name: work_logs Director and Supervision can update work_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director and Supervision can update work_logs" ON public.work_logs FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text]))))));


--
-- Name: bank_credits Director can delete bank_credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete bank_credits" ON public.bank_credits FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: banks Director can delete banks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete banks" ON public.banks FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: companies Director can delete companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete companies" ON public.companies FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: contracts Director can delete contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete contracts" ON public.contracts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: credit_allocations Director can delete credit_allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete credit_allocations" ON public.credit_allocations FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: customers Director can delete customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete customers" ON public.customers FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: funding_payments Director can delete funding_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete funding_payments" ON public.funding_payments FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: investors Director can delete investors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete investors" ON public.investors FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: accounting_invoices Director can delete invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete invoices" ON public.accounting_invoices FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: office_suppliers Director can delete office suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete office suppliers" ON public.office_suppliers FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: old_invoices Director can delete old_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete old_invoices" ON public.old_invoices FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: project_investments Director can delete project_investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete project_investments" ON public.project_investments FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: project_phases Director can delete project_phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete project_phases" ON public.project_phases FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: sales Director can delete sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete sales" ON public.sales FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: subcontractors Director can delete subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete subcontractors" ON public.subcontractors FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: work_logs Director can delete work_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can delete work_logs" ON public.work_logs FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: activity_logs Director can select activity_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Director can select activity_logs" ON public.activity_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: work_logs Directors and Supervision can create work logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors and Supervision can create work logs" ON public.work_logs FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text]))))));


--
-- Name: work_logs Directors and Supervision can delete work logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors and Supervision can delete work logs" ON public.work_logs FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text]))))));


--
-- Name: work_logs Directors and Supervision can update work logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors and Supervision can update work logs" ON public.work_logs FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text]))))));


--
-- Name: project_phases Directors and general users can view all phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors and general users can view all phases" ON public.project_phases FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Investment'::text, 'Sales'::text, 'Accounting'::text]))))));


--
-- Name: projects Directors and general users can view all projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors and general users can view all projects" ON public.projects FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Investment'::text, 'Sales'::text, 'Accounting'::text]))))));


--
-- Name: project_managers Directors can create project manager assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can create project manager assignments" ON public.project_managers FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.role = 'Director'::text)))));


--
-- Name: contract_types Directors can delete contract types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can delete contract types" ON public.contract_types FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (lower(users.role) = ANY (ARRAY['director'::text, 'admin'::text]))))));


--
-- Name: project_phases Directors can delete phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can delete phases" ON public.project_phases FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: project_managers Directors can delete project manager assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can delete project manager assignments" ON public.project_managers FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.role = 'Director'::text)))));


--
-- Name: projects Directors can delete projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can delete projects" ON public.projects FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.role = 'Director'::text)))));


--
-- Name: subcontractors Directors can delete subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can delete subcontractors" ON public.subcontractors FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.role = 'Director'::text)))));


--
-- Name: project_phases Directors can insert phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can insert phases" ON public.project_phases FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: projects Directors can insert projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.role = 'Director'::text)))));


--
-- Name: project_phases Directors can update phases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can update phases" ON public.project_phases FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Director'::text)))));


--
-- Name: projects Directors can update projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can update projects" ON public.projects FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.role = 'Director'::text)))));


--
-- Name: project_managers Directors can view all project manager assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can view all project manager assignments" ON public.project_managers FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.role = 'Director'::text)))));


--
-- Name: contracts Directors, Supervision and Accounting can create contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors, Supervision and Accounting can create contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text, 'Accounting'::text]))))));


--
-- Name: subcontractors Directors, Supervision and Accounting can create subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors, Supervision and Accounting can create subcontractors" ON public.subcontractors FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text, 'Accounting'::text]))))));


--
-- Name: contracts Directors, Supervision and Accounting can update contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors, Supervision and Accounting can update contracts" ON public.contracts FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text, 'Accounting'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text, 'Accounting'::text]))))));


--
-- Name: subcontractors Directors, Supervision and Accounting can update subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors, Supervision and Accounting can update subcontractors" ON public.subcontractors FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text, 'Accounting'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Supervision'::text, 'Accounting'::text]))))));


--
-- Name: calendar_event_exceptions EventExceptions: creator can delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventExceptions: creator can delete" ON public.calendar_event_exceptions FOR DELETE TO authenticated USING ((public.get_event_creator(event_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_event_exceptions EventExceptions: creator can insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventExceptions: creator can insert" ON public.calendar_event_exceptions FOR INSERT TO authenticated WITH CHECK ((public.get_event_creator(event_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_event_exceptions EventExceptions: creator can update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventExceptions: creator can update" ON public.calendar_event_exceptions FOR UPDATE TO authenticated USING ((public.get_event_creator(event_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))) WITH CHECK ((public.get_event_creator(event_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_event_exceptions EventExceptions: creator or participant can view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventExceptions: creator or participant can view" ON public.calendar_event_exceptions FOR SELECT TO authenticated USING (((public.get_event_creator(event_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR public.is_event_participant(event_id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: calendar_event_participants EventParticipants: creator can delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventParticipants: creator can delete" ON public.calendar_event_participants FOR DELETE TO authenticated USING ((public.get_event_creator(event_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_event_participants EventParticipants: creator can insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventParticipants: creator can insert" ON public.calendar_event_participants FOR INSERT TO authenticated WITH CHECK ((public.get_event_creator(event_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_event_participants EventParticipants: creator or self can view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventParticipants: creator or self can view" ON public.calendar_event_participants FOR SELECT TO authenticated USING (((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR (public.get_event_creator(event_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: calendar_event_participants EventParticipants: self can update rsvp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventParticipants: self can update rsvp" ON public.calendar_event_participants FOR UPDATE TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))) WITH CHECK ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_events Events: creator can delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Events: creator can delete" ON public.calendar_events FOR DELETE TO authenticated USING ((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_events Events: creator can update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Events: creator can update" ON public.calendar_events FOR UPDATE TO authenticated USING ((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))) WITH CHECK ((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_events Events: creator or participant can view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Events: creator or participant can view" ON public.calendar_events FOR SELECT TO authenticated USING (((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR public.is_event_participant(id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: calendar_events Events: owner can insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Events: owner can insert" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK ((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: bank_credits Finance roles can insert bank_credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can insert bank_credits" ON public.bank_credits FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: banks Finance roles can insert banks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can insert banks" ON public.banks FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: credit_allocations Finance roles can insert credit_allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can insert credit_allocations" ON public.credit_allocations FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: funding_payments Finance roles can insert funding_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can insert funding_payments" ON public.funding_payments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: investors Finance roles can insert investors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can insert investors" ON public.investors FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: project_investments Finance roles can insert project_investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can insert project_investments" ON public.project_investments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: bank_credits Finance roles can update bank_credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can update bank_credits" ON public.bank_credits FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: banks Finance roles can update banks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can update banks" ON public.banks FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: credit_allocations Finance roles can update credit_allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can update credit_allocations" ON public.credit_allocations FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: funding_payments Finance roles can update funding_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can update funding_payments" ON public.funding_payments FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: investors Finance roles can update investors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can update investors" ON public.investors FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: project_investments Finance roles can update project_investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Finance roles can update project_investments" ON public.project_investments FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Investment'::text]))))));


--
-- Name: calendar_occurrence_responses OccurrenceResponses: self-delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OccurrenceResponses: self-delete" ON public.calendar_occurrence_responses FOR DELETE TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_occurrence_responses OccurrenceResponses: self-insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OccurrenceResponses: self-insert" ON public.calendar_occurrence_responses FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) AND public.is_event_participant(event_id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: calendar_occurrence_responses OccurrenceResponses: self-select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OccurrenceResponses: self-select" ON public.calendar_occurrence_responses FOR SELECT TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: calendar_occurrence_responses OccurrenceResponses: self-update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OccurrenceResponses: self-update" ON public.calendar_occurrence_responses FOR UPDATE TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))) WITH CHECK ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: accounting_payments Retail can view payments for retail invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Retail can view payments for retail invoices" ON public.accounting_payments FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Retail'::text)))) AND (EXISTS ( SELECT 1
   FROM public.accounting_invoices ai
  WHERE ((ai.id = accounting_payments.invoice_id) AND (ai.invoice_category = 'RETAIL'::text) AND (ai.retail_contract_id IS NOT NULL))))));


--
-- Name: accounting_invoices Retail can view retail invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Retail can view retail invoices" ON public.accounting_invoices FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = 'Retail'::text)))) AND (invoice_category = 'RETAIL'::text) AND (retail_contract_id IS NOT NULL)));


--
-- Name: customers Sales roles can insert customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales roles can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Sales'::text, 'Accounting'::text]))))));


--
-- Name: sales Sales roles can insert sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales roles can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Sales'::text, 'Accounting'::text]))))));


--
-- Name: customers Sales roles can update customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales roles can update customers" ON public.customers FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Sales'::text, 'Accounting'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Sales'::text, 'Accounting'::text]))))));


--
-- Name: sales Sales roles can update sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sales roles can update sales" ON public.sales FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Sales'::text, 'Accounting'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Sales'::text, 'Accounting'::text]))))));


--
-- Name: contracts Site roles can insert contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Site roles can insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Supervision'::text]))))));


--
-- Name: subcontractors Site roles can insert subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Site roles can insert subcontractors" ON public.subcontractors FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Supervision'::text]))))));


--
-- Name: contracts Site roles can update contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Site roles can update contracts" ON public.contracts FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Supervision'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Supervision'::text]))))));


--
-- Name: subcontractors Site roles can update subcontractors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Site roles can update subcontractors" ON public.subcontractors FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Supervision'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.role = ANY (ARRAY['Director'::text, 'Accounting'::text, 'Supervision'::text]))))));


--
-- Name: accounting_invoices Supervision can view invoices for managed projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervision can view invoices for managed projects" ON public.accounting_invoices FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((public.users u
     LEFT JOIN public.project_managers pm ON ((pm.user_id = u.id)))
     LEFT JOIN public.contracts c ON ((c.id = accounting_invoices.contract_id)))
  WHERE ((u.auth_user_id = auth.uid()) AND (u.role = 'Supervision'::text) AND (((c.project_id IS NOT NULL) AND (pm.project_id = c.project_id)) OR ((accounting_invoices.project_id IS NOT NULL) AND (pm.project_id = accounting_invoices.project_id)) OR (NOT (EXISTS ( SELECT 1
           FROM public.project_managers pm2
          WHERE (pm2.project_id = COALESCE(c.project_id, accounting_invoices.project_id))))))))));


--
-- Name: projects Supervision users can view assigned projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervision users can view assigned projects" ON public.projects FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.project_managers pm
     JOIN public.users u ON ((pm.user_id = u.id)))
  WHERE ((pm.project_id = projects.id) AND (u.auth_user_id = auth.uid()) AND (u.role = 'Supervision'::text)))));


--
-- Name: project_phases Supervision users can view phases from assigned projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervision users can view phases from assigned projects" ON public.project_phases FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.project_managers pm
     JOIN public.users u ON ((pm.user_id = u.id)))
  WHERE ((pm.project_id = project_phases.project_id) AND (u.auth_user_id = auth.uid()) AND (u.role = 'Supervision'::text)))));


--
-- Name: projects Supervision users can view project info through project_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervision users can view project info through project_manager" ON public.projects FOR SELECT TO authenticated USING ((id IN ( SELECT pm.project_id
   FROM (public.project_managers pm
     JOIN public.users u ON ((pm.user_id = u.id)))
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: project_managers Supervision users can view their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervision users can view their own assignments" ON public.project_managers FOR SELECT TO authenticated USING ((user_id IN ( SELECT users.id
   FROM public.users
  WHERE (users.auth_user_id = auth.uid()))));


--
-- Name: accounting_invoices System can update invoice status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can update invoice status" ON public.accounting_invoices FOR UPDATE TO postgres USING (true) WITH CHECK (true);


--
-- Name: task_assignees TaskAssignees: creator can delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskAssignees: creator can delete" ON public.task_assignees FOR DELETE TO authenticated USING ((public.get_task_creator(task_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: task_assignees TaskAssignees: creator can insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskAssignees: creator can insert" ON public.task_assignees FOR INSERT TO authenticated WITH CHECK ((public.get_task_creator(task_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: task_assignees TaskAssignees: creator or self can view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskAssignees: creator or self can view" ON public.task_assignees FOR SELECT TO authenticated USING (((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR (public.get_task_creator(task_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: task_assignees TaskAssignees: self can update acknowledgement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskAssignees: self can update acknowledgement" ON public.task_assignees FOR UPDATE TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))) WITH CHECK ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: task_attachments TaskAttachments: assignees and creator can insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskAttachments: assignees and creator can insert" ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (((uploaded_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) AND (public.is_task_assignee(task_id, uploaded_by) OR (public.get_task_creator(task_id) = uploaded_by))));


--
-- Name: task_attachments TaskAttachments: assignees and creator can view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskAttachments: assignees and creator can view" ON public.task_attachments FOR SELECT TO authenticated USING ((public.is_task_assignee(task_id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR (public.get_task_creator(task_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: task_attachments TaskAttachments: uploader or task creator can delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskAttachments: uploader or task creator can delete" ON public.task_attachments FOR DELETE TO authenticated USING (((uploaded_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR (public.get_task_creator(task_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: task_comments TaskComments: assignees and creator can insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskComments: assignees and creator can insert" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) AND (public.is_task_assignee(task_id, user_id) OR (public.get_task_creator(task_id) = user_id))));


--
-- Name: task_comments TaskComments: assignees and creator can view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskComments: assignees and creator can view" ON public.task_comments FOR SELECT TO authenticated USING ((public.is_task_assignee(task_id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR (public.get_task_creator(task_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: task_comments TaskComments: author can delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskComments: author can delete" ON public.task_comments FOR DELETE TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: task_comments TaskComments: author can update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskComments: author can update" ON public.task_comments FOR UPDATE TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))) WITH CHECK ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: task_reminder_sends TaskReminderSends: authenticated can view own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TaskReminderSends: authenticated can view own" ON public.task_reminder_sends FOR SELECT TO authenticated USING ((public.is_task_assignee(task_id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR (public.get_task_creator(task_id) = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: tasks Tasks: creator can delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tasks: creator can delete" ON public.tasks FOR DELETE TO authenticated USING ((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: tasks Tasks: creator or assignee can update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tasks: creator or assignee can update" ON public.tasks FOR UPDATE TO authenticated USING (((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR public.is_task_assignee(id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))))) WITH CHECK (((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR public.is_task_assignee(id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: tasks Tasks: creator or assignee can view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tasks: creator or assignee can view" ON public.tasks FOR SELECT TO authenticated USING (((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR public.is_task_assignee(id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: tasks Tasks: owner can insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tasks: owner can insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK ((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: chat_participants Users can add participants to conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add participants to conversations" ON public.chat_participants FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.chat_conversations
  WHERE ((chat_conversations.id = chat_participants.conversation_id) AND (chat_conversations.created_by = ( SELECT u.id
           FROM public.users u
          WHERE (u.auth_user_id = auth.uid())))))) OR public.is_chat_participant(conversation_id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: tic_cost_structures Users can create TIC cost structures for projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create TIC cost structures for projects" ON public.tic_cost_structures FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: tic_cost_structures Users can delete TIC cost structures for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete TIC cost structures for their projects" ON public.tic_cost_structures FOR DELETE TO authenticated USING (((project_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE (p.id = tic_cost_structures.project_id)))));


--
-- Name: company_bank_accounts Users can delete bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete bank accounts" ON public.company_bank_accounts FOR DELETE TO authenticated USING (true);


--
-- Name: chat_messages Users can delete their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own messages" ON public.chat_messages FOR DELETE TO authenticated USING ((sender_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: company_bank_accounts Users can insert bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert bank accounts" ON public.company_bank_accounts FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: chat_participants Users can remove themselves from conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove themselves from conversations" ON public.chat_participants FOR DELETE TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: chat_messages Users can send messages in their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send messages in their conversations" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) AND public.is_chat_participant(conversation_id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: tic_cost_structures Users can update TIC cost structures for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update TIC cost structures for their projects" ON public.tic_cost_structures FOR UPDATE TO authenticated USING (((project_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE (p.id = tic_cost_structures.project_id))))) WITH CHECK (((project_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE (p.id = tic_cost_structures.project_id)))));


--
-- Name: company_bank_accounts Users can update bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update bank accounts" ON public.company_bank_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: chat_participants Users can update their own participant record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own participant record" ON public.chat_participants FOR UPDATE TO authenticated USING ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))) WITH CHECK ((user_id = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: tic_cost_structures Users can view TIC cost structures for their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view TIC cost structures for their projects" ON public.tic_cost_structures FOR SELECT TO authenticated USING (((project_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE (p.id = tic_cost_structures.project_id)))));


--
-- Name: company_bank_accounts Users can view all bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all bank accounts" ON public.company_bank_accounts FOR SELECT TO authenticated USING (true);


--
-- Name: chat_conversations Users can view conversations they participate in; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view conversations they participate in" ON public.chat_conversations FOR SELECT TO authenticated USING (((created_by = ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))) OR public.is_chat_participant(id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid())))));


--
-- Name: chat_messages Users can view messages in their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in their conversations" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_chat_participant(conversation_id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: chat_participants Users can view participants of their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view participants of their conversations" ON public.chat_participants FOR SELECT TO authenticated USING (public.is_chat_participant(conversation_id, ( SELECT u.id
   FROM public.users u
  WHERE (u.auth_user_id = auth.uid()))));


--
-- Name: accounting_companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_companies ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_invoices_refund; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_invoices_refund ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: apartment_garages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.apartment_garages ENABLE ROW LEVEL SECURITY;

--
-- Name: apartment_repositories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.apartment_repositories ENABLE ROW LEVEL SECURITY;

--
-- Name: apartments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_credits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_credits ENABLE ROW LEVEL SECURITY;

--
-- Name: banks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

--
-- Name: buildings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_event_exceptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_event_exceptions ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_event_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_event_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_occurrence_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_occurrence_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_reminder_sends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_reminder_sends ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: company_bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: company_loans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_loans ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contract_types ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: document_associations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_associations ENABLE ROW LEVEL SECURITY;

--
-- Name: document_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: funding_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funding_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: garages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;

--
-- Name: hidden_approved_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hidden_approved_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: investors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_budgets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

--
-- Name: office_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.office_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: old_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.old_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: project_investments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_investments ENABLE ROW LEVEL SECURITY;

--
-- Name: project_managers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_managers ENABLE ROW LEVEL SECURITY;

--
-- Name: project_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: project_phases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: repositories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

--
-- Name: retail_contract_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retail_contract_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: retail_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retail_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: retail_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retail_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: retail_land_plots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retail_land_plots ENABLE ROW LEVEL SECURITY;

--
-- Name: retail_project_phases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retail_project_phases ENABLE ROW LEVEL SECURITY;

--
-- Name: retail_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retail_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: retail_sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retail_sales ENABLE ROW LEVEL SECURITY;

--
-- Name: retail_supplier_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retail_supplier_types ENABLE ROW LEVEL SECURITY;

--
-- Name: retail_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retail_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: subcontractor_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subcontractor_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: subcontractor_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subcontractor_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: subcontractor_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subcontractor_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: subcontractors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

--
-- Name: task_assignees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

--
-- Name: task_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: task_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: task_reminder_sends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_reminder_sends ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tic_cost_structures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tic_cost_structures ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: work_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


