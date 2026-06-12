export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function cardNumberDigits(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

export function formatCardExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

export function formatCardCvc(raw: string, maxLen = 4): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

export function isCardNumberComplete(digits: string): boolean {
  return digits.length >= 15 && digits.length <= 19;
}

export function isCardExpiryComplete(formatted: string): boolean {
  return formatted.replace(/\D/g, "").length === 4;
}

export function isCardCvcComplete(cvc: string, amex: boolean): boolean {
  const len = cvc.replace(/\D/g, "").length;
  return amex ? len === 4 : len === 3;
}
