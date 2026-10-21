-- Platform couriers: open-delivery board, courier earnings and Pix payouts.
-- Also fixes orders_guard/stores_guard, which never fired: as SECURITY DEFINER functions
-- current_user is their owner, never 'authenticated', so clients could edit totals and payouts.

-- 1) Courier earnings per order and courier payouts
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_payout numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_payout_id uuid;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS pix_key_type text;

CREATE TABLE IF NOT EXISTS public.courier_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id),
  amount numeric NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  asaas_transfer_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courier_payouts TO authenticated;
GRANT ALL ON public.courier_payouts TO service_role;
ALTER TABLE public.courier_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier or admin read courier payouts" ON public.courier_payouts FOR SELECT TO authenticated
  USING (courier_id = public.my_courier_id() OR public.has_role(auth.uid(), 'admin'));

-- 2) Guards that actually run for API users (SECURITY INVOKER: current_user is 'authenticated')
CREATE OR REPLACE FUNCTION public.orders_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    -- Money, payment and delivery proof are server-only.
    NEW.total := OLD.total; NEW.subtotal := OLD.subtotal; NEW.delivery_fee := OLD.delivery_fee;
    NEW.store_payout := OLD.store_payout; NEW.platform_fee := OLD.platform_fee; NEW.gateway_fee := OLD.gateway_fee;
    NEW.courier_payout := OLD.courier_payout; NEW.courier_payout_id := OLD.courier_payout_id; NEW.payout_id := OLD.payout_id;
    NEW.payment_status := OLD.payment_status; NEW.payment_method := OLD.payment_method; NEW.asaas_payment_id := OLD.asaas_payment_id;
    NEW.invoice_url := OLD.invoice_url; NEW.pix_qr := OLD.pix_qr; NEW.pix_payload := OLD.pix_payload;
    NEW.delivery_pin := OLD.delivery_pin; NEW.delivered_at := OLD.delivered_at; NEW.rating := OLD.rating; NEW.review := OLD.review;
    NEW.customer_id := OLD.customer_id; NEW.store_id := OLD.store_id; NEW.fulfillment := OLD.fulfillment;
    NEW.customer_name := OLD.customer_name; NEW.customer_phone := OLD.customer_phone;
    NEW.address := OLD.address; NEW.lat := OLD.lat; NEW.lng := OLD.lng; NEW.distance_km := OLD.distance_km;
    -- Store may only move a paid order forward (pago → preparando → saiu_entrega) or cancel it before it leaves.
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
         (OLD.status = 'pago' AND NEW.status IN ('preparando', 'cancelado'))
      OR (OLD.status = 'preparando' AND NEW.status IN ('saiu_entrega', 'cancelado'))
    ) THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.stores_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'UPDATE' THEN NEW.rating_avg := OLD.rating_avg; NEW.rating_count := OLD.rating_count; NEW.owner_id := OLD.owner_id;
    ELSE NEW.rating_avg := 0; NEW.rating_count := 0; END IF;
  END IF;
  RETURN NEW;
END $$;

-- 3) Open deliveries board: paid orders of stores without own couriers, nearest store first.
--    Returns no customer data; the courier sees name/phone/street only after accepting.
CREATE OR REPLACE FUNCTION public.open_deliveries(_lat double precision, _lng double precision)
RETURNS TABLE (order_id uuid, store_name text, store_address text, store_lat double precision, store_lng double precision,
               km_to_store numeric, delivery_km numeric, earning numeric, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, s.name, s.address, s.lat, s.lng,
         round((6371 * 2 * asin(sqrt(power(sin(radians(s.lat - _lat) / 2), 2)
           + cos(radians(_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - _lng) / 2), 2))))::numeric, 1),
         o.distance_km, o.courier_payout, o.status, o.created_at
  FROM public.orders o JOIN public.stores s ON s.id = o.store_id
  WHERE o.courier_id IS NULL AND o.status IN ('pago', 'preparando') AND o.fulfillment = 'delivery'
    AND NOT s.own_couriers AND o.courier_payout > 0
    AND EXISTS (SELECT 1 FROM public.couriers c WHERE c.user_id = auth.uid() AND c.approval_status = 'aprovado')
  ORDER BY 6 ASC, o.created_at ASC
  LIMIT 30
$$;

-- 4) First approved, available courier to accept takes it (atomic: courier_id IS NULL in the WHERE).
CREATE OR REPLACE FUNCTION public.accept_delivery(_order uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.my_courier_id(); n int;
BEGIN
  IF me IS NULL OR NOT EXISTS (SELECT 1 FROM public.couriers WHERE id = me AND approval_status = 'aprovado' AND available) THEN
    RAISE EXCEPTION 'Fique disponível e com cadastro aprovado para aceitar entregas';
  END IF;
  IF (SELECT count(*) FROM public.orders WHERE courier_id = me AND status IN ('pago', 'preparando', 'saiu_entrega')) >= 2 THEN
    RAISE EXCEPTION 'Conclua suas entregas em andamento antes de aceitar outra';
  END IF;
  UPDATE public.orders o SET courier_id = me
  WHERE o.id = _order AND o.courier_id IS NULL AND o.status IN ('pago', 'preparando') AND o.fulfillment = 'delivery'
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = o.store_id AND NOT s.own_couriers);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

REVOKE EXECUTE ON FUNCTION public.open_deliveries(double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_deliveries(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_delivery(uuid) TO authenticated;
