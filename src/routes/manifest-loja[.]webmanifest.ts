import { createFileRoute } from "@tanstack/react-router";
import { manifestResponse } from "@/lib/web-manifest";

export const Route = createFileRoute("/manifest-loja.webmanifest")({
  server: { handlers: { GET: () => manifestResponse("loja") } },
});
