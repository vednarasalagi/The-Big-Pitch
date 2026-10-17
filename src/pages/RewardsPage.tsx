// ============================================================
// Rewards Page — Badges, gamification, QR claim codes
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Trophy, Star, Zap, CheckCircle2, QrCode, Clock, Lock, Users, TrendingUp } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuthStore, useWalletStore, useEventStore } from '@/store'
import { Card, Button, Badge, EmptyState, SectionHeader } from '@/components/ui'
import { formatPoints } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { Reward } from '@/types'
import { getTopInvestors, claimRewardInDb, type TopInvestor } from '@/lib/supabaseApi'

const BADGE_CONFIG: Record<string, { icon: string; color: string; gradient: string }> = {
  early_backer:  { icon: '⚡', color: 'text-amber-400',   gradient: 'from-amber-500/30 to-yellow-500/30' },
  top_investor:  { icon: '🏆', color: 'text-yellow-300',  gradient: 'from-yellow-500/30 to-amber-500/30' },
  idea_hunter:   { icon: '🎯', color: 'text-arena-violet-3', gradient: 'from-arena-violet/30 to-purple-500/30' },
  most_unique:   { icon: '💎', color: 'text-cyan-400',    gradient: 'from-cyan-500/30 to-blue-500/30' },
  backed_winner: { icon: '🚀', color: 'text-emerald-400', gradient: 'from-emerald-500/30 to-green-500/30' },
}

