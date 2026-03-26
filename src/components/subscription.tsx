"use client";

import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradePageContentProps {
  onClose: () => void;
  onSelectPlan: (planId: string, billingCycle: BillingCycle) => void;
}

type BillingCycle = 'monthly' | 'yearly';

type Plan = {
  id: string;
  name: string;
  subtitle: string;
  monthlyPrice?: number;
  customPriceLabel?: string;
  description: string;
  buttonLabel: string;
  features: string[];
  isCurrent?: boolean;
  isHighlight?: boolean;
  highlight?: string;
};

const individualPlans: Plan[] = [
  {
    id: 'free',
    name: "Free",
    subtitle: "All core features, free by default",
    monthlyPrice: 0,
    description: "Use the full product with lighter limits",
    buttonLabel: "Your current plan",
    isCurrent: true,
    features: [
      "Chat, write, code, analyze, and search the web",
      "Projects, artifacts, voice, and creative tools included",
      "Create images, videos, music, and canvas with daily limits",
      "Upload files, take screenshots, and organize work in one place",
      "India-friendly everyday help for study, job prep, side hustles, and small business work"
    ]
  },
  {
    id: 'go',
    name: "Go",
    subtitle: "Higher limits for everyday power users",
    monthlyPrice: 299,
    description: "Everything you already use, with more room to work",
    buttonLabel: "Get Go plan",
    highlight: "Everything in Free, plus:",
    features: [
      "Extended usage quota across chat, uploads, and creative generation",
      "2x projects, artifacts, and voice usage for regular daily workflows",
      "2x image, video, music, and canvas creation quota",
      "Faster responses and steadier availability during busy hours",
      "Built for Indian students, creators, consultants, and founders managing work in English plus regional context"
    ]
  },
  {
    id: 'pro',
    name: "Pro",
    subtitle: "Premium models and much higher limits",
    monthlyPrice: 2499,
    description: "For professionals who rely on Clauxen every day",
    buttonLabel: "Get Pro plan",
    highlight: "Everything in Go and:",
    features: [
      "Based on Go with much higher quota across every tool*",
      "Access to the latest premium models for reasoning, coding, and creation",
      "Agent multi-tasking, deeper research, and higher upload capacity",
      "Priority access during peak hours with faster premium inference",
      "Expanded project, artifact, and automation-style workflow capacity",
      "Generated music content eligible for commercial use",
      "Powerful for agencies, researchers, devs, CA teams, and startup operators in India"
    ]
  },
  {
    id: 'max',
    name: "Max",
    subtitle: "Choose Max 5x or Max 20x",
    monthlyPrice: 9999,
    customPriceLabel: "+",
    description: "The highest limits for advanced users and AI-first operators",
    buttonLabel: "Get Max plan",
    isHighlight: true,
    highlight: "Everything in Pro, plus:",
    features: [
      "Choose Max 5x or Max 20x usage compared with Pro*",
      "Highest quota for research, coding, and image, video, music, and canvas creation",
      "Fastest access to latest premium models and highest priority during peak hours",
      "Research preview features, advanced agent workflows, and early access experiments",
      "Generated music content eligible for commercial use",
      "Best for heavy operators running batch tasks, large searches, long writing, and multi-client work"
    ]
  }
];

const teamPlans: Plan[] = [
  {
    id: 'team',
    name: "Team",
    subtitle: "Shared workspace with Max 5x included",
    monthlyPrice: 1999,
    description: "5-150 users",
    buttonLabel: "Get Team plan",
    isHighlight: true,
    highlight: "Standard seat includes:",
    features: [
      "Everything in Max 5x for every seat",
      "Shared team workspaces, projects, artifacts, and internal knowledge",
      "Connectors, skills, admin controls, and deployment-ready workflows",
      "Central billing, seat management, and team-wide usage visibility",
      "Team workspace data is not used in training by Shirova",
      "Generated music content eligible for commercial use",
      "Built for Indian startups, agencies, ops teams, and modern businesses scaling together"
    ]
  },
  {
    id: 'enterprise',
    name: "Enterprise",
    subtitle: "Security, control, and custom scale",
    customPriceLabel: "Custom",
    description: "20+ users",
    buttonLabel: "Contact sales",
    highlight: "Everything in Team, plus:",
    features: [
      "Pooled usage, custom limit structures, and flexible commercial terms",
      "SSO, advanced access control, governance, and enterprise admin flows",
      "Audit-ready operations, rollout controls, and managed workspace policies",
      "Custom onboarding, procurement, invoicing, and dedicated support",
      "Workspace privacy, compliance, and control at organizational scale",
      "Ideal for large enterprises, BPOs, IT services, and regulated teams across India"
    ]
  }
];

