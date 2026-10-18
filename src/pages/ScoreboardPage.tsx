// ============================================================
// Scoreboard Page — Public Leaderboard & Official Jury Results
// Strictly separates Audience Investment Activity from Official
// Competition Rankings to ensure absolute judging independence.
// Minimalist, high contrast, clean white and black theme.
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Award, Users, Maximize2, Eye, EyeOff, Radio,
  Trophy, ShieldCheck, Lock, CheckCircle2, Sparkles,
  TrendingUp, Activity, FileText
} from 'lucide-react'
import { useEventStore } from '@/store'
import {
  Card, StatusBadge, LiveIndicator, Countdown,
  ProgressBar, Button, Badge
} from '@/components/ui'
import { formatPoints } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import type { Team } from '@/types'

function AudienceRankBadge({ rank }: { rank: number }) {
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

function OfficialRankBadge({ rank }: { rank?: number }) {
  if (rank === 1) {
    return (
      <span className="w-9 h-9 rounded-xl bg-amber-500 text-white font-mono font-black text-sm flex items-center justify-center shadow-sm">
        <Trophy size={16} />
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="w-9 h-9 rounded-xl bg-zinc-300 text-zinc-900 font-mono font-black text-sm flex items-center justify-center">
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="w-9 h-9 rounded-xl bg-amber-700/80 text-white font-mono font-black text-sm flex items-center justify-center">
        3
      </span>
    )
  }
  return (
    <span className="text-zinc-500 font-mono font-bold text-sm w-9 text-center">
      {rank ? `#${rank}` : '—'}
    </span>
  )
}

function AudienceTeamRow({
  team,
  rank,
  maxPoints,
  blind,
}: {
  team: Team
  rank: number
  maxPoints: number
  blind: boolean
}) {
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
      {/* Audience Points Rank */}
      <div className="w-8 flex-shrink-0 flex justify-center">
        <AudienceRankBadge rank={rank} />
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

function OfficialTeamRow({ team }: { team: Team }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        p-4 rounded-2xl bg-white border transition-all flex items-center gap-4 shadow-sm
        ${team.officialRank === 1 ? 'border-amber-400 bg-amber-50/20 shadow-md ring-1 ring-amber-400/30' : 'border-zinc-200/90'}
      `}
    >
      {/* Official Jury Rank */}
      <div className="w-9 flex-shrink-0 flex justify-center">
        <OfficialRankBadge rank={team.officialRank ?? undefined} />
      </div>

      {/* Logo */}
      <div className="w-11 h-11 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-lg font-black text-zinc-900 flex-shrink-0">
        {team.name[0]}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-zinc-950 text-sm truncate">{team.name}</h3>
          <Badge variant="blue" className="text-[10px]">{team.category}</Badge>
          {team.officialAward && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
              <Sparkles size={10} />
              {team.officialAward}
            </span>
          )}
        </div>
        <p className="text-zinc-500 text-xs truncate">{team.pitchTitle}</p>
        {team.officialNotes && (
          <p className="text-zinc-600 text-[11px] italic pt-0.5">
            Jury Note: "{team.officialNotes}"
          </p>
        )}
      </div>

      {/* Official Jury Score */}
      <div className="flex-shrink-0 text-right">
        {team.officialScore !== undefined && team.officialScore !== null ? (
          <div>
            <p className="font-black font-mono text-zinc-950 text-base">{team.officialScore} <span className="text-xs font-normal text-zinc-400">/ 100</span></p>
            <p className="text-zinc-400 text-[10px] uppercase font-semibold">Jury Score</p>
          </div>
        ) : (
          <span className="text-zinc-400 text-xs font-mono">Unscored</span>
        )}
      </div>
    </motion.div>
  )
}

export function ScoreboardPage() {
  const { event, teams, activeRound, livePitch } = useEventStore()
  const [activeTab, setActiveTab] = useState<'audience' | 'official'>('audience')
  const [blindMode, setBlindMode] = useState(event?.config.blindLeaderboard ?? false)
  const [fullscreen, setFullscreen] = useState(false)

  const isOfficialPublished = Boolean(event?.config.officialResultsPublished)

  // Audience sorted strictly by investment points
  const sortedAudienceTeams = [...teams].sort((a, b) => b.totalInvestment - a.totalInvestment)
  const maxPoints = sortedAudienceTeams[0]?.totalInvestment ?? 1
  const totalInvested = teams.reduce((sum, t) => sum + t.totalInvestment, 0)
  const totalBackers = teams.reduce((sum, t) => sum + t.uniqueBackers, 0)
  const isLive = activeRound?.status === 'investment_open'

  // Official sorted strictly by officialRank (unranked last)
  const sortedOfficialTeams = [...teams].sort((a, b) => {
    const rankA = a.officialRank ?? 9999
    const rankB = b.officialRank ?? 9999
    if (rankA !== rankB) return rankA - rankB
    return (b.officialScore ?? 0) - (a.officialScore ?? 0)
  })

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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={22} className="text-zinc-950" />
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight">
              {activeTab === 'audience' ? 'Audience Investment Leaderboard' : 'Official Competition Results'}
            </h1>
            {isLive && <LiveIndicator />}
          </div>
          <p className="text-zinc-500 text-xs">
            {activeTab === 'audience'
              ? 'Real-time audience points allocation and backer activity.'
              : 'Independent jury evaluations, official scores, and competition awards.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'audience' && (
            <button
              onClick={() => setBlindMode(!blindMode)}
              className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm"
              title={blindMode ? 'Show scores' : 'Enable blind mode'}
            >
              {blindMode ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm"
            title="Toggle Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Dual Tab Switcher: Audience vs Official Results */}
      <div className="flex p-1.5 rounded-2xl bg-zinc-100 border border-zinc-200/80">
        <button
          onClick={() => setActiveTab('audience')}
          className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
            activeTab === 'audience'
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <TrendingUp size={14} className="flex-shrink-0" />
          <span className="hidden sm:inline">Audience Investment Activity</span>
          <span className="sm:hidden">Audience Standings</span>
        </button>

        <button
          onClick={() => setActiveTab('official')}
          className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
            activeTab === 'official'
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Award size={14} className="flex-shrink-0" />
          <span className="hidden sm:inline">Official Competition Results</span>
          <span className="sm:hidden">Official Jury</span>
          {isOfficialPublished && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          )}
        </button>
      </div>

      {/* ── VIEW 1: AUDIENCE INVESTMENT ACTIVITY LEADERBOARD ── */}
      {activeTab === 'audience' && (
        <div className="space-y-6 animate-fade-in">
          {/* Audience Independence Disclaimer Notice */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/90 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-zinc-900">
              <ShieldCheck size={15} className="text-zinc-700" />
              <span>Audience Investment Notice</span>
            </div>
            <p className="text-zinc-600 leading-relaxed">
              This leaderboard tracks live audience point allocations and crowd backing enthusiasm.
              <strong> Audience investments do NOT determine, influence, or tie-break official competition winners.</strong> Official results are judged independently by the official jury.
            </p>
          </div>

          {/* Global stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 sm:p-4 rounded-2xl bg-white border border-zinc-200/90 text-center shadow-sm">
              <p className="text-lg sm:text-2xl font-black font-mono text-zinc-950 tracking-tight">{formatPoints(totalInvested)}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-wider font-semibold mt-0.5">Points Deployed</p>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white border border-zinc-200/90 text-center shadow-sm">
              <p className="text-lg sm:text-2xl font-black font-mono text-zinc-950 tracking-tight">{totalBackers}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-wider font-semibold mt-0.5">Backers</p>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white border border-zinc-200/90 text-center shadow-sm">
              <p className="text-lg sm:text-2xl font-black font-mono text-zinc-950 tracking-tight">{teams.length}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-wider font-semibold mt-0.5">Startups</p>
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
              <p className="text-amber-700 text-[11px] mt-0.5">Audience point scores are hidden until the final stage reveal</p>
            </div>
          )}

          {/* Audience Leaderboard rows */}
          <div className="space-y-2.5">
            <AnimatePresence>
              {sortedAudienceTeams.map((team, i) => (
                <AudienceTeamRow
                  key={team.id}
                  team={team}
                  rank={i + 1}
                  maxPoints={maxPoints}
                  blind={blindMode && isLive}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── VIEW 2: OFFICIAL COMPETITION RESULTS (INDEPENDENT JURY) ── */}
      {activeTab === 'official' && (
        <div className="space-y-6 animate-fade-in">
          {!isOfficialPublished ? (
            <div className="p-10 rounded-2xl bg-white border border-zinc-200 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-400 flex items-center justify-center mx-auto">
                <Lock size={26} />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-zinc-950 font-black text-lg">Official Results Unpublished</h3>
                <p className="text-zinc-600 text-xs leading-relaxed">
                  The official judges evaluate pitching teams independently using their own scoring process (including pen and paper).
                  Official competition rankings and winners will be published here by event administrators once jury deliberations conclude.
                </p>
              </div>
              <div className="pt-2">
                <Button variant="secondary" size="sm" onClick={() => setActiveTab('audience')}>
                  View Audience Investment Activity
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-emerald-400/80 shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="text-zinc-950 font-bold text-xs uppercase tracking-wider">Official Jury Decision Published</h4>
                  <p className="text-zinc-500 text-xs">
                    These are the independently evaluated and verified competition rankings from the official judging panel.
                  </p>
                </div>
              </div>

              {/* Official Results List */}
              <div className="space-y-2.5">
                <AnimatePresence>
                  {sortedOfficialTeams.map(team => (
                    <OfficialTeamRow key={team.id} team={team} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
