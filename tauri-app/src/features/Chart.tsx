import { useState } from "react";
import {
  type Exchange,
  type Market,
  type Candle,
  useQuery,
  format,
} from "../api";

export function Chart({ exchange }: { exchange: Exchange }) {
  const markets = useQuery<Market[]>("markets", { exchange });
  const [selected, setSelected] = useState(
    exchange === "bithumb" ? "KRW-BTC" : "BTCUSDT",
  );
  const [interval, setInterval] = useState("1h");
  const [search, setSearch] = useState("");
  const q = useQuery<Candle[]>(
    "candles",
    { exchange, market: selected, interval },
    true,
    30_000,
  );
  const market = markets.data?.find((m) => m.symbol === selected);
  const last = q.data?.[q.data.length - 1];
  const filtered = (markets.data ?? []).filter((m) =>
    `${m.symbol} ${m.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="chart-layout">
      <section className="panel market-list">
        <div className="panel-heading">
          <h3>마켓</h3>
          <button className="text-button" onClick={markets.refresh}>
            ↻
          </button>
        </div>
        <input
          className="search"
          placeholder="자산·마켓 검색"
          aria-label="마켓 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {markets.error && (
          <div className="notice error">{markets.error.message}</div>
        )}
        <div className="market-scroll">
          {filtered.map((m) => (
            <button
              key={m.symbol}
              className={
                m.symbol === selected ? "market-row chosen" : "market-row"
              }
              onClick={() => setSelected(m.symbol)}
            >
              <strong>
                {m.base} <small>/ {m.quote}</small>
              </strong>
              <span>{m.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{market?.name ?? selected}</div>
            <h2>{market ? `${market.base} / ${market.quote}` : selected}</h2>
          </div>
          <div className="right">
            <h2 className="mono">{last ? format(last.close) : "—"}</h2>
            <small className="muted">{market?.quote} · 최근 캔들 종가</small>
          </div>
        </div>
        <div className="chart-toolbar">
          <div className="segmented">
            {[
              ["1m", "1분"],
              ["5m", "5분"],
              ["15m", "15분"],
              ["1h", "1시간"],
              ["4h", "4시간"],
              ["1d", "1일"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={interval === id ? "selected" : ""}
                onClick={() => setInterval(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="text-button"
            onClick={q.refresh}
            disabled={q.loading}
          >
            ↻ {q.loading ? "갱신 중" : "새로고침"}
          </button>
        </div>
        {q.error ? (
          <div className="notice error">{q.error.message}</div>
        ) : q.data?.length ? (
          <CandleChart data={q.data} />
        ) : (
          <div className="empty chart-empty">
            {q.loading
              ? "캔들 데이터를 불러오는 중…"
              : "캔들 데이터가 없습니다."}
          </div>
        )}
        <div className="chart-bottom">
          <span>
            <i className="live-dot" /> 30초마다 갱신
          </span>
          <span>OHLCV · 최근 120개 캔들 · 시간 KST</span>
        </div>
      </section>
    </div>
  );
}
function CandleChart({ data }: { data: Candle[] }) {
  const [hover, setHover] = useState<number>();
  const W = 960,
    H = 430,
    left = 16,
    right = 115,
    plotW = W - left - right;
  const low = Math.min(...data.map((c) => c.low)),
    high = Math.max(...data.map((c) => c.high));
  const pad = (high - low || high * 0.01 || 1) * 0.08;
  const y = (v: number) =>
    22 + ((high + pad - v) / (high - low + 2 * pad)) * 290;
  const dx = plotW / data.length,
    maxVolume = Math.max(...data.map((c) => c.volume), 1);
  const active = data[hover ?? data.length - 1];
  return (
    <>
      <div className="ohlc mono">
        <span>{new Date(active.time * 1000).toLocaleString("ko-KR")}</span>
        <span>시 {format(active.open)}</span>
        <span>고 {format(active.high)}</span>
        <span>저 {format(active.low)}</span>
        <span>종 {format(active.close)}</span>
        <span>량 {format(active.volume)}</span>
      </div>
      <svg
        className="candlestick"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="가격 캔들 및 거래량 차트"
        onMouseLeave={() => setHover(undefined)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(
                data.length - 1,
                Math.floor(
                  (((e.clientX - rect.left) / rect.width) * W - left) / dx,
                ),
              ),
            ),
          );
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const price = high + pad - ((high - low + 2 * pad) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={W - right}
                y1={y(price)}
                y2={y(price)}
                stroke="#27313b"
                strokeDasharray="3 5"
              />
              <text
                x={W - right + 14}
                y={y(price) + 4}
                fill="#82909f"
                fontSize="12"
              >
                {format(price)}
              </text>
            </g>
          );
        })}
        {data.map((c, i) => {
          const x = left + dx * (i + 0.5),
            color = c.close >= c.open ? "#64d6b0" : "#ef8191";
          return (
            <g key={c.time}>
              <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} />
              <rect
                x={x - dx * 0.3}
                width={Math.max(1, dx * 0.6)}
                y={Math.min(y(c.open), y(c.close))}
                height={Math.max(1, Math.abs(y(c.open) - y(c.close)))}
                fill={color}
              />
              <rect
                x={x - dx * 0.3}
                width={Math.max(1, dx * 0.6)}
                y={390 - (c.volume / maxVolume) * 52}
                height={(c.volume / maxVolume) * 52}
                fill={color}
                opacity=".35"
              />
            </g>
          );
        })}
        {[
          0,
          Math.floor(data.length / 3),
          Math.floor((data.length * 2) / 3),
          data.length - 1,
        ].map((i) => (
          <text key={i} x={left + dx * i} y="416" fill="#82909f" fontSize="12">
            {new Date(data[i].time * 1000).toLocaleDateString("ko-KR", {
              month: "2-digit",
              day: "2-digit",
            })}{" "}
            {new Date(data[i].time * 1000).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </text>
        ))}
        {hover !== undefined && (
          <line
            x1={left + dx * (hover + 0.5)}
            x2={left + dx * (hover + 0.5)}
            y1="15"
            y2="390"
            stroke="#aab7c6"
            strokeDasharray="4 4"
          />
        )}
      </svg>
    </>
  );
}
