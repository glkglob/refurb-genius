export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      analysis_jobs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          failed_at: string | null;
          id: string;
          input_payload: Json;
          result_payload: Json | null;
          started_at: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          failed_at?: string | null;
          id?: string;
          input_payload?: Json;
          result_payload?: Json | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          failed_at?: string | null;
          id?: string;
          input_payload?: Json;
          result_payload?: Json | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      deal_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          image_urls: string[];
          metadata: Json;
          role: string;
          structured_output: Json | null;
          thread_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          image_urls?: string[];
          metadata?: Json;
          role: string;
          structured_output?: Json | null;
          thread_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          image_urls?: string[];
          metadata?: Json;
          role?: string;
          structured_output?: Json | null;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deal_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "deal_threads";
            referencedColumns: ["id"];
          },
        ];
      };
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
      deal_threads: {
        Row: {
          created_at: string;
          id: string;
          opportunity_id: string;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          opportunity_id: string;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          opportunity_id?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deal_threads_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "deal_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      estimate_authority_idempotency: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          idempotency_key: string;
          operation_status: string;
          payload_hash: string;
          pricing_authority: string;
          project_id: string;
          resulting_estimate_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          operation_status: string;
          payload_hash: string;
          pricing_authority: string;
          project_id: string;
          resulting_estimate_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          operation_status?: string;
          payload_hash?: string;
          pricing_authority?: string;
          project_id?: string;
          resulting_estimate_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_authority_idempotency_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimate_authority_idempotency_resulting_estimate_id_fkey";
            columns: ["resulting_estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
        ];
      };
      estimate_items: {
        Row: {
          base_unit_rate: number | null;
          catalog_revision: string | null;
          category: string;
          created_at: string | null;
          display_order: number | null;
          estimate_id: string;
          id: string;
          is_ai_suggested: boolean | null;
          labour: number;
          materials: number;
          name: string;
          notes: string | null;
          quantity: number | null;
          rate_key: string | null;
          rate_source: string | null;
          regional_multiplier: number | null;
          resolved_unit_rate: number | null;
          room_id: string | null;
          total_cost: number;
          unit: string | null;
          unit_cost: number | null;
          user_id: string;
          weeks: number;
        };
        Insert: {
          base_unit_rate?: number | null;
          catalog_revision?: string | null;
          category: string;
          created_at?: string | null;
          display_order?: number | null;
          estimate_id: string;
          id?: string;
          is_ai_suggested?: boolean | null;
          labour?: number;
          materials?: number;
          name?: string;
          notes?: string | null;
          quantity?: number | null;
          rate_key?: string | null;
          rate_source?: string | null;
          regional_multiplier?: number | null;
          resolved_unit_rate?: number | null;
          room_id?: string | null;
          total_cost?: number;
          unit?: string | null;
          unit_cost?: number | null;
          user_id: string;
          weeks?: number;
        };
        Update: {
          base_unit_rate?: number | null;
          catalog_revision?: string | null;
          category?: string;
          created_at?: string | null;
          display_order?: number | null;
          estimate_id?: string;
          id?: string;
          is_ai_suggested?: boolean | null;
          labour?: number;
          materials?: number;
          name?: string;
          notes?: string | null;
          quantity?: number | null;
          rate_key?: string | null;
          rate_source?: string | null;
          regional_multiplier?: number | null;
          resolved_unit_rate?: number | null;
          room_id?: string | null;
          total_cost?: number;
          unit?: string | null;
          unit_cost?: number | null;
          user_id?: string;
          weeks?: number;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_items_catalog_entry_fkey";
            columns: ["catalog_revision", "rate_key"];
            isOneToOne: false;
            referencedRelation: "measured_boq_catalog_entries";
            referencedColumns: ["catalog_revision", "rate_key"];
          },
          {
            foreignKeyName: "estimate_items_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
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
          catalog_revision: string | null;
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
          notes: string | null;
          pricing_authority: string;
          pricing_policy_version: string | null;
          project_id: string;
          region: string;
          status: string | null;
          subtotal: number;
          timeline_weeks: number;
          title: string;
          updated_at: string | null;
          user_id: string;
          vat_amount: number;
          vat_rate: number | null;
        };
        Insert: {
          ai_generated?: boolean | null;
          catalog_revision?: string | null;
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
          notes?: string | null;
          pricing_authority?: string;
          pricing_policy_version?: string | null;
          project_id: string;
          region: string;
          status?: string | null;
          subtotal?: number;
          timeline_weeks?: number;
          title?: string;
          updated_at?: string | null;
          user_id: string;
          vat_amount?: number;
          vat_rate?: number | null;
        };
        Update: {
          ai_generated?: boolean | null;
          catalog_revision?: string | null;
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
          notes?: string | null;
          pricing_authority?: string;
          pricing_policy_version?: string | null;
          project_id?: string;
          region?: string;
          status?: string | null;
          subtotal?: number;
          timeline_weeks?: number;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
          vat_amount?: number;
          vat_rate?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "estimates_catalog_revision_fkey";
            columns: ["catalog_revision"];
            isOneToOne: false;
            referencedRelation: "measured_boq_catalog_revisions";
            referencedColumns: ["catalog_revision"];
          },
          {
            foreignKeyName: "estimates_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      feasibility_studies: {
        Row: {
          created_at: string;
          current_snapshot_version: number;
          id: string;
          last_computed_at: string;
          project_id: string;
          status: string;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_snapshot_version?: number;
          id?: string;
          last_computed_at?: string;
          project_id: string;
          status?: string;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_snapshot_version?: number;
          id?: string;
          last_computed_at?: string;
          project_id?: string;
          status?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feasibility_studies_project_id_fkey";
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
      floorplan_models: {
        Row: {
          created_at: string;
          id: string;
          metadata: Json | null;
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
          metadata?: Json | null;
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
          metadata?: Json | null;
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
      measured_boq_catalog_entries: {
        Row: {
          base_unit_rate: number;
          catalog_revision: string;
          cost_type: string;
          created_at: string;
          currency: string;
          description: string | null;
          display_name: string;
          id: string;
          rate_key: string;
          replacement_rate_key: string | null;
          source_reference: string | null;
          status: string;
          trade_or_domain: string;
          unit: string;
          updated_at: string;
          vat_basis: string;
        };
        Insert: {
          base_unit_rate: number;
          catalog_revision: string;
          cost_type: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          display_name: string;
          id?: string;
          rate_key: string;
          replacement_rate_key?: string | null;
          source_reference?: string | null;
          status?: string;
          trade_or_domain: string;
          unit: string;
          updated_at?: string;
          vat_basis?: string;
        };
        Update: {
          base_unit_rate?: number;
          catalog_revision?: string;
          cost_type?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          display_name?: string;
          id?: string;
          rate_key?: string;
          replacement_rate_key?: string | null;
          source_reference?: string | null;
          status?: string;
          trade_or_domain?: string;
          unit?: string;
          updated_at?: string;
          vat_basis?: string;
        };
        Relationships: [
          {
            foreignKeyName: "measured_boq_catalog_entries_catalog_revision_fkey";
            columns: ["catalog_revision"];
            isOneToOne: false;
            referencedRelation: "measured_boq_catalog_revisions";
            referencedColumns: ["catalog_revision"];
          },
        ];
      };
      measured_boq_catalog_events: {
        Row: {
          actor_kind: string;
          actor_user_id: string | null;
          catalog_revision: string;
          command_scope: string;
          content_checksum: string | null;
          created_at: string;
          event_type: string;
          id: string;
          input_checksum: string | null;
          package_id: string | null;
          payload_json: Json;
          prior_revision_id: string | null;
          reason: string | null;
          request_id: string;
          result: string;
          revision_id: string;
        };
        Insert: {
          actor_kind: string;
          actor_user_id?: string | null;
          catalog_revision: string;
          command_scope: string;
          content_checksum?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          input_checksum?: string | null;
          package_id?: string | null;
          payload_json?: Json;
          prior_revision_id?: string | null;
          reason?: string | null;
          request_id: string;
          result: string;
          revision_id: string;
        };
        Update: {
          actor_kind?: string;
          actor_user_id?: string | null;
          catalog_revision?: string;
          command_scope?: string;
          content_checksum?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          input_checksum?: string | null;
          package_id?: string | null;
          payload_json?: Json;
          prior_revision_id?: string | null;
          reason?: string | null;
          request_id?: string;
          result?: string;
          revision_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "measured_boq_catalog_events_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "measured_boq_catalog_packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "measured_boq_catalog_events_prior_revision_id_fkey";
            columns: ["prior_revision_id"];
            isOneToOne: false;
            referencedRelation: "measured_boq_catalog_revisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "measured_boq_catalog_events_revision_id_fkey";
            columns: ["revision_id"];
            isOneToOne: false;
            referencedRelation: "measured_boq_catalog_revisions";
            referencedColumns: ["id"];
          },
        ];
      };
      measured_boq_catalog_packages: {
        Row: {
          catalog_revision: string;
          content_checksum: string;
          created_at: string;
          id: string;
          input_checksum: string;
          licence_status: string;
          manifest_text: string;
          manifest_version: number;
          normaliser_version: string;
          production: boolean;
          revision_id: string;
          snapshot_text: string;
          source_id: string;
          validation_report: Json;
        };
        Insert: {
          catalog_revision: string;
          content_checksum: string;
          created_at?: string;
          id?: string;
          input_checksum: string;
          licence_status: string;
          manifest_text: string;
          manifest_version: number;
          normaliser_version: string;
          production?: boolean;
          revision_id: string;
          snapshot_text: string;
          source_id: string;
          validation_report: Json;
        };
        Update: {
          catalog_revision?: string;
          content_checksum?: string;
          created_at?: string;
          id?: string;
          input_checksum?: string;
          licence_status?: string;
          manifest_text?: string;
          manifest_version?: number;
          normaliser_version?: string;
          production?: boolean;
          revision_id?: string;
          snapshot_text?: string;
          source_id?: string;
          validation_report?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "measured_boq_catalog_packages_catalog_revision_fkey";
            columns: ["catalog_revision"];
            isOneToOne: false;
            referencedRelation: "measured_boq_catalog_revisions";
            referencedColumns: ["catalog_revision"];
          },
          {
            foreignKeyName: "measured_boq_catalog_packages_revision_id_fkey";
            columns: ["revision_id"];
            isOneToOne: true;
            referencedRelation: "measured_boq_catalog_revisions";
            referencedColumns: ["id"];
          },
        ];
      };
      measured_boq_catalog_revisions: {
        Row: {
          catalog_revision: string;
          content_checksum: string;
          created_at: string;
          created_by: string;
          currency: string;
          effective_from: string;
          entry_count: number;
          id: string;
          input_checksum: string | null;
          licence_status: string | null;
          normaliser_version: string | null;
          production: boolean;
          published_at: string | null;
          published_by_id: string | null;
          published_by_kind: string | null;
          regional_basis: string;
          release_notes: string | null;
          retired_at: string | null;
          retired_by_id: string | null;
          retired_by_kind: string | null;
          retirement_reason: string | null;
          schema_version: string;
          source_description: string;
          source_id: string | null;
          status: string;
          updated_at: string;
          vat_basis: string;
        };
        Insert: {
          catalog_revision: string;
          content_checksum: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          effective_from: string;
          entry_count?: number;
          id?: string;
          input_checksum?: string | null;
          licence_status?: string | null;
          normaliser_version?: string | null;
          production?: boolean;
          published_at?: string | null;
          published_by_id?: string | null;
          published_by_kind?: string | null;
          regional_basis?: string;
          release_notes?: string | null;
          retired_at?: string | null;
          retired_by_id?: string | null;
          retired_by_kind?: string | null;
          retirement_reason?: string | null;
          schema_version: string;
          source_description: string;
          source_id?: string | null;
          status?: string;
          updated_at?: string;
          vat_basis?: string;
        };
        Update: {
          catalog_revision?: string;
          content_checksum?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          effective_from?: string;
          entry_count?: number;
          id?: string;
          input_checksum?: string | null;
          licence_status?: string | null;
          normaliser_version?: string | null;
          production?: boolean;
          published_at?: string | null;
          published_by_id?: string | null;
          published_by_kind?: string | null;
          regional_basis?: string;
          release_notes?: string | null;
          retired_at?: string | null;
          retired_by_id?: string | null;
          retired_by_kind?: string | null;
          retirement_reason?: string | null;
          schema_version?: string;
          source_description?: string;
          source_id?: string | null;
          status?: string;
          updated_at?: string;
          vat_basis?: string;
        };
        Relationships: [];
      };
      opportunity_photos: {
        Row: {
          id: string;
          name: string;
          opportunity_id: string;
          size: number;
          storage_path: string;
          uploaded_at: string;
          url: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          opportunity_id: string;
          size?: number;
          storage_path: string;
          uploaded_at?: string;
          url: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          opportunity_id?: string;
          size?: number;
          storage_path?: string;
          uploaded_at?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_photos_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "deal_opportunities";
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
          recommended_works: Json;
          refurbishment_level: string;
          room_type: string;
          source: string;
          user_id: string;
          visible_issues: Json;
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
          recommended_works?: Json;
          refurbishment_level: string;
          room_type: string;
          source?: string;
          user_id: string;
          visible_issues?: Json;
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
          recommended_works?: Json;
          refurbishment_level?: string;
          room_type?: string;
          source?: string;
          user_id?: string;
          visible_issues?: Json;
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
      share_links: {
        Row: {
          access_role: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          owner_user_id: string;
          revoked_at: string | null;
          study_id: string;
          token: string;
          visibility: string;
        };
        Insert: {
          access_role?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          owner_user_id: string;
          revoked_at?: string | null;
          study_id: string;
          token: string;
          visibility?: string;
        };
        Update: {
          access_role?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          owner_user_id?: string;
          revoked_at?: string | null;
          study_id?: string;
          token?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "share_links_study_id_fkey";
            columns: ["study_id"];
            isOneToOne: false;
            referencedRelation: "feasibility_studies";
            referencedColumns: ["id"];
          },
        ];
      };
      study_exports: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          export_type: string;
          id: string;
          queued_at: string;
          status: string;
          storage_path: string | null;
          study_id: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          export_type: string;
          id?: string;
          queued_at?: string;
          status?: string;
          storage_path?: string | null;
          study_id: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          export_type?: string;
          id?: string;
          queued_at?: string;
          status?: string;
          storage_path?: string | null;
          study_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_exports_study_id_fkey";
            columns: ["study_id"];
            isOneToOne: false;
            referencedRelation: "feasibility_studies";
            referencedColumns: ["id"];
          },
        ];
      };
      study_snapshots: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          snapshot: Json;
          study_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          snapshot: Json;
          study_id: string;
          version: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          snapshot?: Json;
          study_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "study_snapshots_study_id_fkey";
            columns: ["study_id"];
            isOneToOne: false;
            referencedRelation: "feasibility_studies";
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
      measured_boq_catalog_assert_parent_draft: {
        Args: { p_revision: string };
        Returns: undefined;
      };
      measured_boq_catalog_is_trusted_lifecycle_owner: {
        Args: never;
        Returns: boolean;
      };
      measured_boq_catalog_lifecycle_result: {
        Args: {
          p_event_id: string;
          p_idempotent_replay: boolean;
          p_new_status: string;
          p_outcome: string;
          p_previous_status: string;
          p_request_id: string;
          p_revision_id: string;
        };
        Returns: Json;
      };
      measured_boq_package_input_checksum: {
        Args: { p_manifest_text: string; p_snapshot_text: string };
        Returns: string;
      };
      persist_category_engine_estimate: {
        Args: {
          p_condition_level: string;
          p_contingency: number;
          p_expected_owner_id: string;
          p_finish_level: string;
          p_high_total: number;
          p_idempotency_key: string;
          p_items: Json;
          p_labour_total: number;
          p_low_total: number;
          p_materials_total: number;
          p_mid_total: number;
          p_payload_hash: string;
          p_pricing_policy_version: string;
          p_project_id: string;
          p_region: string;
          p_subtotal: number;
          p_timeline_weeks: number;
          p_vat_amount: number;
        };
        Returns: Json;
      };
      persist_measured_boq_catalog_draft: {
        Args: {
          p_catalog_revision: string;
          p_content_checksum: string;
          p_input_checksum: string;
          p_manifest_text: string;
          p_manifest_version: number;
          p_normaliser_version: string;
          p_normalized_entries: Json;
          p_request_id: string;
          p_snapshot_text: string;
          p_source_id: string;
          p_validation_report: Json;
        };
        Returns: Json;
      };
      publish_measured_boq_catalog_revision: {
        Args: {
          p_expected_status: string;
          p_request_id: string;
          p_revision_id: string;
        };
        Returns: Json;
      };
      resolve_share_link: {
        Args: { p_token: string };
        Returns: {
          access_role: string;
          expires_at: string;
          id: string;
          owner_user_id: string;
          study_id: string;
          visibility: string;
        }[];
      };
      retire_measured_boq_catalog_revision: {
        Args: {
          p_expected_status: string;
          p_reason: string;
          p_request_id: string;
          p_revision_id: string;
        };
        Returns: Json;
      };
      rollback_measured_boq_catalog_publication: {
        Args: {
          p_expected_status: string;
          p_prior_revision_id: string;
          p_reason: string;
          p_request_id: string;
          p_revision_id: string;
        };
        Returns: Json;
      };
      uuid_v7: { Args: never; Returns: string };
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
