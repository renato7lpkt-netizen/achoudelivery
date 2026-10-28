-- Store cancellations now go through the storeCancelOrder server fn (service role), which refunds the
-- customer. Clients may no longer set status 'cancelado' themselves, so a cancel can't skip the refund.
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
         (OLD.status = 'pago' AND NEW.status = 'preparando')
      OR (OLD.status = 'preparando' AND NEW.status = 'saiu_entrega')
    ) THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;
