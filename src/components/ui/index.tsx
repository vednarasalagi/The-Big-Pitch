// ============================================================
// Reusable UI Components — The Big Pitch Minimalist Design System
// High contrast black & white, crisp 1px borders, typography first
// ============================================================

import { cn } from '@/lib/utils'
import { forwardRef, useState, type HTMLAttributes, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export { BrandLogo } from './BrandLogo'

// ── Card ──────────────────────────────────────────────────
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: 'blue' | 'violet' | 'none'
  hover?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow = 'none', hover = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'skeuo-surface rounded-2xl text-zinc-900',
        hover && 'skeuo-surface-interactive cursor-pointer',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

// ── Button ────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const variantClass = {
      primary:   'skeuo-btn-primary font-bold rounded-xl',
      secondary: 'skeuo-btn-secondary font-bold rounded-xl',
      ghost:     'btn-ghost',
      danger:    'btn-danger',
    }[variant]

    const sizeClass = {
      sm: 'text-xs px-3.5 py-1.5 rounded-lg',
      md: 'px-5 py-2.5 text-sm',
      lg: 'text-base px-6 py-3.5',
    }[size]

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-sans tracking-tight select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none',
          variantClass,
          sizeClass,
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            {children}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            {icon}
            {children}
          </span>
        )}
      </button>
    )
  }
)
Button.displayName = 'Button'

// ── Input ─────────────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn('arena-input', className)} {...props} />
  )
)
Input.displayName = 'Input'

// ── Badge ─────────────────────────────────────────────────
export type BadgeVariant = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
}

export const Badge = ({ variant = 'blue', dot, children, className, ...props }: BadgeProps) => (
  <span className={cn(`badge-${variant}`, className)} {...props}>
    {dot && (
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          variant === 'emerald' && 'bg-emerald-500 animate-pulse',
          variant === 'amber' && 'bg-amber-500',
          variant === 'rose' && 'bg-rose-500',
          variant === 'blue' && 'bg-zinc-600',
          variant === 'violet' && 'bg-zinc-950',
          variant === 'cyan' && 'bg-sky-500'
        )}
      />
    )}
    {children}
  </span>
)

// ── Status Badge ──────────────────────────────────────────
const statusConfig = {
  not_started:       { label: 'Not Started',        variant: 'cyan'    as BadgeVariant },
  upcoming:          { label: 'Upcoming',            variant: 'blue'    as BadgeVariant },
  announced:         { label: 'Announced',           variant: 'violet'  as BadgeVariant },
  investment_open:   { label: 'Live Now',            variant: 'emerald' as BadgeVariant },
  investment_paused: { label: 'Paused',              variant: 'amber'   as BadgeVariant },
  investment_closed: { label: 'Scoring Closed',      variant: 'rose'    as BadgeVariant },
  results_published: { label: 'Results Published',   variant: 'violet'  as BadgeVariant },
  completed:         { label: 'Completed',           variant: 'blue'    as BadgeVariant },
  active:            { label: 'Live Pitching',       variant: 'emerald' as BadgeVariant },
  closed:            { label: 'Closed',              variant: 'rose'    as BadgeVariant },
  scheduled:         { label: 'Scheduled',           variant: 'blue'    as BadgeVariant },
}

export const StatusBadge = ({ status }: { status: string }) => {
  const cfg = statusConfig[status as keyof typeof statusConfig] ?? { label: status, variant: 'blue' as BadgeVariant }
  return (
    <Badge variant={cfg.variant} dot>
      {cfg.label}
    </Badge>
  )
}

// ── Avatar ────────────────────────────────────────────────
interface AvatarProps {
  src?: string
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  className?: string
}

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
  '2xl': 'w-18 h-18 text-xl',
  '3xl': 'w-24 h-24 text-2xl',
}

export const Avatar = ({ src, name, size = 'md', className }: AvatarProps) => {
  const [imageError, setImageError] = useState(false)
  const initials = (name || 'User')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold bg-zinc-900 text-white flex-shrink-0 border border-zinc-200 shadow-sm overflow-hidden select-none',
        sizeMap[size] || sizeMap.md,
        className
      )}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full rounded-full object-cover"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('skeleton h-4 w-full bg-zinc-100', className)} />
)

