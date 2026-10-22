import { useEffect, useState } from "react";
import { type HistoryEntry, useQuery } from "../api";
import { type Exchange, exchanges } from "../exchanges";
export function History({
  exchange,
  currency,
  initialKind,
  nonce,
  busy,
}: {
  exchange: Exchange;
  currency: string;
  initialKind: "deposit" | "withdraw";
  nonce: number;
  busy: boolean;
}) {
  const [kind, setKind] = useState(initialKind);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setKind(initialKind);
    setPage(1);
  }, [currency, initialKind, nonce]);
  return (
    <HistoryPage
      key={`${currency}:${kind}:${page}:${nonce}`}
      {...{ exchange, currency, kind, page, setPage, setKind, busy }}
    />
  );
}
function HistoryPage({
  exchange,
  currency,
  kind,
  page,
  setPage,
  setKind,
  busy,
}: {
  exchange: Exchange;
  currency: string;
  kind: "deposit" | "withdraw";
  page: number;
  setPage: (v: number) => void;
  setKind: (v: "deposit" | "withdraw") => void;
  busy: boolean;
}) {
  const q = useQuery<HistoryEntry[]>(
    "history",
    { exchange, currency, kind, page },
    !busy && currency !== "",
  );
  const date = (value: string) => {
    const d = new Date(/^\d+$/.test(value) ? Number(value) : value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ko-KR");
  };
  return (
    <section className="panel history-panel">
      <div className="panel-heading">
        <div>
          <h3>{currency} 입출금 내역</h3>
          <p>
            {exchanges[exchange].historyDescription}
          </p>
        </div>
        <div className="button-row">
          <div className="segmented">
            {(["deposit", "withdraw"] as const).map((k) => (
              <button
                disabled={busy}
                className={kind === k ? "selected" : ""}
                key={k}
                onClick={() => {
                  setPage(1);
                  setKind(k);
                }}
              >
                {k === "deposit" ? "입금" : "출금"}
              </button>
            ))}
          </div>
          <button disabled={busy || q.loading || currency === ""} onClick={q.refresh}>
            ↻ 새로고침
          </button>
        </div>
      </div>
      {q.error && <div className="notice error">{q.error.message}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>일시</th>
              <th>네트워크</th>
              <th className="right">수량 / 수수료</th>
              <th>상태</th>
              <th>TXID / 요청 ID</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((r, i) => (
              <tr key={`${r.id}:${i}`}>
                <td className="nowrap">{date(r.time)}</td>
                <td>{r.network}</td>
                <td className="right mono">
                  {r.amount}
                  <small>{r.fee !== null ? `수수료 ${r.fee}` : "—"}</small>
                </td>
                <td>
                  <span className="badge">{r.state}</span>
                </td>
                <td className="txid" title={r.address ?? undefined}>
                  <code>{r.txid || r.id}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {q.loading && <div className="empty">내역을 불러오고 있습니다…</div>}
      {!q.loading && !q.error && !q.data?.length && (
        <div className="empty">
          해당 기간의 {kind === "deposit" ? "입금" : "출금"} 내역이 없습니다.
        </div>
      )}
      <div className="pagination">
        <button
          disabled={page <= 1 || q.loading || busy}
          onClick={() => setPage(page - 1)}
        >
          ← 이전
        </button>
        <span>{page} 페이지</span>
        <button
          disabled={
            q.loading || busy || (q.data?.length ?? 0) < 50 || page >= 100
          }
          onClick={() => setPage(page + 1)}
        >
          다음 →
        </button>
      </div>
    </section>
  );
}
