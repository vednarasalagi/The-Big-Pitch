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
      // Millisecond speed MUST strictly start from when the investment window opened (not from pitch start or random)
      const windowOpenMs = activeRound?.investmentOpenTime
        ? new Date(activeRound.investmentOpenTime).getTime()
        : Date.now()
      const timeElapsedMs = Math.max(1, Date.now() - windowOpenMs)

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
    <div className="skeuo-surface p-5 sm:p-6 rounded-3xl space-y-4 shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF]">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 gap-3">
        <div>
          <h3 className="text-zinc-950 font-black text-sm sm:text-base skeuo-text-emboss">Deploy Allocation Points</h3>
          <p className="text-zinc-500 text-xs font-medium">Back this live startup during their active round</p>
        </div>
        {user && (
          <div className="skeuo-sunken px-3.5 py-1.5 rounded-xl text-right flex-shrink-0">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="skeuo-led-bezel">
                <span className="skeuo-led-emerald" />
              </span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider skeuo-text-emboss">Available</span>
            </div>
            <p className="text-zinc-950 font-black font-mono text-xs sm:text-sm leading-tight mt-0.5">{formatPoints(available)} pts</p>
          </div>
        )}
      </div>

      {!user ? (
        <div className="text-center py-6 space-y-3 skeuo-sunken rounded-2xl p-4">
          <p className="text-zinc-600 text-xs sm:text-sm font-semibold">Sign in to deploy your 500 allocation points</p>
          <Link to="/auth" className="inline-block">
            <Button size="md" className="skeuo-btn-primary">Sign In to Score</Button>
          </Link>
        </div>
      ) : justInvested ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-6 space-y-1 skeuo-sunken rounded-2xl"
        >
          <div className="w-11 h-11 rounded-2xl skeuo-token flex items-center justify-center mx-auto mb-2 text-emerald-700">
            <CheckCircle2 size={22} />
          </div>
          <p className="text-zinc-950 font-black text-base skeuo-text-emboss">Score Confirmed</p>
          <p className="text-emerald-700 text-xs font-black font-mono">+{amount} points deployed</p>
        </motion.div>
      ) : (
        <>
          {/* Mechanical Keypad Switch Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase font-bold tracking-wider text-zinc-500 skeuo-text-emboss block">
              Quick Backing Amount
            </label>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {QUICK_AMOUNTS.map(pts => (
                <button
                  key={pts}
                  onClick={() => handleQuickSelect(pts)}
                  disabled={pts > available}
                  className={`
                    py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-xs font-black font-mono select-none cursor-pointer
                    ${selected === pts
                      ? 'skeuo-keypad-btn-active ring-2 ring-zinc-950/20'
                      : pts > available
                      ? 'skeuo-sunken opacity-40 cursor-not-allowed text-zinc-400'
                      : 'skeuo-keypad-btn text-zinc-800'}
                  `}
                >
                  {pts} pts
                </button>
              ))}
            </div>
          </div>

          {/* Recessed Custom Amount Slot */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase font-bold tracking-wider text-zinc-500 skeuo-text-emboss block">
              Or Custom Points
            </label>
            <div className="relative skeuo-sunken rounded-2xl p-0.5 flex items-center">
              <input
                type="number"
                value={custom}
                onChange={e => handleCustom(e.target.value)}
                placeholder="Enter custom points amount..."
                min={1}
                max={available}
                className="w-full px-4 py-2.5 bg-transparent border-0 text-xs sm:text-sm font-black font-mono text-zinc-950 placeholder-zinc-400 focus:outline-none"
              />
              <span className="pr-4 text-zinc-500 text-xs font-black uppercase font-mono">pts</span>
            </div>
          </div>

          {/* Confirm/Score button */}
          {confirming ? (
            <div className="space-y-3 pt-1">
              <div className="p-4 rounded-2xl skeuo-sunken text-center space-y-1">
                <p className="text-zinc-600 text-xs font-bold uppercase tracking-wider skeuo-text-emboss">Confirm Backing</p>
                <p className="text-zinc-950 text-3xl font-black font-mono">{amount} points</p>
                <p className="text-zinc-500 text-[11px] font-medium">Points will be committed immediately for this round</p>
              </div>
              <div className="flex gap-2.5">
                <Button variant="secondary" onClick={() => setConfirming(false)} className="flex-1 justify-center py-3">
                  Cancel
                </Button>
                <Button onClick={handleInvest} loading={loading} className="flex-1 justify-center py-3 skeuo-btn-emerald">
                  Confirm & Deploy
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-1">
              <Button
                onClick={handleInvest}
                disabled={!canInvest}
                loading={loading}
                className="w-full justify-center py-3.5 text-sm font-black skeuo-btn-primary shadow-lg"
              >
                {amount > 0 ? `Deploy ${amount} Points Now` : 'Select Points to Deploy'}
              </Button>
            </div>
          )}

          {available === 0 && (
            <div className="flex items-center gap-2.5 p-3 rounded-2xl skeuo-sunken">
              <AlertCircle size={15} className="text-amber-600 flex-shrink-0" />
              <p className="text-zinc-700 text-xs font-medium">No points remaining. <Link to="/wallet" className="underline font-bold text-zinc-950">Claim or Top-Up Points</Link></p>
            </div>
          )}
        </>
      )}
    </div>
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
            const openTimeMs = activeRound?.investmentOpenTime ? new Date(activeRound.investmentOpenTime).getTime() : 0
            const firstInvTime = teamInvs[0]?.createdAt ? new Date(teamInvs[0].createdAt).getTime() : 0
            const calculatedSpeedMs = (openTimeMs > 0 && firstInvTime >= openTimeMs)
              ? Math.max(1, firstInvTime - openTimeMs)
              : (teamInvs[0]?.timeElapsedMs && teamInvs[0].timeElapsedMs > 0 ? teamInvs[0].timeElapsedMs : 1)

            setTeamStandings([{
              userId: user?.id || 'me',
              displayName: user?.displayName || 'You',
              email: user?.email || '',
              amount: teamInvs.reduce((s, i) => s + i.amount, 0),
              timeElapsedMs: calculatedSpeedMs,
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
        <div className="skeuo-surface rounded-3xl p-8 sm:p-10 text-center shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF] space-y-4">
          <div className="w-16 h-16 rounded-2xl skeuo-sunken flex items-center justify-center mx-auto text-zinc-600">
            <Timer size={36} className="text-zinc-500" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 skeuo-text-emboss">
              No Active Pitch on Stage
            </h2>
            <p className="text-zinc-600 text-xs sm:text-sm leading-relaxed">
              The next student startup pitch will be called shortly by the event administrator. Review the upcoming queue or check tournament standings below.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm justify-center pt-2 mx-auto">
            <Link to="/" className="flex-1">
              <Button variant="secondary" className="w-full justify-center text-xs font-bold py-2.5">
                Browse Startups
              </Button>
            </Link>
            <Link to="/scoreboard" className="flex-1">
              <Button className="w-full justify-center skeuo-btn-primary text-xs font-bold py-2.5">
                View Leaderboard
              </Button>
            </Link>
          </div>
        </div>

        {/* How The Live Stage Works Quick Explainer */}
        <div className="p-5 sm:p-6 rounded-3xl skeuo-surface shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF] space-y-3.5">
          <div className="flex items-center gap-2">
            <span className="skeuo-led-bezel">
              <span className="skeuo-led-emerald" />
            </span>
            <h3 className="font-black text-zinc-950 text-sm sm:text-base skeuo-text-emboss">
              How Live Pitch Scoring Works
            </h3>
          </div>
          <div className="space-y-2.5 text-xs text-zinc-600">
            <div className="flex items-start gap-3 p-2.5 rounded-xl skeuo-sunken">
              <span className="w-6 h-6 rounded-lg skeuo-token-dark font-mono font-black text-white flex items-center justify-center text-xs flex-shrink-0">1</span>
              <p className="pt-0.5 leading-snug"><strong className="text-zinc-950">Stage Countdown:</strong> When the admin calls a team, their presentation timer starts right here on all audience phones.</p>
            </div>
            <div className="flex items-start gap-3 p-2.5 rounded-xl skeuo-sunken">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-b from-emerald-600 to-emerald-800 text-white font-mono font-black border border-emerald-900 flex items-center justify-center text-xs flex-shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_3px_rgba(0,0,0,0.2)]">2</span>
              <p className="pt-0.5 leading-snug"><strong className="text-zinc-950">Deploy Points:</strong> The scoring panel unlocks. Tap mechanical quick amounts or enter custom points to back them.</p>
            </div>
            <div className="flex items-start gap-3 p-2.5 rounded-xl skeuo-sunken">
              <span className="w-6 h-6 rounded-lg skeuo-token-gold font-mono font-black text-amber-950 flex items-center justify-center text-xs flex-shrink-0">3</span>
              <p className="pt-0.5 leading-snug"><strong className="text-zinc-950">Speed Tie-Breaker:</strong> The highest backer with the least reaction time (milliseconds) wins #1 Audience Champion!</p>
            </div>
          </div>
        </div>

        {/* Show upcoming teams */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-zinc-950 font-black text-sm uppercase tracking-wider skeuo-text-emboss">
              Upcoming in Pitch Queue
            </h2>
            <span className="skeuo-token text-[11px] font-bold font-mono px-2.5 py-0.5 rounded-lg text-zinc-800">
              {teams.filter(t => t.status === 'upcoming').length} Queued
            </span>
          </div>

          {teams
            .filter(t => t.status === 'upcoming')
            .map(t => (
              <div key={t.id} className="p-4 rounded-2xl skeuo-surface-interactive flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl skeuo-token flex items-center justify-center text-xs font-black font-mono text-zinc-900 flex-shrink-0">
                  #{t.pitchOrder}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-950 font-bold text-sm truncate skeuo-text-emboss">{t.name}</p>
                  <p className="text-zinc-500 text-xs truncate font-medium">{t.pitchTitle}</p>
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
        <div className="p-4 rounded-2xl skeuo-surface border-2 border-blue-500/80 shadow-[0_4px_16px_rgba(59,130,246,0.12),inset_0_1px_0_#FFF] flex items-center gap-3.5">
          <LiveIndicator label="STAGE PITCHING" />
          <p className="text-zinc-800 text-xs sm:text-sm flex-1 leading-snug font-medium">
            <strong className="text-zinc-950 font-extrabold">{team.name}</strong> is presenting live on stage! Audience scoring window will open following their pitch.
          </p>
        </div>
      )}

      {isInvestmentOpen && (
        <div className="p-4 rounded-2xl skeuo-surface border-2 border-emerald-500/90 shadow-[0_6px_20px_rgba(16,185,129,0.16),inset_0_1px_0_#FFF] flex items-center gap-3.5">
          <LiveIndicator label="SCORING OPEN" />
          <p className="text-zinc-800 text-xs sm:text-sm flex-1 leading-snug font-medium">
            Audience scoring window is live for <strong className="text-zinc-950 font-extrabold">{team.name}</strong>! Deploy your points before the deadline.
          </p>
        </div>
      )}

      {isPaused && (
        <div className="p-3.5 rounded-2xl skeuo-sunken border border-amber-300 text-center">
          <p className="text-amber-900 font-bold text-xs">⏸️ Scoring Round Temporarily Paused</p>
        </div>
      )}

      {isClosed && (
        <div className="p-3.5 rounded-2xl skeuo-sunken text-center">
          <p className="text-zinc-700 font-bold text-xs skeuo-text-emboss">Scoring Window Closed for this Round</p>
        </div>
      )}

      {/* Team Profile — Precision Machined Console */}
      <div className="skeuo-surface rounded-3xl p-6 sm:p-7 space-y-4 shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF]">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl skeuo-token-dark flex items-center justify-center text-2xl font-black font-mono flex-shrink-0 shadow-md">
            {team.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight skeuo-text-emboss">{team.name}</h1>
              <Badge variant="blue" className="skeuo-token text-[10px]">{team.category}</Badge>
            </div>
            <p className="text-zinc-900 font-bold text-sm">{team.pitchTitle}</p>
            {team.presenters && team.presenters.length > 0 && (
              <p className="text-zinc-500 text-xs mt-1 font-medium">
                Pitchers: {team.presenters.join(' · ')}
              </p>
            )}
          </div>
        </div>

        {team.description && (
          <p className="text-zinc-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line pt-2 border-t border-zinc-200/80 font-normal">
            {team.description}
          </p>
        )}

        {/* Live Audience Activity Stats — CNC-Milled Wells */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-1">
          <div className="p-3.5 rounded-2xl skeuo-sunken text-center">
            <p className="text-base sm:text-xl font-black font-mono text-zinc-950">{formatPoints(team.totalInvestment)}</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mt-0.5 skeuo-text-emboss">Audience Pts</p>
          </div>
          <div className="p-3.5 rounded-2xl skeuo-sunken text-center">
            <p className="text-base sm:text-xl font-black font-mono text-zinc-950">{team.uniqueBackers}</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mt-0.5 skeuo-text-emboss">Backers</p>
          </div>
          <div className="p-3.5 rounded-2xl skeuo-sunken text-center">
            <p className="text-base sm:text-xl font-black font-mono text-zinc-950">#{
              teams
                .slice()
                .sort((a, b) => b.totalInvestment - a.totalInvestment)
                .findIndex(t => t.id === team.id) + 1
            }</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mt-0.5 skeuo-text-emboss" title="Audience engagement only — official results judged independently">
              Audience Rank*
            </p>
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 text-center pt-0.5 italic">
          *Audience scoring & gamification activity only. Official competition rankings are judged independently.
        </p>
      </div>

      {/* Countdown Card — Master Chronometer Console */}
      {(isPitchPhase || isInvestmentOpen) && (
        <div className={`p-6 rounded-3xl skeuo-surface text-center space-y-3 shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF] ${isUrgent ? 'border-2 border-rose-400 shadow-[0_6px_20px_rgba(244,63,94,0.15)]' : ''}`}>
          <div className="flex items-center justify-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider skeuo-text-emboss">
            <span className="skeuo-led-bezel">
              <span className={isUrgent ? 'skeuo-led-amber animate-ping' : 'skeuo-led-emerald'} />
            </span>
            <Clock size={14} className={isUrgent ? 'text-rose-600' : 'text-zinc-500'} />
            <span>
              {isPitchPhase ? 'Pitch Presentation Countdown' : 'Scoring Window Remaining'}
            </span>
          </div>

          <div className="py-1">
            <Countdown seconds={timeLeft} size="xl" className="my-1 skeuo-text-emboss" />
          </div>

          <div className="max-w-xs mx-auto skeuo-meter-track h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isUrgent
                  ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                  : 'bg-gradient-to-r from-zinc-800 to-zinc-950'
              }`}
              style={{
                width: `${Math.min(100, Math.max(0, (timeLeft / (isPitchPhase ? (activeRound.scheduledDurationSeconds || 300) : (activeRound.investmentWindowSeconds || 180))) * 100))}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Phase 1 Wait Banner */}
      {isPitchPhase && (
        <div className="p-5 rounded-2xl skeuo-sunken text-center space-y-1.5">
          <p className="text-zinc-950 font-black text-sm skeuo-text-emboss">Startup Presentation in Progress</p>
          <p className="text-zinc-600 text-xs max-w-sm mx-auto font-medium">
            Listen closely to the founders pitch their business. The scoring window will open as soon as their presentation concludes!
          </p>
        </div>
      )}

      {/* Phase 2 Investment Panel */}
      {isInvestmentOpen && !isExpired && (
        <InvestmentPanel teamId={team.id} roundId={activeRound.id} />
      )}

      {/* Attendee Ranking & Top 5 Audience Leaderboard for this Startup */}
      <div className="p-5 sm:p-6 rounded-3xl skeuo-surface space-y-4 shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF]">
        {/* Attendee's Own Ranking Card */}
        {(() => {
          const myStanding = teamStandings.find(s => s.userId === user?.id)
          if (myStanding) {
            return (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#1F1F23] to-[#09090B] text-white space-y-3.5 shadow-[0_12px_28px_-6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.22)] border border-black">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={18} className={myStanding.rank === 1 ? 'text-amber-400' : 'text-zinc-400'} />
                    <span className="font-bold text-xs uppercase tracking-wider text-zinc-300 skeuo-text-deboss">
                      Your Backer Standing
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-xl text-xs font-mono font-black ${
                    myStanding.rank === 1
                      ? 'skeuo-token-gold text-zinc-950'
                      : 'skeuo-token-dark'
                  }`}>
                    Rank #{myStanding.rank} of {teamStandings.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.08)] text-center">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Your Points</p>
                    <p className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">{formatPoints(myStanding.amount)}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.08)] text-center">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Your Speed</p>
                    <p className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">{formatExactMs(myStanding.timeElapsedMs)}</p>
                  </div>
                </div>

                {myStanding.rank === 1 ? (
                  <div className="p-2.5 rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-200 text-xs font-black text-center shadow-inner">
                    🏆 You are currently the #1 Audience Winner for {team.name}!
                  </div>
                ) : (
                  <p className="text-zinc-400 text-[11px] text-center font-medium">
                    Deploy more points to claim the #1 Audience Champion spot!
                  </p>
                )}
              </div>
            )
          }

          return (
            <div className="p-4 rounded-2xl skeuo-sunken text-center space-y-1">
              <p className="text-zinc-950 font-black text-xs skeuo-text-emboss">Audience Competition for {team.name}</p>
              <p className="text-zinc-500 text-[11px] font-medium">
                The attendee who deploys the highest points in the least time wins. Deploy points above to see your live ranking!
              </p>
            </div>
          )
        })()}

        {/* Top 5 Standings Table with Stamped Tokens */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider px-1 skeuo-text-emboss">
            <span>Top 5 Backers for {team.name}</span>
            <span>Speed (ms)</span>
          </div>

          {teamStandings.length === 0 ? (
            <div className="p-6 rounded-2xl skeuo-sunken text-center text-xs text-zinc-500">
              No audience scores recorded yet for this round.
            </div>
          ) : (
            <div className="skeuo-sunken rounded-2xl overflow-hidden p-1.5 space-y-1.5">
              {teamStandings.slice(0, 5).map((standing) => {
                const isMe = standing.userId === user?.id
                return (
                  <div
                    key={standing.userId}
                    className={`p-3 rounded-xl flex items-center justify-between text-xs transition-all ${
                      isMe
                        ? 'skeuo-surface border border-zinc-300 font-bold shadow-sm'
                        : 'bg-white/70 hover:bg-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 pr-2">
                      <span className={`w-7 h-7 rounded-lg font-mono font-black text-[11px] flex items-center justify-center flex-shrink-0 ${
                        standing.rank === 1
                          ? 'skeuo-token-gold'
                          : standing.rank === 2
                          ? 'skeuo-token-silver'
                          : standing.rank === 3
                          ? 'skeuo-token-bronze'
                          : 'skeuo-token text-zinc-700'
                      }`}>
                        #{standing.rank}
                      </span>
                      <div className="min-w-0 truncate">
                        <span className="text-zinc-950 font-bold truncate block sm:inline">
                          {standing.displayName}
                        </span>
                        {isMe && <span className="sm:ml-1.5 px-1.5 py-0.5 skeuo-token-dark rounded text-[9px] font-black">YOU</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 font-mono flex-shrink-0 text-right">
                      <span className="font-black text-zinc-950 text-xs sm:text-sm">
                        {formatPoints(standing.amount)}
                      </span>
                      <span className="skeuo-sunken px-2 py-0.5 rounded-lg text-zinc-600 text-[10px] sm:text-[11px] min-w-[65px] sm:min-w-[70px] text-right font-bold">
                        {formatExactMs(standing.timeElapsedMs)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activity Telemetry Feed */}
      <div className="p-5 sm:p-6 rounded-3xl skeuo-surface space-y-3 shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF]">
        <div className="flex items-center justify-between pb-1 border-b border-zinc-200/80">
          <h3 className="text-zinc-950 font-black text-sm flex items-center gap-2 skeuo-text-emboss">
            <Radio size={14} className="text-zinc-800" />
            Live Pitch Activity Telemetry
          </h3>
          <span className="skeuo-led-bezel">
            <span className="skeuo-led-emerald" />
          </span>
        </div>
        <div className="space-y-1.5">
          <AnimatePresence>
            {livePitch.recentActivity.slice(0, 6).map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2.5 text-xs text-zinc-700 p-2 rounded-xl skeuo-sunken"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
                <span className="flex-1 font-semibold">{item.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {livePitch.recentActivity.length === 0 && (
            <p className="text-zinc-400 text-xs text-center py-4 font-medium">No scores recorded yet for this round</p>
          )}
        </div>
      </div>
    </div>
  )
}
