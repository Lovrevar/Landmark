-- Sales feedback: an interested customer needs to record which project they are
-- interested in, and neither email nor phone should be mandatory any more.

-- ON DELETE SET NULL because deleteProject() hard-deletes rows; without it,
-- deleting a project a customer is linked to would start failing on the FK.
ALTER TABLE public.customers
  ADD COLUMN interested_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX customers_interested_project_id_idx
  ON public.customers (interested_project_id);

COMMENT ON COLUMN public.customers.interested_project_id IS
  'Project this customer is interested in. Buyers derive their project through sales -> apartments instead.';

-- customers.email is UNIQUE (customers_email_key). Postgres allows many NULLs
-- under a unique constraint but only one empty string, so existing '' rows are
-- normalised to NULL *before* the column becomes nullable. The application layer
-- normalises '' -> NULL on write for the same reason.
UPDATE public.customers SET email = NULL WHERE email = '';

ALTER TABLE public.customers ALTER COLUMN email DROP NOT NULL;
