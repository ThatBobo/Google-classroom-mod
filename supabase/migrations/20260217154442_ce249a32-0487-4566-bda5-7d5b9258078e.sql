
-- Create enums
CREATE TYPE public.class_role AS ENUM ('teacher', 'student');
CREATE TYPE public.invite_event_type AS ENUM ('used', 'expired');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  section TEXT,
  subject TEXT,
  room TEXT,
  banner_color TEXT NOT NULL DEFAULT '#1967D2',
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  class_code TEXT NOT NULL DEFAULT substring(md5(random()::text), 1, 7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Class members
CREATE TABLE public.class_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role class_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, user_id)
);
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

-- Assignments
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  points INTEGER,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Submissions
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  content TEXT,
  grade INTEGER,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Announcements
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Opix: Integrations
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  api_key_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Opix: Integration logs
CREATE TABLE public.integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  log_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- Opix: Invites
CREATE TABLE public.invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Opix: Invite events
CREATE TABLE public.invite_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_id UUID NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  event_type invite_event_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invite_events ENABLE ROW LEVEL SECURITY;

-- Helper functions (security definer)
CREATE OR REPLACE FUNCTION public.is_class_member(_user_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members WHERE user_id = _user_id AND class_id = _class_id
  ) OR EXISTS (
    SELECT 1 FROM public.classes WHERE id = _class_id AND owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_class_teacher(_user_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members WHERE user_id = _user_id AND class_id = _class_id AND role = 'teacher'
  ) OR EXISTS (
    SELECT 1 FROM public.classes WHERE id = _class_id AND owner_id = _user_id
  );
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_class_members_updated_at BEFORE UPDATE ON public.class_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view class member profiles" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.class_members cm1
    JOIN public.class_members cm2 ON cm1.class_id = cm2.class_id
    WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.user_id
  )
);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Classes
CREATE POLICY "Members can view classes" ON public.classes FOR SELECT USING (public.is_class_member(auth.uid(), id));
CREATE POLICY "Auth users can create classes" ON public.classes FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update classes" ON public.classes FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete classes" ON public.classes FOR DELETE USING (auth.uid() = owner_id);

-- Class members
CREATE POLICY "Members can view class members" ON public.class_members FOR SELECT USING (public.is_class_member(auth.uid(), class_id));
CREATE POLICY "Teachers can add members" ON public.class_members FOR INSERT WITH CHECK (public.is_class_teacher(auth.uid(), class_id));
CREATE POLICY "Self-join via invite" ON public.class_members FOR INSERT WITH CHECK (auth.uid() = user_id AND role = 'student');
CREATE POLICY "Teachers can update members" ON public.class_members FOR UPDATE USING (public.is_class_teacher(auth.uid(), class_id));
CREATE POLICY "Teachers can remove members" ON public.class_members FOR DELETE USING (public.is_class_teacher(auth.uid(), class_id));

-- Assignments
CREATE POLICY "Members can view assignments" ON public.assignments FOR SELECT USING (public.is_class_member(auth.uid(), class_id));
CREATE POLICY "Teachers can create assignments" ON public.assignments FOR INSERT WITH CHECK (public.is_class_teacher(auth.uid(), class_id));
CREATE POLICY "Teachers can update assignments" ON public.assignments FOR UPDATE USING (public.is_class_teacher(auth.uid(), class_id));
CREATE POLICY "Teachers can delete assignments" ON public.assignments FOR DELETE USING (public.is_class_teacher(auth.uid(), class_id));

-- Submissions
CREATE POLICY "Students can view own submissions" ON public.submissions FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Teachers can view class submissions" ON public.submissions FOR SELECT USING (
  public.is_class_teacher(auth.uid(), (SELECT class_id FROM public.assignments WHERE id = assignment_id))
);
CREATE POLICY "Students can create submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can update own ungraded" ON public.submissions FOR UPDATE USING (auth.uid() = student_id AND grade IS NULL);
CREATE POLICY "Teachers can grade submissions" ON public.submissions FOR UPDATE USING (
  public.is_class_teacher(auth.uid(), (SELECT class_id FROM public.assignments WHERE id = assignment_id))
);

-- Announcements
CREATE POLICY "Members can view announcements" ON public.announcements FOR SELECT USING (public.is_class_member(auth.uid(), class_id));
CREATE POLICY "Teachers can create announcements" ON public.announcements FOR INSERT WITH CHECK (public.is_class_teacher(auth.uid(), class_id));
CREATE POLICY "Authors can update announcements" ON public.announcements FOR UPDATE USING (auth.uid() = author_id AND public.is_class_teacher(auth.uid(), class_id));
CREATE POLICY "Teachers can delete announcements" ON public.announcements FOR DELETE USING (public.is_class_teacher(auth.uid(), class_id));

-- Integrations
CREATE POLICY "Users can view own integrations" ON public.integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create integrations" ON public.integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integrations" ON public.integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations" ON public.integrations FOR DELETE USING (auth.uid() = user_id);

-- Integration logs
CREATE POLICY "Users can view own integration logs" ON public.integration_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.integrations WHERE id = integration_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create own integration logs" ON public.integration_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.integrations WHERE id = integration_id AND user_id = auth.uid())
);

-- Invites
CREATE POLICY "Teachers can view class invites" ON public.invites FOR SELECT USING (public.is_class_teacher(auth.uid(), class_id));
CREATE POLICY "Anyone can view invite by code" ON public.invites FOR SELECT USING (true);
CREATE POLICY "Teachers can create invites" ON public.invites FOR INSERT WITH CHECK (public.is_class_teacher(auth.uid(), class_id));
CREATE POLICY "Teachers can delete invites" ON public.invites FOR DELETE USING (public.is_class_teacher(auth.uid(), class_id));

-- Invite events
CREATE POLICY "Teachers can view invite events" ON public.invite_events FOR SELECT USING (
  public.is_class_teacher(auth.uid(), (SELECT class_id FROM public.invites WHERE id = invite_id))
);
CREATE POLICY "Auth users can create invite events" ON public.invite_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX idx_class_members_class_id ON public.class_members(class_id);
CREATE INDEX idx_class_members_user_id ON public.class_members(user_id);
CREATE INDEX idx_assignments_class_id ON public.assignments(class_id);
CREATE INDEX idx_submissions_assignment_id ON public.submissions(assignment_id);
CREATE INDEX idx_announcements_class_id ON public.announcements(class_id);
CREATE INDEX idx_integrations_user_id ON public.integrations(user_id);
CREATE INDEX idx_integration_logs_integration_id ON public.integration_logs(integration_id);
CREATE INDEX idx_invites_class_id ON public.invites(class_id);
CREATE INDEX idx_invite_events_invite_id ON public.invite_events(invite_id);

-- Enable realtime for announcements
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
