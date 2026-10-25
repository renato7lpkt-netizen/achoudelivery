import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asaas } from "./asaas.server";
import { ADDRESS_EDIT_MAX_KM, CUSTOMER_CANCELLABLE, deliveryFee, effectivePrice, haversineKm, isOpenNow, isStorePaused, maxInstallments, splitOrder } from "./market";

const Input = z.object({
  storeId: z.string().uuid(),
  items: z.array(z.object({ productId: z.string().uuid(), qty: z.number().int().min(1).max(99), options: z.array(z.string().uuid()).max(20).default([]) })).min(1),
  fulfillment: z.literal("delivery"),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  cpf: z.string().regex(/^\d{11}$|^\d{14}$/),
  email: z.string().email(),
  address: z.string().max(300).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  notes: z.string().max(300).optional(),
  method: z.enum(["PIX", "CREDIT_CARD"]),
  installments: z.number().int().min(1).max(2).optional(),
});

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: store } = await supabaseAdmin.from("stores").select("*").eq("id", data.storeId).single();
    if (!store) throw new Error("Loja indisponível");
    // Hidden stores take no orders, except test stores ordered by an admin (same rule as the
    // "admins read test stores" policy, migration 0017) so the full flow can be tried.
    if (!store.is_active) {
      const [{ data: admin }, { data: testOwner }] = await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id").eq("user_id", context.userId).eq("role", "admin").maybeSingle(),
        supabaseAdmin.from("test_accounts").select("user_id").eq("user_id", store.owner_id ?? "").maybeSingle(),
      ]);
      if (!admin || !testOwner) throw new Error("Loja indisponível");
    }
    const { data: hours } = await supabaseAdmin.from("store_hours").select("weekday,opens,closes").eq("store_id", store.id);
    if (!isOpenNow(hours ?? [], isStorePaused(store))) throw new Error("A loja está fechada agora");

    const ids = data.items.map((i) => i.productId);
    const { data: prods } = await supabaseAdmin.from("products").select("*").in("id", ids).eq("store_id", store.id);
    const optIds = data.items.flatMap((i) => i.options);
    const { data: opts } = optIds.length ? await supabaseAdmin.from("product_options").select("*").in("id", optIds) : { data: [] };
    const lines = data.items.map((i) => {
      const p = prods?.find((x) => x.id === i.productId);
      if (!p || !p.available) throw new Error("Algum produto não está mais disponível");
      const chosen = i.options.map((id) => {
        const o = opts?.find((x) => x.id === id && x.product_id === p.id);
        if (!o) throw new Error("Adicional inválido");
        return o;
      });
      const price = Math.round((effectivePrice(p) + chosen.reduce((s, o) => s + Number(o.price), 0)) * 100) / 100;
      return { product_id: p.id, name: p.name, price, qty: i.qty, options: chosen.length ? chosen.map((o) => o.name).join(", ") : null };
    });
    const subtotal = Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
    if (subtotal < Number(store.min_order)) throw new Error("Pedido abaixo do mínimo da loja");

    let fee = 0, km: number | null = null;
    if (data.fulfillment === "delivery") {
      if (!store.delivery_enabled) throw new Error("Loja não faz entrega");
      if (data.lat == null || data.lng == null || !data.address) throw new Error("Informe o endereço de entrega");
      km = Math.round(haversineKm({ lat: store.lat, lng: store.lng }, { lat: data.lat, lng: data.lng }) * 100) / 100;
      if (km > Number(store.delivery_max_km)) throw new Error(`Fora da área de entrega (${km} km)`);
      fee = deliveryFee(store, km);
    }

    const total = Math.round((subtotal + fee) * 100) / 100;
    const split = splitOrder(subtotal, fee, data.method, !!store.own_couriers);
    // Tiny orders with a platform courier would leave the store owing money after fees and the courier's share.
    if (split.payout <= 0) throw new Error("Valor dos produtos muito baixo para cobrir a entrega. Adicione mais itens.");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        store_id: store.id, customer_id: context.userId, fulfillment: data.fulfillment,
        customer_name: data.name, customer_phone: data.phone, address: data.address ?? null,
        lat: data.lat ?? null, lng: data.lng ?? null, distance_km: km, subtotal, delivery_fee: fee, total,
        platform_fee: split.platform, gateway_fee: split.gateway, store_payout: split.payout, courier_payout: split.courier,
        delivery_pin: String(crypto.getRandomValues(new Uint32Array(1))[0]! % 10000).padStart(4, "0"),
        payment_method: data.method, notes: data.notes ?? null,
      })
      .select("id").single();
    if (error || !order) throw new Error("Não foi possível criar o pedido");
    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (itemsError) {
      console.error("order_items insert failed", order.id, itemsError);
      await supabaseAdmin.from("orders").update({ status: "cancelado", payment_status: "ERROR" }).eq("id", order.id);
      throw new Error("Não foi possível criar o pedido");
    }

    try {
      const found = await asaas<{ data: { id: string }[] }>(`/customers?cpfCnpj=${data.cpf}`);
      const customerId = found.data[0]?.id ??
        (await asaas<{ id: string }>("/customers", { method: "POST", body: { name: data.name, cpfCnpj: data.cpf, email: data.email, mobilePhone: data.phone.replace(/\D/g, "") } })).id;
      const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const pay = await asaas<{ id: string; invoiceUrl: string }>("/payments", {
        method: "POST",
        body: {
          customer: customerId, billingType: data.method, value: total, dueDate: due,
          ...(data.method === "CREDIT_CARD" && Math.min(data.installments ?? 1, maxInstallments(total)) > 1
            ? { installmentCount: Math.min(data.installments ?? 1, maxInstallments(total)), totalValue: total } : {}),
          description: `Pedido AchouDelivery - ${store.name}`, externalReference: order.id,
          ...(store.asaas_wallet_id ? { split: [{ walletId: store.asaas_wallet_id, fixedValue: split.payout }] } : {}),
        },
      });
      let pix_qr: string | null = null, pix_payload: string | null = null;
      if (data.method === "PIX") {
        const qr = await asaas<{ encodedImage: string; payload: string }>(`/payments/${pay.id}/pixQrCode`);
        pix_qr = qr.encodedImage; pix_payload = qr.payload;
      }
      await supabaseAdmin.from("orders").update({ asaas_payment_id: pay.id, invoice_url: pay.invoiceUrl, pix_qr, pix_payload }).eq("id", order.id);
    } catch (e) {
      await supabaseAdmin.from("orders").update({ status: "cancelado", payment_status: "ERROR" }).eq("id", order.id);
      throw new Error(e instanceof Error ? e.message : "Falha no pagamento");
    }
    return { orderId: order.id };
  });

