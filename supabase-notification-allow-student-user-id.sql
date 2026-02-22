-- ============================================================
-- Run this in Supabase SQL Editor (once).
-- notifications.user_id currently references auth.users(id).
-- Students log in via public.students and don't have auth.users
-- rows, so inserts with user_id = students.id fail the FK check.
-- This drops the FK so user_id can be either auth.users.id or
-- public.students.id (the app only uses valid ids).
-- ============================================================

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
