import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["ASAAS_WEBHOOK_TOKEN"];
        if (!expected) {
          console.error("ASAAS_WEBHOOK_TOKEN not set; rejecting Asaas webhook");
          return new Response("Unauthorized", { status: 401 });
        }
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
        if (!timingSafeEqual(digest(request.headers.get("asaas-access-token") ?? ""), digest(expected))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const body = (await request.json().catch(() => null)) as
          | { payment?: { id: string; status: string; externalReference?: string } }
          | null;
        const p = body?.payment;
        // Not one of our orders (external references are order UUIDs): acknowledge and ignore.
        if (!p?.externalReference || !/^[0-9a-f-]{36}$/i.test(p.externalReference)) return Response.json({ ok: true });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { applyPaymentStatus } = await import("@/lib/orders.functions");
        const { data: order, error } = await supabaseAdmin
          .from("orders").select("id,asaas_payment_id").eq("id", p.externalReference).maybeSingle();
        // 500 makes Asaas retry later instead of silently dropping the event.
        if (error) {
          console.error("asaas-webhook: order lookup failed", p.externalReference, error);
          return new Response("Database error", { status: 500 });
        }
        if (order && order.asaas_payment_id === p.id) await applyPaymentStatus(supabaseAdmin, order.id, p.status);
        return Response.json({ ok: true });
      },
    },
  },
});
