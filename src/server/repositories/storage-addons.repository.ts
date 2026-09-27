import { query, queryOne } from "@/server/db/pool";

export type StorageBalanceRow = {
  user_id: string;
  extra_gb: number;
  updated_at: string;
};

export type StoragePurchaseRow = {
  id: string;
  user_id: string;
  gigabytes: number;
  amount_paise: number;
  amount_usd_micros: number;
  currency: string;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export async function getExtraStorageGb(userId: string): Promise<number> {
  const row = await queryOne<{ extra_gb: number }>(
    `select extra_gb from public.user_storage_balances where user_id = $1`,
    [userId],
  );
  return Number(row?.extra_gb ?? 0);
}

export async function listStoragePurchases(userId: string, limit = 8) {
  return query<StoragePurchaseRow>(
    `select id, user_id, gigabytes, amount_paise, amount_usd_micros, currency,
            status, razorpay_order_id, razorpay_payment_id, created_at, paid_at
     from public.storage_purchases
     where user_id = $1
     order by created_at desc
     limit $2`,
    [userId, limit],
  );
}

export async function insertPendingStoragePurchase(input: {
  id: string;
  userId: string;
  gigabytes: number;
  amountPaise: number;
  amountUsdMicros: number;
  razorpayOrderId: string;
}) {
  return queryOne<StoragePurchaseRow>(
    `insert into public.storage_purchases (
       id, user_id, gigabytes, amount_paise, amount_usd_micros, currency,
       status, razorpay_order_id
     ) values ($1, $2, $3, $4, $5, 'INR', 'pending', $6)
     returning id, user_id, gigabytes, amount_paise, amount_usd_micros, currency,
               status, razorpay_order_id, razorpay_payment_id, created_at, paid_at`,
    [
      input.id,
      input.userId,
      input.gigabytes,
      input.amountPaise,
      input.amountUsdMicros,
      input.razorpayOrderId,
    ],
  );
}

export async function getStoragePurchaseForUser(
  purchaseId: string,
  userId: string,
) {
  return queryOne<StoragePurchaseRow>(
    `select id, user_id, gigabytes, amount_paise, amount_usd_micros, currency,
            status, razorpay_order_id, razorpay_payment_id, created_at, paid_at
     from public.storage_purchases
     where id = $1 and user_id = $2`,
    [purchaseId, userId],
  );
}
