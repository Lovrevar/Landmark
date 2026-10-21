/*
  # Sales: consistent price per m², and one transaction per sale

  DEFECT_BACKLOG SALES-2, SALES-3 and SALES-5.

  1. price_per_m2 follows price and size_m2
     Units created on the Apartments page, by the garage import and by the apartment import's
     parking/storage columns were stored with price_per_m2 = 0, and editing a price never
     touched it. The bulk price update then recomputed prices from a per-m² value of 0 and wiped
     them. A BEFORE INSERT/UPDATE trigger on apartments, garages and repositories now derives
     price_per_m2 = round(price / size_m2, 2) whenever price or size changes (price is the
     authority; the bulk update writes a price computed from the new per-m² value, so it
     round-trips). Existing rows with a missing or zero value are backfilled.

  2. complete_apartment_sale()
     The sale flow was five separate client calls (customer insert, sale insert, apartment
     update, linked-unit updates, customer status), so a failure midway left an orphan buyer or a
     sale with the apartment still Available. The RPC does all of it in one transaction and runs
     as the caller (SECURITY INVOKER), so RLS decides who may sell. Only apartments are sold;
     garages and storage units are part of the apartment's package (SALES-1).

  sales.total_paid and sales.remaining_amount keep their meaning as a snapshot at the time of the
  sale (down payment, price minus down payment). Paid-to-date always comes from
  accounting_payments.
*/

-- ---------------------------------------------------------------------------
-- 1. price_per_m2
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_unit_price_per_m2() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.size_m2 IS DISTINCT FROM OLD.size_m2
     OR COALESCE(NEW.price_per_m2, 0) = 0 THEN
    IF COALESCE(NEW.size_m2, 0) > 0 THEN
      NEW.price_per_m2 := round(COALESCE(NEW.price, 0) / NEW.size_m2, 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_price_per_m2 ON public.apartments;
CREATE TRIGGER trg_sync_price_per_m2
  BEFORE INSERT OR UPDATE OF price, size_m2, price_per_m2 ON public.apartments
  FOR EACH ROW EXECUTE FUNCTION public.sync_unit_price_per_m2();

DROP TRIGGER IF EXISTS trg_sync_price_per_m2 ON public.garages;
CREATE TRIGGER trg_sync_price_per_m2
  BEFORE INSERT OR UPDATE OF price, size_m2, price_per_m2 ON public.garages
  FOR EACH ROW EXECUTE FUNCTION public.sync_unit_price_per_m2();

DROP TRIGGER IF EXISTS trg_sync_price_per_m2 ON public.repositories;
CREATE TRIGGER trg_sync_price_per_m2
  BEFORE INSERT OR UPDATE OF price, size_m2, price_per_m2 ON public.repositories
  FOR EACH ROW EXECUTE FUNCTION public.sync_unit_price_per_m2();

-- Backfill rows the old code stored without a per-m² value (the trigger computes it).
UPDATE public.apartments   SET price_per_m2 = 0 WHERE COALESCE(price_per_m2, 0) = 0 AND size_m2 > 0 AND price > 0;
UPDATE public.garages      SET price_per_m2 = 0 WHERE COALESCE(price_per_m2, 0) = 0 AND size_m2 > 0 AND price > 0;
UPDATE public.repositories SET price_per_m2 = 0 WHERE COALESCE(price_per_m2, 0) = 0 AND size_m2 > 0 AND price > 0;

-- ---------------------------------------------------------------------------
-- 2. complete_apartment_sale()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_apartment_sale(
  p_apartment_id    uuid,
  p_customer_id     uuid,
  p_new_customer    jsonb,
  p_buyer_name      text,
  p_sale_price      numeric,
  p_payment_method  text,
  p_down_payment    numeric,
  p_monthly_payment numeric,
  p_sale_date       date,
  p_contract_signed boolean,
  p_notes           text
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_status   text;
  v_customer uuid := p_customer_id;
  v_created  boolean := false;
  v_sale     uuid;
  v_rows     integer;
BEGIN
  SELECT status INTO v_status FROM public.apartments WHERE id = p_apartment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'apartment % not found', p_apartment_id USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'Sold' THEN
    RAISE EXCEPTION 'apartment % is already sold', p_apartment_id USING ERRCODE = 'P0001';
  END IF;

  IF v_customer IS NULL THEN
    IF p_new_customer IS NULL OR btrim(COALESCE(p_new_customer->>'name', '')) = '' THEN
      RAISE EXCEPTION 'a customer id or a new customer name is required' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.customers (name, surname, email, phone, address, status)
    VALUES (
      btrim(p_new_customer->>'name'),
      btrim(COALESCE(NULLIF(btrim(p_new_customer->>'surname'), ''), p_new_customer->>'name')),
      NULLIF(btrim(p_new_customer->>'email'), ''),
      NULLIF(btrim(p_new_customer->>'phone'), ''),
      COALESCE(p_new_customer->>'address', ''),
      'buyer'
    )
    RETURNING id INTO v_customer;
    v_created := true;
  ELSE
    UPDATE public.customers SET status = 'buyer' WHERE id = v_customer AND status <> 'buyer';
  END IF;

  INSERT INTO public.sales (
    apartment_id, customer_id, sale_price, payment_method, down_payment,
    total_paid, remaining_amount, monthly_payment, sale_date, contract_signed, notes
  ) VALUES (
    p_apartment_id, v_customer, p_sale_price, p_payment_method, COALESCE(p_down_payment, 0),
    COALESCE(p_down_payment, 0), p_sale_price - COALESCE(p_down_payment, 0),
    COALESCE(p_monthly_payment, 0), COALESCE(p_sale_date, CURRENT_DATE),
    COALESCE(p_contract_signed, false), p_notes
  )
  RETURNING id INTO v_sale;

  UPDATE public.apartments SET status = 'Sold', buyer_name = p_buyer_name WHERE id = p_apartment_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- RLS filtered the update: the caller may not sell. Abort the whole sale.
    RAISE EXCEPTION 'not allowed to update apartment %', p_apartment_id USING ERRCODE = '42501';
  END IF;

  UPDATE public.garages SET status = 'Sold', buyer_name = p_buyer_name
  WHERE id IN (SELECT garage_id FROM public.apartment_garages WHERE apartment_id = p_apartment_id);

  UPDATE public.repositories SET status = 'Sold', buyer_name = p_buyer_name
  WHERE id IN (SELECT repository_id FROM public.apartment_repositories WHERE apartment_id = p_apartment_id);

  RETURN jsonb_build_object('sale_id', v_sale, 'customer_id', v_customer, 'customer_created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_apartment_sale(uuid, uuid, jsonb, text, numeric, text, numeric, numeric, date, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_apartment_sale(uuid, uuid, jsonb, text, numeric, text, numeric, numeric, date, boolean, text) TO authenticated;
