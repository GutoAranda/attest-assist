
-- Trigger to auto-create profile on auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role, is_admin, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'atendente'),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false),
    true
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to generate sequential ticket IDs
CREATE OR REPLACE FUNCTION public.generate_ticket_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_year text;
  next_seq int;
BEGIN
  current_year := extract(year from now())::text;
  SELECT COALESCE(MAX(
    CASE WHEN ticket_id LIKE '#SOL-' || current_year || '-%'
    THEN substring(ticket_id from '#SOL-' || current_year || '-(.+)')::int
    ELSE 0 END
  ), 0) + 1 INTO next_seq
  FROM solicitations;
  RETURN '#SOL-' || current_year || '-' || lpad(next_seq::text, 6, '0');
END;
$$;

-- Add unique constraint for area_conclusions upsert
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'area_conclusions_solicitation_area_unique') THEN
    ALTER TABLE public.area_conclusions ADD CONSTRAINT area_conclusions_solicitation_area_unique UNIQUE (solicitation_id, area_id);
  END IF;
END $$;

-- Allow requester to delete own drafts
CREATE POLICY "Requester can delete own drafts"
ON public.solicitations
FOR DELETE
TO authenticated
USING (requester_id = get_my_profile_id() AND status = 'rascunho');

-- Allow admins to manage profiles (update any)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_admin());
