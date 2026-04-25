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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          id: string
          ifsc: string
          status: Database["public"]["Enums"]["account_status"]
          user_id: string
        }
        Insert: {
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          created_at?: string
          id?: string
          ifsc?: string
          status?: Database["public"]["Enums"]["account_status"]
          user_id: string
        }
        Update: {
          account_number?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          id?: string
          ifsc?: string
          status?: Database["public"]["Enums"]["account_status"]
          user_id?: string
        }
        Relationships: []
      }
      autopay_configs: {
        Row: {
          amount_paise: number
          consecutive_failures: number
          created_at: string
          frequency: Database["public"]["Enums"]["autopay_freq"]
          from_account_id: string
          id: string
          last_run_at: string | null
          last_status: Database["public"]["Enums"]["txn_status"] | null
          next_run_at: string
          nickname: string
          status: Database["public"]["Enums"]["autopay_status"]
          to_account_number: string
          to_ifsc: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          consecutive_failures?: number
          created_at?: string
          frequency: Database["public"]["Enums"]["autopay_freq"]
          from_account_id: string
          id?: string
          last_run_at?: string | null
          last_status?: Database["public"]["Enums"]["txn_status"] | null
          next_run_at: string
          nickname: string
          status?: Database["public"]["Enums"]["autopay_status"]
          to_account_number: string
          to_ifsc: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          consecutive_failures?: number
          created_at?: string
          frequency?: Database["public"]["Enums"]["autopay_freq"]
          from_account_id?: string
          id?: string
          last_run_at?: string | null
          last_status?: Database["public"]["Enums"]["txn_status"] | null
          next_run_at?: string
          nickname?: string
          status?: Database["public"]["Enums"]["autopay_status"]
          to_account_number?: string
          to_ifsc?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopay_configs_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          account_number: string
          created_at: string
          holder_name: string
          id: string
          ifsc: string
          nickname: string
          user_id: string
        }
        Insert: {
          account_number: string
          created_at?: string
          holder_name: string
          id?: string
          ifsc: string
          nickname: string
          user_id: string
        }
        Update: {
          account_number?: string
          created_at?: string
          holder_name?: string
          id?: string
          ifsc?: string
          nickname?: string
          user_id?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          account_id: string
          blocked_at: string | null
          card_number_last4: string
          card_number_masked: string
          cardholder_name: string
          created_at: string
          expiry_month: number
          expiry_year: number
          failed_pin_attempts: number
          id: string
          pin_hash: string | null
          status: Database["public"]["Enums"]["card_status"]
          user_id: string
        }
        Insert: {
          account_id: string
          blocked_at?: string | null
          card_number_last4: string
          card_number_masked: string
          cardholder_name: string
          created_at?: string
          expiry_month: number
          expiry_year: number
          failed_pin_attempts?: number
          id?: string
          pin_hash?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          user_id: string
        }
        Update: {
          account_id?: string
          blocked_at?: string | null
          card_number_last4?: string
          card_number_masked?: string
          cardholder_name?: string
          created_at?: string
          expiry_month?: number
          expiry_year?: number
          failed_pin_attempts?: number
          id?: string
          pin_hash?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          amount_paise: number
          created_at: string
          direction: Database["public"]["Enums"]["entry_direction"]
          id: string
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount_paise: number
          created_at?: string
          direction: Database["public"]["Enums"]["entry_direction"]
          id?: string
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount_paise?: number
          created_at?: string
          direction?: Database["public"]["Enums"]["entry_direction"]
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_paise: number
          completed_at: string | null
          created_at: string
          description: string | null
          failure_reason: string | null
          from_account_id: string | null
          id: string
          idempotency_key: string | null
          initiated_by: string | null
          kind: Database["public"]["Enums"]["txn_kind"]
          status: Database["public"]["Enums"]["txn_status"]
          to_account_id: string | null
        }
        Insert: {
          amount_paise: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          failure_reason?: string | null
          from_account_id?: string | null
          id?: string
          idempotency_key?: string | null
          initiated_by?: string | null
          kind?: Database["public"]["Enums"]["txn_kind"]
          status?: Database["public"]["Enums"]["txn_status"]
          to_account_id?: string | null
        }
        Update: {
          amount_paise?: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          failure_reason?: string | null
          from_account_id?: string | null
          id?: string
          idempotency_key?: string | null
          initiated_by?: string | null
          kind?: Database["public"]["Enums"]["txn_kind"]
          status?: Database["public"]["Enums"]["txn_status"]
          to_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _system_account: { Args: { p_kind: string }; Returns: string }
      account_balance_paise: { Args: { p_account: string }; Returns: number }
      execute_transfer: {
        Args: {
          p_amount_paise: number
          p_description: string
          p_from_account: string
          p_idempotency_key: string
          p_kind?: Database["public"]["Enums"]["txn_kind"]
          p_to_account_number: string
          p_to_ifsc: string
        }
        Returns: Json
      }
      run_due_autopays: { Args: never; Returns: number }
      set_card_pin: { Args: { p_card: string; p_pin: string }; Returns: Json }
      unblock_card: {
        Args: { p_card: string; p_new_pin: string; p_otp: string }
        Returns: Json
      }
      verify_card_pin: {
        Args: { p_card: string; p_pin: string }
        Returns: Json
      }
    }
    Enums: {
      account_status: "active" | "frozen" | "closed"
      account_type: "savings" | "current"
      autopay_freq: "daily" | "weekly" | "monthly"
      autopay_status: "active" | "paused" | "disabled"
      card_status: "active" | "blocked"
      entry_direction: "debit" | "credit"
      txn_kind:
        | "transfer"
        | "autopay"
        | "reversal"
        | "system"
        | "loan_disbursement"
        | "loan_repayment"
        | "fd_lock"
        | "fd_payout"
      txn_status: "pending" | "success" | "failed"
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
    Enums: {
      account_status: ["active", "frozen", "closed"],
      account_type: ["savings", "current"],
      autopay_freq: ["daily", "weekly", "monthly"],
      autopay_status: ["active", "paused", "disabled"],
      card_status: ["active", "blocked"],
      entry_direction: ["debit", "credit"],
      txn_kind: [
        "transfer",
        "autopay",
        "reversal",
        "system",
        "loan_disbursement",
        "loan_repayment",
        "fd_lock",
        "fd_payout",
      ],
      txn_status: ["pending", "success", "failed"],
    },
  },
} as const
