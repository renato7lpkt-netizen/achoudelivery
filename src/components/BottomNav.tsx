import { Link, useLocation } from "@tanstack/react-router";
import { House, Receipt, Search, User } from "lucide-react";
import { useUser } from "@/lib/session";

/** Checkout and order tracking keep the whole screen for their own bottom actions. */
export function bottomNavVisible(pathname: string) {
  return !pathname.startsWith("/checkout") && !pathname.startsWith("/pedido/");
}

/** App-style tab bar on phones (Início, Busca, Pedidos, Perfil); hidden from md up, where the header has the links. */
export function BottomNav() {
  const { pathname, hash } = useLocation();
  const { user } = useUser();
  if (!bottomNavVisible(pathname)) return null;
  const profileTo = user ? "/minha-conta" : "/auth";
  const tabs = [
    { label: "Início", to: "/", icon: House, active: pathname === "/" && hash !== "busca" },
    { label: "Busca", to: "/", hash: "busca", icon: Search, active: pathname === "/" && hash === "busca" },
    { label: "Pedidos", to: user ? "/meus-pedidos" : "/auth", icon: Receipt, active: pathname.startsWith("/meus-pedidos") },
    { label: "Perfil", to: profileTo, icon: User, active: pathname.startsWith("/minha-conta") || pathname === "/auth" },
  ] as const;
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
