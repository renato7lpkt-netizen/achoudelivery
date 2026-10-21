## Hosting
- No longer connected to Lovable. Deployed as a standalone Node.js server (Hostinger): `npm run build` → `npm start` (`node .output/server/index.mjs`), nitro preset `node-server` in `vite.config.ts`.
- `VITE_*` env vars are inlined at build time; everything else is read at runtime. Template: `.env.example`.
- Google login uses `supabase.auth.signInWithOAuth` (provider must be enabled in Supabase Auth); push uses FCM HTTP v1 directly with `FIREBASE_SERVICE_ACCOUNT` (`src/lib/push.server.ts`).

## Marketplace rules
- Order totals, delivery fee and Asaas split are computed only in `createOrder` server fn (orders have no client INSERT grant) — prevents price tampering.
- Fee/distance/open-hours helpers live in `src/lib/market.ts`, shared by client and server so UI estimates match charged values.
- Asaas payment status updates arrive via `/api/public/asaas-webhook` (verified with `asaas-access-token` header) plus a manual refresh fn as fallback.
- Product/cover images are URL fields because public storage buckets are blocked in this workspace.
- Delivery-only: delivery fee rule (own couriers = free up to FREE_KM_OWN, then per-km) lives in `deliveryFee` in `src/lib/market.ts`; promo price via `effectivePrice` applied in `createOrder`.
- Delivery completion only via `confirm_delivery(order, pin)` RPC; DB triggers (`orders_guard`, `stores_guard`, `couriers_guard`) block clients from editing totals, PIN, ratings and courier approval.
- Admin = row in `user_roles` (role 'admin'), checked with `has_role`; header roles come from `useRoles` in `src/lib/roles.ts`.
- Phone product photos are compressed client-side (`src/lib/image.ts`) and stored as data URLs in `products.image_url` — public buckets are blocked.
- Courier documents live in private bucket `courier-docs/<user_id>/…`; admins view via signed URL from `courierDocUrl` — never public links.
- Platform couriers (stores with `own_couriers = false`): `splitOrder` in `src/lib/market.ts` gives the whole delivery fee to `orders.courier_payout` and charges commission on products only. Couriers see paid unassigned orders via the `open_deliveries` RPC (nearest store first, no customer data) and take one with `accept_delivery` (atomic). Admin pays them from the "Repasse entregadores" tab (`sendCourierPayout`, claims `courier_payout_id`).
- `orders_guard`/`stores_guard` must stay SECURITY INVOKER: inside SECURITY DEFINER `current_user` is the owner, so the `current_user = 'authenticated'` check never fires (that bug let clients edit totals/payouts until migration 0013).
- Manual Pix payouts: `src/lib/payouts.functions.ts` groups delivered orders with `payout_id IS NULL`, marks them before calling Asaas `/transfers`, and rolls back on failure.
