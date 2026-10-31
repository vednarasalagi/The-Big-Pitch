// ============================================================
// BrandLogo — Bespoke, Minimalist Geometric Emblem for The Big Pitch
// Unique architectural design: Intersecting venture stage angles
// ============================================================

import { cn } from '@/lib/utils'

interface BrandLogoProps {
  size?: number
  showText?: boolean
  className?: string
  subtitle?: string
}

export function BrandLogo({ size = 28, showText = true, className, subtitle }: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5 select-none min-w-0', className)}>
      {/* Unique Geometric Emblem */}
      <div
        className="flex items-center justify-center rounded-xl bg-zinc-950 text-white shadow-sm flex-shrink-0"
        style={{ width: size + 8, height: size + 8 }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Architectural Stage & Venture Apex Mark */}
          <path
            d="M6 22L16 6L26 22H6Z"
            stroke="white"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M11 22L16 14L21 22"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
            opacity="0.6"
          />
          <circle cx="16" cy="11" r="1.75" fill="white" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none min-w-0">
          <span className="font-black text-sm tracking-tight text-zinc-900 font-sans truncate">
            THE BIG PITCH
          </span>
          <span className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase mt-0.5 truncate">
            {subtitle || 'Audience Edition'}
          </span>
        </div>
      )}
    </div>
  )
}
