import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, MapPin, Phone, Plus, Bike, Star, CloudRain } from "lucide-react";
import { toast } from "sonner";
import { storeQuery } from "@/lib/queries";
import { FREE_KM_OWN, WEEKDAYS, brl, deliveryFee, effectivePrice, etaMin, isOpenNow, isStorePaused, todayHours } from "@/lib/market";
import { useCart } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/loja/$slug")({
  head: () => ({
    meta: [
      { title: "Loja no AchouDelivery — Sete Lagoas" },
      { name: "description", content: "Veja o catálogo, preços e horários e peça direto da loja." },
      { property: "og:title", content: "Loja no AchouDelivery" },
      { property: "og:description", content: "Catálogo e pedidos online de lojas de Sete Lagoas." },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { slug } = Route.useParams();
  const { data: s, isLoading } = useQuery(storeQuery(slug));
  const { add } = useCart();
  const qc = useQueryClient();
  const [pick, setPick] = useState<Product | null>(null);
  const { data: top } = useQuery({ queryKey: ["top", s?.id], enabled: !!s?.id, queryFn: async () => (await supabase.rpc("top_products", { _store: s!.id })).data ?? [] });

  useEffect(() => {
    if (!s?.id) return;
    const ch = supabase.channel(`store-${s.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stores", filter: `id=eq.${s.id}` }, () => qc.invalidateQueries({ queryKey: ["store", slug] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [s?.id, slug, qc]);

  if (isLoading) return <div className="mx-auto max-w-6xl p-4"><Skeleton className="h-72 rounded-2xl" /></div>;
  if (!s) return <div className="p-12 text-center">Loja não encontrada. <Link to="/" className="text-primary underline">Voltar</Link></div>;

  const paused = isStorePaused(s);
  const open = isOpenNow(s.store_hours, paused);
  const sections = Array.from(new Set(s.products.map((p) => p.section)));
  const topList = (top ?? []).map((t) => s.products.find((p) => p.id === t.product_id)).filter((p): p is NonNullable<typeof p> => !!p && p.available);
  const addProduct = (p: Product) => {
    if (p.product_options?.length) { setPick(p); return; }
    if (add({ id: s.id, slug: s.slug, name: s.name }, { productId: p.id, name: p.name, price: effectivePrice(p), image: p.image_url })) toast.success(`${p.name} no carrinho`);
  };

  return (
    <main className="pb-16">
      <div className="relative h-36 bg-hero md:h-56">
        {s.cover_url && <img src={s.cover_url} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <div className="relative z-10 -mt-10 flex items-end gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-background bg-accent font-display text-3xl font-extrabold text-accent-foreground shadow-pop">
            {s.logo_url ? <img src={s.logo_url} alt={`Logo ${s.name}`} className="h-full w-full object-cover" /> : s.name.charAt(0)}
          </div>
          <span className={`mb-2 rounded-full px-3 py-1 text-xs font-bold ${open ? "bg-success text-success-foreground" : "bg-foreground text-background"}`}>
            {open ? "Aberta agora" : paused ? "Pausada pela loja" : "Fechada"}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold md:text-4xl">{s.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          {s.rating_count > 0
            ? <span className="flex items-center gap-1 font-semibold text-secondary-foreground"><Star className="h-4 w-4 fill-secondary text-secondary" />{Number(s.rating_avg).toFixed(1)} ({s.rating_count})</span>
            : <span className="font-semibold text-primary">Novidade</span>}
          <span aria-hidden>•</span><span>{s.category}</span>
          <span aria-hidden>•</span><span className="flex items-center gap-1"><Clock className="h-4 w-4" />{etaMin(s)}-{etaMin(s) + 10} min</span>
          {s.delivery_enabled && <><span aria-hidden>•</span><span className="flex items-center gap-1"><Bike className="h-4 w-4" />{s.own_couriers ? `Grátis até ${FREE_KM_OWN} km` : `${brl(deliveryFee(s, 0))} + ${brl(Number(s.delivery_fee_per_km))}/km`}</span></>}
        </p>
        {Number(s.min_order) > 0 && <p className="mt-1 text-sm text-muted-foreground">Pedido mínimo {brl(Number(s.min_order))}</p>}
      </div>

      {sections.length > 1 && (
        <nav aria-label="Seções do cardápio" className="sticky top-16 z-30 mt-4 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
            {sections.map((sec, i) => (
              <a key={sec} href={`#secao-${i}`} className="shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">{sec}</a>
            ))}
          </div>
        </nav>
      )}

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 md:grid-cols-[1fr_280px]">
        <div>
          {s.rain_mode && <p className="mb-3 flex items-center gap-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground"><CloudRain className="h-4 w-4" />Alta demanda agora: as entregas podem levar um pouco mais.</p>}
          {s.description && <p className="text-muted-foreground">{s.description}</p>}
          {topList.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 text-xl font-bold">🔥 Mais pedidos</h2>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                {topList.map((p) => (
                  <button key={p.id} disabled={!open} onClick={() => addProduct(p)} className="w-36 shrink-0 rounded-2xl border bg-card p-2 text-left disabled:opacity-50">
                    <div className="h-24 overflow-hidden rounded-xl bg-muted">{p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}</div>
                    <p className="mt-1 line-clamp-1 text-sm font-semibold">{p.name}</p><p className="text-sm font-bold text-primary">{brl(effectivePrice(p))}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
          {sections.map((sec, i) => (
            <section key={sec} id={`secao-${i}`} className="mt-8 scroll-mt-32">
              <h2 className="mb-1 text-xl font-bold">{sec}</h2>
              <div className="grid gap-x-6 sm:grid-cols-2">
                {s.products.filter((p) => p.section === sec).map((p) => (
                  <div key={p.id} className={`flex gap-3 border-b py-4 ${p.available ? "" : "opacity-50"}`}>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                      {effectivePrice(p) < Number(p.price) ? (
                        <p className="mt-2 flex items-center gap-2"><span className="text-sm text-muted-foreground line-through">{brl(Number(p.price))}</span><span className="font-bold text-primary">{brl(effectivePrice(p))}</span><span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">-{Math.round((1 - effectivePrice(p) / Number(p.price)) * 100)}%</span></p>
                      ) : <p className="mt-2 font-bold text-primary">{brl(Number(p.price))}</p>}
                    </div>
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />}
                      <Button size="icon" disabled={!open || !p.available} aria-label={`Adicionar ${p.name}`}
                        className="absolute bottom-1 right-1 h-8 w-8 rounded-full shadow-pop"
                        onClick={() => addProduct(p)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {s.products.length === 0 && <p className="mt-8 text-muted-foreground">Esta loja ainda não cadastrou produtos.</p>}
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border bg-card p-4 text-sm md:sticky md:top-20">
          <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-primary" />{s.address}</p>
          {s.phone && <p className="flex gap-2"><Phone className="h-4 w-4 text-primary" />{s.phone}</p>}
          <p className="flex gap-2"><Clock className="h-4 w-4 text-primary" />Hoje: {todayHours(s.store_hours)}</p>
          <p className="flex gap-2"><Bike className="h-4 w-4 text-primary" />{s.own_couriers ? `Entrega grátis até ${FREE_KM_OWN} km, depois ${brl(Number(s.delivery_fee_per_km))}/km` : `Entrega: ${brl(Number(s.delivery_fee_per_km))}/km`} (máx. {Number(s.delivery_max_km)} km)</p>
          <div className="border-t pt-3">
            <p className="mb-1 font-semibold">Horários</p>
            {WEEKDAYS.map((d, i) => {
              const h = s.store_hours.filter((x) => x.weekday === i);
              return <p key={d} className="flex justify-between text-muted-foreground"><span>{d}</span><span>{h.length ? h.map((x) => `${x.opens.slice(0, 5)}–${x.closes.slice(0, 5)}`).join(", ") : "Fechado"}</span></p>;
            })}
          </div>
        </aside>
      </div>
      <OptionsDialog p={pick} onClose={() => setPick(null)} onAdd={(p, chosen) => {
        if (add({ id: s.id, slug: s.slug, name: s.name }, { productId: p.id, name: p.name, image: p.image_url,
          price: effectivePrice(p) + chosen.reduce((t, o) => t + Number(o.price), 0),
          options: chosen.map((o) => o.id), optionsLabel: chosen.map((o) => o.name).join(", ") })) toast.success(`${p.name} no carrinho`);
        setPick(null);
      }} />
    </main>
  );
}

type Opt = { id: string; name: string; price: number };
type Product = { id: string; name: string; price: number; promo_price: number | null; promo_days: number[]; image_url: string | null; available: boolean; product_options?: Opt[] };

function OptionsDialog({ p, onClose, onAdd }: { p: Product | null; onClose: () => void; onAdd: (p: Product, chosen: Opt[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => setSel([]), [p?.id]);
  if (!p) return null;
  const chosen = (p.product_options ?? []).filter((o) => sel.includes(o.id));
  const total = effectivePrice(p) + chosen.reduce((t, o) => t + Number(o.price), 0);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{p.name}</DialogTitle></DialogHeader>
        <p className="text-sm font-semibold">Adicionais</p>
        <div className="space-y-2">
          {p.product_options?.map((o) => (
            <label key={o.id} className="flex items-center gap-3 rounded-xl border p-3">
              <Checkbox checked={sel.includes(o.id)} onCheckedChange={(v) => setSel(v ? [...sel, o.id] : sel.filter((x) => x !== o.id))} />
              <span className="flex-1">{o.name}</span><span className="text-sm text-muted-foreground">{Number(o.price) > 0 ? `+ ${brl(Number(o.price))}` : "Grátis"}</span>
            </label>
          ))}
        </div>
        <Button size="lg" onClick={() => onAdd(p, chosen)}>Adicionar · {brl(total)}</Button>
      </DialogContent>
    </Dialog>
  );
}
