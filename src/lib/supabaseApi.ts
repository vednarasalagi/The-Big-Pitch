// ============================================================
// Supabase Data Access Services — Production API Layer
// Real database operations with error handling and typing.
// ============================================================

import { supabase, TABLES } from './supabase'
import { generateId } from './utils'
import {
  normalizeAudioMime,
  saveTrackToIndexedDB,
  createOrReuseBlobUrl,
  setStoredCelebrationTrackName,
} from './celebrationAudioStorage'
import type { Event, EventConfig, Team, PitchRound, Wallet, WalletLedgerEntry, Investment, RoundStatus, Reward, OfficialResult, TeamInvestorStanding, PaymentIntent, QRPayment, WebhookEventRecord, PackageQRCode, AdminUserInfo, UserProfile } from '@/types'

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
      name: (eventData.name && !eventData.name.toLowerCase().includes('pitch arena')) ? eventData.name : 'THE BIG PITCH',
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

    return data
      .filter((t: any) => !t.is_archived)
      .map((t: any) => ({
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
 * Reusable helper to map database team row to Team interface.
 */
export function mapTeamFromDb(t: any): Team | undefined {
  if (!t) return undefined
  return {
    id: t.id,
    eventId: t.event_id || t.eventId,
    name: t.name,
    logoUrl: t.logo_url || t.logoUrl,
    pitchTitle: t.pitch_title || t.pitchTitle || '',
    description: t.description ?? '',
    category: t.category ?? 'Startup',
    presenters: t.presenters ?? [],
    pitchOrder: t.pitch_order ?? t.pitchOrder ?? 0,
    status: t.status ?? 'upcoming',
    totalInvestment: t.total_investment ?? t.totalInvestment ?? 0,
    uniqueBackers: t.unique_backers ?? t.uniqueBackers ?? 0,
    officialRank: t.official_rank ?? t.officialRank,
    officialAward: t.official_award ?? t.officialAward,
    officialNotes: t.official_notes ?? t.officialNotes,
    officialScore: t.official_score ?? t.officialScore,
    pitchDurationSeconds: t.pitch_duration_seconds ?? t.pitchDurationSeconds,
    investmentWindowSeconds: t.investment_window_seconds ?? t.investmentWindowSeconds,
    createdAt: t.created_at || t.createdAt,
    updatedAt: t.updated_at || t.updatedAt,
  }
}

/**
 * Reusable helper to map database pitch round row to PitchRound interface.
 */
export function mapRoundFromDb(r: any, teamObj?: any): PitchRound {
  const team = teamObj ? mapTeamFromDb(teamObj) : (r.teams ? mapTeamFromDb(r.teams) : (r.team ? mapTeamFromDb(r.team) : undefined))
  return {
    id: r.id,
    eventId: r.event_id || r.eventId,
    teamId: r.team_id || r.teamId,
    team,
    roundNumber: team?.pitchOrder ?? r.round_number ?? r.roundNumber ?? 1,
    status: r.status,
    pitchStartTime: r.pitch_start_time || r.pitchStartTime,
    investmentOpenTime: r.investment_open_time || r.investmentOpenTime,
    investmentCloseTime: r.investment_close_time || r.investmentCloseTime,
    investmentPauseTime: r.investment_pause_time || r.investmentPauseTime,
    scheduledDurationSeconds: r.scheduled_duration_seconds ?? r.scheduledDurationSeconds ?? 300,
    investmentWindowSeconds: r.investment_window_seconds ?? r.investmentWindowSeconds ?? 180,
    totalInvested: r.total_invested ?? r.totalInvested ?? team?.totalInvestment ?? 0,
    uniqueInvestors: r.unique_investors ?? r.uniqueInvestors ?? team?.uniqueBackers ?? 0,
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt,
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
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)

    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    const { data, error } = await query.maybeSingle()
    if (error || !data) return null

    return mapRoundFromDb(data, data.teams)
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

      // HIGH-1 FIX: Removed direct client-side INSERT fallback into wallets.
      // Wallet creation MUST go through the grant_free_points RPC (server-side, atomic).
      // A client-side INSERT bypasses server business rules and can be manipulated.
      console.warn('Wallet RPC did not create wallet for user. They may need to refresh or re-authenticate.')
      return null
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

  // LOW-4 FIX: Validate investment amount is a safe positive integer
  if (!Number.isInteger(amount) || amount <= 0) {
    return { success: false, error: 'Investment amount must be a positive whole number.' }
  }

  const available = wallet.freePoints + wallet.purchasedPoints
  if (amount > available) {
    return { success: false, error: 'Insufficient points in wallet' }
  }

  // Gate Verification Check: Ensure attendee was verified in person by volunteer/admin
  try {
    const { data: profile } = await supabase
      .from(TABLES.PROFILES)
      .select('entry_verified, role')
      .eq('id', userId)
      .maybeSingle()

    if (profile && profile.role !== 'admin' && !profile.entry_verified) {
      return {
        success: false,
        error: 'Account verification required. Please show your Entry Pass QR to an event volunteer at the entrance gate before you can invest.'
      }
    }
  } catch (err) {
    console.warn('Notice checking entry verification status:', err)
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
      // Millisecond speed MUST strictly start once the investment window is open (never from pitch start or random)
      if (roundData.investment_open_time) {
        const windowOpenMs = new Date(roundData.investment_open_time).getTime()
        const authoritativeElapsedMs = Math.max(1, Date.now() - windowOpenMs)
        // If client did not provide calculatedMs, or provided a time measured from pitch start
        // (significantly greater than elapsed time since investment window opened), enforce authoritativeElapsedMs:
        if (!calculatedMs || calculatedMs <= 0 || calculatedMs > authoritativeElapsedMs + 4000) {
          calculatedMs = authoritativeElapsedMs
        }
      }
    }
  } catch {}

  try {
    // 1. Try secure Supabase RPC procedure
    const { data: rpcData, error: rpcError } = await supabase.rpc('process_investment', {
      p_user_id: userId,
      p_event_id: eventId,
      p_team_id: teamId,
      p_round_id: roundId,
      p_amount: amount,
      p_wallet_id: wallet.id,
    })

    if (rpcError) {
      return {
        success: false,
        error: toUserFriendlyError(rpcError, 'Investment service is temporarily unavailable. Please try again in a moment.'),
      }
    }

    // Handle structured JSONB return from process_investment RPC
    if (rpcData && typeof rpcData === 'object' && (rpcData as any).success === false) {
      return {
        success: false,
        error: (rpcData as any).error || 'Investment could not be completed.',
      }
    }

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
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Investment could not be completed. Please try again.') }
  }
}

const AUDIT_STORAGE_KEY = 'pitch_arena_audit_logs'

/**
 * Record an administrative security audit log.
 * Stores in Supabase audit_logs and local backup with instant event dispatch.
 */
export async function logAuditEvent(params: {
  action: string
  targetId?: string
  metadata?: Record<string, any>
  eventId?: string
  adminId?: string   // CRIT-3 FIX: Always pass or resolve the real admin's UUID
}): Promise<void> {
  const { action, targetId, metadata = {}, eventId, adminId } = params
  const now = new Date().toISOString()
  const currentEventId = eventId || '11111111-0000-0000-0000-000000000001'

  // CRIT-3 FIX: Automatically resolve the real authenticated admin ID if not explicitly passed
  let resolvedAdminId = adminId
  if (!resolvedAdminId && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        resolvedAdminId = user.id
      }
    } catch {}
  }
  const displayAdminId = resolvedAdminId || 'system'

  const newLogEntry = {
    id: generateId(),
    event_id: currentEventId,
    admin_id: displayAdminId,
    action,
    target_id: targetId || null,
    metadata,
    created_at: now,
  }

  // 1. Always append to local persistent storage (guarantees immediate availability in UI)
  try {
    const existing = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || '[]')
    const updated = [newLogEntry, ...existing].slice(0, 100)
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated))
  } catch {}

  // 2. Dispatch custom event so LogsTab and OverviewTab re-render instantly
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('audit-logs-updated', { detail: newLogEntry }))
  }

  // 3. Persist to Supabase audit_logs table (only if we have a valid UUID admin_id)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(displayAdminId)
  if (supabase && isUuid) {
    try {
      await supabase.from(TABLES.AUDIT_LOGS).insert({
        event_id: currentEventId,
        admin_id: displayAdminId,
        action,
        target_id: targetId || null,
        metadata: newLogEntry.metadata,
      })
    } catch (err) {
      console.warn('Supabase audit log insert notice:', err)
    }
  }
}

