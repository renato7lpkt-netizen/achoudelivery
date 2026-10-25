-- 0017's policy read test_accounts directly, which `authenticated` cannot SELECT (no client grants), so every
-- store query from a logged-in user failed with 403. Check it through a SECURITY DEFINER helper instead.
CREATE OR REPLACE FUNCTION public.is_test_user(_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.test_accounts WHERE user_id = _user)
$$;
REVOKE EXECUTE ON FUNCTION public.is_test_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_test_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "admins read test stores" ON public.stores;
CREATE POLICY "admins read test stores" ON public.stores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.is_test_user(owner_id));
