
-- Drop old conflicting policies on solicitations
DROP POLICY IF EXISTS "Juridico can read all solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "Atendentes can read relevant solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "Users can read solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "Juridico can update solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "Atendentes can update relevant solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "Users can update solicitations" ON public.solicitations;

-- Drop old conflicting policies on documents
DROP POLICY IF EXISTS "Juridico can read all documents" ON public.documents;
DROP POLICY IF EXISTS "Atendentes can read relevant documents" ON public.documents;
DROP POLICY IF EXISTS "Users can read documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone involved can update documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents" ON public.documents;

-- Create security definer functions
CREATE OR REPLACE FUNCTION public.can_access_solicitation(sol_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'juridico'
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.user_group_assignments uga ON uga.area_id = d.responsible_area_id
    JOIN public.solicitations s ON s.id = d.solicitation_id AND uga.operation_id = s.operation_id
    JOIN public.profiles p ON p.id = uga.user_id AND p.user_id = auth.uid()
    WHERE d.solicitation_id = sol_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_document(doc_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'juridico'
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.solicitations s ON s.id = d.solicitation_id
    JOIN public.user_group_assignments uga ON uga.area_id = d.responsible_area_id AND uga.operation_id = s.operation_id
    JOIN public.profiles p ON p.id = uga.user_id AND p.user_id = auth.uid()
    WHERE d.id = doc_id
  )
$$;

-- Create new policies
CREATE POLICY "Users can read solicitations" ON public.solicitations FOR SELECT TO authenticated USING (public.can_access_solicitation(id));
CREATE POLICY "Users can update solicitations" ON public.solicitations FOR UPDATE TO authenticated USING (public.can_access_solicitation(id));
CREATE POLICY "Users can read documents" ON public.documents FOR SELECT TO authenticated USING (public.can_access_document(id));
CREATE POLICY "Users can update documents" ON public.documents FOR UPDATE TO authenticated USING (public.can_access_document(id));

-- Storage policies for the solicitations bucket
CREATE POLICY "Authenticated users can upload to solicitations"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'solicitations');

CREATE POLICY "Authenticated users can read from solicitations"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'solicitations');

-- Add unique constraint for area_conclusions upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'area_conclusions_solicitation_area_unique'
  ) THEN
    ALTER TABLE public.area_conclusions ADD CONSTRAINT area_conclusions_solicitation_area_unique UNIQUE (solicitation_id, area_id);
  END IF;
END $$;
