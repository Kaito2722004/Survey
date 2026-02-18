-- Run this in Supabase SQL Editor once.
-- Allows the "survey_published" notification type (used when admin publishes a survey).

-- Drop the existing check constraint (name may vary; if this fails, check your table's constraints in Table Editor)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add updated constraint including survey_published
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'new_survey',
    'survey_deadline_1h',
    'survey_completed',
    'survey_published'
  ));
