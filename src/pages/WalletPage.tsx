// ============================================================
// Wallet Page — Points balance, buy points, transaction history
// Minimalist, high contrast, clean white and black theme
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, TrendingUp, ShoppingCart, ArrowUpRight,
  ArrowDownLeft, Gift, Shield, CreditCard, AlertCircle,
  CheckCircle2, Lock, X, ShieldCheck, ShoppingBag
} from 'lucide-react'
import { useAuthStore, useWalletStore, useEventStore } from '@/store'
import { Card, Button, StatCard, ProgressBar, Badge, SectionHeader, EmptyState } from '@/components/ui'
import { formatPoints, formatRupees, formatRelativeTime } from '@/lib/utils'
import { supabase, TABLES, isSupabaseConfigured } from '@/lib/supabase'
import { toUserFriendlyError } from '@/lib/supabaseApi'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import type { LedgerType } from '@/types'

const PURCHASE_PACKAGES = [
  { points: 50, rupees: 5, label: 'Starter' },
  { points: 100, rupees: 10, label: 'Standard', popular: true },
  { points: 200, rupees: 20, label: 'Growth' },
  { points: 500, rupees: 50, label: 'Investor' },
  { points: 1000, rupees: 100, label: 'Principal' },
]

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
  const [buyModal, setBuyModal] = useState<typeof PURCHASE_PACKAGES[0] | null>(null)

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

  const config = event?.config
  const maxPaid = config?.maxPaidPurchaseRupees ?? 100
  const spentRupees = wallet?.totalPaidRupees ?? 0
  const remainingAllowance = Math.max(0, maxPaid - spentRupees)
  const available = wallet ? wallet.freePoints + wallet.purchasedPoints : 0

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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in text-zinc-900">
      <SectionHeader
        title="My Allocation Wallet"
        subtitle={`Event: ${event?.name ?? 'The Big Pitch'}`}
      />

      {/* Balance Overview */}
      <div className="rounded-3xl bg-white border border-zinc-200/90 shadow-sm p-5 sm:p-8 space-y-4 sm:space-y-5">
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Total Available Points</p>
          <p className="text-4xl sm:text-5xl font-black font-mono text-zinc-950 tracking-tight">{formatPoints(available)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
          <div className="p-3 sm:p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <div className="flex items-center gap-1.5 text-zinc-600 text-xs font-semibold mb-1">
              <Gift size={13} className="text-zinc-900 flex-shrink-0" />
              <span className="truncate">Free Grant</span>
            </div>
            <p className="text-zinc-950 font-bold font-mono text-base sm:text-lg">{formatPoints(wallet?.freePoints ?? 0)} pts</p>
          </div>
          <div className="p-3 sm:p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <div className="flex items-center gap-1.5 text-zinc-600 text-xs font-semibold mb-1">
              <CreditCard size={13} className="text-zinc-900 flex-shrink-0" />
              <span className="truncate">Purchased Extra</span>
            </div>
            <p className="text-zinc-950 font-bold font-mono text-base sm:text-lg">{formatPoints(wallet?.purchasedPoints ?? 0)} pts</p>
          </div>
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

      {/* Purchase Allowance */}
      <Card className="p-5 space-y-3 border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-zinc-950 font-bold text-sm">Attendee Extra Purchase Limit</p>
          <Badge variant={remainingAllowance === 0 ? 'rose' : 'blue'}>
            {remainingAllowance === 0 ? 'Allowance Reached' : `₹${remainingAllowance} remaining`}
          </Badge>
        </div>
        <ProgressBar
          value={spentRupees}
          max={maxPaid}
          showLabel
          label={`${formatRupees(spentRupees)} of ${formatRupees(maxPaid)} allocated cap`}
        />
        <p className="text-zinc-500 text-xs leading-relaxed">
          To maintain fair play, each attendee can purchase up to {formatRupees(maxPaid)} worth of extra points per event.
          {config?.pointsPerRupee && ` Conversion rate: ${config.pointsPerRupee} points per ₹1.`}
        </p>
      </Card>

      {/* Buy More Points */}
      {remainingAllowance > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title="Acquire Extra Points"
            subtitle={`${config?.pointsPerRupee ?? 10} points per ₹1`}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PURCHASE_PACKAGES.filter(p => p.rupees <= remainingAllowance).map(pkg => (
              <button
                key={pkg.points}
                onClick={() => setBuyModal(pkg)}
                className={`
                  relative flex items-center justify-between p-4 rounded-2xl bg-white border transition-all text-left shadow-sm
                  ${pkg.popular
                    ? 'border-zinc-950 ring-1 ring-zinc-950/20 hover:shadow-md'
                    : 'border-zinc-200 hover:border-zinc-400 hover:shadow-sm'}
                `}
              >
                {pkg.popular && (
                  <span className="absolute -top-2 right-4 bg-zinc-950 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    POPULAR
                  </span>
                )}
                <div>
                  <p className="text-zinc-950 font-bold font-mono text-lg">{formatPoints(pkg.points)} pts</p>
                  <p className="text-zinc-500 text-xs font-medium">{pkg.label} Package</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-950 font-bold font-mono text-sm">{formatRupees(pkg.rupees)}</span>
                  <ShoppingCart size={15} className="text-zinc-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
          eventId={event?.id || 'default'}
          eventName={event?.name || 'THE BIG PITCH'}
          onClose={() => setBuyModal(null)}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  )
}
