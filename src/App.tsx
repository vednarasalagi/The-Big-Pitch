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
import { AdminDashboard } from '@/pages/AdminDashboard'
import { CastScreenPage } from '@/pages/CastScreenPage'
import { AccessDeniedPage } from '@/pages/AccessDeniedPage'
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
          toast.success('Welcome to Pitch Arena!')
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

// ── Realtime Sync (Supabase) ───────────────────────────────
function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { setTeams, setActiveRound } = useEventStore()
  const { user } = useAuthStore()
  const { event } = useEventStore()
  const { setWallet } = useWalletStore()

  useEffect(() => {
    if (!supabase) return

    // 1. Subscribe to team score changes
    const teamChannel = supabase
      .channel('teams-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, async () => {
        const teams = await getTeams(event?.id)
        setTeams(teams)
      })
      .subscribe()

    // 2. Subscribe to pitch round status changes
    const roundChannel = supabase
      .channel('rounds-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitch_rounds' }, async () => {
        const round = await getActivePitchRound(event?.id)
        setActiveRound(round)
      })
      .subscribe()

    // 3. Subscribe to user's wallet updates
    let walletChannel: any = null
    if (user && event) {
      walletChannel = supabase
        .channel(`wallet-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`,
        }, async () => {
          const w = await getOrCreateWallet(user.id, event.id)
          if (w) setWallet(w)
        })
        .subscribe()
    }

    return () => {
      teamChannel.unsubscribe()
      roundChannel.unsubscribe()
      if (walletChannel) walletChannel.unsubscribe()
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
          <Route path="/rewards"       element={<RewardsPage />} />
          <Route path="/auth"          element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />
          <Route path="/admin"         element={
            <AdminGuard>
              <AdminDashboard />
            </AdminGuard>
          } />
          <Route path="/cast"          element={<CastScreenPage />} />
          <Route path="/projector"     element={<CastScreenPage />} />
          <Route path="*"              element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </RealtimeProvider>
  )
}
