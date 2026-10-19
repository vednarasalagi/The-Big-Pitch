// ============================================================
// Access Denied Page — 403 Forbidden for unauthorized admin access
// Clean minimalist white & black aesthetic.
// ============================================================

import { Link, useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, LogOut, Home, Lock } from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'
import { useAuthStore } from '@/store'
import { toast } from 'sonner'

interface AccessDeniedPageProps {
  userEmail?: string | null
}

export function AccessDeniedPage({ userEmail }: AccessDeniedPageProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const currentEmail = userEmail || user?.email || 'Unknown Account'

  const handleSignOutAndSwitch = async () => {
    await logout()
    toast.info('Signed out. Please sign in with an authorized administrator account.')
    navigate('/auth?redirect=/admin')
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 animate-fade-in text-center">
        {/* Shield Icon Graphic */}
        <div className="relative mx-auto w-16 h-16 skeuo-token rounded-2xl flex items-center justify-center text-zinc-950">
          <ShieldAlert size={32} />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full skeuo-token-dark flex items-center justify-center">
            <Lock size={12} />
          </div>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <span className="skeuo-token px-3 py-1 rounded-xl text-xs font-mono font-bold text-zinc-800 inline-block">
            HTTP 403 · Access Denied
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight skeuo-text-emboss">
            Admin Access Required
          </h1>
          <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
            The Admin Control Room is restricted to authorized event administrators. Your current account is not listed on the administrator allowlist.
          </p>
        </div>

        {/* Account Details Card */}
        <div className="p-5 rounded-2xl skeuo-surface text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Signed in as:</span>
            <span className="text-zinc-900 font-semibold font-mono">Unauthorized for /admin</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl skeuo-sunken">
            <div className="w-2 h-2 rounded-full bg-zinc-400" />
            <span className="text-zinc-900 font-mono text-xs truncate flex-1 font-medium">{currentEmail}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-zinc-700 border border-zinc-200 shadow-2xs">Audience Role</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => navigate('/')}
            className="w-full sm:w-auto justify-center"
            icon={<Home size={15} />}
          >
            Back to Arena Home
          </Button>

          <Button
            variant="primary"
            onClick={handleSignOutAndSwitch}
            className="w-full sm:w-auto justify-center"
            icon={<LogOut size={15} />}
          >
            Switch to Admin Account
          </Button>
        </div>

        <p className="text-zinc-400 text-xs">
          Need administrator permissions? Contact the event organizers to have your email authorized.
        </p>
      </div>
    </div>
  )
}
