import { type Dispatch, type SetStateAction } from "react";
import { type Exchange } from "../exchanges";
import { type AssetActions } from "./contracts";
import { BinanceAsset } from "./binance_asset";
import { BithumbAsset } from "./bithumb_asset";
import { useAssetViewState } from "./view_state";

export { useAssetViewState } from "./view_state";

type AssetViewState = ReturnType<typeof useAssetViewState>[0];

export function Assets({
  exchange,
  viewState,
  onViewStateChange,
  ...actions
}: AssetActions & {
  exchange: Exchange;
  viewState: AssetViewState;
  onViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
}) {
  if (exchange === "binance") {
    return (
      <BinanceAsset
        {...actions}
        viewState={viewState.binance}
        onViewStateChange={(binance) => onViewStateChange((state) => ({ ...state, binance }))}
      />
    );
  }
  return (
    <BithumbAsset
      {...actions}
      filters={viewState.bithumb}
      onFiltersChange={(bithumb) => onViewStateChange((state) => ({ ...state, bithumb }))}
    />
  );
}
