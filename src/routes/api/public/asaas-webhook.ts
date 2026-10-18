import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["ASAAS_WEBHOOK_TOKEN"];
        if (!expected || request.headers.get("asaas-access-token") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const body = (await request.json().catch(() => null)) as
          | { payment?: { id: string; status: string; externalReference?: string } }
          | null;
        const p = body?.payment;
        if (!p?.externalReference) return Response.json({ ok: true });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { applyPaymentStatus } = await import("@/lib/orders.functions");
        const { data: order } = await supabaseAdmin
          .from("orders").select("id,asaas_payment_id").eq("id", p.externalReference).maybeSingle();
        if (order && order.asaas_payment_id === p.id) await applyPaymentStatus(supabaseAdmin, order.id, p.status);
        return Response.json({ ok: true });
      },
    },
  },
});
