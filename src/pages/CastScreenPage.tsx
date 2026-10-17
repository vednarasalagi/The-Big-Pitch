// ============================================================
// CastScreenPage.tsx — Stage Projector & Big Screen Presentation View
// Designed for HDMI / stage projectors, high contrast, live telemetry.
// Supports: Common Arena Dashboard & Individual Team Result Dashboards.
// ============================================================

import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Maximize2, Minimize2, Radio, Trophy, Users, Zap,
  TrendingUp, Award, ArrowLeft, ChevronLeft, ChevronRight,
  Sparkles, Clock, Shield, CheckCircle2, LayoutGrid
} from 'lucide-react'
import { useEventStore } from '@/store'
import { formatPoints, formatRelativeTime } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { StatusBadge, LiveIndicator } from '@/components/ui'

export function CastScreenPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { event, teams, activeRound, livePitch } = useEventStore()

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(searchParams.get('teamId'))

  // Listen to search params
  useEffect(() => {
    const qTeam = searchParams.get('teamId')
    if (qTeam) setSelectedTeamId(qTeam)
  }, [searchParams])

  // Fullscreen toggler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Sorted teams for leaderboard
  const sortedTeams = [...teams].sort((a, b) => b.totalInvestment - a.totalInvestment)
  const totalEventInvested = teams.reduce((s, t) => s + t.totalInvestment, 0)
  const totalEventBackers = teams.reduce((s, t) => s + t.uniqueBackers, 0)
  const maxTeamPoints = sortedTeams[0]?.totalInvestment || 1000

  // Active round or live pitch data
  const currentTeam = activeRound?.team || teams.find(t => t.id === activeRound?.teamId)
  const isLive = activeRound?.status === 'investment_open'

  // If a team result is selected
  const activeSelectedTeam = selectedTeamId ? teams.find(t => t.id === selectedTeamId) : null
  const selectedTeamRank = activeSelectedTeam ? sortedTeams.findIndex(t => t.id === activeSelectedTeam.id) + 1 : 0

  return (
    <div className="min-h-screen bg-[#070913] text-white flex flex-col font-sans select-none overflow-x-hidden">
      {/* Stage Cast Header Bar */}
      <header className="h-16 px-6 sm:px-8 border-b border-white/[0.08] bg-black/40 backdrop-blur-md flex items-center justify-between z-40">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.06] text-xs flex items-center gap-1.5"
            title="Return to Admin"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Admin</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-arena-blue to-arena-violet flex items-center justify-center shadow-glow-blue">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-base tracking-tight">{event?.name || 'Pitch Arena'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-arena-blue/20 text-arena-blue-3 border border-arena-blue/30">
                  Big Screen View
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Switcher & Stats */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden lg:flex items-center gap-6 text-xs text-white/50 border-r border-white/[0.1] pr-6">
            <div>
              <span className="text-white/30 uppercase text-[10px] tracking-wider block">Total Raised</span>
              <span className="text-emerald-400 font-bold text-sm">{formatPoints(totalEventInvested)} pts</span>
            </div>
            <div>
              <span className="text-white/30 uppercase text-[10px] tracking-wider block">Audience Backers</span>
              <span className="text-cyan-400 font-bold text-sm">{totalEventBackers}</span>
            </div>
            <div>
              <span className="text-white/30 uppercase text-[10px] tracking-wider block">Startups</span>
              <span className="text-arena-violet-3 font-bold text-sm">{teams.length} Teams</span>
            </div>
          </div>

          {/* View Toggles */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.05] border border-white/[0.1]">
            <button
              onClick={() => {
                setSelectedTeamId(null)
                setSearchParams({})
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                !selectedTeamId ? 'bg-gradient-to-r from-arena-blue to-arena-violet text-white shadow-md' : 'text-white/60 hover:text-white'
              }`}
            >
              <LayoutGrid size={13} />
              <span>Common Arena</span>
            </button>

            <div className="relative">
              <select
                value={selectedTeamId || ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (val) {
                    setSelectedTeamId(val)
                    setSearchParams({ teamId: val })
                  } else {
                    setSelectedTeamId(null)
                    setSearchParams({})
                  }
                }}
                className={`bg-transparent text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer outline-none transition-all ${
                  selectedTeamId ? 'bg-gradient-to-r from-arena-blue to-arena-violet text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                <option value="" className="bg-arena-navy text-white">Team Results View...</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id} className="bg-arena-navy text-white">
                    #{t.pitchOrder}: {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/70 hover:text-white transition-colors"
            title="Toggle Stage Fullscreen (F11)"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* Main Presentation Surface */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeSelectedTeam ? (
            // ========================================================
            // VIEW 1: INDIVIDUAL TEAM RESULT DASHBOARD (CAST TO STAGE)
            // ========================================================
            <motion.div
              key={`team-${activeSelectedTeam.id}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="max-w-6xl mx-auto space-y-6"
            >
              {/* Team Presentation Banner */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-arena-navy via-arena-navy-2 to-arena-violet/20 border border-white/[0.12] p-8 lg:p-12 shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-arena-blue/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                  <div className="space-y-4 max-w-2xl">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/10 text-white/80 border border-white/15">
                        Pitch Order #{activeSelectedTeam.pitchOrder}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-arena-violet/20 text-arena-violet-3 border border-arena-violet/30">
                        {activeSelectedTeam.category}
                      </span>
                      <StatusBadge status={activeSelectedTeam.status} />
                    </div>

                    <div>
                      <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tight">
                        {activeSelectedTeam.name}
                      </h1>
                      <p className="text-xl lg:text-2xl font-bold gradient-text mt-2">
                        {activeSelectedTeam.pitchTitle}
                      </p>
                    </div>

                    <p className="text-white/70 text-base lg:text-lg leading-relaxed pt-2">
                      {activeSelectedTeam.description || 'Pioneering startup innovation pitched at Pitch Arena.'}
                    </p>

                    {activeSelectedTeam.presenters && activeSelectedTeam.presenters.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 text-white/60 text-sm">
                        <Users size={16} className="text-arena-blue-3" />
                        <span className="font-semibold text-white">Pitchers:</span>
                        <span>{activeSelectedTeam.presenters.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Highlight Metrics Podium */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-4 flex-shrink-0 lg:w-80">
                    <div className="glass-card p-6 text-center border-arena-blue/30 bg-arena-blue/10 rounded-3xl shadow-glow-blue">
                      <p className="text-white/50 text-xs uppercase tracking-widest font-semibold mb-1">Tournament Rank</p>
                      <p className="text-5xl font-black text-white">
                        {selectedTeamRank === 1 ? '🥇 #1' : selectedTeamRank === 2 ? '🥈 #2' : selectedTeamRank === 3 ? '🥉 #3' : `#${selectedTeamRank}`}
                      </p>
                      <p className="text-arena-blue-3 text-xs mt-1 font-semibold">Among {teams.length} Startups</p>
                    </div>

                    <div className="glass-card p-6 text-center border-emerald-500/30 bg-emerald-500/10 rounded-3xl">
                      <p className="text-white/50 text-xs uppercase tracking-widest font-semibold mb-1">Audience Capital</p>
                      <p className="text-4xl lg:text-5xl font-black text-emerald-400">
                        {formatPoints(activeSelectedTeam.totalInvestment)}
                      </p>
                      <p className="text-white/50 text-xs mt-1 font-medium">{activeSelectedTeam.uniqueBackers} Backers Supported</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Navigation & Controls */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    const currentIndex = teams.findIndex(t => t.id === activeSelectedTeam.id)
                    const prevIndex = (currentIndex - 1 + teams.length) % teams.length
                    const prevTeam = teams[prevIndex]
                    if (prevTeam) {
                      setSelectedTeamId(prevTeam.id)
                      setSearchParams({ teamId: prevTeam.id })
                    }
                  }}
                  className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white"
                >
                  <ChevronLeft size={16} /> Previous Startup
                </button>

                <button
                  onClick={() => {
                    setSelectedTeamId(null)
                    setSearchParams({})
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-arena-blue to-arena-violet text-white shadow-lg"
                >
                  Return to Common Arena Board
                </button>

                <button
                  onClick={() => {
                    const currentIndex = teams.findIndex(t => t.id === activeSelectedTeam.id)
                    const nextIndex = (currentIndex + 1) % teams.length
                    const nextTeam = teams[nextIndex]
                    if (nextTeam) {
                      setSelectedTeamId(nextTeam.id)
                      setSearchParams({ teamId: nextTeam.id })
                    }
                  }}
                  className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white"
                >
                  Next Startup <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          ) : (
            // ========================================================
            // VIEW 2: COMMON AUDIENCE ARENA DASHBOARD (STAGE PROJECTOR)
            // ========================================================
            <motion.div
              key="common-dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full max-w-7xl mx-auto items-start"
            >
              {/* Left Column (7 cols): Live Pitch Hero or Stage Status */}
              <div className="lg:col-span-7 space-y-6">
                {isLive && currentTeam ? (
                  // Live Pitch in Progress Box
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/40 via-arena-navy-2 to-arena-blue/20 border-2 border-emerald-500/40 p-8 lg:p-10 shadow-2xl animate-fade-in">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping" />
                        <span className="font-black text-emerald-400 text-sm tracking-widest uppercase">
                          LIVE PITCH ON STAGE
                        </span>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-white/10 text-white/80">
                        Round #{activeRound?.roundNumber || currentTeam.pitchOrder}
                      </span>
                    </div>

                    <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-none mb-3">
                      {currentTeam.name}
                    </h2>
                    <p className="text-xl sm:text-2xl font-bold text-arena-blue-3 mb-4">
                      {currentTeam.pitchTitle}
                    </p>

                    <p className="text-white/70 text-sm sm:text-base leading-relaxed line-clamp-3 mb-6">
                      {currentTeam.description}
                    </p>

                    {currentTeam.presenters && currentTeam.presenters.length > 0 && (
                      <div className="flex items-center gap-2 text-white/60 text-sm mb-6">
                        <Users size={16} className="text-emerald-400" />
                        <span className="font-semibold text-white">Pitchers:</span>
                        <span>{currentTeam.presenters.join(', ')}</span>
                      </div>
                    )}

                    {/* Live Metric Display */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="glass-card p-5 rounded-2xl bg-black/40 border border-emerald-500/20">
                        <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">Live Points Backed</p>
                        <p className="text-4xl font-black text-emerald-400 mt-1">
                          {formatPoints(currentTeam.totalInvestment)}
                        </p>
                      </div>
                      <div className="glass-card p-5 rounded-2xl bg-black/40 border border-white/[0.08]">
                        <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">Active Audience Backers</p>
                        <p className="text-4xl font-black text-white mt-1">
                          {currentTeam.uniqueBackers}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Intermission / Stage Standby Card
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-arena-navy via-arena-navy-2 to-arena-violet/20 border border-white/[0.1] p-8 lg:p-12 text-center space-y-5">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-arena-blue to-arena-violet flex items-center justify-center mx-auto shadow-glow-blue">
                      <Radio size={32} className="text-white animate-pulse" />
                    </div>

                    <div>
                      <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
                        Main Stage Arena
                      </h2>
                      <p className="text-white/50 text-base mt-2">
                        {teams.some(t => t.status === 'upcoming')
                          ? 'Preparing the stage for the next startup pitch.'
                          : 'All scheduled pitch presentations have concluded.'}
                      </p>
                    </div>

                    {teams.find(t => t.status === 'upcoming') && (
                      <div className="glass-card p-5 rounded-2xl max-w-md mx-auto text-left border border-white/[0.1]">
                        <span className="text-arena-blue-3 font-bold text-xs uppercase tracking-widest block mb-1">
                          Up Next On Deck
                        </span>
                        <p className="text-white font-bold text-lg">
                          {teams.find(t => t.status === 'upcoming')?.name}
                        </p>
                        <p className="text-white/50 text-xs mt-0.5 truncate">
                          {teams.find(t => t.status === 'upcoming')?.pitchTitle}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Activity Stream */}
                <div className="glass-card p-5 rounded-3xl border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <Sparkles size={15} className="text-amber-400" /> Live Investment Feed
                    </h3>
                    <span className="text-[11px] text-white/40 font-mono">Realtime broadcast</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-hidden">
                    {livePitch.recentActivity.length > 0 ? (
                      livePitch.recentActivity.slice(0, 4).map((act, i) => (
                        <div key={act.id || i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] text-xs">
                          <span className="text-white/80">{act.message}</span>
                          <span className="text-white/30 text-[10px] font-mono">{formatRelativeTime(act.timestamp)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-white/30 text-xs text-center py-4">Waiting for audience investments...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols): Live Stage Leaderboard */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h3 className="text-white font-black text-xl flex items-center gap-2">
                      <Trophy size={20} className="text-yellow-400" />
                      Live Standings
                    </h3>
                    <p className="text-white/40 text-xs mt-0.5">Ranked by audience capital invested</p>
                  </div>
                  <span className="text-xs font-mono text-arena-blue-3 font-semibold">{teams.length} Startups</span>
                </div>

                <div className="space-y-2.5">
                  {sortedTeams.map((team, idx) => {
                    const isTeamActive = team.id === activeRound?.teamId && isLive
                    const rank = idx + 1
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

                    return (
                      <div
                        key={team.id}
                        onClick={() => {
                          setSelectedTeamId(team.id)
                          setSearchParams({ teamId: team.id })
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                          isTeamActive
                            ? 'bg-emerald-500/15 border-emerald-500/50 shadow-glow-green'
                            : rank === 1
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'glass-card hover:bg-white/[0.06] border-white/[0.08]'
                        }`}
                      >
                        <span className="text-xl font-bold w-7 text-center">{medal}</span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-sm truncate">{team.name}</p>
                            {isTeamActive && <LiveIndicator label="LIVE" />}
                            <span className="text-[10px] text-white/40 font-mono">#{team.pitchOrder}</span>
                          </div>
                          <p className="text-white/40 text-xs truncate max-w-[200px]">{team.pitchTitle}</p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-arena-blue-3 font-black text-sm">{formatPoints(team.totalInvestment)}</p>
                          <p className="text-white/40 text-[10px]">{team.uniqueBackers} backers</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
