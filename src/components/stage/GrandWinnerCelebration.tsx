// ============================================================
// GrandWinnerCelebration.tsx — World-Class Tournament Winner Stage
// Electrifying cinematic celebration with searchlights, sunburst,
// laurel wreath, royal crown crowning the champion, and custom audio fanfare.
// ============================================================

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  Crown, Trophy, Sparkles, Volume2, VolumeX,
  Maximize2, Minimize2, X, Shield, PartyPopper
} from 'lucide-react'
import { Avatar } from '@/components/ui'
import {
  type WinnerCelebrationPayload,
  playCelebrationFanfare,
  getStoredCelebrationAudioUrl,
} from '@/lib/realtimeSync'

interface GrandWinnerCelebrationProps {
  celebration: WinnerCelebrationPayload | null
  onDismiss?: () => void
  isStandalone?: boolean
}

export function GrandWinnerCelebration({
  celebration,
  onDismiss,
  isStandalone = false,
}: GrandWinnerCelebrationProps) {
  const [muted, setMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(() => {
    return typeof document !== 'undefined' && !!document.fullscreenElement
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const winner = celebration?.winner

  // Sync isFullscreen with native document.fullscreenElement
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Fire confetti cannon barrage (called ONCE after 1 second)
  const fireConfettiBarrage = useCallback(() => {
    // 1. Left corner high-velocity cannon
    confetti({
      particleCount: 90,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.85 },
      colors: ['#F59E0B', '#FEF08A', '#FCD34D', '#FFFFFF', '#D97706', '#38BDF8'],
      zIndex: 10000,
    })

    // 2. Right corner high-velocity cannon
    confetti({
      particleCount: 90,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.85 },
      colors: ['#F59E0B', '#FEF08A', '#FCD34D', '#FFFFFF', '#D97706', '#38BDF8'],
      zIndex: 10000,
    })

    // 3. Center shower with stars and ribbons
    confetti({
      particleCount: 50,
      spread: 100,
      origin: { x: 0.5, y: 0.35 },
      shapes: ['star', 'circle'],
      colors: ['#FEF08A', '#F59E0B', '#FFFFFF'],
      scalar: 1.2,
      zIndex: 10000,
    })
  }, [])

  // Initial trigger: play audio + blast confetti ONCE after 1 second
  useEffect(() => {
    if (!celebration?.active || !winner) return

    // Stop any previously playing audio instance
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }

    // Play celebration audio (Custom music uploaded from Admin Panel, or fallback fanfare)
    const customAudioUrl = celebration.audioUrl || getStoredCelebrationAudioUrl()
    if (!muted) {
      if (customAudioUrl) {
        try {
          const audio = new Audio(customAudioUrl)
          audioRef.current = audio
          audio.play().catch(err => {
            console.warn('Custom celebration audio playback failed, falling back to fanfare:', err)
            playCelebrationFanfare()
          })
        } catch {
          playCelebrationFanfare()
        }
      } else {
        playCelebrationFanfare()
      }
    }

    // Confetti blast: ONCE at exactly 1 second (1000ms) after trigger
    const confettiTimer = setTimeout(() => {
      fireConfettiBarrage()
    }, 1000)

    return () => {
      clearTimeout(confettiTimer)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current = null
      }
    }
  }, [celebration?.active, celebration?.timestamp, celebration?.audioUrl, winner?.name, fireConfettiBarrage, muted])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  if (!celebration?.active || !winner) {
    if (!isStandalone) return null
    return (
      <div className="fixed inset-0 z-50 bg-[#050507] flex flex-col items-center justify-center text-white p-6">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
          <Trophy size={32} />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-zinc-100">Stage Standby</h2>
        <p className="text-zinc-500 text-sm mt-1 max-w-sm text-center">
          Awaiting live winner celebration trigger from the Stage Control Room.
        </p>
      </div>
    )
  }

  return (
    <div
      onDoubleClick={toggleFullscreen}
      className="fixed inset-0 z-[9999] text-white flex flex-col justify-between overflow-hidden select-none"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 35%, #1a0e00 0%, #0d0700 40%, #050507 100%)' }}
    >
      {/* ── 1. CINEMATIC ATMOSPHERE, SEARCHLIGHTS & SUNBURST ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Dynamic Volumetric Searchlight Beams */}
        <div className="absolute top-0 left-[-15%] w-[45vw] h-[110vh] bg-gradient-to-b from-amber-400/25 via-amber-300/10 to-transparent blur-3xl transform origin-top animate-spotlight-left" />
        <div className="absolute top-0 right-[-15%] w-[45vw] h-[110vh] bg-gradient-to-b from-amber-400/25 via-amber-300/10 to-transparent blur-3xl transform origin-top animate-spotlight-right" />

        {/* 36-Ray Grand Golden Celestial Sunburst */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] md:w-[1600px] md:h-[1600px] pointer-events-none opacity-35 animate-sunburst">
          <svg viewBox="0 0 1000 1000" className="w-full h-full">
            <defs>
              <radialGradient id="sunburstGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
                <stop offset="45%" stopColor="#FEF08A" stopOpacity="0.3" />
                <stop offset="80%" stopColor="#D97706" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#050507" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g fill="url(#sunburstGrad)">
              {[...Array(36)].map((_, i) => {
                const angle = i * 10
                return (
                  <path
                    key={i}
                    d="M 500 500 L 470 0 L 530 0 Z"
                    transform={`rotate(${angle} 500 500)`}
                  />
                )
              })}
            </g>
          </svg>
        </div>

        {/* Deep warm core glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[600px] h-[600px] md:w-[900px] md:h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.22) 0%, rgba(217,119,6,0.10) 50%, transparent 80%)' }} />
        {/* Amber haze upper bloom */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-b-full" style={{ background: 'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(245,158,11,0.18) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        {/* Pulsating core halo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] md:w-[560px] md:h-[560px] rounded-full animate-pulse" style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.18) 0%, transparent 70%)' }} />

        {/* Celestial Orbital Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] md:w-[620px] md:h-[620px] rounded-full border border-amber-400/20 border-dashed animate-spin-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[530px] h-[530px] md:w-[800px] md:h-[800px] rounded-full border border-amber-300/10 animate-spin-reverse" />
      </div>

      {/* ── 2. STAGE OPERATOR FLOATING HUD BAR (TOP) — HIDDEN IN FULLSCREEN ── */}
      {!isFullscreen && (
        <header className="relative z-30 w-full px-6 py-4 flex items-center justify-between transition-opacity duration-300 animate-fade-in">
          {/* Left: Tournament Badge */}
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-amber-500/30 text-xs font-mono font-bold text-amber-300 shadow-lg shadow-black/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="tracking-widest uppercase">THE BIG PITCH · STAGE CELEBRATION</span>
          </div>

          {/* Right: Quick Stage Actions */}
          <div className="flex items-center gap-2">
            {/* Confetti Cannon Re-fire */}
            <button
              onClick={fireConfettiBarrage}
              title="Fire Confetti Cannons"
              className="p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-300 transition-all active:scale-95 shadow-md flex items-center gap-1.5 text-xs font-bold font-mono"
            >
              <PartyPopper size={16} />
              <span className="hidden sm:inline">Blast Confetti</span>
            </button>

            {/* Audio Mute/Unmute */}
            <button
              onClick={() => {
                if (!muted && audioRef.current) {
                  audioRef.current.pause()
                } else if (muted && audioRef.current) {
                  audioRef.current.play().catch(() => {})
                }
                setMuted(!muted)
              }}
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
              className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95 shadow-md"
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} className="text-amber-400" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              title="Toggle Stage Fullscreen (Double-click background to exit anytime)"
              className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95 shadow-md"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Dismiss / Return to Screen */}
            {onDismiss && (
              <button
                onClick={onDismiss}
                title="Return to Regular Stage Display"
                className="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 transition-all active:scale-95 shadow-md ml-1"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </header>
      )}

      {/* ── 3. HERO CENTERPIECE: AVATAR & GRAND CHAMPION ── */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6 text-center max-w-4xl mx-auto w-full my-auto">
        {/* Championship Banner — no background, no border */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-amber-300 font-mono font-black text-sm sm:text-lg md:text-xl tracking-[0.3em] uppercase mb-8 sm:mb-10"
        >
          #1 Tournament Grand Champion
        </motion.div>

        {/* Center Winner Avatar */}
        <div className="relative my-2 sm:my-4">

          {/* 3D Multi-Layer Concentric Bezel Ring */}
          <div className="relative p-3 sm:p-4 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-300 to-amber-500 shadow-[0_0_100px_rgba(245,158,11,0.65),0_20px_50px_rgba(0,0,0,0.9)]">
            {/* Inner Glare Ring */}
            <div className="p-1 rounded-full bg-[#09090B] relative overflow-hidden">
              <Avatar
                name={winner.name}
                src={winner.avatarUrl}
                size="3xl"
                className="w-48 h-48 sm:w-64 sm:h-64 md:w-76 md:h-76 text-5xl sm:text-7xl md:text-8xl font-black border-4 sm:border-8 border-white shadow-2xl bg-zinc-950 relative z-10"
              />

              {/* Shimmering Glare Sweep passing over photo */}
              <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-r from-transparent via-white/40 to-transparent w-full h-full transform -skew-x-12 animate-gold-sheen" />
            </div>



          </div>
        </div>

        {/* Winner Grand Display Name */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4 mt-6 sm:mt-8"
        >
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight bg-gradient-to-b from-white via-amber-100 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_8px_30px_rgba(0,0,0,0.95)]">
            {winner.name}
          </h1>

          {/* Supported Startup Glass Pill */}
          {winner.teamName && (
            <div className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-amber-500/30 text-amber-200/90 text-sm sm:text-base font-bold shadow-lg">
              {winner.startupLogoUrl ? (
                <img
                  src={winner.startupLogoUrl}
                  alt={winner.teamName}
                  className="w-6 h-6 rounded-md object-contain bg-white p-0.5"
                />
              ) : (
                <div className="w-6 h-6 rounded-md bg-amber-500 text-zinc-950 flex items-center justify-center font-mono font-black text-xs">
                  {winner.teamName[0]}
                </div>
              )}
              <span>
                Backed Startup: <strong className="text-white underline decoration-amber-400 underline-offset-4">{winner.teamName}</strong>
              </span>
              {winner.category && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono">
                  {winner.category}
                </span>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* ── 4. STAGE FOOTER PROMPT — HIDDEN IN FULLSCREEN ── */}
      {!isFullscreen && (
        <footer className="relative z-30 w-full px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 border-t border-zinc-900 bg-zinc-950/60 backdrop-blur-sm gap-2 transition-opacity duration-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-amber-400" />
            <span>Official Stage Record · Server Verified</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fireConfettiBarrage}
              className="text-amber-300 hover:text-white font-mono font-bold transition-colors"
            >
              Launch Cannons 🎉
            </button>
            <span>·</span>
            <span>Click celebrate button in Stage Control to exit</span>
          </div>
        </footer>
      )}
    </div>
  )
}
