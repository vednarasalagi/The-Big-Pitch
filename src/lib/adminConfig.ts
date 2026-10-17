// ============================================================
// Admin Authorization & Allowlist Management
// Single Super Admin architecture + dynamic Admin Allowlist
// ============================================================

import { supabase } from './supabase'

const STORAGE_KEY = 'pitch_arena_admin_allowlist'

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
 * Resolves the role ('admin' | 'audience') for a given email address.
 * Never trusts a client-supplied role flag.
 */
export function resolveUserRole(email?: string | null): 'admin' | 'audience' {
  return isAdminEmail(email) ? 'admin' : 'audience'
}

/**
 * Dynamically adds an authorized admin email to the allowlist.
 * Persists to Supabase `public.admin_allowlist` and local cache.
 */
export async function addAdminEmail(email: string, addedByEmail?: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return false

  // 1. Save to local storage for immediate UI availability
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const list: string[] = stored ? JSON.parse(stored) : []
    if (!list.includes(normalized)) {
      list.push(normalized)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    }
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }

  // 2. If Supabase is connected, persist to database
  if (supabase) {
    try {
      const { error: insertError } = await supabase
        .from('admin_allowlist')
        .upsert({
          email: normalized,
          role: 'admin',
          added_by: addedByEmail ?? getSuperAdminEmail() ?? 'super_admin',
          notes: `Added by ${addedByEmail ?? 'super_admin'} from Admin Panel`,
        }, { onConflict: 'email' })

      if (insertError) {
        console.warn('Supabase allowlist insert notice:', insertError.message)
      }

      // Also update profiles table if this user already exists
      await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('email', normalized)
    } catch (err) {
      console.warn('Could not write to Supabase admin_allowlist:', err)
    }
  }

  return true
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
      .select('email')

    if (!error && data) {
      const list = new Set<string>()
      const superAdmin = getSuperAdminEmail()
      if (superAdmin) list.add(superAdmin)

      data.forEach((row: { email: string }) => {
        if (row.email) list.add(row.email.trim().toLowerCase())
      })

      const combined = Array.from(list)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(combined))
      return combined
    }
  } catch (err) {
    console.warn('Failed to sync admin allowlist from Supabase:', err)
  }

  return getAdminAllowlist()
}

/**
 * Securely verifies the user's admin role from Supabase or fallback.
 */
export async function verifyAdminRole(user: { id: string; email?: string | null }): Promise<boolean> {
  if (!user || !user.email) return false
  const normalized = user.email.trim().toLowerCase()

  // Always true for Super Admin
  if (isSuperAdmin(normalized)) return true

  // Offline / not connected fallback
  if (!supabase) {
    return isAdminEmail(normalized)
  }

  try {
    // 1. Try secure Supabase RPC check if available
    const { data: isRpcAdmin, error: rpcError } = await supabase.rpc('check_is_admin', {
      p_user_id: user.id,
    })

    if (!rpcError && typeof isRpcAdmin === 'boolean') {
      return isRpcAdmin
    }

    // 2. Query profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profileError && profile?.role === 'admin') {
      return true
    }

    // 3. Fallback to allowlist check
    return isAdminEmail(normalized)
  } catch (err) {
    console.error('Error during admin verification:', err)
    return isAdminEmail(normalized)
  }
}
