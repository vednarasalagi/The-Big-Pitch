// ============================================================
// Supabase Edge Function: create-payment-order
// POST /functions/v1/create-payment-order
//
// Server-side Razorpay order creation:
// 1. Validates auth and spending cap
// 2. Creates Razorpay order via API
// 3. Records pending payment_order in DB
// 4. Returns order ID + Razorpay key to frontend
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { rupeeAmount, eventId } = await req.json()
    if (!rupeeAmount || !eventId || rupeeAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch event config
    const { data: config } = await supabaseAdmin
      .from('event_config')
      .select('max_paid_purchase_rupees, points_per_rupee')
      .eq('event_id', eventId)
      .single()

    if (!config) {
      return new Response(JSON.stringify({ error: 'Event config not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check spending cap
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('total_paid_rupees')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .single()

    const alreadySpent = wallet?.total_paid_rupees ?? 0
    const remaining = config.max_paid_purchase_rupees - alreadySpent

    if (rupeeAmount > remaining) {
      return new Response(JSON.stringify({
        error: `Purchase exceeds spending cap. Remaining allowance: ₹${remaining}`
      }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const RAZORPAY_KEY_ID     = Deno.env.get('RAZORPAY_KEY_ID')!
    const RAZORPAY_SECRET_KEY = Deno.env.get('RAZORPAY_SECRET_KEY')!

    if (!RAZORPAY_KEY_ID || !RAZORPAY_SECRET_KEY) {
      // Mock mode for development
      const mockOrderId = `order_mock_${Date.now()}`
      const pointsToCredit = rupeeAmount * config.points_per_rupee

      await supabaseAdmin.from('payment_orders').insert({
        user_id:           user.id,
        event_id:          eventId,
        razorpay_order_id: mockOrderId,
        rupee_amount:      rupeeAmount,
        points_to_credit:  pointsToCredit,
        status:            'created',
      })

      return new Response(JSON.stringify({
        orderId:        mockOrderId,
        rupeeAmount,
        pointsToCredit,
        keyId:          'rzp_test_mock',
        isMock:         true,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create real Razorpay order
    const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_SECRET_KEY}`)
    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount:   rupeeAmount * 100,  // paise
        currency: 'INR',
        receipt:  `pitch_arena_${user.id.slice(0, 8)}_${Date.now()}`,
      }),
    })

    if (!rzpResponse.ok) {
      const err = await rzpResponse.json()
      console.error('Razorpay error:', err)
      return new Response(JSON.stringify({ error: 'Payment gateway error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rzpOrder = await rzpResponse.json()
    const pointsToCredit = rupeeAmount * config.points_per_rupee

    // Record pending payment order in DB
    await supabaseAdmin.from('payment_orders').insert({
      user_id:           user.id,
      event_id:          eventId,
      razorpay_order_id: rzpOrder.id,
      rupee_amount:      rupeeAmount,
      points_to_credit:  pointsToCredit,
      status:            'created',
    })

    return new Response(JSON.stringify({
      orderId:        rzpOrder.id,
      rupeeAmount,
      pointsToCredit,
      keyId:          RAZORPAY_KEY_ID,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unhandled error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
