import { brl } from "./market";

type OrderLike = {
  id: string; customer_name: string; customer_phone: string; address: string | null;
  lat: number | null; lng: number | null; notes: string | null; total: number; delivery_fee: number;
  payment_method: string; created_at: string;
  order_items: { name: string; qty: number; price: number }[];
};

/** Link de WhatsApp com dados da entrega e rota do Google Maps. Sem número, o usuário escolhe o contato. */
export function whatsappRoute(o: OrderLike, phone?: string | null) {
  const maps = o.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}` : "";
  const msg = [
    `🛵 *Entrega AchouDelivery #${o.id.slice(0, 8)}*`,
    `Cliente: ${o.customer_name} · ${o.customer_phone}`,
    `Endereço: ${o.address ?? ""}`,
    o.notes ? `Obs.: ${o.notes}` : "",
    `Itens: ${o.order_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}`,
    maps ? `Rota: ${maps}` : "",
    "Peça o PIN de 4 dígitos ao cliente na entrega.",
  ].filter(Boolean).join("\n");
  const num = phone ? phone.replace(/\D/g, "") : "";
  return `https://wa.me/${num ? (num.startsWith("55") ? num : `55${num}`) : ""}?text=${encodeURIComponent(msg)}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Abre uma comanda formatada para impressora térmica de 80 mm. */
export function printTicket(o: OrderLike, storeName: string) {
  const w = window.open("", "_blank", "width=360,height=640");
  if (!w) return;
  const items = o.order_items.map((i) => `<tr><td>${i.qty}x ${esc(i.name)}</td><td style="text-align:right">${brl(Number(i.price) * i.qty)}</td></tr>`).join("");
  w.document.write(`<html><head><title>Comanda</title><style>
    @page{size:80mm auto;margin:3mm}body{font-family:monospace;font-size:12px;width:74mm;margin:0}
    h1{font-size:16px;text-align:center;margin:4px 0}hr{border:0;border-top:1px dashed #000}table{width:100%;border-collapse:collapse}
  </style></head><body>
  <h1>${esc(storeName)}</h1><p style="text-align:center">Pedido #${o.id.slice(0, 8)}<br>${new Date(o.created_at).toLocaleString("pt-BR")}</p><hr>
  <p><b>${esc(o.customer_name)}</b><br>${esc(o.customer_phone)}<br>${esc(o.address ?? "")}</p><hr>
  <table>${items}</table><hr>
  ${o.notes ? `<p><b>Obs.:</b> ${esc(o.notes)}</p><hr>` : ""}
  <table><tr><td>Entrega</td><td style="text-align:right">${brl(Number(o.delivery_fee))}</td></tr>
  <tr><td><b>TOTAL</b></td><td style="text-align:right"><b>${brl(Number(o.total))}</b></td></tr>
  <tr><td>Pago via</td><td style="text-align:right">${o.payment_method === "PIX" ? "Pix" : "Cartão"}</td></tr></table>
  <script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
}
