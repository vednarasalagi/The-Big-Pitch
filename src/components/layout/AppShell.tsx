// ============================================================
// AppShell — Main layout with clean, ultra-professional light navbar
// ============================================================

import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Compass, Radio, Award, Wallet, Gift, Settings, Bell,
  LogOut, Shield, ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore, useEventStore, useNotificationStore, useWalletStore } from '@/store'
import { Avatar, LiveIndicator, BrandLogo } from '@/components/ui'
import { formatPoints } from '@/lib/utils'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { to: '/',           icon: Compass, label: 'Startups'   },
  { to: '/live',       icon: Radio,   label: 'Live Stage' },
  { to: '/scoreboard', icon: Award,   label: 'Rankings'   },
  { to: '/wallet',     icon: Wallet,  label: 'Allocation' },
  { to: '/rewards',    icon: Gift,    label: 'Rewards'    },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { activeRound } = useEventStore()
  const { wallet } = useWalletStore()
  const { unreadCount } = useNotificationStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const isLive = activeRound?.status === 'investment_open'
  const isAdmin = user?.role === 'admin'
  const totalPoints = wallet ? wallet.freePoints + wallet.purchasedPoints : 0

  const handleLogout = () => {
    logout()
    toast.success('Signed out successfully')
    navigate('/')
  }

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  // Pure fullscreen display for stage projectors and HDMI casting
  if (location.pathname.startsWith('/cast') || location.pathname.startsWith('/projector')) {
    return <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">{children}</div>
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAFAFA] text-zinc-900 selection:bg-zinc-900 selection:text-white">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 lg:px-8 backdrop-blur-xl bg-white/85 border-b border-zinc-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        {/* Left: Unique Brand Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link to="/" className="flex items-center">
            <BrandLogo size={24} subtitle="Pitch Arena" />
          </Link>
        </div>

        {/* Center: Desktop Navigation Bar */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-zinc-100/70 p-1 rounded-xl border border-zinc-200/60">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                  active
                    ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/50'
                )}
              >
                <Icon size={14} strokeWidth={active ? 2 : 1.75} className={active ? 'text-zinc-950' : 'text-zinc-500'} />
                <span>{label}</span>
                {to === '/live' && isLive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right: Actions, Wallet Points, Admin Link, Auth */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {isLive && (
            <div className="hidden md:flex">
              <LiveIndicator />
            </div>
          )}

          {/* Points indicator for audience */}
          {user && !isAdmin && (
            <Link
              to="/wallet"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 transition-colors shadow-sm text-xs"
            >
              <div className="w-2 h-2 rounded-full bg-zinc-900" />
              <span className="text-zinc-500 font-medium">Balance</span>
              <span className="text-zinc-900 font-bold font-mono">{formatPoints(totalPoints)} pts</span>
            </Link>
          )}

          {/* Notifications */}
          {user && (
            <button
              className="relative p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              onClick={() => toast.info('You have no new alerts.')}
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-zinc-900 rounded-full" />
              )}
            </button>
          )}

          {/* Admin link */}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-all shadow-sm"
            >
              <Shield size={13} strokeWidth={2} />
              Admin Room
            </Link>
          )}

          {/* Auth / Avatar button */}
          {user ? (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-zinc-200 transition-all"
            >
              <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
            </button>
          ) : (
            <Link
              to="/auth"
              className="btn-primary text-xs px-4 py-2 font-semibold"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* User Dropdown Menu */}
      {menuOpen && user && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-18 right-6 z-50 w-64 bg-white border border-zinc-200 shadow-xl rounded-2xl animate-slide-down overflow-hidden">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-900 font-bold text-sm truncate">{user.displayName}</p>
                  <p className="text-zinc-500 text-xs font-mono truncate">{user.email}</p>
                </div>
              </div>
            </div>
            <div className="p-2 space-y-1">
              <button
                onClick={() => { navigate('/wallet'); setMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-700 text-sm font-medium transition-colors"
              >
                <Wallet size={15} strokeWidth={1.75} />
                My Allocation & Wallet
                <ChevronRight size={13} className="ml-auto text-zinc-400" />
              </button>
              {isAdmin && (
                <button
                  onClick={() => { navigate('/admin'); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-950 text-sm font-semibold transition-colors"
                >
                  <Shield size={15} strokeWidth={1.75} />
                  Admin Control Room
                  <ChevronRight size={13} className="ml-auto text-zinc-400" />
                </button>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 text-sm font-medium transition-colors"
              >
                <LogOut size={15} strokeWidth={1.75} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 pt-16 pb-20 lg:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden backdrop-blur-xl bg-white/95 border-t border-zinc-200 safe-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-around px-2 py-1.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex flex-col items-center gap-1 py-1 px-3 rounded-xl min-w-0 flex-1 text-[11px] font-medium transition-colors',
                  active ? 'text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-700'
                )}
              >
                <div className="relative">
                  <Icon size={19} strokeWidth={active ? 2.2 : 1.75} />
                  {to === '/live' && isLive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  )}
                </div>
                <span className="truncate">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