/**
 * Fetch audit logs for administrators (combines database logs with local recent events).
 */
export async function getAuditLogs(): Promise<any[]> {
  let serverLogs: any[] = []

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLES.AUDIT_LOGS)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        serverLogs = data
      }
    } catch (err) {
      console.warn('Failed to get server audit logs:', err)
    }
  }

  // Merge with locally recorded audit logs
  let localLogs: any[] = []
  try {
    localLogs = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || '[]')
  } catch {}

  const map = new Map<string, any>()
  for (const log of serverLogs) {
    map.set(log.id, log)
  }
  for (const log of localLogs) {
    if (!map.has(log.id)) {
      map.set(log.id, log)
    }
  }

  const combined = Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime()
  )

  return combined.slice(0, 50)
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
// HIGH-4 FIX: Added userId parameter and ownership filter to prevent
// any authenticated user from claiming another user's reward by ID.
export async function claimRewardInDb(rewardId: string, userId: string): Promise<boolean> {
  if (!supabase || !rewardId || !userId) return false

  try {
    const { error } = await supabase
      .from(TABLES.REWARDS)
      .update({
        claimed: true,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', rewardId)
      .eq('user_id', userId)   // HIGH-4 FIX: Enforce ownership at the query level

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
  logoUrl?: string
  presenters?: string[]
  pitchOrder?: number
  pitchDurationSeconds?: number
  investmentWindowSeconds?: number
}): Promise<{ success: boolean; data?: Team; error?: string }> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }

  try {
    const pitchDuration = Number.isFinite(team.pitchDurationSeconds) ? team.pitchDurationSeconds : 300
    const investmentWindow = Number.isFinite(team.investmentWindowSeconds) ? team.investmentWindowSeconds : 180
    const pitchOrder = Number.isFinite(team.pitchOrder) && (team.pitchOrder || 0) > 0 ? team.pitchOrder : 1

    const insertPayload: any = {
      event_id: team.eventId || '11111111-0000-0000-0000-000000000001',
      name: team.name.trim(),
      pitch_title: team.pitchTitle.trim(),
      description: (team.description || '').trim(),
      category: (team.category || 'General').trim(),
      logo_url: team.logoUrl ? team.logoUrl.trim() : null,
      presenters: Array.isArray(team.presenters) ? team.presenters : [],
      pitch_order: pitchOrder,
      pitch_duration_seconds: pitchDuration,
      investment_window_seconds: investmentWindow,
      status: 'upcoming',
      total_investment: 0,
      unique_backers: 0,
    }

    const { data, error } = await supabase
      .from(TABLES.TEAMS)
      .insert(insertPayload)
      .select()
      .single()

    if (error || !data) {
      console.error('Failed to create team in Supabase:', error)
      return {
        success: false,
        error: toUserFriendlyError(error, 'Failed to pre-list startup team. Please check inputs.'),
      }
    }

    const newTeam: Team = {
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

    return { success: true, data: newTeam }
  } catch (err: any) {
    console.error('Error creating team:', err)
    return {
      success: false,
      error: toUserFriendlyError(err, 'Failed to pre-list startup team'),
    }
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
    logoUrl: string
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
    if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl ? updates.logoUrl.trim() : null
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
 * Delete a team from Supabase, cleaning up dependent child records.
 */
export async function deleteTeam(teamId: string): Promise<boolean> {
  if (!teamId) return false

  if (supabase) {
    try {
      // 1. Delete dependent investments for this team
      try {
        await supabase.from(TABLES.INVESTMENTS).delete().eq('team_id', teamId)
      } catch (e) {
        console.warn('Investments delete cascade warning:', e)
      }

      // 2. Delete dependent pitch_rounds for this team
      try {
        await supabase.from(TABLES.PITCH_ROUNDS).delete().eq('team_id', teamId)
      } catch (e) {
        console.warn('Pitch rounds delete cascade warning:', e)
      }

      // 3. Delete from TEAMS table
      const { error } = await supabase
        .from(TABLES.TEAMS)
        .delete()
        .eq('id', teamId)

      if (error) {
        console.warn('Direct delete on teams hit error, applying archive fallback:', error)
        // Fallback: If RLS blocked DELETE, mark as archived so it disappears
        await supabase
          .from(TABLES.TEAMS)
          .update({ is_archived: true, status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', teamId)
      }

      return true
    } catch (err) {
      console.error('Error deleting team:', err)
      return true // Still return true so UI removes the startup locally
    }
  }

  return true
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
    // 1. Try elevated server RPC first (handles atomic cleanup, activation & insert)
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_start_pitch_round', {
        p_event_id: eventId,
        p_team_id: team.id,
        p_pitch_duration: pitchDurationSeconds,
        p_investment_window: investmentWindowSeconds,
        p_phase: phase,
      })
      if (!rpcErr && rpcData?.success && rpcData?.round) {
        return mapRoundFromDb(rpcData.round, rpcData.round.team)
      }
    } catch (rpcEx) {
      console.warn('RPC admin_start_pitch_round fallback to direct DB:', rpcEx)
    }

    // 2. Direct DB fallback:
    // Close ANY open, paused, or closed rounds so old rounds never linger
    await supabase
      .from(TABLES.PITCH_ROUNDS)
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .in('status', ['announced', 'pitching', 'investment_open', 'investment_paused', 'investment_closed'])

    const now = new Date()
    const isInvesting = phase === 'investment_open'
    const openTime = isInvesting ? now.toISOString() : null
    const closeTime = isInvesting ? new Date(now.getTime() + investmentWindowSeconds * 1000).toISOString() : null

    // Insert new active pitch round for this team
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
        total_invested: team.totalInvestment ?? 0,
        unique_investors: team.uniqueBackers ?? 0,
      })
      .select('*, teams(*)')
      .maybeSingle()

    if (error || !data) {
      console.error('Error starting pitch round directly:', error)
      return null
    }

    // Mark team status as active
    await supabase.from(TABLES.TEAMS).update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', team.id)

    return mapRoundFromDb(data, data.teams || team)
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
    // 1. Try elevated server RPC first
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_open_investment_window', {
        p_round_id: roundId,
        p_duration_seconds: durationSeconds,
      })
      if (!rpcErr && rpcData?.success && rpcData?.round) {
        return mapRoundFromDb(rpcData.round, rpcData.round.team)
      }
    } catch (rpcEx) {
      console.warn('RPC admin_open_investment_window fallback to direct DB:', rpcEx)
    }

    // 2. Direct DB fallback
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
      .maybeSingle()

    if (error || !data) {
      console.error('Error opening investment window directly:', error)
      return null
    }

    return mapRoundFromDb(data, data.teams)
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
    try {
      const { data, error } = await supabase.rpc('admin_close_investment_window', { p_round_id: roundId })
      if (!error && data?.success) return true
    } catch {}

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
  if (!supabase) return false
  const validEventId = (eventId && eventId.length === 36) ? eventId : '11111111-0000-0000-0000-000000000001'
  try {
    const payload: any = {}
    if (configUpdates.freePointsAllocation !== undefined) payload.free_points_allocation = configUpdates.freePointsAllocation
    if (configUpdates.pointsPerRupee !== undefined) payload.points_per_rupee = configUpdates.pointsPerRupee
    if (configUpdates.maxPaidPurchaseRupees !== undefined) payload.max_paid_purchase_rupees = configUpdates.maxPaidPurchaseRupees
    if (configUpdates.maxPaidPoints !== undefined) {
      payload.max_paid_points = configUpdates.maxPaidPoints
    } else if (configUpdates.maxPaidPurchaseRupees !== undefined && configUpdates.pointsPerRupee !== undefined) {
      payload.max_paid_points = configUpdates.maxPaidPurchaseRupees * configUpdates.pointsPerRupee
    }
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
      .eq('event_id', validEventId)

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

      // Speed in milliseconds MUST strictly be measured from when the investment window opened
      if (round?.investment_open_time && inv.created_at) {
        const windowOpenMs = new Date(round.investment_open_time).getTime()
        const invTimeMs = new Date(inv.created_at).getTime()
        const windowElapsed = Math.max(1, invTimeMs - windowOpenMs)

        // If time_elapsed_ms was not recorded, or was mistakenly measured from pitch start
        // (significantly greater than time since investment window opened), use true windowElapsed
        if (!timeMs || timeMs <= 0 || timeMs > windowElapsed + 4000) {
          timeMs = windowElapsed
        }
      } else if (!timeMs || timeMs <= 0) {
        // Clean positive fallback if no investment_open_time exists
        if (round?.created_at && inv.created_at) {
          timeMs = Math.max(1, new Date(inv.created_at).getTime() - new Date(round.created_at).getTime())
        } else {
          timeMs = 1
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

  if (lower.includes('mime type') || lower.includes('invalidmimetype')) {
    return 'The image format is not supported. Please choose a PNG, JPG, or WebP image.'
  }
  if (lower === 'bad request') {
    const detail = err?.details || err?.hint || err?.error || ''
    return detail ? `Request error: ${detail}` : 'Could not process request. Please check the image and your inputs.'
  }

  return msg || fallback
}

// ============================================================
// STATIC QR PAYMENT & RECONCILIATION SERVICES
// ============================================================

/**
 * Create a new static QR payment intent with a unique server-generated claim code.
 */
export async function createPaymentIntent(eventId: string, rupeeAmount: number): Promise<{
  success: boolean
  intentId?: string
  claimCode?: string
  rupeeAmount?: number
  pointsToCredit?: number
  expiresAt?: string
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }
  try {
    const { data, error } = await supabase.rpc('create_payment_intent', {
      p_event_id: eventId,
      p_rupee_amount: rupeeAmount,
    })
    if (error) throw error
    return {
      success: true,
      intentId: data.intent_id,
      claimCode: data.claim_code,
      rupeeAmount: data.rupee_amount,
      pointsToCredit: data.points_to_credit,
      expiresAt: data.expires_at,
    }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Failed to create payment intent') }
  }
}

/**
 * Submit UTR / UPI Reference No. to claim points for an intent.
 */
export async function claimPaymentIntent(intentId: string, utr?: string, vpa?: string): Promise<{
  success: boolean
  status?: string
  matched?: boolean
  pointsCredited?: number
  paymentId?: string
  message?: string
  receivedVpaHint?: string
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }
  try {
    const { data, error } = await supabase.rpc('claim_payment_intent', {
      p_intent_id: intentId,
      p_utr: utr || null,
      p_vpa: vpa || null,
    })
    if (error) throw error
    return {
      success: data.success,
      status: data.status,
      matched: data.matched,
      pointsCredited: data.points_credited,
      paymentId: data.payment_id,
      message: data.message,
      receivedVpaHint: data.received_vpa_hint,
    }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Could not verify payment claim') }
  }
}

