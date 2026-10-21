import { useState } from "react";
import { type Exchange, type Asset, useQuery, exchangeName } from "./api";
import { Chart } from "./features/Chart";
import { Transfers } from "./features/Transfers";
import "./App.css";

export default function App() {
  const [exchange, setExchange] = useState<Exchange>("bithumb");
  const [tab, setTab] = useState("overview");
  const [locked, setLocked] = useState(false);
  const [transferCurrency, setTransferCurrency] = useState("BTC");
  const status = useQuery<{ exchange: Exchange; configured: boolean }[]>(
    "connection_status",
    {},
  );
  const ready = status.data?.find((s) => s.exchange === exchange)?.configured;
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={() => {
            if (!locked) setTab("overview");
          }}
        >
          <span className="brand-icon">◈</span> folio
          <span className="brand-dot">.</span>
        </a>
        <div className="eyebrow">YOUR WORKSPACE</div>
        <nav>
          {[
            ["overview", "◫", "자산 현황"],
            ["chart", "⌁", "거래소 차트"],
            ["transfer", "⇄", "입출금"],
          ].map(([id, icon, label]) => (
            <button
              disabled={locked}
              key={id}
              className={tab === id ? "nav-item active" : "nav-item"}
              onClick={() => setTab(id)}
            >
              <span>{icon}</span>
              {label}
              {tab === id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="live-dot" /> LOCAL WORKSPACE
          <p>API 키는 이 기기에 보관됩니다.</p>
          <small>빗썸 · Binance Spot</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            {tab === "overview"
              ? "자산 현황"
              : tab === "chart"
                ? "거래소 차트"
                : "입출금"}
          </div>
          <div className="exchange-switch">
            {(["bithumb", "binance"] as Exchange[]).map((e) => (
              <button
                disabled={locked}
                className={exchange === e ? "selected" : ""}
                key={e}
                onClick={() => setExchange(e)}
              >
                <span className={`exchange-logo ${e}`}>
                  {e === "bithumb" ? "b" : "◆"}
                </span>
                {exchangeName(e)}
              </button>
            ))}
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {exchange === "bithumb" ? "BITHUMB" : "BINANCE"} / PERSONAL
                WALLET
              </div>
              <h1>
                {tab === "overview"
                  ? "나의 자산"
                  : tab === "chart"
                    ? "시장의 흐름"
                    : "자산을 옮기는 가장 명확한 방법"}
              </h1>
              <p>
                {tab === "overview"
                  ? "거래소별 보유 자산을 한눈에 확인하세요."
                  : tab === "chart"
                    ? "거래소의 실제 캔들 데이터를 확인하세요."
                    : "자산과 네트워크를 확인하고 입출금을 진행하세요."}
              </p>
            </div>
            <span className={`status ${ready ? "ok" : ""}`}>
              <span className="live-dot" />
              {ready
                ? "API 키 설정됨"
                : status.loading
                  ? "설정 확인 중"
                  : "API 키 미설정"}
            </span>
          </div>
          {status.error && (
            <div className="notice error">{status.error.message}</div>
          )}
          <div key={exchange}>
            {tab === "overview" && (
              <Assets
                exchange={exchange}
                onChart={() => setTab("chart")}
                onTransfer={(currency = "BTC") => {
                  setTransferCurrency(currency);
                  setTab("transfer");
                }}
              />
            )}
            {tab === "chart" && <Chart exchange={exchange} />}
            {tab === "transfer" && (
              <Transfers
                exchange={exchange}
                initialCurrency={transferCurrency}
                onBusy={setLocked}
              />
            )}
          </div>
        </main>
        <footer>
          FOLIO TERMINAL <span>거래소별 독립 연결 · KRW / USDT</span>
        </footer>
      </div>
    </div>
  );
}
function Assets({
  exchange,
  onChart,
  onTransfer,
}: {
  exchange: Exchange;
  onChart: () => void;
  onTransfer: (currency?: string) => void;
}) {
  const q = useQuery<Asset[]>("assets", { exchange });
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(true);
  const visible = (q.data ?? []).filter(
    (a) =>
      a.currency.includes(search.toUpperCase()) &&
      (!hideZero || Number(a.available) + Number(a.locked) > 0),
  );
  return (
    <>
      <div className="summary-grid">
        <section className="summary-card accent">
          <div className="eyebrow">CONNECTED EXCHANGE</div>
          <h2>
            {exchangeName(exchange)} <span>↗</span>
          </h2>
          <p>
            {exchange === "bithumb" ? "빗썸 거래 계정" : "바이낸스 현물 지갑"}
          </p>
          <button className="text-button" onClick={() => onTransfer()}>
            입출금 바로가기 →
          </button>
        </section>
        <section className="summary-card">
          <div className="eyebrow">ASSETS HELD</div>
          <h2>
            {q.data
              ? q.data.filter((a) => Number(a.available) + Number(a.locked) > 0)
                  .length
              : "—"}{" "}
            <small>종</small>
          </h2>
          <p>보유 중인 자산</p>
        </section>
        <section className="summary-card">
          <div className="eyebrow">MARKET EXPLORER</div>
          <h2>
            Market <span className="green">⌁</span>
          </h2>
          <p>마켓별 캔들 · 거래량</p>
          <button className="text-button" onClick={onChart}>
            차트 살펴보기 →
          </button>
        </section>
      </div>
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
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => setHideZero(e.target.checked)}
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
        ⓘ 자산 평가는 서로 다른 기준 통화를 합산하지 않습니다. 빗썸과 바이낸스의
        잔고는 각각 조회됩니다.
      </div>
    </>
  );
}
