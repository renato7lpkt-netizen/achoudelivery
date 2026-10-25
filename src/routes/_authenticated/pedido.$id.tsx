import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, RefreshCw, Star, KeyRound, CheckCircle2, ChefHat, Bike, PackageCheck, XCircle, Clock, MapPin, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ADDRESS_EDIT_MAX_KM, CUSTOMER_CANCELLABLE, brl, deliveryWindow, haversineKm } from "@/lib/market";
import { cancelMyOrder, refreshPayment, updateOrderAddress } from "@/lib/orders.functions";
import { findAddress } from "@/lib/address";
import { useNow } from "@/hooks/use-now";
import { Button } from "@/components/ui/button";
import { OrderChat } from "@/components/OrderChat";
import { PushButton } from "@/components/PushButton";
import { OrderMap } from "@/components/OrderMap";
import { AddressInput } from "@/components/AddressInput";
import { PinMap } from "@/components/PinMap";
import { ORDER_COLS } from "@/lib/columns";
import { useMyOrderPins } from "@/lib/pins";

export const Route = createFileRoute("/_authenticated/pedido/$id")({
  head: () => ({ meta: [{ title: "Seu pedido — AchouDelivery" }, { name: "description", content: "Acompanhe o status do seu pedido." }, { property: "og:title", content: "Seu pedido — AchouDelivery" }, { property: "og:description", content: "Status do pedido." }] }),
  component: OrderPage,
});

