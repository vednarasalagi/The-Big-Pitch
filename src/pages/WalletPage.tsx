// ============================================================
// Wallet Page — Points balance, buy points, transaction history
// Minimalist, high contrast, clean white and black theme
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, TrendingUp, ShoppingCart, ArrowUpRight,
  ArrowDownLeft, Gift, Shield, CreditCard, AlertCircle,
  CheckCircle2, Lock, X, ShieldCheck, ShoppingBag,
  Zap, Sparkles, Plus, ArrowRight, Check, AlertTriangle, RefreshCw
} from 'lucide-react'
import { useAuthStore, useWalletStore, useEventStore } from '@/store'
import { Card, Button, StatCard, ProgressBar, Badge, SectionHeader, EmptyState } from '@/components/ui'
import { formatPoints, formatRupees, formatRelativeTime } from '@/lib/utils'
import { supabase, TABLES, isSupabaseConfigured } from '@/lib/supabase'
import { toUserFriendlyError, getOrCreateWallet, getUserPaymentIntents, getPackageQRCodes, claimPaymentIntent } from '@/lib/supabaseApi'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import type { LedgerType, PaymentIntent, PackageQRCode } from '@/types'
import { StaticQRCheckoutModal } from '@/components/wallet/StaticQRCheckoutModal'

export interface PurchasePackage {
  id?: string
  points: number
  rupees: number
  label: string
  popular?: boolean
  badge?: string
  qrImageUrl?: string
  upiVpa?: string
}

const ledgerIcon: Record<LedgerType, React.ReactNode> = {
  free_grant: <Gift size={14} className="text-zinc-900" />,
  purchase: <CreditCard size={14} className="text-zinc-900" />,
  investment: <TrendingUp size={14} className="text-zinc-900" />,
  investment_refund: <ArrowDownLeft size={14} className="text-emerald-600" />,
  admin_adjustment: <Shield size={14} className="text-zinc-900" />,
  purchase_refund: <ArrowDownLeft size={14} className="text-zinc-900" />,
}

const ledgerColor: Record<LedgerType, string> = {
  free_grant: 'text-zinc-950 font-bold',
  purchase: 'text-zinc-950 font-bold',
  investment: 'text-zinc-500 font-semibold',
  investment_refund: 'text-emerald-700 font-bold',
  admin_adjustment: 'text-zinc-950 font-bold',
  purchase_refund: 'text-zinc-950 font-bold',
}


// Official E-Commerce Checkout Modal integrated directly with Razorpay Standard Checkout
// Eliminates untrusted 1-click & custom QR methods in favor of standard, certified checkout flow.
function RazorpayCheckoutModal({
  pkg,
  user,
  eventId,
  eventName,
  onClose,
  onSuccess,
}: {
  pkg: { points: number; rupees: number; label: string }
  user: { id: string; email: string; displayName: string }
  eventId: string
  eventName: string
  onClose: () => void
  onSuccess: (points: number, rupees: number, paymentId?: string) => void
}) {
  return (
    <StaticQRCheckoutModal
      pkg={pkg}
      user={user}
      eventId={eventId}
      eventName={eventName}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  )

}

