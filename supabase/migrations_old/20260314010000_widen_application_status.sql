-- Widen application_history status check to include all values used by the UI
-- Old constraint: applied, pending, failed, interview, rejected, offer
-- New constraint adds: screening, accepted, withdrawn, declined

ALTER TABLE public.application_history
  DROP CONSTRAINT IF EXISTS application_history_status_check;

ALTER TABLE public.application_history
  ADD CONSTRAINT application_history_status_check
  CHECK (status = ANY (ARRAY[
    'applied',
    'pending',
    'screening',
    'interview',
    'offer',
    'accepted',
    'rejected',
    'declined',
    'withdrawn',
    'failed'
  ]::text[]));
