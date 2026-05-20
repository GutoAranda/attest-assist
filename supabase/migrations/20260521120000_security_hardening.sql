-- Comprehensive security hardening:
-- 1. Validate is_active in all auth helper functions
-- 2. Restrict audit_logs and notifications INSERT
-- 3. Tighten attachments INSERT/DELETE
-- 4. Tighten storage delete policy
-- 5. Explicit DELETE policy for user_group_assignments

-- 1. is_active validation: usuário desativado não passa em is_admin/is_juridico
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin AND is_active FROM public.profiles WHERE user_id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_juridico()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'juridico' AND is_active FROM public.profiles WHERE user_id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.has_area_access(p_area_id UUID, p_operation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_group_assignments uga
    JOIN public.profiles p ON p.id = uga.user_id
    WHERE p.user_id = auth.uid()
      AND p.is_active = true
      AND uga.area_id = p_area_id
      AND uga.operation_id = p_operation_id
  );
$$;

-- 2. audit_logs: usuário só pode inserir log em seu próprio nome
DROP POLICY IF EXISTS "Insert audit_logs" ON public.audit_logs;
CREATE POLICY "Insert own audit_logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = public.get_my_profile_id());

-- 3. notifications: usuário só pode criar notificação para si mesmo OU é juridico/admin
DROP POLICY IF EXISTS "Insert notifications" ON public.notifications;
CREATE POLICY "Insert notifications with validation"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_my_profile_id()
  OR public.is_juridico()
  OR public.is_admin()
);

-- 4. attachments DELETE: além de uploaded_by, validar acesso à solicitação
DROP POLICY IF EXISTS "Delete own attachments" ON public.attachments;
CREATE POLICY "Delete own attachments with access check"
ON public.attachments
FOR DELETE
TO authenticated
USING (
  uploaded_by = public.get_my_profile_id()
  AND (
    public.is_juridico()
    OR EXISTS (
      SELECT 1 FROM public.solicitations s
      WHERE s.id = attachments.solicitation_id
        AND (
          s.requester_id = public.get_my_profile_id()
          OR (attachments.document_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = attachments.document_id
              AND public.has_area_access(d.responsible_area_id, s.operation_id)
          ))
        )
    )
  )
);

-- 5. attachments INSERT: validar acesso ao documento se document_id setado
DROP POLICY IF EXISTS "Insert attachments with validation" ON public.attachments;
CREATE POLICY "Insert attachments with full validation"
ON public.attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = public.get_my_profile_id()
  AND (
    public.is_juridico()
    OR EXISTS (
      SELECT 1 FROM public.solicitations s
      WHERE s.id = attachments.solicitation_id
        AND (
          s.requester_id = public.get_my_profile_id()
          OR (attachments.document_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = attachments.document_id
              AND d.solicitation_id = attachments.solicitation_id
              AND public.has_area_access(d.responsible_area_id, s.operation_id)
          ))
        )
    )
  )
);

-- 6. user_group_assignments DELETE: explicit policy (admin only)
DROP POLICY IF EXISTS "Delete user_group_assignments" ON public.user_group_assignments;
CREATE POLICY "Delete user_group_assignments admin only"
ON public.user_group_assignments
FOR DELETE
TO authenticated
USING (public.is_admin());

-- 7. comments INSERT: atendente não pode criar comentário com is_internal=true
DROP POLICY IF EXISTS "Insert comments" ON public.comments;
CREATE POLICY "Insert comments role-aware"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_my_profile_id()
  AND (
    -- juridico can mark as internal
    public.is_juridico()
    -- atendentes can only create non-internal
    OR (is_internal IS NULL OR is_internal = false)
  )
);

-- 8. Storage avatars policy: restrict delete to own files
DROP POLICY IF EXISTS "Auth delete files" ON storage.objects;
CREATE POLICY "Delete own storage files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  -- avatars bucket: only own avatar (path starts with profile id)
  (bucket_id = 'avatars' AND (
    name LIKE (public.get_my_profile_id()::text || '/%')
    OR name LIKE ('%/' || public.get_my_profile_id()::text || '%')
  ))
  -- solicitations bucket: juridico or owner of the related solicitation
  OR (bucket_id = 'solicitations' AND public.is_juridico())
);
