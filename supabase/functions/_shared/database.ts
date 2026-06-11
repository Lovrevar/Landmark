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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounting_companies: {
        Row: {
          created_at: string
          id: string
          initial_balance: number
          name: string
          oib: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          initial_balance?: number
          name: string
          oib: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          initial_balance?: number
          name?: string
          oib?: string
          updated_at?: string
        }
        Relationships: []
      }
      accounting_invoices: {
        Row: {
          apartment_id: string | null
          approved: boolean
          bank_credit_id: string | null
          bank_id: string | null
          base_amount: number
          base_amount_1: number
          base_amount_2: number
          base_amount_3: number
          base_amount_4: number
          category: string
          company_bank_account_id: string | null
          company_id: string
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          credit_allocation_id: string | null
          customer_id: string | null
          description: string | null
          due_date: string
          iban: string | null
          id: string
          investment_id: string | null
          investor_id: string | null
          invoice_category: string
          invoice_number: string
          invoice_type: string
          issue_date: string
          milestone_id: string | null
          office_supplier_id: string | null
          paid_amount: number
          project_id: string | null
          reference_number: string | null
          refund_id: number | null
          remaining_amount: number
          retail_contract_id: string | null
          retail_customer_id: string | null
          retail_milestone_id: string | null
          retail_project_id: string | null
          retail_supplier_id: string | null
          status: string
          supplier_id: string | null
          total_amount: number
          updated_at: string | null
          vat_amount: number
          vat_amount_1: number
          vat_amount_2: number
          vat_amount_3: number
          vat_amount_4: number
          vat_rate: number
          vat_rate_1: number
          vat_rate_2: number
          vat_rate_3: number
          vat_rate_4: number
        }
        Insert: {
          apartment_id?: string | null
          approved?: boolean
          bank_credit_id?: string | null
          bank_id?: string | null
          base_amount?: number
          base_amount_1?: number
          base_amount_2?: number
          base_amount_3?: number
          base_amount_4?: number
          category: string
          company_bank_account_id?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_allocation_id?: string | null
          customer_id?: string | null
          description?: string | null
          due_date: string
          iban?: string | null
          id?: string
          investment_id?: string | null
          investor_id?: string | null
          invoice_category: string
          invoice_number: string
          invoice_type: string
          issue_date?: string
          milestone_id?: string | null
          office_supplier_id?: string | null
          paid_amount?: number
          project_id?: string | null
          reference_number?: string | null
          refund_id?: number | null
          remaining_amount?: number
          retail_contract_id?: string | null
          retail_customer_id?: string | null
          retail_milestone_id?: string | null
          retail_project_id?: string | null
          retail_supplier_id?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string | null
          vat_amount?: number
          vat_amount_1?: number
          vat_amount_2?: number
          vat_amount_3?: number
          vat_amount_4?: number
          vat_rate?: number
          vat_rate_1?: number
          vat_rate_2?: number
          vat_rate_3?: number
          vat_rate_4?: number
        }
        Update: {
          apartment_id?: string | null
          approved?: boolean
          bank_credit_id?: string | null
          bank_id?: string | null
          base_amount?: number
          base_amount_1?: number
          base_amount_2?: number
          base_amount_3?: number
          base_amount_4?: number
          category?: string
          company_bank_account_id?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_allocation_id?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string
          iban?: string | null
          id?: string
          investment_id?: string | null
          investor_id?: string | null
          invoice_category?: string
          invoice_number?: string
          invoice_type?: string
          issue_date?: string
          milestone_id?: string | null
          office_supplier_id?: string | null
          paid_amount?: number
          project_id?: string | null
          reference_number?: string | null
          refund_id?: number | null
          remaining_amount?: number
          retail_contract_id?: string | null
          retail_customer_id?: string | null
          retail_milestone_id?: string | null
          retail_project_id?: string | null
          retail_supplier_id?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string | null
          vat_amount?: number
          vat_amount_1?: number
          vat_amount_2?: number
          vat_amount_3?: number
          vat_amount_4?: number
          vat_rate?: number
          vat_rate_1?: number
          vat_rate_2?: number
          vat_rate_3?: number
          vat_rate_4?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounting_invoices_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_bank_credit_id_fkey"
            columns: ["bank_credit_id"]
            isOneToOne: false
            referencedRelation: "bank_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_company_bank_account_id_fkey"
            columns: ["company_bank_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_credit_allocation_id_fkey"
            columns: ["credit_allocation_id"]
            isOneToOne: false
            referencedRelation: "credit_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "subcontractor_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_office_supplier_id_fkey"
            columns: ["office_supplier_id"]
            isOneToOne: false
            referencedRelation: "office_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "accounting_invoices_refund"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_retail_contract_id_fkey"
            columns: ["retail_contract_id"]
            isOneToOne: false
            referencedRelation: "retail_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_retail_customer_id_fkey"
            columns: ["retail_customer_id"]
            isOneToOne: false
            referencedRelation: "retail_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_retail_milestone_id_fkey"
            columns: ["retail_milestone_id"]
            isOneToOne: false
            referencedRelation: "retail_contract_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_retail_project_id_fkey"
            columns: ["retail_project_id"]
            isOneToOne: false
            referencedRelation: "retail_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_retail_supplier_id_fkey"
            columns: ["retail_supplier_id"]
            isOneToOne: false
            referencedRelation: "retail_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_invoices_refund: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: never
          name: string
        }
        Update: {
          id?: never
          name?: string
        }
        Relationships: []
      }
      accounting_payments: {
        Row: {
          amount: number
          cesija_bank_account_id: string | null
          cesija_company_id: string | null
          cesija_credit_allocation_id: string | null
          cesija_credit_id: string | null
          company_bank_account_id: string | null
          created_at: string | null
          created_by: string | null
          credit_allocation_id: string | null
          credit_id: string | null
          description: string | null
          id: string
          invoice_id: string
          is_cesija: boolean | null
          payment_date: string
          payment_method: string
          payment_source_type: string | null
          reference_number: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          cesija_bank_account_id?: string | null
          cesija_company_id?: string | null
          cesija_credit_allocation_id?: string | null
          cesija_credit_id?: string | null
          company_bank_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_allocation_id?: string | null
          credit_id?: string | null
          description?: string | null
          id?: string
          invoice_id: string
          is_cesija?: boolean | null
          payment_date?: string
          payment_method: string
          payment_source_type?: string | null
          reference_number?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          cesija_bank_account_id?: string | null
          cesija_company_id?: string | null
          cesija_credit_allocation_id?: string | null
          cesija_credit_id?: string | null
          company_bank_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_allocation_id?: string | null
          credit_id?: string | null
          description?: string | null
          id?: string
          invoice_id?: string
          is_cesija?: boolean | null
          payment_date?: string
          payment_method?: string
          payment_source_type?: string | null
          reference_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_payments_cesija_bank_account_id_fkey"
            columns: ["cesija_bank_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_cesija_company_id_fkey"
            columns: ["cesija_company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_cesija_company_id_fkey"
            columns: ["cesija_company_id"]
            isOneToOne: false
            referencedRelation: "company_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_cesija_credit_allocation_id_fkey"
            columns: ["cesija_credit_allocation_id"]
            isOneToOne: false
            referencedRelation: "credit_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_cesija_credit_id_fkey"
            columns: ["cesija_credit_id"]
            isOneToOne: false
            referencedRelation: "bank_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_company_bank_account_id_fkey"
            columns: ["company_bank_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_credit_allocation_id_fkey"
            columns: ["credit_allocation_id"]
            isOneToOne: false
            referencedRelation: "credit_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "bank_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "accounting_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          metadata: Json
          project_id: string | null
          user_id: string
          user_role: string
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          project_id?: string | null
          user_id: string
          user_role: string
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          project_id?: string | null
          user_id?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_help_searches: {
        Row: {
          created_at: string
          current_route: string | null
          id: string
          query: string
          returned_ids: string[]
          top_similarity: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_route?: string | null
          id?: string
          query: string
          returned_ids?: string[]
          top_similarity?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_route?: string | null
          id?: string
          query?: string
          returned_ids?: string[]
          top_similarity?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_help_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_message_attachments: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_size: number
          id: string
          kind: string
          message_id: string
          mime_type: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_size: number
          id?: string
          kind: string
          message_id: string
          mime_type: string
          storage_path: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_size?: number
          id?: string
          kind?: string
          message_id?: string
          mime_type?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: Json
          created_at: string
          edited_at: string | null
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          parent_id: string | null
          role: string
          session_id: string
          stop_reason: string | null
        }
        Insert: {
          content: Json
          created_at?: string
          edited_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          parent_id?: string | null
          role: string
          session_id: string
          stop_reason?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          edited_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          parent_id?: string | null
          role?: string
          session_id?: string
          stop_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sessions: {
        Row: {
          cancel_requested_at: string | null
          context_summary: string | null
          created_at: string
          id: string
          summary_through_message_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_requested_at?: string | null
          context_summary?: string | null
          created_at?: string
          id?: string
          summary_through_message_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_requested_at?: string | null
          context_summary?: string | null
          created_at?: string
          id?: string
          summary_through_message_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_sessions_summary_through_message_id_fkey"
            columns: ["summary_through_message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      apartment_garages: {
        Row: {
          apartment_id: string
          created_at: string | null
          garage_id: string
          id: string
        }
        Insert: {
          apartment_id: string
          created_at?: string | null
          garage_id: string
          id?: string
        }
        Update: {
          apartment_id?: string
          created_at?: string | null
          garage_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apartment_garages_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartment_garages_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
        ]
      }
      apartment_repositories: {
        Row: {
          apartment_id: string
          created_at: string | null
          id: string
          repository_id: string
        }
        Insert: {
          apartment_id: string
          created_at?: string | null
          id?: string
          repository_id: string
        }
        Update: {
          apartment_id?: string
          created_at?: string | null
          id?: string
          repository_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apartment_repositories_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartment_repositories_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      apartments: {
        Row: {
          building_id: string | null
          buyer_name: string | null
          contract_payment_type: string | null
          created_at: string | null
          datum_potpisa_predugovora: string | null
          floor: number
          id: string
          kapara_10_posto: number | null
          kredit_etaziranje_90: number | null
          number: string
          povrsina_ot_sa_koef: number | null
          povrsina_otvoreno: number | null
          price: number
          price_per_m2: number | null
          project_id: string
          rata_1_ab_konstrukcija_30: number | null
          rata_2_postava_stolarije_20: number | null
          rata_3_obrtnicki_radovi_20: number | null
          rata_4_uporabna_20: number | null
          size_m2: number
          sobnost: number | null
          status: string
          tip_stana: string | null
          ulaz: string | null
        }
        Insert: {
          building_id?: string | null
          buyer_name?: string | null
          contract_payment_type?: string | null
          created_at?: string | null
          datum_potpisa_predugovora?: string | null
          floor: number
          id?: string
          kapara_10_posto?: number | null
          kredit_etaziranje_90?: number | null
          number: string
          povrsina_ot_sa_koef?: number | null
          povrsina_otvoreno?: number | null
          price: number
          price_per_m2?: number | null
          project_id: string
          rata_1_ab_konstrukcija_30?: number | null
          rata_2_postava_stolarije_20?: number | null
          rata_3_obrtnicki_radovi_20?: number | null
          rata_4_uporabna_20?: number | null
          size_m2: number
          sobnost?: number | null
          status?: string
          tip_stana?: string | null
          ulaz?: string | null
        }
        Update: {
          building_id?: string | null
          buyer_name?: string | null
          contract_payment_type?: string | null
          created_at?: string | null
          datum_potpisa_predugovora?: string | null
          floor?: number
          id?: string
          kapara_10_posto?: number | null
          kredit_etaziranje_90?: number | null
          number?: string
          povrsina_ot_sa_koef?: number | null
          povrsina_otvoreno?: number | null
          price?: number
          price_per_m2?: number | null
          project_id?: string
          rata_1_ab_konstrukcija_30?: number | null
          rata_2_postava_stolarije_20?: number | null
          rata_3_obrtnicki_radovi_20?: number | null
          rata_4_uporabna_20?: number | null
          size_m2?: number
          sobnost?: number | null
          status?: string
          tip_stana?: string | null
          ulaz?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_credits: {
        Row: {
          amount: number
          bank_id: string | null
          company_id: string | null
          created_at: string | null
          credit_name: string
          credit_seniority: string | null
          credit_type: string
          disbursed_to_account: boolean | null
          disbursed_to_bank_account_id: string | null
          grace_period: number | null
          id: string
          interest_rate: number | null
          interest_repayment_type: string | null
          maturity_date: string | null
          monthly_payment: number | null
          outstanding_balance: number | null
          principal_repayment_type: string | null
          project_id: string | null
          purpose: string | null
          repaid_amount: number | null
          repayment_type: string | null
          start_date: string
          status: string | null
          usage_expiration_date: string | null
          used_amount: number | null
        }
        Insert: {
          amount?: number
          bank_id?: string | null
          company_id?: string | null
          created_at?: string | null
          credit_name?: string
          credit_seniority?: string | null
          credit_type: string
          disbursed_to_account?: boolean | null
          disbursed_to_bank_account_id?: string | null
          grace_period?: number | null
          id?: string
          interest_rate?: number | null
          interest_repayment_type?: string | null
          maturity_date?: string | null
          monthly_payment?: number | null
          outstanding_balance?: number | null
          principal_repayment_type?: string | null
          project_id?: string | null
          purpose?: string | null
          repaid_amount?: number | null
          repayment_type?: string | null
          start_date: string
          status?: string | null
          usage_expiration_date?: string | null
          used_amount?: number | null
        }
        Update: {
          amount?: number
          bank_id?: string | null
          company_id?: string | null
          created_at?: string | null
          credit_name?: string
          credit_seniority?: string | null
          credit_type?: string
          disbursed_to_account?: boolean | null
          disbursed_to_bank_account_id?: string | null
          grace_period?: number | null
          id?: string
          interest_rate?: number | null
          interest_repayment_type?: string | null
          maturity_date?: string | null
          monthly_payment?: number | null
          outstanding_balance?: number | null
          principal_repayment_type?: string | null
          project_id?: string | null
          purpose?: string | null
          repaid_amount?: number | null
          repayment_type?: string | null
          start_date?: string
          status?: string | null
          usage_expiration_date?: string | null
          used_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_credits_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_credits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_credits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_credits_disbursed_to_bank_account_id_fkey"
            columns: ["disbursed_to_bank_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_credits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          available_funds: number | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          interest_rate: number | null
          name: string
          notes: string | null
          outstanding_debt: number | null
          relationship_start: string | null
          total_credit_limit: number | null
        }
        Insert: {
          available_funds?: number | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          interest_rate?: number | null
          name: string
          notes?: string | null
          outstanding_debt?: number | null
          relationship_start?: string | null
          total_credit_limit?: number | null
        }
        Update: {
          available_funds?: number | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          interest_rate?: number | null
          name?: string
          notes?: string | null
          outstanding_debt?: number | null
          relationship_start?: string | null
          total_credit_limit?: number | null
        }
        Relationships: []
      }
      buildings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          project_id: string
          total_floors: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          project_id: string
          total_floors?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          total_floors?: number
        }
        Relationships: [
          {
            foreignKeyName: "buildings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_exceptions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_cancelled: boolean
          original_start_at: string
          override_end_at: string | null
          override_start_at: string | null
          override_title: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_cancelled?: boolean
          original_start_at: string
          override_end_at?: string | null
          override_start_at?: string | null
          override_title?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_cancelled?: boolean
          original_start_at?: string
          override_end_at?: string | null
          override_start_at?: string | null
          override_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_exceptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_participants: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          event_id: string
          id: string
          response: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          response?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          response?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          busy: boolean
          created_at: string
          created_by: string
          description: string
          end_at: string
          event_type: string
          id: string
          is_private: boolean
          location: string
          project_id: string | null
          recurrence: string | null
          reminder_offsets: number[]
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          busy?: boolean
          created_at?: string
          created_by: string
          description?: string
          end_at: string
          event_type?: string
          id?: string
          is_private?: boolean
          location?: string
          project_id?: string | null
          recurrence?: string | null
          reminder_offsets?: number[]
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          busy?: boolean
          created_at?: string
          created_by?: string
          description?: string
          end_at?: string
          event_type?: string
          id?: string
          is_private?: boolean
          location?: string
          project_id?: string | null
          recurrence?: string | null
          reminder_offsets?: number[]
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_notifications: {
        Row: {
          acknowledged_at: string | null
          body: string | null
          created_at: string
          event_id: string
          id: string
          occurrence_start_at: string
          offset_minutes: number
          title: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          body?: string | null
          created_at?: string
          event_id: string
          id?: string
          occurrence_start_at: string
          offset_minutes: number
          title: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          body?: string | null
          created_at?: string
          event_id?: string
          id?: string
          occurrence_start_at?: string
          offset_minutes?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_occurrence_responses: {
        Row: {
          acknowledged_at: string
          created_at: string
          event_id: string
          id: string
          original_start_at: string
          response: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          created_at?: string
          event_id: string
          id?: string
          original_start_at: string
          response: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          created_at?: string
          event_id?: string
          id?: string
          original_start_at?: string
          response?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_occurrence_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_occurrence_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_reminder_sends: {
        Row: {
          event_id: string
          id: string
          occurrence_start_at: string
          offset_minutes: number
          sent_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          occurrence_start_at: string
          offset_minutes: number
          sent_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          occurrence_start_at?: string
          offset_minutes?: number
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_reminder_sends_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_reminder_sends_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          name: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          sender_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_bank_accounts: {
        Row: {
          account_number: string | null
          balance_reset_at: string | null
          bank_name: string
          company_id: string
          created_at: string | null
          current_balance: number
          id: string
          initial_balance: number
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          balance_reset_at?: string | null
          bank_name: string
          company_id: string
          created_at?: string | null
          current_balance?: number
          id?: string
          initial_balance?: number
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          balance_reset_at?: string | null
          bank_name?: string
          company_id?: string
          created_at?: string | null
          current_balance?: number
          id?: string
          initial_balance?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_statistics"
            referencedColumns: ["id"]
          },
        ]
      }
      company_loans: {
        Row: {
          amount: number
          created_at: string | null
          from_bank_account_id: string
          from_company_id: string
          id: string
          loan_date: string | null
          to_bank_account_id: string
          to_company_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          from_bank_account_id: string
          from_company_id: string
          id?: string
          loan_date?: string | null
          to_bank_account_id: string
          to_company_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          from_bank_account_id?: string
          from_company_id?: string
          id?: string
          loan_date?: string | null
          to_bank_account_id?: string
          to_company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_loans_from_bank_account_id_fkey"
            columns: ["from_bank_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_loans_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_loans_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "company_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_loans_to_bank_account_id_fkey"
            columns: ["to_bank_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_loans_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "accounting_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_loans_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "company_statistics"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: number
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          base_amount: number | null
          budget_realized: number
          contract_amount: number
          contract_number: string | null
          contract_type_id: number
          created_at: string | null
          end_date: string | null
          has_contract: boolean
          id: string
          job_description: string
          notes: string | null
          phase_id: string | null
          project_id: string
          signed: boolean | null
          signed_date: string | null
          start_date: string | null
          status: string | null
          subcontractor_id: string
          terms: string | null
          total_amount: number | null
          total_invoices_amount: number
          updated_at: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          base_amount?: number | null
          budget_realized?: number
          contract_amount?: number
          contract_number?: string | null
          contract_type_id?: number
          created_at?: string | null
          end_date?: string | null
          has_contract?: boolean
          id?: string
          job_description: string
          notes?: string | null
          phase_id?: string | null
          project_id: string
          signed?: boolean | null
          signed_date?: string | null
          start_date?: string | null
          status?: string | null
          subcontractor_id: string
          terms?: string | null
          total_amount?: number | null
          total_invoices_amount?: number
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          base_amount?: number | null
          budget_realized?: number
          contract_amount?: number
          contract_number?: string | null
          contract_type_id?: number
          created_at?: string | null
          end_date?: string | null
          has_contract?: boolean
          id?: string
          job_description?: string
          notes?: string | null
          phase_id?: string | null
          project_id?: string
          signed?: boolean | null
          signed_date?: string | null
          start_date?: string | null
          status?: string | null
          subcontractor_id?: string
          terms?: string | null
          total_amount?: number | null
          total_invoices_amount?: number
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "contract_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_allocations: {
        Row: {
          allocated_amount: number
          allocation_type: string | null
          created_at: string | null
          credit_id: string
          description: string | null
          id: string
          project_id: string | null
          refinancing_entity_id: string | null
          refinancing_entity_type: string | null
          updated_at: string | null
          used_amount: number
        }
        Insert: {
          allocated_amount?: number
          allocation_type?: string | null
          created_at?: string | null
          credit_id: string
          description?: string | null
          id?: string
          project_id?: string | null
          refinancing_entity_id?: string | null
          refinancing_entity_type?: string | null
          updated_at?: string | null
          used_amount?: number
        }
        Update: {
          allocated_amount?: number
          allocation_type?: string | null
          created_at?: string | null
          credit_id?: string
          description?: string | null
          id?: string
          project_id?: string | null
          refinancing_entity_id?: string | null
          refinancing_entity_type?: string | null
          updated_at?: string | null
          used_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_allocations_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "bank_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          backed_out_reason: string | null
          bank_account: string | null
          created_at: string | null
          customer_number: number
          email: string
          id: string
          id_number: string | null
          last_contact_date: string | null
          name: string
          notes: string | null
          phone: string | null
          preferences: Json | null
          priority: string | null
          status: string
          surname: string
        }
        Insert: {
          address?: string | null
          backed_out_reason?: string | null
          bank_account?: string | null
          created_at?: string | null
          customer_number?: number
          email: string
          id?: string
          id_number?: string | null
          last_contact_date?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          preferences?: Json | null
          priority?: string | null
          status?: string
          surname: string
        }
        Update: {
          address?: string | null
          backed_out_reason?: string | null
          bank_account?: string | null
          created_at?: string | null
          customer_number?: number
          email?: string
          id?: string
          id_number?: string | null
          last_contact_date?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          preferences?: Json | null
          priority?: string | null
          status?: string
          surname?: string
        }
        Relationships: []
      }
      document_associations: {
        Row: {
          document_id: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          document_id: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          document_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_associations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          code: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name_hr: string
          parent_id: string | null
          path: string
          required_associations: Json
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name_hr: string
          parent_id?: string | null
          path: string
          required_associations?: Json
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name_hr?: string
          parent_id?: string | null
          path?: string
          required_associations?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category_id: string | null
          content_hash: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          search_text: unknown
          source: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          category_id?: string | null
          content_hash?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string | null
          search_text?: unknown
          source?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category_id?: string | null
          content_hash?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          search_text?: unknown
          source?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      garages: {
        Row: {
          building_id: string
          buyer_name: string | null
          created_at: string | null
          floor: number
          id: string
          number: string
          price: number
          price_per_m2: number | null
          size_m2: number
          status: string
        }
        Insert: {
          building_id: string
          buyer_name?: string | null
          created_at?: string | null
          floor?: number
          id?: string
          number: string
          price?: number
          price_per_m2?: number | null
          size_m2?: number
          status?: string
        }
        Update: {
          building_id?: string
          buyer_name?: string | null
          created_at?: string | null
          floor?: number
          id?: string
          number?: string
          price?: number
          price_per_m2?: number | null
          size_m2?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "garages_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_approved_invoices: {
        Row: {
          hidden_at: string
          hidden_by: string | null
          id: string
          invoice_id: string
        }
        Insert: {
          hidden_at?: string
          hidden_by?: string | null
          id?: string
          invoice_id: string
        }
        Update: {
          hidden_at?: string
          hidden_by?: string | null
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_approved_invoices_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_approved_invoices_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "accounting_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_categories: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      monthly_budgets: {
        Row: {
          budget_amount: number
          created_at: string | null
          id: string
          month: number
          notes: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          budget_amount?: number
          created_at?: string | null
          id?: string
          month: number
          notes?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          budget_amount?: number
          created_at?: string | null
          id?: string
          month?: number
          notes?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      office_suppliers: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          tax_id: string | null
          vat_id: string | null
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          tax_id?: string | null
          vat_id?: string | null
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          tax_id?: string | null
          vat_id?: string | null
        }
        Relationships: []
      }
      project_managers: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_managers_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_managers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          completed: boolean | null
          created_at: string | null
          due_date: string | null
          id: string
          name: string
          phase: string | null
          project_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          name: string
          phase?: string | null
          project_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          name?: string
          phase?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          budget_allocated: number | null
          budget_used: number | null
          created_at: string | null
          end_date: string | null
          id: string
          phase_name: string
          phase_number: number
          project_id: string
          start_date: string | null
          status: string | null
        }
        Insert: {
          budget_allocated?: number | null
          budget_used?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          phase_name: string
          phase_number: number
          project_id: string
          start_date?: string | null
          status?: string | null
        }
        Update: {
          budget_allocated?: number | null
          budget_used?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          phase_name?: string
          phase_number?: number
          project_id?: string
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          aliases: string[]
          budget: number
          created_at: string | null
          end_date: string | null
          id: string
          investor: string | null
          location: string
          name: string
          start_date: string
          status: string
        }
        Insert: {
          aliases?: string[]
          budget?: number
          created_at?: string | null
          end_date?: string | null
          id?: string
          investor?: string | null
          location: string
          name: string
          start_date: string
          status?: string
        }
        Update: {
          aliases?: string[]
          budget?: number
          created_at?: string | null
          end_date?: string | null
          id?: string
          investor?: string | null
          location?: string
          name?: string
          start_date?: string
          status?: string
        }
        Relationships: []
      }
      repositories: {
        Row: {
          building_id: string
          buyer_name: string | null
          created_at: string | null
          floor: number
          id: string
          number: string
          price: number
          price_per_m2: number | null
          size_m2: number
          status: string
        }
        Insert: {
          building_id: string
          buyer_name?: string | null
          created_at?: string | null
          floor?: number
          id?: string
          number: string
          price?: number
          price_per_m2?: number | null
          size_m2?: number
          status?: string
        }
        Update: {
          building_id?: string
          buyer_name?: string | null
          created_at?: string | null
          floor?: number
          id?: string
          number?: string
          price?: number
          price_per_m2?: number | null
          size_m2?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "repositories_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_contract_milestones: {
        Row: {
          completed_date: string | null
          contract_id: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          milestone_name: string
          milestone_number: number
          notes: string | null
          percentage: number
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_date?: string | null
          contract_id: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_name: string
          milestone_number?: number
          notes?: string | null
          percentage?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_date?: string | null
          contract_id?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_name?: string
          milestone_number?: number
          notes?: string | null
          percentage?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retail_contract_milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "retail_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_contracts: {
        Row: {
          budget_realized: number
          building_surface_m2: number | null
          contract_amount: number
          contract_date: string | null
          contract_number: string
          created_at: string | null
          customer_id: string | null
          end_date: string | null
          has_contract: boolean
          id: string
          land_area_m2: number | null
          notes: string | null
          phase_id: string
          price_per_m2: number | null
          start_date: string | null
          status: string
          supplier_id: string | null
          total_invoices_amount: number
          total_surface_m2: number | null
          updated_at: string | null
        }
        Insert: {
          budget_realized?: number
          building_surface_m2?: number | null
          contract_amount: number
          contract_date?: string | null
          contract_number: string
          created_at?: string | null
          customer_id?: string | null
          end_date?: string | null
          has_contract?: boolean
          id?: string
          land_area_m2?: number | null
          notes?: string | null
          phase_id: string
          price_per_m2?: number | null
          start_date?: string | null
          status?: string
          supplier_id?: string | null
          total_invoices_amount?: number
          total_surface_m2?: number | null
          updated_at?: string | null
        }
        Update: {
          budget_realized?: number
          building_surface_m2?: number | null
          contract_amount?: number
          contract_date?: string | null
          contract_number?: string
          created_at?: string | null
          customer_id?: string | null
          end_date?: string | null
          has_contract?: boolean
          id?: string
          land_area_m2?: number | null
          notes?: string | null
          phase_id?: string
          price_per_m2?: number | null
          start_date?: string | null
          status?: string
          supplier_id?: string | null
          total_invoices_amount?: number
          total_surface_m2?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retail_contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "retail_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_contracts_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "retail_project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "retail_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_customers: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          name: string
          oib: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name: string
          oib?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name?: string
          oib?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      retail_land_plots: {
        Row: {
          created_at: string | null
          id: string
          location: string | null
          notes: string | null
          owner_first_name: string
          owner_last_name: string
          payment_date: string | null
          payment_status: string
          plot_number: string
          price_per_m2: number
          purchased_area_m2: number
          total_area_m2: number
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          owner_first_name: string
          owner_last_name: string
          payment_date?: string | null
          payment_status?: string
          plot_number: string
          price_per_m2: number
          purchased_area_m2: number
          total_area_m2: number
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          owner_first_name?: string
          owner_last_name?: string
          payment_date?: string | null
          payment_status?: string
          plot_number?: string
          price_per_m2?: number
          purchased_area_m2?: number
          total_area_m2?: number
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      retail_project_phases: {
        Row: {
          budget_allocated: number | null
          created_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          phase_name: string
          phase_order: number
          phase_type: string
          project_id: string
          start_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          budget_allocated?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          phase_name: string
          phase_order: number
          phase_type: string
          project_id: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          budget_allocated?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          phase_name?: string
          phase_order?: number
          phase_type?: string
          project_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retail_project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "retail_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_projects: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          land_plot_id: string | null
          location: string
          name: string
          notes: string | null
          plot_number: string
          price_per_m2: number | null
          purchase_price: number
          start_date: string | null
          status: string
          total_area_m2: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          land_plot_id?: string | null
          location: string
          name: string
          notes?: string | null
          plot_number: string
          price_per_m2?: number | null
          purchase_price?: number
          start_date?: string | null
          status?: string
          total_area_m2: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          land_plot_id?: string | null
          location?: string
          name?: string
          notes?: string | null
          plot_number?: string
          price_per_m2?: number | null
          purchase_price?: number
          start_date?: string | null
          status?: string
          total_area_m2?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retail_projects_land_plot_id_fkey"
            columns: ["land_plot_id"]
            isOneToOne: true
            referencedRelation: "retail_land_plots"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_sales: {
        Row: {
          contract_number: string | null
          created_at: string | null
          customer_id: string
          id: string
          land_plot_id: string
          notes: string | null
          paid_amount: number
          payment_deadline: string
          payment_status: string
          phase_id: string | null
          remaining_amount: number | null
          sale_area_m2: number
          sale_price_per_m2: number
          total_sale_price: number | null
          updated_at: string | null
        }
        Insert: {
          contract_number?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          land_plot_id: string
          notes?: string | null
          paid_amount?: number
          payment_deadline: string
          payment_status?: string
          phase_id?: string | null
          remaining_amount?: number | null
          sale_area_m2: number
          sale_price_per_m2: number
          total_sale_price?: number | null
          updated_at?: string | null
        }
        Update: {
          contract_number?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          land_plot_id?: string
          notes?: string | null
          paid_amount?: number
          payment_deadline?: string
          payment_status?: string
          phase_id?: string | null
          remaining_amount?: number | null
          sale_area_m2?: number
          sale_price_per_m2?: number
          total_sale_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retail_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "retail_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_sales_land_plot_id_fkey"
            columns: ["land_plot_id"]
            isOneToOne: false
            referencedRelation: "retail_land_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_sales_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "retail_project_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_supplier_types: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      retail_suppliers: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          oib: string | null
          supplier_type_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          oib?: string | null
          supplier_type_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          oib?: string | null
          supplier_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retail_suppliers_supplier_type_id_fkey"
            columns: ["supplier_type_id"]
            isOneToOne: false
            referencedRelation: "retail_supplier_types"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          apartment_id: string
          contract_signed: boolean
          created_at: string | null
          customer_id: string
          down_payment: number
          id: string
          monthly_payment: number
          next_payment_date: string | null
          notes: string | null
          payment_method: string
          remaining_amount: number
          sale_date: string
          sale_price: number
          total_paid: number
        }
        Insert: {
          apartment_id: string
          contract_signed?: boolean
          created_at?: string | null
          customer_id: string
          down_payment?: number
          id?: string
          monthly_payment?: number
          next_payment_date?: string | null
          notes?: string | null
          payment_method?: string
          remaining_amount?: number
          sale_date?: string
          sale_price?: number
          total_paid?: number
        }
        Update: {
          apartment_id?: string
          contract_signed?: boolean
          created_at?: string | null
          customer_id?: string
          down_payment?: number
          id?: string
          monthly_payment?: number
          next_payment_date?: string | null
          notes?: string | null
          payment_method?: string
          remaining_amount?: number
          sale_date?: string
          sale_price?: number
          total_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_comments: {
        Row: {
          comment: string
          comment_type: string | null
          created_at: string | null
          id: string
          subcontractor_id: string
          user_id: string
        }
        Insert: {
          comment: string
          comment_type?: string | null
          created_at?: string | null
          id?: string
          subcontractor_id: string
          user_id: string
        }
        Update: {
          comment?: string
          comment_type?: string | null
          created_at?: string | null
          id?: string
          subcontractor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_comments_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_milestones: {
        Row: {
          completed_date: string | null
          contract_id: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          milestone_name: string
          milestone_number: number
          paid_date: string | null
          percentage: number
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_date?: string | null
          contract_id: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_name: string
          milestone_number: number
          paid_date?: string | null
          percentage: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_date?: string | null
          contract_id?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_name?: string
          milestone_number?: number
          paid_date?: string | null
          percentage?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          active_contracts_count: number | null
          completed_at: string | null
          contact: string
          created_at: string | null
          financed_by_bank_id: string | null
          financed_by_investor_id: string | null
          financed_by_type: string | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          active_contracts_count?: number | null
          completed_at?: string | null
          contact: string
          created_at?: string | null
          financed_by_bank_id?: string | null
          financed_by_investor_id?: string | null
          financed_by_type?: string | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          active_contracts_count?: number | null
          completed_at?: string | null
          contact?: string
          created_at?: string | null
          financed_by_bank_id?: string | null
          financed_by_investor_id?: string | null
          financed_by_type?: string | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractors_financed_by_bank_id_fkey"
            columns: ["financed_by_bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number
          storage_path: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes: number
          storage_path: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number
          storage_path?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          description: string
          description_format: string
          due_date: string | null
          due_time: string | null
          id: string
          is_private: boolean
          priority: string
          project_id: string | null
          reminder_offsets: number[]
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string
          description_format?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_private?: boolean
          priority?: string
          project_id?: string | null
          reminder_offsets?: number[]
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          description_format?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_private?: boolean
          priority?: string
          project_id?: string | null
          reminder_offsets?: number[]
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tic_cost_structures: {
        Row: {
          created_at: string | null
          created_by: string | null
          document_date: string
          id: string
          investor_name: string
          line_items: Json
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          document_date?: string
          id?: string
          investor_name?: string
          line_items?: Json
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          document_date?: string
          id?: string
          investor_name?: string
          line_items?: Json
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tic_cost_structures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tic_cost_structures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          email: string | null
          id: string
          role: string
          username: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          role: string
          username?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          role?: string
          username?: string | null
        }
        Relationships: []
      }
      work_logs: {
        Row: {
          blocker_details: string | null
          color: string | null
          contract_id: string | null
          created_at: string | null
          created_by: string
          date: string
          id: string
          notes: string | null
          phase_id: string | null
          project_id: string | null
          status: string | null
          subcontractor_id: string
          updated_at: string | null
          work_description: string
        }
        Insert: {
          blocker_details?: string | null
          color?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by: string
          date: string
          id?: string
          notes?: string | null
          phase_id?: string | null
          project_id?: string | null
          status?: string | null
          subcontractor_id: string
          updated_at?: string | null
          work_description: string
        }
        Update: {
          blocker_details?: string | null
          color?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string
          date?: string
          id?: string
          notes?: string | null
          phase_id?: string | null
          project_id?: string | null
          status?: string | null
          subcontractor_id?: string
          updated_at?: string | null
          work_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_statistics: {
        Row: {
          bank_accounts_count: number | null
          created_at: string | null
          credits_count: number | null
          id: string | null
          initial_balance: number | null
          name: string | null
          oib: string | null
          total_bank_balance: number | null
          total_credits_available: number | null
          total_expense_amount: number | null
          total_expense_invoices: number | null
          total_expense_paid: number | null
          total_expense_unpaid: number | null
          total_income_amount: number | null
          total_income_invoices: number | null
          total_income_paid: number | null
          total_income_unpaid: number | null
        }
        Relationships: []
      }
      payment_totals_by_category: {
        Row: {
          invoice_category: string | null
          invoice_count: number | null
          invoice_type: string | null
          project_id: string | null
          total_invoiced: number | null
          total_paid: number | null
          total_remaining: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_subcontractor_budget_integrity: {
        Args: never
        Returns: {
          budget_planned: number
          budget_realized: number
          calculated_realized: number
          contract_id: string
          contract_number: string
          difference: number
        }[]
      }
      fix_subcontractor_budget_integrity: { Args: never; Returns: undefined }
      get_activity_logs: {
        Args: {
          p_action_prefix?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_offset?: number
          p_project_id?: string
          p_search_term?: string
          p_severity?: string
          p_user_id?: string
        }
        Returns: {
          action: string
          created_at: string
          entity: string
          entity_id: string
          id: string
          ip_address: string
          metadata: Json
          project_id: string
          project_name: string
          total_count: number
          user_id: string
          user_role: string
          username: string
        }[]
      }
      get_apartment_payments: {
        Args: { apartment_uuid: string }
        Returns: {
          amount: number
          created_at: string
          description: string
          id: string
          payment_date: string
          payment_method: string
        }[]
      }
      get_busy_blocks: {
        Args: { p_from: string; p_to: string; p_user_ids: string[] }
        Returns: {
          end_at: string
          start_at: string
          user_id: string
        }[]
      }
      get_chat_conversation_summaries: {
        Args: never
        Returns: {
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          last_content: string
          last_created_at: string
          last_file_name: string
          last_file_size: number
          last_file_type: string
          last_file_url: string
          last_message_id: string
          last_sender_id: string
          name: string
          unread_count: number
        }[]
      }
      get_document_category_counts: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_file_name_search?: string
          p_project_id?: string
          p_uploaded_from?: string
          p_uploaded_to?: string
        }
        Returns: {
          category_id: string
          doc_count: number
        }[]
      }
      get_event_creator: { Args: { p_event_id: string }; Returns: string }
      get_filtered_invoices: {
        Args: {
          p_company_id?: string
          p_invoice_type?: string
          p_limit?: number
          p_offset?: number
          p_search_term?: string
          p_status?: string
        }
        Returns: {
          apartment_id: string
          approved: boolean
          bank_credit_id: string
          bank_id: string
          bank_name: string
          base_amount: number
          base_amount_1: number
          base_amount_2: number
          base_amount_3: number
          base_amount_4: number
          category: string
          company_bank_account_id: string
          company_id: string
          company_name: string
          contract_id: string
          contract_job_description: string
          contract_number: string
          created_at: string
          customer_id: string
          customer_name: string
          customer_surname: string
          description: string
          due_date: string
          iban: string
          id: string
          investor_id: string
          investor_name: string
          invoice_category: string
          invoice_number: string
          invoice_type: string
          issue_date: string
          milestone_id: string
          office_supplier_id: string
          office_supplier_name: string
          paid_amount: number
          project_id: string
          project_name: string
          reference_number: string
          refund_id: number
          refund_name: string
          remaining_amount: number
          retail_contract_id: string
          retail_contract_number: string
          retail_customer_id: string
          retail_customer_name: string
          retail_milestone_id: string
          retail_project_id: string
          retail_project_name: string
          retail_supplier_id: string
          retail_supplier_name: string
          status: string
          supplier_id: string
          supplier_name: string
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_amount_1: number
          vat_amount_2: number
          vat_amount_3: number
          vat_amount_4: number
          vat_rate: number
          vat_rate_1: number
          vat_rate_2: number
          vat_rate_3: number
          vat_rate_4: number
        }[]
      }
      get_invoice_statistics: {
        Args: {
          p_company_id?: string
          p_invoice_type?: string
          p_search_term?: string
          p_status?: string
        }
        Returns: {
          filtered_count: number
          filtered_unpaid_sum: number
          total_unpaid_sum: number
        }[]
      }
      get_subcontractor_payments:
        | {
            Args: { p_project_id: string; p_subcontractor_id: string }
            Returns: {
              amount: number
              description: string
              id: string
              payment_date: string
            }[]
          }
        | {
            Args: { subcontractor_uuid: string }
            Returns: {
              invoice_description: string
              payment_amount: number
              payment_date: string
              payment_id: string
            }[]
          }
      get_task_creator: { Args: { p_task_id: string }; Returns: string }
      is_chat_participant: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_event_participant: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_task_assignee: {
        Args: { p_task_id: string; p_user_id: string }
        Returns: boolean
      }
      recalculate_bank_credit_fields: {
        Args: { p_credit_id: string }
        Returns: undefined
      }
      replace_document_associations: {
        Args: { p_associations: Json; p_document_id: string }
        Returns: undefined
      }
      search_documents: {
        Args: {
          p_category_ids?: string[]
          p_entity_id?: string
          p_entity_type?: string
          p_file_name_search?: string
          p_limit?: number
          p_offset?: number
          p_project_id?: string
          p_uploaded_from?: string
          p_uploaded_to?: string
        }
        Returns: {
          document: Json
          total_count: number
        }[]
      }
      update_overdue_notifications: { Args: never; Returns: undefined }
      user_has_project_access:
        | { Args: { p_project_id: string }; Returns: boolean }
        | { Args: { proj_id: string; user_uuid: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
