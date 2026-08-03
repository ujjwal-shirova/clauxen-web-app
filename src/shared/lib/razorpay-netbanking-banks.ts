/**
 * Activated Razorpay netbanking banks for Shirova checkout.
 * Codes match Razorpay Custom Checkout `createPayment({ method: "netbanking", bank })`.
 * @see https://razorpay.com/docs/payments/payment-methods/netbanking/
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/custom/build-integration/
 */

export type RazorpayNetbankingBank = {
  /** Razorpay bank instrument code (e.g. `CNRB`). */
  code: string;
  name: string;
  /** Shown as quick-pick chips above the full list. */
  popular?: boolean;
};

/**
 * Only banks confirmed activated on the Shirova Razorpay account.
 * Do not add banks from the full Razorpay catalog unless Dashboard-enabled.
 */
export const RAZORPAY_NETBANKING_BANKS: readonly RazorpayNetbankingBank[] = [
  { code: "AUBL", name: "AU Small Finance Bank" },
  { code: "AIRP", name: "Airtel Payments Bank" },
  { code: "ALLA", name: "Allahabad Bank" },
  { code: "BARB_R", name: "Bank of Baroda", popular: true },
  { code: "MAHB", name: "Bank of Maharashtra" },
  { code: "CNRB", name: "Canara Bank", popular: true },
  { code: "CSBK", name: "Catholic Syrian Bank" },
  { code: "CBIN", name: "Central Bank of India" },
  { code: "DCBL", name: "DCB Bank" },
  { code: "DEUT", name: "Deutsche Bank" },
  { code: "DLXB", name: "Dhanlaxmi Bank" },
  { code: "ESFB", name: "Equitas Small Finance Bank" },
  { code: "IBKL", name: "IDBI Bank" },
  { code: "IDFB", name: "IDFC FIRST Bank", popular: true },
  { code: "IDIB", name: "Indian Bank" },
  { code: "IOBA", name: "Indian Overseas Bank" },
  { code: "INDB", name: "IndusInd Bank", popular: true },
  { code: "JAKA", name: "Jammu and Kashmir Bank" },
  { code: "JSFB", name: "Jana Small Finance Bank" },
  { code: "KARB", name: "Karnataka Bank" },
  { code: "KVBL", name: "Karur Vysya Bank" },
  { code: "ORBC", name: "Oriental Bank of Commerce" },
  { code: "UTBI", name: "United Bank of India" },
  { code: "PSIB", name: "Punjab & Sind Bank" },
  { code: "PUNB_R", name: "Punjab National Bank", popular: true },
  { code: "RATN", name: "RBL Bank (Ratnakar)" },
  { code: "SRCB", name: "Saraswat Cooperative Bank" },
  { code: "SIBL", name: "South Indian Bank" },
  { code: "TMBL", name: "Tamilnadu Mercantile Bank" },
  { code: "YESB", name: "Yes Bank", popular: true },
] as const;

const BANK_BY_CODE = new Map(
  RAZORPAY_NETBANKING_BANKS.map((bank) => [bank.code, bank]),
);

export function getNetbankingBankByCode(
  code: string,
): RazorpayNetbankingBank | undefined {
  return BANK_BY_CODE.get(code);
}

export function isActivatedNetbankingBank(code: string): boolean {
  return BANK_BY_CODE.has(code);
}

export function listPopularNetbankingBanks(): RazorpayNetbankingBank[] {
  return RAZORPAY_NETBANKING_BANKS.filter((bank) => bank.popular);
}

export function filterNetbankingBanks(
  query: string,
): RazorpayNetbankingBank[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...RAZORPAY_NETBANKING_BANKS];
  return RAZORPAY_NETBANKING_BANKS.filter(
    (bank) =>
      bank.name.toLowerCase().includes(q) ||
      bank.code.toLowerCase().includes(q),
  );
}
