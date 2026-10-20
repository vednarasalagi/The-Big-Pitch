// ============================================================
// AdminGuard — Secure Route Guard for Admin Routes
// SECURITY: Authorization is ALWAYS verified server-side via
// the check_is_admin RPC. The localStorage cache is NEVER used
// for access control decisions — only the DB is the source of truth.
// ============================================================

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store'
import { verifyAdminRole } from '@/lib/adminConfig'
import { NotFoundPage } from '@/pages/NotFoundPage'

interface AdminGuardProps {
  children: React.ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading, setUser } = useAuthStore()
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

      // SECURITY: Always verify against the server-side database.
      // Never grant access based on localStorage cache alone.
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
  }, [user?.id, user?.email])

  if (isLoading || isVerifying) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
        <span className="text-xs text-zinc-400 font-medium">Verifying access...</span>
      </div>
    )
  }

  // If user does not have admin access (not logged in or not authorized), show 404 Page Not Found
  if (!user || !isAuthorized) {
    return <NotFoundPage />
  }

  return <>{children}</>
}
