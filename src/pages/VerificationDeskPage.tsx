// ============================================================
// VerificationDeskPage.tsx — Event Entry Gate & Volunteer Scanner Desk
// Accessible to: 'admin' and 'member' (volunteer) roles
// Features: Live Camera QR Scanner (jsQR) + Searchable Attendee Registration Roster
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  QrCode, Users, Search, CheckCircle2, AlertTriangle,
  Camera, CameraOff, RefreshCw, Volume2, VolumeX, Shield,
  UserCheck, X, Clock, ArrowLeft, Sparkles, Filter, Check, RotateCcw
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { useAuthStore } from '@/store'
import { Avatar, StatusBadge } from '@/components/ui'
import { getRegisteredAttendees, verifyAttendeeAtGate, unverifyAttendeeAtGate } from '@/lib/supabaseApi'
import { supabase, TABLES } from '@/lib/supabase'
import type { UserProfile } from '@/types'
import { toast } from 'sonner'
import { cn, formatRelativeTime } from '@/lib/utils'

export function VerificationDeskPage() {
  const { user } = useAuthStore()

  // Guard: Must be admin or member (volunteer)
  const isAuthorized = user && (user.role === 'admin' || user.role === 'member')

  const [activeTab, setActiveTab] = useState<'scanner' | 'roster'>('scanner')
  const [attendees, setAttendees] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'verified'>('all')

  // Camera Scanner State
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [autoVerifyOnScan, setAutoVerifyOnScan] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Last scanned attendee card modal
  const [scannedAttendee, setScannedAttendee] = useState<UserProfile | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const scanLockRef = useRef(false)

  // Web Audio Synthesizer Beep (No external files needed)
  const playBeep = useCallback((success = true) => {
    if (!soundEnabled) return
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = success ? 'sine' : 'sawtooth'
      osc.frequency.setValueAtTime(success ? 880 : 330, audioCtx.currentTime) // A5 or E4
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.16)
    } catch {}
  }, [soundEnabled])

  // Load attendees roster
  const loadRoster = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRegisteredAttendees()
      setAttendees(data)
    } catch (err) {
      toast.error('Failed to load registered attendees.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthorized) {
      loadRoster()
    }
  }, [isAuthorized, loadRoster])

  // Realtime subscription for gate verification sync across all volunteers
  useEffect(() => {
    if (!supabase || !isAuthorized) return

    const channel = supabase
      .channel('gate_verification_roster')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.PROFILES },
        () => {
          loadRoster()
        }
      )
      .subscribe()

    return () => {
      if (supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [isAuthorized, loadRoster])

  // Camera Stream Lifecycle
  useEffect(() => {
    if (!isAuthorized || activeTab !== 'scanner') {
      stopCamera()
      return
    }

    startCamera()

    return () => {
      stopCamera()
    }
  }, [isAuthorized, activeTab, facingMode])

  const [manualCodeInput, setManualCodeInput] = useState('')

  // Read URL query params for tab switching (e.g. /verify?tab=roster)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam === 'roster' || tabParam === 'scanner') {
      setActiveTab(tabParam)
    }
  }, [])

  const startCamera = async () => {
    setCameraError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera API is not supported on this browser or device.')
        return
      }

      // Stop any existing stream
      stopCamera()

      let stream: MediaStream
      try {
        // Preferred mobile camera constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        })
      } catch (constraintErr) {
        console.warn('FacingMode constraint fallback:', constraintErr)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        videoRef.current.setAttribute('autoplay', 'true')
        videoRef.current.setAttribute('muted', 'true')
        try {
          await videoRef.current.play()
        } catch (playErr) {
          console.warn('Video play notice:', playErr)
        }
        setCameraActive(true)
        requestAnimationFrame(tickScan)
      }
    } catch (err: any) {
      console.warn('Camera access error:', err)
      setCameraActive(false)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in browser settings.')
      } else {
        setCameraError('Unable to open camera stream. You can still verify attendees using the manual pass code input below.')
      }
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  // Real-time Canvas Frame QR Scanner (jsQR)
  const tickScan = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      if (cameraActive) requestAnimationFrame(tickScan)
      return
    }

    const video = videoRef.current
    let canvas = canvasRef.current
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvasRef.current = canvas
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (code && code.data && !scanLockRef.current) {
      handleCodeDetected(code.data)
    }

    if (cameraActive) {
      requestAnimationFrame(tickScan)
    }
  }

  const handleCodeDetected = async (data: string) => {
    scanLockRef.current = true
    try {
      let attendeeId: string | null = null
      let passCode: string | null = null

      // Detect JSON payload or plain code
      try {
        const parsed = JSON.parse(data)
        if (parsed.id) attendeeId = parsed.id
        if (parsed.code) passCode = parsed.code
      } catch {
        // Plain text format: e.g. TBP-A8F2 or raw UUID
        if (data.startsWith('TBP-')) passCode = data.trim()
        else if (data.length === 36) attendeeId = data.trim()
      }

      // Find attendee in roster
      let target: UserProfile | undefined = attendees.find(
        a => (attendeeId && a.id === attendeeId) || (passCode && a.passCode?.toUpperCase() === passCode.toUpperCase())
      )

      // Fallback reload if not in cached list
      if (!target && (attendeeId || passCode)) {
        const freshList = await getRegisteredAttendees()
        setAttendees(freshList)
        target = freshList.find(
          a => (attendeeId && a.id === attendeeId) || (passCode && a.passCode?.toUpperCase() === passCode.toUpperCase())
        )
      }

      if (target) {
        playBeep(true)
        if (navigator.vibrate) navigator.vibrate([80, 40, 80])
        setScannedAttendee(target)

        if (autoVerifyOnScan && !target.isEntryVerified && target.role !== 'admin') {
          await executeVerification(target.id)
        }
      } else {
        playBeep(false)
        toast.error('Scanned QR code is not recognized as a registered attendee.')
      }
    } finally {
      // Re-enable scan after 2.5 seconds pause
      setTimeout(() => {
        scanLockRef.current = false
      }, 2500)
    }
  }

  // Execute verification
  const executeVerification = async (attendeeId: string) => {
    if (!user) return
    setVerifyingId(attendeeId)
    try {
      const res = await verifyAttendeeAtGate(attendeeId, user.id)
      if (res.success) {
        toast.success('Attendee gate verified successfully!')
        // Optimistic update
        setAttendees(prev => prev.map(a => a.id === attendeeId ? {
          ...a,
          isEntryVerified: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy: user.email,
        } : a))

        if (scannedAttendee?.id === attendeeId) {
          setScannedAttendee(prev => prev ? {
            ...prev,
            isEntryVerified: true,
            verifiedAt: new Date().toISOString(),
            verifiedBy: user.email,
          } : null)
        }
      } else {
        toast.error(res.error || 'Verification failed.')
      }
    } catch {
      toast.error('An error occurred during verification.')
    } finally {
      setVerifyingId(null)
    }
  }

  // Undo verification
  const executeUnverify = async (attendeeId: string) => {
    if (!user) return
    setVerifyingId(attendeeId)
    try {
      const res = await unverifyAttendeeAtGate(attendeeId, user.id)
      if (res.success) {
        toast.info('Attendee entry verification revoked.')
        setAttendees(prev => prev.map(a => a.id === attendeeId ? {
          ...a,
          isEntryVerified: false,
          verifiedAt: undefined,
          verifiedBy: undefined,
        } : a))

        if (scannedAttendee?.id === attendeeId) {
          setScannedAttendee(prev => prev ? {
            ...prev,
            isEntryVerified: false,
            verifiedAt: undefined,
            verifiedBy: undefined,
          } : null)
        }
      }
    } finally {
      setVerifyingId(null)
    }
  }

  if (!isAuthorized) {
    return <Navigate to="/" replace />
  }

  // Filtered roster calculation
  const totalCount = attendees.length
  const verifiedCount = attendees.filter(a => a.role === 'admin' || a.isEntryVerified).length
  const pendingCount = totalCount - verifiedCount

  const filteredAttendees = attendees.filter(a => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch = !q ||
      a.displayName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.passCode && a.passCode.toLowerCase().includes(q))

    const isVerified = a.role === 'admin' || a.isEntryVerified
    if (filterMode === 'verified') return matchesSearch && isVerified
    if (filterMode === 'pending') return matchesSearch && !isVerified
    return matchesSearch
  })

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 pb-20 pt-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors shadow-sm"
              title="Return to Arena"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight leading-none">
                  Event Entry & Verification Desk
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-950 text-white font-mono">
                  {user.role === 'admin' ? 'Super Admin' : 'Volunteer Member'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Single-Account Rule Enforcement • Scan attendee QR pass or search registration roster
              </p>
            </div>
          </div>

          {/* Quick KPI stats */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 shadow-sm flex items-center gap-1.5">
              <span className="text-zinc-400 font-sans">Total:</span>
              <span className="font-black text-zinc-950">{totalCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm flex items-center gap-1.5 text-emerald-900">
              <span className="text-emerald-700 font-sans font-semibold">Verified:</span>
              <span className="font-black">{verifiedCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 shadow-sm flex items-center gap-1.5 text-amber-900">
              <span className="text-amber-700 font-sans font-semibold">Pending:</span>
              <span className="font-black">{pendingCount}</span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-200/80 border border-zinc-300">
            <button
              type="button"
              onClick={() => setActiveTab('scanner')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all',
                activeTab === 'scanner'
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-300/50'
              )}
            >
              <QrCode size={15} />
              <span>Camera QR Scanner</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all',
                activeTab === 'roster'
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-300/50'
              )}
            >
              <Users size={15} />
              <span>Registration Roster ({totalCount})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadRoster}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors shadow-sm"
            title="Reload Attendee List"
          >
            <RefreshCw size={15} className={cn(loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── TAB 1: LIVE CAMERA QR SCANNER ── */}
        {activeTab === 'scanner' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
            {/* Viewfinder Column (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative rounded-3xl overflow-hidden bg-black aspect-[4/3] sm:aspect-video flex items-center justify-center border-4 border-zinc-900 shadow-2xl">
                {/* Real video feed */}
                <video
                  ref={videoRef}
                  className={cn(
                    'w-full h-full object-cover',
                    !cameraActive && 'hidden'
                  )}
                  playsInline
                  autoPlay
                  muted
                />

                {/* Scanning Target Overlay */}
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Darkened vignette around target */}
                    <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl border-2 border-amber-400 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                      {/* Corner Target Markers */}
                      <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                      <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                      <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

                      {/* Animated Laser Sweep Line */}
                      <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-scan-laser" />
                    </div>

                    <p className="mt-4 text-white text-xs font-bold drop-shadow tracking-wide bg-black/60 px-3 py-1 rounded-full border border-white/20">
                      Align attendee QR inside the box
                    </p>
                  </div>
                )}

                {/* Camera Inactive / Error Fallback */}
                {(!cameraActive || cameraError) && (
                  <div className="p-8 text-center text-white/80 space-y-3">
                    <CameraOff size={36} className="mx-auto text-amber-400" />
                    <p className="text-sm font-bold text-white">
                      {cameraError || 'Camera is currently stopped.'}
                    </p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 rounded-xl bg-amber-400 text-black font-black text-xs hover:bg-amber-300 transition-colors shadow-md"
                    >
                      Start Camera
                    </button>
                  </div>
                )}
              </div>

              {/* Scanner Control Bar */}
              <div className="p-4 rounded-2xl bg-white border border-zinc-200/90 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition-colors"
                  >
                    <Camera size={13} />
                    <span>Flip Camera ({facingMode === 'environment' ? 'Back' : 'Front'})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSoundEnabled(prev => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition-colors"
                  >
                    {soundEnabled ? <Volume2 size={13} className="text-emerald-600" /> : <VolumeX size={13} className="text-zinc-400" />}
                    <span>Sound {soundEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoVerifyOnScan}
                    onChange={(e) => setAutoVerifyOnScan(e.target.checked)}
                    className="w-4 h-4 rounded text-zinc-950 focus:ring-0 accent-zinc-950 cursor-pointer"
                  />
                  <span className="font-bold text-zinc-800">Auto-verify on scan</span>
                </label>
              </div>

              {/* Quick Manual Pass Code Verification */}
              <div className="p-4 rounded-2xl bg-white border border-zinc-200/90 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-zinc-950 tracking-wide flex items-center gap-1.5">
                    <QrCode size={14} className="text-purple-600" />
                    <span>Quick Pass Code or Email Verification</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">e.g. TBP-A8F2 or email</span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (manualCodeInput.trim()) {
                      handleCodeDetected(manualCodeInput.trim())
                      setManualCodeInput('')
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    placeholder="Enter pass code (TBP-XXXX) or attendee email..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:border-zinc-950 text-xs font-mono text-zinc-900 outline-none uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs transition-colors flex-shrink-0 shadow-sm"
                  >
                    Verify Pass
                  </button>
                </form>
              </div>
            </div>

            {/* Scanned Card Column (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 rounded-3xl bg-white border border-zinc-200/90 shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wide flex items-center gap-2">
                    <UserCheck size={16} className="text-zinc-950" />
                    <span>Scanned Attendee Details</span>
                  </h3>
                  {scannedAttendee && (
                    <button
                      type="button"
                      onClick={() => setScannedAttendee(null)}
                      className="p-1 text-zinc-400 hover:text-zinc-950 rounded-lg hover:bg-zinc-100"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {scannedAttendee ? (
                  <div className="space-y-4 animate-scale-up">
                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-zinc-50 border border-zinc-200">
                      <Avatar
                        name={scannedAttendee.displayName}
                        src={scannedAttendee.avatarUrl}
                        size="lg"
                        className="border-2 border-white shadow-sm flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-black text-base text-zinc-950 truncate">
                            {scannedAttendee.displayName}
                          </h4>
                          {scannedAttendee.role === 'admin' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500 text-black font-black uppercase">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-500 text-xs font-mono truncate">{scannedAttendee.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Pass Code</span>
                        <span className="font-mono font-black text-sm text-zinc-950">{scannedAttendee.passCode || 'N/A'}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Registered</span>
                        <span className="text-zinc-700 font-medium">{formatRelativeTime(scannedAttendee.createdAt)}</span>
                      </div>
                    </div>

                    {/* Status Box */}
                    {scannedAttendee.role === 'admin' || scannedAttendee.isEntryVerified ? (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                          <span className="font-black text-xs uppercase tracking-wide">
                            Gate Verified Attendee
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 leading-snug">
                          This user is cleared to invest points on startups.
                        </p>
                        {scannedAttendee.verifiedBy && (
                          <p className="text-[10px] text-emerald-700/80 font-mono pt-1">
                            Verified by: {scannedAttendee.verifiedBy}
                          </p>
                        )}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => executeUnverify(scannedAttendee.id)}
                            disabled={verifyingId === scannedAttendee.id}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline"
                          >
                            Revoke / Undo Verification
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                            <span className="font-black text-xs uppercase tracking-wide">
                              Pending Physical Entry Verification
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-900 leading-snug">
                            Single Account Rule: Confirm attendee is physically present at the venue before activating.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => executeVerification(scannedAttendee.id)}
                          disabled={verifyingId === scannedAttendee.id}
                          className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={18} />
                          <span>{verifyingId === scannedAttendee.id ? 'Activating...' : 'Verify & Activate Account'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-400 space-y-2">
                    <QrCode size={36} className="mx-auto text-zinc-300" />
                    <p className="text-xs font-semibold text-zinc-500">
                      Waiting for QR scan...
                    </p>
                    <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                      Point the camera at the attendee's "Event Entry Pass" QR code to view and verify them.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: REGISTRATION ROSTER & MANUAL SEARCH ── */}
        {activeTab === 'roster' && (
          <div className="space-y-4 animate-fade-in">
            {/* Search and Filters Bar */}
            <div className="p-4 rounded-3xl bg-white border border-zinc-200/90 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or pass code (e.g. TBP-A8F2)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
                />
              </div>

              {/* Status filter pills */}
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl transition-colors',
                    filterMode === 'all'
                      ? 'bg-zinc-950 text-white shadow-sm'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  )}
                >
                  All ({totalCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('pending')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl transition-colors',
                    filterMode === 'pending'
                      ? 'bg-amber-500 text-black shadow-sm font-black'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  )}
                >
                  Pending ({pendingCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('verified')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl transition-colors',
                    filterMode === 'verified'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  )}
                >
                  Verified ({verifiedCount})
                </button>
              </div>
            </div>

            {/* Attendees Table / List */}
            <div className="bg-white rounded-3xl border border-zinc-200/90 shadow-sm overflow-hidden divide-y divide-zinc-200/70">
              {filteredAttendees.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 space-y-2">
                  <Users size={32} className="mx-auto text-zinc-300" />
                  <p className="text-sm font-bold text-zinc-800">No attendees match your search</p>
                  <p className="text-xs text-zinc-400">Try searching with a different name, email, or pass code.</p>
                </div>
              ) : (
                filteredAttendees.map(attendee => {
                  const isVerified = attendee.role === 'admin' || attendee.isEntryVerified

                  return (
                    <div
                      key={attendee.id}
                      className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={attendee.displayName}
                          src={attendee.avatarUrl}
                          size="md"
                          className="border border-white shadow-sm flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-950 truncate">
                              {attendee.displayName}
                            </span>
                            {attendee.role === 'admin' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500 text-black font-black uppercase">
                                Admin
                              </span>
                            )}
                            {attendee.role === 'member' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-600 text-white font-black uppercase">
                                Member
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mt-0.5">
                            <span className="truncate">{attendee.email}</span>
                            <span>•</span>
                            <span className="font-bold text-zinc-800">{attendee.passCode || 'NO-CODE'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right verification action */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                        {isVerified ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-1.5">
                              <CheckCircle2 size={13} className="text-emerald-700" />
                              <span>Verified at Gate</span>
                            </span>
                            {attendee.role !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => executeUnverify(attendee.id)}
                                disabled={verifyingId === attendee.id}
                                className="p-1 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-100 text-xs font-bold"
                                title="Revoke verification"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => executeVerification(attendee.id)}
                            disabled={verifyingId === attendee.id}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 size={14} />
                            <span>{verifyingId === attendee.id ? 'Verifying...' : 'Verify Attendee'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
