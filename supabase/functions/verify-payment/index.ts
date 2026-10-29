// ============================================================
// Supabase Edge Function: verify-payment
// POST /functions/v1/verify-payment
//
// Called by the browser right after Razorpay Checkout succeeds.
// Verifies the checkout signature (HMAC-SHA256 of "order_id|payment_id"
// with the Razorpay secret), confirms the order belongs to the caller,
// then credits points via complete_payment_order (idempotent).
// payment-webhook is the fallback if this call never arrives.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  return {
    ...(origin && ALLOWED_ORIGINS.includes(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  const origin = req.headers.get("Origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json(req, { error: "Origin not allowed." }, 403);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const razorpaySecret = Deno.env.get("RAZORPAY_SECRET_KEY");

    if (!supabaseUrl || !serviceRoleKey || !razorpaySecret) {
      console.error("verify-payment: missing server configuration.");
      return json(req, { error: "Server configuration error." }, 500);
    }

    const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json(req, { error: "Authentication required." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json(req, { error: "Invalid or expired session." }, 401);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json(req, { error: "Invalid JSON body." }, 400);
    }

    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;

    if (
      typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string" ||
      !orderId || !paymentId || !signature
    ) {
      return json(req, { error: "Missing payment details." }, 400);
    }

    // The order must belong to the authenticated caller.
    const { data: order } = await admin
      .from("payment_orders")
      .select("id, user_id")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (!order || order.user_id !== user.id) {
      return json(req, { error: "Order not found." }, 404);
    }

    const expected = await hmacHex(`${orderId}|${paymentId}`, razorpaySecret);
    if (!safeEqual(expected, signature.trim().toLowerCase())) {
      console.warn("verify-payment: signature mismatch for order", orderId);
      return json(req, { error: "Payment signature verification failed." }, 400);
    }

    const { data: result, error } = await admin.rpc("complete_payment_order", {
      p_razorpay_order_id: orderId,
      p_payment_id: paymentId,
      p_signature: signature,
      p_amount_paise: null,
    });

    if (error || !result?.success) {
      console.error("verify-payment: completion failed", error ?? result);
      return json(req, { error: "Payment received but crediting is pending. It will be applied automatically." }, 502);
    }

    return json(req, {
      success: true,
      points: result.points,
      rupees: result.rupees,
      alreadyProcessed: result.already_processed === true,
    });
  } catch (err) {
    console.error("verify-payment unhandled error:", err);
    return json(req, { error: "Internal server error." }, 500);
  }
});