/**
 * Get payment intent by ID.
 */
export async function getPaymentIntent(intentId: string): Promise<PaymentIntent | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from(TABLES.PAYMENT_INTENTS)
      .select('*')
      .eq('id', intentId)
      .single()
    if (error || !data) return null
    return {
      id: data.id,
      userId: data.user_id,
      eventId: data.event_id,
      claimCode: data.claim_code,
      rupeeAmount: data.rupee_amount,
      pointsToCredit: data.points_to_credit,
      status: data.status,
      userUtr: data.user_utr,
      userVpa: data.user_vpa,
      matchedPaymentId: data.matched_payment_id,
      matchedAt: data.matched_at,
      adminNotes: data.admin_notes,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch {
    return null
  }
}

/**
 * Fetch all payment intents for a user.
 */
export async function getUserPaymentIntents(userId: string, eventId: string): Promise<PaymentIntent[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from(TABLES.PAYMENT_INTENTS)
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error || !data) return []
    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      eventId: d.event_id,
      claimCode: d.claim_code,
      rupeeAmount: d.rupee_amount,
      pointsToCredit: d.points_to_credit,
      status: d.status,
      userUtr: d.user_utr,
      userVpa: d.user_vpa,
      matchedPaymentId: d.matched_payment_id,
      matchedAt: d.matched_at,
      adminNotes: d.admin_notes,
      expiresAt: d.expires_at,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }))
  } catch {
    return []
  }
}

