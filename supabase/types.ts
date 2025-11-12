// =====================================================
// Supabase Database Types
// =====================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          full_name: string
          email: string
          phone: string | null
          kyc_status: 'PENDING' | 'APPROVED' | 'REJECTED'
          wallet_ss58: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          full_name: string
          email: string
          phone?: string | null
          kyc_status?: 'PENDING' | 'APPROVED' | 'REJECTED'
          wallet_ss58?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          full_name?: string
          email?: string
          phone?: string | null
          kyc_status?: 'PENDING' | 'APPROVED' | 'REJECTED'
          wallet_ss58?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bank_deposits: {
        Row: {
          id: string
          user_id: string
          bank_ref: string
          amount_mur: string
          received_date: string
          proof_url: string | null
          status: 'PENDING' | 'MATCHED' | 'REJECTED'
          matched_by: string | null
          matched_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bank_ref: string
          amount_mur: string
          received_date: string
          proof_url?: string | null
          status?: 'PENDING' | 'MATCHED' | 'REJECTED'
          matched_by?: string | null
          matched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bank_ref?: string
          amount_mur?: string
          received_date?: string
          proof_url?: string | null
          status?: 'PENDING' | 'MATCHED' | 'REJECTED'
          matched_by?: string | null
          matched_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      fiat_balances: {
        Row: {
          user_id: string
          available: string
          locked: string
          updated_at: string
        }
        Insert: {
          user_id: string
          available?: string
          locked?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          available?: string
          locked?: string
          updated_at?: string
        }
      }
      fiat_ledger: {
        Row: {
          id: string
          user_id: string
          direction: 'CREDIT' | 'DEBIT'
          amount_mur: string
          reason: string
          ref_table: string | null
          ref_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          direction: 'CREDIT' | 'DEBIT'
          amount_mur: string
          reason: string
          ref_table?: string | null
          ref_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          direction?: 'CREDIT' | 'DEBIT'
          amount_mur?: string
          reason?: string
          ref_table?: string | null
          ref_id?: string | null
          created_at?: string
        }
      }
      properties: {
        Row: {
          id: string
          title: string
          location: string
          description: string | null
          images: Json
          price_per_lot: string
          total_lots: number
          min_lot_purchase: number
          target_raise_mur: string
          status: 'DRAFT' | 'OPEN' | 'READY_TO_MINT' | 'MINTED' | 'CLOSED'
          asset_hub_asset_id: number | null
          decimals: number | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          location: string
          description?: string | null
          images?: Json
          price_per_lot: string
          total_lots: number
          min_lot_purchase?: number
          status?: 'DRAFT' | 'OPEN' | 'READY_TO_MINT' | 'MINTED' | 'CLOSED'
          asset_hub_asset_id?: number | null
          decimals?: number | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          location?: string
          description?: string | null
          images?: Json
          price_per_lot?: string
          total_lots?: number
          min_lot_purchase?: number
          status?: 'DRAFT' | 'OPEN' | 'READY_TO_MINT' | 'MINTED' | 'CLOSED'
          asset_hub_asset_id?: number | null
          decimals?: number | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          user_id: string
          property_id: string
          lots: number
          unit_price_mur: string
          total_price_mur: string
          status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'FAILED'
          created_at: string
          paid_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          lots: number
          unit_price_mur: string
          status?: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'FAILED'
          created_at?: string
          paid_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          lots?: number
          unit_price_mur?: string
          status?: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'FAILED'
          created_at?: string
          paid_at?: string | null
        }
      }
      property_allocations: {
        Row: {
          id: string
          user_id: string
          property_id: string
          lots: number
          status: 'RESERVED' | 'SETTLED_OFFCHAIN' | 'ONCHAIN_SETTLED' | 'REVOKED'
          order_id: string | null
          created_at: string
          onchain_tx_hash: string | null
          onchain_block: number | null
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          lots: number
          status?: 'RESERVED' | 'SETTLED_OFFCHAIN' | 'ONCHAIN_SETTLED' | 'REVOKED'
          order_id?: string | null
          created_at?: string
          onchain_tx_hash?: string | null
          onchain_block?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          lots?: number
          status?: 'RESERVED' | 'SETTLED_OFFCHAIN' | 'ONCHAIN_SETTLED' | 'REVOKED'
          order_id?: string | null
          created_at?: string
          onchain_tx_hash?: string | null
          onchain_block?: number | null
        }
      }
      token_mint_batches: {
        Row: {
          id: string
          property_id: string
          asset_id: number
          total_minted: number
          signer_wallet: string
          extrinsic_hash: string | null
          status: 'PLANNED' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED'
          created_at: string
          confirmed_at: string | null
        }
      }
      token_transfers: {
        Row: {
          id: string
          property_id: string
          user_id: string
          asset_id: number
          amount: number
          extrinsic_hash: string | null
          confirmed: boolean
          created_at: string
          confirmed_at: string | null
        }
      }
      dividend_statements: {
        Row: {
          id: string
          property_id: string
          period_start: string
          period_end: string
          gross_income_mur: string
          expenses_mur: string
          distributable_mur: string
          created_at: string
          created_by: string
        }
      }
      dividend_payouts: {
        Row: {
          id: string
          statement_id: string
          user_id: string
          amount_mur: string
          payout_method: 'BANK_TRANSFER' | 'INTERNAL_CREDIT'
          payout_ref: string | null
          created_at: string
        }
      }
      audit_log: {
        Row: {
          id: string
          actor_user_id: string | null
          action: string
          target_table: string | null
          target_id: string | null
          details: Json | null
          created_at: string
        }
      }
    }
    Views: {
      property_summary: {
        Row: {
          id: string
          title: string
          location: string
          price_per_lot: string
          total_lots: number
          target_raise_mur: string
          status: string
          lots_sold: number
          amount_raised: string
          created_at: string
          updated_at: string
        }
      }
      user_portfolios: {
        Row: {
          user_id: string
          property_id: string
          property_title: string
          property_location: string
          total_lots: number
          price_per_lot: string
          total_invested: string
          allocation_status: string
          property_status: string
        }
      }
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      kyc_status_enum: 'PENDING' | 'APPROVED' | 'REJECTED'
      deposit_status_enum: 'PENDING' | 'MATCHED' | 'REJECTED'
      ledger_direction_enum: 'CREDIT' | 'DEBIT'
      property_status_enum: 'DRAFT' | 'OPEN' | 'READY_TO_MINT' | 'MINTED' | 'CLOSED'
      order_status_enum: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'FAILED'
      allocation_status_enum: 'RESERVED' | 'SETTLED_OFFCHAIN' | 'ONCHAIN_SETTLED' | 'REVOKED'
      mint_batch_status_enum: 'PLANNED' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED'
      payout_method_enum: 'BANK_TRANSFER' | 'INTERNAL_CREDIT'
    }
  }
}
