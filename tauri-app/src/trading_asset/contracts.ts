// Navigation callbacks shared by independently implemented exchange asset screens.
export interface AssetActions {
  onTransfer: (currency?: string) => void;
}
