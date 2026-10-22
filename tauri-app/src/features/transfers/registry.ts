import type { Exchange } from "../../exchanges";
import { bithumbTransfers } from "../bithumb/transfers";
import { binanceTransfers } from "../binance/transfers";
import type { TransferDefinition } from "./definition";

// Adding an Exchange requires an explicit transfer definition; no provider fallback.
export const transferDefinitions: Record<Exchange, TransferDefinition> = {
  bithumb: bithumbTransfers,
  binance: binanceTransfers,
};
