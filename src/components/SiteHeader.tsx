import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Store, User, LogOut, Receipt, Bike, ShieldCheck } from "lucide-react";
import { useRoles } from "@/lib/roles";
import { useCart } from "@/lib/cart";
import { useUser } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/market";

export function SiteHeader() {
  const { count, subtotal, cart } = useCart();
  const { user } = useUser();
  const navigate = useNavigate();
  const { data: roles } = useRoles(user?.id);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-hero font-display text-lg font-extrabold text-primary-foreground">A</span>
          <span className="font-display text-xl font-extrabold tracking-tight">AchouDelivery</span>
        </Link>
        <span className="hidden text-xs text-muted-foreground sm:inline">Sete Lagoas · MG</span>
        <div className="ml-auto flex items-center gap-1">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/meus-pedidos"><Receipt className="mr-1 h-4 w-4" /><span className="hidden sm:inline">Pedidos</span></Link></Button>
              <Button asChild variant="ghost" size="sm"><Link to="/minha-conta"><User className="mr-1 h-4 w-4" /><span className="hidden sm:inline">Minha conta</span></Link></Button>
              {roles?.isCourier && <Button asChild variant="ghost" size="sm"><Link to="/entregador"><Bike className="mr-1 h-4 w-4" />Entregador</Link></Button>}
              {roles?.isStore && <Button asChild variant="ghost" size="sm"><Link to="/painel"><Store className="mr-1 h-4 w-4" />Minha loja</Link></Button>}
              {roles?.isAdmin && <Button asChild variant="ghost" size="sm"><Link to="/admin"><ShieldCheck className="mr-1 h-4 w-4" />Admin</Link></Button>}
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
          {count > 0 && cart && (
            <Button asChild size="sm" className="ml-1 rounded-full shadow-pop">
              <Link to="/checkout"><ShoppingBag className="mr-1 h-4 w-4" />{count} · {brl(subtotal)}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