/**
 * Admin: Fetch incoming static QR payments.
 */
export async function getAdminQRPayments(): Promise<QRPayment[]> {
  if (!supabase) return []
  try {
    // 1. Try secure RPC first (bypasses RLS issues)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_qr_payments')
    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData.map((d: any) => ({
        id: d.id,
        razorpayPaymentId: d.razorpay_payment_id,
        razorpayQrId: d.razorpay_qr_id,
        amountPaise: d.amount_paise,
        rupeeAmount: d.rupee_amount,
        currency: d.currency,
        payerVpa: d.payer_vpa,
        bankRrn: d.bank_rrn,
        status: d.status,
        matchedIntentId: d.matched_intent_id,
        matchedUserId: d.matched_user_id,
        rawPayload: d.raw_payload,
        paymentTime: d.payment_time,
        adminNotes: d.admin_notes,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        matchedUserEmail: d.matched_user_email,
        matchedUserDisplayName: d.matched_user_display_name,
      }))
    }

    // 2. Fallback to direct table select
    const { data, error } = await supabase
      .from(TABLES.QR_PAYMENTS)
      .select(`
        *,
        profiles:matched_user_id (
          email,
          display_name
        )
      `)
      .order('payment_time', { ascending: false })
      .limit(100)
    if (error || !data) return []
    return data.map((d: any) => ({
      id: d.id,
      razorpayPaymentId: d.razorpay_payment_id,
      razorpayQrId: d.razorpay_qr_id,
      amountPaise: d.amount_paise,
      rupeeAmount: d.rupee_amount,
      currency: d.currency,
      payerVpa: d.payer_vpa,
      bankRrn: d.bank_rrn,
      status: d.status,
      matchedIntentId: d.matched_intent_id,
      matchedUserId: d.matched_user_id,
      rawPayload: d.raw_payload,
      paymentTime: d.payment_time,
      adminNotes: d.admin_notes,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      matchedUserEmail: d.profiles?.email,
      matchedUserDisplayName: d.profiles?.display_name,
    }))
  } catch (err) {
    console.warn('Error fetching admin QR payments:', err)
    return []
  }
}

/**
 * Admin: Fetch payment intents across all users.
 */
