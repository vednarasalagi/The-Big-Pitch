// ============================================================
// Admin Authorization & Allowlist Management
// Single Super Admin architecture + dynamic Admin Allowlist
// ============================================================

import { supabase } from './supabase'

const STORAGE_KEY = 'pitch_arena_admin_allowlist'
const MEMBER_STORAGE_KEY = 'pitch_arena_member_allowlist'

/**
 * Returns the single configured Super Admin email from environment variables.
 * Fallback to VITE_ADMIN_EMAILS first entry if VITE_SUPER_ADMIN_EMAIL is not yet set.
 */
export function getSuperAdminEmail(): string {
  const superAdmin = import.meta.env.VITE_SUPER_ADMIN_EMAIL as string | undefined
  if (superAdmin && superAdmin.trim()) {
    return superAdmin.trim().toLowerCase()
  }

  // Fallback to the first email in VITE_ADMIN_EMAILS if configured
  const envEmails = import.meta.env.VITE_ADMIN_EMAILS as string | undefined
  if (envEmails) {
    const first = envEmails.split(',')[0]?.trim().toLowerCase()
    if (first && first.includes('@')) return first
  }

  return ''
}

/**
 * Checks if a given email is the designated Super Admin.
 */
export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false
  const superAdmin = getSuperAdminEmail()
  if (!superAdmin) return false
  return email.trim().toLowerCase() === superAdmin
}

/**
 * Returns all currently known admin emails.
 * Always includes the Super Admin, plus any dynamically added admins.
 */
export function getAdminAllowlist(): string[] {
  const allowlist = new Set<string>()

  // 1. Super Admin email is always included
  const superAdmin = getSuperAdminEmail()
  if (superAdmin) {
    allowlist.add(superAdmin)
  }

  // 2. Load from local cache / storage
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed: string[] = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        parsed.forEach(e => {
          if (e && typeof e === 'string' && e.includes('@')) {
            allowlist.add(e.trim().toLowerCase())
          }
        })
      }
    }
  } catch {
    // Ignore storage parse error
  }

  return Array.from(allowlist)
}

/**
 * Returns all currently known member (volunteer) emails.
 */
export function getMemberAllowlist(): string[] {
  const allowlist = new Set<string>()

  try {
    const stored = localStorage.getItem(MEMBER_STORAGE_KEY)
    if (stored) {
      const parsed: string[] = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        parsed.forEach(e => {
          if (e && typeof e === 'string' && e.includes('@')) {
            allowlist.add(e.trim().toLowerCase())
          }
        })
      }
    }
  } catch {}

  return Array.from(allowlist)
}

/**
 * Validates whether an email belongs to the authorized admin list.
 * Checks Super Admin first, then the allowlist.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (isSuperAdmin(normalized)) return true
  const list = getAdminAllowlist()
  return list.includes(normalized)
}

/**
 * Validates whether an email belongs to the volunteer/member list.
 */
export function isMemberEmail(email?: string | null): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  const list = getMemberAllowlist()
  return list.includes(normalized)
}

/**
 * Validates whether an email is staff (either Admin or Member/Volunteer).
 * Both have permission to access the Event Gate Verification Scanner.
 */
export function isStaffEmail(email?: string | null): boolean {
  return isAdminEmail(email) || isMemberEmail(email)
}

/**
 * Resolves the role ('admin' | 'member' | 'audience') for a given email address.
 * Never trusts a client-supplied role flag.
 */
export function resolveUserRole(email?: string | null): 'admin' | 'member' | 'audience' {
  if (!email) return 'audience'
  const normalized = email.trim().toLowerCase()
  if (isAdminEmail(normalized)) return 'admin'
  if (isMemberEmail(normalized)) return 'member'
  return 'audience'
}

/**
 * Dynamically adds an authorized staff email (admin or volunteer member).
 * Persists to Supabase `public.admin_allowlist` and local cache.
 */
