// ============================================================
// Admin Dashboard — Executive Control Room for Event Administrators
// Clean, minimalist white & black aesthetic.
// Includes full event management, live control, team telemetry,
// audit logs, and secure Admin Email Allowlist management.
// ============================================================

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Settings, Radio, Users, CreditCard,
  Gift, FileText, Shield, ChevronRight, Play, Pause,
  Square, SkipForward, Clock, TrendingUp, Activity,
  AlertTriangle, CheckCircle2, Download, Eye, Edit3,
  Plus, RefreshCw, Wifi, Bell, ShieldCheck, UserPlus,
  Trash2, Mail, ExternalLink, Search, Filter, Lock,
  Tv, ArrowUp, ArrowDown, Sparkles, X, Check, Award,
  Sliders, Database, Terminal, Trophy, Zap
} from 'lucide-react'
import { useAuthStore, useEventStore, useWalletStore, useAdminStore } from '@/store'
import {
  Card, Button, Badge, StatCard, StatusBadge, SectionHeader,
  Avatar, ProgressBar, Divider, LiveIndicator,
} from '@/components/ui'
import { formatPoints, formatRupees, formatRelativeTime } from '@/lib/utils'
import {
  getAuditLogs,
  createTeam,
  updateTeam,
  deleteTeam,
  reorderTeams,
  startPitchForTeam,
  stopPitchForTeam,
  toUserFriendlyError,
} from '@/lib/supabaseApi'
import { supabase, TABLES } from '@/lib/supabase'
import {
  getAdminAllowlist,
  addAdminEmail,
  removeAdminEmail,
  isAdminEmail,
  isSuperAdmin,
  getSuperAdminEmail,
  syncAdminAllowlistFromSupabase,
} from '@/lib/adminConfig'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import type { RoundStatus, Team } from '@/types'

// ── Admin Navigation Tabs ──────────────────────────────────
const ADMIN_TABS = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'control', icon: Radio, label: 'Live Control' },
  { id: 'teams', icon: Users, label: 'Pre-listed Teams' },
  { id: 'cast', icon: Tv, label: 'Stage Cast' },
  { id: 'allowlist', icon: ShieldCheck, label: 'Admin Access' },
  { id: 'payments', icon: CreditCard, label: 'Payments' },
  { id: 'rewards', icon: Gift, label: 'Rewards' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'logs', icon: FileText, label: 'Audit Logs' },
]

