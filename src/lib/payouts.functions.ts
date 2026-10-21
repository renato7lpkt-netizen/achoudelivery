import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asaas, AsaasError } from "./asaas.server";

const KEY_TYPE: Record<string, string> = { CPF: "CPF", CNPJ: "CNPJ", "E-mail": "EMAIL", Celular: "PHONE", "Aleatória": "EVP" };
// Only orders whose money actually arrived in the Asaas account can be paid out.
const PAID = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const r2 = (n: number) => Math.round(n * 100) / 100;

async function assertAdmin(ctx: { supabase: any; userId: string }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito");
}

/**
 * Claims the orders for one payout record and sends the Pix.
 * Claiming first (only rows still unclaimed) means a concurrent payout can never pay the same order twice.
 */
async function claimAndTransfer(admin: any, o: { // eslint-disable-line @typescript-eslint/no-explicit-any
  payoutTable: "payouts" | "courier_payouts"; claimCol: "payout_id" | "courier_payout_id"; payoutId: string;
  orderIds: string[]; amount: number; pixKey: string; pixType: string; description: string;
}) {
  const { data: claimed } = await admin.from("orders").update({ [o.claimCol]: o.payoutId })
    .in("id", o.orderIds).is(o.claimCol, null).select("id");
  if ((claimed?.length ?? 0) !== o.orderIds.length) {
    await admin.from("orders").update({ [o.claimCol]: null }).eq(o.claimCol, o.payoutId);
    await admin.from(o.payoutTable).update({ status: "erro", error: "Repasse concorrente em andamento" }).eq("id", o.payoutId);
    throw new Error("Já existe um repasse em andamento para este destinatário. Atualize a página.");
  }
  try {
    const t = await asaas<{ id: string; status: string }>("/transfers", {
      method: "POST",
      body: { value: o.amount, operationType: "PIX", pixAddressKey: o.pixKey, pixAddressKeyType: KEY_TYPE[o.pixType], description: o.description },
    });
    await admin.from(o.payoutTable).update({ status: "enviado", asaas_transfer_id: t.id }).eq("id", o.payoutId);
    return { ok: true, amount: o.amount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha no Pix";
    if (!(e instanceof AsaasError)) {
      // Network failure/timeout: the transfer may have gone through, so keep the orders claimed
      // (no retry can double-pay) and leave it for the admin to check in the Asaas dashboard.
      await admin.from(o.payoutTable).update({ status: "verificar", error: msg }).eq("id", o.payoutId);
      throw new Error("Sem resposta do Asaas. Confira no painel do Asaas se o Pix saiu antes de tentar de novo.");
    }
    await admin.from(o.payoutTable).update({ status: "erro", error: msg }).eq("id", o.payoutId);
    await admin.from("orders").update({ [o.claimCol]: null }).eq(o.claimCol, o.payoutId);
    throw new Error(msg);
  }
}

/** Lojas com vendas entregues ainda não repassadas. */
export const pendingPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders } = await supabaseAdmin.from("orders").select("store_id, store_payout")
      .eq("status", "concluido").is("payout_id", null).not("asaas_payment_id", "is", null).in("payment_status", PAID);
    const { data: stores } = await supabaseAdmin.from("stores").select("id,name,pix_key,pix_key_type,asaas_wallet_id");
    const map = new Map<string, { amount: number; count: number }>();
    for (const o of orders ?? []) {
      const m = map.get(o.store_id) ?? { amount: 0, count: 0 };
      m.amount += Number(o.store_payout); m.count++; map.set(o.store_id, m);
    }
    return [...map.entries()].map(([id, m]) => {
      const s = stores?.find((x) => x.id === id);
      return { storeId: id, name: s?.name ?? "—", pixKey: s?.pix_key ?? null, pixType: s?.pix_key_type ?? null, splitAuto: !!s?.asaas_wallet_id, amount: r2(m.amount), count: m.count };
    }).filter((x) => !x.splitAuto);
  });

