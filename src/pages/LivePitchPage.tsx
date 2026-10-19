// ============================================================
// Live Pitch Page — Real-time pitch + investment interface
// Minimalist, high contrast, clean white and black theme
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Radio, Users, Clock, CheckCircle2,
  AlertCircle, Timer, Flame, ArrowUpRight,
  Trophy, Crown, Zap
} from 'lucide-react'
import { useAuthStore, useEventStore, useWalletStore } from '@/store'
import {
  Card, Button, StatusBadge, Countdown, LiveIndicator,
  Badge, ProgressBar, EmptyState,
} from '@/components/ui'
import { formatPoints, formatExactMs, generateId } from '@/lib/utils'
import { submitInvestment, getTeamAudienceStandings } from '@/lib/supabaseApi'
import { supabase, TABLES } from '@/lib/supabase'
import type { TeamInvestorStanding } from '@/types'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  broadcastInvestmentMade,
  STANDINGS_INVALIDATE_EVENT,
  syncLiveState,
} from '@/lib/realtimeSync'

const QUICK_AMOUNTS = [10, 25, 50, 100, 200]

function InvestmentPanel({ teamId, roundId }: { teamId: string; roundId: string }) {
  const { user } = useAuthStore()
  const { wallet, deductPoints, addInvestment } = useWalletStore()
  const { updateTeamInvestment, addActivity, teams, event, activeRound } = useEventStore()

  const [selected, setSelected] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [justInvested, setJustInvested] = useState(false)

  const available = wallet ? wallet.freePoints + wallet.purchasedPoints : 0
  const amount = selected ?? (custom ? parseInt(custom) : 0)
  const canInvest = user && amount > 0 && amount <= available && !loading

  const handleQuickSelect = (pts: number) => {
    setSelected(pts === selected ? null : pts)
    setCustom('')
  }

  const handleCustom = (val: string) => {
    const n = parseInt(val) || 0
    setCustom(val)
    setSelected(null)
    if (n > available) toast.error(`Max available: ${available} pts`)
  }

  const handleInvest = async () => {
    if (!canInvest || !user) return
    if (!confirming) { setConfirming(true); return }

    setLoading(true)
    setConfirming(false)
    try {
      const openTime = (activeRound?.investmentOpenTime || activeRound?.pitchStartTime)
        ? new Date(activeRound.investmentOpenTime || activeRound.pitchStartTime!).getTime()
        : Date.now()
      const timeElapsedMs = Math.max(1, Date.now() - openTime)

      if (wallet) {
        const res = await submitInvestment({
          userId: user.id,
          eventId: event?.id || '11111111-0000-0000-0000-000000000001',
          teamId,
          roundId,
          amount,
          wallet,
          timeElapsedMs,
        })

        if (!res.success) {
          toast.error(res.error || 'Scoring points could not be processed.')
          setLoading(false)
          return
        }
      }

      // Deduct wallet in local state
      deductPoints(amount)

      // Add investment record with millisecond speed
      const inv = {
        id: generateId(),
        userId: user.id,
        eventId: event?.id || '11111111-0000-0000-0000-000000000001',
        teamId,
        roundId,
        amount,
        timeElapsedMs,
        createdAt: new Date().toISOString(),
      }
      addInvestment(inv)

      // Update team total
      const team = teams.find(t => t.id === teamId)
      const newTotal = (team?.totalInvestment ?? 0) + amount
      const newBackers = (team?.uniqueBackers ?? 0) + 1
      if (team) {
        updateTeamInvestment(teamId, amount, newBackers)
      }

      // Add activity feed item
      addActivity({
        id: generateId(),
        type: 'investment',
        message: `Attendee backed ${team?.name ?? 'the startup'} with ${amount} pts`,
        timestamp: new Date().toISOString(),
      })

      // Broadcast investment in real time to all audience & projector devices
      broadcastInvestmentMade(teamId, amount, newTotal, newBackers, user.id)

      toast.success(`Backed with ${amount} points successfully!`)
      setJustInvested(true)
      setSelected(null)
      setCustom('')
      setTimeout(() => setJustInvested(false), 3000)
    } catch {
      toast.error('Points could not be deployed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6 space-y-4 border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between pb-1 border-b border-zinc-100">
        <div>
          <h3 className="text-zinc-950 font-bold text-sm">Deploy Allocation Points</h3>
          <p className="text-zinc-500 text-xs">Back this live startup during their active round</p>
        </div>
        {user && (
          <div className="text-right">
            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Available</p>
            <p className="text-zinc-950 font-bold font-mono text-sm">{formatPoints(available)} pts</p>
          </div>
        )}
      </div>

      {!user ? (
        <div className="text-center py-5 space-y-3">
          <p className="text-zinc-500 text-sm">Sign in to deploy your allocation points</p>
          <Link to="/auth">
            <Button size="md" className="bg-zinc-950 text-white">Sign In to Score</Button>
          </Link>
        </div>
      ) : justInvested ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-6 space-y-1"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-zinc-950 font-bold text-base">Score Confirmed</p>
          <p className="text-zinc-500 text-xs font-mono">+{amount} points deployed</p>
        </motion.div>
      ) : (
        <>
          {/* Quick amounts (Responsive for small phones and desktops) */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {QUICK_AMOUNTS.map(pts => (
              <button
                key={pts}
                onClick={() => handleQuickSelect(pts)}
                disabled={pts > available}
                className={`
                  py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold font-mono transition-all duration-150
                  ${selected === pts
                    ? 'bg-zinc-950 text-white shadow-sm border border-zinc-950 scale-[1.02]'
                    : pts > available
                    ? 'bg-zinc-50 text-zinc-300 border border-zinc-200/60 cursor-not-allowed'
                    : 'bg-white text-zinc-800 hover:bg-zinc-50 border border-zinc-200 shadow-sm'}
                `}
              >
                {pts} pts
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="relative">
            <input
              type="number"
              value={custom}
              onChange={e => handleCustom(e.target.value)}
              placeholder="Custom amount..."
              min={1}
              max={available}
              className="arena-input pr-14 text-sm font-mono"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-medium">pts</span>
          </div>

          {/* Confirm/Score button */}
          {confirming ? (
            <div className="space-y-2">
              <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 text-center">
                <p className="text-zinc-600 text-xs font-semibold">Confirm Backing</p>
                <p className="text-zinc-950 text-2xl font-black font-mono mt-0.5">{amount} points</p>
                <p className="text-zinc-400 text-[11px] mt-0.5">Points are committed for this round</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setConfirming(false)} className="flex-1 justify-center">
                  Cancel
                </Button>
                <Button onClick={handleInvest} loading={loading} className="flex-1 justify-center bg-zinc-950 text-white">
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleInvest}
              disabled={!canInvest}
              loading={loading}
              className="w-full justify-center bg-zinc-950 text-white py-2.5"
            >
              {amount > 0 ? `Deploy ${amount} Points` : 'Select Points to Deploy'}
            </Button>
          )}

          {available === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 bg-zinc-50">
              <AlertCircle size={14} className="text-zinc-600 flex-shrink-0" />
              <p className="text-zinc-600 text-xs">No points remaining. <Link to="/wallet" className="underline font-semibold text-zinc-900">Get more points</Link></p>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export function LivePitchPage() {
  const { event, activeRound, livePitch, updateLivePitch, teams } = useEventStore()
  const { user } = useAuthStore()
  const { investments: localInvestments } = useWalletStore()
  const team = activeRound?.team || teams.find(t => t.id === activeRound?.teamId)
  const [timeLeft, setTimeLeft] = useState(livePitch.timeRemainingSeconds)
  const [teamStandings, setTeamStandings] = useState<TeamInvestorStanding[]>([])

  // Fast polling heartbeat on LivePitchPage: guarantees attendee screen updates automatically
  // even if they were waiting on "No Active Pitch" before admin called the startup
  useEffect(() => {
    syncLiveState()
    const timer = setInterval(() => {
      syncLiveState()
    }, 2000)

    const handleInvalidate = (e: any) => {
      if (!team || !e.detail?.teamId || e.detail.teamId === team.id) {
        syncLiveState()
      }
    }

    window.addEventListener(STANDINGS_INVALIDATE_EVENT, handleInvalidate)
    return () => {
      clearInterval(timer)
      window.removeEventListener(STANDINGS_INVALIDATE_EVENT, handleInvalidate)
    }
  }, [team?.id])

  // Live standings subscriber for current team on attendee device
  useEffect(() => {
    if (!team) {
      setTeamStandings([])
      return
    }

    let isMounted = true

    const loadStandings = async () => {
      const data = await getTeamAudienceStandings(team.id)
      if (isMounted) {
        if (data.length > 0) {
          setTeamStandings(data)
        } else {
          // Check local investments
          const teamInvs = localInvestments.filter(i => i.teamId === team.id)
          if (teamInvs.length > 0) {
            setTeamStandings([{
              userId: user?.id || 'me',
              displayName: user?.displayName || 'You',
              email: user?.email || '',
              amount: teamInvs.reduce((s, i) => s + i.amount, 0),
              timeElapsedMs: teamInvs[0]?.timeElapsedMs || 1420,
              investedAt: teamInvs[0]?.createdAt || new Date().toISOString(),
              rank: 1,
            }])
          } else {
            setTeamStandings([])
          }
        }
      }
    }

    loadStandings()
    const timer = setInterval(loadStandings, 2500)

    const handleInvalidateStandings = (e: any) => {
      if (!e.detail?.teamId || e.detail.teamId === team.id) {
        loadStandings()
      }
    }
    window.addEventListener(STANDINGS_INVALIDATE_EVENT, handleInvalidateStandings)

    let channel: any = null
    if (supabase) {
      channel = supabase
        .channel(`live-pitch-standings-${team.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: TABLES.INVESTMENTS, filter: `team_id=eq.${team.id}` },
          () => {
            loadStandings()
          }
        )
        .subscribe()
    }

    return () => {
      isMounted = false
      clearInterval(timer)
      window.removeEventListener(STANDINGS_INVALIDATE_EVENT, handleInvalidateStandings)
      if (channel && supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [team?.id, localInvestments.length, user?.id, user?.displayName, user?.email])

  const isPitchPhase = activeRound?.status === 'announced' || activeRound?.status === 'pitching'
  const isInvestmentOpen = activeRound?.status === 'investment_open'
  const isPaused = activeRound?.status === 'investment_paused'
  const isClosed = activeRound?.status === 'investment_closed' || activeRound?.status === 'completed'

  // Authoritative server countdown timer
  useEffect(() => {
    if (!activeRound) return

    if (isPaused) {
      return
    }

    // Phase 2: Investment Window Open
    if (isInvestmentOpen && activeRound.investmentCloseTime) {
      const closeTime = new Date(activeRound.investmentCloseTime).getTime()

      const tick = () => {
        const remaining = Math.max(0, Math.floor((closeTime - Date.now()) / 1000))
        setTimeLeft(remaining)
        updateLivePitch({ timeRemainingSeconds: remaining })
      }

      tick()
      const interval = setInterval(tick, 1000)
      return () => clearInterval(interval)
    }

    // Phase 1: Pitch Presentation Phase
    const pitchStart = activeRound.pitchStartTime || activeRound.createdAt
    if (isPitchPhase && pitchStart) {
      const pitchDuration = activeRound.scheduledDurationSeconds || 300
      const pitchEndTime = new Date(pitchStart).getTime() + (pitchDuration * 1000)

      const tick = () => {
        const remaining = Math.max(0, Math.floor((pitchEndTime - Date.now()) / 1000))
        setTimeLeft(remaining)
        updateLivePitch({ timeRemainingSeconds: remaining })
      }

      tick()
      const interval = setInterval(tick, 1000)
      return () => clearInterval(interval)
    }
  }, [activeRound?.status, activeRound?.investmentCloseTime, activeRound?.pitchStartTime, activeRound?.createdAt, isPaused, isInvestmentOpen, isPitchPhase])

  if (!activeRound || !team) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 animate-fade-in text-zinc-900">
        <EmptyState
          icon={<Timer size={40} className="text-zinc-400" />}
          title="No Active Pitch on Stage"
          description="The next startup pitch will be called shortly by the event administrator. Review the upcoming queue or check tournament standings below."
          action={
            <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm justify-center pt-2">
              <Link to="/" className="flex-1">
                <Button variant="secondary" className="w-full justify-center text-xs font-semibold">
                  Browse Startups
                </Button>
              </Link>
              <Link to="/scoreboard" className="flex-1">
                <Button className="w-full justify-center bg-zinc-950 text-white text-xs font-bold">
                  View Leaderboard
                </Button>
              </Link>
            </div>
          }
        />

        {/* How The Live Stage Works Quick Explainer */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-3">
          <h3 className="font-bold text-zinc-950 text-sm flex items-center gap-2">
            <Radio size={16} className="text-emerald-600" />
            How Live Pitch Scoring Works
          </h3>
          <div className="space-y-2 text-xs text-zinc-600">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-zinc-100 font-mono font-bold text-zinc-900 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
              <p><strong className="text-zinc-900">Stage Countdown:</strong> When the admin calls a team, their presentation timer starts right here.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-zinc-100 font-mono font-bold text-zinc-900 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
              <p><strong className="text-zinc-900">Deploy Points:</strong> The scoring buttons unlock. Select or enter how many points to back them with.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-md bg-zinc-100 font-mono font-bold text-zinc-900 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
              <p><strong className="text-zinc-900">Speed Tie-Breaker:</strong> The highest backer with the least reaction time (milliseconds) wins #1 Audience Champion!</p>
            </div>
          </div>
        </div>

        {/* Show upcoming teams */}
        <div className="space-y-3">
          <h2 className="text-zinc-950 font-bold text-sm px-1">Upcoming in Pitch Queue</h2>
          {teams
            .filter(t => t.status === 'upcoming')
            .map(t => (
              <div key={t.id} className="p-4 rounded-2xl bg-white border border-zinc-200/90 shadow-sm flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-sm font-bold font-mono text-zinc-900 flex-shrink-0">
                  #{t.pitchOrder}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-950 font-bold text-sm truncate">{t.name}</p>
                  <p className="text-zinc-500 text-xs truncate">{t.pitchTitle}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
        </div>
      </div>
    )
  }

  const isUrgent = isInvestmentOpen && timeLeft <= 30 && timeLeft > 0
  const isExpired = isInvestmentOpen && timeLeft === 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5 animate-fade-in text-zinc-900">
      {/* Status banner */}
      {isPitchPhase && (
        <div className="p-4 rounded-2xl bg-white border border-blue-400/80 shadow-sm flex items-center gap-3">
          <LiveIndicator label="STAGE PITCHING" />
          <p className="text-zinc-700 text-xs sm:text-sm flex-1 leading-snug">
            <strong className="text-zinc-950">{team.name}</strong> is presenting live on stage! Audience scoring window will open following their pitch.
          </p>
        </div>
      )}

      {isInvestmentOpen && (
        <div className="p-4 rounded-2xl bg-white border border-emerald-500/80 shadow-sm flex items-center gap-3">
          <LiveIndicator label="SCORING OPEN" />
          <p className="text-zinc-700 text-xs sm:text-sm flex-1 leading-snug">
            Audience scoring window is live for <strong className="text-zinc-950">{team.name}</strong>! Deploy your points before the deadline.
          </p>
        </div>
      )}

      {isPaused && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
          <p className="text-amber-900 font-semibold text-xs">⏸️ Scoring Round Temporarily Paused by Admin</p>
        </div>
      )}

      {isClosed && (
        <div className="p-3.5 rounded-2xl bg-zinc-100 border border-zinc-200 text-center">
          <p className="text-zinc-700 font-semibold text-xs">Scoring Window Closed for this Round</p>
        </div>
      )}

      {/* Team Profile */}
      <Card className="overflow-hidden border-zinc-200/90 bg-white shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center text-2xl font-black flex-shrink-0">
            {team.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-black text-zinc-950 tracking-tight">{team.name}</h1>
              <Badge variant="blue">{team.category}</Badge>
            </div>
            <p className="text-zinc-900 font-bold text-sm">{team.pitchTitle}</p>
            {team.presenters && team.presenters.length > 0 && (
              <p className="text-zinc-500 text-xs mt-1">
                Pitchers: {team.presenters.join(' · ')}
              </p>
            )}
          </div>
        </div>

        {team.description && (
          <p className="text-zinc-600 text-sm leading-relaxed whitespace-pre-line pt-1 border-t border-zinc-100">
            {team.description}
          </p>
        )}

        {/* Live Audience Activity Stats */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
            <p className="text-lg font-bold font-mono text-zinc-950">{formatPoints(team.totalInvestment)}</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">Audience Pts</p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
            <p className="text-lg font-bold font-mono text-zinc-950">{team.uniqueBackers}</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">Backers</p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
            <p className="text-lg font-bold font-mono text-zinc-950">#{
              teams
                .slice()
                .sort((a, b) => b.totalInvestment - a.totalInvestment)
                .findIndex(t => t.id === team.id) + 1
            }</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold" title="Audience engagement only — official results judged independently">
              Audience Rank*
            </p>
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 text-center pt-1 italic">
          *Audience scoring & gamification activity only. Official competition rankings are judged independently.
        </p>
      </Card>

      {/* Countdown Card */}
      {(isPitchPhase || isInvestmentOpen) && (
        <Card className={`p-6 text-center border-zinc-200/90 bg-white shadow-sm ${isUrgent ? 'border-rose-400 bg-rose-50/20' : ''}`}>
          <div className="flex items-center justify-center gap-2 mb-1 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <Clock size={14} className={isUrgent ? 'text-rose-600' : 'text-zinc-400'} />
            <span>
              {isPitchPhase ? 'Pitch Presentation Countdown' : 'Scoring Window Remaining'}
            </span>
          </div>
          <Countdown seconds={timeLeft} size="xl" className="my-2" />
          <ProgressBar
            value={timeLeft}
            max={isPitchPhase ? (activeRound.scheduledDurationSeconds || 300) : (activeRound.investmentWindowSeconds || 180)}
            className="max-w-xs mx-auto"
          />
        </Card>
      )}

      {/* Phase 1 Wait Banner */}
      {isPitchPhase && (
        <Card className="p-5 text-center border-zinc-200 bg-zinc-50 shadow-sm space-y-2">
          <p className="text-zinc-900 font-bold text-sm">Startup Presentation in Progress</p>
          <p className="text-zinc-500 text-xs max-w-sm mx-auto">
            Listen closely to the founders pitch their business. The scoring window will open as soon as their presentation concludes!
          </p>
        </Card>
      )}

      {/* Phase 2 Investment Panel */}
      {isInvestmentOpen && !isExpired && (
        <InvestmentPanel teamId={team.id} roundId={activeRound.id} />
      )}

      {/* Attendee Ranking & Top 5 Audience Leaderboard for this Startup */}
      <Card className="p-5 border-zinc-200/90 bg-white shadow-sm space-y-4">
        {/* Attendee's Own Ranking Card */}
        {(() => {
          const myStanding = teamStandings.find(s => s.userId === user?.id)
          if (myStanding) {
            return (
              <div className="p-4 rounded-2xl bg-zinc-950 text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={18} className={myStanding.rank === 1 ? 'text-amber-400' : 'text-zinc-400'} />
                    <span className="font-bold text-xs uppercase tracking-wider text-zinc-300">
                      Your Backer Standing
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-black ${
                    myStanding.rank === 1
                      ? 'bg-amber-400 text-zinc-950 shadow-sm'
                      : 'bg-zinc-800 text-white border border-zinc-700'
                  }`}>
                    Rank #{myStanding.rank} of {teamStandings.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10 text-center">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">Your Points</p>
                    <p className="text-xl font-black font-mono text-white mt-0.5">{formatPoints(myStanding.amount)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10 text-center">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">Your Speed</p>
                    <p className="text-xl font-black font-mono text-white mt-0.5">{formatExactMs(myStanding.timeElapsedMs)}</p>
                  </div>
                </div>

                {myStanding.rank === 1 ? (
                  <div className="p-2.5 rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-200 text-xs font-bold text-center">
                    🏆 You are currently the #1 Audience Winner for {team.name}!
                  </div>
                ) : (
                  <p className="text-zinc-400 text-[11px] text-center">
                    Deploy more points to claim the #1 Audience Champion spot!
                  </p>
                )}
              </div>
            )
          }

          return (
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/90 text-center space-y-1">
              <p className="text-zinc-950 font-bold text-xs">Audience Competition for {team.name}</p>
              <p className="text-zinc-500 text-[11px]">
                The attendee who deploys the highest points in the least time wins. Deploy points above to see your live ranking!
              </p>
            </div>
          )
        })()}

        {/* Top 5 Standings Table */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">
            <span>Top 5 Backers for {team.name}</span>
            <span>Speed (ms)</span>
          </div>

          {teamStandings.length === 0 ? (
            <div className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 text-center text-xs text-zinc-400">
              No audience scores recorded yet for this round.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 overflow-hidden bg-white">
              {teamStandings.slice(0, 5).map((standing) => {
                const isMe = standing.userId === user?.id
                return (
                  <div
                    key={standing.userId}
                    className={`p-3 flex items-center justify-between text-xs transition-colors ${
                      isMe ? 'bg-zinc-100/80 font-semibold' : 'hover:bg-zinc-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 pr-2">
                      <span className={`w-6 h-6 rounded-lg font-mono font-bold text-[11px] flex items-center justify-center flex-shrink-0 ${
                        standing.rank === 1
                          ? 'bg-amber-400 text-zinc-950 font-black'
                          : standing.rank === 2
                          ? 'bg-zinc-200 text-zinc-800'
                          : standing.rank === 3
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        #{standing.rank}
                      </span>
                      <div className="min-w-0 truncate">
                        <span className="text-zinc-950 font-medium truncate block sm:inline">
                          {standing.displayName}
                        </span>
                        {isMe && <span className="sm:ml-1.5 px-1.5 py-0.2 bg-zinc-950 text-white rounded text-[9px] sm:text-[10px] font-bold">YOU</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 font-mono flex-shrink-0 text-right">
                      <span className="font-bold text-zinc-950 text-xs sm:text-sm">
                        {formatPoints(standing.amount)}
                      </span>
                      <span className="text-zinc-500 text-[10px] sm:text-[11px] min-w-[65px] sm:min-w-[70px] text-right">
                        {formatExactMs(standing.timeElapsedMs)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Activity Feed */}
      <Card className="p-5 border-zinc-200/90 bg-white shadow-sm space-y-3">
        <h3 className="text-zinc-950 font-bold text-sm flex items-center gap-2">
          <Radio size={14} className="text-zinc-700" />
          Live Pitch Activity
        </h3>
        <div className="space-y-2">
          <AnimatePresence>
            {livePitch.recentActivity.slice(0, 6).map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-xs text-zinc-600 py-1.5 border-b border-zinc-100 last:border-0"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                <span className="flex-1 font-medium">{item.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {livePitch.recentActivity.length === 0 && (
            <p className="text-zinc-400 text-xs text-center py-2">No scores recorded yet for this round</p>
          )}
        </div>
      </Card>
    </div>
  )
}
