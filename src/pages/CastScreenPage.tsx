// ============================================================
// CastScreenPage.tsx — Stage Projector & Big Screen Presentation View
// Ultra-clean, high-contrast monochrome design for stage & auditorium screens.
// Supports: Common Arena Dashboard & Individual Startup Result Cards.
// ============================================================

import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Maximize2, Minimize2, Radio, Trophy, Users,
  TrendingUp, ArrowLeft, ChevronLeft, ChevronRight,
  Sparkles, Clock, Shield, CheckCircle2, LayoutGrid,
  ArrowUpRight, BarChart3, Layers
} from 'lucide-react'
import { useEventStore } from '@/store'
import { formatPoints, formatRelativeTime } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { StatusBadge, LiveIndicator } from '@/components/ui'
import { BrandLogo } from '@/components/ui/BrandLogo'

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
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-950 flex flex-col font-sans select-none overflow-x-hidden antialiased">
      {/* Stage Cast Header Bar */}
      <header className="h-16 px-6 sm:px-8 border-b border-zinc-200/90 bg-white/95 backdrop-blur-md flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="text-zinc-500 hover:text-zinc-950 transition-colors p-2 rounded-xl hover:bg-zinc-100 text-xs flex items-center gap-1.5 font-medium border border-transparent hover:border-zinc-200"
            title="Return to Admin Control"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Admin</span>
          </Link>

          <div className="h-4 w-px bg-zinc-200 hidden sm:block" />

          <div className="flex items-center gap-3">
            <BrandLogo size={24} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-zinc-950 text-sm sm:text-base tracking-tight">{event?.name || 'The Big Pitch'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-zinc-100 text-zinc-800 border border-zinc-200">
                  Stage Projection
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Switcher & Stats */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden lg:flex items-center gap-6 text-xs text-zinc-600 border-r border-zinc-200 pr-6">
            <div>
              <span className="text-zinc-400 uppercase text-[10px] tracking-wider block font-semibold">Total Raised</span>
              <span className="text-zinc-950 font-black text-sm">{formatPoints(totalEventInvested)}</span>
            </div>
            <div>
              <span className="text-zinc-400 uppercase text-[10px] tracking-wider block font-semibold">Audience Backers</span>
              <span className="text-zinc-950 font-black text-sm">{totalEventBackers}</span>
            </div>
            <div>
              <span className="text-zinc-400 uppercase text-[10px] tracking-wider block font-semibold">Lineup</span>
              <span className="text-zinc-950 font-black text-sm">{teams.length} Startups</span>
            </div>
          </div>

          {/* View Toggles */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 border border-zinc-200">
            <button
              onClick={() => {
                setSelectedTeamId(null)
                setSearchParams({})
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                !selectedTeamId ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-950'
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
                  selectedTeamId ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <option value="" className="bg-white text-zinc-950">Team Results View...</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id} className="bg-white text-zinc-950">
                    #{t.pitchOrder}: {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-zinc-950 transition-colors shadow-sm"
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
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto space-y-6"
            >
              {/* Team Presentation Banner */}
              <div className="relative overflow-hidden rounded-3xl bg-white border border-zinc-200/90 p-8 lg:p-12 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                  <div className="space-y-4 max-w-2xl">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-zinc-100 text-zinc-900 border border-zinc-200">
                        Pitch Order #{activeSelectedTeam.pitchOrder}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {activeSelectedTeam.category}
                      </span>
                      <StatusBadge status={activeSelectedTeam.status} />
                    </div>

                    <div>
                      <h1 className="text-4xl lg:text-6xl font-black text-zinc-950 tracking-tight leading-none">
                        {activeSelectedTeam.name}
                      </h1>
                      <p className="text-xl lg:text-2xl font-bold text-zinc-700 mt-3 leading-snug">
                        {activeSelectedTeam.pitchTitle}
                      </p>
                    </div>

                    <p className="text-zinc-600 text-base lg:text-lg leading-relaxed pt-1">
                      {activeSelectedTeam.description || 'Pioneering startup innovation presented at The Big Pitch.'}
                    </p>

                    {activeSelectedTeam.presenters && activeSelectedTeam.presenters.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 text-zinc-600 text-sm">
                        <Users size={16} className="text-zinc-400" />
                        <span className="font-bold text-zinc-900">Pitchers:</span>
                        <span>{activeSelectedTeam.presenters.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Highlight Metrics Podium */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-4 flex-shrink-0 lg:w-80">
                    <div className="p-6 text-center border border-zinc-200/90 bg-zinc-50 rounded-2xl shadow-sm">
                      <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-1">Tournament Rank</p>
                      <p className="text-5xl font-black text-zinc-950 font-mono">
                        #{selectedTeamRank}
                      </p>
                      <p className="text-zinc-500 text-xs mt-1.5 font-medium">Among {teams.length} Startups</p>
                    </div>

                    <div className="p-6 text-center border border-zinc-200/90 bg-zinc-950 text-white rounded-2xl shadow-sm">
                      <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold mb-1">Audience Capital</p>
                      <p className="text-4xl lg:text-5xl font-black text-white font-mono">
                        {formatPoints(activeSelectedTeam.totalInvestment)}
                      </p>
                      <p className="text-zinc-400 text-xs mt-1.5 font-medium">{activeSelectedTeam.uniqueBackers} Backers Supported</p>
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
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 transition-colors shadow-sm"
                >
                  <ChevronLeft size={16} /> Previous Startup
                </button>

                <button
                  onClick={() => {
                    setSelectedTeamId(null)
                    setSearchParams({})
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm transition-colors"
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
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 transition-colors shadow-sm"
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
                  <div className="relative overflow-hidden rounded-3xl bg-white border-2 border-zinc-950 p-8 lg:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] animate-fade-in">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-black text-zinc-950 text-xs tracking-widest uppercase">
                          LIVE PITCH ON STAGE
                        </span>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-zinc-100 text-zinc-900 border border-zinc-200">
                        Round #{activeRound?.roundNumber || currentTeam.pitchOrder}
                      </span>
                    </div>

                    <h2 className="text-4xl sm:text-6xl font-black text-zinc-950 tracking-tight leading-none mb-3">
                      {currentTeam.name}
                    </h2>
                    <p className="text-xl sm:text-2xl font-bold text-zinc-700 mb-4 leading-snug">
                      {currentTeam.pitchTitle}
                    </p>

                    <p className="text-zinc-600 text-sm sm:text-base leading-relaxed line-clamp-3 mb-6">
                      {currentTeam.description}
                    </p>

                    {currentTeam.presenters && currentTeam.presenters.length > 0 && (
                      <div className="flex items-center gap-2 text-zinc-600 text-sm mb-6">
                        <Users size={16} className="text-zinc-400" />
                        <span className="font-bold text-zinc-900">Pitchers:</span>
                        <span>{currentTeam.presenters.join(', ')}</span>
                      </div>
                    )}

                    {/* Live Metric Display */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/90">
                        <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold">Live Points Backed</p>
                        <p className="text-4xl font-black text-zinc-950 mt-1 font-mono">
                          {formatPoints(currentTeam.totalInvestment)}
                        </p>
                      </div>
                      <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/90">
                        <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold">Active Backers</p>
                        <p className="text-4xl font-black text-zinc-950 mt-1 font-mono">
                          {currentTeam.uniqueBackers}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Intermission / Stage Standby Card
                  <div className="relative overflow-hidden rounded-3xl bg-white border border-zinc-200/90 p-8 lg:p-12 text-center space-y-5 shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-950 text-white flex items-center justify-center mx-auto shadow-sm">
                      <Radio size={28} className="animate-pulse" />
                    </div>

                    <div>
                      <h2 className="text-3xl lg:text-4xl font-black text-zinc-950 tracking-tight">
                        Main Stage Arena
                      </h2>
                      <p className="text-zinc-500 text-base mt-2">
                        {teams.some(t => t.status === 'upcoming')
                          ? 'Preparing the stage for the next startup pitch.'
                          : 'All scheduled pitch presentations have concluded.'}
                      </p>
                    </div>

                    {teams.find(t => t.status === 'upcoming') && (
                      <div className="p-5 rounded-2xl max-w-md mx-auto text-left border border-zinc-200 bg-zinc-50 shadow-sm">
                        <span className="text-zinc-500 font-bold text-xs uppercase tracking-widest block mb-1">
                          Up Next On Deck
                        </span>
                        <p className="text-zinc-950 font-black text-lg">
                          {teams.find(t => t.status === 'upcoming')?.name}
                        </p>
                        <p className="text-zinc-500 text-xs mt-0.5 truncate">
                          {teams.find(t => t.status === 'upcoming')?.pitchTitle}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Activity Stream */}
                <div className="bg-white p-6 rounded-3xl border border-zinc-200/90 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-zinc-950 font-bold text-sm flex items-center gap-2">
                      <Sparkles size={15} className="text-zinc-700" /> Live Investment Feed
                    </h3>
                    <span className="text-[11px] text-zinc-400 font-mono">Realtime broadcast</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-hidden">
                    {livePitch.recentActivity.length > 0 ? (
                      livePitch.recentActivity.slice(0, 4).map((act, i) => (
                        <div key={act.id || i} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-xs">
                          <span className="text-zinc-800 font-medium">{act.message}</span>
                          <span className="text-zinc-400 text-[10px] font-mono">{formatRelativeTime(act.timestamp)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-400 text-xs text-center py-4">Waiting for audience investments...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols): Live Stage Leaderboard */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h3 className="text-zinc-950 font-black text-xl flex items-center gap-2">
                      <Trophy size={20} className="text-zinc-950" />
                      Live Standings
                    </h3>
                    <p className="text-zinc-500 text-xs mt-0.5">Ranked by audience capital invested</p>
                  </div>
                  <span className="text-xs font-mono text-zinc-900 font-bold bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">{teams.length} Startups</span>
                </div>

                <div className="space-y-2.5">
                  {sortedTeams.map((team, idx) => {
                    const isTeamActive = team.id === activeRound?.teamId && isLive
                    const rank = idx + 1

                    return (
                      <div
                        key={team.id}
                        onClick={() => {
                          setSelectedTeamId(team.id)
                          setSearchParams({ teamId: team.id })
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 shadow-sm ${
                          isTeamActive
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : 'bg-white hover:bg-zinc-50 border-zinc-200/90'
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-xl font-mono text-xs font-black flex items-center justify-center flex-shrink-0 ${
                          isTeamActive
                            ? 'bg-white text-zinc-950'
                            : rank === 1
                            ? 'bg-zinc-950 text-white'
                            : rank === 2
                            ? 'bg-zinc-800 text-white'
                            : rank === 3
                            ? 'bg-zinc-700 text-white'
                            : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                        }`}>
                          {rank}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-bold text-sm truncate ${isTeamActive ? 'text-white' : 'text-zinc-950'}`}>{team.name}</p>
                            {isTeamActive && <LiveIndicator label="LIVE" />}
                            <span className={`text-[10px] font-mono ${isTeamActive ? 'text-zinc-400' : 'text-zinc-400'}`}>#{team.pitchOrder}</span>
                          </div>
                          <p className={`text-xs truncate max-w-[200px] ${isTeamActive ? 'text-zinc-400' : 'text-zinc-500'}`}>{team.pitchTitle}</p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className={`font-black text-sm font-mono ${isTeamActive ? 'text-white' : 'text-zinc-950'}`}>{formatPoints(team.totalInvestment)}</p>
                          <p className={`text-[10px] ${isTeamActive ? 'text-zinc-400' : 'text-zinc-400'}`}>{team.uniqueBackers} backers</p>
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