export const refreshPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase.from("orders").select("id,asaas_payment_id,status").eq("id", data.orderId).single();
    if (!order?.asaas_payment_id) return { status: order?.status ?? null };
    const p = await asaas<{ status: string }>(`/payments/${order.asaas_payment_id}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await applyPaymentStatus(supabaseAdmin, order.id, p.status);
    return { status: p.status };
  });

const PAID = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

/**
 * Undoes the Asaas charge of a cancelled order: refunds it when paid, deletes it while still open
 * (a deleted Pix QR can no longer be paid). Card installments are refunded/deleted as a whole.
 * Returns the payment status to store on the order.
 */
async function voidPayment(paymentId: string): Promise<string> {
  const p = await asaas<{ status: string; installment?: string | null }>(`/payments/${paymentId}`);
  const path = p.installment ? `/installments/${p.installment}` : `/payments/${paymentId}`;
  const refund = async () => (await asaas<{ status?: string }>(`${path}/refund`, { method: "POST", body: {} })).status ?? "REFUND_REQUESTED";
  if (PAID.includes(p.status)) return refund();
  if (["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS", "DELETED"].includes(p.status)) return p.status;
  try {
    await asaas(path, { method: "DELETE" });
    return "DELETED";
  } catch (e) {
    // Paid between the read and the delete: refund instead.
    const again = await asaas<{ status: string }>(`/payments/${paymentId}`);
    if (!PAID.includes(again.status)) throw e;
    return refund();
  }
}

/** Customer cancels before the store starts preparing; the payment is refunded (or the open charge deleted). */
export const cancelMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin.from("orders").select("id,status,asaas_payment_id,customer_id,stores(owner_id)").eq("id", data.orderId).maybeSingle();
    if (!order || order.customer_id !== context.userId) throw new Error("Pedido não encontrado");
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) throw new Error("A loja já começou a preparar seu pedido. Fale com a loja pelo chat.");
    // Claim first (conditional on the status we read), so the store can't start preparing in the meantime.
    const { data: moved } = await supabaseAdmin.from("orders").update({ status: "cancelado" }).eq("id", order.id).eq("status", order.status).select("id");
    if (!moved?.length) throw new Error("A situação do pedido acabou de mudar. Atualize a página.");
    if (order.asaas_payment_id) {
      try {
        const payment_status = await voidPayment(order.asaas_payment_id);
        await supabaseAdmin.from("orders").update({ payment_status }).eq("id", order.id);
      } catch (e) {
        console.error("cancelMyOrder: refund failed", order.id, e);
        await supabaseAdmin.from("orders").update({ status: order.status }).eq("id", order.id).eq("status", "cancelado");
        throw new Error("Não conseguimos estornar o pagamento agora. Tente de novo em alguns minutos ou fale com a loja.");
      }
    }
    const owner = (order.stores as { owner_id: string | null } | null)?.owner_id;
    if (order.status === "pago" && owner) {
      try {
        const { sendPushToUser } = await import("@/lib/push.server");
        await sendPushToUser(supabaseAdmin, owner, "❌ Pedido cancelado pelo cliente", `Pedido #${order.id.slice(0, 8)} foi cancelado antes do preparo. O valor foi estornado ao cliente.`, "/painel");
      } catch (e) {
        console.error("cancelMyOrder: push failed", order.id, e);
      }
    }
    return { ok: true };
  });

