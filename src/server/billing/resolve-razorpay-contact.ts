import { normalizeIndianMobileContact } from "@/lib/razorpay-custom-checkout";
import {
  ensureRazorpayCustomer,
  fetchRazorpayCustomer,
} from "@/server/billing/razorpay-customers";
import { query, queryOne } from "@/server/db/pool";
import {
  getDefaultBillingAddress,
  listPaymentMethods,
} from "@/server/repositories/billing-profile.repository";

export function normalizeRazorpayContact(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  return normalizeIndianMobileContact(raw);
}

function contactFromRecord(
  record: Record<string, unknown> | null | undefined,
): string | null {
  if (!record) return null;
  for (const key of ["phone", "phone_number", "mobile", "contact"]) {
    const value = record[key];
    if (typeof value === "string") {
      const contact = normalizeRazorpayContact(value);
      if (contact) return contact;
    }
  }
  return null;
}

function contactFromIdentities(identities: unknown): string | null {
  if (!Array.isArray(identities)) return null;
  for (const identity of identities) {
    if (!identity || typeof identity !== "object") continue;
    const record = identity as Record<string, unknown>;
    const direct = contactFromRecord(record);
    if (direct) return direct;
    if (record.identity_data && typeof record.identity_data === "object") {
      const nested = contactFromRecord(
        record.identity_data as Record<string, unknown>,
      );
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * Resolve the Razorpay `contact` Razorpay Custom Checkout requires, without a
 * checkout mobile field. Prefers account / billing-address phone, then an
 * existing Razorpay customer record.
 */
export async function resolveRazorpayContactForUser(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
  preferred?: string | null;
}): Promise<{ contact: string | null; customerId: string | null }> {
  const preferred = normalizeRazorpayContact(input.preferred);

  const [authRow, identityRows, address, methods] = await Promise.all([
    queryOne<{
      phone: string | null;
      raw_user_meta_data: Record<string, unknown> | null;
    }>(
      `select phone, raw_user_meta_data
       from auth.users
       where id = $1
       limit 1`,
      [input.userId],
    ).catch(() => null),
    query<{ identity_data: Record<string, unknown> | null }>(
      `select identity_data
       from auth.identities
       where user_id = $1`,
      [input.userId],
    ).catch(() => []),
    getDefaultBillingAddress(input.userId).catch(() => null),
    listPaymentMethods(input.userId).catch(() => []),
  ]);

  let contact =
    preferred ||
    normalizeRazorpayContact(authRow?.phone) ||
    contactFromRecord(authRow?.raw_user_meta_data) ||
    contactFromIdentities(identityRows.map((row) => row.identity_data)) ||
    normalizeRazorpayContact(address?.phone);

  if (!contact) {
    for (const method of methods) {
      const customerId = method.razorpay_customer_id;
      if (!customerId) continue;
      try {
        const customer = await fetchRazorpayCustomer(customerId);
        contact = normalizeRazorpayContact(customer.contact);
        if (contact) {
          return { contact, customerId: customer.id };
        }
      } catch {
        // Keep scanning other saved methods.
      }
    }
  }

  if (contact) {
    return { contact, customerId: null };
  }

  let customerId: string | null = null;
  const email = input.email?.trim();
  if (email) {
    try {
      const customer = await ensureRazorpayCustomer({
        userId: input.userId,
        email,
        name: input.name,
        contact,
      });
      customerId = customer.id ?? null;
      if (!contact) {
        contact = normalizeRazorpayContact(customer.contact);
      }
    } catch {
      // Checkout can still proceed with a stored contact if customer APIs fail.
    }
  }

  return { contact, customerId };
}
