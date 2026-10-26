// ============================================================
// UserProfileModal.tsx — Attendee Profile & Avatar Photo Manager
// Allows attendees to upload/change profile photo from device camera/gallery.
// Optimizes image locally and uploads directly to Supabase Storage.
// ============================================================

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Camera,
  Upload,
  User,
  Sparkles,
  Check,
  Loader2,
  Trash2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui'
import { useAuthStore } from '@/store'
import { processAvatarImage } from '@/lib/imageUtils'
import { uploadUserAvatar, updateUserProfile } from '@/lib/supabaseApi'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, setUser } = useAuthStore()

  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen || !user) return null

  // Handle device file selection (camera or gallery)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMsg('')
    setIsProcessing(true)

    try {
      // Optimize image client-side to square 512x512 WebP under 200KB
      const processed = await processAvatarImage(file, 512)
      setSelectedFile(processed.file)
      setAvatarPreview(processed.dataUrl)
      toast.success('Photo ready to save!')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not process selected image.')
      toast.error(err?.message || 'Invalid image file.')
    } finally {
      setIsProcessing(false)
      // Reset input value so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Handle Remove Photo
  const handleRemovePhoto = () => {
    setSelectedFile(null)
    setAvatarPreview(null)
  }

  // Handle Save Profile
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const cleanName = displayName.trim()
    if (!cleanName) {
      setErrorMsg('Display name cannot be empty.')
      return
    }

    setIsSaving(true)

    try {
      let finalAvatarUrl: string | undefined = user.avatarUrl

      // 1. If a new file was selected, upload it to Supabase Storage
      if (selectedFile) {
        const uploadRes = await uploadUserAvatar(selectedFile, user.id)
        if (!uploadRes.success || !uploadRes.publicUrl) {
          throw new Error(uploadRes.error || 'Failed to upload image to storage.')
        }
        finalAvatarUrl = uploadRes.publicUrl
      } else if (avatarPreview === null && user.avatarUrl) {
        // User removed photo
        finalAvatarUrl = ''
      }

      // 2. Persist profile changes in Supabase
      const updateRes = await updateUserProfile(user.id, {
        displayName: cleanName,
        avatarUrl: finalAvatarUrl || '',
      })

      if (!updateRes.success) {
        throw new Error(updateRes.error || 'Failed to update profile.')
      }

      // 3. Update local auth state
      setUser({
        ...user,
        displayName: cleanName,
        avatarUrl: finalAvatarUrl || undefined,
        updatedAt: new Date().toISOString(),
      })

      toast.success('Profile updated successfully!')
      onClose()
    } catch (err: any) {
      console.error('Profile update error:', err)
      setErrorMsg(err?.message || 'Could not save profile.')
      toast.error(err?.message || 'Could not save profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="skeuo-surface rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200/90 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl skeuo-token-dark flex items-center justify-center text-white">
              <Camera size={15} />
            </div>
            <div>
              <h2 className="text-zinc-950 font-black text-base sm:text-lg tracking-tight">
                Profile & Photo
              </h2>
              <p className="text-zinc-500 text-[11px]">
                Cast on stage projector & leaderboard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-800 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Photo Uploader Showcase */}
          <div className="flex flex-col items-center justify-center space-y-3 pt-1">
            <div className="relative group">
              {/* Outer decorative ring */}
              <div className="p-1 rounded-full bg-gradient-to-tr from-amber-400 via-zinc-200 to-zinc-900 shadow-md">
                <Avatar
                  name={displayName || user.displayName}
                  src={avatarPreview || undefined}
                  size="3xl"
                  className="w-24 h-24 sm:w-28 sm:h-28 text-2xl sm:text-3xl border-2 border-white shadow-inner"
                />
              </div>

              {/* Upload trigger button badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing || isSaving}
                className="absolute bottom-0 right-0 p-2.5 rounded-full bg-zinc-950 text-white shadow-lg hover:scale-105 active:scale-95 transition-transform border-2 border-white"
                title="Upload photo from device"
              >
                {isProcessing ? (
                  <Loader2 size={16} className="animate-spin text-amber-400" />
                ) : (
                  <Camera size={16} />
                )}
              </button>
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing || isSaving}
                className="skeuo-btn-secondary px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 text-zinc-800"
              >
                <Upload size={13} />
                <span>Upload from Device</span>
              </button>

              {avatarPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isSaving}
                  className="p-1.5 px-2.5 rounded-xl hover:bg-rose-50 text-rose-600 text-xs font-semibold flex items-center gap-1 transition-colors border border-transparent hover:border-rose-200"
                  title="Remove photo"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 text-center max-w-xs">
              JPG, PNG, or WebP. Automatically centered & optimized for stage presentation.
            </p>
          </div>

          {/* Form Fields */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name or investor alias"
                  maxLength={40}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 text-zinc-950 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all pl-10"
                />
                <User size={16} className="absolute left-3.5 top-3 text-zinc-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                This name and your photo will appear live on the stage projector when you invest!
              </p>
            </div>

            <div className="p-3 rounded-2xl skeuo-sunken text-xs flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Linked Email:</span>
              <span className="font-mono text-zinc-900 font-bold truncate max-w-[200px]">
                {user.email}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 rounded-xl skeuo-btn-secondary text-xs font-bold text-zinc-700 text-center"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving || isProcessing}
              className="flex-1 py-2.5 px-4 rounded-xl skeuo-btn-primary text-xs font-black text-white text-center flex items-center justify-center gap-2 shadow-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} strokeWidth={2.5} />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
