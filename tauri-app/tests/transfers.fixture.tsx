import { mockIPC } from "@tauri-apps/api/mocks";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "../src/App";
import type { Withdrawal, Review } from "../src/api";
import type { KrwRequest, KrwReview } from "../src/features/bithumb/krw_contracts";

// Only this separate dev fixture installs mocks. Production imports never reference it.
Object.assign(globalThis, { isTauri: true });
const options = new URLSearchParams(location.search);
const tickets = new Map<string, Review | KrwReview>();
const calls: unknown[] = [];
mockIPC((command, payload: Record<string, unknown> = {}) => {
  calls.push({ command, payload: structuredClone(payload) });
  document.getElementById("ipc-log")!.textContent = JSON.stringify(calls, null, 2);
  const currency = String(payload.currency ?? "BTC");
  if (command === "connection_status") return [{ exchange: "bithumb", configured: true }, { exchange: "binance", configured: true }];
  if (command === "markets") return ["BTC", "XRP"].map((base) => ({ base, quote: "KRW", symbol: `KRW-${base}`, name: base }));
  if (command === "assets") return [{ currency: "BTC", available: "1", locked: "0" }, { currency: "KRW", available: "100000", locked: "0" }];
  if (command === "networks") return [{ id: currency, name: currency, deposit: true, withdraw: true, memoRequired: currency === "XRP" }];
  if (command === "history") return [];
  if (command === "withdraw_addresses") return [{ currency: "XRP", network: "XRP", address: "r-fixture-address", tag: "12345", label: "등록 수취인", target: payload.exchange === "bithumb" ? {
    exchange: "bithumb", details: { type: "personal", exchange: "Binance", korean: "테스트 수취인", english: "Test Recipient" },
  } : { exchange: "binance" } }];
  if (command === "deposit_address" || command === "generate_address") return { currency, network: payload.network, address: "fixture-deposit-address", tag: "12345", message: "모의 주소" };
  if (command === "review_withdrawal" || command === "review_bithumb_krw") {
    const request = structuredClone(payload.request) as Withdrawal | KrwRequest;
    const ticket = `ticket-${tickets.size + 1}`;
    const common = { request, ticket, expiresAt: Date.now() + (options.has("expired") ? -1 : 60000) };
    const review = command === "review_withdrawal"
      ? { ...common, fee: "0.1", minimum: "1", note: "검토 모의 응답" } as Review
      : { ...common, availableBalance: (request as KrwRequest).kind === "withdraw" ? "100000" : null } as KrwReview;
    tickets.set(ticket, review);
    return review;
  }
  if (command === "execute_withdrawal" || command === "execute_bithumb_krw") {
    const review = tickets.get(String(payload.ticket));
    if (!review) throw { kind: "validation", message: "티켓이 이미 사용되었습니다." };
    tickets.delete(String(payload.ticket));
    if (options.get("outcome") === "uncertain") throw new Error("모의 IPC 응답 손실");
    if (options.get("outcome") === "rejected") throw { kind: "rejected", message: "모의 명시적 거절" };
    return { id: "fixture-request-id", state: "PROCESSING", fee: "0", request: review.request };
  }
  throw new Error(`모의 응답이 없는 명령: ${command}`);
});
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
