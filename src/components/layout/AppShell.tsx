// ============================================================
// AppShell — Main layout with clean, ultra-professional light navbar
// Simple, intuitive navigation designed for all device screens.
// ============================================================

import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Layers, Radio, Trophy, Wallet,
  LogOut, Shield, ChevronRight, Bell, Sparkles, ArrowRight, Camera, QrCode
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAuthStore, useEventStore, useNotificationStore, useWalletStore } from '@/store'
import { Avatar, LiveIndicator, BrandLogo } from '@/components/ui'
import { Footer } from '@/components/layout/Footer'
import { UserProfileModal } from '@/components/profile/UserProfileModal'
import { EntryPassModal } from '@/components/profile/EntryPassModal'
import { formatPoints } from '@/lib/utils'
import { toast } from 'sonner'

// Simple, self-explanatory navigation items that attendees immediately understand
const NAV_ITEMS = [
  { to: '/',           icon: Layers,  label: 'Startups',    description: 'Browse Pitch Lineup' },
  { to: '/live',       icon: Radio,   label: 'Live Pitch',  description: 'Stage & Score' },
  { to: '/scoreboard', icon: Trophy,  label: 'Leaderboard', description: 'Audience & Awards' },
  { to: '/wallet',     icon: Wallet,  label: 'My Points',   description: 'Balance & Packages' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { activeRound, teams } = useEventStore()
  const { wallet } = useWalletStore()
  const { unreadCount } = useNotificationStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [entryPassModalOpen, setEntryPassModalOpen] = useState(false)

  const isLive = activeRound?.status === 'investment_open' || activeRound?.status === 'announced' || activeRound?.status === 'pitching'
  const isInvestingNow = activeRound?.status === 'investment_open'
  const currentLiveTeam = activeRound?.team || teams.find(t => t.id === activeRound?.teamId)
  const isAdmin = user?.role === 'admin'
  const isMember = user?.role === 'member'
  const isStaff = isAdmin || isMember
  const totalPoints = wallet ? wallet.freePoints + wallet.purchasedPoints : 0

  const handleLogout = async () => {
    setMenuOpen(false)
    try {
      await logout()
      toast.success('Signed out successfully')
    } catch {
      toast.error('Sign out error. Please try again.')
    }
    navigate('/')
  }

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  // Dynamic mobile navigation dock items: Includes direct Scanner access for Staff (Member & Admin)
  const mobileNavItems = useMemo(() => {
    if (isStaff) {
      return [
        { to: '/',           icon: Layers,  label: 'Startups' },
        { to: '/live',       icon: Radio,   label: 'Live' },
        { to: '/verify',     icon: Camera,  label: 'Scanner', isScanner: true },
        { to: '/scoreboard', icon: Trophy,  label: 'Awards' },
        { to: isAdmin ? '/admin' : '/wallet', icon: isAdmin ? Shield : Wallet, label: isAdmin ? 'Admin' : 'Wallet' },
      ]
    }
    return NAV_ITEMS
  }, [isStaff, isAdmin])

  // Pure fullscreen display for stage projectors, HDMI casting, and grand celebrations
  if (
    location.pathname.startsWith('/cast') ||
    location.pathname.startsWith('/projector') ||
    location.pathname.startsWith('/celebrate') ||
    location.pathname.startsWith('/winner')
  ) {
    return <div className="min-h-screen bg-[#0A0A0C] text-zinc-100">{children}</div>
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAFAFA] text-zinc-900 selection:bg-zinc-900 selection:text-white">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-3 sm:px-6 lg:px-8 backdrop-blur-xl bg-white/90 border-b border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        {/* Left: Unique Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Link to="/" className="flex items-center">
            <BrandLogo size={22} subtitle="Audience Edition" />
          </Link>
        </div>

        {/* Center: Desktop Navigation Bar with tactile physical switch track & fluid sliding rocker */}
        <nav className="hidden md:flex items-center gap-1 skeuo-pill-track p-1 rounded-2xl flex-shrink-0 relative">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = isActive(to)
            const showLiveBadge = to === '/live' && isLive

            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 select-none z-10',
                  active
                    ? 'text-white'
                    : 'text-zinc-600 hover:text-zinc-950'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="desktop-navbar-active-pill"
                    className="absolute inset-0 skeuo-pill-active rounded-xl -z-10"
                    transition={{
                      type: 'spring',
                      stiffness: 450,
                      damping: 32,
                      mass: 0.75,
                    }}
                  />
                )}
                <Icon size={15} strokeWidth={active ? 2.2 : 1.75} className={active ? 'text-white' : 'text-zinc-600'} />
                <span>{label}</span>
                {showLiveBadge && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white animate-pulse shadow-xs">
                    Live
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right: Actions, Balance Pill, Admin Link, Auth */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Attendee Entry Pass & QR Button (shown for general audience attendees) */}
          {user && !isStaff && (
            <button
              onClick={() => setEntryPassModalOpen(true)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer',
                user.isEntryVerified
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse'
              )}
              title={user.isEntryVerified ? 'Gate Verified: Click to view Entry Pass' : 'Entry Pass Unverified: Show QR at gate'}
            >
              <QrCode size={13} className={user.isEntryVerified ? 'text-emerald-600' : 'text-amber-600'} />
              <span className="hidden sm:inline font-mono">{user.passCode || 'Entry Pass'}</span>
              <span className="sm:hidden">{user.isEntryVerified ? 'Pass' : 'Verify'}</span>
            </button>
          )}

          {/* Points indicator — VISIBLE ON BOTH MOBILE & DESKTOP for instant clarity */}
          {user && !isAdmin && (
            <Link
              to="/wallet"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl skeuo-sunken transition-all text-xs font-semibold text-zinc-950"
              title="Your Available Points — Click to manage wallet"
            >
              <span className="skeuo-led-bezel">
                <span className="skeuo-led-emerald" />
              </span>
              <span className="hidden sm:inline text-zinc-500 font-medium">Points:</span>
              <span className="font-mono font-black">{formatPoints(totalPoints)}</span>
            </Link>
          )}

          {/* Volunteer & Admin Scanner Desk shortcut */}
          {isStaff && (
            <Link
              to="/verify"
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs"
              title="Gate Scanner & Attendee Verification"
            >
              <Camera size={13} strokeWidth={2.2} />
              <span>Scanner</span>
            </Link>
          )}

          {/* Admin shortcut for administrators */}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl skeuo-btn-primary text-xs font-bold transition-all"
            >
              <Shield size={13} strokeWidth={2} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          {/* Auth / Avatar button */}
          {user ? (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-zinc-300 transition-all"
              aria-label="User profile menu"
            >
              <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
            </button>
          ) : (
            <Link
              to="/auth"
              className="px-3.5 sm:px-4 py-1.5 rounded-xl skeuo-btn-primary text-xs font-bold transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Global "Live Pitch Now Active" Callout Bar */}
      {/* Guides attendees on any screen directly to the active stage pitch! */}
      {isLive && currentLiveTeam && !location.pathname.startsWith('/live') && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white px-3 sm:px-6 py-2 border-b border-zinc-800 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
              <span className="font-black uppercase tracking-wider text-emerald-400 text-[10px] hidden sm:inline">
                {isInvestingNow ? 'Scoring Window Open' : 'Pitch In Progress'}
              </span>
              <span className="font-bold text-white truncate">
                {currentLiveTeam.name}
              </span>
              <span className="text-zinc-400 truncate hidden md:inline">
                — {currentLiveTeam.pitchTitle}
              </span>
            </div>

            <Link
              to="/live"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs transition-colors flex-shrink-0 shadow-sm"
            >
              <span>{isInvestingNow ? 'Score Points' : 'Watch Live'}</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      )}

      {/* User Dropdown Menu */}
      {menuOpen && user && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-18 right-4 sm:right-6 z-50 w-72 bg-white border border-zinc-200 shadow-2xl rounded-2xl animate-slide-down overflow-hidden text-zinc-900">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/70">
              <button
                type="button"
                onClick={() => { setProfileModalOpen(true); setMenuOpen(false) }}
                className="w-full text-left flex items-center gap-3 cursor-pointer p-1.5 -m-1.5 rounded-xl hover:bg-zinc-100 transition-colors group"
                title="Click to edit profile photo & name"
              >
                <div className="relative">
                  <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
                  <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-zinc-950 text-white text-[9px] border border-white shadow-sm group-hover:scale-110 transition-transform">
                    <Camera size={10} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-950 font-bold text-sm truncate group-hover:text-amber-600 transition-colors flex items-center gap-1.5">
                    <span>{user.displayName}</span>
                  </p>
                  <p className="text-zinc-500 text-xs font-mono truncate">{user.email}</p>
                </div>
                <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-700" />
              </button>
              <div className="mt-3 pt-2.5 border-t border-zinc-200/70 flex items-center justify-between text-xs">
                <span className="text-zinc-500">Your Point Balance:</span>
                <span className="font-mono font-black text-zinc-950">{formatPoints(totalPoints)}</span>
              </div>
            </div>

            <div className="p-2 space-y-1 text-sm font-medium">
              <button
                onClick={() => { setEntryPassModalOpen(true); setMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-800 transition-colors text-left"
              >
                <QrCode size={16} className={user.isEntryVerified ? 'text-emerald-600' : 'text-amber-600'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span>My Entry Pass & QR</span>
                    {user.isEntryVerified ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Verified
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} className="ml-auto text-zinc-400" />
              </button>

              <button
                onClick={() => { setProfileModalOpen(true); setMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-800 transition-colors"
              >
                <Camera size={16} className="text-zinc-500" />
                <span>Edit Profile & Photo</span>
                <ChevronRight size={14} className="ml-auto text-zinc-400" />
              </button>

              <button
                onClick={() => { navigate('/wallet'); setMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-800 transition-colors"
              >
                <Wallet size={16} className="text-zinc-500" />
                <span>My Points & Wallet</span>
                <ChevronRight size={14} className="ml-auto text-zinc-400" />
              </button>

              <button
                onClick={() => { navigate('/live'); setMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-800 transition-colors"
              >
                <Radio size={16} className="text-zinc-500" />
                <span>Live Pitch Stage</span>
                {isLive && <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              </button>

              <button
                onClick={() => { navigate('/scoreboard'); setMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-800 transition-colors"
              >
                <Trophy size={16} className="text-zinc-500" />
                <span>Tournament Leaderboard</span>
                <ChevronRight size={14} className="ml-auto text-zinc-400" />
              </button>

              {isStaff && (
                <button
                  onClick={() => { navigate('/verify'); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-purple-50 text-purple-700 font-bold transition-colors"
                >
                  <Camera size={16} className="text-purple-600" />
                  <span>Entry Scanner Desk</span>
                  <ChevronRight size={14} className="ml-auto text-purple-400" />
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => { navigate('/admin'); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-950 font-bold transition-colors"
                >
                  <Shield size={16} className="text-zinc-950" />
                  <span>Admin Control Room</span>
                  <ChevronRight size={14} className="ml-auto text-zinc-400" />
                </button>
              )}

              <div className="pt-1 border-t border-zinc-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content Area */}
      {/* Offset dynamically for top navbar + live banner, with safe bottom padding for mobile bar */}
      <main className={cn(
        'flex-1 pb-24 md:pb-12 transition-all',
        isLive && currentLiveTeam && !location.pathname.startsWith('/live') ? 'pt-26 sm:pt-28' : 'pt-16'
      )}>
        {children}
      </main>

      {/* Enterprise Compliance Footer */}
      <Footer />

      {/* Mobile Bottom Navigation Bar (Tactile Hardware Dock) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-gradient-to-b from-white to-[#F6F7F9] border-t border-zinc-200/90 shadow-[0_-6px_24px_rgba(0,0,0,0.06),inset_0_1px_0_#FFFFFF] pb-[max(0.35rem,env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center justify-around px-1 py-1.5">
          {mobileNavItems.map(({ to, icon: Icon, label, ...rest }) => {
            const active = isActive(to)
            const showLiveDot = to === '/live' && isLive
            const isScannerTab = (rest as any).isScanner

            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl min-w-0 flex-1 transition-all select-none',
                  active
                    ? (isScannerTab ? 'text-purple-700 font-black' : 'text-zinc-950 font-black')
                    : (isScannerTab ? 'text-purple-600 font-bold' : 'text-zinc-500 hover:text-zinc-800 font-semibold')
                )}
              >
                <div className="relative flex items-center justify-center">
                  <div className={cn(
                    'p-1.5 rounded-xl transition-colors duration-150 relative',
                    active 
                      ? (isScannerTab ? 'bg-purple-600 text-white shadow-md' : 'text-white')
                      : (isScannerTab ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'hover:bg-zinc-100 text-zinc-600')
                  )}>
                    {active && !isScannerTab && (
                      <motion.div
                        layoutId="mobile-dock-active-cap"
                        className="absolute inset-0 skeuo-btn-primary rounded-xl -z-10"
                        transition={{
                          type: 'spring',
                          stiffness: 450,
                          damping: 32,
                          mass: 0.75,
                        }}
                      />
                    )}
                    <Icon size={17} strokeWidth={active ? 2.4 : 1.8} className={active ? 'text-white' : (isScannerTab ? 'text-purple-700' : 'text-zinc-600')} />
                  </div>
                  {showLiveDot && (
                    <span className="absolute -top-1 -right-1 skeuo-led-bezel w-3.5 h-3.5 z-20">
                      <span className="skeuo-led-emerald animate-pulse" />
                    </span>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] tracking-tight truncate leading-none mt-0.5',
                  active && 'skeuo-text-emboss font-bold text-zinc-950',
                  isScannerTab && 'text-purple-700 font-bold'
                )}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Profile & Photo Upload Modal */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />

      {/* Event Entry Pass & QR Modal */}
      <EntryPassModal
        isOpen={entryPassModalOpen}
        onClose={() => setEntryPassModalOpen(false)}
      />
    </div>
  )
}
