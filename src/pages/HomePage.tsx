// ============================================================
// Home Page — Competing Startups Lineup & Event Overview
// Displays pre-listed teams, startup ideas, pitcher details,
// live pitch status, and audience investment overview.
// ============================================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, Trophy, Users, TrendingUp, ArrowRight, Clock, Star,
  Search, Filter, ExternalLink, Sparkles, X, ChevronRight,
  Radio, CheckCircle2, Shield
} from 'lucide-react'
import { useAuthStore, useEventStore, useWalletStore } from '@/store'
import { Card, StatusBadge, Avatar, LiveIndicator, Button, ProgressBar, Badge } from '@/components/ui'
import { formatPoints, formatRelativeTime } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import type { Team } from '@/types'

// Modal for reading complete startup idea and pitcher background
function StartupDetailModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const { activeRound } = useEventStore()
  const isTeamLive = activeRound?.status === 'investment_open' && activeRound?.teamId === team.id

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-card w-full max-w-lg p-6 sm:p-7 space-y-5 border-white/[0.15] shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="space-y-2 pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 text-white/80 border border-white/10">
              Pitch #{team.pitchOrder}
            </span>
            <Badge variant="cyan" className="text-[11px]">{team.category}</Badge>
            <StatusBadge status={team.status} />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            {team.name}
          </h2>
          <p className="text-base sm:text-lg font-bold gradient-text">
            {team.pitchTitle}
          </p>
        </div>

        {/* Pitcher Details */}
        {team.presenters && team.presenters.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
            <div className="flex items-center gap-2 text-arena-blue-3 font-semibold text-xs">
              <Users size={14} />
              <span>Pitchers & Presenters</span>
            </div>
            <p className="text-white text-sm font-medium pl-5">
              {team.presenters.join(', ')}
            </p>
          </div>
        )}

        {/* Startup Idea & Description */}
        <div className="space-y-2">
          <h4 className="text-white/40 uppercase text-xs font-bold tracking-wider">Startup Idea & Vision</h4>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-white/80 text-sm leading-relaxed whitespace-pre-line">
            {team.description || 'This team has registered their pitch idea for Pitch Arena.'}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="glass-card p-3.5 text-center">
            <span className="text-white/40 text-[11px] uppercase tracking-wider font-semibold block">Audience Points</span>
            <span className="text-xl font-bold text-arena-blue-3">{formatPoints(team.totalInvestment)}</span>
          </div>
          <div className="glass-card p-3.5 text-center">
            <span className="text-white/40 text-[11px] uppercase tracking-wider font-semibold block">Unique Backers</span>
            <span className="text-xl font-bold text-white">{team.uniqueBackers} Backers</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          {isTeamLive ? (
            <Link to="/live" className="flex-1">
              <Button size="md" icon={<Zap size={15} />} className="w-full justify-center bg-gradient-to-r from-emerald-500 to-cyan-500 animate-glow">
                Back this Pitch Live Now!
              </Button>
            </Link>
          ) : (
            <Link to={`/cast?teamId=${team.id}`} className="flex-1">
              <Button variant="secondary" size="md" icon={<ExternalLink size={14} />} className="w-full justify-center">
                Stage Projector View
              </Button>
            </Link>
          )}
          <Button variant="secondary" size="md" onClick={onClose} className="px-5">
            Close
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

