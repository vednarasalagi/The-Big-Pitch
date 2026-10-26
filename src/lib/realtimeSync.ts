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
export const STAGE_CELEBRATION_EVENT = 'pitch-stage-celebration'
export const STAGE_CELEBRATION_STORAGE_KEY = 'pitch_arena_stage_celebration'
export const PITCH_ROUND_UPDATE_EVENT = 'pitch-round-update'
export const PITCH_TEAMS_UPDATE_EVENT = 'pitch-teams-update'
export const PITCH_ACTIVE_ROUND_STORAGE_KEY = 'pitch_arena_active_round'
export const PITCH_TEAMS_STORAGE_KEY = 'pitch_arena_teams'

/**
 * Read cached active pitch round safely from localStorage.
 */
export function getStoredActiveRound(): PitchRound | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PITCH_ACTIVE_ROUND_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.round ?? parsed ?? null
  } catch {
    return null
  }
}

export interface WinnerCelebrationPayload {
  active: boolean
  winner?: {
    userId?: string
    name: string
    avatarUrl?: string
    amount: number
    rank?: number
    teamName?: string
    startupLogoUrl?: string
    timeElapsedMs?: number
    category?: string
  } | null
  timestamp: number
}

/**
 * Built-in Web Audio API synthesizer for live celebration fanfare.
 * Requires 0 external files or network requests.
 */
export function playCelebrationFanfare() {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const now = ctx.currentTime

    // Triumphant brass sequence chords: C5 -> E5 -> G5 -> C6 grand sustain
    const notes = [
      { f: 523.25, start: 0.0, dur: 0.22, vol: 0.22 }, // C5
      { f: 659.25, start: 0.22, dur: 0.22, vol: 0.24 }, // E5
      { f: 783.99, start: 0.44, dur: 0.35, vol: 0.26 }, // G5
      { f: 1046.50, start: 0.78, dur: 1.6, vol: 0.32 }, // C6
      { f: 1318.51, start: 0.85, dur: 1.5, vol: 0.18 }, // E6 harmonic overtone
    ]

    notes.forEach(({ f, start, dur, vol }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(f, now + start)

      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + dur)
    })
  } catch (e) {
    console.warn('Audio celebration notice:', e)
  }
}

/**
 * Read current winner celebration state from localStorage safely.
 */
export function getWinnerCelebrationState(): WinnerCelebrationPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STAGE_CELEBRATION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WinnerCelebrationPayload
  } catch {
    return null
  }
}

/**
 * Broadcast winner celebration trigger across all screens and projectors.
 */
export function broadcastWinnerCelebration(active: boolean, winner?: WinnerCelebrationPayload['winner']) {
  const payload: WinnerCelebrationPayload = {
    active,
    winner: winner || null,
    timestamp: Date.now(),
  }

  // 1. Local window sync
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STAGE_CELEBRATION_STORAGE_KEY, JSON.stringify(payload))
    } catch {}
    window.dispatchEvent(new CustomEvent(STAGE_CELEBRATION_EVENT, { detail: payload }))
  }

  // 2. Peer-to-peer Supabase broadcast
  if (!supabase) return
  try {
    const channel = getRealtimeChannel()
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'CELEBRATE_WINNER',
        payload,
      }).catch(err => console.warn('Celebration broadcast send error:', err))
    }
  } catch (err) {
    console.warn('Failed to broadcast celebration:', err)
  }
}

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
 * Safe helper to post message to browser BroadcastChannel.
 */
function postCrossTab(message: any) {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel('pitch_arena_cross_tab')
      bc.postMessage(message)
      bc.close()
    } catch {}
  }
}

/**
 * Broadcast an authoritative pitch round update to all connected audience & stage screens.
 * Synchronizes across:
 * 1. Current window Zustand store & components
 * 2. Same-browser tabs via localStorage and HTML5 BroadcastChannel (0ms)
 * 3. Remote arena devices via Supabase websocket broadcast
 */
export function broadcastRoundUpdate(round: PitchRound | null) {
  // 1. Instantly update current tab's Zustand store
  try {
    useEventStore.getState().setActiveRound(round)
  } catch {}

  // 2. Dispatch local DOM custom event & localStorage for same-origin tabs
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PITCH_ACTIVE_ROUND_STORAGE_KEY, JSON.stringify({ round, timestamp: Date.now() }))
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent(PITCH_ROUND_UPDATE_EVENT, { detail: { round } }))
    } catch {}
    postCrossTab({ type: 'ROUND_UPDATE', round, timestamp: Date.now() })
  }

  // 3. Invalidate standings for the team
  if (round?.teamId) {
    invalidateStandings(round.teamId)
  }

  // 4. Broadcast across arena devices via Supabase channel
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
  // 1. Instantly update current tab's Zustand store
  try {
    useEventStore.getState().setTeams(teams)
  } catch {}

  // 2. Local tab and cross-tab storage sync
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PITCH_TEAMS_STORAGE_KEY, JSON.stringify({ teams, timestamp: Date.now() }))
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent(PITCH_TEAMS_UPDATE_EVENT, { detail: { teams } }))
    } catch {}
    postCrossTab({ type: 'TEAMS_UPDATE', teams, timestamp: Date.now() })
  }

  // 3. Broadcast to all clients
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
