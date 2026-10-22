import { useState } from "react";
import { type Asset, useQuery } from "../api";
import { exchanges, exchangeName } from "../exchanges";
import { type AssetActions } from "./contracts";
import { type FuturesAccount, type FuturesAsset } from "./binance_contracts";

export function BinanceAsset({ onChart, onTransfer }: AssetActions) {
  return (
    <div className="binance-assets">
      <SpotAssets onChart={onChart} onTransfer={onTransfer} />
      <FuturesAssets account="usdtM" title="USDT-M Futures" />
      <FuturesAssets account="coinM" title="COIN-M Futures" />
      <p className="footnote">
        계정별 잔고는 각 자산 단위로 표시하며 합산하지 않습니다.
        선물 계정의 자산을 외부로 출금하려면 먼저 Spot으로 이체하세요.
      </p>
    </div>
  );
}

function SpotAssets({ onChart, onTransfer }: AssetActions) {
  const exchange = "binance";
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
          <p>{exchanges[exchange].accountDescription}</p>
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
          <p>Spot 보유 자산</p>
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
              Spot 자산 <span className="count">{visible.length}</span>
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
    </>
  );
}

function FuturesAssets({
  account,
  title,
}: {
  account: FuturesAccount;
  title: string;
}) {
  const query = useQuery<FuturesAsset[]>("binance_futures_assets", { account });
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(true);
  const visible = (query.data ?? []).filter(
    (asset) =>
      asset.currency.includes(search.toUpperCase()) &&
      (!hideZero ||
        [
          asset.walletBalance,
          asset.availableBalance,
          asset.crossWalletBalance,
          asset.crossUnrealizedPnl,
          asset.transferable,
        ].some((value) => /[1-9]/.test(value))),
  );

  return (
    <section className="panel" aria-label={`${title} 자산`}>
      <div className="panel-heading">
        <div>
          <h3>
            {title} 자산 <span className="count">{visible.length}</span>
          </h3>
          <p>
            {account === "usdtM"
              ? "USDⓈ-M 계정의 모든 담보 자산을 표시합니다."
              : "코인 증거금 계정의 자산을 표시합니다."}
          </p>
        </div>
        <button onClick={query.refresh} disabled={query.loading}>
          {query.loading ? "조회 중…" : "↻ 새로고침"}
        </button>
      </div>
      <div className="table-tools">
        <input
          aria-label={`${title} 자산 검색`}
          className="search"
          placeholder="⌕  자산 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(event) => setHideZero(event.target.checked)}
          />{" "}
          잔고 없는 자산 숨기기
        </label>
      </div>
      {query.error && (
        <div className="notice error" role="alert">
          <strong>{title} 조회 실패</strong>
          <p>{query.error.message}</p>
          <small>해당 선물 계정의 활성화 상태와 API 키의 조회 권한을 확인하세요.</small>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>자산</th>
              <th className="right">지갑 잔고</th>
              <th className="right">사용 가능</th>
              <th className="right">교차 지갑 잔고</th>
              <th className="right">교차 미실현 손익</th>
              <th className="right">이체 가능</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((asset) => (
              <tr key={asset.currency}>
                <td>
                  <strong>{asset.currency}</strong>
                </td>
                <td className="right mono">{asset.walletBalance}</td>
                <td className="right mono">{asset.availableBalance}</td>
                <td className="right mono">{asset.crossWalletBalance}</td>
                <td
                  className={`right mono ${asset.crossUnrealizedPnl.startsWith("-") ? "red" : ""}`}
                >
                  {asset.crossUnrealizedPnl}
                </td>
                <td className="right mono">{asset.transferable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.loading && <div className="empty">{title} 자산을 불러오고 있습니다…</div>}
      {!query.loading && !query.error && visible.length === 0 && (
        <div className="empty">표시할 {title} 자산이 없습니다.</div>
      )}
      <p className="footnote">
        수량은 각 행의 자산 단위입니다. 교차 미실현 손익은 격리 포지션 손익을 포함하지 않습니다.
      </p>
    </section>
  );
}