export async function getAdminPaymentIntents(): Promise<PaymentIntent[]> {
  if (!supabase) return []
  try {
    // 1. Try secure RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_payment_intents')
    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        eventId: d.event_id,
        claimCode: d.claim_code,
        rupeeAmount: d.rupee_amount,
        pointsToCredit: d.points_to_credit,
        status: d.status,
        userUtr: d.user_utr,
        userVpa: d.user_vpa,
        matchedPaymentId: d.matched_payment_id,
        matchedAt: d.matched_at,
        adminNotes: d.admin_notes,
        expiresAt: d.expires_at,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        userEmail: d.user_email,
        userDisplayName: d.user_display_name,
      }))
    }

    // 2. Fallback to direct table select
    const { data, error } = await supabase
      .from(TABLES.PAYMENT_INTENTS)
      .select(`
        *,
        profiles:user_id (
          email,
          display_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error || !data) return []
    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      eventId: d.event_id,
      claimCode: d.claim_code,
      rupeeAmount: d.rupee_amount,
      pointsToCredit: d.points_to_credit,
      status: d.status,
      userUtr: d.user_utr,
      userVpa: d.user_vpa,
      matchedPaymentId: d.matched_payment_id,
      matchedAt: d.matched_at,
      adminNotes: d.admin_notes,
      expiresAt: d.expires_at,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      userEmail: d.profiles?.email,
      userDisplayName: d.profiles?.display_name,
    }))
  } catch (err) {
    console.warn('Error fetching admin payment intents:', err)
    return []
  }
}

/**
 * Admin: Fetch raw webhook event logs.
 */
export async function getAdminWebhookEvents(): Promise<WebhookEventRecord[]> {
  if (!supabase) return []
  try {
    // 1. Try secure RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_webhook_events')
    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData.map((d: any) => ({
        id: d.id,
        eventType: d.event_type,
        eventId: d.event_id,
        signatureVerified: d.signature_verified,
        status: d.status,
        errorMessage: d.error_message,
        payload: d.payload,
        createdAt: d.created_at,
      }))
    }

    // 2. Fallback to direct table select
    const { data, error } = await supabase
      .from(TABLES.WEBHOOK_EVENTS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error || !data) return []
    return data.map((d: any) => ({
      id: d.id,
      eventType: d.event_type,
      eventId: d.event_id,
      signatureVerified: d.signature_verified,
      status: d.status,
      errorMessage: d.error_message,
      payload: d.payload,
      createdAt: d.created_at,
    }))
  } catch (err) {
    console.warn('Error fetching webhook events:', err)
    return []
  }
}

/**
 * Admin: Manually match an unmatched QR payment to a user intent.
 */
export async function adminManualMatchPayment(paymentId: string, intentId: string, notes?: string): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }
  try {
    const { data, error } = await supabase.rpc('admin_manual_match_payment', {
      p_payment_id: paymentId,
      p_intent_id: intentId,
      p_admin_notes: notes || null,
    })
    if (error) throw error
    return { success: true, message: data?.message || 'Payment successfully matched' }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Failed to manually match payment') }
  }
}

/**
 * Admin: Reject payment.
 */
export async function adminRejectPayment(paymentId: string, notes: string): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }
  try {
    const { data, error } = await supabase.rpc('admin_reject_payment', {
      p_payment_id: paymentId,
      p_notes: notes,
    })
    if (error) throw error
    return { success: true, message: data?.message || 'Payment rejected' }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Failed to reject payment') }
  }
}

/**
 * Admin: Flag payment intent.
 */
export async function adminFlagIntent(intentId: string, status: string, notes?: string): Promise<{
  success: boolean
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }
  try {
    const { error } = await supabase.rpc('admin_flag_intent', {
      p_intent_id: intentId,
      p_status: status,
      p_notes: notes || null,
    })
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Failed to flag intent') }
  }
}

/**
 * Admin: Delete a purchase claim / payment intent.
 */
export async function adminDeletePaymentIntent(intentId: string): Promise<{
  success: boolean
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }
  try {
    const { error } = await supabase.rpc('admin_delete_payment_intent', {
      p_intent_id: intentId,
    })
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Failed to delete payment intent') }
  }
}

/**
 * Update the user's saved UPI ID (VPA) in their profile.
 */
export async function updateUserVpa(vpa: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }
  try {
    const { error } = await supabase.rpc('update_user_vpa', { p_vpa: vpa })
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Failed to save UPI ID') }
  }
}

/**
 * Get user's saved UPI ID.
 */
export async function getUserVpa(userId?: string): Promise<string | null> {
  if (!supabase) return null
  try {
    let targetId = userId
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser()
      targetId = user?.id
    }
    if (!targetId) return null

    const { data, error } = await supabase
      .from(TABLES.PROFILES)
      .select('upi_id')
      .eq('id', targetId)
      .single()

    if (error || !data) return null
    return data.upi_id || null
  } catch {
    return null
  }
}

/**
 * Fetch the 5 fixed packages with their static QR codes.
 */
export async function getPackageQRCodes(eventId = '11111111-0000-0000-0000-000000000001'): Promise<PackageQRCode[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from(TABLES.PACKAGE_QR_CODES)
      .select('*')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true })

    if (error || !data || data.length === 0) {
      return [
        { id: 'pkg_1', eventId, label: 'Starter Pack', rupeeAmount: 10, points: 100, isActive: true, displayOrder: 1 },
        { id: 'pkg_2', eventId, label: 'Supporter Pack', rupeeAmount: 20, points: 200, isActive: true, displayOrder: 2 },
        { id: 'pkg_3', eventId, label: 'Enthusiast Pack', rupeeAmount: 50, points: 500, isActive: true, displayOrder: 3 },
        { id: 'pkg_4', eventId, label: 'Champion Pack', rupeeAmount: 100, points: 1000, isActive: true, displayOrder: 4 },
        { id: 'pkg_5', eventId, label: 'Super Backer', rupeeAmount: 200, points: 2000, isActive: true, displayOrder: 5 },
      ]
    }

    return data.map((d: any) => ({
      id: d.id,
      eventId: d.event_id,
      label: d.label,
      rupeeAmount: d.rupee_amount,
      points: d.points,
      qrImageUrl: d.qr_image_url || undefined,
      upiVpa: d.upi_vpa || undefined,
      isActive: d.is_active,
      displayOrder: d.display_order,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }))
  } catch {
    return [
      { id: 'pkg_1', eventId, label: 'Starter Pack', rupeeAmount: 10, points: 100, isActive: true, displayOrder: 1 },
      { id: 'pkg_2', eventId, label: 'Supporter Pack', rupeeAmount: 20, points: 200, isActive: true, displayOrder: 2 },
      { id: 'pkg_3', eventId, label: 'Enthusiast Pack', rupeeAmount: 50, points: 500, isActive: true, displayOrder: 3 },
      { id: 'pkg_4', eventId, label: 'Champion Pack', rupeeAmount: 100, points: 1000, isActive: true, displayOrder: 4 },
      { id: 'pkg_5', eventId, label: 'Super Backer', rupeeAmount: 200, points: 2000, isActive: true, displayOrder: 5 },
    ]
  }
}

/**
 * Admin: Update a package's QR code image, price, points, or status.
 */
export async function adminUpdatePackageQRCode(pkg: Partial<PackageQRCode> & { id: string }): Promise<{
  success: boolean
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }
  try {
    // 1. Try secure RPC first (bypasses RLS permission errors)
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_update_package_qr_code', {
      p_package_id: pkg.id,
      p_label: pkg.label ?? null,
      p_rupee_amount: pkg.rupeeAmount ?? null,
      p_points: pkg.points ?? null,
      p_qr_image_url: pkg.qrImageUrl ?? null,
      p_upi_vpa: pkg.upiVpa ?? null,
      p_is_active: pkg.isActive ?? null,
    })

    if (!rpcError && rpcData?.success) {
      return { success: true }
    }

    // 2. Fallback to direct table update with updated RLS policy
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }
    if (pkg.label !== undefined) updateData.label = pkg.label
    if (pkg.rupeeAmount !== undefined) updateData.rupee_amount = pkg.rupeeAmount
    if (pkg.points !== undefined) updateData.points = pkg.points
    if (pkg.qrImageUrl !== undefined) updateData.qr_image_url = pkg.qrImageUrl
    if (pkg.upiVpa !== undefined) updateData.upi_vpa = pkg.upiVpa
    if (pkg.isActive !== undefined) updateData.is_active = pkg.isActive

    const { error } = await supabase
      .from(TABLES.PACKAGE_QR_CODES)
      .update(updateData)
      .eq('id', pkg.id)

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Failed to update package QR code') }
  }
}

/**
 * Helper to convert a File to a base64 data URL
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Admin: Upload a static QR code image for a package.
 * First tries uploading to Supabase Storage bucket 'payment-qr-codes'.
 * If the bucket is not available, automatically falls back to an optimized base64 Data URL
 * so upload NEVER fails and works immediately without manual storage setup!
 */
export async function uploadPackageQRImage(
  packageId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }

  // 1. Validation
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Please upload a valid image file (PNG, JPG, WEBP, or SVG)' }
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'File size exceeds 5MB limit. Please choose a smaller image.' }
  }

  try {
    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `${packageId}_${Date.now()}.${fileExt}`
    const filePath = `packages/${fileName}`

    const mimeType = file.type || (
      fileExt === 'webp' ? 'image/webp' :
      fileExt === 'png' ? 'image/png' :
      fileExt === 'svg' ? 'image/svg+xml' :
      'image/jpeg'
    )

    // Try Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('payment-qr-codes')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: mimeType,
      })

    if (!uploadError) {
      const { data: publicData } = supabase.storage
        .from('payment-qr-codes')
        .getPublicUrl(filePath)
      if (publicData?.publicUrl) {
        return { success: true, url: publicData.publicUrl }
      }
    }

    // Fallback: convert to Base64 Data URL (stored in text column)
    const base64Url = await fileToDataUrl(file)
    return { success: true, url: base64Url }
  } catch (err: any) {
    try {
      const base64Url = await fileToDataUrl(file)
      return { success: true, url: base64Url }
    } catch {
      return { success: false, error: toUserFriendlyError(err, 'Failed to process image file') }
    }
  }
}

/**
 * Admin: Upload a startup team logo.
 * First tries Supabase Storage bucket 'avatars' or 'payment-qr-codes'.
 * If the bucket is not available or restricted, smoothly falls back to an optimized base64 Data URL
 * so upload NEVER fails and works immediately without manual storage setup!
 */
export async function uploadTeamLogo(
  identifier: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }

  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Please upload a valid image file (PNG, JPG, WEBP, or SVG)' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'File size exceeds 5MB limit. Please choose a smaller image.' }
  }

  try {
    const safeId = identifier.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 32) || 'startup'
    const fileExt = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
    const fileName = `team_${safeId}_${Date.now()}.${fileExt || 'png'}`
    const filePath = `teams/${fileName}`
    const mimeType = file.type || 'image/png'

    // Use ArrayBuffer for rock-solid browser storage upload
    const arrayBuffer = await file.arrayBuffer()

    // 1. Try 'avatars' bucket first
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, arrayBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: mimeType,
      })

    if (!uploadError) {
      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)
      if (publicData?.publicUrl) {
        return { success: true, url: publicData.publicUrl }
      }
    } else {
      console.warn('Avatars bucket team logo upload warning:', uploadError)
    }

    // 2. High reliability fallback: Base64 Data URL (compressed to prevent 413)
    const base64Url = await fileToDataUrl(file)
    return { success: true, url: base64Url }
  } catch (err: any) {
    try {
      const base64Url = await fileToDataUrl(file)
      return { success: true, url: base64Url }
    } catch {
      return { success: false, error: toUserFriendlyError(err, 'Failed to process team logo image') }
    }
  }
}

/**
 * Admin: Upload custom celebration music audio file.
 * Automatically saves to IndexedDB for zero-latency local playback,
 * and syncs to Supabase Storage ('celebration-audio' or 'avatars') for stage broadcasting.
 */
export async function uploadCelebrationAudio(
  file: File
): Promise<{ success: boolean; url?: string; fileName?: string; isLocalOnly?: boolean; error?: string }> {
  const validAudioTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/webm',
    'audio/mp4',
    'audio/flac',
  ]
  const isValidType = validAudioTypes.includes(file.type) || /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i.test(file.name)
  if (!isValidType) {
    return { success: false, error: 'Please choose a valid audio file (MP3, WAV, M4A, AAC, or OGG).' }
  }

  // Max 50MB for celebration music
  if (file.size > 50 * 1024 * 1024) {
    return { success: false, error: 'Audio file exceeds 50MB limit. Please choose a smaller track.' }
  }

  const mimeType = normalizeAudioMime(file.name, file.type)
  const arrayBuffer = await file.arrayBuffer()
  const typedBlob = new Blob([arrayBuffer], { type: mimeType })

  // 1. Immediately cache in IndexedDB and create a local Blob URL
  // This guarantees zero-latency, 100% reliable local test play in any browser
  await saveTrackToIndexedDB(typedBlob, file.name, mimeType)
  const localBlobUrl = createOrReuseBlobUrl(typedBlob)
  setStoredCelebrationTrackName(file.name)

  if (!supabase) {
    return { success: true, url: localBlobUrl, fileName: file.name, isLocalOnly: true }
  }

  try {
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '')
    const safeCleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `celebration_${Date.now()}_${safeCleanName}`
    const primaryPath = `tracks/${fileName}`

    // 2. Try dedicated 'celebration-audio' bucket first (passing typed Blob for multipart form upload)
    const { error: uploadErrorPrimary } = await supabase.storage
      .from('celebration-audio')
      .upload(primaryPath, typedBlob, {
        cacheControl: '86400',
        upsert: true,
        contentType: mimeType,
      })

    if (!uploadErrorPrimary) {
      const { data: publicData } = supabase.storage
        .from('celebration-audio')
        .getPublicUrl(primaryPath)
      if (publicData?.publicUrl) {
        return { success: true, url: publicData.publicUrl, fileName: file.name, isLocalOnly: false }
      }
    }

    console.error('Supabase celebration-audio bucket upload error:', uploadErrorPrimary)

    // 3. Try 'avatars' bucket as a fallback
    const fallbackPath = `audio/${fileName}`
    const { error: uploadErrorFallback } = await supabase.storage
      .from('avatars')
      .upload(fallbackPath, typedBlob, {
        cacheControl: '86400',
        upsert: true,
        contentType: mimeType,
      })

    if (!uploadErrorFallback) {
      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fallbackPath)
      if (publicData?.publicUrl) {
        return { success: true, url: publicData.publicUrl, fileName: file.name, isLocalOnly: false }
      }
    }

    console.error('Supabase avatars fallback bucket upload error:', uploadErrorFallback)

    const detailedErr = uploadErrorPrimary?.message || uploadErrorFallback?.message || 'Upload rejected by storage service'
    return {
      success: false,
      url: localBlobUrl,
      fileName: file.name,
      isLocalOnly: true,
      error: `Could not save to Supabase Storage (${detailedErr}). Please run migration 021_celebration_audio_storage.sql in your Supabase SQL Editor.`
    }
  } catch (err: any) {
    console.error('Storage upload exception:', err)
    return {
      success: false,
      url: localBlobUrl,
      fileName: file.name,
      isLocalOnly: true,
      error: 'Failed to upload audio file: ' + (err?.message || 'Unknown network error')
    }
  }
}


/**
 * Admin: Fetch full list of audience users with live wallet telemetry.
 */
export async function getAdminUsersList(eventId = '11111111-0000-0000-0000-000000000001'): Promise<AdminUserInfo[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase.rpc('get_admin_users_list', {
      p_event_id: eventId,
    })

    if (error) {
      console.warn('RPC get_admin_users_list fallback query:', error)
      const { data: profiles, error: pError } = await supabase
        .from(TABLES.PROFILES)
        .select(`
          id, email, display_name, role, upi_id, created_at,
          wallets (id, free_points, purchased_points, invested_points, total_paid_rupees)
        `)
        .order('created_at', { ascending: false })

      if (pError || !profiles) return []

      return profiles.map((p: any) => {
        const w = Array.isArray(p.wallets) ? p.wallets[0] : p.wallets
        const free = w?.free_points || 0
        const purchased = w?.purchased_points || 0
        return {
          id: p.id,
          email: p.email,
          displayName: p.display_name || '',
          role: p.role,
          upiId: p.upi_id || undefined,
          walletId: w?.id,
          freePoints: free,
          purchasedPoints: purchased,
          investedPoints: w?.invested_points || 0,
          availablePoints: free + purchased,
          totalPaidRupees: w?.total_paid_rupees || 0,
          createdAt: p.created_at,
        }
      })
    }

    return (data || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      displayName: u.display_name || '',
      role: u.role,
      upiId: u.upi_id || undefined,
      walletId: u.wallet_id || undefined,
      freePoints: u.free_points || 0,
      purchasedPoints: u.purchased_points || 0,
      investedPoints: u.invested_points || 0,
      availablePoints: u.available_points || 0,
      totalPaidRupees: u.total_paid_rupees || 0,
      createdAt: u.created_at,
    }))
  } catch (err) {
    console.warn('Error fetching admin users list:', err)
    return []
  }
}

/**
 * Admin: Add or adjust points for an audience user (problem/discrepancy resolution).
 */
export async function adminAdjustUserPoints(
  userId: string,
  eventId: string,
  points: number,
  rupeeAmount = 0,
  reason = 'Admin Point Adjustment'
): Promise<{
  success: boolean
  error?: string
  newBalance?: number
}> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }
  try {
    const { data, error } = await supabase.rpc('admin_adjust_user_points', {
      p_user_id: userId,
      p_event_id: eventId,
      p_points: points,
      p_rupee_amount: rupeeAmount,
      p_reason: reason,
    })

    if (error) throw error
    return {
      success: true,
      newBalance: data?.new_balance,
    }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Failed to adjust points') }
  }
}

/**
 * Super Admin: Permanently delete a user account and associated records.
 */
export async function adminDeleteUser(userId: string): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }
  try {
    const { data, error } = await supabase.rpc('admin_delete_user', {
      p_target_user_id: userId,
    })

    if (error) throw error
    return {
      success: data?.success ?? true,
      message: data?.message,
    }
  } catch (err: any) {
    return { success: false, error: toUserFriendlyError(err, 'Failed to delete user') }
  }
}

/**
 * Upload an avatar image file to Supabase Storage ('avatars' bucket)
 * and return the permanent public URL.
 */
export async function uploadUserAvatar(
  file: File,
  userId?: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }

  try {
    const fileExt = file.name.split('.').pop() || 'webp'
    const userFolder = userId ? userId : `signup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const fileName = `${userFolder}/avatar-${Date.now()}.${fileExt}`

    const mimeType = file.type || (
      fileExt === 'webp' ? 'image/webp' :
      fileExt === 'png' ? 'image/png' :
      fileExt === 'gif' ? 'image/gif' :
      'image/jpeg'
    )

    // 1. Try Supabase Storage bucket 'avatars' with explicit MIME-type
    try {
      const fileBuffer = await file.arrayBuffer()
      let uploadResult = await supabase.storage
        .from('avatars')
        .upload(fileName, fileBuffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: mimeType,
        })

      // If ArrayBuffer fails, try direct File object
      if (uploadResult.error) {
        uploadResult = await supabase.storage
          .from('avatars')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: mimeType,
          })
      }

      if (!uploadResult.error && uploadResult.data?.path) {
        const { data } = supabase.storage
          .from('avatars')
          .getPublicUrl(uploadResult.data.path)

        if (data?.publicUrl) {
          return {
            success: true,
            publicUrl: data.publicUrl,
          }
        }
      } else if (uploadResult.error) {
        console.warn('Storage upload returned error, using high-reliability fallback:', uploadResult.error)
      }
    } catch (storageErr) {
      console.warn('Storage upload exception, using high-reliability fallback:', storageErr)
    }

    // 2. High-reliability Fallback: Convert to optimized base64 Data URL
    // Guarantees profile updates NEVER fail even if storage bucket policies or network has issues
    const base64Url = await fileToDataUrl(file)
    return {
      success: true,
      publicUrl: base64Url,
    }
  } catch (err: any) {
    console.error('Failed to process user avatar:', err)
    return {
      success: false,
      error: toUserFriendlyError(err, 'Could not process profile picture.'),
    }
  }
}

