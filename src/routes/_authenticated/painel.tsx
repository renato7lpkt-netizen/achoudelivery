import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, LocateFixed, Printer, MessageCircle, CloudRain, BellRing, Camera, ImageUp, Search, Loader2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CATEGORIES, FREE_KM_OWN, ORDER_STATUS, WEEKDAYS, brl, geocode, isOpenNow, isStorePaused, splitFees } from "@/lib/market";
import { printTicket, whatsappLink, whatsappRoute } from "@/lib/order-tools";
import { LINK_UNITS, type LinkUnit, isLinkActive, linkMinutes, linkResult, timeLeft } from "@/lib/affiliation";
import { useNow } from "@/hooks/use-now";
import { Button } from "@/components/ui/button";
import { OrderChat } from "@/components/OrderChat";
import { PushButton } from "@/components/PushButton";
import { notifyOrderStatus } from "@/lib/push.functions";
import { ShareLocation } from "@/components/LiveTracking";
import { compressImage, squareImage } from "@/lib/image";
import { locateMe } from "@/lib/locate";
import { GeoNote } from "@/components/GeoNote";
import { ORDER_COLS, STORE_COLS } from "@/lib/columns";
import { summarizeEarnings } from "@/lib/earnings";
import { EarningsSummary } from "@/components/EarningsSummary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel do lojista — AchouDelivery" }, { name: "description", content: "Gerencie produtos, horários, entrega e pedidos." }, { property: "og:title", content: "Painel do lojista — AchouDelivery" }, { property: "og:description", content: "Painel da sua loja." }] }),
  // ?aba= picks the section, so the phone tab bar (BottomNav) can open it.
  validateSearch: (s: Record<string, unknown>): { aba?: PanelTab } => (PANEL_TABS.includes(s["aba"] as PanelTab) ? { aba: s["aba"] as PanelTab } : {}),
  component: Painel,
});

const PANEL_TABS = ["pedidos", "produtos", "recebimento", "loja", "horarios", "equipe", "dados"] as const;
type PanelTab = (typeof PANEL_TABS)[number];

type Store = Tables<"stores">;

function Painel() {
  const { user } = Route.useRouteContext();
  const { aba = "pedidos" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: store, isLoading } = useQuery({
    queryKey: ["my-store", user.id],
    // Payout fields are not readable here (migration 0014); the owner gets them from useStorePix.
    queryFn: async () => (await supabase.from("stores").select(STORE_COLS).eq("owner_id", user.id).maybeSingle()).data as Store | null,
  });
  if (isLoading) return <main className="p-16 text-center text-muted-foreground">Carregando…</main>;
  if (!store) return <CreateStore userId={user.id} />;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold">{store.name}</h1>
          <Link to="/loja/$slug" params={{ slug: store.slug }} className="text-sm text-primary underline">Ver página da loja</Link></div>
        <PauseToggle store={store} />
      </div>
      <PixReminder storeId={store.id} />
      <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as PanelTab }, replace: true })} className="mt-6">
        <TabsList className="h-auto flex-wrap"><TabsTrigger value="pedidos">Pedidos</TabsTrigger><TabsTrigger value="recebimento">Ganhos e Pix</TabsTrigger><TabsTrigger value="produtos">Produtos</TabsTrigger><TabsTrigger value="loja">Loja e entrega</TabsTrigger><TabsTrigger value="horarios">Horários</TabsTrigger><TabsTrigger value="equipe">Meus entregadores</TabsTrigger><TabsTrigger value="dados">Dados cadastrais</TabsTrigger></TabsList>
        <TabsContent value="recebimento"><Payout store={store} /></TabsContent>
        <TabsContent value="pedidos"><Orders store={store} /></TabsContent>
        <TabsContent value="produtos"><Products store={store} /></TabsContent>
        <TabsContent value="loja"><Settings store={store} /></TabsContent>
        <TabsContent value="horarios"><Hours store={store} /></TabsContent>
        <TabsContent value="equipe"><Team store={store} /></TabsContent>
        <TabsContent value="dados"><Company store={store} /></TabsContent>
      </Tabs>
    </main>
  );
}

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function onlyDigits(v: string) { return v.replace(/\D/g, ""); }

