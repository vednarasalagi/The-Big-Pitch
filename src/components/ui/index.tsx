// ============================================================
// Reusable UI Components — Pitch Arena Design System
// ============================================================

import { cn } from '@/lib/utils'
import { forwardRef, type HTMLAttributes, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'

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
        'glass-card',
        hover && 'glass-card-hover cursor-pointer',
        glow === 'blue' && 'shadow-glow-blue border-arena-blue/30',
        glow === 'violet' && 'shadow-glow-violet border-arena-violet/30',
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
      primary:   'btn-primary',
      secondary: 'btn-secondary',
      ghost:     'btn-ghost',
      danger:    'btn-danger',
    }[variant]

    const sizeClass = {
      sm: 'text-xs px-4 py-1.5',
      md: '',
      lg: 'text-base px-8 py-3',
    }[size]

    return (
      <button
        ref={ref}
        className={cn(variantClass, sizeClass, className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            {children}
          </span>
        ) : (
          <span className="flex items-center gap-2">
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
type BadgeVariant = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
}

export const Badge = ({ variant = 'blue', dot, children, className, ...props }: BadgeProps) => (
  <span className={cn(`badge-${variant}`, className)} {...props}>
    {dot && <span className={cn('w-1.5 h-1.5 rounded-full',
      variant === 'blue' && 'bg-arena-blue-3',
      variant === 'violet' && 'bg-arena-violet-3',
      variant === 'emerald' && 'bg-emerald-400',
      variant === 'amber' && 'bg-amber-400',
      variant === 'rose' && 'bg-rose-400',
      variant === 'cyan' && 'bg-cyan-400',
    )} />}
    {children}
  </span>
)

// ── Status Badge ──────────────────────────────────────────
const statusConfig = {
  not_started:       { label: 'Not Started',        variant: 'cyan'    as BadgeVariant },
  upcoming:          { label: 'Upcoming',            variant: 'blue'    as BadgeVariant },
  announced:         { label: 'Announced',           variant: 'violet'  as BadgeVariant },
  investment_open:   { label: 'Investing Open',      variant: 'emerald' as BadgeVariant },
  investment_paused: { label: 'Paused',              variant: 'amber'   as BadgeVariant },
  investment_closed: { label: 'Investing Closed',    variant: 'rose'    as BadgeVariant },
  results_published: { label: 'Results Published',   variant: 'violet'  as BadgeVariant },
  completed:         { label: 'Completed',           variant: 'cyan'    as BadgeVariant },
  active:            { label: 'Live Now',            variant: 'emerald' as BadgeVariant },
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
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-xl' }

export const Avatar = ({ src, name, size = 'md', className }: AvatarProps) => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className={cn('rounded-full flex items-center justify-center font-bold bg-gradient-to-br from-arena-blue to-arena-violet text-white flex-shrink-0', sizeMap[size], className)}>
      {src ? <img src={src} alt={name} className="w-full h-full rounded-full object-cover" /> : initials}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('skeleton h-4 w-full', className)} />
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

const colorMap = {
  blue:    'text-arena-blue-3',
  violet:  'text-arena-violet-3',
  emerald: 'text-emerald-400',
  amber:   'text-amber-400',
  rose:    'text-rose-400',
  cyan:    'text-cyan-400',
}

export const StatCard = ({ label, value, subtext, icon, trend, trendValue, color = 'blue', className }: StatCardProps) => (
  <Card className={cn('p-5', className)}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
        <p className={cn('text-2xl font-bold', colorMap[color])}>{value}</p>
        {subtext && <p className="text-white/40 text-xs mt-1">{subtext}</p>}
        {trend && trendValue && (
          <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium',
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-white/40'
          )}>
            {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : <Minus size={12} />}
            {trendValue}
          </div>
        )}
      </div>
      {icon && (
        <div className={cn('p-2.5 rounded-xl', `bg-${color === 'blue' ? 'arena-blue' : color === 'violet' ? 'arena-violet' : color}-500/10`, colorMap[color])}>
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

export const ProgressBar = ({ value, max = 100, color = 'blue', size = 'md', showLabel, label, className }: ProgressBarProps) => {
  const pct = Math.min(100, (value / max) * 100)
  const gradients = {
    blue:    'from-arena-blue to-arena-violet',
    violet:  'from-arena-violet to-arena-violet-3',
    emerald: 'from-emerald-600 to-emerald-400',
    amber:   'from-amber-600 to-amber-400',
    rose:    'from-rose-600 to-rose-400',
  }
  return (
    <div className={cn('space-y-1', className)}>
      {(showLabel || label) && (
        <div className="flex justify-between text-xs text-white/50">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className={cn('w-full rounded-full bg-white/[0.06]', size === 'sm' ? 'h-1.5' : 'h-2.5')}>
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out', gradients[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────
export const Divider = ({ className }: { className?: string }) => (
  <div className={cn('h-px w-full bg-white/[0.08]', className)} />
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
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
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
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    {icon && <div className="text-white/20 mb-4 text-5xl">{icon}</div>}
    <h3 className="text-white/70 font-semibold text-base mb-2">{title}</h3>
    {description && <p className="text-white/40 text-sm max-w-xs">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
)

// ── Live Indicator ────────────────────────────────────────
export const LiveIndicator = ({ label = 'LIVE', className }: { label?: string; className?: string }) => (
  <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/20 border border-rose-500/40 rounded-full text-rose-400 text-xs font-bold', className)}>
    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
    {label}
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
    sm: 'text-xl font-bold',
    md: 'text-3xl font-bold',
    lg: 'text-5xl font-bold',
    xl: 'text-7xl font-bold',
  }

  return (
    <div className={cn(
      'font-mono tabular-nums transition-colors duration-300',
      sizeClasses[size],
      isUrgent ? 'text-rose-400 animate-pulse' : 'text-white',
      className
    )}>
      {m}:{s.toString().padStart(2, '0')}
    </div>
  )
}