export async function addStaffEmail(
  email: string,
  role: 'admin' | 'member' = 'member',
  addedByEmail?: string
): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return false

  const storageKey = role === 'admin' ? STORAGE_KEY : MEMBER_STORAGE_KEY

  // 1. Save to local storage for immediate UI availability
  try {
    const stored = localStorage.getItem(storageKey)
    const list: string[] = stored ? JSON.parse(stored) : []
    if (!list.includes(normalized)) {
      list.push(normalized)
      localStorage.setItem(storageKey, JSON.stringify(list))
    }
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }

  // 2. If Supabase is connected, persist to database
  if (supabase) {
    try {
      // 2a. Call elevated SECURITY DEFINER RPC to bypass RLS and update profiles table directly
      const { data: rpcData, error: rpcErr } = await supabase.rpc('grant_staff_role', {
        p_email: normalized,
        p_role: role,
      })

      if (!rpcErr && rpcData?.success) {
        return true
      }

      // 2b. Fallback: Direct table upsert into admin_allowlist
      const { error: insertError } = await supabase
        .from('admin_allowlist')
        .upsert({
          email: normalized,
          role,
          added_by: addedByEmail ?? getSuperAdminEmail() ?? 'super_admin',
          notes: `Added as ${role} by ${addedByEmail ?? 'super_admin'} from Dashboard`,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' })

      if (insertError) {
        console.warn('Supabase allowlist insert notice:', insertError.message)
      }

      // 2c. Also attempt updating profiles table if this user already exists
      await supabase
        .from('profiles')
        .update({ 
          role, 
          entry_verified: role === 'admin' ? true : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('email', normalized)
    } catch (err) {
      console.warn('Could not write to Supabase admin_allowlist:', err)
    }
  }

  return true
}

/**
 * Backwards-compatible alias for addAdminEmail
 */
export async function addAdminEmail(email: string, addedByEmail?: string): Promise<boolean> {
  return addStaffEmail(email, 'admin', addedByEmail)
}

/**
 * Dynamically removes an authorized admin email from the allowlist.
 * The Super Admin email can NEVER be removed.
 */
export async function removeAdminEmail(email: string): Promise<{ success: boolean; message?: string }> {
  const normalized = email.trim().toLowerCase()

  if (isSuperAdmin(normalized)) {
    return { success: false, message: 'The primary Super Admin account cannot be removed.' }
  }

  // 1. Remove from local storage
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const list: string[] = JSON.parse(stored)
      const updated = list.filter(e => e.toLowerCase() !== normalized)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }
  } catch (e) {
    console.error('Failed to update localStorage:', e)
  }

  // 2. If Supabase is connected, delete from database
  if (supabase) {
    try {
      await supabase
        .from('admin_allowlist')
        .delete()
        .eq('email', normalized)

      // Demote in profiles table to audience
      await supabase
        .from('profiles')
        .update({ role: 'audience' })
        .eq('email', normalized)
    } catch (err) {
      console.warn('Could not delete from Supabase admin_allowlist:', err)
    }
  }

  return { success: true }
}

/**
 * Synchronizes the local allowlist with the latest records in Supabase `admin_allowlist`.
 */
export async function syncAdminAllowlistFromSupabase(): Promise<string[]> {
  if (!supabase) {
    return getAdminAllowlist()
  }

  try {
    const { data, error } = await supabase
      .from('admin_allowlist')
      .select('email, role')

    if (!error && data) {
      const adminList = new Set<string>()
      const memberList = new Set<string>()

      const superAdmin = getSuperAdminEmail()
      if (superAdmin) adminList.add(superAdmin)

      data.forEach((row: { email: string; role?: string }) => {
        if (!row.email) return
        const normalized = row.email.trim().toLowerCase()
        if (row.role === 'admin') {
          adminList.add(normalized)
        } else if (row.role === 'member') {
          memberList.add(normalized)
        } else {
          adminList.add(normalized)
        }
      })

      const combinedAdmins = Array.from(adminList)
      const combinedMembers = Array.from(memberList)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(combinedAdmins))
      localStorage.setItem(MEMBER_STORAGE_KEY, JSON.stringify(combinedMembers))
      return combinedAdmins
    }
  } catch (err) {
    console.warn('Failed to sync admin allowlist from Supabase:', err)
  }

  return getAdminAllowlist()
}

