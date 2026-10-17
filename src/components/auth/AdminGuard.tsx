// ============================================================
// AdminGuard — Secure Route Guard for Admin Routes
// ============================================================

import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { isAdminEmail, verifyAdminRole } from '@/lib/adminConfig'
import { AccessDeniedPage } from '@/pages/AccessDeniedPage'
import { Loader2, Shield } from 'lucide-react'

interface AdminGuardProps {
  children: React.ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading, setUser } = useAuthStore()
  const location = useLocation()
  const [isVerifying, setIsVerifying] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function checkAuthorization() {
      if (!user) {
        if (isMounted) {
          setIsAuthorized(false)
          setIsVerifying(false)
        }
        return
      }

      // Check allowlist
      const hasAllowlist = isAdminEmail(user.email)
      if (hasAllowlist) {
        // Sync role if necessary
        if (user.role !== 'admin') {
          setUser({ ...user, role: 'admin' })
        }
        if (isMounted) {
          setIsAuthorized(true)
          setIsVerifying(false)
        }
        return
      }

      // Backend verification
      const verified = await verifyAdminRole(user)
      if (isMounted) {
        if (verified && user.role !== 'admin') {
          setUser({ ...user, role: 'admin' })
        }
        setIsAuthorized(verified)
        setIsVerifying(false)
      }
    }

    checkAuthorization()

    return () => {
      isMounted = false
    }
  }, [user, user?.email])

  if (isLoading || isVerifying) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-arena-violet/10 border border-arena-violet/20 flex items-center justify-center animate-pulse">
          <Shield size={24} className="text-arena-violet-3" />
        </div>
        <div className="flex items-center gap-2 text-white/50 text-sm">
          <Loader2 size={16} className="animate-spin text-arena-blue-3" />
          <span>Verifying administrator authorization...</span>
        </div>
      </div>
    )
  }

  // If not logged in, redirect to login page with return target
  if (!user) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  // If logged in but unauthorized, show Access Denied page
  if (!isAuthorized) {
    return <AccessDeniedPage userEmail={user.email} />
  }

  return <>{children}</>
}
