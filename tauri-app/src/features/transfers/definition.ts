import type { ComponentType } from "react";
import type { CoinWithdrawalProps } from "../Withdraw";

export type TransferKind = "deposit" | "withdraw";
export interface BankTransferProps {
  kind: TransferKind;
  onBusy: (busy: boolean) => void;
  onHistory: (currency: string, kind: TransferKind) => void;
}
export interface TransferDefinition {
  canGenerateDepositAddress: boolean;
  excludedCurrencies: readonly string[];
  Withdraw: ComponentType<CoinWithdrawalProps>;
  bank?: {
    currency: string;
    title: string;
    description: string;
    footnote: string;
    Form: ComponentType<BankTransferProps>;
  };
}
