import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  CreditCard,
  TrendingUp,
  Gift,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  X,
  Check,
  AlertTriangle,
  ArrowRight,
  Code,
  Copy,
  User,
  Users,
  Shield,
  FileText,
  Plus,
  Edit2,
  QrCode,
  Upload,
  Image as ImageIcon,
  DollarSign,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  getAdminQRPayments,
  getAdminPaymentIntents,
  getAdminWebhookEvents,
  adminManualMatchPayment,
  adminRejectPayment,
  adminFlagIntent,
  getAdminUsersList,
  adminAdjustUserPoints,
  adminDeleteUser,
  getPackageQRCodes,
  adminUpdatePackageQRCode,
  uploadPackageQRImage,
  adminDeletePaymentIntent,
  getPaymentMode,
  setPaymentMode as savePaymentMode,
} from '@/lib/supabaseApi'
import { isSuperAdmin } from '@/lib/adminConfig'
import { formatPoints, formatRupees, formatRelativeTime } from '@/lib/utils'
import type {
  QRPayment,
  PaymentIntent,
  WebhookEventRecord,
  AdminUserInfo,
  PackageQRCode,
  PaymentMode,
} from '@/types'
import { useAdminStore, useEventStore, useAuthStore } from '@/store'

export function AdminPaymentsCockpit() {
  const { eventConfig } = useAdminStore()
  const { event } = useEventStore()
  const { user: currentUser } = useAuthStore()
  const isCurrentSuperAdmin = isSuperAdmin(currentUser?.email)
  const pointsPerRupee = Math.max(1, eventConfig?.pointsPerRupee ?? event?.config?.pointsPerRupee ?? 10)

  const paymentEventId = event?.id || '11111111-0000-0000-0000-000000000001'
  const [paymentMode, setPaymentModeState] = useState<PaymentMode | null>(null)
  const [savingMode, setSavingMode] = useState(false)

  useEffect(() => {
    getPaymentMode(paymentEventId).then(setPaymentModeState)
  }, [paymentEventId])

  const handleSwitchMode = async (mode: PaymentMode) => {
    if (mode === paymentMode || savingMode) return
    const label = mode === 'portal' ? 'Razorpay Payment Portal (automatic)' : 'UPI QR (manual match)'
    if (!window.confirm(`Switch checkout to ${label}? Attendees will see the change immediately.`)) return
    setSavingMode(true)
    const res = await savePaymentMode(paymentEventId, mode)
    setSavingMode(false)
    if (res.success) {
      setPaymentModeState(mode)
      toast.success(`Checkout is now ${mode === 'portal' ? 'Razorpay Portal' : 'UPI QR'}`)
    } else {
      toast.error(res.error || 'Could not change payment mode')
    }
  }

  const [payments, setPayments] = useState<QRPayment[]>([])
  const [intents, setIntents] = useState<PaymentIntent[]>([])
  const [webhookLogs, setWebhookLogs] = useState<WebhookEventRecord[]>([])
  const [usersList, setUsersList] = useState<AdminUserInfo[]>([])
  const [packagesList, setPackagesList] = useState<PackageQRCode[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Sub-tab selection
  const [activeTab, setActiveTab] = useState<'unmatched' | 'all-payments' | 'intents' | 'users' | 'packages' | 'webhooks'>('unmatched')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [matchModalPayment, setMatchModalPayment] = useState<QRPayment | null>(null)
  const [selectedIntentId, setSelectedIntentId] = useState<string>('')
  const [manualMatchNotes, setManualMatchNotes] = useState('')
  const [matchingSubmitting, setMatchingSubmitting] = useState(false)

  const [rejectModalPayment, setRejectModalPayment] = useState<QRPayment | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  const [jsonModalData, setJsonModalData] = useState<{ title: string; json: any } | null>(null)
  const [copiedJson, setCopiedJson] = useState(false)

  // Point Adjustment Modal State
  const [adjustModalUser, setAdjustModalUser] = useState<AdminUserInfo | null>(null)
  const [adjustPoints, setAdjustPoints] = useState<number>(500)
  const [adjustRupees, setAdjustRupees] = useState<number>(0)
  const [adjustReason, setAdjustReason] = useState<string>('Emergency Token Adjustment')
  const [adjustSubmitting, setAdjustSubmitting] = useState(false)

  // Super Admin Delete User Modal State
  const [deleteModalUser, setDeleteModalUser] = useState<AdminUserInfo | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingUser, setDeletingUser] = useState(false)
  const [deletingIntentId, setDeletingIntentId] = useState<string | null>(null)

  // Package QR Code Edit State
  const [editingPackage, setEditingPackage] = useState<PackageQRCode | null>(null)
  const [editQrUrl, setEditQrUrl] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editRupees, setEditRupees] = useState<number>(50)
  const [editPoints, setEditPoints] = useState<number>(500)
  const [editActive, setEditActive] = useState<boolean>(true)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Direct Image Upload State
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showManualUrlInput, setShowManualUrlInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageFile = async (file: File) => {
    if (!editingPackage) return
    setUploadingImage(true)
    try {
      const res = await uploadPackageQRImage(editingPackage.id, file)
      if (res.success && res.url) {
        setEditQrUrl(res.url)
        toast.success('QR image attached successfully!')
      } else {
        toast.error(res.error || 'Failed to process image file')
      }
    } catch {
      toast.error('Failed to process image upload')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageFile(e.dataTransfer.files[0])
    }
  }

  // 1. Load Data
  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)

    try {
      const [qrData, intentsData, webhooksData, usersData, pkgsData] = await Promise.all([
        getAdminQRPayments(),
        getAdminPaymentIntents(),
        getAdminWebhookEvents(),
        getAdminUsersList(),
        getPackageQRCodes(),
      ])

      setPayments(qrData)
      setIntents(intentsData)
      setWebhookLogs(webhooksData)
      setUsersList(usersData)
      setPackagesList(pkgsData)
    } catch (err) {
      console.error('Failed to load payment reconciliation data:', err)
      toast.error('Could not refresh payment records')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 2. Realtime Subscriptions + 5s Auto-sync Heartbeat
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('admin_payment_reconciliation')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qr_payments' }, () => {
        loadData(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_intents' }, () => {
        loadData(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'package_qr_codes' }, () => {
        loadData(true)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_events' }, () => {
        loadData(true)
      })
      .subscribe()

    // 5-second background heartbeat ensures zero manual refresh is ever needed
    const interval = setInterval(() => {
      loadData(true)
    }, 5000)

    return () => {
      clearInterval(interval)
      if (supabase) supabase.removeChannel(channel)
    }
  }, [])

  // 3. Computed Metrics
  const metrics = useMemo(() => {
    const totalRupees = payments
      .filter(p => p.status === 'matched')
      .reduce((acc, p) => acc + p.rupeeAmount, 0)

    const pointsIssued = intents
      .filter(i => i.status === 'credited')
      .reduce((acc, i) => acc + i.pointsToCredit, 0)

    const unmatchedCount = payments.filter(p => p.status === 'unmatched').length
    const pendingIntentsCount = intents.filter(i => i.status === 'pending' || i.status === 'processing').length
    const totalAudienceUsers = usersList.length

    return {
      totalRupees,
      pointsIssued,
      unmatchedCount,
      pendingIntentsCount,
      totalAudienceUsers,
    }
  }, [payments, intents, usersList])

  // 4. Filtered Items
  const filteredPayments = useMemo(() => {
    let list = payments
    if (activeTab === 'unmatched') {
      list = list.filter(p => p.status === 'unmatched' || p.status === 'manual_review')
    }

    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()

    return list.filter(p =>
      (p.bankRrn && p.bankRrn.toLowerCase().includes(q)) ||
      (p.payerVpa && p.payerVpa.toLowerCase().includes(q)) ||
      p.razorpayPaymentId.toLowerCase().includes(q) ||
      (p.matchedUserEmail && p.matchedUserEmail.toLowerCase().includes(q)) ||
      p.rupeeAmount.toString().includes(q)
    )
  }, [payments, activeTab, searchQuery])

  const filteredIntents = useMemo(() => {
    if (!searchQuery.trim()) return intents
    const q = searchQuery.toLowerCase().trim()
    return intents.filter(i =>
      i.claimCode.toLowerCase().includes(q) ||
      (i.userVpa && i.userVpa.toLowerCase().includes(q)) ||
      (i.userUtr && i.userUtr.toLowerCase().includes(q)) ||
      (i.userEmail && i.userEmail.toLowerCase().includes(q)) ||
      i.rupeeAmount.toString().includes(q)
    )
  }, [intents, searchQuery])

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return usersList
    const q = searchQuery.toLowerCase().trim()
    return usersList.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      (u.upiId && u.upiId.toLowerCase().includes(q))
    )
  }, [usersList, searchQuery])

  const filteredWebhooks = useMemo(() => {
    if (!searchQuery.trim()) return webhookLogs
    const q = searchQuery.toLowerCase().trim()
    return webhookLogs.filter(w =>
      w.eventType.toLowerCase().includes(q) ||
      (w.eventId && w.eventId.toLowerCase().includes(q)) ||
      (w.errorMessage && w.errorMessage.toLowerCase().includes(q))
    )
  }, [webhookLogs, searchQuery])

  // Candidate intents for manual match
  const candidateIntents = useMemo(() => {
    if (!matchModalPayment) return []
    return intents.filter(
      i =>
        (i.status === 'pending' || i.status === 'processing' || i.status === 'manual_review') &&
        i.rupeeAmount === matchModalPayment.rupeeAmount
    )
  }, [matchModalPayment, intents])

  // Execute Manual Match
  const handleExecuteManualMatch = async () => {
    if (!matchModalPayment || !selectedIntentId) {
      toast.error('Please select an audience intent to link.')
      return
    }

    setMatchingSubmitting(true)
    const res = await adminManualMatchPayment(
      matchModalPayment.razorpayPaymentId,
      selectedIntentId,
      manualMatchNotes.trim() || undefined
    )

    if (res.success) {
      toast.success(res.message || 'Payment successfully matched & tokens credited!')
      setMatchModalPayment(null)
      setSelectedIntentId('')
      setManualMatchNotes('')
      loadData(true)
    } else {
      toast.error(res.error || 'Failed to match payment')
    }
    setMatchingSubmitting(false)
  }

  // Execute Reject
  const handleExecuteReject = async () => {
    if (!rejectModalPayment || !rejectReason.trim()) {
      toast.error('Please specify a rejection reason for the audit log.')
      return
    }

    setRejectSubmitting(true)
    const res = await adminRejectPayment(rejectModalPayment.razorpayPaymentId, rejectReason.trim())

    if (res.success) {
      toast.success('Payment marked as rejected.')
      setRejectModalPayment(null)
      setRejectReason('')
      loadData(true)
    } else {
      toast.error(res.error || 'Failed to reject payment')
    }
    setRejectSubmitting(false)
  }

  // Execute Admin Points Adjustment for a User
  const handleExecutePointAdjustment = async () => {
    if (!adjustModalUser || adjustPoints === 0) {
      toast.error('Please enter a non-zero point value')
      return
    }

    setAdjustSubmitting(true)
    const eventId = '11111111-0000-0000-0000-000000000001'
    const res = await adminAdjustUserPoints(
      adjustModalUser.id,
      eventId,
      adjustPoints,
      adjustRupees,
      adjustReason.trim() || 'Admin Manual Adjustment'
    )

    if (res.success) {
      toast.success(`Successfully added ${adjustPoints} points to ${adjustModalUser.displayName || adjustModalUser.email}!`)
      setAdjustModalUser(null)
      setAdjustPoints(500)
      setAdjustRupees(0)
      loadData(true)
    } else {
      toast.error(res.error || 'Failed to adjust points')
    }
    setAdjustSubmitting(false)
  }

  // Execute Permanent User Deletion (Super Admin Only)
  const handleExecuteDeleteUser = async () => {
    if (!deleteModalUser) return
    setDeletingUser(true)
    try {
      const res = await adminDeleteUser(deleteModalUser.id)
      if (res.success) {
        toast.success(res.message || `User ${deleteModalUser.email} permanently deleted.`)
        setDeleteModalUser(null)
        setDeleteConfirmText('')
        await loadData(true)
      } else {
        toast.error(res.error || 'Failed to delete user.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error occurred while deleting user.')
    } finally {
      setDeletingUser(false)
    }
  }

  // Execute Delete Payment Intent / Purchase Claim
  const handleDeleteIntent = async (intentId: string, claimCode: string) => {
    if (!window.confirm(`Are you sure you want to delete purchase claim "${claimCode}"? This will unlink any associated QR payment.`)) {
      return
    }

    setDeletingIntentId(intentId)
    try {
      const res = await adminDeletePaymentIntent(intentId)
      if (res.success) {
        toast.success(`Purchase claim ${claimCode} deleted.`)
        await loadData(true)
      } else {
        toast.error(res.error || 'Failed to delete purchase claim.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error deleting purchase claim.')
    } finally {
      setDeletingIntentId(null)
    }
  }

  // Execute Package QR Code Update
  const handleSavePackageQR = async () => {
    if (!editingPackage) return

    setEditSubmitting(true)
    const res = await adminUpdatePackageQRCode({
      id: editingPackage.id,
      label: editLabel.trim(),
      rupeeAmount: editRupees,
      points: editPoints,
      qrImageUrl: editQrUrl.trim() || undefined,
      isActive: editActive,
    })

    if (res.success) {
      toast.success(`Updated QR configuration for ${editLabel}!`)
      setEditingPackage(null)
      loadData(true)
    } else {
      toast.error(res.error || 'Failed to update package QR code')
    }
    setEditSubmitting(false)
  }

  const handleCopyJson = () => {
    if (!jsonModalData) return
    navigator.clipboard.writeText(JSON.stringify(jsonModalData.json, null, 2))
    setCopiedJson(true)
    toast.success('JSON copied to clipboard')
    setTimeout(() => setCopiedJson(false), 2000)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cockpit Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight skeuo-text-emboss flex items-center gap-2">
            <span>Payment & User Management Cockpit</span>
            <span className="text-[11px] font-mono font-bold bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded-full border border-zinc-200">
              VPA Auto-Match
            </span>
          </h2>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5 font-medium">
            Manage static QR packages, attendee wallets, point grants, and UPI reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="skeuo-btn-secondary px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 text-zinc-700"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Checkout Mode Switch: exactly one method is live for attendees */}
      <div className="skeuo-surface rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-zinc-950">Attendee Checkout Method</p>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">
            {paymentMode === 'portal'
              ? 'Razorpay Portal is live: payments are verified and credited automatically. New QR claims are blocked.'
              : 'UPI QR is live: payments are matched by UPI ID / UTR. The Razorpay Portal is blocked.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl skeuo-sunken bg-zinc-100 sm:w-80">
          {([
            { id: 'qr', label: 'UPI QR', Icon: QrCode },
            { id: 'portal', label: 'Razorpay Portal', Icon: CreditCard },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              disabled={savingMode || paymentMode === null}
              onClick={() => handleSwitchMode(id)}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 ${
                paymentMode === id ? 'skeuo-pill-active text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="skeuo-surface p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Total Revenue</span>
            <TrendingUp size={15} className="text-zinc-700" />
          </div>
          <p className="text-xl font-black text-zinc-950 font-mono tracking-tight">
            {formatRupees(metrics.totalRupees)}
          </p>
          <span className="text-[10px] text-zinc-500 font-semibold block">Authoritative revenue</span>
        </div>

        <div className="skeuo-surface p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Points Issued</span>
            <Gift size={15} className="text-zinc-700" />
          </div>
          <p className="text-xl font-black text-zinc-950 font-mono tracking-tight">
            {formatPoints(metrics.pointsIssued)}
          </p>
          <span className="text-[10px] text-emerald-600 font-semibold block">Credited to attendees</span>
        </div>

        <div className="skeuo-surface p-4 rounded-2xl space-y-1 border-amber-300/80 bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold">Unmatched</span>
            <AlertCircle size={15} className="text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-900 font-mono tracking-tight">
            {metrics.unmatchedCount}
          </p>
          <span className="text-[10px] text-amber-700 font-medium block">Action required</span>
        </div>

        <div className="skeuo-surface p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Pending Claims</span>
            <Clock size={15} className="text-zinc-700" />
          </div>
          <p className="text-xl font-black text-zinc-950 font-mono tracking-tight">
            {metrics.pendingIntentsCount}
          </p>
          <span className="text-[10px] text-zinc-500 font-semibold block">Awaiting bank settlement</span>
        </div>

        <div className="skeuo-surface p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Audience Users</span>
            <Users size={15} className="text-zinc-700" />
          </div>
          <p className="text-xl font-black text-zinc-950 font-mono tracking-tight">
            {metrics.totalAudienceUsers}
          </p>
          <span className="text-[10px] text-zinc-500 font-semibold block">Active registered accounts</span>
        </div>
      </div>

      {/* Navigation Tabs & Search Controls */}
      <div className="skeuo-surface rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/80 pb-3">
          {/* Sub Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('unmatched')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'unmatched'
                  ? 'skeuo-btn-primary text-white shadow-sm'
                  : 'skeuo-btn-secondary text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <span>Action Needed</span>
              {metrics.unmatchedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-black">
                  {metrics.unmatchedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'skeuo-btn-primary text-white shadow-sm'
                  : 'skeuo-btn-secondary text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <Users size={12} />
              <span>Audience Users ({usersList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('packages')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'packages'
                  ? 'skeuo-btn-primary text-white shadow-sm'
                  : 'skeuo-btn-secondary text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <QrCode size={12} />
              <span>5 Package QRs ({packagesList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all-payments')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'all-payments'
                  ? 'skeuo-btn-primary text-white shadow-sm'
                  : 'skeuo-btn-secondary text-zinc-600 hover:text-zinc-950'
              }`}
            >
              All QR Payments ({payments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('intents')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'intents'
                  ? 'skeuo-btn-primary text-white shadow-sm'
                  : 'skeuo-btn-secondary text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Purchase Claims ({intents.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('webhooks')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'webhooks'
                  ? 'skeuo-btn-primary text-white shadow-sm'
                  : 'skeuo-btn-secondary text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <Code size={12} />
              <span>Webhooks</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search Name, Email, UPI VPA..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl skeuo-sunken text-xs font-mono text-zinc-900 placeholder:text-zinc-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
            />
          </div>
        </div>

        {/* ── TAB 1 & 2: QR PAYMENTS TABLE ───────────────────────────── */}
        {(activeTab === 'unmatched' || activeTab === 'all-payments') && (
          <div className="overflow-x-auto">
            {filteredPayments.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs font-medium">
                {activeTab === 'unmatched'
                  ? '🎉 No unmatched payments! All incoming settlements are reconciled.'
                  : 'No static QR payments found matching search criteria.'}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-mono text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Payer UPI VPA</th>
                    <th className="py-2.5 px-3">Bank UTR / RRN</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Matched User</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredPayments.map(p => {
                    const isMatched = p.status === 'matched'
                    const isUnmatched = p.status === 'unmatched'
                    const isReview = p.status === 'manual_review'
                    const isRejected = p.status === 'rejected'

                    return (
                      <tr key={p.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                          {formatRelativeTime(p.paymentTime)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-zinc-950 text-sm">
                            {formatRupees(p.rupeeAmount)}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-900 font-bold whitespace-nowrap">
                          {p.payerVpa ? (
                            <span className="bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                              {p.payerVpa}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">No VPA</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-600 whitespace-nowrap">
                          {p.bankRrn || <span className="text-zinc-400 italic">—</span>}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                              isMatched
                                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                                : isReview
                                ? 'bg-amber-500/10 text-amber-800 border border-amber-500/30'
                                : isUnmatched
                                ? 'bg-blue-500/10 text-blue-800 border border-blue-500/20'
                                : 'bg-red-500/10 text-red-700 border border-red-500/20'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-600 max-w-[200px] truncate">
                          {p.matchedUserEmail ? (
                            <div className="leading-tight">
                              <span className="font-semibold text-zinc-900 block truncate">
                                {p.matchedUserDisplayName || p.matchedUserEmail}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono truncate block">
                                {p.matchedUserEmail}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {(isUnmatched || isReview) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMatchModalPayment(p)
                                  setSelectedIntentId('')
                                  setManualMatchNotes('')
                                }}
                                className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-[11px] font-bold shadow-sm transition-all flex items-center gap-1"
                              >
                                <Check size={11} />
                                <span>Match</span>
                              </button>
                            )}

                            {!isMatched && !isRejected && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModalPayment(p)
                                  setRejectReason('')
                                }}
                                className="px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-medium transition-colors"
                              >
                                Reject
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setJsonModalData({ title: `Payment ${p.razorpayPaymentId}`, json: p.rawPayload })}
                              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                              title="View raw webhook JSON"
                            >
                              <Code size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── TAB: AUDIENCE USERS & LIVE POINT ADJUSTMENTS ───────────── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>All registered attendee accounts and allocation wallets</span>
              <span className="font-mono font-bold text-zinc-900">{filteredUsers.length} users</span>
            </div>

            <div className="overflow-x-auto">
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs font-medium">
                  No audience members found matching search query.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-400 font-mono text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Attendee</th>
                      <th className="py-2.5 px-3">Saved UPI ID (VPA)</th>
                      <th className="py-2.5 px-3">Purchased</th>
                      <th className="py-2.5 px-3">Invested</th>
                      <th className="py-2.5 px-3">Available Balance</th>
                      <th className="py-2.5 px-3">Total Paid</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="leading-tight">
                            <span className="font-bold text-zinc-950 block">
                              {u.displayName || 'Audience Member'}
                            </span>
                            <span className="text-[11px] text-zinc-500 font-mono block">
                              {u.email}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-zinc-800 whitespace-nowrap">
                          {u.upiId ? (
                            <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 text-zinc-900">
                              {u.upiId}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">Not set</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-700 whitespace-nowrap">
                          {formatPoints(u.purchasedPoints)} pts
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-500 whitespace-nowrap">
                          {formatPoints(u.investedPoints)} pts
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono font-black text-sm text-zinc-950">
                            {formatPoints(u.availablePoints)} pts
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {formatRupees(u.totalPaidRupees)}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustModalUser(u)
                                setAdjustPoints(500)
                                setAdjustRupees(0)
                                setAdjustReason('Admin point resolution during live event')
                              }}
                              className="px-2.5 py-1 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-[11px] font-bold shadow-sm transition-all inline-flex items-center gap-1"
                            >
                              <Plus size={12} />
                              <span>Add Points</span>
                            </button>

                            {isCurrentSuperAdmin && u.id !== currentUser?.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteModalUser(u)
                                  setDeleteConfirmText('')
                                }}
                                className="px-2 py-1 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 text-[11px] font-bold transition-all inline-flex items-center gap-1 shadow-sm"
                                title="Super Admin Only: Permanently Delete User"
                              >
                                <Trash2 size={12} />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: PACKAGE QR CODES MANAGEMENT ───────────────────────── */}
        {activeTab === 'packages' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-emerald-950">Active Conversion Rate: </span>
                <span className="font-mono font-black text-emerald-800 text-sm">₹1 = {pointsPerRupee} Points</span>
                <span className="text-zinc-500 ml-1.5">(Configured in Event Settings)</span>
              </div>
              <span className="text-[11px] text-zinc-600 font-medium">All 5 packages dynamically calculate token grants from this rate.</span>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-600">
              <span>Configure static QR codes and pricing for the 5 fixed token tiers. Changes update immediately across all audience devices.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packagesList.map(pkg => (
                <div
                  key={pkg.id}
                  className="skeuo-surface rounded-2xl p-4 space-y-3.5 border border-zinc-200/90 shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-zinc-950 text-base">
                        {pkg.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        pkg.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-600'
                      }`}>
                        {pkg.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-mono font-black text-xl text-zinc-950">
                        {formatRupees(pkg.rupeeAmount)}
                      </span>
                      <span className="font-bold text-emerald-700">
                        +{formatPoints(pkg.rupeeAmount * pointsPerRupee)} points
                      </span>
                    </div>

                    {/* QR Code Preview */}
                    <div className="flex justify-center p-3 rounded-xl bg-white border border-zinc-200 shadow-inner my-2">
                      {pkg.qrImageUrl ? (
                        <img
                          src={pkg.qrImageUrl}
                          alt={pkg.label}
                          className="w-36 h-36 object-contain rounded"
                        />
                      ) : (
                        <div className="w-36 h-36 flex flex-col items-center justify-center text-center p-2 text-zinc-400 bg-zinc-50 rounded">
                          <QRCodeSVG
                            value={`upi://pay?pa=thebigpitchvedn664812.rzp@rxairtel&pn=The%20Big%20Pitch%20Ved%20Narasalagi&am=${pkg.rupeeAmount}&cu=INR`}
                            size={120}
                          />
                          <span className="text-[9px] text-zinc-500 mt-1 font-mono">Auto-generated</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-500 font-mono truncate">
                      <span>QR Image: </span>
                      {pkg.qrImageUrl ? (
                        <span className="text-zinc-800 truncate">{pkg.qrImageUrl}</span>
                      ) : (
                        <span className="text-zinc-400 italic">Default UPI QR</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingPackage(pkg)
                      setEditLabel(pkg.label)
                      setEditRupees(pkg.rupeeAmount)
                      setEditPoints(pkg.rupeeAmount * pointsPerRupee)
                      setEditQrUrl(pkg.qrImageUrl || '')
                      setEditActive(pkg.isActive)
                      setShowManualUrlInput(false)
                      setUploadingImage(false)
                    }}
                    className="w-full py-2 rounded-xl skeuo-btn-secondary text-xs font-bold flex items-center justify-center gap-1.5 text-zinc-800"
                  >
                    <Edit2 size={12} />
                    <span>Change QR Code / Details</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: AUDIENCE PURCHASE CLAIMS ─────────────────────────── */}
        {activeTab === 'intents' && (
          <div className="overflow-x-auto">
            {filteredIntents.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs font-medium">
                No audience purchase intents found.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-mono text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3">Claim Reference</th>
                    <th className="py-2.5 px-3">Audience User</th>
                    <th className="py-2.5 px-3">Amount & Points</th>
                    <th className="py-2.5 px-3">Payer UPI VPA</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Expires</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredIntents.map(i => {
                    const isCredited = i.status === 'credited'
                    const isExpired = i.status === 'expired'
                    const isReview = i.status === 'manual_review'
                    const isMismatch = i.status === 'vpa_mismatch'

                    return (
                      <tr key={i.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                          {formatRelativeTime(i.createdAt)}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-zinc-950 whitespace-nowrap">
                          <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                            {i.claimCode}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="leading-tight">
                            <span className="font-semibold text-zinc-900 block truncate">
                              {i.userDisplayName || 'Audience Member'}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono block">
                              {i.userEmail || i.userId}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-zinc-950">
                            {formatRupees(i.rupeeAmount)}
                          </span>
                          <span className="text-zinc-500 text-[11px] ml-1">
                            (+{formatPoints(i.pointsToCredit)} pts)
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-zinc-800 whitespace-nowrap">
                          {i.userVpa ? (
                            <span className="bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                              {i.userVpa}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">Not set</span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                              isCredited
                                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                                : isMismatch
                                ? 'bg-rose-500/10 text-rose-800 border border-rose-500/30 font-black'
                                : isReview
                                ? 'bg-amber-500/10 text-amber-800 border border-amber-500/30'
                                : isExpired
                                ? 'bg-zinc-200 text-zinc-600'
                                : 'bg-blue-500/10 text-blue-700 border border-blue-500/20'
                            }`}
                          >
                            {i.status === 'vpa_mismatch' ? 'VPA Mismatch' : i.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                          {new Date(i.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteIntent(i.id, i.claimCode)}
                            disabled={deletingIntentId === i.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 rounded border border-rose-200 transition-colors disabled:opacity-50"
                            title="Delete this purchase claim"
                          >
                            <Trash2 size={12} className={deletingIntentId === i.id ? 'animate-spin' : ''} />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── TAB: WEBHOOK LOGS ─────────────────────────────────────── */}
        {activeTab === 'webhooks' && (
          <div className="overflow-x-auto">
            {filteredWebhooks.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs font-medium">
                No webhook event records recorded yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-mono text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Received Time</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Event ID</th>
                    <th className="py-2.5 px-3">Signature</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Raw Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono">
                  {filteredWebhooks.map(w => (
                    <tr key={w.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-3 text-[11px] text-zinc-500 whitespace-nowrap">
                        {formatRelativeTime(w.createdAt)}
                      </td>
                      <td className="py-3 px-3 font-bold text-zinc-900 whitespace-nowrap">
                        {w.eventType}
                      </td>
                      <td className="py-3 px-3 text-zinc-500 whitespace-nowrap text-[11px]">
                        {w.eventId || '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {w.signatureVerified ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <Check size={12} /> Verified
                          </span>
                        ) : (
                          <span className="text-red-600 font-bold flex items-center gap-1">
                            <X size={12} /> Unverified
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            w.status === 'processed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : w.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setJsonModalData({ title: `Webhook ${w.eventType}`, json: w.payload })}
                          className="px-2 py-1 rounded-lg skeuo-btn-secondary text-[11px] font-bold text-zinc-800"
                        >
                          View JSON
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: ADMIN EMERGENCY POINT ADJUSTMENT ────────────────── */}
      {adjustModalUser && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setAdjustModalUser(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="skeuo-surface rounded-3xl w-full max-w-md overflow-hidden text-zinc-900 shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="text-base font-black text-zinc-950 flex items-center gap-1.5">
                  <Gift size={16} />
                  <span>Add Points to User Wallet</span>
                </h3>
                <p className="text-xs text-zinc-500">
                  Direct emergency points grant for problem resolution
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalUser(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target User Info */}
            <div className="p-3.5 rounded-2xl skeuo-sunken text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">User:</span>
                <span className="font-bold text-zinc-950">{adjustModalUser.displayName || 'Attendee'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Email:</span>
                <span className="text-zinc-800">{adjustModalUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Current Balance:</span>
                <span className="font-bold text-emerald-700">{formatPoints(adjustModalUser.availablePoints)} pts</span>
              </div>
            </div>

            {/* Adjustment Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-900 mb-1">
                  Points to Credit:
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[100, 200, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAdjustPoints(amt)}
                      className={`py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
                        adjustPoints === amt
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  value={adjustPoints}
                  onChange={e => setAdjustPoints(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl skeuo-sunken text-sm font-mono font-bold text-zinc-950 focus:outline-none"
                  placeholder="Enter custom points"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Rupees Paid (Optional — record if attendee paid cash/UPI off-ramp):
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustRupees}
                  onChange={e => setAdjustRupees(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl skeuo-sunken text-xs font-mono text-zinc-900 focus:outline-none"
                  placeholder="₹0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-900 mb-1">
                  Reason for Audit Trail:
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl skeuo-sunken text-xs text-zinc-900 focus:outline-none"
                  placeholder="e.g. UPI VPA mismatch during pitch window"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-950"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePointAdjustment}
                disabled={adjustPoints <= 0 || adjustSubmitting}
                className="skeuo-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {adjustSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                <span>Credit {adjustPoints} Points</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── MODAL: SUPER ADMIN DELETE USER ─────────────────────────── */}
      {deleteModalUser && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (!deletingUser) setDeleteModalUser(null)
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="skeuo-surface rounded-3xl w-full max-w-md overflow-hidden text-zinc-900 shadow-2xl p-5 space-y-4 border border-red-500/30"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shadow-sm">
                  <Trash2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-red-600">Permanently Delete User</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">
                    Super Admin Privilege
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                disabled={deletingUser}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-100/90 border border-zinc-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Attendee:</span>
                <span className="font-bold text-zinc-950">{deleteModalUser.displayName || 'Unnamed Member'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Email:</span>
                <span className="font-mono font-bold text-zinc-900">{deleteModalUser.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Available Balance:</span>
                <span className="font-mono font-bold text-zinc-800">{formatPoints(deleteModalUser.availablePoints)} pts</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Total Paid:</span>
                <span className="font-mono font-bold text-emerald-700">{formatRupees(deleteModalUser.totalPaidRupees)}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-red-700">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>Irreversible Master Purge</span>
              </p>
              <p className="text-[11px] text-red-800 leading-relaxed">
                This will permanently delete this account, its login credentials from Supabase Auth, wallet balance, transaction ledger, investments, and payment intents.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-800 mb-1">
                Type <span className="font-mono text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-200 font-black">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={deletingUser}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-red-500 bg-white"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                disabled={deletingUser}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteUser}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingUser}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md disabled:opacity-40 flex items-center gap-1.5 transition-colors"
              >
                {deletingUser ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Permanently Delete</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── MODAL: EDIT PACKAGE QR CODE ─────────────────────────────── */}
      {editingPackage && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setEditingPackage(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="skeuo-surface rounded-3xl w-full max-w-md overflow-hidden text-zinc-900 shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="text-base font-black text-zinc-950 flex items-center gap-1.5">
                  <QrCode size={16} />
                  <span>Edit Package QR Code</span>
                </h3>
                <p className="text-xs text-zinc-500">
                  Update QR image link and pricing for this package
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPackage(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-900 mb-1">Package Label:</label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl skeuo-sunken font-bold text-zinc-950 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-zinc-900 mb-1">Rupees (₹):</label>
                  <input
                    type="number"
                    min="1"
                    value={editRupees}
                    onChange={e => {
                      const r = parseInt(e.target.value) || 0
                      setEditRupees(r)
                      setEditPoints(r * pointsPerRupee)
                    }}
                    className="w-full px-3 py-2 rounded-xl skeuo-sunken font-mono font-bold text-zinc-950 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-900 mb-1">Points to Credit:</label>
                  <input
                    type="number"
                    min="1"
                    value={editPoints}
                    onChange={e => setEditPoints(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl skeuo-sunken font-mono font-bold text-emerald-700 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 font-normal block mt-0.5">
                    Rate: ₹1 = {pointsPerRupee} pts
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-zinc-900">
                  Payment QR Code Image:
                </label>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageFile(e.target.files[0])
                    }
                  }}
                  className="hidden"
                />

                {editQrUrl ? (
                  /* Current QR Image Preview + Actions */
                  <div className="p-3 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center gap-3.5">
                    <div className="w-20 h-20 rounded-xl bg-zinc-50 border border-zinc-200 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      <img
                        src={editQrUrl}
                        alt="QR Preview"
                        className="w-full h-full object-contain rounded"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                        <Check size={13} className="text-emerald-600" />
                        <span>Custom QR Image Attached</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 truncate font-mono">
                        {editQrUrl.startsWith('data:') ? 'Uploaded Image Data' : editQrUrl}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="px-2.5 py-1 rounded-lg skeuo-btn-secondary text-[10px] font-bold text-zinc-800 flex items-center gap-1"
                        >
                          <Upload size={11} />
                          <span>Replace Image</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditQrUrl('')}
                          className="px-2 py-1 rounded-lg hover:bg-red-50 text-red-600 text-[10px] font-bold flex items-center gap-1"
                        >
                          <Trash2 size={11} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Dropzone / Upload Area */
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]'
                        : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50'
                    }`}
                  >
                    {uploadingImage ? (
                      <div className="py-2 flex flex-col items-center justify-center space-y-2">
                        <RefreshCw size={24} className="animate-spin text-zinc-700" />
                        <span className="text-xs font-bold text-zinc-800">Processing & Uploading QR Image...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-1.5">
                        <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-zinc-200 flex items-center justify-center text-zinc-700 mx-auto">
                          <Upload size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-900">
                            Click to upload QR image <span className="font-normal text-zinc-500">or drag and drop</span>
                          </p>
                          <p className="text-[10px] text-zinc-400">
                            PNG, JPG, WEBP, or SVG (max 5MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Optional Manual URL Fallback Toggle */}
                <div className="pt-0.5">
                  {!showManualUrlInput ? (
                    <button
                      type="button"
                      onClick={() => setShowManualUrlInput(true)}
                      className="text-[10px] text-zinc-400 hover:text-zinc-700 underline"
                    >
                      Or enter image URL manually
                    </button>
                  ) : (
                    <div className="space-y-1 pt-1">
                      <input
                        type="text"
                        placeholder="https://... direct image URL"
                        value={editQrUrl}
                        onChange={e => setEditQrUrl(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl skeuo-sunken font-mono text-[11px] text-zinc-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowManualUrlInput(false)}
                        className="text-[10px] text-zinc-400 hover:text-zinc-700 underline"
                      >
                        Hide manual URL field
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="active-toggle"
                  checked={editActive}
                  onChange={e => setEditActive(e.target.checked)}
                  className="rounded text-zinc-950 focus:ring-0"
                />
                <label htmlFor="active-toggle" className="font-semibold text-zinc-800 cursor-pointer">
                  Available for audience to purchase
                </label>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPackage(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-950"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePackageQR}
                disabled={editSubmitting || uploadingImage || !editLabel.trim() || editRupees <= 0}
                className="skeuo-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {editSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                <span>Save Package QR</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── MODAL: MANUAL MATCH & CREDIT ────────────────────────────── */}
      {matchModalPayment && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setMatchModalPayment(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="skeuo-surface rounded-3xl w-full max-w-lg overflow-hidden text-zinc-900 shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="text-base font-black text-zinc-950">Manual Payment Match & Credit</h3>
                <p className="text-xs text-zinc-500">
                  Link unmatched bank payment to an audience purchase intent
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMatchModalPayment(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl skeuo-sunken text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Payment ID:</span>
                <span className="font-bold text-zinc-900">{matchModalPayment.razorpayPaymentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Amount:</span>
                <span className="font-bold text-emerald-700 text-sm">{formatRupees(matchModalPayment.rupeeAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Payer VPA:</span>
                <span className="font-bold text-zinc-900">{matchModalPayment.payerVpa || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Bank UTR / RRN:</span>
                <span className="text-zinc-700">{matchModalPayment.bankRrn || 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-900">
                Select Matching Audience Purchase Intent:
              </label>

              {candidateIntents.length === 0 ? (
                <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/50 text-amber-900 text-xs">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span>No pending intents with exact amount of {formatRupees(matchModalPayment.rupeeAmount)}</span>
                  </p>
                  <p className="text-[11px] mt-1 text-amber-800">
                    The attendee may have selected a different tier. If this was an emergency purchase, you can directly use the <strong>"Audience Users"</strong> tab to grant points!
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {candidateIntents.map(ci => {
                    const isSelected = selectedIntentId === ci.id
                    return (
                      <div
                        key={ci.id}
                        onClick={() => setSelectedIntentId(ci.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                          isSelected
                            ? 'border-zinc-950 bg-zinc-900 text-white shadow-sm'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                              isSelected ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900 border border-zinc-200'
                            }`}>
                              {ci.claimCode}
                            </span>
                            <span className="font-bold">{ci.userDisplayName || ci.userEmail}</span>
                          </div>
                          <p className={`text-[10px] mt-0.5 font-mono ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                            UPI VPA: {ci.userVpa || 'Not entered'} • {formatRelativeTime(ci.createdAt)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className={`font-bold block ${isSelected ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            +{formatPoints(ci.pointsToCredit)} pts
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Admin Audit Notes (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Verified attendee UPI receipt in auditorium"
                value={manualMatchNotes}
                onChange={e => setManualMatchNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl skeuo-sunken text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMatchModalPayment(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-950"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteManualMatch}
                disabled={!selectedIntentId || matchingSubmitting}
                className="skeuo-btn-primary px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {matchingSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                <span>Confirm Match & Credit</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── MODAL: REJECT PAYMENT ───────────────────────────────────── */}
      {rejectModalPayment && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setRejectModalPayment(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="skeuo-surface rounded-3xl w-full max-w-md overflow-hidden text-zinc-900 shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="text-base font-black text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={18} />
                <span>Reject Payment</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalPayment(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-600">
              Are you sure you want to mark payment <strong className="font-mono text-zinc-950">{rejectModalPayment.razorpayPaymentId}</strong> ({formatRupees(rejectModalPayment.rupeeAmount)}) as rejected?
            </p>

            <div>
              <label className="block text-xs font-bold text-zinc-900 mb-1">
                Rejection Reason:
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Fraudulent payment, reversed by bank, or test payment"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl skeuo-sunken text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalPayment(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-950"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReject}
                disabled={!rejectReason.trim() || rejectSubmitting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {rejectSubmitting ? <RefreshCw size={13} className="animate-spin" /> : null}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── MODAL: RAW JSON VIEWER ──────────────────────────────────── */}
      {jsonModalData && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setJsonModalData(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="skeuo-surface rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden text-zinc-900 shadow-2xl p-5 flex flex-col space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Code size={16} className="text-zinc-600" />
                <h3 className="text-sm font-bold text-zinc-950 truncate max-w-sm">
                  {jsonModalData.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="skeuo-btn-secondary px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 text-zinc-700"
                >
                  {copiedJson ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copiedJson ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJsonModalData(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-[11px] leading-relaxed shadow-inner">
              <pre>{JSON.stringify(jsonModalData.json, null, 2)}</pre>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