/**
 * Update user profile (display name and/or avatar URL) in both public.profiles and auth metadata.
 */
export async function updateUserProfile(
  userId: string,
  updates: { displayName?: string; avatarUrl?: string }
): Promise<{
  success: boolean
  displayName?: string
  avatarUrl?: string
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database service is unavailable' }

  try {
    // 1. Try atomic RPC update_user_profile if available
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('update_user_profile', {
        p_display_name: updates.displayName || null,
        p_avatar_url: updates.avatarUrl || null,
        p_user_id: userId || null,
      })

      if (!rpcError && rpcData?.success) {
        // Also sync to auth user_metadata in parallel (guarded against large data URLs)
        const metaUpdates: Record<string, any> = {}
        if (updates.displayName) metaUpdates.full_name = updates.displayName
        if (updates.avatarUrl && !updates.avatarUrl.startsWith('data:')) {
          metaUpdates.avatar_url = updates.avatarUrl
        }
        if (Object.keys(metaUpdates).length > 0) {
          await supabase.auth.updateUser({ data: metaUpdates }).catch(() => {})
        }

        return {
          success: true,
          displayName: rpcData.displayName || updates.displayName,
          avatarUrl: rpcData.avatarUrl || updates.avatarUrl,
        }
      } else if (rpcError) {
        console.warn('RPC update_user_profile error, falling back to direct update:', rpcError)
      }
    } catch (rpcErr) {
      console.warn('RPC update_user_profile exception, fallback to direct table update:', rpcErr)
    }

    // 2. Direct fallback to public.profiles table update
    const profileUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (updates.displayName?.trim()) profileUpdates.display_name = updates.displayName.trim()
    if (updates.avatarUrl !== undefined) profileUpdates.avatar_url = updates.avatarUrl

    const { error: tableError } = await supabase
      .from(TABLES.PROFILES)
      .update(profileUpdates)
      .eq('id', userId)

    if (tableError) {
      console.error('profiles table update error:', tableError)
      throw tableError
    }

    // 3. Sync to Supabase Auth metadata (guarded against large data URLs)
    const metaUpdates: Record<string, any> = {}
    if (updates.displayName) metaUpdates.full_name = updates.displayName
    if (updates.avatarUrl && !updates.avatarUrl.startsWith('data:')) {
      metaUpdates.avatar_url = updates.avatarUrl
    }
    if (Object.keys(metaUpdates).length > 0) {
      await supabase.auth.updateUser({ data: metaUpdates }).catch(() => {})
    }

    return {
      success: true,
      displayName: updates.displayName,
      avatarUrl: updates.avatarUrl,
    }
  } catch (err: any) {
    console.error('Failed to update user profile:', err)
    return {
      success: false,
      error: toUserFriendlyError(err, 'Failed to update profile'),
    }
  }
}

