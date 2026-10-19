// ============================================================
// Home Page — Competing Startups Lineup & Event Overview
// Minimalist, high-contrast, pure white & black aesthetic
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Search, X, ChevronRight,
  Radio, ArrowUpRight, Sparkles, Building2, Layers, Trophy
} from 'lucide-react'
import { useAuthStore, useEventStore, useWalletStore } from '@/store'
import { Card, StatusBadge, LiveIndicator, Button, Badge } from '@/components/ui'
import { formatPoints } from '@/lib/utils'
import { syncLiveState } from '@/lib/realtimeSync'
import { motion, AnimatePresence } from 'framer-motion'
import type { Team } from '@/types'

// Modal for reading complete startup idea and pitcher background
function StartupDetailModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const { activeRound } = useEventStore()
  const isTeamLive = activeRound?.status === 'investment_open' && activeRound?.teamId === team.id

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="bg-white w-full max-w-lg rounded-2xl border border-zinc-200 shadow-2xl relative max-h-[92dvh] sm:max-h-[88vh] flex flex-col text-zinc-900 my-auto overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-start justify-between gap-3 bg-white flex-shrink-0">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-800 border border-zinc-200">
                Pitch #{team.pitchOrder}
              </span>
              <Badge variant="blue" className="text-[10px] sm:text-[11px]">{team.category}</Badge>
              <StatusBadge status={team.status} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight leading-tight truncate">
              {team.name}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-zinc-700 line-clamp-2">
              {team.pitchTitle}
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close Overview"
            className="p-1.5 sm:p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
          {/* Pitcher Details */}
          {team.presenters && team.presenters.length > 0 && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1">
              <div className="flex items-center gap-2 text-zinc-700 font-semibold text-xs">
                <Users size={13} className="text-zinc-900 flex-shrink-0" />
                <span>Pitchers & Founding Team</span>
              </div>
              <p className="text-zinc-900 text-xs sm:text-sm font-medium pl-5 break-words">
                {team.presenters.join(', ')}
              </p>
            </div>
          )}

          {/* Startup Idea & Description */}
          <div className="space-y-1.5">
            <h4 className="text-zinc-400 uppercase text-[11px] font-bold tracking-wider">Startup Idea & Vision</h4>
            <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80 text-zinc-700 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-normal break-words">
              {team.description || 'This team has registered their pitch idea for The Big Pitch.'}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
            <div className="p-3 sm:p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
              <span className="text-zinc-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold block">Audience Points</span>
              <span className="text-base sm:text-xl font-bold font-mono text-zinc-950 truncate block">{formatPoints(team.totalInvestment)}</span>
            </div>
            <div className="p-3 sm:p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center">
              <span className="text-zinc-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold block">Unique Backers</span>
              <span className="text-base sm:text-xl font-bold font-mono text-zinc-950 truncate block">{team.uniqueBackers} Backers</span>
            </div>
          </div>
        </div>

        {/* Fixed Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-100 bg-zinc-50/80 flex flex-col sm:flex-row gap-2 sm:gap-2.5 flex-shrink-0">
          <Link to={`/leaderboard?teamId=${team.id}&tab=pitch`} className="flex-1">
            <Button variant="secondary" icon={<Trophy size={14} />} className="w-full justify-center text-xs sm:text-sm py-2.5">
              Pitch Leaderboard
            </Button>
          </Link>

          {isTeamLive ? (
            <Link to="/live" className="flex-1">
              <Button size="md" icon={<Radio size={15} />} className="w-full justify-center bg-zinc-950 text-white text-xs sm:text-sm py-2.5">
                Score Live Now
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" onClick={onClose} className="sm:flex-none justify-center text-xs sm:text-sm py-2.5 text-zinc-500 hover:text-zinc-900">
              Close Overview
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export function HomePage() {
  const { event, teams, activeRound } = useEventStore()
  const { user } = useAuthStore()
  const { wallet, investments } = useWalletStore()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'active' | 'completed'>('all')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)

  // Real-time background sync for startup lineup scores & stage indicators
  useEffect(() => {
    syncLiveState()
    const timer = setInterval(syncLiveState, 3000)
    return () => clearInterval(timer)
  }, [])

  const isLive = activeRound?.status === 'investment_open'
  const totalInvested = teams.reduce((acc, t) => acc + t.totalInvestment, 0)
  const totalBackers = teams.reduce((acc, t) => acc + t.uniqueBackers, 0)

  // Status counts
  const activeCount = teams.filter((t) => t.status === 'active').length
  const upcomingCount = teams.filter((t) => t.status === 'upcoming').length
  const completedCount = teams.filter((t) => t.status === 'completed' || t.status === 'closed').length

  // Filtered teams
  const filteredTeams = teams.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.pitchTitle.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      (t.presenters && t.presenters.some((p) => p.toLowerCase().includes(search.toLowerCase())))

    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? t.status === 'active'
        : filterStatus === 'upcoming'
        ? t.status === 'upcoming'
        : t.status === 'completed' || t.status === 'closed'

    return matchesSearch && matchesStatus
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in text-zinc-900">
      {/* Hero / Event Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-zinc-200/90 p-7 sm:p-10 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="relative space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {isLive ? (
                <LiveIndicator label="STAGE PITCH IN PROGRESS" />
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                  {event?.status ? event.status.replace(/_/g, ' ').toUpperCase() : 'ARENA OPEN'}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-[1.1]">
              {event?.name && event.name !== 'Pitch Arena 2025' ? event.name : 'THE BIG PITCH'}
            </h1>
            <p className="text-zinc-600 text-base sm:text-lg leading-relaxed">
              {event?.tagline ?? 'Discover ambitious student startup founders, evaluate live pitches, and deploy your audience scoring points.'}
            </p>
          </div>

          {/* Clean Responsive Metric Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-1">
            <div className="p-3 sm:p-4 rounded-2xl bg-zinc-50/90 border border-zinc-200/80 text-center">
              <p className="text-base sm:text-2xl lg:text-3xl font-black font-mono text-zinc-950 tracking-tight">{formatPoints(totalInvested)}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mt-0.5 sm:mt-1">Points Backed</p>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-zinc-50/90 border border-zinc-200/80 text-center">
              <p className="text-base sm:text-2xl lg:text-3xl font-black font-mono text-zinc-950 tracking-tight">{totalBackers}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mt-0.5 sm:mt-1">Backers</p>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-zinc-50/90 border border-zinc-200/80 text-center">
              <p className="text-base sm:text-2xl lg:text-3xl font-black font-mono text-zinc-950 tracking-tight">{teams.length}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mt-0.5 sm:mt-1">Startups</p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2">
            {!user ? (
              <Link to="/auth">
                <Button size="lg" className="w-full justify-center bg-zinc-950 text-white font-bold py-3 text-sm">
                  Sign In to Claim 500 Free Audience Allocation Points
                </Button>
              </Link>
            ) : user.role === 'admin' ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/admin" className="flex-1">
                  <Button size="md" className="w-full justify-center bg-zinc-950 text-white">
                    Open Admin Control Room
                  </Button>
                </Link>
                <Link to="/cast" className="flex-1">
                  <Button variant="secondary" icon={<Radio size={14} />} size="md" className="w-full justify-center">
                    Projector Stage Cast Screen
                  </Button>
                </Link>
              </div>
            ) : isLive ? (
              <Link to="/live">
                <Button size="lg" icon={<Radio size={16} />} className="w-full justify-center bg-zinc-950 text-white font-bold py-3 text-sm shadow-md">
                  Active Pitch Round Live — Join & Score Now
                </Button>
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2.5">
                <Link to="/live" className="flex-1">
                  <Button size="md" icon={<Radio size={14} />} className="w-full justify-center bg-zinc-950 text-white font-semibold">
                    Go to Live Stage
                  </Button>
                </Link>
                <Link to="/scoreboard" className="flex-1">
                  <Button variant="secondary" size="md" className="w-full justify-center font-semibold">
                    View Tournament Leaderboard
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Helpful 3-Step Simple Guide for New Attendees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link to="/wallet" className="p-4 rounded-2xl bg-white border border-zinc-200/90 hover:border-zinc-300 transition-all shadow-xs group">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-6 h-6 rounded-lg bg-zinc-950 text-white text-xs font-black flex items-center justify-center font-mono">1</span>
            <h3 className="font-bold text-zinc-950 text-sm group-hover:text-zinc-800">500 Free Points</h3>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed">
            Every audience member gets 500 welcome points to deploy into favorite startups.
          </p>
        </Link>

        <Link to="/live" className="p-4 rounded-2xl bg-white border border-zinc-200/90 hover:border-zinc-300 transition-all shadow-xs group">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center justify-center font-mono">2</span>
            <h3 className="font-bold text-zinc-950 text-sm group-hover:text-zinc-800">Watch Live & Back</h3>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed">
            Head to the <strong>Live Pitch</strong> tab. When a team pitches on stage, the timer opens for point backing!
          </p>
        </Link>

        <Link to="/scoreboard" className="p-4 rounded-2xl bg-white border border-zinc-200/90 hover:border-zinc-300 transition-all shadow-xs group">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-6 h-6 rounded-lg bg-amber-500 text-white text-xs font-black flex items-center justify-center font-mono">3</span>
            <h3 className="font-bold text-zinc-950 text-sm group-hover:text-zinc-800">Win Audience Champion</h3>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed">
            Back teams with the highest points in the fastest time (milliseconds) to win #1 Champion!
          </p>
        </Link>
      </div>

      {/* Active Live Pitch Alert (High Impact Clean Card) */}
      {isLive && activeRound?.team && (
        <Link to="/live">
          <div className="bg-white border-2 border-emerald-500 p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-xl font-bold flex-shrink-0">
                <Radio size={22} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700 font-bold text-xs uppercase tracking-wider">Pitching Live Right Now</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <p className="text-zinc-950 font-black text-base sm:text-lg truncate mt-0.5">{activeRound.team.name}</p>
                <p className="text-zinc-600 text-xs truncate">{activeRound.team.pitchTitle}</p>
              </div>
            </div>
            <Button size="sm" className="bg-zinc-950 text-white flex-shrink-0 font-bold px-3 py-1.5">
              Score This Pitch →
            </Button>
          </div>
        </Link>
      )}

      {/* ======================================================== */}
      {/* PRE-LISTED PITCHING TEAMS SHOWCASE SECTION               */}
      {/* ======================================================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-zinc-950 font-black text-xl tracking-tight">
              Competing Startups & Ideas
            </h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              Review pre-listed team concepts, founder credits, and audience backing
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-700 font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 w-fit">
            {teams.length} Startups Pre-listed
          </span>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={14} className="text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search startup name, idea, or pitcher..."
              className="arena-input pl-9 w-full text-xs"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filterStatus === 'all'
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              All ({teams.length})
            </button>
            <button
              onClick={() => setFilterStatus('upcoming')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filterStatus === 'upcoming'
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              Upcoming ({upcomingCount})
            </button>
            {activeCount > 0 && (
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterStatus === 'active'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Live ({activeCount})
              </button>
            )}
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filterStatus === 'completed'
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>
        </div>

        {/* Pre-listed Teams Cards Grid */}
        {filteredTeams.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs border border-dashed border-zinc-300 rounded-2xl space-y-1 bg-white">
            <p className="text-zinc-900 font-semibold text-sm">No startups found</p>
            <p>Try searching with another keyword or reset the filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredTeams.map((team) => {
              const isCurrentLive = activeRound?.status === 'investment_open' && activeRound?.teamId === team.id

              return (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`group relative p-5 rounded-2xl bg-white border transition-all cursor-pointer shadow-sm ${
                    isCurrentLive
                      ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                      : 'border-zinc-200/90 hover:border-zinc-400 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Pitch Order Pill */}
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-sm font-bold font-mono text-zinc-900 flex-shrink-0 group-hover:bg-zinc-200 transition-colors">
                        #{team.pitchOrder}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-zinc-950 text-base group-hover:text-zinc-700 transition-colors truncate">
                            {team.name}
                          </h3>
                          <Badge variant="blue" className="text-[10px]">{team.category}</Badge>
                          <StatusBadge status={team.status} />
                        </div>

                        {/* Startup Idea / Pitch Title */}
                        <p className="text-zinc-900 font-bold text-sm leading-snug">
                          {team.pitchTitle}
                        </p>

                        {/* Startup Idea Description teaser */}
                        {team.description && (
                          <p className="text-zinc-500 text-xs line-clamp-2 leading-relaxed pt-0.5 font-normal">
                            {team.description}
                          </p>
                        )}

                        {/* Pitchers details */}
                        {team.presenters && team.presenters.length > 0 && (
                          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] pt-1">
                            <Users size={12} className="text-zinc-700 flex-shrink-0" />
                            <span className="font-semibold text-zinc-700">Pitchers:</span>
                            <span className="truncate">{team.presenters.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Points & CTA */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pl-14 sm:pl-0 flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100">
                      <div className="text-left sm:text-right">
                        <p className="text-zinc-950 font-bold font-mono text-base">{formatPoints(team.totalInvestment)}</p>
                        <p className="text-zinc-400 text-[11px]">{team.uniqueBackers} backers</p>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-zinc-600 group-hover:text-zinc-950 font-semibold transition-colors">
                        <span>Read Vision</span>
                        <ArrowUpRight size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected Startup Detail Modal */}
      {selectedTeam && (
        <StartupDetailModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />
      )}
    </div>
  )
}
