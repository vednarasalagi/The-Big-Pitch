// ============================================================
// Scoreboard Page — Public live leaderboard
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Users, TrendingUp, Maximize2, Eye, EyeOff, Zap } from 'lucide-react'
import { useEventStore } from '@/store'
import { Card, StatusBadge, LiveIndicator, Countdown, ProgressBar, Button } from '@/components/ui'
import { formatPoints, ordinalSuffix } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import type { Team } from '@/types'

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>
  if (rank === 2) return <span className="text-2xl">🥈</span>
  if (rank === 3) return <span className="text-2xl">🥉</span>
  return <span className="text-white/40 font-bold text-sm w-6 text-center">#{rank}</span>
}

function TeamRow({ team, rank, maxPoints, blind }: { team: Team; rank: number; maxPoints: number; blind: boolean }) {
  const pct = maxPoints > 0 ? (team.totalInvestment / maxPoints) * 100 : 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, type: 'spring', stiffness: 200 }}
      className={`
        glass-card p-4 flex items-center gap-4
        ${rank === 1 ? 'border-amber-500/30 bg-amber-500/5' : ''}
        ${team.status === 'active' ? 'border-emerald-500/30 bg-emerald-500/5' : ''}
      `}
    >
      {/* Rank */}
      <div className="w-10 flex-shrink-0 flex justify-center">
        <RankBadge rank={rank} />
      </div>

      {/* Logo */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-arena-blue/30 to-arena-violet/30 flex items-center justify-center text-2xl font-black text-white flex-shrink-0 flex-shrink-0">
        {team.name[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-bold text-white text-sm">{team.name}</h3>
          {team.status === 'active' && <LiveIndicator label="LIVE" />}
          <StatusBadge status={team.status} />
        </div>
        <p className="text-white/50 text-xs truncate">{team.pitchTitle}</p>
        {!blind && (
          <ProgressBar value={pct} max={100} size="sm" color={rank === 1 ? 'amber' : 'blue'} className="mt-1.5" />
        )}
      </div>

      {/* Stats */}
      {blind ? (
        <div className="flex-shrink-0 text-center">
          <EyeOff size={20} className="text-white/20 mx-auto" />
          <p className="text-white/30 text-xs mt-1">Hidden</p>
        </div>
      ) : (
        <div className="flex-shrink-0 text-right">
          <p className="font-black text-arena-blue-3 text-lg">{formatPoints(team.totalInvestment)}</p>
          <div className="flex items-center gap-1 justify-end text-white/40 text-xs">
            <Users size={10} />
            <span>{team.uniqueBackers}</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export function ScoreboardPage() {
  const { event, teams, activeRound, livePitch } = useEventStore()
  const [blindMode, setBlindMode] = useState(event?.config.blindLeaderboard ?? false)
  const [fullscreen, setFullscreen] = useState(false)

  const sortedTeams = [...teams].sort((a, b) => b.totalInvestment - a.totalInvestment)
  const maxPoints = sortedTeams[0]?.totalInvestment ?? 1
  const totalInvested = teams.reduce((sum, t) => sum + t.totalInvestment, 0)
  const totalBackers = teams.reduce((sum, t) => sum + t.uniqueBackers, 0)
  const isLive = activeRound?.status === 'investment_open'

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={20} className="text-amber-400" />
            <h1 className="text-xl font-black text-white">Audience Scoreboard</h1>
            {isLive && <LiveIndicator />}
          </div>
          <p className="text-white/40 text-xs">{event?.name} · Powered by audience investment</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBlindMode(!blindMode)}
            className="p-2 rounded-lg glass-card hover:bg-white/[0.08] text-white/60 hover:text-white transition-colors"
            title={blindMode ? 'Show scores' : 'Enable blind mode'}
          >
            {blindMode ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg glass-card hover:bg-white/[0.08] text-white/60 hover:text-white transition-colors"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-lg font-bold text-arena-blue-3">{formatPoints(totalInvested)}</p>
          <p className="text-white/40 text-xs mt-0.5">Total Invested</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-bold text-arena-violet-3">{totalBackers}</p>
          <p className="text-white/40 text-xs mt-0.5">Unique Backers</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{livePitch.connectedViewers}</p>
          <p className="text-white/40 text-xs mt-0.5">Watching</p>
        </Card>
      </div>

      {/* Active pitch banner */}
      {isLive && activeRound?.team && (
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center text-xl font-bold text-white">
                {activeRound.team.name[0]}
              </div>
              <div>
                <p className="text-emerald-400 text-xs font-semibold">Now Pitching</p>
                <p className="text-white font-bold">{activeRound.team.name}</p>
              </div>
            </div>
            <div className="text-right">
              <Countdown seconds={livePitch.timeRemainingSeconds} size="md" />
              <p className="text-white/40 text-xs mt-0.5">remaining</p>
            </div>
          </div>
          <Link to="/live" className="block mt-3">
            <Button size="sm" icon={<Zap size={12} />} className="w-full justify-center text-xs">
              Invest Now
            </Button>
          </Link>
        </Card>
      )}

      {/* Blind mode notice */}
      {blindMode && (
        <div className="glass-card border-arena-amber/30 bg-arena-amber/5 p-3 text-center">
          <p className="text-amber-400 text-sm font-semibold">🙈 Blind Leaderboard Mode</p>
          <p className="text-white/50 text-xs mt-0.5">Scores are hidden until the round closes</p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="space-y-2">
        <AnimatePresence>
          {sortedTeams.map((team, i) => (
            <TeamRow
              key={team.id}
              team={team}
              rank={i + 1}
              maxPoints={maxPoints}
              blind={blindMode && isLive}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Important disclaimer */}
      <Card className="p-4 border-arena-violet/20 bg-arena-violet/5">
        <div className="flex items-start gap-3">
          <span className="text-lg flex-shrink-0">⚖️</span>
          <div>
            <p className="text-arena-violet-3 font-semibold text-sm">Audience Rankings Only</p>
            <p className="text-white/50 text-xs mt-1 leading-relaxed">
              These rankings reflect <strong>audience investment</strong> only and do not affect official judging. 
              Official judges evaluate pitches independently using separate criteria.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
