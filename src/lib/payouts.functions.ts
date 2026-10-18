import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asaas } from "./asaas.server";

const KEY_TYPE: Record<string, string> = { CPF: "CPF", CNPJ: "CNPJ", "E-mail": "EMAIL", Celular: "PHONE", "Aleatória": "EVP" };

async function assertAdmin(ctx: { supabase: any; userId: string }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito");
}

/** Lojas com vendas entregues ainda não repassadas. */
export const pendingPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders } = await supabaseAdmin.from("orders").select("store_id, store_payout")
      .eq("status", "concluido").is("payout_id", null).not("asaas_payment_id", "is", null);
    const { data: stores } = await supabaseAdmin.from("stores").select("id,name,pix_key,pix_key_type,asaas_wallet_id");
    const map = new Map<string, { amount: number; count: number }>();
    for (const o of orders ?? []) {
      const m = map.get(o.store_id) ?? { amount: 0, count: 0 };
      m.amount += Number(o.store_payout); m.count++; map.set(o.store_id, m);
    }
    return [...map.entries()].map(([id, m]) => {
      const s = stores?.find((x) => x.id === id);
      return { storeId: id, name: s?.name ?? "—", pixKey: s?.pix_key ?? null, pixType: s?.pix_key_type ?? null, splitAuto: !!s?.asaas_wallet_id, amount: Math.round(m.amount * 100) / 100, count: m.count };
    }).filter((x) => !x.splitAuto);
  });

/** Faz o Pix de repasse pela conta Asaas do AchouDelivery. */
export const sendPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("stores").select("id,name,pix_key,pix_key_type").eq("id", data.storeId).single();
    if (!s?.pix_key || !s.pix_key_type || !KEY_TYPE[s.pix_key_type]) throw new Error("Loja sem chave Pix cadastrada");
    const { data: orders } = await supabaseAdmin.from("orders").select("id, store_payout").eq("store_id", s.id).eq("status", "concluido").is("payout_id", null).not("asaas_payment_id", "is", null);
    const amount = Math.round((orders ?? []).reduce((t, o) => t + Number(o.store_payout), 0) * 100) / 100;
    if (!orders?.length || amount <= 0) throw new Error("Nada a repassar");
    const { data: p } = await supabaseAdmin.from("payouts").insert({ store_id: s.id, amount, orders_count: orders.length, pix_key: s.pix_key }).select("id").single();
    if (!p) throw new Error("Falha ao registrar repasse");
    await supabaseAdmin.from("orders").update({ payout_id: p.id }).in("id", orders.map((o) => o.id));
    try {
      const t = await asaas<{ id: string; status: string }>("/transfers", {
        method: "POST",
        body: { value: amount, operationType: "PIX", pixAddressKey: s.pix_key, pixAddressKeyType: KEY_TYPE[s.pix_key_type], description: `Repasse AchouDelivery - ${s.name}` },
      });
      await supabaseAdmin.from("payouts").update({ status: "enviado", asaas_transfer_id: t.id }).eq("id", p.id);
      return { ok: true, amount };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no Pix";
      await supabaseAdmin.from("payouts").update({ status: "erro", error: msg }).eq("id", p.id);
      await supabaseAdmin.from("orders").update({ payout_id: null }).eq("payout_id", p.id);
      throw new Error(msg);
    }
  });

/** Link temporário para o admin ver o documento do entregador. */
export const courierDocUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: u } = await context.supabase.storage.from("courier-docs").createSignedUrl(data.path, 300);
    if (!u) throw new Error("Documento não encontrado");
    return { url: u.signedUrl };
  });