const TITLE: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pedido confirmado",
  preparando: "Preparando seu pedido",
  saiu_entrega: "Seu pedido está a caminho",
  concluido: "Pedido entregue",
  cancelado: "Pedido cancelado",
};
const ACTIVE = ["pago", "preparando", "saiu_entrega"];
/** Courier GPS older than this is not used for "N min". */
const FRESH_GPS_MS = 5 * 60000;
const hhmm = (d: Date | string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function OrderPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const refresh = useServerFn(refreshPayment);
  const now = useNow(30000);
  const { data: o } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => (await supabase.from("orders").select(`${ORDER_COLS},order_items(*),stores(name,slug,address,lat,lng,prep_time_min,rain_mode)` as const).eq("id", id).single()).data,
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
  const reload = () => qc.invalidateQueries({ queryKey: ["order", id] });

  const home = o.lat != null && o.lng != null ? { lat: o.lat, lng: o.lng } : null;
  const store = o.stores?.lat != null && o.stores?.lng != null ? { lat: o.stores.lat, lng: o.stores.lng } : null;
  const gpsFresh = o.courier_loc_at != null && now.getTime() - new Date(o.courier_loc_at).getTime() < FRESH_GPS_MS;
  const courier = o.status === "saiu_entrega" && gpsFresh && o.courier_lat != null && o.courier_lng != null ? { lat: o.courier_lat, lng: o.courier_lng } : null;
  const eta = ACTIVE.includes(o.status) ? deliveryWindow(o, o.stores, courier && home ? haversineKm(courier, home) : null, now) : null;

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <p className="text-sm text-muted-foreground">Pedido #{o.id.slice(0, 8)} · {o.stores?.name}</p>
      <h1 className="mt-1 text-3xl font-extrabold">{TITLE[o.status] ?? o.status}</h1>

      {o.status === "cancelado" ? <Cancelled paymentStatus={o.payment_status} /> : (
        <section className="mt-4 rounded-2xl border bg-card p-4">
          <Progress status={o.status} />
          {eta && (
            <div className="mt-4 flex items-start gap-2">
              <Clock className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p><span className="font-display text-2xl font-extrabold">{hhmm(eta.from)}–{hhmm(eta.to)}</span> <span className="text-sm text-muted-foreground">Previsão de entrega</span></p>
                <p className="text-sm text-muted-foreground">
                  {eta.minutesLeft != null ? <>O entregador chega em cerca de <b className="text-foreground">{eta.minutesLeft} min</b>.</>
                    : eta.late ? "Está demorando um pouco mais que o normal. Previsão atualizada."
                    : o.status === "pago" ? "Esperando a loja aceitar o pedido."
                    : o.status === "preparando" ? "A loja está preparando tudo."
                    : "O entregador está a caminho."}
                </p>
              </div>
            </div>
          )}
          {o.status === "concluido" && o.delivered_at && <p className="mt-4 flex items-center gap-2 text-sm"><PackageCheck className="h-5 w-5 text-success" />Entregue às <b>{hhmm(o.delivered_at)}</b>. Bom apetite!</p>}
          {waiting && <p className="mt-4 text-sm text-muted-foreground">Pague abaixo para a loja receber o pedido.</p>}
          {home && ACTIVE.includes(o.status) && <OrderMap store={store} home={home} courier={courier} minutesLeft={eta?.minutesLeft ?? null} />}
          {o.status === "saiu_entrega" && !courier && <p className="mt-2 text-xs text-muted-foreground">O mapa mostra o entregador quando ele liga a localização no app.</p>}
          {CUSTOMER_CANCELLABLE.includes(o.status) && home && <EditAddress orderId={o.id} address={o.address ?? ""} point={home} onDone={reload} />}
        </section>
      )}

      {pin && ACTIVE.includes(o.status) && (
        <div className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-primary bg-accent p-4">
          <KeyRound className="h-8 w-8 shrink-0 text-primary" />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Código de entrega</p>
            <p className="text-xs text-muted-foreground">Informe ao entregador somente quando receber o pedido.</p></div>
          <p className="shrink-0 rounded-xl bg-primary px-3 py-1 font-display text-3xl font-extrabold tracking-[0.2em] text-primary-foreground">{pin}</p>
        </div>
      )}
      <div className="mt-4"><PushButton label="Avisar no celular quando o pedido andar" /></div>
      {!["aguardando_pagamento", "cancelado"].includes(o.status) && <div className="mt-6"><OrderChat orderId={o.id} role="cliente" /></div>}
      {o.status === "concluido" && o.rating == null && <RateBox orderId={o.id} onDone={reload} />}
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
        <Button variant="ghost" className="mt-2 w-full" onClick={async () => { await refresh({ data: { orderId: id } }); reload(); }}>
          <RefreshCw className="mr-1 h-4 w-4" />Já paguei, atualizar
        </Button>
      )}

      {CUSTOMER_CANCELLABLE.includes(o.status) && <CancelButton orderId={o.id} paid={o.status === "pago"} onDone={reload} />}

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
  { key: "pago", label: "Confirmado", icon: CheckCircle2 },
  { key: "preparando", label: "Preparando", icon: ChefHat },
  { key: "saiu_entrega", label: "A caminho", icon: Bike },
  { key: "concluido", label: "Entregue", icon: PackageCheck },
] as const;

