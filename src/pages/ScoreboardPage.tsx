// ============================================================
// Scoreboard Page — Public live leaderboard
// Minimalist, high contrast, clean white and black theme
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Award, Users, Maximize2, Eye, EyeOff, Radio } from 'lucide-react'
import { useEventStore } from '@/store'
import { Card, StatusBadge, LiveIndicator, Countdown, ProgressBar, Button, Badge } from '@/components/ui'
import { formatPoints } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import type { Team } from '@/types'

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="w-8 h-8 rounded-xl bg-zinc-950 text-white font-mono font-black text-sm flex items-center justify-center shadow-sm">
        1
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="w-8 h-8 rounded-xl bg-zinc-200 text-zinc-900 font-mono font-black text-sm flex items-center justify-center">
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-700 font-mono font-black text-sm flex items-center justify-center border border-zinc-200">
        3
      </span>
    )
  }
  return <span className="text-zinc-400 font-mono font-bold text-sm w-8 text-center">#{rank}</span>
}

function TeamRow({ team, rank, maxPoints, blind }: { team: Team; rank: number; maxPoints: number; blind: boolean }) {
  const pct = maxPoints > 0 ? (team.totalInvestment / maxPoints) * 100 : 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
      className={`
        p-4 rounded-2xl bg-white border transition-all flex items-center gap-4 shadow-sm
        ${rank === 1 ? 'border-zinc-950/80 shadow-md ring-1 ring-zinc-950/10' : 'border-zinc-200/90 hover:border-zinc-300'}
        ${team.status === 'active' ? 'border-emerald-500 ring-2 ring-emerald-500/10' : ''}
      `}
    >
      {/* Rank */}
      <div className="w-8 flex-shrink-0 flex justify-center">
        <RankBadge rank={rank} />
      </div>

      {/* Logo */}
      <div className="w-11 h-11 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-lg font-black text-zinc-900 flex-shrink-0">
        {team.name[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-zinc-950 text-sm truncate">{team.name}</h3>
          <Badge variant="blue" className="text-[10px]">{team.category}</Badge>
          {team.status === 'active' && <LiveIndicator label="LIVE" />}
          <StatusBadge status={team.status} />
        </div>
        <p className="text-zinc-500 text-xs truncate">{team.pitchTitle}</p>
        {!blind && (
          <ProgressBar value={pct} max={100} size="sm" className="mt-1" />
        )}
      </div>

      {/* Stats */}
      {blind ? (
        <div className="flex-shrink-0 text-center">
          <EyeOff size={18} className="text-zinc-300 mx-auto" />
          <p className="text-zinc-400 text-[10px] mt-0.5">Hidden</p>
        </div>
      ) : (
        <div className="flex-shrink-0 text-right">
          <p className="font-black font-mono text-zinc-950 text-base">{formatPoints(team.totalInvestment)}</p>
          <div className="flex items-center gap-1 justify-end text-zinc-400 text-xs font-medium">
            <Users size={11} />
            <span>{team.uniqueBackers} backers</span>
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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in text-zinc-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award size={22} className="text-zinc-900" />
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Tournament Standings</h1>
            {isLive && <LiveIndicator />}
          </div>
          <p className="text-zinc-500 text-xs">Real-time audience investment ranking</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBlindMode(!blindMode)}
            className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm"
            title={blindMode ? 'Show scores' : 'Enable blind mode'}
          >
            {blindMode ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm"
            title="Toggle Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-zinc-200/90 text-center shadow-sm">
          <p className="text-2xl font-black font-mono text-zinc-950 tracking-tight">{formatPoints(totalInvested)}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium mt-0.5">Total Deployed</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-zinc-200/90 text-center shadow-sm">
          <p className="text-2xl font-black font-mono text-zinc-950 tracking-tight">{totalBackers}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium mt-0.5">Audience Backers</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-zinc-200/90 text-center shadow-sm">
          <p className="text-2xl font-black font-mono text-zinc-950 tracking-tight">{teams.length}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium mt-0.5">Startups Ranked</p>
        </div>
      </div>

      {/* Active pitch banner */}
      {isLive && activeRound?.team && (
        <div className="p-4 rounded-2xl bg-white border-2 border-emerald-500 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-sm">
              <Radio size={18} className="animate-pulse" />
            </div>
            <div>
              <p className="text-emerald-700 text-xs font-bold uppercase tracking-wider">Now Pitching on Stage</p>
              <p className="text-zinc-950 font-black text-base">{activeRound.team.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <Countdown seconds={livePitch.timeRemainingSeconds} size="sm" />
              <p className="text-zinc-400 text-[10px] uppercase font-semibold">Remaining</p>
            </div>
            <Link to="/live">
              <Button size="sm" className="bg-zinc-950 text-white">
                Invest Live
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Blind mode notice */}
      {blindMode && (
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-center">
          <p className="text-amber-900 font-semibold text-xs">Blind Leaderboard Mode Active</p>
          <p className="text-amber-700 text-[11px] mt-0.5">Point scores are hidden until the final stage reveal</p>
        </div>
      )}

      {/* Leaderboard rows */}
      <div className="space-y-2.5">
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
      <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-zinc-600 text-xs leading-relaxed">
        <p className="font-bold text-zinc-900 mb-0.5">Audience Scoreboard Standings</p>
        These standings represent live audience points allocation. Official tournament jury rankings are computed independently.
      </div>
    </div>
  )
}