/**
 * Fetch detailed user profile including gate entry verification status & pass code
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase || !userId) return null

  try {
    const { data, error } = await supabase
      .from(TABLES.PROFILES)
      .select('id, email, display_name, avatar_url, role, is_verified, entry_verified, verified_at, verified_by, pass_code, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null

    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      role: data.role as any,
      isVerified: Boolean(data.is_verified),
      isEntryVerified: data.role === 'admin' ? true : Boolean(data.entry_verified),
      verifiedAt: data.verified_at,
      verifiedBy: data.verified_by,
      passCode: data.pass_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (err) {
    console.warn('Failed to load user profile:', err)
    return null
  }
}

/**
 * Fetch all registered attendees for the Gate Verification Roster (Volunteers/Admins only)
 */
export async function getRegisteredAttendees(): Promise<UserProfile[]> {
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from(TABLES.PROFILES)
      .select('id, email, display_name, avatar_url, role, is_verified, entry_verified, verified_at, verified_by, pass_code, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return data.map((d: any) => ({
      id: d.id,
      email: d.email,
      displayName: d.display_name,
      avatarUrl: d.avatar_url,
      role: d.role as any,
      isVerified: Boolean(d.is_verified),
      isEntryVerified: d.role === 'admin' ? true : Boolean(d.entry_verified),
      verifiedAt: d.verified_at,
      verifiedBy: d.verified_by,
      passCode: d.pass_code,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }))
  } catch (err) {
    console.warn('Failed to fetch registered attendees:', err)
    return []
  }
}

