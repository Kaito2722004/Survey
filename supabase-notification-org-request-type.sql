-- ============================================================
-- Run this in Supabase SQL Editor (once).
-- Adds 'org_request' notification type so admins can be notified
-- when a new organization signs up and requests access.
-- ============================================================

-- Drop the existing CHECK constraint on type (name may vary; adjust if your DB uses a different name)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Re-add the constraint including 'org_request'
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'new_survey'::text,
    'survey_deadline_1h'::text,
    'survey_expired'::text,
    'survey_completed'::text,
    'survey_published'::text,
    'org_request'::text
  ]));
