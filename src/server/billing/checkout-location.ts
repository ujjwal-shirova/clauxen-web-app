import { isKnownCountryCode } from "@/lib/countries";
import {
  defaultCurrencyForCountry,
  type CheckoutCurrency,
} from "@/lib/checkout-currency";

/**
 * Server-side checkout location authority.
 *
 * Rules (enforced on every pay-time path — never trust the client):
 *  - Effective country IN  → INR charge + 18% GST (or GSTIN-exempt).
 *  - Effective country ≠ IN → USD charge + zero-rated export, no GST.
 *
 * Detection is 2-of-3 evidence (declared billing country, IP country,
 * payment-instrument evidence) per the digital-services industry standard.
 * Declared country wins ties at order time; post-payment instrument
 * evidence is recorded on the order for the audit trail. Any conflict
 * resolves conservatively to IN (charge GST) so a false declaration
 * can never dodge tax.
 */

export type LocationEvidence = {
  /** Self-declared billing country (ISO-2). */
  declared: string;
  /** Edge geo-IP country (ISO-2). */
  ip: string;
  /** Instrument hint once known: card/rail evidence. */
  instrument: "IN" | "FOREIGN" | "UNKNOWN";
  /** Final country used for currency + tax. */
  effective: string;
  /** 2-of-3 verdict at decision time. */
  verdict: "match" | "mismatch" | "unverified";
  decidedAt: string;
};

const HEADER_CANDIDATES = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-country-code",
] as const;

/** Best-effort ISO-2 country from edge geo headers. Defaults to IN. */
export function resolveIpCountry(headers: Headers): string {
  for (const name of HEADER_CANDIDATES) {
    const raw = headers.get(name)?.trim().toUpperCase().slice(0, 2);
    if (raw && /^[A-Z]{2}$/.test(raw) && isKnownCountryCode(raw)) {
      return raw;
    }
  }
  return "IN";
}

function normalizeCountry(raw: unknown, fallback: string): string {
  if (typeof raw === "string") {
    const code = raw.trim().toUpperCase().slice(0, 2);
    if (/^[A-Z]{2}$/.test(code) && isKnownCountryCode(code)) {
      return code;
    }
  }
  return fallback;
}

/**
 * Order-time resolution (instrument not yet known).
 *
 * Conservative 2-of-2: any India signal (IP or declared) → IN / INR / GST.
 * USD + zero-rated export only when BOTH signals are non-IN. A false
 * "United States" declaration from an Indian IP can never dodge GST.
 */
export function resolveOrderTimeLocation(input: {
  declaredCountry?: unknown;
  ipCountry: string;
}): {
  effectiveCountry: string;
  currency: CheckoutCurrency;
  evidence: LocationEvidence;
} {
  const ip = normalizeCountry(input.ipCountry, "IN");
  const declared = normalizeCountry(input.declaredCountry, ip);
  const inVotes = Number(declared === "IN") + Number(ip === "IN");
  const effectiveCountry = inVotes > 0 ? "IN" : declared;
  const verdict: LocationEvidence["verdict"] =
    declared === ip ? "match" : inVotes > 0 ? "mismatch" : "unverified";
  return {
    effectiveCountry,
    currency: defaultCurrencyForCountry(effectiveCountry),
    evidence: {
      declared,
      ip,
      instrument: "UNKNOWN",
      effective: effectiveCountry,
      verdict,
      decidedAt: new Date().toISOString(),
    },
  };
}

export type RazorpayInstrumentSnapshot = {
  method?: string | null;
  international?: boolean | null;
  card?: {
    network?: string | null;
    issuer?: string | null;
    international?: boolean | null;
  } | null;
  bank?: string | null;
  vpa?: string | null;
};

/**
 * Instrument → country hint. UPI / netbanking / EMI / wallets issued
 * in India can only be Indian. For cards, Razorpay's `international`
 * flag (+ missing issuer for foreign banks) decides; RuPay ⇒ IN.
 */
export function instrumentCountryHint(
  snapshot: RazorpayInstrumentSnapshot,
): "IN" | "FOREIGN" | "UNKNOWN" {
  const method = (snapshot.method || "").toLowerCase();
  if (
    method === "upi" ||
    method === "netbanking" ||
    method === "emi" ||
    method === "paylater" ||
    method === "wallet"
  ) {
    return "IN";
  }
  if (snapshot.vpa && !snapshot.method) return "IN";
  if (method === "card" || !method) {
    const card = snapshot.card;
    const network = (card?.network || "").toLowerCase();
    if (network.includes("rupay")) return "IN";
    if (card?.international === true || snapshot.international === true) {
      return "FOREIGN";
    }
    if (card?.international === false || snapshot.international === false) {
      return "IN";
    }
    // Razorpay omits `issuer` for foreign-bank cards; a present 4-char
    // issuer code with no international flag leans domestic.
    if (card?.issuer && card.issuer.length === 4) return "IN";
    return "UNKNOWN";
  }
  return "UNKNOWN";
}

/**
 * Post-payment 2-of-3 verdict. Votes: declared, IP, instrument
 * (UNKNOWN abstains). Indian payment rails always win (UPI / netbanking /
 * RuPay / domestic card cannot be an export). Majority otherwise; ties
 * resolve to IN so a false foreign declaration never skips GST.
 */
export function evaluateLocationVerdict(input: {
  declared: string;
  ip: string;
  instrument: "IN" | "FOREIGN" | "UNKNOWN";
}): { effective: string; verdict: "match" | "mismatch" } {
  if (input.instrument === "IN") {
    return {
      effective: "IN",
      verdict: input.declared === "IN" ? "match" : "mismatch",
    };
  }
  const declaredIn = input.declared === "IN";
  const ipIn = input.ip === "IN";
  const votes: boolean[] = [declaredIn, ipIn];
  if (input.instrument === "FOREIGN") {
    votes.push(false);
  }
  const inVotes = votes.filter(Boolean).length;
  const outVotes = votes.length - inVotes;
  const effectiveIn = inVotes >= outVotes;
  const effective = effectiveIn ? "IN" : input.declared === "IN" ? "IN" : input.declared;
  const verdict =
    (effective === "IN") === declaredIn ? "match" : "mismatch";
  return { effective, verdict };
}

/** Finalize evidence once the instrument snapshot is known. */
export function finalizeLocationEvidence(
  prior: LocationEvidence,
  snapshot: RazorpayInstrumentSnapshot,
): LocationEvidence {
  const instrument = instrumentCountryHint(snapshot);
  const { effective, verdict } = evaluateLocationVerdict({
    declared: prior.declared,
    ip: prior.ip,
    instrument,
  });
  return {
    ...prior,
    instrument,
    effective,
    verdict,
    decidedAt: new Date().toISOString(),
  };
}
