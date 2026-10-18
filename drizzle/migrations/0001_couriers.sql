CREATE TABLE public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  phone text NOT NULL,
  cpf text NOT NULL,
  vehicle text NOT NULL DEFAULT 'Moto',
  plate text,
  pix_key text,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couriers TO authenticated;
GRANT ALL ON public.couriers TO service_role;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier own" ON public.couriers FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.orders ADD COLUMN courier_id uuid REFERENCES public.couriers(id);

CREATE OR REPLACE FUNCTION public.my_courier_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.couriers WHERE user_id = auth.uid()
$$;

CREATE POLICY "courier read assigned orders" ON public.orders FOR SELECT TO authenticated USING (courier_id IS NOT NULL AND courier_id = public.my_courier_id());
CREATE POLICY "courier read assigned items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.courier_id IS NOT NULL AND o.courier_id = public.my_courier_id()));

-- Store owners see safe courier info only
CREATE OR REPLACE FUNCTION public.list_couriers()
RETURNS TABLE (id uuid, name text, phone text, vehicle text, plate text, available boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.phone, c.vehicle, c.plate, c.available FROM public.couriers c
  WHERE EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.orders o JOIN public.stores s ON s.id = o.store_id WHERE o.courier_id = c.id AND o.customer_id = auth.uid())
  ORDER BY c.available DESC, c.name
$$;

CREATE OR REPLACE FUNCTION public.courier_update_order(_order uuid, _status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status NOT IN ('saiu_entrega','concluido') THEN RAISE EXCEPTION 'status inválido'; END IF;
  UPDATE public.orders SET status = _status
  WHERE id = _order AND courier_id IS NOT NULL AND courier_id = public.my_courier_id()
    AND status IN ('preparando','saiu_entrega');
END $$;
REVOKE EXECUTE ON FUNCTION public.courier_update_order(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.courier_update_order(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_couriers() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_couriers() TO authenticated;