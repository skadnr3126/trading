import { useState, type ReactNode } from "react";
import { useReviewedOperation } from "./transfers/useReviewedOperation";
import {
  type Network,
  type Withdrawal,
  type Target,
  type Review,
  type Execution,
  type AllowedAddress,
  api,
  useQuery,
} from "../api";
import { exchangeName } from "../exchanges";
export interface CoinWithdrawalProps {
  currency: string;
  network: Network;
  onBusy: (v: boolean) => void;
  onHistory: (currency: string, kind: "withdraw") => void;
}

export function Withdraw({
  target,
  onChooseAddress,
  renderDetails,
  currency,
  network,
  onBusy,
  onHistory,
}: CoinWithdrawalProps & {
  target: Target;
  onChooseAddress?: (address: AllowedAddress) => void;
  renderDetails?: (invalidate: () => void) => ReactNode;
}) {
  const exchange = target.exchange;
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [tag, setTag] = useState("");
  const allowed = useQuery<AllowedAddress[]>("withdraw_addresses", { exchange });
  const flow = useReviewedOperation<Withdrawal, Review, Execution>({
    inspect: (request) => api<Review>("review_withdrawal", { request }),
    execute: (review) => api<Execution>("execute_withdrawal", {
      exchange: review.request.target.exchange, ticket: review.ticket,
    }),
    onBusy,
    onSettled: (request) => onHistory(request.currency, "withdraw"),
  });
  const { review, confirmed, busy, result, error, attempt, clock, locked, invalidate, setConfirmed } = flow;
  const inspect = () => flow.inspect({ currency, network: network.id, address, amount, tag: tag || null, target });
  function choose(index: string) {
    if (index === "") return;
    const a = allowed.data?.[Number(index)];
    if (!a || a.currency !== currency || a.network !== network.id) return;
    invalidate();
    setAddress(a.address);
    setTag(a.tag ?? "");
    onChooseAddress?.(a);
  }
  const matching = allowed.data
    ?.map((a, index) => ({ ...a, index }))
    .filter((a) => a.currency === currency && a.network === network.id);
  return (
    <div>
      <div className="network-note">
        <span className="live-dot" />
        {network.name}{" "}
        <span className={network.withdraw ? "green" : "red"}>
          {network.withdraw ? "출금 가능" : "출금 중단"}
        </span>
      </div>
      <fieldset disabled={locked}>
        <label>
          등록된 주소
          <select defaultValue="" onChange={(e) => choose(e.target.value)}>
            <option value="">주소 선택 또는 직접 입력</option>
            {matching?.map((a) => (
              <option key={a.index} value={a.index}>
                {a.label} · {a.address}
              </option>
            ))}
          </select>
        </label>
        {allowed.error && (
          <small className="muted">
            주소 목록 조회: {allowed.error.message}
          </small>
        )}
        <label>
          출금 주소
          <input
            value={address}
            placeholder="받는 지갑의 주소를 입력하세요"
            onChange={(e) => {
              invalidate();
              setAddress(e.target.value);
            }}
          />
        </label>
        <div className="form-grid">
          <label>
            출금 수량 ({currency})
            <input
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              onChange={(e) => {
                invalidate();
                setAmount(e.target.value);
              }}
            />
          </label>
          <label>
            태그 / 메모 {network.memoRequired ? "(필수)" : "(필요 시 입력)"}
            <input
              value={tag}
              onChange={(e) => {
                invalidate();
                setTag(e.target.value);
              }}
              placeholder="Destination tag / memo"
            />
          </label>
        </div>
        {renderDetails?.(invalidate)}
      </fieldset>
      {!result && error?.kind !== "uncertain" && (
        <button
          className="primary full"
          disabled={busy || !network.withdraw || !address || !amount}
          onClick={() => void inspect()}
        >
          {busy ? "요청 처리 중…" : "출금 정보 검토 →"}
        </button>
      )}
      {review && (
        <div className="review-box">
          <div className="eyebrow">
            FINAL REVIEW ·{" "}
            {Math.max(0, Math.ceil((review.expiresAt - clock) / 1000))}초 남음
          </div>
          <h3>출금 내용을 최종 확인하세요</h3>
          <dl>
            <dt>거래소 · 네트워크</dt>
            <dd>
              {exchangeName(exchange)} · {review.request.network}
            </dd>
            <dt>출금 수량</dt>
            <dd>
              {review.request.amount} {review.request.currency}
            </dd>
            <dt>수수료</dt>
            <dd>
              {review.fee} {review.request.currency}
            </dd>
            <dt>받는 주소</dt>
            <dd className="mono">{review.request.address}</dd>
            {review.request.tag && (
              <>
                <dt>태그 / 메모</dt>
                <dd>{review.request.tag}</dd>
              </>
            )}
          </dl>
          <p>{review.note}</p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            주소·네트워크·수량을 확인했으며 실제 출금을 실행합니다.
          </label>
          <button
            className="primary full"
            disabled={!confirmed || busy || review.expiresAt <= clock}
            onClick={() => void flow.execute()}
          >
            실제 출금 요청
          </button>
        </div>
      )}
      {error && (
        <div
          className={`notice ${error.kind === "uncertain" ? "warning" : "error"}`}
          role="alert"
        >
          <strong>
            {error.kind === "uncertain"
              ? "처리 여부 확인 필요"
              : "요청을 완료하지 못했습니다"}
          </strong>
          <p>{error.message}</p>
          {attempt && (
            <p className="mono">
              {exchangeName(attempt.target.exchange)} · {attempt.amount}{" "}
              {attempt.currency} · {attempt.network}
              <br />
              {attempt.address}
            </p>
          )}
          {error.kind === "uncertain" && attempt && (
            <button onClick={() => onHistory(attempt.currency, "withdraw")}>
              이 출금의 내역 새로고침
            </button>
          )}
        </div>
      )}
      {result && (
        <div className="notice success">
          <strong>출금 요청이 접수되었습니다.</strong>
          <p>{result.state}</p>
          <p className="mono">
            {result.request.amount} {result.request.currency} ·{" "}
            {result.request.network}
            <br />
            {result.request.address}
          </p>
          <code>요청 ID: {result.id}</code>
          <div className="button-row">
            <button
              onClick={() => onHistory(result.request.currency, "withdraw")}
            >
              출금 내역 확인
            </button>
            <button
              onClick={() => {
                flow.reset();
                setAmount("");
              }}
            >
              새 출금 작성
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
