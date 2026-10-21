-- Column-level privacy that RLS cannot express:
--  * couriers (and store owners) could read orders.delivery_pin and confirm a delivery without meeting the customer;
--  * anyone, even without login, could read stores.pix_key (often the owner's CPF), pix_key_type and asaas_wallet_id;
--  * Realtime broadcast whole rows, so the same columns also leaked through postgres_changes payloads.
-- A table-level SELECT grant overrides column revokes, so we revoke it and grant the safe columns explicitly.
-- New columns on these tables must be added to these grants (and to src/lib/columns.ts) to be readable.

-- 1) orders: every column except delivery_pin
REVOKE SELECT ON public.orders FROM authenticated;
GRANT SELECT (id, store_id, customer_id, status, fulfillment, customer_name, customer_phone, address, lat, lng, distance_km,
  subtotal, delivery_fee, total, platform_fee, gateway_fee, store_payout, payment_method, payment_status, asaas_payment_id,
  invoice_url, pix_qr, pix_payload, notes, created_at, courier_id, rating, review, delivered_at, courier_lat, courier_lng,
  courier_loc_at, payout_id, courier_payout, courier_payout_id) ON public.orders TO authenticated;

-- The customer (only) gets the PIN of their open orders.
CREATE OR REPLACE FUNCTION public.my_order_pins()
RETURNS TABLE (order_id uuid, pin text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.delivery_pin FROM public.orders o
  WHERE o.customer_id = auth.uid() AND o.status IN ('pago', 'preparando', 'saiu_entrega') AND o.delivery_pin IS NOT NULL
$$;

-- 2) stores: everything except the payout fields
REVOKE SELECT ON public.stores FROM anon, authenticated;
GRANT SELECT (id, owner_id, name, slug, description, category, logo_url, cover_url, address, lat, lng, phone,
  delivery_enabled, pickup_enabled, delivery_base_fee, delivery_fee_per_km, delivery_max_km, min_order, prep_time_min,
  is_paused, is_active, created_at, delivery_fee_per_km_far, delivery_tier_km, own_couriers, paused_until, rain_mode,
  rating_avg, rating_count) ON public.stores TO anon, authenticated;

-- The owner (only) reads their own Pix key; writing it keeps working through the existing UPDATE policy.
CREATE OR REPLACE FUNCTION public.my_store_pix(_store uuid)
RETURNS TABLE (pix_key_type text, pix_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.pix_key_type, s.pix_key FROM public.stores s WHERE s.id = _store AND s.owner_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.my_order_pins() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_store_pix(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_order_pins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_store_pix(uuid) TO authenticated;

-- 3) Realtime: publish only what the screens use to refresh (filters: id, store_id, courier_id; painel reads status).
ALTER PUBLICATION supabase_realtime SET TABLE
  public.orders (id, store_id, customer_id, courier_id, status, payment_status, courier_lat, courier_lng, courier_loc_at, created_at),
  public.stores (id, name, slug, is_active, is_paused, paused_until, rain_mode, own_couriers),
  public.order_messages;
