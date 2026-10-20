// ============================================================
// Global App Store — Zustand (Production Architecture)
// Clean state management powered by Supabase.
// ============================================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  UserProfile, Event, Team, PitchRound, Wallet,
  WalletLedgerEntry, Investment, Notification, Reward,
  LivePitchState, EventConfig, ActivityItem,
} from '@/types'
import { resolveUserRole } from '@/lib/adminConfig'
import { supabase } from '@/lib/supabase'

// ── 1. Auth Store ──────────────────────────────────────────
interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  setUser: (user: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      setUser: (user) => {
        if (!user) {
          set({ user: null })
          return
        }
        const verifiedRole = resolveUserRole(user.email)
        set({ user: { ...user, role: verifiedRole } })
      },
      setLoading: (isLoading) => set({ isLoading }),
      logout: async () => {
        try {
          if (supabase) {
            await supabase.auth.signOut()
          }
        } catch (err) {
          console.error('Supabase sign-out error:', err)
        } finally {
          // Clear Zustand user & wallet stores
          set({ user: null })
          useWalletStore.getState().setWallet(null)
          useWalletStore.getState().setLedger([])
          useWalletStore.getState().setInvestments([])
          useWalletStore.getState().setRewards([])

          // Remove any Supabase session tokens from localStorage as a failsafe
          try {
            Object.keys(localStorage).forEach((key) => {
              if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key)
              }
            })
            localStorage.removeItem('pitch-arena-auth')
          } catch {
            // ignore
          }
        }
      },
    }),
    {
      name: 'pitch-arena-auth',
      // LOW-2 FIX: Never persist privileged 'admin' role in localStorage.
      // Re-hydrated sessions start as 'audience' until AdminGuard verifies via Supabase DB.
      partialize: (state) => ({
        user: state.user
          ? {
              ...state.user,
              role: 'audience' as const,
            }
          : null,
      }),
    }
  )
)

// ── 2. Event Store ─────────────────────────────────────────
interface EventState {
  event:        Event | null
  teams:        Team[]
  activeRound:  PitchRound | null
  livePitch:    LivePitchState
  connectedCount: number
  setEvent:     (event: Event | null) => void
  setTeams:     (teams: Team[]) => void
  setActiveRound: (round: PitchRound | null) => void
  updateTeamInvestment: (teamId: string, amount: number, uniqueBackers: number) => void
  updateLivePitch: (state: Partial<LivePitchState>) => void
  addActivity:  (item: ActivityItem) => void
  setConnectedCount: (count: number) => void
}

export const useEventStore = create<EventState>()((set) => ({
  event:        null,
  teams:        [],
  activeRound:  null,
  connectedCount: 0,
  livePitch: {
    currentRound: undefined,
    activeTeam: undefined,
    timeRemainingSeconds: 0,
    connectedViewers: 0,
    recentActivity: [],
  },
  setEvent:       (event) => set({ event }),
  setTeams:       (teams) => set({ teams }),
  setActiveRound: (round) => set((state) => ({
    activeRound: round,
    livePitch: {
      ...state.livePitch,
      currentRound: round ?? undefined,
      activeTeam: round?.team ?? undefined,
      timeRemainingSeconds: round?.scheduledDurationSeconds ?? 300,
    },
  })),
  updateTeamInvestment: (teamId, amount, uniqueBackers) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId
          ? { ...t, totalInvestment: t.totalInvestment + amount, uniqueBackers }
          : t
      ),
    })),
  updateLivePitch: (updates) =>
    set((state) => ({ livePitch: { ...state.livePitch, ...updates } })),
  addActivity: (item) =>
    set((state) => ({
      livePitch: {
        ...state.livePitch,
        recentActivity: [item, ...state.livePitch.recentActivity].slice(0, 30),
      },
    })),
  setConnectedCount: (count) => set({ connectedCount: count }),
}))

// ── 3. Wallet Store ─────────────────────────────────────────
interface WalletState {
  wallet:    Wallet | null
  ledger:    WalletLedgerEntry[]
  investments: Investment[]
  rewards:   Reward[]
  setWallet: (wallet: Wallet | null) => void
  setLedger: (ledger: WalletLedgerEntry[]) => void
  setInvestments: (investments: Investment[]) => void
  setRewards:(rewards: Reward[]) => void
  deductPoints: (amount: number) => void
  addInvestment: (investment: Investment) => void
}

export const useWalletStore = create<WalletState>()((set) => ({
  wallet:      null,
  ledger:      [],
  investments: [],
  rewards:     [],
  setWallet:   (wallet) => set({ wallet }),
  setLedger:   (ledger) => set({ ledger }),
  setInvestments: (investments) => set({ investments }),
  setRewards:  (rewards) => set({ rewards }),
  deductPoints: (amount) =>
    set((state) => {
      if (!state.wallet) return {}
      const deductFree = Math.min(state.wallet.freePoints, amount)
      const deductPurchased = amount - deductFree

      return {
        wallet: {
          ...state.wallet,
          freePoints: Math.max(0, state.wallet.freePoints - deductFree),
          purchasedPoints: Math.max(0, state.wallet.purchasedPoints - deductPurchased),
          investedPoints: state.wallet.investedPoints + amount,
          totalSpentPoints: state.wallet.totalSpentPoints + amount,
        },
      }
    }),
  addInvestment: (investment) =>
    set((state) => ({ investments: [investment, ...state.investments] })),
}))

// ── 4. Notification Store ──────────────────────────────────
interface NotificationState {
  notifications: Notification[]
  unreadCount:   number
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAllAsRead: () => void
  clearAll:      () => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount:   0,
  addNotification: (n) => {
    const item: Notification = {
      ...n,
      id:        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read:      false,
    }
    set((state) => ({
      notifications: [item, ...state.notifications].slice(0, 50),
      unreadCount:   state.unreadCount + 1,
    }))
  },
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount:   0,
    })),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}))

// ── 5. Admin Store ─────────────────────────────────────────
interface AdminState {
  isAdminPanelOpen: boolean
  selectedTab:      string
  eventConfig:      EventConfig | null
  setAdminPanelOpen: (open: boolean) => void
  setSelectedTab:    (tab: string) => void
  setEventConfig:    (config: EventConfig | null) => void
}

export const useAdminStore = create<AdminState>()((set) => ({
  isAdminPanelOpen: false,
  selectedTab:      'overview',
  eventConfig:      null,
  setAdminPanelOpen: (open) => set({ isAdminPanelOpen: open }),
  setSelectedTab:    (tab) => set({ selectedTab: tab }),
  setEventConfig:    (config) => set({ eventConfig: config }),
}))
