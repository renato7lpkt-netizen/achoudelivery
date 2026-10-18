const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

export async function sendPushToUser(admin: any, userId: string, title: string, body: string, path = "/") {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovable || !conn || !userId) return;
  const { data: rows } = await admin.from("push_tokens").select("token").eq("user_id", userId);
  for (const { token } of (rows ?? []) as { token: string }[]) {
    try {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": conn, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: { path },
            webpush: { fcm_options: { link: path }, notification: { icon: "/icon-192.png", requireInteraction: true } },
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error(`FCM send failed [${res.status}]: ${txt}`);
        if (res.status === 404 || res.status === 400) await admin.from("push_tokens").delete().eq("token", token);
      }
    } catch (e) {
      console.error("FCM error", e);
    }
  }
}

export async function notifyStoreNewOrder(admin: any, orderId: string) {
  const { data: o } = await admin.from("orders").select("id,total,stores(owner_id,name)").eq("id", orderId).maybeSingle();
  const owner = o?.stores?.owner_id;
  if (owner) await sendPushToUser(admin, owner, "🛎️ Novo pedido pago!", `Pedido de R$ ${Number(o.total).toFixed(2).replace(".", ",")} — abra o painel para aceitar.`, "/painel");
}
