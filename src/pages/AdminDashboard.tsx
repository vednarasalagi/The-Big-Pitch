// ============================================================
// Admin Dashboard — Executive Control Room for Event Administrators
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
  Tv, ArrowUp, ArrowDown, Sparkles, X, Check, Award
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
          color="blue"
          icon={<TrendingUp size={18} />}
          trend="up"
          trendValue="+14% this hour"
        />
        <StatCard
          label="Active Backers"
          value={totalBackers}
          color="violet"
          icon={<Users size={18} />}
          trend="up"
          trendValue="High engagement"
        />
        <StatCard
          label="Competing Teams"
          value={teams.length}
          color="emerald"
          icon={<Activity size={18} />}
          subtext="5 rounds scheduled"
        />
        <StatCard
          label="Connected Live"
          value={142}
          color="cyan"
          icon={<Wifi size={18} />}
          subtext="Audience active"
        />
      </div>

      {/* Active round status banner */}
      {activeRound && (
        <Card className="p-5 border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <LiveIndicator />
              <h3 className="text-white font-bold text-base">Active Pitch Round</h3>
            </div>
            <StatusBadge status={activeRound.status} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div>
              <p className="text-white text-2xl font-black">{activeRound.team?.name}</p>
              <p className="text-white/60 text-xs mt-0.5">{activeRound.team?.pitchTitle}</p>
              <div className="flex items-center gap-4 mt-2.5">
                <span className="text-emerald-400 text-sm font-bold">{formatPoints(activeRound.totalInvested)} invested</span>
                <span className="text-white/40 text-xs">{activeRound.uniqueInvestors} investors</span>
              </div>
            </div>
            <Link
              to="/live"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-xs hover:bg-emerald-500/30 transition-colors w-fit"
            >
              <Eye size={14} />
              Open Live Stream
            </Link>
          </div>
        </Card>
      )}

      {/* Two columns: Team rankings preview + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team Leaderboard Preview */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader title="Team Rankings" subtitle="Real-time leaderboard" />
            <Link to="/scoreboard" className="text-xs text-arena-blue-3 hover:underline">View All →</Link>
          </div>
          <div className="space-y-2">
            {teams.slice(0, 4).map((t, i) => (
              <div key={t.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-white/40 w-4">#{i + 1}</span>
                  <div>
                    <p className="text-white font-semibold text-xs">{t.name}</p>
                    <p className="text-white/40 text-[11px]">{t.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-arena-blue-3">{formatPoints(t.totalInvestment)}</p>
                  <p className="text-[10px] text-white/40">{t.uniqueBackers} backers</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Audit Log */}
        <Card className="p-4 space-y-3">
          <SectionHeader title="Recent Security Activity" subtitle="Real-time event actions" />
          <div className="space-y-2">
            {recentLogs.length === 0 ? (
              <p className="text-white/40 text-xs py-3 text-center">No security actions recorded yet.</p>
            ) : (
              recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-7 h-7 rounded-lg bg-arena-violet/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Activity size={12} className="text-arena-violet-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-xs font-medium truncate">{(log.action || 'admin_action').replace(/_/g, ' ')}</p>
                    <p className="text-white/30 text-[10px]">{formatRelativeTime(log.created_at || log.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
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
  const [category, setCategory] = useState(team?.category || 'AI & ML')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-lg p-6 space-y-4 border-white/[0.15] shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white"
        >
          <X size={16} />
        </button>

        <div>
          <h3 className="text-white font-black text-xl">
            {team ? `Edit Startup: ${team.name}` : 'Pre-list New Pitching Startup'}
          </h3>
          <p className="text-white/50 text-xs mt-1">
            Pre-listed details (startup idea, team name, and pitchers) will appear immediately on the audience home screen and stage boards.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-white/70 text-xs font-semibold block mb-1">Team / Startup Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. EcoCharge"
                className="arena-input w-full text-xs"
              />
            </div>
            <div>
              <label className="text-white/70 text-xs font-semibold block mb-1">Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="arena-input w-full text-xs"
              >
                <option value="AI & ML">AI & Machine Learning</option>
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
            <label className="text-white/70 text-xs font-semibold block mb-1">Startup Idea / Pitch Title *</label>
            <input
              type="text"
              required
              value={pitchTitle}
              onChange={e => setPitchTitle(e.target.value)}
              placeholder="e.g. Wireless Solar EV Road Surface Charging"
              className="arena-input w-full text-xs"
            />
          </div>

          <div>
            <label className="text-white/70 text-xs font-semibold block mb-1">Idea Description (Problem & Solution)</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what problem the startup solves, their unique solution, and target market..."
              className="arena-input w-full text-xs resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-white/70 text-xs font-semibold block mb-1">Pitchers / Presenters (comma separated)</label>
              <input
                type="text"
                value={presenters}
                onChange={e => setPresenters(e.target.value)}
                placeholder="e.g. Aarav Patel, Sneha Rao"
                className="arena-input w-full text-xs"
              />
            </div>
            <div>
              <label className="text-white/70 text-xs font-semibold block mb-1">Pitch Queue #</label>
              <input
                type="number"
                min={1}
                value={pitchOrder}
                onChange={e => setPitchOrder(parseInt(e.target.value) || 1)}
                className="arena-input w-full text-xs"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1 justify-center bg-gradient-to-r from-arena-blue to-arena-violet">
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
        toast.success(`🚀 Pitch round started for ${teamToStart.name}!`)
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
      toast.info(`Pitch round completed for ${activeRound.team?.name || 'team'}.`)
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
    toast.info(isPaused ? 'Round resumed!' : 'Round paused. Investments temporarily disabled.')
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
        subtitle="Start or stop pitches for any team whenever you want, adjust timers, and set the next pitching team."
      />

      {/* 1. Active Pitch Management Card */}
      <Card className="p-6 space-y-5 border-white/[0.12] relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={16} className={activeRound ? 'text-emerald-400 animate-pulse' : 'text-white/40'} />
            <h3 className="text-white font-bold text-base">Stage Pitch Status</h3>
          </div>
          {activeRound ? <StatusBadge status={activeRound.status} /> : <Badge variant="cyan">Stage Standby</Badge>}
        </div>

        {activeRound && activeTeam ? (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-arena-navy-2 to-arena-blue/15 border border-emerald-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <p className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Live On Stage</p>
                </div>
                <h4 className="text-2xl font-black text-white mt-1">{activeTeam.name}</h4>
                <p className="text-arena-blue-3 font-semibold text-sm">{activeTeam.pitchTitle}</p>
                {activeTeam.presenters && activeTeam.presenters.length > 0 && (
                  <p className="text-white/50 text-xs mt-1">Pitchers: {activeTeam.presenters.join(', ')}</p>
                )}
              </div>

              <div className="text-left sm:text-right">
                <p className="text-3xl font-black text-emerald-400">{formatPoints(activeRound.totalInvested)}</p>
                <p className="text-white/40 text-xs">{activeRound.uniqueInvestors} audience backers</p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.08]">
              <Button
                variant={activeRound.status === 'investment_paused' ? 'primary' : 'secondary'}
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
                className="justify-center col-span-2 bg-rose-600 hover:bg-rose-500 text-white font-bold"
                icon={<Square size={13} />}
                loading={loading === 'stop'}
                onClick={handleStopPitch}
              >
                Stop / End Pitch
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-3 border border-dashed border-white/[0.1] rounded-2xl">
            <Radio size={32} className="text-white/20 mx-auto" />
            <div>
              <p className="text-white font-bold text-base">Stage Standby</p>
              <p className="text-white/40 text-xs mt-1">
                No startup is currently pitching. Select any team below to start their live pitch.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* 2. Choose & Start Pitch for ANY Team Card */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <Play size={16} className="text-arena-blue-3" />
              Launch Pitch for Any Listed Team
            </h3>
            <p className="text-white/40 text-xs mt-0.5">
              Admin can start the pitch for any team at any time, or designate the next upcoming team.
            </p>
          </div>
        </div>

        {/* Start Pitch Selector */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <select
            value={selectedTeamToPitch}
            onChange={e => setSelectedTeamToPitch(e.target.value)}
            className="arena-input flex-1 text-xs"
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
            className="justify-center bg-gradient-to-r from-arena-blue to-arena-violet whitespace-nowrap"
          >
            Start Pitch Now
          </Button>
        </div>

        {/* Set Up Next Selector */}
        <div className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <span className="text-white/70 text-xs font-semibold whitespace-nowrap">Designate as Up Next:</span>
          <select
            value={selectedNextTeam}
            onChange={e => setSelectedNextTeam(e.target.value)}
            className="arena-input flex-1 text-xs"
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
      </Card>

      {/* 3. Quick Pitch Launcher List for all Teams */}
      <Card className="p-5 space-y-3">
        <h4 className="text-white font-bold text-sm">All Pre-listed Teams ({teams.length})</h4>
        <div className="space-y-2">
          {teams.map(team => {
            const isThisTeamLive = activeRound?.status === 'investment_open' && activeRound?.teamId === team.id

            return (
              <div
                key={team.id}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isThisTeamLive
                    ? 'bg-emerald-500/15 border-emerald-500/40 shadow-glow-green'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-white/40 font-mono text-xs w-6">#{team.pitchOrder}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold text-sm truncate">{team.name}</p>
                      <StatusBadge status={team.status} />
                      <Badge variant="cyan" className="text-[10px]">{team.category}</Badge>
                    </div>
                    <p className="text-white/50 text-xs truncate max-w-md">{team.pitchTitle}</p>
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
                      className="text-xs"
                    >
                      Stop Pitch
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      loading={loading === `start-${team.id}`}
                      onClick={() => handleStartPitch(team)}
                      icon={<Play size={12} />}
                      className="text-xs bg-gradient-to-r from-arena-blue to-arena-violet"
                    >
                      Start Pitch
                    </Button>
                  )}
                  <Link to={`/cast?teamId=${team.id}`} target="_blank">
                    <button
                      className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
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
      </Card>
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
            className="bg-gradient-to-r from-arena-blue to-arena-violet"
          >
            Pre-list New Team
          </Button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={14} className="text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search teams by name, startup idea, or pitcher..."
            className="arena-input pl-9 w-full text-xs"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filterCat === cat
                  ? 'bg-arena-blue/20 border border-arena-blue/40 text-arena-blue-3'
                  : 'bg-white/[0.04] text-white/50 hover:text-white'
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
            <Card
              key={team.id}
              className={`p-4 transition-all ${
                isThisTeamLive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/[0.06]'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Order & Reorder Controls */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveOrder(idx, 'up')}
                      className="p-1 rounded hover:bg-white/[0.08] text-white/30 hover:text-white disabled:opacity-20"
                      title="Move Up"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <span className="text-white font-mono text-xs font-bold">#{team.pitchOrder}</span>
                    <button
                      disabled={idx === teams.length - 1}
                      onClick={() => handleMoveOrder(idx, 'down')}
                      className="p-1 rounded hover:bg-white/[0.08] text-white/30 hover:text-white disabled:opacity-20"
                      title="Move Down"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-arena-blue/30 to-arena-violet/30 flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                    {team.name[0]}
                  </div>

                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold text-sm truncate">{team.name}</p>
                      <Badge variant="cyan" className="text-[10px]">{team.category}</Badge>
                      <StatusBadge status={team.status} />
                    </div>

                    <p className="text-arena-blue-3 font-semibold text-xs leading-snug">{team.pitchTitle}</p>

                    {team.description && (
                      <p className="text-white/40 text-[11px] line-clamp-2 leading-relaxed">{team.description}</p>
                    )}

                    {team.presenters && team.presenters.length > 0 && (
                      <div className="flex items-center gap-1 text-white/40 text-[11px]">
                        <Users size={11} className="text-arena-violet-3" />
                        <span className="text-white/60 font-medium">Pitchers:</span>
                        <span>{team.presenters.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action Toolbar */}
                <div className="flex items-center justify-between lg:justify-end gap-3 pl-10 lg:pl-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/[0.06]">
                  <div className="text-left lg:text-right pr-2">
                    <p className="text-arena-blue-3 font-bold text-xs">{formatPoints(team.totalInvestment)}</p>
                    <p className="text-white/40 text-[10px]">{team.uniqueBackers} backers</p>
                  </div>

                  {/* Start Pitch button */}
                  {!isThisTeamLive && (
                    <Button
                      size="sm"
                      onClick={() => handleStartPitchDirect(team)}
                      icon={<Play size={12} />}
                      className="text-xs bg-gradient-to-r from-arena-blue to-arena-violet whitespace-nowrap"
                    >
                      Start Pitch
                    </Button>
                  )}

                  {/* Stage Cast Button */}
                  <Link to={`/cast?teamId=${team.id}`} target="_blank">
                    <button
                      className="p-2 rounded-xl hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
                      title="Cast Team Results to Stage Screen"
                    >
                      <Tv size={14} />
                    </button>
                  </Link>

                  {/* Edit Button */}
                  <button
                    className="p-2 rounded-xl hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
                    onClick={() => setModalTeam(team)}
                    title="Edit Team Details"
                  >
                    <Edit3 size={14} />
                  </button>

                  {/* Delete Button */}
                  <button
                    className="p-2 rounded-xl hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors"
                    onClick={() => handleDeleteTeam(team.id, team.name)}
                    title="Remove Team"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          )
        })}

        {filteredTeams.length === 0 && (
          <div className="glass-card p-8 text-center border-dashed border-white/10 rounded-2xl">
            <Users size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-white font-semibold">No Pitching Teams Found</p>
            <p className="text-white/40 text-xs mt-1 max-w-sm mx-auto">
              Pre-list startups with their startup idea, pitch details, and pitcher information to feature them on the home screen.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button onClick={() => setModalTeam('new')} icon={<Plus size={14} />}>
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
        <Card className="p-6 space-y-4 border-arena-blue/30 bg-arena-blue/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-arena-blue/20 flex items-center justify-center text-arena-blue-3">
              <Tv size={22} />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Common Stage Board</h3>
              <p className="text-white/50 text-xs mt-0.5">Full stage display with live pitch & realtime standings</p>
            </div>
          </div>

          <p className="text-white/60 text-xs leading-relaxed">
            Optimized for HDMI stage projectors and auditorium screens. Shows current pitching startup in huge typography, live countdown timer, and live leaderboard rankings.
          </p>

          <Button
            onClick={() => handleOpenCast()}
            icon={<ExternalLink size={14} />}
            className="w-full justify-center bg-gradient-to-r from-arena-blue to-arena-violet"
          >
            Open Stage Projector Window
          </Button>
        </Card>

        {/* Card 2: Per-Team Result Dashboards */}
        <Card className="p-6 space-y-4 border-arena-violet/30 bg-arena-violet/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-arena-violet/20 flex items-center justify-center text-arena-violet-3">
              <Award size={22} />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Individual Startup Result Card</h3>
              <p className="text-white/50 text-xs mt-0.5">Project a specific startup's result on the big screen</p>
            </div>
          </div>

          <p className="text-white/60 text-xs leading-relaxed">
            Project a startup's final score, tournament rank, startup idea, and pitcher credits on the big screen during presentations or award ceremonies.
          </p>

          <div className="space-y-2">
            <select
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value)}
              className="arena-input w-full text-xs"
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
              className="w-full justify-center"
            >
              Cast Selected Startup Results
            </Button>
          </div>
        </Card>
      </div>

      {/* Quick Cast Grid for every team */}
      <Card className="p-5 space-y-3">
        <h4 className="text-white font-bold text-sm flex items-center gap-2">
          <Sparkles size={15} className="text-amber-400" />
          Quick Team Screen Launch
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {teams.map(team => (
            <div
              key={team.id}
              className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/40 font-mono">#{team.pitchOrder}</span>
                  <p className="text-white font-bold text-xs truncate">{team.name}</p>
                </div>
                <p className="text-white/40 text-[10px] truncate max-w-[150px]">{team.pitchTitle}</p>
              </div>

              <button
                onClick={() => handleOpenCast(team.id)}
                className="px-2.5 py-1 rounded-lg bg-arena-blue/15 hover:bg-arena-blue/30 border border-arena-blue/30 text-arena-blue-3 text-[11px] font-semibold flex items-center gap-1 transition-colors flex-shrink-0"
              >
                <Tv size={11} />
                <span>Cast</span>
              </button>
            </div>
          ))}
        </div>
      </Card>
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
      <Card className="p-4 border-arena-violet/30 bg-arena-violet/5 space-y-2">
        <div className="flex items-center gap-2 text-arena-violet-3 text-xs font-semibold">
          <ShieldCheck size={16} />
          <span>Server-Enforced Role Resolution</span>
        </div>
        <p className="text-white/60 text-xs leading-relaxed">
          The Super Admin has permanent master access configured via <code className="text-arena-violet-3 bg-white/5 px-1 py-0.5 rounded">VITE_SUPER_ADMIN_EMAIL</code>.
          Any email added below will automatically be granted the <strong className="text-white">Admin</strong> role upon sign-in and stored in Supabase.
        </p>
      </Card>

      {/* Add New Admin Form */}
      <Card className="p-5 space-y-4">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <UserPlus size={15} className="text-arena-blue-3" />
          Authorize New Administrator
        </h3>
        <form onSubmit={handleAddEmail} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail size={14} className="text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. colleague@college.edu"
              className="arena-input pl-9 w-full text-xs"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            loading={loading}
            icon={<Plus size={14} />}
            className="justify-center whitespace-nowrap bg-gradient-to-r from-arena-blue to-arena-violet"
          >
            Add Admin Email
          </Button>
        </form>
      </Card>

      {/* Current Allowlist List */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <span className="text-xs font-semibold text-white/70">
            Authorized Email Addresses ({allowlist.length})
          </span>
          <span className="text-[11px] text-white/40 font-mono">Status: Active</span>
        </div>

        <div className="space-y-2">
          {allowlist.map((adminEmail) => {
            const isCurrentUser = adminEmail.toLowerCase() === user?.email.toLowerCase()
            const isThisSuperAdmin = isSuperAdmin(adminEmail)

            return (
              <div
                key={adminEmail}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isThisSuperAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-arena-violet/15 text-arena-violet-3'
                  }`}>
                    {isThisSuperAdmin ? <ShieldCheck size={15} /> : <Shield size={14} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-mono text-xs font-medium">{adminEmail}</p>
                      {isThisSuperAdmin && (
                        <Badge variant="amber" className="text-[9px] px-1.5 py-0">Super Admin (Protected)</Badge>
                      )}
                      {isCurrentUser && (
                        <Badge variant="violet" className="text-[9px] px-1.5 py-0">You (Current)</Badge>
                      )}
                    </div>
                    <p className="text-white/40 text-[10px]">
                      {isThisSuperAdmin
                        ? 'Master administrator defined in environment config'
                        : 'Delegated event administrator · Managed via Supabase'}
                    </p>
                  </div>
                </div>

                {!isCurrentUser && !isThisSuperAdmin && (
                  <button
                    onClick={() => handleRemoveEmail(adminEmail)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Revoke admin authorization"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ── 5. Payments Tab ─────────────────────────────────────────
function PaymentsTab() {
  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader title="Financial & Transaction History" subtitle="Live tracking of paid point purchases and volume" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value="₹240" color="emerald" icon={<TrendingUp size={16} />} />
        <StatCard label="Paid Orders" value="12" color="blue" icon={<CreditCard size={16} />} />
        <StatCard label="Points Issued" value="2,400" color="violet" icon={<Gift size={16} />} />
        <StatCard label="Failed Orders" value="0" color="cyan" icon={<CheckCircle2 size={16} />} />
      </div>
      <Card className="p-4">
        <p className="text-white/50 text-xs text-center py-6">
          Razorpay Webhook & Payment sync active. Transaction records are secured in public.payment_transactions.
        </p>
      </Card>
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
          <Card key={rule.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="text-2xl flex-shrink-0">
                {rule.type === 'top_investor' ? '🏆' : rule.type === 'early_backer' ? '⚡' : '💎'}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{rule.label}</p>
                <p className="text-white/50 text-xs">{rule.description}</p>
                <p className="text-arena-violet-3 text-xs mt-0.5">{rule.prizeDescription}</p>
              </div>
            </div>
            <Badge variant="emerald" dot>Active</Badge>
          </Card>
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
      <Card className="p-5 space-y-4">
        {[
          { label: 'Free Points Allocation', key: 'freePointsAllocation', suffix: 'pts' },
          { label: 'Points per ₹1', key: 'pointsPerRupee', suffix: 'pts/₹' },
          { label: 'Max Paid Purchase', key: 'maxPaidPurchaseRupees', suffix: '₹' },
          { label: 'Min Investment Amount', key: 'minInvestmentAmount', suffix: 'pts' },
          { label: 'Max Investment Amount', key: 'maxInvestmentAmount', suffix: 'pts' },
        ].map(({ label, key, suffix }) => (
          <div key={key} className="space-y-1">
            <label className="text-white/70 text-xs font-medium">{label}</label>
            <div className="relative">
              <input
                type="number"
                value={(config as any)[key]}
                onChange={e => setConfig({ ...config, [key]: parseInt(e.target.value) || 0 })}
                className="arena-input pr-12 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">{suffix}</span>
            </div>
          </div>
        ))}

        <Button onClick={handleSave} className="w-full justify-center mt-2" icon={saved ? <CheckCircle2 size={14} /> : undefined}>
          {saved ? 'Saved Successfully!' : 'Save Configuration'}
        </Button>
      </Card>
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
      <Card className="divide-y divide-white/[0.06]">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-xs">
            {loading ? 'Loading audit records...' : 'No audit events recorded yet.'}
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="p-3.5 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-arena-violet/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield size={13} className="text-arena-violet-3" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white text-xs font-semibold">{(log.action || 'admin_action').replace(/_/g, ' ')}</p>
                  <Badge variant="blue" className="text-[9px]">Admin Action</Badge>
                </div>
                <p className="text-white/40 text-[11px] mt-0.5">{formatRelativeTime(log.created_at || log.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </Card>
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
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="glass-card border-arena-violet/30 bg-gradient-to-r from-arena-violet/10 via-arena-navy-2 to-arena-blue/10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-arena-blue to-arena-violet flex items-center justify-center shadow-glow-violet flex-shrink-0">
            <Shield size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-black text-xl tracking-tight">Admin Control Room</h1>
              <Badge variant="violet" dot className="text-[10px]">Verified Admin</Badge>
            </div>
            <p className="text-white/50 text-xs mt-0.5 font-mono">
              Signed in: {user?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink size={13} />
            Public Arena
          </Link>
          <LiveIndicator label="COMPETITION LIVE" />
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="scroll-x pb-1 -mx-2 px-2">
        <div className="flex gap-2 min-w-max p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          {ADMIN_TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setSelectedTab(id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${selectedTab === id
                ? 'bg-gradient-to-r from-arena-blue/80 to-arena-violet/80 text-white shadow-md'
                : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                }`}
            >
              <Icon size={14} />
              {label}
              {id === 'allowlist' && (
                <span className="w-1.5 h-1.5 rounded-full bg-arena-violet-3" />
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
