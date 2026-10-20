/*
  # Cancelling a sale (SALES-10)

  A sale could be recorded and never undone. The only way back was the status select in the Edit
  Apartment window, which set the apartment to Available and left everything else as it was: the
  `sales` row, the buyer's name on the apartment, the linked garage and storage unit still Sold,
  the customer still a "buyer". Every dashboard and report counts `sales` rows, so the sale went
  on counting.

  1. One sale per apartment
     A unique index on `sales.apartment_id`. Nothing prevented two rows for the same apartment,
     and every reader takes "the" sale of an apartment. No database had such a pair on 2026-10-12.

  2. public.cancel_apartment_sale(p_apartment_id)
     The reverse of complete_apartment_sale(), in one transaction:
       - only Director and Accounting (42501 otherwise);
       - refused while invoices to the buyer exist for the apartment (P0001): they and their
         payments would stay behind as revenue for a unit that is for sale again — void or move
         them in Cashflow first;
       - deletes the `sales` row;
       - sets the apartment and its linked garages and storage units to Available and clears
         `buyer_name` (the links themselves are kept);
       - if the customer has no other sale, sets them back to 'interested'. What they were before
         the sale is not recorded anywhere, and 'buyer' would no longer be true.
     Returns what was cancelled, for the activity log, which is where the record of the sale
     survives (action `sale.cancel`).

     SECURITY DEFINER, unlike complete_apartment_sale(): the DELETE policy on `sales` is Director
     only and Accounting has to be able to cancel, so the function checks the role itself.
*/

CREATE UNIQUE INDEX IF NOT EXISTS sales_one_per_apartment ON public.sales (apartment_id);

CREATE OR REPLACE FUNCTION public.cancel_apartment_sale(p_apartment_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_sale      public.sales%ROWTYPE;
  v_buyer     text;
  v_invoices  integer;
  v_reverted  boolean := false;
BEGIN
  IF public.app_user_role() IS NULL OR public.app_user_role() NOT IN ('Director', 'Accounting') THEN
    RAISE EXCEPTION 'only Director and Accounting may cancel a sale' USING ERRCODE = '42501';
  END IF;

  SELECT buyer_name INTO v_buyer FROM public.apartments WHERE id = p_apartment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'apartment % not found', p_apartment_id USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE apartment_id = p_apartment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'apartment % has no sale to cancel', p_apartment_id USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO v_invoices
  FROM public.accounting_invoices
  WHERE apartment_id = p_apartment_id AND invoice_type = 'OUTGOING_SALES';
  IF v_invoices > 0 THEN
    RAISE EXCEPTION 'apartment % has % sales invoice(s); a sale with invoices cannot be cancelled',
      p_apartment_id, v_invoices USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.sales WHERE id = v_sale.id;

  UPDATE public.apartments SET status = 'Available', buyer_name = NULL WHERE id = p_apartment_id;

  UPDATE public.garages SET status = 'Available', buyer_name = NULL
  WHERE id IN (SELECT garage_id FROM public.apartment_garages WHERE apartment_id = p_apartment_id);

  UPDATE public.repositories SET status = 'Available', buyer_name = NULL
  WHERE id IN (SELECT repository_id FROM public.apartment_repositories WHERE apartment_id = p_apartment_id);

  IF NOT EXISTS (SELECT 1 FROM public.sales WHERE customer_id = v_sale.customer_id) THEN
    UPDATE public.customers SET status = 'interested'
    WHERE id = v_sale.customer_id AND status = 'buyer';
    v_reverted := FOUND;
  END IF;

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'apartment_id', p_apartment_id,
    'customer_id', v_sale.customer_id,
    'sale_price', v_sale.sale_price,
    'sale_date', v_sale.sale_date,
    'buyer_name', v_buyer,
    'customer_status_reverted', v_reverted
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_apartment_sale(uuid) IS
  'Undoes complete_apartment_sale(): deletes the sale, returns the apartment and its linked units '
  'to Available, and sets a customer with no other sale back to interested. Director and '
  'Accounting only; refused while OUTGOING_SALES invoices exist for the apartment.';

REVOKE ALL ON FUNCTION public.cancel_apartment_sale(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_apartment_sale(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Manual check after applying (read-only):
--
--   SELECT indexdef FROM pg_indexes WHERE indexname = 'sales_one_per_apartment';
--   SELECT prosecdef, proconfig FROM pg_proc WHERE proname = 'cancel_apartment_sale';
--   -- expect prosecdef = true and search_path=public, pg_temp
-- ---------------------------------------------------------------------------
