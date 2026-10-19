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
      <span className="w-8 h-8 rounded-xl skeuo-token-gold font-mono font-black text-xs sm:text-sm flex items-center justify-center">
        1
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="w-8 h-8 rounded-xl skeuo-token-silver font-mono font-black text-xs sm:text-sm flex items-center justify-center">
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="w-8 h-8 rounded-xl skeuo-token-bronze font-mono font-black text-xs sm:text-sm flex items-center justify-center">
        3
      </span>
    )
  }
  return <span className="skeuo-token font-mono font-bold text-xs w-8 h-8 rounded-xl flex items-center justify-center text-zinc-600">#{rank}</span>
}

function OfficialRankBadge({ rank }: { rank?: number }) {
  if (rank === 1) {
    return (
      <span className="w-9 h-9 rounded-xl skeuo-token-gold font-mono font-black text-sm flex items-center justify-center">
        <Trophy size={16} />
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="w-9 h-9 rounded-xl skeuo-token-silver font-mono font-black text-sm flex items-center justify-center">
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="w-9 h-9 rounded-xl skeuo-token-bronze font-mono font-black text-sm flex items-center justify-center">
        3
      </span>
    )
  }
  return (
    <span className="skeuo-token text-zinc-600 font-mono font-bold text-xs w-9 h-9 rounded-xl flex items-center justify-center">
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
        p-4 sm:p-5 rounded-3xl transition-all flex items-center gap-3.5 sm:gap-4
        ${rank === 1
          ? 'skeuo-surface border-2 border-zinc-950/90 shadow-[0_8px_24px_rgba(0,0,0,0.08),inset_0_1px_0_#FFF] ring-1 ring-zinc-950/10'
          : 'skeuo-surface-interactive'
        }
        ${team.status === 'active' ? 'border-2 border-emerald-500/90 shadow-[0_8px_24px_rgba(16,185,129,0.16)] ring-2 ring-emerald-500/10' : ''}
      `}
    >
      {/* Audience Points Rank */}
      <div className="w-8 flex-shrink-0 flex justify-center">
        <AudienceRankBadge rank={rank} />
      </div>

      {/* Logo */}
      <div className="w-11 h-11 rounded-2xl skeuo-token-dark flex items-center justify-center text-base sm:text-lg font-black font-mono text-white flex-shrink-0 shadow-sm">
        {team.name[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="skeuo-token text-[10px] uppercase font-bold text-zinc-700 px-2 py-0.5 rounded-lg">
            Pitch #{team.pitchOrder}
          </span>
          <h3 className="font-extrabold text-zinc-950 text-xs sm:text-sm truncate skeuo-text-emboss">{team.name}</h3>
          <Badge variant="blue" className="skeuo-token text-[10px]">{team.category}</Badge>
          {team.status === 'active' && <LiveIndicator label="LIVE" />}
          <StatusBadge status={team.status} />
        </div>
        <p className="text-zinc-600 text-[11px] sm:text-xs truncate font-medium">{team.pitchTitle}</p>
        {!blind && (
          <div className="skeuo-meter-track h-2 rounded-full overflow-hidden p-0.5 mt-1.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-zinc-800 to-zinc-950 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        )}
      </div>

      {/* Stats & Link to pitch leaderboard */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {blind ? (
          <div className="skeuo-sunken px-3 py-1.5 rounded-xl text-center">
            <EyeOff size={16} className="text-zinc-400 mx-auto" />
            <p className="text-zinc-500 text-[10px] font-bold mt-0.5 skeuo-text-emboss">Hidden</p>
          </div>
        ) : (
          <div className="skeuo-sunken px-3.5 py-1.5 rounded-xl text-right min-w-[95px] sm:min-w-[110px]">
            <p className="font-black font-mono text-zinc-950 text-sm sm:text-base leading-tight">{formatPoints(team.totalInvestment)}</p>
            <div className="flex items-center gap-1 justify-end text-zinc-500 text-[10px] sm:text-[11px] font-bold mt-0.5">
              <Users size={11} className="text-zinc-600" />
              <span>{team.uniqueBackers}</span>
            </div>
          </div>
        )}

        {onSelectPitch && (
          <button
            onClick={onSelectPitch}
            className="skeuo-btn-secondary p-2 rounded-xl text-zinc-600 hover:text-zinc-950 ml-1 flex-shrink-0"
            title="View Pitch Leaderboard"
          >
            <ArrowRight size={14} />
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
        p-4 sm:p-5 rounded-3xl transition-all flex items-center gap-4
        ${team.officialRank === 1
          ? 'skeuo-surface border-2 border-amber-400 shadow-[0_8px_24px_rgba(245,158,11,0.18),inset_0_1px_0_#FFF] ring-2 ring-amber-400/20'
          : 'skeuo-surface-interactive'
        }
      `}
    >
      {/* Official Jury Rank */}
      <div className="w-9 flex-shrink-0 flex justify-center">
        <OfficialRankBadge rank={team.officialRank ?? undefined} />
      </div>

      {/* Logo */}
      <div className="w-11 h-11 rounded-2xl skeuo-token-dark flex items-center justify-center text-lg font-black font-mono text-white flex-shrink-0 shadow-sm">
        {team.name[0]}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-extrabold text-zinc-950 text-sm sm:text-base truncate skeuo-text-emboss">{team.name}</h3>
          <Badge variant="blue" className="skeuo-token text-[10px]">{team.category}</Badge>
          {team.officialAward && (
            <span className="skeuo-token-gold px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <Sparkles size={10} />
              {team.officialAward}
            </span>
          )}
        </div>
        <p className="text-zinc-600 text-xs truncate font-medium">{team.pitchTitle}</p>
        {team.officialNotes && (
          <p className="text-zinc-600 text-[11px] italic pt-0.5">
            Jury Note: "{team.officialNotes}"
          </p>
        )}
      </div>

      {/* Official Jury Score */}
      <div className="flex-shrink-0 text-right">
        {team.officialScore !== undefined && team.officialScore !== null ? (
          <div className="skeuo-sunken px-3.5 py-1.5 rounded-xl text-right">
            <p className="font-black font-mono text-zinc-950 text-base leading-tight">{team.officialScore} <span className="text-xs font-normal text-zinc-400">/ 100</span></p>
            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mt-0.5 skeuo-text-emboss">Jury Score</p>
          </div>
        ) : (
          <span className="skeuo-sunken px-2.5 py-1 rounded-lg text-zinc-400 text-xs font-mono font-bold">Unscored</span>
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
      {/* Selected Pitch Info Card — Precision Console */}
      <div className="skeuo-surface p-6 sm:p-7 rounded-3xl space-y-5 shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="skeuo-token-dark px-2.5 py-0.5 rounded-lg text-[11px] font-black font-mono tracking-wider">
                Pitch #{team.pitchOrder}
              </span>
              <Badge variant="blue" className="skeuo-token text-[11px]">{team.category}</Badge>
              <StatusBadge status={team.status} />
              {isLive && <LiveIndicator label="SCORING OPEN" />}
            </div>
            <h2 className="text-xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-tight skeuo-text-emboss">
              {team.name}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-zinc-700">
              {team.pitchTitle}
            </p>
            {team.presenters && team.presenters.length > 0 && (
              <p className="text-[11px] text-zinc-500 pt-0.5 font-medium">
                Founders: <strong className="text-zinc-800">{team.presenters.join(', ')}</strong>
              </p>
            )}
          </div>

          {/* Quick CTA if Live */}
          {isLive && (
            <Link to="/live" className="flex-shrink-0">
              <Button size="sm" icon={<Radio size={14} />} className="skeuo-btn-primary py-2.5 px-4 font-bold">
                Score Live Now
              </Button>
            </Link>
          )}
        </div>

        {/* 3 Metric Wells for this Pitch */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
          <div className="p-3.5 rounded-2xl skeuo-sunken text-center">
            <span className="text-zinc-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-bold block skeuo-text-emboss">Total Points</span>
            <span className="text-base sm:text-xl font-black font-mono text-zinc-950 block truncate mt-0.5">
              {formatPoints(team.totalInvestment)}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl skeuo-sunken text-center">
            <span className="text-zinc-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-bold block skeuo-text-emboss">Unique Backers</span>
            <span className="text-base sm:text-xl font-black font-mono text-zinc-950 block truncate mt-0.5">
              {team.uniqueBackers}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl skeuo-sunken text-center">
            <span className="text-zinc-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-bold block truncate skeuo-text-emboss">#1 Champion</span>
            <span className="text-xs sm:text-sm font-bold text-zinc-950 block truncate mt-1">
              {champion ? (
                <span className="text-amber-700 flex items-center justify-center gap-1 font-mono font-black">
                  <Crown size={13} className="text-amber-500 flex-shrink-0" />
                  <span className="truncate">{champion.displayName}</span>
                </span>
              ) : (
                <span className="text-zinc-400 font-medium">None</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Standings List Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Crown size={18} className="text-amber-500" />
          <h3 className="font-black text-zinc-950 text-sm sm:text-base skeuo-text-emboss">
            Audience Backer Standings for {team.name}
          </h3>
        </div>
        <span className="skeuo-token text-xs text-zinc-700 font-mono font-bold px-2.5 py-0.5 rounded-lg">
          {standings.length} {standings.length === 1 ? 'backer' : 'backers'}
        </span>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-2xl skeuo-sunken animate-pulse" />
          ))}
        </div>
      ) : standings.length === 0 ? (
        /* Empty State */
        <div className="p-8 sm:p-10 rounded-3xl skeuo-sunken text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl skeuo-token flex items-center justify-center mx-auto text-zinc-500">
            <Users size={22} />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-zinc-950 text-sm skeuo-text-emboss">No audience points scored yet for this pitch</h4>
            <p className="text-zinc-500 text-xs max-w-sm mx-auto font-medium">
              {isLive
                ? 'Scoring window is currently active! Be the first to back this team and secure the #1 Audience Champion rank.'
                : 'No audience points were allocated to this startup during its pitch window.'}
            </p>
          </div>
          {isLive && (
            <div className="pt-2">
              <Link to="/live">
                <Button size="sm" className="skeuo-btn-primary font-bold">
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
                    p-3.5 sm:p-4 rounded-3xl transition-all flex items-center gap-3.5 sm:gap-4
                    ${isChamp
                      ? 'skeuo-surface border-2 border-amber-400 shadow-[0_8px_24px_rgba(245,158,11,0.18),inset_0_1px_0_#FFF] ring-2 ring-amber-400/20'
                      : isCurrentUser
                        ? 'skeuo-surface border-2 border-zinc-950 shadow-md ring-1 ring-zinc-950/10'
                        : 'skeuo-surface-interactive'
                    }
                  `}
                >
                  {/* Rank Badge */}
                  <div className="w-8 flex-shrink-0 flex justify-center">
                    {item.rank === 1 ? (
                      <span className="w-8 h-8 rounded-xl skeuo-token-gold font-mono font-black text-sm flex items-center justify-center">
                        <Crown size={15} />
                      </span>
                    ) : item.rank === 2 ? (
                      <span className="w-8 h-8 rounded-xl skeuo-token-silver font-mono font-black text-xs sm:text-sm flex items-center justify-center">
                        2
                      </span>
                    ) : item.rank === 3 ? (
                      <span className="w-8 h-8 rounded-xl skeuo-token-bronze font-mono font-black text-xs sm:text-sm flex items-center justify-center">
                        3
                      </span>
                    ) : (
                      <span className="skeuo-token text-zinc-600 font-mono font-bold text-xs sm:text-sm w-8 h-8 rounded-xl flex items-center justify-center">
                        #{item.rank}
                      </span>
                    )}
                  </div>

                  {/* Investor Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-zinc-950 text-xs sm:text-sm truncate skeuo-text-emboss">
                        {item.displayName}
                      </span>
                      {isCurrentUser && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black skeuo-token-dark">
                          YOU
                        </span>
                      )}
                      {isChamp && (
                        <span className="skeuo-token-gold px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                          <Crown size={11} className="text-amber-950" />
                          #1 Champion
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-zinc-500 text-[11px]">
                      <span className="skeuo-sunken px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono font-bold text-[10px]">
                        <Zap size={10} className="text-amber-600" />
                        {formatExactMs(item.timeElapsedMs)} speed
                      </span>
                    </div>
                  </div>

                  {/* Points Allocated */}
                  <div className="flex-shrink-0 text-right">
                    <div className="skeuo-sunken px-3.5 py-1.5 rounded-xl text-right min-w-[95px] sm:min-w-[110px]">
                      <p className="font-black font-mono text-zinc-950 text-sm sm:text-base leading-tight">
                        {formatPoints(item.amount)}
                      </p>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mt-0.5 skeuo-text-emboss">
                        Allocated
                      </p>
                    </div>
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
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Trophy size={22} className="text-zinc-950 flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight skeuo-text-emboss">
              {activeTab === 'pitch'
                ? 'Startup Pitch Leaderboard'
                : activeTab === 'overall'
                  ? 'Overall Event Standings'
                  : 'Official Competition Results'}
            </h1>
            {isLive && <LiveIndicator />}
          </div>
          <p className="text-zinc-500 text-xs font-medium">
            {activeTab === 'pitch'
              ? 'Select any startup to view its individual audience backer rankings (live and post-pitch).'
              : activeTab === 'overall'
                ? 'Aggregated audience points allocation across all startups in the competition.'
                : 'Independent jury evaluations, official scores, and competition awards.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {activeTab === 'overall' && (
            <button
              onClick={() => setBlindMode(!blindMode)}
              className="skeuo-btn-secondary p-2.5 rounded-xl text-zinc-600 hover:text-zinc-950 transition-colors"
              title={blindMode ? 'Show scores' : 'Enable blind mode'}
            >
              {blindMode ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="skeuo-btn-secondary p-2.5 rounded-xl text-zinc-600 hover:text-zinc-950 transition-colors"
            title="Toggle Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* 3-Way Physical Switchboard Track: Pitch Leaderboards vs Overall Standings vs Official Jury */}
      <div className="skeuo-pill-track p-1.5 rounded-2xl flex gap-1.5 items-center relative">
        <button
          onClick={() => {
            setActiveTab('pitch')
            if (selectedTeamId) setSearchParams({ teamId: selectedTeamId, tab: 'pitch' })
          }}
          className={`relative flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs font-bold transition-colors duration-150 flex items-center justify-center gap-1.5 select-none z-10 ${
            activeTab === 'pitch'
              ? 'text-white'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          {activeTab === 'pitch' && (
            <motion.div
              layoutId="scoreboard-mode-active-pill"
              className="absolute inset-0 skeuo-pill-active rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.75 }}
            />
          )}
          <Target size={14} className="flex-shrink-0" />
          <span>Pitch Leaderboards</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('overall')
            setSearchParams({ tab: 'overall' })
          }}
          className={`relative flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs font-bold transition-colors duration-150 flex items-center justify-center gap-1.5 select-none z-10 ${
            activeTab === 'overall'
              ? 'text-white'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          {activeTab === 'overall' && (
            <motion.div
              layoutId="scoreboard-mode-active-pill"
              className="absolute inset-0 skeuo-pill-active rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.75 }}
            />
          )}
          <TrendingUp size={14} className="flex-shrink-0" />
          <span className="hidden sm:inline">Overall Standings</span>
          <span className="sm:hidden">Overall</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('official')
            setSearchParams({ tab: 'official' })
          }}
          className={`relative flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs font-bold transition-colors duration-150 flex items-center justify-center gap-1.5 select-none z-10 ${
            activeTab === 'official'
              ? 'text-white'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          {activeTab === 'official' && (
            <motion.div
              layoutId="scoreboard-mode-active-pill"
              className="absolute inset-0 skeuo-pill-active rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.75 }}
            />
          )}
          <Award size={14} className="flex-shrink-0" />
          <span className="hidden sm:inline">Official Jury</span>
          <span className="sm:hidden">Jury</span>
          {isOfficialPublished && (
            <span className="skeuo-led-bezel w-3.5 h-3.5 ml-0.5">
              <span className="skeuo-led-emerald" />
            </span>
          )}
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* VIEW 1: PER-PITCH SEPARATE LEADERBOARD                      */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'pitch' && (
        <div className="space-y-5 animate-fade-in">
          {/* Horizontal Startup Selector Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold text-zinc-700 uppercase tracking-wider text-[11px] skeuo-text-emboss">Choose Startup Pitch:</span>
              <span className="skeuo-token text-[11px] font-bold font-mono px-2 py-0.5 rounded-lg text-zinc-800">
                {sortedByPitchOrder.length} startups
              </span>
            </div>

            <div className="skeuo-sunken p-1.5 rounded-2xl flex gap-1.5 overflow-x-auto no-scrollbar items-center">
              {sortedByPitchOrder.map(team => {
                const isSelected = team.id === selectedTeamId
                const isTeamActive = activeRound?.status === 'investment_open' && activeRound?.teamId === team.id

                return (
                  <button
                    key={team.id}
                    onClick={() => handleSelectPitch(team.id)}
                    className={`
                      px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 select-none cursor-pointer
                      ${isSelected
                        ? 'skeuo-keypad-btn-active ring-2 ring-zinc-950/20'
                        : 'skeuo-keypad-btn text-zinc-800'
                      }
                    `}
                  >
                    <span className="font-mono">#{team.pitchOrder}</span>
                    <span className="max-w-[120px] truncate">{team.name}</span>
                    {isTeamActive && (
                      <span className="skeuo-led-bezel w-3.5 h-3.5">
                        <span className="skeuo-led-emerald animate-ping" />
                      </span>
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
            <div className="p-8 text-center skeuo-sunken rounded-3xl">
              <p className="text-zinc-500 text-xs font-medium">No startups available to display.</p>
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
          <div className="p-4 rounded-2xl skeuo-sunken text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-zinc-900 skeuo-text-emboss">
              <ShieldCheck size={15} className="text-zinc-800 flex-shrink-0" />
              <span>Audience Scoring Notice</span>
            </div>
            <p className="text-zinc-600 leading-relaxed font-medium">
              This leaderboard tracks aggregate audience point allocations and crowd backing enthusiasm.
              <strong> Audience point allocations do NOT determine, influence, or tie-break official competition winners.</strong> Official results are judged independently by the official jury.
            </p>
          </div>

          {/* CNC-Milled Sunken Global Stats Wells */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="p-3.5 sm:p-4 rounded-2xl skeuo-sunken text-center">
              <p className="text-base sm:text-2xl font-black font-mono text-zinc-950 tracking-tight">{formatPoints(totalInvested)}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-wider font-bold mt-0.5 skeuo-text-emboss">Points Deployed</p>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl skeuo-sunken text-center">
              <p className="text-base sm:text-2xl font-black font-mono text-zinc-950 tracking-tight">{totalBackers}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-wider font-bold mt-0.5 skeuo-text-emboss">Backers</p>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl skeuo-sunken text-center">
              <p className="text-base sm:text-2xl font-black font-mono text-zinc-950 tracking-tight">{teams.length}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-wider font-bold mt-0.5 skeuo-text-emboss">Startups</p>
            </div>
          </div>

          {/* Active pitch banner */}
          {isLive && activeRound?.team && (
            <div className="skeuo-surface border-2 border-emerald-500/90 p-4 rounded-2xl shadow-[0_6px_20px_rgba(16,185,129,0.16),inset_0_1px_0_#FFF] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl skeuo-sunken text-emerald-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  <Radio size={19} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-emerald-800 text-xs font-bold uppercase tracking-wider skeuo-text-emboss">Now Pitching on Stage</p>
                    <span className="skeuo-led-bezel">
                      <span className="skeuo-led-emerald animate-ping" />
                    </span>
                  </div>
                  <p className="text-zinc-950 font-black text-base sm:text-lg truncate skeuo-text-emboss">{activeRound.team.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  onClick={() => handleSelectPitch(activeRound.team!.id)}
                  className="skeuo-btn-secondary px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-800 hover:text-zinc-950"
                >
                  View Pitch Standings
                </button>
                <Link to="/live">
                  <Button size="sm" className="skeuo-btn-primary font-bold px-4 py-2">
                    Score Live Now
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Blind mode notice */}
          {blindMode && (
            <div className="p-3.5 rounded-2xl skeuo-sunken border border-amber-300 text-center">
              <p className="text-amber-900 font-bold text-xs">Blind Leaderboard Mode Active</p>
              <p className="text-amber-700 text-[11px] mt-0.5 font-medium">Audience point scores are hidden until the final stage reveal</p>
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
            <div className="skeuo-surface rounded-3xl p-8 sm:p-10 text-center space-y-4 shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF]">
              <div className="w-14 h-14 rounded-2xl skeuo-sunken flex items-center justify-center mx-auto text-zinc-500">
                <Lock size={26} />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-zinc-950 font-black text-lg sm:text-xl skeuo-text-emboss">Official Results Unpublished</h3>
                <p className="text-zinc-600 text-xs sm:text-sm leading-relaxed font-medium">
                  The official judges evaluate pitching teams independently using their own scoring process (including pen and paper).
                  Official competition rankings and winners will be published here by event administrators once jury deliberations conclude.
                </p>
              </div>
              <div className="pt-2">
                <Button variant="secondary" size="sm" onClick={() => setActiveTab('pitch')} className="skeuo-btn-secondary font-bold">
                  View Pitch Standings
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="skeuo-surface border border-emerald-400/80 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl skeuo-token flex items-center justify-center text-emerald-700 flex-shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h4 className="text-zinc-950 font-bold text-xs uppercase tracking-wider skeuo-text-emboss">Official Jury Decision Published</h4>
                  <p className="text-zinc-500 text-xs font-medium">
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
