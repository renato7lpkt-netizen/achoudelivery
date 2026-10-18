import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUS, brl } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/meus-pedidos")({
  head: () => ({ meta: [{ title: "Meus pedidos — AchouDelivery" }, { name: "description", content: "Histórico dos seus pedidos." }, { property: "og:title", content: "Meus pedidos — AchouDelivery" }, { property: "og:description", content: "Seus pedidos no AchouDelivery." }] }),
  component: MyOrders,
});

function MyOrders() {
  const { user } = Route.useRouteContext();
  const { data } = useQuery({
    queryKey: ["my-orders", user.id],
    queryFn: async () => (await supabase.from("orders").select("id,status,total,created_at,delivery_pin,stores(name)").eq("customer_id", user.id).order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Meus pedidos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Informe o PIN ao entregador só quando receber o pedido.</p>
      <div className="mt-6 space-y-3">
        {data?.map((o) => (
          <Link key={o.id} to="/pedido/$id" params={{ id: o.id }} className="flex items-center justify-between rounded-2xl border bg-card p-4 hover:border-primary">
            <div><p className="font-semibold">{o.stores?.name}</p><p className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")} · {ORDER_STATUS[o.status]}</p></div>
            <div className="text-right">
              <span className="font-bold">{brl(Number(o.total))}</span>
              {o.delivery_pin && ["pago", "preparando", "saiu_entrega"].includes(o.status) && (
                <p className="mt-1 rounded-lg bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">PIN <span className="font-display text-base tracking-widest">{o.delivery_pin}</span></p>
              )}
            </div>
          </Link>
        ))}
        {data?.length === 0 && <p className="text-muted-foreground">Nenhum pedido ainda.</p>}
      </div>
    </main>
  );
}
