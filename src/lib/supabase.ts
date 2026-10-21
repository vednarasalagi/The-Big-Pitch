// ============================================================
// Supabase Production Client — initialized from environment
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  supabaseAnonKey.length > 20
)

let _supabase: SupabaseClient | null = null

if (isSupabaseConfigured) {
  _supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  })
}

export const supabase = _supabase

// ============================================================
// Table name constants
// ============================================================
export const TABLES = {
  PROFILES:        'profiles',
  EVENTS:          'events',
  EVENT_CONFIG:    'event_config',
  EVENT_PARTICIPANTS: 'event_participants',
  TEAMS:           'teams',
  PITCH_ROUNDS:    'pitch_rounds',
  WALLETS:         'wallets',
  WALLET_LEDGER:   'wallet_ledger',
  INVESTMENTS:     'investments',
  PAYMENT_ORDERS:  'payment_orders',
  PAYMENT_TRANSACTIONS: 'payment_transactions',
  PAYMENT_INTENTS: 'payment_intents',
  QR_PAYMENTS:     'qr_payments',
  WEBHOOK_EVENTS:  'webhook_events',
  PACKAGE_QR_CODES: 'package_qr_codes',
  REWARDS:         'rewards',
  REWARD_CLAIMS:   'reward_claims',
  ADMIN_ALLOWLIST: 'admin_allowlist',
  AUDIT_LOGS:      'audit_logs',
} as const

// ============================================================
// Realtime channel names
// ============================================================
export const CHANNELS = {
  SCOREBOARD:     'scoreboard',
  PITCH_EVENTS:   'pitch-events',
  WALLET_UPDATES: 'wallet-updates',
  ADMIN_CONTROL:  'admin-control',
} as const
