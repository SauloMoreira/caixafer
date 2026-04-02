
-- =============================================
-- SAAS FOUNDATION: companies + company_memberships
-- Safe, non-breaking, gradual multi-tenant prep
-- =============================================

-- 1. Companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  cnpj text,
  email text,
  phone text,
  address text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  slug text UNIQUE,
  timezone text DEFAULT 'America/Sao_Paulo',
  currency text DEFAULT 'BRL',
  receipt_footer text,
  theme_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Company memberships table
CREATE TABLE public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

-- 3. Security definer helper functions
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_memberships
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = _user_id AND company_id = _company_id AND is_active = true
  );
$$;

-- 4. RLS policies for companies (using security definer to avoid recursion)
CREATE POLICY "Members can view their company"
ON public.companies FOR SELECT TO authenticated
USING (id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can update their company"
ON public.companies FOR UPDATE TO authenticated
USING (id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- 5. RLS policies for company_memberships
CREATE POLICY "Users can view own memberships"
ON public.company_memberships FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage memberships"
ON public.company_memberships FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Insert default company (must exist before ALTER TABLE defaults reference it)
INSERT INTO public.companies (id, name, legal_name, slug)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Caixa da FER',
  'Cantina da FER',
  'caixa-da-fer'
);

-- 7. Add company_id to all business tables (nullable with default = safe, fills existing rows automatically)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.movement_categories ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.cash_closings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.cash_session_transfers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.spr_volunteers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.spr_fiado_charges ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.spr_fiado_payments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.daily_operation_insights ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.security_audit_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.security_incidents ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';

-- 8. Create memberships for all existing users
INSERT INTO public.company_memberships (company_id, user_id, role)
SELECT 'a0000000-0000-0000-0000-000000000001', p.id, p.role::text
FROM public.profiles p
ON CONFLICT (company_id, user_id) DO NOTHING;

-- 9. Auto-create membership when new user profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user_company_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_memberships (company_id, user_id, role)
  VALUES ('a0000000-0000-0000-0000-000000000001', NEW.id, NEW.role::text)
  ON CONFLICT (company_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_company_membership
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_company_membership();
