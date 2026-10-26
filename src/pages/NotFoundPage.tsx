// ============================================================
// NotFoundPage.tsx — 404 Page Not Found
// Clean, tactile skeuomorphic design for missing or restricted routes.
// ============================================================

import { Link } from 'react-router-dom'
import { Home, Radio, Trophy, Search } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-7 text-center animate-fade-in">
        {/* Recessed Icon Well */}
        <div className="w-20 h-20 rounded-3xl skeuo-sunken mx-auto flex items-center justify-center text-zinc-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.9)]">
          <Search size={36} className="text-zinc-700" />
        </div>

        {/* 404 Badge and Heading */}
        <div className="space-y-3">
          <span className="skeuo-token px-3.5 py-1 rounded-full text-xs font-mono font-bold text-zinc-700 uppercase tracking-widest inline-block">
            HTTP 404 · Page Not Found
          </span>
          <h1 className="text-6xl sm:text-7xl font-black text-zinc-950 tracking-tighter font-mono">
            404
          </h1>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            We couldn't find this page
          </h2>
          <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">
            The page you requested does not exist, has been removed, or is not accessible.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto">
          <Link
            to="/"
            className="skeuo-btn-primary w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white"
          >
            <Home size={16} />
            <span>Return to Arena</span>
          </Link>

          <Link
            to="/live"
            className="skeuo-btn-secondary w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-zinc-900"
          >
            <Radio size={16} className="text-emerald-600" />
            <span>Live Pitch</span>
          </Link>

          <Link
            to="/scoreboard"
            className="skeuo-btn-secondary w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-zinc-900"
          >
            <Trophy size={16} className="text-amber-500" />
            <span>Standings</span>
          </Link>
        </div>

        <p className="text-zinc-400 text-xs pt-4 font-medium">
          THE BIG PITCH · Live Pitch Arena
        </p>
      </div>
    </div>
  )
}
