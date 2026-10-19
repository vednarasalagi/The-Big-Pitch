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
import { toUserFriendlyError } from '@/lib/supabaseApi'
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
      name: 'THE BIG PITCH',
      description: `${pkg.points} Allocation Points — ${pkg.label} Package`,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white border border-zinc-200 shadow-2xl rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 sm:space-y-5 text-zinc-900 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold mb-1.5">
              <ShieldCheck size={12} className="text-emerald-700" />
              <span>SSL 256-Bit Encrypted Checkout</span>
            </div>
            <h3 className="text-zinc-950 font-black text-xl tracking-tight">Order Summary</h3>
            <p className="text-zinc-500 text-xs mt-0.5">Official Points Allocation • {eventName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* E-Commerce Order Item Card */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h4 className="font-bold text-zinc-950 text-sm leading-snug">{pkg.label} Package</h4>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {formatPoints(pkg.points)} Audience Allocation Points
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono font-black text-zinc-950 text-base">{formatRupees(pkg.rupees)}</span>
              <p className="text-[10px] text-zinc-400">Qty: 1</p>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="border-t border-zinc-200/80 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Item Subtotal</span>
              <span className="font-mono text-zinc-900">{formatRupees(pkg.rupees)}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Payment Gateway & Processing Fee</span>
              <span className="text-emerald-700 font-semibold">FREE (₹0.00)</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Taxes & GST (18%)</span>
              <span className="text-zinc-600">Included</span>
            </div>
            <div className="border-t border-zinc-200 pt-2 flex justify-between items-baseline">
              <div>
                <span className="font-bold text-zinc-950 text-sm block">Total Amount Payable</span>
                <span className="text-[10px] text-zinc-400">Instant credit upon authorization</span>
              </div>
              <span className="font-mono font-black text-2xl text-zinc-950">{formatRupees(pkg.rupees)}</span>
            </div>
          </div>
        </div>

        {/* Attendee Billing Details */}
        <div className="rounded-xl border border-zinc-200 p-3 bg-white text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 font-medium">Attendee Name</span>
            <span className="font-semibold text-zinc-900">{user.displayName || 'Registered Attendee'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 font-medium">Billing Email</span>
            <span className="font-mono text-zinc-700 text-[11px] truncate max-w-[200px]">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 font-medium">Credited Destination</span>
            <span className="text-zinc-800 text-[11px] font-medium">Attendee Live Wallet</span>
          </div>
        </div>

        {/* Accepted Payment Methods via Razorpay Standard Checkout */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Accepted via Razorpay Standard Checkout:
          </p>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 font-medium border border-zinc-200/80">
              UPI (GPay / PhonePe / Paytm / QR)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 font-medium border border-zinc-200/80">
              Cards (Visa / Mastercard / RuPay)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 font-medium border border-zinc-200/80">
              NetBanking (50+ Banks)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 font-medium border border-zinc-200/80">
              Wallets
            </span>
          </div>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Payment Error</p>
              <p className="text-[11px] text-rose-800 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <Button
            onClick={handleProceedToRazorpay}
            loading={loading}
            className="w-full justify-center bg-zinc-950 text-white hover:bg-zinc-800 py-3 font-bold text-sm shadow-sm"
            icon={<Lock size={15} />}
          >
            {loading ? 'Initializing Razorpay...' : `Proceed to Pay ${formatRupees(pkg.rupees)} via Razorpay`}
          </Button>

          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="w-full justify-center text-zinc-500 hover:text-zinc-900 text-xs font-semibold py-1.5"
          >
            Cancel and Return
          </Button>
        </div>

        {/* Legal & Compliance Notice */}
        <p className="text-[11px] text-zinc-400 text-center leading-relaxed px-1">
          By proceeding, you agree to our{' '}
          <Link to="/terms" target="_blank" className="text-zinc-700 hover:text-zinc-950 font-bold underline">Terms & Conditions</Link>
          {' '}and{' '}
          <Link to="/terms#refunds" target="_blank" className="text-zinc-700 hover:text-zinc-950 font-bold underline">Refund Policy</Link>.
          Digital simulation points are delivered instantly.
        </p>

        {/* Trust Seal */}
        <div className="pt-2 border-t border-zinc-100 flex items-center justify-center gap-3 text-[10px] text-zinc-400">
          <span className="flex items-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-600" />
            PCI-DSS Level 1 Certified
          </span>
          <span>•</span>
          <span>Razorpay Official Partner</span>
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
      { rupees: 20, label: 'Growth', popular: false, badge: 'Value Pack' },
      { rupees: 50, label: 'Venture', popular: false, badge: 'High Impact' },
      { rupees: 100, label: 'Principal', popular: false, badge: 'Power Backer' },
      { rupees: 200, label: 'Angel Tier', popular: false, badge: 'Angel' },
      { rupees: 500, label: 'Syndicate', popular: false, badge: 'Syndicate' },
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
      <div className="max-w-2xl mx-auto px-4 py-12 text-zinc-900">
        <EmptyState
          icon={<Wallet size={40} className="text-zinc-400" />}
          title="Sign in to view your allocation wallet"
          description={`Every attendee receives ${event?.config.freePointsAllocation ?? 500} free points upon sign in to back live pitching startups.`}
          action={<Link to="/auth"><Button className="bg-zinc-950 text-white">Sign In to Continue</Button></Link>}
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
      setWallet({
        ...wallet,
        purchasedPoints: newPurchased,
        totalPaidRupees: newSpentRupees,
      })

      if (supabase) {
        try {
          await supabase
            .from(TABLES.WALLETS)
            .update({
              purchased_points: newPurchased,
              total_paid_rupees: newSpentRupees,
              updated_at: new Date().toISOString(),
            })
            .eq('id', wallet.id)

          await supabase.from(TABLES.WALLET_LEDGER).insert({
            wallet_id: wallet.id,
            user_id: wallet.userId,
            event_id: wallet.eventId,
            type: 'purchase',
            amount: points,
            balance_after: wallet.freePoints + newPurchased,
            description: paymentId
              ? `Purchased ${points} points (${formatRupees(rupees)}) • Razorpay ID: ${paymentId}`
              : `Purchased ${points} points (${formatRupees(rupees)})`,
          })
        } catch (err) {
          console.warn('Wallet database sync notice:', err)
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
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            My Allocation Wallet
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
            Event: <span className="font-semibold text-zinc-900">{event?.name && !event.name.toLowerCase().includes('pitch arena') ? event.name : 'THE BIG PITCH'}</span> • Live Investment Balance
          </p>
        </div>

        {/* Quick jump to buy points button */}
        {remainingAllowance > 0 && (
          <a
            href="#buy-points"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm w-fit"
          >
            <Plus size={14} />
            <span>Buy Extra Points</span>
          </a>
        )}
      </div>

      {/* Balance Overview Card */}
      <div className="rounded-3xl bg-white border border-zinc-200/90 shadow-sm p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold mb-1">
              Total Available Investment Points
            </p>
            <p className="text-4xl sm:text-6xl font-black font-mono text-zinc-950 tracking-tight">
              {formatPoints(available)}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Deployment Ready
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-600 text-xs font-semibold">
              <Gift size={14} className="text-zinc-900" />
              <span>Free Welcome Grant</span>
            </div>
            <p className="text-zinc-950 font-bold font-mono text-xl">
              {formatPoints(wallet?.freePoints ?? 0)}
            </p>
            <p className="text-[11px] text-zinc-400">Granted to you upon joining the arena</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-600 text-xs font-semibold">
              <CreditCard size={14} className="text-zinc-900" />
              <span>Purchased Extra Points</span>
            </div>
            <p className="text-zinc-950 font-bold font-mono text-xl">
              {formatPoints(wallet?.purchasedPoints ?? 0)}
            </p>
            <p className="text-[11px] text-zinc-400">Acquired via secure Razorpay checkout</p>
          </div>
        </div>
      </div>

      {/* FEATURED: POINTS BUYING SECTION — HIGH VISIBILITY */}
      <div id="buy-points" className="scroll-mt-20">
        <div className="rounded-3xl bg-white border-2 border-zinc-950 p-6 sm:p-8 shadow-md space-y-6 relative overflow-hidden">
          {/* Top Pill & Headline */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-zinc-950 text-white flex items-center gap-1.5 shadow-xs">
                  <Zap size={13} className="text-amber-400 fill-amber-400" />
                  Active Rate: ₹1 = {pointsPerRupee} Points
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Instant Wallet Credit
                </span>
              </div>
              <h2 className="text-2xl font-black text-zinc-950 tracking-tight pt-1">
                Acquire Extra Points
              </h2>
              <p className="text-zinc-600 text-xs sm:text-sm leading-relaxed max-w-xl">
                Deploy heavier allocations into promising student startups during live rounds. All packages are instant and verified through official payment channels.
              </p>
            </div>

            {/* Spending Allowance Status Pill */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-left sm:text-right min-w-[180px]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                Your Remaining Allowance
              </span>
              <span className="text-lg font-black font-mono text-zinc-950">
                ₹{remainingAllowance} / ₹{maxPaid}
              </span>
              <span className="text-[11px] text-zinc-500 block">
                {remainingAllowance > 0
                  ? `Can acquire up to ${formatPoints(remainingAllowance * pointsPerRupee)}`
                  : 'Event maximum cap reached'}
              </span>
            </div>
          </div>

          {/* Progress Bar of Event Allowance */}
          <div className="space-y-1.5 bg-zinc-50/80 p-3.5 rounded-2xl border border-zinc-200/70">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700">Attendee Event Cap</span>
              <span className="font-mono font-bold text-zinc-900">
                {formatRupees(spentRupees)} spent of {formatRupees(maxPaid)} limit
              </span>
            </div>
            <ProgressBar
              value={spentRupees}
              max={maxPaid}
              showLabel={false}
            />
          </div>

          {remainingAllowance > 0 ? (
            <div className="space-y-5">
              {/* Dynamic Package Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {purchasePackages.map((pkg) => {
                  const isAvailable = pkg.rupees <= remainingAllowance
                  return (
                    <div
                      key={pkg.rupees}
                      className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all ${
                        pkg.popular
                          ? 'border-zinc-950 ring-2 ring-zinc-950/20 bg-zinc-50/50 shadow-sm'
                          : 'border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs'
                      } ${!isAvailable ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {pkg.popular && (
                        <span className="absolute -top-2.5 right-4 bg-zinc-950 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                          Most Popular
                        </span>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                            {pkg.label}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">
                            ₹1 = {pointsPerRupee} pts
                          </span>
                        </div>

                        <div>
                          <p className="text-2xl sm:text-3xl font-black font-mono text-zinc-950 tracking-tight">
                            +{formatPoints(pkg.points)}
                          </p>
                          <p className="text-zinc-500 text-xs">
                            Instant points added to wallet
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 mt-2 border-t border-zinc-100 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase font-bold block">Cost</span>
                          <span className="font-mono font-black text-lg text-zinc-950">
                            {formatRupees(pkg.rupees)}
                          </span>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => setBuyModal(pkg)}
                          className={`px-4 py-2 font-bold text-xs shadow-xs justify-center ${
                            pkg.popular
                              ? 'bg-zinc-950 text-white hover:bg-zinc-800'
                              : 'bg-zinc-900 text-white hover:bg-zinc-800'
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
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-zinc-950" />
                    Custom Top-Up Calculator (Enter any amount)
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">
                    Max: ₹{remainingAllowance}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="1"
                      max={remainingAllowance}
                      placeholder={`Enter amount (1 - ${remainingAllowance})`}
                      value={customRupeesInput}
                      onChange={(e) => setCustomRupeesInput(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm font-mono font-bold text-zinc-950 focus:outline-none focus:border-zinc-950"
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-start gap-3">
                    <span className="text-xs text-zinc-600 font-mono font-bold whitespace-nowrap">
                      = {formatPoints((parseInt(customRupeesInput) || 0) * pointsPerRupee)}
                    </span>

                    <Button
                      size="sm"
                      onClick={handleCustomBuy}
                      disabled={!customRupeesInput || (parseInt(customRupeesInput) || 0) <= 0 || (parseInt(customRupeesInput) || 0) > remainingAllowance}
                      className="bg-zinc-950 text-white hover:bg-zinc-800 font-bold text-xs px-5 py-2.5"
                    >
                      Buy Custom
                    </Button>
                  </div>
                </div>
              </div>

              {/* Payment Methods Banner */}
              <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-zinc-700">Supported Payment Methods:</span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 font-medium text-zinc-800">
                    UPI (Google Pay, PhonePe, Paytm, QR)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 font-medium text-zinc-800">
                    Cards (Visa, RuPay, Mastercard)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 font-medium text-zinc-800">
                    NetBanking
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                  <CheckCircle2 size={13} />
                  <span>Official Razorpay Gateway</span>
                </div>
              </div>

              {/* E-Commerce Compliance & Policies Reference */}
              <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-emerald-600" />
                  <span>Digital Goods Delivery • Free Shipping (₹0.00) • 100% Secure via Razorpay</span>
                </span>
                <div className="flex items-center gap-3 text-zinc-600 font-semibold">
                  <Link to="/terms" className="hover:text-zinc-950 underline">Terms & Conditions</Link>
                  <Link to="/privacy" className="hover:text-zinc-950 underline">Privacy Policy</Link>
                  <Link to="/terms#refunds" className="hover:text-zinc-950 underline">Refunds</Link>
                  <Link to="/terms#delivery" className="hover:text-zinc-950 underline">Delivery</Link>
                  <Link to="/terms#contact" className="hover:text-zinc-950 underline">Contact</Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-1">
              <p className="font-bold text-zinc-900 text-sm">
                Maximum Event Purchase Allowance Reached
              </p>
              <p className="text-zinc-500 text-xs">
                To keep the pitch tournament fair for all founders, you have reached the maximum allowed limit of {formatRupees(maxPaid)}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3.5">
        <StatCard
          label="Points Deployed"
          value={formatPoints(wallet?.investedPoints ?? 0)}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Pitches Backed"
          value={investments.length}
          subtext={`across ${new Set(investments.map(i => i.teamId)).size} startups`}
          icon={<ArrowUpRight size={18} />}
        />
      </div>

      {/* Transaction History */}
      <div className="space-y-3">
        <SectionHeader title="Transaction Ledger" subtitle={`${ledger.length} records`} />
        <Card className="divide-y divide-zinc-100 border-zinc-200 bg-white shadow-sm overflow-hidden p-0">
          {ledger.length === 0 && (
            <div className="p-8 text-center text-zinc-400 text-xs">
              No transactions recorded yet in your allocation history.
            </div>
          )}
          {[...ledger].reverse().map(entry => (
            <div key={entry.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center flex-shrink-0">
                  {ledgerIcon[entry.type]}
                </div>
                <div>
                  <p className="text-zinc-900 text-sm font-semibold">{entry.description}</p>
                  <p className="text-zinc-400 text-xs font-mono">{formatRelativeTime(entry.createdAt)}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-4 font-mono">
                <p className={`font-bold text-sm ${ledgerColor[entry.type]}`}>
                  {entry.amount > 0 ? '+' : ''}{entry.amount} pts
                </p>
                <p className="text-zinc-400 text-[11px]">{formatPoints(entry.balanceAfter)} bal</p>
              </div>
            </div>
          ))}
        </Card>
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
