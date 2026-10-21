export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      courier_payouts: {
        Row: {
          amount: number
          asaas_transfer_id: string | null
          courier_id: string
          created_at: string
          error: string | null
          id: string
          orders_count: number
          pix_key: string
          status: string
        }
        Insert: {
          amount: number
          asaas_transfer_id?: string | null
          courier_id: string
          created_at?: string
          error?: string | null
          id?: string
          orders_count?: number
          pix_key: string
          status?: string
        }
        Update: {
          amount?: number
          asaas_transfer_id?: string | null
          courier_id?: string
          created_at?: string
          error?: string | null
          id?: string
          orders_count?: number
          pix_key?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_payouts_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          approval_status: string
          available: boolean
          cpf: string
          created_at: string
          doc_path: string | null
          id: string
          name: string
          phone: string
          pix_key: string | null
          pix_key_type: string | null
          plate: string | null
          reject_reason: string | null
          user_id: string
          vehicle: string
        }
        Insert: {
          approval_status?: string
          available?: boolean
          cpf: string
          created_at?: string
          doc_path?: string | null
          id?: string
          name: string
          phone: string
          pix_key?: string | null
          pix_key_type?: string | null
          plate?: string | null
          reject_reason?: string | null
          user_id: string
          vehicle?: string
        }
        Update: {
          approval_status?: string
          available?: boolean
          cpf?: string
          created_at?: string
          doc_path?: string | null
          id?: string
          name?: string
          phone?: string
          pix_key?: string | null
          pix_key_type?: string | null
          plate?: string | null
          reject_reason?: string | null
          user_id?: string
          vehicle?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          name: string
          options: string | null
          order_id: string
          price: number
          product_id: string | null
          qty: number
        }
        Insert: {
          id?: string
          name: string
          options?: string | null
          order_id: string
          price: number
          product_id?: string | null
          qty: number
        }
        Update: {
          id?: string
          name?: string
          options?: string | null
          order_id?: string
          price?: number
          product_id?: string | null
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          order_id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          order_id: string
          sender_id?: string
          sender_role: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          asaas_payment_id: string | null
          courier_id: string | null
          courier_lat: number | null
          courier_lng: number | null
          courier_loc_at: string | null
          courier_payout: number
          courier_payout_id: string | null
          created_at: string
          customer_id: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_fee: number
          delivery_pin: string | null
          distance_km: number | null
          fulfillment: string
          gateway_fee: number
          id: string
          invoice_url: string | null
          lat: number | null
          lng: number | null
          notes: string | null
          payment_method: string
          payment_status: string
          payout_id: string | null
          pix_payload: string | null
          pix_qr: string | null
          platform_fee: number
          rating: number | null
          review: string | null
          status: string
          store_id: string
          store_payout: number
          subtotal: number
          total: number
        }
        Insert: {
          address?: string | null
          asaas_payment_id?: string | null
          courier_id?: string | null
          courier_lat?: number | null
          courier_lng?: number | null
          courier_loc_at?: string | null
          courier_payout?: number
          courier_payout_id?: string | null
          created_at?: string
          customer_id: string
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_fee?: number
          delivery_pin?: string | null
          distance_km?: number | null
          fulfillment: string
          gateway_fee?: number
          id?: string
          invoice_url?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          payment_method: string
          payment_status?: string
          payout_id?: string | null
          pix_payload?: string | null
          pix_qr?: string | null
          platform_fee?: number
          rating?: number | null
          review?: string | null
          status?: string
          store_id: string
          store_payout?: number
          subtotal: number
          total: number
        }
        Update: {
          address?: string | null
          asaas_payment_id?: string | null
          courier_id?: string | null
          courier_lat?: number | null
          courier_lng?: number | null
          courier_loc_at?: string | null
          courier_payout?: number
          courier_payout_id?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_fee?: number
          delivery_pin?: string | null
          distance_km?: number | null
          fulfillment?: string
          gateway_fee?: number
          id?: string
          invoice_url?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          payment_method?: string
          payment_status?: string
          payout_id?: string | null
          pix_payload?: string | null
          pix_qr?: string | null
          platform_fee?: number
          rating?: number | null
          review?: string | null
          status?: string
          store_id?: string
          store_payout?: number
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          asaas_transfer_id: string | null
          created_at: string
          error: string | null
          id: string
          orders_count: number
          pix_key: string
          status: string
          store_id: string
        }
        Insert: {
          amount: number
          asaas_transfer_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          orders_count?: number
          pix_key: string
          status?: string
          store_id: string
        }
        Update: {
          amount?: number
          asaas_transfer_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          orders_count?: number
          pix_key?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price?: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          created_at: string
          description: string
          id: string
          image_url: string | null
          name: string
          price: number
          promo_days: number[]
          promo_price: number | null
          section: string
          store_id: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name: string
          price: number
          promo_days?: number[]
          promo_price?: number | null
          section?: string
          store_id: string
        }
        Update: {
          available?: boolean
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          promo_days?: number[]
          promo_price?: number | null
          section?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          cpf: string | null
          created_at: string
          full_name: string | null
          id: string
          lat: number | null
          lng: number | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          lat?: number | null
          lng?: number | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          phone?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      store_couriers: {
        Row: {
          created_at: string
          id: string
          name: string
          plate: string | null
          store_id: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plate?: string | null
          store_id: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plate?: string | null
          store_id?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_couriers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_hours: {
        Row: {
          closes: string
          id: string
          opens: string
          store_id: string
          weekday: number
        }
        Insert: {
          closes: string
          id?: string
          opens: string
          store_id: string
          weekday: number
        }
        Update: {
          closes?: string
          id?: string
          opens?: string
          store_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_private: {
        Row: {
          created_at: string
          document: string
          email: string
          legal_name: string
          owner_id: string
          responsible_cpf: string | null
          responsible_name: string
          store_id: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          document: string
          email: string
          legal_name: string
          owner_id: string
          responsible_cpf?: string | null
          responsible_name: string
          store_id: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          document?: string
          email?: string
          legal_name?: string
          owner_id?: string
          responsible_cpf?: string | null
          responsible_name?: string
          store_id?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_private_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string
          asaas_wallet_id: string | null
          category: string
          cover_url: string | null
          created_at: string
          delivery_base_fee: number
          delivery_enabled: boolean
          delivery_fee_per_km: number
          delivery_fee_per_km_far: number
          delivery_max_km: number
          delivery_tier_km: number
          description: string
          id: string
          is_active: boolean
          is_paused: boolean
          lat: number
          lng: number
          logo_url: string | null
          min_order: number
          name: string
          own_couriers: boolean
          owner_id: string | null
          paused_until: string | null
          phone: string | null
          pickup_enabled: boolean
          pix_key: string | null
          pix_key_type: string | null
          prep_time_min: number
          rain_mode: boolean
          rating_avg: number
          rating_count: number
          slug: string
        }
        Insert: {
          address?: string
          asaas_wallet_id?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          delivery_base_fee?: number
          delivery_enabled?: boolean
          delivery_fee_per_km?: number
          delivery_fee_per_km_far?: number
          delivery_max_km?: number
          delivery_tier_km?: number
          description?: string
          id?: string
          is_active?: boolean
          is_paused?: boolean
          lat?: number
          lng?: number
          logo_url?: string | null
          min_order?: number
          name: string
          own_couriers?: boolean
          owner_id?: string | null
          paused_until?: string | null
          phone?: string | null
          pickup_enabled?: boolean
          pix_key?: string | null
          pix_key_type?: string | null
          prep_time_min?: number
          rain_mode?: boolean
          rating_avg?: number
          rating_count?: number
          slug: string
        }
        Update: {
          address?: string
          asaas_wallet_id?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          delivery_base_fee?: number
          delivery_enabled?: boolean
          delivery_fee_per_km?: number
          delivery_fee_per_km_far?: number
          delivery_max_km?: number
          delivery_tier_km?: number
          description?: string
          id?: string
          is_active?: boolean
          is_paused?: boolean
          lat?: number
          lng?: number
          logo_url?: string | null
          min_order?: number
          name?: string
          own_couriers?: boolean
          owner_id?: string | null
          paused_until?: string | null
          phone?: string | null
          pickup_enabled?: boolean
          pix_key?: string | null
          pix_key_type?: string | null
          prep_time_min?: number
          rain_mode?: boolean
          rating_avg?: number
          rating_count?: number
          slug?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_delivery: { Args: { _order: string }; Returns: boolean }
      confirm_delivery: {
        Args: { _order: string; _pin: string }
        Returns: boolean
      }
      courier_update_order: {
        Args: { _order: string; _status: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_couriers: {
        Args: never
        Returns: {
          available: boolean
          id: string
          name: string
          phone: string
          plate: string
          vehicle: string
        }[]
      }
      my_order_pins: { Args: never; Returns: { order_id: string; pin: string }[] }
      my_store_pix: {
        Args: { _store: string }
        Returns: { pix_key: string; pix_key_type: string }[]
      }
      my_courier_id: { Args: never; Returns: string }
      open_deliveries: {
        Args: { _lat: number; _lng: number }
        Returns: {
          created_at: string
          delivery_km: number
          earning: number
          km_to_store: number
          order_id: string
          status: string
          store_address: string
          store_lat: number
          store_lng: number
          store_name: string
        }[]
      }
      order_party: { Args: { _order: string }; Returns: string }
      owns_store: { Args: { _store: string }; Returns: boolean }
      rate_order: {
        Args: { _order: string; _rating: number; _review: string }
        Returns: undefined
      }
      top_products: {
        Args: { _store: string }
        Returns: {
          product_id: string
          sold: number
        }[]
      }
      update_courier_location: {
        Args: { _lat: number; _lng: number; _order: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
