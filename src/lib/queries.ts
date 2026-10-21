import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STORE_COLS } from "@/lib/columns";

export const storesQuery = queryOptions({
  queryKey: ["stores"],
  queryFn: async () => {
    const { data, error } = await supabase.from("stores").select(`${STORE_COLS},store_hours(weekday,opens,closes)` as const).eq("is_active", true);
    if (error) throw error;
    return data;
  },
});

export const storeQuery = (slug: string) =>
  queryOptions({
    queryKey: ["store", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores").select(`${STORE_COLS},store_hours(weekday,opens,closes),products(*,product_options(*))` as const).eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
