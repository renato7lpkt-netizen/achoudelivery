import { Link, useLocation } from "@tanstack/react-router";
import { ShoppingBag, Store, ChevronRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { bottomNavVisible } from "@/components/BottomNav";
import { brl } from "@/lib/market";
import { appArea } from "@/lib/web-manifest";

/** Faixa fixa no rodapé com o carrinho: abrir a loja ou fechar o pedido. */
export function CartBar() {
  const { cart, count, subtotal } = useCart();
  const { pathname } = useLocation();
  if (!cart || count === 0 || pathname.startsWith("/checkout") || pathname.startsWith("/pedido") || appArea(pathname) !== "cliente") return null;
  const inStore = pathname === `/loja/${cart.storeSlug}`;
  // On phones the tab bar sits at the very bottom, so the cart rides just above it.
  const aboveNav = bottomNavVisible(pathname);
  return (
    <>
      <div className="h-24" aria-hidden />
      <div className={`fixed inset-x-0 z-50 border-t bg-background/95 p-3 shadow-pop backdrop-blur md:bottom-0 ${aboveNav ? "bottom-16" : "bottom-0"}`} style={aboveNav ? undefined : { paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {!inStore && (
            <Link to="/loja/$slug" params={{ slug: cart.storeSlug }} className="flex min-w-0 max-w-[38%] items-center gap-2 rounded-xl border bg-card px-3 py-3 text-sm font-semibold hover:border-primary">
              <Store className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate"><span className="hidden sm:inline">Abrir </span>{cart.storeName}</span>
            </Link>
          )}
          {/* min-w-0 lets this shrink on narrow phones; the label truncates so the total always stays visible */}
          <Link to="/checkout" className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-primary px-3 py-3 text-primary-foreground sm:gap-3 sm:px-4">
            <span className="relative shrink-0"><ShoppingBag className="h-6 w-6" /><span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-background px-1 text-xs font-bold text-primary">{count}</span></span>
            <span className="min-w-0 flex-1 truncate font-bold">Ver carrinho</span>
            <span className="shrink-0 whitespace-nowrap font-display text-base font-extrabold sm:text-lg">{brl(subtotal)}</span>
            <ChevronRight className="hidden h-5 w-5 shrink-0 sm:block" />
          </Link>
        </div>
      </div>
    </>
  );
}
