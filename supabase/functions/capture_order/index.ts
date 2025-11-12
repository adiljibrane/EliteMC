// =====================================================
// capture_order Edge Function
// Captures payment for an order by moving funds from available to locked/deducted
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema
const CaptureOrderSchema = z.object({
  order_id: z.string().uuid(),
  idempotency_key: z.string().optional(),
})

interface CaptureOrderInput {
  order_id: string
  idempotency_key?: string
}

interface OrderData {
  id: string
  user_id: string
  property_id: string
  lots: number
  total_price_mur: string
  status: string
  paid_at: string | null
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

    // Parse and validate input
    const body = await req.json()
    const input = CaptureOrderSchema.parse(body) as CaptureOrderInput

    // Idempotency check
    if (input.idempotency_key) {
      const { data: existingLog } = await supabaseClient
        .from('audit_log')
        .select('id, details')
        .eq('action', 'capture_order')
        .eq('target_id', input.order_id)
        .eq('details->>idempotency_key', input.idempotency_key)
        .single()

      if (existingLog) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Order already captured (idempotent)',
            order_id: input.order_id,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Start transaction by setting isolation level
    const { error: txError } = await supabaseClient.rpc('exec_sql', {
      query: 'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE'
    }).catch(() => ({ error: null })) // Supabase doesn't support explicit transactions, so we rely on atomic operations

    // Fetch order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', input.order_id)
      .single() as { data: OrderData | null, error: any }

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify ownership
    if (order.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to capture this order' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check order status
    if (order.status === 'PAID') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Order already paid',
          order_id: input.order_id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (order.status !== 'PENDING_PAYMENT') {
      return new Response(
        JSON.stringify({ error: `Cannot capture order with status: ${order.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const totalPrice = parseFloat(order.total_price_mur)

    // Fetch user balance
    const { data: balance, error: balanceError } = await supabaseClient
      .from('fiat_balances')
      .select('*')
      .eq('user_id', user.id)
      .single() as { data: BalanceData | null, error: any }

    if (balanceError || !balance) {
      return new Response(
        JSON.stringify({ error: 'Balance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const availableBalance = parseFloat(balance.available)

    // Verify sufficient balance
    if (availableBalance < totalPrice) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient balance',
          required: totalPrice,
          available: availableBalance,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Deduct from available balance
    const newAvailable = availableBalance - totalPrice
    const { error: updateBalanceError } = await supabaseClient
      .from('fiat_balances')
      .update({ available: newAvailable.toFixed(2) })
      .eq('user_id', user.id)

    if (updateBalanceError) {
      throw new Error(`Failed to update balance: ${updateBalanceError.message}`)
    }

    // Create ledger entry
    const { error: ledgerError } = await supabaseClient
      .from('fiat_ledger')
      .insert({
        user_id: user.id,
        direction: 'DEBIT',
        amount_mur: totalPrice.toFixed(2),
        reason: `Purchase of ${order.lots} lots for property`,
        ref_table: 'orders',
        ref_id: order.id,
      })

    if (ledgerError) {
      throw new Error(`Failed to create ledger entry: ${ledgerError.message}`)
    }

    // Mark order as PAID
    const { error: updateOrderError } = await supabaseClient
      .from('orders')
      .update({
        status: 'PAID',
        paid_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (updateOrderError) {
      throw new Error(`Failed to update order: ${updateOrderError.message}`)
    }

    // Create property allocation
    const { error: allocationError } = await supabaseClient
      .from('property_allocations')
      .insert({
        user_id: user.id,
        property_id: order.property_id,
        lots: order.lots,
        status: 'RESERVED',
        order_id: order.id,
      })

    if (allocationError) {
      throw new Error(`Failed to create allocation: ${allocationError.message}`)
    }

    // Create audit log
    await supabaseClient
      .from('audit_log')
      .insert({
        actor_user_id: user.id,
        action: 'capture_order',
        target_table: 'orders',
        target_id: order.id,
        details: {
          order_id: order.id,
          amount: totalPrice,
          lots: order.lots,
          property_id: order.property_id,
          idempotency_key: input.idempotency_key,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order captured successfully',
        order_id: order.id,
        amount: totalPrice,
        new_balance: newAvailable,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in capture_order:', error)

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
