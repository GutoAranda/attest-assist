
-- Duplicate check functions
CREATE OR REPLACE FUNCTION public.check_duplicate_process(p_number TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS TABLE(ticket_id TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ticket_id FROM solicitations
  WHERE process_number = p_number
  AND (p_exclude_id IS NULL OR id != p_exclude_id)
  AND status != 'rascunho'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.check_duplicate_employee(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS TABLE(ticket_id TEXT, process_number TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ticket_id, process_number FROM solicitations
  WHERE employee_name ILIKE p_name
  AND (p_exclude_id IS NULL OR id != p_exclude_id)
  AND status != 'rascunho'
  LIMIT 5
$$;

-- Ensure storage buckets are public
UPDATE storage.buckets SET public = true WHERE id IN ('solicitations', 'attachments');
