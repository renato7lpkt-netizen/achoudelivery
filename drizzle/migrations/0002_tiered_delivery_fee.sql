ALTER TABLE public.stores ADD COLUMN delivery_fee_per_km_far numeric(10,2) NOT NULL DEFAULT 2.5;
ALTER TABLE public.stores ADD COLUMN delivery_tier_km numeric(10,2) NOT NULL DEFAULT 10;
ALTER TABLE public.stores ALTER COLUMN delivery_fee_per_km SET DEFAULT 3;
ALTER TABLE public.stores ALTER COLUMN delivery_base_fee SET DEFAULT 0;
ALTER TABLE public.stores ALTER COLUMN delivery_max_km SET DEFAULT 20;
UPDATE public.stores SET delivery_fee_per_km = 3, delivery_base_fee = 0, delivery_fee_per_km_far = 2.5, delivery_tier_km = 10, delivery_max_km = GREATEST(delivery_max_km, 20) WHERE delivery_fee_per_km IS NOT NULL;