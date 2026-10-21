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
  officialResultsPublished?: boolean;
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
  // Official Competition Judging (strictly independent of audience investments)
  officialRank?: number | null;
  officialScore?: number | null;
  officialAward?: string | null;
  officialNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfficialResult {
  teamId: string;
  rank?: number | null;
  score?: number | null;
  award?: string | null;
  notes?: string | null;
}

// --- Pitch Round ---
export type RoundStatus =
  | 'scheduled'
  | 'announced'
  | 'pitching'
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
  timeElapsedMs?: number;
  createdAt: string;
}

export interface TeamInvestorStanding {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  amount: number;
  timeElapsedMs: number;
  investedAt: string;
  rank: number;
  isCurrentUser?: boolean;
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

// --- Static QR Payment Types ---
export type PaymentIntentStatus =
  | 'pending'
  | 'processing'
  | 'credited'
  | 'manual_review'
  | 'expired'
  | 'failed'
  | 'cancelled'
  | 'vpa_mismatch';

export interface PaymentIntent {
  id: string;
  userId: string;
  eventId: string;
  claimCode: string;
  rupeeAmount: number;
  pointsToCredit: number;
  status: PaymentIntentStatus;
  userUtr?: string;
  userVpa?: string;
  matchedPaymentId?: string;
  matchedAt?: string;
  adminNotes?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  userEmail?: string;
  userDisplayName?: string;
}

export type QRPaymentStatus =
  | 'unmatched'
  | 'matched'
  | 'manual_review'
  | 'rejected'
  | 'refunded';

export interface QRPayment {
  id: string;
  razorpayPaymentId: string;
  razorpayQrId?: string;
  amountPaise: number;
  rupeeAmount: number;
  currency: string;
  payerVpa?: string;
  bankRrn?: string;
  status: QRPaymentStatus;
  matchedIntentId?: string;
  matchedUserId?: string;
  rawPayload?: any;
  paymentTime: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  matchedUserEmail?: string;
  matchedUserDisplayName?: string;
}

export interface WebhookEventRecord {
  id: string;
  eventType: string;
  eventId?: string;
  signatureVerified: boolean;
  status: 'received' | 'processed' | 'ignored' | 'failed' | 'duplicate';
  errorMessage?: string;
  payload: any;
  createdAt: string;
}

export interface PackageQRCode {
  id: string;
  eventId: string;
  label: string;
  rupeeAmount: number;
  points: number;
  qrImageUrl?: string;
  upiVpa?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUserInfo {
  id: string;
  email: string;
  displayName: string;
  role: string;
  upiId?: string;
  walletId?: string;
  freePoints: number;
  purchasedPoints: number;
  investedPoints: number;
  availablePoints: number;
  totalPaidRupees: number;
  createdAt: string;
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
