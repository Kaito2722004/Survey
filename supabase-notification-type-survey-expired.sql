-- Run this in Supabase SQL Editor once.
-- Allows the "survey_expired" notification type (for students when a survey has expired and can't be taken).

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'new_survey',
    'survey_deadline_1h',
    'survey_expired',
    'survey_completed',
    'survey_published'
  ));
