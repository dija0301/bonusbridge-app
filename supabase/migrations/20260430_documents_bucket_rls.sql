-- RLS for the `documents` storage bucket where signed PDFs live.
--
-- File path convention (set by docusign-webhook):
--   documents/{issuer_id}/{agreement_id}/signed-agreement.pdf
--
-- Access matrix:
--   - admin role           → all documents
--   - issuer_admin / issuer_user → only their own org's folder ({issuer_id}/...)
--   - recipient            → only their own agreements' files
--
-- After applying this migration, you must also flip the `documents` bucket from
-- "public" to "private" in the Supabase dashboard (Storage → documents bucket →
-- Settings → Public toggle OFF). Otherwise these policies don't gate anything.

-- Admin: full access (consistent with the admin overrides we added on other tables)
CREATE POLICY "documents_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth_role() = 'admin'::user_role
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND auth_role() = 'admin'::user_role
  );

-- Issuer admin/user: read documents in their own org's folder
-- folder structure is {issuer_id}/{agreement_id}/file.pdf, so foldername[1] is the issuer_id.
CREATE POLICY "documents_issuer_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND current_user_role() = ANY (ARRAY['issuer_admin'::user_role, 'issuer_user'::user_role])
    AND (storage.foldername(name))[1] = current_user_issuer_id()::text
  );

-- Recipient: read only documents tied to agreements they own
-- foldername[2] is the agreement_id.
CREATE POLICY "documents_recipient_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth_role() = 'recipient'::user_role
    AND (storage.foldername(name))[2] IN (
      SELECT a.id::text
      FROM agreements a
      JOIN recipients r ON r.id = a.recipient_id
      WHERE r.user_id = auth.uid()
    )
  );

-- Service role (used by the docusign-webhook edge function to upload) bypasses
-- RLS automatically — no policy needed for inserts from there.
