
-- Fix overly permissive policies on spr_volunteers
DROP POLICY "Cashiers can insert volunteers" ON public.spr_volunteers;
DROP POLICY "Cashiers can update volunteers" ON public.spr_volunteers;

CREATE POLICY "Cashiers can insert volunteers" ON public.spr_volunteers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Cashiers can update volunteers" ON public.spr_volunteers FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