function RewardCard({ reward }: { reward: Reward }) {
  const [showQR, setShowQR] = useState(false)
  const [claimed, setClaimed] = useState(reward.claimed)
  const cfg = BADGE_CONFIG[reward.badgeType] ?? BADGE_CONFIG.early_backer

  const handleClaim = async () => {
    setClaimed(true)
    setShowQR(true)
    await claimRewardInDb(reward.id)
  }

  return (
    <Card className={`overflow-hidden ${claimed ? 'opacity-75' : ''}`}>
      <div className={`p-5 bg-gradient-to-br ${cfg.gradient}`}>
        <div className="flex items-start gap-4">
          <div className="text-4xl flex-shrink-0">{cfg.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-white font-bold text-base">{reward.badgeType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h3>
              {claimed && <Badge variant="emerald" dot>Claimed</Badge>}
            </div>
            <p className="text-white/70 text-sm">{reward.description}</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {!claimed ? (
          <Button onClick={handleClaim} className="w-full justify-center" icon={<QrCode size={14} />}>
            Claim Reward
          </Button>
        ) : showQR ? (
          <div className="text-center space-y-3">
            <p className="text-emerald-400 text-sm font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 size={14} /> Show this QR to claim your prize
            </p>
            <div className="p-4 bg-white rounded-2xl inline-block mx-auto">
              <QRCodeSVG
                value={`pitch-arena://claim/${reward.claimCode ?? reward.id}`}
                size={140}
                level="M"
              />
            </div>
            <p className="text-white/40 text-xs font-mono">{reward.claimCode ?? reward.id}</p>
            <p className="text-white/30 text-xs">One-time use · Server validated</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 size={14} />
            <span>Already claimed</span>
          </div>
        )}
      </div>
    </Card>
  )
}

function TopInvestorLeaderboard() {
  const { user } = useAuthStore()
  const { wallet } = useWalletStore()
  const { event } = useEventStore()
  const [topInvestors, setTopInvestors] = useState<TopInvestor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getTopInvestors(event?.id).then(data => {
      if (active) {
        setTopInvestors(data)
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [event?.id, wallet?.investedPoints])

  const userInvested = wallet?.investedPoints ?? 0
  const userInTop = topInvestors.some(i => i.userId === user?.id)

  return (
    <Card className="p-5">
      <SectionHeader title="Top Investors" subtitle="Ranked by live points invested" className="mb-4" />
      {loading ? (
        <div className="py-6 text-center text-white/40 text-xs">
          <div className="w-6 h-6 border-2 border-arena-blue border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading leaderboard...
        </div>
      ) : topInvestors.length === 0 ? (
        <div className="py-8 text-center text-white/40 text-xs space-y-1">
          <p className="text-white/60 font-semibold text-sm">No investments recorded yet</p>
          <p>Back a pitch team during live rounds to appear on the leaderboard!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topInvestors.map((investor, i) => {
            const isYou = investor.userId === user?.id
            return (
              <div
                key={investor.userId}
                className={`flex items-center gap-3 py-2 px-3 rounded-xl transition-colors ${
                  isYou ? 'bg-arena-blue/10 border border-arena-blue/30 text-arena-blue-3' : 'hover:bg-white/[0.03]'
                }`}
              >
                <span className="w-6 text-center font-bold text-sm">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${isYou ? 'text-arena-blue-3' : 'text-white'}`}>
                    {investor.name} {isYou && '(You)'}
                  </p>
                </div>
                <span className={`font-bold text-sm ${isYou ? 'text-arena-blue-3' : 'text-white/80'}`}>
                  {formatPoints(investor.points)}
                </span>
              </div>
            )
          })}

          {!userInTop && userInvested > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.08] flex items-center justify-between px-3 text-xs">
              <span className="text-white/50">Your Rank</span>
              <span className="text-arena-blue-3 font-semibold">{formatPoints(userInvested)} invested</span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export function RewardsPage() {
  const { user } = useAuthStore()
  const { rewards } = useWalletStore()
  const { event } = useEventStore()

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <EmptyState
          icon={<Gift />}
          title="Sign in to view rewards"
          description="Earn badges and prizes by investing in great pitches!"
          action={<Link to="/auth"><Button icon={<Zap size={14} />}>Sign In</Button></Link>}
        />
      </div>
    )
  }

  const rewardRules = event?.config.rewardRules ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      <SectionHeader
        title="Rewards & Badges"
        subtitle="Earn prizes for your investment activity"
      />

      {/* My Rewards */}
      {rewards.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-white font-bold text-sm px-1 flex items-center gap-2">
            <Star size={14} className="text-amber-400" />
            My Earned Badges ({rewards.length})
          </h2>
          {rewards.map(r => <RewardCard key={r.id} reward={r} />)}
        </div>
      ) : (
        <Card className="p-6 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-white font-semibold text-base mb-2">No rewards yet</h3>
          <p className="text-white/50 text-sm">Start investing in pitches to earn badges and prizes!</p>
          <Link to="/live" className="block mt-4">
            <Button icon={<Zap size={14} />} variant="secondary" className="mx-auto">Go Invest Now</Button>
          </Link>
        </Card>
      )}

      {/* Top Investor Leaderboard */}
      <TopInvestorLeaderboard />

      {/* Reward Rules */}
      <div className="space-y-3">
        <SectionHeader title="How to Earn Rewards" subtitle="Eligibility rules for this event" />
        <div className="space-y-2">
          {rewardRules.map(rule => (
            <Card key={rule.id} className="p-4 flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">
                {rule.type === 'top_investor' ? '🏆' :
                 rule.type === 'early_backer' ? '⚡' :
                 rule.type === 'most_unique' ? '💎' : '🚀'}
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{rule.label}</p>
                <p className="text-white/50 text-xs mt-0.5">{rule.description}</p>
                <p className="text-arena-violet-3 text-xs mt-2 font-medium">{rule.prizeDescription}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <Card className="p-4 border-arena-violet/20 bg-arena-violet/5">
        <div className="flex items-start gap-3">
          <Lock size={14} className="text-arena-violet-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-arena-violet-3 font-semibold text-sm">Reward Policy</p>
            <p className="text-white/50 text-xs mt-1 leading-relaxed">
              Final eligibility is calculated after the event closes. Rewards are not promised until then.
              QR codes are one-time use and validated server-side to prevent duplicate redemptions.
              Organizer decisions on eligibility are final.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
