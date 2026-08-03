/** Indian GSTIN format — 15 chars: 2 digit state + PAN + entity + Z + checksum */
const GSTIN_RE =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function normalizeGstin(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidIndianGstin(value: string): boolean {
  const normalized = normalizeGstin(value);
  if (!normalized) return false;
  return GSTIN_RE.test(normalized);
}
