-- Admins can open and order from hidden test stores (owner in test_accounts, migration 0015), e.g. the
-- "Loja Demonstração" used by the Play Store reviewer, to try the full customer flow. The storefront list
-- still filters is_active, so customers never see them. createOrder applies the same rule server-side.
DROP POLICY IF EXISTS "admins read test stores" ON public.stores;
CREATE POLICY "admins read test stores" ON public.stores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM public.test_accounts t WHERE t.user_id = owner_id));

-- Test stores stay open all day, every day, so testers and the Play reviewer can order at any time
-- (00:00–00:00 counts as open the whole day in isOpenNow).
DELETE FROM public.store_hours h USING public.stores s
WHERE h.store_id = s.id AND EXISTS (SELECT 1 FROM public.test_accounts t WHERE t.user_id = s.owner_id);
INSERT INTO public.store_hours (store_id, weekday, opens, closes)
SELECT s.id, wd, '00:00', '00:00'
FROM public.stores s CROSS JOIN generate_series(0, 6) AS wd
WHERE EXISTS (SELECT 1 FROM public.test_accounts t WHERE t.user_id = s.owner_id);
