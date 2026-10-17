// ============================================================
// Supabase Data Access Services — Production API Layer
// Real database operations with error handling and typing.
// ============================================================

import { supabase, TABLES } from './supabase'
import type { Event, Team, PitchRound, Wallet, WalletLedgerEntry, Investment, RoundStatus, Reward } from '@/types'

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
      .in('status', ['announced', 'investment_open', 'investment_paused'])
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
  if (!supabase || !userId) return null

  try {
    // 1. Try to fetch existing wallet
    const { data: existing, error: fetchErr } = await supabase
      .from(TABLES.WALLETS)
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .single()

    if (existing && !fetchErr) {
      return {
        id: existing.id,
        userId: existing.user_id,
        eventId: existing.event_id,
        freePoints: existing.free_points,
        purchasedPoints: existing.purchased_points,
        investedPoints: existing.invested_points,
        totalSpentPoints: existing.total_spent_points,
        totalPaidRupees: existing.total_paid_rupees,
        freePointsGranted: existing.free_points_granted,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      }
    }

    // 2. Insert fresh wallet for this user + event
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
      .single()

    if (insertErr || !inserted) {
      console.warn('Could not insert wallet:', insertErr?.message)
      return null
    }

    // 3. Log initial free grant ledger record
    await supabase.from(TABLES.WALLET_LEDGER).insert({
      wallet_id: inserted.id,
      user_id: userId,
      event_id: eventId,
      type: 'free_grant',
      amount: initialGrant,
      balance_after: initialGrant,
      description: 'Welcome grant of audience voting points',
    })

    return {
      id: inserted.id,
      userId: inserted.user_id,
      eventId: inserted.event_id,
      freePoints: inserted.free_points,
      purchasedPoints: inserted.purchased_points,
      investedPoints: inserted.invested_points,
      totalSpentPoints: inserted.total_spent_points,
      totalPaidRupees: inserted.total_paid_rupees,
      freePointsGranted: inserted.free_points_granted,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    }
  } catch (err) {
    console.error('Wallet access error:', err)
    return null
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
}): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Database client not connected' }

  const { userId, eventId, teamId, roundId, amount, wallet } = params
  const available = wallet.freePoints + wallet.purchasedPoints
  if (amount > available) {
    return { success: false, error: 'Insufficient points in wallet' }
  }

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

    // Insert investment
    const { data: invData, error: invErr } = await supabase
      .from(TABLES.INVESTMENTS)
      .insert({
        user_id: userId,
        event_id: eventId,
        team_id: teamId,
        round_id: roundId,
        amount,
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
 * Start a pitch round for ANY chosen team.
 */
export async function startPitchForTeam(eventId: string, team: Team, durationSeconds = 300): Promise<PitchRound | null> {
  if (!supabase || !team) return null

  try {
    // 1. Close any currently open pitch rounds
    await supabase
      .from(TABLES.PITCH_ROUNDS)
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .in('status', ['announced', 'investment_open', 'investment_paused'])

    // 2. Insert new active pitch round for this team
    const { data, error } = await supabase
      .from(TABLES.PITCH_ROUNDS)
      .insert({
        event_id: eventId,
        team_id: team.id,
        status: 'investment_open',
        pitch_start_time: new Date().toISOString(),
        investment_open_time: new Date().toISOString(),
        scheduled_duration_seconds: durationSeconds,
        investment_window_seconds: durationSeconds,
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
      status: 'investment_open',
      pitchStartTime: data.pitch_start_time,
      investmentOpenTime: data.investment_open_time,
      scheduledDurationSeconds: durationSeconds,
      investmentWindowSeconds: durationSeconds,
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
 * Maps technical or unexpected errors to friendly, professional user statements.
 * Never leaks database details, table names, or environment variable names to end users.
 */
export function toUserFriendlyError(err: any, fallback = 'Unable to complete request. Please try again.'): string {
  if (!err) return fallback
  const msg = typeof err === 'string' ? err : err.message || ''
  const lower = msg.toLowerCase()

  if (lower.includes('invalid login credentials') || lower.includes('invalid email or password') || lower.includes('invalid_grant')) {
    return 'Incorrect email or password. Please verify and try again.'
  }
  if (lower.includes('user already registered') || lower.includes('already exists') || lower.includes('unique constraint')) {
    return 'An account with this email already exists. Please sign in instead.'
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch') || lower.includes('connection')) {
    return 'Network connection issue. Please check your internet connection.'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment before trying again.'
  }
  if (lower.includes('insufficient points')) {
    return 'You do not have enough points for this investment.'
  }
  if (lower.includes('not configured') || lower.includes('supabase') || lower.includes('vite_') || lower.includes('key')) {
    return 'The service is temporarily unavailable. Please try again shortly.'
  }

  return fallback
}

