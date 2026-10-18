CREATE TABLE IF NOT EXISTS public.push_tokens (token text PRIMARY KEY, user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push tokens read" ON public.push_tokens FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own push tokens delete" ON public.push_tokens FOR DELETE TO authenticated USING (user_id = auth.uid());