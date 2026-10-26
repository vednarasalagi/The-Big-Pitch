// ============================================================
// PrivacyPage.tsx — Privacy Policy
// Compliant with IT Act 2000, SPDI Rules 2011, DPDP Act 2023 & Razorpay standards
// Configured for E-Commerce Digital Products & Founder Resources
// ============================================================

import React from 'react'
import { Link } from 'react-router-dom'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { ShieldCheck, Mail, Lock, CheckCircle2, FileText, Database } from 'lucide-react'

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How THE BIG PITCH collects, protects, processes, and safeguards customer personal data, transaction records, and digital product access."
      lastUpdated="October 2026"
    >
      {/* Statutory Compliance Notice */}
      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 leading-relaxed">
        <p>
          This Privacy Policy is formulated pursuant to Section 43A of the <strong>Information Technology Act, 2000</strong>, the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (&ldquo;SPDI Rules&rdquo;)</strong>, and the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>.
        </p>
      </div>

      {/* 1. Commitment to Privacy */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide flex items-center gap-2">
          <span>1. Our Commitment to Privacy</span>
        </h2>
        <p>
          <strong>THE BIG PITCH</strong> (&ldquo;We&rdquo;, &ldquo;Our&rdquo;, or &ldquo;Us&rdquo;) operates this digital products e-commerce platform offering premium startup resources, pitch deck masterclasses, financial operating models, and founder assets.
        </p>
        <p>
          We are dedicated to safeguarding the privacy and security of every visitor, customer, and founder (&ldquo;You&rdquo;) who accesses our website and purchases our digital goods.
        </p>
      </section>

      {/* 2. Information We Collect */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          2. Information We Collect
        </h2>
        <p>
          We collect only the information strictly necessary to process your digital product orders, generate license access, and comply with Indian statutory requirements:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-700">
          <li>
            <strong>Personal & Account Details:</strong> Your full name, email address, contact telephone number (collected during registration, checkout, or support requests), and profile avatar.
          </li>
          <li>
            <strong>Transaction & Order Records:</strong> Razorpay Order IDs, Payment IDs, purchased digital product keys and titles, payment amount in INR (₹), timestamp, and download authorization logs.
          </li>
          <li>
            <strong>Technical & Security Metadata:</strong> IP address, device type, operating system, and browser metadata collected automatically for fraud detection, bot prevention, and license verification.
          </li>
          <li>
            <strong>Financial Security Guarantee (No Card Storage):</strong> We <strong>DO NOT</strong> collect, store, or have access to your bank account numbers, credit or debit card numbers, CVVs, netbanking credentials, or UPI PINs. All financial payments are processed exclusively by <strong>Razorpay Software Private Limited</strong> on RBI-regulated, PCI-DSS Level 1 compliant secure servers.
          </li>
        </ul>
      </section>

      {/* 3. How We Use Information */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          3. How We Use Your Information
        </h2>
        <p>
          Your information is utilized solely for legitimate operational and compliance purposes:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-700">
          <li>To instantly provision your digital product downloads, templates, and library access links.</li>
          <li>To create and manage your secure account via Supabase Auth and database storage.</li>
          <li>To prevent fraudulent payments, verify billing authenticity, and perform Razorpay transaction reconciliation.</li>
          <li>To maintain mandatory transaction audit logs under Indian financial regulations and taxation requirements.</li>
          <li>To send transactional receipts, critical security notices, and template package updates.</li>
          <li>To handle customer inquiries and resolve issues under our <Link to="/terms#refunds" className="text-zinc-950 font-bold underline">Cancellation & Refund Policy</Link>.</li>
        </ul>
      </section>

      {/* 4. Third-Party Disclosures & Non-Disclosure */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          4. Sharing with Third-Party Providers
        </h2>
        <p>
          We <strong>never sell, rent, monetize, or trade</strong> your personal information to third-party marketers or data brokers. We share data strictly on a need-to-know basis with trusted technology partners essential for platform operations:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-700">
          <li>
            <strong>Razorpay Software Private Limited:</strong> Authorized payment aggregator processing checkout for UPI, credit/debit cards, and netbanking under PCI-DSS Level 1 compliance.
          </li>
          <li>
            <strong>Supabase Inc.:</strong> Cloud database and authentication infrastructure providing encrypted user identity and order records.
          </li>
          <li>
            <strong>Statutory & Legal Authorities:</strong> Disclosed only if strictly required under summons, court order, or applicable law of the Republic of India.
          </li>
        </ul>
      </section>

      {/* 5. Data Security Safeguards */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          5. Data Security Safeguards
        </h2>
        <p>
          We implement rigorous security practices and procedures as required by Rule 5 of the SPDI Rules:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-700">
          <li><strong>256-bit TLS/SSL Cryptography:</strong> All data transmitted between your browser and our servers is encrypted in transit.</li>
          <li><strong>PostgreSQL Row-Level Security (RLS):</strong> User order histories and library downloads are isolated and accessible only by the verified authenticated owner.</li>
          <li><strong>Access Controls:</strong> Administrative access to catalog management and customer orders is restricted by secure multi-layer passcodes.</li>
        </ul>
      </section>

      {/* 6. Your Rights Under Indian Law */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          6. Your Rights Under Indian Law
        </h2>
        <p>
          In accordance with the DPDP Act and IT Rules, you hold the following rights regarding your personal information:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-700">
          <li><strong>Right to Review:</strong> You may request a copy of the personal data we hold regarding your account.</li>
          <li><strong>Right to Correction:</strong> You may request correction of inaccurate or incomplete personal information.</li>
          <li><strong>Right to Erasure:</strong> You may request account deletion, subject to mandatory statutory tax and accounting retention requirements.</li>
        </ul>
      </section>

      {/* 7. Statutory Grievance Redressal Officer */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
          7. Statutory Grievance Redressal Mechanism
        </h2>
        <p>
          In compliance with Section 5(9) of the <strong>Information Technology (SPDI) Rules, 2011</strong> and the <strong>Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</strong>, the details of our designated <strong>Grievance Redressal Officer</strong> are provided below:
        </p>

        <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 text-xs space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="font-bold text-zinc-400 uppercase text-[10px] block">Officer Designation</span>
              <span className="font-bold text-zinc-950">Grievance Redressal Officer</span>
              <p className="text-zinc-600">THE BIG PITCH</p>
            </div>

            <div>
              <span className="font-bold text-zinc-400 uppercase text-[10px] block">Direct Email</span>
              <a href="mailto:thebigpitch.official@gmail.com" className="font-mono text-zinc-950 font-bold underline block pt-0.5">
                thebigpitch.official@gmail.com
              </a>
            </div>
          </div>
          <p className="text-zinc-500 text-[11px] pt-1 border-t border-zinc-200/80">
            <strong>Response SLA:</strong> In strict compliance with Indian IT Rules, all grievance notices are acknowledged within <strong>48 hours</strong> and redressed within <strong>30 calendar days</strong> of receipt.
          </p>
        </div>
      </section>
    </LegalLayout>
  )
}
