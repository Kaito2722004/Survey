-- ============================================================
-- REQUIRED: Run this in Supabase SQL Editor (once).
-- Without this, students and admins will not get any notifications
-- because the app cannot insert into the notifications table.
-- ============================================================

CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
