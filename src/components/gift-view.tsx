'use client';

import React, { useState } from 'react';
import { ArrowLeft, Check, Mail, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GiftPayment } from './gift-payment';
import { GiftAnimation } from './gift-animation';

interface GiftViewProps {
  onClose: () => void;
}

const colors = [
  { id: 'clay', value: '#DD8164', label: 'Clay' },
  { id: 'sky', value: '#77A3CF', label: 'Sky' },
  { id: 'olive', value: '#839569', label: 'Olive' },
  { id: 'fig', value: '#C8728F', label: 'Fig' },
  { id: 'coral', value: '#EFD9D9', label: 'Coral' },
  { id: 'cactus', value: '#CBDCD5', label: 'Cactus' },
  { id: 'heather', value: '#D7D6E1', label: 'Heather' },
];

const plans = [
  { id: 'go', name: 'Go', subtitle: 'Affordable entry', monthlyPrice: 299 },
  { id: 'pro', name: 'Pro', subtitle: 'For the curious', monthlyPrice: 2499 },
  { id: 'max5x', name: 'Max 5x', subtitle: 'For the enthusiast', monthlyPrice: 9999 },
  { id: 'max20x', name: 'Max 20x', subtitle: 'For the power user', monthlyPrice: 19999 },
];

const durations = [
  { id: '1month', label: '1 month', months: 1 },
  { id: '3months', label: '3 months', months: 3 },
  { id: '6months', label: '6 months', months: 6 },
  { id: '1year', label: '1 year', months: 12 },
];

