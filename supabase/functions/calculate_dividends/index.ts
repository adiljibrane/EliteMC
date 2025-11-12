// =====================================================
// calculate_dividends Edge Function
// Admin function to calculate and distribute dividends pro-rata
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema
const CalculateDividendsSchema = z.object({
  property_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gross_income_mur: z.number().positive(),
  expenses_mur: z.number().min(0).default(0),
  payout_method: z.enum(['BANK_TRANSFER', 'INTERNAL_CREDIT']).default('INTERNAL_CREDIT'),
})

interface CalculateDividendsInput {
  property_id: string
  period_start: string
  period_end: string
  gross_income_mur: number
  expenses_mur: number
  payout_method: 'BANK_TRANSFER' | 'INTERNAL_CREDIT'
}

interface PropertyData {
  id: string
  title: string
  total_lots: number
}

interface AllocationData {
  user_id: string
  lots: number
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
    const isAdmin = user.app_metadata?.is_admin === true

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate input
    const body = await req.json()
    const input = CalculateDividendsSchema.parse(body) as CalculateDividendsInput

    // Fetch property details
    const { data: property, error: propertyError } = await supabaseClient
      .from('properties')
      .select('id, title, total_lots')
      .eq('id', input.property_id)
      .single() as { data: PropertyData | null, error: any }

    if (propertyError || !property) {
      return new Response(
        JSON.stringify({ error: 'Property not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate distributable amount
    const distributable = input.gross_income_mur - input.expenses_mur

    if (distributable <= 0) {
      return new Response(
        JSON.stringify({ error: 'No distributable income (expenses >= income)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create dividend statement
    const { data: statement, error: statementError } = await supabaseClient
      .from('dividend_statements')
      .insert({
        property_id: input.property_id,
        period_start: input.period_start,
        period_end: input.period_end,
        gross_income_mur: input.gross_income_mur.toFixed(2),
        expenses_mur: input.expenses_mur.toFixed(2),
        created_by: user.id,
      })
      .select()
      .single()

    if (statementError || !statement) {
      throw new Error(`Failed to create dividend statement: ${statementError?.message}`)
    }

    // Fetch eligible allocations (SETTLED_OFFCHAIN or ONCHAIN_SETTLED)
    const { data: allocations, error: allocationsError } = await supabaseClient
      .from('property_allocations')
      .select('user_id, lots')
      .eq('property_id', input.property_id)
      .in('status', ['SETTLED_OFFCHAIN', 'ONCHAIN_SETTLED']) as { data: AllocationData[] | null, error: any }

    if (allocationsError) {
      throw new Error(`Failed to fetch allocations: ${allocationsError.message}`)
    }

    if (!allocations || allocations.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No eligible allocations found for dividend distribution',
          hint: 'Allocations must be in SETTLED_OFFCHAIN or ONCHAIN_SETTLED status',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Aggregate lots per user (in case a user has multiple allocations)
    const userLotsMap = new Map<string, number>()
    let totalEligibleLots = 0

    for (const allocation of allocations) {
      const currentLots = userLotsMap.get(allocation.user_id) || 0
      userLotsMap.set(allocation.user_id, currentLots + allocation.lots)
      totalEligibleLots += allocation.lots
    }

    if (totalEligibleLots === 0) {
      throw new Error('Total eligible lots is zero')
    }

    // Calculate and create payouts
    const payouts = []
    const payoutRecords = []

    for (const [userId, lots] of userLotsMap.entries()) {
      const percentage = lots / totalEligibleLots
      const payoutAmount = distributable * percentage

      // Round to 2 decimal places
      const roundedAmount = Math.round(payoutAmount * 100) / 100

      if (roundedAmount > 0) {
        payouts.push({
          user_id: userId,
          lots,
          percentage: (percentage * 100).toFixed(2) + '%',
          amount: roundedAmount,
        })

        payoutRecords.push({
          statement_id: statement.id,
          user_id: userId,
          amount_mur: roundedAmount.toFixed(2),
          payout_method: input.payout_method,
          payout_ref: null, // Will be updated later for bank transfers
        })
      }
    }

    // Insert all payouts
    const { data: insertedPayouts, error: payoutsError } = await supabaseClient
      .from('dividend_payouts')
      .insert(payoutRecords)
      .select()

    if (payoutsError) {
      throw new Error(`Failed to create payouts: ${payoutsError.message}`)
    }

    // If INTERNAL_CREDIT, credit user balances
    if (input.payout_method === 'INTERNAL_CREDIT') {
      for (const payout of payouts) {
        // Ensure balance record exists
        const { data: existingBalance } = await supabaseClient
          .from('fiat_balances')
          .select('*')
          .eq('user_id', payout.user_id)
          .single() as { data: BalanceData | null, error: any }

        if (!existingBalance) {
          await supabaseClient
            .from('fiat_balances')
            .insert({
              user_id: payout.user_id,
              available: '0',
              locked: '0',
            })
        }

        // Fetch current balance
        const { data: balance, error: balanceError } = await supabaseClient
          .from('fiat_balances')
          .select('*')
          .eq('user_id', payout.user_id)
          .single() as { data: BalanceData | null, error: any }

        if (balanceError || !balance) {
          console.error(`Failed to fetch balance for user ${payout.user_id}`)
          continue
        }

        const currentAvailable = parseFloat(balance.available)
        const newAvailable = currentAvailable + payout.amount

        // Update balance
        const { error: updateBalanceError } = await supabaseClient
          .from('fiat_balances')
          .update({ available: newAvailable.toFixed(2) })
          .eq('user_id', payout.user_id)

        if (updateBalanceError) {
          console.error(`Failed to update balance for user ${payout.user_id}:`, updateBalanceError)
          continue
        }

        // Create ledger entry
        const ledgerEntry = await supabaseClient
          .from('fiat_ledger')
          .insert({
            user_id: payout.user_id,
            direction: 'CREDIT',
            amount_mur: payout.amount.toFixed(2),
            reason: `Dividend payout for ${property.title} (${input.period_start} to ${input.period_end})`,
            ref_table: 'dividend_payouts',
            ref_id: insertedPayouts?.find((p: any) => p.user_id === payout.user_id)?.id,
          })

        if (ledgerEntry.error) {
          console.error(`Failed to create ledger entry for user ${payout.user_id}:`, ledgerEntry.error)
        }
      }
    }

    // Create audit log
    await supabaseClient
      .from('audit_log')
      .insert({
        actor_user_id: user.id,
        action: 'calculate_dividends',
        target_table: 'dividend_statements',
        target_id: statement.id,
        details: {
          property_id: input.property_id,
          property_title: property.title,
          period_start: input.period_start,
          period_end: input.period_end,
          gross_income: input.gross_income_mur,
          expenses: input.expenses_mur,
          distributable: distributable,
          payout_method: input.payout_method,
          total_eligible_lots: totalEligibleLots,
          payouts_count: payouts.length,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dividends calculated and distributed successfully',
        statement_id: statement.id,
        property_title: property.title,
        distributable_amount: distributable,
        total_eligible_lots: totalEligibleLots,
        payouts_count: payouts.length,
        payout_method: input.payout_method,
        payouts: payouts,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in calculate_dividends:', error)

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
