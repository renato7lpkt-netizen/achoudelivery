// PWA manifests, one per app (Cliente, Loja, Entregador), served by Node routes such as
// routes/manifest[.]webmanifest.ts so they get the application/manifest+json type: Hostinger
// serves files in public/ without our headers. The root route links the manifest of the area
// being viewed (appArea), so "Adicionar à tela inicial" installs the right app.

export type AppArea = "cliente" | "loja" | "entregador";

/** Which app a page belongs to: the store panel and the courier area each are their own app. */
export function appArea(pathname: string): AppArea {
  if (pathname.startsWith("/painel")) return "loja";
  if (pathname.startsWith("/entregador")) return "entregador";
  return "cliente";
}

export const APPS = {
  cliente: {
    manifest: "/manifest.webmanifest",
    title: "AchouDelivery",
    theme: "#ea580c",
    appleIcon: "/apple-touch-icon.png",
    icons: { any: "/icon", maskable: "/icon-maskable" },
    androidPackage: "br.com.achoudelivery.cliente",
    manifestFields: {
      id: "/",
      start_url: "/",
      name: "AchouDelivery - Lojas de Sete Lagoas",
      short_name: "AchouDelivery",
      description: "Peça dos melhores restaurantes, mercados e lojas de Sete Lagoas com entrega rápida. Pague por Pix ou cartão e acompanhe seu pedido em tempo real.",
      categories: ["food", "shopping", "lifestyle"],
    },
  },
  loja: {
    manifest: "/manifest-loja.webmanifest",
    title: "AchouDelivery Loja",
    theme: "#1f2937",
    appleIcon: "/apple-touch-icon-loja.png",
    icons: { any: "/icon-loja", maskable: "/icon-loja-maskable" },
    androidPackage: "br.com.achoudelivery.loja",
    manifestFields: {
      id: "/painel",
      start_url: "/painel",
      name: "AchouDelivery Loja - Painel do lojista",
      short_name: "AD Loja",
      description: "Receba e aceite pedidos, cadastre produtos, defina horários e acompanhe quanto sua loja vai receber.",
      categories: ["business", "food"],
    },
  },
  entregador: {
    manifest: "/manifest-entregador.webmanifest",
    title: "AchouDelivery Entregador",
    theme: "#15803d",
    appleIcon: "/apple-touch-icon-entregador.png",
    icons: { any: "/icon-entregador", maskable: "/icon-entregador-maskable" },
    androidPackage: "br.com.achoudelivery.entregador",
    manifestFields: {
      id: "/entregador",
      start_url: "/entregador",
      name: "AchouDelivery Entregador",
      short_name: "AD Entregador",
      description: "Veja entregas perto de você, aceite com um toque, siga a rota e acompanhe seus ganhos.",
      categories: ["business", "travel"],
    },
  },
} as const;

export function webManifest(area: AppArea) {
  const app = APPS[area];
  const icon = (base: string, size: number, purpose: "any" | "maskable") => ({ src: `${base}-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose });
  return {
    ...app.manifestFields,
    // Every app keeps the whole site in scope so sign-in and order pages open inside it.
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: app.theme,
    lang: "pt-BR",
    dir: "ltr",
    icons: [
      icon(app.icons.any, 192, "any"),
      icon(app.icons.any, 512, "any"),
      icon(app.icons.maskable, 192, "maskable"),
      icon(app.icons.maskable, 512, "maskable"),
    ],
    ...(area === "cliente" && {
      screenshots: [
        { src: "/screenshot-mobile.png", sizes: "540x1170", type: "image/png", form_factor: "narrow", label: "Vitrine de lojas no celular" },
        { src: "/screenshot-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Vitrine de lojas no computador" },
      ],
    }),
  };
}

export function manifestResponse(area: AppArea) {
  return new Response(JSON.stringify(webManifest(area)), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
