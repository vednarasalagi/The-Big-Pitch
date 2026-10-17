// ============================================================
// Auth Page — Modern, Secure Authentication Portal
// Powered by Supabase Auth with server-verified role management.
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Zap, Shield, Gift, Users, CheckCircle2, AlertCircle,
  Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertTriangle
} from 'lucide-react'
import { useAuthStore, useWalletStore } from '@/store'
import { Button, Card, Badge } from '@/components/ui'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { resolveUserRole } from '@/lib/adminConfig'
import { toUserFriendlyError } from '@/lib/supabaseApi'
import { toast } from 'sonner'

const BENEFITS = [
  { icon: Gift,         text: '500 free points on joining',  color: 'text-emerald-400' },
  { icon: Zap,          text: 'Invest in live student pitches', color: 'text-arena-blue-3' },
  { icon: Users,        text: 'Compete on real-time leaderboard', color: 'text-arena-violet-3' },
  { icon: CheckCircle2, text: 'Claim badges & sponsor rewards', color: 'text-amber-400' },
]

export function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectParam = searchParams.get('redirect')

  const { user, setUser, setLoading } = useAuthStore()
  const { setWallet } = useWalletStore()

  // Form state
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
  const handleSuccessfulAuth = (authEmail: string, displayName: string, userId: string) => {
    const verifiedRole = resolveUserRole(authEmail)

    const profile = {
      id:          userId,
      email:       authEmail,
      displayName: displayName || (authEmail.split('@')[0] ?? 'User'),
      avatarUrl:   undefined,
      role:        verifiedRole,
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
      isVerified:  true,
    }

    setUser(profile)

    // Role-based automatic redirect
    if (verifiedRole === 'admin') {
      toast.success('Welcome, Administrator! Opening Admin Control Room...')
      navigate('/admin', { replace: true })
    } else {
      toast.success(`Welcome back, ${profile.displayName}!`)
      const target = redirectParam && redirectParam !== '/admin' ? redirectParam : '/'
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

    // --- Real Supabase Authentication ---
    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

        if (error) {
          setErrorMessage(toUserFriendlyError(error, 'Incorrect email or password. Please verify and try again.'))
          setSubmitting(false)
          return
        }

        if (data.user) {
          handleSuccessfulAuth(
            data.user.email ?? cleanEmail,
            data.user.user_metadata?.full_name ?? '',
            data.user.id
          )
        }
      } else {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: fullName.trim() || cleanEmail.split('@')[0] },
          },
        })

        if (error) {
          setErrorMessage(toUserFriendlyError(error, 'Unable to create account. Please check your information.'))
          setSubmitting(false)
          return
        }

        if (data.user) {
          toast.success('Welcome! Your account has been created.')
          handleSuccessfulAuth(
            data.user.email ?? cleanEmail,
            fullName.trim() || cleanEmail.split('@')[0],
            data.user.id
          )
        }
      }
    } catch (err: any) {
      setErrorMessage(toUserFriendlyError(err, 'An unexpected error occurred. Please try again.'))
    } finally {
      setSubmitting(false)
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
        <div className="bg-white p-7 sm:p-8 space-y-5 border border-zinc-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-2xl relative">
          {/* Mode Switcher Tabs */}
          <div className="flex p-1 rounded-xl bg-zinc-100 border border-zinc-200/60">
            <button
              type="button"
              onClick={() => { setMode('signin'); setErrorMessage(null) }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signin'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80 font-bold'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setErrorMessage(null) }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80 font-bold'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-shake">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-rose-600" />
              <p className="flex-1 leading-relaxed font-medium">{errorMessage}</p>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5 animate-fade-in">
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
                    className="arena-input pl-3 w-full text-sm"
                  />
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
                  className="arena-input pl-3 w-full text-sm"
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
                  <span className="text-[11px] text-zinc-400 hover:text-zinc-700 cursor-pointer">
                    Forgot?
                  </span>
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
                  className="arena-input pl-3 pr-10 w-full text-sm font-mono"
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
            <Button
              type="submit"
              className="w-full justify-center text-sm py-2.5 font-semibold bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm"
              loading={submitting}
              icon={<ArrowRight size={15} />}
            >
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-zinc-200 w-full" />
            <span className="bg-white px-3 text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
              or
            </span>
          </div>

          {/* Google OAuth Button */}
          <Button
            type="button"
            variant="secondary"
            onClick={handleGoogleSignIn}
            className="w-full justify-center gap-3 border-zinc-200 hover:bg-zinc-50 text-zinc-800 text-xs font-semibold py-2.5 shadow-sm"
            icon={
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            }
          >
            Continue with Google
          </Button>

          {/* Security Note */}
          <div className="flex items-center gap-1.5 justify-center pt-1 text-zinc-400 text-xs">
            <Shield size={12} />
            <span>Secure Supabase Authentication</span>
          </div>
        </div>

        {/* Benefits List */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-zinc-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <Icon size={14} className="flex-shrink-0 text-zinc-900" />
              <p className="text-zinc-600 text-xs font-medium">{text}</p>
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
