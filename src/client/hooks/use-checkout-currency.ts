"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatCheckoutAmountInr,
  type CheckoutCurrency,
} from "@/lib/checkout-currency";
import {
  getPublicUsdInrRate,
  resolveInitialCheckoutCurrency,
  storeCheckoutCurrency,
} from "@/lib/checkout-currency-preference";

export function useCheckoutCurrency() {
  const [currency, setCurrencyState] = useState<CheckoutCurrency>("INR");
  const [ready, setReady] = useState(false);
  const usdInrRate = getPublicUsdInrRate();

  useEffect(() => {
    let cancelled = false;
    void resolveInitialCheckoutCurrency().then((detected) => {
      if (!cancelled) {
        setCurrencyState(detected);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrency = useCallback((next: CheckoutCurrency) => {
    setCurrencyState(next);
    storeCheckoutCurrency(next);
  }, []);

  const formatInr = useCallback(
    (amountInr: number) =>
      formatCheckoutAmountInr(amountInr, currency, usdInrRate),
    [currency, usdInrRate],
  );

  return {
    currency,
    setCurrency,
    ready,
    usdInrRate,
    formatInr,
    isUsd: currency === "USD",
  };
}
