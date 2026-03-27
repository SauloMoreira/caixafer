
-- Add volunteer_id to profiles to link volunteer users to spr_volunteers
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS volunteer_id uuid REFERENCES public.spr_volunteers(id);

-- RLS: Allow volunteers to view their own fiado charges
CREATE POLICY "Volunteers can view own fiado charges"
ON public.spr_fiado_charges
FOR SELECT
TO authenticated
USING (
  volunteer_id IN (
    SELECT p.volunteer_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'volunteer'::app_role
  )
);

-- RLS: Allow volunteers to view their own fiado charge items
CREATE POLICY "Volunteers can view own fiado charge items"
ON public.spr_fiado_charge_items
FOR SELECT
TO authenticated
USING (
  charge_id IN (
    SELECT fc.id FROM public.spr_fiado_charges fc
    WHERE fc.volunteer_id IN (
      SELECT p.volunteer_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'volunteer'::app_role
    )
  )
);

-- RLS: Allow volunteers to view own fiado payments
CREATE POLICY "Volunteers can view own fiado payments"
ON public.spr_fiado_payments
FOR SELECT
TO authenticated
USING (
  volunteer_id IN (
    SELECT p.volunteer_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'volunteer'::app_role
  )
);