/** Horizontal tracker (like the big delivery apps): done steps filled, the current one highlighted and pulsing. */
function Progress({ status }: { status: string }) {
  const idx = STEPS.findIndex((s) => s.key === status); // -1 while waiting for payment
  const delivered = status === "concluido";
  return (
    <ol className="flex items-start">
      {STEPS.map(({ key, label, icon: Icon }, i) => {
        const done = i < idx || delivered, current = i === idx && !delivered;
        const last = i === STEPS.length - 1;
        return (
          <li key={key} className={`flex flex-col ${last ? "items-end" : "flex-1"}`}>
            <div className="flex w-full items-center">
              <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full ${done ? "bg-primary text-primary-foreground" : current ? "bg-primary text-primary-foreground ring-4 ring-primary/25" : "bg-muted text-muted-foreground"}`}>
                {current && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
                <Icon className="relative h-5 w-5" />
              </span>
              {!last && <span aria-hidden className={`mx-1 h-1.5 flex-1 rounded-full ${i < idx || delivered ? "bg-primary" : "bg-muted"}`} />}
            </div>
            <span className={`mt-1.5 text-[11px] font-semibold ${done || current ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Cancelled({ paymentStatus }: { paymentStatus: string | null }) {
  const refunded = paymentStatus != null && paymentStatus.startsWith("REFUND");
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
      <XCircle className="h-6 w-6 shrink-0" />
      <div><p className="font-bold">Pedido cancelado</p>
        <p className="text-sm">{refunded ? "O valor pago foi estornado. No Pix volta na hora; no cartão aparece na fatura."
          : paymentStatus === "DELETED" ? "A cobrança foi desfeita. Nada foi cobrado."
          : "Se você já pagou, entre em contato com a loja para combinar o estorno."}</p></div>
    </div>
  );
}

/**
 * Fix the delivery point before the store starts preparing (house number, gate, a pin a bit off).
 * Moves stay within ADDRESS_EDIT_MAX_KM so the fee already paid still holds; the server checks it again.
 */
function EditAddress({ orderId, address, point, onDone }: { orderId: string; address: string; point: { lat: number; lng: number }; onDone: () => void }) {
  const save = useServerFn(updateOrderAddress);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(address);
  const [pos, setPos] = useState(point);
  const [busy, setBusy] = useState(false);
  const area = { near: point, radiusKm: 2 };
  const far = haversineKm(point, pos) > ADDRESS_EDIT_MAX_KM;
  async function pick(label: string) {
    const g = await findAddress(label, area).catch(() => null);
    if (g) setPos({ lat: g.lat, lng: g.lng });
    else toast.error("Não achamos esse endereço. Arraste o alfinete até a porta.");
  }
  async function submit() {
    setBusy(true);
    try {
      await save({ data: { orderId, address: text, lat: pos.lat, lng: pos.lng } });
      toast.success("Endereço atualizado. A loja e o entregador já veem o novo ponto.");
      setOpen(false); onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar", { duration: 9000 });
    } finally { setBusy(false); }
  }
  if (!open) {
    return (
      <Button variant="secondary" className="mt-3 w-full" onClick={() => { setText(address); setPos(point); setOpen(true); }}>
        <MapPin className="mr-1 h-4 w-4" />Editar endereço
      </Button>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded-xl border p-3">
      <p className="text-sm font-semibold">Corrigir o endereço de entrega</p>
      <AddressInput value={text} onChange={setText} onPick={pick} area={area} />
      <PinMap value={pos} onChange={setPos} />
      {far && <p className="text-xs font-medium text-destructive">O ponto ficou a mais de {ADDRESS_EDIT_MAX_KM * 1000} m do endereço do pedido. Para entregar em outro lugar, cancele e faça um novo pedido.</p>}
      <p className="text-xs text-muted-foreground">Dá para ajustar o número, o complemento ou o ponto no mapa. O frete não muda.</p>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={submit} disabled={busy || far || text.trim().length < 3}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar endereço"}</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  );
}

/** Free cancellation before the store starts preparing (see /termos); the server refunds the payment. */
function CancelButton({ orderId, paid, onDone }: { orderId: string; paid: boolean; onDone: () => void }) {
  const cancel = useServerFn(cancelMyOrder);
  const [busy, setBusy] = useState(false);
  async function go() {
    const msg = paid
      ? "Cancelar o pedido? O valor pago será estornado: no Pix volta na hora; no cartão o estorno aparece na fatura (pode levar até 2 faturas)."
      : "Cancelar o pedido? A cobrança será desfeita e não poderá mais ser paga.";
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await cancel({ data: { orderId } });
      toast.success(paid ? "Pedido cancelado. O estorno foi solicitado." : "Pedido cancelado.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar", { duration: 9000 });
      onDone();
    } finally { setBusy(false); }
  }
  return (
    <div className="mt-4 text-center">
      <Button variant="outline" className="w-full text-destructive" onClick={go} disabled={busy}>
        <XCircle className="mr-1 h-4 w-4" />{busy ? "Cancelando…" : "Cancelar pedido"}
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">Grátis até a loja começar a preparar{paid ? ", com estorno do valor pago" : ""}.</p>
    </div>
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