function CreateStore({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const [f, setF] = useState({
    name: "", category: "Lanches", description: "", legal_name: "", document: "", responsible_name: "", responsible_cpf: "",
    email: user.email ?? "", whatsapp: "", phone: "", address: "", cover_url: "", pix_key_type: "", pix_key: "",
    delivery_enabled: true, own_couriers: false,
  });
  const [pos, setPos] = useState<{ lat: number; lng: number; label?: string; approx?: boolean } | null>(null);
  const [finding, setFinding] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function locate() {
    if (!f.address.trim()) { toast.error("Digite o endereço da loja"); return; }
    setFinding(true);
    const g = await geocode(f.address).catch(() => null);
    setFinding(false);
    if (!g) { toast.error("Endereço não encontrado em Sete Lagoas. Confira rua, número e bairro."); return; }
    setPos(g);
  }
  async function useGps() {
    setFinding(true);
    try {
      const here = await locateMe();
      setPos({ lat: here.lat, lng: here.lng, label: here.address ?? "sua localização atual" });
      if (here.address) setF((prev) => ({ ...prev, address: here.address! }));
      toast.success("Localização da loja encontrada. Confira o número.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não conseguimos sua localização.", { duration: 9000 });
    } finally { setFinding(false); }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const doc = onlyDigits(f.document);
    if (doc.length !== 11 && doc.length !== 14) { toast.error("Informe um CPF ou CNPJ válido"); return; }
    if (!pos) { toast.error("Clique em Localizar para confirmar o endereço da loja"); return; }
    if (!terms) { toast.error("Aceite as condições para continuar"); return; }
    setBusy(true);
    const slug = `${slugify(f.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from("stores").insert({
      owner_id: userId, name: f.name, slug, category: f.category, description: f.description, address: f.address,
      lat: pos.lat, lng: pos.lng, phone: f.phone || f.whatsapp, cover_url: f.cover_url || null,
      pix_key_type: f.pix_key_type || null, pix_key: f.pix_key || null, delivery_enabled: true, pickup_enabled: false, own_couriers: f.own_couriers, is_active: true,
    }).select("id").single();
    if (error || !data) { setBusy(false); toast.error("Não foi possível criar a loja"); return; }
    const { error: e2 } = await supabase.from("store_private").insert({
      store_id: data.id, owner_id: userId, legal_name: f.legal_name, document: doc, responsible_name: f.responsible_name,
      responsible_cpf: onlyDigits(f.responsible_cpf) || null, email: f.email, whatsapp: f.whatsapp,
    });
    if (e2) toast.error("Loja criada, mas os dados cadastrais não salvaram. Confira em Dados cadastrais.");
    await supabase.from("store_hours").insert([1, 2, 3, 4, 5, 6].map((d) => ({ store_id: data.id, weekday: d, opens: "09:00", closes: "18:00" })));
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["my-store"] }); qc.invalidateQueries({ queryKey: ["roles"] });
    toast.success("Loja cadastrada! Agora cadastre seus produtos.");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Cadastre sua loja</h1>
      <p className="mt-1 text-muted-foreground">Venda para Sete Lagoas inteira. Comissão de 5,5% + taxa de pagamento (Pix ou cartão) por venda.</p>
      <form onSubmit={create} className="mt-6 space-y-8">
        <fieldset className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
          <legend className="px-2 font-bold">1. Sua loja</legend>
          <div><Label>Nome da loja (como aparece no site)</Label><Input required value={f.name} onChange={set("name")} /></div>
          <div><Label>Categoria</Label>
            <select className="h-10 w-full rounded-md border bg-card px-3" value={f.category} onChange={set("category")}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div className="sm:col-span-2"><Label>Descrição</Label><Textarea required value={f.description} onChange={set("description")} placeholder="O que você vende, diferenciais…" /></div>
          <div className="sm:col-span-2"><Label>Foto da loja</Label>
            <div className="flex items-center gap-3">
              {f.cover_url && <img src={f.cover_url} alt="" className="h-16 w-28 rounded-lg object-cover" />}
              <PhotoChoice onPick={(u) => setF({ ...f, cover_url: u })} />
            </div>
            <Input className="mt-2" value={f.cover_url.startsWith("data:") ? "" : f.cover_url} onChange={set("cover_url")} placeholder="ou cole um link https://…" /></div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
          <legend className="px-2 font-bold">2. Dados da empresa</legend>
          <div><Label>Razão social ou nome completo</Label><Input required value={f.legal_name} onChange={set("legal_name")} /></div>
          <div><Label>CNPJ ou CPF</Label><Input required value={f.document} onChange={set("document")} placeholder="00.000.000/0000-00" /></div>
          <div><Label>Nome do responsável</Label><Input required value={f.responsible_name} onChange={set("responsible_name")} /></div>
          <div><Label>CPF do responsável</Label><Input value={f.responsible_cpf} onChange={set("responsible_cpf")} /></div>
          <div><Label>E-mail</Label><Input required type="email" value={f.email} onChange={set("email")} /></div>
          <div><Label>WhatsApp</Label><Input required value={f.whatsapp} onChange={set("whatsapp")} placeholder="(31) 9…" /></div>
          <div><Label>Telefone da loja (opcional)</Label><Input value={f.phone} onChange={set("phone")} /></div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-2xl border bg-card p-4">
          <legend className="px-2 font-bold">3. Endereço e entrega</legend>
          <div><Label>Endereço da loja</Label>
            <Input required value={f.address} onChange={(e) => { set("address")(e); setPos(null); }} onBlur={() => { if (f.address && !pos && !finding) locate(); }} placeholder="Rua, número, bairro" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={locate} disabled={finding}><Search className="mr-1 h-4 w-4" />Buscar endereço</Button>
              <Button type="button" variant="outline" size="sm" onClick={useGps} disabled={finding}><LocateFixed className="mr-1 h-4 w-4" />Usar minha localização</Button>
              {finding && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
            {pos ? <GeoNote label={pos.label} approx={pos.approx} /> : <p className="mt-1 text-xs text-muted-foreground">Necessário para calcular a distância das entregas</p>}</div>
          <div><p className="font-semibold">Sua loja tem entregador próprio?</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[true, false].map((v) => <button type="button" key={String(v)} onClick={() => setF({ ...f, own_couriers: v })} className={`rounded-xl border p-3 text-sm font-semibold ${f.own_couriers === v ? "border-primary bg-accent" : "bg-card"}`}>{v ? "Sim, tenho equipe" : "Não, uso os do AchouDelivery"}</button>)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{f.own_couriers ? `Entrega grátis até ${FREE_KM_OWN} km; acima disso R$ 2/km no que passar.` : "Frete de R$ 2/km, feito pelos entregadores do AchouDelivery."}</p></div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-2xl border bg-card p-4">
          <legend className="px-2 font-bold">4. Recebimento</legend>
          <div><Label>Tipo da chave Pix</Label><select className="h-10 w-full rounded-md border bg-card px-3" value={f.pix_key_type} onChange={(e) => setF({ ...f, pix_key_type: e.target.value })}><option value="">—</option>{["CPF", "CNPJ", "Celular", "E-mail", "Aleatória"].map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><Label>Chave Pix para receber o repasse mensal</Label><Input value={f.pix_key} onChange={set("pix_key")} />
            <p className="mt-1 text-xs text-muted-foreground">Pode preencher depois na aba "Recebimento".</p></div>
        </fieldset>

        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          Concordo com a comissão de 5,5% + taxa de pagamento (Pix ou cartão) sobre cada venda e confirmo que os dados acima são verdadeiros.</label>
        <Button className="w-full" size="lg" type="submit" disabled={busy}>Cadastrar loja</Button>
      </form>
    </main>
  );
}

function Company({ store }: { store: Store }) {
  const qc = useQueryClient();
  const key = ["store-private", store.id];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("store_private").select("*").eq("store_id", store.id).maybeSingle()).data });
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setF({ legal_name: data.legal_name, document: data.document, responsible_name: data.responsible_name, responsible_cpf: data.responsible_cpf ?? "", email: data.email, whatsapp: data.whatsapp });
  }, [data]);
  if (isLoading) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = { legal_name: f["legal_name"] ?? "", document: onlyDigits(f["document"] ?? ""), responsible_name: f["responsible_name"] ?? "",
      responsible_cpf: onlyDigits(f["responsible_cpf"] ?? "") || null, email: f["email"] ?? "", whatsapp: f["whatsapp"] ?? "" };
    const { error } = data
      ? await supabase.from("store_private").update(row).eq("store_id", store.id)
      : await supabase.from("store_private").insert({ ...row, store_id: store.id, owner_id: store.owner_id! });
    if (error) { toast.error("Erro ao salvar"); return; }
    qc.invalidateQueries({ queryKey: key }); toast.success("Dados salvos");
  }
  const fields: [string, string][] = [["legal_name", "Razão social"], ["document", "CNPJ ou CPF"], ["responsible_name", "Responsável"], ["responsible_cpf", "CPF do responsável"], ["email", "E-mail"], ["whatsapp", "WhatsApp"]];
  return (
    <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
      <p className="text-sm text-muted-foreground sm:col-span-2">Esses dados são privados — só você vê.</p>
      {fields.map(([k, l]) => <div key={k}><Label>{l}</Label><Input required={k !== "responsible_cpf"} value={f[k] ?? ""} onChange={set(k)} /></div>)}
      <Button type="submit" className="sm:col-span-2">Salvar dados cadastrais</Button>
    </form>
  );
}

function PauseToggle({ store }: { store: Store }) {
  const qc = useQueryClient();
  const { data: hours } = useQuery({ queryKey: ["hours", store.id], queryFn: async () => (await supabase.from("store_hours").select("*").eq("store_id", store.id)).data ?? [] });
  const paused = isStorePaused(store);
  const open = isOpenNow(hours ?? [], paused);
  const upd = async (patch: Partial<Store>) => { await supabase.from("stores").update(patch).eq("id", store.id); qc.invalidateQueries({ queryKey: ["my-store"] }); };
  const until = store.paused_until && new Date(store.paused_until) > new Date() ? new Date(store.paused_until).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-3 rounded-full border bg-card px-4 py-2 text-sm font-semibold">
        <span className={open ? "text-success" : "text-muted-foreground"}>{open ? "Aberta agora" : until ? `Pausada até ${until}` : "Fechada"}</span>
        <Switch checked={!store.is_paused} onCheckedChange={(v) => upd({ is_paused: !v, paused_until: null })} />
        <span>Recebendo pedidos</span>
      </label>
      {until ? <Button size="sm" variant="outline" onClick={() => upd({ paused_until: null })}>Retomar pedidos</Button>
        : [15, 30, 60].map((m) => <Button key={m} size="sm" variant="outline" onClick={() => upd({ paused_until: new Date(Date.now() + m * 60000).toISOString() })}>Pausar {m} min</Button>)}
      <Button size="sm" variant={store.rain_mode ? "default" : "outline"} onClick={() => upd({ rain_mode: !store.rain_mode })}><CloudRain className="mr-1 h-4 w-4" />Modo chuva {store.rain_mode ? "ligado" : ""}</Button>
    </div>
  );
}

const NEXT: Record<string, { label: string; to: string }[]> = {
  pago: [{ label: "Iniciar preparo", to: "preparando" }],
  preparando: [{ label: "Saiu para entrega", to: "saiu_entrega" }],
};

function Orders({ store }: { store: Store }) {
  const qc = useQueryClient();
  const key = ["store-orders", store.id];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("orders").select(`${ORDER_COLS},order_items(*)` as const).eq("store_id", store.id).order("created_at", { ascending: false }).limit(100)).data ?? [] });
  useEffect(() => {
    const ch = supabase.channel(`orders-${store.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, (p) => {
        if (p.eventType === "UPDATE" && (p.new as { status: string }).status === "pago") {
          toast.success("Novo pedido pago!");
          if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("AchouDelivery — novo pedido!", { body: "Um cliente acabou de pagar. Abra o painel para aceitar." });
        }
        qc.invalidateQueries({ queryKey: key });
        qc.invalidateQueries({ queryKey: ["store-earnings", store.id] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id]);
  const { data: couriers } = useQuery({ queryKey: ["couriers"], queryFn: async () => (await supabase.rpc("list_couriers")).data ?? [] });
  async function assign(id: string, courierId: string) {
    const { error } = await supabase.from("orders").update({ courier_id: courierId || null }).eq("id", id);
    if (error) { toast.error("Erro ao definir entregador"); return; }
    qc.invalidateQueries({ queryKey: key }); toast.success("Entregador definido");
  }
  async function move(id: string, to: string) {
    await supabase.from("orders").update({ status: to }).eq("id", id);
    notifyOrderStatus({ data: { orderId: id } }).catch(() => {});
    qc.invalidateQueries({ queryKey: key });
  }
  const pending = data?.filter((o) => o.status === "pago").length ?? 0;
  useAlarm(pending > 0);
  const [team, setTeam] = useState<Tables<"store_couriers">[]>([]);
  useEffect(() => { supabase.from("store_couriers").select("*").eq("store_id", store.id).then(({ data }) => setTeam(data ?? [])); }, [store.id]);
  const [pins, setPins] = useState<Record<string, string>>({});
  async function confirm(id: string) {
    const { data: ok } = await supabase.rpc("confirm_delivery", { _order: id, _pin: pins[id] ?? "" });
    if (!ok) { toast.error("PIN incorreto"); return; }
    toast.success("Entrega confirmada"); qc.invalidateQueries({ queryKey: key });
  }
  return (
    <div className="mt-4 space-y-3">
      <NotifyButton />
      <PushButton label="Avisos de pedido no celular" />
      {pending > 0 && <p className="flex animate-pulse items-center gap-2 rounded-xl bg-primary p-3 font-bold text-primary-foreground"><BellRing className="h-5 w-5" />{pending} pedido(s) aguardando você aceitar</p>}
      {data?.map((o) => (
        <div key={o.id} className="rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">#{o.id.slice(0, 8)} · {o.customer_name} · {o.customer_phone}</p>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">{ORDER_STATUS[o.status]}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")} · Entrega ({o.distance_km} km): {o.address} · {o.payment_method === "PIX" ? "Pix" : "Cartão"}</p>
          <ul className="mt-2 text-sm">{o.order_items.map((i) => <li key={i.id}>{i.qty}× {i.name}</li>)}</ul>
          {o.notes && <p className="mt-1 text-sm italic">Obs.: {o.notes}</p>}
          <p className="mt-2 text-sm">Total {brl(Number(o.total))} · Você recebe <b className="text-success">≈ {brl(Number(o.store_payout))}</b></p>
          <p className="text-xs text-muted-foreground">Descontos: pagamento {brl(Number(o.gateway_fee))} · AchouDelivery {brl(Number(o.platform_fee))}{Number(o.courier_payout) > 0 && <> · entregador {brl(Number(o.courier_payout))}</>}</p>
          {o.fulfillment === "delivery" && !["concluido", "cancelado", "aguardando_pagamento"].includes(o.status) && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="font-semibold">Entregador:</span>
              <select className="h-9 rounded-md border bg-card px-2" value={o.courier_id ?? ""} onChange={(e) => assign(o.id, e.target.value)}>
                <option value="">{store.own_couriers ? "Equipe própria (sem app)" : "Nenhum"}</option>
                {couriers?.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.vehicle} · {c.phone}{c.available ? "" : " (indisponível)"}</option>)}
              </select>
              {couriers?.length === 0 && <Link to="/painel" search={{ aba: "equipe" }} className="text-xs text-primary underline">Afiliar entregador com app</Link>}
            </div>
          )}
          {!store.own_couriers && !o.courier_id && ["pago", "preparando"].includes(o.status) && (
            <p className="mt-1 text-xs text-muted-foreground">Aguardando um entregador do AchouDelivery aceitar (ou escolha um entregador afiliado acima).</p>
          )}
          {o.status === "saiu_entrega" && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="font-semibold">PIN do cliente:</span>
              <Input className="h-9 w-24" inputMode="numeric" maxLength={4} value={pins[o.id] ?? ""} onChange={(e) => setPins({ ...pins, [o.id]: e.target.value.replace(/\D/g, "") })} />
              <Button size="sm" onClick={() => confirm(o.id)}>Confirmar entrega</Button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {NEXT[o.status]?.map((n) => <Button key={n.to} size="sm" onClick={() => move(o.id, n.to)}>{n.label}</Button>)}
            {o.status !== "aguardando_pagamento" && <Button size="sm" variant="outline" onClick={() => printTicket(o, store.name)}><Printer className="mr-1 h-4 w-4" />Comanda</Button>}
            {o.lat != null && !["concluido", "cancelado", "aguardando_pagamento"].includes(o.status) && (
              <select className="h-9 rounded-md border bg-card px-2 text-sm" value="" onChange={(e) => { const t = team.find((x) => x.id === e.target.value); window.open(whatsappRoute(o, t?.whatsapp), "_blank"); }}>
                <option value="">WhatsApp: enviar rota…</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}{t.plate ? ` · ${t.plate}` : ""}</option>)}
                <option value="other">Escolher contato</option>
              </select>
            )}
            {["pago", "preparando"].includes(o.status) && <Button size="sm" variant="outline" onClick={() => move(o.id, "cancelado")}>Cancelar</Button>}
            {store.own_couriers && !o.courier_id && o.status === "saiu_entrega" && <ShareLocation orderId={o.id} />}
            {!["aguardando_pagamento", "cancelado"].includes(o.status) && <OrderChat orderId={o.id} role="loja" />}
          </div>
        </div>
      ))}
      {data?.length === 0 && <p className="text-muted-foreground">Nenhum pedido ainda.</p>}
    </div>
  );
}

