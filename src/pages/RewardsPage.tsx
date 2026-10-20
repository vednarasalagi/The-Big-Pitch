// ============================================================
// Rewards Page — Badges, gamification, QR claim codes
// Minimalist, high contrast, clean white and black theme
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Trophy, Star, CheckCircle2, QrCode, Lock, Users, Award } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuthStore, useWalletStore, useEventStore } from '@/store'
import { Card, Button, Badge, EmptyState, SectionHeader } from '@/components/ui'
import { formatPoints } from '@/lib/utils'
import type { Reward } from '@/types'
import { getTopInvestors, claimRewardInDb, type TopInvestor } from '@/lib/supabaseApi'

function RewardCard({ reward, userId }: { reward: Reward; userId: string }) {
  const [showQR, setShowQR] = useState(false)
  const [claimed, setClaimed] = useState(reward.claimed)

  const handleClaim = async () => {
    setClaimed(true)
    setShowQR(true)
    // HIGH-4 FIX: Pass userId so the DB query enforces ownership
    await claimRewardInDb(reward.id, userId)
  }

  return (
    <Card className={`overflow-hidden border-zinc-200 bg-white shadow-sm ${claimed ? 'opacity-80' : ''}`}>
      <div className="p-5 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            <Award size={20} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-zinc-950 font-bold text-base">
                {reward.badgeType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </h3>
              {claimed && <Badge variant="emerald" dot>Claimed</Badge>}
            </div>
            <p className="text-zinc-500 text-xs leading-relaxed">{reward.description}</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {!claimed ? (
          <Button onClick={handleClaim} className="w-full justify-center bg-zinc-950 text-white" icon={<QrCode size={14} />}>
            Generate Verification Code
          </Button>
        ) : showQR ? (
          <div className="text-center space-y-3 py-2">
            <p className="text-zinc-950 text-sm font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-600" /> Present code at organizer desk
            </p>
            <div className="p-3 bg-white border border-zinc-200 rounded-2xl inline-block mx-auto shadow-sm">
              <QRCodeSVG
                value={`pitch-arena://claim/${reward.claimCode ?? reward.id}`}
                size={140}
                level="M"
              />
            </div>
            <p className="text-zinc-500 text-xs font-mono">{reward.claimCode ?? reward.id}</p>
            <p className="text-zinc-400 text-[11px]">Single-use verification token</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 size={14} />
            <span>Redeemed successfully</span>
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
    <Card className="p-6 border-zinc-200 bg-white shadow-sm space-y-4">
      <SectionHeader title="Top Audience Backers" subtitle="Ranked by total points deployed into startups" />
      {loading ? (
        <div className="py-8 text-center text-zinc-400 text-xs">
          <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading rankings...
        </div>
      ) : topInvestors.length === 0 ? (
        <div className="py-8 text-center text-zinc-400 text-xs space-y-1">
          <p className="text-zinc-900 font-semibold text-sm">No audience investments recorded yet</p>
          <p>Back active pitch rounds to earn a spot on the leaderboard!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {topInvestors.map((investor, i) => {
            const isYou = investor.userId === user?.id
            return (
              <div
                key={investor.userId}
                className={`flex items-center gap-3 py-2.5 px-3.5 rounded-xl transition-colors ${
                  isYou ? 'bg-zinc-100 border border-zinc-300 font-semibold text-zinc-950' : 'hover:bg-zinc-50 text-zinc-700'
                }`}
              >
                <span className="w-6 text-center font-bold font-mono text-xs text-zinc-500">
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs text-zinc-950 truncate">
                    {investor.name} {isYou && '(You)'}
                  </p>
                </div>
                <span className="font-bold font-mono text-xs text-zinc-950">
                  {formatPoints(investor.points)} pts
                </span>
              </div>
            )
          })}

          {!userInTop && userInvested > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between px-3 text-xs">
              <span className="text-zinc-500 font-medium">Your Total Deployed</span>
              <span className="text-zinc-950 font-bold font-mono">{formatPoints(userInvested)} pts</span>
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
      <div className="max-w-2xl mx-auto px-4 py-12 text-zinc-900">
        <EmptyState
          icon={<Gift size={40} className="text-zinc-400" />}
          title="Sign in to view badges & rewards"
          description="Earn merit badges and access sponsor perks by backing top student startups."
          action={<Link to="/auth"><Button className="bg-zinc-950 text-white">Sign In to Continue</Button></Link>}
        />
      </div>
    )
  }

  const rewardRules = event?.config.rewardRules ?? []

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in text-zinc-900">
      <SectionHeader
        title="Badges & Rewards"
        subtitle="Recognition and sponsor awards for active audience investors"
      />

      {/* My Rewards */}
      {rewards.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-zinc-950 font-bold text-sm px-1 flex items-center gap-2">
            <Award size={15} className="text-zinc-900" />
            My Earned Badges ({rewards.length})
          </h2>
          {rewards.map(r => <RewardCard key={r.id} reward={r} userId={user.id} />)}
        </div>
      ) : (
        <Card className="p-8 text-center border-zinc-200 bg-white shadow-sm space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-800 flex items-center justify-center mx-auto mb-3">
            <Award size={22} />
          </div>
          <h3 className="text-zinc-950 font-bold text-base">No badges unlocked yet</h3>
          <p className="text-zinc-500 text-xs max-w-sm mx-auto">
            Participate in live pitching rounds and deploy points to unlock badges and claim awards.
          </p>
          <div className="pt-2">
            <Link to="/live">
              <Button variant="secondary" size="sm">Go to Live Arena</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Top Investor Leaderboard */}
      <TopInvestorLeaderboard />

      {/* Reward Rules */}
      <div className="space-y-3">
        <SectionHeader title="Reward Eligibility Rules" subtitle="Criteria for unlocking badges at this event" />
        <div className="space-y-2">
          {rewardRules.map(rule => (
            <Card key={rule.id} className="p-4 border-zinc-200 bg-white shadow-sm flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900 flex-shrink-0 font-bold">
                <Award size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-950 font-bold text-sm">{rule.label}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{rule.description}</p>
                <p className="text-zinc-700 text-xs mt-1.5 font-semibold">{rule.prizeDescription}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-zinc-500 text-xs leading-relaxed">
        <p className="font-bold text-zinc-900 mb-0.5">Award Fulfillment Notice</p>
        Final eligibility is calculated after all pitching rounds conclude. Redemptions are validated by event administrators.
      </div>
    </div>
  )
}
