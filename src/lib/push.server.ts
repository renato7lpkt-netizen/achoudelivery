import { createSign } from "node:crypto";

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

// FIREBASE_SERVICE_ACCOUNT = the service-account JSON downloaded from Firebase console (single line).
function serviceAccount(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.project_id && sa.client_email && sa.private_key ? sa : null;
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

let cachedToken: { value: string; exp: number } | undefined;

// OAuth2 JWT-bearer flow for FCM HTTP v1; tokens last 1h, refreshed a minute early.
async function accessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;
  const b64 = (v: string) => Buffer.from(v).toString("base64url");
  const unsigned = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key.replace(/\\n/g, "\n"), "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) {
    console.error(`FCM auth failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

export async function sendPushToUser(admin: any, userId: string, title: string, body: string, path = "/") {
  const sa = serviceAccount();
  if (!sa || !userId) return;
  const { data: rows } = await admin.from("push_tokens").select("token").eq("user_id", userId);
  const list = (rows ?? []) as { token: string }[];
  if (list.length === 0) return;
  const bearer = await accessToken(sa);
  if (!bearer) return;
  for (const { token } of list) {
    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
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