function FeePreview({ price }: { price: number }) {
  const pix = splitFees(price, "PIX"), card = splitFees(price, "CREDIT_CARD");
  const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
  return (
    <div className="space-y-1 rounded-xl bg-muted p-3 text-xs">
      <p className="font-semibold">Quanto você recebe (5,5% AchouDelivery + taxa de pagamento)</p>
      {price > 0 ? (
        <>
          <p className="text-sm">No Pix: <b className="text-success">{brl(pix.payout)}</b> <span className="text-muted-foreground">(desconto de {brl(pix.gateway + pix.platform)} · {pct(pix.retainedPct)})</span></p>
          <p className="text-sm">No cartão: <b className="text-success">{brl(card.payout)}</b> <span className="text-muted-foreground">(desconto de {brl(card.gateway + card.platform)} · {pct(card.retainedPct)})</span></p>
        </>
      ) : <p className="text-muted-foreground">Digite o preço para ver quanto você recebe.</p>}
      <p className="text-muted-foreground">Taxas de pagamento: Pix R$ 1,99 por pedido · Cartão 2,99% + R$ 0,49. Valor por pedido com 1 item; pedidos maiores rendem mais.</p>
    </div>
  );
}

function Products({ store }: { store: Store }) {
  const qc = useQueryClient();
  const key = ["my-products", store.id];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("products").select("*").eq("store_id", store.id).order("section")).data ?? [] });
  const empty = { name: "", description: "", price: "", image_url: "", section: "Cardápio" };
  const [f, setF] = useState(empty);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("products").insert({ store_id: store.id, name: f.name, description: f.description, price: Number(f.price.replace(",", ".")), image_url: f.image_url || null, section: f.section || "Cardápio" });
    if (error) { toast.error("Erro ao salvar"); return; }
    setF(empty); qc.invalidateQueries({ queryKey: key }); toast.success("Produto adicionado");
  }
  const upd = async (id: string, patch: Partial<Tables<"products">>) => { await supabase.from("products").update(patch).eq("id", id); qc.invalidateQueries({ queryKey: key }); };
  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-2">
        {data?.map((p) => (
          <div key={p.id} className="relative flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}</div>
            <div className="flex-1"><p className="font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.section}</p></div>
            <Input className="w-24" aria-label="Preço" defaultValue={Number(p.price).toFixed(2)} onBlur={(e) => upd(p.id, { price: Number(e.target.value.replace(",", ".")) })} />
            <PromoEditor p={p} onSave={(patch) => upd(p.id, patch)} />
            <OptionsEditor productId={p.id} />
            <PhotoButton onPick={(url) => upd(p.id, { image_url: url })} />
            <Switch checked={p.available} onCheckedChange={(v) => upd(p.id, { available: v })} aria-label="Disponível" />
            <Button size="icon" variant="ghost" aria-label="Excluir" onClick={async () => { await supabase.from("products").delete().eq("id", p.id); qc.invalidateQueries({ queryKey: key }); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {data?.length === 0 && <p className="text-muted-foreground">Cadastre seu primeiro produto.</p>}
      </div>
      <form onSubmit={add} className="h-fit space-y-3 rounded-2xl border bg-card p-4">
        <p className="font-bold">Novo produto</p>
        <div><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Preço (R$)</Label><Input required inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
          <div><Label>Seção</Label><Input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} /></div>
        </div>
        <FeePreview price={Number(f.price.replace(",", ".")) || 0} />
        <div><Label>Foto</Label>
          <div className="flex items-center gap-2">
            {f.image_url && <img src={f.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
            <PhotoChoice onPick={(url) => setF({ ...f, image_url: url })} />
          </div>
          <Input className="mt-2" value={f.image_url.startsWith("data:") ? "" : f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} placeholder="ou cole um link https://…" /></div>
        <Button className="w-full" type="submit"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
      </form>
    </div>
  );
}

function Settings({ store }: { store: Store }) {
  const qc = useQueryClient();
  const [f, setF] = useState(store);
  // Address text the current lat/lng belong to; saving with a different text re-locates first, so they never drift apart.
  const [geoFor, setGeoFor] = useState(store.address);
  const [geo, setGeo] = useState<{ label: string; approx: boolean } | null>(null);
  const [finding, setFinding] = useState(false);
  useEffect(() => { setF(store); setGeoFor(store.address); setGeo(null); }, [store]);
  const num = (k: keyof Store) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value.replace(",", ".")) });
  const txt = (k: keyof Store) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    let cur = f;
    if (f.address.trim() && f.address !== geoFor) {
      setFinding(true);
      const g = await geocode(f.address).catch(() => null);
      setFinding(false);
      if (!g) { toast.error("Não achamos o endereço da loja em Sete Lagoas. Confira e tente de novo."); return; }
      cur = { ...f, lat: g.lat, lng: g.lng };
      setF(cur); setGeoFor(f.address); setGeo(g);
    }
    const { id, owner_id, created_at, slug, rating_avg, rating_count, ...patch } = cur;
    void id; void owner_id; void created_at; void slug; void rating_avg; void rating_count;
    const { error } = await supabase.from("stores").update(patch).eq("id", store.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    qc.invalidateQueries({ queryKey: ["my-store"] }); toast.success("Salvo");
  }
  async function locate() {
    if (!f.address.trim()) { toast.error("Digite o endereço da loja"); return; }
    setFinding(true);
    const g = await geocode(f.address).catch(() => null);
    setFinding(false);
    if (!g) { toast.error("Endereço não encontrado em Sete Lagoas. Confira rua e bairro."); return; }
    setF({ ...f, lat: g.lat, lng: g.lng }); setGeoFor(f.address); setGeo(g);
    toast.success("Endereço encontrado — salve para aplicar");
  }
  async function useGps() {
    setFinding(true);
    try {
      const here = await locateMe();
      const address = here.address ?? f.address;
      setF({ ...f, address, lat: here.lat, lng: here.lng }); setGeoFor(address);
      setGeo({ label: here.address ?? "sua localização atual", approx: false });
      toast.success("Localização da loja encontrada. Confira o número e salve.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não conseguimos sua localização.", { duration: 9000 });
    } finally { setFinding(false); }
  }
  return (
    <form onSubmit={save} className="mt-4 grid gap-4 md:grid-cols-2">
      <div><Label>Nome</Label><Input value={f.name} onChange={txt("name")} /></div>
      <div><Label>Categoria</Label><select className="h-10 w-full rounded-md border bg-card px-3" value={f.category} onChange={txt("category") as never}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="md:col-span-2"><Label>Descrição</Label><Textarea value={f.description} onChange={txt("description")} /></div>
      <div><Label>Logo da loja</Label>
        <div className="flex items-center gap-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-accent font-display text-xl font-extrabold text-accent-foreground">
            {f.logo_url ? <img src={f.logo_url} alt="Logo atual" className="h-full w-full object-cover" /> : f.name.charAt(0)}
          </div>
          <PhotoChoice square onPick={(u) => setF({ ...f, logo_url: u })} />
          {f.logo_url && <Button type="button" variant="ghost" size="sm" onClick={() => setF({ ...f, logo_url: null })}>Remover</Button>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Aparece na lista de lojas. Use uma imagem quadrada; cortamos o centro.</p></div>
      <div><Label>Capa da loja</Label>
        <div className="flex items-center gap-3">
          {f.cover_url && <img src={f.cover_url} alt="Capa atual" className="h-16 w-28 shrink-0 rounded-xl object-cover" />}
          <PhotoChoice onPick={(u) => setF({ ...f, cover_url: u })} />
        </div>
        <Input className="mt-2" value={f.cover_url?.startsWith("data:") ? "" : f.cover_url ?? ""} onChange={txt("cover_url")} placeholder="ou cole um link https://…" /></div>
      <div><Label>Telefone</Label><Input value={f.phone ?? ""} onChange={txt("phone")} /></div>
      <div className="md:col-span-2"><Label>Endereço da loja</Label>
        <Input value={f.address} onChange={(e) => { txt("address")(e); setGeo(null); }} placeholder="Rua, número, bairro" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={locate} disabled={finding}><Search className="mr-1 h-4 w-4" />Buscar endereço</Button>
          <Button type="button" variant="outline" size="sm" onClick={useGps} disabled={finding}><LocateFixed className="mr-1 h-4 w-4" />Usar minha localização</Button>
          {finding && <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
        {geo ? <GeoNote label={geo.label} approx={geo.approx} />
          : <p className="mt-1 text-xs text-muted-foreground">{f.address !== geoFor ? "Endereço alterado: vamos localizar no mapa ao salvar." : `Ponto no mapa: ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}`}</p>}</div>
      <label className="flex items-center gap-2 md:col-span-2"><Switch checked={f.own_couriers} onCheckedChange={(v) => setF({ ...f, own_couriers: v })} />Tenho entregador próprio</label>
      {f.own_couriers && <p className="rounded-xl bg-accent p-3 text-sm md:col-span-2">Até {FREE_KM_OWN} km a entrega é <b>grátis</b> para o cliente. O valor abaixo vale só para os km acima de {FREE_KM_OWN}.</p>}
      <div><Label>{f.own_couriers ? `Valor por km acima de ${FREE_KM_OWN} km (R$)` : "Valor por km (R$)"}</Label><Input inputMode="decimal" defaultValue={f.delivery_fee_per_km} onChange={num("delivery_fee_per_km")} /></div>
      <div><Label>Raio máximo (km)</Label><Input inputMode="decimal" defaultValue={f.delivery_max_km} onChange={num("delivery_max_km")} /></div>
      <div><Label>Pedido mínimo (R$)</Label><Input inputMode="decimal" defaultValue={f.min_order} onChange={num("min_order")} /></div>
      <div><Label>Tempo de preparo (min)</Label><Input inputMode="numeric" defaultValue={f.prep_time_min} onChange={num("prep_time_min")} /></div>
      <Button type="submit" className="md:col-span-2">Salvar alterações</Button>
    </form>
  );
}

/** The store's own Pix key, readable only by its owner through the my_store_pix RPC. */
function useStorePix(storeId: string) {
  return useQuery({
    queryKey: ["my-store-pix", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_store_pix", { _store: storeId });
      if (error) throw error;
      return data?.[0] ?? { pix_key_type: null, pix_key: null };
    },
  });
}

function PixReminder({ storeId }: { storeId: string }) {
  const { data } = useStorePix(storeId);
  if (!data || data.pix_key) return null;
  return <p className="mt-4 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">Cadastre sua chave Pix na aba "Ganhos e Pix" para receber o repasse das vendas.</p>;
}

function Payout({ store }: { store: Store }) {
  const qc = useQueryClient();
  const { data: pix } = useStorePix(store.id);
  const [type, setType] = useState("");
  const [key, setKey] = useState("");
  useEffect(() => { setType(pix?.pix_key_type ?? ""); setKey(pix?.pix_key ?? ""); }, [pix]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!type || key.trim().length < 3) { toast.error("Escolha o tipo e informe a chave Pix"); return; }
    const { error } = await supabase.from("stores").update({ pix_key_type: type, pix_key: key.trim() }).eq("id", store.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    qc.invalidateQueries({ queryKey: ["my-store-pix", store.id] }); toast.success("Chave Pix atualizada");
  }
  return (
    <div className="mt-4 space-y-4">
    <StoreEarnings store={store} />
    <form onSubmit={save} className="grid max-w-xl gap-4 rounded-2xl border bg-card p-5">
      <div><h2 className="text-lg font-bold">Chave Pix do repasse</h2>
        <p className="text-sm text-muted-foreground">O AchouDelivery faz o repasse das suas vendas (menos a comissão de 5,5% e a taxa do meio de pagamento de cada produto) para a chave Pix abaixo. Você pode trocar quando quiser.</p></div>
      <div><Label>Tipo da chave Pix</Label><select className="h-10 w-full rounded-md border bg-card px-3" value={type} onChange={(e) => setType(e.target.value)}><option value="">—</option>{["CPF", "CNPJ", "Celular", "E-mail", "Aleatória"].map((t) => <option key={t}>{t}</option>)}</select></div>
      <div><Label>Chave Pix</Label><Input value={key} onChange={(e) => setKey(e.target.value)} /></div>
      <Button type="submit">Salvar chave Pix</Button>
      <PayoutHistory storeId={store.id} />
    </form>
    </div>
  );
}

/** What the store gets from its orders: the stored store_payout already has the payment fee, the 5.5% and the platform courier taken out. */
function StoreEarnings({ store }: { store: Store }) {
  const { data } = useQuery({
    queryKey: ["store-earnings", store.id],
    refetchInterval: 60000,
    queryFn: async () => (await supabase.from("orders").select("status,payment_status,delivered_at,store_payout,payout_id")
      .eq("store_id", store.id).in("status", ["pago", "preparando", "saiu_entrega", "concluido"]).order("created_at", { ascending: false }).limit(1000)).data ?? [],
  });
  if (!data) return null;
  const s = summarizeEarnings(data.map((o) => ({ ...o, amount: Number(o.store_payout), settled: o.payout_id != null })));
  return <EarningsSummary s={s} note={`Valores já sem a taxa do pagamento, a comissão de 5,5%${store.own_couriers ? "" : " e a taxa de entrega (que vai para o entregador)"}. O repasse é feito por Pix para a chave abaixo.`} />;
}

function Hours({ store }: { store: Store }) {
  const qc = useQueryClient();
  const key = ["hours", store.id];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("store_hours").select("*").eq("store_id", store.id).order("weekday")).data ?? [] });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  return (
    <div className="mt-4 space-y-2">
      {WEEKDAYS.map((d, i) => {
        const rows = data?.filter((h) => h.weekday === i) ?? [];
        return (
          <div key={d} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
            <span className="w-24 font-semibold">{d}</span>
            {rows.length === 0 && <span className="text-sm text-muted-foreground">Fechado</span>}
            {rows.map((h) => (
              <div key={h.id} className="flex items-center gap-1">
                <Input type="time" className="w-28" defaultValue={h.opens.slice(0, 5)} onBlur={async (e) => { await supabase.from("store_hours").update({ opens: e.target.value }).eq("id", h.id); refresh(); }} />
                <span>às</span>
                <Input type="time" className="w-28" defaultValue={h.closes.slice(0, 5)} onBlur={async (e) => { await supabase.from("store_hours").update({ closes: e.target.value }).eq("id", h.id); refresh(); }} />
                <Button size="icon" variant="ghost" aria-label="Remover" onClick={async () => { await supabase.from("store_hours").delete().eq("id", h.id); refresh(); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="ml-auto" onClick={async () => { await supabase.from("store_hours").insert({ store_id: store.id, weekday: i, opens: "09:00", closes: "18:00" }); refresh(); }}><Plus className="mr-1 h-4 w-4" />Turno</Button>
          </div>
        );
      })}
    </div>
  );
}

function useAlarm(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = () => {
      [0, 0.25].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.type = "square"; g.gain.value = 0.15;
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.15);
      });
    };
    beep();
    const t = setInterval(beep, 2000);
    return () => { clearInterval(t); void ctx.close(); };
  }, [on]);
}

