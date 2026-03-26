
'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Info } from 'lucide-react';

interface BillingCheckoutProps {
  onBack: () => void;
  planId: string | null;
  initialBillingCycle?: 'monthly' | 'yearly';
}

type MaxTier = '5x' | '20x';

const YEARLY_DISCOUNT = 0.17;

const PLAN_DETAILS: Record<string, { name: string, monthly: number, yearly: number }> = {
  go: { name: "Go plan", monthly: 299, yearly: Math.round(299 * 12 * (1 - YEARLY_DISCOUNT)) },
  pro: { name: "Pro plan", monthly: 2499, yearly: Math.round(2499 * 12 * (1 - YEARLY_DISCOUNT)) },
  max: { name: "Max plan", monthly: 9999, yearly: Math.round(9999 * 12 * (1 - YEARLY_DISCOUNT)) },
  team: { name: "Team plan", monthly: 1999, yearly: Math.round(1999 * 12 * (1 - YEARLY_DISCOUNT)) },
};

const MAX_TIER_DETAILS: Record<MaxTier, { label: string; monthly: number; badge?: string }> = {
  '5x': { label: '5x more usage than Pro', monthly: 9999 },
  '20x': { label: '20x more usage than Pro', monthly: 19999, badge: 'Save 50%' },
};

