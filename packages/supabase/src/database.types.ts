export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      deal_opportunities: {
        Row: {
          bedrooms: number | null;
          created_at: string;
          estimated_gdv: number | null;
          expected_monthly_rent: number | null;
          id: string;
          listing_url: string | null;
          postcode: string | null;
          property_type: string | null;
          purchase_price: number | null;
          refurb_budget: number | null;
          status: string;
          target_exit_strategy: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bedrooms?: number | null;
          created_at?: string;
          estimated_gdv?: number | null;
          expected_monthly_rent?: number | null;
          id?: string;
          listing_url?: string | null;
          postcode?: string | null;
          property_type?: string | null;
          purchase_price?: number | null;
          refurb_budget?: number | null;
          status?: string;
          target_exit_strategy?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bedrooms?: number | null;
          created_at?: string;
          estimated_gdv?: number | null;
          expected_monthly_rent?: number | null;
          id?: string;
          listing_url?: string | null;
          postcode?: string | null;
          property_type?: string | null;
          purchase_price?: number | null;
          refurb_budget?: number | null;
          status?: string;
          target_exit_strategy?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      estimate_items: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          display_order: number | null;
          estimate_id: string;
          id: string;
          is_ai_suggested: boolean | null;
          labour: number | null;
          materials: number | null;
          name: string | null;
          notes: string | null;
          project_id: string | null;
          quantity: number;
          room_id: string | null;
          total_cost: number;
          unit: string;
          unit_cost: number;
          updated_at: string;
          user_id: string;
          weeks: number | null;
        };
        Insert: {
          category: string;
          created_at?: string;
          description?: string | null;
          display_order?: number | null;
          estimate_id: string;
          id?: string;
          is_ai_suggested?: boolean | null;
          labour?: number | null;
          materials?: number | null;
          name?: string | null;
          notes?: string | null;
          project_id?: string | null;
          quantity?: number;
          room_id?: string | null;
          total_cost?: number;
          unit?: string;
          unit_cost?: number;
          updated_at?: string;
          user_id: string;
          weeks?: number | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          display_order?: number | null;
          estimate_id?: string;
          id?: string;
          is_ai_suggested?: boolean | null;
          labour?: number | null;
          materials?: number | null;
          name?: string | null;
          notes?: string | null;
          project_id?: string | null;
          quantity?: number;
          room_id?: string | null;
          total_cost?: number;
          unit?: string;
          unit_cost?: number;
          updated_at?: string;
          user_id?: string;
          weeks?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_items_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimate_items_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimate_items_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "estimate_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      estimate_rooms: {
        Row: {
          area_sqm: number | null;
          created_at: string | null;
          display_order: number | null;
          estimate_id: string;
          id: string;
          name: string;
          subtotal: number | null;
        };
        Insert: {
          area_sqm?: number | null;
          created_at?: string | null;
          display_order?: number | null;
          estimate_id: string;
          id?: string;
          name: string;
          subtotal?: number | null;
        };
        Update: {
          area_sqm?: number | null;
          created_at?: string | null;
          display_order?: number | null;
          estimate_id?: string;
          id?: string;
          name?: string;
          subtotal?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_rooms_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
        ];
      };
      estimates: {
        Row: {
          ai_generated: boolean | null;
          condition_level: string | null;
          contingency: number | null;
          contingency_percent: number;
          created_at: string;
          finish_level: string | null;
          high_total: number | null;
          id: string;
          labour_total: number | null;
          low_total: number | null;
          materials_total: number | null;
          mid_total: number | null;
          notes: string | null;
          project_id: string;
          region: string | null;
          roi_percent: number | null;
          status: string | null;
          subtotal: number | null;
          summary: string | null;
          timeline_weeks: number | null;
          title: string | null;
          total_cost: number;
          updated_at: string;
          user_id: string;
          vat: number | null;
          vat_amount: number | null;
          vat_rate: number | null;
        };
        Insert: {
          ai_generated?: boolean | null;
          condition_level?: string | null;
          contingency?: number | null;
          contingency_percent?: number;
          created_at?: string;
          finish_level?: string | null;
          high_total?: number | null;
          id?: string;
          labour_total?: number | null;
          low_total?: number | null;
          materials_total?: number | null;
          mid_total?: number | null;
          notes?: string | null;
          project_id: string;
          region?: string | null;
          roi_percent?: number | null;
          status?: string | null;
          subtotal?: number | null;
          summary?: string | null;
          timeline_weeks?: number | null;
          title?: string | null;
          total_cost?: number;
          updated_at?: string;
          user_id: string;
          vat?: number | null;
          vat_amount?: number | null;
          vat_rate?: number | null;
        };
        Update: {
          ai_generated?: boolean | null;
          condition_level?: string | null;
          contingency?: number | null;
          contingency_percent?: number;
          created_at?: string;
          finish_level?: string | null;
          high_total?: number | null;
          id?: string;
          labour_total?: number | null;
          low_total?: number | null;
          materials_total?: number | null;
          mid_total?: number | null;
          notes?: string | null;
          project_id?: string;
          region?: string | null;
          roi_percent?: number | null;
          status?: string | null;
          subtotal?: number | null;
          summary?: string | null;
          timeline_weeks?: number | null;
          title?: string | null;
          total_cost?: number;
          updated_at?: string;
          user_id?: string;
          vat?: number | null;
          vat_amount?: number | null;
          vat_rate?: number | null;
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
          content_type: string | null;
          created_at: string;
          filename: string | null;
          id: string;
          name: string;
          project_id: string;
          room_label: string | null;
          size: number | null;
          size_bytes: number | null;
          storage_path: string;
          uploaded_at: string;
          url: string;
          user_id: string;
        };
        Insert: {
          content_type?: string | null;
          created_at?: string;
          filename?: string | null;
          id?: string;
          name?: string;
          project_id: string;
          room_label?: string | null;
          size?: number | null;
          size_bytes?: number | null;
          storage_path: string;
          uploaded_at?: string;
          url?: string;
          user_id: string;
        };
        Update: {
          content_type?: string | null;
          created_at?: string;
          filename?: string | null;
          id?: string;
          name?: string;
          project_id?: string;
          room_label?: string | null;
          size?: number | null;
          size_bytes?: number | null;
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
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          address: string;
          analysis_done: boolean | null;
          bathrooms: number | null;
          bedrooms: number | null;
          created_at: string;
          estimate_done: boolean | null;
          estimated_gdv: number | null;
          id: string;
          name: string;
          notes: string | null;
          photos_done: boolean | null;
          postcode: string | null;
          property_type: string | null;
          purchase_price: number | null;
          region: string | null;
          report_done: boolean | null;
          size: number | null;
          size_sqm: number | null;
          status: string;
          target_margin: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address?: string;
          analysis_done?: boolean | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          created_at?: string;
          estimate_done?: boolean | null;
          estimated_gdv?: number | null;
          id?: string;
          name: string;
          notes?: string | null;
          photos_done?: boolean | null;
          postcode?: string | null;
          property_type?: string | null;
          purchase_price?: number | null;
          region?: string | null;
          report_done?: boolean | null;
          size?: number | null;
          size_sqm?: number | null;
          status?: string;
          target_margin?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address?: string;
          analysis_done?: boolean | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          created_at?: string;
          estimate_done?: boolean | null;
          estimated_gdv?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          photos_done?: boolean | null;
          postcode?: string | null;
          property_type?: string | null;
          purchase_price?: number | null;
          region?: string | null;
          report_done?: boolean | null;
          size?: number | null;
          size_sqm?: number | null;
          status?: string;
          target_margin?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      redesign_concepts: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          photo_id: string | null;
          project_id: string;
          style: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          photo_id?: string | null;
          project_id: string;
          style?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          photo_id?: string | null;
          project_id?: string;
          style?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "redesign_concepts_photo_id_fkey";
            columns: ["photo_id"];
            isOneToOne: false;
            referencedRelation: "photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "redesign_concepts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      room_analyses: {
        Row: {
          ai_summary: string;
          condition_level: string;
          confidence_score: number;
          created_at: string;
          id: string;
          photo_id: string | null;
          photo_name: string;
          photo_url: string;
          project_id: string;
          recommended_works: string[];
          refurbishment_level: string;
          room_type: string;
          source: string | null;
          user_id: string;
          visible_issues: string[];
        };
        Insert: {
          ai_summary?: string;
          condition_level: string;
          confidence_score?: number;
          created_at?: string;
          id?: string;
          photo_id?: string | null;
          photo_name: string;
          photo_url: string;
          project_id: string;
          recommended_works?: string[];
          refurbishment_level: string;
          room_type: string;
          source?: string | null;
          user_id: string;
          visible_issues?: string[];
        };
        Update: {
          ai_summary?: string;
          condition_level?: string;
          confidence_score?: number;
          created_at?: string;
          id?: string;
          photo_id?: string | null;
          photo_name?: string;
          photo_url?: string;
          project_id?: string;
          recommended_works?: string[];
          refurbishment_level?: string;
          room_type?: string;
          source?: string | null;
          user_id?: string;
          visible_issues?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "room_analyses_photo_id_fkey";
            columns: ["photo_id"];
            isOneToOne: false;
            referencedRelation: "photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_analyses_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      scope_analyses: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          overall_score: number;
          property_id: string;
          region: string | null;
          summary: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          overall_score?: number;
          property_id: string;
          region?: string | null;
          summary?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          overall_score?: number;
          property_id?: string;
          region?: string | null;
          summary?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scope_analyses_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      scope_analysis_issues: {
        Row: {
          category: string | null;
          created_at: string;
          description: string;
          display_order: number;
          id: string;
          recommended_action: string | null;
          room_id: string;
          severity: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description: string;
          display_order?: number;
          id?: string;
          recommended_action?: string | null;
          room_id: string;
          severity?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string;
          display_order?: number;
          id?: string;
          recommended_action?: string | null;
          room_id?: string;
          severity?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scope_analysis_issues_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "scope_analysis_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      scope_analysis_items: {
        Row: {
          base_unit_cost: number;
          category: string | null;
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          notes: string | null;
          quantity: number;
          room_id: string;
          unit: string | null;
        };
        Insert: {
          base_unit_cost?: number;
          category?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          name: string;
          notes?: string | null;
          quantity?: number;
          room_id: string;
          unit?: string | null;
        };
        Update: {
          base_unit_cost?: number;
          category?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          name?: string;
          notes?: string | null;
          quantity?: number;
          room_id?: string;
          unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scope_analysis_items_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "scope_analysis_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      scope_analysis_rooms: {
        Row: {
          area_sqm: number | null;
          condition_summary: string | null;
          created_at: string;
          display_order: number;
          id: string;
          room_name: string;
          scope_analysis_id: string;
        };
        Insert: {
          area_sqm?: number | null;
          condition_summary?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          room_name: string;
          scope_analysis_id: string;
        };
        Update: {
          area_sqm?: number | null;
          condition_summary?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          room_name?: string;
          scope_analysis_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scope_analysis_rooms_scope_analysis_id_fkey";
            columns: ["scope_analysis_id"];
            isOneToOne: false;
            referencedRelation: "scope_analyses";
            referencedColumns: ["id"];
          },
        ];
      };
      trade_profiles: {
        Row: {
          bio: string | null;
          business_name: string;
          contact_name: string;
          created_at: string;
          insurance_status: string;
          phone: string | null;
          postcode: string | null;
          trade_categories: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bio?: string | null;
          business_name: string;
          contact_name: string;
          created_at?: string;
          insurance_status?: string;
          phone?: string | null;
          postcode?: string | null;
          trade_categories?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bio?: string | null;
          business_name?: string;
          contact_name?: string;
          created_at?: string;
          insurance_status?: string;
          phone?: string | null;
          postcode?: string | null;
          trade_categories?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trades_job_interests: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          message: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          message?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          message?: string | null;
          status?: string;
          user_id?: string;
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
          budget_max: number | null;
          budget_min: number | null;
          created_at: string;
          description: string;
          desired_start_date: string | null;
          id: string;
          job_category: string;
          postcode: string | null;
          property_address: string | null;
          property_type: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          budget_max?: number | null;
          budget_min?: number | null;
          created_at?: string;
          description: string;
          desired_start_date?: string | null;
          id?: string;
          job_category: string;
          postcode?: string | null;
          property_address?: string | null;
          property_type?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          budget_max?: number | null;
          budget_min?: number | null;
          created_at?: string;
          description?: string;
          desired_start_date?: string | null;
          id?: string;
          job_category?: string;
          postcode?: string | null;
          property_address?: string | null;
          property_type?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      // --- New foundation tables for 3D Floorplan, Marketplace, Photo Analysis, Pitch Deck, Public Gallery ---
      // Added via 20260605123000_feature_foundation.sql (UUIDv7 PKs, RLS, etc.)
      floorplan_models: {
        Row: {
          created_at: string;
          id: string;
          metadata: Json;
          model_url: string | null;
          name: string;
          project_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metadata?: Json;
          model_url?: string | null;
          name?: string;
          project_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          metadata?: Json;
          model_url?: string | null;
          name?: string;
          project_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "floorplan_models_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      floorplan_annotations: {
        Row: {
          annotation_type: string;
          created_at: string;
          data: Json;
          id: string;
          model_id: string;
          updated_at: string;
        };
        Insert: {
          annotation_type: string;
          created_at?: string;
          data?: Json;
          id?: string;
          model_id: string;
          updated_at?: string;
        };
        Update: {
          annotation_type?: string;
          created_at?: string;
          data?: Json;
          id?: string;
          model_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "floorplan_annotations_model_id_fkey";
            columns: ["model_id"];
            isOneToOne: false;
            referencedRelation: "floorplan_models";
            referencedColumns: ["id"];
          },
        ];
      };
      floorplan_measurements: {
        Row: {
          created_at: string;
          id: string;
          measurement_type: string;
          model_id: string;
          unit: string;
          updated_at: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          measurement_type: string;
          model_id: string;
          unit?: string;
          updated_at?: string;
          value: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          measurement_type?: string;
          model_id?: string;
          unit?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "floorplan_measurements_model_id_fkey";
            columns: ["model_id"];
            isOneToOne: false;
            referencedRelation: "floorplan_models";
            referencedColumns: ["id"];
          },
        ];
      };
      tradespeople: {
        Row: {
          bio: string | null;
          business_name: string;
          contact_name: string;
          created_at: string;
          email: string | null;
          id: string;
          insurance_status: string;
          phone: string | null;
          postcode: string | null;
          rating: number | null;
          review_count: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bio?: string | null;
          business_name: string;
          contact_name: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          insurance_status?: string;
          phone?: string | null;
          postcode?: string | null;
          rating?: number | null;
          review_count?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bio?: string | null;
          business_name?: string;
          contact_name?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          insurance_status?: string;
          phone?: string | null;
          postcode?: string | null;
          rating?: number | null;
          review_count?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trade_specialties: {
        Row: {
          created_at: string;
          id: string;
          specialty: string;
          tradesperson_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          specialty: string;
          tradesperson_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          specialty?: string;
          tradesperson_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trade_specialties_tradesperson_id_fkey";
            columns: ["tradesperson_id"];
            isOneToOne: false;
            referencedRelation: "tradespeople";
            referencedColumns: ["id"];
          },
        ];
      };
      trade_favorites: {
        Row: {
          created_at: string;
          id: string;
          tradesperson_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          tradesperson_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          tradesperson_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trade_favorites_tradesperson_id_fkey";
            columns: ["tradesperson_id"];
            isOneToOne: false;
            referencedRelation: "tradespeople";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_requests: {
        Row: {
          created_at: string;
          id: string;
          message: string | null;
          project_id: string;
          proposed_price: number | null;
          status: string;
          tradesperson_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message?: string | null;
          project_id: string;
          proposed_price?: number | null;
          status?: string;
          tradesperson_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string | null;
          project_id?: string;
          proposed_price?: number | null;
          status?: string;
          tradesperson_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_requests_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_requests_tradesperson_id_fkey";
            columns: ["tradesperson_id"];
            isOneToOne: false;
            referencedRelation: "tradespeople";
            referencedColumns: ["id"];
          },
        ];
      };
      trade_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          quote_request_id: string;
          sender_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          quote_request_id: string;
          sender_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          quote_request_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trade_messages_quote_request_id_fkey";
            columns: ["quote_request_id"];
            isOneToOne: false;
            referencedRelation: "quote_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      photo_analysis_results: {
        Row: {
          analysis_data: Json;
          confidence: number | null;
          created_at: string;
          id: string;
          photo_id: string | null;
          project_id: string;
          source: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          analysis_data?: Json;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          photo_id?: string | null;
          project_id: string;
          source?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          analysis_data?: Json;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          photo_id?: string | null;
          project_id?: string;
          source?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "photo_analysis_results_photo_id_fkey";
            columns: ["photo_id"];
            isOneToOne: false;
            referencedRelation: "photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photo_analysis_results_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      pitch_deck_exports: {
        Row: {
          created_at: string;
          export_url: string | null;
          file_size_bytes: number | null;
          format: string;
          id: string;
          project_id: string;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          export_url?: string | null;
          file_size_bytes?: number | null;
          format?: string;
          id?: string;
          project_id: string;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          export_url?: string | null;
          file_size_bytes?: number | null;
          format?: string;
          id?: string;
          project_id?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pitch_deck_exports_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      public_gallery_projects: {
        Row: {
          cover_image_url: string | null;
          created_at: string;
          description: string | null;
          featured: boolean;
          id: string;
          is_public: boolean;
          project_id: string;
          title: string | null;
          updated_at: string;
          view_count: number;
        };
        Insert: {
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          featured?: boolean;
          id?: string;
          is_public?: boolean;
          project_id: string;
          title?: string | null;
          updated_at?: string;
          view_count?: number;
        };
        Update: {
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          featured?: boolean;
          id?: string;
          is_public?: boolean;
          project_id?: string;
          title?: string | null;
          updated_at?: string;
          view_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "public_gallery_projects_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      investor_leads: {
        Row: {
          created_at: string;
          email: string;
          gallery_project_id: string;
          id: string;
          message: string | null;
          name: string;
          phone: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          gallery_project_id: string;
          id?: string;
          message?: string | null;
          name: string;
          phone?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          gallery_project_id?: string;
          id?: string;
          message?: string | null;
          name?: string;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "investor_leads_gallery_project_id_fkey";
            columns: ["gallery_project_id"];
            isOneToOne: false;
            referencedRelation: "public_gallery_projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
