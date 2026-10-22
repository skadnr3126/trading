import { useState } from "react";
import { useReviewedOperation } from "../transfers/useReviewedOperation";
import { api, failure } from "../../api";
import type { KrwExecution, KrwKind, KrwRequest, KrwReview } from "./krw_contracts";

export function KrwTransfer({ kind, onBusy, onHistory }: {
  kind: KrwKind;
  onBusy: (busy: boolean) => void;
  onHistory: (currency: string, kind: KrwKind) => void;
}) {
  const [amount, setAmount] = useState("");
  const label = kind === "deposit" ? "입금" : "출금";
  const valid = /^[0-9]+$/.test(amount) && /[1-9]/.test(amount) && amount.length <= 28;
  const flow = useReviewedOperation<KrwRequest, KrwReview, KrwExecution>({
    inspect: (request) => api<KrwReview>("review_bithumb_krw", { request }),
    execute: (review) => api<KrwExecution>("execute_bithumb_krw", { ticket: review.ticket }),
    failure: (error, mutation, request) => {
      const problem = failure(error, mutation);
      return problem.kind === "uncertain" ? {
        kind: "uncertain",
        message: `원화 ${request.kind === "deposit" ? "입금" : "출금"} 접수 여부를 확인할 수 없습니다. 같은 요청을 다시 실행하기 전에 해당 원화 내역을 확인하세요.`,
      } : problem;
    },
    onBusy,
    onSettled: (request) => onHistory("KRW", request.kind),
  });
  const { review, confirmed, busy, result, error, attempt, clock, locked, invalidate, setConfirmed } = flow;
  const inspect = () => { if (valid) void flow.inspect({ kind, amount, twoFactorType: "kakao" }); };

  return <div>
    <div className="notice">
      <strong>빗썸에 연결된 본인 명의 은행 계좌</strong>
      <p>{kind === "deposit"
        ? "연결된 계좌에서 원화를 가져와 빗썸에 입금합니다."
        : "빗썸의 원화를 연결된 계좌로 출금합니다."}</p>
      <p>요청 후 카카오 인증을 완료하세요. 계좌 연결 및 해당 API 권한이 필요합니다.</p>
    </div>
    <fieldset disabled={locked}>
      <label>{label} 금액 (KRW)
        <input inputMode="numeric" value={amount} placeholder="1원 단위로 입력"
          onChange={(e) => {
            setAmount(e.target.value);
            invalidate();
          }} />
      </label>
      {amount && !valid && <small className="red">금액은 1원 단위의 양의 정수로 입력하세요.</small>}
    </fieldset>
    {!locked && <button className="primary full" disabled={!valid} onClick={() => void inspect()}>
      원화 {label} 정보 검토 →
    </button>}
    {busy && <p role="status">요청 처리 중…</p>}
    {review && <div className="review-box">
      <div className="eyebrow">FINAL REVIEW · {Math.max(0, Math.ceil((review.expiresAt - clock) / 1000))}초 남음</div>
      <h3>원화 {label} 내용을 최종 확인하세요</h3>
      <dl>
        <dt>이체 방향</dt><dd>{kind === "deposit" ? "연결 계좌 → 빗썸" : "빗썸 → 연결 계좌"}</dd>
        <dt>금액</dt><dd>{review.request.amount} KRW</dd>
        {review.availableBalance !== null && <><dt>사용 가능 잔고</dt><dd>{review.availableBalance} KRW</dd></>}
        <dt>수수료·한도</dt><dd>사전 조회 불가 · 거래소 최종 판정</dd>
        <dt>2차 인증</dt><dd>카카오 인증</dd>
      </dl>
      <p>수수료는 별도로 부과될 수 있습니다. 요청 후 인증 화면과 처리 내역에서 확인하세요.</p>
      <label className="checkbox"><input type="checkbox" checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)} />
        연결 계좌·금액·수수료를 확인했으며 실제 원화 {label}을 요청합니다.
      </label>
      <button className="primary full" disabled={!confirmed || busy || review.expiresAt <= clock}
        onClick={() => void flow.execute()}>실제 원화 {label} 요청</button>
    </div>}
    {error && <div className={`notice ${error.kind === "uncertain" ? "warning" : "error"}`} role="alert">
      <strong>{error.kind === "uncertain" ? "처리 여부 확인 필요" : "요청을 완료하지 못했습니다"}</strong>
      <p>{error.message}</p>
      {attempt && <p>원화 {attempt.kind === "deposit" ? "입금" : "출금"} · {attempt.amount} KRW</p>}
      {error.kind === "uncertain" && attempt && <button onClick={() => onHistory("KRW", attempt.kind)}>이 요청의 내역 새로고침</button>}
    </div>}
    {result && <div className="notice success">
      <strong>원화 {result.request.kind === "deposit" ? "입금" : "출금"} 요청이 접수되었습니다.</strong>
      <p>{result.request.amount} KRW · 수수료 {result.fee} KRW</p>
      <p>상태: {result.state}</p>
      <p>카카오 인증 요청을 확인하고, 최종 처리 여부는 내역에서 확인하세요.</p>
      <code>요청 ID: {result.id}</code>
      <div className="button-row">
        <button onClick={() => onHistory("KRW", result.request.kind)}>이 요청의 내역 확인</button>
        <button onClick={() => {
          flow.reset(); setAmount("");
        }}>새 요청 작성</button>
      </div>
    </div>}
  </div>;
}
