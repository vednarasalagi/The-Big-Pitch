// ============================================================
// App.tsx — Production Router with Supabase Live Data Sync
// ============================================================

import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage }       from '@/pages/HomePage'
import { LivePitchPage }  from '@/pages/LivePitchPage'
import { ScoreboardPage } from '@/pages/ScoreboardPage'
import { WalletPage }     from '@/pages/WalletPage'
import { RewardsPage }    from '@/pages/RewardsPage'
import { AuthPage }       from '@/pages/AuthPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { AdminDashboard } from '@/pages/AdminDashboard'
import { CastScreenPage } from '@/pages/CastScreenPage'
import { AccessDeniedPage } from '@/pages/AccessDeniedPage'
import { TermsPage } from '@/pages/TermsPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { AdminGuard }     from '@/components/auth/AdminGuard'
import { useAuthStore, useEventStore, useWalletStore } from '@/store'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getActiveEvent,
  getTeams,
  getActivePitchRound,
  getOrCreateWallet,
  getUserInvestments,
  getWalletLedger,
  getUserRewards,
} from '@/lib/supabaseApi'
import { resolveUserRole } from '@/lib/adminConfig'
import { toast } from 'sonner'

// ── Auth Callback Handler ──────────────────────────────────
function AuthCallback() {
  const { setUser } = useAuthStore()
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const email = user.email ?? ''
        const verifiedRole = resolveUserRole(email)
        setUser({
          id:          user.id,
          email,
          displayName: user.user_metadata?.full_name ?? user.email ?? 'User',
          avatarUrl:   user.user_metadata?.avatar_url,
          role:        verifiedRole,
          createdAt:   user.created_at,
          updatedAt:   new Date().toISOString(),
          isVerified:  !!user.email_confirmed_at,
        })
        if (verifiedRole === 'admin') {
          toast.success('Signed in as Administrator. Welcome to Admin Control Room!')
          setTarget('/admin')
        } else {
          toast.success('Welcome to THE BIG PITCH!')
          setTarget('/')
        }
      } else {
        setTarget('/auth')
      }
    })
  }, [])

  if (!target) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2 text-white/50">
        <div className="w-8 h-8 rounded-full border-2 border-arena-blue-3 border-t-transparent animate-spin" />
        <p className="text-sm">Finalizing authentication...</p>
      </div>
    )
  }

  return <Navigate to={target} replace />
}

// ── 404 Page ───────────────────────────────────────────────
function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4 text-center px-4">
      <div className="text-8xl">🎯</div>
      <h1 className="text-white font-black text-4xl">404</h1>
      <p className="text-white/50 text-lg">This page missed its pitch.</p>
      <a href="/" className="btn-primary px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-arena-blue to-arena-violet">
        Back to Arena
      </a>
    </div>
  )
}

import {
  getRealtimeChannel,
  syncLiveState,
  invalidateStandings,
} from '@/lib/realtimeSync'

