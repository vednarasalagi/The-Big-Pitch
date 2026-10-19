// ============================================================
// Scoreboard Page — Public Leaderboard & Official Jury Results
// Strictly separates Audience Investment Activity from Official
// Competition Rankings to ensure absolute judging independence.
// Features:
// 1. Per-Pitch Leaderboards (select any startup, active or completed)
// 2. Overall Event Standings (aggregated audience points)
// 3. Official Jury Results (independent verified judging)
// Minimalist, high contrast, clean white and black theme.
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Award, Users, Maximize2, Eye, EyeOff, Radio,
  Trophy, ShieldCheck, Lock, CheckCircle2, Sparkles,
  TrendingUp, Activity, FileText, Layers, Target,
  Zap, Crown, Clock, ArrowRight, User
} from 'lucide-react'
import { useEventStore, useAuthStore, useWalletStore } from '@/store'
import {
  Card, StatusBadge, LiveIndicator, Countdown,
  ProgressBar, Button, Badge
} from '@/components/ui'
import { formatPoints, formatExactMs } from '@/lib/utils'
import { supabase, TABLES } from '@/lib/supabase'
import { getTeamAudienceStandings } from '@/lib/supabaseApi'
import { STANDINGS_INVALIDATE_EVENT, syncLiveState } from '@/lib/realtimeSync'
import { motion, AnimatePresence } from 'framer-motion'
import type { Team, TeamInvestorStanding } from '@/types'

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
  onSelectPitch,
}: {
  team: Team
  rank: number
  maxPoints: number
  blind: boolean
  onSelectPitch?: () => void
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
        p-3.5 sm:p-4 rounded-2xl bg-white border transition-all flex items-center gap-3 sm:gap-4 shadow-sm
        ${rank === 1 ? 'border-zinc-950/80 shadow-md ring-1 ring-zinc-950/10' : 'border-zinc-200/90 hover:border-zinc-300'}
        ${team.status === 'active' ? 'border-emerald-500 ring-2 ring-emerald-500/10' : ''}
      `}
    >
      {/* Audience Points Rank */}
      <div className="w-8 flex-shrink-0 flex justify-center">
        <AudienceRankBadge rank={rank} />
      </div>

      {/* Logo */}
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-base sm:text-lg font-black text-zinc-900 flex-shrink-0">
        {team.name[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-[10px] uppercase font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
            Pitch #{team.pitchOrder}
          </span>
          <h3 className="font-bold text-zinc-950 text-xs sm:text-sm truncate">{team.name}</h3>
          <Badge variant="blue" className="text-[10px]">{team.category}</Badge>
          {team.status === 'active' && <LiveIndicator label="LIVE" />}
          <StatusBadge status={team.status} />
        </div>
        <p className="text-zinc-500 text-[11px] sm:text-xs truncate">{team.pitchTitle}</p>
        {!blind && (
          <ProgressBar value={pct} max={100} size="sm" className="mt-1" />
        )}
      </div>

      {/* Stats & Link to pitch leaderboard */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {blind ? (
          <div className="text-center">
            <EyeOff size={18} className="text-zinc-300 mx-auto" />
            <p className="text-zinc-400 text-[10px] mt-0.5">Hidden</p>
          </div>
        ) : (
          <div className="text-right">
            <p className="font-black font-mono text-zinc-950 text-sm sm:text-base">{formatPoints(team.totalInvestment)}</p>
            <div className="flex items-center gap-1 justify-end text-zinc-400 text-[11px] font-medium">
              <Users size={11} />
              <span>{team.uniqueBackers}</span>
            </div>
          </div>
        )}

        {onSelectPitch && (
          <button
            onClick={onSelectPitch}
            className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 transition-colors ml-1"
            title="View Pitch Leaderboard"
          >
            <ArrowRight size={15} />
          </button>
        )}
      </div>
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

// ── Specific Pitch Audience Leaderboard View ──────────────────
function PitchStandingsView({
  team,
  isLive,
}: {
  team: Team
  isLive: boolean
}) {
  const { user } = useAuthStore()
  const { investments: localInvestments } = useWalletStore()
  const [standings, setStandings] = useState<TeamInvestorStanding[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadData = async (isInitial = false) => {
      if (isInitial) setLoading(true)
      try {
        const data = await getTeamAudienceStandings(team.id)
        if (!isMounted) return

        if (data.length > 0) {
          setStandings(data)
        } else {
          // Check local investments fallback
          const teamInvs = localInvestments.filter(i => i.teamId === team.id)
          if (teamInvs.length > 0) {
            setStandings([
              {
                userId: user?.id || 'current-user',
                displayName: user?.displayName || 'Audience Backer',
                email: user?.email || '',
                amount: teamInvs.reduce((s, i) => s + i.amount, 0),
                timeElapsedMs: teamInvs[0]?.timeElapsedMs || 1420,
                investedAt: teamInvs[0]?.createdAt || new Date().toISOString(),
                rank: 1,
              },
            ])
          } else {
            setStandings([])
          }
        }
      } catch (err) {
        console.warn('Failed to load pitch audience standings:', err)
      } finally {
        if (isMounted && isInitial) {
          setLoading(false)
        }
      }
    }

    // Always load once on pitch selection / mount
    loadData(true)

    // IF INVESTING IS CLOSED: Do NOT poll. Load only once!
    if (!isLive) {
      return () => {
        isMounted = false
      }
    }

    // ONLY IF INVESTING IS ACTIVELY OPEN / LIVE:
    const interval = setInterval(() => {
      loadData(false)
    }, 3000)

    const handleInvalidate = (e: any) => {
      if (!e.detail?.teamId || e.detail.teamId === team.id) {
        loadData(false)
      }
    }
    window.addEventListener(STANDINGS_INVALIDATE_EVENT, handleInvalidate)

    let channel: any = null
    if (supabase) {
      channel = supabase
        .channel(`pitch-leaderboard-${team.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: TABLES.INVESTMENTS, filter: `team_id=eq.${team.id}` },
          () => {
            loadData(false)
          }
        )
        .subscribe()
    }

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener(STANDINGS_INVALIDATE_EVENT, handleInvalidate)
      if (channel && supabase) supabase.removeChannel(channel)
    }
  }, [team.id, isLive])

  const champion = standings.length > 0 ? standings[0] : null

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Selected Pitch Info Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-zinc-950 text-white">
                Pitch #{team.pitchOrder}
              </span>
              <Badge variant="blue" className="text-[11px]">{team.category}</Badge>
              <StatusBadge status={team.status} />
              {isLive && <LiveIndicator label="SCORING OPEN" />}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight leading-tight">
              {team.name}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-zinc-700">
              {team.pitchTitle}
            </p>
            {team.presenters && team.presenters.length > 0 && (
              <p className="text-[11px] text-zinc-500 pt-0.5">
                Founders: <strong className="text-zinc-700">{team.presenters.join(', ')}</strong>
              </p>
            )}
          </div>

          {/* Quick CTA if Live */}
          {isLive && (
            <Link to="/live" className="flex-shrink-0">
              <Button size="sm" icon={<Radio size={14} />} className="bg-zinc-950 text-white font-bold shadow-sm">
                Score Live Now
              </Button>
            </Link>
          )}
        </div>

        {/* 3 Metric Cards for this Pitch */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1 border-t border-zinc-100">
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
            <span className="text-zinc-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold block">Total Points</span>
            <span className="text-base sm:text-xl font-black font-mono text-zinc-950 block truncate">
              {formatPoints(team.totalInvestment)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
            <span className="text-zinc-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold block">Unique Backers</span>
            <span className="text-base sm:text-xl font-black font-mono text-zinc-950 block truncate">
              {team.uniqueBackers}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
            <span className="text-zinc-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold block truncate">#1 Champion</span>
            <span className="text-xs sm:text-sm font-bold text-zinc-950 block truncate mt-1">
              {champion ? (
                <span className="text-amber-700 flex items-center justify-center gap-1 font-mono font-bold">
                  <Crown size={12} className="text-amber-500 flex-shrink-0" />
                  <span className="truncate">{champion.displayName}</span>
                </span>
              ) : (
                'None'
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Standings List Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown size={18} className="text-amber-500" />
          <h3 className="font-black text-zinc-950 text-base">
            Audience Backer Standings for {team.name}
          </h3>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          {standings.length} {standings.length === 1 ? 'backer' : 'backers'}
        </span>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-zinc-100 animate-pulse border border-zinc-200/60" />
          ))}
        </div>
      ) : standings.length === 0 ? (
        /* Empty State */
        <div className="p-8 sm:p-10 rounded-2xl bg-white border border-zinc-200 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-400 flex items-center justify-center mx-auto">
            <Users size={22} />
          </div>
          <div>
            <h4 className="font-bold text-zinc-950 text-sm">No audience points scored yet for this pitch</h4>
            <p className="text-zinc-500 text-xs mt-1 max-w-sm mx-auto">
                {isLive
                ? 'Scoring window is currently active! Be the first to back this team and secure the #1 Audience Champion rank.'
                : 'No audience points were allocated to this startup during its pitch window.'}
            </p>
          </div>
          {isLive && (
            <div className="pt-2">
              <Link to="/live">
                <Button size="sm" className="bg-zinc-950 text-white font-bold">
                  Score Live Now
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        /* Ranked Investor Standings */
        <div className="space-y-2.5">
          <AnimatePresence>
            {standings.map(item => {
              const isCurrentUser = user && (item.userId === user.id || item.email === user.email)
              const isChamp = item.rank === 1

              return (
                <motion.div
                  key={item.userId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`
                    p-3.5 sm:p-4 rounded-2xl transition-all flex items-center gap-3 sm:gap-4 shadow-sm border
                    ${isChamp
                      ? 'border-amber-400 bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-white ring-1 ring-amber-400/40'
                      : isCurrentUser
                        ? 'border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950/20'
                        : 'border-zinc-200/90 bg-white hover:border-zinc-300'
                    }
                  `}
                >
                  {/* Rank Badge */}
                  <div className="w-8 flex-shrink-0 flex justify-center">
                    {item.rank === 1 ? (
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white font-mono font-black text-sm flex items-center justify-center shadow-sm">
                        <Crown size={15} />
                      </span>
                    ) : item.rank === 2 ? (
                      <span className="w-8 h-8 rounded-xl bg-zinc-200 text-zinc-900 font-mono font-black text-sm flex items-center justify-center">
                        2
                      </span>
                    ) : item.rank === 3 ? (
                      <span className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-700 font-mono font-black text-sm flex items-center justify-center border border-zinc-200">
                        3
                      </span>
                    ) : (
                      <span className="text-zinc-400 font-mono font-bold text-xs sm:text-sm w-8 text-center">
                        #{item.rank}
                      </span>
                    )}
                  </div>

                  {/* Investor Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-zinc-950 text-xs sm:text-sm truncate">
                        {item.displayName}
                      </span>
                      {isCurrentUser && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-zinc-950 text-white">
                          YOU
                        </span>
                      )}
                      {isChamp && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <Crown size={10} className="text-amber-600" />
                          #1 Champion
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
                      <span className="flex items-center gap-1 font-mono">
                        <Zap size={11} className="text-amber-500" />
                        {formatExactMs(item.timeElapsedMs)} speed
                      </span>
                    </div>
                  </div>

                  {/* Points Allocated */}
                  <div className="flex-shrink-0 text-right">
                    <p className="font-black font-mono text-zinc-950 text-sm sm:text-base">
                      {formatPoints(item.amount)}
                    </p>
                    <p className="text-zinc-400 text-[10px] uppercase font-semibold">
                      Allocated
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export function ScoreboardPage() {
  const { event, teams, activeRound, livePitch } = useEventStore()
  const [searchParams, setSearchParams] = useSearchParams()

  // Selected startup for pitch-specific leaderboard
  const paramTeamId = searchParams.get('teamId')
  const defaultTab = searchParams.get('tab') as 'pitch' | 'overall' | 'official' | null

  const [activeTab, setActiveTab] = useState<'pitch' | 'overall' | 'official'>(
    defaultTab || (paramTeamId ? 'pitch' : 'pitch')
  )

  // Default to param team, or currently active live team, or first team
  const defaultSelectedTeamId = useMemo(() => {
    if (paramTeamId && teams.some(t => t.id === paramTeamId)) {
      return paramTeamId
    }
    if (activeRound?.teamId && teams.some(t => t.id === activeRound.teamId)) {
      return activeRound.teamId
    }
    return teams[0]?.id || ''
  }, [paramTeamId, activeRound?.teamId, teams])

  const [selectedTeamId, setSelectedTeamId] = useState<string>(defaultSelectedTeamId)

  // Update selected team if query param changes
  useEffect(() => {
    if (paramTeamId && teams.some(t => t.id === paramTeamId)) {
      setSelectedTeamId(paramTeamId)
      setActiveTab('pitch')
    }
  }, [paramTeamId, teams])

  // Sync selected team with default if currently empty
  useEffect(() => {
    if (!selectedTeamId && defaultSelectedTeamId) {
      setSelectedTeamId(defaultSelectedTeamId)
    }
  }, [defaultSelectedTeamId, selectedTeamId])

  const isLive = activeRound?.status === 'investment_open'

  // Load scoreboard state once on mount; only poll if a round is currently open for live investing
  useEffect(() => {
    syncLiveState()
    if (!isLive) return

    const timer = setInterval(syncLiveState, 3000)
    return () => clearInterval(timer)
  }, [isLive])

  const [blindMode, setBlindMode] = useState(event?.config.blindLeaderboard ?? false)
  const [fullscreen, setFullscreen] = useState(false)

  const isOfficialPublished = Boolean(event?.config.officialResultsPublished)

  // Teams sorted by pitch order for the selector
  const sortedByPitchOrder = useMemo(() => {
    return [...teams].sort((a, b) => (a.pitchOrder ?? 0) - (b.pitchOrder ?? 0))
  }, [teams])

  // Selected team object
  const selectedTeam = useMemo(() => {
    return teams.find(t => t.id === selectedTeamId) || teams[0] || null
  }, [teams, selectedTeamId])

  // Overall audience sorted strictly by investment points
  const sortedAudienceTeams = useMemo(() => {
    return [...teams].sort((a, b) => b.totalInvestment - a.totalInvestment)
  }, [teams])

  const maxPoints = sortedAudienceTeams[0]?.totalInvestment ?? 1
  const totalInvested = teams.reduce((sum, t) => sum + t.totalInvestment, 0)
  const totalBackers = teams.reduce((sum, t) => sum + t.uniqueBackers, 0)

  // Official sorted strictly by officialRank (unranked last)
  const sortedOfficialTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const rankA = a.officialRank ?? 9999
      const rankB = b.officialRank ?? 9999
      if (rankA !== rankB) return rankA - rankB
      return (b.officialScore ?? 0) - (a.officialScore ?? 0)
    })
  }, [teams])

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

  // Switch to specific pitch tab and select that team
  const handleSelectPitch = (teamId: string) => {
    setSelectedTeamId(teamId)
    setActiveTab('pitch')
    setSearchParams({ teamId, tab: 'pitch' })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 sm:py-8 space-y-6 animate-fade-in text-zinc-900">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={22} className="text-zinc-950" />
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight">
              {activeTab === 'pitch'
                ? 'Startup Pitch Leaderboard'
                : activeTab === 'overall'
                  ? 'Overall Event Standings'
                  : 'Official Competition Results'}
            </h1>
            {isLive && <LiveIndicator />}
          </div>
          <p className="text-zinc-500 text-xs">
            {activeTab === 'pitch'
              ? 'Select any startup to view its individual audience backer rankings (live and post-pitch).'
              : activeTab === 'overall'
                ? 'Aggregated audience points allocation across all startups in the competition.'
                : 'Independent jury evaluations, official scores, and competition awards.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'overall' && (
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

      {/* 3-Way Mode Switcher: Pitch Leaderboards vs Overall Standings vs Official Jury */}
      <div className="flex p-1.5 rounded-2xl bg-zinc-100 border border-zinc-200/80 gap-1">
        <button
          onClick={() => {
            setActiveTab('pitch')
            if (selectedTeamId) setSearchParams({ teamId: selectedTeamId, tab: 'pitch' })
          }}
          className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'pitch'
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Target size={14} className="flex-shrink-0" />
          <span>Pitch Leaderboards</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('overall')
            setSearchParams({ tab: 'overall' })
          }}
          className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'overall'
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <TrendingUp size={14} className="flex-shrink-0" />
          <span className="hidden sm:inline">Overall Standings</span>
          <span className="sm:hidden">Overall</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('official')
            setSearchParams({ tab: 'official' })
          }}
          className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'official'
              ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Award size={14} className="flex-shrink-0" />
          <span className="hidden sm:inline">Official Jury</span>
          <span className="sm:hidden">Jury</span>
          {isOfficialPublished && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          )}
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* VIEW 1: PER-PITCH SEPARATE LEADERBOARD                      */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'pitch' && (
        <div className="space-y-5 animate-fade-in">
          {/* Horizontal Startup Selector Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs px-0.5">
              <span className="font-bold text-zinc-700">Choose Startup Pitch:</span>
              <span className="text-zinc-400">{sortedByPitchOrder.length} startups</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-1 px-1">
              {sortedByPitchOrder.map(team => {
                const isSelected = team.id === selectedTeamId
                const isTeamActive = activeRound?.status === 'investment_open' && activeRound?.teamId === team.id

                return (
                  <button
                    key={team.id}
                    onClick={() => handleSelectPitch(team.id)}
                    className={`
                      px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 border
                      ${isSelected
                        ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                      }
                    `}
                  >
                    <span>#{team.pitchOrder}</span>
                    <span className="max-w-[120px] truncate">{team.name}</span>
                    {isTeamActive && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Active Pitch Standings View */}
          {selectedTeam ? (
            <PitchStandingsView
              team={selectedTeam}
              isLive={activeRound?.status === 'investment_open' && activeRound?.teamId === selectedTeam.id}
            />
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200">
              <p className="text-zinc-500 text-xs">No startups available to display.</p>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* VIEW 2: OVERALL EVENT STANDINGS (AGGREGATE)                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'overall' && (
        <div className="space-y-6 animate-fade-in">
          {/* Audience Independence Disclaimer Notice */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/90 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-zinc-900">
              <ShieldCheck size={15} className="text-zinc-700" />
              <span>Audience Scoring Notice</span>
            </div>
            <p className="text-zinc-600 leading-relaxed">
              This leaderboard tracks aggregate audience point allocations and crowd backing enthusiasm.
              <strong> Audience point allocations do NOT determine, influence, or tie-break official competition winners.</strong> Official results are judged independently by the official jury.
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
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  onClick={() => handleSelectPitch(activeRound.team!.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                  View Pitch Standings
                </button>
                <Link to="/live">
                  <Button size="sm" className="bg-zinc-950 text-white">
                    Score Live Now
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

          {/* Overall Audience Leaderboard rows */}
          <div className="space-y-2.5">
            <AnimatePresence>
              {sortedAudienceTeams.map((team, i) => (
                <AudienceTeamRow
                  key={team.id}
                  team={team}
                  rank={i + 1}
                  maxPoints={maxPoints}
                  blind={blindMode && isLive}
                  onSelectPitch={() => handleSelectPitch(team.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* VIEW 3: OFFICIAL COMPETITION RESULTS (INDEPENDENT JURY)     */}
      {/* ──────────────────────────────────────────────────────────── */}
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
                <Button variant="secondary" size="sm" onClick={() => setActiveTab('pitch')}>
                  View Pitch Standings
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
