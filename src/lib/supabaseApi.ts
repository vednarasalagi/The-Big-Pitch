// ============================================================
// Supabase Data Access Services — Production API Layer
// Real database operations with error handling and typing.
// ============================================================

import { supabase, TABLES } from './supabase'
import type { Event, EventConfig, Team, PitchRound, Wallet, WalletLedgerEntry, Investment, RoundStatus, Reward, OfficialResult, TeamInvestorStanding } from '@/types'

/**
 * Fetch the active or upcoming event along with its configuration.
 */
export async function getActiveEvent(): Promise<Event | null> {
  if (!supabase) return null

  try {
    const { data: eventData, error: eventError } = await supabase
      .from(TABLES.EVENTS)
      .select(`
        id,
        name,
        tagline,
        logo_url,
        banner_url,
        status,
        start_time,
        end_time,
        created_at,
        updated_at,
        ${TABLES.EVENT_CONFIG} (
          id,
          free_points_allocation,
          points_per_rupee,
          max_paid_purchase_rupees,
          max_paid_points,
          allowed_purchase_amounts,
          min_investment_amount,
          max_investment_amount,
          allow_multiple_investments,
          pitch_duration_seconds,
          investment_window_seconds,
          blind_leaderboard,
          allowed_email_domains,
          reward_rules
        )
      `)
      .order('start_time', { ascending: false })
      .limit(1)
      .single()

    if (eventError || !eventData) {
      return null
    }

    const config = Array.isArray(eventData.event_config)
      ? eventData.event_config[0]
      : eventData.event_config

    return {
      id: eventData.id,
      name: eventData.name,
      tagline: eventData.tagline,
      logoUrl: eventData.logo_url,
      bannerUrl: eventData.banner_url,
      status: eventData.status,
      startTime: eventData.start_time,
      endTime: eventData.end_time,
      createdAt: eventData.created_at,
      updatedAt: eventData.updated_at,
      config: config ? {
        id: config.id,
        eventId: eventData.id,
        freePointsAllocation: config.free_points_allocation ?? 500,
        pointsPerRupee: config.points_per_rupee ?? 10,
        maxPaidPurchaseRupees: config.max_paid_purchase_rupees ?? 100,
        maxPaidPoints: config.max_paid_points ?? 1000,
        allowedPurchaseAmounts: config.allowed_purchase_amounts ?? [50, 100, 200, 500, 1000],
        minInvestmentAmount: config.min_investment_amount ?? 10,
        maxInvestmentAmount: config.max_investment_amount ?? 500,
        allowMultipleInvestments: config.allow_multiple_investments ?? true,
        pitchDurationSeconds: config.pitch_duration_seconds ?? 300,
        investmentWindowSeconds: config.investment_window_seconds ?? 180,
        blindLeaderboard: config.blind_leaderboard ?? false,
        allowedEmailDomains: config.allowed_email_domains ?? [],
        rewardRules: config.reward_rules ?? [],
        officialResultsPublished: (config as any)?.official_results_published ?? false,
        updatedAt: (config as any)?.updated_at ?? new Date().toISOString(),
      } : {
        id: 'cfg-default',
        eventId: eventData.id,
        freePointsAllocation: 500,
        pointsPerRupee: 10,
        maxPaidPurchaseRupees: 100,
        maxPaidPoints: 1000,
        allowedPurchaseAmounts: [50, 100, 200, 500, 1000],
        minInvestmentAmount: 10,
        maxInvestmentAmount: 500,
        allowMultipleInvestments: true,
        pitchDurationSeconds: 300,
        investmentWindowSeconds: 180,
        blindLeaderboard: false,
        allowedEmailDomains: [],
        rewardRules: [],
        officialResultsPublished: false,
        updatedAt: new Date().toISOString(),
      },
    }
  } catch (err) {
    console.error('Failed to get active event from Supabase:', err)
    return null
  }
}

/**
 * Fetch teams for an event.
 */
export async function getTeams(eventId?: string): Promise<Team[]> {
  if (!supabase) return []

  try {
    let query = supabase.from(TABLES.TEAMS).select('*').order('pitch_order', { ascending: true })
    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    const { data, error } = await query
    if (error || !data) return []

    return data.map((t: any) => ({
      id: t.id,
      eventId: t.event_id,
      name: t.name,
      logoUrl: t.logo_url,
      pitchTitle: t.pitch_title,
      description: t.description ?? '',
      category: t.category ?? 'Startup',
      presenters: t.presenters ?? [],
      pitchOrder: t.pitch_order ?? 0,
      status: t.status ?? 'upcoming',
      pitchDurationSeconds: t.pitch_duration_seconds,
      investmentWindowSeconds: t.investment_window_seconds,
      totalInvestment: t.total_investment ?? 0,
      uniqueBackers: t.unique_backers ?? 0,
      isArchived: t.is_archived ?? false,
      officialRank: t.official_rank ?? null,
      officialScore: t.official_score !== undefined && t.official_score !== null ? Number(t.official_score) : null,
      officialAward: t.official_award ?? null,
      officialNotes: t.official_notes ?? null,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }))
  } catch (err) {
    console.error('Failed to get teams from Supabase:', err)
    return []
  }
}

