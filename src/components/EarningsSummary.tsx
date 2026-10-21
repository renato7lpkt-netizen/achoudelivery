import { brl } from "@/lib/market";
import type { summarizeEarnings } from "@/lib/earnings";

/** Four tiles: next payout, orders on the way, today and this month — all approximate until the payout is sent. */
export function EarningsSummary({ s, note }: { s: ReturnType<typeof summarizeEarnings>; note: string }) {
  const tiles = [
    { label: "A receber no próximo repasse", value: s.toReceive, hint: "pedidos entregues e pagos", strong: true },
    { label: "Em andamento", value: s.inProgress, hint: "entra quando for entregue" },
    { label: "Hoje", value: s.today, hint: `${s.todayCount} ${s.todayCount === 1 ? "entrega" : "entregas"}` },
    { label: "Este mês", value: s.month, hint: `${s.monthCount} ${s.monthCount === 1 ? "entrega" : "entregas"}` },
  ];
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="text-lg font-bold">Quanto você vai receber <span className="text-sm font-normal text-muted-foreground">(aproximado)</span></h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-xl p-3 ${t.strong ? "bg-success/10 ring-1 ring-success/30" : "bg-muted"}`}>
            <p className="text-xs font-semibold text-muted-foreground">{t.label}</p>
            <p className={`mt-1 font-display text-xl font-extrabold ${t.strong ? "text-success" : ""}`}>{brl(t.value)}</p>
            <p className="text-[11px] text-muted-foreground">{t.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </section>
  );
}
