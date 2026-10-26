// ============================================================
// Auth Page — Modern, Secure Authentication Portal
// Powered by Supabase Auth with server-verified role management.
// Supports Email/Password, Email OTP Verification, and Google OAuth.
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Zap, Shield, Gift, Users, CheckCircle2, AlertCircle,
  Mail, Lock, User, Eye, EyeOff, ArrowRight, ArrowLeft,
  KeyRound, RefreshCw, ShieldCheck, Camera, Upload
} from 'lucide-react'
import { useAuthStore, useWalletStore } from '@/store'
import { Button, Card, Badge, Avatar } from '@/components/ui'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { resolveUserRole } from '@/lib/adminConfig'
import { toUserFriendlyError, uploadUserAvatar } from '@/lib/supabaseApi'
import { processAvatarImage } from '@/lib/imageUtils'
import { toast } from 'sonner'

const BENEFITS = [
  { icon: Gift,         text: '500 free allocation points on sign up', color: 'text-zinc-900' },
  { icon: Zap,          text: 'Invest live in student pitch rounds', color: 'text-zinc-900' },
  { icon: Users,        text: 'Compete for #1 Audience Champion', color: 'text-zinc-900' },
  { icon: CheckCircle2, text: 'Realtime millisecond-precision ranking', color: 'text-zinc-900' },
]

