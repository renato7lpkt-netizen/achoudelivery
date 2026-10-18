CREATE TABLE public.store_private (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  legal_name text NOT NULL,
  document text NOT NULL,
  responsible_name text NOT NULL,
  responsible_cpf text,
  email text NOT NULL,
  whatsapp text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_private TO authenticated;
GRANT ALL ON public.store_private TO service_role;
ALTER TABLE public.store_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner private" ON public.store_private FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND public.owns_store(store_id));