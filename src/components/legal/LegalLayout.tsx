// ============================================================
// LegalLayout.tsx — Simple, Professional 2-Page Legal Layout
// High-contrast, clean minimalist layout with only Terms and Privacy
// ============================================================

import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LegalLayoutProps {
  title: string
  subtitle: string
  lastUpdated?: string
  children: React.ReactNode
}

export function LegalLayout({
  title,
  subtitle,
  lastUpdated = 'October 19, 2026',
  children,
}: LegalLayoutProps) {
  const location = useLocation()
  const isTerms = location.pathname.startsWith('/terms') || location.pathname.includes('refund') || location.pathname.includes('shipping') || location.pathname.includes('contact')
  const isPrivacy = location.pathname.startsWith('/privacy')

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-20">
      {/* Minimal Top Header */}
      <header className="bg-white border-b border-zinc-200/90 pt-8 pb-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-950 font-medium transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to The Big Pitch</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                The Big Pitch • Legal & Compliance
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1 max-w-xl">
                {subtitle}
              </p>
            </div>

            <div className="text-xs text-zinc-400 font-mono">
              Last updated: {lastUpdated}
            </div>
          </div>

          {/* Simple 2-Page Navigation Toggle */}
          <div className="pt-2 flex items-center gap-2">
            <Link
              to="/terms"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border',
                isTerms
                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                  : 'bg-zinc-50 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 border-zinc-200'
              )}
            >
              <FileText size={14} />
              <span>Terms & Conditions</span>
            </Link>

            <Link
              to="/privacy"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border',
                isPrivacy
                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                  : 'bg-zinc-50 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 border-zinc-200'
              )}
            >
              <ShieldCheck size={14} />
              <span>Privacy Policy</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Single Column Article (Ultra-Clean, Professional Reading Experience) */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <article className="bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8 text-zinc-700 leading-relaxed text-sm">
          {children}
        </article>
      </main>
    </div>
  )
}
