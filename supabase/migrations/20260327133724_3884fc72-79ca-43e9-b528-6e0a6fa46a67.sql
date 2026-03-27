
-- Add separate address fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN cep text,
  ADD COLUMN street text,
  ADD COLUMN address_number text,
  ADD COLUMN address_complement text,
  ADD COLUMN neighborhood text,
  ADD COLUMN city text,
  ADD COLUMN state text;

-- Migrate existing address data to street field
UPDATE public.profiles SET street = address WHERE address IS NOT NULL AND address != '';

-- Drop old address column
ALTER TABLE public.profiles DROP COLUMN address;