export function GiftView({ onClose }: GiftViewProps) {
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [selectedDuration, setSelectedDuration] = useState('6months');
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [deliveryMethod, setDeliveryMethod] = useState('email');
  
  // Form fields
  const [recipientName, setRecipientName] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [yourName, setYourName] = useState('Revlon');
  const [yourEmail, setYourEmail] = useState('revl.developer.go@gmail.com');

  const currentPlan = plans.find(p => p.id === selectedPlan) || plans[0];
  const currentDuration = durations.find(d => d.id === selectedDuration) || durations[2];
  const total = currentPlan.monthlyPrice * currentDuration.months;

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex overflow-hidden animate-in fade-in duration-300 font-sans">
      {/* Back Button Overlay */}
      <button 
        onClick={handleBack} 
        className="absolute left-6 top-6 p-2 hover:bg-black/5 rounded-lg transition-all z-[110]"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5 text-[#3D3D3A]" />
      </button>

      {/* Left Part: Configuration */}
      <div className="flex-[1.6] bg-white overflow-y-auto border-r border-black/5 scrollbar-hide relative">
        <div className="max-w-[512px] mx-auto px-8 py-24 flex flex-col justify-center min-h-full">
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h1 className="text-[38px] font-serif font-medium text-[#3D3D3A] leading-[1.4] mb-2">
                Give the gift of Clauxen
              </h1>
              <p className="text-[16px] text-[#3D3D3A] font-[430] leading-relaxed mb-10">
                Every plan includes Clauxen Code, unlimited projects, and access to our latest models.
              </p>

              {/* Plan Selection */}
              <div className="mb-8">
                <span className="block text-[14px] font-semibold text-[#3D3D3A] mb-3">
                  Which plan?
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all duration-200 outline-none",
                        selectedPlan === plan.id 
                          ? "border-[#1f1e1d] ring-1 ring-[#1f1e1d] shadow-sm bg-white" 
                          : "border-black/15 hover:border-black/30 bg-transparent"
                      )}
                    >
                      <div className="text-[14px] font-semibold text-[#3D3D3A]">{plan.name}</div>
                      <div className="text-[14px] text-[#73726C] font-[430] leading-tight mt-1">{plan.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selection */}
              <div className="mb-8">
                <span className="block text-[14px] font-semibold text-[#3D3D3A] mb-3">
                  How many months?
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {durations.map((duration) => (
                    <button
                      key={duration.id}
                      onClick={() => setSelectedDuration(duration.id)}
                      className={cn(
                        "py-3 px-2 rounded-xl border text-center transition-all duration-200 outline-none",
                        selectedDuration === duration.id 
                          ? "border-[#1f1e1d] ring-1 ring-[#1f1e1d] shadow-sm bg-white" 
                          : "border-black/15 hover:border-black/30 bg-transparent"
                      )}
                    >
                      <div className="text-[14px] font-semibold text-[#3D3D3A]">{duration.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="mb-10">
                <span className="block text-[14px] font-semibold text-[#3D3D3A] mb-1">
                  Total
                </span>
                <div className="text-[24px] font-bold text-[#3D3D3A]">
                  ₹{total.toLocaleString('en-IN')}.00
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-black/5">
                <Button 
                  onClick={() => setStep(2)}
                  className="h-10 px-8 bg-black text-white hover:bg-black/90 rounded-xl font-medium transition-all transform active:scale-95"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h1 className="text-[28px] font-serif font-medium text-[#3D3D3A] mb-6">
                Personalize your gift
              </h1>

              {/* Color Picker */}
              <div className="mb-8">
                <span className="block text-[14px] font-semibold text-[#3D3D3A] mb-3">
                  Pick a color
                </span>
                <div className="flex flex-wrap gap-3">
                  {colors.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center",
                        selectedColor.id === color.id ? "border-black" : "border-transparent"
                      )}
                      style={{ backgroundColor: color.value }}
                      aria-label={color.label}
                    >
                      {selectedColor.id === color.id && (
                        <Check className={cn("w-4 h-4", color.id === 'coral' || color.id === 'cactus' || color.id === 'heather' ? "text-black" : "text-white")} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery Method */}
              <div className="mb-8">
                <span className="block text-[14px] font-semibold text-[#3D3D3A] mb-3">
                  Choose how to send
                </span>
                <div className="space-y-3">
                  <button
                    onClick={() => setDeliveryMethod('email')}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                      deliveryMethod === 'email' ? "border-black bg-black/5" : "border-black/15 hover:border-black/30"
                    )}
                  >
                    <Mail className="w-5 h-5 text-[#73726C]" />
                    <div className="flex-1">
                      <div className="text-[14px] font-semibold">Send an email</div>
                    </div>
                    {deliveryMethod === 'email' && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                  </button>
                  <button
                    onClick={() => setDeliveryMethod('link')}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                      deliveryMethod === 'link' ? "border-black bg-black/5" : "border-black/15 hover:border-black/30"
                    )}
                  >
                    <LinkIcon className="w-5 h-5 text-[#73726C]" />
                    <div className="flex-1">
                      <div className="text-[14px] font-semibold">Get a link to share</div>
                    </div>
                    {deliveryMethod === 'link' && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                  </button>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4 mb-10">
                {deliveryMethod === 'email' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-medium text-[#3D3D3A]">Recipient's name</label>
                      <input 
                        type="text" 
                        placeholder="Name"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className="w-full h-10 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-medium text-[#3D3D3A]">Recipient's email</label>
                      <input 
                        type="email" 
                        placeholder="Email"
                        className="w-full h-10 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium text-[#3D3D3A]">Your name</label>
                  <input 
                    type="text" 
                    value={yourName}
                    onChange={(e) => setYourName(e.target.value)}
                    className="w-full h-10 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium text-[#3D3D3A]">Add a note</label>
                  <textarea 
                    placeholder="Gift message"
                    rows={3}
                    value={giftNote}
                    onChange={(e) => setGiftNote(e.target.value)}
                    className="w-full p-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium text-[#3D3D3A]">Your email</label>
                  <input 
                    type="email" 
                    value={yourEmail}
                    onChange={(e) => setYourEmail(e.target.value)}
                    className="w-full h-10 px-3 bg-white rounded-lg border border-black/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
                <Button 
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-10 px-8 border-black/15 text-[#3D3D3A] rounded-xl font-medium"
                >
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(3)}
                  className="h-10 px-8 bg-black text-white hover:bg-black/90 rounded-xl font-medium"
                >
                  Check out
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <GiftPayment 
              onBack={() => setStep(2)} 
              currentDurationLabel={currentDuration.label} 
            />
          )}
        </div>
      </div>

      {/* Right Part: Preview (Sticky) */}
      <div className="flex-1 bg-[#F5F4ED] flex flex-col items-center justify-center p-8 sticky top-0 h-full">
        <div style={{ transform: "matrix(1.25, 0, 0, 1.25, 0, 0)" }} className="relative transition-all duration-500 animate-in zoom-in-95 flex flex-col items-center gap-4">
          <div style={{ width: '288px', position: 'relative' }}>
            <div 
              className="relative overflow-hidden transition-colors duration-500"
              style={{ 
                aspectRatio: '3 / 2', 
                backgroundColor: selectedColor.value,
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
                borderRadius: '16px',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                boxShadow: 'rgb(255, 255, 255) 0px 0px 0px 0px inset, rgba(255, 255, 255, 0.3) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px'
              }}
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,250,244,0.96) 0%, rgba(244,240,234,0.86) 32%, rgba(232,231,235,0.78) 68%, rgba(249,244,238,0.88) 100%)',
                  }}
                />
                <div
                  className="absolute -left-14 top-0 h-28 w-72 rounded-[999px] opacity-80 blur-2xl"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(255,255,255,0.92) 0%, rgba(226,223,236,0.58) 46%, rgba(243,235,226,0.72) 100%)',
                    transform: 'rotate(-14deg)',
                  }}
                />
                <div
                  className="absolute -right-16 top-10 h-24 w-72 rounded-[999px] opacity-70 blur-2xl"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(227,227,233,0.72) 0%, rgba(255,247,240,0.8) 52%, rgba(235,241,246,0.62) 100%)',
                    transform: 'rotate(18deg)',
                  }}
                />
                <div
                  className="absolute -left-16 bottom-6 h-24 w-80 rounded-[999px] opacity-65 blur-2xl"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(250,244,237,0.88) 0%, rgba(220,219,228,0.48) 50%, rgba(255,253,250,0.86) 100%)',
                    transform: 'rotate(6deg)',
                  }}
                />
                <div
                  className="absolute right-2 bottom-0 h-20 w-48 rounded-[999px] opacity-55 blur-2xl"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(226,230,238,0.75) 0%, rgba(255,245,236,0.7) 100%)',
                    transform: 'rotate(-18deg)',
                  }}
                />
                <svg
                  viewBox="0 0 288 192"
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full opacity-70"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M-18 58C18 32 58 28 104 42C150 56 194 64 238 46C266 34 286 30 316 40"
                    fill="none"
                    stroke="rgba(255,255,255,0.76)"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                  <path
                    d="M-24 92C14 68 52 66 96 80C144 96 190 104 234 88C262 78 286 74 316 82"
                    fill="none"
                    stroke="rgba(220,220,230,0.56)"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d="M-18 132C26 112 70 114 116 126C164 140 208 144 250 128C278 118 298 114 320 120"
                    fill="none"
                    stroke="rgba(247,242,236,0.88)"
                    strokeWidth="14"
                    strokeLinecap="round"
                  />
                  <path
                    d="M-12 162C34 146 82 148 126 158C170 168 212 172 252 160C282 152 300 148 320 152"
                    fill="none"
                    stroke="rgba(231,233,241,0.5)"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.52),transparent_36%)]" />
              </div>
              
              {/* Gift Content */}
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
                <GiftAnimation />
                <div className="mt-[6px] text-center">
                  <div 
                    className="text-[12px] font-semibold leading-[16.8px] text-[#3D3D3A]"
                  >
                    {currentDuration.label} of Clauxen {currentPlan.name}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Message Box Container */}
          {deliveryMethod === 'email' && (recipientName || giftNote) && (
            <div className="w-72 bg-[#FAF9F5]/50 border border-[#1F1E1D]/15 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="text-[12px] font-semibold text-[#1F1E1D] mb-1">
                To: {recipientName}
              </div>
              <p className="text-[12px] text-[#3D3D3A] font-[430] leading-relaxed break-words">
                {giftNote}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
