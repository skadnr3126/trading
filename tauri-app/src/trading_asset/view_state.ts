import { useState } from "react";
import { type FuturesAccount } from "./binance_contracts";

export interface AssetFilters {
  search: string;
  hideZero: boolean;
}

export interface AssetFilterControls {
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
}

export type BinanceAssetAccount = "spot" | FuturesAccount;

export interface BinanceAssetViewState {
  account: BinanceAssetAccount;
  filters: Record<BinanceAssetAccount, AssetFilters>;
}

// Owned by App so navigation and exchange switches preserve view preferences.
// Balances remain owned by each screen's query and refresh on remount.
export function useAssetViewState() {
  return useState(() => ({
    bithumb: { search: "", hideZero: true },
    binance: {
      account: "spot" as BinanceAssetAccount,
      filters: {
        spot: { search: "", hideZero: true },
        usdtM: { search: "", hideZero: true },
        coinM: { search: "", hideZero: true },
      },
    },
  }));
}
