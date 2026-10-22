import { useState } from "react";
import { useQuery } from "./api";
import {
  type Exchange,
  exchanges,
  exchangeIds,
  defaultExchange,
  exchangeName,
} from "./exchanges";
import { Assets, useAssetViewState } from "./trading_asset";
import { Chart } from "./features/Chart";
import { Transfers } from "./features/Transfers";
import "./App.css";

export default function App() {
  const [exchange, setExchange] = useState<Exchange>(defaultExchange);
  const [tab, setTab] = useState("overview");
  const [assetViewState, setAssetViewState] = useAssetViewState();
  const [locked, setLocked] = useState(false);
  const [transferCurrency, setTransferCurrency] = useState("BTC");
  const status = useQuery<{ exchange: Exchange; configured: boolean }[]>(
    "connection_status",
    {},
  );
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
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="exchange-switch">
            {exchangeIds.map((e) => (
              <button
                disabled={locked}
                className={exchange === e ? "selected" : ""}
                key={e}
                onClick={() => setExchange(e)}
              >
                <span className={`exchange-logo ${e}`}>
                  {exchanges[e].logo}
                </span>
                {exchangeName(e)}
              </button>
            ))}
          </div>
        </header>
        <main>
          
          {status.error && (
            <div className="notice error">{status.error.message}</div>
          )}
          <div key={exchange}>
            {tab === "overview" && (
              <Assets
                exchange={exchange}
                viewState={assetViewState}
                onViewStateChange={setAssetViewState}
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
          FOLIO TERMINAL{" "}
          <span>
            거래소별 독립 연결 ·{" "}
            {Array.from(
              new Set(exchangeIds.map((id) => exchanges[id].quoteCurrency)),
            ).join(" / ")}
          </span>
        </footer>
      </div>
    </div>
  );
}
