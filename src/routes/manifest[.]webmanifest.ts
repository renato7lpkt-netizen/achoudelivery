import { createFileRoute } from "@tanstack/react-router";
import { webManifest } from "@/lib/web-manifest";

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(webManifest), {
          headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
        }),
    },
  },
});
