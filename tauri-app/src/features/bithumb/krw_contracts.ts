export type KrwKind = "deposit" | "withdraw";
export interface KrwRequest {
  kind: KrwKind;
  amount: string;
  twoFactorType: "kakao";
}
export interface KrwReview {
  ticket: string;
  request: KrwRequest;
  availableBalance: string | null;
  expiresAt: number;
}
export interface KrwExecution {
  id: string;
  state: string;
  fee: string;
  request: KrwRequest;
}
