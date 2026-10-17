// ============================================================
// Wallet Page — Points balance, buy points, transaction history
// Minimalist, high contrast, clean white and black theme
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, TrendingUp, ShoppingCart, Clock, ArrowUpRight,
  ArrowDownLeft, Gift, Shield, CreditCard, AlertTriangle, Zap
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

// Real Razorpay Payment Modal
function RazorpayPaymentModal({
  pkg,
  user,
  wallet,
  eventId,
  onClose,
  onSuccess,
}: {
  pkg: { points: number; rupees: number; label: string }
  user: { id: string; email: string; displayName: string }
  wallet: { id: string; freePoints: number; purchasedPoints: number; totalPaidRupees: number }
  eventId: string
  onClose: () => void
  onSuccess: (points: number, rupees: number) => void
}) {
  const [step, setStep] = useState<'confirm' | 'processing' | 'error'>('confirm')
  const [errorMsg, setErrorMsg] = useState('')

  const handlePay = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Payment services are temporarily unavailable. Please try again shortly.')
      setStep('error')
      return
    }

    setStep('processing')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setErrorMsg('Please sign in to complete your points purchase.')
        setStep('error')
        return
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          points: pkg.points,
          rupees: pkg.rupees,
          eventId,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.orderId) {
        setErrorMsg(toUserFriendlyError(data?.error, 'Unable to create payment order. Please try again.'))
        setStep('error')
        return
      }

      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID as string
      if (!razorpayKey) {
        setErrorMsg('Payment gateway configuration is currently being finalized. Please contact the organizer.')
        setStep('error')
        return
      }

      const options = {
        key: razorpayKey,
        amount: data.amount,
        currency: data.currency ?? 'INR',
        name: 'The Big Pitch',
        description: `${pkg.points} Audience Allocation Points`,
        order_id: data.orderId,
        prefill: {
          name: user.displayName,
          email: user.email,
        },
        theme: {
          color: '#18181B',
        },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          onSuccess(pkg.points, pkg.rupees)
          onClose()
        },
        modal: {
          ondismiss: () => {
            onClose()
          },
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', (resp: any) => {
        setErrorMsg(toUserFriendlyError(resp.error?.description, 'Payment was declined or cancelled.'))
        setStep('error')
      })
      rzp.open()
    } catch (err: any) {
      setErrorMsg(toUserFriendlyError(err, 'Unable to connect to the payment gateway.'))
      setStep('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-zinc-200 shadow-2xl rounded-2xl w-full max-w-sm p-6 space-y-5 text-zinc-900"
        onClick={e => e.stopPropagation()}
      >
        {step === 'confirm' && (
          <>
            <div className="text-center space-y-1">
              <div className="w-11 h-11 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-2 text-zinc-900">
                <CreditCard size={20} />
              </div>
              <h3 className="text-zinc-950 font-bold text-lg">Purchase Allocation Points</h3>
              <p className="text-zinc-500 text-xs">Secure transaction processed via Razorpay</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 text-center space-y-0.5">
              <p className="text-3xl font-black font-mono text-zinc-950">{pkg.points}</p>
              <p className="text-zinc-500 text-xs font-medium">points for {formatRupees(pkg.rupees)}</p>
            </div>
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <Shield size={13} className="text-zinc-800 flex-shrink-0" />
              <span>Verified server-side balance credit</span>
            </div>
            <div className="flex gap-2.5 pt-1">
              <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
              <Button onClick={handlePay} className="flex-1 justify-center bg-zinc-950 text-white" icon={<CreditCard size={14} />}>
                Pay {formatRupees(pkg.rupees)}
              </Button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="text-center py-8 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin mx-auto" />
            <p className="text-zinc-950 font-semibold text-sm">Opening Secure Checkout...</p>
            <p className="text-zinc-400 text-xs">Connecting to payment gateway</p>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
              <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">Payment Notice</p>
                <p className="text-rose-700 text-xs mt-0.5 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={onClose} className="w-full justify-center">Close</Button>
          </div>
        )}
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
          description="Every attendee receives 500 free points upon sign in to back live pitching startups."
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

  const handlePurchaseSuccess = async (points: number, rupees: number) => {
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
            description: `Purchased ${points} points (${formatRupees(rupees)})`,
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
      <div className="rounded-3xl bg-white border border-zinc-200/90 shadow-sm p-6 sm:p-8 space-y-5">
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Total Available Points</p>
          <p className="text-5xl font-black font-mono text-zinc-950 tracking-tight">{formatPoints(available)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <div className="flex items-center gap-1.5 text-zinc-600 text-xs font-semibold mb-1">
              <Gift size={13} className="text-zinc-900" />
              <span>Free Welcome Grant</span>
            </div>
            <p className="text-zinc-950 font-bold font-mono text-lg">{formatPoints(wallet?.freePoints ?? 0)} pts</p>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <div className="flex items-center gap-1.5 text-zinc-600 text-xs font-semibold mb-1">
              <CreditCard size={13} className="text-zinc-900" />
              <span>Purchased Extra</span>
            </div>
            <p className="text-zinc-950 font-bold font-mono text-lg">{formatPoints(wallet?.purchasedPoints ?? 0)} pts</p>
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

      {/* Buy Modal */}
      {buyModal && wallet && user && (
        <RazorpayPaymentModal
          pkg={buyModal}
          user={user}
          wallet={wallet}
          eventId={event?.id || 'default'}
          onClose={() => setBuyModal(null)}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  )
}
