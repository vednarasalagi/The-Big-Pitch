// ============================================================
// PrivacyPage.tsx — Privacy Policy
// Compliant with IT Act 2000, SPDI Rules 2011, DPDP Act 2023 & Razorpay standards
// Simple, professional, and transparent
// ============================================================

import React from 'react'
import { Link } from 'react-router-dom'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { ShieldCheck, Mail, Lock, CheckCircle2 } from 'lucide-react'

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How The Big Pitch collects, protects, processes, and safeguards attendee personal data and transaction records."
      lastUpdated="October 19, 2026"
    >
      {/* Statutory Compliance Notice */}
      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 leading-relaxed">
        <p>
          This Privacy Policy is formulated pursuant to Section 43A of the <strong>Information Technology Act, 2000</strong>, the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (&ldquo;SPDI Rules&rdquo;)</strong>, and the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>.
        </p>
      </div>

      {/* 1. Commitment to Privacy */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          1. Our Commitment to Privacy
        </h2>
        <p>
          <strong>THE BIG PITCH</strong> (&ldquo;We&rdquo;, &ldquo;Our&rdquo;, or &ldquo;Us&rdquo;), organized under Sphinx 2026 and the Entrepreneurship Cell (E-Cell) at <strong>Malaviya National Institute of Technology (MNIT), JLN Marg, Jaipur, Rajasthan — 302017, India</strong>, is dedicated to protecting the privacy of every participant, attendee, and fest guest (&ldquo;You&rdquo;) using our platform.
        </p>
      </section>

      {/* 2. Information We Collect */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          2. Information We Collect
        </h2>
        <p>
          We collect only information necessary for tournament registration and digital transactions:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-700">
          <li>
            <strong>Account Details:</strong> Your name, email address, phone number (if provided for authentication), and profile avatar.
          </li>
          <li>
            <strong>Transaction Records (Razorpay):</strong> Razorpay Order ID, Payment ID, package purchased, rupee amount, and timestamp.
          </li>
          <li>
            <strong>Financial Security Guarantee:</strong> We <strong>DO NOT</strong> store, collect, or have access to your bank account numbers, card numbers, CVVs, netbanking passwords, or UPI PINs. All financial payments are handled exclusively by <strong>Razorpay Software Private Limited</strong> on PCI-DSS Level 1 compliant secure servers.
          </li>
          <li>
            <strong>Platform Activity:</strong> Virtual point allocation history, pitch votes, and leaderboard scores.
          </li>
        </ul>
      </section>

      {/* 3. How We Use Your Information */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          3. How We Use Your Information
        </h2>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-700">
          <li>To authenticate and manage your user account via Supabase Auth.</li>
          <li>To deliver instant digital credits of purchased points into your live wallet.</li>
          <li>To compile real-time tournament leaderboards and audience scoring scorecards.</li>
          <li>To resolve transaction or billing inquiries under our <Link to="/terms#refunds" className="text-zinc-950 font-bold underline">Refund Policy</Link>.</li>
          <li>To prevent fraudulent bot voting and maintain tournament integrity.</li>
        </ul>
      </section>

      {/* 4. Third-Party Service Providers */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          4. Sharing with Third-Party Providers
        </h2>
        <p>
          We <strong>never sell, rent, or trade</strong> your personal information. We disclose data only to trusted technical partners essential for platform operation:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-700">
          <li>
            <strong>Razorpay Software Pvt. Ltd.:</strong> Authorized payment aggregator processing e-commerce checkout and UPI/card/netbanking payments.
          </li>
          <li>
            <strong>Supabase Inc.:</strong> Cloud database and authentication infrastructure providing encrypted user identity and ledger storage.
          </li>
        </ul>
      </section>

      {/* 5. Data Security Measures */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          5. Data Security Safeguards
        </h2>
        <p>
          We enforce 256-bit SSL/TLS cryptographic encryption for all data in transit, strict Postgres Row Level Security (RLS) on user databases, and role-based access controls to prevent unauthorized access or disclosure.
        </p>
      </section>

      {/* 6. User Rights */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          6. Your Rights under Indian Law
        </h2>
        <p>
          You have the right to review your registered personal data, request corrections of inaccurate details, or request account and data deletion following event completion by contacting our grievance desk.
        </p>
      </section>

      {/* 7. Statutory Grievance Redressal Officer */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          7. Statutory Grievance Redressal Mechanism
        </h2>
        <p>
          In accordance with the <strong>Information Technology Act, 2000</strong> and rules made thereunder, the details of our designated <strong>Grievance Officer</strong> are provided below:
        </p>

        <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 text-xs space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="font-bold text-zinc-400 uppercase text-[10px] block">Officer Designation</span>
              <span className="font-bold text-zinc-950">Grievance Redressal Officer</span>
              <p className="text-zinc-600">The Big Pitch • Sphinx 2026 (E-Cell)</p>
            </div>

            <div>
              <span className="font-bold text-zinc-400 uppercase text-[10px] block">Direct Email</span>
              <a href="mailto:ecell.nitjaipur@gmail.com" className="font-mono text-zinc-950 font-bold underline block pt-0.5">
                ecell.nitjaipur@gmail.com
              </a>
            </div>

            <div className="sm:col-span-2">
              <span className="font-bold text-zinc-400 uppercase text-[10px] block">Postal Address</span>
              <p className="text-zinc-700">
                Malaviya National Institute of Technology (MNIT), JLN Marg, Jaipur, Rajasthan — 302017, India
              </p>
            </div>
          </div>
          <p className="text-zinc-500 text-[11px] pt-1 border-t border-zinc-200/80">
            <strong>Response SLA:</strong> In compliance with Indian IT Rules, all grievance notices are acknowledged within <strong>48 hours</strong> and resolved within <strong>30 calendar days</strong>.
          </p>
        </div>
      </section>
    </LegalLayout>
  )
}
