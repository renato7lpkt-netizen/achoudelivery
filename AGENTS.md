<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

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
- Manual Pix payouts: `src/lib/payouts.functions.ts` groups delivered orders with `payout_id IS NULL`, marks them before calling Asaas `/transfers`, and rolls back on failure.
