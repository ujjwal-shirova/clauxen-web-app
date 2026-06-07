
'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/frontend/lib/utils';
import { appBtn } from '@/frontend/lib/app-buttons';
import { Info } from 'lucide-react';
import {
  createBillingOrder,
  getBillingPlans, // GET plans list — server-side canonical price_paise values fetch
  verifyBillingPayment, // POST verify — Razorpay signature validate + subscription activate
  type BillingPlan, // TypeScript type — API plan object shape (id, price_paise_monthly/yearly)
} from '@/frontend/lib/api/billing';
import { openRazorpayCheckout } from '@/frontend/lib/razorpay-checkout';
import { useAuth } from '@/frontend/hooks/use-auth';

export type MaxTier = '5x' | '20x';

interface BillingCheckoutProps {
  onBack: () => void;
  onPaymentSuccess?: () => void;
  planId: string | null;
  initialBillingCycle?: 'monthly' | 'yearly';
  initialMaxTier?: MaxTier;
}

const YEARLY_DISCOUNT = 0.17;

const PLAN_DETAILS: Record<string, { name: string, monthly: number, yearly: number }> = {
  go: { name: "Go plan", monthly: 99, yearly: Math.round(99 * 12 * (1 - YEARLY_DISCOUNT)) },
  pro: { name: "Pro plan", monthly: 2499, yearly: Math.round(2499 * 12 * (1 - YEARLY_DISCOUNT)) }, // Pro tier — default checkout plan
  max: { name: "Max plan", monthly: 9999, yearly: Math.round(9999 * 12 * (1 - YEARLY_DISCOUNT)) },
  'business-workspace': { name: "Business workspace", monthly: 1800, yearly: Math.round(1800 * 12 * (1 - YEARLY_DISCOUNT)) }, // Business workspace per-seat pricing
  'business-code': { name: "Business Clauxen Code", monthly: 0, yearly: 0 },
  enterprise: { name: "Enterprise", monthly: 0, yearly: 0 },
};

// Max plan sub-options — UI cards + monthly rupee amounts
const MAX_TIER_DETAILS: Record<MaxTier, { label: string; monthly: number; badge?: string }> = {
  '5x': { label: '5x more usage than Pro', monthly: 9999 },
  '20x': { label: '20x more usage than Pro', monthly: 19999, badge: 'Save 50%' },
};

