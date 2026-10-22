import { useId, useState } from "react";
import {
  type Market,
  type Network,
  type DepositAddress,
  api,
  failure,
  useQuery,
} from "../api";
import { type Exchange } from "../exchanges";
import { History } from "./History";
import { transferDefinitions } from "./transfers/registry";

export function Transfers({
  exchange,
  currencyInput,
  onCurrencyChange,
  onBusy,
}: {
  exchange: Exchange;
  currencyInput: string;
  onCurrencyChange: (currency: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const currencyListId = useId();
  const [network, setNetwork] = useState("");
  const [mode, setMode] = useState("deposit");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{
    currency: string;
    kind: "deposit" | "withdraw";
    nonce: number;
  } | null>(null);
  const markets = useQuery<Market[]>("markets", { exchange });
  const definition = transferDefinitions[exchange];
  const currencies = [
    ...new Set([
      "BTC",
      "ETH",
      "XRP",
      "USDT",
      ...(definition.bank ? [definition.bank.currency] : []),
      ...(markets.data ?? []).map((m) => m.base),
    ]),
  ]
    .filter((c) => !definition.excludedCurrencies.includes(c))
    .sort();
  const normalizedCurrency = currencyInput.trim().toUpperCase();
  const currency = currencies.includes(normalizedCurrency) ? normalizedCurrency : "";
  const bank = definition.bank?.currency === currency ? definition.bank : undefined;
  const networks = useQuery<Network[]>(
    "networks",
    { exchange, currency },
    currency !== "" && !bank,
  );
  const selected = currency
    ? networks.data?.find((n) => n.id === network)
    : undefined;
  const setWorking = (value: boolean) => {
    setBusy(value);
    onBusy(value);
  };
  const showHistory = (asset: string, kind: "deposit" | "withdraw") => {
    setHistory((h) => ({ currency: asset, kind, nonce: (h?.nonce ?? 0) + 1 }));
  };
  return (
    <>
      <section className="panel transfer-panel">
        <div className="panel-heading">
          <div>
            <h3>{bank ? bank.title : "가상자산 입출금"}</h3>
            <p>{bank ? bank.description : "주소와 네트워크가 일치하는지 확인하세요."}</p>
          </div>
          <div className="segmented">
            <button
              disabled={busy}
              className={mode === "deposit" ? "selected" : ""}
              onClick={() => setMode("deposit")}
            >
              ↙ 입금
            </button>
            <button
              disabled={busy}
              className={mode === "withdraw" ? "selected" : ""}
              onClick={() => setMode("withdraw")}
            >
              ↗ 출금
            </button>
          </div>
        </div>
        <div className="transfer-body">
          <div className="form-grid">
            <label>
              자산
              <input
                list={currencyListId}
                value={currencyInput}
                placeholder="자산 검색 (예: BTC, ETH)"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                onChange={(e) => {
                  const next = e.target.value.trim().toUpperCase();
                  onCurrencyChange(next);
                  if (next === currency) return;
                  setNetwork("");
                  if (currencies.includes(next)) {
                    showHistory(
                      next,
                      mode === "withdraw" ? "withdraw" : "deposit",
                    );
                  }
                }}
              />
              <datalist id={currencyListId}>
                {currencies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            {!bank && <label>
              네트워크
              <select
                value={selected?.id ?? ""}
                disabled={busy || !currency || networks.loading}
                onChange={(e) => setNetwork(e.target.value)}
              >
                <option value="" disabled>
                  네트워크 선택
                </option>
                {networks.data?.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.id})
                  </option>
                ))}
              </select>
            </label>}
          </div>
          {!currency && (
            <p className="muted">목록에서 자산을 선택하거나 심볼을 끝까지 입력하세요.</p>
          )}
          {networks.error && (
            <div className="notice error">
              {networks.error.message}{" "}
              <button onClick={networks.refresh}>다시 조회</button>
            </div>
          )}
          {networks.loading && (
            <p className="muted">입출금 네트워크를 확인하고 있습니다…</p>
          )}
          {!networks.loading && networks.data?.length === 0 && (
            <div className="notice">이 자산의 입출금 네트워크가 없습니다.</div>
          )}
          {bank && <bank.Form key={`${currency}:${mode}`}
            kind={mode === "withdraw" ? "withdraw" : "deposit"}
            onBusy={setWorking} onHistory={showHistory} />}
          {!bank && selected && (
            <div key={`${currency}:${selected.id}:${mode}`}>
              {mode === "deposit" ? (
                <Deposit
                  exchange={exchange}
                  currency={currency}
                  network={selected}
                  onBusy={setWorking}
                />
              ) : (
                <definition.Withdraw
                  currency={currency}
                  network={selected}
                  onBusy={setWorking}
                  onHistory={showHistory}
                />
              )}
            </div>
          )}
        </div>
      </section>
      <History
        exchange={exchange}
        currency={history?.currency ?? currency}
        initialKind={history?.kind ?? "deposit"}
        nonce={history?.nonce ?? 0}
        busy={busy}
      />
      <p className="footnote">
        {bank ? bank.footnote
          : "가상자산 입금은 외부 지갑에서 조회한 주소로 전송해 진행합니다."}
      </p>
    </>
  );
}
function Deposit({
  exchange,
  currency,
  network,
  onBusy,
}: {
  exchange: Exchange;
  currency: string;
  network: Network;
  onBusy: (v: boolean) => void;
}) {
  const [address, setAddress] = useState<DepositAddress>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  async function read(generate = false) {
    setBusy(true);
    onBusy(true);
    setError("");
    setAddress(undefined);
    try {
      setAddress(
        await api<DepositAddress>(
          generate ? "generate_address" : "deposit_address",
          { exchange, currency, network: network.id },
        ),
      );
    } catch (e) {
      setError(failure(e, generate).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setError("복사하지 못했습니다. 주소를 직접 선택해 복사하세요.");
    }
  }
  return (
    <div className="deposit-area">
      <div className="network-note">
        <span className="live-dot" />
        {network.name} 네트워크{" "}
        <span className={network.deposit ? "green" : "red"}>
          {network.deposit ? "입금 가능" : "입금 중단"}
        </span>
      </div>
      <div className="address-box">
        <span className="address-symbol">↙</span>
        <h3>{currency} 입금 주소</h3>
        <p>선택한 네트워크로만 {currency}을(를) 전송하세요.</p>
        {address?.address ? (
          <>
            <div className="address-value">
              <code>{address.address}</code>
              <button onClick={() => void copy(address.address!)}>
                {copied === address.address ? "복사됨" : "복사"}
              </button>
            </div>
            {address.tag && (
              <div className="tag-box">
                <strong>필수 태그 / 메모</strong>
                <code>{address.tag}</code>
                <button onClick={() => void copy(address.tag!)}>
                  {copied === address.tag ? "복사됨" : "복사"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="muted">주소를 조회해 입금 정보를 확인하세요.</div>
        )}
        {address && <p>{address.message}</p>}
        <div className="button-row">
          <button
            className="primary"
            disabled={busy || !network.deposit}
            onClick={() => void read()}
          >
            {busy ? "처리 중…" : "입금 주소 조회"}
          </button>
          {transferDefinitions[exchange].canGenerateDepositAddress && (
            <button
              disabled={busy || !network.deposit}
              onClick={() => void read(true)}
            >
              주소 생성 요청
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="notice">
        ⓘ 다른 네트워크로 전송하면 자산을 복구할 수 없을 수 있습니다.
        태그/메모가 표시되면 주소와 함께 입력하세요.
      </div>
    </div>
  );
}
