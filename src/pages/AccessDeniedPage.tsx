// ============================================================
// Access Denied Page — 403 Forbidden for unauthorized admin access
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

  const handleSignOutAndSwitch = () => {
    logout()
    toast.info('Signed out. Please sign in with an authorized administrator account.')
    navigate('/auth?redirect=/admin')
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 animate-fade-in text-center">
        {/* Shield Icon Graphic */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/10">
          <ShieldAlert size={40} className="text-rose-400 animate-pulse" />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-arena-navy-2 border border-rose-500/40 flex items-center justify-center">
            <Lock size={14} className="text-rose-400" />
          </div>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <Badge variant="rose" dot className="px-3 py-1 text-xs">
            HTTP 403 · Access Denied
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Admin Access Required
          </h1>
          <p className="text-white/60 text-sm max-w-sm mx-auto leading-relaxed">
            The Admin Control Room is restricted to authorized event administrators. Your current account is not listed on the administrator allowlist.
          </p>
        </div>

        {/* Account Details Card */}
        <Card className="p-4 border-white/[0.08] bg-white/[0.02] text-left">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
            <span>Signed in as:</span>
            <span className="text-rose-400 font-medium">Unauthorized for /admin</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <div className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-white font-mono text-xs truncate flex-1">{currentEmail}</span>
            <Badge variant="cyan" className="text-[10px]">Audience Role</Badge>
          </div>
        </Card>

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
            className="w-full sm:w-auto justify-center bg-gradient-to-r from-arena-blue to-arena-violet"
            icon={<LogOut size={15} />}
          >
            Switch to Admin Account
          </Button>
        </div>

        <p className="text-white/30 text-xs">
          Need administrator permissions? Contact the event organizers to have your email authorized.
        </p>
      </div>
    </div>
  )
}