function NotifyButton() {
  const [perm, setPerm] = useState<string>("granted");
  useEffect(() => { if (typeof Notification !== "undefined") setPerm(Notification.permission); }, []);
  if (perm === "granted" || perm === "denied") return null;
  return <Button size="sm" variant="secondary" onClick={async () => setPerm(await Notification.requestPermission())}><BellRing className="mr-1 h-4 w-4" />Ativar avisos no navegador</Button>;
}

function PromoEditor({ p, onSave }: { p: Tables<"products">; onSave: (patch: Partial<Tables<"products">>) => void }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(p.promo_price != null ? String(p.promo_price) : "");
  const [days, setDays] = useState<number[]>(p.promo_days ?? []);
  if (!open) return <Button size="sm" variant={p.promo_price ? "default" : "outline"} onClick={() => setOpen(true)}>{p.promo_price ? `Promo ${brl(Number(p.promo_price))}` : "Promoção"}</Button>;
  return (
    <div className="absolute right-2 top-full z-10 mt-1 w-72 space-y-2 rounded-xl border bg-card p-3 shadow-pop">
      <Label>Preço promocional (R$)</Label>
      <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Vazio = sem promoção" />
      <p className="text-xs text-muted-foreground">Dias da promoção (nenhum = todos os dias)</p>
      <div className="flex flex-wrap gap-1">{WEEKDAYS.map((d, i) => <button type="button" key={d} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])} className={`rounded-full border px-2 py-0.5 text-xs ${days.includes(i) ? "border-primary bg-primary text-primary-foreground" : ""}`}>{d.slice(0, 3)}</button>)}</div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { const v = Number(price.replace(",", ".")); onSave({ promo_price: price && v > 0 ? v : null, promo_days: days }); setOpen(false); }}>Salvar</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
      </div>
    </div>
  );
}

