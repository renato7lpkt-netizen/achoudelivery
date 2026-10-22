import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Store, User, LogOut, Receipt, Bike, ShieldCheck } from "lucide-react";
import { useRoles } from "@/lib/roles";
import { useCart } from "@/lib/cart";
import { useUser } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/market";
import { appArea } from "@/lib/web-manifest";

const AREA_BADGE = {
  loja: { label: "Loja", className: "bg-slate-800 text-white" },
  entregador: { label: "Entregador", className: "bg-green-700 text-white" },
} as const;

export function SiteHeader() {
  const { count, subtotal, cart } = useCart();
  const { user } = useUser();
  const navigate = useNavigate();
  const { data: roles } = useRoles(user?.id);
  // Each area is its own app: the store panel and the courier page hide the shopping links and the cart.
  const area = appArea(useLocation().pathname);
  const shopping = area === "cliente";
  const badge = area === "cliente" ? null : AREA_BADGE[area];
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        {/* min-w-0 + truncate: with the phone's large-text setting the logo shrinks instead of pushing the page wider */}
        <Link to={area === "loja" ? "/painel" : area === "entregador" ? "/entregador" : "/"} className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-hero font-display text-lg font-extrabold text-primary-foreground">A</span>
          <span className={`truncate font-display text-xl font-extrabold tracking-tight ${badge ? "hidden sm:inline" : ""}`}>AchouDelivery</span>
          {badge && <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.className}`}>{badge.label}</span>}
        </Link>
        {shopping && <span className="hidden text-xs text-muted-foreground sm:inline">Sete Lagoas · MG</span>}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {user ? (
            <>
              {!shopping && <Button asChild variant="ghost" size="sm"><Link aria-label="Fazer pedidos" to="/"><ShoppingBag className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Comprar</span></Link></Button>}
              {shopping && <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex"><Link to="/meus-pedidos"><Receipt className="mr-1 h-4 w-4" /><span className="hidden sm:inline">Pedidos</span></Link></Button>}
              {shopping && <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex"><Link to="/minha-conta"><User className="mr-1 h-4 w-4" /><span className="hidden sm:inline">Minha conta</span></Link></Button>}
              {roles?.isCourier && area !== "entregador" && <Button asChild variant="ghost" size="sm"><Link aria-label="Entregador" to="/entregador"><Bike className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Entregador</span></Link></Button>}
              {roles?.isStore && area !== "loja" && <Button asChild variant="ghost" size="sm"><Link aria-label="Minha loja" to="/painel"><Store className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Minha loja</span></Link></Button>}
              {roles?.isAdmin && <Button asChild variant="ghost" size="sm"><Link aria-label="Admin" to="/admin"><ShieldCheck className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Admin</span></Link></Button>}
              <Button variant="ghost" size="icon" aria-label="Sair" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/", replace: true }); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
            <Button asChild variant="ghost" size="sm"><Link to="/entregador"><Bike className="mr-1 h-4 w-4" /><span className="hidden sm:inline">Seja entregador</span></Link></Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/painel"><Store className="mr-1 h-4 w-4" />Venda no AchouDelivery</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/auth"><User className="mr-1 h-4 w-4" />Entrar</Link></Button>
            </>
          )}
          {shopping && count > 0 && cart && (
            // Phones already have the CartBar at the bottom; here it only pushed the header off-screen.
            <Button asChild size="sm" className="ml-1 hidden rounded-full shadow-pop md:inline-flex">
              <Link to="/checkout"><ShoppingBag className="mr-1 h-4 w-4" />{count} · {brl(subtotal)}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
