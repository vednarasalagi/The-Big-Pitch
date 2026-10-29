// ============================================================
// EntryPassModal.tsx — Official Event Entry Pass & Verification QR Ticket
// Displays attendee's physical event credential, unique QR, pass code, and gate verification status
// ============================================================

import React, { useState } from 'react'
import {
  X, ShieldCheck, QrCode, CheckCircle2, Clock,
  AlertTriangle, Copy, Check, Download, RefreshCw, UserCheck, Sparkles
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Avatar } from '@/components/ui'
import { getUserProfile } from '@/lib/supabaseApi'
import { useAuthStore } from '@/store'
import type { UserProfile } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface EntryPassModalProps {
  isOpen: boolean
  onClose: () => void
}

export function EntryPassModal({ isOpen, onClose }: EntryPassModalProps) {
  const { user, setUser } = useAuthStore()
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  if (!isOpen || !user) return null

  const isVerified = user.role === 'admin' || user.isEntryVerified
  const passCode = user.passCode || `TBP-${user.id.slice(0, 6).toUpperCase()}`

  // QR Code payload format: standardized prefix for instant volunteer scanner recognition
  const qrData = JSON.stringify({
    type: 'TBP_ENTRY_PASS',
    id: user.id,
    email: user.email,
    name: user.displayName,
    code: passCode,
  })

  const copyCode = () => {
    navigator.clipboard.writeText(passCode)
    setCopied(true)
    toast.success(`Copied Pass Code: ${passCode}`)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRefreshStatus = async () => {
    setRefreshing(true)
    try {
      const updated = await getUserProfile(user.id)
      if (updated) {
        setUser({
          ...user,
          role: updated.role,
          isEntryVerified: updated.isEntryVerified,
          verifiedAt: updated.verifiedAt,
          verifiedBy: updated.verifiedBy,
          passCode: updated.passCode,
        })
        if (updated.isEntryVerified) {
          toast.success('Congratulations! Your account is verified at the gate!')
        } else {
          toast.info('Status updated: Account is still pending gate verification.')
        }
      }
    } catch {
      toast.error('Could not refresh status. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="modal-overlay z-[100] bg-zinc-950/70 backdrop-blur-sm animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="modal-panel relative max-w-sm sm:max-w-md bg-white rounded-3xl border border-zinc-200/90 shadow-2xl overflow-y-auto text-zinc-900 z-10 animate-scale-up">
        {/* Ticket Header Bar */}
        <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white px-6 py-4 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
              <QrCode size={16} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight leading-none text-white">
                THE BIG PITCH • PASS
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Official Event Entry Credential
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ticket Card Body */}
        <div className="p-6 sm:p-7 space-y-5 bg-gradient-to-b from-[#FAFAFA] to-white">
          {/* User Profile Card */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white border border-zinc-200/90 shadow-sm">
            <Avatar name={user.displayName} src={user.avatarUrl} size="lg" className="border-2 border-white shadow-sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="font-black text-sm text-zinc-950 truncate">
                  {user.displayName}
                </h4>
                {user.role === 'admin' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500 text-black font-black uppercase tracking-wider">
                    Admin
                  </span>
                )}
                {user.role === 'member' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-600 text-white font-black uppercase tracking-wider">
                    Member
                  </span>
                )}
              </div>
              <p className="text-zinc-500 text-xs font-mono truncate">{user.email}</p>
            </div>
          </div>

          {/* Verification QR Code Section */}
          <div className="flex flex-col items-center justify-center p-5 rounded-2xl skeuo-sunken bg-white border border-zinc-200 text-center relative overflow-hidden">
            {/* Holographic light shimmer */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

            <div className="p-3 bg-white rounded-2xl shadow-inner border border-zinc-200">
              <QRCodeSVG
                value={qrData}
                size={180}
                level="H"
                includeMargin={false}
                className="rounded-lg"
              />
            </div>

            {/* Pass Code */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Pass Code:</span>
              <button
                type="button"
                onClick={copyCode}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-mono font-black text-xs transition-colors border border-zinc-300"
                title="Click to copy pass code"
              >
                <span>{passCode}</span>
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-zinc-400" />}
              </button>
            </div>
          </div>

          {/* Verification Status Banner */}
          {isVerified ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <span className="font-black text-xs uppercase tracking-wide">
                  Gate Verified • Pitch Investing Active
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-snug">
                Your entry credential was verified by an event volunteer. You are cleared to invest points on all live pitches!
              </p>
              {user.verifiedBy && (
                <p className="text-[10px] text-emerald-700/80 font-mono pt-0.5">
                  Verified by: {user.verifiedBy}
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                <span className="font-black text-xs uppercase tracking-wide">
                  Pending Gate Verification
                </span>
              </div>
              <p className="text-[11px] text-amber-900 leading-snug">
                To maintain the <strong>Single Account Rule</strong>, please show this QR code to any event volunteer at the auditorium entrance.
              </p>
              <p className="text-[10px] text-amber-800 font-medium pt-0.5">
                ⚠️ Account cannot invest points until verified at the gate.
              </p>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRefreshStatus}
              disabled={refreshing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs transition-colors border border-zinc-200"
            >
              <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} />
              <span>Refresh Status</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-950 text-white font-black text-xs hover:bg-zinc-800 transition-colors shadow-sm text-center"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
