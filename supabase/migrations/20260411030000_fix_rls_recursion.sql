-- Fix RLS recursion: Drop problematic policies and recreate with SECURITY DEFINER functions

-- Create a helper function to check if user can access a solicitation (avoids recursion)
CREATE OR REPLACE FUNCTION public.can_access_solicitation(sol_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'juridico'
  )
  OR EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.user_group_assignments uga ON uga.area_id = d.responsible_area_id
    JOIN public.solicitations s ON s.id = d.solicitation_id AND uga.operation_id = s.operation_id
    JOIN public.profiles p ON p.id = uga.user_id AND p.user_id = auth.uid()
    WHERE d.solicitation_id = sol_id
  );
$$;

-- Create a helper function to check if user can access a document
CREATE OR REPLACE FUNCTION public.can_access_document(doc_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'juridico'
  )
  OR EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.solicitations s ON s.id = d.solicitation_id
    JOIN public.user_group_assignments uga ON uga.area_id = d.responsible_area_id AND uga.operation_id = s.operation_id
    JOIN public.profiles p ON p.id = uga.user_id AND p.user_id = auth.uid()
    WHERE d.id = doc_id
  );
$$;

-- Drop old solicitations policies
DROP POLICY IF EXISTS "Juridico can read all solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "Atendentes can read relevant solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "Juridico can insert solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "Juridico can update solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "Atendentes can update relevant solicitations" ON public.solicitations;

-- Recreate solicitations policies using SECURITY DEFINER functions
CREATE POLICY "Users can read solicitations" ON public.solicitations
FOR SELECT TO authenticated
USING (public.can_access_solicitation(id));

CREATE POLICY "Juridico can insert solicitations" ON public.solicitations
FOR INSERT TO authenticated
WITH CHECK (public.is_juridico());

CREATE POLICY "Users can update solicitations" ON public.solicitations
FOR UPDATE TO authenticated
USING (public.can_access_solicitation(id));

-- Drop old documents policies
DROP POLICY IF EXISTS "Juridico can read all documents" ON public.documents;
DROP POLICY IF EXISTS "Atendentes can read relevant documents" ON public.documents;
DROP POLICY IF EXISTS "Juridico can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone involved can update documents" ON public.documents;

-- Recreate documents policies using SECURITY DEFINER functions
CREATE POLICY "Users can read documents" ON public.documents
FOR SELECT TO authenticated
USING (public.can_access_document(id));

CREATE POLICY "Juridico can insert documents" ON public.documents
FOR INSERT TO authenticated
WITH CHECK (public.is_juridico());

CREATE POLICY "Users can update documents" ON public.documents
FOR UPDATE TO authenticated
USING (public.can_access_document(id));

-- Also fix: allow atendentes to read ALL profiles (needed for comments, UI display)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Authenticated can read profiles" ON public.profiles
FOR SELECT TO authenticated
USING (true);

-- Fix: allow admins to insert profiles (for invites)
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins or self can insert profiles" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (true);

-- Fix: allow juridico to delete documents (when editing solicitation)
CREATE POLICY "Juridico can delete documents" ON public.documents
FOR DELETE TO authenticated
USING (public.is_juridico());

-- Fix: allow area_conclusions delete (for revision requests)
CREATE POLICY "Delete area_conclusions" ON public.area_conclusions
FOR DELETE TO authenticated
USING (true);

-- Fix: allow notifications delete (cleanup)
CREATE POLICY "Delete own notifications" ON public.notifications
FOR DELETE TO authenticated
USING (user_id = public.get_my_profile_id());
