// ============================================================
// Footer.tsx — Enterprise Legal & Compliance Footer
// Provides immediate access to Razorpay required compliance pages
// ============================================================

import React from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  Lock,
  Zap,
  CheckCircle2,
  Mail,
  MapPin,
  ExternalLink,
  Coins,
  ArrowUpRight,
} from 'lucide-react'
import { BrandLogo } from '@/components/ui'

export function Footer() {
  return (
    <footer className="bg-white border-t border-zinc-200/90 text-zinc-600 text-xs mt-auto pb-20 md:pb-0">
      {/* Trust & Payment Security Banner */}
      <div className="border-b border-zinc-100 bg-zinc-50/70 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-zinc-600 font-medium text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-900 font-semibold">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>100% Secure via Razorpay</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock size={13} className="text-zinc-500" />
              <span>256-bit SSL Secured Checkout</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-zinc-500" />
              <span>PCI-DSS Level 1 Compliance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap size={13} className="text-amber-500" />
              <span>Instant Digital Delivery</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-zinc-500 text-[11px]">
            <span>Supported:</span>
            <span className="font-semibold text-zinc-800">UPI • Cards • NetBanking</span>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Directory */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Col 1: Brand & Organizer (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Link to="/" className="inline-block">
              <BrandLogo size={24} subtitle="Audience Investment Platform" />
            </Link>

            <p className="text-zinc-500 text-xs leading-relaxed max-w-sm">
              <strong>The Big Pitch</strong> is an interactive startup pitching competition and live audience allocation platform organized under <strong>Sphinx 2026</strong> and the <strong>Entrepreneurship Cell (E-Cell)</strong> at MNIT Jaipur.
            </p>

            <div className="space-y-1.5 text-[11px] text-zinc-500 pt-1">
              <div className="flex items-start gap-2">
                <MapPin size={13} className="text-zinc-400 flex-shrink-0 mt-0.5" />
                <span>Malaviya National Institute of Technology (MNIT), JLN Marg, Jaipur, Rajasthan — 302017, India</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-zinc-400 flex-shrink-0" />
                <a href="mailto:ecell.nitjaipur@gmail.com" className="font-mono text-zinc-800 font-semibold hover:underline">
                  ecell.nitjaipur@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* Col 2: Legal & Policies (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="font-black text-xs text-zinc-950 uppercase tracking-wider">
              Legal & Policies
            </h4>
            <ul className="space-y-2 text-xs font-medium text-zinc-600">
              <li>
                <Link to="/terms" className="hover:text-zinc-950 transition-colors flex items-center justify-between group">
                  <span>Terms & Conditions</span>
                  <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-zinc-950 transition-colors flex items-center justify-between group">
                  <span>Privacy Policy</span>
                  <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                </Link>
              </li>
              <li>
                <Link to="/terms#refunds" className="hover:text-zinc-950 transition-colors flex items-center justify-between group text-zinc-500">
                  <span>• Cancellation & Refunds</span>
                  <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                </Link>
              </li>
              <li>
                <Link to="/terms#delivery" className="hover:text-zinc-950 transition-colors flex items-center justify-between group text-zinc-500">
                  <span>• Shipping & Delivery</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 font-bold uppercase">Digital</span>
                </Link>
              </li>
              <li>
                <Link to="/terms#contact" className="hover:text-zinc-950 transition-colors flex items-center justify-between group text-zinc-500">
                  <span>• Contact Information</span>
                  <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Platform Navigation (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="font-black text-xs text-zinc-950 uppercase tracking-wider">
              Platform
            </h4>
            <ul className="space-y-2 text-xs font-medium text-zinc-600">
              <li>
                <Link to="/" className="hover:text-zinc-950 transition-colors">Startups Lineup</Link>
              </li>
              <li>
                <Link to="/live" className="hover:text-zinc-950 transition-colors">Live Stage Pitch</Link>
              </li>
              <li>
                <Link to="/scoreboard" className="hover:text-zinc-950 transition-colors">Scoreboard & Awards</Link>
              </li>
              <li>
                <Link to="/wallet" className="hover:text-zinc-950 transition-colors">My Points & Top-Up</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal Disclaimer & Copyright */}
        <div className="mt-10 pt-6 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
          <p>
            © {new Date().getFullYear()} <strong>The Big Pitch</strong> • Sphinx 2026, E-Cell. All rights reserved.
          </p>

          <p className="text-center sm:text-right max-w-md text-zinc-400">
            Points purchased or used are digital simulation tokens solely for event participation and hold zero monetary redemption value or startup equity.
          </p>
        </div>
      </div>
    </footer>
  )
}
