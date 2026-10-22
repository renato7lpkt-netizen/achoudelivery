import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Phone, Navigation, Store, Bike, RefreshCw, Loader2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CITY_CENTER, ORDER_STATUS, brl } from "@/lib/market";
import { ORDER_COLS } from "@/lib/columns";
import { summarizeEarnings } from "@/lib/earnings";
import { EarningsSummary } from "@/components/EarningsSummary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { OrderChat } from "@/components/OrderChat";
import { ShareLocation } from "@/components/LiveTracking";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isLinkActive, timeLeft } from "@/lib/affiliation";
import { whatsappLink } from "@/lib/order-tools";
import { useNow } from "@/hooks/use-now";

export const Route = createFileRoute("/_authenticated/entregador")({
  head: () => ({ meta: [{ title: "Entregadores — AchouDelivery" }, { name: "description", content: "Cadastre-se como entregador e receba entregas das lojas de Sete Lagoas." }, { property: "og:title", content: "Seja entregador no AchouDelivery" }, { property: "og:description", content: "Cadastro e painel de entregas." }] }),
  // ?aba= picks the section, so the phone tab bar (BottomNav) can open it.
  validateSearch: (s: Record<string, unknown>): { aba?: CourierTab } => (COURIER_TABS.includes(s["aba"] as CourierTab) ? { aba: s["aba"] as CourierTab } : {}),
  component: CourierPage,
});

const COURIER_TABS = ["disponiveis", "minhas", "ganhos", "perfil"] as const;
type CourierTab = (typeof COURIER_TABS)[number];
const ACTIVE = ["pago", "preparando", "saiu_entrega"];
const REFRESH_MS = 10000; // couriers can't subscribe to other orders' rows, so the board is polled

type Courier = Tables<"couriers">;
const VEHICLES = ["Moto", "Bicicleta", "Carro", "A pé"];
const PIX_TYPES = ["CPF", "CNPJ", "E-mail", "Celular", "Aleatória"];

function CourierPage() {
  const { user } = Route.useRouteContext();
  const { data: courier, isLoading } = useQuery({
    queryKey: ["my-courier", user.id],
    queryFn: async () => (await supabase.from("couriers").select("*").eq("user_id", user.id).maybeSingle()).data,
  });
  if (isLoading) return <main className="p-16 text-center text-muted-foreground">Carregando…</main>;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {!courier ? <CourierForm userId={user.id} />
        : courier.approval_status !== "aprovado" ? <><Approval courier={courier} /><DocUpload courier={courier} /><Profile courier={courier} editable /></>
        : <CourierTabs courier={courier} />}
    </main>
  );
}