/**
 * Fetch the currently active pitch round.
 */
export async function getActivePitchRound(eventId?: string): Promise<PitchRound | null> {
  if (!supabase) return null

  try {
    let query = supabase
      .from(TABLES.PITCH_ROUNDS)
      .select('*, teams(*)')
      .in('status', ['announced', 'pitching', 'investment_open', 'investment_paused', 'investment_closed'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    const { data, error } = await query.single()
    if (error || !data) return null

    const team = data.teams ? {
      id: data.teams.id,
      eventId: data.teams.event_id,
      name: data.teams.name,
      logoUrl: data.teams.logo_url,
      pitchTitle: data.teams.pitch_title,
      description: data.teams.description ?? '',
      category: data.teams.category ?? 'Startup',
      presenters: data.teams.presenters ?? [],
      pitchOrder: data.teams.pitch_order ?? 0,
      status: data.teams.status ?? 'upcoming',
      totalInvestment: data.teams.total_investment ?? 0,
      uniqueBackers: data.teams.unique_backers ?? 0,
      createdAt: data.teams.created_at,
      updatedAt: data.teams.updated_at,
    } : undefined

    return {
      id: data.id,
      eventId: data.event_id,
      teamId: data.team_id,
      team,
      roundNumber: team?.pitchOrder ?? 1,
      status: data.status,
      pitchStartTime: data.pitch_start_time,
      investmentOpenTime: data.investment_open_time,
      investmentCloseTime: data.investment_close_time,
      investmentPauseTime: data.investment_pause_time,
      scheduledDurationSeconds: data.scheduled_duration_seconds ?? 300,
      investmentWindowSeconds: data.investment_window_seconds ?? 180,
      totalInvested: data.total_invested ?? 0,
      uniqueInvestors: data.unique_investors ?? 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (err) {
    console.error('Failed to get active pitch round from Supabase:', err)
    return null
  }
}

/**
 * Fetch or automatically initialize user wallet with starting allocation in Supabase.
 */
export async function getOrCreateWallet(userId: string, eventId: string, initialGrant = 500): Promise<Wallet | null> {
  if (!userId) return null

  // Helper for mapping DB row to Wallet
  const mapWallet = (row: any): Wallet => ({
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    freePoints: row.free_points ?? 0,
    purchasedPoints: row.purchased_points ?? 0,
    investedPoints: row.invested_points ?? 0,
    totalSpentPoints: row.total_spent_points ?? 0,
    totalPaidRupees: row.total_paid_rupees ?? 0,
    freePointsGranted: row.free_points_granted ?? false,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  })

  // 1. If Supabase client exists, attempt server-side database operations
  if (supabase) {
    try {
      // Step A: Check if wallet already exists
      const { data: existing, error: fetchErr } = await supabase
        .from(TABLES.WALLETS)
        .select('*')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .maybeSingle()

      if (existing && !fetchErr) {
        return mapWallet(existing)
      }

      // Step B: Atomically create wallet & credit free points via server RPC
      // The RPC reads free_points_allocation from event_config securely on server
      try {
        await supabase.rpc('grant_free_points', {
          p_user_id: userId,
          p_event_id: eventId,
        })
      } catch (rpcErr) {
        console.warn('grant_free_points RPC call notice:', rpcErr)
      }

      // Step C: Re-query wallet after RPC
      const { data: afterRpc, error: afterRpcErr } = await supabase
        .from(TABLES.WALLETS)
        .select('*')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .maybeSingle()

      if (afterRpc && !afterRpcErr) {
        return mapWallet(afterRpc)
      }

      // Step D: Direct insert fallback (if permitted by policies)
      const { data: inserted, error: insertErr } = await supabase
        .from(TABLES.WALLETS)
        .insert({
          user_id: userId,
          event_id: eventId,
          free_points: initialGrant,
          purchased_points: 0,
          invested_points: 0,
          total_spent_points: 0,
          total_paid_rupees: 0,
          free_points_granted: true,
        })
        .select()
        .maybeSingle()

      if (inserted && !insertErr) {
        // Record ledger entry
        try {
          await supabase.from(TABLES.WALLET_LEDGER).insert({
            wallet_id: inserted.id,
            user_id: userId,
            event_id: eventId,
            type: 'free_grant',
            amount: initialGrant,
            balance_after: initialGrant,
            description: 'Welcome grant of audience voting points',
          })
        } catch {}

        return mapWallet(inserted)
      }
    } catch (err) {
      console.error('Wallet access error:', err)
    }
  }

  // 2. Offline / local fallback storage (guarantees audience has starting points)
  const mockStorageKey = `pitch_arena_wallet_${userId}_${eventId}`
  try {
    const saved = localStorage.getItem(mockStorageKey)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed && typeof parsed.freePoints === 'number') {
        return parsed
      }
    }
    const freshMock: Wallet = {
      id: `wallet-${userId.slice(0, 8)}`,
      userId,
      eventId,
      freePoints: initialGrant,
      purchasedPoints: 0,
      investedPoints: 0,
      totalSpentPoints: 0,
      totalPaidRupees: 0,
      freePointsGranted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(mockStorageKey, JSON.stringify(freshMock))
    return freshMock
  } catch {
    return {
      id: `wallet-${userId.slice(0, 8)}`,
      userId,
      eventId,
      freePoints: initialGrant,
      purchasedPoints: 0,
      investedPoints: 0,
      totalSpentPoints: 0,
      totalPaidRupees: 0,
      freePointsGranted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Fetch user ledger transactions.
 */
export async function getWalletLedger(walletId: string): Promise<WalletLedgerEntry[]> {
  if (!supabase || !walletId) return []

  try {
    const { data, error } = await supabase
      .from(TABLES.WALLET_LEDGER)
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return data.map((row: any) => ({
      id: row.id,
      walletId: row.wallet_id,
      userId: row.user_id,
      eventId: row.event_id,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balance_after,
      description: row.description,
      referenceId: row.reference_id,
      createdAt: row.created_at,
    }))
  } catch (err) {
    console.error('Failed to get ledger entries:', err)
    return []
  }
}

/**
 * Fetch investments for user.
 */
export async function getUserInvestments(userId: string, eventId?: string): Promise<Investment[]> {
  if (!supabase || !userId) return []

  try {
    let query = supabase
      .from(TABLES.INVESTMENTS)
      .select('*, teams(name, pitch_title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    const { data, error } = await query
    if (error || !data) return []

    return data.map((inv: any) => ({
      id: inv.id,
      userId: inv.user_id,
      eventId: inv.event_id,
      teamId: inv.team_id,
      roundId: inv.round_id,
      amount: inv.amount,
      createdAt: inv.created_at,
      teamName: inv.teams?.name,
    }))
  } catch (err) {
    console.error('Failed to fetch investments:', err)
    return []
  }
}

/**
 * Execute real investment in Supabase.
 * Calls `process_investment` stored procedure if available, or coordinates atomic updates.
 */
export async function submitInvestment(params: {
  userId: string
  eventId: string
  teamId: string
  roundId: string
  amount: number
  wallet: Wallet
  timeElapsedMs?: number
}): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Database client not connected' }

  const { userId, eventId, teamId, roundId, amount, wallet, timeElapsedMs } = params
  const available = wallet.freePoints + wallet.purchasedPoints
  if (amount > available) {
    return { success: false, error: 'Insufficient points in wallet' }
  }

  // Calculate authoritative reaction time in milliseconds from window open
  let calculatedMs = timeElapsedMs ?? 0

  // Check round deadline and status authoritatively
  try {
    const { data: roundData } = await supabase
      .from(TABLES.PITCH_ROUNDS)
      .select('status, investment_open_time, investment_close_time')
      .eq('id', roundId)
      .maybeSingle()

    if (roundData) {
      if (roundData.status !== 'investment_open') {
        return { success: false, error: 'The investment window is not currently open for this pitch.' }
      }
      if (roundData.investment_close_time && new Date(roundData.investment_close_time).getTime() < Date.now()) {
        return { success: false, error: 'The investment window deadline has passed.' }
      }
      if (!calculatedMs && roundData.investment_open_time) {
        calculatedMs = Math.max(1, Date.now() - new Date(roundData.investment_open_time).getTime())
      }
    }
  } catch {}

  try {
    // 1. Try secure Supabase RPC procedure
    const { error: rpcError } = await supabase.rpc('process_investment', {
      p_user_id: userId,
      p_event_id: eventId,
      p_team_id: teamId,
      p_round_id: roundId,
      p_amount: amount,
      p_wallet_id: wallet.id,
    })

    if (!rpcError) {
      // Sync time_elapsed_ms on the created investment record
      if (calculatedMs > 0) {
        try {
          await supabase
            .from(TABLES.INVESTMENTS)
            .update({ time_elapsed_ms: calculatedMs })
            .eq('user_id', userId)
            .eq('round_id', roundId)
            .order('created_at', { ascending: false })
            .limit(1)
        } catch {}
      }
      return { success: true }
    }

    // 2. Direct database transaction fallback if procedure is not installed
    const deductFree = Math.min(wallet.freePoints, amount)
    const deductPurchased = amount - deductFree

    const newFree = wallet.freePoints - deductFree
    const newPurchased = wallet.purchasedPoints - deductPurchased

    // Update wallet
    const { error: walletErr } = await supabase
      .from(TABLES.WALLETS)
      .update({
        free_points: newFree,
        purchased_points: newPurchased,
        invested_points: wallet.investedPoints + amount,
        total_spent_points: wallet.totalSpentPoints + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id)

    if (walletErr) {
      return { success: false, error: walletErr.message }
    }

    // Insert investment with millisecond reaction time
    const { data: invData, error: invErr } = await supabase
      .from(TABLES.INVESTMENTS)
      .insert({
        user_id: userId,
        event_id: eventId,
        team_id: teamId,
        round_id: roundId,
        amount,
        time_elapsed_ms: calculatedMs,
      })
      .select()
      .single()

    if (invErr) {
      return { success: false, error: invErr.message }
    }

    // Append to wallet ledger
    await supabase.from(TABLES.WALLET_LEDGER).insert({
      wallet_id: wallet.id,
      user_id: userId,
      event_id: eventId,
      type: 'investment',
      amount: -amount,
      balance_after: newFree + newPurchased,
      description: 'Investment in pitch team',
      reference_id: invData?.id,
    })

    // Update team totals
    const { data: teamData } = await supabase
      .from(TABLES.TEAMS)
      .select('total_investment, unique_backers')
      .eq('id', teamId)
      .single()

    if (teamData) {
      await supabase
        .from(TABLES.TEAMS)
        .update({
          total_investment: (teamData.total_investment ?? 0) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teamId)
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Investment could not be completed. Please try again.') }
  }
}

/**
 * Fetch audit logs for administrators.
 */
export async function getAuditLogs(): Promise<any[]> {
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from(TABLES.AUDIT_LOGS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error || !data) return []
    return data
  } catch (err) {
    console.error('Failed to get audit logs:', err)
    return []
  }
}

export interface TopInvestor {
  userId: string
  name: string
  points: number
}

/**
 * Fetch top investors ranked by points invested.
 */
export async function getTopInvestors(eventId?: string): Promise<TopInvestor[]> {
  if (!supabase) return []

  try {
    let query = supabase
      .from(TABLES.WALLETS)
      .select('user_id, invested_points, profiles(display_name, email)')
      .gt('invested_points', 0)
      .order('invested_points', { ascending: false })
      .limit(10)

    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    const { data, error } = await query
    if (error || !data) return []

    return data.map((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return {
        userId: row.user_id,
        name: profile?.display_name || (profile?.email ? profile.email.split('@')[0] : 'Investor'),
        points: row.invested_points || 0,
      }
    })
  } catch (err) {
    console.error('Failed to get top investors:', err)
    return []
  }
}

/**
 * Fetch user rewards from Supabase.
 */
export async function getUserRewards(userId: string, eventId?: string): Promise<Reward[]> {
  if (!supabase || !userId) return []

  try {
    let query = supabase
      .from(TABLES.REWARDS)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    const { data, error } = await query
    if (error || !data) return []

    return data.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      eventId: r.event_id,
      ruleId: r.rule_id,
      badgeType: r.badge_type,
      description: r.description,
      claimed: r.claimed,
      claimCode: r.claim_code,
      claimedAt: r.claimed_at,
      createdAt: r.created_at,
    }))
  } catch (err) {
    console.error('Failed to get user rewards:', err)
    return []
  }
}

/**
 * Claim reward in Supabase.
 */
export async function claimRewardInDb(rewardId: string): Promise<boolean> {
  if (!supabase || !rewardId) return false

  try {
    const { error } = await supabase
      .from(TABLES.REWARDS)
      .update({
        claimed: true,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', rewardId)

    return !error
  } catch (err) {
    console.error('Failed to claim reward:', err)
    return false
  }
}

/**
 * Create a new pre-listed team in Supabase.
 */
export async function createTeam(team: {
  eventId: string
  name: string
  pitchTitle: string
  description?: string
  category?: string
  presenters?: string[]
  pitchOrder?: number
  pitchDurationSeconds?: number
  investmentWindowSeconds?: number
}): Promise<Team | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from(TABLES.TEAMS)
      .insert({
        event_id: team.eventId,
        name: team.name.trim(),
        pitch_title: team.pitchTitle.trim(),
        description: (team.description || '').trim(),
        category: (team.category || 'General').trim(),
        presenters: team.presenters || [],
        pitch_order: team.pitchOrder || 1,
        pitch_duration_seconds: team.pitchDurationSeconds,
        investment_window_seconds: team.investmentWindowSeconds,
        status: 'upcoming',
        total_investment: 0,
        unique_backers: 0,
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Failed to create team in Supabase:', error)
      return null
    }

    return {
      id: data.id,
      eventId: data.event_id,
      name: data.name,
      logoUrl: data.logo_url,
      pitchTitle: data.pitch_title,
      description: data.description ?? '',
      category: data.category ?? 'Startup',
      presenters: data.presenters ?? [],
      pitchOrder: data.pitch_order ?? 0,
      status: data.status ?? 'upcoming',
      pitchDurationSeconds: data.pitch_duration_seconds,
      investmentWindowSeconds: data.investment_window_seconds,
      totalInvestment: data.total_investment ?? 0,
      uniqueBackers: data.unique_backers ?? 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (err) {
    console.error('Error creating team:', err)
    return null
  }
}

/**
 * Update an existing team.
 */
export async function updateTeam(
  teamId: string,
  updates: Partial<{
    name: string
    pitchTitle: string
    description: string
    category: string
    presenters: string[]
    pitchOrder: number
    status: 'upcoming' | 'active' | 'closed' | 'completed'
    pitchDurationSeconds: number
    investmentWindowSeconds: number
  }>
): Promise<boolean> {
  if (!supabase || !teamId) return false

  try {
    const payload: any = {}
    if (updates.name !== undefined) payload.name = updates.name.trim()
    if (updates.pitchTitle !== undefined) payload.pitch_title = updates.pitchTitle.trim()
    if (updates.description !== undefined) payload.description = updates.description.trim()
    if (updates.category !== undefined) payload.category = updates.category.trim()
    if (updates.presenters !== undefined) payload.presenters = updates.presenters
    if (updates.pitchOrder !== undefined) payload.pitch_order = updates.pitchOrder
    if (updates.status !== undefined) payload.status = updates.status
    if (updates.pitchDurationSeconds !== undefined) payload.pitch_duration_seconds = updates.pitchDurationSeconds
    if (updates.investmentWindowSeconds !== undefined) payload.investment_window_seconds = updates.investmentWindowSeconds
    payload.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from(TABLES.TEAMS)
      .update(payload)
      .eq('id', teamId)

    return !error
  } catch (err) {
    console.error('Error updating team:', err)
    return false
  }
}

/**
 * Delete a team from Supabase.
 */
export async function deleteTeam(teamId: string): Promise<boolean> {
  if (!supabase || !teamId) return false

  try {
    const { error } = await supabase
      .from(TABLES.TEAMS)
      .delete()
      .eq('id', teamId)

    return !error
  } catch (err) {
    console.error('Error deleting team:', err)
    return false
  }
}

/**
 * Reorder multiple teams at once.
 */
export async function reorderTeams(teamOrders: { id: string; pitchOrder: number }[]): Promise<boolean> {
  const client = supabase
  if (!client || teamOrders.length === 0) return false

  try {
    await Promise.all(
      teamOrders.map(({ id, pitchOrder }) =>
        client.from(TABLES.TEAMS).update({ pitch_order: pitchOrder, updated_at: new Date().toISOString() }).eq('id', id)
      )
    )
    return true
  } catch (err) {
    console.error('Error reordering teams:', err)
    return false
  }
}

/**
 * Start a pitch round for ANY chosen team with separate pitch and investment timers.
 */
export async function startPitchForTeam(
  eventId: string,
  team: Team,
  pitchDurationSeconds = 300,
  investmentWindowSeconds = 180,
  phase: 'announced' | 'pitching' | 'investment_open' = 'announced'
): Promise<PitchRound | null> {
  if (!supabase || !team) return null

  try {
    // 1. Close any currently open pitch rounds
    await supabase
      .from(TABLES.PITCH_ROUNDS)
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .in('status', ['announced', 'pitching', 'investment_open', 'investment_paused'])

    const now = new Date()
    const isInvesting = phase === 'investment_open'
    const openTime = isInvesting ? now.toISOString() : null
    const closeTime = isInvesting ? new Date(now.getTime() + investmentWindowSeconds * 1000).toISOString() : null

    // 2. Insert new active pitch round for this team
    const { data, error } = await supabase
      .from(TABLES.PITCH_ROUNDS)
      .insert({
        event_id: eventId,
        team_id: team.id,
        status: phase,
        pitch_start_time: now.toISOString(),
        investment_open_time: openTime,
        investment_close_time: closeTime,
        scheduled_duration_seconds: pitchDurationSeconds,
        investment_window_seconds: investmentWindowSeconds,
        total_invested: team.totalInvestment,
        unique_investors: team.uniqueBackers,
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Error starting pitch round:', error)
      return null
    }

    // 3. Mark team status as active
    await supabase.from(TABLES.TEAMS).update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', team.id)

    return {
      id: data.id,
      eventId: data.event_id,
      teamId: data.team_id,
      team: { ...team, status: 'active' },
      roundNumber: team.pitchOrder,
      status: data.status,
      pitchStartTime: data.pitch_start_time,
      investmentOpenTime: data.investment_open_time,
      investmentCloseTime: data.investment_close_time,
      scheduledDurationSeconds: pitchDurationSeconds,
      investmentWindowSeconds: investmentWindowSeconds,
      totalInvested: team.totalInvestment,
      uniqueInvestors: team.uniqueBackers,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (err) {
    console.error('Failed to start pitch for team:', err)
    return null
  }
}

/**
 * Open the audience investment window with an authoritative server deadline.
 */
export async function openInvestmentWindow(roundId: string, durationSeconds = 180): Promise<PitchRound | null> {
  if (!supabase || !roundId) return null
  try {
    const now = new Date()
    const closeTime = new Date(now.getTime() + durationSeconds * 1000).toISOString()

    const { data, error } = await supabase
      .from(TABLES.PITCH_ROUNDS)
      .update({
        status: 'investment_open',
        investment_open_time: now.toISOString(),
        investment_close_time: closeTime,
        investment_pause_time: null,
        investment_window_seconds: durationSeconds,
        updated_at: now.toISOString(),
      })
      .eq('id', roundId)
      .select('*, teams(*)')
      .single()

    if (error || !data) {
      console.error('Error opening investment window:', error)
      return null
    }

    return {
      id: data.id,
      eventId: data.event_id,
      teamId: data.team_id,
      team: data.teams,
      roundNumber: data.teams?.pitch_order ?? 1,
      status: 'investment_open',
      pitchStartTime: data.pitch_start_time,
      investmentOpenTime: data.investment_open_time,
      investmentCloseTime: data.investment_close_time,
      scheduledDurationSeconds: data.scheduled_duration_seconds ?? 300,
      investmentWindowSeconds: durationSeconds,
      totalInvested: data.total_invested ?? 0,
      uniqueInvestors: data.unique_investors ?? 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (err) {
    console.error('Error opening investment window:', err)
    return null
  }
}

/**
 * Pause the active pitch round timer.
 */
export async function pauseRound(roundId: string): Promise<boolean> {
  if (!supabase || !roundId) return false
  try {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from(TABLES.PITCH_ROUNDS)
      .update({
        status: 'investment_paused',
        investment_pause_time: now,
        updated_at: now,
      })
      .eq('id', roundId)

    return !error
  } catch (err) {
    console.error('Error pausing round:', err)
    return false
  }
}

/**
 * Resume a paused pitch round, preserving remaining time.
 */
export async function resumeRound(round: PitchRound): Promise<string | null> {
  if (!supabase || !round?.id) return null
  try {
    const now = Date.now()
    let newCloseTime: string

    if (round.investmentPauseTime && round.investmentCloseTime) {
      const pausedAt = new Date(round.investmentPauseTime).getTime()
      const pausedElapsed = Math.max(0, now - pausedAt)
      const prevClose = new Date(round.investmentCloseTime).getTime()
      newCloseTime = new Date(prevClose + pausedElapsed).toISOString()
    } else {
      const windowSec = round.investmentWindowSeconds ?? 180
      newCloseTime = new Date(now + windowSec * 1000).toISOString()
    }

    const { error } = await supabase
      .from(TABLES.PITCH_ROUNDS)
      .update({
        status: 'investment_open',
        investment_close_time: newCloseTime,
        investment_pause_time: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', round.id)

    if (error) {
      console.error('Error resuming round:', error)
      return null
    }
    return newCloseTime
  } catch (err) {
    console.error('Error resuming round:', err)
    return null
  }
}

/**
 * Extend the investment clock by extra seconds with server authority.
 */
export async function extendRoundTimer(round: PitchRound, extraSeconds = 60): Promise<string | null> {
  if (!supabase || !round?.id) return null
  try {
    const baseTime = round.investmentCloseTime
      ? Math.max(new Date(round.investmentCloseTime).getTime(), Date.now())
      : Date.now()
    const newCloseTime = new Date(baseTime + extraSeconds * 1000).toISOString()

    const { error } = await supabase
      .from(TABLES.PITCH_ROUNDS)
      .update({
        investment_close_time: newCloseTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', round.id)

    if (error) {
      console.error('Error extending round timer:', error)
      return null
    }
    return newCloseTime
  } catch (err) {
    console.error('Error extending round timer:', err)
    return null
  }
}

/**
 * Close the investment window for the round.
 */
export async function closeInvestmentWindow(roundId: string): Promise<boolean> {
  if (!supabase || !roundId) return false
  try {
    const { error } = await supabase
      .from(TABLES.PITCH_ROUNDS)
      .update({
        status: 'investment_closed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', roundId)

    return !error
  } catch (err) {
    console.error('Error closing investment window:', err)
    return false
  }
}

/**
 * Update event configuration in Supabase database.
 */
export async function updateEventConfig(eventId: string, configUpdates: Partial<EventConfig>): Promise<boolean> {
  if (!supabase || !eventId) return false
  try {
    const payload: any = {}
    if (configUpdates.freePointsAllocation !== undefined) payload.free_points_allocation = configUpdates.freePointsAllocation
    if (configUpdates.pointsPerRupee !== undefined) payload.points_per_rupee = configUpdates.pointsPerRupee
    if (configUpdates.maxPaidPurchaseRupees !== undefined) payload.max_paid_purchase_rupees = configUpdates.maxPaidPurchaseRupees
    if (configUpdates.maxPaidPoints !== undefined) payload.max_paid_points = configUpdates.maxPaidPoints
    if (configUpdates.minInvestmentAmount !== undefined) payload.min_investment_amount = configUpdates.minInvestmentAmount
    if (configUpdates.maxInvestmentAmount !== undefined) payload.max_investment_amount = configUpdates.maxInvestmentAmount
    if (configUpdates.allowMultipleInvestments !== undefined) payload.allow_multiple_investments = configUpdates.allowMultipleInvestments
    if (configUpdates.pitchDurationSeconds !== undefined) payload.pitch_duration_seconds = configUpdates.pitchDurationSeconds
    if (configUpdates.investmentWindowSeconds !== undefined) payload.investment_window_seconds = configUpdates.investmentWindowSeconds
    if (configUpdates.blindLeaderboard !== undefined) payload.blind_leaderboard = configUpdates.blindLeaderboard
    if (configUpdates.allowedEmailDomains !== undefined) payload.allowed_email_domains = configUpdates.allowedEmailDomains
    if (configUpdates.officialResultsPublished !== undefined) payload.official_results_published = configUpdates.officialResultsPublished
    payload.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from(TABLES.EVENT_CONFIG)
      .update(payload)
      .eq('event_id', eventId)

    if (error) {
      console.error('Error updating event_config in Supabase:', error)
      return false
    }
    return true
  } catch (err) {
    console.error('Error updating event_config:', err)
    return false
  }
}

/**
 * Update team-specific timer settings.
 */
export async function updateTeamTimerSettings(teamId: string, pitchDurationSeconds: number, investmentWindowSeconds: number): Promise<boolean> {
  if (!supabase || !teamId) return false
  try {
    const { error } = await supabase
      .from(TABLES.TEAMS)
      .update({
        pitch_duration_seconds: pitchDurationSeconds,
        investment_window_seconds: investmentWindowSeconds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamId)

    return !error
  } catch (err) {
    console.error('Error updating team timer settings:', err)
    return false
  }
}

/**
 * Save official judges' competition results independently of audience investments.
 */
export async function saveOfficialResults(
  eventId: string,
  results: OfficialResult[],
  isPublished: boolean
): Promise<boolean> {
  if (!supabase || !eventId) return false
  try {
    // 1. Update official ranking fields on teams
    await Promise.all(
      results.map(r =>
        supabase!
          .from(TABLES.TEAMS)
          .update({
            official_rank: r.rank ?? null,
            official_score: r.score ?? null,
            official_award: r.award ?? null,
            official_notes: r.notes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', r.teamId)
      )
    )

    // 2. Update publication status on event config
    await supabase
      .from(TABLES.EVENT_CONFIG)
      .update({
        official_results_published: isPublished,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)

    return true
  } catch (err) {
    console.error('Error saving official judging results:', err)
    return false
  }
}

/**
 * Stop/complete the pitch round for a team whenever admin wants.
 */
export async function stopPitchForTeam(teamId: string, roundId?: string): Promise<boolean> {
  if (!supabase || !teamId) return false

  try {
    if (roundId) {
      await supabase
        .from(TABLES.PITCH_ROUNDS)
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', roundId)
    } else {
      await supabase
        .from(TABLES.PITCH_ROUNDS)
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('team_id', teamId)
    }

    // Mark team as completed
    await supabase
      .from(TABLES.TEAMS)
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', teamId)

    return true
  } catch (err) {
    console.error('Failed to stop pitch:', err)
    return false
  }
}

/**
 * Fetch all investments made into a specific team (for team results dashboard).
 */
export async function getTeamInvestments(teamId: string): Promise<Investment[]> {
  if (!supabase || !teamId) return []

  try {
    const { data, error } = await supabase
      .from(TABLES.INVESTMENTS)
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return data.map((inv: any) => ({
      id: inv.id,
      userId: inv.user_id,
      eventId: inv.event_id,
      teamId: inv.team_id,
      roundId: inv.round_id,
      amount: inv.amount,
      createdAt: inv.created_at,
    }))
  } catch (err) {
    console.error('Failed to get team investments:', err)
    return []
  }
}

/**
 * Fetch audience investor standings for a specific team.
 * Calculates rankings based on:
 * 1. Highest Amount Invested (Descending)
 * 2. Least Time Taken in Milliseconds (Ascending) as tie-breaker/speed factor.
 */
export async function getTeamAudienceStandings(teamId: string): Promise<TeamInvestorStanding[]> {
  if (!supabase || !teamId) return []

  try {
    const { data: investments, error: invError } = await supabase
      .from(TABLES.INVESTMENTS)
      .select('id, user_id, team_id, round_id, amount, time_elapsed_ms, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true })

    if (invError || !investments || investments.length === 0) return []

    // Fetch round information to calculate fallback millisecond timings if needed
    const roundIds = Array.from(new Set(investments.map((i: any) => i.round_id).filter(Boolean)))
    const roundsMap = new Map<string, any>()
    if (roundIds.length > 0) {
      const { data: rounds } = await supabase
        .from(TABLES.PITCH_ROUNDS)
        .select('id, investment_open_time, pitch_start_time, created_at')
        .in('id', roundIds)

      rounds?.forEach((r: any) => roundsMap.set(r.id, r))
    }

    // Fetch user profiles for all investors
    const userIds = Array.from(new Set(investments.map((i: any) => i.user_id).filter(Boolean)))
    const profilesMap = new Map<string, any>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from(TABLES.PROFILES)
        .select('id, display_name, email, avatar_url')
        .in('id', userIds)

      profiles?.forEach((p: any) => profilesMap.set(p.id, p))
    }

    // Aggregate by user
    const userMap = new Map<string, {
      userId: string
      displayName: string
      email: string
      avatarUrl?: string
      totalAmount: number
      minTimeElapsedMs: number
      firstInvestedAt: string
    }>()

    for (const inv of investments as any[]) {
      const profile = profilesMap.get(inv.user_id)
      const round = roundsMap.get(inv.round_id)

      let timeMs = Number(inv.time_elapsed_ms) || 0
      if (!timeMs || timeMs <= 0) {
        const openTime = round?.investment_open_time || round?.pitch_start_time || round?.created_at
        if (openTime && inv.created_at) {
          timeMs = Math.max(1, new Date(inv.created_at).getTime() - new Date(openTime).getTime())
        } else {
          timeMs = 1200
        }
      }

      const existing = userMap.get(inv.user_id)
      if (existing) {
        existing.totalAmount += inv.amount
        if (timeMs < existing.minTimeElapsedMs) {
          existing.minTimeElapsedMs = timeMs
        }
      } else {
        userMap.set(inv.user_id, {
          userId: inv.user_id,
          displayName: profile?.display_name || profile?.email?.split('@')[0] || 'Audience Backer',
          email: profile?.email || '',
          avatarUrl: profile?.avatar_url,
          totalAmount: inv.amount,
          minTimeElapsedMs: timeMs,
          firstInvestedAt: inv.created_at,
        })
      }
    }

    // Rank: Highest amount invested first (descending); least time taken (milliseconds ascending) as tie-breaker/speed factor
    const sorted = Array.from(userMap.values()).sort((a, b) => {
      if (b.totalAmount !== a.totalAmount) {
        return b.totalAmount - a.totalAmount
      }
      return a.minTimeElapsedMs - b.minTimeElapsedMs
    })

    return sorted.map((item, index) => ({
      userId: item.userId,
      displayName: item.displayName,
      email: item.email,
      avatarUrl: item.avatarUrl,
      amount: item.totalAmount,
      timeElapsedMs: item.minTimeElapsedMs,
      investedAt: item.firstInvestedAt,
      rank: index + 1,
    }))
  } catch (err) {
    console.error('Failed to get team audience standings:', err)
    return []
  }
}

/**
 * Maps technical or unexpected errors to friendly, professional user statements.
 * Never leaks database details, table names, or environment variable names to end users.
 */
export function toUserFriendlyError(err: any, fallback = 'Unable to complete request. Please try again.'): string {
  if (!err) return fallback
  const msg = typeof err === 'string' ? err : err.message || ''
  const lower = msg.toLowerCase()

  if (lower.includes('email not confirmed')) {
    return 'Your email address has not been confirmed yet. Please verify your OTP code.'
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid email or password') || lower.includes('invalid_grant')) {
    return 'Incorrect email or password. Please verify and try again.'
  }
  if (lower.includes('user already registered') || lower.includes('already exists') || lower.includes('unique constraint')) {
    return 'An account with this email already exists. Please sign in instead.'
  }
  if (lower.includes('token has expired') || lower.includes('otp has expired')) {
    return 'This verification code has expired. Please request a new code.'
  }
  if (lower.includes('invalid token') || lower.includes('invalid otp') || lower.includes('token is invalid') || lower.includes('token has expired or is invalid')) {
    return 'Incorrect verification code. Please check your email and try again.'
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch') || lower.includes('connection')) {
    return 'Network connection issue. Please check your internet connection.'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('over_email_send_rate_limit')) {
    return 'Too many attempts. Please wait a minute before requesting another code.'
  }
  if (lower.includes('insufficient points')) {
    return 'You do not have enough points for this investment.'
  }
  if (lower.includes('not configured') || lower.includes('supabase') || lower.includes('vite_') || lower.includes('key')) {
    return 'The service is temporarily unavailable. Please try again shortly.'
  }

  return msg || fallback
}

