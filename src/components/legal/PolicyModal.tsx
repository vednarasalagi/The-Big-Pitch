// ============================================================
// PolicyModal.tsx — Unified Legal Compliance Modal
// Implements the same tabbed legal dialog as the reference site
// Supports: privacy | terms | shipping | refund | contact
// ============================================================

import React, { useState, useEffect } from 'react'
import {
  X, ShieldCheck, FileText, Truck, RotateCcw,
  Mail, MapPin, Building2, CheckCircle2, AlertTriangle, ExternalLink
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export type PolicyTab = 'privacy' | 'terms' | 'shipping' | 'refund' | 'contact'

interface PolicyModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: PolicyTab
}

const TABS: { id: PolicyTab; label: string; icon: React.ElementType }[] = [
  { id: 'privacy',  label: 'Privacy Policy',      icon: ShieldCheck },
  { id: 'terms',    label: 'Terms & Conditions',  icon: FileText },
  { id: 'refund',   label: 'Refunds & Returns',   icon: RotateCcw },
  { id: 'shipping', label: 'Shipping & Delivery', icon: Truck },
  { id: 'contact',  label: 'Contact Us',          icon: Mail },
]

export function PolicyModal({ isOpen, onClose, defaultTab = 'privacy' }: PolicyModalProps) {
  const [activeTab, setActiveTab] = useState<PolicyTab>(defaultTab)

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab)
  }, [defaultTab, isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay z-[100] bg-zinc-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="modal-panel relative max-w-3xl bg-white rounded-3xl border border-zinc-200/90 shadow-2xl flex flex-col overflow-hidden text-zinc-900 z-10 animate-scale-up">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-zinc-200/80 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-950 text-white shadow-sm">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-950 tracking-tight leading-none">
                Legal Policies & Compliance
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1">
                THE BIG PITCH • Razorpay & Indian IT Act 2000 Compliant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={activeTab === 'privacy' ? '/privacy' : '/terms'}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-950 transition-colors px-2.5 py-1 rounded-lg hover:bg-zinc-100"
              title="Open full page in new tab"
            >
              <span>Full Page</span>
              <ExternalLink size={12} />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-950 hover:bg-zinc-200/80 transition-colors"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-100 bg-white overflow-x-auto no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0',
                activeTab === id
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100'
              )}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-xs sm:text-sm text-zinc-700 leading-relaxed">
          {/* TAB 1: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-zinc-100 pb-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Policy</span>
                <h4 className="text-lg font-black text-zinc-950">Privacy Policy</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Last updated: October 2026 • IT Act 2000 & DPDP Act 2023</p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">1. Information We Collect</h5>
                <ul className="list-disc pl-5 space-y-1 text-zinc-600">
                  <li><strong>Personal Information:</strong> Name, email address, phone number, and profile details provided during account creation or digital checkout.</li>
                  <li><strong>Order & Transaction Records:</strong> Razorpay Order IDs, Payment IDs, purchased digital asset keys, and timestamps.</li>
                  <li><strong>Technical Data:</strong> IP address, browser type, and device metadata strictly for fraud prevention.</li>
                  <li><strong>Zero Financial Credential Storage:</strong> Complete credit/debit card numbers, CVVs, and UPI PINs are processed exclusively by Razorpay on PCI-DSS Level 1 compliant servers.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">2. How We Use Information</h5>
                <ul className="list-disc pl-5 space-y-1 text-zinc-600">
                  <li>Instant fulfillment and generation of digital downloads and cloud template links.</li>
                  <li>Account management, purchase library storage, and fraud prevention.</li>
                  <li>Mandatory transaction audit logs under Indian tax and financial regulations.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">3. Third-Party Disclosures</h5>
                <p className="text-zinc-600">
                  We <strong>never sell, rent, or trade</strong> your personal data. We disclose data solely to Razorpay Software Pvt. Ltd. (payment processing) and Supabase Inc. (encrypted storage and authentication), or statutory authorities when mandated by Indian law.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">4. Grievance Officer</h5>
                <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/80 text-xs text-zinc-600 space-y-1">
                  <p className="font-bold text-zinc-900">Grievance Redressal Officer • THE BIG PITCH</p>
                  <p>Email: <a href="mailto:thebigpitch.official@gmail.com" className="font-mono text-zinc-950 font-bold underline">thebigpitch.official@gmail.com</a></p>
                  <p className="text-[11px] text-zinc-400 pt-1">Response SLA: Acknowledged within 48 hours, resolved within 30 days.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TERMS & CONDITIONS */}
          {activeTab === 'terms' && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-zinc-100 pb-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Contract</span>
                <h4 className="text-lg font-black text-zinc-950">Terms & Conditions of Service</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Governed by the Laws of the Republic of India</p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">1. Nature of Products</h5>
                <p className="text-zinc-600">
                  THE BIG PITCH sells <strong>intangible digital goods</strong> (pitch deck templates in Figma/Keynote, financial models in Excel/Google Sheets, operating spreadsheets, and founder toolkits). No physical shipments are made.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">2. License Grant & IP Restrictions</h5>
                <p className="text-zinc-600">
                  Upon confirmed payment, you receive a non-exclusive, perpetual personal and commercial license to adapt and use the templates for your personal projects and business pitches. You are strictly prohibited from reselling, sub-licensing, redistributing, or publicly hosting the original source files as competing standalone products.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">3. Pricing & Payments (Razorpay)</h5>
                <p className="text-zinc-600">
                  All prices are quoted in Indian Rupees (INR ₹) inclusive of taxes. Transactions are processed securely via Razorpay Software Pvt. Ltd. supporting UPI, Credit/Debit Cards, and NetBanking.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">4. Limitation of Liability</h5>
                <p className="text-zinc-600">
                  Products are provided on an &ldquo;as is&rdquo; basis for operational guidance. We make no warranty that materials will guarantee venture funding or commercial profitability. Total liability is capped at the rupee amount paid for the specific product in dispute.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: REFUND & CANCELLATION */}
          {activeTab === 'refund' && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-zinc-100 pb-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Returns</span>
                <h4 className="text-lg font-black text-zinc-950">Cancellation & Refund Policy</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Compliant with Razorpay E-Commerce Standards</p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">1. Non-Refundable Nature of Digital Downloads</h5>
                <p className="text-zinc-600">
                  Because digital products are made accessible immediately upon checkout and cannot be physically returned or un-downloaded, <strong>all sales are final and non-refundable</strong> once download links or cloud access keys have been provisioned.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">2. Cancellation Policy</h5>
                <p className="text-zinc-600">
                  You may cancel any transaction at any time before completing payment in the Razorpay checkout window. Once authorized and digital delivery occurs, cancellation is not possible.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">3. Refund Exceptions (100% Guaranteed)</h5>
                <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
                  <li><strong>Duplicate Charges:</strong> In the event of an accidental double debit for the same product, a 100% refund for the duplicate transaction will be issued upon verification.</li>
                  <li><strong>Technical Delivery Failure:</strong> If payment is deducted, but download access is not provisioned within 24 hours due to a technical glitch, you are entitled to a full 100% refund.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/80 text-xs text-zinc-600 space-y-1">
                <p className="font-bold text-zinc-900">How to Request a Refund</p>
                <p>Email: <a href="mailto:thebigpitch.official@gmail.com" className="font-mono text-zinc-950 font-bold underline">thebigpitch.official@gmail.com</a> within 48 hours of purchase with your Razorpay Payment ID.</p>
                <p className="text-[11px] text-zinc-500 pt-1">Settlement Timeline: Approved refunds are processed back to the original source within <strong>5 to 7 business days</strong>.</p>
              </div>
            </div>
          )}

          {/* TAB 4: SHIPPING & DELIVERY */}
          {activeTab === 'shipping' && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-zinc-100 pb-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Fulfillment</span>
                <h4 className="text-lg font-black text-zinc-950">Shipping & Delivery Policy (Digital Goods)</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Instantaneous Electronic Delivery</p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">1. 100% Digital Delivery</h5>
                <p className="text-zinc-600">
                  All purchases on THE BIG PITCH are delivered electronically. We do not dispatch physical products, parcel packages, or postal couriers.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">2. Delivery Timeline</h5>
                <p className="text-zinc-600">
                  Delivery is <strong>instantaneous</strong> (typically within 30 to 60 seconds). Download links and library access are generated automatically upon receiving confirmation from the Razorpay payment gateway.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-black text-zinc-900 text-xs uppercase tracking-wide">3. Shipping Charges</h5>
                <p className="text-zinc-600">
                  <strong>₹0.00 (Nil / Free Delivery)</strong>. There are no shipping, handling, or fulfillment charges on any digital products.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: CONTACT US */}
          {activeTab === 'contact' && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-zinc-100 pb-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Support</span>
                <h4 className="text-lg font-black text-zinc-950">Merchant Contact Information</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Customer Support & Inquiries</p>
              </div>

              <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 space-y-3 text-xs text-zinc-700">
                <div>
                  <span className="font-bold text-zinc-400 uppercase text-[10px] block">Entity Name</span>
                  <span className="font-bold text-zinc-950 text-sm">THE BIG PITCH</span>
                  <p className="text-zinc-500 mt-0.5">Category: E-Commerce (Digital Goods & Online Resources)</p>
                  <p className="text-zinc-500 mt-0.5">Website: https://the-big-pitch.vercel.app</p>
                </div>

                <div>
                  <span className="font-bold text-zinc-400 uppercase text-[10px] block">Direct Support Email</span>
                  <a href="mailto:thebigpitch.official@gmail.com" className="font-mono text-zinc-950 font-bold underline text-sm">
                    thebigpitch.official@gmail.com
                  </a>
                  <p className="text-zinc-500 mt-0.5">Support Hours: Monday – Saturday: 09:00 AM – 08:00 PM IST</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-100 bg-zinc-50/70 flex items-center justify-between text-xs text-zinc-500">
          <span>100% Secure via Razorpay • 256-bit SSL</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-950 text-white font-bold text-xs hover:bg-zinc-800 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