/** Approved courier: available deliveries, own deliveries, earnings and profile as separate tabs. */
function CourierTabs({ courier }: { courier: Courier }) {
  const { aba = "disponiveis" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useCourierOrders(courier.id);
  useCourierOrdersLive(courier.id);
  const active = data?.filter((o) => ACTIVE.includes(o.status)).length ?? 0;
  const go = (v: CourierTab) => navigate({ search: { aba: v }, replace: true });
  return (
    <>
      <Profile courier={courier} />
      <Tabs value={aba} onValueChange={(v) => go(v as CourierTab)} className="mt-4">
        <TabsList className="grid h-auto w-full grid-cols-4">
          <TabsTrigger value="disponiveis">Entregas</TabsTrigger>
          <TabsTrigger value="minhas">Minhas{active > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{active}</span>}</TabsTrigger>
          <TabsTrigger value="ganhos">Ganhos</TabsTrigger>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
        </TabsList>
        <TabsContent value="disponiveis">
          {active > 0 && <button onClick={() => go("minhas")} className="mt-4 w-full rounded-xl bg-primary p-3 text-left text-sm font-bold text-primary-foreground">Você tem {active} {active === 1 ? "entrega" : "entregas"} em andamento → ver</button>}
          <LinkBanner onOpen={() => go("perfil")} />
          <OpenDeliveries courier={courier} onAccepted={() => go("minhas")} />
        </TabsContent>
        <TabsContent value="minhas"><Deliveries courier={courier} /></TabsContent>
        <TabsContent value="ganhos"><CourierEarnings courier={courier} /></TabsContent>
        <TabsContent value="perfil"><div className="mt-4 space-y-6"><StoreLink /><CourierForm userId={courier.user_id} courier={courier} /></div></TabsContent>
      </Tabs>
    </>
  );
}

/**
 * Realtime refresh of the courier's own orders. Call it once per page (CourierTabs): supabase reuses a
 * channel by name, and adding callbacks to an already subscribed channel throws and breaks the page.
 */
function useCourierOrdersLive(courierId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel(`courier-${courierId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `courier_id=eq.${courierId}` }, () => qc.invalidateQueries({ queryKey: ["courier-orders", courierId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [courierId, qc]);
}

/** The courier's own orders, refreshed by useCourierOrdersLive plus a 10 s poll (realtime can drop on phones in the background). */
function useCourierOrders(courierId: string) {
  return useQuery({
    queryKey: ["courier-orders", courierId],
    refetchInterval: REFRESH_MS,
    queryFn: async () => (await supabase.from("orders").select(`${ORDER_COLS},order_items(*),stores(name,address,phone,lat,lng,own_couriers)` as const).eq("courier_id", courierId).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
}

/** Links to stores (active first), polled so the code card turns into the link as soon as the store types it. */
function useCourierLinks() {
  return useQuery({
    queryKey: ["courier-links"],
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("courier_links");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function LinkBanner({ onOpen }: { onOpen: () => void }) {
  const { data } = useCourierLinks();
  const now = useNow(30000);
  const l = data?.find((x) => isLinkActive(x, now));
  if (!l) return null;
  return (
    <button onClick={onOpen} className="mt-4 flex w-full items-center gap-2 rounded-xl bg-accent p-3 text-left text-sm">
      <Link2 className="h-4 w-4 shrink-0 text-primary" />
      <span>Você está trabalhando para <b>{l.store_name}</b> · faltam {timeLeft(l.ends_at, now)}. As entregas dela aparecem em <b>Minhas</b>.</span>
    </button>
  );
}

/**
 * Affiliation: the courier shows a one-time 6-digit code (10 min) and the store owner types it in the store app,
 * choosing how long the courier works for the store. Payment is agreed directly with the store.
 */
function StoreLink() {
  const qc = useQueryClient();
  const { data: links } = useCourierLinks();
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(code ? 1000 : 30000);
  const active = links?.find((l) => isLinkActive(l, now));
  const past = links?.filter((l) => l !== active) ?? [];
  const codeLive = code && new Date(code.expires_at) > now;
  useEffect(() => { if (active) setCode(null); }, [active]);
  async function make() {
    setBusy(true);
    const { data, error } = await supabase.rpc("link_code_create");
    setBusy(false);
    if (error || !data?.[0]) { toast.error(error?.message ?? "Não foi possível gerar o código"); return; }
    setCode(data[0]);
  }
  async function end(id: string, store: string) {
    if (!window.confirm(`Encerrar o trabalho para ${store} agora?`)) return;
    const { data: ok } = await supabase.rpc("link_end", { _link: id });
    if (!ok) { toast.error("Não foi possível encerrar"); return; }
    toast.success("Afiliação encerrada"); qc.invalidateQueries({ queryKey: ["courier-links"] });
  }
  const secs = code ? Math.max(0, Math.ceil((new Date(code.expires_at).getTime() - now.getTime()) / 1000)) : 0;
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Link2 className="h-5 w-5 text-primary" />Trabalhar para uma loja</h2>
      {active ? (
        <div className="mt-3 rounded-xl bg-accent p-3 text-sm">
          <p className="font-bold">{active.store_name}</p>
          <p className="text-muted-foreground">{active.store_address}</p>
          <p className="mt-2">Até {new Date(active.ends_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · <b>faltam {timeLeft(active.ends_at, now)}</b></p>
          <p className="mt-1">{active.deliveries} {active.deliveries === 1 ? "entrega feita" : "entregas feitas"} · {Number(active.km).toFixed(1)} km</p>
          <p className="mt-2 text-xs text-muted-foreground">A loja escolhe você nos pedidos dela, e eles aparecem na aba Minhas. O pagamento é combinado direto com a loja.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {active.store_phone && <Button asChild size="sm" variant="outline"><a href={whatsappLink(active.store_phone)} target="_blank" rel="noreferrer">WhatsApp da loja</a></Button>}
            <Button size="sm" variant="outline" onClick={() => end(active.link_id, active.store_name)}>Encerrar agora</Button>
          </div>
        </div>
      ) : codeLive ? (
        <div className="mt-3 text-center">
          <p className="text-sm text-muted-foreground">Passe este código para o dono da loja. Ele digita no app da Loja, em <b>Meus entregadores</b>.</p>
          <p className="my-3 font-mono text-4xl font-extrabold tracking-[0.3em]">{code.code}</p>
          <p className="text-xs text-muted-foreground">Vale por mais {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} e só pode ser usado uma vez.</p>
          <Button size="sm" variant="ghost" className="mt-2" onClick={make} disabled={busy}>Gerar outro</Button>
        </div>
      ) : (
        <div className="mt-2 text-sm">
          <p className="text-muted-foreground">Vai trabalhar como entregador próprio de uma loja por algumas horas, dias ou semanas? Gere um código e passe para o dono da loja.</p>
          <Button className="mt-3" onClick={make} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar código de 6 números"}</Button>
        </div>
      )}
      {past.length > 0 && (
        <ul className="mt-4 divide-y border-t text-sm">
          {past.map((l) => <li key={l.link_id} className="flex justify-between gap-2 py-2"><span>{l.store_name} · até {new Date(l.ended_at ?? l.ends_at).toLocaleDateString("pt-BR")}</span><span className="text-muted-foreground">{l.deliveries} entregas · {Number(l.km).toFixed(1)} km</span></li>)}
        </ul>
      )}
    </section>
  );
}

function CourierForm({ userId, courier }: { userId: string; courier?: Courier }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: courier?.name ?? "", phone: courier?.phone ?? "", cpf: courier?.cpf ?? "",
    vehicle: courier?.vehicle ?? "Moto", plate: courier?.plate ?? "", pix_key: courier?.pix_key ?? "",
    pix_key_type: courier?.pix_key_type ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cpf = f.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) { toast.error("CPF inválido"); return; }
    if (f.pix_key && !f.pix_key_type) { toast.error("Escolha o tipo da chave Pix"); return; }
    const row = { ...f, cpf, plate: f.plate || null, pix_key: f.pix_key || null, pix_key_type: f.pix_key ? f.pix_key_type : null };
    const { error } = courier
      ? await supabase.from("couriers").update(row).eq("id", courier.id)
      : await supabase.from("couriers").insert({ ...row, user_id: userId });
    if (error) { toast.error("Não foi possível salvar"); return; }
    qc.invalidateQueries({ queryKey: ["my-courier"] }); qc.invalidateQueries({ queryKey: ["roles"] });
    toast.success(courier ? "Dados atualizados" : "Cadastro enviado! Vamos analisar e liberar suas entregas.");
  }
  return (
    <form onSubmit={save} className="space-y-4">
      {!courier && <><h1 className="text-3xl font-extrabold">Seja entregador</h1>
        <p className="text-muted-foreground">Faça entregas para as lojas de Sete Lagoas no seu horário.</p></>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Nome completo</Label><Input required value={f.name} onChange={set("name")} /></div>
        <div><Label>Celular (WhatsApp)</Label><Input required value={f.phone} onChange={set("phone")} placeholder="(31) 9…" /></div>
        <div><Label>CPF</Label><Input required value={f.cpf} onChange={set("cpf")} placeholder="000.000.000-00" /></div>
        <div><Label>Veículo</Label>
          <select className="h-10 w-full rounded-md border bg-card px-3" value={f.vehicle} onChange={set("vehicle")}>
            {VEHICLES.map((v) => <option key={v}>{v}</option>)}
          </select></div>
        <div><Label>Placa (se houver)</Label><Input value={f.plate} onChange={set("plate")} /></div>
        <div><Label>Tipo da chave Pix</Label>
          <select className="h-10 w-full rounded-md border bg-card px-3" value={f.pix_key_type} onChange={set("pix_key_type")}>
            <option value="">Escolha…</option>
            {PIX_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select></div>
        <div><Label>Chave Pix (para receber)</Label><Input value={f.pix_key} onChange={set("pix_key")} /></div>
      </div>
      <Button type="submit" className="w-full">{courier ? "Salvar dados" : "Quero ser entregador"}</Button>
    </form>
  );
}

function Profile({ courier, editable = false }: { courier: Courier; editable?: boolean }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">Olá, {courier.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">{courier.vehicle}{courier.plate ? ` · ${courier.plate}` : ""}</p></div>
        <label className="flex items-center gap-2 font-semibold">
          <Switch checked={courier.available} onCheckedChange={async (v) => { await supabase.from("couriers").update({ available: v }).eq("id", courier.id); qc.invalidateQueries({ queryKey: ["my-courier"] }); }} />
          <span className={courier.available ? "text-success" : "text-muted-foreground"}>{courier.available ? "Disponível" : "Indisponível"}</span>
        </label>
      </div>
      {editable && <Button variant="link" className="px-0" onClick={() => setEdit(!edit)}>{edit ? "Fechar" : "Editar meus dados"}</Button>}
      {editable && edit && <CourierForm userId={courier.user_id} courier={courier} />}
    </section>
  );
}

function Deliveries({ courier }: { courier: Courier }) {
  const qc = useQueryClient();
  const key = ["courier-orders", courier.id];
  const { data } = useCourierOrders(courier.id);
  async function move(id: string, status: string) {
    const { error } = await supabase.rpc("courier_update_order", { _order: id, _status: status });
    if (error) { toast.error("Não foi possível atualizar"); return; }
    qc.invalidateQueries({ queryKey: key });
  }
  const active = data?.filter((o) => ACTIVE.includes(o.status)) ?? [];
  const done = data?.filter((o) => !active.includes(o)) ?? [];
  return (
    <section className="mt-4">
      <h2 className="text-xl font-bold">Minhas entregas</h2>
      {active.length === 0 && <p className="mt-2 text-muted-foreground">Nenhuma entrega no momento. Veja a aba <Link to="/entregador" search={{ aba: "disponiveis" }} className="font-semibold text-primary underline">Entregas</Link> para aceitar uma perto de você.</p>}
      <div className="mt-3 space-y-3">
        {active.map((o) => (
          <div key={o.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between"><p className="font-bold">#{o.id.slice(0, 8)} · {o.stores?.name}</p>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">{ORDER_STATUS[o.status]}</span></div>
            <p className="mt-2 flex gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-primary" />Coletar: {o.stores?.address}</p>
            <p className="mt-1 flex gap-2 text-sm"><Navigation className="h-4 w-4 shrink-0 text-primary" />Entregar: {o.address} ({o.distance_km} km)</p>
            <p className="mt-1 flex gap-2 text-sm"><Phone className="h-4 w-4 shrink-0 text-primary" />{o.customer_name} · {o.customer_phone}</p>
            <p className="mt-1 text-sm text-muted-foreground">{o.order_items.map((i) => `${i.qty}× ${i.name}`).join(", ")} {Number(o.courier_payout) > 0 ? <> · <b className="text-success">Você ganha {brl(Number(o.courier_payout))}</b></> : o.stores?.own_couriers && <> · <span>pagamento combinado com a loja</span></>}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {o.lat && <Button asChild size="sm" variant="outline"><a href={`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}`} target="_blank" rel="noreferrer">Abrir rota</a></Button>}
              {o.status === "preparando" && <Button size="sm" onClick={() => move(o.id, "saiu_entrega")}>Peguei o pedido</Button>}
              {o.status === "saiu_entrega" && <ShareLocation orderId={o.id} />}
              {o.status === "saiu_entrega" && <PinConfirm orderId={o.id} onDone={() => qc.invalidateQueries({ queryKey: key })} />}
              <OrderChat orderId={o.id} role="entregador" />
            </div>
          </div>
        ))}
      </div>
      {done.length > 0 && <>
        <h3 className="mt-6 font-semibold">Histórico</h3>
        <ul className="mt-2 divide-y rounded-2xl border bg-card text-sm">
          {done.map((o) => <li key={o.id} className="flex justify-between gap-2 p-3"><span>{o.stores?.name} · {new Date(o.created_at).toLocaleDateString("pt-BR")}</span><span className="text-right">{ORDER_STATUS[o.status]}{o.status === "concluido" && Number(o.courier_payout) > 0 && <b className="ml-2 text-success">{brl(Number(o.courier_payout))}</b>}</span></li>)}
        </ul></>}
    </section>
  );
}

/** Board of paid orders from stores without own couriers, nearest store first; first courier to accept takes it. */
function OpenDeliveries({ courier, onAccepted }: { courier: Courier; onAccepted: () => void }) {
  const qc = useQueryClient();
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [taking, setTaking] = useState<string | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) { setHere(CITY_CENTER); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setHere((h) => h ?? CITY_CENTER), // without GPS, sort from downtown
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  const key = ["open-deliveries", here?.lat.toFixed(3), here?.lng.toFixed(3)];
  const { data, isFetching, refetch } = useQuery({
    queryKey: key,
    enabled: !!here && courier.available,
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("open_deliveries", { _lat: here!.lat, _lng: here!.lng });
      if (error) throw error;
      return data ?? [];
    },
  });
  async function accept(orderId: string) {
    setTaking(orderId);
    const { data: ok, error } = await supabase.rpc("accept_delivery", { _order: orderId });
    setTaking(null);
    if (error) { toast.error(error.message); return; }
    if (!ok) toast.error("Outro entregador pegou essa entrega primeiro.");
    else { toast.success("Entrega aceita! Vá até a loja para coletar."); onAccepted(); }
    qc.invalidateQueries({ queryKey: ["open-deliveries"] });
    qc.invalidateQueries({ queryKey: ["courier-orders", courier.id] });
  }
  return (
    <section className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Entregas disponíveis</h2>
        {courier.available && <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching} aria-label="Atualizar">
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>}
      </div>
      {!courier.available ? (
        <p className="mt-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">Fique <b>Disponível</b> no topo para ver e aceitar entregas perto de você.</p>
      ) : !data ? (
        <p className="mt-2 text-sm text-muted-foreground">Buscando entregas perto de você…</p>
      ) : data.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma entrega aberta agora. A lista atualiza sozinha a cada 10 segundos.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {data.map((d) => (
            <div key={d.order_id} className="rounded-2xl border-2 border-primary/30 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-bold"><Store className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{d.store_name}</span></p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{d.store_address}</p>
                </div>
                <p className="shrink-0 text-right"><span className="block text-xs text-muted-foreground">Você ganha</span><span className="font-display text-2xl font-extrabold text-success">{brl(Number(d.earning))}</span></p>
              </div>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-primary" />{Number(d.km_to_store).toFixed(1)} km até a loja</span>
                {d.delivery_km != null && <span className="flex items-center gap-1"><Bike className="h-4 w-4 text-primary" />{Number(d.delivery_km).toFixed(1)} km de entrega</span>}
                <span className="text-muted-foreground">{d.status === "pago" ? "Loja vai aceitar" : "Em preparo"}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" onClick={() => accept(d.order_id)} disabled={taking !== null}>
                  {taking === d.order_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceitar entrega"}
                </Button>
                <Button asChild variant="outline"><a href={`https://www.google.com/maps/dir/?api=1&destination=${d.store_lat},${d.store_lng}`} target="_blank" rel="noreferrer">Ver loja no mapa</a></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Delivery fees of platform deliveries (orders.courier_payout); store-team deliveries are paid by the store itself. */
function CourierEarnings({ courier }: { courier: Courier }) {
  const { data } = useQuery({
    queryKey: ["courier-earnings", courier.id],
    refetchInterval: 60000,
    queryFn: async () => (await supabase.from("orders").select("status,payment_status,delivered_at,courier_payout,courier_payout_id")
      .eq("courier_id", courier.id).in("status", ACTIVE.concat("concluido")).order("created_at", { ascending: false }).limit(1000)).data ?? [],
  });
  const { data: payouts } = useQuery({
    queryKey: ["my-courier-payouts", courier.id],
    queryFn: async () => (await supabase.from("courier_payouts").select("id,amount,orders_count,status,created_at").eq("courier_id", courier.id).order("created_at", { ascending: false }).limit(24)).data ?? [],
  });
  if (!data) return <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>;
  const s = summarizeEarnings(data.map((o) => ({ ...o, amount: Number(o.courier_payout), settled: o.courier_payout_id != null })));
  return (
    <div className="mt-4 space-y-4">
      <EarningsSummary s={s} note="Você recebe a taxa de entrega inteira das entregas do AchouDelivery, por Pix na chave do seu perfil. Entregas da equipe própria de uma loja são pagas direto pela loja e não entram aqui." />
      {!courier.pix_key && <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">Cadastre sua chave Pix na aba <b>Perfil</b> para receber os repasses.</p>}
      {payouts && payouts.length > 0 && (
        <section className="rounded-2xl border bg-card p-4 text-sm">
          <h3 className="font-bold">Repasses recebidos</h3>
          {payouts.map((p) => <p key={p.id} className="mt-1 flex justify-between"><span>{new Date(p.created_at).toLocaleDateString("pt-BR")} · {p.orders_count} entregas</span><span>{brl(Number(p.amount))} · {p.status}</span></p>)}
        </section>
      )}
    </div>
  );
}

function Approval({ courier }: { courier: Courier }) {
  const st = courier.approval_status;
  if (st === "aprovado") return null;
  return (
    <div className={`mb-4 rounded-2xl p-4 text-sm ${st === "recusado" ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}`}>
      {st === "recusado"
        ? <><b>Cadastro recusado.</b> {courier.reject_reason ?? ""} Corrija seus dados e fale com o AchouDelivery.</>
        : <><b>Cadastro em análise.</b> Vamos conferir seus dados; assim que aprovado você começa a receber entregas.</>}
    </div>
  );
}

function PinConfirm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [pin, setPin] = useState("");
  async function go() {
    const { data: ok } = await supabase.rpc("confirm_delivery", { _order: orderId, _pin: pin });
    if (!ok) { toast.error("PIN incorreto. Peça o código ao cliente."); return; }
    toast.success("Entrega concluída!"); onDone();
  }
  return (
    <div className="flex items-center gap-2">
      <Input className="h-9 w-24" inputMode="numeric" maxLength={4} placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
      <Button size="sm" onClick={go}>Confirmar entrega</Button>
    </div>
  );
}

function DocUpload({ courier }: { courier: Courier }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function up(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo maior que 10 MB"); return; }
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${courier.user_id}/documento-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("courier-docs").upload(path, file, { upsert: true, contentType: file.type });
    if (!error) await supabase.from("couriers").update({ doc_path: path }).eq("id", courier.id);
    setBusy(false);
    if (error) { toast.error("Não foi possível enviar o documento"); return; }
    qc.invalidateQueries({ queryKey: ["my-courier"] }); toast.success("Documento enviado para análise");
  }
  return (
    <div className="mb-4 rounded-2xl border bg-card p-4 text-sm">
      <p className="font-bold">Documento (CNH ou CRLV)</p>
      <p className="text-muted-foreground">Envie uma foto ou o PDF da CNH digital. O nome precisa ser igual ao do cadastro. Só o AchouDelivery vê esse arquivo.</p>
      {courier.doc_path && <p className="mt-1 text-success">✓ Documento enviado</p>}
      <label className="mt-2 inline-flex cursor-pointer items-center rounded-md border px-3 py-2 font-semibold">
        {busy ? "Enviando…" : courier.doc_path ? "Trocar documento" : "Enviar foto ou PDF"}
        <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={up} disabled={busy} />
      </label>
    </div>
  );
}
