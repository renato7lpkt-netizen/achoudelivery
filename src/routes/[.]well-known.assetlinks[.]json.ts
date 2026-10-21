import { createFileRoute } from "@tanstack/react-router";
import { APPS } from "@/lib/web-manifest";

// Digital Asset Links for the Play Store apps (Trusted Web Activity): without it Android shows a URL bar.
// ANDROID_SHA256_FINGERPRINTS = comma-separated SHA-256 signing fingerprints from Play Console
// (Configuração > Integridade do app > Assinatura de apps), same key for the three packages or one per package.
export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: () => {
        const fingerprints = (process.env["ANDROID_SHA256_FINGERPRINTS"] ?? "").split(",").map((f) => f.trim().toUpperCase()).filter(Boolean);
        const links = fingerprints.length === 0 ? [] : Object.values(APPS).map((app) => ({
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: app.androidPackage, sha256_cert_fingerprints: fingerprints },
        }));
        return new Response(JSON.stringify(links), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      },
    },
  },
});
