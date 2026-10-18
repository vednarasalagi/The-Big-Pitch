// ============================================================
// ResetPasswordPage.tsx — Secure Password Recovery with Email OTP
// Clean, modern white & black interface with Supabase Auth OTP verification.
// ============================================================

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Mail, Lock, KeyRound, ArrowRight, ArrowLeft,
  CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, RefreshCw
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { toUserFriendlyError } from '@/lib/supabaseApi'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { Button } from '@/components/ui'
import { toast } from 'sonner'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // Start cooldown timer
  const startCooldown = () => {
    setCooldown(45)
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Step 1: Send Password Reset OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Authentication service is temporarily unavailable.')
      return
    }

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setErrorMessage(toUserFriendlyError(error, 'Unable to send reset code. Please check your email and try again.'))
        setLoading(false)
        return
      }

      toast.success(`Verification code sent to ${cleanEmail}`)
      setStep('verify')
      startCooldown()
    } catch (err: any) {
      setErrorMessage(toUserFriendlyError(err, 'An error occurred while sending the code.'))
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Authentication service is temporarily unavailable.')
      return
    }
    setErrorMessage(null)
    setResending(true)

    try {
      const cleanEmail = email.trim().toLowerCase()
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setErrorMessage(toUserFriendlyError(error, 'Could not resend code. Please wait before trying again.'))
      } else {
        toast.success(`A fresh verification code was sent to ${cleanEmail}`)
        startCooldown()
      }
    } catch (err: any) {
      setErrorMessage(toUserFriendlyError(err, 'Could not resend code.'))
    } finally {
      setResending(false)
    }
  }

  // Step 2: Verify Recovery OTP & Update Password
  const handleVerifyAndUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const cleanEmail = email.trim().toLowerCase()
    const cleanOtp = otp.trim()

    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code from your email.')
      return
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.')
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Authentication service is temporarily unavailable.')
      return
    }

    setLoading(true)
    try {
      // 1. Verify the recovery OTP token
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: 'recovery',
      })

      if (verifyError) {
        setErrorMessage(toUserFriendlyError(verifyError, 'Incorrect or expired verification code. Please request a new code.'))
        setLoading(false)
        return
      }

      // 2. Set the new password for the authenticated recovery session
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setErrorMessage(toUserFriendlyError(updateError, 'Could not update password. Please try again.'))
        setLoading(false)
        return
      }

      toast.success('Your password has been reset successfully! Please sign in.')
      navigate('/auth', { replace: true })
    } catch (err: any) {
      setErrorMessage(toUserFriendlyError(err, 'Failed to reset password. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] flex items-center justify-center px-4 py-12 bg-[#FAFAFA] text-zinc-900">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <BrandLogo size={36} showText={false} />
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">The Big Pitch</h1>
          <p className="text-zinc-500 text-xs">Venture Stage & Audience Capital Arena</p>
        </div>

        {/* Main Card */}
        <div className="bg-white p-7 sm:p-8 space-y-5 border border-zinc-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-2xl relative">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 text-[11px] font-bold mb-2">
              <KeyRound size={12} className="text-zinc-900" />
              <span>Password Recovery</span>
            </div>
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">
              {step === 'request' ? 'Reset Your Password' : 'Enter Verification Code'}
            </h2>
            <p className="text-zinc-500 text-xs mt-1">
              {step === 'request'
                ? "Enter your registered email address and we'll send you a 6-digit recovery OTP code."
                : `We sent a 6-digit verification code to ${email}. Enter it below to set your new password.`}
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-shake">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-rose-600" />
              <p className="flex-1 leading-relaxed font-medium">{errorMessage}</p>
            </div>
          )}

          {/* STEP 1: Request Email */}
          {step === 'request' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                  <Mail size={13} className="text-zinc-500" />
                  Account Email Address
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="arena-input pl-3 w-full text-sm"
                />
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full justify-center bg-zinc-950 text-white font-bold py-2.5 text-sm shadow-sm"
                icon={<ArrowRight size={15} />}
              >
                Send Reset Code
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-950 font-medium transition-colors"
                >
                  <ArrowLeft size={13} />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Verify OTP & Set New Password */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyAndUpdate} className="space-y-4">
              {/* 6-digit OTP code */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={cooldown > 0 || resending}
                    className="text-[11px] font-semibold text-zinc-900 hover:underline disabled:text-zinc-400 disabled:no-underline flex items-center gap-1"
                  >
                    <RefreshCw size={10} className={resending ? 'animate-spin' : ''} />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="arena-input text-center text-xl font-mono font-black tracking-widest w-full py-2.5"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                  <Lock size={13} className="text-zinc-500" />
                  New Password (min 6 chars)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="arena-input pl-3 pr-10 w-full text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                  <Lock size={13} className="text-zinc-500" />
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="arena-input pl-3 w-full text-sm font-mono"
                />
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full justify-center bg-zinc-950 text-white font-bold py-2.5 text-sm shadow-sm"
                icon={<CheckCircle2 size={15} />}
              >
                Set New Password & Sign In
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('request'); setErrorMessage(null) }}
                  className="text-zinc-500 hover:text-zinc-900 font-medium"
                >
                  Change Email
                </button>
                <Link
                  to="/auth"
                  className="text-zinc-500 hover:text-zinc-950 font-medium"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* Security Note */}
          <div className="flex items-center gap-1.5 justify-center pt-1 text-zinc-400 text-xs border-t border-zinc-100">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Encrypted Supabase OTP Verification</span>
          </div>
        </div>
      </div>
    </div>
  )
}
