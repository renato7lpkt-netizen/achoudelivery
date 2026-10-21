import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Clock, Bike, Search, Star, Zap, Sandwich, Pizza, ShoppingBasket, CakeSlice, CupSoda, Pill, PawPrint, Store, LayoutGrid, type LucideIcon } from "lucide-react";
import { Banners } from "@/components/Banners";
import { storesQuery } from "@/lib/queries";
import { CATEGORIES, CITY_CENTER, brl, deliveryFee, effectivePrice, etaMin, haversineKm, isOpenNow, isStorePaused, todayHours } from "@/lib/market";
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

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Lanches: Sandwich, Pizza, Mercado: ShoppingBasket, Doces: CakeSlice, Bebidas: CupSoda, "Farmácia": Pill, Pet: PawPrint, Outros: Store,
};

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
  const searchRef = useRef<HTMLInputElement>(null);
  const { hash } = useLocation();

  // "Busca" tab in the bottom nav links to /#busca: bring the search field up and focus it.
  useEffect(() => {
    if (hash !== "busca") return;
    searchRef.current?.scrollIntoView({ block: "center" });
    searchRef.current?.focus();
  }, [hash]);

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
            <Input id="busca" ref={searchRef} type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar loja ou produto (ex.: pizza, açaí)…" className="h-12 rounded-full bg-card pl-12 text-foreground" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <Banners />
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          <CategoryTile label="Todas" icon={LayoutGrid} active={!cat} onClick={() => setCat(null)} />
          {CATEGORIES.map((c) => <CategoryTile key={c} label={c} icon={CATEGORY_ICONS[c] ?? Store} active={cat === c} onClick={() => setCat(cat === c ? null : c)} />)}
        </div>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
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
        <div className="mt-3 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="my-2 h-20 rounded-2xl" />)}
          {list.map((s) => <StoreRow key={s.id} s={s} />)}
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

type StoreItem = Awaited<ReturnType<NonNullable<typeof storesQuery.queryFn>>>[number] & { km: number; open: boolean };

/** iFood-style list row: logo on the left, name, rating/category/distance, then time and delivery fee. */
function StoreRow({ s }: { s: StoreItem }) {
  const fee = deliveryFee(s, s.km);
  return (
    <Link to="/loja/$slug" params={{ slug: s.slug }} className="group flex items-center gap-4 border-b py-3 last:border-b-0">
      <div className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border bg-accent ${s.open ? "" : "grayscale"}`}>
        {s.logo_url || s.cover_url
          ? <img src={(s.logo_url || s.cover_url)!} alt="" loading="lazy" className="h-full w-full object-cover" />
          : <span className="grid h-full w-full place-items-center font-display text-2xl font-extrabold text-accent-foreground">{s.name.charAt(0)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-bold group-hover:text-primary">{s.name}</h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          {s.rating_count > 0
            ? <span className="flex items-center gap-0.5 font-semibold text-secondary-foreground"><Star className="h-3.5 w-3.5 fill-secondary text-secondary" />{Number(s.rating_avg).toFixed(1)}</span>
            : <span className="font-semibold text-primary">Novidade</span>}
          <span aria-hidden>•</span><span>{s.category}</span>
          <span aria-hidden>•</span><span>{s.km.toFixed(1)} km</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          {s.open ? <span>{etaMin(s)}-{etaMin(s) + 10} min</span> : <span className="font-semibold text-foreground">Fechada · {todayHours(s.store_hours)}</span>}
          {s.delivery_enabled && <><span aria-hidden>•</span>{fee === 0 ? <span className="font-semibold text-success">Grátis</span> : <span>{brl(fee)}</span>}</>}
        </p>
      </div>
    </Link>
  );
}

function CategoryTile({ label, icon: Icon, active, onClick }: { label: string; icon: LucideIcon; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} className="flex w-[72px] shrink-0 snap-start flex-col items-center gap-1.5 text-xs font-semibold">
      <span className={`grid h-16 w-16 place-items-center rounded-2xl transition ${active ? "bg-primary text-primary-foreground shadow-pop" : "bg-accent text-accent-foreground hover:bg-accent/70"}`}>
        <Icon className="h-7 w-7" />
      </span>
      <span className={active ? "text-primary" : ""}>{label}</span>
    </button>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}>
      {children}
    </button>
  );
}
