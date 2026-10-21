import { useEffect, useState } from "react";
import {
  type Network,
  type Details,
  type Withdrawal,
  type Review,
  type Execution,
  type AllowedAddress,
  type Failure,
  api,
  failure,
  useQuery,
} from "../api";
import { type Exchange, exchangeName } from "../exchanges";
export function Withdraw({
  exchange,
  currency,
  network,
  onBusy,
  onHistory,
}: {
  exchange: Exchange;
  currency: string;
  network: Network;
  onBusy: (v: boolean) => void;
  onHistory: (currency: string, kind: "withdraw") => void;
}) {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [tag, setTag] = useState("");
  const [details, setDetails] = useState<Details>({
    type: "whitelist",
    exchange: "",
  });
  const [review, setReview] = useState<Review>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Execution>();
  const [error, setError] = useState<Failure>();
  const [attempt, setAttempt] = useState<Withdrawal>();
  const [clock, setClock] = useState(Date.now());
  const allowed = useQuery<AllowedAddress[]>("withdraw_addresses", {
    exchange,
  });
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  function invalidate() {
    setReview(undefined);
    setConfirmed(false);
  }
  const request = (): Withdrawal => {
    const common = {
      currency,
      network: network.id,
      address,
      amount,
      tag: tag || null,
    };
    switch (exchange) {
      case "bithumb":
        return { ...common, target: { exchange, details } };
      case "binance":
        return { ...common, target: { exchange } };
      default: {
        const unsupported: never = exchange;
        throw new Error(`지원하지 않는 출금 거래소: ${unsupported}`);
      }
    }
  };
  async function inspect() {
    setBusy(true);
    onBusy(true);
    setError(undefined);
    invalidate();
    try {
      setReview(await api<Review>("review_withdrawal", { request: request() }));
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function execute() {
    if (!review || !confirmed || review.expiresAt <= Date.now() || busy) return;
    const snapshot = review;
    invalidate();
    setAttempt(snapshot.request);
    setBusy(true);
    onBusy(true);
    setError(undefined);
    try {
      const response = await api<Execution>("execute_withdrawal", {
        exchange,
        ticket: snapshot.ticket,
      });
      setResult(response);
    } catch (e) {
      setError(failure(e, true));
    } finally {
      setBusy(false);
      onBusy(false);
      onHistory(snapshot.request.currency, "withdraw");
    }
  }
  const locked = busy || !!result || error?.kind === "uncertain";
  function choose(index: string) {
    if (index === "") return;
    const a = allowed.data?.[Number(index)];
    if (!a || a.currency !== currency || a.network !== network.id) return;
    invalidate();
    setAddress(a.address);
    setTag(a.tag ?? "");
    if (exchange === "bithumb" && a.target?.exchange === "bithumb")
      setDetails(a.target.details);
  }
  const matching = allowed.data
    ?.map((a, index) => ({ ...a, index }))
    .filter((a) => a.currency === currency && a.network === network.id);
  const field = (key: keyof Details, value: string) => {
    invalidate();
    setDetails((d) => ({ ...d, [key]: value }));
  };
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
        {exchange === "bithumb" && (
          <div className="bithumb-details">
            <div className="eyebrow">BITHUMB RECIPIENT</div>
            <label>
              수취인 유형
              <select
                value={details.type}
                onChange={(e) => {
                  invalidate();
                  setDetails({ type: e.target.value as Details["type"] });
                }}
              >
                <option value="whitelist">
                  화이트리스트 / CODE ID Connect
                </option>
                <option value="personal">CODE 개인</option>
                <option value="corporation">CODE 법인</option>
                <option value="internal">빗썸 내부 출금</option>
              </select>
            </label>
            {details.type !== "internal" && (
              <label>
                받는 거래소 영문명
                <input
                  value={details.exchange ?? ""}
                  onChange={(e) => field("exchange", e.target.value)}
                  placeholder="예: Binance (등록 정보와 동일하게 입력)"
                />
              </label>
            )}
            {(details.type === "personal" ||
              details.type === "corporation") && (
              <div className="form-grid">
                <label>
                  수취인 / 대표자 국문명
                  <input
                    value={details.korean ?? ""}
                    onChange={(e) => field("korean", e.target.value)}
                  />
                </label>
                <label>
                  수취인 / 대표자 영문명
                  <input
                    value={details.english ?? ""}
                    onChange={(e) => field("english", e.target.value)}
                  />
                </label>
              </div>
            )}
            {details.type === "corporation" && (
              <div className="form-grid">
                <label>
                  법인 국문명
                  <input
                    value={details.corpKorean ?? ""}
                    onChange={(e) => field("corpKorean", e.target.value)}
                  />
                </label>
                <label>
                  법인 영문명
                  <input
                    value={details.corpEnglish ?? ""}
                    onChange={(e) => field("corpEnglish", e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
        )}
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
            onClick={() => void execute()}
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
                setResult(undefined);
                setAmount("");
                setAttempt(undefined);
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
