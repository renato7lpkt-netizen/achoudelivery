-- A fresh Supabase project grants ALL on every new public table to anon/authenticated by default.
-- Reset to exactly the grants the earlier migrations declare (RLS stays the second line of defense).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

GRANT SELECT ON public.stores, public.store_hours, public.products, public.product_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.stores, public.store_hours, public.products, public.product_options,
  public.couriers, public.store_private, public.store_couriers
  TO authenticated;
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT SELECT ON public.order_items, public.user_roles, public.payouts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.order_messages TO authenticated;
GRANT SELECT, DELETE ON public.push_tokens TO authenticated;
