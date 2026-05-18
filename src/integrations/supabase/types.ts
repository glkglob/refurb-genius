export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      deal_opportunities: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          listing_url: string | null;
          postcode: string | null;
          property_type: string | null;
          bedrooms: number | null;
          purchase_price: number | null;
          estimated_gdv: number | null;
          expected_monthly_rent: number | null;
          refurb_budget: number | null;
          target_exit_strategy: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          listing_url?: string | null;
          postcode?: string | null;
          property_type?: string | null;
          bedrooms?: number | null;
          purchase_price?: number | null;
          estimated_gdv?: number | null;
          expected_monthly_rent?: number | null;
          refurb_budget?: number | null;
          target_exit_strategy?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          listing_url?: string | null;
          postcode?: string | null;
          property_type?: string | null;
          bedrooms?: number | null;
          purchase_price?: number | null;
          estimated_gdv?: number | null;
          expected_monthly_rent?: number | null;
          refurb_budget?: number | null;
          target_exit_strategy?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      estimate_items: {
        Row: {
          category: string;
          estimate_id: string;
          id: string;
          labour: number;
          materials: number;
          total: number;
          user_id: string;
          weeks: number;
        };
        Insert: {
          category: string;
          estimate_id: string;
          id?: string;
          labour?: number;
          materials?: number;
          total?: number;
          user_id: string;
          weeks?: number;
        };
        Update: {
          category?: string;
          estimate_id?: string;
          id?: string;
          labour?: number;
          materials?: number;
          total?: number;
          user_id?: string;
          weeks?: number;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_items_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
        ];
      };
      estimates: {
        Row: {
          condition_level: string;
          contingency: number;
          created_at: string;
          finish_level: string;
          high_total: number;
          id: string;
          labour_total: number;
          low_total: number;
          materials_total: number;
          mid_total: number;
          project_id: string;
          region: string;
          subtotal: number;
          timeline_weeks: number;
          user_id: string;
          vat: number;
        };
        Insert: {
          condition_level: string;
          contingency?: number;
          created_at?: string;
          finish_level: string;
          high_total?: number;
          id?: string;
          labour_total?: number;
          low_total?: number;
          materials_total?: number;
          mid_total?: number;
          project_id: string;
          region: string;
          subtotal?: number;
          timeline_weeks?: number;
          user_id: string;
          vat?: number;
        };
        Update: {
          condition_level?: string;
          contingency?: number;
          created_at?: string;
          finish_level?: string;
          high_total?: number;
          id?: string;
          labour_total?: number;
          low_total?: number;
          materials_total?: number;
          mid_total?: number;
          project_id?: string;
          region?: string;
          subtotal?: number;
          timeline_weeks?: number;
          user_id?: string;
          vat?: number;
        };
        Relationships: [
          {
            foreignKeyName: "estimates_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      photos: {
        Row: {
          id: string;
          name: string;
          project_id: string;
          size: number;
          storage_path: string;
          uploaded_at: string;
          url: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          project_id: string;
          size?: number;
          storage_path: string;
          uploaded_at?: string;
          url: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          project_id?: string;
          size?: number;
          storage_path?: string;
          uploaded_at?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "photos_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          company: string | null;
          created_at: string;
          default_region: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          role: string;
        };
        Insert: {
          company?: string | null;
          created_at?: string;
          default_region?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          role?: string;
        };
        Update: {
          company?: string | null;
          created_at?: string;
          default_region?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          role?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          address: string;
          analysis_done: boolean;
          bathrooms: number;
          bedrooms: number;
          created_at: string;
          estimate_done: boolean;
          estimated_gdv: number;
          id: string;
          name: string;
          notes: string;
          photos_done: boolean;
          postcode: string;
          property_type: string;
          purchase_price: number;
          region: string;
          report_done: boolean;
          size_sqm: number;
          status: string;
          user_id: string;
        };
        Insert: {
          address?: string;
          analysis_done?: boolean;
          bathrooms?: number;
          bedrooms?: number;
          created_at?: string;
          estimate_done?: boolean;
          estimated_gdv?: number;
          id?: string;
          name: string;
          notes?: string;
          photos_done?: boolean;
          postcode?: string;
          property_type: string;
          purchase_price?: number;
          region: string;
          report_done?: boolean;
          size_sqm?: number;
          status?: string;
          user_id: string;
        };
        Update: {
          address?: string;
          analysis_done?: boolean;
          bathrooms?: number;
          bedrooms?: number;
          created_at?: string;
          estimate_done?: boolean;
          estimated_gdv?: number;
          id?: string;
          name?: string;
          notes?: string;
          photos_done?: boolean;
          postcode?: string;
          property_type?: string;
          purchase_price?: number;
          region?: string;
          report_done?: boolean;
          size_sqm?: number;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      redesign_concepts: {
        Row: {
          created_at: string;
          id: string;
          payload: Json;
          project_id: string;
          style: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          payload: Json;
          project_id: string;
          style: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          payload?: Json;
          project_id?: string;
          style?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "redesign_concepts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      trade_profiles: {
        Row: {
          user_id: string;
          business_name: string;
          contact_name: string;
          phone: string | null;
          postcode: string | null;
          trade_categories: string[];
          bio: string | null;
          insurance_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          business_name: string;
          contact_name: string;
          phone?: string | null;
          postcode?: string | null;
          trade_categories?: string[];
          bio?: string | null;
          insurance_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          business_name?: string;
          contact_name?: string;
          phone?: string | null;
          postcode?: string | null;
          trade_categories?: string[];
          bio?: string | null;
          insurance_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trades_job_interests: {
        Row: {
          id: string;
          job_id: string;
          user_id: string;
          message: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          user_id: string;
          message?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          user_id?: string;
          message?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trades_job_interests_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "trades_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      trades_jobs: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          property_address: string | null;
          postcode: string | null;
          property_type: string | null;
          job_category: string;
          description: string;
          budget_min: number | null;
          budget_max: number | null;
          desired_start_date: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          property_address?: string | null;
          postcode?: string | null;
          property_type?: string | null;
          job_category: string;
          description: string;
          budget_min?: number | null;
          budget_max?: number | null;
          desired_start_date?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          property_address?: string | null;
          postcode?: string | null;
          property_type?: string | null;
          job_category?: string;
          description?: string;
          budget_min?: number | null;
          budget_max?: number | null;
          desired_start_date?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
