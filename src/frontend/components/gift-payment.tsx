'use client';

import React from 'react';
import { Info, Lock, ChevronDown } from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';

interface GiftPaymentProps {
  onBack: () => void;
  currentDurationLabel: string;
}

const indianStates = [
  "Andaman & Nicobar", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
  "Chandigarh", "Chhattisgarh", "Dadra & Nagar Haveli & Daman & Diu", "Delhi", 
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", 
  "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", 
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal"
];

export function GiftPayment({ onBack, currentDurationLabel }: GiftPaymentProps) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <h1 className="text-[28px] font-serif font-medium text-[#3D3D3A] mb-6">
        Review your details
      </h1>

      {/* Payment Method Section */}
      <div className="p-4 rounded-xl border border-black/15 mb-4 bg-white">
        <h2 className="text-[14px] font-semibold text-[#3D3D3A] mb-4">Payment method</h2>
        
        {/* Stripe-like Tabs */}
        <div className="flex p-1 bg-[#F0EEE6] rounded-lg mb-4">
          <button className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-white shadow-sm text-[14px] font-semibold text-[#0570DE] ring-1 ring-[#0570DE]">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H0zm0 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6H0zm3 5a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1z" clipRule="evenodd" />
            </svg>
            Card
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[14px] font-semibold text-[#5A5A58] hover:bg-black/5 transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M5 7.5V14h1.5V7.5h3V14H11V7.5h3V14h1a1 1 0 0 1 1 1v1H0v-1a1 1 0 0 1 1-1h1V7.5h3zM8 0c4.681 2.572 7.181 3.95 7.5 4.134A1 1 0 0 1 14.98 6H1.02A1 1 0 0 1 .5 4.134C.82 3.95 3.32 2.572 8 0z" clipRule="evenodd" />
            </svg>
            US bank account
          </button>
        </div>

        {/* Link Prompt */}
        <button className="w-full flex items-center justify-center py-3 px-4 mb-4 border border-black/10 rounded-lg hover:bg-black/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#00D66F] rounded-sm flex items-center justify-center">
              <Lock className="w-2.5 h-2.5 text-white fill-current" />
            </div>
            <span className="text-[14px] font-semibold text-[#0570DE]">Secure, fast checkout with Link</span>
            <ChevronDown className="w-4 h-4 text-[#0570DE] opacity-60" />
          </div>
        </button>

        {/* Card Fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[14px] font-medium text-[#3D3D3A]">Card number</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="1234 1234 1234 1234"
                className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all pr-24"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-60">
                <img src="https://claude.ai/images/home-page-assets/visa.svg" alt="Visa" className="h-4" />
                <img src="https://claude.ai/images/home-page-assets/mastercard.svg" alt="Mastercard" className="h-4" />
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[14px] font-medium text-[#3D3D3A]">Expiration date</label>
              <input 
                type="text" 
                placeholder="MM / YY"
                className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[14px] font-medium text-[#3D3D3A]">Security code</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="CVC"
                  className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40">
                  <Info className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing Address Section */}
      <div className="p-4 rounded-xl border border-black/15 mb-4 bg-white">
        <h3 className="text-[14px] font-semibold text-[#3D3D3A] mb-4">Billing address</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[14px] font-medium text-[#3D3D3A]">Full name</label>
            <input 
              type="text" 
              placeholder="Full name on card"
              className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[14px] font-medium text-[#3D3D3A]">Country or region</label>
            <div className="relative">
              <select className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all appearance-none">
                <option value="IN">India</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                {/* Simplified list for brevity, can be expanded */}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[14px] font-medium text-[#3D3D3A]">Address</label>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="Address line 1"
                className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
              <input 
                type="text" 
                placeholder="Address line 2 (optional)"
                className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[14px] font-medium text-[#3D3D3A]">City</label>
              <input 
                type="text" 
                placeholder="City"
                className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[14px] font-medium text-[#3D3D3A]">PIN</label>
              <input 
                type="text" 
                placeholder="Postal code"
                className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[14px] font-medium text-[#3D3D3A]">State</label>
            <div className="relative">
              <select className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all appearance-none">
                <option value="">Select State</option>
                {indianStates.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Info */}
      <div className="p-4 bg-[#FAF9F5]/50 border border-black/15 rounded-xl mb-4">
        <p className="text-[14px] text-[#3D3D3A] font-[430]">
          Enter your billing address to see the total.
        </p>
      </div>

      <div className="space-y-4 mb-8 text-[12px] text-[#73726C] leading-relaxed">
        <p>
          Recipients can receive up to 12 months of a gifted plan. If they've already been gifted months, they may not be able to redeem the full amount. <a href="#" className="underline decoration-[#73726C]/30 hover:text-black">Learn more</a>.
        </p>
        <p>
          Your gift subscription will end after {currentDurationLabel} and won’t auto-renew. Unredeemed gifts expire 1 year after purchase. By clicking “Pay now,” you authorize Clauxen to charge your payment method for the amount shown.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
        <Button 
          variant="outline"
          onClick={onBack}
          className="h-10 px-8 border-black/15 text-[#3D3D3A] rounded-xl font-medium"
        >
          Back
        </Button>
        <Button 
          disabled
          className="h-10 px-8 bg-black text-white hover:bg-black/90 rounded-xl font-medium opacity-50 cursor-not-allowed"
        >
          Pay now
        </Button>
      </div>
    </div>
  );
}
