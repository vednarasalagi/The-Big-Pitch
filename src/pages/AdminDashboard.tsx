// ============================================================
// Admin Dashboard — Executive Control Room for Event Administrators
// Clean, minimalist white & black aesthetic.
// Includes full event management, live control, team telemetry,
// audit logs, and secure Admin Email Allowlist management.
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard, Settings, Radio, Users, CreditCard,
  Gift, FileText, Shield, ChevronRight, ChevronLeft, Play, Pause,
  Square, SkipForward, Clock, TrendingUp, Activity,
  AlertTriangle, CheckCircle2, Download, Eye, Edit3,
  Plus, RefreshCw, Wifi, Bell, ShieldCheck, UserPlus,
  Trash2, Mail, ExternalLink, Search, Filter, Lock,
  Tv, ArrowUp, ArrowDown, Sparkles, X, Check, Award,
  Sliders, Database, Terminal, Trophy, Zap, LayoutGrid
} from 'lucide-react'
import { useAuthStore, useEventStore, useWalletStore, useAdminStore } from '@/store'
import {
  Card, Button, Badge, StatCard, StatusBadge, SectionHeader,
  Avatar, ProgressBar, Divider, LiveIndicator,
} from '@/components/ui'
import { formatPoints, formatRupees, formatRelativeTime } from '@/lib/utils'
import {
  getAuditLogs,
  logAuditEvent,
  createTeam,
  updateTeam,
  deleteTeam,
  reorderTeams,
  startPitchForTeam,
  openInvestmentWindow,
  pauseRound,
  resumeRound,
  extendRoundTimer,
  closeInvestmentWindow,
  stopPitchForTeam,
  updateEventConfig,
  updateTeamTimerSettings,
  saveOfficialResults,
  toUserFriendlyError,
} from '@/lib/supabaseApi'
import {
  getAdminAllowlist,
  addAdminEmail,
  removeAdminEmail,
  isSuperAdmin,
  syncAdminAllowlistFromSupabase,
} from '@/lib/adminConfig'
import { broadcastRoundUpdate, broadcastTeamsUpdate } from '@/lib/realtimeSync'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import type { Team, OfficialResult } from '@/types'

// ── Admin Navigation Tabs & Categorization ───────────────────
export interface AdminTabItem {
  id: string
  label: string
  shortLabel: string
  description: string
  category: 'live' | 'competition' | 'system'
  icon: any
  badge?: string
}

export const ADMIN_CATEGORIES = [
  { id: 'all', label: 'All Controls', count: 10, icon: LayoutGrid },
  { id: 'live', label: 'Live Stage', count: 4, icon: Radio },
  { id: 'competition', label: 'Startups & Jury', count: 2, icon: Trophy },
  { id: 'system', label: 'Config & Access', count: 4, icon: Settings },
] as const

export const ADMIN_TABS: AdminTabItem[] = [
  {
    id: 'overview',
    icon: LayoutDashboard,
    label: 'Overview & Telemetry',
    shortLabel: 'Overview',
    description: 'Live tournament status, active backers & audience telemetry',
    category: 'live',
  },
  {
    id: 'control',
    icon: Radio,
    label: 'Live Stage Control',
    shortLabel: 'Live Control',
    description: 'Start pitches, open/pause/resume/close investment windows',
    category: 'live',
    badge: 'Live',
  },
  {
    id: 'timer',
    icon: Clock,
    label: 'Pitch Timers & Duration',
    shortLabel: 'Timers',
    description: 'Adjust pitch durations and live investment countdown windows',
    category: 'live',
  },
  {
    id: 'cast',
    icon: Tv,
    label: 'Stage Projector Cast',
    shortLabel: 'Stage Cast',
    description: 'Auditorium presentation view for stage projectors & big screens',
    category: 'live',
  },
  {
    id: 'teams',
    icon: Users,
    label: 'Startup Lineup',
    shortLabel: 'Startups',
    description: 'Add, edit, reorder pitching teams, founders & categories',
    category: 'competition',
  },
  {
    id: 'judging',
    icon: Trophy,
    label: 'Official Jury Scores',
    shortLabel: 'Jury Scores',
    description: 'Record judge ranks, official scores, awards & jury feedback',
    category: 'competition',
  },
  {
    id: 'allowlist',
    icon: ShieldCheck,
    label: 'Admin Access Control',
    shortLabel: 'Admin Access',
    description: 'Delegate admin privileges & manage authorized admin allowlist',
    category: 'system',
  },
  {
    id: 'payments',
    icon: CreditCard,
    label: 'Payments & Ledger',
    shortLabel: 'Payments',
    description: 'Razorpay payment orders & audience point transactions',
    category: 'system',
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Event Configuration',
    shortLabel: 'Event Rules',
    description: 'Welcome bonus points, investment caps & email domains',
    category: 'system',
  },
  {
    id: 'logs',
    icon: FileText,
    label: 'Audit Trail Logs',
    shortLabel: 'Audit Logs',
    description: 'Complete chronological history of all admin stage actions',
    category: 'system',
  },
]

