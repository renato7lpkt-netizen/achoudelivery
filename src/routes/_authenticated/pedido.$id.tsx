import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, RefreshCw, Star, KeyRound, Receipt, CheckCircle2, ChefHat, Bike, PackageCheck, XCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUS, brl } from "@/lib/market";
import { refreshPayment } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { OrderChat } from "@/components/OrderChat";
import { PushButton } from "@/components/PushButton";
import { LiveMap } from "@/components/LiveTracking";
import { ORDER_COLS } from "@/lib/columns";
import { useMyOrderPins } from "@/lib/pins";

export const Route = createFileRoute("/_authenticated/pedido/$id")({
  head: () => ({ meta: [{ title: "Seu pedido — AchouDelivery" }, { name: "description", content: "Acompanhe o status do seu pedido." }, { property: "og:title", content: "Seu pedido — AchouDelivery" }, { property: "og:description", content: "Status do pedido." }] }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const refresh = useServerFn(refreshPayment);
  const { data: o } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => (await supabase.from("orders").select(`${ORDER_COLS},order_items(*),stores(name,slug,address)` as const).eq("id", id).single()).data,
  });
  useEffect(() => {
    const ch = supabase.channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["order", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const { data: pins } = useMyOrderPins(!!o);
  if (!o) return <main className="p-16 text-center text-muted-foreground">Carregando…</main>;
  const pin = pins?.get(o.id);
  const waiting = o.status === "aguardando_pagamento";

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p className="text-sm text-muted-foreground">Pedido #{o.id.slice(0, 8)} · {o.stores?.name}</p>
      <h1 className="mt-1 text-3xl font-extrabold">{ORDER_STATUS[o.status] ?? o.status}</h1>
      <Timeline status={o.status} createdAt={o.created_at} deliveredAt={o.delivered_at} />
      {pin && ["pago", "preparando", "saiu_entrega"].includes(o.status) && (
        <div className="mt-6 flex items-center gap-4 rounded-2xl border-2 border-primary bg-accent p-4">
          <KeyRound className="h-8 w-8 text-primary" />
          <div><p className="text-sm font-semibold">Código de entrega</p><p className="font-display text-3xl font-extrabold tracking-[0.3em]">{pin}</p>
            <p className="text-xs text-muted-foreground">Informe ao entregador somente quando receber o pedido.</p></div>
        </div>
      )}
      {o.status === "saiu_entrega" && o.courier_lat != null && o.courier_lng != null && <LiveMap lat={o.courier_lat} lng={o.courier_lng} at={o.courier_loc_at} />}
      <div className="mt-4"><PushButton label="Avisar no celular quando o pedido andar" /></div>
      {!["aguardando_pagamento", "cancelado"].includes(o.status) && <div className="mt-6"><OrderChat orderId={o.id} role="cliente" /></div>}
      {o.status === "concluido" && o.rating == null && <RateBox orderId={o.id} onDone={() => qc.invalidateQueries({ queryKey: ["order", id] })} />}
      {o.rating != null && <p className="mt-4 flex items-center gap-1 text-sm text-muted-foreground">Sua avaliação: {Array.from({ length: o.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-primary text-primary" />)}</p>}

      {waiting && o.payment_method === "PIX" && o.pix_qr && (
        <div className="mt-6 rounded-2xl border bg-card p-5 text-center">
          <p className="font-semibold">Pague com Pix para confirmar</p>
          <img src={`data:image/png;base64,${o.pix_qr}`} alt="QR Code Pix" className="mx-auto my-4 h-56 w-56" />
          <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(o.pix_payload ?? ""); toast.success("Código Pix copiado"); }}>
            <Copy className="mr-1 h-4 w-4" />Copiar Pix copia e cola
          </Button>
        </div>
      )}
      {waiting && o.payment_method === "CREDIT_CARD" && o.invoice_url && (
        <Button asChild className="mt-6 w-full" size="lg"><a href={o.invoice_url} target="_blank" rel="noreferrer">Pagar com cartão <ExternalLink className="ml-1 h-4 w-4" /></a></Button>
      )}
      {waiting && (
        <Button variant="ghost" className="mt-2 w-full" onClick={async () => { await refresh({ data: { orderId: id } }); qc.invalidateQueries({ queryKey: ["order", id] }); }}>
          <RefreshCw className="mr-1 h-4 w-4" />Já paguei, atualizar
        </Button>
      )}

      <div className="mt-6 rounded-2xl border bg-card p-4 text-sm">
        {o.order_items.map((i) => <p key={i.id} className="flex justify-between"><span>{i.qty}× {i.name}{i.options && <span className="block text-xs text-muted-foreground">+ {i.options}</span>}</span><span>{brl(i.qty * Number(i.price))}</span></p>)}
        <div className="mt-3 border-t pt-2">
          <p className="flex justify-between"><span>Entrega</span><span>{Number(o.delivery_fee) === 0 ? "Grátis" : brl(Number(o.delivery_fee))}</span></p>
          <p className="flex justify-between font-bold"><span>Total</span><span>{brl(Number(o.total))}</span></p>
        </div>
        <p className="mt-3 text-muted-foreground">Entregar em: {o.address}</p>
      </div>
      <Link to="/meus-pedidos" className="mt-6 block text-center text-primary underline">Ver todos os pedidos</Link>
    </main>
  );
}

const STEPS = [
  { key: "aguardando_pagamento", label: "Pedido feito", hint: "Aguardando o pagamento", icon: Receipt },
  { key: "pago", label: "Pagamento confirmado", hint: "A loja vai aceitar seu pedido", icon: CheckCircle2 },
  { key: "preparando", label: "Em preparo", hint: "A loja está preparando tudo", icon: ChefHat },
  { key: "saiu_entrega", label: "Saiu para entrega", hint: "O entregador está a caminho", icon: Bike },
  { key: "concluido", label: "Entregue", hint: "Bom apetite!", icon: PackageCheck },
] as const;

/** Vertical iFood-style tracker: done steps filled, current step pulsing, upcoming steps muted. */
function Timeline({ status, createdAt, deliveredAt }: { status: string; createdAt: string; deliveredAt: string | null }) {
  if (status === "cancelado") {
    return (
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        <XCircle className="h-6 w-6 shrink-0" />
        <div><p className="font-bold">Pedido cancelado</p><p className="text-sm">Se você já pagou, entre em contato com a loja para combinar o estorno.</p></div>
      </div>
    );
  }
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === status));
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null);
  return (
    <ol className="mt-5 rounded-2xl border bg-card p-4">
      {STEPS.map(({ key, label, hint, icon: Icon }, i) => {
        const done = i < idx, current = i === idx;
        const at = i === 0 ? time(createdAt) : key === "concluido" ? time(deliveredAt) : null;
        return (
          <li key={key} className="relative flex gap-3 pb-5 last:pb-0">
            {i < STEPS.length - 1 && <span aria-hidden className={`absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5 ${done ? "bg-primary" : "bg-border"}`} />}
            <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full ${done ? "bg-primary text-primary-foreground" : current ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted text-muted-foreground"}`}>
              {current && key !== "concluido" && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
              <Icon className="relative h-5 w-5" />
            </span>
            <div className="min-w-0 pt-1">
              <p className={`font-semibold ${done || current ? "text-foreground" : "text-muted-foreground"}`}>{label}{at && <span className="ml-2 text-xs font-normal text-muted-foreground">{at}</span>}</p>
              {current && <p className="text-sm text-muted-foreground">{hint}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RateBox({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  async function send() {
    if (!rating) { toast.error("Escolha de 1 a 5 estrelas"); return; }
    const { error } = await supabase.rpc("rate_order", { _order: orderId, _rating: rating, _review: review });
    if (error) { toast.error("Não foi possível enviar"); return; }
    toast.success("Obrigado pela avaliação!"); onDone();
  }
  return (
    <div className="mt-6 rounded-2xl border bg-card p-4">
      <p className="font-bold">Como foi seu pedido?</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} estrelas`} onClick={() => setRating(n)}><Star className={`h-8 w-8 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} /></button>)}
      </div>
      <Textarea className="mt-3" value={review} onChange={(e) => setReview(e.target.value)} placeholder="Conte como foi a comida e a entrega (opcional)" maxLength={500} />
      <Button className="mt-3 w-full" onClick={send}>Enviar avaliação</Button>
    </div>
  );
}