export function HomePage() {
  const { user } = useAuthStore()
  const { event, teams, activeRound } = useEventStore()
  const { wallet, investments } = useWalletStore()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'active' | 'completed'>('all')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)

  const sortedTeams = [...teams].sort((a, b) => (a.pitchOrder || 0) - (b.pitchOrder || 0))
  const totalInvested = teams.reduce((sum, t) => sum + t.totalInvestment, 0)
  const totalBackers = teams.reduce((sum, t) => sum + t.uniqueBackers, 0)
  const isLive = activeRound?.status === 'investment_open'

  // Filtered teams list for display
  const filteredTeams = sortedTeams.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.pitchTitle.toLowerCase().includes(search.toLowerCase()) ||
      (t.presenters && t.presenters.some(p => p.toLowerCase().includes(search.toLowerCase())))

    const matchesStatus = filterStatus === 'all' || t.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const upcomingCount = teams.filter(t => t.status === 'upcoming').length
  const activeCount = teams.filter(t => t.status === 'active').length
  const completedCount = teams.filter(t => t.status === 'completed').length

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Hero / Event Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-arena-blue/20 via-arena-navy-3 to-arena-violet/20 border border-white/[0.08] p-6 sm:p-8">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-arena-blue/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-arena-violet/10 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            {isLive ? <LiveIndicator /> : <StatusBadge status={event?.status ?? 'not_started'} />}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 leading-tight tracking-tight">
            {event?.name ?? 'Pitch Arena'}
          </h1>
          <p className="text-white/60 text-sm sm:text-base mb-6 max-w-xl">
            {event?.tagline ?? 'Discover ambitious student startup founders, explore their ideas, and back them with audience investment points.'}
          </p>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="glass-card p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-black text-arena-blue-3">{formatPoints(totalInvested)}</p>
              <p className="text-white/40 text-[11px] sm:text-xs mt-0.5">Total Invested</p>
            </div>
            <div className="glass-card p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-black text-arena-violet-3">{totalBackers}</p>
              <p className="text-white/40 text-[11px] sm:text-xs mt-0.5">Audience Backers</p>
            </div>
            <div className="glass-card p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-black text-emerald-400">{teams.length}</p>
              <p className="text-white/40 text-[11px] sm:text-xs mt-0.5">Competing Startups</p>
            </div>
          </div>

          {/* CTAs */}
          {!user ? (
            <Link to="/auth">
              <Button icon={<Zap size={15} />} size="md" className="w-full justify-center bg-gradient-to-r from-arena-blue to-arena-violet shadow-glow-blue">
                Sign In to Get 500 Free Audience Points
              </Button>
            </Link>
          ) : user.role === 'admin' ? (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Link to="/admin" className="flex-1">
                <Button icon={<Zap size={15} />} size="md" className="w-full justify-center bg-gradient-to-r from-arena-violet to-arena-blue shadow-glow-violet">
                  Open Admin Control Room
                </Button>
              </Link>
              <Link to="/cast" className="flex-1">
                <Button variant="secondary" icon={<Radio size={15} />} size="md" className="w-full justify-center">
                  Open Stage Big Screen Cast
                </Button>
              </Link>
            </div>
          ) : isLive ? (
            <Link to="/live">
              <Button icon={<Zap size={15} />} size="md" className="w-full justify-center animate-glow bg-gradient-to-r from-emerald-500 to-cyan-500">
                🔥 Invest Live Now — Round In Progress!
              </Button>
            </Link>
          ) : (
            <Link to="/scoreboard">
              <Button variant="secondary" icon={<Trophy size={15} />} size="md" className="w-full justify-center">
                View Live Scoreboard
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* My Wallet Quick Card (if signed in as audience) */}
      {user && user.role !== 'admin' && wallet && (
        <Link to="/wallet">
          <Card hover className="p-4 border-white/[0.08]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-arena-violet/20 flex items-center justify-center text-arena-violet-3">
                  <Star size={14} />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">My Wallet</p>
                  <p className="text-white/40 text-xs">{investments.length} pitches backed</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-white/30" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="glass-card p-2.5 text-center">
                <p className="text-base font-bold text-arena-blue-3">{formatPoints(wallet.freePoints + wallet.purchasedPoints)}</p>
                <p className="text-white/40 text-[10px] mt-0.5">Available</p>
              </div>
              <div className="glass-card p-2.5 text-center">
                <p className="text-base font-bold text-arena-violet-3">{formatPoints(wallet.investedPoints)}</p>
                <p className="text-white/40 text-[10px] mt-0.5">Invested</p>
              </div>
              <div className="glass-card p-2.5 text-center">
                <p className="text-base font-bold text-emerald-400">{formatPoints(wallet.freePoints)}</p>
                <p className="text-white/40 text-[10px] mt-0.5">Free Points</p>
              </div>
            </div>
          </Card>
        </Link>
      )}

      {/* Active Pitch Alert (Glowing Card) */}
      {isLive && activeRound?.team && (
        <Link to="/live">
          <div className="glass-card border-emerald-500/40 bg-emerald-500/10 p-5 rounded-2xl flex items-center justify-between gap-4 animate-pulse-slow">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-2xl flex-shrink-0 shadow-glow-green">
                🚀
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Pitching Live Right Now</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-white font-black text-lg truncate mt-0.5">{activeRound.team.name}</p>
                <p className="text-white/60 text-xs truncate">{activeRound.team.pitchTitle}</p>
              </div>
            </div>
            <Button size="sm" icon={<Zap size={14} />} className="bg-emerald-500 hover:bg-emerald-400 text-white flex-shrink-0">
              Invest
            </Button>
          </div>
        </Link>
      )}

      {/* ======================================================== */}
      {/* PRE-LISTED PITCHING TEAMS SHOWCASE SECTION               */}
      {/* ======================================================== */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-black text-xl flex items-center gap-2">
              <Sparkles size={18} className="text-arena-blue-3" />
              Pitching Startups & Ideas
            </h2>
            <p className="text-white/40 text-xs mt-0.5">
              Explore pre-listed startup ideas, pitcher profiles, and audience backing
            </p>
          </div>
          <span className="text-xs font-mono text-arena-blue-3 font-semibold px-2.5 py-1 rounded-lg bg-arena-blue/10 border border-arena-blue/20 w-fit">
            {teams.length} Startups Pre-listed
          </span>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={14} className="text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
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
                  ? 'bg-arena-blue text-white'
                  : 'bg-white/[0.04] text-white/50 hover:text-white'
              }`}
            >
              All ({teams.length})
            </button>
            <button
              onClick={() => setFilterStatus('upcoming')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filterStatus === 'upcoming'
                  ? 'bg-arena-blue text-white'
                  : 'bg-white/[0.04] text-white/50 hover:text-white'
              }`}
            >
              Upcoming ({upcomingCount})
            </button>
            {activeCount > 0 && (
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterStatus === 'active'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                Live Now ({activeCount})
              </button>
            )}
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filterStatus === 'completed'
                  ? 'bg-arena-blue text-white'
                  : 'bg-white/[0.04] text-white/50 hover:text-white'
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>
        </div>

        {/* Pre-listed Teams Cards Grid */}
        {filteredTeams.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-xs border border-dashed border-white/[0.08] rounded-2xl space-y-1">
            <p className="text-white/60 font-semibold text-sm">No startups found</p>
            <p>Try searching with another keyword or reset the filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTeams.map((team) => {
              const isCurrentLive = activeRound?.status === 'investment_open' && activeRound?.teamId === team.id

              return (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`group relative p-5 rounded-2xl border transition-all cursor-pointer ${
                    isCurrentLive
                      ? 'bg-gradient-to-r from-emerald-950/40 to-arena-navy border-emerald-500/50 shadow-glow-green'
                      : 'glass-card hover:border-white/[0.2] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Pitch Order Pill */}
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-arena-blue/20 to-arena-violet/20 border border-white/[0.08] flex items-center justify-center text-sm font-black text-white flex-shrink-0 group-hover:border-arena-blue/50 transition-colors">
                        #{team.pitchOrder}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-white text-base group-hover:text-arena-blue-3 transition-colors truncate">
                            {team.name}
                          </h3>
                          <Badge variant="cyan" className="text-[10px]">{team.category}</Badge>
                          <StatusBadge status={team.status} />
                        </div>

                        {/* Startup Idea / Pitch Title */}
                        <p className="text-arena-blue-2 font-bold text-sm leading-snug">
                          {team.pitchTitle}
                        </p>

                        {/* Startup Idea Description teaser */}
                        {team.description && (
                          <p className="text-white/50 text-xs line-clamp-2 leading-relaxed pt-0.5">
                            {team.description}
                          </p>
                        )}

                        {/* Pitchers details */}
                        {team.presenters && team.presenters.length > 0 && (
                          <div className="flex items-center gap-1.5 text-white/40 text-[11px] pt-1">
                            <Users size={12} className="text-arena-violet-3 flex-shrink-0" />
                            <span className="text-white/60 font-medium">Pitchers:</span>
                            <span className="truncate">{team.presenters.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Points & CTA */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pl-14 sm:pl-0 flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/[0.06]">
                      <div className="text-left sm:text-right">
                        <p className="text-arena-blue-3 font-black text-sm">{formatPoints(team.totalInvestment)}</p>
                        <p className="text-white/40 text-[10px]">{team.uniqueBackers} backers</p>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-white/50 group-hover:text-white font-semibold transition-colors">
                        <span>Details</span>
                        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
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
