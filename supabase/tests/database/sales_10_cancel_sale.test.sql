-- SALES-10: cancel_apartment_sale undoes complete_apartment_sale — Director and Accounting only,
-- refused while sales invoices exist (20261012100100_cancel_apartment_sale.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Fixtures, as the database owner.
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000010a1', 'sales@test.local', '{"provider":"email","role":"Sales"}'),
  ('00000000-0000-0000-0000-0000000010a2', 'acc@test.local',   '{"provider":"email","role":"Accounting"}');

insert into public.projects (id, name, location, start_date)
  values ('00000000-0000-0000-0000-0000000010b1', 'Prodaja', 'Zagreb', '2026-01-01');
insert into public.buildings (id, project_id, name)
  values ('00000000-0000-0000-0000-0000000010b2', '00000000-0000-0000-0000-0000000010b1', 'Zgrada A');

-- Apartments 1 and 3 are sold to customer 1; apartment 2 to customer 2, and it has an invoice.
insert into public.apartments (id, project_id, building_id, number, floor, size_m2, price, status, buyer_name) values
  ('00000000-0000-0000-0000-0000000010c1', '00000000-0000-0000-0000-0000000010b1', '00000000-0000-0000-0000-0000000010b2', 'A-1', 1, 50, 100000, 'Sold', 'Ivo Kupac'),
  ('00000000-0000-0000-0000-0000000010c2', '00000000-0000-0000-0000-0000000010b1', '00000000-0000-0000-0000-0000000010b2', 'A-2', 1, 50, 100000, 'Sold', 'Ana Kupac'),
  ('00000000-0000-0000-0000-0000000010c3', '00000000-0000-0000-0000-0000000010b1', '00000000-0000-0000-0000-0000000010b2', 'A-3', 2, 50, 100000, 'Sold', 'Ivo Kupac');
insert into public.garages (id, building_id, number, status, buyer_name)
  values ('00000000-0000-0000-0000-0000000010d1', '00000000-0000-0000-0000-0000000010b2', 'G-1', 'Sold', 'Ivo Kupac');
insert into public.repositories (id, building_id, number, status, buyer_name)
  values ('00000000-0000-0000-0000-0000000010d2', '00000000-0000-0000-0000-0000000010b2', 'S-1', 'Sold', 'Ivo Kupac');
insert into public.apartment_garages (apartment_id, garage_id)
  values ('00000000-0000-0000-0000-0000000010c1', '00000000-0000-0000-0000-0000000010d1');
insert into public.apartment_repositories (apartment_id, repository_id)
  values ('00000000-0000-0000-0000-0000000010c1', '00000000-0000-0000-0000-0000000010d2');

insert into public.customers (id, name, surname, status) values
  ('00000000-0000-0000-0000-0000000010e1', 'Ivo', 'Kupac', 'buyer'),
  ('00000000-0000-0000-0000-0000000010e2', 'Ana', 'Kupac', 'buyer');
insert into public.sales (apartment_id, customer_id, sale_price) values
  ('00000000-0000-0000-0000-0000000010c1', '00000000-0000-0000-0000-0000000010e1', 100000),
  ('00000000-0000-0000-0000-0000000010c2', '00000000-0000-0000-0000-0000000010e2', 100000),
  ('00000000-0000-0000-0000-0000000010c3', '00000000-0000-0000-0000-0000000010e1', 100000);

insert into public.accounting_companies (id, name, oib)
  values ('00000000-0000-0000-0000-0000000010f1', 'Investitor d.o.o.', '00000000001');
insert into public.accounting_invoices
  (company_id, invoice_type, invoice_category, category, invoice_number, due_date, customer_id, apartment_id)
values
  ('00000000-0000-0000-0000-0000000010f1', 'OUTGOING_SALES', 'APARTMENT', 'apartment', 'R-1/2026', '2026-12-31',
   '00000000-0000-0000-0000-0000000010e2', '00000000-0000-0000-0000-0000000010c2');

-- As Sales: refused.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010a1","role":"authenticated"}';
select throws_ok(
  $$ select public.cancel_apartment_sale('00000000-0000-0000-0000-0000000010c1') $$,
  '42501', null,
  'SALES-10: Sales cannot cancel a sale'
);

-- As Accounting.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010a2","role":"authenticated"}';
select throws_ok(
  $$ select public.cancel_apartment_sale('00000000-0000-0000-0000-0000000010c2') $$,
  'P0001', null,
  'SALES-10: a sale with a sales invoice cannot be cancelled'
);
select is(
  public.cancel_apartment_sale('00000000-0000-0000-0000-0000000010c1')->>'customer_status_reverted',
  'false',
  'SALES-10: Accounting cancels a sale; the customer still has another one, so stays a buyer'
);

reset role;
select is(
  (select count(*) from public.sales where apartment_id = '00000000-0000-0000-0000-0000000010c1'),
  0::bigint,
  'SALES-10: the cancelled sale is gone, so no report counts it'
);
select results_eq(
  $$ select status, buyer_name from public.apartments where id = '00000000-0000-0000-0000-0000000010c1'
     union all
     select status, buyer_name from public.garages where id = '00000000-0000-0000-0000-0000000010d1'
     union all
     select status, buyer_name from public.repositories where id = '00000000-0000-0000-0000-0000000010d2' $$,
  $$ values ('Available', null::text), ('Available', null::text), ('Available', null::text) $$,
  'SALES-10: the apartment and its linked garage and storage unit are for sale again, with no buyer'
);
select is(
  (select count(*) from public.apartment_garages where apartment_id = '00000000-0000-0000-0000-0000000010c1')
  + (select count(*) from public.apartment_repositories where apartment_id = '00000000-0000-0000-0000-0000000010c1'),
  2::bigint,
  'SALES-10: the garage and storage unit stay linked to the apartment'
);
select is(
  (select status from public.customers where id = '00000000-0000-0000-0000-0000000010e1'),
  'buyer',
  'SALES-10: a customer with another sale is still a buyer'
);
select results_eq(
  $$ select a.status, (select count(*) from public.sales s where s.apartment_id = a.id)
     from public.apartments a where a.id = '00000000-0000-0000-0000-0000000010c2' $$,
  $$ values ('Sold', 1::bigint) $$,
  'SALES-10: the refused cancel changed nothing'
);

-- Cancelling the customer's last sale makes them interested again.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010a2","role":"authenticated"}';
select is(
  public.cancel_apartment_sale('00000000-0000-0000-0000-0000000010c3')->>'customer_status_reverted',
  'true',
  'SALES-10: cancelling the last sale reports the customer as reverted'
);
reset role;
select is(
  (select status from public.customers where id = '00000000-0000-0000-0000-0000000010e1'),
  'interested',
  'SALES-10: a customer with no sale left is interested again'
);

-- One sale per apartment.
select throws_ok(
  $$ insert into public.sales (apartment_id, customer_id)
     values ('00000000-0000-0000-0000-0000000010c2', '00000000-0000-0000-0000-0000000010e1') $$,
  '23505', null,
  'SALES-10: an apartment cannot be sold twice'
);

-- The function itself.
select is(
  (select array[prosecdef::text] || proconfig from pg_proc where oid = 'public.cancel_apartment_sale(uuid)'::regprocedure),
  array['true', 'search_path=public, pg_temp'],
  'cancel_apartment_sale runs as its owner, with a pinned search path'
);
select ok(
  not has_function_privilege('anon', 'public.cancel_apartment_sale(uuid)', 'execute'),
  'anon cannot call cancel_apartment_sale'
);

select * from finish();
rollback;
