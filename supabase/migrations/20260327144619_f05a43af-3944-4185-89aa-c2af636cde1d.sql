
ALTER TABLE public.cash_closings
  ADD COLUMN IF NOT EXISTS reopened_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_reason text,
  ADD COLUMN IF NOT EXISTS previous_closing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS closing_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_latest_version boolean NOT NULL DEFAULT true;
