ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS deleted_by UUID;

CREATE OR REPLACE FUNCTION public.generate_operation_ticket_id(op_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  current_year text;
  next_seq int;
  op_name text;
  sigla text;
BEGIN
  current_year := extract(year from now())::text;

  SELECT name INTO op_name FROM public.operations WHERE id = op_id;
  IF op_name IS NULL THEN
    op_name := 'SOL';
  END IF;

  -- Extract sigla: text before " - " (or full first word if no " - ")
  IF position(' - ' in op_name) > 0 THEN
    sigla := upper(trim(split_part(op_name, ' - ', 1)));
  ELSE
    sigla := upper(trim(split_part(op_name, ' ', 1)));
  END IF;

  -- Sanitize: keep only A-Z and 0-9
  sigla := regexp_replace(sigla, '[^A-Z0-9]', '', 'g');
  IF sigla = '' THEN
    sigla := 'SOL';
  END IF;

  -- Global sequential per year (across all operations and old #SOL- tickets)
  SELECT COALESCE(MAX(
    CASE
      WHEN ticket_id ~ ('^#?[A-Z0-9]+-' || current_year || '-[0-9]+$')
      THEN substring(ticket_id from '-([0-9]+)$')::int
      ELSE 0
    END
  ), 0) + 1 INTO next_seq
  FROM public.solicitations;

  RETURN sigla || '-' || current_year || '-' || lpad(next_seq::text, 6, '0');
END;
$$;