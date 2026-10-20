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
  Zap, Sparkles, Plus, ArrowRight, Check
} from 'lucide-react'
import { useAuthStore, useWalletStore, useEventStore } from '@/store'
import { Card, Button, StatCard, ProgressBar, Badge, SectionHeader, EmptyState } from '@/components/ui'
import { formatPoints, formatRupees, formatRelativeTime } from '@/lib/utils'
import { supabase, TABLES, isSupabaseConfigured } from '@/lib/supabase'
import { toUserFriendlyError, getOrCreateWallet } from '@/lib/supabaseApi'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import type { LedgerType } from '@/types'

export interface PurchasePackage {
  points: number
  rupees: number
  label: string
  popular?: boolean
  badge?: string
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

// Inject Razorpay checkout script once
function useRazorpayScript() {
  useEffect(() => {
    if (document.getElementById('razorpay-checkout-js')) return
    const script = document.createElement('script')
    script.id = 'razorpay-checkout-js'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
  }, [])
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
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleProceedToRazorpay = async () => {
    setErrorMsg('')

    if (typeof (window as any).Razorpay === 'undefined') {
      setErrorMsg('Payment gateway script is loading. Please check your internet connection and try again.')
      return
    }

    setLoading(true)

    let razorpayKey = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || ''
    let orderId: string | undefined = undefined

    // Attempt server-side order creation via Supabase Edge Function
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

        if (token && supabaseUrl) {
          const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              rupeeAmount: pkg.rupees,
              eventId,
            }),
          })

          const data = await res.json()
          if (!res.ok) {
            setErrorMsg(toUserFriendlyError(data?.error, 'Could not initiate payment order.'))
            setLoading(false)
            return
          }

          if (data.orderId) {
            orderId = data.orderId
          }
          if (data.keyId && !razorpayKey) {
            razorpayKey = data.keyId
          }
        }
      } catch (err: any) {
        console.warn('Backend order generation notice:', err)
      }
    }

    // Require Razorpay Key ID
    if (!razorpayKey) {
      setErrorMsg('Razorpay merchant key is not configured. Please set VITE_RAZORPAY_KEY_ID in your environment or Supabase Edge Function.')
      setLoading(false)
      return
    }

    const options = {
      key: razorpayKey,
      amount: pkg.rupees * 100, // Amount in paise
      currency: 'INR',
      name: 'THE BIG PITCH — Sphinx 2026',
      description: `${pkg.points} Event Participation Points — ${pkg.label} Package (Digital Event Goods)`,
      notes_key_1: 'NOT an investment. Virtual event tokens for audience scoring at college fest.',
      order_id: orderId,
      prefill: {
        name: user.displayName || '',
        email: user.email || '',
      },
      notes: {
        eventId,
        userId: user.id,
        points: pkg.points.toString(),
        package: pkg.label,
        event: eventName,
      },
      theme: {
        color: '#09090b',
      },
      handler: async (response: { razorpay_payment_id: string; razorpay_order_id?: string; razorpay_signature?: string }) => {
        setLoading(false)
        onSuccess(pkg.points, pkg.rupees, response.razorpay_payment_id)
        onClose()
      },
      modal: {
        ondismiss: () => {
          setLoading(false)
        },
      },
    }

    try {
      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', (resp: any) => {
        setErrorMsg(toUserFriendlyError(resp.error?.description, 'Payment failed or was declined by your bank/UPI app.'))
        setLoading(false)
      })
      rzp.open()
      setLoading(false)
    } catch (err: any) {
      setErrorMsg(toUserFriendlyError(err?.message, 'Could not launch Razorpay checkout modal.'))
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="skeuo-surface rounded-3xl w-full max-w-sm overflow-hidden text-zinc-900 my-auto shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35),inset_0_1px_0_#FFF]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl skeuo-token-dark flex items-center justify-center flex-shrink-0">
              <ShoppingBag size={14} />
            </div>
            <div className="min-w-0">
              <h3 className="text-zinc-950 font-black text-base tracking-tight leading-none truncate skeuo-text-emboss">Checkout</h3>
              <p className="text-zinc-500 text-[11px] mt-1 truncate font-medium">{eventName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Checkout"
            className="skeuo-btn-secondary p-1.5 rounded-xl text-zinc-600 hover:text-zinc-950 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Order Details Card — Sunken Slot */}
          <div className="rounded-2xl skeuo-sunken p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-extrabold text-zinc-950 text-sm block truncate skeuo-text-emboss">{pkg.label} Package</span>
                <span className="text-zinc-600 text-xs font-semibold">+{formatPoints(pkg.points)} Event Participation Points</span>
              </div>
              <span className="font-mono font-black text-xl text-zinc-950 flex-shrink-0">{formatRupees(pkg.rupees)}</span>
            </div>

            <div className="border-t border-zinc-300/60 pt-2 flex items-center justify-between text-[11px] text-zinc-600 font-medium">
              <span>Attendee</span>
              <span className="font-bold text-zinc-900 truncate max-w-[180px] text-right">
                {user.displayName || user.email}
              </span>
            </div>
          </div>

          {/* Secure Payment Note */}
          <div className="flex items-center justify-between text-[11px] text-zinc-500 px-0.5 font-medium">
            <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
              <span className="skeuo-led-bezel w-3.5 h-3.5">
                <span className="skeuo-led-emerald" />
              </span>
              <span>Razorpay Secure</span>
            </span>
            <span className="text-zinc-500 text-[10px] font-mono">UPI • Cards • NetBanking</span>
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 rounded-2xl skeuo-sunken border border-rose-300 text-rose-900 text-xs flex items-start gap-2">
              <AlertCircle size={15} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-800 font-semibold flex-1">{errorMsg}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <Button
              onClick={handleProceedToRazorpay}
              loading={loading}
              className="w-full justify-center skeuo-btn-primary py-3.5 font-black text-sm shadow-md"
              icon={<Lock size={14} />}
            >
              {loading ? 'Initializing Razorpay...' : `Pay ${formatRupees(pkg.rupees)} via Razorpay`}
            </Button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full text-center text-xs text-zinc-500 hover:text-zinc-950 font-bold py-1 transition-colors"
            >
              Cancel & Return
            </button>
          </div>

          {/* Legal Notice */}
          <p className="text-[10px] text-zinc-400 text-center leading-normal px-1">
            You are purchasing <strong>virtual event participation tokens</strong> (digital goods) for audience scoring at a live college fest. No financial investment is made in any startup.{' '}
            <Link to="/terms" target="_blank" className="text-zinc-600 font-bold hover:underline">Terms</Link>
            {' '}&{' '}
            <Link to="/terms#refunds" target="_blank" className="text-zinc-600 font-bold hover:underline">Refund Policy</Link>.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export function WalletPage() {
  useRazorpayScript()
  const { user } = useAuthStore()
  const { wallet, ledger, investments, setWallet } = useWalletStore()
  const { event } = useEventStore()
  const [buyModal, setBuyModal] = useState<PurchasePackage | null>(null)
  const [customRupeesInput, setCustomRupeesInput] = useState<string>('')

  const config = event?.config
  const pointsPerRupee = Math.max(1, config?.pointsPerRupee ?? 10)
  const maxPaid = Math.max(5, config?.maxPaidPurchaseRupees ?? 100)
  const spentRupees = wallet?.totalPaidRupees ?? 0
  const remainingAllowance = Math.max(0, maxPaid - spentRupees)
  const available = wallet ? wallet.freePoints + wallet.purchasedPoints : 0

  // Dynamically generate packages according to active event config
  const purchasePackages = useMemo<PurchasePackage[]>(() => {
    const baseTiers = [
      { rupees: 5, label: 'Starter', popular: false, badge: 'Budget' },
      { rupees: 10, label: 'Standard', popular: true, badge: 'Most Popular' },
      { rupees: 20, label: 'Supporter', popular: false, badge: 'Value Pack' },
      { rupees: 50, label: 'Enthusiast', popular: false, badge: 'High Impact' },
      { rupees: 100, label: 'Champion', popular: false, badge: 'Power Backer' },
      { rupees: 200, label: 'Super Fan', popular: false, badge: 'Top Cheer' },
      { rupees: 500, label: 'Mega Backer', popular: false, badge: 'Mega Cheer' },
    ]

    const filtered = baseTiers.filter(t => t.rupees <= maxPaid)
    const tiersToUse = filtered.length >= 2 ? filtered : baseTiers.slice(0, 3)

    return tiersToUse.map(t => ({
      points: t.rupees * pointsPerRupee,
      rupees: t.rupees,
      label: t.label,
      popular: t.popular,
      badge: t.badge,
    }))
  }, [pointsPerRupee, maxPaid])

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

  const handleCustomBuy = () => {
    const val = parseInt(customRupeesInput) || 0
    if (val <= 0) {
      toast.error('Please enter an amount of at least ₹1')
      return
    }
    if (val > remainingAllowance) {
      toast.error(`Maximum remaining purchase limit is ₹${remainingAllowance}`)
      return
    }
    setBuyModal({
      rupees: val,
      points: val * pointsPerRupee,
      label: 'Custom Top-Up',
      popular: false,
    })
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

              {/* Custom Rupee Top-Up Calculator */}
              <div className="p-4 sm:p-5 rounded-2xl skeuo-sunken space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5 skeuo-text-emboss">
                    <Sparkles size={14} className="text-zinc-950" />
                    Custom Top-Up Calculator (Enter any amount)
                  </span>
                  <span className="text-xs text-zinc-500 font-mono font-bold">
                    Max: ₹{remainingAllowance}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1 skeuo-surface rounded-xl p-0.5 flex items-center border border-zinc-300">
                    <span className="pl-3.5 font-bold text-zinc-500 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="1"
                      max={remainingAllowance}
                      placeholder={`Enter amount (1 - ${remainingAllowance})`}
                      value={customRupeesInput}
                      onChange={(e) => setCustomRupeesInput(e.target.value)}
                      className="w-full pl-2 pr-3.5 py-2.5 bg-transparent text-sm font-mono font-black text-zinc-950 placeholder-zinc-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-start gap-3">
                    <span className="text-xs text-zinc-700 font-mono font-black whitespace-nowrap skeuo-sunken px-3 py-2 rounded-xl">
                      = {formatPoints((parseInt(customRupeesInput) || 0) * pointsPerRupee)}
                    </span>

                    <Button
                      size="sm"
                      onClick={handleCustomBuy}
                      disabled={!customRupeesInput || (parseInt(customRupeesInput) || 0) <= 0 || (parseInt(customRupeesInput) || 0) > remainingAllowance}
                      className="skeuo-btn-primary font-black text-xs px-5 py-2.5"
                    >
                      Buy Custom
                    </Button>
                  </div>
                </div>
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