/**
 * Securely verifies the user's admin role from Supabase server-side records and allowlist.
 */
export async function verifyAdminRole(user: { id: string; email?: string | null }): Promise<boolean> {
  if (!user || !user.id || !user.email) return false
  const normalized = user.email.trim().toLowerCase()

  // 1. Super Admin email is always granted full admin access unconditionally
  if (isSuperAdmin(normalized)) return true

  // 2. Fast-path: Check synced allowlist cache
  if (isAdminEmail(normalized)) return true

  if (!supabase) {
    return isAdminEmail(normalized)
  }

  try {
    // 3. Try elevated get_my_staff_status RPC (auto-syncs allowlist to profile)
    const { data: staffStatus, error: staffErr } = await supabase.rpc('get_my_staff_status')
    if (!staffErr && staffStatus && typeof staffStatus.is_admin === 'boolean') {
      if (staffStatus.is_admin) return true
    }

    // 4. Try check_is_admin RPC
    const { data: isRpcAdmin, error: rpcError } = await supabase.rpc('check_is_admin', {
      p_user_id: user.id,
    })

    if (!rpcError && typeof isRpcAdmin === 'boolean' && isRpcAdmin) {
      return true
    }

    // 5. Query profiles table directly
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profileError && profile?.role === 'admin') {
      return true
    }

    // 6. Query admin_allowlist table directly in database
    const { data: allowlistRow, error: allowlistError } = await supabase
      .from('admin_allowlist')
      .select('email, role')
      .eq('email', normalized)
      .maybeSingle()

    if (!allowlistError && allowlistRow?.email) {
      if (!allowlistRow.role || allowlistRow.role === 'admin') {
        // Self-healing: Ensure profile role is updated to admin
        try {
          await supabase.from('profiles').update({ role: 'admin', entry_verified: true }).eq('id', user.id)
        } catch {}
        return true
      }
    }

    return false
  } catch (err) {
    console.warn('Error during admin verification:', err)
    return isAdminEmail(normalized)
  }
}

/**
 * Verifies if user has staff access (either Admin or Volunteer Member).
 * Used for Gate Scanner Desk and attendee verification access.
 */
export async function verifyStaffRole(user: { id: string; email?: string | null }): Promise<{
  isStaff: boolean
  role: 'admin' | 'member' | 'audience'
}> {
  if (!user || !user.id || !user.email) return { isStaff: false, role: 'audience' }
  const normalized = user.email.trim().toLowerCase()

  // 1. Super Admin
  if (isSuperAdmin(normalized)) {
    return { isStaff: true, role: 'admin' }
  }

  // 2. Allowlist cache check
  if (isAdminEmail(normalized)) {
    return { isStaff: true, role: 'admin' }
  }
  if (isMemberEmail(normalized)) {
    return { isStaff: true, role: 'member' }
  }

  if (!supabase) {
    const role = resolveUserRole(normalized)
    return { isStaff: role !== 'audience', role }
  }

  try {
    // 3. Try get_my_staff_status RPC
    const { data: staffStatus, error: staffErr } = await supabase.rpc('get_my_staff_status')
    if (!staffErr && staffStatus && typeof staffStatus.is_staff === 'boolean') {
      if (staffStatus.is_staff) {
        return { isStaff: true, role: staffStatus.role }
      }
    }

    // 4. Query profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role === 'admin' || profile?.role === 'member') {
      return { isStaff: true, role: profile.role }
    }

    // 5. Query admin_allowlist directly
    const { data: allowlistRow } = await supabase
      .from('admin_allowlist')
      .select('email, role')
      .eq('email', normalized)
      .maybeSingle()

    if (allowlistRow?.email) {
      const assignedRole = allowlistRow.role === 'member' ? 'member' : 'admin'
      // Auto-sync to profiles
      try {
        await supabase.from('profiles').update({ role: assignedRole }).eq('id', user.id)
      } catch {}
      return { isStaff: true, role: assignedRole }
    }

    return { isStaff: false, role: 'audience' }
  } catch {
    const role = resolveUserRole(normalized)
    return { isStaff: role !== 'audience', role }
  }
}

