import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  X,
  QrCode,
  Copy,
  Check,
  Clock,
  Sparkles,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Edit2,
  Smartphone,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  createPaymentIntent,
  claimPaymentIntent,
  getPaymentIntent,
  getUserVpa,
  updateUserVpa,
} from '@/lib/supabaseApi'
import { formatPoints, formatRupees } from '@/lib/utils'

interface StaticQRCheckoutModalProps {
  pkg: {
    points: number
    rupees: number
    label: string
    qrImageUrl?: string
    upiVpa?: string
  }
  user: { id: string; email: string; displayName: string }
  eventId: string
  eventName: string
  onClose: () => void
  onSuccess: (points: number, rupees: number, paymentId?: string) => void
}

export function StaticQRCheckoutModal({
  pkg,
  user,
  eventId,
  eventName,
  onClose,
  onSuccess,
}: StaticQRCheckoutModalProps) {
  // 2-Step Flow: Step 1 asks for Payer UPI ID -> Step 2 shows QR to pay
  const [checkoutStep, setCheckoutStep] = useState<'vpa_input' | 'scan_qr'>('vpa_input')

  // Intent State
  const [loadingIntent, setLoadingIntent] = useState(true)
  const [intentId, setIntentId] = useState<string | null>(null)
  const [claimCode, setClaimCode] = useState<string>('')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(30 * 60)

  // VPA State (Auto-saved Payer UPI ID)
  const [payerVpa, setPayerVpa] = useState<string>('')
  const [isEditingVpa, setIsEditingVpa] = useState<boolean>(false)
  const [savedVpa, setSavedVpa] = useState<string | null>(null)

  // Fallback UTR state (hidden by default)
  const [showUtrFallback, setShowUtrFallback] = useState<boolean>(false)
  const [optionalUtr, setOptionalUtr] = useState<string>('')

  // Submission & Polling State
  const [submittingClaim, setSubmittingClaim] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [status, setStatus] = useState<'initiating' | 'pending' | 'polling' | 'credited' | 'manual_review' | 'expired' | 'vpa_mismatch'>('initiating')
  const [statusMessage, setStatusMessage] = useState('')
  const [mismatchHint, setMismatchHint] = useState<string>('')
  const pollingTimerRef = useRef<any>(null)

  // Merchant Configuration (Used for QR Generation / Deep link only)
  const merchantVpa = pkg.upiVpa || (import.meta.env.VITE_MERCHANT_UPI_VPA as string) || 'sphinx.ecell@upi'
  const merchantName = (import.meta.env.VITE_MERCHANT_NAME as string) || 'THE BIG PITCH - SPHINX 2026'
  const staticQrImageUrl = pkg.qrImageUrl || (import.meta.env.VITE_STATIC_QR_URL as string) || ''

  // UPI Deep Link for scanning
  const upiIntentString = `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(merchantName)}&am=${pkg.rupees}&cu=INR&tn=${encodeURIComponent(claimCode || 'SphinxTokens')}`

  // 1. Load User's Saved VPA on Mount (Do NOT create database intent yet!)
  useEffect(() => {
    let isMounted = true

    async function init() {
      setLoadingIntent(true)
      setErrorMsg('')

      // Fetch user's saved VPA
      const vpa = await getUserVpa(user.id)
      if (isMounted) {
        if (vpa) {
          setSavedVpa(vpa)
          setPayerVpa(vpa)
          setIsEditingVpa(false)
        } else {
          setIsEditingVpa(true)
        }
        setStatus('pending')
        setLoadingIntent(false)
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [user.id])

  // 2. Countdown Timer
  useEffect(() => {
    if (!expiresAt) return

    const interval = setInterval(() => {
      const remainingMs = new Date(expiresAt).getTime() - Date.now()
      if (remainingMs <= 0) {
        setTimeLeft(0)
        setStatus('expired')
        clearInterval(interval)
      } else {
        setTimeLeft(Math.floor(remainingMs / 1000))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  // 3. Supabase Realtime Listener on Payment Intent
  useEffect(() => {
    if (!intentId || !supabase) return

    const channel = supabase
      .channel(`payment_intent_${intentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_intents',
          filter: `id=eq.${intentId}`,
        },
        payload => {
          const updated = payload.new as any
          if (!updated) return

          if (updated.status === 'credited') {
            setStatus('credited')
            setStatusMessage('Payment verified! Your tokens have been credited to your wallet.')
            toast.success(`${pkg.points} points credited to your wallet!`)
            onSuccess(pkg.points, pkg.rupees, updated.matched_payment_id)
            stopPolling()
          } else if (updated.status === 'vpa_mismatch') {
            setStatus('vpa_mismatch')
            toast.error('UPI ID Mismatch: Payment received from a different UPI ID!', { duration: 6000 })
            setShowUtrFallback(true)
            stopPolling()
          } else if (updated.status === 'manual_review') {
            setStatus('manual_review')
            setStatusMessage('Payment detected. Queued for fast desk review.')
            stopPolling()
          }
        }
      )
      .subscribe()

    return () => {
      if (supabase) supabase.removeChannel(channel)
      stopPolling()
    }
  }, [intentId, pkg.points, pkg.rupees, onSuccess])

  // Polling helper
  const startPolling = () => {
    stopPolling()
    setStatus('polling')
    let attempts = 0
    const maxAttempts = 24 // 2 minutes (every 5 seconds)

    pollingTimerRef.current = setInterval(async () => {
      attempts++
      if (!intentId) return

      try {
        const current = await getPaymentIntent(intentId)
        if (current?.status === 'credited') {
          setStatus('credited')
          setStatusMessage('Payment verified! Your tokens have been credited.')
          toast.success(`${pkg.points} points credited to your wallet!`)
          onSuccess(pkg.points, pkg.rupees, current.matchedPaymentId)
          stopPolling()
        } else if (current?.status === 'vpa_mismatch') {
          setStatus('vpa_mismatch')
          toast.error('UPI ID Mismatch: Payment received from a different UPI ID!', { duration: 6000 })
          setShowUtrFallback(true)
          stopPolling()
        } else if (current?.status === 'manual_review') {
          setStatus('manual_review')
          setStatusMessage('Payment flagged for rapid review by our arena desk.')
          stopPolling()
        } else if (attempts >= maxAttempts) {
          stopPolling()
          setStatus('pending')
          toast.info('Payment still awaiting bank settlement. You can click "Check Status" anytime.')
        }
      } catch {
        // silent fail during polling
      }
    }, 5000)
  }

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
  }

  const handleCopyClaimCode = () => {
    if (!claimCode) return
    navigator.clipboard.writeText(claimCode)
    setCopiedCode(true)
    toast.success('Claim reference copied!')
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // Step 1: Validate UPI ID and advance to QR display
  const handleProceedToQR = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMsg('')

    const cleanVpa = payerVpa.trim()
    if (!cleanVpa || !cleanVpa.includes('@') || cleanVpa.length < 3) {
      setErrorMsg('Please enter a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm)')
      setIsEditingVpa(true)
      return
    }

    // Auto-save VPA to profile so user never has to re-enter
    updateUserVpa(cleanVpa).catch(() => {})
    setSavedVpa(cleanVpa)
    setIsEditingVpa(false)
    setCheckoutStep('scan_qr')
  }

  // Step 2: Handle "I Have Paid" (Creates intent on demand and auto-matches via VPA)
  const handleClaimWithVpa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMsg('')

    const cleanVpa = payerVpa.trim()
    if (!cleanVpa || !cleanVpa.includes('@')) {
      setErrorMsg('Please enter a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm)')
      setCheckoutStep('vpa_input')
      setIsEditingVpa(true)
      return
    }

    setSubmittingClaim(true)

    try {
      updateUserVpa(cleanVpa).catch(() => {})
      setSavedVpa(cleanVpa)

      let currentIntentId = intentId
      // Only create a purchase claim in the database when the user actually claims "I Have Paid"!
      if (!currentIntentId) {
        const createRes = await createPaymentIntent(eventId, pkg.rupees)
        if (!createRes.success || !createRes.intentId) {
          setErrorMsg(createRes.error || 'Could not register purchase claim. Please try again.')
          setSubmittingClaim(false)
          return
        }
        currentIntentId = createRes.intentId
        setIntentId(createRes.intentId)
        setClaimCode(createRes.claimCode || '')
        setExpiresAt(createRes.expiresAt || null)
      }

      const result = await claimPaymentIntent(
        currentIntentId,
        optionalUtr.trim() || undefined,
        cleanVpa
      )

      if (result.matched || result.status === 'credited') {
        setStatus('credited')
        setStatusMessage(result.message || 'Payment successfully verified!')
        toast.success(`${pkg.points} points credited to your wallet!`)
        onSuccess(pkg.points, pkg.rupees, result.paymentId)
      } else if (result.status === 'vpa_mismatch') {
        setStatus('vpa_mismatch')
        setMismatchHint(result.receivedVpaHint || 'a different UPI ID')
        setStatusMessage(result.message || 'Payment received from a different UPI ID.')
        toast.error('UPI ID Mismatch: Payment received from a different UPI ID!', { duration: 7000 })
        setShowUtrFallback(true)
      } else if (result.status === 'manual_review') {
        setStatus('manual_review')
        setStatusMessage(result.message || 'Queued for quick admin review.')
      } else {
        toast.info('Claim submitted. Awaiting bank webhook confirmation...')
        startPolling()
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verification check failed. Please try again.')
    } finally {
      setSubmittingClaim(false)
    }
  }

  // Manual Check Status Button
  const handleManualCheckStatus = async () => {
    if (!intentId) {
      handleClaimWithVpa()
      return
    }
    setCheckingStatus(true)
    setErrorMsg('')

    try {
      const updated = await getPaymentIntent(intentId)
      if (updated?.status === 'credited') {
        setStatus('credited')
        setStatusMessage('Payment verified! Your tokens have been credited.')
        toast.success(`${pkg.points} points credited to your wallet!`)
        onSuccess(pkg.points, pkg.rupees, updated.matchedPaymentId)
      } else if (updated?.status === 'vpa_mismatch') {
        setStatus('vpa_mismatch')
        toast.error('Payment detected, but from a different UPI ID!')
        setShowUtrFallback(true)
      } else if (updated?.status === 'manual_review') {
        setStatus('manual_review')
      } else {
        toast.info('Payment still awaiting bank settlement. Please allow up to 1 minute.')
      }
    } catch (err: any) {
      setErrorMsg('Could not fetch updated status.')
    } finally {
      setCheckingStatus(false)
    }
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-zinc-950/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className={`skeuo-surface rounded-3xl w-full my-auto shadow-[0_25px_70px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_#FFF] border border-zinc-200/80 overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh] transition-all duration-300 ${
          checkoutStep === 'scan_qr' && status !== 'credited' && status !== 'expired'
            ? 'max-w-[420px] md:max-w-[680px]'
            : 'max-w-[420px]'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/70 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl skeuo-token-dark flex items-center justify-center flex-shrink-0 text-white shadow-sm">
              <QrCode size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="text-zinc-950 font-black text-sm sm:text-base tracking-tight leading-none truncate skeuo-text-emboss">
                {status === 'credited'
                  ? 'Payment Confirmed'
                  : checkoutStep === 'vpa_input'
                  ? 'Confirm Your UPI ID'
                  : 'Scan & Pay QR'}
              </h3>
              <p className="text-zinc-500 text-[10px] sm:text-[11px] mt-0.5 sm:mt-1 truncate font-medium">
                {status === 'credited'
                  ? 'Tokens Credited to Wallet'
                  : checkoutStep === 'vpa_input'
                  ? 'Step 1 of 2: Payer Verification'
                  : 'Step 2 of 2: Authoritative Settlement'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Checkout"
            className="skeuo-btn-secondary p-1.5 rounded-xl text-zinc-600 hover:text-zinc-950 transition-colors flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-4 md:p-5 overflow-y-auto overscroll-contain flex-1">

          {/* SUCCESS VIEW */}
          {status === 'credited' ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-6 px-4 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto shadow-inner border border-emerald-500/30">
                <CheckCircle2 size={36} className="animate-bounce" />
              </div>
              <div>
                <h4 className="text-xl font-black text-zinc-950 tracking-tight">Payment Verified!</h4>
                <p className="text-zinc-600 text-xs mt-1">
                  <span className="font-bold text-zinc-950">+{formatPoints(pkg.points)} points</span> have been credited to your wallet.
                </p>
              </div>
              <div className="p-3 rounded-2xl skeuo-sunken text-xs space-y-1 text-left text-zinc-700">
                <div className="flex justify-between">
                  <span>Package:</span>
                  <span className="font-bold text-zinc-950">{pkg.label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="font-bold text-zinc-950 font-mono">{formatRupees(pkg.rupees)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Matched Payer UPI:</span>
                  <span className="font-bold text-emerald-700 font-mono">{payerVpa || 'Auto-matched'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-semibold text-emerald-600">Authoritative Credit Confirmed</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="skeuo-btn-primary w-full py-3 rounded-xl font-bold text-sm tracking-wide shadow-md text-white"
              >
                Return to Arena
              </button>
            </motion.div>
          ) : status === 'expired' ? (
            /* EXPIRED VIEW */
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center mx-auto">
                <Clock size={28} />
              </div>
              <h4 className="text-lg font-bold text-zinc-950">Purchase Window Expired</h4>
              <p className="text-zinc-500 text-xs max-w-xs mx-auto">
                This purchase intent window has timed out. Please initiate a new top-up request.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="skeuo-btn-secondary px-5 py-2.5 rounded-xl font-semibold text-xs"
              >
                Close & Retry
              </button>
            </div>
          ) : checkoutStep === 'vpa_input' ? (
            /* ─────────────────────────────────────────────────────────────
               STEP 1: ASK UPI ID FIRST & CONFIRM
               ───────────────────────────────────────────────────────────── */
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              {/* Package Summary */}
              <div className="rounded-2xl skeuo-sunken p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-extrabold text-zinc-950 text-sm block truncate skeuo-text-emboss">
                      {pkg.label}
                    </span>
                    <span className="text-emerald-700 text-xs font-bold">
                      +{formatPoints(pkg.points)} Participation Points
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-mono font-black text-xl text-zinc-950 block">
                      {formatRupees(pkg.rupees)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-medium">Exact amount</span>
                  </div>
                </div>
              </div>

              {/* Payer UPI ID Input */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/90 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                    <Smartphone size={14} className="text-zinc-600" />
                    <span>Your Payer UPI ID (VPA):</span>
                  </span>
                  {!isEditingVpa && savedVpa && (
                    <button
                      type="button"
                      onClick={() => setIsEditingVpa(true)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-950 font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Edit2 size={11} />
                      <span>Change</span>
                    </button>
                  )}
                </div>

                {!isEditingVpa && savedVpa ? (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-zinc-200 font-mono text-xs shadow-sm">
                    <span className="font-bold text-zinc-950">{savedVpa}</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Saved
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                      value={payerVpa}
                      onChange={e => {
                        setPayerVpa(e.target.value)
                        setErrorMsg('')
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleProceedToQR(e)
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl skeuo-sunken text-xs font-mono font-bold text-zinc-950 placeholder:text-zinc-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                )}
              </div>

              {/* Prominent Warning Banner */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 leading-relaxed">
                  <strong className="font-bold">Important Warning:</strong> You must make the UPI payment from the <strong>exact same UPI ID</strong> that you enter here. If you pay from a different UPI ID, your payment cannot be verified and points might not be credited to your account!
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs flex items-center gap-1.5">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Proceed to QR Button */}
              <button
                type="button"
                onClick={handleProceedToQR}
                disabled={loadingIntent}
                className="skeuo-btn-primary w-full py-3.5 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-md text-white disabled:opacity-50"
              >
                <span>Proceed to Payment QR</span>
                <ArrowRight size={15} />
              </button>
            </motion.div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               STEP 2: SCAN & PAY VIA QR CODE (RESPONSIVE GRID & COMPACT MOBILE)
               ───────────────────────────────────────────────────────────── */
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3 md:space-y-0 md:grid md:grid-cols-12 md:gap-4 md:items-start"
            >
              {/* LEFT COLUMN (ON MD) / TOP (ON MOBILE): QR CODE CARD */}
              <div className="md:col-span-6 flex flex-col items-center justify-center p-3 sm:p-3.5 md:p-4 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-2.5">
                <div className="relative p-2 rounded-2xl bg-white border border-zinc-200 shadow-inner group flex items-center justify-center">
                  {staticQrImageUrl ? (
                    <img
                      src={staticQrImageUrl}
                      alt={`${pkg.label} Static QR`}
                      className="w-36 h-36 xs:w-40 xs:h-40 sm:w-44 sm:h-44 md:w-48 md:h-48 object-contain rounded-lg"
                    />
                  ) : (
                    <QRCodeSVG
                      value={upiIntentString}
                      size={152}
                      level="M"
                      includeMargin={false}
                      className="rounded-lg w-32 h-32 xs:w-36 xs:h-36 sm:w-40 sm:h-40 md:w-44 md:h-44"
                    />
                  )}
                </div>

                <div className="text-center space-y-0.5">
                  <p className="text-[11px] sm:text-xs font-bold text-zinc-900 leading-tight">
                    Scan with any UPI App
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-zinc-500">
                    GPay &bull; PhonePe &bull; Paytm &bull; BHIM
                  </p>
                </div>

                {/* Mobile Direct UPI Intent Button */}
                <a
                  href={upiIntentString}
                  className="w-full py-2 px-3 rounded-xl skeuo-btn-secondary text-[11px] sm:text-xs font-bold text-center flex items-center justify-center gap-1.5 text-zinc-800 transition-transform active:scale-[0.98]"
                >
                  <span>Pay {formatRupees(pkg.rupees)} in UPI App</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              {/* RIGHT COLUMN (ON MD) / BOTTOM (ON MOBILE): INFO & ACTIONS */}
              <div className="md:col-span-6 space-y-2.5">
                {/* Back & Active Payer Bar */}
                <div className="flex items-center justify-between text-xs bg-zinc-100/90 px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-200">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Smartphone size={12} className="text-zinc-500 flex-shrink-0" />
                    <span className="text-zinc-500 text-[10px] sm:text-[11px]">Paying from:</span>
                    <span className="font-mono font-bold text-zinc-950 text-xs truncate max-w-[125px] sm:max-w-[160px]">{payerVpa}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutStep('vpa_input')
                      setIsEditingVpa(true)
                    }}
                    className="text-[10px] sm:text-[11px] text-zinc-600 hover:text-zinc-950 font-bold flex items-center gap-0.5 flex-shrink-0 ml-1.5"
                  >
                    <Edit2 size={10} />
                    <span>Change</span>
                  </button>
                </div>

                {/* Package Summary & Timer Bar */}
                <div className="rounded-2xl skeuo-sunken p-2.5 sm:p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="min-w-0">
                      <span className="font-black text-zinc-950 text-xs sm:text-sm block truncate">
                        {pkg.label} &bull; {formatRupees(pkg.rupees)}
                      </span>
                      <span className="text-emerald-700 text-[11px] sm:text-xs font-bold">
                        +{formatPoints(pkg.points)} Points
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full font-semibold border border-amber-500/20 flex-shrink-0">
                      <Clock size={11} />
                      <span>{timeDisplay}</span>
                    </div>
                  </div>

                  {claimCode && (
                    <div className="pt-1.5 border-t border-zinc-200/60 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-sans font-semibold">Ref Code:</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="font-bold text-zinc-950 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 text-[11px]">
                          {claimCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyClaimCode}
                          className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors"
                          title="Copy claim reference"
                        >
                          {copiedCode ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Banner when polling or in manual review */}
                {status === 'polling' && (
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 text-xs flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-blue-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[11px]">Listening for Bank Settlement</p>
                      <p className="text-[10px] text-blue-700 truncate">Matching payment from {payerVpa}...</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleManualCheckStatus}
                      disabled={checkingStatus}
                      className="p-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-bold px-2"
                    >
                      Check
                    </button>
                  </div>
                )}

                {status === 'manual_review' && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      <AlertCircle size={13} className="text-amber-600" />
                      <span>In Desk Review</span>
                    </div>
                    <p className="text-[10px] text-amber-800">
                      Payment detected! Queued for rapid review by the admin desk.
                    </p>
                  </div>
                )}

                {status === 'vpa_mismatch' && (
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-950 text-xs space-y-2 animate-fade-in shadow-sm">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="font-extrabold text-amber-950 text-xs tracking-tight">UPI ID Mismatch Detected</h4>
                        <p className="text-amber-900 leading-tight text-[10px] sm:text-[11px]">
                          Payment received from <strong className="font-mono text-zinc-950">{mismatchHint || 'different UPI'}</strong>, not <strong className="font-mono text-zinc-950">{payerVpa}</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-white/95 border border-amber-300 text-[10px] sm:text-[11px] text-zinc-800 space-y-1.5">
                      <p className="font-bold text-zinc-900">Choose how to verify:</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCheckoutStep('vpa_input')
                            setIsEditingVpa(true)
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center gap-1 hover:bg-zinc-800 transition-colors"
                        >
                          <Edit2 size={10} />
                          <span>Change UPI</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUtrFallback(true)}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 hover:bg-amber-600 transition-colors shadow-sm"
                        >
                          <CheckCircle2 size={10} />
                          <span>Submit UTR</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-[11px] flex items-center gap-1.5">
                    <AlertCircle size={12} className="flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Primary Action Button — 1-Click "I Have Paid" */}
                <button
                  type="button"
                  onClick={() => handleClaimWithVpa()}
                  disabled={submittingClaim || loadingIntent}
                  className="skeuo-btn-primary w-full py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-md disabled:opacity-50 text-white transition-all active:scale-[0.99]"
                >
                  {submittingClaim ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Checking Settlement...</span>
                    </>
                  ) : (
                    <>
                      <span>I Have Paid via UPI</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

                {/* Optional Fallback UTR Input */}
                <div className="pt-0.5 text-center">
                  {!showUtrFallback ? (
                    <button
                      type="button"
                      onClick={() => setShowUtrFallback(true)}
                      className="text-[10px] sm:text-[11px] text-zinc-400 hover:text-zinc-700 underline transition-colors"
                    >
                      Trouble matching? Enter 12-digit UTR (Optional)
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-left p-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-xs space-y-1.5 mt-1"
                    >
                      <label className="block text-[10px] font-bold text-zinc-800">
                        12-Digit UTR / Bank Reference No.:
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="e.g. 502184910284"
                          value={optionalUtr}
                          onChange={e => setOptionalUtr(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-300 text-xs font-mono font-bold text-zinc-950 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleClaimWithVpa()}
                          disabled={submittingClaim || !optionalUtr.trim()}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white font-bold text-xs hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                        >
                          Verify
                        </button>
                      </div>
                      <p className="text-[9px] text-zinc-500">
                        Found under "UTR" or "UPI Ref ID" in Google Pay, PhonePe, Paytm, or BHIM receipt.
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
