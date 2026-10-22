use crate::{
    contracts::*,
    error::{AppError, Result},
    exchanges::{
        Exchanges,
        binance::{FuturesAccount, FuturesAsset},
        bithumb::{KrwExecution, KrwRequest, KrwReview},
    },
};
use tauri::State;
#[tauri::command]
pub async fn review_bithumb_krw(
    state: State<'_, Exchanges>,
    request: KrwRequest,
) -> Result<KrwReview> {
    state.bithumb.review_krw(request).await
}
#[tauri::command]
pub async fn execute_bithumb_krw(
    state: State<'_, Exchanges>,
    ticket: String,
) -> Result<KrwExecution> {
    state.bithumb.execute_krw(&ticket).await
}
#[tauri::command]
pub fn connection_status(state: State<'_, Exchanges>) -> Vec<Connection> {
    [Exchange::Bithumb, Exchange::Binance]
        .into_iter()
        .map(|exchange| Connection {
            exchange,
            configured: state.ready(exchange),
        })
        .collect()
}
#[tauri::command]
pub async fn assets(state: State<'_, Exchanges>, exchange: Exchange) -> Result<Vec<Asset>> {
    match exchange {
        Exchange::Bithumb => state.bithumb.assets().await,
        Exchange::Binance => state.binance.assets().await,
    }
}
#[tauri::command]
pub async fn binance_futures_assets(
    state: State<'_, Exchanges>,
    account: FuturesAccount,
) -> Result<Vec<FuturesAsset>> {
    state.binance.futures_assets(account).await
}
#[tauri::command]
pub async fn markets(state: State<'_, Exchanges>, exchange: Exchange) -> Result<Vec<Market>> {
    match exchange {
        Exchange::Bithumb => state.bithumb.markets().await,
        Exchange::Binance => state.binance.markets().await,
    }
}
#[tauri::command]
pub async fn candles(
    state: State<'_, Exchanges>,
    exchange: Exchange,
    market: String,
    interval: String,
) -> Result<Vec<Candle>> {
    symbol(&market)?;
    if !["1m", "5m", "15m", "1h", "4h", "1d"].contains(&interval.as_str()) {
        return Err(AppError::invalid("지원하지 않는 간격입니다."));
    }
    match exchange {
        Exchange::Bithumb => state.bithumb.candles(&market, &interval).await,
        Exchange::Binance => state.binance.candles(&market, &interval).await,
    }
}
#[tauri::command]
pub async fn networks(
    state: State<'_, Exchanges>,
    exchange: Exchange,
    currency: String,
) -> Result<Vec<Network>> {
    symbol(&currency)?;
    match exchange {
        Exchange::Bithumb => state.bithumb.networks(&currency).await,
        Exchange::Binance => state.binance.networks(&currency).await,
    }
}
#[tauri::command]
pub async fn deposit_address(
    state: State<'_, Exchanges>,
    exchange: Exchange,
    currency: String,
    network: String,
) -> Result<DepositAddress> {
    symbol(&currency)?;
    symbol(&network)?;
    match exchange {
        Exchange::Bithumb => state.bithumb.deposit(&currency, &network, false).await,
        Exchange::Binance => state.binance.deposit(&currency, &network).await,
    }
}
#[tauri::command]
pub async fn generate_address(
    state: State<'_, Exchanges>,
    exchange: Exchange,
    currency: String,
    network: String,
) -> Result<DepositAddress> {
    symbol(&currency)?;
    symbol(&network)?;
    match exchange {
        Exchange::Bithumb => state.bithumb.deposit(&currency, &network, true).await,
        Exchange::Binance => state.binance.deposit(&currency, &network).await,
    }
}
#[tauri::command]
pub async fn history(
    state: State<'_, Exchanges>,
    exchange: Exchange,
    currency: String,
    kind: HistoryKind,
    page: u32,
) -> Result<Vec<HistoryEntry>> {
    symbol(&currency)?;
    if page == 0 || page > 100 {
        return Err(AppError::invalid("페이지 범위를 확인하세요."));
    }
    match exchange {
        Exchange::Bithumb => state.bithumb.history(&currency, kind, page).await,
        Exchange::Binance => state.binance.history(&currency, kind, page).await,
    }
}
#[tauri::command]
pub async fn withdraw_addresses(
    state: State<'_, Exchanges>,
    exchange: Exchange,
) -> Result<Vec<AllowedAddress>> {
    match exchange {
        Exchange::Bithumb => state.bithumb.addresses().await,
        Exchange::Binance => state.binance.addresses().await,
    }
}
#[tauri::command]
pub async fn review_withdrawal(
    state: State<'_, Exchanges>,
    request: Withdrawal,
) -> Result<WithdrawalReview> {
    match request.exchange() {
        Exchange::Bithumb => state.bithumb.review(request).await,
        Exchange::Binance => state.binance.review(request).await,
    }
}
#[tauri::command]
pub async fn execute_withdrawal(
    state: State<'_, Exchanges>,
    exchange: Exchange,
    ticket: String,
) -> Result<Execution> {
    match exchange {
        Exchange::Bithumb => state.bithumb.execute(&ticket).await,
        Exchange::Binance => state.binance.execute(&ticket).await,
    }
}
