import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Delivery PINs of the signed-in customer's open orders (orders.delivery_pin itself is not readable since migration 0014). */
export function useMyOrderPins(enabled = true) {
  return useQuery({
    queryKey: ["my-order-pins"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_order_pins");
      if (error) return new Map<string, string>(); // before the migration runs there is no RPC: just hide the PIN
      return new Map((data ?? []).map((r) => [r.order_id, r.pin]));
    },
  });
}
