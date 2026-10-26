// ============================================================
// Supabase Edge Function: invest
// POST /functions/v1/invest
//
// Atomically processes an investment:
// 1. Validates user auth and event state
// 2. Checks wallet balance
// 3. Verifies round is open (server time authority)
// 4. Deducts points and creates investment record in one transaction
// 5. Updates team total and unique backer count
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize admin client (service role — bypasses RLS for transactional ops)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Validate user JWT
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

    // Enforce single-account entry verification rule
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('entry_verified, role')
      .eq('id', user.id)
      .single()

    if (profile && profile.role !== 'admin' && !profile.entry_verified) {
      return new Response(JSON.stringify({
        error: 'Event entry verification required. Please have your QR pass scanned by a volunteer at the entrance.',
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { roundId, teamId, eventId, amount } = await req.json()

    // Validate input
    if (!roundId || !teamId || !eventId || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Fetch and validate round state (server time authoritative)
    const { data: round, error: roundError } = await supabaseAdmin
      .from('pitch_rounds')
      .select('*')
      .eq('id', roundId)
      .single()

    if (roundError || !round) {
      return new Response(JSON.stringify({ error: 'Round not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (round.status !== 'investment_open') {
      return new Response(JSON.stringify({ error: 'Investment window is not open' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Server-side deadline check
    if (round.investment_close_time && new Date(round.investment_close_time) <= new Date()) {
      return new Response(JSON.stringify({ error: 'Investment window has closed' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Fetch event config for validation
    const { data: config } = await supabaseAdmin
      .from('event_config')
      .select('min_investment_amount, max_investment_amount, allow_multiple_investments')
      .eq('event_id', eventId)
      .single()

    if (config) {
      if (amount < config.min_investment_amount) {
        return new Response(JSON.stringify({ error: `Minimum investment: ${config.min_investment_amount} pts` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (amount > config.max_investment_amount) {
        return new Response(JSON.stringify({ error: `Maximum investment: ${config.max_investment_amount} pts` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (!config.allow_multiple_investments) {
        const { data: existing } = await supabaseAdmin
          .from('investments')
          .select('id')
          .eq('user_id', user.id)
          .eq('round_id', roundId)
          .limit(1)
          .single()
        if (existing) {
          return new Response(JSON.stringify({ error: 'Already invested in this round' }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
    }

    // 3. Fetch wallet with FOR UPDATE lock (prevent concurrent overspend)
    const { data: wallet, error: walletError } = await supabaseAdmin
      .rpc('get_wallet_for_update', { p_user_id: user.id, p_event_id: eventId })

    if (walletError || !wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const available = wallet.free_points + wallet.purchased_points
    if (available < amount) {
      return new Response(JSON.stringify({ error: 'Insufficient points' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Deduct points and create investment atomically via RPC
    const { data: result, error: txError } = await supabaseAdmin
      .rpc('process_investment', {
        p_user_id:   user.id,
        p_event_id:  eventId,
        p_team_id:   teamId,
        p_round_id:  roundId,
        p_amount:    amount,
        p_wallet_id: wallet.id,
      })

    if (txError || !result || (typeof result === 'object' && (result as any).success === false)) {
      const errMsg = (typeof result === 'object' && (result as any)?.error) ? (result as any).error : 'Investment processing failed'
      console.error('Transaction error:', txError || errMsg)
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const investmentId = typeof result === 'object' ? (result as any).investmentId : result

    return new Response(JSON.stringify({ success: true, investmentId }), {
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
