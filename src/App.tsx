// ============================================================
// App.tsx — Production Router with Supabase Live Data Sync
// ============================================================

import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
import { NotFoundPage } from '@/pages/NotFoundPage'
import { TermsPage } from '@/pages/TermsPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { CelebrationPage } from '@/pages/CelebrationPage'
import { VerificationDeskPage } from '@/pages/VerificationDeskPage'
import { AdminGuard }     from '@/components/auth/AdminGuard'
import { StaffGuard }     from '@/components/auth/StaffGuard'
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
  getUserProfile,
} from '@/lib/supabaseApi'
import { resolveUserRole, verifyStaffRole, syncAdminAllowlistFromSupabase } from '@/lib/adminConfig'
import { toast } from 'sonner'

// ── Auth Callback Handler ──────────────────────────────────
function AuthCallback() {
  const { setUser } = useAuthStore()
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    syncAdminAllowlistFromSupabase().catch(() => {})
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const email = user.email ?? ''
        try {
          const [profile, staffCheck] = await Promise.all([
            getUserProfile(user.id),
            verifyStaffRole({ id: user.id, email })
          ])
          const baseRole = resolveUserRole(email)
          const finalRole = staffCheck.isStaff
            ? staffCheck.role
            : (profile?.role === 'admin' || baseRole === 'admin'
              ? 'admin'
              : (profile?.role === 'member' || baseRole === 'member' ? 'member' : 'audience'))

          setUser({
            id:          user.id,
            email,
            displayName: (profile?.displayName || user.user_metadata?.full_name) ?? user.email ?? 'User',
            avatarUrl:   profile?.avatarUrl || user.user_metadata?.avatar_url,
            role:        finalRole,
            createdAt:   user.created_at,
            updatedAt:   new Date().toISOString(),
            isVerified:  !!user.email_confirmed_at,
            isEntryVerified: finalRole === 'admin' ? true : Boolean(profile?.isEntryVerified),
            verifiedAt:  profile?.verifiedAt,
            verifiedBy:  profile?.verifiedBy,
            passCode:    profile?.passCode,
          })

          if (finalRole === 'admin') {
            toast.success('Signed in as Administrator. Welcome to Admin Control Room!')
            setTarget('/admin')
          } else if (finalRole === 'member') {
            toast.success('Signed in as Event Volunteer / Member. Welcome to Entry Verification Desk!')
            setTarget('/verify')
          } else {
            toast.success('Welcome to THE BIG PITCH!')
            setTarget('/')
          }
        } catch {
          const baseRole = resolveUserRole(email)
          setUser({
            id:          user.id,
            email,
            displayName: user.user_metadata?.full_name ?? user.email ?? 'User',
            avatarUrl:   user.user_metadata?.avatar_url,
            role:        baseRole,
            createdAt:   user.created_at,
            updatedAt:   new Date().toISOString(),
            isVerified:  !!user.email_confirmed_at,
            isEntryVerified: baseRole === 'admin',
          })
          setTarget(baseRole === 'admin' ? '/admin' : (baseRole === 'member' ? '/verify' : '/'))
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

import {
  getRealtimeChannel,
  syncLiveState,
  invalidateStandings,
  PITCH_ROUND_UPDATE_EVENT,
  PITCH_TEAMS_UPDATE_EVENT,
  PITCH_ACTIVE_ROUND_STORAGE_KEY,
  PITCH_TEAMS_STORAGE_KEY,
} from '@/lib/realtimeSync'

// ── Realtime Sync Engine (Supabase Broadcast + Cross-Tab + CDC + Heartbeat) ──
function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { setTeams, setActiveRound } = useEventStore()
  const { user } = useAuthStore()
  const { event } = useEventStore()
  const { setWallet } = useWalletStore()

  useEffect(() => {
    // 0. Cross-Tab & Same-Origin Event Listeners (0ms latency without websocket roundtrip)
    const handleLocalRoundUpdate = (e: any) => {
      if (e.detail?.round !== undefined) {
        setActiveRound(e.detail.round)
      }
    }

    const handleLocalTeamsUpdate = (e: any) => {
      if (e.detail?.teams) {
        setTeams(e.detail.teams)
      }
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === PITCH_ACTIVE_ROUND_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          setActiveRound(parsed.round ?? parsed)
        } catch {}
      }
      if (e.key === PITCH_TEAMS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          setTeams(parsed.teams ?? parsed)
        } catch {}
      }
    }

    window.addEventListener(PITCH_ROUND_UPDATE_EVENT, handleLocalRoundUpdate)
    window.addEventListener(PITCH_TEAMS_UPDATE_EVENT, handleLocalTeamsUpdate)
    window.addEventListener('storage', handleStorageEvent)

    // HTML5 BroadcastChannel for cross-tab communication
    let crossTabBc: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        crossTabBc = new BroadcastChannel('pitch_arena_cross_tab')
        crossTabBc.onmessage = (ev) => {
          if (ev.data?.type === 'ROUND_UPDATE' && ev.data.round !== undefined) {
            setActiveRound(ev.data.round)
          } else if (ev.data?.type === 'TEAMS_UPDATE' && ev.data.teams) {
            setTeams(ev.data.teams)
          }
        }
      } catch {}
    }

    if (!supabase) {
      return () => {
        window.removeEventListener(PITCH_ROUND_UPDATE_EVENT, handleLocalRoundUpdate)
        window.removeEventListener(PITCH_TEAMS_UPDATE_EVENT, handleLocalTeamsUpdate)
        window.removeEventListener('storage', handleStorageEvent)
        crossTabBc?.close()
      }
    }

    // 1. Singleton Broadcast Channel (0ms peer-to-peer stage push across network devices)
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
        .on('broadcast', { event: 'CELEBRATE_WINNER' }, ({ payload }) => {
          if (payload && typeof window !== 'undefined') {
            try {
              localStorage.setItem('pitch_arena_stage_celebration', JSON.stringify(payload))
            } catch {}
            window.dispatchEvent(new CustomEvent('pitch-stage-celebration', { detail: payload }))
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
      window.removeEventListener(PITCH_ROUND_UPDATE_EVENT, handleLocalRoundUpdate)
      window.removeEventListener(PITCH_TEAMS_UPDATE_EVENT, handleLocalTeamsUpdate)
      window.removeEventListener('storage', handleStorageEvent)
      crossTabBc?.close()

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
  const location = useLocation()
  const { setUser, setLoading, user } = useAuthStore()
  const { setEvent, setTeams, setActiveRound, event } = useEventStore()
  const { setWallet, setInvestments, setLedger, setRewards } = useWalletStore()

  // 1. Initialize Supabase auth session
  useEffect(() => {
    if (!supabase) return

    setLoading(true)
    syncAdminAllowlistFromSupabase().catch(() => {})

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email ?? ''
        const [profile, staffCheck] = await Promise.all([
          getUserProfile(session.user.id),
          verifyStaffRole({ id: session.user.id, email })
        ])
        const baseRole = resolveUserRole(email)
        const finalRole = staffCheck.isStaff
          ? staffCheck.role
          : (profile?.role === 'admin' || baseRole === 'admin'
            ? 'admin'
            : (profile?.role === 'member' || baseRole === 'member' ? 'member' : 'audience'))

        setUser({
          id:          session.user.id,
          email,
          displayName: (profile?.displayName || session.user.user_metadata?.full_name) ?? 'User',
          avatarUrl:   profile?.avatarUrl || session.user.user_metadata?.avatar_url,
          role:        finalRole,
          createdAt:   session.user.created_at,
          updatedAt:   new Date().toISOString(),
          isVerified:  !!session.user.email_confirmed_at,
          isEntryVerified: finalRole === 'admin' ? true : Boolean(profile?.isEntryVerified),
          verifiedAt:  profile?.verifiedAt,
          verifiedBy:  profile?.verifiedBy,
          passCode:    profile?.passCode,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const email = session.user.email ?? ''
        const [profile, staffCheck] = await Promise.all([
          getUserProfile(session.user.id),
          verifyStaffRole({ id: session.user.id, email })
        ])
        const baseRole = resolveUserRole(email)
        const finalRole = staffCheck.isStaff
          ? staffCheck.role
          : (profile?.role === 'admin' || baseRole === 'admin'
            ? 'admin'
            : (profile?.role === 'member' || baseRole === 'member' ? 'member' : 'audience'))

        setUser({
          id:          session.user.id,
          email,
          displayName: (profile?.displayName || session.user.user_metadata?.full_name) ?? 'User',
          avatarUrl:   profile?.avatarUrl || session.user.user_metadata?.avatar_url,
          role:        finalRole,
          createdAt:   session.user.created_at,
          updatedAt:   new Date().toISOString(),
          isVerified:  !!session.user.email_confirmed_at,
          isEntryVerified: finalRole === 'admin' ? true : Boolean(profile?.isEntryVerified),
          verifiedAt:  profile?.verifiedAt,
          verifiedBy:  profile?.verifiedBy,
          passCode:    profile?.passCode,
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
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex-1"
          >
            <Routes location={location}>
              <Route path="/"              element={<HomePage />} />
              <Route path="/live"          element={<LivePitchPage />} />
              <Route path="/scoreboard"    element={<ScoreboardPage />} />
              <Route path="/wallet"        element={<WalletPage />} />
              <Route path="/rewards"       element={<Navigate to="/" replace />} />
              <Route path="/auth"          element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/access-denied" element={<NotFoundPage />} />
              <Route path="/admin"         element={
                <AdminGuard>
                  <AdminDashboard />
                </AdminGuard>
              } />
              <Route path="/admin/*"       element={
                <AdminGuard>
                  <AdminDashboard />
                </AdminGuard>
              } />
              {/* Event Entry Gate Verification Scanner Desk (Volunteers & Admins) */}
              <Route path="/verify" element={
                <StaffGuard>
                  <VerificationDeskPage />
                </StaffGuard>
              } />
              <Route path="/scan" element={
                <StaffGuard>
                  <VerificationDeskPage />
                </StaffGuard>
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
              <Route path="/celebrate"     element={<CelebrationPage />} />
              <Route path="/winner"        element={<CelebrationPage />} />
              <Route path="*"              element={<NotFoundPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </AppShell>
    </RealtimeProvider>
  )
}
