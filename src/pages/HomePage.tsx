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
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-zinc-950/65 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="skeuo-surface w-full max-w-lg rounded-3xl relative max-h-[92dvh] sm:max-h-[88vh] flex flex-col text-zinc-900 my-auto overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3),inset_0_1px_0_#FFF]"
        onClick={e => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200/80 flex items-start justify-between gap-3 bg-gradient-to-b from-white to-zinc-50/50 flex-shrink-0">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="skeuo-token px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black font-mono tracking-wider text-zinc-800">
                PITCH #{team.pitchOrder}
              </span>
              <Badge variant="blue" className="text-[10px] sm:text-[11px] skeuo-token">{team.category}</Badge>
              <StatusBadge status={team.status} />
              {isTeamLive && <LiveIndicator label="STAGE LIVE" />}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight leading-tight truncate skeuo-text-emboss">
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
            className="skeuo-btn-secondary p-2 rounded-xl text-zinc-600 hover:text-zinc-950 transition-colors flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
          {/* Pitcher Details */}
          {team.presenters && team.presenters.length > 0 && (
            <div className="p-3.5 rounded-2xl skeuo-sunken space-y-1">
              <div className="flex items-center gap-2 text-zinc-700 font-bold text-xs uppercase tracking-wider">
                <Users size={13} className="text-zinc-900 flex-shrink-0" />
                <span className="skeuo-text-emboss">Pitchers & Founding Team</span>
              </div>
              <p className="text-zinc-950 text-xs sm:text-sm font-semibold pl-5 break-words">
                {team.presenters.join(', ')}
              </p>
            </div>
          )}

          {/* Startup Idea & Description */}
          <div className="space-y-1.5">
            <h4 className="text-zinc-500 uppercase text-[11px] font-bold tracking-wider skeuo-text-emboss">
              Startup Idea & Vision
            </h4>
            <div className="p-4 sm:p-5 rounded-2xl skeuo-sunken text-zinc-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-medium break-words">
              {team.description || 'This team has registered their pitch idea for The Big Pitch.'}
            </div>
          </div>

          {/* Performance Metrics Wells */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
            <div className="p-3.5 rounded-2xl skeuo-sunken text-center">
              <span className="text-zinc-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-bold block skeuo-text-emboss">Audience Points</span>
              <span className="text-base sm:text-xl font-black font-mono text-zinc-950 truncate block mt-0.5">{formatPoints(team.totalInvestment)}</span>
            </div>
            <div className="p-3.5 rounded-2xl skeuo-sunken text-center">
              <span className="text-zinc-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-bold block skeuo-text-emboss">Unique Backers</span>
              <span className="text-base sm:text-xl font-black font-mono text-zinc-950 truncate block mt-0.5">{team.uniqueBackers} Backers</span>
            </div>
          </div>
        </div>

        {/* Fixed Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-200/80 bg-gradient-to-b from-zinc-50/50 to-zinc-100 flex flex-col sm:flex-row gap-2 sm:gap-2.5 flex-shrink-0">
          <Link to={`/scoreboard?teamId=${team.id}&tab=pitch`} className="flex-1">
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
            <Button variant="ghost" onClick={onClose} className="sm:flex-none justify-center text-xs sm:text-sm py-2.5 text-zinc-600 hover:text-zinc-950">
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
      {/* Hero / Event Header — Tactile Precision Console */}
      <div className="relative overflow-hidden rounded-3xl skeuo-surface p-6 sm:p-9 shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95)]">
        <div className="relative space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {isLive ? (
                <LiveIndicator label="STAGE PITCH IN PROGRESS" />
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white border border-zinc-300 text-zinc-800 shadow-[inset_0_1px_0_#FFF,0_1px_2px_rgba(0,0,0,0.05)]">
                  <span className="skeuo-led-bezel">
                    <span className="skeuo-led-dark" />
                  </span>
                  <span>{event?.status ? event.status.replace(/_/g, ' ').toUpperCase() : 'ARENA OPEN'}</span>
                </span>
              )}
            </div>

            <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider skeuo-text-emboss">
              SPHINX 2026 • E-CELL
            </span>
          </div>

          <div className="space-y-2 max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-[1.08] skeuo-text-emboss">
              {event?.name && event.name !== 'Pitch Arena 2025' ? event.name : 'THE BIG PITCH'}
            </h1>
            <p className="text-zinc-600 text-sm sm:text-base leading-relaxed font-normal">
              {event?.tagline ?? 'Discover ambitious student startup founders, evaluate live pitches, and deploy your audience scoring points.'}
            </p>
          </div>

          {/* CNC-Milled Sunken Metric Wells */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-1">
            <div className="p-3.5 sm:p-4 rounded-2xl skeuo-sunken text-center">
              <p className="text-base sm:text-2xl lg:text-3xl font-black font-mono text-zinc-950 tracking-tight">{formatPoints(totalInvested)}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mt-0.5 sm:mt-1 skeuo-text-emboss">Points Backed</p>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl skeuo-sunken text-center">
              <p className="text-base sm:text-2xl lg:text-3xl font-black font-mono text-zinc-950 tracking-tight">{totalBackers}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mt-0.5 sm:mt-1 skeuo-text-emboss">Backers</p>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl skeuo-sunken text-center">
              <p className="text-base sm:text-2xl lg:text-3xl font-black font-mono text-zinc-950 tracking-tight">{teams.length}</p>
              <p className="text-zinc-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mt-0.5 sm:mt-1 skeuo-text-emboss">Startups</p>
            </div>
          </div>

          {/* Action CTAs — Tactile Push Buttons */}
          <div className="pt-2">
            {!user ? (
              <Link to="/auth">
                <Button size="lg" className="w-full justify-center text-sm font-black py-3.5">
                  Sign In to Claim 500 Free Audience Allocation Points
                </Button>
              </Link>
            ) : user.role === 'admin' ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/admin" className="flex-1">
                  <Button size="md" className="w-full justify-center">
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
                <Button size="lg" icon={<Radio size={16} />} className="w-full justify-center py-3.5 text-sm font-black">
                  Active Pitch Round Live — Join & Score Now
                </Button>
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2.5">
                <Link to="/live" className="flex-1">
                  <Button size="md" icon={<Radio size={14} />} className="w-full justify-center font-bold">
                    Go to Live Stage
                  </Button>
                </Link>
                <Link to="/scoreboard" className="flex-1">
                  <Button variant="secondary" size="md" className="w-full justify-center font-bold">
                    View Tournament Leaderboard
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3-Step Simple Guide — Physical Hardware Cards with Embossed Tokens */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Link to="/wallet" className="p-4 sm:p-5 rounded-2xl skeuo-surface-interactive group">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-7 h-7 rounded-xl skeuo-token-dark text-xs font-black flex items-center justify-center font-mono">1</span>
            <h3 className="font-extrabold text-zinc-950 text-sm group-hover:text-zinc-700 transition-colors">500 Free Points</h3>
          </div>
          <p className="text-zinc-600 text-xs leading-relaxed font-normal">
            Every audience member gets 500 welcome points to deploy into favorite startups.
          </p>
        </Link>

        <Link to="/live" className="p-4 sm:p-5 rounded-2xl skeuo-surface-interactive group">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-7 h-7 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-800 text-white border border-emerald-900 text-xs font-black flex items-center justify-center font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_4px_rgba(0,0,0,0.15)]">2</span>
            <h3 className="font-extrabold text-zinc-950 text-sm group-hover:text-zinc-700 transition-colors">Watch Live & Back</h3>
          </div>
          <p className="text-zinc-600 text-xs leading-relaxed font-normal">
            Head to the <strong>Live Pitch</strong> tab. When a team pitches on stage, the timer opens for point backing!
          </p>
        </Link>

        <Link to="/scoreboard" className="p-4 sm:p-5 rounded-2xl skeuo-surface-interactive group">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-7 h-7 rounded-xl bg-gradient-to-b from-amber-500 to-amber-700 text-white border border-amber-800 text-xs font-black flex items-center justify-center font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_4px_rgba(0,0,0,0.15)]">3</span>
            <h3 className="font-extrabold text-zinc-950 text-sm group-hover:text-zinc-700 transition-colors">Win Champion</h3>
          </div>
          <p className="text-zinc-600 text-xs leading-relaxed font-normal">
            Back teams with the highest points in the fastest time (milliseconds) to win #1 Champion!
          </p>
        </Link>
      </div>

      {/* Active Live Pitch Alert — Tactical Hardware Display */}
      {isLive && activeRound?.team && (
        <Link to="/live">
          <div className="skeuo-surface border-2 border-emerald-500/90 p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-4 shadow-[0_6px_20px_rgba(16,185,129,0.16),inset_0_1px_0_#FFF] hover:scale-[1.01] transition-all">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl skeuo-sunken text-emerald-700 flex items-center justify-center text-xl font-bold flex-shrink-0">
                <Radio size={22} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-800 font-extrabold text-xs uppercase tracking-wider skeuo-text-emboss">Pitching Live Right Now</span>
                  <span className="skeuo-led-bezel">
                    <span className="skeuo-led-emerald animate-ping" />
                  </span>
                </div>
                <p className="text-zinc-950 font-black text-base sm:text-lg truncate mt-0.5 skeuo-text-emboss">{activeRound.team.name}</p>
                <p className="text-zinc-600 text-xs truncate font-medium">{activeRound.team.pitchTitle}</p>
              </div>
            </div>
            <Button size="sm" className="flex-shrink-0 font-bold px-4 py-2">
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
            <h2 className="text-zinc-950 font-black text-xl tracking-tight skeuo-text-emboss">
              Competing Startups & Ideas
            </h2>
            <p className="text-zinc-500 text-xs mt-0.5 font-medium">
              Review pre-listed team concepts, founder credits, and audience backing
            </p>
          </div>
          <span className="skeuo-token text-xs font-mono text-zinc-800 font-bold px-3 py-1 rounded-xl w-fit">
            {teams.length} Startups Pre-listed
          </span>
        </div>

        {/* Physical Control Deck: Sunken Search & Segmented Rocker Switches */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
          {/* Recessed CNC-Milled Search Slot */}
          <div className="relative flex-1 skeuo-sunken rounded-2xl p-0.5 flex items-center">
            <Search size={15} className="text-zinc-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search startup name, idea, or pitcher..."
              className="w-full pl-9 pr-8 py-2.5 bg-transparent border-0 text-xs sm:text-sm font-semibold text-zinc-950 placeholder-zinc-400 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 p-1 rounded-lg text-zinc-400 hover:text-zinc-800 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Physical Switchboard Track for Filters with fluid sliding rocker */}
          <div className="skeuo-pill-track p-1 rounded-2xl flex gap-1 overflow-x-auto no-scrollbar items-center flex-shrink-0 relative">
            <button
              onClick={() => setFilterStatus('all')}
              className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 select-none z-10 ${
                filterStatus === 'all'
                  ? 'text-white'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {filterStatus === 'all' && (
                <motion.div
                  layoutId="homepage-filter-active-pill"
                  className="absolute inset-0 skeuo-pill-active rounded-xl -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.75 }}
                />
              )}
              All ({teams.length})
            </button>
            <button
              onClick={() => setFilterStatus('upcoming')}
              className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 select-none z-10 ${
                filterStatus === 'upcoming'
                  ? 'text-white'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {filterStatus === 'upcoming' && (
                <motion.div
                  layoutId="homepage-filter-active-pill"
                  className="absolute inset-0 skeuo-pill-active rounded-xl -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.75 }}
                />
              )}
              Upcoming ({upcomingCount})
            </button>
            {activeCount > 0 && (
              <button
                onClick={() => setFilterStatus('active')}
                className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 flex items-center gap-1.5 select-none z-10 ${
                  filterStatus === 'active'
                    ? 'text-white'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                {filterStatus === 'active' && (
                  <motion.div
                    layoutId="homepage-filter-active-pill"
                    className="absolute inset-0 bg-gradient-to-b from-emerald-600 to-emerald-800 text-white rounded-xl -z-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.2)]"
                    transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.75 }}
                  />
                )}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live ({activeCount})
              </button>
            )}
            <button
              onClick={() => setFilterStatus('completed')}
              className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 select-none z-10 ${
                filterStatus === 'completed'
                  ? 'text-white'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {filterStatus === 'completed' && (
                <motion.div
                  layoutId="homepage-filter-active-pill"
                  className="absolute inset-0 skeuo-pill-active rounded-xl -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.75 }}
                />
              )}
              Completed ({completedCount})
            </button>
          </div>
        </div>

        {/* Pre-listed Teams Cards Grid — Tactile Physical Boards */}
        {filteredTeams.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs border border-dashed border-zinc-300 rounded-3xl space-y-1 skeuo-sunken">
            <p className="text-zinc-900 font-bold text-sm skeuo-text-emboss">No startups found</p>
            <p>Try searching with another keyword or reset the filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredTeams.map((team) => {
              const isCurrentLive = activeRound?.status === 'investment_open' && activeRound?.teamId === team.id

              return (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`group relative p-5 sm:p-6 rounded-3xl transition-all cursor-pointer ${
                    isCurrentLive
                      ? 'skeuo-surface border-2 border-emerald-500/90 shadow-[0_8px_24px_rgba(16,185,129,0.16),inset_0_1px_0_#FFF] ring-2 ring-emerald-500/10'
                      : 'skeuo-surface-interactive'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Stamped Hardware Order Token */}
                      <div className="w-11 h-11 rounded-2xl skeuo-token flex items-center justify-center text-sm font-black font-mono text-zinc-900 flex-shrink-0 group-hover:scale-105 transition-transform">
                        #{team.pitchOrder}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-zinc-950 text-base sm:text-lg group-hover:text-zinc-800 transition-colors truncate skeuo-text-emboss">
                            {team.name}
                          </h3>
                          <Badge variant="blue" className="text-[10px] skeuo-token">{team.category}</Badge>
                          <StatusBadge status={team.status} />
                          {isCurrentLive && <LiveIndicator label="LIVE" />}
                        </div>

                        {/* Startup Idea / Pitch Title */}
                        <p className="text-zinc-900 font-bold text-sm leading-snug">
                          {team.pitchTitle}
                        </p>

                        {/* Startup Idea Description teaser */}
                        {team.description && (
                          <p className="text-zinc-600 text-xs line-clamp-2 leading-relaxed pt-0.5 font-normal">
                            {team.description}
                          </p>
                        )}

                        {/* Pitchers details in tactile sunken groove */}
                        {team.presenters && team.presenters.length > 0 && (
                          <div className="pt-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl skeuo-sunken text-zinc-700 text-[11px] font-medium">
                              <Users size={12} className="text-zinc-900 flex-shrink-0" />
                              <span className="font-bold text-zinc-900">Pitchers:</span>
                              <span className="truncate">{team.presenters.join(', ')}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Sunken Gauge & Tactile Action */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pl-14 sm:pl-0 flex-shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-zinc-100">
                      <div className="skeuo-sunken px-3.5 py-2 rounded-xl text-left sm:text-right min-w-[110px]">
                        <p className="text-zinc-950 font-black font-mono text-base sm:text-lg tracking-tight leading-none">
                          {formatPoints(team.totalInvestment)}
                        </p>
                        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mt-1 skeuo-text-emboss">
                          {team.uniqueBackers} backers
                        </p>
                      </div>

                      <div className="skeuo-btn-secondary px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold text-zinc-800 group-hover:text-zinc-950 group-hover:border-zinc-400 transition-all">
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
