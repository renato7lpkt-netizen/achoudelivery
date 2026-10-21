// Columns the browser may read (migration 0014 grants SELECT per column, so `select("*")` is refused on these tables).
// Keep in sync with the GRANT lists in drizzle/migrations/0014_hide_pin_and_store_pix.sql when adding columns.

/** stores without pix_key, pix_key_type and asaas_wallet_id (owner reads Pix via the my_store_pix RPC). */
export const STORE_COLS =
  "id,owner_id,name,slug,description,category,logo_url,cover_url,address,lat,lng,phone,delivery_enabled,pickup_enabled,delivery_base_fee,delivery_fee_per_km,delivery_max_km,min_order,prep_time_min,is_paused,is_active,created_at,delivery_fee_per_km_far,delivery_tier_km,own_couriers,paused_until,rain_mode,rating_avg,rating_count";

/** orders without delivery_pin (the customer gets it via the my_order_pins RPC). */
export const ORDER_COLS =
  "id,store_id,customer_id,status,fulfillment,customer_name,customer_phone,address,lat,lng,distance_km,subtotal,delivery_fee,total,platform_fee,gateway_fee,store_payout,payment_method,payment_status,asaas_payment_id,invoice_url,pix_qr,pix_payload,notes,created_at,courier_id,rating,review,delivered_at,courier_lat,courier_lng,courier_loc_at,payout_id,courier_payout,courier_payout_id";
