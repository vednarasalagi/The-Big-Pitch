// ============================================================
// Live Pitch Page — Real-time pitch + investment interface
// Minimalist, high contrast, clean white and black theme
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Radio, Users, Clock, CheckCircle2,
  AlertCircle, Timer, Flame, ArrowUpRight,
  Trophy, Crown, Zap, QrCode
} from 'lucide-react'
import { useAuthStore, useEventStore, useWalletStore } from '@/store'
import {
  Card, Button, StatusBadge, Countdown, LiveIndicator,
  Badge, ProgressBar, EmptyState, Avatar,
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
  PITCH_ROUND_UPDATE_EVENT,
  syncLiveState,
} from '@/lib/realtimeSync'
import { EntryPassModal } from '@/components/profile/EntryPassModal'

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
  const [entryPassOpen, setEntryPassOpen] = useState(false)

  const isGateVerified = user?.role === 'admin' || Boolean(user?.isEntryVerified)
  const available = wallet ? wallet.freePoints + wallet.purchasedPoints : 0
  const amount = selected ?? (custom ? parseInt(custom) : 0)
  const canInvest = user && isGateVerified && amount > 0 && amount <= available && !loading

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
    if (!user) return
    if (!isGateVerified) {
      toast.error('Event entry verification required. Please show your QR pass to a volunteer at the entrance.')
      setEntryPassOpen(true)
      return
    }
    if (!canInvest) return
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
    <div className="skeuo-surface p-3 sm:p-4 rounded-2xl space-y-2.5 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF] flex-shrink-0">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80 gap-2">
        <div>
          <h3 className="text-zinc-950 font-black text-xs sm:text-sm skeuo-text-emboss">Deploy Points</h3>
          <p className="text-zinc-500 text-[10px] font-medium">Back live startup</p>
        </div>
        {user && (
          <div className="skeuo-sunken px-2.5 py-1 rounded-xl text-right flex-shrink-0">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider skeuo-text-emboss">Available</span>
            <p className="text-zinc-950 font-black font-mono text-xs leading-tight">{formatPoints(available)} pts</p>
          </div>
        )}
      </div>

      {!user ? (
        <div className="text-center py-4 space-y-2 skeuo-sunken rounded-xl p-3">
          <p className="text-zinc-600 text-xs font-semibold">Sign in to deploy your 500 points</p>
          <Link to="/auth" className="inline-block">
            <Button size="sm" className="skeuo-btn-primary text-xs py-1.5 px-4">Sign In to Score</Button>
          </Link>
        </div>
      ) : !isGateVerified ? (
        <div className="py-3 px-3 space-y-2 skeuo-sunken rounded-xl text-center border border-amber-300/80 bg-amber-50/40">
          <div className="flex items-center justify-center gap-2 text-amber-800">
            <QrCode size={16} />
            <span className="text-xs font-bold">Entry Pass QR Scan Required</span>
          </div>
          <p className="text-zinc-600 text-[11px] leading-tight">
            Single-account rule: get verified by a volunteer at the entrance to deploy points.
          </p>
          <Button
            onClick={() => setEntryPassOpen(true)}
            className="skeuo-btn-primary text-xs font-bold py-1.5 px-3 inline-flex items-center gap-1.5 shadow-sm"
          >
            <QrCode size={13} />
            <span>Show QR Pass</span>
          </Button>
        </div>
      ) : justInvested ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-4 space-y-1 skeuo-sunken rounded-xl"
        >
          <div className="w-8 h-8 rounded-xl skeuo-token flex items-center justify-center mx-auto mb-1 text-emerald-700">
            <CheckCircle2 size={18} />
          </div>
          <p className="text-zinc-950 font-black text-xs sm:text-sm skeuo-text-emboss">Points Deployed!</p>
          <p className="text-emerald-700 text-xs font-black font-mono">+{amount} points deployed</p>
        </motion.div>
      ) : (
        <>
          {/* Quick Backing Amount Buttons */}
          <div className="space-y-1">
            <div className="grid grid-cols-5 gap-1.5">
              {QUICK_AMOUNTS.map(pts => (
                <button
                  key={pts}
                  onClick={() => handleQuickSelect(pts)}
                  disabled={pts > available}
                  className={`
                    py-1.5 sm:py-2 rounded-xl text-[11px] font-black font-mono select-none cursor-pointer
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
          <div className="relative skeuo-sunken rounded-xl p-0.5 flex items-center">
            <input
              type="number"
              value={custom}
              onChange={e => handleCustom(e.target.value)}
              placeholder="Or custom points..."
              min={1}
              max={available}
              className="w-full px-3 py-1.5 bg-transparent border-0 text-xs font-black font-mono text-zinc-950 placeholder-zinc-400 focus:outline-none"
            />
            <span className="pr-3 text-zinc-500 text-[10px] font-black uppercase font-mono">pts</span>
          </div>

          {/* Confirm/Score button */}
          {confirming ? (
            <div className="space-y-2 pt-0.5">
              <div className="p-2 rounded-xl skeuo-sunken text-center">
                <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider">Confirm Deploying</p>
                <p className="text-zinc-950 text-xl font-black font-mono">{amount} points</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} className="flex-1 justify-center py-2 text-xs">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleInvest} loading={loading} className="flex-1 justify-center py-2 text-xs skeuo-btn-emerald">
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-0.5">
              <Button
                onClick={handleInvest}
                disabled={!canInvest}
                loading={loading}
                className="w-full justify-center py-2.5 text-xs sm:text-sm font-black skeuo-btn-primary shadow-md"
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

      {/* Entry Pass Modal for prompt */}
      <EntryPassModal isOpen={entryPassOpen} onClose={() => setEntryPassOpen(false)} />
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
  const [passModalOpen, setPassModalOpen] = useState(false)

  const isGateVerified = user?.role === 'admin' || Boolean(user?.isEntryVerified)

  // Fast polling heartbeat & instant cross-tab stage listener on LivePitchPage:
  // guarantees attendee screen updates automatically the exact millisecond admin opens or changes pitch round
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

    const handleRoundUpdate = (e: any) => {
      if (e.detail?.round !== undefined) {
        useEventStore.getState().setActiveRound(e.detail.round)
      }
    }

    window.addEventListener(STANDINGS_INVALIDATE_EVENT, handleInvalidate)
    window.addEventListener(PITCH_ROUND_UPDATE_EVENT, handleRoundUpdate)
    return () => {
      clearInterval(timer)
      window.removeEventListener(STANDINGS_INVALIDATE_EVENT, handleInvalidate)
      window.removeEventListener(PITCH_ROUND_UPDATE_EVENT, handleRoundUpdate)
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
    <div className="max-w-md mx-auto px-3 sm:px-4 py-2 sm:py-3 min-h-[calc(100dvh-4.25rem)] flex flex-col justify-between gap-2 animate-fade-in text-zinc-900 overflow-hidden">
      {/* ── 1. COMPACT TOP HEADER: STARTUP LOGO & NAME + LIVE STATUS ── */}
      <div className="skeuo-surface p-2.5 sm:p-3 rounded-2xl flex items-center justify-between gap-2.5 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Startup Logo (Upload/Display) */}
          <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
            {team.logoUrl ? (
              <img
                src={team.logoUrl}
                alt={team.name}
                className="w-full h-full object-contain p-0.5"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="w-full h-full bg-zinc-950 text-white font-mono font-black text-sm flex items-center justify-center">
                {team.name[0]}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <h1 className="text-base font-black text-zinc-950 truncate tracking-tight skeuo-text-emboss">
                {team.name}
              </h1>
              {team.category && (
                <span className="px-1.5 py-0.2 rounded-md bg-zinc-100 text-[9px] font-bold text-zinc-600 border border-zinc-200 flex-shrink-0">
                  {team.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isPitchPhase ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  Pitching
                </span>
              ) : isInvestmentOpen ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Scoring Open
                </span>
              ) : isPaused ? (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-full">
                  Paused
                </span>
              ) : (
                <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.2 rounded-full">
                  Closed
                </span>
              )}
              <span className="text-[10px] text-zinc-400 font-mono font-bold">#{team.pitchOrder}</span>
            </div>
          </div>
        </div>

        {/* Live Countdown Clock */}
        {(isPitchPhase || isInvestmentOpen) && (
          <div className="skeuo-sunken px-2.5 py-1 rounded-xl text-right flex-shrink-0 border border-zinc-200/60">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-zinc-500 justify-end">
              <Clock size={10} className={isUrgent ? 'text-rose-500 animate-pulse' : 'text-zinc-400'} />
              <span>{isPitchPhase ? 'Pitch' : 'Time'}</span>
            </div>
            <p className={`font-mono font-black text-sm leading-tight mt-0.5 ${isUrgent ? 'text-rose-600 animate-pulse' : 'text-zinc-950'}`}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </p>
          </div>
        )}
      </div>

      {/* Gate Verification Required Bar (if user not verified) */}
      {user && !isGateVerified && (
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-950 flex items-center justify-between gap-2 shadow-xs flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <QrCode size={14} className="text-amber-800 flex-shrink-0" />
            <p className="text-[10px] sm:text-[11px] font-bold truncate">Gate verification required before scoring</p>
          </div>
          <Button
            size="sm"
            onClick={() => setPassModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] py-0.5 px-2.5 flex-shrink-0 h-7"
          >
            Show QR
          </Button>
        </div>
      )}

      {/* ── 2. TOP 3 INVESTORS IN A SINGLE LINE (PROJECTOR FORMAT, NO POSITIONS 4 & 5) ── */}
      <div className="skeuo-surface p-2.5 rounded-2xl shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF] flex-shrink-0 space-y-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            <Crown size={12} className="text-amber-500" />
            <h2 className="text-[10px] font-black text-zinc-950 uppercase tracking-wider skeuo-text-emboss">
              Top 3 Investors
            </h2>
          </div>
          <span className="text-[9px] font-mono font-bold text-zinc-400">Podium · Single Line</span>
        </div>

        {(() => {
          const rank1 = teamStandings[0]
          const rank2 = teamStandings[1]
          const rank3 = teamStandings[2]

          return (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 items-start text-center pt-1">
              {/* #1 GOLD CHAMPION */}
              <div className="flex flex-col items-center">
                <div className="relative mb-1">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Crown size={13} className="text-amber-400 fill-amber-400 drop-shadow-[0_1px_3px_rgba(251,191,36,0.9)] animate-pulse" />
                  </div>
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 shadow-[0_3px_10px_rgba(245,158,11,0.35)]">
                    <Avatar
                      name={rank1?.displayName || 'Leader'}
                      src={rank1?.avatarUrl}
                      size="md"
                      className="w-11 h-11 text-xs font-black border-2 border-white shadow-inner bg-zinc-900 text-white"
                    />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full skeuo-token-gold font-mono font-black text-[9px] flex items-center justify-center shadow-xs border border-white text-zinc-950">
                    1
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] font-black text-zinc-950 truncate max-w-[95px] leading-tight">
                  {rank1 ? rank1.displayName : 'Awaiting #1'}
                </p>
                <span className="mt-0.5 px-2 py-0.2 rounded-full skeuo-token-gold font-mono font-black text-[9px] text-zinc-950">
                  {rank1 ? formatPoints(rank1.amount) : '0'} pts
                </span>
              </div>

              {/* #2 SILVER RUNNER UP */}
              <div className="flex flex-col items-center">
                <div className="relative mb-1">
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-zinc-400 via-zinc-200 to-zinc-400 shadow-xs">
                    <Avatar
                      name={rank2?.displayName || 'Runner Up'}
                      src={rank2?.avatarUrl}
                      size="sm"
                      className="w-10 h-10 text-[11px] font-black border-2 border-white shadow-inner bg-zinc-800 text-white"
                    />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full skeuo-token-silver font-mono font-black text-[8px] flex items-center justify-center shadow-xs border border-white text-zinc-950">
                    2
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] font-bold text-zinc-950 truncate max-w-[95px] leading-tight">
                  {rank2 ? rank2.displayName : 'Awaiting #2'}
                </p>
                <span className="mt-0.5 px-2 py-0.2 rounded-full skeuo-token-silver font-mono font-black text-[9px] text-zinc-900">
                  {rank2 ? formatPoints(rank2.amount) : '0'} pts
                </span>
              </div>

              {/* #3 BRONZE RUNNER UP */}
              <div className="flex flex-col items-center">
                <div className="relative mb-1">
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-700 via-amber-400 to-amber-700 shadow-xs">
                    <Avatar
                      name={rank3?.displayName || 'Contender'}
                      src={rank3?.avatarUrl}
                      size="sm"
                      className="w-10 h-10 text-[11px] font-black border-2 border-white shadow-inner bg-zinc-800 text-white"
                    />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full skeuo-token-bronze font-mono font-black text-[8px] flex items-center justify-center shadow-xs border border-white text-zinc-950">
                    3
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] font-bold text-zinc-950 truncate max-w-[95px] leading-tight">
                  {rank3 ? rank3.displayName : 'Awaiting #3'}
                </p>
                <span className="mt-0.5 px-2 py-0.2 rounded-full skeuo-token-bronze font-mono font-black text-[9px] text-amber-950">
                  {rank3 ? formatPoints(rank3.amount) : '0'} pts
                </span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── 3. USER'S OWN POSITION (DIRECTLY BELOW TOP 3) ── */}
      {(() => {
        const myStanding = teamStandings.find(s => s.userId === user?.id)
        if (myStanding) {
          return (
            <div className="p-2 rounded-xl bg-zinc-950 text-white flex items-center justify-between gap-2 shadow-xs border border-zinc-900 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md skeuo-token-gold text-zinc-950 font-mono font-black text-[11px] flex items-center justify-center flex-shrink-0">
                  #{myStanding.rank}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate">
                    {myStanding.rank === 1 ? '🏆 You are the #1 Leader!' : 'Your Live Ranking Position'}
                  </p>
                  <p className="text-[9px] text-zinc-400 truncate">
                    Rank #{myStanding.rank} of {teamStandings.length} backers
                  </p>
                </div>
              </div>

              <div className="text-right flex-shrink-0 font-mono">
                <p className="text-xs font-black text-amber-400">{formatPoints(myStanding.amount)} pts</p>
                <p className="text-[9px] text-zinc-400">{formatExactMs(myStanding.timeElapsedMs)}</p>
              </div>
            </div>
          )
        }

        return (
          <div className="p-2 rounded-xl skeuo-sunken flex items-center justify-between gap-2 text-xs text-zinc-600 flex-shrink-0 border border-zinc-200/80">
            <div className="flex items-center gap-1.5 truncate">
              <Trophy size={13} className="text-zinc-400 flex-shrink-0" />
              <span className="truncate text-[10px] sm:text-[11px] font-medium">
                Your Position: <strong className="text-zinc-900">Not Backed Yet</strong>
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 flex-shrink-0">Deploy below to enter</span>
          </div>
        )
      })()}

      {/* ── 4. INVESTMENT WINDOW (BELOW USER'S POSITION) ── */}
      <div className="flex-1 min-h-0 flex flex-col justify-end">
        {isInvestmentOpen && !isExpired ? (
          <InvestmentPanel teamId={team.id} roundId={activeRound.id} />
        ) : isPitchPhase ? (
          <div className="p-3.5 rounded-2xl skeuo-sunken text-center space-y-1 my-auto">
            <p className="text-zinc-950 font-black text-xs sm:text-sm skeuo-text-emboss">
              Startup Presentation in Progress
            </p>
            <p className="text-zinc-500 text-[11px] max-w-xs mx-auto">
              Scoring window will open authoritatively as soon as the founders conclude their pitch!
            </p>
          </div>
        ) : isPaused ? (
          <div className="p-3.5 rounded-2xl skeuo-sunken border border-amber-300 text-center my-auto">
            <p className="text-amber-900 font-bold text-xs">⏸️ Scoring Round Temporarily Paused by Stage Control</p>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl skeuo-sunken text-center my-auto">
            <p className="text-zinc-700 font-bold text-xs skeuo-text-emboss">Scoring Window Closed for this Round</p>
          </div>
        )}
      </div>

      <EntryPassModal isOpen={passModalOpen} onClose={() => setPassModalOpen(false)} />
    </div>
  )
}
