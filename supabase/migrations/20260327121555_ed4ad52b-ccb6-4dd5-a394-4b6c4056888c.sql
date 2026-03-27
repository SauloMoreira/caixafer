
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier');
CREATE TYPE public.entry_type AS ENUM ('income', 'expense');
CREATE TYPE public.closing_status AS ENUM ('open', 'closed');
CREATE TYPE public.fiado_status AS ENUM ('open', 'partial', 'paid');
CREATE TYPE public.payment_method AS ENUM ('pix', 'debito', 'credito', 'transferencia');
CREATE TYPE public.document_type AS ENUM ('recibo', 'nota_fiscal', 'id_transferencia', 'sem_documento');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'cashier',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role
  )
$$;

-- Profile policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile name" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'cashier');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  unit_price NUMERIC(10,2) NOT NULL,
  internal_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number SERIAL,
  business_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can do all on sales" ON public.sales FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Cashiers can view own sales" ON public.sales FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Cashiers can insert sales" ON public.sales FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Cashiers can update own sales today" ON public.sales FOR UPDATE USING (auth.uid() = created_by AND business_date = CURRENT_DATE);
CREATE POLICY "Cashiers can delete own sales today" ON public.sales FOR DELETE USING (auth.uid() = created_by AND business_date = CURRENT_DATE);

-- Sale Items
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can do all on sale items" ON public.sale_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Cashiers can view own sale items" ON public.sale_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.created_by = auth.uid())
);
CREATE POLICY "Cashiers can insert sale items" ON public.sale_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.created_by = auth.uid())
);
CREATE POLICY "Cashiers can update own sale items today" ON public.sale_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.created_by = auth.uid() AND sales.business_date = CURRENT_DATE)
);
CREATE POLICY "Cashiers can delete own sale items today" ON public.sale_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.created_by = auth.uid() AND sales.business_date = CURRENT_DATE)
);

-- Cash Entries
CREATE TABLE public.cash_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type entry_type NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  business_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method payment_method,
  document_type document_type,
  document_reference TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  source_type TEXT,
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can do all on entries" ON public.cash_entries FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Cashiers can view own entries" ON public.cash_entries FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Cashiers can insert entries" ON public.cash_entries FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Cashiers can update own entries today" ON public.cash_entries FOR UPDATE USING (auth.uid() = created_by AND business_date = CURRENT_DATE);
CREATE POLICY "Cashiers can delete own entries today" ON public.cash_entries FOR DELETE USING (auth.uid() = created_by AND business_date = CURRENT_DATE);

-- Cash Closings
CREATE TABLE public.cash_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  opening_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  sales_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  income_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  expense_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  expected_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  counted_balance NUMERIC(10,2),
  difference_amount NUMERIC(10,2),
  notes TEXT,
  status closing_status NOT NULL DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_date, user_id)
);
ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can do all on closings" ON public.cash_closings FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Cashiers can view own closings" ON public.cash_closings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Cashiers can insert closings" ON public.cash_closings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Cashiers can update own closings today" ON public.cash_closings FOR UPDATE USING (auth.uid() = user_id AND business_date = CURRENT_DATE);

-- SPR Volunteers
CREATE TABLE public.spr_volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  document_number TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spr_volunteers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view volunteers" ON public.spr_volunteers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert volunteers" ON public.spr_volunteers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update volunteers" ON public.spr_volunteers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete volunteers" ON public.spr_volunteers FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Cashiers can insert volunteers" ON public.spr_volunteers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Cashiers can update volunteers" ON public.spr_volunteers FOR UPDATE TO authenticated USING (true);

-- SPR Fiado Charges
CREATE TABLE public.spr_fiado_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID NOT NULL REFERENCES public.spr_volunteers(id),
  business_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  status fiado_status NOT NULL DEFAULT 'open',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spr_fiado_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can do all on fiado charges" ON public.spr_fiado_charges FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Cashiers can view own fiado charges" ON public.spr_fiado_charges FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Cashiers can insert fiado charges" ON public.spr_fiado_charges FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Cashiers can update own fiado charges today" ON public.spr_fiado_charges FOR UPDATE USING (auth.uid() = created_by AND business_date = CURRENT_DATE);

-- SPR Fiado Charge Items
CREATE TABLE public.spr_fiado_charge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id UUID NOT NULL REFERENCES public.spr_fiado_charges(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.spr_fiado_charge_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can do all on fiado charge items" ON public.spr_fiado_charge_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Cashiers can view own fiado charge items" ON public.spr_fiado_charge_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.spr_fiado_charges WHERE spr_fiado_charges.id = spr_fiado_charge_items.charge_id AND spr_fiado_charges.created_by = auth.uid())
);
CREATE POLICY "Cashiers can insert fiado charge items" ON public.spr_fiado_charge_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.spr_fiado_charges WHERE spr_fiado_charges.id = spr_fiado_charge_items.charge_id AND spr_fiado_charges.created_by = auth.uid())
);

-- SPR Fiado Payments
CREATE TABLE public.spr_fiado_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiado_charge_id UUID NOT NULL REFERENCES public.spr_fiado_charges(id),
  volunteer_id UUID NOT NULL REFERENCES public.spr_volunteers(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_paid NUMERIC(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  document_type document_type,
  document_reference TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spr_fiado_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can do all on fiado payments" ON public.spr_fiado_payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Cashiers can view own fiado payments" ON public.spr_fiado_payments FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Cashiers can insert fiado payments" ON public.spr_fiado_payments FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Trigger for fiado payment automation
CREATE OR REPLACE FUNCTION public.handle_fiado_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  total_paid NUMERIC(10,2);
  charge_amount NUMERIC(10,2);
BEGIN
  SELECT COALESCE(SUM(amount_paid), 0) INTO total_paid
  FROM public.spr_fiado_payments
  WHERE fiado_charge_id = NEW.fiado_charge_id;

  SELECT amount INTO charge_amount
  FROM public.spr_fiado_charges
  WHERE id = NEW.fiado_charge_id;

  UPDATE public.spr_fiado_charges
  SET status = CASE
    WHEN total_paid >= charge_amount THEN 'paid'::fiado_status
    WHEN total_paid > 0 THEN 'partial'::fiado_status
    ELSE 'open'::fiado_status
  END
  WHERE id = NEW.fiado_charge_id;

  INSERT INTO public.cash_entries (
    entry_type, category, description, business_date, amount,
    payment_method, document_type, document_reference, notes,
    created_by, source_type, source_id
  ) VALUES (
    'income', 'fiado_payment',
    'Pagamento de fiado - ' || (SELECT full_name FROM public.spr_volunteers WHERE id = NEW.volunteer_id),
    NEW.payment_date, NEW.amount_paid,
    NEW.payment_method, NEW.document_type, NEW.document_reference, NEW.notes,
    NEW.created_by, 'spr_fiado_payment', NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_fiado_payment_created
  AFTER INSERT ON public.spr_fiado_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_fiado_payment();

-- Indexes
CREATE INDEX idx_sales_business_date ON public.sales(business_date);
CREATE INDEX idx_sales_created_by ON public.sales(created_by);
CREATE INDEX idx_cash_entries_business_date ON public.cash_entries(business_date);
CREATE INDEX idx_cash_entries_created_by ON public.cash_entries(created_by);
CREATE INDEX idx_spr_fiado_charges_volunteer ON public.spr_fiado_charges(volunteer_id);
CREATE INDEX idx_spr_fiado_payments_charge ON public.spr_fiado_payments(fiado_charge_id);
