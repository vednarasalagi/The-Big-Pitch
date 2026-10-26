// ============================================================
// StaffGuard.tsx — Route Guard for Volunteer Scanner & Verification Desk
// Allows access only to 'admin' and 'member' roles
// ============================================================

import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { isStaffEmail, verifyStaffRole } from '@/lib/adminConfig'
import { getUserProfile } from '@/lib/supabaseApi'

interface StaffGuardProps {
  children: React.ReactNode
}

export function StaffGuard({ children }: StaffGuardProps) {
  const { user, isLoading, setUser } = useAuthStore()
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function checkStaff() {
      if (!user) {
        if (isMounted) {
          setAuthorized(false)
          setChecking(false)
        }
        return
      }

      // Check current user role
      if (user.role === 'admin' || user.role === 'member') {
        if (isMounted) {
          setAuthorized(true)
          setChecking(false)
        }
        return
      }

      // Deep verification against server RPC & allowlist
      try {
        const { isStaff, role } = await verifyStaffRole(user)
        if (isMounted) {
          if (isStaff) {
            setUser({ ...user, role })
            setAuthorized(true)
          } else {
            setAuthorized(false)
          }
          setChecking(false)
        }
      } catch {
        if (isMounted) {
          setAuthorized(isStaffEmail(user.email))
          setChecking(false)
        }
      }
    }

    checkStaff()

    return () => {
      isMounted = false
    }
  }, [user?.id, user?.email, user?.role, setUser])

  if (isLoading || checking) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
        <span className="text-xs text-zinc-400 font-medium">Checking volunteer authorization...</span>
      </div>
    )
  }

  if (!authorized) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
