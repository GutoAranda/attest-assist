
-- 4a: avatar_url
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 12a: priority
ALTER TABLE public.solicitations ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.solicitations DROP CONSTRAINT IF EXISTS solicitations_priority_check;
ALTER TABLE public.solicitations ADD CONSTRAINT solicitations_priority_check CHECK (priority IN ('urgente','normal','baixa'));

-- 19: comments.is_internal
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

-- 15a: ticket_views
CREATE TABLE IF NOT EXISTS public.ticket_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(solicitation_id, user_id)
);
ALTER TABLE public.ticket_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read ticket_views" ON public.ticket_views;
CREATE POLICY "Read ticket_views" ON public.ticket_views FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Insert own ticket_views" ON public.ticket_views;
CREATE POLICY "Insert own ticket_views" ON public.ticket_views FOR INSERT TO authenticated WITH CHECK (user_id = public.get_my_profile_id());
DROP POLICY IF EXISTS "Update own ticket_views" ON public.ticket_views;
CREATE POLICY "Update own ticket_views" ON public.ticket_views FOR UPDATE TO authenticated USING (user_id = public.get_my_profile_id());

-- 18a: tags
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#D6E2E7',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read tags" ON public.tags;
CREATE POLICY "Read tags" ON public.tags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage tags" ON public.tags;
CREATE POLICY "Admins manage tags" ON public.tags FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.solicitation_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(solicitation_id, tag_id)
);
ALTER TABLE public.solicitation_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read solicitation_tags" ON public.solicitation_tags;
CREATE POLICY "Read solicitation_tags" ON public.solicitation_tags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Juridico manage solicitation_tags" ON public.solicitation_tags;
CREATE POLICY "Juridico manage solicitation_tags" ON public.solicitation_tags FOR ALL TO authenticated USING (public.is_juridico()) WITH CHECK (public.is_juridico());