// ── Realtime Sync Engine (Supabase Broadcast + CDC + Heartbeat) ──
function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { setTeams, setActiveRound } = useEventStore()
  const { user } = useAuthStore()
  const { event } = useEventStore()
  const { setWallet } = useWalletStore()

  useEffect(() => {
    if (!supabase) return

    // 1. Singleton Broadcast Channel (0ms peer-to-peer stage push)
    const broadcastChannel = getRealtimeChannel()
    if (broadcastChannel) {
      broadcastChannel
        .on('broadcast', { event: 'ROUND_UPDATE' }, ({ payload }) => {
          if (payload && 'round' in payload) {
            setActiveRound(payload.round)
          }
        })
        .on('broadcast', { event: 'TEAMS_UPDATE' }, ({ payload }) => {
          if (payload?.teams) {
            setTeams(payload.teams)
          }
        })
        .on('broadcast', { event: 'INVESTMENT_MADE' }, ({ payload }) => {
          if (payload?.teamId && typeof payload?.amount === 'number') {
            useEventStore.getState().updateTeamInvestment(
              payload.teamId,
              payload.amount,
              payload.uniqueBackers ?? 0
            )
            invalidateStandings(payload.teamId)
          }
        })
        .subscribe()
    }

    // 2. Postgres CDC Channel (Replication tables)
    const cdcChannel = supabase
      .channel('app-postgres-cdc')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, async () => {
        const teams = await getTeams(event?.id)
        if (teams.length > 0) setTeams(teams)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitch_rounds' }, async () => {
        const round = await getActivePitchRound(event?.id)
        setActiveRound(round)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_config' }, async () => {
        const activeEvent = await getActiveEvent()
        if (activeEvent) useEventStore.getState().setEvent(activeEvent)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'investments' }, (payload: any) => {
        if (payload?.new?.team_id) {
          invalidateStandings(payload.new.team_id)
        }
      })
      .subscribe()

    // 3. User Wallet CDC Subscription
    let walletChannel: any = null
    if (user && event) {
      walletChannel = supabase
        .channel(`wallet-cdc-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wallets',
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            const w = await getOrCreateWallet(user.id, event.id)
            if (w) setWallet(w)
          }
        )
        .subscribe()
    }

    // 4. Resilient Polling Heartbeat (every 2.5s)
    // Ensures state updates even if websockets disconnect, throttle, or sleep
    const heartbeatTimer = setInterval(() => {
      syncLiveState()
    }, 2500)

    // 5. Wakeup & Tab Focus Listener
    // Instantly syncs the live stage when user returns to tab or unlocks phone
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncLiveState()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)
    window.addEventListener('online', handleVisibilityOrFocus)

    return () => {
      clearInterval(heartbeatTimer)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      window.removeEventListener('online', handleVisibilityOrFocus)

      if (cdcChannel && supabase) supabase.removeChannel(cdcChannel)
      if (walletChannel && supabase) supabase.removeChannel(walletChannel)
    }
  }, [event?.id, user?.id])

  return <>{children}</>
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  const { setUser, setLoading, user } = useAuthStore()
  const { setEvent, setTeams, setActiveRound, event } = useEventStore()
  const { setWallet, setInvestments, setLedger, setRewards } = useWalletStore()

  // 1. Initialize Supabase auth session
  useEffect(() => {
    if (!supabase) return

    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email ?? ''
        setUser({
          id:          session.user.id,
          email,
          displayName: session.user.user_metadata?.full_name ?? 'User',
          avatarUrl:   session.user.user_metadata?.avatar_url,
          role:        resolveUserRole(email),
          createdAt:   session.user.created_at,
          updatedAt:   new Date().toISOString(),
          isVerified:  !!session.user.email_confirmed_at,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const email = session.user.email ?? ''
        setUser({
          id:          session.user.id,
          email,
          displayName: session.user.user_metadata?.full_name ?? 'User',
          avatarUrl:   session.user.user_metadata?.avatar_url,
          role:        resolveUserRole(email),
          createdAt:   session.user.created_at,
          updatedAt:   new Date().toISOString(),
          isVerified:  !!session.user.email_confirmed_at,
        })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2. Load live event, teams, and active round from Supabase
  useEffect(() => {
    if (!supabase) return

    async function loadEventData() {
      const activeEvent = await getActiveEvent()
      if (activeEvent) {
        setEvent(activeEvent)
        const [teams, round] = await Promise.all([
          getTeams(activeEvent.id),
          getActivePitchRound(activeEvent.id),
        ])
        setTeams(teams)
        setActiveRound(round)
      } else {
        // Fallback: try to load any teams even if event row is not seeded yet
        const teams = await getTeams()
        if (teams.length > 0) setTeams(teams)
      }
    }

    loadEventData()
  }, [])

  // 3. Load user's wallet & investments when authenticated
  useEffect(() => {
    if (!supabase || !user) return
    const activeUser = user

    async function loadUserData(u: typeof activeUser) {
      const eventId = event?.id || '11111111-0000-0000-0000-000000000001'
      const userWallet = await getOrCreateWallet(u.id, eventId, event?.config.freePointsAllocation ?? 500)
      if (userWallet) {
        setWallet(userWallet)
        const [invs, ledger, rewards] = await Promise.all([
          getUserInvestments(u.id, eventId),
          getWalletLedger(userWallet.id),
          getUserRewards(u.id, eventId),
        ])
        setInvestments(invs)
        setLedger(ledger)
        setRewards(rewards)
      }
    }

    loadUserData(activeUser)
  }, [user?.id, event?.id])

  return (
    <RealtimeProvider>
      <AppShell>
        <Routes>
          <Route path="/"              element={<HomePage />} />
          <Route path="/live"          element={<LivePitchPage />} />
          <Route path="/scoreboard"    element={<ScoreboardPage />} />
          <Route path="/wallet"        element={<WalletPage />} />
          <Route path="/rewards"       element={<Navigate to="/" replace />} />
          <Route path="/auth"          element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />
          <Route path="/admin"         element={
            <AdminGuard>
              <AdminDashboard />
            </AdminGuard>
          } />
          {/* Legal Compliance Routes — Consolidated into Terms and Privacy */}
          <Route path="/terms"                 element={<TermsPage />} />
          <Route path="/terms-and-conditions"  element={<TermsPage />} />
          <Route path="/privacy"               element={<PrivacyPage />} />
          <Route path="/privacy-policy"        element={<PrivacyPage />} />
          <Route path="/refund-policy"         element={<TermsPage />} />
          <Route path="/cancellation-refund"   element={<TermsPage />} />
          <Route path="/cancellation-and-refund" element={<TermsPage />} />
          <Route path="/shipping-policy"       element={<TermsPage />} />
          <Route path="/delivery-policy"       element={<TermsPage />} />
          <Route path="/contact"               element={<TermsPage />} />
          <Route path="/contact-us"            element={<TermsPage />} />

          <Route path="/cast"          element={<CastScreenPage />} />
          <Route path="/projector"     element={<CastScreenPage />} />
          <Route path="*"              element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </RealtimeProvider>
  )
}
