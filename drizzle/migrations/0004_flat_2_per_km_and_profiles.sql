ALTER TABLE public.stores ALTER COLUMN delivery_fee_per_km SET DEFAULT 2;
ALTER TABLE public.stores ALTER COLUMN delivery_fee_per_km_far SET DEFAULT 2;
UPDATE public.stores SET delivery_base_fee = 0, delivery_fee_per_km = 2, delivery_fee_per_km_far = 2;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());