function getRenewalDate(billingCycle: 'monthly' | 'yearly') {
  const today = new Date();
  const renewalDate = new Date(today);

  if (billingCycle === 'monthly') {
    renewalDate.setMonth(renewalDate.getMonth() + 1); // calendar month increment — JS rollover handle
  } else {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1); // calendar year increment
  }

  return renewalDate.toLocaleDateString('en-IN', { // India date string — user-facing renewal notice
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function BillingCheckout({
  onBack,
  onPaymentSuccess,
  planId,
  initialBillingCycle = 'monthly',
  initialMaxTier = '5x',
}: BillingCheckoutProps) {
  const auth = useAuth(); // auth context — displayName/email Razorpay prefill
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(initialBillingCycle); // UI state — monthly vs yearly toggle
  const [maxTier, setMaxTier] = useState<MaxTier>(initialMaxTier); // UI state — Max plan 5x vs 20x
  const [useDifferentName, setUseDifferentName] = useState(false);
  const [agreed, setAgreed] = useState(false); // terms checkbox — Subscribe button enable gate
  const [apiPlans, setApiPlans] = useState<BillingPlan[]>([]); // server plans — canonical paise prices
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null); // error message — order/create/verify failures

  const activePlanId = planId || 'pro'; // resolved plan slug — null guard pro default
  const details = PLAN_DETAILS[activePlanId] || PLAN_DETAILS.pro; // display metadata — name + fallback rupees
  const isMaxPlan = activePlanId === 'max';
  const isUsageCodePlan = activePlanId === 'business-code'; // metered Clauxen Code flow
  const isEnterprisePlan = activePlanId === 'enterprise'; // custom enterprise quote flow
  const isVariableCheckoutPlan = isUsageCodePlan || isEnterprisePlan;
  const maxDetails = MAX_TIER_DETAILS[maxTier];

  useEffect(() => {
    setBillingCycle(initialBillingCycle);
  }, [initialBillingCycle, activePlanId]); // Re-run when cycle prop or plan changes

  useEffect(() => {
    if (activePlanId === 'max') {
      setMaxTier(initialMaxTier);
    }
  }, [activePlanId, initialMaxTier]); // Dependencies — plan switch + tier prop

  useEffect(() => {
    void getBillingPlans()
      .then((res) => setApiPlans(res.plans ?? []))
      .catch(() => setApiPlans([])); // failure — empty; PLAN_DETAILS fallback
  }, []);

  const apiPlan = apiPlans.find((p) => p.id === (isMaxPlan ? (maxTier === '20x' ? 'max20x' : 'max5x') : activePlanId)); // Match API plan row — max5x/max20x mapping for Max
  const apiMonthlyPaise = apiPlan?.price_paise_monthly; // Server monthly price in paise (₹1 = 100 paise)
  const apiYearlyPaise = apiPlan?.price_paise_yearly; // Server yearly lump-sum price in paise

  const currentPrice = isMaxPlan
    ? maxDetails.monthly // Max always monthly list price from tier
    : isVariableCheckoutPlan
      ? 0 // Variable plans — no fixed rupee amount at checkout
      : billingCycle === 'monthly'
        ? details.monthly // Standard monthly rupee price
        : details.yearly; // Standard yearly rupee price (already discounted)
  const cycleLabel = isMaxPlan ? '/month' : billingCycle === 'monthly' ? '/month' : '/year';
  
  const subtotal = currentPrice;
  const tax = isVariableCheckoutPlan ? 0 : Math.round(subtotal * 0.18);
  const total = subtotal + tax;
  const renewalDate = getRenewalDate(isMaxPlan ? 'monthly' : billingCycle);

  const formatPrice = (val: number) => `₹${val.toLocaleString('en-IN')}`; // INR format helper — en-IN locale grouping

  const subtotalPaise = // Amount sent to createBillingOrder — prefer API paise, else rupees×100
    apiMonthlyPaise != null
      ? billingCycle === 'yearly' && apiYearlyPaise
        ? apiYearlyPaise // Yearly — server yearly paise lump sum
        : apiMonthlyPaise * (isMaxPlan ? 1 : billingCycle === 'yearly' ? 12 : 1) // Monthly or 12× monthly for yearly fallback
      : Math.round(subtotal * 100); // Fallback — rupees to paise conversion

  const handleSubscribe = async () => {
    if (!agreed || isVariableCheckoutPlan || paying) return;
    setPayError(null);
    setPaying(true); // button disable + loading label
    try {
      const checkout = await createBillingOrder({ // Backend Razorpay order create
        planId: isMaxPlan ? (maxTier === '20x' ? 'max20x' : 'max5x') : activePlanId, // Resolved API plan id
        planName: details.name, // Human-readable plan name for records
        billingCycle: isMaxPlan ? 'monthly' : billingCycle, // Max always monthly billing cycle
        amountPaise: subtotalPaise, // Charge amount in paise
        maxTier: isMaxPlan ? maxTier : undefined, // Optional metadata for Max tier
      });
      const keyId = checkout.razorpay.keyId; // Razorpay public key — checkout.js init
      if (!keyId) throw new Error('Razorpay is not configured for checkout.'); // misconfiguration guard — key missing

      await openRazorpayCheckout({
        keyId, // Razorpay key_id
        orderId: checkout.razorpay.orderId, // Server-created order id
        amount: checkout.razorpay.amount, // Amount in paise (must match order)
        currency: checkout.razorpay.currency, // Typically INR
        name: 'Clauxen', // Merchant display name in modal
        description: details.name, // Payment description line
        prefill: { // Optional customer prefill — faster checkout
          name: auth.user?.displayName ?? undefined, // Logged-in display name
          email: auth.user?.email ?? undefined, // Logged-in email
        },
        onSuccess: async (payment) => { // Razorpay success — server-side signature verify
          await verifyBillingPayment({ // POST verify — subscription activate
            razorpayOrderId: payment.razorpay_order_id,
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpaySignature: payment.razorpay_signature,
          });
          onPaymentSuccess?.(); // parent notify — subscription UI refresh
        },
      });
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Payment failed.'); // user-visible error string
    } finally {
      setPaying(false);
    }
  };

  const orderLinePriceLabel = isUsageCodePlan
    ? 'Usage pricing'
    : isEnterprisePlan
      ? 'Custom quote'
      : formatPrice(subtotal); // fixed plans — formatted INR subtotal

  return (
    <div className="w-full h-full bg-zinc-50 font-sans text-zinc-800 overflow-y-auto animate-in fade-in duration-500"> {/* root scroll — warm background + fade-in */}
      <header className="flex items-center justify-center py-8 relative w-full shrink-0"> {/* top bar — back button position */}
        <div className="absolute left-4 top-10"> {/* back button — top-left absolute */}
          <button 
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-800 transition-all"
            aria-label="Back" // screen reader label
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"> 
              <path d="M228,128a12,12,0,0,1-12,12H69l51.52,51.51a12,12,0,0,1-17,17l-72-72a12,12,0,0,1,0-17l72-72a12,12,0,0,1,17,17L69,116H216A12,12,0,0,1,228,128Z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-[512px] mx-auto w-full px-4 flex flex-col pb-24 pt-8"> {/* centered column — max 512px */}
        <h1 className="text-[24px] font-medium mb-6">{details.name}</h1> {/* plan title heading */}

        <div className="grid gap-4 mb-4"> {/* main stack — cycle/tier + summary + form */}
          {isMaxPlan ? ( // Max plan — 5x vs 20x tier cards
            <div className="grid grid-cols-2 gap-4 bg-zinc-50">
              {(Object.entries(MAX_TIER_DETAILS) as Array<[MaxTier, typeof MAX_TIER_DETAILS[MaxTier]]>).map(([tier, tierDetails]) => ( // Max tiers iterate
                <button
                  key={tier} // React list key — tier id
                  onClick={() => setMaxTier(tier)}
                  className={cn(
                    "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-all",
                    maxTier === tier
                      ? "border-[#2C84DB] bg-[#D3E5F8]" // selected — blue border + tint
                      : "border-zinc-200 bg-transparent hover:border-black/30" // unselected — subtle border
                  )}
                >
                  <div className="mb-3 flex w-full items-center justify-between"> {/* radio + optional badge row */}
                    <div className={cn(
                      "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
                      maxTier === tier ? "border-[#2C84DB]" : "border-black/15" // custom radio outer ring
                    )}>
                      {maxTier === tier && <div className="h-2.5 w-2.5 rounded-full bg-[#2C84DB]" />} 
                    </div>
                    {tierDetails.badge && (
                      <div className="rounded-lg bg-[#1B67B2]/10 px-2 py-1 text-[12px] font-medium leading-4 text-[#1B67B2]">
                        {tierDetails.badge}
                      </div>
                    )}
                  </div>
                  <span className="max-w-[75%] text-left font-medium">{tierDetails.label}</span> {/* tier marketing label */}
                  <span className="mt-1 text-left text-[14px] leading-5 text-zinc-800">
                    {formatPrice(tierDetails.monthly)}/month + tax {/* monthly price line */}
                  </span>
                </button>
              ))}
            </div>
          ) : isVariableCheckoutPlan ? (
            <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-4 text-[14px] leading-relaxed text-zinc-800">
              {isUsageCodePlan ? (
                <p>
                  <strong>Usage pricing:</strong> Clauxen Code usage is metered and invoiced on actual use. There is no fixed seat charge at checkout; our team confirms rates when your workspace is activated.
                </p>
              ) : (
                <p>
                  <strong>Enterprise:</strong> Pricing and contract terms are prepared for your organization. Submit your details below—no card charge until a quote is accepted.
                </p>
              )}
            </div>
          ) : ( // standard plans — monthly vs yearly toggle cards
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setBillingCycle('monthly')} // monthly billing select
                className={cn(
                  "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-all",
                  billingCycle === 'monthly'
                    ? "border-[#2C84DB] bg-[#D3E5F8]"
                    : "border-zinc-200 bg-transparent hover:border-black/30"
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
                <span className="mt-1 text-left text-[14px] leading-5 text-zinc-800">
                  {formatPrice(details.monthly)}/month + tax
                </span>
              </button>

              <button 
                onClick={() => setBillingCycle('yearly')} // yearly billing — 17% savings badge
                className={cn(
                  "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-all",
                  billingCycle === 'yearly'
                    ? "border-[#2C84DB] bg-[#D3E5F8]"
                    : "border-zinc-200 bg-transparent hover:border-black/30"
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
                <span className="mt-1 text-left text-[14px] leading-5 text-zinc-800">
                  {formatPrice(details.yearly)}/year + tax
                </span>
              </button>
            </div>
          )}

          <div className="bg-zinc-50 border border-black/10 rounded-xl p-5 flex flex-col gap-4 text-[14px]"> {/* order summary card */}
            <div className="font-semibold">Order details</div>
            <div className="flex justify-between items-center"> {/* line item — plan name + price */}
              <div className="flex flex-col">
                <span className="font-medium">{details.name}</span>
                <span className="text-zinc-500">
                  {isMaxPlan
                    ? maxDetails.label
                    : isVariableCheckoutPlan
                      ? 'Details confirmed at activation'
                      : billingCycle === 'monthly'
                        ? 'Monthly'
                        : 'Annually'}
                </span>
              </div>
              <span className="font-semibold">{isVariableCheckoutPlan ? orderLinePriceLabel : formatPrice(subtotal)}</span>
            </div>
            <div className="h-px bg-black/10 w-full" /> {/* divider */}
            <div className="flex justify-between items-center font-medium"><span>Subtotal</span><span>{isVariableCheckoutPlan ? orderLinePriceLabel : formatPrice(subtotal)}</span></div>
            <div className="flex justify-between items-center font-medium"><span>Tax</span><span>{formatPrice(tax)}</span></div>
            <div className="h-px bg-black/10 w-full" />
            <div className="flex justify-between items-center font-bold"><span>Total due today</span><span>{isVariableCheckoutPlan ? formatPrice(0) : formatPrice(total)}</span></div>
          </div>

          <div className="border border-black/10 rounded-xl p-5 flex gap-4 bg-white"> {/* renewal / variable-plan info notice */}
            <Info className="icon-md shrink-0 mt-0.5 icon-muted" />
            <p className="text-[14px] leading-relaxed">
              {isVariableCheckoutPlan ? (
                <>
                  No automatic renewal charge applies until a fixed price or usage schedule is agreed. Use the form below so we can follow up on next steps.
                </>
              ) : (
                <>
                  Your subscription will auto renew on {renewalDate}. You will be charged <span className="font-semibold">{formatPrice(total)} today and {formatPrice(total)}{cycleLabel} including tax on renewal</span>.
                </>
              )}
            </p>
          </div>

          <form className="bg-zinc-50 border border-black/10 rounded-[20px] p-6 flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}> {/* payment form — native submit block; Razorpay actual charge */}
            <div className="font-semibold text-[18px]">Payment method</div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-zinc-800">Full name</label>
              <input type="text" defaultValue="Revlon" className="h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" /> 
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-zinc-800">Country or region</label>
              <select className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all appearance-none"><option value="IN">India</option></select> 
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-zinc-800">Address</label>
              <input type="text" className="h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-zinc-800">Card number</label>
              <input type="text" placeholder="1234 1234 1234 1234" className="w-full h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" /> 
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5"><label className="text-[14px] font-medium text-zinc-800">Expiration date</label><input type="text" placeholder="MM / YY" className="h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" /></div>
              <div className="flex flex-col gap-1.5"><label className="text-[14px] font-medium text-zinc-800">Security code</label><input type="text" placeholder="CVC" className="h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" /></div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={useDifferentName} onChange={(e) => setUseDifferentName(e.target.checked)} className="w-4 h-4 rounded border-black/30 accent-black" /> {/* alternate invoice name field toggle */}
                <span className="text-[14px] text-zinc-800">Use a different name on invoices</span>
              </label>
            </div>
            {useDifferentName && ( // conditional "Bill to" field — animated reveal
              <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[14px] font-medium text-zinc-800">Bill to</label>
                <input type="text" placeholder="Company or individual name" className="h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4 border-t border-black/5"> {/* optional GSTIN — B2B India tax ID */}
              <div>
                <div className="text-[14px] font-medium text-zinc-800">Business tax ID (Optional)</div>
                <div className="text-[12px] text-zinc-500 mt-0.5">If you provide a tax ID, the "Full name" above should be your business's name.</div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[14px] text-zinc-800 whitespace-nowrap">Indian GST number</label>
                <input type="text" placeholder="12ABCDE3456FGZH" className="flex-1 h-11 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
              </div>
            </div>

            <div className="pt-4 border-t border-black/5"> {/* terms agreement + Subscribe CTA */}
              <label className="flex items-start gap-3 cursor-pointer group select-none">
                <div className="mt-0.5 shrink-0"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-4 h-4 rounded border-black/30" /></div> {/* required consent checkbox */}
                <span className="text-[12px] leading-relaxed text-zinc-500">
                  You agree that Clauxen will charge your card in the amount above now and on a recurring {isMaxPlan ? 'monthly' : billingCycle === 'monthly' ? 'monthly' : 'annual'} basis until you cancel.
                </span>
              </label>
              <button
                type="button"
                disabled={!agreed || isVariableCheckoutPlan || paying}
                onClick={() => void handleSubscribe()}
                className={cn(
                  "mt-6",
                  agreed && !isVariableCheckoutPlan && !paying
                    ? appBtn.primaryLg
                    : "app-btn app-btn-lg w-full h-11 rounded-xl font-medium bg-zinc-300 text-white cursor-not-allowed",
                )}
              >
                {paying ? 'Opening checkout…' : 'Subscribe'} {/* loading vs default label */}
              </button>
              {payError && ( // inline payment error
                <p className="mt-2 text-center text-[12px] text-red-600">{payError}</p>
              )}
              {isVariableCheckoutPlan && (
                <p className="mt-3 text-center text-[12px] text-zinc-500">
                  Card charges are disabled for this plan until pricing is confirmed.
                </p>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
