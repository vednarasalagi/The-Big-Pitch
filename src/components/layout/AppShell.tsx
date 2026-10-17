// ============================================================
// AppShell — Main layout with top navbar + mobile bottom nav
// ============================================================

import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Zap, Trophy, Wallet, Gift, Settings, Bell,
  LogOut, Menu, X, ChevronRight, Shield,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore, useEventStore, useNotificationStore, useWalletStore } from '@/store'
import { Avatar, LiveIndicator, Badge } from '@/components/ui'
import { formatPoints } from '@/lib/utils'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { to: '/',           icon: Home,   label: 'Home'        },
  { to: '/live',       icon: Zap,    label: 'Live Pitch'  },
  { to: '/scoreboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/wallet',     icon: Wallet, label: 'Wallet'      },
  { to: '/rewards',    icon: Gift,   label: 'Rewards'     },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { event, activeRound } = useEventStore()
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
    return <div className="min-h-screen bg-[#070913] text-white">{children}</div>
  }

  return (
    <div className="min-h-dvh flex flex-col bg-arena-gradient">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 lg:px-6 backdrop-blur-xl bg-arena-navy/85 border-b border-arena-border">
        {/* Left: Brand Logo & Event Pill */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-arena-blue to-arena-violet flex items-center justify-center shadow-glow-blue">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-extrabold text-white text-sm tracking-tight hidden sm:block">Pitch Arena</span>
          </Link>
        </div>

        {/* Center: Desktop Navigation Bar */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                  active
                    ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.08]'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                )}
              >
                <Icon size={14} className={active ? 'text-arena-blue-3' : 'text-white/40'} />
                <span>{label}</span>
                {to === '/live' && isLive && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right: Actions, Wallet Points, Admin Link, Auth */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {isLive && (
            <div className="hidden md:flex">
              <LiveIndicator />
            </div>
          )}

          {/* Points indicator for audience */}
          {user && !isAdmin && (
            <Link
              to="/wallet"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
            >
              <Wallet size={12} className="text-arena-blue-3" />
              <span className="text-white font-bold text-xs">{formatPoints(totalPoints)}</span>
            </Link>
          )}

          {/* Notifications */}
          {user && (
            <button
              className="relative p-2 rounded-xl hover:bg-white/[0.06] text-white/60 hover:text-white transition-colors"
              onClick={() => toast.info('You have no new alerts.')}
              aria-label="Notifications"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Admin link */}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-arena-violet/15 border border-arena-violet/30 text-arena-violet-3 text-xs font-semibold hover:bg-arena-violet/25 transition-colors shadow-sm"
            >
              <Shield size={13} />
              Admin Control
            </Link>
          )}

          {/* Auth / Avatar button */}
          {user ? (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-white/[0.06] transition-colors"
            >
              <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
            </button>
          ) : (
            <Link
              to="/auth"
              className="btn-primary text-xs px-4 py-1.5 font-semibold bg-gradient-to-r from-arena-blue to-arena-violet"
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
          <div className="fixed top-16 right-4 z-50 w-64 glass-card border border-white/[0.12] shadow-card animate-slide-down">
            <div className="p-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{user.displayName}</p>
                  <p className="text-white/40 text-xs">{user.role === 'admin' ? '⚡ Event Admin' : '🎯 Investor'}</p>
                </div>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={() => { navigate('/profile'); setMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-white/70 hover:text-white text-sm transition-colors"
              >
                <Settings size={14} />
                Settings
                <ChevronRight size={12} className="ml-auto" />
              </button>
              {isAdmin && (
                <button
                  onClick={() => { navigate('/admin'); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-arena-violet-3 text-sm transition-colors"
                >
                  <Shield size={14} />
                  Admin Dashboard
                  <ChevronRight size={12} className="ml-auto" />
                </button>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rose-500/10 text-rose-400 text-sm transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 pt-14 pb-20 lg:pb-4">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden backdrop-blur-xl bg-arena-navy/90 border-t border-arena-border safe-bottom">
        <div className="flex items-center justify-around px-2 py-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'nav-link min-w-0 flex-1',
                isActive(to) && 'nav-link-active'
              )}
            >
              <div className="relative">
                <Icon size={20} />
                {to === '/live' && isLive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                )}
              </div>
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
