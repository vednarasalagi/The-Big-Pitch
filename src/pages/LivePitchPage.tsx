// ============================================================
// Live Pitch Page — Real-time pitch + investment interface
// Minimalist, high contrast, clean white and black theme
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Radio, Users, Clock, CheckCircle2,
  AlertCircle, Timer, Flame, ArrowUpRight
} from 'lucide-react'
import { useAuthStore, useEventStore, useWalletStore } from '@/store'
import {
  Card, Button, StatusBadge, Countdown, LiveIndicator,
  Badge, ProgressBar, EmptyState,
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
        message: `Investor deployed ${amount} pts into ${team?.name ?? 'the startup'}`,
        timestamp: new Date().toISOString(),
      })

      toast.success(`Invested ${amount} points successfully!`)
      setJustInvested(true)
      setSelected(null)
      setCustom('')
      setTimeout(() => setJustInvested(false), 3000)
    } catch {
      toast.error('Investment could not be completed. Please try again.')
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
            <Button size="md" className="bg-zinc-950 text-white">Sign In to Invest</Button>
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
          <p className="text-zinc-950 font-bold text-base">Investment Confirmed</p>
          <p className="text-zinc-500 text-xs font-mono">+{amount} points deployed</p>
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
                  py-2.5 rounded-xl text-xs font-bold font-mono transition-all duration-150
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

          {/* Confirm/Invest button */}
          {confirming ? (
            <div className="space-y-2">
              <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 text-center">
                <p className="text-zinc-600 text-xs font-semibold">Confirm Investment</p>
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
              {amount > 0 ? `Invest ${amount} Points` : 'Select Points to Invest'}
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
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8 animate-fade-in text-zinc-900">
        <EmptyState
          icon={<Timer size={40} className="text-zinc-400" />}
          title="No Active Pitch on Stage"
          description="The next startup pitch will be called shortly by the event administrator. You can review current tournament standings below."
          action={
            <Link to="/scoreboard">
              <Button variant="secondary">View Leaderboard</Button>
            </Link>
          }
        />

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

  const isOpen = activeRound.status === 'investment_open'
  const isPaused = activeRound.status === 'investment_paused'
  const isUrgent = timeLeft <= 30

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5 animate-fade-in text-zinc-900">
      {/* Status banner */}
      {isOpen && (
        <div className="p-4 rounded-2xl bg-white border border-emerald-500/80 shadow-sm flex items-center gap-3">
          <LiveIndicator label="INVESTING OPEN" />
          <p className="text-zinc-700 text-xs sm:text-sm flex-1 leading-snug">
            <strong className="text-zinc-950">{team.name}</strong> is currently on stage! Review their vision below and submit your investment.
          </p>
        </div>
      )}
      {isPaused && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
          <p className="text-amber-900 font-semibold text-xs">⏸️ Investment Round Temporarily Paused by Admin</p>
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

        {/* Live stats */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
            <p className="text-lg font-bold font-mono text-zinc-950">{formatPoints(team.totalInvestment)}</p>
            <p className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Points</p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
            <p className="text-lg font-bold font-mono text-zinc-950">{team.uniqueBackers}</p>
            <p className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Backers</p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
            <p className="text-lg font-bold font-mono text-zinc-950">#{
              teams
                .slice()
                .sort((a, b) => b.totalInvestment - a.totalInvestment)
                .findIndex(t => t.id === team.id) + 1
            }</p>
            <p className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Rank</p>
          </div>
        </div>
      </Card>

      {/* Countdown */}
      {isOpen && (
        <Card className={`p-6 text-center border-zinc-200/90 bg-white shadow-sm ${isUrgent ? 'border-rose-400 bg-rose-50/20' : ''}`}>
          <div className="flex items-center justify-center gap-2 mb-1 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <Clock size={14} className={isUrgent ? 'text-rose-600' : 'text-zinc-400'} />
            <span>Investment Window Remaining</span>
          </div>
          <Countdown seconds={timeLeft} size="xl" className="my-2" />
          <ProgressBar
            value={timeLeft}
            max={activeRound.investmentWindowSeconds}
            className="max-w-xs mx-auto"
          />
        </Card>
      )}

      {/* Investment Panel */}
      {isOpen && (
        <InvestmentPanel teamId={team.id} roundId={activeRound.id} />
      )}

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
            <p className="text-zinc-400 text-xs text-center py-2">No investments recorded yet for this round</p>
          )}
        </div>
      </Card>
    </div>
  )
}