export function WalletPage() {
  const { user } = useAuthStore()
  const { wallet, ledger, investments, setWallet } = useWalletStore()
  const { event } = useEventStore()
  const [buyModal, setBuyModal] = useState<PurchasePackage | null>(null)
  const [userIntents, setUserIntents] = useState<PaymentIntent[]>([])
  const [packageQRCodes, setPackageQRCodes] = useState<PackageQRCode[]>([])
  const [inlineUtr, setInlineUtr] = useState('')
  const [submittingInlineUtr, setSubmittingInlineUtr] = useState(false)

  // Realtime subscription & auto-sync heartbeat on user's payment intents
  useEffect(() => {
    if (!user?.id || !event?.id) return

    const refreshIntents = async () => {
      try {
        const intents = await getUserPaymentIntents(user.id, event.id)
        setUserIntents(intents)
      } catch {}
    }

    refreshIntents()

    if (!supabase) return

    const channel = supabase
      .channel(`user_wallet_intents_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_intents',
          filter: `user_id=eq.${user.id}`,
        },
        payload => {
          refreshIntents()
          const newRow = payload.new as any
          if (newRow?.status === 'credited') {
            getOrCreateWallet(user.id, event.id).then(w => {
              if (w) setWallet(w)
            })
          }
        }
      )
      .subscribe()

    // 5-second polling heartbeat ensures the user sees status updates without reloading
    const interval = setInterval(() => {
      refreshIntents()
    }, 5000)

    return () => {
      clearInterval(interval)
      if (supabase) supabase.removeChannel(channel)
    }
  }, [user?.id, event?.id, setWallet])

  useEffect(() => {
    if (event?.id) {
      getPackageQRCodes(event.id).then(setPackageQRCodes)
    }
  }, [event?.id])

  // Locate current active pending/verifying/mismatch intent
  const activeIntent = useMemo(() => {
    return userIntents.find(i =>
      i.status === 'pending' ||
      i.status === 'processing' ||
      i.status === 'manual_review' ||
      i.status === 'vpa_mismatch'
    )
  }, [userIntents])

  const handleInlineUtrSubmit = async () => {
    if (!activeIntent || !inlineUtr.trim()) return
    setSubmittingInlineUtr(true)
    try {
      const res = await claimPaymentIntent(activeIntent.id, inlineUtr.trim(), activeIntent.userVpa)
      if (res.matched || res.status === 'credited') {
        toast.success(`${formatPoints(activeIntent.pointsToCredit)} points credited to your wallet!`)
        setInlineUtr('')
        if (user && event) {
          const updatedWallet = await getOrCreateWallet(user.id, event.id)
          if (updatedWallet) setWallet(updatedWallet)
          const updatedIntents = await getUserPaymentIntents(user.id, event.id)
          setUserIntents(updatedIntents)
        }
      } else if (res.status === 'vpa_mismatch') {
        toast.error('UPI ID Mismatch: Sender UPI does not match your registered UPI ID!')
        if (user && event) {
          const updatedIntents = await getUserPaymentIntents(user.id, event.id)
          setUserIntents(updatedIntents)
        }
      } else {
        toast.info(res.message || 'UTR submitted. Awaiting verification.')
        if (user && event) {
          const updatedIntents = await getUserPaymentIntents(user.id, event.id)
          setUserIntents(updatedIntents)
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit UTR')
    } finally {
      setSubmittingInlineUtr(false)
    }
  }

  const config = event?.config
  const pointsPerRupee = Math.max(1, config?.pointsPerRupee ?? 10)
  const maxPaid = Math.max(5, config?.maxPaidPurchaseRupees ?? 500)
  const spentRupees = wallet?.totalPaidRupees ?? 0
  const remainingAllowance = Math.max(0, maxPaid - spentRupees)
  const available = wallet ? wallet.freePoints + wallet.purchasedPoints : 0

  // Dynamically load the 5 fixed packages (configurable by admin)
  const purchasePackages = useMemo<PurchasePackage[]>(() => {
    if (packageQRCodes && packageQRCodes.length > 0) {
      return packageQRCodes
        .filter(p => p.isActive && p.rupeeAmount <= maxPaid)
        .map(p => ({
          id: p.id,
          points: p.rupeeAmount * pointsPerRupee,
          rupees: p.rupeeAmount,
          label: p.label,
          popular: p.rupeeAmount === 50,
          badge: p.rupeeAmount === 10 ? 'Budget' : p.rupeeAmount === 50 ? 'Most Popular' : undefined,
          qrImageUrl: p.qrImageUrl,
          upiVpa: p.upiVpa,
        }))
    }

    // Default 5 fixed tiers fallback
    const fallbackTiers: PurchasePackage[] = [
      { rupees: 10, points: 10 * pointsPerRupee, label: 'Starter Pack', popular: false, badge: 'Budget' },
      { rupees: 20, points: 20 * pointsPerRupee, label: 'Supporter Pack', popular: false, badge: 'Value' },
      { rupees: 50, points: 50 * pointsPerRupee, label: 'Enthusiast Pack', popular: true, badge: 'Most Popular' },
      { rupees: 100, points: 100 * pointsPerRupee, label: 'Champion Pack', popular: false, badge: 'Power Backer' },
      { rupees: 200, points: 200 * pointsPerRupee, label: 'Super Backer', popular: false, badge: 'Top Cheer' },
    ]

    return fallbackTiers.filter(t => t.rupees <= maxPaid)
  }, [packageQRCodes, pointsPerRupee, maxPaid])

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-zinc-900 animate-fade-in">
        <EmptyState
          icon={<Wallet size={32} className="text-zinc-800" />}
          title="Sign in to view your allocation wallet"
          description={`Every attendee receives ${event?.config.freePointsAllocation ?? 500} free points upon sign in to back live pitching startups.`}
          action={
            <Link
              to="/auth?redirect=/wallet"
              className="skeuo-btn-primary px-6 py-2.5 rounded-xl text-white font-bold text-sm inline-flex items-center gap-2"
            >
              Sign In to Continue
            </Link>
          }
        />
      </div>
    )
  }

  const handlePurchaseSuccess = async (points: number, rupees: number, paymentId?: string) => {
    const newPurchased = (wallet?.purchasedPoints ?? 0) + points
    const newSpentRupees = (wallet?.totalPaidRupees ?? 0) + rupees

    if (wallet) {
      // Optimistic UI state
      setWallet({
        ...wallet,
        purchasedPoints: newPurchased,
        totalPaidRupees: newSpentRupees,
      })

      // Refresh authoritative balance from Supabase (processed via server RPC/webhook)
      if (supabase && user) {
        try {
          const authoritative = await getOrCreateWallet(user.id, wallet.eventId)
          if (authoritative) {
            setWallet(authoritative)
          }
        } catch (err) {
          console.warn('Wallet refresh notice:', err)
        }
      }
    }

    toast.success(`${points} points added to your wallet!`)
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-7 animate-fade-in text-zinc-900">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight skeuo-text-emboss">
            My Allocation Wallet
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5 font-medium">
            Event: <span className="font-semibold text-zinc-900">{event?.name && !event.name.toLowerCase().includes('pitch arena') ? event.name : 'THE BIG PITCH'}</span> • Event Participation Points Wallet
          </p>
        </div>

        {/* Quick jump to buy points button */}
        {remainingAllowance > 0 && (
          <a
            href="#buy-points"
            className="skeuo-btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold w-fit"
          >
            <Plus size={14} />
            <span>Buy Extra Points</span>
          </a>
        )}
      </div>

      {/* Balance Overview Console — Tactile Instrument Vault */}
      <div className="skeuo-surface rounded-3xl p-6 sm:p-8 space-y-5 shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold mb-1 skeuo-text-emboss">
              Available Event Participation Points
            </p>
            <p className="text-4xl sm:text-6xl font-black font-mono text-zinc-950 tracking-tight skeuo-text-emboss">
              {formatPoints(available)}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:self-center">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-emerald-300 text-emerald-950 shadow-[inset_0_1px_0_#FFF,0_1px_3px_rgba(16,185,129,0.15)]">
              <span className="skeuo-led-bezel">
                <span className="skeuo-led-emerald animate-pulse" />
              </span>
              <span className="font-extrabold uppercase tracking-wide text-[11px]">Live Deployment Ready</span>
            </span>
          </div>
        </div>

        {/* CNC-Milled Sunken Grants & Purchases Wells */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-4 rounded-2xl skeuo-sunken space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-700 text-xs font-bold uppercase tracking-wider">
              <Gift size={14} className="text-zinc-900" />
              <span className="skeuo-text-emboss">Free Welcome Grant</span>
            </div>
            <p className="text-zinc-950 font-black font-mono text-2xl">
              {formatPoints(wallet?.freePoints ?? 0)}
            </p>
            <p className="text-[11px] text-zinc-500 font-medium">Granted to you upon joining the arena</p>
          </div>

          <div className="p-4 rounded-2xl skeuo-sunken space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-700 text-xs font-bold uppercase tracking-wider">
              <CreditCard size={14} className="text-zinc-900" />
              <span className="skeuo-text-emboss">Purchased Extra Points</span>
            </div>
            <p className="text-zinc-950 font-black font-mono text-2xl">
              {formatPoints(wallet?.purchasedPoints ?? 0)}
            </p>
            <p className="text-[11px] text-zinc-500 font-medium">Acquired via secure Razorpay checkout</p>
          </div>
        </div>
      </div>

      {/* ACTIVE TOP-UP VERIFICATION IN PROGRESS */}
      {activeIntent && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-5 sm:p-6 border-2 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.06),inset_0_1px_0_#FFF] ${
            activeIntent.status === 'vpa_mismatch'
              ? 'bg-gradient-to-br from-rose-50/90 via-amber-50/40 to-white border-rose-400/70'
              : activeIntent.status === 'manual_review'
              ? 'bg-gradient-to-br from-amber-50/90 via-amber-50/30 to-white border-amber-400/60'
              : 'bg-gradient-to-br from-blue-50/90 via-indigo-50/30 to-white border-blue-400/60'
          }`}
        >
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  activeIntent.status === 'vpa_mismatch'
                    ? 'bg-rose-500 text-white'
                    : activeIntent.status === 'manual_review'
                    ? 'bg-amber-500 text-white'
                    : 'bg-blue-600 text-white'
                }`}
              >
                {activeIntent.status === 'vpa_mismatch' ? (
                  <AlertTriangle size={20} />
                ) : activeIntent.status === 'manual_review' ? (
                  <AlertCircle size={20} />
                ) : (
                  <RefreshCw size={20} className="animate-spin" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-zinc-950 font-black text-base tracking-tight skeuo-text-emboss">
                    {activeIntent.status === 'vpa_mismatch'
                      ? 'UPI ID Mismatch Detected'
                      : activeIntent.status === 'manual_review'
                      ? 'Payment in Admin Review'
                      : 'Active Payment Verification in Progress'}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      activeIntent.status === 'vpa_mismatch'
                        ? 'bg-rose-500/20 text-rose-800 border border-rose-500/30'
                        : activeIntent.status === 'manual_review'
                        ? 'bg-amber-500/20 text-amber-900 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-900 border border-blue-500/30'
                    }`}
                  >
                    {activeIntent.status === 'vpa_mismatch' ? 'Mismatch' : activeIntent.status}
                  </span>
                </div>
                <p className="text-zinc-600 text-xs mt-0.5 font-medium">
                  Ref Code: <span className="font-mono font-bold text-zinc-900">{activeIntent.claimCode}</span> &bull;{' '}
                  <span className="font-bold text-zinc-950 font-mono">{formatRupees(activeIntent.rupeeAmount)}</span> for{' '}
                  <span className="text-emerald-700 font-bold">+{formatPoints(activeIntent.pointsToCredit)} points</span>
                </p>
              </div>
            </div>

            {/* Resume / Reopen in Checkout Button */}
            <button
              type="button"
              onClick={() => {
                const targetPkg = purchasePackages.find(p => p.rupees === activeIntent.rupeeAmount) || {
                  points: activeIntent.pointsToCredit,
                  rupees: activeIntent.rupeeAmount,
                  label: `₹${activeIntent.rupeeAmount} Top-up Package`,
                }
                setBuyModal(targetPkg)
              }}
              className="skeuo-btn-primary px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 self-start sm:self-auto shadow-sm"
            >
              <span>Resume Checkout / QR</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Description & Helper */}
          <div className="p-3.5 rounded-2xl bg-white/90 border border-zinc-200/80 text-xs space-y-2">
            {activeIntent.status === 'vpa_mismatch' ? (
              <p className="text-rose-950 leading-relaxed text-[11px] font-medium">
                <strong>Attention:</strong> Payment was received, but the sender UPI did not match your registered UPI ID (<span className="font-mono font-bold text-zinc-900">{activeIntent.userVpa || 'None'}</span>). To immediately verify and credit your points, enter the <strong>12-digit UTR number</strong> from your bank receipt below, or click <strong>"Resume Checkout"</strong> to change your UPI ID.
              </p>
            ) : activeIntent.status === 'manual_review' ? (
              <p className="text-amber-950 leading-relaxed text-[11px] font-medium">
                Your payment was received and flagged for fast review by the arena operations team. Tokens will be credited to your wallet shortly.
              </p>
            ) : (
              <p className="text-blue-950 leading-relaxed text-[11px] font-medium">
                Waiting for UPI bank confirmation from <span className="font-mono font-bold text-zinc-900">{activeIntent.userVpa || 'your UPI app'}</span>. Once settled, points are credited automatically. You can also submit your 12-digit UTR reference below to expedite verification.
              </p>
            )}

            {/* Quick Inline UTR Verification Form */}
            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder="Enter 12-digit UTR (e.g. 502184910284)"
                value={inlineUtr}
                onChange={e => setInlineUtr(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-300 text-xs font-mono font-bold text-zinc-950 placeholder:text-zinc-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={handleInlineUtrSubmit}
                disabled={submittingInlineUtr || !inlineUtr.trim()}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
              >
                {submittingInlineUtr ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Submit UTR</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* FEATURED: POINTS BUYING SECTION — HIGH VISIBILITY */}
      <div id="buy-points" className="scroll-mt-20">
        <div className="skeuo-surface rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.08),inset_0_1px_0_#FFF] space-y-6 relative overflow-hidden border border-zinc-300/80">
          {/* Top Pill & Headline */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="skeuo-token-dark px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={13} className="text-amber-400 fill-amber-400" />
                  Active Rate: ₹1 = {pointsPerRupee} Points
                </span>
                <span className="skeuo-token px-2.5 py-1 rounded-xl text-[11px] font-bold text-emerald-800">
                  Instant Wallet Credit
                </span>
              </div>
              <h2 className="text-2xl font-black text-zinc-950 tracking-tight pt-1 skeuo-text-emboss">
                Acquire Extra Points
              </h2>
              <p className="text-zinc-600 text-xs sm:text-sm leading-relaxed max-w-xl font-normal">
                Deploy heavier allocations into promising student startups during live rounds. All packages are instant and verified through official payment channels.
              </p>
            </div>

            {/* Spending Allowance Status Pill */}
            <div className="p-3.5 rounded-2xl skeuo-sunken text-left sm:text-right min-w-[180px]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block skeuo-text-emboss">
                Your Remaining Allowance
              </span>
              <span className="text-lg font-black font-mono text-zinc-950">
                ₹{remainingAllowance} / ₹{maxPaid}
              </span>
              <span className="text-[11px] text-zinc-500 block font-medium">
                {remainingAllowance > 0
                  ? `Can acquire up to ${formatPoints(remainingAllowance * pointsPerRupee)}`
                  : 'Event maximum cap reached'}
              </span>
            </div>
          </div>

          {/* Sunken Meter Track of Event Allowance */}
          <div className="space-y-1.5 skeuo-sunken p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-800 skeuo-text-emboss">Attendee Event Cap</span>
              <span className="font-mono font-black text-zinc-950">
                {formatRupees(spentRupees)} spent of {formatRupees(maxPaid)} limit
              </span>
            </div>
            <div className="skeuo-meter-track h-2.5 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-zinc-800 to-zinc-950 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, (spentRupees / maxPaid) * 100))}%` }}
              />
            </div>
          </div>

          {remainingAllowance > 0 ? (
            <div className="space-y-5">
              {/* Dynamic Tactile Voucher Package Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {purchasePackages.map((pkg) => {
                  const isAvailable = pkg.rupees <= remainingAllowance
                  return (
                    <div
                      key={pkg.rupees}
                      className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl transition-all ${
                        pkg.popular
                          ? 'skeuo-surface border-2 border-zinc-950 shadow-md ring-1 ring-zinc-950/20'
                          : 'skeuo-surface-interactive'
                      } ${!isAvailable ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {pkg.popular && (
                        <span className="absolute -top-2.5 right-4 skeuo-token-gold text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs">
                          Most Popular
                        </span>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider skeuo-text-emboss">
                            {pkg.label}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-zinc-400">
                            ₹1 = {pointsPerRupee} pts
                          </span>
                        </div>

                        <div>
                          <p className="text-2xl sm:text-3xl font-black font-mono text-zinc-950 tracking-tight">
                            +{formatPoints(pkg.points)}
                          </p>
                          <p className="text-zinc-500 text-xs font-medium">
                            Instant points added to wallet
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 mt-2 border-t border-zinc-200/80 flex items-center justify-between gap-3">
                        <div className="skeuo-sunken px-2.5 py-1 rounded-xl">
                          <span className="text-[9px] text-zinc-500 uppercase font-bold block skeuo-text-emboss">Cost</span>
                          <span className="font-mono font-black text-base text-zinc-950 leading-tight">
                            {formatRupees(pkg.rupees)}
                          </span>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => setBuyModal(pkg)}
                          className={`px-4 py-2 font-black text-xs justify-center ${
                            pkg.popular
                              ? 'skeuo-btn-emerald'
                              : 'skeuo-btn-primary'
                          }`}
                        >
                          Buy with UPI
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Payment Methods Banner */}
              <div className="pt-2 border-t border-zinc-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-zinc-700 skeuo-text-emboss">Supported Payment Methods:</span>
                  <span className="px-2 py-0.5 rounded-lg skeuo-token text-zinc-800 text-[11px] font-bold">
                    UPI (Google Pay, PhonePe, Paytm, QR)
                  </span>
                  <span className="px-2 py-0.5 rounded-lg skeuo-token text-zinc-800 text-[11px] font-bold">
                    Cards (Visa, RuPay, Mastercard)
                  </span>
                  <span className="px-2 py-0.5 rounded-lg skeuo-token text-zinc-800 text-[11px] font-bold">
                    NetBanking
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <span className="skeuo-led-bezel w-3.5 h-3.5">
                    <span className="skeuo-led-emerald" />
                  </span>
                  <span>Official Razorpay Gateway</span>
                </div>
              </div>

              {/* E-Commerce Compliance & Policies Reference */}
              <div className="pt-2 border-t border-zinc-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck size={12} className="text-emerald-600" />
                  <span>Digital Goods Delivery • Free Shipping (₹0.00) • 100% Secure via Razorpay</span>
                </span>
                <div className="flex items-center gap-3 text-zinc-700 font-bold">
                  <Link to="/terms" className="hover:text-zinc-950 underline">Terms & Conditions</Link>
                  <Link to="/privacy" className="hover:text-zinc-950 underline">Privacy Policy</Link>
                  <Link to="/terms#refunds" className="hover:text-zinc-950 underline">Refunds</Link>
                  <Link to="/terms#delivery" className="hover:text-zinc-950 underline">Delivery</Link>
                  <Link to="/terms#contact" className="hover:text-zinc-950 underline">Contact</Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl skeuo-sunken text-center space-y-1">
              <p className="font-black text-zinc-900 text-sm skeuo-text-emboss">
                Maximum Event Purchase Allowance Reached
              </p>
              <p className="text-zinc-500 text-xs font-medium">
                To keep the pitch tournament fair for all founders, you have reached the maximum allowed limit of {formatRupees(maxPaid)}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3.5">
        <StatCard
          label="Points Allocated"
          value={formatPoints(wallet?.investedPoints ?? 0)}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Pitches Scored"
          value={investments.length}
          subtext={`across ${new Set(investments.map(i => i.teamId)).size} startups`}
          icon={<ArrowUpRight size={18} />}
        />
      </div>

      {/* Recent QR Payment Requests / Claims */}
      {userIntents.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title="My Token Top-up Requests"
            subtitle={`${userIntents.length} requests • Razorpay Static QR`}
          />
          <div className="skeuo-surface rounded-3xl overflow-hidden p-0 shadow-sm divide-y divide-zinc-200/70">
            {userIntents.map(intent => {
              const isCredited = intent.status === 'credited'
              const isPending = intent.status === 'pending' || intent.status === 'processing'
              const isReview = intent.status === 'manual_review'
              const isMismatch = intent.status === 'vpa_mismatch'
              return (
                <div key={intent.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/70 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <div className="w-9 h-9 rounded-xl skeuo-token flex items-center justify-center flex-shrink-0">
                      <CreditCard size={14} className="text-zinc-900" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-zinc-950 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                          {intent.claimCode}
                        </span>
                        <span className="text-xs font-bold text-zinc-900">
                          {formatRupees(intent.rupeeAmount)} → +{formatPoints(intent.pointsToCredit)} pts
                        </span>
                      </div>
                      <p className="text-zinc-500 text-[11px] font-mono mt-0.5">
                        {intent.userUtr ? `UTR: ${intent.userUtr}` : 'Awaiting UTR submission'} • {formatRelativeTime(intent.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                        isCredited
                          ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                          : isMismatch
                          ? 'bg-rose-500/15 text-rose-800 border border-rose-500/30 font-black'
                          : isReview
                          ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                          : isPending
                          ? 'bg-blue-500/10 text-blue-700 border border-blue-500/20'
                          : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {intent.status === 'vpa_mismatch' ? 'UPI Mismatch' : intent.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transaction History / Ledger Console */}
      <div className="space-y-3">
        <SectionHeader title="Transaction Ledger" subtitle={`${ledger.length} records`} />
        <div className="skeuo-surface rounded-3xl overflow-hidden p-0 shadow-sm divide-y divide-zinc-200/70">
          {ledger.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-xs font-medium">
              No transactions recorded yet in your allocation history.
            </div>
          )}
          {[...ledger].reverse().map(entry => (
            <div key={entry.id} className="p-4 sm:p-4.5 flex items-center justify-between hover:bg-zinc-50/70 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                <div className="w-9 h-9 rounded-xl skeuo-token flex items-center justify-center flex-shrink-0">
                  {ledgerIcon[entry.type]}
                </div>
                <div className="min-w-0">
                  <p className="text-zinc-950 text-xs sm:text-sm font-bold truncate skeuo-text-emboss">{entry.description}</p>
                  <p className="text-zinc-500 text-[11px] font-mono">{formatRelativeTime(entry.createdAt)}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3 font-mono">
                <p className={`font-black text-xs sm:text-sm ${ledgerColor[entry.type]}`}>
                  {entry.amount > 0 ? '+' : ''}{entry.amount} pts
                </p>
                <p className="text-zinc-500 text-[10px] font-bold">{formatPoints(entry.balanceAfter)} bal</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Checkout Modal */}
      {buyModal && wallet && user && (
        <RazorpayCheckoutModal
          pkg={buyModal}
          user={user}
          eventId={event?.id || '11111111-0000-0000-0000-000000000001'}
          eventName={event?.name && !event.name.toLowerCase().includes('pitch arena') ? event.name : 'THE BIG PITCH'}
          onClose={() => setBuyModal(null)}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  )
}
