CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Outros',
  logo_url text,
  cover_url text,
  address text NOT NULL DEFAULT '',
  lat double precision NOT NULL DEFAULT -19.4658,
  lng double precision NOT NULL DEFAULT -44.2467,
  phone text,
  asaas_wallet_id text,
  delivery_enabled boolean NOT NULL DEFAULT true,
  pickup_enabled boolean NOT NULL DEFAULT true,
  delivery_base_fee numeric(10,2) NOT NULL DEFAULT 3,
  delivery_fee_per_km numeric(10,2) NOT NULL DEFAULT 1.5,
  delivery_max_km numeric(10,2) NOT NULL DEFAULT 10,
  min_order numeric(10,2) NOT NULL DEFAULT 0,
  prep_time_min int NOT NULL DEFAULT 30,
  is_paused boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active stores" ON public.stores FOR SELECT TO anon, authenticated USING (is_active OR owner_id = auth.uid());
CREATE POLICY "owner insert store" ON public.stores FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner update store" ON public.stores FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner delete store" ON public.stores FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.owns_store(_store uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores WHERE id = _store AND owner_id = auth.uid())
$$;

CREATE TABLE public.store_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  weekday int NOT NULL,
  opens time NOT NULL,
  closes time NOT NULL
);
GRANT SELECT ON public.store_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_hours TO authenticated;
GRANT ALL ON public.store_hours TO service_role;
ALTER TABLE public.store_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read hours" ON public.store_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner manage hours" ON public.store_hours FOR ALL TO authenticated USING (public.owns_store(store_id)) WITH CHECK (public.owns_store(store_id));

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL,
  image_url text,
  section text NOT NULL DEFAULT 'Cardápio',
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner manage products" ON public.products FOR ALL TO authenticated USING (public.owns_store(store_id)) WITH CHECK (public.owns_store(store_id));

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  customer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'aguardando_pagamento',
  fulfillment text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  distance_km numeric(10,2),
  subtotal numeric(10,2) NOT NULL,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL,
  platform_fee numeric(10,2) NOT NULL DEFAULT 0,
  gateway_fee numeric(10,2) NOT NULL DEFAULT 0,
  store_payout numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL,
  payment_status text NOT NULL DEFAULT 'PENDING',
  asaas_payment_id text,
  invoice_url text,
  pix_qr text,
  pix_payload text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer read orders" ON public.orders FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.owns_store(store_id));
CREATE POLICY "store update orders" ON public.orders FOR UPDATE TO authenticated USING (public.owns_store(store_id)) WITH CHECK (public.owns_store(store_id));

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid,
  name text NOT NULL,
  price numeric(10,2) NOT NULL,
  qty int NOT NULL
);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.customer_id = auth.uid() OR public.owns_store(o.store_id))));

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stores;

INSERT INTO public.stores (id, name, slug, description, category, cover_url, address, lat, lng, phone, delivery_base_fee, delivery_fee_per_km, prep_time_min) VALUES
('11111111-1111-1111-1111-111111111111','Burguer da Lagoa','burguer-da-lagoa','Hambúrgueres artesanais na brasa, pertinho da Lagoa Paulino.','Lanches','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200','Av. Getúlio Vargas, Centro, Sete Lagoas',-19.4630,-44.2480,'(31) 99999-0001',3,1.5,30),
('22222222-2222-2222-2222-222222222222','Pizzaria Boa Vista','pizzaria-boa-vista','Pizzas no forno a lenha com massa de longa fermentação.','Pizza','https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200','Rua Boa Vista, Boa Vista, Sete Lagoas',-19.4560,-44.2390,'(31) 99999-0002',4,1.8,40),
('33333333-3333-3333-3333-333333333333','Mercearia Serra','mercearia-serra','Hortifruti, queijos mineiros e itens do dia a dia.','Mercado','https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200','Rua da Serra, Jardim Cambuí, Sete Lagoas',-19.4750,-44.2550,'(31) 99999-0003',2,1.2,20),
('44444444-4444-4444-4444-444444444444','Doceria Mineirinha','doceria-mineirinha','Doces caseiros, bolos e pão de queijo quentinho.','Doces','https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200','Rua Santa Juliana, Centro, Sete Lagoas',-19.4680,-44.2440,'(31) 99999-0004',3,1.5,25);

INSERT INTO public.store_hours (store_id, weekday, opens, closes)
SELECT s.id, d, '08:00', '23:00' FROM public.stores s, generate_series(0,6) d;

INSERT INTO public.products (store_id, name, description, price, image_url, section) VALUES
('11111111-1111-1111-1111-111111111111','Smash Duplo','Dois blends 90g, cheddar, cebola caramelizada.',32.90,'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600','Burgers'),
('11111111-1111-1111-1111-111111111111','Bacon Lagoa','Blend 160g, bacon crocante, molho da casa.',36.90,'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600','Burgers'),
('11111111-1111-1111-1111-111111111111','Batata Rústica','Porção 300g com alecrim.',18.00,'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600','Acompanhamentos'),
('22222222-2222-2222-2222-222222222222','Margherita','Molho de tomate, muçarela de búfala, manjericão.',54.90,'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600','Pizzas'),
('22222222-2222-2222-2222-222222222222','Calabresa Mineira','Calabresa, cebola roxa e queijo canastra.',59.90,'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600','Pizzas'),
('33333333-3333-3333-3333-333333333333','Queijo Canastra 500g','Meia cura, direto do produtor.',42.00,'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600','Laticínios'),
('33333333-3333-3333-3333-333333333333','Cesta de Frutas','Seleção da estação, 3kg.',29.90,'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600','Hortifruti'),
('44444444-4444-4444-4444-444444444444','Pão de Queijo (12un)','Assado na hora.',16.00,'https://images.unsplash.com/photo-1598142982901-df6cec2f9b5b?w=600','Salgados'),
('44444444-4444-4444-4444-444444444444','Bolo de Fubá','Inteiro, com goiabada.',28.00,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600','Doces');