export const SkeletonCard = () => (
  <Card className="p-5 space-y-3">
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-3 w-2/3" />
    <Skeleton className="h-3 w-1/2" />
  </Card>
)

// ── Stat Card ─────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan'
  className?: string
}

export const StatCard = ({ label, value, subtext, icon, trend, trendValue, className }: StatCardProps) => (
  <Card className={cn('p-5 skeuo-surface', className)}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1.5">{label}</p>
        <p className="text-3xl font-extrabold text-zinc-900 font-mono tracking-tight">{value}</p>
        {subtext && <p className="text-zinc-500 text-xs mt-1">{subtext}</p>}
        {trend && trendValue && (
          <div className={cn(
            'flex items-center gap-1 mt-2 text-xs font-semibold',
            trend === 'up' ? 'text-emerald-700' : trend === 'down' ? 'text-rose-700' : 'text-zinc-500'
          )}>
            {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : <Minus size={12} />}
            {trendValue}
          </div>
        )}
      </div>
      {icon && (
        <div className="skeuo-token p-2.5 rounded-xl text-zinc-800 flex-shrink-0">
          {icon}
        </div>
      )}
    </div>
  </Card>
)

// ── Progress Bar ──────────────────────────────────────────
interface ProgressBarProps {
  value: number
  max?: number
  color?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose'
  size?: 'sm' | 'md'
  showLabel?: boolean
  label?: string
  className?: string
}

export const ProgressBar = ({ value, max = 100, size = 'md', showLabel, label, className }: ProgressBarProps) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={cn('space-y-1.5', className)}>
      {(showLabel || label) && (
        <div className="flex justify-between text-xs text-zinc-500 font-medium">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className={cn('w-full rounded-full skeuo-meter-track overflow-hidden p-[1px]', size === 'sm' ? 'h-2' : 'h-3')}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-zinc-800 to-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────
export const Divider = ({ className }: { className?: string }) => (
  <div className={cn('h-px w-full bg-zinc-200', className)} />
)

// ── Section Header ────────────────────────────────────────
interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export const SectionHeader = ({ title, subtitle, action, className }: SectionHeaderProps) => (
  <div className={cn('flex items-start justify-between gap-4', className)}>
    <div>
      <h2 className="text-xl font-bold text-zinc-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
)

// ── Empty State ───────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="skeuo-surface flex flex-col items-center justify-center py-12 px-6 text-center rounded-2xl max-w-lg mx-auto my-6">
    {icon && (
      <div className="skeuo-token w-14 h-14 flex items-center justify-center text-zinc-700 mb-4">
        {icon}
      </div>
    )}
    <h3 className="text-zinc-950 font-black text-lg mb-1.5 skeuo-text-emboss">{title}</h3>
    {description && <p className="text-zinc-600 text-xs sm:text-sm max-w-sm leading-relaxed">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
)

// ── Live Indicator ────────────────────────────────────────
export const LiveIndicator = ({ label = 'LIVE PITCH', className }: { label?: string; className?: string }) => (
  <span className={cn('inline-flex items-center gap-2 px-3 py-1 bg-white border border-emerald-300 rounded-full text-emerald-950 text-xs font-bold tracking-wide shadow-[inset_0_1px_0_#FFF,0_2px_4px_rgba(16,185,129,0.1)]', className)}>
    <span className="skeuo-led-bezel">
      <span className="skeuo-led-emerald animate-pulse" />
    </span>
    <span className="tracking-wide font-extrabold text-[11px] uppercase">{label}</span>
  </span>
)

// ── Countdown Timer ───────────────────────────────────────
interface CountdownProps {
  seconds: number
  urgent?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export const Countdown = ({ seconds, urgent, size = 'md', className }: CountdownProps) => {
  const m = Math.floor(Math.max(0, seconds) / 60)
  const s = Math.max(0, seconds) % 60
  const isUrgent = urgent || seconds <= 30

  const sizeClasses = {
    sm: 'text-lg font-bold',
    md: 'text-3xl font-extrabold',
    lg: 'text-5xl font-black',
    xl: 'text-7xl font-black',
  }

  return (
    <div className={cn(
      'font-mono tabular-nums tracking-tight',
      sizeClasses[size],
      isUrgent ? 'text-rose-600 animate-pulse' : 'text-zinc-900',
      className
    )}>
      {m}:{s.toString().padStart(2, '0')}
    </div>
  )
}