/** Faz o Pix de repasse pela conta Asaas do AchouDelivery. */
export const sendPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("stores").select("id,name,pix_key,pix_key_type,asaas_wallet_id").eq("id", data.storeId).single();
    if (!s?.pix_key || !s.pix_key_type || !KEY_TYPE[s.pix_key_type]) throw new Error("Loja sem chave Pix cadastrada");
    // Split stores already receive their share automatically on each payment.
    if (s.asaas_wallet_id) throw new Error("Loja recebe por split automático; repasse manual não é necessário");
    const { data: orders } = await supabaseAdmin.from("orders").select("id, store_payout").eq("store_id", s.id)
      .eq("status", "concluido").is("payout_id", null).not("asaas_payment_id", "is", null).in("payment_status", PAID);
    const amount = r2((orders ?? []).reduce((t, o) => t + Number(o.store_payout), 0));
    if (!orders?.length || amount <= 0) throw new Error("Nada a repassar");
    const { data: p } = await supabaseAdmin.from("payouts").insert({ store_id: s.id, amount, orders_count: orders.length, pix_key: s.pix_key }).select("id").single();
    if (!p) throw new Error("Falha ao registrar repasse");
    return claimAndTransfer(supabaseAdmin, {
      payoutTable: "payouts", claimCol: "payout_id", payoutId: p.id, orderIds: orders.map((o) => o.id),
      amount, pixKey: s.pix_key, pixType: s.pix_key_type, description: `Repasse AchouDelivery - ${s.name}`,
    });
  });

/** Entregadores da plataforma com entregas concluídas ainda não pagas. */
export const pendingCourierPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders } = await supabaseAdmin.from("orders").select("courier_id, courier_payout")
      .eq("status", "concluido").is("courier_payout_id", null).gt("courier_payout", 0).not("courier_id", "is", null).in("payment_status", PAID);
    const { data: couriers } = await supabaseAdmin.from("couriers").select("id,name,phone,pix_key,pix_key_type");
    const map = new Map<string, { amount: number; count: number }>();
    for (const o of orders ?? []) {
      if (!o.courier_id) continue;
      const m = map.get(o.courier_id) ?? { amount: 0, count: 0 };
      m.amount += Number(o.courier_payout); m.count++; map.set(o.courier_id, m);
    }
    return [...map.entries()].map(([id, m]) => {
      const c = couriers?.find((x) => x.id === id);
      return { courierId: id, name: c?.name ?? "—", phone: c?.phone ?? "", pixKey: c?.pix_key ?? null, pixType: c?.pix_key_type ?? null, amount: r2(m.amount), count: m.count };
    }).sort((a, b) => b.amount - a.amount);
  });

/** Pix do total devido a um entregador, pela conta Asaas do AchouDelivery. */
export const sendCourierPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courierId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("couriers").select("id,name,pix_key,pix_key_type").eq("id", data.courierId).single();
    if (!c?.pix_key || !c.pix_key_type || !KEY_TYPE[c.pix_key_type]) throw new Error("Entregador sem chave Pix (ou sem o tipo da chave) cadastrada");
    const { data: orders } = await supabaseAdmin.from("orders").select("id, courier_payout").eq("courier_id", c.id)
      .eq("status", "concluido").is("courier_payout_id", null).gt("courier_payout", 0).in("payment_status", PAID);
    const amount = r2((orders ?? []).reduce((t, o) => t + Number(o.courier_payout), 0));
    if (!orders?.length || amount <= 0) throw new Error("Nada a repassar");
    const { data: p } = await supabaseAdmin.from("courier_payouts").insert({ courier_id: c.id, amount, orders_count: orders.length, pix_key: c.pix_key }).select("id").single();
    if (!p) throw new Error("Falha ao registrar repasse");
    return claimAndTransfer(supabaseAdmin, {
      payoutTable: "courier_payouts", claimCol: "courier_payout_id", payoutId: p.id, orderIds: orders.map((o) => o.id),
      amount, pixKey: c.pix_key, pixType: c.pix_key_type, description: `Entregas AchouDelivery - ${c.name}`,
    });
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
