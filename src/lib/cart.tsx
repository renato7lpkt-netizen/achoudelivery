import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = { key?: string; productId: string; name: string; price: number; qty: number; image?: string | null; options?: string[]; optionsLabel?: string };
const k = (i: { key?: string; productId: string }) => i.key ?? i.productId;
export type Cart = { storeId: string; storeSlug: string; storeName: string; items: CartItem[] } | null;

type Ctx = {
  cart: Cart;
  add: (store: { id: string; slug: string; name: string }, item: Omit<CartItem, "qty">) => boolean;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = "achadao-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setCart(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    if (cart) localStorage.setItem(KEY, JSON.stringify(cart));
    else localStorage.removeItem(KEY);
  }, [cart]);

  const add: Ctx["add"] = (store, raw) => {
    const item = { ...raw, key: raw.productId + (raw.options?.length ? ":" + [...raw.options].sort().join(",") : "") };
    if (cart && cart.storeId !== store.id) {
      if (!window.confirm(`Seu carrinho tem itens de ${cart.storeName}. Esvaziar e começar um novo em ${store.name}?`))
        return false;
      setCart({ storeId: store.id, storeSlug: store.slug, storeName: store.name, items: [{ ...item, qty: 1 }] });
      return true;
    }
    setCart((c) => {
      const base = c ?? { storeId: store.id, storeSlug: store.slug, storeName: store.name, items: [] };
      const ex = base.items.find((i) => k(i) === item.key);
      const items = ex
        ? base.items.map((i) => (k(i) === item.key ? { ...i, qty: i.qty + 1 } : i))
        : [...base.items, { ...item, qty: 1 }];
      return { ...base, items };
    });
    return true;
  };
  const setQty = (key: string, qty: number) =>
    setCart((c) => {
      if (!c) return c;
      const items = c.items.map((i) => (k(i) === key ? { ...i, qty } : i)).filter((i) => i.qty > 0);
      return items.length ? { ...c, items } : null;
    });
  const count = cart?.items.reduce((s, i) => s + i.qty, 0) ?? 0;
  const subtotal = cart?.items.reduce((s, i) => s + i.qty * i.price, 0) ?? 0;
  return (
    <CartCtx.Provider value={{ cart, add, setQty, clear: () => setCart(null), count, subtotal }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("CartProvider missing");
  return c;
}
