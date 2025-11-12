// =====================================================
// match_deposit Edge Function
// Admin function to match bank deposits and credit user balances
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema
const MatchDepositSchema = z.object({
  bank_deposit_id: z.string().uuid(),
  action: z.enum(['MATCH', 'REJECT']),
  notes: z.string().optional(),
})

interface MatchDepositInput {
  bank_deposit_id: string
  action: 'MATCH' | 'REJECT'
  notes?: string
}

interface BankDepositData {
  id: string
  user_id: string
  bank_ref: string
  amount_mur: string
  status: string
  received_date: string
}

interface BalanceData {
  user_id: string
  available: string
  locked: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify admin status
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Check if user has admin claim in JWT
    const isAdmin = user.app_metadata?.is_admin === true

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate input
    const body = await req.json()
    const input = MatchDepositSchema.parse(body) as MatchDepositInput

    // Fetch deposit details
    const { data: deposit, error: depositError } = await supabaseClient
      .from('bank_deposits')
      .select('*')
      .eq('id', input.bank_deposit_id)
      .single() as { data: BankDepositData | null, error: any }

    if (depositError || !deposit) {
      return new Response(
        JSON.stringify({ error: 'Bank deposit not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check deposit status
    if (deposit.status !== 'PENDING') {
      return new Response(
        JSON.stringify({
          error: `Cannot process deposit with status: ${deposit.status}`,
          current_status: deposit.status,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const amount = parseFloat(deposit.amount_mur)

    if (input.action === 'REJECT') {
      // Reject deposit
      const { error: updateError } = await supabaseClient
        .from('bank_deposits')
        .update({
          status: 'REJECTED',
          matched_by: user.id,
          matched_at: new Date().toISOString(),
        })
        .eq('id', deposit.id)

      if (updateError) {
        throw new Error(`Failed to reject deposit: ${updateError.message}`)
      }

      // Create audit log
      await supabaseClient
        .from('audit_log')
        .insert({
          actor_user_id: user.id,
          action: 'reject_deposit',
          target_table: 'bank_deposits',
          target_id: deposit.id,
          details: {
            deposit_id: deposit.id,
            user_id: deposit.user_id,
            amount: amount,
            notes: input.notes,
          },
        })

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Deposit rejected successfully',
          deposit_id: deposit.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // MATCH action - credit user balance

    // Check if user has a balance record, create if not exists
    const { data: existingBalance } = await supabaseClient
      .from('fiat_balances')
      .select('*')
      .eq('user_id', deposit.user_id)
      .single() as { data: BalanceData | null, error: any }

    if (!existingBalance) {
      // Create balance record
      const { error: createBalanceError } = await supabaseClient
        .from('fiat_balances')
        .insert({
          user_id: deposit.user_id,
          available: '0',
          locked: '0',
        })

      if (createBalanceError) {
        throw new Error(`Failed to create balance record: ${createBalanceError.message}`)
      }
    }

    // Fetch current balance
    const { data: balance, error: balanceError } = await supabaseClient
      .from('fiat_balances')
      .select('*')
      .eq('user_id', deposit.user_id)
      .single() as { data: BalanceData | null, error: any }

    if (balanceError || !balance) {
      throw new Error('Failed to fetch balance after creation')
    }

    const currentAvailable = parseFloat(balance.available)
    const newAvailable = currentAvailable + amount

    // Update balance
    const { error: updateBalanceError } = await supabaseClient
      .from('fiat_balances')
      .update({ available: newAvailable.toFixed(2) })
      .eq('user_id', deposit.user_id)

    if (updateBalanceError) {
      throw new Error(`Failed to update balance: ${updateBalanceError.message}`)
    }

    // Create ledger entry
    const { error: ledgerError } = await supabaseClient
      .from('fiat_ledger')
      .insert({
        user_id: deposit.user_id,
        direction: 'CREDIT',
        amount_mur: amount.toFixed(2),
        reason: `Bank deposit matched - Ref: ${deposit.bank_ref}`,
        ref_table: 'bank_deposits',
        ref_id: deposit.id,
      })

    if (ledgerError) {
      throw new Error(`Failed to create ledger entry: ${ledgerError.message}`)
    }

    // Update deposit status
    const { error: updateDepositError } = await supabaseClient
      .from('bank_deposits')
      .update({
        status: 'MATCHED',
        matched_by: user.id,
        matched_at: new Date().toISOString(),
      })
      .eq('id', deposit.id)

    if (updateDepositError) {
      throw new Error(`Failed to update deposit: ${updateDepositError.message}`)
    }

    // Create audit log
    await supabaseClient
      .from('audit_log')
      .insert({
        actor_user_id: user.id,
        action: 'match_deposit',
        target_table: 'bank_deposits',
        target_id: deposit.id,
        details: {
          deposit_id: deposit.id,
          user_id: deposit.user_id,
          amount: amount,
          previous_balance: currentAvailable,
          new_balance: newAvailable,
          notes: input.notes,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Deposit matched successfully',
        deposit_id: deposit.id,
        amount_credited: amount,
        new_balance: newAvailable,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in match_deposit:', error)

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
