import { describe, expect, it } from "vitest";
import { summarizeEarnings, type EarningRow } from "./earnings";
import { appArea } from "./web-manifest";

const now = new Date(2026, 9, 21, 15, 0);
const row = (o: Partial<EarningRow>): EarningRow => ({ status: "concluido", payment_status: "RECEIVED", delivered_at: new Date(2026, 9, 21, 12).toISOString(), amount: 10, settled: false, ...o });

describe("summarizeEarnings", () => {
  it("counts only delivered, paid and unpaid-out orders as to receive", () => {
    const s = summarizeEarnings([
      row({}),
      row({ settled: true }), // already in a payout
      row({ payment_status: "PENDING" }), // not paid
      row({ status: "preparando", amount: 7, delivered_at: null }),
      row({ status: "cancelado", amount: 99 }),
      row({ delivered_at: new Date(2026, 9, 2).toISOString(), amount: 5 }),
      row({ delivered_at: new Date(2026, 8, 30).toISOString(), amount: 3 }),
    ], now);
    expect(s.toReceive).toBe(18);
    expect(s.inProgress).toBe(7);
    expect(s.today).toBe(30);
    expect(s.todayCount).toBe(3);
    expect(s.month).toBe(35);
    expect(s.monthCount).toBe(4);
  });
});

describe("appArea", () => {
  it("maps each page to its app", () => {
    expect(appArea("/painel")).toBe("loja");
    expect(appArea("/entregador")).toBe("entregador");
    expect(appArea("/loja/pizzaria")).toBe("cliente");
    expect(appArea("/")).toBe("cliente");
  });
});
