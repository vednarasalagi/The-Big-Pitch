
import { createClient } from "npm:@supabase/supabase-js@2";

type Reservation = {
  reservation_id: string;
  rupee_amount: number;
  points_to_credit: number;
  status: "creating" | "created" | "failed";
  razorpay_order_id: string | null;
  created_now: boolean;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const APP_ENV = Deno.env.get("APP_ENV") ?? "production";
const PAYMENT_MODE = Deno.env.get("PAYMENT_MODE") ?? "razorpay";

const ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");

  // In production, configure exact frontend origins.
  const isAllowed =
    !origin ||
    ALLOWED_ORIGINS.includes(origin) ||
    (
      APP_ENV === "development" &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    );

  return {
    ...(origin && isAllowed
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function getPublicError(error: {
  message?: string;
  code?: string;
}) {
  const messages: Record<string, { status: number; message: string }> = {
    INVALID_PURCHASE_AMOUNT: {
      status: 400,
      message: "Enter a valid whole-rupee purchase amount.",
    },
    PORTAL_DISABLED: {
      status: 409,
      message: "Online payments are not enabled right now. Please use the UPI QR option.",
    },
    INVALID_EVENT: {
      status: 404,
      message: "Event not found or unavailable.",
    },
    EVENT_CONFIG_NOT_FOUND: {
      status: 409,
      message: "The event payment configuration is missing.",
    },
    EVENT_CONFIG_INVALID: {
      status: 409,
      message: "The event payment configuration is invalid.",
    },
    WALLET_NOT_FOUND: {
      status: 404,
      message: "Your event wallet was not found.",
    },
    PURCHASE_CAP_EXCEEDED: {
      status: 409,
      message: "This purchase exceeds your remaining event allowance.",
    },
    IDEMPOTENCY_KEY_REUSED: {
      status: 409,
      message: "This request ID was used for a different purchase.",
    },
  };

  const known = error.message ? messages[error.message] : undefined;

  if (known) return known;

  if (error.code === "22023") {
    return {
      status: 400,
      message: "Invalid purchase request.",
    };
  }

  console.error("Payment reservation database error:", {
    code: error.code,
    message: error.message,
  });

  return {
    status: 500,
    message: "Unable to prepare your purchase.",
  };
}

function readReservation(value: unknown): Reservation | null {
  if (!isRecord(value)) return null;

  const r = value;

  if (
    typeof r.reservation_id !== "string" ||
    !UUID_REGEX.test(r.reservation_id) ||
    typeof r.rupee_amount !== "number" ||
    !Number.isSafeInteger(r.rupee_amount) ||
    typeof r.points_to_credit !== "number" ||
    !Number.isSafeInteger(r.points_to_credit) ||
    r.points_to_credit <= 0 ||
    !["creating", "created", "failed"].includes(
      String(r.status),
    ) ||
    !(
      r.razorpay_order_id === null ||
      typeof r.razorpay_order_id === "string"
    ) ||
    typeof r.created_now !== "boolean"
  ) {
    return null;
  }

  return r as unknown as Reservation;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: getCorsHeaders(req),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      req,
      { error: "Method not allowed." },
      405,
    );
  }

  const origin = req.headers.get("Origin");

  if (
    origin &&
    !getCorsHeaders(req)["Access-Control-Allow-Origin"]
  ) {
    return jsonResponse(req, { error: "Origin not allowed." }, 403);
  }

  let reservationId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server configuration.");

      return jsonResponse(
        req,
        { error: "Server configuration error." },
        500,
      );
    }

    // Mock mode must never be activated merely because a key is missing.
    const isMockMode =
      APP_ENV === "development" &&
      PAYMENT_MODE === "mock";

    if (
      PAYMENT_MODE !== "razorpay" &&
      !isMockMode
    ) {
      console.error("Invalid payment-mode configuration.");

      return jsonResponse(
        req,
        { error: "Payment service is not configured." },
        500,
      );
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpaySecret = Deno.env.get("RAZORPAY_SECRET_KEY");

    if (
      !isMockMode &&
      (!razorpayKeyId || !razorpaySecret)
    ) {
      console.error("Razorpay credentials are missing.");

      return jsonResponse(
        req,
        { error: "Payment service is not configured." },
        500,
      );
    }

    // Authenticate the actual Supabase user.
    const authorization = req.headers.get("Authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1];

    if (!token) {
      return jsonResponse(
        req,
        { error: "Authentication required." },
        401,
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse(
        req,
        { error: "Invalid or expired session." },
        401,
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: "Invalid JSON body." }, 400);
    }

    if (!isRecord(body)) {
      return jsonResponse(
        req,
        { error: "Request body must be a JSON object." },
        400,
      );
    }

    const { rupeeAmount, eventId } = body;

    if (
      typeof rupeeAmount !== "number" ||
      !Number.isSafeInteger(rupeeAmount) ||
      rupeeAmount <= 0
    ) {
      return jsonResponse(
        req,
        { error: "Amount must be a positive whole number of rupees." },
        400,
      );
    }

    if (
      typeof eventId !== "string" ||
      !UUID_REGEX.test(eventId)
    ) {
      return jsonResponse(
        req,
        { error: "A valid event ID is required." },
        400,
      );
    }

    const requestId = req.headers.get("Idempotency-Key");

    if (!requestId || !UUID_REGEX.test(requestId)) {
      return jsonResponse(
        req,
        { error: "A valid Idempotency-Key header is required." },
        400,
      );
    }

    // Critical: reserve the user's purchase allowance atomically.
    // This RPC must calculate already-paid purchases PLUS active
    // pending reservations before accepting another purchase.
    const {
      data: rawReservation,
      error: reservationError,
    } = await supabaseAdmin.rpc("reserve_payment_order", {
      p_user_id: user.id,
      p_event_id: eventId,
      p_rupee_amount: rupeeAmount,
      p_request_id: requestId,
    });

    if (reservationError) {
      const publicError = getPublicError(reservationError);

      return jsonResponse(
        req,
        { error: publicError.message },
        publicError.status,
      );
    }

    const reservation = readReservation(rawReservation);

    if (!reservation) {
      console.error("Invalid reservation response from database.");

      return jsonResponse(
        req,
        { error: "Unable to prepare your purchase." },
        500,
      );
    }

    reservationId = reservation.reservation_id;

    // A retry after a successful order creation returns that same order.
    if (
      reservation.status === "created" &&
      reservation.razorpay_order_id
    ) {
      return jsonResponse(req, {
        orderId: reservation.razorpay_order_id,
        rupeeAmount: reservation.rupee_amount,
        pointsToCredit: reservation.points_to_credit,
        keyId: isMockMode ? null : razorpayKeyId,
        isMock: isMockMode,
      });
    }

    // Do not create multiple provider orders for one request ID.
    if (!reservation.created_now || reservation.status !== "creating") {
      return jsonResponse(
        req,
        {
          error:
            "This purchase is already being processed or cannot be retried. Check its status before starting another purchase.",
        },
        409,
      );
    }

    let providerOrderId: string;

    if (isMockMode) {
      // This creates a development order only.
      // A separate development-only endpoint must simulate payment
      // and credit points; this function must never credit them.
      providerOrderId =
        `order_mock_${reservation.reservation_id.replace(/-/g, "")}`;
    } else {
      const amountInPaise = reservation.rupee_amount * 100;

      if (!Number.isSafeInteger(amountInPaise)) {
        await supabaseAdmin.rpc("fail_payment_order", {
          p_reservation_id: reservation.reservation_id,
          p_reason: "INVALID_PROVIDER_AMOUNT",
        });

        return jsonResponse(
          req,
          { error: "Invalid purchase amount." },
          400,
        );
      }

      const credentials = btoa(
        `${razorpayKeyId}:${razorpaySecret}`,
      );

      const receipt =
        `pa_${reservation.reservation_id.replace(/-/g, "").slice(0, 32)}`;

      let razorpayResponse: Response;

      try {
        razorpayResponse = await fetch(
          "https://api.razorpay.com/v1/orders",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Basic ${credentials}`,
            },
            body: JSON.stringify({
              amount: amountInPaise,
              currency: "INR",
              receipt,
            }),
            signal: AbortSignal.timeout(15_000),
          },
        );
      } catch (error) {
        console.error("Razorpay order request failed:", error);

        // If this operation fails, the RPC must release the reservation.
        // A network timeout is ambiguous; production systems should
        // reconcile the provider order before releasing the cap.
        const { error: releaseError } =
          await supabaseAdmin.rpc("fail_payment_order", {
            p_reservation_id: reservation.reservation_id,
            p_reason: "PROVIDER_REQUEST_FAILED",
          });

        if (releaseError) {
          console.error(
            "Failed to update reservation after provider error:",
            releaseError,
          );
        }

        return jsonResponse(
          req,
          { error: "Unable to create payment order. Please check its status before retrying." },
          502,
        );
      }

      if (!razorpayResponse.ok) {
        // Log status only; do not return provider internals to the user.
        console.error(
          "Razorpay order creation returned HTTP",
          razorpayResponse.status,
        );

        const { error: releaseError } =
          await supabaseAdmin.rpc("fail_payment_order", {
            p_reservation_id: reservation.reservation_id,
            p_reason: "PROVIDER_REJECTED_ORDER",
          });

        if (releaseError) {
          console.error("Could not release failed reservation:", releaseError);
        }

        return jsonResponse(
          req,
          { error: "Payment provider rejected the order." },
          502,
        );
      }

      const providerBody: unknown = await razorpayResponse.json();

      if (!isRecord(providerBody)) {
        console.error("Unexpected Razorpay response format.");

        // Keep the reservation for reconciliation: the provider might
        // have created an order even though the response was unusable.
        return jsonResponse(
          req,
          { error: "Payment order needs verification. Please contact event support before retrying." },
          502,
        );
      }

      if (
        typeof providerBody.id !== "string" ||
        providerBody.amount !== amountInPaise ||
        providerBody.currency !== "INR"
      ) {
        console.error("Razorpay order response did not match the request.");

        return jsonResponse(
          req,
          { error: "Payment order needs verification. Please contact event support before retrying." },
          502,
        );
      }

      providerOrderId = providerBody.id;
    }

    // Persist the Razorpay order ID BEFORE returning it to the browser.
    const {
      error: finalizeError,
    } = await supabaseAdmin.rpc("finalize_payment_order", {
      p_reservation_id: reservation.reservation_id,
      p_razorpay_order_id: providerOrderId,
      p_payment_mode: isMockMode ? "mock" : "razorpay",
    });

    if (finalizeError) {
      // Do not return an order the database cannot track.
      // Do not automatically release the reservation here. A provider
      // order may already exist, so an operator/reconciliation process
      // must resolve the ambiguous state.
      console.error("Could not finalize payment order:", {
        reservationId: reservation.reservation_id,
        providerOrderId,
        code: finalizeError.code,
      });

      return jsonResponse(
        req,
        {
          error: "Your order is awaiting verification. Please check its status before retrying.",
        },
        503,
      );
    }

    return jsonResponse(req, {
      orderId: providerOrderId,
      rupeeAmount: reservation.rupee_amount,
      pointsToCredit: reservation.points_to_credit,
      keyId: isMockMode ? null : razorpayKeyId,
      isMock: isMockMode,
    });
  } catch (error) {
    console.error("Unhandled payment-order error:", error);

    return jsonResponse(
      req,
      { error: "Internal server error." },
      500,
    );
  }
});
