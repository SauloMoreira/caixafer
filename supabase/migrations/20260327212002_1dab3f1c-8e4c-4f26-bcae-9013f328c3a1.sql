
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_primary_admin boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS has_operational_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_primary_admin IS 'Flag para administrador principal do sistema';
COMMENT ON COLUMN public.profiles.has_operational_override IS 'Permite override operacional em qualquer sessão de caixa';
