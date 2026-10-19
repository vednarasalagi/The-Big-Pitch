// ============================================================
// Realtime Sync Service — The Big Pitch Live Synchronization Engine
// Bulletproof multi-tier architecture:
// 1. Supabase Realtime Broadcast (instant 0-latency peer-to-peer push)
// 2. Postgres CDC (supabase_realtime table replication)
// 3. Smart Heartbeat Poller (resilient 2s fallback for dropped websockets / sleep)
// 4. Focus & Wakeup Re-synchronizer (instant sync when phone screen unlocks)
// ============================================================

import { supabase, TABLES } from './supabase'
import { getActivePitchRound, getTeams, getOrCreateWallet, getActiveEvent } from './supabaseApi'
import { useEventStore, useWalletStore, useAuthStore } from '@/store'
import type { PitchRound, Team } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export const REALTIME_CHANNEL_NAME = 'the-big-pitch-sync'
export const STANDINGS_INVALIDATE_EVENT = 'pitch-standings-invalidate'

let _syncChannel: RealtimeChannel | null = null

/**
 * Returns the singleton broadcast channel for live pitch events.
 */
export function getRealtimeChannel(): RealtimeChannel | null {
  if (!supabase) return null
  if (!_syncChannel) {
    _syncChannel = supabase.channel(REALTIME_CHANNEL_NAME, {
      config: {
        broadcast: { ack: false, self: false },
      },
    })
  }
  return _syncChannel
}

/**
 * Broadcast an authoritative pitch round update to all connected audience & stage screens.
 */
export function broadcastRoundUpdate(round: PitchRound | null) {
  if (!supabase) return
  try {
    const channel = getRealtimeChannel()
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'ROUND_UPDATE',
        payload: { round, timestamp: Date.now() },
      }).catch(err => console.warn('Broadcast send error:', err))
    }
  } catch (err) {
    console.warn('Failed to broadcast round update:', err)
  }
}

/**
 * Broadcast an updated teams lineup (order, scores, status) to all connected devices.
 */
export function broadcastTeamsUpdate(teams: Team[]) {
  if (!supabase) return
  try {
    const channel = getRealtimeChannel()
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'TEAMS_UPDATE',
        payload: { teams, timestamp: Date.now() },
      }).catch(err => console.warn('Broadcast send error:', err))
    }
  } catch (err) {
    console.warn('Failed to broadcast teams update:', err)
  }
}

/**
 * Broadcast an investment deployment in real time across the arena.
 */
export function broadcastInvestmentMade(
  teamId: string,
  amount: number,
  totalInvestment?: number,
  uniqueBackers?: number,
  userId?: string
) {
  // Invalidate local standings immediately
  invalidateStandings(teamId)

  if (!supabase) return
  try {
    const channel = getRealtimeChannel()
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'INVESTMENT_MADE',
        payload: {
          teamId,
          amount,
          totalInvestment,
          uniqueBackers,
          userId,
          timestamp: Date.now(),
        },
      }).catch(err => console.warn('Broadcast send error:', err))
    }
  } catch (err) {
    console.warn('Failed to broadcast investment:', err)
  }
}

/**
 * Invalidate client standings caches and trigger immediate re-fetch on all mounted standings components.
 */
export function invalidateStandings(teamId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STANDINGS_INVALIDATE_EVENT, { detail: { teamId } }))
  }
}

/**
 * Deep equality check for pitch rounds to avoid spurious React re-renders.
 */
export function isRoundEqual(a: PitchRound | null, b: PitchRound | null): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    a.id === b.id &&
    a.teamId === b.teamId &&
    a.status === b.status &&
    a.investmentOpenTime === b.investmentOpenTime &&
    a.investmentCloseTime === b.investmentCloseTime &&
    a.investmentPauseTime === b.investmentPauseTime &&
    a.scheduledDurationSeconds === b.scheduledDurationSeconds &&
    a.investmentWindowSeconds === b.investmentWindowSeconds &&
    a.totalInvested === b.totalInvested &&
    a.uniqueInvestors === b.uniqueInvestors &&
    a.team?.id === b.team?.id &&
    a.team?.status === b.team?.status &&
    a.team?.totalInvestment === b.team?.totalInvestment &&
    a.team?.uniqueBackers === b.team?.uniqueBackers
  )
}

/**
 * Deep equality check for teams list to prevent unnecessary UI thrashing.
 */
export function areTeamsEqual(a: Team[], b: Team[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const tA = a[i]
    const tB = b[i]
    if (
      tA.id !== tB.id ||
      tA.status !== tB.status ||
      tA.pitchOrder !== tB.pitchOrder ||
      tA.totalInvestment !== tB.totalInvestment ||
      tA.uniqueBackers !== tB.uniqueBackers ||
      tA.officialRank !== tB.officialRank ||
      tA.officialScore !== tB.officialScore
    ) {
      return false
    }
  }
  return true
}

/**
 * Performs a complete server state re-synchronization.
 * Compares snapshots and only mutates Zustand store if data genuinely changed.
 */
export async function syncLiveState(): Promise<void> {
  const currentEvent = useEventStore.getState().event
  const eventId = currentEvent?.id

  try {
    const [round, teams] = await Promise.all([
      getActivePitchRound(eventId),
      getTeams(eventId),
    ])

    const state = useEventStore.getState()

    // 1. Check if active round changed
    if (!isRoundEqual(state.activeRound, round)) {
      state.setActiveRound(round)
    }

    // 2. Check if teams changed
    if (teams.length > 0 && !areTeamsEqual(state.teams, teams)) {
      state.setTeams(teams)
    }

    // 3. Sync user wallet if logged in
    const user = useAuthStore.getState().user
    if (user && eventId) {
      const currentWallet = useWalletStore.getState().wallet
      const freshWallet = await getOrCreateWallet(user.id, eventId)
      if (freshWallet && currentWallet) {
        if (
          freshWallet.freePoints !== currentWallet.freePoints ||
          freshWallet.purchasedPoints !== currentWallet.purchasedPoints ||
          freshWallet.investedPoints !== currentWallet.investedPoints
        ) {
          useWalletStore.getState().setWallet(freshWallet)
        }
      }
    }
  } catch (err) {
    console.warn('Realtime polling sync notice:', err)
  }
}
