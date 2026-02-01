-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create surveys table
CREATE TABLE public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  response_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('short_answer', 'paragraph', 'multiple_choice', 'checkboxes', 'dropdown')),
  title TEXT NOT NULL,
  options TEXT[] DEFAULT '{}',
  required BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create survey_responses table
CREATE TABLE public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Profiles policies: users can only access their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Surveys policies: owners can CRUD, anyone can read published surveys
CREATE POLICY "Survey owners can do everything"
  ON public.surveys FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view published surveys"
  ON public.surveys FOR SELECT
  USING (is_published = true);

-- Questions policies: survey owners can CRUD, anyone can view questions for published surveys
CREATE POLICY "Survey owners can manage questions"
  ON public.questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.surveys 
      WHERE surveys.id = questions.survey_id 
      AND surveys.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view questions for published surveys"
  ON public.questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.surveys 
      WHERE surveys.id = questions.survey_id 
      AND surveys.is_published = true
    )
  );

-- Survey responses policies: anyone can submit, only survey owner can view
CREATE POLICY "Anyone can submit responses to published surveys"
  ON public.survey_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.surveys 
      WHERE surveys.id = survey_responses.survey_id 
      AND surveys.is_published = true
    )
  );

CREATE POLICY "Survey owners can view responses"
  ON public.survey_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.surveys 
      WHERE surveys.id = survey_responses.survey_id 
      AND surveys.user_id = auth.uid()
    )
  );

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

-- Create trigger for auto-creating profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_surveys_updated_at
  BEFORE UPDATE ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to increment response count
CREATE OR REPLACE FUNCTION public.increment_response_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.surveys
  SET response_count = response_count + 1
  WHERE id = NEW.survey_id;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-increment response count
CREATE TRIGGER on_response_submitted
  AFTER INSERT ON public.survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_response_count();