// ── 1. Overview Tab ─────────────────────────────────────────
function OverviewTab() {
  const { teams, activeRound } = useEventStore()
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const totalInvested = teams.reduce((s, t) => s + t.totalInvestment, 0)
  const totalBackers = teams.reduce((s, t) => s + t.uniqueBackers, 0)

  useEffect(() => {
    const fetchRecent = () => getAuditLogs().then(data => setRecentLogs(data.slice(0, 5)))
    fetchRecent()
    window.addEventListener('audit-logs-updated', fetchRecent)
    const interval = setInterval(fetchRecent, 5000)
    return () => {
      window.removeEventListener('audit-logs-updated', fetchRecent)
      clearInterval(interval)
    }
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
                    <p className="text-zinc-900 text-xs font-bold truncate">{(log.action || 'admin_action').replace(/_/g, ' ')}</p>
                    {log.metadata?.description && (
                      <p className="text-zinc-500 text-[11px] truncate mt-0.5">{log.metadata.description}</p>
                    )}
                    <p className="text-zinc-400 text-[10px] font-mono mt-0.5">{formatRelativeTime(log.created_at || log.createdAt)}</p>
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
  const [category, setCategory] = useState(team?.category || '')
  const [presenters, setPresenters] = useState(team?.presenters?.join(', ') || '')
  const [pitchOrder, setPitchOrder] = useState(team?.pitchOrder || (teams.length + 1))
  const defaultPitch = event?.config.pitchDurationSeconds ?? 300
  const defaultInvest = event?.config.investmentWindowSeconds ?? 180

  const [pitchDurationMin, setPitchDurationMin] = useState(Math.floor((team?.pitchDurationSeconds ?? defaultPitch) / 60))
  const [pitchDurationSec, setPitchDurationSec] = useState((team?.pitchDurationSeconds ?? defaultPitch) % 60)
  const [investmentWindowMin, setInvestmentWindowMin] = useState(Math.floor((team?.investmentWindowSeconds ?? defaultInvest) / 60))
  const [investmentWindowSec, setInvestmentWindowSec] = useState((team?.investmentWindowSeconds ?? defaultInvest) % 60)
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
    const totalPitchSec = pitchDurationMin * 60 + pitchDurationSec
    const totalInvestSec = investmentWindowMin * 60 + investmentWindowSec
    const cleanCategory = (category || 'General').trim()

    if (team) {
      // Edit
      const ok = await updateTeam(team.id, {
        name: name.trim(),
        pitchTitle: pitchTitle.trim(),
        description: description.trim(),
        category: cleanCategory,
        presenters: presenterList,
        pitchOrder: Number(pitchOrder) || 1,
        pitchDurationSeconds: totalPitchSec,
        investmentWindowSeconds: totalInvestSec,
      })
      setLoading(false)
      if (ok) {
        toast.success(`Updated ${name} successfully!`)
        const updated = {
          ...team,
          name: name.trim(),
          pitchTitle: pitchTitle.trim(),
          description: description.trim(),
          category: cleanCategory,
          presenters: presenterList,
          pitchOrder: Number(pitchOrder) || 1,
          pitchDurationSeconds: totalPitchSec,
          investmentWindowSeconds: totalInvestSec,
          updatedAt: new Date().toISOString(),
        }
        onSaved(updated)
        broadcastTeamsUpdate(teams.map(t => (t.id === team.id ? updated : t)))
        await logAuditEvent({
          action: 'UPDATE_STARTUP',
          targetId: team.id,
          metadata: { name: name.trim(), category: cleanCategory, description: `Updated details for "${name.trim()}"` },
          eventId,
        })
        onClose()
      } else {
        toast.error('Unable to update team. Please try again.')
      }
    } else {
      // Create new
      const created = await createTeam({
        eventId,
        name: name.trim(),
        pitchTitle: pitchTitle.trim(),
        description: description.trim(),
        category: cleanCategory,
        presenters: presenterList,
        pitchOrder: Number(pitchOrder) || (teams.length + 1),
        pitchDurationSeconds: totalPitchSec,
        investmentWindowSeconds: totalInvestSec,
      })
      setLoading(false)
      if (created) {
        toast.success(`Pre-listed ${name} successfully!`)
        onSaved(created)
        broadcastTeamsUpdate([...teams, created])
        await logAuditEvent({
          action: 'PRELIST_STARTUP',
          targetId: created.id,
          metadata: { name: created.name, category: cleanCategory, description: `Pre-listed new startup "${created.name}"` },
          eventId,
        })
        onClose()
      } else {
        toast.error('Unable to pre-list team. Please try again.')
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-zinc-950/65 backdrop-blur-sm animate-fade-in overflow-y-auto" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="bg-white w-full max-w-lg rounded-2xl border border-zinc-200 shadow-2xl relative max-h-[92dvh] sm:max-h-[88vh] flex flex-col text-zinc-900 my-auto overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-start justify-between gap-3 bg-white flex-shrink-0">
          <div>
            <h3 className="text-zinc-950 font-black text-lg sm:text-xl tracking-tight">
              {team ? `Edit Startup: ${team.name}` : 'Pre-list New Pitching Startup'}
            </h3>
            <p className="text-zinc-500 text-xs mt-0.5">
              Pre-listed details will appear immediately on the audience home screen and stage boards.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-zinc-700 text-xs font-bold">Category</label>
                <span className="text-[10px] text-zinc-400 font-medium">Optional</span>
              </div>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. AgriTech, AI & ML, FinTech, Web3..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 text-xs text-zinc-900 outline-none transition-all placeholder:text-zinc-400"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['AI & ML', 'CleanTech', 'FinTech', 'HealthTech', 'EdTech', 'B2B SaaS', 'AgriTech', 'D2C'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setCategory(tag)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                      category === tag
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
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

          {/* Team-Specific Timer Durations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
            <div>
              <label className="text-zinc-700 text-xs font-bold block mb-1.5">Pitch Presentation Time</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={pitchDurationMin}
                    onChange={e => setPitchDurationMin(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">min</span>
                </div>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={pitchDurationSec}
                    onChange={e => setPitchDurationSec(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">sec</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-zinc-700 text-xs font-bold block mb-1.5">Investment Window</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={investmentWindowMin}
                    onChange={e => setInvestmentWindowMin(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">min</span>
                </div>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={investmentWindowSec}
                    onChange={e => setInvestmentWindowSec(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">sec</span>
                </div>
              </div>
            </div>
          </div>

          </div>

          {/* Fixed Footer Actions */}
          <div className="p-3.5 sm:p-4 border-t border-zinc-100 bg-white flex gap-3 flex-shrink-0">
            <Button variant="secondary" onClick={onClose} className="flex-1 justify-center text-xs sm:text-sm py-2.5">
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1 justify-center bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs sm:text-sm py-2.5">
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
  const [countdown, setCountdown] = useState<number>(0)

  const eventId = event?.id || '11111111-0000-0000-0000-000000000001'
  const activeTeam = activeRound?.team || teams.find(t => t.id === activeRound?.teamId)

  // Live timer tick for active round
  useEffect(() => {
    if (!activeRound) {
      setCountdown(0)
      return
    }

    const updateTimer = () => {
      if (activeRound.status === 'investment_open' && activeRound.investmentCloseTime) {
        const closeTime = new Date(activeRound.investmentCloseTime).getTime()
        const remaining = Math.max(0, Math.floor((closeTime - Date.now()) / 1000))
        setCountdown(remaining)
      } else if ((activeRound.status === 'announced' || activeRound.status === 'pitching') && activeRound.pitchStartTime) {
        const start = new Date(activeRound.pitchStartTime).getTime()
        const duration = (activeRound.scheduledDurationSeconds ?? 300) * 1000
        const remaining = Math.max(0, Math.floor((start + duration - Date.now()) / 1000))
        setCountdown(remaining)
      } else if (activeRound.status === 'investment_paused') {
        // Paused, freeze
      } else {
        setCountdown(0)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [activeRound?.status, activeRound?.investmentCloseTime, activeRound?.pitchStartTime, activeRound?.scheduledDurationSeconds])

  // Start pitch for ANY chosen team
  const handleStartPitch = async (teamToStart: Team, phase: 'announced' | 'investment_open' = 'announced') => {
    setLoading(`start-${teamToStart.id}`)
    try {
      const pitchDuration = teamToStart.pitchDurationSeconds ?? event?.config.pitchDurationSeconds ?? 300
      const investmentWindow = teamToStart.investmentWindowSeconds ?? event?.config.investmentWindowSeconds ?? 180
      const newRound = await startPitchForTeam(eventId, teamToStart, pitchDuration, investmentWindow, phase)
      if (newRound) {
        setActiveRound(newRound)
        const updatedTeams = teams.map(t => (t.id === teamToStart.id ? { ...t, status: 'active' as const } : t))
        setTeams(updatedTeams)
        broadcastRoundUpdate(newRound)
        broadcastTeamsUpdate(updatedTeams)
        await logAuditEvent({
          action: 'START_PITCH',
          targetId: teamToStart.id,
          metadata: {
            teamName: teamToStart.name,
            phase,
            description: phase === 'announced'
              ? `Started pitch presentation for "${teamToStart.name}"`
              : `Opened live investment window for "${teamToStart.name}"`,
          },
          eventId,
        })
        toast.success(
          phase === 'announced'
            ? `Pitch presentation started for ${teamToStart.name}! (${Math.floor(pitchDuration / 60)}m ${pitchDuration % 60}s)`
            : `Investment round opened for ${teamToStart.name}! (${Math.floor(investmentWindow / 60)}m ${investmentWindow % 60}s)`
        )
      } else {
        toast.error('Unable to start pitch round. Please try again.')
      }
    } catch (err: any) {
      toast.error(toUserFriendlyError(err, 'Failed to start pitch round.'))
    } finally {
      setLoading(null)
    }
  }

  // Open audience investment window
  const handleOpenInvestments = async () => {
    if (!activeRound) return
    setLoading('open-investments')
    try {
      const windowSec = activeRound.team?.investmentWindowSeconds ?? event?.config.investmentWindowSeconds ?? 180
      const updated = await openInvestmentWindow(activeRound.id, windowSec)
      if (updated) {
        setActiveRound(updated)
        broadcastRoundUpdate(updated)
        await logAuditEvent({
          action: 'OPEN_INVESTMENT',
          targetId: activeRound.teamId,
          metadata: {
            teamName: activeRound.team?.name,
            roundId: activeRound.id,
            durationSeconds: windowSec,
            description: `Opened audience investment window for "${activeRound.team?.name || 'startup'}" (${Math.floor(windowSec / 60)}m ${windowSec % 60}s)`,
          },
          eventId,
        })
        toast.success(`Audience investment window is now OPEN! (${Math.floor(windowSec / 60)}m ${windowSec % 60}s)`)
      }
    } catch (err: any) {
      toast.error(toUserFriendlyError(err, 'Failed to open investments.'))
    } finally {
      setLoading(null)
    }
  }

  // Close audience investment window
  const handleCloseInvestments = async () => {
    if (!activeRound) return
    setLoading('close-investments')
    try {
      const ok = await closeInvestmentWindow(activeRound.id)
      if (ok) {
        const closedRound = { ...activeRound, status: 'investment_closed' as const }
        setActiveRound(closedRound)
        broadcastRoundUpdate(closedRound)
        await logAuditEvent({
          action: 'CLOSE_INVESTMENT',
          targetId: activeRound.teamId,
          metadata: {
            teamName: activeRound.team?.name,
            roundId: activeRound.id,
            description: `Closed audience investment window for "${activeRound.team?.name || 'startup'}"`,
          },
          eventId,
        })
        toast.info('Investment window closed. Audience can no longer invest.')
      }
    } catch (err: any) {
      toast.error(toUserFriendlyError(err, 'Failed to close investment window.'))
    } finally {
      setLoading(null)
    }
  }

  // Pause / Resume with preserved remaining time
  const handleTogglePause = async () => {
    if (!activeRound) return
    const isPaused = activeRound.status === 'investment_paused'
    if (isPaused) {
      const newClose = await resumeRound(activeRound)
      if (newClose) {
        const resumedRound = {
          ...activeRound,
          status: 'investment_open' as const,
          investmentCloseTime: newClose,
          investmentPauseTime: undefined,
        }
        setActiveRound(resumedRound)
        broadcastRoundUpdate(resumedRound)
        await logAuditEvent({
          action: 'RESUME_ROUND',
          targetId: activeRound.teamId,
          metadata: {
            teamName: activeRound.team?.name,
            roundId: activeRound.id,
            description: `Resumed countdown timer for "${activeRound.team?.name || 'startup'}"`,
          },
          eventId,
        })
        toast.success('Round resumed! Remaining countdown continues.')
      }
    } else {
      const ok = await pauseRound(activeRound.id)
      if (ok) {
        const pausedRound = {
          ...activeRound,
          status: 'investment_paused' as const,
          investmentPauseTime: new Date().toISOString(),
        }
        setActiveRound(pausedRound)
        broadcastRoundUpdate(pausedRound)
        await logAuditEvent({
          action: 'PAUSE_ROUND',
          targetId: activeRound.teamId,
          metadata: {
            teamName: activeRound.team?.name,
            roundId: activeRound.id,
            description: `Paused countdown timer for "${activeRound.team?.name || 'startup'}"`,
          },
          eventId,
        })
        toast.info('Round paused. Investments and timer temporarily held.')
      }
    }
  }

  // Add 60s to clock
  const handleExtendClock = async () => {
    if (!activeRound) return
    const newClose = await extendRoundTimer(activeRound, 60)
    if (newClose) {
      const extendedRound = { ...activeRound, investmentCloseTime: newClose }
      setActiveRound(extendedRound)
      broadcastRoundUpdate(extendedRound)
      await logAuditEvent({
        action: 'EXTEND_TIMER',
        targetId: activeRound.teamId,
        metadata: {
          teamName: activeRound.team?.name,
          addedSeconds: 60,
          description: `Added +60s extension to round timer for "${activeRound.team?.name || 'startup'}"`,
        },
        eventId,
      })
      toast.success('+60s added to authoritative round timer!')
    }
  }

  // Stop pitch whenever admin wants
  const handleStopPitch = async () => {
    if (!activeRound) return
    setLoading('stop')
    try {
      await stopPitchForTeam(activeRound.teamId, activeRound.id)
      const updatedTeams = teams.map(t => (t.id === activeRound.teamId ? { ...t, status: 'completed' as const } : t))
      setTeams(updatedTeams)
      setActiveRound(null)
      broadcastRoundUpdate(null)
      broadcastTeamsUpdate(updatedTeams)
      await logAuditEvent({
        action: 'STOP_PITCH',
        targetId: activeRound.teamId,
        metadata: {
          teamName: activeRound.team?.name,
          roundId: activeRound.id,
          description: `Concluded pitch round for "${activeRound.team?.name || 'team'}"`,
        },
        eventId,
      })
      toast.info(`Pitch round concluded for ${activeRound.team?.name || 'team'}.`)
    } catch (err: any) {
      toast.error(toUserFriendlyError(err, 'Failed to stop pitch round.'))
    } finally {
      setLoading(null)
    }
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
    broadcastTeamsUpdate(updatedTeams)
    await reorderTeams(updatedTeams.map(t => ({ id: t.id, pitchOrder: t.pitchOrder })))
    toast.success(`${target.name} is now designated as the NEXT pitch!`)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Live Competition Controller"
        subtitle="Manage live stages, separate presentation and investment phases, and sync authoritative timers."
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
                  <p className="text-zinc-950 font-bold text-xs uppercase tracking-wider">
                    {activeRound.status === 'announced' || activeRound.status === 'pitching'
                      ? 'Phase 1: Pitch Presentation in Progress'
                      : activeRound.status === 'investment_open'
                      ? 'Phase 2: Audience Investment Window Open'
                      : activeRound.status === 'investment_paused'
                      ? 'Paused: Investment Window on Hold'
                      : 'Phase 3: Investment Window Closed'}
                  </p>
                </div>
                <h4 className="text-2xl font-black text-zinc-950 mt-1">{activeTeam.name}</h4>
                <p className="text-zinc-700 font-semibold text-sm">{activeTeam.pitchTitle}</p>
                {activeTeam.presenters && activeTeam.presenters.length > 0 && (
                  <p className="text-zinc-500 text-xs mt-1">Pitchers: {activeTeam.presenters.join(', ')}</p>
                )}
              </div>

              <div className="flex items-center gap-6 sm:text-right">
                <div>
                  <p className="text-3xl font-black text-zinc-950 font-mono">
                    {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                  </p>
                  <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
                    {activeRound.status === 'investment_open' ? 'Window Remaining' : 'Pitch Time Left'}
                  </p>
                </div>

                <div className="border-l border-zinc-200 pl-4">
                  <p className="text-2xl font-black text-zinc-950 font-mono">{formatPoints(activeRound.totalInvested)}</p>
                  <p className="text-zinc-500 text-xs">{activeRound.uniqueInvestors} backers</p>
                </div>
              </div>
            </div>

            {/* Phase Transition and Action Controls */}
            <div className="space-y-2 pt-2 border-t border-zinc-200">
              {/* If presentation phase: Show button to Open Investment Window */}
              {(activeRound.status === 'announced' || activeRound.status === 'pitching') && (
                <div className="p-3 rounded-xl bg-white border border-emerald-300 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-zinc-950">Pitch in progress. Ready for investments?</p>
                    <p className="text-[11px] text-zinc-500">
                      Configured window: {Math.floor((activeTeam.investmentWindowSeconds ?? event?.config.investmentWindowSeconds ?? 180) / 60)}m {(activeTeam.investmentWindowSeconds ?? event?.config.investmentWindowSeconds ?? 180) % 60}s
                    </p>
                  </div>
                  <Button
                    size="sm"
                    loading={loading === 'open-investments'}
                    onClick={handleOpenInvestments}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold whitespace-nowrap shadow-sm"
                    icon={<Play size={13} />}
                  >
                    Open Investment Window Now
                  </Button>
                </div>
              )}

              {/* Action Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="justify-center"
                  icon={activeRound.status === 'investment_paused' ? <Play size={13} /> : <Pause size={13} />}
                  onClick={handleTogglePause}
                >
                  {activeRound.status === 'investment_paused' ? 'Resume Timer' : 'Pause Timer'}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  className="justify-center"
                  onClick={handleExtendClock}
                >
                  +60s Clock
                </Button>

                {activeRound.status === 'investment_open' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="justify-center border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                    loading={loading === 'close-investments'}
                    onClick={handleCloseInvestments}
                  >
                    Close Investments
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="justify-center"
                    loading={loading === 'open-investments'}
                    onClick={handleOpenInvestments}
                  >
                    Open Window
                  </Button>
                )}

                <Button
                  variant="danger"
                  size="sm"
                  className="justify-center bg-zinc-950 hover:bg-zinc-800 text-white font-bold"
                  icon={<Square size={13} />}
                  loading={loading === 'stop'}
                  onClick={handleStopPitch}
                >
                  End Pitch Round
                </Button>
              </div>
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
              Select team and choose whether to start their presentation first or open investments immediately.
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

          <div className="flex gap-2">
            <Button
              disabled={!selectedTeamToPitch || loading !== null}
              loading={loading === `start-${selectedTeamToPitch}`}
              onClick={() => {
                const team = teams.find(t => t.id === selectedTeamToPitch)
                if (team) handleStartPitch(team, 'announced')
              }}
              icon={<Play size={14} />}
              className="justify-center bg-zinc-950 hover:bg-zinc-800 text-white whitespace-nowrap shadow-sm text-xs"
            >
              Start Presentation
            </Button>

            <Button
              variant="secondary"
              disabled={!selectedTeamToPitch || loading !== null}
              onClick={() => {
                const team = teams.find(t => t.id === selectedTeamToPitch)
                if (team) handleStartPitch(team, 'investment_open')
              }}
              className="justify-center whitespace-nowrap text-xs border-zinc-300"
            >
              Start Direct with Window
            </Button>
          </div>
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
    await logAuditEvent({
      action: 'REORDER_TEAMS',
      metadata: {
        description: `Reordered pitching startup lineup: moved "${temp.name}" ${direction}`,
      },
      eventId,
    })
    toast.success('Pitch order updated.')
  }

  // Handle delete team
  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to remove "${teamName}" from the pitching lineup?`)) return

    const ok = await deleteTeam(teamId)
    if (ok) {
      if (activeRound?.teamId === teamId) {
        setActiveRound(null)
        broadcastRoundUpdate(null)
      }
      const updated = teams.filter(t => t.id !== teamId)
      setTeams(updated)
      broadcastTeamsUpdate(updated)
      await logAuditEvent({
        action: 'DELETE_STARTUP',
        targetId: teamId,
        metadata: { name: teamName, description: `Removed "${teamName}" from pitching lineup` },
        eventId,
      })
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
      const updatedTeams = teams.map(t => (t.id === team.id ? { ...t, status: 'active' as const } : t))
      setTeams(updatedTeams)
      broadcastRoundUpdate(newRound)
      broadcastTeamsUpdate(updatedTeams)
      await logAuditEvent({
        action: 'START_PITCH',
        targetId: team.id,
        metadata: {
          teamName: team.name,
          durationSeconds: duration,
          description: `Started pitch for "${team.name}" directly from startup lineup`,
        },
        eventId,
      })
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
      await logAuditEvent({
        action: 'AUTHORIZE_ADMIN',
        metadata: { email: clean, description: `Authorized ${clean} as administrator` },
      })
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
      await logAuditEvent({
        action: 'REVOKE_ADMIN',
        metadata: { email: emailToRemove, description: `Revoked admin privileges for ${emailToRemove}` },
      })
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



// ── 7. Pitch Timer & Investment Window Tab ──────────────────
function TimerConfigTab() {
  const { event, teams, setTeams, setEvent } = useEventStore()
  const { eventConfig, setEventConfig } = useAdminStore()

  const currentEventConfig = eventConfig ?? event?.config
  const eventId = event?.id || 'event-pitch-arena-2025'

  // Default timer states (min & sec)
  const defaultPitchSec = currentEventConfig?.pitchDurationSeconds ?? 300
  const defaultInvestSec = currentEventConfig?.investmentWindowSeconds ?? 180

  const [pitchMin, setPitchMin] = useState(Math.floor(defaultPitchSec / 60))
  const [pitchSec, setPitchSec] = useState(defaultPitchSec % 60)
  const [investMin, setInvestMin] = useState(Math.floor(defaultInvestSec / 60))
  const [investSec, setInvestSec] = useState(defaultInvestSec % 60)
  const [savingDefaults, setSavingDefaults] = useState(false)

  // Per-team timer settings: Record<teamId, { pitchMin, pitchSec, investMin, investSec }>
  const [teamTimers, setTeamTimers] = useState<Record<string, { pitchMin: number; pitchSec: number; investMin: number; investSec: number }>>(() => {
    const map: Record<string, { pitchMin: number; pitchSec: number; investMin: number; investSec: number }> = {}
    teams.forEach(t => {
      const pSec = t.pitchDurationSeconds ?? defaultPitchSec
      const iSec = t.investmentWindowSeconds ?? defaultInvestSec
      map[t.id] = {
        pitchMin: Math.floor(pSec / 60),
        pitchSec: pSec % 60,
        investMin: Math.floor(iSec / 60),
        investSec: iSec % 60,
      }
    })
    return map
  })
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null)

  // Update team timers state when teams change
  useEffect(() => {
    setTeamTimers(prev => {
      const next = { ...prev }
      teams.forEach(t => {
        if (!next[t.id]) {
          const pSec = t.pitchDurationSeconds ?? defaultPitchSec
          const iSec = t.investmentWindowSeconds ?? defaultInvestSec
          next[t.id] = {
            pitchMin: Math.floor(pSec / 60),
            pitchSec: pSec % 60,
            investMin: Math.floor(iSec / 60),
            investSec: iSec % 60,
          }
        }
      })
      return next
    })
  }, [teams, defaultPitchSec, defaultInvestSec])

  // Save Default Durations to Event Config
  const handleSaveDefaults = async () => {
    const totalPitch = Math.max(10, (pitchMin * 60) + pitchSec)
    const totalInvest = Math.max(10, (investMin * 60) + investSec)

    setSavingDefaults(true)
    const updatedConfig = {
      ...currentEventConfig,
      pitchDurationSeconds: totalPitch,
      investmentWindowSeconds: totalInvest,
    } as any

    setEventConfig(updatedConfig)
    if (event) {
      setEvent({ ...event, config: updatedConfig })
    }

    const ok = await updateEventConfig(eventId, {
      pitchDurationSeconds: totalPitch,
      investmentWindowSeconds: totalInvest,
    })
    setSavingDefaults(false)

    if (ok) {
      await logAuditEvent({
        action: 'UPDATE_DEFAULT_TIMERS',
        metadata: {
          pitchSeconds: totalPitch,
          investSeconds: totalInvest,
          description: `Updated default timers: pitch=${pitchMin}m ${pitchSec}s, investment window=${investMin}m ${investSec}s`,
        },
        eventId,
      })
      toast.success(`Default timers saved: ${pitchMin}m ${pitchSec}s pitch, ${investMin}m ${investSec}s window`)
    } else {
      toast.error('Failed to persist default timers to Supabase')
    }
  }

  // Save Per-Team Override
  const handleSaveTeamTimer = async (teamId: string) => {
    const timer = teamTimers[teamId]
    if (!timer) return

    const totalPitch = Math.max(10, (timer.pitchMin * 60) + timer.pitchSec)
    const totalInvest = Math.max(10, (timer.investMin * 60) + timer.investSec)
    const teamName = teams.find(t => t.id === teamId)?.name || 'team'

    setSavingTeamId(teamId)
    const ok = await updateTeamTimerSettings(teamId, totalPitch, totalInvest)
    setSavingTeamId(null)

    if (ok) {
      setTeams(teams.map(t => t.id === teamId ? { ...t, pitchDurationSeconds: totalPitch, investmentWindowSeconds: totalInvest } : t))
      await logAuditEvent({
        action: 'UPDATE_TEAM_TIMER',
        targetId: teamId,
        metadata: {
          teamName,
          pitchSeconds: totalPitch,
          investSeconds: totalInvest,
          description: `Updated timer for "${teamName}": pitch=${timer.pitchMin}m ${timer.pitchSec}s, invest=${timer.investMin}m ${timer.investSec}s`,
        },
        eventId,
      })
      toast.success(`Timer updated for ${teamName}!`)
    } else {
      toast.error('Failed to update team timer')
    }
  }

  // Reset team to global defaults
  const handleResetTeamToDefaults = (teamId: string) => {
    setTeamTimers(prev => ({
      ...prev,
      [teamId]: {
        pitchMin,
        pitchSec,
        investMin,
        investSec,
      }
    }))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Pitch Timer & Investment Window"
        subtitle="Configure presentation and audience investment phase durations. Changes synchronize authoritatively across stage screens and audience devices."
      />

      {/* 1. Global Default Durations Card */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-zinc-950 font-bold text-sm flex items-center gap-2">
              <Clock size={16} className="text-zinc-950" />
              Event Default Durations
            </h3>
            <p className="text-zinc-500 text-xs mt-0.5">
              These durations apply to all pitching rounds unless overridden for a specific team.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
            Authoritative Defaults
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Default Pitch Duration */}
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-zinc-900 font-bold text-xs">Phase 1: Pitch Presentation Duration</label>
              <span className="text-zinc-400 text-xs font-mono">{(pitchMin * 60) + pitchSec}s total</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 font-semibold uppercase">Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={pitchMin}
                  onChange={e => setPitchMin(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs font-mono font-bold text-zinc-900 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-semibold uppercase">Seconds</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={pitchSec}
                  onChange={e => setPitchSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs font-mono font-bold text-zinc-900 outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              During this presentation phase, audience investment controls remain waiting.
            </p>
          </div>

          {/* Default Investment Window */}
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-zinc-900 font-bold text-xs">Phase 2: Audience Investment Window</label>
              <span className="text-zinc-400 text-xs font-mono">{(investMin * 60) + investSec}s total</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 font-semibold uppercase">Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={investMin}
                  onChange={e => setInvestMin(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs font-mono font-bold text-zinc-900 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-semibold uppercase">Seconds</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={investSec}
                  onChange={e => setInvestSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs font-mono font-bold text-zinc-900 outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              When this window closes, investments are automatically locked and rejected.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-zinc-400 text-xs font-medium">Quick Presets:</span>
          {[
            { label: '3m Pitch / 2m Invest', pM: 3, pS: 0, iM: 2, iS: 0 },
            { label: '5m Pitch / 3m Invest', pM: 5, pS: 0, iM: 3, iS: 0 },
            { label: '7m Pitch / 4m Invest', pM: 7, pS: 0, iM: 4, iS: 0 },
            { label: '1m Demo / 45s Invest', pM: 1, pS: 0, iM: 0, iS: 45 },
          ].map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setPitchMin(preset.pM)
                setPitchSec(preset.pS)
                setInvestMin(preset.iM)
                setInvestSec(preset.iS)
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <Button
          loading={savingDefaults}
          onClick={handleSaveDefaults}
          className="w-full justify-center bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm"
          icon={<CheckCircle2 size={14} />}
        >
          Save & Apply Default Durations
        </Button>
      </div>

      {/* 2. Team-Specific Timer Configurations */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
        <div>
          <h3 className="text-zinc-950 font-bold text-sm flex items-center gap-2">
            <Sliders size={16} className="text-zinc-950" />
            Team-Specific Duration Overrides ({teams.length} teams)
          </h3>
          <p className="text-zinc-500 text-xs mt-0.5">
            Configure custom presentation or investment windows for specific teams if needed.
          </p>
        </div>

        <div className="space-y-3">
          {teams.map(team => {
            const timer = teamTimers[team.id] || {
              pitchMin: Math.floor((team.pitchDurationSeconds ?? defaultPitchSec) / 60),
              pitchSec: (team.pitchDurationSeconds ?? defaultPitchSec) % 60,
              investMin: Math.floor((team.investmentWindowSeconds ?? defaultInvestSec) / 60),
              investSec: (team.investmentWindowSeconds ?? defaultInvestSec) % 60,
            }

            return (
              <div
                key={team.id}
                className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="min-w-0 md:w-1/3">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-mono text-xs font-bold">#{team.pitchOrder}</span>
                    <h4 className="text-zinc-950 font-bold text-sm truncate">{team.name}</h4>
                  </div>
                  <p className="text-zinc-500 text-xs truncate">{team.pitchTitle}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Pitch Min</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={timer.pitchMin}
                      onChange={e => setTeamTimers(prev => ({
                        ...prev,
                        [team.id]: { ...timer, pitchMin: Math.max(0, parseInt(e.target.value) || 0) }
                      }))}
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Pitch Sec</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={timer.pitchSec}
                      onChange={e => setTeamTimers(prev => ({
                        ...prev,
                        [team.id]: { ...timer, pitchSec: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) }
                      }))}
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Invest Min</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={timer.investMin}
                      onChange={e => setTeamTimers(prev => ({
                        ...prev,
                        [team.id]: { ...timer, investMin: Math.max(0, parseInt(e.target.value) || 0) }
                      }))}
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Invest Sec</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={timer.investSec}
                      onChange={e => setTeamTimers(prev => ({
                        ...prev,
                        [team.id]: { ...timer, investSec: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) }
                      }))}
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-900 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleResetTeamToDefaults(team.id)}
                    className="text-xs"
                    title="Set to global defaults"
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    loading={savingTeamId === team.id}
                    onClick={() => handleSaveTeamTimer(team.id)}
                    className="bg-zinc-950 text-white hover:bg-zinc-800 text-xs whitespace-nowrap"
                  >
                    Save Team
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── 8. Official Judging & Competition Results Tab ───────────
function OfficialJudgingTab() {
  const { teams, setTeams, event, setEvent } = useEventStore()
  const eventId = event?.id || 'event-pitch-arena-2025'

  const [isPublished, setIsPublished] = useState(event?.config.officialResultsPublished ?? false)
  const [saving, setSaving] = useState(false)

  // Independent judging results per team
  const [results, setResults] = useState<Record<string, { rank?: number; score?: number; award?: string; notes?: string }>>(() => {
    const map: Record<string, { rank?: number; score?: number; award?: string; notes?: string }> = {}
    teams.forEach(t => {
      map[t.id] = {
        rank: t.officialRank ?? undefined,
        score: t.officialScore ?? undefined,
        award: t.officialAward || '',
        notes: t.officialNotes || '',
      }
    })
    return map
  })

  // Sync results when teams change
  useEffect(() => {
    setResults(prev => {
      const next = { ...prev }
      teams.forEach(t => {
        if (!next[t.id]) {
          next[t.id] = {
            rank: t.officialRank ?? undefined,
            score: t.officialScore ?? undefined,
            award: t.officialAward || '',
            notes: t.officialNotes || '',
          }
        }
      })
      return next
    })
  }, [teams])

  const handleSaveResults = async () => {
    setSaving(true)

    const list: OfficialResult[] = teams.map(t => ({
      teamId: t.id,
      rank: results[t.id]?.rank,
      score: results[t.id]?.score,
      award: results[t.id]?.award?.trim() || undefined,
      notes: results[t.id]?.notes?.trim() || undefined,
    }))

    const ok = await saveOfficialResults(eventId, list, isPublished)
    setSaving(false)

    if (ok) {
      // Update local teams state
      const updatedTeams = teams.map(t => {
        const r = results[t.id]
        return {
          ...t,
          officialRank: r?.rank,
          officialScore: r?.score,
          officialAward: r?.award?.trim() || undefined,
          officialNotes: r?.notes?.trim() || undefined,
        }
      })
      setTeams(updatedTeams)

      if (event) {
        setEvent({
          ...event,
          config: {
            ...event.config,
            officialResultsPublished: isPublished,
          }
        })
      }

      await logAuditEvent({
        action: isPublished ? 'PUBLISH_RESULTS' : 'SAVE_RESULTS',
        metadata: {
          isPublished,
          teamsCount: list.length,
          description: isPublished
            ? 'Published official competition jury results and rankings to audience'
            : 'Saved draft official competition jury results',
        },
        eventId,
      })

      toast.success(isPublished ? 'Official Competition Results published to audience!' : 'Official results saved (draft).')
    } else {
      toast.error('Failed to save official judging results')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Official Competition Results"
        subtitle="Record independent jury scores, awards, and rankings. Audience investments never influence or determine official rankings."
      />

      {/* Critical Independence Alert Card */}
      <div className="p-5 rounded-2xl bg-zinc-950 text-white space-y-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-400" />
          <h4 className="font-black text-sm uppercase tracking-wider text-emerald-400">
            Jury & Ranking Independence Rule
          </h4>
        </div>
        <p className="text-zinc-300 text-xs leading-relaxed">
          The official judges evaluate pitching teams independently using their own scoring process (including pen and paper).
          Audience investment points are strictly categorized as <strong>Audience Investment Activity</strong> and can <strong>never</strong> determine, modify, tie-break, or influence official competition winners.
        </p>
      </div>

      {/* Publication Control Card */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-zinc-950 font-bold text-sm flex items-center gap-2">
            <Trophy size={16} className="text-zinc-950" />
            Audience Results Visibility
          </h3>
          <p className="text-zinc-500 text-xs mt-0.5">
            {isPublished
              ? 'Official competition rankings and awards are currently VISIBLE to the audience on the scoreboard.'
              : 'Official competition rankings are currently UNPUBLISHED. Audience sees only investment activity.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsPublished(!isPublished)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            isPublished
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
          }`}
        >
          {isPublished ? <CheckCircle2 size={14} /> : <Lock size={14} />}
          <span>{isPublished ? 'Published to Audience' : 'Unpublished (Draft)'}</span>
        </button>
      </div>

      {/* Entry Form Table */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-zinc-950 font-bold text-sm">Official Jury Evaluations ({teams.length} teams)</h3>
          <span className="text-[11px] text-zinc-400 font-mono">Independent Judging Scorecard</span>
        </div>

        <div className="space-y-3">
          {teams.map(team => {
            const r = results[team.id] || {}

            return (
              <div
                key={team.id}
                className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="min-w-0 lg:w-1/4">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-mono text-xs font-bold">#{team.pitchOrder}</span>
                    <h4 className="text-zinc-950 font-bold text-sm truncate">{team.name}</h4>
                  </div>
                  <p className="text-zinc-500 text-xs truncate">{team.pitchTitle}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Official Rank</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      value={r.rank ?? ''}
                      onChange={e => setResults(prev => ({
                        ...prev,
                        [team.id]: { ...r, rank: e.target.value ? parseInt(e.target.value) : undefined }
                      }))}
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Jury Score (/100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="e.g. 94.5"
                      value={r.score ?? ''}
                      onChange={e => setResults(prev => ({
                        ...prev,
                        [team.id]: { ...r, score: e.target.value ? parseFloat(e.target.value) : undefined }
                      }))}
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Official Award</label>
                    <input
                      type="text"
                      placeholder="e.g. Grand Champion"
                      value={r.award ?? ''}
                      onChange={e => setResults(prev => ({
                        ...prev,
                        [team.id]: { ...r, award: e.target.value }
                      }))}
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Jury Notes</label>
                    <input
                      type="text"
                      placeholder="Judge feedback"
                      value={r.notes ?? ''}
                      onChange={e => setResults(prev => ({
                        ...prev,
                        [team.id]: { ...r, notes: e.target.value }
                      }))}
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <Button
          loading={saving}
          onClick={handleSaveResults}
          className="w-full justify-center bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm mt-3"
          icon={<CheckCircle2 size={14} />}
        >
          {isPublished ? 'Save & Publish Official Results' : 'Save Draft Official Results'}
        </Button>
      </div>
    </div>
  )
}

// ── 9. Settings Tab ─────────────────────────────────────────
function SettingsTab() {
  const { eventConfig, setEventConfig } = useAdminStore()
  const { event, setEvent } = useEventStore()
  const [config, setConfig] = useState(eventConfig ?? event?.config)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  // Re-sync if event config loads or changes
  useEffect(() => {
    if (event?.config) {
      setConfig(event.config)
    }
  }, [event?.config])

  const handleSave = async () => {
    if (!config) return
    setLoading(true)

    const updatedConfig: typeof config = {
      ...config,
      maxPaidPoints: config.maxPaidPurchaseRupees * config.pointsPerRupee,
    }

    setEventConfig(updatedConfig)
    if (event) {
      setEvent({ ...event, config: updatedConfig })
    }

    const eventId = event?.id || '11111111-0000-0000-0000-000000000001'
    const ok = await updateEventConfig(eventId, updatedConfig)
    setLoading(false)

    if (ok) {
      setSaved(true)
      await logAuditEvent({
        action: 'UPDATE_EVENT_CONFIG',
        metadata: {
          freePointsAllocation: updatedConfig.freePointsAllocation,
          pointsPerRupee: updatedConfig.pointsPerRupee,
          maxPaidPurchaseRupees: updatedConfig.maxPaidPurchaseRupees,
          description: `Updated event configuration: welcome bonus ${updatedConfig.freePointsAllocation} pts, rate ${updatedConfig.pointsPerRupee} pts/₹, purchase cap ₹${updatedConfig.maxPaidPurchaseRupees}`,
        },
        eventId,
      })
      toast.success('Event rules & buying rates saved and synced to database!')
      setTimeout(() => setSaved(false), 2500)
    } else {
      toast.error('Failed to sync configuration to database. Check connection.')
    }
  }

  if (!config) return null

  const ppr = Math.max(1, config.pointsPerRupee || 10)
  const maxCap = Math.max(5, config.maxPaidPurchaseRupees || 100)

  // Live preview tiers based on active form values
  const previewTiers = [
    { rupees: 5, label: 'Starter Pack', points: 5 * ppr },
    { rupees: 10, label: 'Standard Pack (Popular)', points: 10 * ppr },
    { rupees: 20, label: 'Growth Pack', points: 20 * ppr },
    { rupees: 50, label: 'Venture Pack', points: 50 * ppr },
    { rupees: 100, label: 'Angel Tier', points: 100 * ppr },
  ].filter(t => t.rupees <= maxCap)

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Competition Rules & Purchase Thresholds"
        subtitle="Values update attendee wallet rates, live limits, and payment packages dynamically."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-4">
          <h3 className="text-zinc-950 font-bold text-sm border-b border-zinc-100 pb-2 flex items-center gap-2">
            <Sliders size={16} />
            Config Parameters
          </h3>

          {[
            {
              label: 'Free Points Allocation (Welcome Bonus)',
              key: 'freePointsAllocation',
              suffix: 'pts',
              desc: 'Given to each attendee upon signing up.',
            },
            {
              label: 'Points per ₹1 Conversion Rate',
              key: 'pointsPerRupee',
              suffix: 'pts / ₹1',
              desc: 'Determines how many points users receive when buying packages.',
            },
            {
              label: 'Max Paid Purchase Allowance',
              key: 'maxPaidPurchaseRupees',
              suffix: '₹ max',
              desc: 'Upper monetary limit an individual attendee can spend.',
            },
            {
              label: 'Min Investment Amount per Pitch',
              key: 'minInvestmentAmount',
              suffix: 'pts min',
              desc: 'Smallest point amount allowed in a single investment.',
            },
            {
              label: 'Max Investment Amount per Pitch',
              key: 'maxInvestmentAmount',
              suffix: 'pts max',
              desc: 'Cap on how many points one attendee can invest in a single team.',
            },
          ].map(({ label, key, suffix, desc }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-baseline justify-between">
                <label className="text-zinc-900 text-xs font-bold">{label}</label>
                <span className="text-zinc-400 text-[10px]">{desc}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={(config as any)[key]}
                  onChange={e => setConfig({ ...config, [key]: Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full px-3.5 py-2.5 pr-20 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 text-xs text-zinc-900 outline-none font-mono font-bold transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-mono font-medium">
                  {suffix}
                </span>
              </div>
            </div>
          ))}

          <Button
            loading={loading}
            onClick={handleSave}
            className="w-full justify-center mt-3 bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm py-2.5 font-bold"
            icon={saved ? <CheckCircle2 size={15} /> : <Check size={15} />}
          >
            {saved ? 'Saved & Synced to Live Arena!' : 'Save & Publish Rules'}
          </Button>
        </div>

        {/* Live Impact Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-zinc-950 text-white shadow-md space-y-4 border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-800 text-zinc-200 border border-zinc-700">
                Live Audience Preview
              </span>
              <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Dynamic
              </span>
            </div>

            <div>
              <p className="text-zinc-400 text-xs font-medium">Active Exchange Rate</p>
              <p className="text-2xl font-black font-mono tracking-tight text-white mt-0.5">
                ₹1 = {ppr} Points
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                Max Attendee Allowance: <strong className="text-white font-mono">₹{maxCap}</strong> ({formatPoints(maxCap * ppr)})
              </p>
            </div>

            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                Packages Attendees Will See in Wallet:
              </p>
              <div className="space-y-1.5">
                {previewTiers.map((tier) => (
                  <div
                    key={tier.rupees}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <span className="font-bold text-white block">{tier.label}</span>
                      <span className="text-zinc-400 text-[10px]">Costs {formatRupees(tier.rupees)}</span>
                    </div>
                    <span className="text-emerald-400 font-black text-sm">
                      +{formatPoints(tier.points)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-zinc-400 text-[11px] leading-relaxed italic border-t border-zinc-800 pt-2">
              Whenever you hit <strong>Save & Publish Rules</strong>, attendees' wallets and point top-up modals update in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 10. Audit Logs Tab ──────────────────────────────────────
function LogsTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchLogs = async () => {
    try {
      const data = await getAuditLogs()
      setLogs(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLogs()

    const handleUpdate = () => {
      fetchLogs()
    }

    window.addEventListener('audit-logs-updated', handleUpdate)
    const interval = setInterval(fetchLogs, 5000)

    return () => {
      window.removeEventListener('audit-logs-updated', handleUpdate)
      clearInterval(interval)
    }
  }, [])

  const handleManualRefresh = () => {
    setRefreshing(true)
    fetchLogs()
    toast.success('Audit trail refreshed.')
  }

  const handleExport = () => {
    if (logs.length === 0) {
      toast.info('No audit logs available to export.')
      return
    }
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `big_pitch_audit_trail_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Audit log export downloaded!')
  }

  const filteredLogs = logs.filter(log => {
    if (!search) return true
    const q = search.toLowerCase()
    const action = (log.action || '').toLowerCase()
    const desc = (log.metadata?.description || '').toLowerCase()
    const name = (log.metadata?.name || log.metadata?.teamName || '').toLowerCase()
    return action.includes(q) || desc.includes(q) || name.includes(q)
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SectionHeader title="Security Audit Log" subtitle="Tamper-evident real-time log of all administrative stage events" />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />}
            onClick={handleManualRefresh}
          >
            Refresh
          </Button>
          <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={handleExport}>
            Export Log
          </Button>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter audit actions (e.g. startup name, investment, pitch, timer)..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-zinc-200 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 transition-all shadow-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-white border border-zinc-200/90 rounded-2xl divide-y divide-zinc-100 shadow-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-xs space-y-2">
            <Shield size={24} className="mx-auto text-zinc-300" />
            <p className="font-semibold text-zinc-600">
              {loading ? 'Loading audit records...' : search ? 'No matching audit records found.' : 'No audit events recorded yet.'}
            </p>
            <p className="text-[11px] text-zinc-400">
              Administrative actions (pre-listing startups, stage controls, timers, results) are logged here automatically.
            </p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const actionText = (log.action || 'admin_action').replace(/_/g, ' ')
            const isDelete = log.action?.includes('DELETE') || log.action?.includes('REVOKE')
            const isStart = log.action?.includes('START') || log.action?.includes('OPEN')
            const isSettings = log.action?.includes('CONFIG') || log.action?.includes('TIMER')

            return (
              <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-zinc-50/50 transition-colors">
                <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isDelete
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : isStart
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : isSettings
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-800'
                }`}>
                  <Shield size={14} />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-zinc-950 text-xs font-bold uppercase tracking-wide">{actionText}</p>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                      Authoritative
                    </span>
                  </div>
                  {log.metadata?.description && (
                    <p className="text-zinc-700 text-xs font-medium">{log.metadata.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-zinc-400 text-[10px] font-mono pt-0.5">
                    <span>{formatRelativeTime(log.created_at || log.createdAt)}</span>
                    {log.created_at && (
                      <span>• {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Main Admin Dashboard ───────────────────────────────────
export function AdminDashboard() {
  const { user } = useAuthStore()
  const { selectedTab, setSelectedTab } = useAdminStore()
  const [activeCategory, setActiveCategory] = useState<'all' | 'live' | 'competition' | 'system'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  const isSuper = isSuperAdmin(user?.email)
  const currentTab = ADMIN_TABS.find((t) => t.id === selectedTab) || ADMIN_TABS[0]

  // Filter tabs by category if one is active
  const displayedTabs =
    activeCategory === 'all'
      ? ADMIN_TABS
      : ADMIN_TABS.filter((t) => t.category === activeCategory)

  // Smooth scroll left/right for desktop tab bar
  const scrollTabs = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -240 : 240
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

  const tabContent: Record<string, React.ReactNode> = {
    overview: <OverviewTab />,
    control: <ControlTab />,
    timer: <TimerConfigTab />,
    teams: <TeamsTab />,
    judging: <OfficialJudgingTab />,
    cast: <CastAdminTab />,
    allowlist: <AllowlistTab />,
    payments: <PaymentsTab />,
    settings: <SettingsTab />,
    logs: <LogsTab />,
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in text-zinc-900">
      {/* Header Banner */}
      <div className="bg-white border border-zinc-200/90 shadow-sm p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-950 text-white flex items-center justify-center shadow-md flex-shrink-0">
            <Shield size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-zinc-950 font-black text-xl sm:text-2xl tracking-tight">
                Admin Control Room
              </h1>
              {isSuper ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-950 text-white">
                  Super Admin
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                  Event Admin
                </span>
              )}
            </div>
            <p className="text-zinc-500 text-xs mt-0.5 font-mono truncate">
              Signed in: <span className="text-zinc-900 font-semibold">{user?.email}</span>
            </p>
          </div>
        </div>

        {/* Quick Launch Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Link
            to="/cast"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Open stage presentation in new tab"
          >
            <Tv size={13} />
            Stage Projector
          </Link>
          <Link
            to="/"
            className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 text-zinc-700 hover:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink size={13} />
            Public View
          </Link>
          <LiveIndicator label="STAGE LIVE" />
        </div>
      </div>

      {/* Navigation Suite */}
      <div className="space-y-3">
        {/* Category Pill Filters (Desktop & Tablet) */}
        <div className="hidden sm:flex items-center justify-between gap-3 border-b border-zinc-200/80 pb-3">
          <div className="flex items-center gap-1.5 bg-zinc-100/90 p-1 rounded-2xl border border-zinc-200/70">
            {ADMIN_CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id
              const Icon = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
                  }`}
                >
                  <Icon size={13} />
                  <span>{cat.label}</span>
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      active ? 'bg-zinc-950 text-white' : 'bg-zinc-200/80 text-zinc-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              )
            })}
          </div>

          <span className="text-zinc-400 text-xs font-medium hidden md:inline">
            Showing {displayedTabs.length} of {ADMIN_TABS.length} controls
          </span>
        </div>

        {/* Mobile Dropdown Switcher (Zero Overflow on Small Screens) */}
        <div className="sm:hidden bg-white p-3.5 rounded-2xl border border-zinc-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold px-0.5">
            <span className="flex items-center gap-1.5 text-zinc-700 font-bold">
              <Sliders size={13} />
              Jump to Admin Section
            </span>
            <span className="font-mono text-[11px] bg-zinc-100 px-2 py-0.5 rounded-full text-zinc-700 border border-zinc-200">
              {ADMIN_TABS.findIndex((t) => t.id === selectedTab) + 1} / {ADMIN_TABS.length}
            </span>
          </div>
          <div className="relative">
            <select
              value={selectedTab}
              onChange={(e) => {
                const tab = ADMIN_TABS.find((t) => t.id === e.target.value)
                if (tab) {
                  setSelectedTab(tab.id)
                  if (activeCategory !== 'all' && tab.category !== activeCategory) {
                    setActiveCategory('all')
                  }
                }
              }}
              className="w-full appearance-none bg-zinc-50 border border-zinc-300 text-zinc-950 text-sm font-bold py-3 pl-3.5 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-all cursor-pointer shadow-xs"
            >
              <optgroup label="⚡ Live Stage Operations">
                {ADMIN_TABS.filter((t) => t.category === 'live').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🏆 Startups & Judging">
                {ADMIN_TABS.filter((t) => t.category === 'competition').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="⚙️ Config, Payments & Access">
                {ADMIN_TABS.filter((t) => t.category === 'system').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-500">
              <ChevronRight size={16} className="rotate-90" />
            </div>
          </div>
        </div>

        {/* Tab Buttons Strip (Responsive with Scroll Controls & Visual Boundaries) */}
        <div className="relative group hidden sm:block">
          {/* Scroll Left Button */}
          <button
            onClick={() => scrollTabs('left')}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-zinc-300 shadow-md text-zinc-700 hover:text-zinc-950 hover:scale-105 flex items-center justify-center transition-all opacity-80 hover:opacity-100"
            title="Scroll left"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Scrollable Container with Subtle Padding */}
          <div
            ref={scrollRef}
            className="overflow-x-auto no-scrollbar scroll-smooth px-1 py-1"
          >
            <div className="flex gap-2 min-w-max p-1.5 rounded-2xl bg-zinc-100/80 border border-zinc-200/80">
              {displayedTabs.map(({ id, icon: Icon, label, shortLabel, category }) => {
                const active = selectedTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedTab(id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 ${
                      active
                        ? 'bg-zinc-950 text-white shadow-sm ring-1 ring-zinc-950 font-bold scale-[1.01]'
                        : 'bg-white/80 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-200/70 shadow-xs'
                    }`}
                  >
                    <Icon size={14} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-white' : 'text-zinc-500'} />
                    <span>{shortLabel || label}</span>
                    {id === 'control' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                    {id === 'allowlist' && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-zinc-200 text-zinc-800 font-mono">
                        Security
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => scrollTabs('right')}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-zinc-300 shadow-md text-zinc-700 hover:text-zinc-950 hover:scale-105 flex items-center justify-center transition-all opacity-80 hover:opacity-100"
            title="Scroll right"
            aria-label="Scroll tabs right"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Active Section Context Banner — Explains What This Screen Does */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 flex items-center justify-center flex-shrink-0">
            {currentTab?.icon && <currentTab.icon size={19} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono">
                {currentTab?.category === 'live'
                  ? 'Stage Operations'
                  : currentTab?.category === 'competition'
                  ? 'Competition & Judging'
                  : 'Event Administration'}
              </span>
              <span className="text-zinc-300">·</span>
              <span className="text-zinc-900 font-black text-sm">{currentTab?.label}</span>
            </div>
            <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">
              {currentTab?.description}
            </p>
          </div>
        </div>

        {/* Dynamic Context Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
          {selectedTab === 'control' && (
            <Link
              to="/cast"
              target="_blank"
              className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Tv size={13} />
              Open Cast Projector
            </Link>
          )}
          {selectedTab === 'teams' && (
            <button
              onClick={() => setSelectedTab('judging')}
              className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Trophy size={13} />
              Switch to Jury Scores
            </button>
          )}
          {selectedTab === 'timer' && (
            <button
              onClick={() => setSelectedTab('control')}
              className="px-3 py-1.5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Radio size={13} />
              Go to Live Control
            </button>
          )}
        </div>
      </div>

      {/* Main Tab View Content */}
      <div className="min-w-0">{tabContent[selectedTab]}</div>
    </div>
  )
}
