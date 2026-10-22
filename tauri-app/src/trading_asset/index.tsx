import { type ComponentType } from "react";
import { type Exchange } from "../exchanges";
import { type AssetActions } from "./contracts";
import { BinanceAsset } from "./binance_asset";
import { BithumbAsset } from "./bithumb_asset";

const assetComponents = {
  binance: BinanceAsset,
  bithumb: BithumbAsset,
} satisfies Record<Exchange, ComponentType<AssetActions>>;

export function Assets({
  exchange,
  ...actions
}: AssetActions & { exchange: Exchange }) {
  const AssetComponent = assetComponents[exchange];
  return <AssetComponent {...actions} />;
}
