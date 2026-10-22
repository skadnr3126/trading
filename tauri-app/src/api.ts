import type { BithumbWithdrawalDetails } from "./features/bithumb/withdrawal_contracts";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
export interface Asset {
  currency: string;
  available: string;
  locked: string;
}
export interface Market {
  symbol: string;
  base: string;
  quote: string;
  name: string;
}
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export interface Network {
  id: string;
  name: string;
  deposit: boolean;
  withdraw: boolean;
  memoRequired: boolean;
}
export interface DepositAddress {
  currency: string;
  network: string;
  address: string | null;
  tag: string | null;
  message: string;
}

export type Target =
  { exchange: "binance" } | { exchange: "bithumb"; details: BithumbWithdrawalDetails };
export interface Withdrawal {
  currency: string;
  network: string;
  amount: string;
  address: string;
  tag: string | null;
  target: Target;
}
export interface Review {
  ticket: string;
  request: Withdrawal;
  fee: string;
  minimum: string;
  expiresAt: number;
  note: string;
}
export interface Execution {
  id: string;
  state: string;
  request: Withdrawal;
}
export interface AllowedAddress {
  currency: string;
  network: string;
  address: string;
  tag: string | null;
  label: string;
  target: Target | null;
}
export interface HistoryEntry {
  id: string;
  currency: string;
  network: string;
  amount: string;
  fee: string | null;
  state: string;
  time: string;
  txid: string | null;
  address: string | null;
}
export interface Failure {
  kind: string;
  message: string;
}
export function failure(e: unknown, mutation = false): Failure {
  if (
    e &&
    typeof e === "object" &&
    "kind" in e &&
    "message" in e &&
    typeof e.message === "string"
  )
    return e as Failure;
  return {
    kind: mutation ? "uncertain" : "unknown",
    message: mutation
      ? "실행 결과를 확인할 수 없습니다. 재실행 전에 출금 내역을 확인하세요."
      : String(e),
  };
}
export async function api<T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!isTauri())
    throw {
      kind: "configuration",
      message: "타우리 앱에서 실행하세요. 터미널: npm run tauri dev",
    };
  return invoke<T>(command, args);
}
// Each lookup owns its lifecycle; a late response cannot overwrite a newer selection.
export function useQuery<T>(
  command: string,
  args: Record<string, unknown>,
  enabled = true,
  poll = 0,
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Failure>();
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const key = JSON.stringify(args);

  useEffect(() => {
    let live = true;
    setData(undefined);
    setError(undefined);
    if (!enabled) {
      setLoading(false);
      return;
    }
    const read = async () => {
      setLoading(true);
      try {
        const next = await api<T>(command, JSON.parse(key));
        if (live) {
          setData(next);
          setError(undefined);
        }
      } catch (e) {
        if (live) setError(failure(e));
      } finally {
        if (live) setLoading(false);
      }
    };
    void read();
    const timer = poll
      ? window.setInterval(() => void read(), poll)
      : undefined;
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [command, key, enabled, version, poll]);
  return { data, error, loading, refresh };
}
export const format = (n: number) =>
  n.toLocaleString("ko-KR", { maximumFractionDigits: 8 });
