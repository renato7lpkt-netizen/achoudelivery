-- Test accounts (the Play Store reviewer login) never mix with real orders:
-- a test courier only sees/accepts orders of test stores, and real couriers never get orders of test stores.
CREATE TABLE IF NOT EXISTS public.test_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.test_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.test_accounts FROM PUBLIC, anon, authenticated;

INSERT INTO public.test_accounts (user_id, note)
SELECT id, 'Conta do revisor da Play Store' FROM auth.users WHERE email = 'renato7lpkt3@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

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
    AND EXISTS (SELECT 1 FROM public.test_accounts t WHERE t.user_id = s.owner_id)
      = EXISTS (SELECT 1 FROM public.test_accounts t WHERE t.user_id = auth.uid())
  ORDER BY 6 ASC, o.created_at ASC
  LIMIT 30
$$;

CREATE OR REPLACE FUNCTION public.accept_delivery(_order uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.my_courier_id(); n int;
  i_am_test boolean := EXISTS (SELECT 1 FROM public.test_accounts WHERE user_id = auth.uid());
BEGIN
  IF me IS NULL OR NOT EXISTS (SELECT 1 FROM public.couriers WHERE id = me AND approval_status = 'aprovado' AND available) THEN
    RAISE EXCEPTION 'Fique disponível e com cadastro aprovado para aceitar entregas';
  END IF;
  IF (SELECT count(*) FROM public.orders WHERE courier_id = me AND status IN ('pago', 'preparando', 'saiu_entrega')) >= 2 THEN
    RAISE EXCEPTION 'Conclua suas entregas em andamento antes de aceitar outra';
  END IF;
  UPDATE public.orders o SET courier_id = me
  WHERE o.id = _order AND o.courier_id IS NULL AND o.status IN ('pago', 'preparando') AND o.fulfillment = 'delivery'
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = o.store_id AND NOT s.own_couriers
                AND EXISTS (SELECT 1 FROM public.test_accounts t WHERE t.user_id = s.owner_id) = i_am_test);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

REVOKE EXECUTE ON FUNCTION public.open_deliveries(double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_deliveries(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_delivery(uuid) TO authenticated;
