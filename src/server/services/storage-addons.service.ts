import { randomUUID } from "node:crypto";
import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";
import { withTransaction } from "@/server/db/pool";
import {
  captureRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayPayment,
  isRazorpayConfigured,
  verifyPaymentSignatureSecure,
} from "@/server/billing/razorpay";
import { parseUsdInrRate } from "@/lib/checkout-currency";
import {
  STORAGE_EXTRA_GB_CAP,
  STORAGE_USD_PER_GB,
  includedBytesForPlan,
  includedGbForPlan,
  normalizeAddonGigabytes,
  resolveActiveStoragePlanId,
  storageAddonAmountPaise,
  storageAddonUsdMicros,
  storageQuotaBytesForPlan,
  storageTierForPlan,
} from "@/lib/storage-quota";
import * as billingRepo from "@/server/repositories/billing.repository";
import * as userFilesRepo from "@/server/repositories/user-files.repository";
import * as storageRepo from "@/server/repositories/storage-addons.repository";

function usdInrRate() {
  return parseUsdInrRate(env.checkoutUsdInrRate);
}

function isMissingStorageTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /user_storage_balances|storage_purchases|42P01/i.test(message);
}

export async function getStorageAccountSummary(userId: string) {
  const [stats, subscription] = await Promise.all([
    userFilesRepo.getUserFileStorageStats(userId),
    billingRepo.getUserSubscription(userId),
  ]);

  let extraGb = 0;
  let purchases: Awaited<ReturnType<typeof storageRepo.listStoragePurchases>> =
    [];
  try {
    [extraGb, purchases] = await Promise.all([
      storageRepo.getExtraStorageGb(userId),
      storageRepo.listStoragePurchases(userId),
    ]);
  } catch (error) {
    if (!isMissingStorageTable(error)) throw error;
  }

  const planId = resolveActiveStoragePlanId(subscription);
  const includedBytes = includedBytesForPlan(planId);
  const quotaBytes = storageQuotaBytesForPlan(planId, extraGb);

  return {
    usedBytes: Number(stats?.total_bytes ?? 0),
    quotaBytes,
    includedBytes,
    includedGb: includedGbForPlan(planId),
    extraGb,
    planId,
    tier: storageTierForPlan(planId),
    priceUsdPerGb: STORAGE_USD_PER_GB,
    usdInrRate: usdInrRate(),
    categories: [
      {
        id: "files",
        title: "Files",
        bytes: Number(stats?.document_bytes ?? 0),
        count: Number(stats?.document_count ?? 0),
      },
      {
        id: "images",
        title: "Images",
        bytes: Number(stats?.image_bytes ?? 0),
        count: Number(stats?.image_count ?? 0),
      },
    ],
    purchases: purchases.map((row) => ({
      id: row.id,
      gigabytes: row.gigabytes,
      amountPaise: row.amount_paise,
      amountUsdMicros: row.amount_usd_micros,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    })),
  };
}

export async function startStoragePurchase(input: {
  userId: string;
  gigabytes: unknown;
}) {
  const gigabytes = normalizeAddonGigabytes(input.gigabytes);
  if (gigabytes == null) {
    throw new AppError(
      "Choose between 1 and 10,000 GB.",
      400,
      "invalid_storage_amount",
    );
  }

  if (!isRazorpayConfigured()) {
    throw new AppError(
      "Payments are not available right now.",
      503,
      "billing_unavailable",
    );
  }

  let currentExtra = 0;
  try {
    currentExtra = await storageRepo.getExtraStorageGb(input.userId);
  } catch (error) {
    if (isMissingStorageTable(error)) {
      throw new AppError(
        "Storage add-ons are not available yet.",
        503,
        "storage_unavailable",
      );
    }
    throw error;
  }

  if (currentExtra + gigabytes > STORAGE_EXTRA_GB_CAP) {
    throw new AppError(
      "That would exceed the storage add-on limit on this account.",
      400,
      "storage_cap",
    );
  }

  const rate = usdInrRate();
  const amountPaise = storageAddonAmountPaise(gigabytes, rate);
  const amountUsdMicros = storageAddonUsdMicros(gigabytes);
  const purchaseId = randomUUID();
  const receipt = `sto${purchaseId.replace(/-/g, "").slice(0, 20)}`;

  const preferDirect = Boolean(
    env.razorpayKeyId?.trim() && env.razorpayKeySecret?.trim(),
  );

  const razorpay = await createRazorpayOrder({
    amountMinor: amountPaise,
    currency: "INR",
    receipt,
    preferDirect,
    notes: {
      kind: "storage_addon",
      user_id: input.userId,
      purchase_id: purchaseId,
      gigabytes: String(gigabytes),
    },
  });

  const row = await storageRepo.insertPendingStoragePurchase({
    id: purchaseId,
    userId: input.userId,
    gigabytes,
    amountPaise,
    amountUsdMicros,
    razorpayOrderId: razorpay.id,
  });

  if (!row) {
    throw new AppError("Could not start the storage purchase.", 500, "storage_purchase_failed");
  }

  const keyId = env.publicRazorpayKeyId || env.razorpayKeyId;
  if (!keyId) {
    throw new AppError(
      "Payments are not available right now.",
      503,
      "billing_unavailable",
    );
  }

  return {
    purchase: {
      id: row.id,
      gigabytes: row.gigabytes,
      amountPaise: row.amount_paise,
      amountUsdMicros: row.amount_usd_micros,
      currency: "INR" as const,
      keyId,
      orderId: razorpay.id,
      priceUsdPerGb: STORAGE_USD_PER_GB,
    },
  };
}

