// ============================================================
// Live Pitch Page — Real-time pitch + investment interface
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, Users, TrendingUp, Clock, CheckCircle2,
  AlertCircle, Timer, Flame, ChevronRight,
} from 'lucide-react'
import { useAuthStore, useEventStore, useWalletStore, useNotificationStore } from '@/store'
import {
  Card, Button, StatusBadge, Countdown, LiveIndicator,
  Avatar, Badge, ProgressBar, EmptyState,
} from '@/components/ui'
import { formatPoints, generateId } from '@/lib/utils'
import { submitInvestment } from '@/lib/supabaseApi'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const QUICK_AMOUNTS = [10, 25, 50, 100, 200]

function InvestmentPanel({ teamId, roundId }: { teamId: string; roundId: string }) {
  const { user } = useAuthStore()
  const { wallet, deductPoints, addInvestment } = useWalletStore()
  const { updateTeamInvestment, addActivity, teams, event } = useEventStore()

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
      if (wallet) {
        const res = await submitInvestment({
          userId: user.id,
          eventId: event?.id || '11111111-0000-0000-0000-000000000001',
          teamId,
          roundId,
          amount,
          wallet,
        })

        if (!res.success) {
          toast.error(res.error || 'Investment could not be processed.')
          setLoading(false)
          return
        }
      }

      // Deduct wallet in local state
      deductPoints(amount)

      // Add investment record
      const inv = {
        id: generateId(),
        userId: user.id,
        eventId: event?.id || '11111111-0000-0000-0000-000000000001',
        teamId,
        roundId,
        amount,
        createdAt: new Date().toISOString(),
      }
      addInvestment(inv)

      // Update team total
      const team = teams.find(t => t.id === teamId)
      if (team) {
        updateTeamInvestment(teamId, amount, team.uniqueBackers + 1)
      }

      // Add activity feed item
      addActivity({
        id: generateId(),
        type: 'investment',
        message: `Someone invested ${amount} pts in ${team?.name ?? 'the team'}`,
        timestamp: new Date().toISOString(),
      })

      toast.success(`🎉 Invested ${amount} points!`)
      setJustInvested(true)
      setSelected(null)
      setCustom('')
      setTimeout(() => setJustInvested(false), 3000)
    } catch {
      toast.error('Investment failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-base">💸 Invest Points</h3>
        {wallet && (
          <div className="text-right">
            <p className="text-xs text-white/40">Available</p>
            <p className="text-arena-blue-3 font-bold text-sm">{formatPoints(available)}</p>
          </div>
        )}
      </div>

      {!user ? (
        <div className="text-center py-4">
          <p className="text-white/50 text-sm mb-3">Sign in to invest your points</p>
          <Link to="/auth">
            <Button icon={<Zap size={14} />}>Sign In with Google</Button>
          </Link>
        </div>
      ) : justInvested ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-6"
        >
          <div className="text-5xl mb-2">🎉</div>
          <p className="text-emerald-400 font-bold text-lg">Investment Confirmed!</p>
          <p className="text-white/50 text-sm">+{amount} pts invested</p>
        </motion.div>
      ) : (
        <>
          {/* Quick amounts */}
          <div className="grid grid-cols-5 gap-2">
            {QUICK_AMOUNTS.map(pts => (
              <button
                key={pts}
                onClick={() => handleQuickSelect(pts)}
                disabled={pts > available}
                className={`
                  py-2.5 rounded-xl text-sm font-bold transition-all duration-150
                  ${selected === pts
                    ? 'bg-gradient-to-r from-arena-blue to-arena-violet text-white shadow-glow-blue scale-105'
                    : pts > available
                    ? 'bg-white/[0.03] text-white/20 cursor-not-allowed'
                    : 'bg-white/[0.06] text-white hover:bg-white/[0.10] border border-white/[0.08]'}
                `}
              >
                {pts}
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
              className="arena-input pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">pts</span>
          </div>

          {/* Confirm/Invest button */}
          {confirming ? (
            <div className="space-y-2">
              <div className="glass-card border-arena-amber/30 bg-arena-amber/5 p-3 text-center">
                <p className="text-amber-400 text-sm font-semibold">Confirm Investment</p>
                <p className="text-white text-2xl font-black mt-1">{amount} points</p>
                <p className="text-white/40 text-xs mt-0.5">This cannot be undone once the round closes</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setConfirming(false)} className="flex-1 justify-center">
                  Cancel
                </Button>
                <Button onClick={handleInvest} loading={loading} className="flex-1 justify-center">
                  <CheckCircle2 size={14} />
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleInvest}
              disabled={!canInvest}
              loading={loading}
              className="w-full justify-center"
              icon={<TrendingUp size={14} />}
            >
              {amount > 0 ? `Invest ${amount} Points` : 'Select an amount'}
            </Button>
          )}

          {available === 0 && (
            <div className="flex items-center gap-2 p-3 glass-card border-rose-500/20 bg-rose-500/5 rounded-xl">
              <AlertCircle size={14} className="text-rose-400 flex-shrink-0" />
              <p className="text-rose-300 text-xs">No points available. <Link to="/wallet" className="underline">Buy more points</Link></p>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export function LivePitchPage() {
  const { event, activeRound, livePitch, updateLivePitch } = useEventStore()
  const team = activeRound?.team
  const [timeLeft, setTimeLeft] = useState(livePitch.timeRemainingSeconds)

  // Countdown timer
  useEffect(() => {
    if (!activeRound?.investmentCloseTime) return
    const closeTime = new Date(activeRound.investmentCloseTime).getTime()

    const tick = () => {
      const remaining = Math.max(0, Math.floor((closeTime - Date.now()) / 1000))
      setTimeLeft(remaining)
      updateLivePitch({ timeRemainingSeconds: remaining })
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeRound?.investmentCloseTime])

  if (!activeRound || !team) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <EmptyState
          icon={<Timer />}
          title="No Active Pitch"
          description="Stay tuned! The next pitch will be announced soon. Check the scoreboard to see current standings."
          action={
            <Link to="/scoreboard">
              <Button variant="secondary" icon={<TrendingUp size={14} />}>View Scoreboard</Button>
            </Link>
          }
        />
        {/* Show upcoming teams */}
        <div className="mt-8 space-y-2">
          <h2 className="text-white font-bold text-base px-1">Up Next</h2>
          {useEventStore.getState().teams
            .filter(t => t.status === 'upcoming')
            .map(t => (
              <Card key={t.id} className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-arena-blue/20 flex items-center justify-center text-lg font-bold text-white">
                  {t.pitchOrder}
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-white/40 text-xs">{t.pitchTitle}</p>
                </div>
                <StatusBadge status={t.status} />
              </Card>
            ))}
        </div>
      </div>
    )
  }

  const isOpen = activeRound.status === 'investment_open'
  const isPaused = activeRound.status === 'investment_paused'
  const isUrgent = timeLeft <= 30

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      {/* Status banner */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3"
        >
          <LiveIndicator label="INVESTING OPEN" />
          <p className="text-white/80 text-sm flex-1">
            🚀 <strong className="text-white">{team.name}</strong> is on stage! Listen to their pitch and invest your points.
          </p>
        </motion.div>
      )}
      {isPaused && (
        <div className="glass-card border-amber-500/30 bg-amber-500/5 p-3 text-center">
          <p className="text-amber-400 font-semibold text-sm">⏸️ Investing Temporarily Paused</p>
        </div>
      )}

      {/* Team Profile */}
      <Card className="overflow-hidden">
        {/* Header gradient */}
        <div className="h-2 w-full bg-gradient-to-r from-arena-blue to-arena-violet" />
        <div className="p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-arena-blue/40 to-arena-violet/40 flex items-center justify-center text-3xl font-black text-white flex-shrink-0">
              {team.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-black text-white">{team.name}</h1>
                <Badge variant="blue">{team.category}</Badge>
              </div>
              <p className="text-arena-blue-3 font-semibold text-sm">{team.pitchTitle}</p>
              <p className="text-white/50 text-xs mt-1">
                {team.presenters.join(' · ')}
              </p>
            </div>
          </div>

          <p className="text-white/70 text-sm leading-relaxed mb-4">{team.description}</p>

          {/* Live stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-3 text-center">
              <p className="text-lg font-bold text-arena-blue-3">{formatPoints(team.totalInvestment)}</p>
              <p className="text-white/40 text-xs">Invested</p>
            </div>
            <div className="glass-card p-3 text-center">
              <p className="text-lg font-bold text-arena-violet-3">{team.uniqueBackers}</p>
              <p className="text-white/40 text-xs">Backers</p>
            </div>
            <div className="glass-card p-3 text-center">
              <p className="text-lg font-bold text-emerald-400">#{
                useEventStore.getState().teams
                  .sort((a, b) => b.totalInvestment - a.totalInvestment)
                  .findIndex(t => t.id === team.id) + 1
              }</p>
              <p className="text-white/40 text-xs">Rank</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Countdown */}
      {isOpen && (
        <Card className={`p-5 text-center ${isUrgent ? 'border-rose-500/40 bg-rose-500/5' : ''}`}>
          <div className="flex items-center justify-center gap-3 mb-1">
            <Clock size={16} className={isUrgent ? 'text-rose-400' : 'text-white/50'} />
            <p className="text-white/60 text-sm font-medium">Investment Window Closes</p>
            {isUrgent && <Flame size={16} className="text-rose-400 animate-pulse" />}
          </div>
          <Countdown seconds={timeLeft} size="xl" className="my-2" />
          <ProgressBar
            value={timeLeft}
            max={activeRound.investmentWindowSeconds}
            color={isUrgent ? 'rose' : 'blue'}
            className="max-w-xs mx-auto"
          />
        </Card>
      )}

      {/* Investment Panel */}
      {isOpen && (
        <InvestmentPanel teamId={team.id} roundId={activeRound.id} />
      )}

      {/* Activity Feed */}
      <Card className="p-4">
        <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <Flame size={14} className="text-arena-amber" />
          Live Activity
        </h3>
        <div className="space-y-2">
          <AnimatePresence>
            {livePitch.recentActivity.slice(0, 6).map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-sm text-white/60 py-1 border-b border-white/[0.05] last:border-0"
              >
                <span className="text-xs">
                  {item.type === 'investment' ? '💸' : item.type === 'new_backer' ? '🎯' : '📣'}
                </span>
                <span className="flex-1">{item.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {livePitch.recentActivity.length === 0 && (
            <p className="text-white/30 text-xs text-center py-2">No activity yet</p>
          )}
        </div>
      </Card>

      {/* Connected viewers */}
      <div className="flex items-center justify-center gap-2 text-white/30 text-xs py-2">
        <Users size={12} />
        <span>{livePitch.connectedViewers} people watching</span>
      </div>
    </div>
  )
}
