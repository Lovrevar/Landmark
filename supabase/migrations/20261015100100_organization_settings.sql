/*
  # The organisation's name, per database (GEN-19)

  Reports printed "LANDMARK GROUP" from the locale files, so the demo and every other instance
  carried the customer's name. The name belongs to the data, not to the build: each database —
  production, LandmarkDemo, dev — holds its own, and one frontend build serves them all.

  One row, enforced by a boolean primary key that can only be true. Every signed-in user can read
  it: a Sales user's Sales report prints it too, which is why the name is not taken from
  `accounting_companies` (Director and Accounting only). Nobody writes it from the app; it is set
  once per database:

    UPDATE public.organization_settings SET name = 'Landmark Group';

  NULL means no name is configured, and the reports print only their titles.
*/

CREATE TABLE IF NOT EXISTS public.organization_settings (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  name       text CHECK (name IS NULL OR btrim(name) <> ''),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_settings IS
  'Settings of the organisation this database belongs to. Exactly one row. Read by every '
  'signed-in user, written only with SQL (no client policy).';
COMMENT ON COLUMN public.organization_settings.name IS
  'Printed on report covers, headers and footers. NULL: reports print only their titles.';

INSERT INTO public.organization_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users can read organization settings" ON public.organization_settings;
CREATE POLICY "Signed-in users can read organization settings" ON public.organization_settings
  FOR SELECT TO authenticated
  USING (true);

-- No write policy, so RLS refuses every client write; the grants say the same thing outright.
REVOKE ALL ON public.organization_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.organization_settings FROM authenticated;
GRANT SELECT ON public.organization_settings TO authenticated;
