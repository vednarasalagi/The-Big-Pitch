// ============================================================
// Pitch Arena — Core Type Definitions
// ============================================================

// --- Auth & Users ---
export type UserRole = 'admin' | 'audience' | 'public';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  emailDomain?: string;
  isVerified: boolean;
}

// --- Event ---
export type EventStatus =
  | 'not_started'
  | 'upcoming'
  | 'announced'
  | 'investment_open'
  | 'investment_paused'
  | 'investment_closed'
  | 'results_published'
  | 'completed';

export interface Event {
  id: string;
  name: string;
  tagline?: string;
  logoUrl?: string;
  bannerUrl?: string;
  status: EventStatus;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  updatedAt: string;
  config: EventConfig;
}

export interface EventConfig {
  id: string;
  eventId: string;
  freePointsAllocation: number;         // e.g., 500
  pointsPerRupee: number;               // e.g., 10
  maxPaidPurchaseRupees: number;        // e.g., 100
  maxPaidPoints: number;                // e.g., 1000
  allowedPurchaseAmounts: number[];     // e.g., [50, 100, 200, 500, 1000]
  minInvestmentAmount: number;          // e.g., 10
  maxInvestmentAmount: number;          // e.g., 500
  allowMultipleInvestments: boolean;
  pitchDurationSeconds: number;
  investmentWindowSeconds: number;
  blindLeaderboard: boolean;
  allowedEmailDomains: string[];        // empty = allow all
  rewardRules: RewardRule[];
  updatedAt: string;
}

// --- Team ---
export type TeamStatus = 'upcoming' | 'active' | 'closed' | 'completed';

export interface Team {
  id: string;
  eventId: string;
  name: string;
  logoUrl?: string;
  pitchTitle: string;
  description: string;
  category: string;
  presenters: string[];
  pitchOrder: number;
  status: TeamStatus;
  pitchDurationSeconds?: number;
  investmentWindowSeconds?: number;
  totalInvestment: number;
  uniqueBackers: number;
  createdAt: string;
  updatedAt: string;
}

// --- Pitch Round ---
export type RoundStatus =
  | 'scheduled'
  | 'announced'
  | 'investment_open'
  | 'investment_paused'
  | 'investment_closed'
  | 'completed';

export interface PitchRound {
  id: string;
  eventId: string;
  teamId: string;
  team?: Team;
  roundNumber?: number;
  status: RoundStatus;
  pitchStartTime?: string;
  investmentOpenTime?: string;
  investmentCloseTime?: string;
  investmentPauseTime?: string;
  durationSeconds?: number;
  scheduledDurationSeconds?: number;
  investmentWindowSeconds?: number;
  totalInvested: number;
  uniqueInvestors: number;
  createdAt?: string;
  updatedAt?: string;
}


// --- Wallet ---
export interface Wallet {
  id: string;
  userId: string;
  eventId: string;
  freePoints: number;
  purchasedPoints: number;
  investedPoints: number;
  totalSpentPoints: number;
  totalPaidRupees: number;
  freePointsGranted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LedgerType =
  | 'free_grant'
  | 'purchase'
  | 'investment'
  | 'investment_refund'
  | 'admin_adjustment'
  | 'purchase_refund';

export interface WalletLedgerEntry {
  id: string;
  walletId: string;
  userId: string;
  eventId: string;
  type: LedgerType;
  amount: number;          // positive = credit, negative = debit
  balanceAfter: number;
  description: string;
  referenceId?: string;    // investmentId or paymentId
  createdAt: string;
}

// --- Investment ---
export interface Investment {
  id: string;
  userId: string;
  eventId: string;
  teamId: string;
  roundId: string;
  amount: number;
  createdAt: string;
}

// --- Payment ---
export type PaymentStatus = 'created' | 'pending' | 'success' | 'failed' | 'cancelled' | 'refunded';

export interface PaymentOrder {
  id: string;
  userId: string;
  eventId: string;
  razorpayOrderId: string;
  rupeeAmount: number;
  pointsToCredit: number;
  status: PaymentStatus;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Rewards ---
export interface RewardRule {
  id: string;
  label: string;
  description: string;
  type: 'top_investor' | 'backed_winner' | 'early_backer' | 'most_unique';
  threshold?: number;       // e.g., top N investors
  prizeDescription: string;
}



export interface Reward {
  id: string;
  eventId: string;
  userId: string;
  ruleId: string;
  badgeType: string;
  description: string;
  claimed: boolean;
  claimCode?: string;
  claimedAt?: string;
  createdAt: string;
}

// --- Admin Audit Log ---
export type AuditAction =
  | 'round_started'
  | 'round_paused'
  | 'round_resumed'
  | 'round_extended'
  | 'round_closed'
  | 'results_published'
  | 'event_config_updated'
  | 'team_created'
  | 'team_updated'
  | 'team_archived'
  | 'points_adjusted'
  | 'payment_overridden'
  | 'reward_granted'
  | 'reward_claimed';

export interface AuditLog {
  id: string;
  eventId: string;
  adminId: string;
  action: AuditAction;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// --- UI State ---
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface LivePitchState {
  currentRound?: PitchRound;
  activeTeam?: Team;
  timeRemainingSeconds: number;
  connectedViewers: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'investment' | 'round_change' | 'new_backer';
  message: string;
  timestamp: string;
}
