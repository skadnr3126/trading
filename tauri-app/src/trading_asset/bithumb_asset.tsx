import { type Asset, useQuery } from "../api";
import { exchanges, exchangeName } from "../exchanges";
import { type AssetActions } from "./contracts";
import { type AssetFilterControls } from "./view_state";

export function BithumbAsset({ onChart, onTransfer, filters, onFiltersChange }: AssetActions & AssetFilterControls) {
  const exchange = "bithumb";
  const q = useQuery<Asset[]>("assets", { exchange });
  const { search, hideZero } = filters;
  const visible = (q.data ?? []).filter(
    (a) =>
      a.currency.includes(search.toUpperCase()) &&
      (!hideZero || Number(a.available) + Number(a.locked) > 0),
  );
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>
              보유 자산 <span className="count">{visible.length}</span>
            </h3>
            <p>수량은 거래소에서 제공한 원래 정밀도로 표시합니다.</p>
          </div>
          <button onClick={q.refresh} disabled={q.loading}>
            {q.loading ? "조회 중…" : "↻ 새로고침"}
          </button>
        </div>
        <div className="table-tools">
          <input
            aria-label="자산 검색"
            className="search"
            placeholder="⌕  자산 검색"
            value={search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => onFiltersChange({ ...filters, hideZero: e.target.checked })}
            />{" "}
            잔고 없는 자산 숨기기
          </label>
        </div>
        {q.error && <div className="notice error">{q.error.message}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>자산</th>
                <th className="right">사용 가능</th>
                <th className="right">주문·출금 대기</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.currency}>
                  <td>
                    <span className="coin-icon">{a.currency.slice(0, 1)}</span>
                    <strong>{a.currency}</strong>
                  </td>
                  <td className="right mono">{a.available}</td>
                  <td className="right mono muted">{a.locked}</td>
                  <td className="right">
                    <button
                      disabled={a.currency === "KRW"}
                      className="text-button"
                      onClick={() => onTransfer(a.currency)}
                    >
                      입출금 ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!q.loading && !q.error && visible.length === 0 && (
          <div className="empty">표시할 자산이 없습니다.</div>
        )}
        {q.loading && (
          <div className="empty">거래소에서 자산을 불러오고 있습니다…</div>
        )}
      </section>
      <div className="footnote">
        ⓘ 자산 평가는 서로 다른 기준 통화를 합산하지 않습니다. 거래소별 잔고는
        각각 조회됩니다.
      </div>
    </>
  );
}
