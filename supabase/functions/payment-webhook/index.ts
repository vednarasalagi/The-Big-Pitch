// ============================================================
// Supabase Edge Function: payment-webhook
// POST /functions/v1/payment-webhook
//
// Razorpay webhook handler — idempotent point crediting:
// 1. Verify webhook signature (HMAC-SHA256)
// 2. Find existing payment_order by razorpay_order_id
// 3. Credit points EXACTLY ONCE (idempotency via status check)
// 4. Update wallet ledger and wallet balance
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-razorpay-signature, content-type',
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

    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    const signature     = req.headers.get('x-razorpay-signature')
    const body          = await req.text()

    // 1. Verify webhook signature
    if (webhookSecret && signature) {
      const expectedSig = hmac('sha256', webhookSecret, body, 'utf8', 'hex')
      if (expectedSig !== signature) {
        console.warn('Invalid webhook signature')
        return new Response('Invalid signature', { status: 400 })
      }
    } else if (!Deno.env.get('RAZORPAY_KEY_ID')?.startsWith('rzp_test_mock')) {
      // In production, always require signature
      console.warn('Missing webhook signature in production')
      return new Response('Forbidden', { status: 403 })
    }

    const event = JSON.parse(body)
    const eventType = event.event

    if (eventType !== 'payment.captured') {
      // Acknowledge but ignore other event types
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    const payment   = event.payload?.payment?.entity
    const orderId   = payment?.order_id
    const paymentId = payment?.id

    if (!orderId || !paymentId) {
      return new Response('Missing order/payment ID', { status: 400 })
    }

    // 2. Find payment order (idempotency: skip if already successful)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('payment_orders')
      .select('*')
      .eq('razorpay_order_id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Payment order not found:', orderId)
      return new Response('Order not found', { status: 404 })
    }

    // IDEMPOTENCY CHECK — do not re-credit
    if (order.status === 'success') {
      console.log('Duplicate webhook — order already processed:', orderId)
      return new Response(JSON.stringify({ received: true, skipped: 'already_processed' }), { status: 200 })
    }

    // 3. Mark order as success
    const { error: updateError } = await supabaseAdmin
      .from('payment_orders')
      .update({
        status:              'success',
        razorpay_payment_id: paymentId,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'created')  // Optimistic concurrency — only update if still 'created'

    if (updateError) {
      console.error('Failed to update order status:', updateError)
      return new Response('Update failed', { status: 500 })
    }

    // 4. Credit points to wallet atomically
    const { error: creditError } = await supabaseAdmin
      .rpc('credit_purchased_points', {
        p_user_id:        order.user_id,
        p_event_id:       order.event_id,
        p_points:         order.points_to_credit,
        p_rupees:         order.rupee_amount,
        p_payment_order_id: order.id,
      })

    if (creditError) {
      console.error('Credit failed — manual intervention required:', creditError)
      // Log to audit table for manual resolution
      await supabaseAdmin.from('audit_logs').insert({
        event_id:   order.event_id,
        admin_id:   '00000000-0000-0000-0000-000000000000', // system
        action:     'payment_credit_failed',
        target_id:  order.id,
        metadata:   { error: creditError.message, paymentId, orderId },
      })
      return new Response('Credit failed', { status: 500 })
    }

    console.log(`✅ Credited ${order.points_to_credit} pts to user ${order.user_id}`)
    return new Response(JSON.stringify({ received: true, credited: order.points_to_credit }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Internal error', { status: 500 })
  }
})
