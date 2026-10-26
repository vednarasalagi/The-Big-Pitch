// ============================================================
// GrandWinnerCelebration.tsx — World-Class Tournament Winner Stage
// Electrifying cinematic celebration with searchlights, sunburst,
// multi-cannon confetti, laurel wreath, audio fanfare & luxury stats.
// ============================================================

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  Crown, Trophy, Sparkles, Zap, Volume2, VolumeX,
  Maximize2, Minimize2, X, Flame, Shield, ArrowUpRight,
  PartyPopper
} from 'lucide-react'
import { Avatar } from '@/components/ui'
import { formatPoints, formatExactMs } from '@/lib/utils'
import {
  type WinnerCelebrationPayload,
  playCelebrationFanfare,
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pointsCount, setPointsCount] = useState(0)
  const confettiIntervalRef = useRef<any>(null)
  const winner = celebration?.winner

  // Fire multi-stage confetti cannons
  const fireConfettiBarrage = useCallback(() => {
    // 1. Left corner high-velocity cannon
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 65,
      origin: { x: 0, y: 0.85 },
      colors: ['#F59E0B', '#FEF08A', '#FCD34D', '#FFFFFF', '#D97706', '#38BDF8'],
      zIndex: 10000,
    })

    // 2. Right corner high-velocity cannon
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 65,
      origin: { x: 1, y: 0.85 },
      colors: ['#F59E0B', '#FEF08A', '#FCD34D', '#FFFFFF', '#D97706', '#38BDF8'],
      zIndex: 10000,
    })

    // 3. Center shower with stars and ribbons
    confetti({
      particleCount: 45,
      spread: 100,
      origin: { x: 0.5, y: 0.35 },
      shapes: ['star', 'circle'],
      colors: ['#FEF08A', '#F59E0B', '#FFFFFF'],
      scalar: 1.2,
      zIndex: 10000,
    })
  }, [])

  // Initial trigger: sound & confetti cannons
  useEffect(() => {
    if (!celebration?.active || !winner) return

    if (!muted) {
      playCelebrationFanfare()
    }

    // Initial cannon blast
    fireConfettiBarrage()
    const timer2 = setTimeout(fireConfettiBarrage, 800)
    const timer3 = setTimeout(fireConfettiBarrage, 2200)

    // Gentle recurring ambient glitter confetti
    confettiIntervalRef.current = setInterval(() => {
      confetti({
        particleCount: 15,
        spread: 80,
        origin: { x: Math.random() * 0.6 + 0.2, y: 0.1 },
        colors: ['#F59E0B', '#FEF08A', '#FFFFFF'],
        gravity: 0.8,
        scalar: 0.9,
        zIndex: 10000,
      })
    }, 3800)

    return () => {
      clearTimeout(timer2)
      clearTimeout(timer3)
      if (confettiIntervalRef.current) clearInterval(confettiIntervalRef.current)
    }
  }, [celebration?.active, celebration?.timestamp, winner?.name, fireConfettiBarrage, muted])

  // Count-up animation for points backed
  useEffect(() => {
    if (!winner?.amount) {
      setPointsCount(0)
      return
    }

    const target = winner.amount
    const duration = 1200 // ms
    const startTime = performance.now()

    const animateCount = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      setPointsCount(Math.round(target * easeProgress))

      if (progress < 1) {
        requestAnimationFrame(animateCount)
      }
    }

    requestAnimationFrame(animateCount)
  }, [winner?.amount, celebration?.timestamp])

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
    <div className="fixed inset-0 z-[9999] bg-[#050507] text-white flex flex-col justify-between overflow-hidden select-none">
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

        {/* Ambient Pulsating Golden Glow Halo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] md:w-[850px] md:h-[850px] rounded-full bg-gradient-to-tr from-amber-500/35 via-yellow-400/25 to-amber-600/20 blur-[130px] animate-pulse" />

        {/* Celestial Orbital Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] md:w-[600px] md:h-[600px] rounded-full border-2 border-amber-400/25 border-dashed animate-spin-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] md:w-[760px] md:h-[760px] rounded-full border border-amber-300/15 animate-spin-reverse" />
      </div>

      {/* ── 2. STAGE OPERATOR FLOATING HUD BAR (TOP) ── */}
      <header className="relative z-30 w-full px-6 py-4 flex items-center justify-between">
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
            onClick={() => setMuted(!muted)}
            title={muted ? 'Unmute Fanfare' : 'Mute Audio'}
            className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95 shadow-md"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} className="text-amber-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Stage Fullscreen"
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

      {/* ── 3. HERO CENTERPIECE: CROWN, AVATAR & LAUREL WREATH ── */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-2 text-center max-w-4xl mx-auto w-full">
        {/* Animated Championship Crest Banner */}
        <motion.div
          initial={{ y: -25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-6 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/30 to-amber-500/20 border-2 border-amber-400/60 text-amber-200 font-mono font-black text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_30px_rgba(245,158,11,0.4)] mb-4"
        >
          <Crown size={18} className="text-amber-400 fill-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.8)]" />
          <span>#1 TOURNAMENT GRAND CHAMPION</span>
          <Crown size={18} className="text-amber-400 fill-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.8)]" />
        </motion.div>

        {/* Center Winner Avatar with 3D Ring, Laurel Wreath & Crown */}
        <div className="relative my-2 sm:my-3">
          {/* Floating Royal Crown */}
          <motion.div
            animate={{ y: [-6, 6, -6], rotate: [-2, 2, -2] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="relative">
              <Crown
                size={64}
                className="text-amber-400 fill-amber-300 drop-shadow-[0_8px_32px_rgba(251,191,36,0.95)] sm:w-20 sm:h-20"
              />
              <Sparkles size={20} className="absolute -top-1 -right-2 text-yellow-200 animate-ping" />
            </div>
          </motion.div>

          {/* 3D Multi-Layer Concentric Bezel Ring */}
          <div className="relative p-3 sm:p-4 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-300 to-amber-500 shadow-[0_0_100px_rgba(245,158,11,0.65),0_20px_50px_rgba(0,0,0,0.9)]">
            {/* Inner Glare Ring */}
            <div className="p-1 rounded-full bg-[#09090B] relative overflow-hidden">
              <Avatar
                name={winner.name}
                src={winner.avatarUrl}
                size="3xl"
                className="w-44 h-44 sm:w-60 sm:h-60 md:w-68 md:h-68 text-5xl sm:text-7xl font-black border-4 sm:border-8 border-white shadow-2xl bg-zinc-950 relative z-10"
              />

              {/* Shimmering Glare Sweep passing over photo */}
              <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-r from-transparent via-white/40 to-transparent w-full h-full transform -skew-x-12 animate-gold-sheen" />
            </div>

            {/* Victory Laurel Wreath (SVG) wrapping around bottom */}
            <div className="absolute -bottom-6 -left-6 -right-6 pointer-events-none z-20 flex justify-center">
              <svg viewBox="0 0 260 90" className="w-[125%] h-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                <defs>
                  <linearGradient id="laurelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FEF08A" />
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#B45309" />
                  </linearGradient>
                </defs>
                {/* Left Branch */}
                <path
                  d="M 50 20 C 35 45 45 75 90 85 C 75 80 65 65 70 50 Z"
                  fill="url(#laurelGrad)"
                />
                <circle cx="50" cy="25" r="4.5" fill="#FEF08A" />
                <circle cx="60" cy="40" r="5" fill="#F59E0B" />
                <circle cx="75" cy="60" r="5.5" fill="#FEF08A" />
                {/* Right Branch */}
                <path
                  d="M 210 20 C 225 45 215 75 170 85 C 185 80 195 65 190 50 Z"
                  fill="url(#laurelGrad)"
                />
                <circle cx="210" cy="25" r="4.5" fill="#FEF08A" />
                <circle cx="200" cy="40" r="5" fill="#F59E0B" />
                <circle cx="185" cy="60" r="5.5" fill="#FEF08A" />
              </svg>
            </div>

            {/* Stamped #1 Championship Seal Medal Badge at Bottom Right */}
            <div className="absolute -bottom-2 -right-2 sm:-bottom-3 sm:-right-3 z-30">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-200 to-amber-500 p-1 shadow-2xl border-2 border-white flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-gradient-to-b from-yellow-300 to-amber-600 flex flex-col items-center justify-center text-zinc-950 font-black font-mono shadow-inner border border-amber-700">
                  <span className="text-[10px] sm:text-xs leading-none">RANK</span>
                  <span className="text-xl sm:text-2xl leading-none font-black drop-shadow-sm">#1</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Winner Grand Display Name */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-1.5 mt-2"
        >
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight bg-gradient-to-b from-white via-amber-100 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_8px_30px_rgba(0,0,0,0.95)]">
            {winner.name}
          </h1>

          {/* Supported Startup Glass Pill */}
          {winner.teamName && (
            <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-amber-500/30 text-amber-200/90 text-sm sm:text-base font-bold shadow-lg">
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
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono">
                  {winner.category}
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* ── 4. TRIPLE LUXURY METRIC TROPHY PODS ── */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-3xl mt-5"
        >
          {/* POD 1: CAPITAL DEPLOYED */}
          <div className="relative p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl border border-amber-500/40 shadow-[0_8px_24px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] text-center group hover:border-amber-400 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto mb-2 shadow-inner">
              <Trophy size={18} />
            </div>
            <p className="text-[10px] font-mono font-bold text-amber-300/80 uppercase tracking-widest">
              Capital Deployed
            </p>
            <p className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
              {formatPoints(pointsCount)} <span className="text-xs text-amber-400 font-bold">PTS</span>
            </p>
            <span className="inline-block mt-1 text-[10px] text-zinc-400">
              Highest Stage Investment
            </span>
          </div>

          {/* POD 2: SPEED FACTOR */}
          <div className="relative p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl border border-amber-500/40 shadow-[0_8px_24px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] text-center group hover:border-amber-400 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto mb-2 shadow-inner">
              <Zap size={18} />
            </div>
            <p className="text-[10px] font-mono font-bold text-amber-300/80 uppercase tracking-widest">
              Reaction Speed Factor
            </p>
            <p className="text-2xl sm:text-3xl font-black font-mono text-amber-300 mt-1">
              {winner.timeElapsedMs ? formatExactMs(winner.timeElapsedMs) : 'Instant'}
            </p>
            <span className="inline-block mt-1 text-[10px] text-zinc-400">
              Speed Tie-Breaker Metric
            </span>
          </div>

          {/* POD 3: TOURNAMENT STANDING */}
          <div className="relative p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl border border-amber-500/40 shadow-[0_8px_24px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] text-center group hover:border-amber-400 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto mb-2 shadow-inner">
              <Crown size={18} />
            </div>
            <p className="text-[10px] font-mono font-bold text-amber-300/80 uppercase tracking-widest">
              Arena Standing
            </p>
            <p className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
              1<sup className="text-xs text-amber-400 font-bold">st</sup> Place
            </p>
            <span className="inline-block mt-1 text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Audience Champion
            </span>
          </div>
        </motion.div>
      </main>

      {/* ── 5. STAGE FOOTER PROMPT ── */}
      <footer className="relative z-30 w-full px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 border-t border-zinc-900 bg-zinc-950/60 backdrop-blur-sm gap-2">
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
    </div>
  )
}
