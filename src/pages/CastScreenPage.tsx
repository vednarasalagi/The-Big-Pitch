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
  ArrowUpRight, BarChart3, Layers, Crown, Zap
} from 'lucide-react'
import { useEventStore, useWalletStore, useAuthStore } from '@/store'
import { formatPoints, formatRelativeTime, formatMilliseconds, formatExactMs } from '@/lib/utils'
import { getTeamAudienceStandings } from '@/lib/supabaseApi'
import { supabase, TABLES } from '@/lib/supabase'
import { STANDINGS_INVALIDATE_EVENT, syncLiveState } from '@/lib/realtimeSync'
import type { TeamInvestorStanding } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'
import { StatusBadge, LiveIndicator } from '@/components/ui'
import { BrandLogo } from '@/components/ui/BrandLogo'

export function CastScreenPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { event, teams, activeRound, livePitch } = useEventStore()
  const { user } = useAuthStore()
  const { investments: localInvestments } = useWalletStore()

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(searchParams.get('teamId'))
  const [teamStandings, setTeamStandings] = useState<TeamInvestorStanding[]>([])
  const [standingsLoading, setStandingsLoading] = useState(false)

  // Listen to search params
  useEffect(() => {
    const qTeam = searchParams.get('teamId')
    if (qTeam) setSelectedTeamId(qTeam)
  }, [searchParams])

  // Pitch-order sorted startups for sequential stage navigation
  const pitchOrderedTeams = [...teams].sort((a, b) => (a.pitchOrder || 0) - (b.pitchOrder || 0))

  // Robust detection for browser fullscreen (DOM API, F11, Esc, button)
  useEffect(() => {
    const checkFullscreen = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        // @ts-ignore Webkit fallback
        document.webkitFullscreenElement ||
        (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) ||
        (typeof window !== 'undefined' && window.innerHeight >= screen.height - 4 && window.innerWidth >= screen.width - 4)
      )
      setIsFullscreen(isFs)
    }

    checkFullscreen()
    document.addEventListener('fullscreenchange', checkFullscreen)
    document.addEventListener('webkitfullscreenchange', checkFullscreen)
    window.addEventListener('resize', checkFullscreen)

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen)
      document.removeEventListener('webkitfullscreenchange', checkFullscreen)
      window.removeEventListener('resize', checkFullscreen)
    }
  }, [])

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

  // Keyboard navigation: Arrow keys & presentation clickers cycle startups
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an input or select is focused
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      const list = pitchOrderedTeams.length > 0 ? pitchOrderedTeams : teams
      if (list.length === 0) return

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        if (!selectedTeamId) {
          const first = list[0]
          setSelectedTeamId(first.id)
          setSearchParams({ teamId: first.id })
        } else {
          const currentIndex = list.findIndex(t => t.id === selectedTeamId)
          const nextIndex = (currentIndex + 1) % list.length
          const nextTeam = list[nextIndex]
          if (nextTeam) {
            setSelectedTeamId(nextTeam.id)
            setSearchParams({ teamId: nextTeam.id })
          }
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault()
        if (!selectedTeamId) {
          const last = list[list.length - 1]
          setSelectedTeamId(last.id)
          setSearchParams({ teamId: last.id })
        } else {
          const currentIndex = list.findIndex(t => t.id === selectedTeamId)
          const prevIndex = (currentIndex - 1 + list.length) % list.length
          const prevTeam = list[prevIndex]
          if (prevTeam) {
            setSelectedTeamId(prevTeam.id)
            setSearchParams({ teamId: prevTeam.id })
          }
        }
      } else if (e.key === 'Escape' && !document.fullscreenElement) {
        setSelectedTeamId(null)
        setSearchParams({})
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pitchOrderedTeams, teams, selectedTeamId, setSearchParams])

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

  // Load live audience standings for the casted startup
  useEffect(() => {
    if (!activeSelectedTeam) {
      setTeamStandings([])
      return
    }

    let isMounted = true

    const loadStandings = async () => {
      setStandingsLoading(true)
      const data = await getTeamAudienceStandings(activeSelectedTeam.id)
      if (isMounted) {
        if (data.length > 0) {
          setTeamStandings(data)
        } else {
          // Fallback to local store investments if testing locally
          const teamInvs = localInvestments.filter(i => i.teamId === activeSelectedTeam.id)
          if (teamInvs.length > 0) {
            const fallbackStanding: TeamInvestorStanding = {
              userId: user?.id || 'current-user',
              displayName: user?.displayName || 'Audience Backer',
              email: user?.email || '',
              amount: teamInvs.reduce((s, i) => s + i.amount, 0),
              timeElapsedMs: teamInvs[0]?.timeElapsedMs || 1420,
              investedAt: teamInvs[0]?.createdAt || new Date().toISOString(),
              rank: 1,
            }
            setTeamStandings([fallbackStanding])
          } else {
            setTeamStandings([])
          }
        }
        setStandingsLoading(false)
      }
    }

    loadStandings()
    const timer = setInterval(loadStandings, 2500)

    const handleInvalidate = (e: any) => {
      if (!e.detail?.teamId || e.detail.teamId === activeSelectedTeam.id) {
        loadStandings()
      }
    }
    window.addEventListener(STANDINGS_INVALIDATE_EVENT, handleInvalidate)

    let channel: any = null
    if (supabase) {
      channel = supabase
        .channel(`cast-investments-${activeSelectedTeam.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: TABLES.INVESTMENTS, filter: `team_id=eq.${activeSelectedTeam.id}` },
          () => {
            loadStandings()
          }
        )
        .subscribe()
    }

    return () => {
      isMounted = false
      clearInterval(timer)
      window.removeEventListener(STANDINGS_INVALIDATE_EVENT, handleInvalidate)
      if (channel && supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [activeSelectedTeam?.id, localInvestments.length, user?.id, user?.displayName, user?.email])

  // Automated background stage poller for projector screen
  useEffect(() => {
    syncLiveState()
    const timer = setInterval(syncLiveState, 2000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className={`bg-[#FAFAFA] text-zinc-950 flex flex-col font-sans select-none antialiased ${isFullscreen ? 'h-screen w-screen overflow-hidden' : 'min-h-screen overflow-x-hidden'}`}>
      {/* Stage Cast Header Bar (Hidden in Fullscreen) */}
      {!isFullscreen && (
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
                  <span className="font-black text-zinc-950 text-sm sm:text-base tracking-tight">
                    {event?.name && !event.name.toLowerCase().includes('pitch arena') ? event.name : 'THE BIG PITCH'}
                  </span>
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
                  {pitchOrderedTeams.map(t => (
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
              title="Toggle Stage Fullscreen (F11 or Press F)"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </header>
      )}

      {/* Main Presentation Surface */}
      <main className={`flex-1 ${isFullscreen ? 'h-full w-full overflow-hidden p-4 sm:p-6 lg:p-8 flex flex-col justify-center' : 'p-6 lg:p-8 overflow-y-auto'}`}>
        <AnimatePresence mode="wait">
          {activeSelectedTeam ? (
            // ========================================================
            // VIEW 1: INDIVIDUAL TEAM RESULT DASHBOARD (CAST TO STAGE)
            // Side-by-Side Single Page View — No Scrolling Required
            // ========================================================
            <motion.div
              key={`team-${activeSelectedTeam.id}`}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className={`w-full max-w-7xl mx-auto flex flex-col justify-between gap-4 ${isFullscreen ? 'h-full max-h-full py-1' : 'min-h-[calc(100vh-6.5rem)]'}`}
            >
              {/* Main Side-by-Side 2-Column Grid */}
              <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch ${isFullscreen ? 'h-full' : ''}`}>
                {/* ── LEFT COLUMN (5 cols): STARTUP DETAILS & METRICS ── */}
                <div className="lg:col-span-5 rounded-3xl bg-white border border-zinc-200/90 p-6 lg:p-7 shadow-sm flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-zinc-100 text-zinc-900 border border-zinc-200">
                        Pitch #{activeSelectedTeam.pitchOrder}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {activeSelectedTeam.category}
                      </span>
                      <StatusBadge status={activeSelectedTeam.status} />
                    </div>

                    <div>
                      <h1 className="text-3xl lg:text-4xl font-black text-zinc-950 tracking-tight leading-tight">
                        {activeSelectedTeam.name}
                      </h1>
                      <p className="text-base lg:text-lg font-bold text-zinc-700 mt-1 leading-snug">
                        {activeSelectedTeam.pitchTitle}
                      </p>
                    </div>

                    <p className="text-zinc-600 text-xs sm:text-sm leading-relaxed line-clamp-3">
                      {activeSelectedTeam.description || 'Pioneering startup innovation presented at The Big Pitch.'}
                    </p>

                    {activeSelectedTeam.presenters && activeSelectedTeam.presenters.length > 0 && (
                      <div className="flex items-center gap-2 pt-1 text-zinc-600 text-xs">
                        <Users size={14} className="text-zinc-400 flex-shrink-0" />
                        <span className="font-bold text-zinc-900">Pitchers:</span>
                        <span className="truncate">{activeSelectedTeam.presenters.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Dual Podiums (Rank + Capital) */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100">
                    <div className="p-4 text-center border border-zinc-200/90 bg-zinc-50 rounded-2xl shadow-sm">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Tournament Rank</p>
                      <p className="text-3xl lg:text-4xl font-black text-zinc-950 font-mono mt-0.5">
                        #{selectedTeamRank}
                      </p>
                      <p className="text-zinc-400 text-[10px] mt-0.5 font-medium">of {teams.length} Startups</p>
                    </div>

                    <div className="p-4 text-center border border-zinc-200/90 bg-zinc-950 text-white rounded-2xl shadow-sm">
                      <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Audience Capital</p>
                      <p className="text-2xl lg:text-3xl font-black text-white font-mono mt-0.5">
                        {formatPoints(activeSelectedTeam.totalInvestment)}
                      </p>
                      <p className="text-zinc-400 text-[10px] mt-0.5 font-medium">{activeSelectedTeam.uniqueBackers} Backers</p>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN (7 cols): AUDIENCE WINNER & TOP 5 BACKERS ── */}
                <div className="lg:col-span-7 rounded-3xl bg-white border border-zinc-200/90 p-6 lg:p-7 shadow-sm flex flex-col justify-between gap-4">
                  <div className="space-y-3.5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-1 border-b border-zinc-100">
                      <div className="flex items-center gap-2">
                        <Trophy size={20} className="text-amber-500 flex-shrink-0" />
                        <div>
                          <h2 className="text-lg sm:text-xl font-black text-zinc-950 tracking-tight leading-none">
                            Audience Winner & Top Backers
                          </h2>
                          <p className="text-zinc-500 text-[11px] mt-0.5">
                            Decided by highest capital invested in the least time (milliseconds precision)
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                        Top 5 Podium
                      </span>
                    </div>

                    {teamStandings.length > 0 ? (
                      <div className="space-y-3">
                        {/* #1 Winner Showcase Podium Banner */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white p-4 sm:p-5 border border-zinc-800 shadow-md">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black tracking-wider uppercase">
                                <Crown size={12} className="text-amber-400" />
                                <span>#1 Audience Champion</span>
                              </div>
                              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                                {teamStandings[0].displayName}
                              </h3>
                              <p className="text-zinc-400 text-[11px] font-mono">
                                {teamStandings[0].email ? teamStandings[0].email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Verified Audience Backer'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2.5 flex-shrink-0">
                              <div className="p-2.5 px-3 rounded-xl bg-white/10 border border-white/10 text-center backdrop-blur-sm min-w-[100px]">
                                <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">Capital</p>
                                <p className="text-xl font-black text-white font-mono mt-0.5">
                                  {formatPoints(teamStandings[0].amount)}
                                </p>
                              </div>
                              <div className="p-2.5 px-3 rounded-xl bg-amber-400/10 border border-amber-400/20 text-center backdrop-blur-sm min-w-[120px]">
                                <p className="text-[9px] text-amber-300 uppercase tracking-widest font-bold flex items-center justify-center gap-1">
                                  <Zap size={10} className="text-amber-400" /> Speed (ms)
                                </p>
                                <p className="text-xl font-black text-amber-300 font-mono mt-0.5">
                                  {formatExactMs(teamStandings[0].timeElapsedMs)}
                                </p>
                                <p className="text-[9px] text-zinc-400 mt-0.5">
                                  {(teamStandings[0].timeElapsedMs / 1000).toFixed(3)}s
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Top 5 Backers Table */}
                        <div className="rounded-xl border border-zinc-200/90 bg-white overflow-hidden shadow-sm">
                          <div className="px-3.5 py-2 bg-zinc-50/80 border-b border-zinc-100 flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            <span>Rank & Investor</span>
                            <div className="flex gap-6">
                              <span className="w-20 text-right">Points</span>
                              <span className="w-28 text-right">Time Taken (ms)</span>
                            </div>
                          </div>

                          <div className="divide-y divide-zinc-100">
                            {teamStandings.slice(0, 5).map((standing) => (
                              <div
                                key={standing.userId}
                                className={`px-3.5 py-2 flex items-center justify-between transition-colors ${
                                  standing.rank === 1 ? 'bg-amber-50/30' : 'hover:bg-zinc-50/50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-6 h-6 rounded-lg font-black font-mono flex items-center justify-center text-[10px] ${
                                    standing.rank === 1
                                      ? 'bg-amber-400 text-zinc-950 font-black shadow-sm'
                                      : standing.rank === 2
                                      ? 'bg-zinc-200 text-zinc-800'
                                      : standing.rank === 3
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-zinc-100 text-zinc-600'
                                  }`}>
                                    #{standing.rank}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-zinc-950 text-xs sm:text-sm">
                                        {standing.displayName}
                                      </span>
                                      {standing.rank === 1 && (
                                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-900 border border-amber-300">
                                          Winner
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-zinc-400 text-[10px] font-mono">
                                      {standing.email ? standing.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Audience Backer'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-6 font-mono">
                                  <span className="w-20 text-right font-black text-xs sm:text-sm text-zinc-950">
                                    {formatPoints(standing.amount)}
                                  </span>
                                  <div className="w-28 text-right">
                                    <span className="font-bold text-xs sm:text-sm text-zinc-950 block">
                                      {formatExactMs(standing.timeElapsedMs)}
                                    </span>
                                    <span className="text-[9px] text-zinc-400 font-sans block">
                                      {(standing.timeElapsedMs / 1000).toFixed(3)}s
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 rounded-2xl border border-zinc-200 bg-zinc-50/50 text-center space-y-2">
                        <Clock size={24} className="text-zinc-400 mx-auto animate-pulse" />
                        <h3 className="font-bold text-zinc-900 text-sm">Awaiting Audience Backers</h3>
                        <p className="text-zinc-500 text-xs max-w-sm mx-auto">
                          Once audience members invest points into {activeSelectedTeam.name}, the fastest and highest backer will be crowned live here with millisecond precision.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Navigation Toolbar (Hidden in Fullscreen) */}
              {!isFullscreen && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => {
                      const list = pitchOrderedTeams.length > 0 ? pitchOrderedTeams : teams
                      const currentIndex = list.findIndex(t => t.id === activeSelectedTeam.id)
                      const prevIndex = (currentIndex - 1 + list.length) % list.length
                      const prevTeam = list[prevIndex]
                      if (prevTeam) {
                        setSelectedTeamId(prevTeam.id)
                        setSearchParams({ teamId: prevTeam.id })
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 transition-colors shadow-sm"
                  >
                    <ChevronLeft size={14} /> Previous Startup
                  </button>

                  <button
                    onClick={() => {
                      setSelectedTeamId(null)
                      setSearchParams({})
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm transition-colors"
                  >
                    Return to Common Arena Board
                  </button>

                  <button
                    onClick={() => {
                      const list = pitchOrderedTeams.length > 0 ? pitchOrderedTeams : teams
                      const currentIndex = list.findIndex(t => t.id === activeSelectedTeam.id)
                      const nextIndex = (currentIndex + 1) % list.length
                      const nextTeam = list[nextIndex]
                      if (nextTeam) {
                        setSelectedTeamId(nextTeam.id)
                        setSearchParams({ teamId: nextTeam.id })
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 transition-colors shadow-sm"
                  >
                    Next Startup <ChevronRight size={14} />
                  </button>
                </div>
              )}
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
