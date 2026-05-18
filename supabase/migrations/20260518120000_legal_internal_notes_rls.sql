-- Restrict comments.is_internal visibility to author + jurídico role
DROP POLICY IF EXISTS "Read comments" ON public.comments;
CREATE POLICY "Read comments" ON public.comments FOR SELECT TO authenticated
USING (
  is_internal = false
  OR user_id = public.get_my_profile_id()
  OR public.is_juridico()
);

DROP POLICY IF EXISTS "Insert comments" ON public.comments;
CREATE POLICY "Insert comments" ON public.comments FOR INSERT TO authenticated
WITH CHECK (
  is_internal = false
  OR public.is_juridico()
);
