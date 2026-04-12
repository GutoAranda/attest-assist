
ALTER TABLE public.solicitations ADD COLUMN IF NOT EXISTS employee_registration TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.profiles (user_id, name, email, role, is_admin, is_active) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'atendente'), COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false), true) ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email; RETURN NEW; END; $$;

INSERT INTO storage.buckets (id, name, public) VALUES ('solicitations', 'solicitations', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth upload solicitations' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Auth upload solicitations" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'solicitations');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth read solicitations' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Auth read solicitations" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'solicitations');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth delete solicitations' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Auth delete solicitations" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'solicitations');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth upload attachments' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Auth upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth read attachments' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Auth read attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth delete attachments' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Auth delete attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments');
  END IF;
END $$;
