import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock, Bike, Search, Star, Zap } from "lucide-react";
import { Banners } from "@/components/Banners";
import { AppDownload } from "@/components/AppDownload";
import { storesQuery } from "@/lib/queries";
import { CATEGORIES, CITY_CENTER, FREE_KM_OWN, brl, deliveryFee, effectivePrice, etaMin, haversineKm, isOpenNow, isStorePaused, todayHours } from "@/lib/market";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AchouDelivery — Peça das lojas de Sete Lagoas" },
      { name: "description", content: "Marketplace local de Sete Lagoas: lanches, mercado, doces e mais com entrega rápida." },
      { property: "og:title", content: "AchouDelivery — Peça das lojas de Sete Lagoas" },
      { property: "og:description", content: "Encontre lojas abertas perto de você e peça com Pix ou cartão." },
    ],
  }),
  component: Vitrine,
});

function Vitrine() {
  const { data: stores, isLoading } = useQuery(storesQuery);
  const qc = useQueryClient();
  const [loc, setLoc] = useState(CITY_CENTER);
  const [usingGps, setUsingGps] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [fastest, setFastest] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setUsingGps(true); },
      () => {},
      { timeout: 8000 },
    );
    const ch = supabase.channel("stores-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "stores" }, () => qc.invalidateQueries({ queryKey: ["stores"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: found } = useQuery({
    queryKey: ["product-search", q.trim().toLowerCase()],
    enabled: q.trim().length >= 2,
    queryFn: async () => (await supabase.from("products").select("id,name,price,promo_price,promo_days,image_url,store_id").eq("available", true).ilike("name", `%${q.trim().replace(/[%_,]/g, "")}%`).limit(12)).data ?? [],
  });
  const list = useMemo(() => {
    return (stores ?? [])
      .map((s) => ({ ...s, km: haversineKm(loc, s), open: isOpenNow(s.store_hours, isStorePaused(s)) }))
      .filter((s) => (!cat || s.category === cat) && (!openOnly || s.open) && (!freeOnly || deliveryFee(s, s.km) === 0)
        && (s.name.toLowerCase().includes(q.toLowerCase()) || s.category.toLowerCase().includes(q.toLowerCase()) || (found ?? []).some((p) => p.store_id === s.id)))
      .sort((a, b) => Number(b.open) - Number(a.open) || (fastest ? etaMin(a) - etaMin(b) : 0) || a.km - b.km);
  }, [stores, loc, cat, openOnly, freeOnly, fastest, q, found]);

  const { data: featured } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => (await supabase.from("products").select("id,name,price,promo_price,promo_days,image_url,store_id").eq("available", true).order("created_at", { ascending: false }).limit(60)).data ?? [],
  });
  const shownProducts = useMemo(() => {
    const src = q.trim().length >= 2 ? (found ?? []) : (featured ?? []);
    return src
      .map((p) => ({ p, st: list.find((s) => s.id === p.store_id) }))
      .filter((x): x is { p: typeof src[number]; st: (typeof list)[number] } => !!x.st)
      .slice(0, 6);
  }, [q, found, featured, list]);

  return (
    <main>
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-background/15 px-3 py-1 text-sm">
            <MapPin className="h-4 w-4" />{usingGps ? "Perto de você" : "Sete Lagoas · MG"}
          </p>
          <h1 className="max-w-2xl text-4xl font-extrabold md:text-6xl">O melhor da cidade, chegando aí.</h1>
          <p className="mt-3 max-w-xl text-lg opacity-90">Lojas de Sete Lagoas com entrega rápida na sua porta.</p>
          <div className="relative mt-6 max-w-lg">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar loja ou produto (ex.: pizza, açaí)…" className="h-12 rounded-full bg-card pl-12 text-foreground" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <Banners />
        <AppDownload />
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={!cat} onClick={() => setCat(null)}>Todas</Chip>
          {CATEGORIES.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip active={openOnly} onClick={() => setOpenOnly(!openOnly)}><Clock className="mr-1 inline h-4 w-4" />Abertos agora</Chip>
          <Chip active={freeOnly} onClick={() => setFreeOnly(!freeOnly)}><Bike className="mr-1 inline h-4 w-4" />Entrega grátis</Chip>
          <Chip active={fastest} onClick={() => setFastest(!fastest)}><Zap className="mr-1 inline h-4 w-4" />Mais rápidos</Chip>
        </div>

        {shownProducts.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-xl font-bold">{q.trim().length >= 2 ? "Produtos encontrados" : "Produtos"}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shownProducts.map(({ p, st }) => (
                <Link key={p.id} to="/loja/$slug" params={{ slug: st.slug }} className="overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-1 hover:border-primary">
                  <div className="aspect-square bg-muted">{p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />}</div>
                  <div className="p-3">
                    <p className="line-clamp-1 font-semibold">{p.name}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{st.name}</p>
                    <p className="mt-1 font-bold text-primary">{brl(effectivePrice(p))}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <h2 className="mt-8 text-xl font-bold">Lojas</h2>
        <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          {list.map((s) => (
            <Link key={s.id} to="/loja/$slug" params={{ slug: s.slug }}
              className={`group overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-1 hover:shadow-pop ${s.open ? "" : "opacity-70"}`}>
              <div className="relative aspect-[16/9] bg-muted">
                {s.cover_url && <img src={s.cover_url} alt={s.name} loading="lazy" className="h-full w-full object-cover" />}
                <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${s.open ? "bg-success text-success-foreground" : "bg-foreground text-background"}`}>
                  {s.open ? "Aberta" : "Fechada"}
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold">{s.name}</h3>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{s.category}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {s.rating_count > 0 && <span className="flex items-center gap-1 font-semibold text-foreground"><Star className="h-3.5 w-3.5 fill-primary text-primary" />{Number(s.rating_avg).toFixed(1)} ({s.rating_count})</span>}
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.km.toFixed(1)} km</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{etaMin(s)} min · {todayHours(s.store_hours)}</span>
                  {s.delivery_enabled && <span className="flex items-center gap-1"><Bike className="h-3.5 w-3.5" />{deliveryFee(s, s.km) === 0 ? "Entrega grátis" : brl(deliveryFee(s, s.km))}</span>}
                  {s.own_couriers && <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">Grátis até {FREE_KM_OWN} km</span>}
                </div>
              </div>
            </Link>
          ))}
          {!isLoading && list.length === 0 && <p className="col-span-full py-12 text-center text-muted-foreground">Nenhuma loja encontrada.</p>}
        </div>
      </section>

      <footer className="mt-12 border-t py-6 text-center text-xs text-muted-foreground">
        <Link to="/privacidade" className="font-semibold hover:text-primary hover:underline">Política de Privacidade</Link>
        <span className="mx-2">·</span>
        Seus dados são protegidos conforme a LGPD
      </footer>
    </main>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}>
      {children}
    </button>
  );
}
