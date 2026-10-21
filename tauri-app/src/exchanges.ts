// Frontend presentation and supported UI actions. API policy stays in the backend.
interface ExchangeDefinition {
  name: string;
  code: string;
  logo: string;
  workspaceLabel: string;
  walletLabel: string;
  accountDescription: string;
  defaultMarket: string;
  quoteCurrency: string;
  canGenerateDepositAddress: boolean;
  historyDescription: string;
}

export const exchanges = {
  bithumb: {
    name: "빗썸",
    code: "BITHUMB",
    logo: "b",
    workspaceLabel: "빗썸",
    walletLabel: "PERSONAL WALLET",
    accountDescription: "빗썸 거래 계정",
    defaultMarket: "KRW-BTC",
    quoteCurrency: "KRW",
    canGenerateDepositAddress: true,
    historyDescription: "최신순 · 페이지당 50건",
  },
  binance: {
    name: "바이낸스",
    code: "BINANCE",
    logo: "◆",
    workspaceLabel: "Binance Spot",
    walletLabel: "PERSONAL WALLET",
    accountDescription: "바이낸스 현물 지갑",
    defaultMarket: "BTCUSDT",
    quoteCurrency: "USDT",
    canGenerateDepositAddress: false,
    historyDescription: "최근 89일 · 페이지당 50건",
  },
} satisfies Record<string, ExchangeDefinition>;

export type Exchange = keyof typeof exchanges;
export const exchangeIds = Object.keys(exchanges) as Exchange[];
export const defaultExchange = exchangeIds[0];
export const exchangeName = (exchange: Exchange) => exchanges[exchange].name;
