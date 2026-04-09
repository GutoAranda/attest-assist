-- Create operations table
CREATE TABLE public.operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create areas table
CREATE TABLE public.areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('juridico', 'atendente')),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_group_assignments table
CREATE TABLE public.user_group_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  UNIQUE(user_id, area_id, operation_id)
);

-- Create solicitations table
CREATE TABLE public.solicitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id TEXT UNIQUE,
  operation_id UUID NOT NULL REFERENCES public.operations(id),
  process_number TEXT,
  employee_name TEXT,
  requester_id UUID NOT NULL REFERENCES public.profiles(id),
  observations TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aberto','em_atendimento','parcialmente_concluido','concluido','cancelado')),
  cancel_reason TEXT,
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluded_at TIMESTAMPTZ
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  responsible_area_id UUID NOT NULL REFERENCES public.areas(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','em_busca','inexistente','revisao_solicitada')),
  observations TEXT,
  revision_reason TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create area_conclusions table
CREATE TABLE public.area_conclusions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.areas(id),
  concluded_by UUID NOT NULL REFERENCES public.profiles(id),
  concluded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(solicitation_id, area_id)
);

-- Create attachments table
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create comments table
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('nova_solicitacao','conclusao','revisao','cancelamento','comentario','sla_7dias','sla_3dias','sla_1dia','sla_hoje','sla_vencido')),
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  solicitation_id UUID REFERENCES public.solicitations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_conclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's profile id
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    false
  )
$$;

-- Helper function to check if current user is juridico
CREATE OR REPLACE FUNCTION public.is_juridico()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'juridico' FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    false
  )
$$;

-- operations: everyone reads, admins write
CREATE POLICY "Everyone can read operations" ON public.operations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert operations" ON public.operations FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update operations" ON public.operations FOR UPDATE TO authenticated USING (public.is_admin());

-- areas: everyone reads, admins write
CREATE POLICY "Everyone can read areas" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert areas" ON public.areas FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update areas" ON public.areas FOR UPDATE TO authenticated USING (public.is_admin());

-- profiles: users read own, juridico reads all
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_juridico());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- user_group_assignments
CREATE POLICY "Admins can manage assignments" ON public.user_group_assignments FOR ALL TO authenticated
  USING (public.is_admin());
CREATE POLICY "Users can read own assignments" ON public.user_group_assignments FOR SELECT TO authenticated
  USING (user_id = public.get_my_profile_id());

-- solicitations
CREATE POLICY "Juridico can read all solicitations" ON public.solicitations FOR SELECT TO authenticated
  USING (public.is_juridico());
CREATE POLICY "Atendentes can read relevant solicitations" ON public.solicitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.user_group_assignments uga ON uga.area_id = d.responsible_area_id AND uga.operation_id = solicitations.operation_id
      WHERE d.solicitation_id = solicitations.id AND uga.user_id = public.get_my_profile_id()
    )
  );
CREATE POLICY "Juridico can insert solicitations" ON public.solicitations FOR INSERT TO authenticated
  WITH CHECK (public.is_juridico());
CREATE POLICY "Juridico can update solicitations" ON public.solicitations FOR UPDATE TO authenticated
  USING (public.is_juridico());
CREATE POLICY "Atendentes can update relevant solicitations" ON public.solicitations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.user_group_assignments uga ON uga.area_id = d.responsible_area_id AND uga.operation_id = solicitations.operation_id
      WHERE d.solicitation_id = solicitations.id AND uga.user_id = public.get_my_profile_id()
    )
  );

-- documents
CREATE POLICY "Juridico can read all documents" ON public.documents FOR SELECT TO authenticated
  USING (public.is_juridico());
CREATE POLICY "Atendentes can read relevant documents" ON public.documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solicitations s
      JOIN public.user_group_assignments uga ON uga.area_id = documents.responsible_area_id AND uga.operation_id = s.operation_id
      WHERE s.id = documents.solicitation_id AND uga.user_id = public.get_my_profile_id()
    )
  );
CREATE POLICY "Juridico can insert documents" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.is_juridico());
CREATE POLICY "Anyone involved can update documents" ON public.documents FOR UPDATE TO authenticated
  USING (
    public.is_juridico() OR EXISTS (
      SELECT 1 FROM public.solicitations s
      JOIN public.user_group_assignments uga ON uga.area_id = documents.responsible_area_id AND uga.operation_id = s.operation_id
      WHERE s.id = documents.solicitation_id AND uga.user_id = public.get_my_profile_id()
    )
  );

-- area_conclusions, attachments, comments, audit_logs - open for authenticated
CREATE POLICY "Read area_conclusions" ON public.area_conclusions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert area_conclusions" ON public.area_conclusions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Read attachments" ON public.attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert attachments" ON public.attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Delete own attachments" ON public.attachments FOR DELETE TO authenticated USING (uploaded_by = public.get_my_profile_id());

CREATE POLICY "Read comments" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- notifications
CREATE POLICY "Read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = public.get_my_profile_id());
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = public.get_my_profile_id());

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('solicitations', 'solicitations', false);
CREATE POLICY "Auth upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'solicitations');
CREATE POLICY "Auth read files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'solicitations');
CREATE POLICY "Auth delete files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'solicitations');

-- Indexes
CREATE INDEX idx_solicitations_status ON public.solicitations(status);
CREATE INDEX idx_solicitations_operation ON public.solicitations(operation_id);
CREATE INDEX idx_documents_solicitation ON public.documents(solicitation_id);
CREATE INDEX idx_documents_area ON public.documents(responsible_area_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX idx_user_group_user ON public.user_group_assignments(user_id);
CREATE INDEX idx_audit_logs_solicitation ON public.audit_logs(solicitation_id);
CREATE INDEX idx_comments_solicitation ON public.comments(solicitation_id);
