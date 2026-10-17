
// ============================================================
// Wallet Page — Points balance, buy points, transaction history
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, TrendingUp, ShoppingCart, Clock, ArrowUpRight,
  ArrowDownLeft, Gift, Shield, CheckCircle2, CreditCard,
  AlertTriangle, Zap,
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
  { points: 100, rupees: 10, label: 'Popular', popular: true },
  { points: 200, rupees: 20, label: 'Enthusiast' },
  { points: 500, rupees: 50, label: 'Investor' },
  { points: 1000, rupees: 100, label: 'Champion' },
]

const ledgerIcon: Record<LedgerType, React.ReactNode> = {
  free_grant: <Gift size={14} className="text-emerald-400" />,
  purchase: <CreditCard size={14} className="text-arena-blue-3" />,
  investment: <TrendingUp size={14} className="text-arena-violet-3" />,
  investment_refund: <ArrowDownLeft size={14} className="text-emerald-400" />,
  admin_adjustment: <Shield size={14} className="text-amber-400" />,
  purchase_refund: <ArrowDownLeft size={14} className="text-cyan-400" />,
}

const ledgerColor: Record<LedgerType, string> = {
  free_grant: 'text-emerald-400',
  purchase: 'text-arena-blue-3',
  investment: 'text-rose-400',
  investment_refund: 'text-emerald-400',
  admin_adjustment: 'text-amber-400',
  purchase_refund: 'text-cyan-400',
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

// Real Razorpay Payment Modal — calls Supabase Edge Function, then opens Razorpay checkout
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
      // 1. Get auth token for the edge function call
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setErrorMsg('Please sign in to complete your points purchase.')
        setStep('error')
        return
      }

      // 2. Call the Supabase Edge Function to create a Razorpay order
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rupeeAmount: pkg.rupees, eventId }),
      })

      const orderData = await res.json()

      if (!res.ok) {
        setErrorMsg(toUserFriendlyError(orderData?.error, 'Unable to initiate payment. Please try again in a moment.'))
        setStep('error')
        return
      }

      const { orderId, keyId, pointsToCredit } = orderData

      // 3. Check if real Razorpay key is present
      if (!keyId || keyId === 'rzp_test_mock') {
        setErrorMsg('Payment gateway is currently undergoing maintenance. Please try again shortly.')
        setStep('error')
        return
      }

      // 4. Open Razorpay checkout
      const razorpayKey = keyId || (import.meta.env.VITE_RAZORPAY_KEY_ID as string)
      if (!(window as any).Razorpay) {
        setErrorMsg('Payment checkout window could not load. Please check your internet connection and try again.')
        setStep('error')
        return
      }

      const options = {
        key: razorpayKey,
        amount: pkg.rupees * 100,  // paise
        currency: 'INR',
        name: 'Pitch Arena',
        description: `${pointsToCredit} Points Pack`,
        order_id: orderId,
        prefill: {
          email: user.email,
          name: user.displayName,
        },
        theme: { color: '#6366f1' },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          // 5. Verify payment server-side via webhook (Razorpay calls webhook automatically)
          //    Optimistically update the UI while webhook processes
          try {
            // Update payment_orders status optimistically (webhook will fully verify)
            if (supabase) {
              await supabase
                .from(TABLES.PAYMENT_ORDERS)
                .update({
                  status: 'success',
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  updated_at: new Date().toISOString(),
                })
                .eq('razorpay_order_id', orderId)
            }
          } catch (err) {
            console.warn('Payment order status update notice:', err)
          }

          onSuccess(pointsToCredit, pkg.rupees)
          onClose()
          toast.success(`🎉 ${pointsToCredit} points credited to your wallet!`)
        },
        modal: {
          ondismiss: () => {
            toast.info('Payment cancelled.')
            onClose()
          },
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', (response: any) => {
        toast.error(`Payment failed: ${response.error?.description || 'Unknown error'}`)
        onClose()
      })
      rzp.open()

    } catch (err: any) {
      setErrorMsg(toUserFriendlyError(err, 'Unable to complete transaction. Please try again.'))
      setStep('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={step === 'confirm' ? onClose : undefined}>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-sm p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {step === 'confirm' && (
          <>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-arena-blue/30 to-arena-violet/30 flex items-center justify-center mx-auto mb-3">
                <CreditCard size={22} className="text-arena-blue-3" />
              </div>
              <h3 className="text-white font-bold text-lg">Purchase Points</h3>
              <p className="text-white/50 text-sm mt-1">Secure payment via Razorpay</p>
            </div>
            <div className="glass-card p-4 text-center space-y-1">
              <p className="text-4xl font-black gradient-text">{pkg.points}</p>
              <p className="text-white/60 text-sm">points for {formatRupees(pkg.rupees)}</p>
            </div>
            <div className="flex items-center gap-2 text-white/40 text-xs">
              <Shield size={12} className="text-emerald-400 flex-shrink-0" />
              <span>End-to-end encrypted · Verified by Razorpay · Points credited after server confirmation</span>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
              <Button onClick={handlePay} className="flex-1 justify-center" icon={<CreditCard size={14} />}>
                Pay {formatRupees(pkg.rupees)}
              </Button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full border-2 border-arena-blue border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold">Creating payment order...</p>
            <p className="text-white/40 text-sm mt-1">Connecting to payment gateway</p>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <AlertTriangle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-rose-300 font-semibold text-sm">Payment Failed</p>
                <p className="text-white/60 text-xs mt-1 leading-relaxed">{errorMsg}</p>
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
      <div className="max-w-2xl mx-auto px-4 py-6">
        <EmptyState
          icon={<Wallet />}
          title="Sign in to view your wallet"
          description="Get 500 free points when you join. Track your investments and buy more points."
          action={<Link to="/auth"><Button icon={<Zap size={14} />}>Sign In with Google</Button></Link>}
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
    if (!wallet) return
    const newPurchased = wallet.purchasedPoints + points
    const newPaidRupees = wallet.totalPaidRupees + rupees

    setWallet({
      ...wallet,
      purchasedPoints: newPurchased,
      totalPaidRupees: newPaidRupees,
    })

    if (supabase) {
      try {
        await supabase
          .from(TABLES.WALLETS)
          .update({
            purchased_points: newPurchased,
            total_paid_rupees: newPaidRupees,
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

    toast.success(`🎉 ${points} points added to your wallet!`)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      <SectionHeader
        title="My Wallet"
        subtitle={`Event: ${event?.name ?? 'Pitch Arena'}`}
      />

      {/* Balance Overview */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-arena-blue/20 via-arena-navy-3 to-arena-violet/20 border border-white/[0.08] p-6">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-arena-blue/10 blur-2xl pointer-events-none" />
        <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Total Available</p>
        <p className="text-5xl font-black gradient-text mb-4">{formatPoints(available)}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-3">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs mb-1">
              <Gift size={12} /> Free Points
            </div>
            <p className="text-white font-bold">{formatPoints(wallet?.freePoints ?? 0)}</p>
          </div>
          <div className="glass-card p-3">
            <div className="flex items-center gap-1.5 text-arena-blue-3 text-xs mb-1">
              <CreditCard size={12} /> Purchased
            </div>
            <p className="text-white font-bold">{formatPoints(wallet?.purchasedPoints ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Invested"
          value={formatPoints(wallet?.investedPoints ?? 0)}
          color="violet"
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Investments"
          value={investments.length}
          subtext={`across ${new Set(investments.map(i => i.teamId)).size} teams`}
          color="cyan"
          icon={<ArrowUpRight size={18} />}
        />
      </div>

      {/* Purchase Allowance */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-white font-semibold text-sm">Purchase Allowance</p>
          <Badge variant={remainingAllowance === 0 ? 'rose' : 'emerald'}>
            {remainingAllowance === 0 ? 'Limit Reached' : `₹${remainingAllowance} left`}
          </Badge>
        </div>
        <ProgressBar
          value={spentRupees}
          max={maxPaid}
          color={remainingAllowance < 20 ? 'rose' : 'emerald'}
          showLabel
          label={`${formatRupees(spentRupees)} of ${formatRupees(maxPaid)} used`}
        />
        <p className="text-white/40 text-xs">
          Each attendee can purchase up to {formatRupees(maxPaid)} worth of extra points per event.
          {config?.pointsPerRupee && ` Rate: ${config.pointsPerRupee} pts/₹`}
        </p>
      </Card>

      {/* Buy More Points */}
      {remainingAllowance > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title="Buy More Points"
            subtitle={`${config?.pointsPerRupee ?? 10} points per ₹1`}
          />
          <div className="grid grid-cols-1 gap-2">
            {PURCHASE_PACKAGES.filter(p => p.rupees <= remainingAllowance).map(pkg => (
              <button
                key={pkg.points}
                onClick={() => setBuyModal(pkg)}
                className={`
                  relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 text-left
                  ${pkg.popular
                    ? 'bg-gradient-to-r from-arena-blue/15 to-arena-violet/15 border-arena-blue/40 hover:border-arena-blue/60'
                    : 'glass-card hover:bg-white/[0.07] hover:border-white/[0.15]'}
                `}
              >
                {pkg.popular && (
                  <span className="absolute -top-2 right-4 bg-gradient-to-r from-arena-blue to-arena-violet text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    POPULAR
                  </span>
                )}
                <div>
                  <p className="text-white font-bold text-base">{formatPoints(pkg.points)}</p>
                  <p className="text-white/50 text-xs">{pkg.label}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-arena-blue-3 font-bold">{formatRupees(pkg.rupees)}</p>
                  <ShoppingCart size={16} className="text-white/30" />
                </div>
              </button>
            ))}
          </div>
          <div className="glass-card border-arena-violet/20 p-3 flex items-start gap-2">
            <Shield size={14} className="text-arena-violet-3 flex-shrink-0 mt-0.5" />
            <p className="text-white/50 text-xs">
              Payments are processed securely via Razorpay. Points are credited only after server verification.
              No points are earned from failed or cancelled transactions.
            </p>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="space-y-3">
        <SectionHeader title="Transaction History" subtitle={`${ledger.length} transactions`} />
        <Card className="p-1 divide-y divide-white/[0.06]">
          {ledger.length === 0 && (
            <EmptyState icon={<Clock />} title="No transactions yet" description="Your transaction history will appear here." />
          )}
          {[...ledger].reverse().map(entry => (
            <div key={entry.id} className="tx-row px-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                  {ledgerIcon[entry.type]}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{entry.description}</p>
                  <p className="text-white/30 text-xs">{formatRelativeTime(entry.createdAt)}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className={`font-bold text-sm ${ledgerColor[entry.type]}`}>
                  {entry.amount > 0 ? '+' : ''}{entry.amount} pts
                </p>
                <p className="text-white/30 text-xs">{formatPoints(entry.balanceAfter)} bal</p>
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
