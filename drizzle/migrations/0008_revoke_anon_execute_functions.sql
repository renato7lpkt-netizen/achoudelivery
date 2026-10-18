-- Impede que visitantes sem login chamem funções internas do banco.
-- As funções continuam disponíveis para usuários logados (authenticated),
-- que é quem de fato usa o app.
REVOKE EXECUTE ON FUNCTION public.confirm_delivery(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.courier_update_order(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_couriers() FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_courier_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.order_party(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_store(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rate_order(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.top_products(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_courier_location(uuid, double precision, double precision) FROM anon;