/**
 * Customer fixes the delivery point (number, gate, wrong pin) before the store starts preparing.
 * Only small moves (ADDRESS_EDIT_MAX_KM) so the delivery fee already charged still holds;
 * goes through the service role because orders_guard blocks address edits from the browser.
 */
export const updateOrderAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), address: z.string().trim().min(3).max(300), lat: z.number(), lng: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin.from("orders").select("id,status,customer_id,lat,lng,stores(owner_id)").eq("id", data.orderId).maybeSingle();
    if (!order || order.customer_id !== context.userId) throw new Error("Pedido não encontrado");
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) throw new Error("A loja já começou a preparar. Fale com a loja pelo chat para ajustar o endereço.");
    if (order.lat != null && order.lng != null && haversineKm({ lat: order.lat, lng: order.lng }, data) > ADDRESS_EDIT_MAX_KM) {
      throw new Error("O novo ponto ficou longe do endereço do pedido. Para entregar em outro lugar, cancele e faça um novo pedido.");
    }
    const { data: moved } = await supabaseAdmin.from("orders").update({ address: data.address, lat: data.lat, lng: data.lng })
      .eq("id", order.id).in("status", CUSTOMER_CANCELLABLE).select("id");
    if (!moved?.length) throw new Error("A situação do pedido acabou de mudar. Atualize a página.");
    const owner = (order.stores as { owner_id: string | null } | null)?.owner_id;
    if (owner && order.status === "pago") {
      try {
        const { sendPushToUser } = await import("@/lib/push.server");
        await sendPushToUser(supabaseAdmin, owner, "📍 Endereço ajustado pelo cliente", `Pedido #${order.id.slice(0, 8)}: ${data.address}`, "/painel");
      } catch (e) {
        console.error("updateOrderAddress: push failed", order.id, e);
      }
    }
    return { ok: true };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyPaymentStatus(admin: any, orderId: string, status: string) {
  const paid = PAID.includes(status);
  const failed = ["OVERDUE", "REFUNDED", "CHARGEBACK_REQUESTED", "DELETED"].includes(status);
  const next = paid ? "pago" : failed ? "cancelado" : null;
  // Conditional transition: when webhook and manual refresh race, only one call wins and notifies the store.
  const { data: moved } = next
    ? await admin.from("orders").update({ payment_status: status, status: next }).eq("id", orderId).eq("status", "aguardando_pagamento").select("id")
    : { data: [] };
  if (!moved?.length) await admin.from("orders").update({ payment_status: status }).eq("id", orderId);
  if (next === "pago" && moved?.length) {
    try {
      const { notifyStoreNewOrder } = await import("@/lib/push.server");
      await notifyStoreNewOrder(admin, orderId);
    } catch (e) {
      console.error("notifyStoreNewOrder failed", orderId, e);
    }
  }
}
