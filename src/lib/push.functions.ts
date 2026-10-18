import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ORDER_STATUS } from "@/lib/market";

export const savePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(20).max(4096) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_tokens").upsert({ token: data.token, user_id: context.userId });
    return { ok: true };
  });

// Loja avisa o cliente quando muda o status do pedido.
export const notifyOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin.from("orders").select("id,status,customer_id,stores(owner_id,name)").eq("id", data.orderId).maybeSingle();
    const store = (o as any)?.stores;
    if (!o || store?.owner_id !== context.userId) return { ok: false };
    const { sendPushToUser } = await import("@/lib/push.server");
    const label = (ORDER_STATUS as Record<string, any>)[o.status];
    const text = typeof label === "string" ? label : label?.label ?? o.status;
    await sendPushToUser(supabaseAdmin, o.customer_id, store?.name ?? "AchouDelivery", `Seu pedido: ${text}`, `/pedido/${o.id}`);
    return { ok: true };
  });
