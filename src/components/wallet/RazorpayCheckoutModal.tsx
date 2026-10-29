// ============================================================
// Razorpay Standard Checkout Portal Modal
// Official Razorpay Gateway for Instant Points Crediting
// ============================================================

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  CreditCard,
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { createPortalOrder, verifyPortalPayment } from '@/lib/supabaseApi'
import { formatPoints, formatRupees } from '@/lib/utils'

interface RazorpayCheckoutModalProps {
  pkg: {
    points: number
    rupees: number
    label: string
  }
  user: { id: string; email: string; displayName: string }
  eventId: string
  eventName: string
  onClose: () => void
  onSuccess: (points: number, rupees: number, paymentId?: string) => void
}

declare global {
  interface Window {
    Razorpay?: any
  }
}

export function RazorpayCheckoutModal({
  pkg,
  user,
  eventId,
  eventName,
  onClose,
  onSuccess,
}: RazorpayCheckoutModalProps) {
  // One idempotency key per purchase attempt; a retry reuses the same server order
  const requestIdRef = useRef(crypto.randomUUID())
  const [isProcessing, setIsProcessing] = useState(false)
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null)

  // Dynamically load Razorpay standard checkout script
  useEffect(() => {
    if (window.Razorpay) {
      setSdkLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => setSdkLoaded(true)
    script.onerror = () => {
      toast.error('Failed to load Razorpay payment gateway script. Please check your internet connection.')
    }
    document.body.appendChild(script)

    return () => {
      // Don't remove script to allow caching across opens
    }
  }, [])

  const handleLaunchRazorpay = async () => {
    if (!sdkLoaded || !window.Razorpay) {
      toast.error('Payment gateway is still initializing. Please try again in a few seconds.')
      return
    }

    setIsProcessing(true)

    // 1. Server creates the order (amount, cap and mode are enforced there)
    const order = await createPortalOrder({
      eventId,
      rupeeAmount: pkg.rupees,
      requestId: requestIdRef.current,
    })

    if (!order.success) {
      setIsProcessing(false)
      toast.error(order.error)
      return
    }

    const options = {
      key: order.keyId,
      order_id: order.orderId,
      amount: pkg.rupees * 100,
      currency: 'INR',
      name: 'THE BIG PITCH',
      description: `${pkg.points} Allocation Points — ${pkg.label}`,
      image: '/favicon.svg',
      prefill: {
        name: user.displayName || '',
        email: user.email || '',
      },
      theme: {
        color: '#09090b',
      },
      handler: async function (response: {
        razorpay_payment_id: string
        razorpay_order_id: string
        razorpay_signature: string
      }) {
        // 2. Server verifies the signature and credits the wallet
        const result = await verifyPortalPayment({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        })

        if (result.success) {
          setLastPaymentId(response.razorpay_payment_id)
          setPaymentSuccess(true)
          toast.success(`Payment verified! ${pkg.points} points credited to your wallet.`)
          onSuccess(pkg.points, pkg.rupees, response.razorpay_payment_id)
        } else {
          // Money was taken; the webhook will still credit the wallet.
          setLastPaymentId(response.razorpay_payment_id)
          toast.error(
            (result.error || 'Verification failed.') +
              ` If points do not appear shortly, contact the event desk with Payment ID ${response.razorpay_payment_id}.`,
            { duration: 12000 }
          )
          setIsProcessing(false)
        }
      },
      modal: {
        ondismiss: function () {
          setIsProcessing(false)
        },
      },
    }

    try {
      const rzpInstance = new window.Razorpay(options)
      rzpInstance.on('payment.failed', function (res: any) {
        setIsProcessing(false)
        toast.error(res.error?.description || 'Payment was unsuccessful or cancelled.')
      })
      rzpInstance.open()
    } catch (err: any) {
      setIsProcessing(false)
      console.error('Razorpay launch exception:', err)
      toast.error('Could not open Razorpay window. Please allow popups and try again.')
    }
  }

  return (
    <div className="modal-overlay z-[100] bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="modal-panel relative max-w-lg bg-white border border-zinc-200/90 rounded-3xl shadow-2xl overflow-y-auto flex flex-col text-zinc-900"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl skeuo-token flex items-center justify-center text-zinc-950 shadow-xs">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="font-black text-zinc-950 text-sm sm:text-base skeuo-text-emboss">
                Razorpay Payment Portal
              </h3>
              <p className="text-zinc-500 text-[11px] font-medium flex items-center gap-1">
                <Lock size={10} className="text-emerald-600" />
                <span>RBI-Authorized Aggregator • 256-Bit SSL Encrypted</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-zinc-200/70 text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {paymentSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-400 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 size={36} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-black text-zinc-950 skeuo-text-emboss">Payment Confirmed!</h4>
                <p className="text-zinc-600 text-xs">
                  Your points have been credited to your allocation wallet.
                </p>
                {lastPaymentId && (
                  <p className="text-[11px] font-mono text-zinc-400 pt-1">
                    Payment ID: {lastPaymentId}
                  </p>
                )}
              </div>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl skeuo-btn-primary font-bold text-xs"
                >
                  Return to Wallet
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Package Summary Card */}
              <div className="p-4 rounded-2xl skeuo-surface border border-zinc-200/80 shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_#FFF] space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider skeuo-text-emboss">Package</span>
                  <span className="text-xs font-extrabold text-zinc-950">{pkg.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">Points to receive</p>
                    <p className="text-2xl font-black text-zinc-950 font-mono tracking-tight flex items-center gap-1.5 mt-0.5">
                      <span>+{formatPoints(pkg.points)}</span>
                      <span className="text-xs text-zinc-500 font-sans font-bold">pts</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 font-medium">Price in INR</p>
                    <p className="text-2xl font-black text-emerald-700 font-mono tracking-tight mt-0.5">
                      {formatRupees(pkg.rupees)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Supported Payment Channels */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 skeuo-text-emboss">
                  Supported Payment Methods
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl skeuo-sunken">
                    <p className="font-black text-zinc-900">UPI</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">GPay, PhonePe, Paytm</p>
                  </div>
                  <div className="p-2.5 rounded-xl skeuo-sunken">
                    <p className="font-black text-zinc-900">Cards</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Visa, MC, RuPay</p>
                  </div>
                  <div className="p-2.5 rounded-xl skeuo-sunken">
                    <p className="font-black text-zinc-900">NetBanking</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">50+ Indian Banks</p>
                  </div>
                </div>
              </div>

              {/* Instant Delivery Guarantee */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 text-xs">
                <Zap size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="leading-snug">
                  <strong>Instant Delivery:</strong> Points are credited immediately to your balance as soon as payment is authorized in the Razorpay window.
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleLaunchRazorpay}
                  disabled={isProcessing || !sdkLoaded}
                  className="w-full py-3.5 px-4 rounded-xl skeuo-btn-primary font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Opening Secure Razorpay Portal...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={15} />
                      <span>Proceed to Pay {formatRupees(pkg.rupees)}</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>

              {/* Terms & Merchant footer */}
              <p className="text-center text-[10px] text-zinc-400 font-medium">
                By proceeding, you agree to our{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700">
                  Privacy Policy
                </a>
                .
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