export async function verifyStoragePurchase(input: {
  userId: string;
  purchaseId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const purchase = await storageRepo.getStoragePurchaseForUser(
    input.purchaseId,
    input.userId,
  );
  if (!purchase) {
    throw new AppError("Purchase not found.", 404, "not_found");
  }
  if (purchase.razorpay_order_id !== input.razorpayOrderId) {
    throw new AppError("Payment does not match this purchase.", 400, "invalid_payment");
  }
  if (
    purchase.status === "paid" &&
    purchase.razorpay_payment_id === input.razorpayPaymentId
  ) {
    const extraGb = await storageRepo.getExtraStorageGb(input.userId);
    return { status: "paid" as const, extraGb, gigabytes: purchase.gigabytes };
  }
  if (purchase.status !== "pending") {
    throw new AppError("This purchase is already closed.", 409, "purchase_closed");
  }

  const signatureOk = await verifyPaymentSignatureSecure({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });
  if (!signatureOk) {
    throw new AppError("Payment could not be verified.", 400, "invalid_signature");
  }

  let payment = await fetchRazorpayPayment(input.razorpayPaymentId);
  if (payment.order_id !== input.razorpayOrderId) {
    throw new AppError("Payment does not match this order.", 400, "invalid_payment");
  }
  if (payment.currency !== "INR" || payment.amount !== purchase.amount_paise) {
    throw new AppError("Payment amount does not match.", 400, "amount_mismatch");
  }

  if (payment.status === "authorized" && !payment.captured) {
    payment = await captureRazorpayPayment({
      paymentId: payment.id,
      amount: purchase.amount_paise,
      currency: "INR",
    });
  }
  if (payment.status !== "captured" && !payment.captured) {
    throw new AppError("Payment was not captured.", 402, "payment_not_captured");
  }

  const credited = await withTransaction(async (client) => {
    const updated = await client.query<{ gigabytes: number }>(
      `update public.storage_purchases
       set status = 'paid',
           paid_at = now(),
           razorpay_payment_id = $2
       where id = $1
         and user_id = $3
         and status = 'pending'
         and razorpay_order_id = $4
       returning gigabytes`,
      [
        purchase.id,
        input.razorpayPaymentId,
        input.userId,
        input.razorpayOrderId,
      ],
    );

    if ((updated.rowCount ?? 0) === 0) {
      const existing = await client.query<{
        status: string;
        razorpay_payment_id: string | null;
      }>(
        `select status, razorpay_payment_id
         from public.storage_purchases
         where id = $1 and user_id = $2`,
        [purchase.id, input.userId],
      );
      const row = existing.rows[0];
      if (
        row?.status === "paid" &&
        row.razorpay_payment_id === input.razorpayPaymentId
      ) {
        return false;
      }
      throw new AppError(
        "Purchase could not be completed.",
        409,
        "purchase_conflict",
      );
    }

    await client.query(
      `insert into public.user_storage_balances (user_id, extra_gb)
       values ($1, $2)
       on conflict (user_id) do update
         set extra_gb = public.user_storage_balances.extra_gb + excluded.extra_gb,
             updated_at = now()`,
      [input.userId, purchase.gigabytes],
    );
    return true;
  });

  const extraGb = await storageRepo.getExtraStorageGb(input.userId);
  return {
    status: "paid" as const,
    extraGb,
    gigabytes: purchase.gigabytes,
    credited,
  };
}
