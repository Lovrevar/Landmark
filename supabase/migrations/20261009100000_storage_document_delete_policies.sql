/*
  # Document files: only the uploader or a finance role may delete them (SEC-A12)

  `20260930100000` limited deleting a `public.documents` row to its uploader, Director and
  Accounting. The file behind the row was left with the bucket-wide policies restored in
  `20260527100000` / `20260527100100`, which check `bucket_id` and nothing else: any signed-in
  user could remove any file in `documents` or `contract-documents` through the Storage API,
  leaving a row that points at nothing.

  The DELETE policies on those two buckets now mirror the table rule:

    - the object's owner (`storage.objects.owner_id`, set by Storage to the uploading user), or
    - a Director or Accounting user.

  Why the owner and not a join to `public.documents`: the app deletes the row first and the file
  second (`deleteDocument` in documentService.ts), so by the time the file is removed there is no
  row left to join to. The owner is the same person the table rule names — on production every
  app upload has `owner_id = documents.uploaded_by` (18 of 18 on 2026-10-09). Files written by
  the service role (email import, filesystem scan) have no owner and no `uploaded_by`; for both
  the row and the file that leaves Director and Accounting, as before.

  Not changed:
    - INSERT and SELECT stay bucket-wide, matching `documents`' own INSERT and SELECT policies.
    - There is no UPDATE policy on either bucket, so a file cannot be overwritten in place; that
      was already the case and stays so.
    - The service role (the `sort-document` function) bypasses RLS.

  Idempotent: each policy is dropped before it is created.
*/

DROP POLICY IF EXISTS "Authenticated users can delete from documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Uploader or finance can delete document files"        ON storage.objects;
CREATE POLICY "Uploader or finance can delete document files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      owner_id = (SELECT auth.uid())::text
      OR public.app_user_role() IN ('Director', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can delete from contract-documents" ON storage.objects;
DROP POLICY IF EXISTS "Uploader or finance can delete contract document files" ON storage.objects;
CREATE POLICY "Uploader or finance can delete contract document files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contract-documents'
    AND (
      owner_id = (SELECT auth.uid())::text
      OR public.app_user_role() IN ('Director', 'Accounting')
    )
  );

-- ---------------------------------------------------------------------------
-- Manual check after applying (read-only): the two DELETE policies and nothing bucket-wide.
--
--   SELECT policyname, cmd, qual FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND qual LIKE '%documents%' AND cmd = 'DELETE';
-- ---------------------------------------------------------------------------
