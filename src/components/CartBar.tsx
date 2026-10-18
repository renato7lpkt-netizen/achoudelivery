import { Link, useLocation } from "@tanstack/react-router";
import { ShoppingBag, Store, ChevronRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { brl } from "@/lib/market";

/** Faixa fixa no rodapé com o carrinho: abrir a loja ou fechar o pedido. */
export function CartBar() {
  const { cart, count, subtotal } = useCart();
  const { pathname } = useLocation();
  if (!cart || count === 0 || pathname.startsWith("/checkout") || pathname.startsWith("/pedido")) return null;
  const inStore = pathname === `/loja/${cart.storeSlug}`;
  return (
    <>
      <div className="h-24" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-3 shadow-pop backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {!inStore && (
            <Link to="/loja/$slug" params={{ slug: cart.storeSlug }} className="flex min-w-0 items-center gap-2 rounded-xl border bg-card px-3 py-3 text-sm font-semibold hover:border-primary">
              <Store className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate"><span className="hidden sm:inline">Abrir </span>{cart.storeName}</span>
            </Link>
          )}
          <Link to="/checkout" className="flex flex-1 items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground">
            <span className="relative"><ShoppingBag className="h-6 w-6" /><span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-background px-1 text-xs font-bold text-primary">{count}</span></span>
            <span className="flex-1 font-bold">Ver carrinho</span>
            <span className="font-display text-lg font-extrabold">{brl(subtotal)}</span>
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </>
  );
}
