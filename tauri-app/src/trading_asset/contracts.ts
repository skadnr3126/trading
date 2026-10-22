// Navigation callbacks shared by independently implemented exchange asset screens.
export interface AssetActions {
  onChart: () => void;
  onTransfer: (currency?: string) => void;
}
