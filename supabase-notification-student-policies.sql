-- ============================================================
-- Run this in Supabase SQL Editor (once).
-- Fixes notifications for BOTH students and alumni when they
-- don't use Supabase Auth (they use the students table to log in).
-- Also adds SELECT for auth users (admin/portal) if missing.
-- ============================================================

-- 1) Auth users (admin, portal alumni): allow reading their notifications.
--    If you get "policy already exists", skip this and run only (2) and (3).
CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2) Students & alumni (students table login): allow INSERT so the app can
--    create new_survey, deadline_1h, survey_expired when they load the dashboard.
CREATE POLICY "Students can have notifications inserted"
  ON public.notifications
  FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.students));

-- 3) Students & alumni: allow SELECT so the bell shows their notifications.
--    Run ONLY this if you get "already exists" on (1) or (2).
CREATE POLICY "Students can read own notifications"
  ON public.notifications
  FOR SELECT
  USING (user_id IN (SELECT id FROM public.students));
