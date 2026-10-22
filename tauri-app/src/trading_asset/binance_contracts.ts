export type FuturesAccount = "usdtM" | "coinM";

export interface FuturesAsset {
  currency: string;
  walletBalance: string;
  availableBalance: string;
  crossWalletBalance: string;
  crossUnrealizedPnl: string;
  transferable: string;
}