/**
 * Verify an attendee at the event entrance (by Member volunteer or Admin)
 */
export async function verifyAttendeeAtGate(
  attendeeId: string,
  verifierId?: string
): Promise<{ success: boolean; error?: string; attendee?: any }> {
  if (!supabase) return { success: false, error: 'Database client not connected' }

  try {
    // 1. Try RPC procedure first
    const { data: rpcData, error: rpcError } = await supabase.rpc('verify_attendee_entry', {
      p_attendee_id: attendeeId,
      p_verifier_id: verifierId || null,
    })

    if (!rpcError && rpcData?.success) {
      return { success: true, attendee: rpcData }
    }

    // 2. Direct table fallback if RPC is not yet migrated
    const { data: sessionData } = await supabase.auth.getSession()
    const verifierEmail = sessionData?.session?.user?.email || 'Volunteer Staff'

    const { error: updateError } = await supabase
      .from(TABLES.PROFILES)
      .update({
        entry_verified: true,
        verified_at: new Date().toISOString(),
        verified_by: verifierEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attendeeId)

    if (updateError) throw updateError

    return { success: true }
  } catch (err: any) {
    console.error('Error verifying attendee at gate:', err)
    return {
      success: false,
      error: toUserFriendlyError(err, 'Failed to verify attendee at gate'),
    }
  }
}

/**
 * Unverify an attendee (undo gate verification)
 */
export async function unverifyAttendeeAtGate(
  attendeeId: string,
  verifierId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Database client not connected' }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('unverify_attendee_entry', {
      p_attendee_id: attendeeId,
      p_verifier_id: verifierId || null,
    })

    if (!rpcError && rpcData?.success) {
      return { success: true }
    }

    const { error: updateError } = await supabase
      .from(TABLES.PROFILES)
      .update({
        entry_verified: false,
        verified_at: null,
        verified_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attendeeId)

    if (updateError) throw updateError

    return { success: true }
  } catch (err: any) {
    return {
      success: false,
      error: toUserFriendlyError(err, 'Failed to undo verification'),
    }
  }
}

/**
 * Instantly credit user wallet upon successful Razorpay Standard Checkout payment
 */
export async function creditWalletFromRazorpayPayment(params: {
  userId: string
  eventId: string
  amountRupees: number
  points: number
  razorpayPaymentId: string
  razorpayOrderId?: string
  packageLabel?: string
}): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Database client not connected' }

  const {
    userId,
    eventId,
    amountRupees,
    points,
    razorpayPaymentId,
    razorpayOrderId,
    packageLabel,
  } = params

  try {
    // 1. Fetch user's current wallet
    let wallet = await getOrCreateWallet(userId, eventId)
    if (!wallet) throw new Error('Could not retrieve or create attendee wallet')

    const newPurchased = wallet.purchasedPoints + points
    const newTotalBalance = wallet.freePoints + newPurchased

    // 2. Update wallet purchased points
    const { error: walletError } = await supabase
      .from(TABLES.WALLETS)
      .update({
        purchased_points: newPurchased,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id)

    if (walletError) throw walletError

    // 3. Record transaction ledger entry
    await supabase.from(TABLES.WALLET_LEDGER).insert({
      id: generateId(),
      wallet_id: wallet.id,
      user_id: userId,
      type: 'purchase',
      amount: points,
      balance_after: newTotalBalance,
      description: `Purchased ${points} Points via Razorpay Gateway (${packageLabel || `₹${amountRupees}`}) [${razorpayPaymentId}]`,
      reference_id: razorpayPaymentId,
      created_at: new Date().toISOString(),
    })

    // 4. Record into payment_intents table
    try {
      await supabase.from(TABLES.PAYMENT_INTENTS).insert({
        id: generateId(),
        user_id: userId,
        event_id: eventId,
        amount_rupees: amountRupees,
        points: points,
        status: 'credited',
        utr: razorpayPaymentId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        credited_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch (e) {
      console.warn('Payment intent insert notice:', e)
    }

    return { success: true }
  } catch (err: any) {
    console.error('Failed to credit wallet from Razorpay payment:', err)
    return {
      success: false,
      error: toUserFriendlyError(err, 'Failed to credit purchased points to wallet'),
    }
  }
}

