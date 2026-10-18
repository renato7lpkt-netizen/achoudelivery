ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS own_couriers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS rain_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS rating_avg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS promo_price numeric,
  ADD COLUMN IF NOT EXISTS promo_days integer[] NOT NULL DEFAULT '{}';
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_pin text,
  ADD COLUMN IF NOT EXISTS rating integer,
  ADD COLUMN IF NOT EXISTS review text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'em_analise',
  ADD COLUMN IF NOT EXISTS reject_reason text;
UPDATE public.couriers SET approval_status = 'aprovado' WHERE approval_status = 'em_analise' AND created_at < now();

-- Couriers can't self-approve
CREATE OR REPLACE FUNCTION public.couriers_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.approval_status := 'em_analise'; NEW.reject_reason := NULL;
  ELSIF NEW.approval_status IS DISTINCT FROM OLD.approval_status AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.approval_status := OLD.approval_status; NEW.reject_reason := OLD.reject_reason;
  END IF;
  RETURN NEW;
END $$;

CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TRIGGER couriers_guard BEFORE INSERT OR UPDATE ON public.couriers FOR EACH ROW EXECUTE FUNCTION public.couriers_guard();
CREATE POLICY "admin read couriers" ON public.couriers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update couriers" ON public.couriers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Store own delivery team
CREATE TABLE public.store_couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  whatsapp text NOT NULL,
  plate text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_couriers TO authenticated;
GRANT ALL ON public.store_couriers TO service_role;
ALTER TABLE public.store_couriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manage team" ON public.store_couriers FOR ALL TO authenticated USING (public.owns_store(store_id)) WITH CHECK (public.owns_store(store_id));

-- Only approved couriers are listed to stores
CREATE OR REPLACE FUNCTION public.list_couriers()
 RETURNS TABLE(id uuid, name text, phone text, vehicle text, plate text, available boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.name, c.phone, c.vehicle, c.plate, c.available FROM public.couriers c
  WHERE c.approval_status = 'aprovado' AND (
     EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.orders o WHERE o.courier_id = c.id AND o.customer_id = auth.uid()))
  ORDER BY c.available DESC, c.name
$function$;

-- Courier: only pickup via this fn; completion requires PIN
CREATE OR REPLACE FUNCTION public.courier_update_order(_order uuid, _status text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _status <> 'saiu_entrega' THEN RAISE EXCEPTION 'use o PIN para concluir'; END IF;
  UPDATE public.orders SET status = _status
  WHERE id = _order AND courier_id IS NOT NULL AND courier_id = public.my_courier_id() AND status = 'preparando';
END $function$;

CREATE OR REPLACE FUNCTION public.confirm_delivery(_order uuid, _pin text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  UPDATE public.orders SET status = 'concluido', delivered_at = now()
  WHERE id = _order AND status = 'saiu_entrega' AND delivery_pin = _pin
    AND ((courier_id IS NOT NULL AND courier_id = public.my_courier_id()) OR public.owns_store(store_id));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $function$;
GRANT EXECUTE ON FUNCTION public.confirm_delivery(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rate_order(_order uuid, _rating int, _review text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sid uuid;
BEGIN
  IF _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'nota inválida'; END IF;
  UPDATE public.orders SET rating = _rating, review = left(coalesce(_review,''), 500)
  WHERE id = _order AND customer_id = auth.uid() AND status = 'concluido' AND rating IS NULL
  RETURNING store_id INTO sid;
  IF sid IS NULL THEN RAISE EXCEPTION 'não é possível avaliar'; END IF;
  UPDATE public.stores s SET rating_count = x.c, rating_avg = x.a
  FROM (SELECT count(*) c, round(avg(rating)::numeric, 1) a FROM public.orders WHERE store_id = sid AND rating IS NOT NULL) x
  WHERE s.id = sid;
END $function$;
GRANT EXECUTE ON FUNCTION public.rate_order(uuid, int, text) TO authenticated;

-- Store owners cannot change rating/pin on orders, nor rating aggregates
CREATE OR REPLACE FUNCTION public.orders_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.delivery_pin := OLD.delivery_pin; NEW.rating := OLD.rating; NEW.review := OLD.review;
    NEW.total := OLD.total; NEW.subtotal := OLD.subtotal; NEW.delivery_fee := OLD.delivery_fee;
    NEW.store_payout := OLD.store_payout; NEW.platform_fee := OLD.platform_fee;
    IF NEW.status = 'concluido' AND OLD.status = 'saiu_entrega' AND OLD.fulfillment = 'delivery' AND NEW.delivered_at IS NULL THEN
      NEW.status := OLD.status; -- delivery completion only via PIN
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_guard BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_guard();

CREATE OR REPLACE FUNCTION public.stores_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'UPDATE' THEN NEW.rating_avg := OLD.rating_avg; NEW.rating_count := OLD.rating_count;
    ELSE NEW.rating_avg := 0; NEW.rating_count := 0; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stores_guard BEFORE INSERT OR UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.stores_guard();