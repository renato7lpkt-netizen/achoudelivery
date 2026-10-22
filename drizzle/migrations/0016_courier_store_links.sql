-- Courier ↔ store affiliation with a 6-digit code.
-- The courier app makes a one-time code (10 min); the store owner types it and picks how long the courier
-- works for the store. While the link is active the store can assign its orders to that courier.
-- Payment of affiliated couriers is agreed directly between store and courier (outside the app).
-- All access goes through the RPCs below; the tables have no client grants.

CREATE TABLE IF NOT EXISTS public.courier_link_codes (
  code text PRIMARY KEY CHECK (code ~ '^[0-9]{6}$'),
  courier_id uuid NOT NULL UNIQUE REFERENCES public.couriers(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.store_courier_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  ended_at timestamptz, -- set when the store or the courier ends it early
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_courier_links_courier_idx ON public.store_courier_links (courier_id, ends_at);
CREATE INDEX IF NOT EXISTS store_courier_links_store_idx ON public.store_courier_links (store_id, ends_at);

-- Wrong codes typed by a store, to stop guessing (5 per 15 min).
CREATE TABLE IF NOT EXISTS public.link_code_attempts (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS link_code_attempts_idx ON public.link_code_attempts (store_id, created_at);

ALTER TABLE public.courier_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_courier_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_code_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.courier_link_codes, public.store_courier_links, public.link_code_attempts FROM PUBLIC, anon, authenticated;

-- 1) Courier: new code (replaces the previous one).
CREATE OR REPLACE FUNCTION public.link_code_create() RETURNS TABLE (code text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE me uuid := public.my_courier_id(); c text; exp timestamptz := now() + interval '10 minutes'; tries int := 0;
BEGIN
  IF me IS NULL OR NOT EXISTS (SELECT 1 FROM public.couriers WHERE id = me AND approval_status = 'aprovado') THEN
    RAISE EXCEPTION 'Seu cadastro precisa estar aprovado para se afiliar a uma loja';
  END IF;
  DELETE FROM public.courier_link_codes k WHERE k.expires_at < now() OR k.courier_id = me;
  LOOP
    c := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
    BEGIN
      INSERT INTO public.courier_link_codes (code, courier_id, expires_at) VALUES (c, me, exp);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 20 THEN RAISE; END IF;
    END;
  END LOOP;
  RETURN QUERY SELECT c, exp;
END $$;

-- Internal: courier behind a code typed by the owner of _store (NULL = wrong/expired; counts as a failed attempt).
-- Test accounts (migration 0015) only link to test stores and vice versa.
CREATE OR REPLACE FUNCTION public._link_code_courier(_store uuid, _code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  IF NOT public.owns_store(_store) THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;
  IF (SELECT count(*) FROM public.link_code_attempts WHERE store_id = _store AND created_at > now() - interval '15 minutes') >= 5 THEN
    RAISE EXCEPTION 'Muitas tentativas erradas. Espere 15 minutos e peça um código novo ao entregador.';
  END IF;
  SELECT k.courier_id INTO cid
  FROM public.courier_link_codes k
    JOIN public.couriers c ON c.id = k.courier_id
    JOIN public.stores s ON s.id = _store
  WHERE k.code = _code AND k.expires_at > now() AND c.approval_status = 'aprovado'
    AND EXISTS (SELECT 1 FROM public.test_accounts t WHERE t.user_id = c.user_id)
      = EXISTS (SELECT 1 FROM public.test_accounts t WHERE t.user_id = s.owner_id)
  FOR UPDATE OF k;
  IF cid IS NULL THEN INSERT INTO public.link_code_attempts (store_id) VALUES (_store); END IF;
  RETURN cid;
END $$;

-- Internal: active link of a courier with another store, if any.
CREATE OR REPLACE FUNCTION public._linked_elsewhere(_courier uuid, _store uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_courier_links
                 WHERE courier_id = _courier AND store_id <> _store AND ended_at IS NULL AND ends_at > now())
$$;

-- 2) Store: who is behind the code (to confirm before linking).
CREATE OR REPLACE FUNCTION public.link_code_lookup(_store uuid, _code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid := public._link_code_courier(_store, _code); r record;
BEGIN
  IF cid IS NULL THEN RETURN jsonb_build_object('error', 'Código inválido ou vencido. Peça um código novo ao entregador.'); END IF;
  IF public._linked_elsewhere(cid, _store) THEN
    RETURN jsonb_build_object('error', 'Esse entregador está afiliado a outra loja agora. Ele precisa encerrar lá antes.');
  END IF;
  SELECT name, vehicle, plate INTO r FROM public.couriers WHERE id = cid;
  RETURN jsonb_build_object('name', r.name, 'vehicle', r.vehicle, 'plate', r.plate);
END $$;

-- 3) Store: link the courier for _minutes (1 hour to 8 weeks). Linking again with the same store renews it.
CREATE OR REPLACE FUNCTION public.link_code_redeem(_store uuid, _code text, _minutes int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; lid uuid;
BEGIN
  IF _minutes IS NULL OR _minutes < 60 OR _minutes > 80640 THEN
    RETURN jsonb_build_object('error', 'Escolha um prazo entre 1 hora e 8 semanas.');
  END IF;
  cid := public._link_code_courier(_store, _code);
  IF cid IS NULL THEN RETURN jsonb_build_object('error', 'Código inválido ou vencido. Peça um código novo ao entregador.'); END IF;
  IF public._linked_elsewhere(cid, _store) THEN
    RETURN jsonb_build_object('error', 'Esse entregador está afiliado a outra loja agora. Ele precisa encerrar lá antes.');
  END IF;
  UPDATE public.store_courier_links SET ended_at = now()
  WHERE courier_id = cid AND store_id = _store AND ended_at IS NULL AND ends_at > now();
  INSERT INTO public.store_courier_links (store_id, courier_id, ends_at)
  VALUES (_store, cid, now() + make_interval(mins => _minutes)) RETURNING id INTO lid;
  DELETE FROM public.courier_link_codes WHERE courier_id = cid;
  RETURN jsonb_build_object('link_id', lid);
END $$;

-- 4) Store: its affiliated couriers (active + ended in the last 30 days) with deliveries made in the period.
CREATE OR REPLACE FUNCTION public.store_links(_store uuid)
RETURNS TABLE (link_id uuid, courier_id uuid, name text, phone text, vehicle text, plate text, available boolean,
               starts_at timestamptz, ends_at timestamptz, ended_at timestamptz, deliveries int, km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, c.id, c.name, c.phone, c.vehicle, c.plate, c.available, l.starts_at, l.ends_at, l.ended_at, d.n, d.km
  FROM public.store_courier_links l
    JOIN public.couriers c ON c.id = l.courier_id
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS n, coalesce(sum(o.distance_km), 0)::numeric AS km FROM public.orders o
      WHERE o.store_id = l.store_id AND o.courier_id = l.courier_id AND o.status = 'concluido'
        AND o.created_at >= l.starts_at AND o.created_at < coalesce(l.ended_at, l.ends_at)
    ) d
  WHERE l.store_id = _store AND public.owns_store(_store)
    AND coalesce(l.ended_at, l.ends_at) > now() - interval '30 days'
  ORDER BY (l.ended_at IS NULL AND l.ends_at > now()) DESC, l.ends_at DESC
$$;

-- 5) Courier: own links (active + ended in the last 30 days) with deliveries made in the period.
CREATE OR REPLACE FUNCTION public.courier_links()
RETURNS TABLE (link_id uuid, store_name text, store_address text, store_phone text,
               starts_at timestamptz, ends_at timestamptz, ended_at timestamptz, deliveries int, km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, s.name, s.address, s.phone, l.starts_at, l.ends_at, l.ended_at, d.n, d.km
  FROM public.store_courier_links l
    JOIN public.stores s ON s.id = l.store_id
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS n, coalesce(sum(o.distance_km), 0)::numeric AS km FROM public.orders o
      WHERE o.store_id = l.store_id AND o.courier_id = l.courier_id AND o.status = 'concluido'
        AND o.created_at >= l.starts_at AND o.created_at < coalesce(l.ended_at, l.ends_at)
    ) d
  WHERE l.courier_id = public.my_courier_id()
    AND coalesce(l.ended_at, l.ends_at) > now() - interval '30 days'
  ORDER BY (l.ended_at IS NULL AND l.ends_at > now()) DESC, l.ends_at DESC
$$;

-- 6) Store or courier ends an active link early.
CREATE OR REPLACE FUNCTION public.link_end(_link uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.store_courier_links SET ended_at = now()
  WHERE id = _link AND ended_at IS NULL AND ends_at > now()
    AND (public.owns_store(store_id) OR courier_id = public.my_courier_id());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- Used by orders_guard (SECURITY INVOKER): is _courier actively linked to _store, which the caller owns?
CREATE OR REPLACE FUNCTION public.is_affiliated(_store uuid, _courier uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.owns_store(_store) AND EXISTS (
    SELECT 1 FROM public.store_courier_links
    WHERE store_id = _store AND courier_id = _courier AND ended_at IS NULL AND ends_at > now())
$$;

-- Stores now see only their affiliated couriers (plus whoever is on one of their open orders),
-- instead of every approved courier with phone number. Customers still see their order's courier.
CREATE OR REPLACE FUNCTION public.list_couriers()
RETURNS TABLE (id uuid, name text, phone text, vehicle text, plate text, available boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.phone, c.vehicle, c.plate, c.available FROM public.couriers c
  WHERE c.approval_status = 'aprovado' AND (
       EXISTS (SELECT 1 FROM public.store_courier_links l
               WHERE l.courier_id = c.id AND l.ended_at IS NULL AND l.ends_at > now() AND public.owns_store(l.store_id))
    OR EXISTS (SELECT 1 FROM public.orders o
               WHERE o.courier_id = c.id AND o.status IN ('pago', 'preparando', 'saiu_entrega') AND public.owns_store(o.store_id))
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.courier_id = c.id AND o.customer_id = auth.uid()))
  ORDER BY c.available DESC, c.name
$$;

-- orders_guard (must stay SECURITY INVOKER, see AGENTS.md): a store may only put an affiliated courier on an order
-- (or clear it). Platform couriers still take orders through accept_delivery (SECURITY DEFINER, not affected).
CREATE OR REPLACE FUNCTION public.orders_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.total := OLD.total; NEW.subtotal := OLD.subtotal; NEW.delivery_fee := OLD.delivery_fee;
    NEW.store_payout := OLD.store_payout; NEW.platform_fee := OLD.platform_fee; NEW.gateway_fee := OLD.gateway_fee;
    NEW.courier_payout := OLD.courier_payout; NEW.courier_payout_id := OLD.courier_payout_id; NEW.payout_id := OLD.payout_id;
    NEW.payment_status := OLD.payment_status; NEW.payment_method := OLD.payment_method; NEW.asaas_payment_id := OLD.asaas_payment_id;
    NEW.invoice_url := OLD.invoice_url; NEW.pix_qr := OLD.pix_qr; NEW.pix_payload := OLD.pix_payload;
    NEW.delivery_pin := OLD.delivery_pin; NEW.delivered_at := OLD.delivered_at; NEW.rating := OLD.rating; NEW.review := OLD.review;
    NEW.customer_id := OLD.customer_id; NEW.store_id := OLD.store_id; NEW.fulfillment := OLD.fulfillment;
    NEW.customer_name := OLD.customer_name; NEW.customer_phone := OLD.customer_phone;
    NEW.address := OLD.address; NEW.lat := OLD.lat; NEW.lng := OLD.lng; NEW.distance_km := OLD.distance_km;
    IF NEW.courier_id IS DISTINCT FROM OLD.courier_id AND NEW.courier_id IS NOT NULL
       AND NOT public.is_affiliated(OLD.store_id, NEW.courier_id) THEN
      NEW.courier_id := OLD.courier_id;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
         (OLD.status = 'pago' AND NEW.status IN ('preparando', 'cancelado'))
      OR (OLD.status = 'preparando' AND NEW.status IN ('saiu_entrega', 'cancelado'))
    ) THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public._link_code_courier(uuid, text), public._linked_elsewhere(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_code_create(), public.link_code_lookup(uuid, text), public.link_code_redeem(uuid, text, int),
  public.store_links(uuid), public.courier_links(), public.link_end(uuid), public.is_affiliated(uuid, uuid), public.list_couriers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_code_create(), public.link_code_lookup(uuid, text), public.link_code_redeem(uuid, text, int),
  public.store_links(uuid), public.courier_links(), public.link_end(uuid), public.is_affiliated(uuid, uuid), public.list_couriers() TO authenticated;
