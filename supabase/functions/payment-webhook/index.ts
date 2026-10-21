// ============================================================
// Supabase Edge Function: payment-webhook
// POST /functions/v1/payment-webhook
//
// Dual Razorpay Webhook Handler:
// 1. Static QR Payment (`qr_code.credited`) — Sphinx '26 audience flow
// 2. Order-Based Payment (`payment.captured`) — standard checkout fallback
//
// Features:
// - Native Web Crypto HMAC-SHA256 signature verification
// - Full raw audit logging into public.webhook_events
// - Idempotent processing (guarantees payments can only be credited once)
// - Transactional atomic matching via match_qr_payment_internal RPC
// - Resilient error handling and 200 ACKs to prevent Razorpay retry storms
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-razorpay-signature, content-type',
}

/**
 * Standard Web Crypto API HMAC-SHA256 signature verifier
 */
async function verifyRazorpaySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    const expectedSig = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")

    return expectedSig.toLowerCase() === signature.trim().toLowerCase()
  } catch (err) {
    console.error("Signature verification error:", err)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
  const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment secrets')
    return new Response('Configuration error', { status: 500, headers: corsHeaders })
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let rawBody = ''
  let signature = ''
  let event: any = null

  try {
    signature = req.headers.get('x-razorpay-signature') || ''
    rawBody = await req.text()

    if (!rawBody) {
      return new Response('Empty body', { status: 400, headers: corsHeaders })
    }

    // 1. Signature Verification
    let signatureVerified = false
    if (webhookSecret && signature) {
      signatureVerified = await verifyRazorpaySignature(rawBody, signature, webhookSecret)
      if (!signatureVerified) {
        console.warn('⚠️ Invalid webhook signature received')
        // Still log unverified webhook for fraud auditing
        try {
          const parsed = JSON.parse(rawBody)
          await supabaseAdmin.from('webhook_events').insert({
            event_type: parsed.event || 'unknown',
            event_id: parsed.id || null,
            signature_verified: false,
            status: 'failed',
            error_message: 'Invalid HMAC signature',
            payload: parsed,
          })
        } catch (_) {}

        return new Response('Invalid signature', { status: 400, headers: corsHeaders })
      }
    } else if (!razorpayKeyId?.startsWith('rzp_test_mock')) {
      // In production, signature is mandatory
      console.warn('⚠️ Missing signature in production webhook')
      return new Response('Signature header missing', { status: 403, headers: corsHeaders })
    } else {
      // Test mock mode
      signatureVerified = true
    }

    event = JSON.parse(rawBody)
    const eventType = event.event
    const eventId = event.id || null

    console.log(`[Webhook] Received event: ${eventType} (ID: ${eventId})`)

    // 2. Audit Log into public.webhook_events
    await supabaseAdmin.from('webhook_events').insert({
      event_type: eventType,
      event_id: eventId,
      signature_verified: signatureVerified,
      status: 'received',
      payload: event,
    })

    // ─────────────────────────────────────────────────────────────
    // CASE A: Static QR Payment Event (`qr_code.credited`)
    // ─────────────────────────────────────────────────────────────
    if (eventType === 'qr_code.credited') {
      const payment = event.payload?.payment?.entity
      const qrCode = event.payload?.qr_code?.entity

      if (!payment || !payment.id) {
        console.error('Missing payment entity in qr_code.credited payload')
        return new Response(JSON.stringify({ error: 'Missing payment data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const paymentId = payment.id
      const qrId = qrCode?.id || payment.qr_code_id || null
      const amountPaise = payment.amount // e.g. 5000 = ₹50.00
      const payerVpa = payment.vpa || null
      const bankRrn = payment.acquirer_data?.rrn || payment.acquirer_data?.upi_transaction_id || payment.notes?.rrn || null
      const paymentTime = payment.created_at
        ? new Date(payment.created_at * 1000).toISOString()
        : new Date().toISOString()

      console.log(`[Static QR] Processing payment ${paymentId}: ₹${amountPaise / 100}, UTR/RRN: ${bankRrn}, Payer: ${payerVpa}`)

      // Call the server-authoritative matching RPC
      const { data: matchResult, error: matchError } = await supabaseAdmin.rpc('match_qr_payment_internal', {
        p_payment_id: paymentId,
        p_qr_id: qrId,
        p_amount_paise: amountPaise,
        p_bank_rrn: bankRrn,
        p_payer_vpa: payerVpa,
        p_raw_payload: event,
        p_payment_time: paymentTime,
      })

      if (matchError) {
        console.error('Error executing match_qr_payment_internal:', matchError)
        await supabaseAdmin.from('webhook_events').update({
          status: 'failed',
          error_message: matchError.message,
        }).eq('event_id', eventId)

        return new Response(JSON.stringify({ error: 'Internal processing error', detail: matchError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log('[Static QR] Match Result:', matchResult)

      await supabaseAdmin.from('webhook_events').update({
        status: 'processed',
      }).eq('event_id', eventId)

      return new Response(JSON.stringify({
        received: true,
        type: 'qr_code.credited',
        payment_id: paymentId,
        result: matchResult,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─────────────────────────────────────────────────────────────
    // CASE B: Standard Checkout Event (`payment.captured`)
    // ─────────────────────────────────────────────────────────────
    if (eventType === 'payment.captured') {
      const payment = event.payload?.payment?.entity
      const orderId = payment?.order_id
      const paymentId = payment?.id

      // Check if this captured payment is actually a QR code payment without an order ID
      if (!orderId && (payment?.method === 'upi' || payment?.qr_code_id)) {
        console.log(`[Payment Captured] Identified as QR payment without order_id: ${paymentId}`)
        const amountPaise = payment.amount
        const payerVpa = payment.vpa || null
        const bankRrn = payment.acquirer_data?.rrn || payment.acquirer_data?.upi_transaction_id || null
        const paymentTime = payment.created_at
          ? new Date(payment.created_at * 1000).toISOString()
          : new Date().toISOString()

        const { data: matchResult, error: matchError } = await supabaseAdmin.rpc('match_qr_payment_internal', {
          p_payment_id: paymentId,
          p_qr_id: payment.qr_code_id || null,
          p_amount_paise: amountPaise,
          p_bank_rrn: bankRrn,
          p_payer_vpa: payerVpa,
          p_raw_payload: event,
          p_payment_time: paymentTime,
        })

        return new Response(JSON.stringify({ received: true, type: 'qr_captured', result: matchResult }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!orderId || !paymentId) {
        return new Response(JSON.stringify({ received: true, skipped: 'no_order_id' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Find legacy payment order
      const { data: order, error: orderError } = await supabaseAdmin
        .from('payment_orders')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .single()

      if (orderError || !order) {
        console.warn('Payment order not found for captured payment:', orderId)
        return new Response(JSON.stringify({ received: true, note: 'order_not_found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (order.status === 'success') {
        console.log('Duplicate webhook — order already credited:', orderId)
        return new Response(JSON.stringify({ received: true, skipped: 'already_processed' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Update order status
      const { error: updateError } = await supabaseAdmin
        .from('payment_orders')
        .update({
          status: 'success',
          razorpay_payment_id: paymentId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('status', 'created')

      if (updateError) {
        console.error('Failed to update order status:', updateError)
        return new Response('Update failed', { status: 500, headers: corsHeaders })
      }

      // Credit points to wallet atomically
      const { error: creditError } = await supabaseAdmin.rpc('credit_purchased_points', {
        p_user_id: order.user_id,
        p_event_id: order.event_id,
        p_points: order.points_to_credit,
        p_rupees: order.rupee_amount,
        p_payment_order_id: order.id,
      })

      if (creditError) {
        console.error('Credit failed for order:', creditError)
        return new Response('Credit failed', { status: 500, headers: corsHeaders })
      }

      console.log(`✅ Credited ${order.points_to_credit} points to user ${order.user_id} via order checkout`)
      return new Response(JSON.stringify({ received: true, credited: order.points_to_credit }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Acknowledge other event types with 200 OK
    return new Response(JSON.stringify({ received: true, ignored: eventType }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Webhook unhandled error:', error)
    return new Response(JSON.stringify({ error: 'Internal error', detail: error?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
