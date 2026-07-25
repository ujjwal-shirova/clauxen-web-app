import { query, queryOne, withTransaction } from "@/server/db/pool";
import { AppError } from "@/server/db/errors";

export type BillingAddressRow = {
  id: string;
  user_id: string;
  full_name: string;
  country_code: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentMethodRow = {
  id: string;
  user_id: string;
  provider_ref_encrypted: string;
  provider_ref_fingerprint: string;
  network: string;
  brand: string;
  card_first4: string | null;
  card_last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
  razorpay_customer_id: string | null;
  last_payment_id: string | null;
  method_type: "card" | "upi";
  upi_vpa: string | null;
  display_label: string | null;
  mandate_max_amount_paise: number | null;
  mandate_status: string | null;
  created_at: string;
  updated_at: string;
};

export async function getDefaultBillingAddress(userId: string) {
  return queryOne<BillingAddressRow>(
    `select *
     from public.billing_addresses
     where user_id = $1
     order by is_default desc, updated_at desc
     limit 1`,
    [userId],
  );
}

export async function upsertBillingAddress(input: {
  userId: string;
  fullName: string;
  countryCode: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  phone?: string | null;
}) {
  const existing = await getDefaultBillingAddress(input.userId);
  if (existing) {
    return queryOne<BillingAddressRow>(
      `update public.billing_addresses
       set full_name = $2,
           country_code = $3,
           address_line1 = $4,
           address_line2 = $5,
           city = $6,
           state = $7,
           postal_code = $8,
           phone = $9,
           is_default = true,
           updated_at = now()
       where id = $1
       returning *`,
      [
        existing.id,
        input.fullName,
        input.countryCode,
        input.addressLine1,
        input.addressLine2 ?? "",
        input.city,
        input.state,
        input.postalCode,
        input.phone ?? null,
      ],
    );
  }

  return queryOne<BillingAddressRow>(
    `insert into public.billing_addresses (
       user_id, full_name, country_code, address_line1, address_line2,
       city, state, postal_code, phone, is_default
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
     returning *`,
    [
      input.userId,
      input.fullName,
      input.countryCode,
      input.addressLine1,
      input.addressLine2 ?? "",
      input.city,
      input.state,
      input.postalCode,
      input.phone ?? null,
    ],
  );
}

export async function listPaymentMethods(userId: string) {
  return query<PaymentMethodRow>(
    `select *
     from public.payment_methods
     where user_id = $1
     order by is_default desc, created_at desc`,
    [userId],
  );
}

export async function getPaymentMethod(userId: string, id: string) {
  return queryOne<PaymentMethodRow>(
    `select * from public.payment_methods where id = $1 and user_id = $2 limit 1`,
    [id, userId],
  );
}

export async function upsertPaymentMethod(input: {
  userId: string;
  providerRefEncrypted: string;
  providerRefFingerprint: string;
  network: string;
  brand: string;
  methodType?: "card" | "upi";
  cardFirst4?: string | null;
  cardLast4?: string | null;
  upiVpa?: string | null;
  displayLabel?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  razorpayCustomerId?: string | null;
  lastPaymentId?: string | null;
  mandateMaxAmountPaise?: number | null;
  mandateStatus?: string | null;
  makeDefault?: boolean;
}) {
  const methodType = input.methodType ?? "card";
  return withTransaction(async (client) => {
    const existing = await client.query<PaymentMethodRow>(
      `select * from public.payment_methods
       where user_id = $1 and provider_ref_fingerprint = $2
       limit 1`,
      [input.userId, input.providerRefFingerprint],
    );
    const row = existing.rows[0];

    if (input.makeDefault !== false) {
      await client.query(
        `update public.payment_methods set is_default = false where user_id = $1`,
        [input.userId],
      );
    }

    if (row) {
      const updated = await client.query<PaymentMethodRow>(
        `update public.payment_methods
         set provider_ref_encrypted = $2,
             network = $3,
             brand = $4,
             card_first4 = $5,
             card_last4 = $6,
             exp_month = $7,
             exp_year = $8,
             razorpay_customer_id = coalesce($9, razorpay_customer_id),
             last_payment_id = coalesce($10, last_payment_id),
             is_default = case when $11 then true else is_default end,
             method_type = $12,
             upi_vpa = coalesce($13, upi_vpa),
             display_label = coalesce($14, display_label),
             mandate_max_amount_paise = coalesce($15, mandate_max_amount_paise),
             mandate_status = coalesce($16, mandate_status),
             updated_at = now()
         where id = $1
         returning *`,
        [
          row.id,
          input.providerRefEncrypted,
          input.network,
          input.brand,
          input.cardFirst4 ?? null,
          input.cardLast4 ?? null,
          input.expMonth ?? null,
          input.expYear ?? null,
          input.razorpayCustomerId ?? null,
          input.lastPaymentId ?? null,
          input.makeDefault !== false,
          methodType,
          input.upiVpa ?? null,
          input.displayLabel ?? null,
          input.mandateMaxAmountPaise ?? null,
          input.mandateStatus ?? null,
        ],
      );
      return updated.rows[0] ?? null;
    }

    const inserted = await client.query<PaymentMethodRow>(
      `insert into public.payment_methods (
         user_id, provider_ref_encrypted, provider_ref_fingerprint,
         network, brand, card_first4, card_last4, exp_month, exp_year,
         is_default, razorpay_customer_id, last_payment_id,
         method_type, upi_vpa, display_label, mandate_max_amount_paise, mandate_status
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       returning *`,
      [
        input.userId,
        input.providerRefEncrypted,
        input.providerRefFingerprint,
        input.network,
        input.brand,
        input.cardFirst4 ?? null,
        input.cardLast4 ?? null,
        input.expMonth ?? null,
        input.expYear ?? null,
        input.makeDefault !== false,
        input.razorpayCustomerId ?? null,
        input.lastPaymentId ?? null,
        methodType,
        input.upiVpa ?? null,
        input.displayLabel ?? null,
        input.mandateMaxAmountPaise ?? null,
        input.mandateStatus ?? null,
      ],
    );
    return inserted.rows[0] ?? null;
  });
}

export async function setDefaultPaymentMethod(userId: string, id: string) {
  return withTransaction(async (client) => {
    const found = await client.query(
      `select id from public.payment_methods where id = $1 and user_id = $2`,
      [id, userId],
    );
    if (!found.rows[0]) {
      throw new AppError("Payment method not found.", 404, "not_found");
    }
    await client.query(
      `update public.payment_methods set is_default = false where user_id = $1`,
      [userId],
    );
    const updated = await client.query<PaymentMethodRow>(
      `update public.payment_methods
       set is_default = true, updated_at = now()
       where id = $1 and user_id = $2
       returning *`,
      [id, userId],
    );
    return updated.rows[0] ?? null;
  });
}

export async function deletePaymentMethod(userId: string, id: string) {
  return withTransaction(async (client) => {
    const deleted = await client.query<PaymentMethodRow>(
      `delete from public.payment_methods
       where id = $1 and user_id = $2
       returning *`,
      [id, userId],
    );
    const row = deleted.rows[0];
    if (!row) {
      throw new AppError("Payment method not found.", 404, "not_found");
    }
    if (row.is_default) {
      await client.query(
        `update public.payment_methods
         set is_default = true
         where id = (
           select id from public.payment_methods
           where user_id = $1
           order by created_at desc
           limit 1
         )`,
        [userId],
      );
    }
    return row;
  });
}
