
-- Add active_session_id column to profiles for single-session enforcement
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_session_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