const YEARLY_DISCOUNT = 0.17;

function getYearlyPrice(monthlyPrice: number) {
  return Math.round(monthlyPrice * 12 * (1 - YEARLY_DISCOUNT));
}

function getPlanPrice(plan: Plan, billingCycle: BillingCycle) {
  if (typeof plan.monthlyPrice !== 'number') {
    return null;
  }

  return billingCycle === 'monthly' ? plan.monthlyPrice : getYearlyPrice(plan.monthlyPrice);
}

function formatPlanPrice(plan: Plan, billingCycle: BillingCycle) {
  if (plan.customPriceLabel === 'Custom') {
    return 'Custom';
  }

  const price = getPlanPrice(plan, billingCycle);

  if (price === null) {
    return '';
  }

  return price.toLocaleString('en-IN');
}

export default function UpgradePageContent({ onClose, onSelectPlan }: UpgradePageContentProps) {
  const [activeTab, setActiveTab] = React.useState<'individual' | 'team'>('individual');
  const [planBillingCycles, setPlanBillingCycles] = React.useState<Record<string, BillingCycle>>({
    go: 'monthly',
    pro: 'monthly',
  });

  const currentPlans = activeTab === 'individual' ? individualPlans : teamPlans;
  const getBillingCycleForPlan = (planId: string): BillingCycle => planBillingCycles[planId] ?? 'monthly';
  const setBillingCycleForPlan = (planId: string, billingCycle: BillingCycle) => {
    setPlanBillingCycles((current) => ({
      ...current,
      [planId]: billingCycle,
    }));
  };

  return (
    <div className="w-full h-full bg-[#FAF9F5] font-sans text-[#3D3D3A] overflow-y-auto">
      <header className="flex items-center justify-center py-5 relative w-full sticky top-0 bg-[#FAF9F5]/80 backdrop-blur-md z-20">
        <button 
          onClick={onClose} 
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-black/5 rounded-lg transition-all"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[24px] md:text-[30px] font-medium leading-[36px]">Plans that grow with you</h1>
      </header>

      <main className="max-w-[1200px] mx-auto w-full px-2 md:px-2 flex flex-col items-center pb-24">
        {/* Tab Toggle */}
        <div className="mt-8 mb-8">
          <div className="bg-[#F0EEE6] p-0.5 rounded-xl flex relative h-10 w-fit select-none">
            <button 
              onClick={() => setActiveTab('individual')}
              className={cn(
                "px-6 h-9 rounded-[8px] text-[14px] font-medium transition-all relative z-10",
                activeTab === 'individual' ? "bg-white shadow-sm text-black" : "text-[#73726C] hover:text-black"
              )}
            >
              Individual
            </button>
            <button 
              onClick={() => setActiveTab('team')}
              className={cn(
                "px-6 h-9 rounded-[8px] text-[14px] font-medium transition-all relative z-10",
                activeTab === 'team' ? "bg-white shadow-sm text-black" : "text-[#73726C] hover:text-black"
              )}
            >
              Team and Enterprise
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className={cn(
          "grid gap-5 w-full mt-4 items-stretch",
          activeTab === 'individual' ? "grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 px-0" : "grid-cols-1 md:grid-cols-2 max-w-[920px]"
        )}>
          {currentPlans.map((plan) => {
            const billingCycle = getBillingCycleForPlan(plan.id);

            return (
            <div 
              key={plan.id} 
              className={cn(
                "flex flex-col bg-white border border-[#1F1E1D]/15 rounded-2xl p-6 transition-all duration-300 relative group hover:shadow-lg",
                plan.isHighlight && "border-[#2C84DB]/40 shadow-[0_4px_24px_rgba(44,132,219,0.1)]"
              )}
            >
              <div className="flex flex-col gap-2 min-h-[180px]">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-medium">{plan.name}</h3>
                  {(plan.id === 'go' || plan.id === 'pro') && (
                    <div className="ml-3 flex h-9 shrink-0 items-center rounded-full bg-[#F0EEE6] p-0.5">
                      <button
                        type="button"
                        onClick={() => setBillingCycleForPlan(plan.id, 'monthly')}
                        className={cn(
                          "h-8 rounded-full px-3 text-[12px] font-medium transition-all",
                          billingCycle === 'monthly'
                            ? "bg-white text-black shadow-sm"
                            : "text-[#73726C] hover:text-black"
                        )}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingCycleForPlan(plan.id, 'yearly')}
                        className={cn(
                          "flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-medium transition-all",
                          billingCycle === 'yearly'
                            ? "bg-white text-black shadow-sm"
                            : "text-[#73726C] hover:text-black"
                        )}
                      >
                        <span>Yearly</span>
                        <span className="rounded-full bg-[#1B67B2]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#1B67B2]">
                          Save 17%
                        </span>
                      </button>
                    </div>
                  )}
                </div>
                <p className="min-h-[40px] text-[14px] leading-snug text-[#73726C]">
                  {plan.description}
                </p>
                
                <div className="mt-4 flex flex-col">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[30px] font-medium">
                      {plan.customPriceLabel === 'Custom' ? '' : '₹'}{formatPlanPrice(plan, billingCycle)}{plan.customPriceLabel === '+' ? '+' : ''}
                    </span>
                    {typeof plan.monthlyPrice === 'number' && plan.monthlyPrice > 0 && (
                      <span className="text-[14px] text-[#73726C] ml-1">
                        {plan.id === 'team'
                          ? billingCycle === 'monthly'
                            ? '/ per seat / month'
                            : '/ per seat / year'
                          : billingCycle === 'monthly'
                            ? '/ month'
                            : '/ year'}
                      </span>
                    )}
                  </div>
                  {typeof plan.monthlyPrice === 'number' && plan.monthlyPrice > 0 && activeTab === 'individual' && (
                    <p className="text-[11px] text-[#73726C]">
                      {billingCycle === 'monthly' ? 'billed monthly' : 'billed annually'}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 mb-8">
                <Button 
                  disabled={plan.isCurrent}
                  onClick={() => !plan.isCurrent && onSelectPlan(plan.id, billingCycle)}
                  className={cn(
                    "w-full h-11 rounded-xl font-medium transition-all text-[14px] border",
                    plan.isCurrent ? "bg-transparent text-[#AFAFAF] cursor-default border-[#1F1E1D]/15" : 
                    "bg-black text-white hover:bg-black/90 border-0"
                  )}
                >
                  {plan.buttonLabel}
                </Button>
                {plan.id === 'max' && (
                  <p className="mt-2 text-center text-[12px] text-[#73726C]">
                    No commitment · Cancel anytime
                  </p>
                )}
                {plan.id === 'team' && (
                   <div className="mt-2 flex items-center gap-2 p-3 bg-[#FAF9F5] border border-[#1F1E1D]/15 rounded-lg text-[13px] text-[#73726C]">
                     <Info className="w-4 h-4 shrink-0" />
                     <span>Work email address required.</span>
                   </div>
                )}
              </div>

              <div className="flex-1 flex flex-col pt-6 border-t border-[#1F1E1D]/10">
                {plan.highlight && (
                  <p className="text-[14px] font-bold mb-4">{plan.highlight}</p>
                )}
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[14px] leading-tight text-[#3D3D3A]/80">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#73726C]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            );
          })}
        </div>
        
        <div className="mt-12 text-center text-[14px] text-[#73726C] max-w-2xl">
          <p>*<a href="#" className="underline underline-offset-4 decoration-[#73726C]/30 hover:text-black">Usage limits apply</a>. Prices shown don’t include applicable tax.</p>
        </div>
      </main>
    </div>
  );
}
