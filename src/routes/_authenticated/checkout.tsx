import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, LocateFixed, Loader2, MapPin, User, ShoppingBag, CreditCard, QrCode, Store } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { storeQuery } from "@/lib/queries";
import { FREE_KM_OWN, INSTALLMENT_MIN, brl, deliveryFee, geocode, haversineKm, isOpenNow, isStorePaused, maxInstallments } from "@/lib/market";
import { createOrder } from "@/lib/orders.functions";
import { isValidCpf, maskCpf, maskPhone } from "@/lib/br";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Finalizar pedido — AchouDelivery" }, { name: "description", content: "Revise seu carrinho e pague com Pix ou cartão." }, { property: "og:title", content: "Finalizar pedido — AchouDelivery" }, { property: "og:description", content: "Checkout do AchouDelivery." }] }),
  component: Checkout,
});

function Checkout() {
  const { cart, setQty, subtotal, clear } = useCart();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const create = useServerFn(createOrder);
  const { data: store } = useQuery({ ...storeQuery(cart?.storeSlug ?? ""), enabled: !!cart });
  const [method, setMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [inst, setInst] = useState(1);
  const [f, setF] = useState({ name: "", phone: "", cpf: "", address: "", notes: "" });
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoGeo = useRef(false);

  // Preenche o endereço salvo na conta (ou do cadastro) e calcula o frete sozinho
  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("profiles").select("address, lat, lng, full_name, phone, cpf").eq("id", user.id).maybeSingle();
      setF((prev) => ({ ...prev, name: prev.name || p?.full_name || "", phone: prev.phone || p?.phone || "", cpf: prev.cpf || maskCpf(p?.cpf ?? "") }));
      const addr = p?.address || localStorage.getItem("achadao_address") || "";
      if (addr) setF((prev) => ({ ...prev, address: prev.address || addr }));
      if (p?.lat != null && p?.lng != null) setPos({ lat: p.lat, lng: p.lng });
    })();
  }, [user.id]);

  useEffect(() => {
    if (autoGeo.current || !store || !f.address || pos) return;
    autoGeo.current = true;
    setLocating(true);
    geocode(f.address).then((g) => { if (g) setPos(g); }).finally(() => setLocating(false));
  }, [store, f.address, pos]);

  if (!cart) return <main className="p-16 text-center"><p>Seu carrinho está vazio.</p><Link to="/" className="text-primary underline">Ver lojas</Link></main>;

  const fulfill = "delivery" as const;
  const km = store && pos ? haversineKm(store, pos) : null;
  const fee = fulfill === "delivery" && store && km != null ? deliveryFee(store, km) : 0;
  const outOfRange = fulfill === "delivery" && store && km != null && km > Number(store.delivery_max_km);
  const open = store ? isOpenNow(store.store_hours, isStorePaused(store)) : true;

  async function locateByAddress() {
    if (!f.address) { toast.error("Digite o endereço"); return; }
    setLocating(true);
    const g = await geocode(f.address).catch(() => null);
    setLocating(false);
    if (!g) { toast.error("Não achamos esse endereço. Tente só rua e bairro, o CEP, ou use sua localização."); return; }
    setPos(g);
  }
  function locateGps() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => { setLocating(false); toast.error("Não foi possível obter sua localização"); },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (fulfill === "delivery" && !pos) { toast.error("Calcule a distância do endereço de entrega"); return; }
    if (!isValidCpf(f.cpf)) { toast.error("CPF inválido. Confira os 11 números."); return; }
    setBusy(true);
    try {
      if (fulfill === "delivery" && f.address) {
        await supabase.from("profiles").upsert({ id: user.id, full_name: f.name, phone: f.phone, cpf: f.cpf.replace(/\D/g, ""), address: f.address, lat: pos?.lat ?? null, lng: pos?.lng ?? null });
        localStorage.removeItem("achadao_address");
      }
      const r = await create({ data: {
        storeId: cart!.storeId, items: cart!.items.map((i) => ({ productId: i.productId, qty: i.qty, options: i.options ?? [] })),
        fulfillment: fulfill, name: f.name, phone: f.phone, cpf: f.cpf.replace(/\D/g, ""), email: user.email!,
        address: fulfill === "delivery" ? f.address : undefined, lat: pos?.lat, lng: pos?.lng, notes: f.notes || undefined, method,
        installments: method === "CREDIT_CARD" ? Math.min(inst, maxInstallments(subtotal + fee)) : 1,
      } });
      clear();
      navigate({ to: "/pedido/$id", params: { id: r.orderId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao finalizar");
    } finally { setBusy(false); }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const total = subtotal + fee;
  const canPay = !busy && open && !outOfRange;
  const payLabel = `Pagar com ${method === "PIX" ? "Pix" : "cartão"}`;

  const items = (
    <ul className="divide-y">
      {cart.items.map((i) => (
        <li key={i.key ?? i.productId} className="flex items-center gap-3 py-3 text-sm">
          <span className="min-w-0 flex-1"><span className="font-semibold">{i.name}</span>{i.optionsLabel && <span className="block text-xs text-muted-foreground">+ {i.optionsLabel}</span>}
            <span className="block font-semibold text-primary">{brl(i.qty * i.price)}</span></span>
          <div className="flex items-center rounded-full border">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Menos ${i.name}`} onClick={() => setQty(i.key ?? i.productId, i.qty - 1)}><Minus className="h-3.5 w-3.5" /></Button>
            <span className="w-6 text-center font-semibold">{i.qty}</span>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Mais ${i.name}`} onClick={() => setQty(i.key ?? i.productId, i.qty + 1)}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        </li>
      ))}
    </ul>
  );
  const totals = (
    <div className="space-y-1 text-sm">
      <p className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{brl(subtotal)}</span></p>
      <p className="flex justify-between text-muted-foreground"><span>Taxa de entrega</span><span className={km != null && fee === 0 ? "font-semibold text-success" : ""}>{km == null ? "Informe o endereço" : fee === 0 ? "Grátis" : brl(fee)}</span></p>
      <p className="flex justify-between pt-2 text-lg font-bold"><span>Total</span><span>{brl(total)}</span></p>
    </div>
  );

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[1fr_340px] md:py-8">
      <form id="co" onSubmit={submit} className="space-y-4">
        <h1 className="text-2xl font-extrabold md:text-3xl">Finalizar pedido</h1>
        {!open && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">A loja está fechada agora.</p>}

        <Block icon={MapPin} title="Entrega">
          {store?.own_couriers && <p className="mb-3 rounded-xl bg-accent p-3 text-sm font-semibold">Entrega grátis até {FREE_KM_OWN} km nesta loja</p>}
          <Label htmlFor="addr">Endereço de entrega</Label>
          <Input id="addr" required value={f.address} onChange={(e) => { set("address")(e); setPos(null); autoGeo.current = false; }} placeholder="Rua, número, bairro ou CEP" autoComplete="street-address" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={locateByAddress} disabled={locating}>Calcular distância</Button>
            <Button type="button" variant="outline" size="sm" onClick={locateGps} disabled={locating}><LocateFixed className="mr-1 h-4 w-4" />Usar minha localização</Button>
            {locating && <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
          {km != null && <p className={`mt-2 text-sm ${outOfRange ? "text-destructive" : "text-muted-foreground"}`}>{km.toFixed(1)} km da loja {outOfRange && "— fora da área de entrega"}</p>}
          <Label htmlFor="notes" className="mt-4 block">Observações</Label>
          <Textarea id="notes" value={f.notes} onChange={set("notes")} placeholder="Ex.: sem cebola, apartamento 201, troco…" />
        </Block>

        <Block icon={User} title="Seus dados">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="nome">Nome</Label><Input id="nome" required value={f.name} onChange={set("name")} autoComplete="name" /></div>
            <div><Label htmlFor="cel">Celular</Label><Input id="cel" required inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} placeholder="(31) 9…" autoComplete="tel" /></div>
            <div className="sm:col-span-2"><Label htmlFor="cpf">CPF (exigido para o pagamento)</Label><Input id="cpf" required inputMode="numeric" value={f.cpf} onChange={(e) => setF({ ...f, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" />
              {f.cpf.replace(/\D/g, "").length === 11 && !isValidCpf(f.cpf) && <p className="mt-1 text-xs text-destructive">CPF inválido</p>}</div>
          </div>
        </Block>

        <Block icon={ShoppingBag} title="Pedido" className="md:hidden">
          <p className="flex items-center gap-2 text-sm font-semibold"><Store className="h-4 w-4 text-primary" />{cart.storeName}</p>
          {items}
          <div className="border-t pt-3">{totals}</div>
        </Block>

        <Block icon={CreditCard} title="Pagamento">
          <div className="grid grid-cols-2 gap-2">
            {(["PIX", "CREDIT_CARD"] as const).map((m) => {
              const Icon = m === "PIX" ? QrCode : CreditCard;
              return (
                <button type="button" key={m} onClick={() => setMethod(m)} aria-pressed={method === m}
                  className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left font-semibold transition ${method === m ? "border-primary bg-accent" : "border-border bg-card"}`}>
                  <Icon className={`h-5 w-5 shrink-0 ${method === m ? "text-primary" : "text-muted-foreground"}`} />
                  <span>{m === "PIX" ? "Pix" : "Cartão de crédito"}<span className="block text-xs font-normal text-muted-foreground">{m === "PIX" ? "Aprovação na hora" : "Pague pelo link seguro"}</span></span>
                </button>
              );
            })}
          </div>
          {method === "CREDIT_CARD" && (maxInstallments(total) > 1 ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[1, 2].map((n) => (
                <button type="button" key={n} onClick={() => setInst(n)} className={`rounded-xl border p-2 text-sm font-semibold ${inst === n ? "border-primary bg-accent" : "bg-card"}`}>
                  {n}x de {brl(total / n)}
                </button>
              ))}
            </div>
          ) : <p className="mt-2 text-xs text-muted-foreground">Cartão somente à vista (1x). Parcelamento em 2x para compras acima de {brl(INSTALLMENT_MIN)}.</p>)}
        </Block>
      </form>

      <aside className="hidden h-fit rounded-2xl border bg-card p-4 md:sticky md:top-20 md:block">
        <p className="flex items-center gap-2 font-bold"><Store className="h-4 w-4 text-primary" />{cart.storeName}</p>
        {items}
        <div className="border-t pt-3">{totals}</div>
        <Button form="co" type="submit" className="mt-4 w-full shadow-pop" size="lg" disabled={!canPay}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : payLabel}
        </Button>
      </aside>

      {/* Phones: total and pay button always within reach, like a native checkout. */}
      <div className="h-20 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur md:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="leading-tight"><p className="text-xs text-muted-foreground">Total</p><p className="font-display text-xl font-extrabold">{brl(total)}</p></div>
          <Button form="co" type="submit" size="lg" className="flex-1 shadow-pop" disabled={!canPay}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : payLabel}
          </Button>
        </div>
      </div>
    </main>
  );
}

function Block({ icon: Icon, title, className = "", children }: { icon: React.ComponentType<{ className?: string }>; title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border bg-card p-4 ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold"><Icon className="h-5 w-5 text-primary" />{title}</h2>
      {children}
    </section>
  );
}
