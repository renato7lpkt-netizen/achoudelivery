DO $$ DECLARE r record; BEGIN
FOR r IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND p.proname <> 'top_products' LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  IF r.proname NOT IN ('couriers_guard','orders_guard','stores_guard') THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  ELSE
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
  END IF;
END LOOP; END $$;