import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Perfis do usuário logado: loja, entregador e admin (lidos com as regras de acesso do banco). */
export function useRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [s, c, r] = await Promise.all([
        supabase.from("stores").select("id").eq("owner_id", userId!).limit(1),
        supabase.from("couriers").select("id").eq("user_id", userId!).limit(1),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      return {
        isStore: (s.data?.length ?? 0) > 0,
        isCourier: (c.data?.length ?? 0) > 0,
        isAdmin: (r.data ?? []).some((x) => x.role === "admin"),
      };
    },
  });
}
