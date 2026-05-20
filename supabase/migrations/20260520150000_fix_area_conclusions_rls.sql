-- Fix critical security gap: validate area_conclusions inserts/updates
-- Previously, "Insert area_conclusions" had WITH CHECK (true) allowing any
-- authenticated user to mark any area as concluded for any solicitation.

-- Helper function: check if current user has access to area in operation
CREATE OR REPLACE FUNCTION public.has_area_access(p_area_id UUID, p_operation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_group_assignments
    WHERE user_id = public.get_my_profile_id()
      AND area_id = p_area_id
      AND operation_id = p_operation_id
  );
$$;

-- Drop old permissive insert policy
DROP POLICY IF EXISTS "Insert area_conclusions" ON public.area_conclusions;

-- Replace with permission-validating policy
CREATE POLICY "Insert area_conclusions with permission check"
ON public.area_conclusions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_juridico()
  OR EXISTS (
    SELECT 1 FROM public.solicitations s
    WHERE s.id = area_conclusions.solicitation_id
      AND public.has_area_access(area_conclusions.area_id, s.operation_id)
  )
);

-- Also add UPDATE policy (was missing)
DROP POLICY IF EXISTS "Update area_conclusions" ON public.area_conclusions;
CREATE POLICY "Update area_conclusions with permission check"
ON public.area_conclusions
FOR UPDATE
TO authenticated
USING (
  public.is_juridico()
  OR EXISTS (
    SELECT 1 FROM public.solicitations s
    WHERE s.id = area_conclusions.solicitation_id
      AND public.has_area_access(area_conclusions.area_id, s.operation_id)
  )
)
WITH CHECK (
  public.is_juridico()
  OR EXISTS (
    SELECT 1 FROM public.solicitations s
    WHERE s.id = area_conclusions.solicitation_id
      AND public.has_area_access(area_conclusions.area_id, s.operation_id)
  )
);

-- Restrict DELETE to juridico only (atendente should NOT be able to undo conclusion)
DROP POLICY IF EXISTS "Delete area_conclusions" ON public.area_conclusions;
CREATE POLICY "Delete area_conclusions juridico only"
ON public.area_conclusions
FOR DELETE
TO authenticated
USING (public.is_juridico());

-- Tighten documents UPDATE policy: atendente can only update docs in their assigned areas
DROP POLICY IF EXISTS "Update documents" ON public.documents;
CREATE POLICY "Update documents with permission check"
ON public.documents
FOR UPDATE
TO authenticated
USING (
  public.is_juridico()
  OR EXISTS (
    SELECT 1 FROM public.solicitations s
    WHERE s.id = documents.solicitation_id
      AND public.has_area_access(documents.responsible_area_id, s.operation_id)
  )
)
WITH CHECK (
  public.is_juridico()
  OR EXISTS (
    SELECT 1 FROM public.solicitations s
    WHERE s.id = documents.solicitation_id
      AND public.has_area_access(documents.responsible_area_id, s.operation_id)
  )
);

-- Tighten attachments INSERT: validate document_id (if set) belongs to current solicitation
DROP POLICY IF EXISTS "Insert attachments" ON public.attachments;
CREATE POLICY "Insert attachments with validation"
ON public.attachments
FOR INSERT
TO authenticated
WITH CHECK (
  -- If document_id is set, must belong to the same solicitation
  (document_id IS NULL OR EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = attachments.document_id
      AND d.solicitation_id = attachments.solicitation_id
  ))
  AND uploaded_by = public.get_my_profile_id()
);
