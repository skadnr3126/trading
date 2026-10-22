import { Withdraw, type CoinWithdrawalProps } from "../Withdraw";
import type { TransferDefinition } from "../transfers/definition";

function BinanceWithdraw(props: CoinWithdrawalProps) {
  return <Withdraw {...props} target={{ exchange: "binance" }} />;
}

export const binanceTransfers: TransferDefinition = {
  canGenerateDepositAddress: false,
  excludedCurrencies: ["KRW"],
  Withdraw: BinanceWithdraw,
};