export function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectParam = searchParams.get('redirect')

  const { user, setUser, setLoading } = useAuthStore()

  // Form state
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify-otp'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const signupFileInputRef = useRef<HTMLInputElement>(null)
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // Handle device photo selection during sign-up
  const handleSignupFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const processed = await processAvatarImage(file, 512)
      setAvatarFile(processed.file)
      setAvatarPreview(processed.dataUrl)
      toast.success('Profile photo ready!')
    } catch (err: any) {
      toast.error(err?.message || 'Could not process photo.')
    }
  }

  // Start cooldown timer
  const startCooldown = (seconds = 45) => {
    setCooldown(seconds)
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

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate(redirectParam && redirectParam !== '/admin' ? redirectParam : '/', { replace: true })
      }
    }
  }, [user, navigate, redirectParam])

  // Helper to handle post-login redirection based on verified role
  const handleSuccessfulAuth = (authEmail: string, displayName: string, userId: string, customAvatarUrl?: string) => {
    const verifiedRole = resolveUserRole(authEmail)
    const isEntryVerified = verifiedRole === 'admin'

    const profile = {
      id:          userId,
      email:       authEmail,
      displayName: displayName || (authEmail.split('@')[0] ?? 'User'),
      avatarUrl:   customAvatarUrl,
      role:        verifiedRole,
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
      isVerified:  true,
      isEntryVerified,
    }

    setUser(profile)

    // Role-based automatic redirect
    if (verifiedRole === 'admin') {
      toast.success('Welcome, Administrator! Opening Admin Control Room...')
      navigate('/admin', { replace: true })
    } else if (verifiedRole === 'member') {
      toast.success('Welcome, Staff Member! Opening Entry Scanner Desk...')
      navigate('/verify', { replace: true })
    } else {
      toast.success(`Welcome to The Big Pitch, ${profile.displayName}!`)
      const target = redirectParam && redirectParam !== '/admin' && redirectParam !== '/verify' ? redirectParam : '/'
      navigate(target, { replace: true })
    }
  }

  // Handle Email & Password Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Sign-in service is temporarily unavailable. Please try again later.')
      toast.error('Unable to connect. Please try again shortly.')
      return
    }

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)

    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

        if (error) {
          const errMsg = error.message.toLowerCase()

          // If unconfirmed email, transition directly to OTP verification view!
          if (errMsg.includes('email not confirmed')) {
            setMode('verify-otp')
            setErrorMessage('Your email address has not been verified yet. We have sent a 6-digit confirmation code to your email.')
            // Auto resend verification code
            await supabase.auth.resend({ type: 'signup', email: cleanEmail }).catch(() => {})
            startCooldown(45)
            setSubmitting(false)
            return
          }

          setErrorMessage(toUserFriendlyError(error, 'Incorrect email or password. Please verify and try again.'))
          setSubmitting(false)
          return
        }

        if (data.user) {
          handleSuccessfulAuth(
            data.user.email ?? cleanEmail,
            data.user.user_metadata?.full_name ?? '',
            data.user.id,
            data.user.user_metadata?.avatar_url
          )
        }
      } else {
        // Upload avatar if selected
        let uploadedAvatarUrl: string | undefined = undefined
        if (avatarFile) {
          try {
            const uploadRes = await uploadUserAvatar(avatarFile)
            if (uploadRes.success && uploadRes.publicUrl) {
              uploadedAvatarUrl = uploadRes.publicUrl
            }
          } catch (uploadErr) {
            console.warn('Avatar pre-upload skipped:', uploadErr)
          }
        }

        // Sign Up with OTP Email Verification
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim() || cleanEmail.split('@')[0],
              ...(uploadedAvatarUrl ? { avatar_url: uploadedAvatarUrl } : {}),
            },
          },
        })

        if (error) {
          setErrorMessage(toUserFriendlyError(error, 'Unable to create account. Please check your information.'))
          setSubmitting(false)
          return
        }

        // 1. Direct login if email confirmation is turned off in Supabase project
        if (data.session && data.user) {
          toast.success('Welcome! Your account has been created.')
          handleSuccessfulAuth(
            data.user.email ?? cleanEmail,
            fullName.trim() || cleanEmail.split('@')[0],
            data.user.id,
            uploadedAvatarUrl || data.user.user_metadata?.avatar_url
          )
          return
        }

        // 2. Email confirmation is required: prompt for 6-digit verification code
        if (data.user) {
          // If the user was already created previously in auth.users (identities is empty),
          // Supabase does not re-dispatch confirmation emails on signUp().
          // We explicitly trigger resend() so the 6-digit OTP code is actually sent!
          if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            const resendCheck = await supabase.auth.resend({
              type: 'signup',
              email: cleanEmail,
            })
            if (resendCheck.error) {
              const resendMsg = resendCheck.error.message.toLowerCase()
              if (resendMsg.includes('error sending')) {
                setErrorMessage('Supabase SMTP error: Could not dispatch email. In Supabase SMTP settings, ensure Port is 587 (not 465) and Password is a 16-character Google App Password.')
                setSubmitting(false)
                return
              }
            }
          }

          toast.success(`6-digit verification code sent to ${cleanEmail}!`)
          setMode('verify-otp')
          startCooldown(45)
          setSubmitting(false)
          return
        }
      }
    } catch (err: any) {
      setErrorMessage(toUserFriendlyError(err, 'An unexpected error occurred. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Handle 6-Digit Email Verification OTP Confirmation
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const cleanEmail = email.trim().toLowerCase()
    const cleanOtp = otp.trim()

    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code sent to your email.')
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Authentication service is temporarily unavailable.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Verify signup OTP
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: 'signup',
      })

      // 2. Fallback to 'email' OTP type if project is configured with email token
      if (error) {
        const fallback = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanOtp,
          type: 'email',
        })
        if (!fallback.error) {
          error = null
          data = fallback.data
        }
      }

      if (error) {
        setErrorMessage(toUserFriendlyError(error, 'Incorrect or expired verification code. Please check your email and try again.'))
        setSubmitting(false)
        return
      }

      if (data.user) {
        toast.success('Email confirmed successfully! Welcome to The Big Pitch.')
        handleSuccessfulAuth(
          data.user.email ?? cleanEmail,
          data.user.user_metadata?.full_name ?? (fullName.trim() || cleanEmail.split('@')[0]),
          data.user.id
        )
      } else {
        // If session was not returned automatically, sign in with the password
        if (password) {
          const loginRes = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          })
          if (loginRes.data?.user) {
            handleSuccessfulAuth(
              loginRes.data.user.email ?? cleanEmail,
              loginRes.data.user.user_metadata?.full_name ?? (fullName.trim() || cleanEmail.split('@')[0]),
              loginRes.data.user.id
            )
            return
          }
        }

        toast.success('Email verified! You can now sign in.')
        setMode('signin')
      }
    } catch (err: any) {
      setErrorMessage(toUserFriendlyError(err, 'Verification failed. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Resend Verification Code
  const handleResendSignupCode = async () => {
    if (cooldown > 0 || resending) return
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Authentication service is temporarily unavailable.')
      return
    }
    setErrorMessage(null)
    setResending(true)

    const cleanEmail = email.trim().toLowerCase()
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('error sending')) {
          setErrorMessage('Supabase SMTP Error: Could not dispatch email. Please change Port to 587 (instead of 465) in Supabase SMTP settings, and ensure you are using a 16-character Google App Password.')
        } else {
          setErrorMessage(toUserFriendlyError(error, 'Could not resend code. Please wait a moment before trying again.'))
        }
      } else {
        toast.success(`A fresh 6-digit verification code has been sent to ${cleanEmail}`)
        startCooldown(45)
      }
    } catch (err: any) {
      setErrorMessage(toUserFriendlyError(err, 'Could not resend code.'))
    } finally {
      setResending(false)
    }
  }

  // Handle Google OAuth Sign In via Supabase
  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured || !supabase) {
      toast.error('Google Sign-In is temporarily unavailable. Please use email & password.')
      setErrorMessage('Google Sign-In is temporarily unavailable. Please sign in with email and password.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      toast.error(toUserFriendlyError(error, 'Google Sign-In failed. Please try again.'))
      setErrorMessage(toUserFriendlyError(error, 'Unable to sign in with Google right now.'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] flex items-center justify-center px-4 py-12 bg-[#FAFAFA]">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <BrandLogo size={36} showText={false} />
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">The Big Pitch</h1>
          <p className="text-zinc-500 text-xs">Venture Stage & Audience Capital Arena</p>
        </div>

        {/* Main Authentication Card */}
        <div className="skeuo-surface p-7 sm:p-8 space-y-5 rounded-2xl relative">
          {/* Mode Switcher Tabs with fluid sliding rocker (Only shown when not verifying OTP) */}
          {mode !== 'verify-otp' && (
            <div className="skeuo-pill-track p-1 flex relative rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => { setMode('signin'); setErrorMessage(null) }}
                className={`relative flex-1 py-2 text-xs font-semibold rounded-xl transition-colors duration-150 select-none z-10 ${
                  mode === 'signin'
                    ? 'text-white font-bold'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {mode === 'signin' && (
                  <motion.div
                    layoutId="auth-mode-active-pill"
                    className="absolute inset-0 skeuo-pill-active rounded-xl -z-10"
                    transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.75 }}
                  />
                )}
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setErrorMessage(null) }}
                className={`relative flex-1 py-2 text-xs font-semibold rounded-xl transition-colors duration-150 select-none z-10 ${
                  mode === 'signup'
                    ? 'text-white font-bold'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {mode === 'signup' && (
                  <motion.div
                    layoutId="auth-mode-active-pill"
                    className="absolute inset-0 skeuo-pill-active rounded-xl -z-10"
                    transition={{ type: 'spring', stiffness: 450, damping: 32, mass: 0.75 }}
                  />
                )}
                Create Account
              </button>
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-shake">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-rose-600" />
              <p className="flex-1 leading-relaxed font-medium">{errorMessage}</p>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* VIEW A: EMAIL & PASSWORD CREDENTIALS FORM                */}
          {/* ──────────────────────────────────────────────────────── */}
          {mode !== 'verify-otp' ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-3 animate-fade-in">
                    {/* Optional Profile Photo Uploader */}
                    <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl skeuo-sunken border border-zinc-200/90 bg-zinc-50/60">
                      <button
                        type="button"
                        className="relative group cursor-pointer flex-shrink-0"
                        onClick={() => signupFileInputRef.current?.click()}
                        title="Click to choose a photo"
                      >
                        <Avatar
                          name={fullName || 'User'}
                          src={avatarPreview || undefined}
                          size="lg"
                          className="w-12 h-12 text-sm border-2 border-white shadow-sm"
                        />
                        <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-zinc-950 text-white text-[9px] border border-white shadow">
                          <Camera size={10} />
                        </span>
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-900">Profile Photo</span>
                          <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Optional</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {avatarFile ? avatarFile.name : 'Shows on stage projector & leaderboard'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => signupFileInputRef.current?.click()}
                        className="skeuo-btn-secondary px-2.5 py-1 rounded-xl text-[11px] font-bold text-zinc-800 flex-shrink-0"
                      >
                        {avatarPreview ? 'Change' : 'Upload'}
                      </button>

                      <input
                        ref={signupFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={handleSignupFileChange}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                        <User size={13} className="text-zinc-500" />
                        Full Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Alex Morgan"
                          className="arena-input pl-3 w-full text-sm rounded-xl border-zinc-200 shadow-inner bg-zinc-50/50 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                    <Mail size={13} className="text-zinc-500" />
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="arena-input pl-3 w-full text-sm rounded-xl border-zinc-200 shadow-inner bg-zinc-50/50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                      <Lock size={13} className="text-zinc-500" />
                      Password
                    </label>
                    {mode === 'signin' && (
                      <Link
                        to={`/reset-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                        className="text-[11px] text-zinc-500 hover:text-zinc-950 font-semibold hover:underline"
                      >
                        Forgot Password?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="arena-input pl-3 pr-10 w-full text-sm font-mono rounded-xl border-zinc-200 shadow-inner bg-zinc-50/50 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="skeuo-btn-primary rounded-xl w-full justify-center text-sm py-3 font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <RefreshCw size={14} className="animate-spin" />}
                  <span>{mode === 'signin' ? 'Sign In' : 'Create Account & Send Code'}</span>
                  {!submitting && <ArrowRight size={15} />}
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-zinc-200 w-full" />
                <span className="bg-white px-3 text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                  or
                </span>
              </div>

              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="skeuo-btn-secondary rounded-xl w-full justify-center gap-3 text-zinc-800 text-xs font-semibold py-3 flex items-center"
              >
                <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </>
          ) : (
            /* ──────────────────────────────────────────────────────── */
            /* VIEW B: EMAIL VERIFICATION OTP CONFIRMATION VIEW         */
            /* ──────────────────────────────────────────────────────── */
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-1">
                <div className="skeuo-token rounded-2xl w-14 h-14 mx-auto mb-2 text-zinc-900 flex items-center justify-center">
                  <Mail size={22} />
                </div>
                <h2 className="text-lg font-black text-zinc-950">Verify Your Email Address</h2>
                <p className="text-zinc-500 text-xs">
                  We sent a 6-digit verification code to <strong className="text-zinc-900">{email}</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-zinc-700">Enter 6-Digit Code</label>
                    <button
                      type="button"
                      onClick={handleResendSignupCode}
                      disabled={cooldown > 0 || resending}
                      className="text-zinc-900 font-semibold hover:underline disabled:text-zinc-400 disabled:no-underline flex items-center gap-1 text-[11px]"
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
                    className="skeuo-sunken text-center text-2xl font-mono font-black tracking-widest w-full py-3.5 text-zinc-950 rounded-2xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="skeuo-btn-primary rounded-xl w-full justify-center font-bold py-3 text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <RefreshCw size={14} className="animate-spin" />}
                  <CheckCircle2 size={15} />
                  <span>Verify Code & Continue</span>
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setErrorMessage(null) }}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-950 font-medium"
                  >
                    <ArrowLeft size={13} />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Compliance & Security Note */}
          <div className="pt-2 border-t border-zinc-100 text-center space-y-1.5">
            <p className="text-[11px] text-zinc-500">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-zinc-950 font-bold hover:underline">Terms & Conditions</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-zinc-950 font-bold hover:underline">Privacy Policy</Link>.
            </p>
            <div className="flex items-center gap-1.5 justify-center text-zinc-400 text-xs">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span>Secure Supabase Authentication & OTP</span>
            </div>
          </div>
        </div>

        {/* Benefits List */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <div key={text} className="skeuo-surface p-3 rounded-2xl flex items-center gap-2.5">
              <div className="skeuo-token rounded-xl w-7 h-7 flex-shrink-0 flex items-center justify-center text-zinc-800">
                <Icon size={13} />
              </div>
              <p className="text-zinc-700 text-xs font-semibold leading-tight">{text}</p>
            </div>
          ))}
        </div>

        <p className="text-zinc-400 text-xs text-center px-4 leading-relaxed">
          The Big Pitch — Live Pitch Competition Platform.
        </p>
      </div>
    </div>
  )
}