function getRenewalDate(billingCycle: 'monthly' | 'yearly') {
  const today = new Date();
  const renewalDate = new Date(today);

  if (billingCycle === 'monthly') {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  } else {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  }

  return renewalDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function BillingCheckout({ onBack, planId, initialBillingCycle = 'monthly' }: BillingCheckoutProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(initialBillingCycle);
  const [maxTier, setMaxTier] = useState<MaxTier>('5x');
  const [useDifferentName, setUseDifferentName] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const activePlanId = planId || 'pro';
  const details = PLAN_DETAILS[activePlanId] || PLAN_DETAILS.pro;
  const isMaxPlan = activePlanId === 'max';
  const maxDetails = MAX_TIER_DETAILS[maxTier];

  useEffect(() => {
    setBillingCycle(initialBillingCycle);
  }, [initialBillingCycle, activePlanId]);

  const currentPrice = isMaxPlan
    ? maxDetails.monthly
    : billingCycle === 'monthly'
      ? details.monthly
      : details.yearly;
  const cycleLabel = isMaxPlan ? '/month' : billingCycle === 'monthly' ? '/month' : '/year';
  
  const subtotal = currentPrice;
  const tax = Math.round(subtotal * 0.18); // 18% GST
  const total = subtotal + tax;
  const renewalDate = getRenewalDate(isMaxPlan ? 'monthly' : billingCycle);

  const formatPrice = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  return (
    <div className="w-full h-full bg-[#FAF9F5] font-sans text-[#3D3D3A] overflow-y-auto animate-in fade-in duration-500">
      <header className="flex items-center justify-center py-8 relative w-full shrink-0">
        <div className="absolute left-4 top-10">
          <button 
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#3D3D3A] transition-all"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
              <path d="M228,128a12,12,0,0,1-12,12H69l51.52,51.51a12,12,0,0,1-17,17l-72-72a12,12,0,0,1,0-17l72-72a12,12,0,0,1,17,17L69,116H216A12,12,0,0,1,228,128Z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-[512px] mx-auto w-full px-4 flex flex-col pb-24 pt-8">
        <h1 className="text-[24px] font-medium mb-6">{details.name}</h1>

        <div className="grid gap-4 mb-4">
          {isMaxPlan ? (
            <div className="grid grid-cols-2 gap-4 bg-[#FAF9F5]">
              {(Object.entries(MAX_TIER_DETAILS) as Array<[MaxTier, typeof MAX_TIER_DETAILS[MaxTier]]>).map(([tier, tierDetails]) => (
                <button
                  key={tier}
                  onClick={() => setMaxTier(tier)}
                  className={cn(
                    "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-all",
                    maxTier === tier
                      ? "border-[#2C84DB] bg-[#D3E5F8]"
                      : "border-[#1F1E1D]/15 bg-transparent hover:border-black/30"
                  )}
                >
                  <div className="mb-3 flex w-full items-center justify-between">
                    <div className={cn(
                      "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
                      maxTier === tier ? "border-[#2C84DB]" : "border-black/15"
                    )}>
                      {maxTier === tier && <div className="h-2.5 w-2.5 rounded-full bg-[#2C84DB]" />}
                    </div>
                    {tierDetails.badge && (
                      <div className="rounded-lg bg-[#1B67B2]/10 px-2 py-1 text-[12px] font-medium leading-4 text-[#1B67B2]">
                        {tierDetails.badge}
                      </div>
                    )}
                  </div>
                  <span className="max-w-[75%] text-left font-medium">{tierDetails.label}</span>
                  <span className="mt-1 text-left text-[14px] leading-5 text-[#3D3D3A]">
                    {formatPrice(tierDetails.monthly)}/month + tax
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-all",
                  billingCycle === 'monthly'
                    ? "border-[#2C84DB] bg-[#D3E5F8]"
                    : "border-[#1F1E1D]/15 bg-transparent hover:border-black/30"
                )}
              >
                <div className="mb-3 flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
                    billingCycle === 'monthly' ? "border-[#2C84DB]" : "border-black/15"
                  )}>
                    {billingCycle === 'monthly' && <div className="h-2.5 w-2.5 rounded-full bg-[#2C84DB]" />}
                  </div>
                </div>
                <span className="max-w-[75%] text-left font-medium">Monthly</span>
                <span className="mt-1 text-left text-[14px] leading-5 text-[#3D3D3A]">
                  {formatPrice(details.monthly)}/month + tax
                </span>
              </button>

              <button 
                onClick={() => setBillingCycle('yearly')}
                className={cn(
                  "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-all",
                  billingCycle === 'yearly'
                    ? "border-[#2C84DB] bg-[#D3E5F8]"
                    : "border-[#1F1E1D]/15 bg-transparent hover:border-black/30"
                )}
              >
                <div className="mb-3 flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
                    billingCycle === 'yearly' ? "border-[#2C84DB]" : "border-black/15"
                  )}>
                    {billingCycle === 'yearly' && <div className="h-2.5 w-2.5 rounded-full bg-[#2C84DB]" />}
                  </div>
                  <div className="rounded-lg bg-[#1B67B2]/10 px-2 py-1 text-[12px] font-medium leading-4 text-[#1B67B2]">
                    Save 17%
                  </div>
                </div>
                <span className="max-w-[75%] text-left font-medium">Yearly</span>
                <span className="mt-1 text-left text-[14px] leading-5 text-[#3D3D3A]">
                  {formatPrice(details.yearly)}/year + tax
                </span>
              </button>
            </div>
          )}

          <div className="bg-[#F5F4ED] border border-black/10 rounded-xl p-5 flex flex-col gap-4 text-[14px]">
            <div className="font-semibold">Order details</div>
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-medium">{details.name}</span>
                <span className="text-[#73726C]">
                  {isMaxPlan ? maxDetails.label : billingCycle === 'monthly' ? 'Monthly' : 'Annually'}
                </span>
              </div>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            <div className="h-px bg-black/10 w-full" />
            <div className="flex justify-between items-center font-medium"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between items-center font-medium"><span>Tax</span><span>{formatPrice(tax)}</span></div>
            <div className="h-px bg-black/10 w-full" />
            <div className="flex justify-between items-center font-bold"><span>Total due today</span><span>{formatPrice(total)}</span></div>
          </div>

          <div className="border border-black/10 rounded-xl p-5 flex gap-4 bg-white">
            <Info className="shrink-0 mt-0.5 text-[#73726C] w-4 h-4" />
            <p className="text-[14px] leading-relaxed">
              Your subscription will auto renew on {renewalDate}. You will be charged <span className="font-semibold">{formatPrice(total)} today and {formatPrice(total)}{cycleLabel} including tax on renewal</span>.
            </p>
          </div>

          <form className="bg-[#FAF9F5] border border-black/10 rounded-[20px] p-6 flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
            <div className="font-semibold text-[18px]">Payment method</div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#3D3D3A]">Full name</label>
              <input type="text" defaultValue="Revlon" className="h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#3D3D3A]">Country or region</label>
              <select className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all appearance-none"><option value="IN">India</option></select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#3D3D3A]">Address</label>
              <input type="text" className="h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#3D3D3A]">Card number</label>
              <input type="text" placeholder="1234 1234 1234 1234" className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5"><label className="text-[14px] font-medium text-[#3D3D3A]">Expiration date</label><input type="text" placeholder="MM / YY" className="h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" /></div>
              <div className="flex flex-col gap-1.5"><label className="text-[14px] font-medium text-[#3D3D3A]">Security code</label><input type="text" placeholder="CVC" className="h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" /></div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={useDifferentName} onChange={(e) => setUseDifferentName(e.target.checked)} className="w-4 h-4 rounded border-black/30 accent-black" />
                <span className="text-[14px] text-[#3D3D3A]">Use a different name on invoices</span>
              </label>
            </div>
            {useDifferentName && (
              <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[14px] font-medium text-[#3D3D3A]">Bill to</label>
                <input type="text" placeholder="Company or individual name" className="h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4 border-t border-black/5">
              <div>
                <div className="text-[14px] font-medium text-[#3D3D3A]">Business tax ID (Optional)</div>
                <div className="text-[12px] text-[#73726C] mt-0.5">If you provide a tax ID, the "Full name" above should be your business's name.</div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[14px] text-[#3D3D3A] whitespace-nowrap">Indian GST number</label>
                <input type="text" placeholder="12ABCDE3456FGZH" className="flex-1 h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
              </div>
            </div>

            <div className="pt-4 border-t border-black/5">
              <label className="flex items-start gap-3 cursor-pointer group select-none">
                <div className="mt-0.5 shrink-0"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-4 h-4 rounded border-black/30" /></div>
                <span className="text-[12px] leading-relaxed text-[#73726C]">
                  You agree that Clauxen will charge your card in the amount above now and on a recurring {isMaxPlan ? 'monthly' : billingCycle === 'monthly' ? 'monthly' : 'annual'} basis until you cancel.
                </span>
              </label>
              <button disabled={!agreed} className={cn("w-full h-11 mt-6 rounded-xl font-medium transition-all text-white", agreed ? "bg-black hover:bg-black/90" : "bg-black/30 cursor-not-allowed")}>Subscribe</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