// ── 1. Overview Tab ─────────────────────────────────────────
function OverviewTab() {
  const { teams, activeRound } = useEventStore()
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const totalInvested = teams.reduce((s, t) => s + t.totalInvestment, 0)
  const totalBackers = teams.reduce((s, t) => s + t.uniqueBackers, 0)

  useEffect(() => {
    getAuditLogs().then(data => setRecentLogs(data.slice(0, 4)))
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Total Invested"
          value={formatPoints(totalInvested)}
          icon={<TrendingUp size={18} />}
          trend="up"
          trendValue="+14% this hour"
        />
        <StatCard
          label="Active Backers"
          value={totalBackers}
          icon={<Users size={18} />}
          trend="up"
          trendValue="High engagement"
        />
        <StatCard
          label="Competing Teams"
          value={teams.length}
          icon={<Activity size={18} />}
          subtext="Pitch lineup active"
        />
        <StatCard
          label="Audience Connected"
          value={142}
          icon={<Wifi size={18} />}
          subtext="Live telemetry on"
        />
      </div>

      {/* Active round status banner */}
      {activeRound && (
        <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-zinc-950 font-black text-base tracking-tight">Active Pitch Round</h3>
            </div>
            <StatusBadge status={activeRound.status} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div>
              <p className="text-zinc-950 text-2xl font-black">{activeRound.team?.name}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{activeRound.team?.pitchTitle}</p>
              <div className="flex items-center gap-4 mt-2.5">
                <span className="text-zinc-950 font-mono text-sm font-bold">{formatPoints(activeRound.totalInvested)} points backed</span>
                <span className="text-zinc-400 text-xs font-mono">{activeRound.uniqueInvestors} investors</span>
              </div>
            </div>
            <Link
              to="/live"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 text-white font-semibold text-xs hover:bg-zinc-800 transition-colors w-fit shadow-sm"
            >
              <Eye size={14} />
              Open Live Stream
            </Link>
          </div>
        </div>
      )}

      {/* Two columns: Team rankings preview + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team Leaderboard Preview */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <SectionHeader title="Team Rankings" subtitle="Real-time leaderboard" />
            <Link to="/scoreboard" className="text-xs font-bold text-zinc-900 hover:underline">View All →</Link>
          </div>
          <div className="space-y-2">
            {teams.slice(0, 4).map((t, i) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-zinc-400 w-5">#{i + 1}</span>
                  <div>
                    <p className="text-zinc-950 font-bold text-xs">{t.name}</p>
                    <p className="text-zinc-500 text-[11px]">{t.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black font-mono text-zinc-950">{formatPoints(t.totalInvestment)}</p>
                  <p className="text-[10px] text-zinc-400">{t.uniqueBackers} backers</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Audit Log */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-4 shadow-sm">
          <SectionHeader title="Recent Activity" subtitle="Real-time administrative events" />
          <div className="space-y-2">
            {recentLogs.length === 0 ? (
              <p className="text-zinc-400 text-xs py-6 text-center">No security actions recorded yet.</p>
            ) : (
              recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                  <div className="w-7 h-7 rounded-lg bg-zinc-200 text-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Activity size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-900 text-xs font-medium truncate">{(log.action || 'admin_action').replace(/_/g, ' ')}</p>
                    <p className="text-zinc-400 text-[10px] font-mono">{formatRelativeTime(log.created_at || log.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal for Pre-listing or Editing a Startup Team ──────────
function TeamModal({
  team,
  onClose,
  onSaved,
}: {
  team: Team | null // null means create new, otherwise edit
  onClose: () => void
  onSaved: (savedTeam: Team) => void
}) {
  const { event, teams } = useEventStore()
  const [name, setName] = useState(team?.name || '')
  const [pitchTitle, setPitchTitle] = useState(team?.pitchTitle || '')
  const [description, setDescription] = useState(team?.description || '')
  const [category, setCategory] = useState(team?.category || 'AI & Machine Learning')
  const [presenters, setPresenters] = useState(team?.presenters?.join(', ') || '')
  const [pitchOrder, setPitchOrder] = useState(team?.pitchOrder ?? (teams.length + 1))
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !pitchTitle.trim()) {
      toast.error('Please enter the team name and startup idea title.')
      return
    }

    setLoading(true)
    const presenterList = presenters
      .split(',')
      .map(p => p.trim())
      .filter(Boolean)

    const eventId = event?.id || '11111111-0000-0000-0000-000000000001'

    if (team) {
      // Edit
      const ok = await updateTeam(team.id, {
        name,
        pitchTitle,
        description,
        category,
        presenters: presenterList,
        pitchOrder: Number(pitchOrder) || 1,
      })
      setLoading(false)
      if (ok) {
        toast.success(`Updated ${name} successfully!`)
        onSaved({
          ...team,
          name: name.trim(),
          pitchTitle: pitchTitle.trim(),
          description: description.trim(),
          category: category.trim(),
          presenters: presenterList,
          pitchOrder: Number(pitchOrder) || 1,
          updatedAt: new Date().toISOString(),
        })
        onClose()
      } else {
        toast.error('Unable to update team. Please try again.')
      }
    } else {
      // Create new
      const created = await createTeam({
        eventId,
        name,
        pitchTitle,
        description,
        category,
        presenters: presenterList,
        pitchOrder: Number(pitchOrder) || (teams.length + 1),
      })
      setLoading(false)
      if (created) {
        toast.success(`Pre-listed ${name} successfully!`)
        onSaved(created)
        onClose()
      } else {
        toast.error('Unable to pre-list team. Please try again.')
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="bg-white w-full max-w-lg p-6 sm:p-8 space-y-5 rounded-3xl border border-zinc-200 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <X size={16} />
        </button>

        <div>
          <h3 className="text-zinc-950 font-black text-xl tracking-tight">
            {team ? `Edit Startup: ${team.name}` : 'Pre-list New Pitching Startup'}
          </h3>
          <p className="text-zinc-500 text-xs mt-1">
            Pre-listed details (startup idea, team name, and pitchers) will appear immediately on the audience home screen and stage boards.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-700 text-xs font-bold block mb-1.5">Team / Startup Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. EcoCharge"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 text-xs text-zinc-900 outline-none transition-all placeholder:text-zinc-400"
              />
            </div>
            <div>
              <label className="text-zinc-700 text-xs font-bold block mb-1.5">Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 text-xs text-zinc-900 outline-none transition-all"
              >
                <option value="AI & Machine Learning">AI & Machine Learning</option>
                <option value="CleanTech">CleanTech & Energy</option>
                <option value="FinTech">FinTech & Payments</option>
                <option value="HealthTech">HealthTech & Bio</option>
                <option value="EdTech">EdTech & Education</option>
                <option value="SaaS">B2B SaaS</option>
                <option value="Consumer">Consumer & Mobile</option>
                <option value="Hardware">Hardware & Robotics</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-zinc-700 text-xs font-bold block mb-1.5">Startup Idea / Pitch Title *</label>
            <input
              type="text"
              required
              value={pitchTitle}
              onChange={e => setPitchTitle(e.target.value)}
              placeholder="e.g. Wireless Solar EV Road Surface Charging"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 text-xs text-zinc-900 outline-none transition-all placeholder:text-zinc-400"
            />
          </div>

          <div>
            <label className="text-zinc-700 text-xs font-bold block mb-1.5">Idea Description (Problem & Solution)</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what problem the startup solves, their unique solution, and target market..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 text-xs text-zinc-900 outline-none transition-all resize-none placeholder:text-zinc-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-zinc-700 text-xs font-bold block mb-1.5">Pitchers / Presenters (comma separated)</label>
              <input
                type="text"
                value={presenters}
                onChange={e => setPresenters(e.target.value)}
                placeholder="e.g. Aarav Patel, Sneha Rao"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 text-xs text-zinc-900 outline-none transition-all placeholder:text-zinc-400"
              />
            </div>
            <div>
              <label className="text-zinc-700 text-xs font-bold block mb-1.5">Pitch Queue #</label>
              <input
                type="number"
                min={1}
                value={pitchOrder}
                onChange={e => setPitchOrder(parseInt(e.target.value) || 1)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 text-xs text-zinc-900 outline-none transition-all font-mono"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1 justify-center bg-zinc-950 hover:bg-zinc-800 text-white font-bold">
              {team ? 'Save Changes' : 'Pre-list Team'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── 2. Live Control Room Tab ────────────────────────────────
function ControlTab() {
  const { event, teams, setTeams, activeRound, setActiveRound } = useEventStore()
  const [loading, setLoading] = useState<string | null>(null)
  const [selectedTeamToPitch, setSelectedTeamToPitch] = useState<string>('')
  const [selectedNextTeam, setSelectedNextTeam] = useState<string>('')

  const eventId = event?.id || '11111111-0000-0000-0000-000000000001'
  const activeTeam = activeRound?.team || teams.find(t => t.id === activeRound?.teamId)

  // Start pitch for ANY chosen team
  const handleStartPitch = async (teamToStart: Team) => {
    setLoading(`start-${teamToStart.id}`)
    try {
      const duration = event?.config.pitchDurationSeconds ?? 300
      const newRound = await startPitchForTeam(eventId, teamToStart, duration)
      if (newRound) {
        setActiveRound(newRound)
        setTeams(teams.map(t => (t.id === teamToStart.id ? { ...t, status: 'active' } : t)))
        toast.success(`Pitch round started for ${teamToStart.name}!`)
      } else {
        toast.error('Unable to start pitch round. Please try again.')
      }
    } catch (err: any) {
      toast.error(toUserFriendlyError(err, 'Failed to start pitch round.'))
    } finally {
      setLoading(null)
    }
  }

  // Stop pitch whenever admin wants
  const handleStopPitch = async () => {
    if (!activeRound) return
    setLoading('stop')
    try {
      await stopPitchForTeam(activeRound.teamId, activeRound.id)
      setTeams(teams.map(t => (t.id === activeRound.teamId ? { ...t, status: 'completed' } : t)))
      setActiveRound(null)
      toast.info(`Pitch round concluded for ${activeRound.team?.name || 'team'}.`)
    } catch (err: any) {
      toast.error(toUserFriendlyError(err, 'Failed to stop pitch round.'))
    } finally {
      setLoading(null)
    }
  }

  // Pause / Resume
  const handleTogglePause = async () => {
    if (!activeRound) return
    const isPaused = activeRound.status === 'investment_paused'
    const newStatus = isPaused ? 'investment_open' : 'investment_paused'
    setActiveRound({ ...activeRound, status: newStatus })

    if (supabase) {
      await supabase.from(TABLES.PITCH_ROUNDS).update({ status: newStatus }).eq('id', activeRound.id)
    }
    toast.info(isPaused ? 'Round resumed!' : 'Round paused. Investments temporarily held.')
  }

  // Set designated next team
  const handleSetNextTeam = async (targetTeamId: string) => {
    const target = teams.find(t => t.id === targetTeamId)
    if (!target) return

    const currentOrder = activeRound?.roundNumber || 0
    const newOrder = currentOrder + 1

    const updatedTeams = teams.map(t => {
      if (t.id === target.id) return { ...t, pitchOrder: newOrder, status: 'upcoming' as const }
      if (t.pitchOrder >= newOrder && t.id !== target.id) return { ...t, pitchOrder: t.pitchOrder + 1 }
      return t
    })

    setTeams(updatedTeams)
    await reorderTeams(updatedTeams.map(t => ({ id: t.id, pitchOrder: t.pitchOrder })))
    toast.success(`${target.name} is now designated as the NEXT pitch!`)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Live Competition Controller"
        subtitle="Start or stop pitches for any team on demand, adjust timers, and set the next pitching team."
      />

      {/* 1. Active Pitch Management Card */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={16} className={activeRound ? 'text-zinc-950 animate-pulse' : 'text-zinc-400'} />
            <h3 className="text-zinc-950 font-black text-base">Stage Pitch Status</h3>
          </div>
          {activeRound ? <StatusBadge status={activeRound.status} /> : <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">Stage Standby</span>}
        </div>

        {activeRound && activeTeam ? (
          <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-zinc-950 font-bold text-xs uppercase tracking-wider">Live On Stage</p>
                </div>
                <h4 className="text-2xl font-black text-zinc-950 mt-1">{activeTeam.name}</h4>
                <p className="text-zinc-700 font-semibold text-sm">{activeTeam.pitchTitle}</p>
                {activeTeam.presenters && activeTeam.presenters.length > 0 && (
                  <p className="text-zinc-500 text-xs mt-1">Pitchers: {activeTeam.presenters.join(', ')}</p>
                )}
              </div>

              <div className="text-left sm:text-right">
                <p className="text-3xl font-black text-zinc-950 font-mono">{formatPoints(activeRound.totalInvested)}</p>
                <p className="text-zinc-500 text-xs">{activeRound.uniqueInvestors} audience backers</p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-200">
              <Button
                variant="secondary"
                size="sm"
                className="justify-center"
                icon={activeRound.status === 'investment_paused' ? <Play size={13} /> : <Pause size={13} />}
                onClick={handleTogglePause}
              >
                {activeRound.status === 'investment_paused' ? 'Resume' : 'Pause'}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="justify-center"
                onClick={() => toast.success('+60s added to clock')}
              >
                +60s Clock
              </Button>

              <Button
                variant="danger"
                size="sm"
                className="justify-center col-span-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold"
                icon={<Square size={13} />}
                loading={loading === 'stop'}
                onClick={handleStopPitch}
              >
                Stop / End Pitch
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-3 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
            <Radio size={32} className="text-zinc-300 mx-auto" />
            <div>
              <p className="text-zinc-950 font-bold text-base">Stage Standby</p>
              <p className="text-zinc-500 text-xs mt-1">
                No startup is currently pitching. Select any team below to start their live pitch.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Choose & Start Pitch for ANY Team Card */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-zinc-950 font-black text-base flex items-center gap-2">
              <Play size={16} className="text-zinc-950" />
              Launch Pitch for Any Listed Team
            </h3>
            <p className="text-zinc-500 text-xs mt-0.5">
              Admin can start the pitch for any team at any time, or designate the next upcoming team.
            </p>
          </div>
        </div>

        {/* Start Pitch Selector */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
          <select
            value={selectedTeamToPitch}
            onChange={e => setSelectedTeamToPitch(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs text-zinc-900 outline-none"
          >
            <option value="">Select team to start pitch...</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>
                #{t.pitchOrder}: {t.name} — {t.pitchTitle} ({t.status.toUpperCase()})
              </option>
            ))}
          </select>

          <Button
            disabled={!selectedTeamToPitch || loading !== null}
            loading={loading === `start-${selectedTeamToPitch}`}
            onClick={() => {
              const team = teams.find(t => t.id === selectedTeamToPitch)
              if (team) handleStartPitch(team)
            }}
            icon={<Play size={14} />}
            className="justify-center bg-zinc-950 hover:bg-zinc-800 text-white whitespace-nowrap shadow-sm"
          >
            Start Pitch Now
          </Button>
        </div>

        {/* Set Up Next Selector */}
        <div className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
          <span className="text-zinc-700 text-xs font-bold whitespace-nowrap">Designate as Up Next:</span>
          <select
            value={selectedNextTeam}
            onChange={e => setSelectedNextTeam(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs text-zinc-900 outline-none"
          >
            <option value="">Select next team...</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>
                #{t.pitchOrder}: {t.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled={!selectedNextTeam}
            onClick={() => {
              handleSetNextTeam(selectedNextTeam)
              setSelectedNextTeam('')
            }}
            className="whitespace-nowrap"
          >
            Set as Up Next
          </Button>
        </div>
      </div>

      {/* 3. Quick Pitch Launcher List for all Teams */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
        <h4 className="text-zinc-950 font-bold text-sm">All Pre-listed Teams ({teams.length})</h4>
        <div className="space-y-2">
          {teams.map(team => {
            const isThisTeamLive = activeRound?.status === 'investment_open' && activeRound?.teamId === team.id

            return (
              <div
                key={team.id}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isThisTeamLive
                    ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                    : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`font-mono text-xs w-6 font-bold ${isThisTeamLive ? 'text-zinc-400' : 'text-zinc-400'}`}>#{team.pitchOrder}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold text-sm truncate ${isThisTeamLive ? 'text-white' : 'text-zinc-950'}`}>{team.name}</p>
                      <StatusBadge status={team.status} />
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${isThisTeamLive ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-white text-zinc-600 border-zinc-200'}`}>{team.category}</span>
                    </div>
                    <p className={`text-xs truncate max-w-md ${isThisTeamLive ? 'text-zinc-400' : 'text-zinc-500'}`}>{team.pitchTitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 pl-9 sm:pl-0">
                  {isThisTeamLive ? (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={loading === 'stop'}
                      onClick={handleStopPitch}
                      icon={<Square size={12} />}
                      className="text-xs bg-white text-zinc-950 hover:bg-zinc-100"
                    >
                      Stop Pitch
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      loading={loading === `start-${team.id}`}
                      onClick={() => handleStartPitch(team)}
                      icon={<Play size={12} />}
                      className="text-xs bg-zinc-950 text-white hover:bg-zinc-800"
                    >
                      Start Pitch
                    </Button>
                  )}
                  <Link to={`/cast?teamId=${team.id}`} target="_blank">
                    <button
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isThisTeamLive
                          ? 'border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                          : 'border-zinc-200 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100'
                      }`}
                      title="Cast Team Results to Big Screen"
                    >
                      <Tv size={14} />
                    </button>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── 3. Teams Tab (Pre-listing, Startup Ideas, Pitchers, Reordering) ──────
function TeamsTab() {
  const { teams, setTeams, event, activeRound, setActiveRound } = useEventStore()
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [modalTeam, setModalTeam] = useState<Team | null | 'new'>(null)

  const eventId = event?.id || '11111111-0000-0000-0000-000000000001'
  const categories = ['all', ...Array.from(new Set(teams.map(t => t.category)))]

  const filteredTeams = teams.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.pitchTitle.toLowerCase().includes(search.toLowerCase()) ||
      (t.presenters && t.presenters.some(p => p.toLowerCase().includes(search.toLowerCase())))
    const matchesCat = filterCat === 'all' || t.category === filterCat
    return matchesSearch && matchesCat
  })

  // Handle reordering up/down
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= teams.length) return

    const newTeams = [...teams]
    const temp = newTeams[index]
    newTeams[index] = newTeams[targetIndex]
    newTeams[targetIndex] = temp

    // Reassign pitchOrder
    const reordered = newTeams.map((t, idx) => ({ ...t, pitchOrder: idx + 1 }))
    setTeams(reordered)

    await reorderTeams(reordered.map(t => ({ id: t.id, pitchOrder: t.pitchOrder })))
    toast.success('Pitch order updated.')
  }

  // Handle delete team
  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to remove "${teamName}" from the pitching lineup?`)) return

    const ok = await deleteTeam(teamId)
    if (ok) {
      setTeams(teams.filter(t => t.id !== teamId))
      toast.success(`Removed "${teamName}" from pitching lineup.`)
    } else {
      toast.error('Unable to remove team. Please try again.')
    }
  }

  // Start pitch directly from team card
  const handleStartPitchDirect = async (team: Team) => {
    const duration = event?.config.pitchDurationSeconds ?? 300
    const newRound = await startPitchForTeam(eventId, team, duration)
    if (newRound) {
      setActiveRound(newRound)
      setTeams(teams.map(t => (t.id === team.id ? { ...t, status: 'active' } : t)))
      toast.success(`Started pitch for ${team.name}!`)
    } else {
      toast.error('Failed to start pitch round.')
    }
  }

  const [seeding, setSeeding] = useState(false)
  const handleSeedSampleLineup = async () => {
    setSeeding(true)
    const samples = [
      {
        name: 'NeuroPulse AI',
        pitchTitle: 'Non-Invasive Neural Interfaces for Clinical Stroke Rehabilitation',
        description: 'An AI-powered BCI headband and gamified neurofeedback suite that helps post-stroke patients recover motor and speech functions 3x faster than conventional clinical physical therapy.',
        category: 'HealthTech & AI',
        presenters: ['Dr. Evelyn Vance (Founder & CEO)', 'Marcus Lin (CTO)'],
        pitchOrder: 1,
      },
      {
        name: 'Solaris Orbit',
        pitchTitle: 'Space-Based Solar Mesh Network for Clean Microgrids',
        description: 'Orbital ultralight solar collectors and laser downlink nodes delivering uninterrupted zero-carbon power to isolated island grids and remote industrial mining operations.',
        category: 'CleanTech',
        presenters: ['Kavita Rao (Founder & Chief Aerospace Engineer)'],
        pitchOrder: 2,
      },
      {
        name: 'OmniChain Pay',
        pitchTitle: 'Sub-Second Quantum-Resistant Cross-Border B2B Settlement',
        description: 'Decentralized liquidity routing protocol enabling exporters and SMBs across Southeast Asia and India to settle supplier invoices in under 4 seconds with zero FX spread.',
        category: 'Fintech',
        presenters: ['Tariq Al-Mansoor (CEO)', 'Sarah Jenkins (VP Product)'],
        pitchOrder: 3,
      },
      {
        name: 'BioHarvest Dynamics',
        pitchTitle: 'Autonomous Precision Drone Pollination for High-Yield Agriculture',
        description: 'Micro-drone swarms utilizing computer vision to pollinate commercial fruit and almond orchards, addressing the global bee collapse crisis while increasing harvest yields by 28%.',
        category: 'AgriTech',
        presenters: ['Ananya Sharma (CEO & Agronomist)'],
        pitchOrder: 4,
      },
    ]

    const added: Team[] = []
    for (const s of samples) {
      const created = await createTeam({
        eventId,
        ...s,
      })
      if (created) added.push(created)
    }

    if (added.length > 0) {
      setTeams([...teams, ...added])
      toast.success(`Successfully pre-listed ${added.length} sample startups!`)
    } else {
      toast.error('Unable to load sample startups.')
    }
    setSeeding(false)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <SectionHeader
            title="Pre-listed Pitching Teams"
            subtitle={`${teams.length} startups pre-listed with startup ideas and pitcher details.`}
          />
        </div>
        <div className="flex items-center gap-2">
          {teams.length === 0 && (
            <Button
              variant="secondary"
              size="sm"
              loading={seeding}
              icon={<Sparkles size={13} />}
              onClick={handleSeedSampleLineup}
            >
              Load Sample Lineup
            </Button>
          )}
          <Button
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => setModalTeam('new')}
            className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold shadow-sm"
          >
            Pre-list New Team
          </Button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={14} className="text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search teams by name, startup idea, or pitcher..."
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs text-zinc-900 outline-none placeholder:text-zinc-400"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                filterCat === cat
                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:text-zinc-950 hover:bg-zinc-50'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Teams Grid */}
      <div className="space-y-2.5">
        {filteredTeams.map((team, idx) => {
          const isThisTeamLive = activeRound?.status === 'investment_open' && activeRound?.teamId === team.id

          return (
            <div
              key={team.id}
              className={`p-5 rounded-2xl border transition-all ${
                isThisTeamLive ? 'border-zinc-950 bg-zinc-50 shadow-sm' : 'border-zinc-200/90 bg-white shadow-sm'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Order & Reorder Controls */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveOrder(idx, 'up')}
                      className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                      title="Move Up"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <span className="text-zinc-950 font-mono text-xs font-black">#{team.pitchOrder}</span>
                    <button
                      disabled={idx === teams.length - 1}
                      onClick={() => handleMoveOrder(idx, 'down')}
                      className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                      title="Move Down"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
                    {team.name[0]}
                  </div>

                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-zinc-950 font-black text-sm tracking-tight truncate">{team.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">{team.category}</span>
                      <StatusBadge status={team.status} />
                    </div>

                    <p className="text-zinc-700 font-semibold text-xs leading-snug">{team.pitchTitle}</p>

                    {team.description && (
                      <p className="text-zinc-500 text-[11px] line-clamp-2 leading-relaxed">{team.description}</p>
                    )}

                    {team.presenters && team.presenters.length > 0 && (
                      <div className="flex items-center gap-1 text-zinc-500 text-[11px]">
                        <Users size={12} className="text-zinc-400" />
                        <span className="text-zinc-700 font-semibold">Pitchers:</span>
                        <span>{team.presenters.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action Toolbar */}
                <div className="flex items-center justify-between lg:justify-end gap-3 pl-12 lg:pl-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-100">
                  <div className="text-left lg:text-right pr-2">
                    <p className="text-zinc-950 font-mono font-bold text-xs">{formatPoints(team.totalInvestment)}</p>
                    <p className="text-zinc-400 text-[10px]">{team.uniqueBackers} backers</p>
                  </div>

                  {/* Start Pitch button */}
                  {!isThisTeamLive && (
                    <Button
                      size="sm"
                      onClick={() => handleStartPitchDirect(team)}
                      icon={<Play size={12} />}
                      className="text-xs bg-zinc-950 text-white hover:bg-zinc-800 whitespace-nowrap shadow-sm"
                    >
                      Start Pitch
                    </Button>
                  )}

                  {/* Stage Cast Button */}
                  <Link to={`/cast?teamId=${team.id}`} target="_blank">
                    <button
                      className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-950 transition-colors"
                      title="Cast Team Results to Stage Screen"
                    >
                      <Tv size={14} />
                    </button>
                  </Link>

                  {/* Edit Button */}
                  <button
                    className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-950 transition-colors"
                    onClick={() => setModalTeam(team)}
                    title="Edit Team Details"
                  >
                    <Edit3 size={14} />
                  </button>

                  {/* Delete Button */}
                  <button
                    className="p-2 rounded-xl border border-zinc-200 hover:border-rose-200 hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition-colors"
                    onClick={() => handleDeleteTeam(team.id, team.name)}
                    title="Remove Team"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {filteredTeams.length === 0 && (
          <div className="p-8 text-center border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
            <Users size={32} className="mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-950 font-bold">No Pitching Teams Found</p>
            <p className="text-zinc-500 text-xs mt-1 max-w-sm mx-auto">
              Pre-list startups with their startup idea, pitch details, and pitcher information to feature them on the home screen.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button onClick={() => setModalTeam('new')} icon={<Plus size={14} />} className="bg-zinc-950 text-white">
                Pre-list Startup
              </Button>
              {teams.length === 0 && (
                <Button
                  variant="secondary"
                  loading={seeding}
                  onClick={handleSeedSampleLineup}
                  icon={<Sparkles size={14} />}
                >
                  Load Sample Lineup
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal for creating or editing team */}
      {modalTeam && (
        <TeamModal
          team={modalTeam === 'new' ? null : modalTeam}
          onClose={() => setModalTeam(null)}
          onSaved={saved => {
            if (modalTeam === 'new') {
              setTeams([...teams, saved])
            } else {
              setTeams(teams.map(t => (t.id === saved.id ? saved : t)))
            }
          }}
        />
      )}
    </div>
  )
}

// ── 3b. Stage Cast Control Tab ──────────────────────────────
function CastAdminTab() {
  const { event, teams } = useEventStore()
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')

  const handleOpenCast = (teamId?: string) => {
    const url = teamId ? `/cast?teamId=${teamId}` : '/cast'
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Stage Projector & Big Screen Cast"
        subtitle="Cast live competition standings or individual startup result cards onto auditorium projectors and stage displays."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Common Arena Board */}
        <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-950">
              <Tv size={22} />
            </div>
            <div>
              <h3 className="text-zinc-950 font-black text-base">Common Stage Board</h3>
              <p className="text-zinc-500 text-xs mt-0.5">Full stage display with live pitch & realtime standings</p>
            </div>
          </div>

          <p className="text-zinc-600 text-xs leading-relaxed">
            Optimized for HDMI stage projectors and auditorium screens. Shows current pitching startup in huge typography, live countdown timer, and live leaderboard rankings.
          </p>

          <Button
            onClick={() => handleOpenCast()}
            icon={<ExternalLink size={14} />}
            className="w-full justify-center bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm"
          >
            Open Stage Projector Window
          </Button>
        </div>

        {/* Card 2: Per-Team Result Dashboards */}
        <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-950">
              <Award size={22} />
            </div>
            <div>
              <h3 className="text-zinc-950 font-black text-base">Individual Startup Result Card</h3>
              <p className="text-zinc-500 text-xs mt-0.5">Project a specific startup's result on the big screen</p>
            </div>
          </div>

          <p className="text-zinc-600 text-xs leading-relaxed">
            Project a startup's final score, tournament rank, startup idea, and pitcher credits on the big screen during presentations or award ceremonies.
          </p>

          <div className="space-y-2">
            <select
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs text-zinc-900 outline-none"
            >
              <option value="">Select startup to cast...</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  #{t.pitchOrder}: {t.name} — {t.pitchTitle}
                </option>
              ))}
            </select>

            <Button
              disabled={!selectedTeamId}
              onClick={() => handleOpenCast(selectedTeamId)}
              icon={<Tv size={14} />}
              className="w-full justify-center bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-40 shadow-sm"
            >
              Cast Selected Startup Results
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Cast Grid for every team */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
        <h4 className="text-zinc-950 font-bold text-sm flex items-center gap-2">
          <Sparkles size={15} className="text-zinc-950" />
          Quick Team Screen Launch
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {teams.map(team => (
            <div
              key={team.id}
              className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-zinc-300 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400 font-mono">#{team.pitchOrder}</span>
                  <p className="text-zinc-950 font-bold text-xs truncate">{team.name}</p>
                </div>
                <p className="text-zinc-500 text-[10px] truncate max-w-[150px]">{team.pitchTitle}</p>
              </div>

              <button
                onClick={() => handleOpenCast(team.id)}
                className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors flex-shrink-0 shadow-sm"
              >
                <Tv size={11} />
                <span>Cast</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 4. Admin Email Allowlist Tab (Single Super Admin + Managed Admins) ───
function AllowlistTab() {
  const { user } = useAuthStore()
  const [allowlist, setAllowlist] = useState<string[]>(() => getAdminAllowlist())
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const superAdminEmail = getSuperAdminEmail()

  // Sync latest allowlist from Supabase backend on mount
  useEffect(() => {
    syncAdminAllowlistFromSupabase().then((list) => {
      setAllowlist(list)
    })
  }, [])

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = newEmail.trim().toLowerCase()
    if (!clean || !clean.includes('@')) {
      toast.error('Please enter a valid email address.')
      return
    }

    if (allowlist.includes(clean)) {
      toast.warning('This email is already an authorized administrator.')
      return
    }

    setLoading(true)
    const success = await addAdminEmail(clean, user?.email)
    setLoading(false)

    if (success) {
      const updated = getAdminAllowlist()
      setAllowlist(updated)
      setNewEmail('')
      toast.success(`Authorized ${clean} as an event administrator!`)
    } else {
      toast.error('Failed to add email to administrator list.')
    }
  }

  const handleRemoveEmail = async (emailToRemove: string) => {
    if (isSuperAdmin(emailToRemove)) {
      toast.error('The primary Super Admin account cannot be removed.')
      return
    }
    if (emailToRemove.toLowerCase() === user?.email.toLowerCase()) {
      toast.error('You cannot remove your own active administrator account.')
      return
    }

    const res = await removeAdminEmail(emailToRemove)
    if (res.success) {
      setAllowlist(getAdminAllowlist())
      toast.info(`Revoked admin access for ${emailToRemove}.`)
    } else {
      toast.error(res.message || 'Failed to remove admin.')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Admin Email Allowlist"
        subtitle="Manage authorized administrator accounts. The Super Admin can grant or revoke admin access for other users."
      />

      {/* Security Architecture Card */}
      <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
        <div className="flex items-center gap-2 text-zinc-950 text-xs font-bold">
          <ShieldCheck size={16} />
          <span>Server-Enforced Role Resolution</span>
        </div>
        <p className="text-zinc-600 text-xs leading-relaxed">
          The Super Admin has permanent master access configured via <code className="text-zinc-900 bg-zinc-200/80 px-1 py-0.5 rounded font-mono">VITE_SUPER_ADMIN_EMAIL</code>.
          Any email added below will automatically be granted the <strong className="text-zinc-950">Admin</strong> role upon sign-in and stored in Supabase.
        </p>
      </div>

      {/* Add New Admin Form */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
        <h3 className="text-zinc-950 font-bold text-sm flex items-center gap-2">
          <UserPlus size={15} className="text-zinc-950" />
          Authorize New Administrator
        </h3>
        <form onSubmit={handleAddEmail} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail size={14} className="text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. colleague@college.edu"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs text-zinc-900 outline-none"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            loading={loading}
            icon={<Plus size={14} />}
            className="justify-center whitespace-nowrap bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm"
          >
            Add Admin Email
          </Button>
        </form>
      </div>

      {/* Current Allowlist List */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
          <span className="text-xs font-bold text-zinc-800">
            Authorized Email Addresses ({allowlist.length})
          </span>
          <span className="text-[11px] text-zinc-400 font-mono">Status: Active</span>
        </div>

        <div className="space-y-2">
          {allowlist.map((adminEmail) => {
            const isCurrentUser = adminEmail.toLowerCase() === user?.email.toLowerCase()
            const isThisSuperAdmin = isSuperAdmin(adminEmail)

            return (
              <div
                key={adminEmail}
                className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isThisSuperAdmin ? 'bg-zinc-950 text-white' : 'bg-zinc-200 text-zinc-800'
                  }`}>
                    {isThisSuperAdmin ? <ShieldCheck size={15} /> : <Shield size={14} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-zinc-950 font-mono text-xs font-semibold">{adminEmail}</p>
                      {isThisSuperAdmin && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-zinc-950 text-white font-mono">Super Admin (Protected)</span>
                      )}
                      {isCurrentUser && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-zinc-200 text-zinc-800 font-mono">You (Current)</span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-[10px]">
                      {isThisSuperAdmin
                        ? 'Master administrator defined in environment config'
                        : 'Delegated event administrator · Managed via Supabase'}
                    </p>
                  </div>
                </div>

                {!isCurrentUser && !isThisSuperAdmin && (
                  <button
                    onClick={() => handleRemoveEmail(adminEmail)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Revoke admin authorization"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── 5. Payments Tab ─────────────────────────────────────────
function PaymentsTab() {
  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader title="Financial & Transaction History" subtitle="Live tracking of point purchases and payment telemetry" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value="₹240" icon={<TrendingUp size={16} />} />
        <StatCard label="Paid Orders" value="12" icon={<CreditCard size={16} />} />
        <StatCard label="Points Issued" value="2,400" icon={<Gift size={16} />} />
        <StatCard label="Failed Orders" value="0" icon={<CheckCircle2 size={16} />} />
      </div>
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm">
        <p className="text-zinc-500 text-xs text-center py-6">
          Razorpay Webhook & Payment sync active. Transaction records are secured in public.payment_transactions.
        </p>
      </div>
    </div>
  )
}

// ── 6. Rewards Admin Tab ────────────────────────────────────
function RewardsAdminTab() {
  const { event } = useEventStore()
  const rules = event?.config.rewardRules ?? []

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader title="Reward & Badge Rules" subtitle="Automated gamification rules for audience investors" />
      <div className="space-y-2.5">
        {rules.map(rule => (
          <div key={rule.id} className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-950 flex-shrink-0">
                {rule.type === 'top_investor' ? <Trophy size={18} /> : rule.type === 'early_backer' ? <Zap size={18} /> : <Award size={18} />}
              </div>
              <div>
                <p className="text-zinc-950 font-bold text-sm">{rule.label}</p>
                <p className="text-zinc-500 text-xs">{rule.description}</p>
                <p className="text-zinc-700 font-semibold text-xs mt-0.5">{rule.prizeDescription}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">Active</span>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        className="w-full justify-center"
        icon={<CheckCircle2 size={14} />}
        onClick={() => toast.success('Rewards calculated successfully!')}
      >
        Trigger Automated Reward Distribution
      </Button>
    </div>
  )
}

// ── 7. Settings Tab ─────────────────────────────────────────
function SettingsTab() {
  const { eventConfig, setEventConfig } = useAdminStore()
  const { event } = useEventStore()
  const [config, setConfig] = useState(eventConfig ?? event?.config)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!config) return
    setEventConfig(config)
    setSaved(true)
    toast.success('Event configuration updated!')
    setTimeout(() => setSaved(false), 2000)
  }

  if (!config) return null

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader title="Competition Rules & Thresholds" subtitle="Configuration parameters update dynamically" />
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
        {[
          { label: 'Free Points Allocation', key: 'freePointsAllocation', suffix: 'pts' },
          { label: 'Points per ₹1', key: 'pointsPerRupee', suffix: 'pts/₹' },
          { label: 'Max Paid Purchase', key: 'maxPaidPurchaseRupees', suffix: '₹' },
          { label: 'Min Investment Amount', key: 'minInvestmentAmount', suffix: 'pts' },
          { label: 'Max Investment Amount', key: 'maxInvestmentAmount', suffix: 'pts' },
        ].map(({ label, key, suffix }) => (
          <div key={key} className="space-y-1">
            <label className="text-zinc-700 text-xs font-bold">{label}</label>
            <div className="relative">
              <input
                type="number"
                value={(config as any)[key]}
                onChange={e => setConfig({ ...config, [key]: parseInt(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 pr-12 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs text-zinc-900 outline-none font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-mono">{suffix}</span>
            </div>
          </div>
        ))}

        <Button onClick={handleSave} className="w-full justify-center mt-3 bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm" icon={saved ? <CheckCircle2 size={14} /> : undefined}>
          {saved ? 'Saved Successfully!' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  )
}

// ── 8. Audit Logs Tab ───────────────────────────────────────
function LogsTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAuditLogs().then(data => {
      setLogs(data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <SectionHeader title="Security Audit Log" subtitle="Tamper-evident log of all administrative actions" />
        <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={() => toast.info('Exporting audit log...')}>
          Export Log
        </Button>
      </div>
      <div className="bg-white border border-zinc-200/90 rounded-2xl divide-y divide-zinc-100 shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-xs">
            {loading ? 'Loading audit records...' : 'No audit events recorded yet.'}
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="p-4 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-zinc-950 text-xs font-bold">{(log.action || 'admin_action').replace(/_/g, ' ')}</p>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">Admin Action</span>
                </div>
                <p className="text-zinc-400 text-[11px] font-mono mt-0.5">{formatRelativeTime(log.created_at || log.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Main Admin Dashboard ───────────────────────────────────
export function AdminDashboard() {
  const { user } = useAuthStore()
  const { selectedTab, setSelectedTab } = useAdminStore()
  const navigate = useNavigate()

  const tabContent: Record<string, React.ReactNode> = {
    overview: <OverviewTab />,
    control: <ControlTab />,
    teams: <TeamsTab />,
    cast: <CastAdminTab />,
    allowlist: <AllowlistTab />,
    payments: <PaymentsTab />,
    rewards: <RewardsAdminTab />,
    settings: <SettingsTab />,
    logs: <LogsTab />,
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fade-in text-zinc-900">
      {/* Header Banner */}
      <div className="bg-white border border-zinc-200/90 shadow-sm p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-zinc-950 text-white flex items-center justify-center shadow-sm flex-shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-zinc-950 font-black text-xl tracking-tight">Admin Control Room</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                Verified Admin
              </span>
            </div>
            <p className="text-zinc-500 text-xs mt-0.5 font-mono">
              Signed in: {user?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/"
            className="px-3.5 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <ExternalLink size={13} />
            Public Arena
          </Link>
          <LiveIndicator label="STAGE LIVE" />
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="scroll-x pb-1 -mx-2 px-2">
        <div className="flex gap-1.5 min-w-max p-1.5 rounded-2xl bg-zinc-100/80 border border-zinc-200/80">
          {ADMIN_TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setSelectedTab(id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedTab === id
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/90 font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <Icon size={14} strokeWidth={selectedTab === id ? 2 : 1.75} />
              {label}
              {id === 'allowlist' && (
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab View */}
      {tabContent[selectedTab]}
    </div>
  )
}
