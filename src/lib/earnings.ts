// Estimated earnings for the store panel and the courier area, from the amounts createOrder stored
// on each order (store_payout / courier_payout). Same rules as src/lib/payouts.functions.ts:
// an order enters the next payout once delivered (PIN) and paid, and leaves it once its payout id is set.

const PAID = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const ACTIVE = ["pago", "preparando", "saiu_entrega"];

export type EarningRow = { status: string; payment_status: string | null; delivered_at: string | null; amount: number; settled: boolean };

export function summarizeEarnings(rows: EarningRow[], now = new Date()) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let toReceive = 0, inProgress = 0, today = 0, month = 0, todayCount = 0, monthCount = 0;
  for (const o of rows) {
    if (ACTIVE.includes(o.status)) { inProgress += o.amount; continue; }
    if (o.status !== "concluido") continue;
    if (!o.settled && PAID.includes(o.payment_status ?? "")) toReceive += o.amount;
    const at = o.delivered_at ? new Date(o.delivered_at).getTime() : 0;
    if (at >= startOfMonth) { month += o.amount; monthCount++; }
    if (at >= startOfDay) { today += o.amount; todayCount++; }
  }
  return { toReceive: r2(toReceive), inProgress: r2(inProgress), today: r2(today), month: r2(month), todayCount, monthCount };
}
