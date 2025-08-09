export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      etsy_connections: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          refresh_token: string | null
          shop_id: string
          shop_name: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          refresh_token?: string | null
          shop_id: string
          shop_name?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          refresh_token?: string | null
          shop_id?: string
          shop_name?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      etsy_fee_settings: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          listing_fee: number
          offsite_ads_enabled: boolean
          offsite_ads_pct: number
          processing_fixed: number
          processing_pct: number
          shop_id: string | null
          store_name: string | null
          transaction_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          listing_fee?: number
          offsite_ads_enabled?: boolean
          offsite_ads_pct?: number
          processing_fixed?: number
          processing_pct?: number
          shop_id?: string | null
          store_name?: string | null
          transaction_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          listing_fee?: number
          offsite_ads_enabled?: boolean
          offsite_ads_pct?: number
          processing_fixed?: number
          processing_pct?: number
          shop_id?: string | null
          store_name?: string | null
          transaction_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_parent_fk"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          parent_category_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_category_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_category_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_variants: {
        Row: {
          color: string | null
          cost_per_unit: number | null
          created_at: string
          id: string
          item_id: string
          notes: string | null
          size: string
          sku: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          color?: string | null
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          size: string
          sku?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          color?: string | null
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          size?: string
          sku?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "expense_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_variants_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cogs: number
          created_at: string
          fees: number
          id: string
          order_id_fk: string
          price: number
          product_name: string | null
          profit: number | null
          quantity: number
          size: string | null
          sku: string | null
          updated_at: string
          user_id: string
          variant_id: string | null
        }
        Insert: {
          cogs?: number
          created_at?: string
          fees?: number
          id?: string
          order_id_fk: string
          price?: number
          product_name?: string | null
          profit?: number | null
          quantity?: number
          size?: string | null
          sku?: string | null
          updated_at?: string
          user_id: string
          variant_id?: string | null
        }
        Update: {
          cogs?: number
          created_at?: string
          fees?: number
          id?: string
          order_id_fk?: string
          price?: number
          product_name?: string | null
          profit?: number | null
          quantity?: number
          size?: string | null
          sku?: string | null
          updated_at?: string
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fk_fkey"
            columns: ["order_id_fk"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          external_shipping_cost: number
          id: string
          listing_fee: number
          offsite_ads_fee: number
          order_date: string | null
          order_id: string
          other_expenses: number
          processing_fee: number
          shipping_label_fee: number
          shop_id: string | null
          source: string
          store_name: string | null
          total_cogs: number | null
          total_fees: number | null
          total_price: number | null
          total_profit: number | null
          transaction_fee: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_shipping_cost?: number
          id?: string
          listing_fee?: number
          offsite_ads_fee?: number
          order_date?: string | null
          order_id: string
          other_expenses?: number
          processing_fee?: number
          shipping_label_fee?: number
          shop_id?: string | null
          source: string
          store_name?: string | null
          total_cogs?: number | null
          total_fees?: number | null
          total_price?: number | null
          total_profit?: number | null
          transaction_fee?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_shipping_cost?: number
          id?: string
          listing_fee?: number
          offsite_ads_fee?: number
          order_date?: string | null
          order_id?: string
          other_expenses?: number
          processing_fee?: number
          shipping_label_fee?: number
          shop_id?: string | null
          source?: string
          store_name?: string | null
          total_cogs?: number | null
          total_fees?: number | null
          total_price?: number | null
          total_profit?: number | null
          transaction_fee?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json
          workspace_id: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value: Json
          workspace_id?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
          workspace_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recalc_order_totals: {
        Args: { p_order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