/**
 * Couriers with the app who work for the store for a while: the courier shows a 6-digit code (Perfil tab of the
 * courier app), the owner types it here and picks the period. Payment is agreed between them, outside the app.
 */
function Affiliates({ store }: { store: Store }) {
  const qc = useQueryClient();
  const key = ["store-links", store.id];
  const { data } = useQuery({
    queryKey: key,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("store_links", { _store: store.id });
      if (error) throw error;
      return data ?? [];
    },
  });
  const now = useNow(30000);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<{ name: string; vehicle: string; plate: string | null } | null>(null);
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<LinkUnit>("dias");
  const [busy, setBusy] = useState(false);
  const active = data?.filter((l) => isLinkActive(l, now)) ?? [];
  const past = data?.filter((l) => !isLinkActive(l, now)) ?? [];
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["couriers"] }); };
  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("link_code_lookup", { _store: store.id, _code: code });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const r = linkResult<{ name: string; vehicle: string; plate: string | null }>(data);
    if ("error" in r) { toast.error(r.error); return; }
    setFound(r);
  }
  async function link() {
    setBusy(true);
    const { data, error } = await supabase.rpc("link_code_redeem", { _store: store.id, _code: code, _minutes: linkMinutes(Number(amount), unit) });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const r = linkResult<{ link_id: string }>(data);
    if ("error" in r) { toast.error(r.error); return; }
    toast.success(`${found?.name ?? "Entregador"} afiliado à sua loja`);
    setCode(""); setFound(null); refresh();
  }
  async function end(id: string, name: string) {
    if (!window.confirm(`Encerrar a afiliação de ${name} agora?`)) return;
    const { data: ok } = await supabase.rpc("link_end", { _link: id });
    if (!ok) { toast.error("Não foi possível encerrar"); return; }
    toast.success("Afiliação encerrada"); refresh();
  }
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Link2 className="h-5 w-5 text-primary" />Entregadores afiliados pelo app</h2>
      <p className="mt-1 text-sm text-muted-foreground">O entregador gera um código de 6 números no app do Entregador (aba Perfil). Digite aqui e escolha por quanto tempo ele trabalha para a sua loja. Durante esse tempo você escolhe ele nos pedidos, e o pedido aparece no app dele. O pagamento é combinado direto entre vocês.</p>
      {!found ? (
        <form onSubmit={lookup} className="mt-3 flex gap-2">
          <Input className="w-40 font-mono text-lg tracking-widest" inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="Código do entregador" />
          <Button type="submit" disabled={busy || code.length !== 6}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar entregador"}</Button>
        </form>
      ) : (
        <div className="mt-3 space-y-3 rounded-xl bg-accent p-3 text-sm">
          <p><b>{found.name}</b> · {found.vehicle}{found.plate ? ` · ${found.plate}` : ""}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div><Label>Trabalhar por</Label><Input className="w-20" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} /></div>
            <select className="h-10 rounded-md border bg-card px-3" value={unit} onChange={(e) => setUnit(e.target.value as LinkUnit)} aria-label="Unidade">
              {(Object.keys(LINK_UNITS) as LinkUnit[]).map((u) => <option key={u} value={u}>{LINK_UNITS[u].label}</option>)}
            </select>
            <Button onClick={link} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Afiliar"}</Button>
            <Button variant="ghost" onClick={() => { setFound(null); setCode(""); }}>Cancelar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Máximo: 24 horas, 30 dias ou 8 semanas. Para renovar, peça um código novo.</p>
        </div>
      )}
      {active.length > 0 && (
        <div className="mt-4 space-y-2">
          {active.map((l) => (
            <div key={l.link_id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.name} <span className={l.available ? "text-success" : "text-muted-foreground"}>· {l.available ? "disponível" : "indisponível"}</span></p>
                <p className="text-xs text-muted-foreground">{l.vehicle}{l.plate ? ` · ${l.plate}` : ""} · faltam {timeLeft(l.ends_at, now)} · {l.deliveries} entregas · {Number(l.km).toFixed(1)} km</p>
              </div>
              <Button asChild size="sm" variant="outline"><a href={whatsappLink(l.phone)} target="_blank" rel="noreferrer">WhatsApp</a></Button>
              <Button size="sm" variant="ghost" onClick={() => end(l.link_id, l.name)}>Encerrar</Button>
            </div>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <ul className="mt-4 divide-y border-t text-sm">
          {past.map((l) => <li key={l.link_id} className="flex justify-between gap-2 py-2"><span>{l.name} · até {new Date(l.ended_at ?? l.ends_at).toLocaleDateString("pt-BR")}</span><span className="text-muted-foreground">{l.deliveries} entregas · {Number(l.km).toFixed(1)} km</span></li>)}
        </ul>
      )}
    </section>
  );
}

function Team({ store }: { store: Store }) {
  const qc = useQueryClient();
  const key = ["team", store.id];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("store_couriers").select("*").eq("store_id", store.id).order("name")).data ?? [] });
  const [f, setF] = useState({ name: "", whatsapp: "", plate: "" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("store_couriers").insert({ store_id: store.id, name: f.name, whatsapp: f.whatsapp.replace(/\D/g, ""), plate: f.plate.toUpperCase() || null });
    if (error) { toast.error("Erro ao salvar"); return; }
    setF({ name: "", whatsapp: "", plate: "" }); qc.invalidateQueries({ queryKey: key }); toast.success("Entregador adicionado");
  }
  return (
    <div className="mt-4 space-y-6">
      <Affiliates store={store} />
      <h2 className="text-lg font-bold">Contatos de entregadores (sem app)</h2>
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          {!store.own_couriers && <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">Ative "Tenho entregador próprio" em Loja e entrega para oferecer frete grátis até {FREE_KM_OWN} km.</p>}
          {data?.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <div className="flex-1"><p className="font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">{t.whatsapp}{t.plate ? ` · Placa ${t.plate}` : ""}</p></div>
              <Button size="icon" variant="ghost" aria-label="Remover" onClick={async () => { await supabase.from("store_couriers").delete().eq("id", t.id); qc.invalidateQueries({ queryKey: key }); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {data?.length === 0 && <p className="text-muted-foreground">Nenhum entregador cadastrado.</p>}
        </div>
        <form onSubmit={add} className="h-fit space-y-3 rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-2 font-bold"><MessageCircle className="h-4 w-4" />Novo entregador</p>
          <div><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>WhatsApp</Label><Input required value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="(31) 9…" /></div>
          <div><Label>Placa da moto</Label><Input value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} placeholder="ABC1D23" /></div>
          <Button className="w-full" type="submit"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
        </form>
      </div>
    </div>
  );
}

function PhotoButton({ onPick, label = "Foto", capture, square = false }: { onPick: (url: string) => void; label?: React.ReactNode; capture?: boolean; square?: boolean }) {
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { onPick(await (square ? squareImage(file) : compressImage(file))); toast.success("Foto pronta — salve para aplicar"); } catch { toast.error("Não foi possível ler a foto"); }
    e.target.value = "";
  }
  return (
    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border bg-card px-3 text-sm font-semibold hover:border-primary">
      {label}<input type="file" accept="image/*" capture={capture ? "environment" : undefined} className="hidden" onChange={pick} />
    </label>
  );
}

/** Two explicit choices: open the camera, or pick a file/gallery image. */
function PhotoChoice({ onPick, square = false }: { onPick: (url: string) => void; square?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <PhotoButton capture square={square} onPick={onPick} label={<><Camera className="h-4 w-4" />Tirar foto</>} />
      <PhotoButton square={square} onPick={onPick} label={<><ImageUp className="h-4 w-4" />Escolher arquivo</>} />
    </div>
  );
}

function OptionsEditor({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [price, setPrice] = useState("");
  const key = ["opts", productId];
  const { data } = useQuery({ queryKey: key, enabled: open, queryFn: async () => (await supabase.from("product_options").select("*").eq("product_id", productId).order("created_at")).data ?? [] });
  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("product_options").insert({ product_id: productId, name: name.trim(), price: Number(price.replace(",", ".")) || 0 });
    if (error) { toast.error("Erro ao salvar"); return; }
    setName(""); setPrice(""); qc.invalidateQueries({ queryKey: key });
  }
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Adicionais</Button>;
  return (
    <div className="w-full rounded-xl bg-muted p-3 text-sm">
      <div className="flex justify-between"><p className="font-semibold">Adicionais</p><button className="text-xs" onClick={() => setOpen(false)}>Fechar</button></div>
      {data?.map((o) => (
        <p key={o.id} className="flex items-center justify-between py-1"><span>{o.name} · {brl(Number(o.price))}</span>
          <button aria-label="Remover" onClick={async () => { await supabase.from("product_options").delete().eq("id", o.id); qc.invalidateQueries({ queryKey: key }); }}><Trash2 className="h-4 w-4" /></button></p>
      ))}
      <div className="mt-2 flex gap-2"><Input placeholder="Ex.: Bacon extra" value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="w-24" inputMode="decimal" placeholder="R$" value={price} onChange={(e) => setPrice(e.target.value)} /><Button size="sm" onClick={add}>Incluir</Button></div>
    </div>
  );
}

function PayoutHistory({ storeId }: { storeId: string }) {
  const { data } = useQuery({ queryKey: ["payouts", storeId], queryFn: async () => (await supabase.from("payouts").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(24)).data ?? [] });
  if (!data?.length) return <p className="text-xs text-muted-foreground">Nenhum repasse feito ainda.</p>;
  return (
    <div className="border-t pt-3 text-sm"><p className="mb-1 font-semibold">Repasses recebidos</p>
      {data.map((p) => <p key={p.id} className="flex justify-between"><span>{new Date(p.created_at).toLocaleDateString("pt-BR")} · {p.orders_count} pedidos</span><span>{brl(Number(p.amount))} · {p.status}</span></p>)}
    </div>
  );
}
