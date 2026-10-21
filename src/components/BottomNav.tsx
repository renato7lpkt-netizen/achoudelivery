import { Link, useLocation } from "@tanstack/react-router";
import { Bike, ClipboardList, House, Package, Receipt, Search, Store, User, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUser } from "@/lib/session";
import { appArea } from "@/lib/web-manifest";

/** Checkout and order tracking keep the whole screen for their own bottom actions. */
export function bottomNavVisible(pathname: string) {
  return !pathname.startsWith("/checkout") && !pathname.startsWith("/pedido/");
}

type Aba = "pedidos" | "produtos" | "recebimento" | "loja" | "disponiveis" | "minhas" | "ganhos" | "perfil";
type Tab = { label: string; icon: LucideIcon; active: boolean; to: string; hash?: string; search?: { aba: Aba } };

/** Tabs of each app: the store panel and the courier area use their own sections instead of the shopping tabs. */
function useTabs(): Tab[] {
  const { pathname, hash, search } = useLocation();
  const { user } = useUser();
  const aba = (search as { aba?: string }).aba;
  const area = appArea(pathname);
  if (area === "loja") {
    const cur = aba ?? "pedidos";
    const t = (label: string, id: Aba, icon: LucideIcon): Tab => ({ label, icon, to: "/painel", search: { aba: id }, active: cur === id });
    return [t("Pedidos", "pedidos", ClipboardList), t("Produtos", "produtos", Package), t("Ganhos", "recebimento", Wallet), t("Loja", "loja", Store)];
  }
  if (area === "entregador") {
    const cur = aba ?? "disponiveis";
    const t = (label: string, id: Aba, icon: LucideIcon): Tab => ({ label, icon, to: "/entregador", search: { aba: id }, active: cur === id });
    return [t("Entregas", "disponiveis", Bike), t("Minhas", "minhas", ClipboardList), t("Ganhos", "ganhos", Wallet), t("Perfil", "perfil", User)];
  }
  return [
    { label: "Início", to: "/", icon: House, active: pathname === "/" && hash !== "busca" },
    { label: "Busca", to: "/", hash: "busca", icon: Search, active: pathname === "/" && hash === "busca" },
    { label: "Pedidos", to: user ? "/meus-pedidos" : "/auth", icon: Receipt, active: pathname.startsWith("/meus-pedidos") },
    { label: "Perfil", to: user ? "/minha-conta" : "/auth", icon: User, active: pathname.startsWith("/minha-conta") || pathname === "/auth" },
  ];
}

/** App-style tab bar on phones; hidden from md up, where the header and the page tabs have the links. */
export function BottomNav() {
  const { pathname } = useLocation();
  const tabs = useTabs();
  if (!bottomNavVisible(pathname)) return null;
  return (
    <>
      <div className="h-16 md:hidden" aria-hidden />
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
          {tabs.map(({ label, icon: Icon, active, ...link }) => (
            <li key={label}>
              <Link
                {...link}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className={`h-6 w-6 ${active ? "stroke-[2.5]" : ""}`} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
