// ============================================================
// CelebrationPage.tsx — Dedicated Standalone Live Winner Stage
// Direct projector & auditorium cast URL: /celebrate
// Features searchlights, sunburst, double confetti cannons,
// audio fanfare, 3D laurel wreath and interactive demo preview.
// ============================================================

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getWinnerCelebrationState,
  STAGE_CELEBRATION_EVENT,
  STAGE_CELEBRATION_STORAGE_KEY,
  type WinnerCelebrationPayload,
} from '@/lib/realtimeSync'
import { GrandWinnerCelebration } from '@/components/stage/GrandWinnerCelebration'
import { Button } from '@/components/ui'
import { Trophy, ArrowLeft, Radio, Sparkles } from 'lucide-react'

export function CelebrationPage() {
  const [celebration, setCelebration] = useState<WinnerCelebrationPayload | null>(() => {
    return getWinnerCelebrationState()
  })

  // Listen to stage celebration events & storage sync
  useEffect(() => {
    const handleCelebration = (e: any) => {
      if (e.detail) {
        setCelebration(e.detail)
      }
    }
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STAGE_CELEBRATION_STORAGE_KEY) {
        setCelebration(getWinnerCelebrationState())
      }
    }

    window.addEventListener(STAGE_CELEBRATION_EVENT, handleCelebration)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(STAGE_CELEBRATION_EVENT, handleCelebration)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Interactive local demo test helper
  const handleLaunchDemo = () => {
    setCelebration({
      active: true,
      winner: {
        userId: 'demo-champion-1',
        name: 'Ved Narasalagi',
        avatarUrl: undefined,
        amount: 500,
        rank: 1,
        teamName: 'NeuroPulse AI',
        timeElapsedMs: 1240,
        category: 'HealthTech & AI',
      },
      timestamp: Date.now(),
    })
  }

  if (celebration?.active && celebration.winner) {
    return (
      <GrandWinnerCelebration
        celebration={celebration}
        onDismiss={() => setCelebration({ active: false, winner: null, timestamp: Date.now() })}
        isStandalone={true}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between p-6 sm:p-10 select-none">
      <header className="flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs font-mono font-bold"
        >
          <ArrowLeft size={16} />
          <span>BACK TO MAIN ARENA</span>
        </Link>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>PROJECTOR STANDBY SCREEN</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto text-center space-y-6 my-auto">
        <div className="w-24 h-24 rounded-3xl bg-zinc-900/90 border-2 border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(245,158,11,0.2)]">
          <Trophy size={48} className="animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Grand Celebration Screen
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            This screen automatically bursts into celebration when triggered from the live stage control desk. Keep this URL open on your stage projector.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            onClick={handleLaunchDemo}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-black text-sm py-3 px-6 shadow-[0_0_30px_rgba(245,158,11,0.4)]"
            icon={<Sparkles size={16} />}
          >
            Preview Grand Celebration Demo
          </Button>
          <Link to="/admin">
            <Button variant="secondary" className="w-full sm:w-auto text-xs py-3">
              Go to Admin Stage Control
            </Button>
          </Link>
        </div>
      </main>

      <footer className="text-center text-xs text-zinc-600 font-mono">
        THE BIG PITCH · STAGE AUDITORIUM CELEBRATION SYSTEM
      </footer>
    </div>
  )
}
