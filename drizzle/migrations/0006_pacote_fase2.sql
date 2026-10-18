CREATE TABLE public.product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_options TO authenticated;
GRANT ALL ON public.product_options TO service_role;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read options" ON public.product_options FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner manage options" ON public.product_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.owns_store(p.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.owns_store(p.store_id)));

ALTER TABLE public.order_items ADD COLUMN options text;

CREATE TABLE public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  sender_role text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.order_party(_order uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN o.customer_id = auth.uid() THEN 'cliente'
    WHEN public.owns_store(o.store_id) THEN 'loja'
    WHEN o.courier_id IS NOT NULL AND o.courier_id = public.my_courier_id() THEN 'entregador'
  END FROM public.orders o WHERE o.id = _order
$$;
CREATE POLICY "parties read messages" ON public.order_messages FOR SELECT TO authenticated USING (public.order_party(order_id) IS NOT NULL);
CREATE POLICY "parties send messages" ON public.order_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND sender_role = public.order_party(order_id));
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;

ALTER TABLE public.orders ADD COLUMN courier_lat double precision, ADD COLUMN courier_lng double precision, ADD COLUMN courier_loc_at timestamptz, ADD COLUMN payout_id uuid;
CREATE OR REPLACE FUNCTION public.update_courier_location(_order uuid, _lat double precision, _lng double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.orders SET courier_lat = _lat, courier_lng = _lng, courier_loc_at = now()
  WHERE id = _order AND status = 'saiu_entrega'
    AND ((courier_id IS NOT NULL AND courier_id = public.my_courier_id()) OR public.owns_store(store_id));
END $$;

ALTER TABLE public.couriers ADD COLUMN doc_path text;

CREATE OR REPLACE FUNCTION public.top_products(_store uuid)
RETURNS TABLE(product_id uuid, sold bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.product_id, sum(i.qty)::bigint FROM public.order_items i JOIN public.orders o ON o.id = i.order_id
  WHERE o.store_id = _store AND o.status IN ('pago','preparando','saiu_entrega','concluido') AND i.product_id IS NOT NULL
  GROUP BY i.product_id ORDER BY 2 DESC LIMIT 4
$$;
GRANT EXECUTE ON FUNCTION public.top_products(uuid) TO anon, authenticated;

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  amount numeric NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  asaas_transfer_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read payouts" ON public.payouts FOR SELECT TO authenticated USING (public.owns_store(store_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "courier upload own doc" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'courier-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "courier update own doc" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'courier-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "courier or admin read doc" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'courier-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));