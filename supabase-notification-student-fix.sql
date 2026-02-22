-- ============================================================
-- Run this in Supabase SQL Editor (once).
-- Student/alumni notifications may still fail because the RLS
-- policies use (user_id IN (SELECT id FROM public.students)).
-- If the "students" table has RLS, the anon key cannot read it,
-- so the subquery returns no rows and inserts/reads are blocked.
-- This fix uses a SECURITY DEFINER function so the check runs
-- with enough privileges to see student ids.
-- ============================================================

-- 1) Helper: returns true if the given uuid is a student id (runs with definer privileges)
CREATE OR REPLACE FUNCTION public.is_student_user_id(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.students WHERE id = uid);
$$;

-- Allow anon and authenticated to call it (required for RLS policy to run)
GRANT EXECUTE ON FUNCTION public.is_student_user_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_student_user_id(uuid) TO authenticated;

-- 2) Drop the old student policies (they use the subquery that can fail)
DROP POLICY IF EXISTS "Students can have notifications inserted" ON public.notifications;
DROP POLICY IF EXISTS "Students can read own notifications" ON public.notifications;

-- 3) Recreate using the function so anon key works
CREATE POLICY "Students can have notifications inserted"
  ON public.notifications
  FOR INSERT
  WITH CHECK (public.is_student_user_id(user_id));

CREATE POLICY "Students can read own notifications"
  ON public.notifications
  FOR SELECT
  USING (public.is_student_user_id(user_id));
