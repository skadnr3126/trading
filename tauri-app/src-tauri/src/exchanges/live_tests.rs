// Opt-in integration checks. Only read endpoints; no address creation or withdrawals.
use super::*;
use crate::contracts::HistoryKind;
#[tokio::test]
#[ignore]
async fn live_bithumb_read_only() {
    let e = Exchanges::new();
    assert!(e.bithumb.ready(), "Bithumb credentials not configured");
    assert!(!e.bithumb.markets().await.expect("markets read").is_empty());
    assert!(
        !e.bithumb
            .candles("KRW-BTC", "1h")
            .await
            .expect("candles read")
            .is_empty()
    );
    e.bithumb.assets().await.expect("assets read");
    let networks = e.bithumb.networks("BTC").await.expect("networks read");
    assert!(!networks.is_empty());
    e.bithumb
        .history("BTC", HistoryKind::Deposit, 1)
        .await
        .expect("deposit history read");
    e.bithumb
        .history("BTC", HistoryKind::Withdraw, 1)
        .await
        .expect("withdraw history read");
    e.bithumb
        .addresses()
        .await
        .expect("registered addresses read");
}
#[tokio::test]
#[ignore]
async fn live_binance_read_only() {
    let e = Exchanges::new();
    assert!(e.binance.ready(), "Binance credentials not configured");
    assert!(!e.binance.markets().await.expect("markets read").is_empty());
    assert!(
        !e.binance
            .candles("BTCUSDT", "1h")
            .await
            .expect("candles read")
            .is_empty()
    );
    e.binance.assets().await.expect("assets read");
    assert!(
        !e.binance
            .networks("BTC")
            .await
            .expect("networks read")
            .is_empty()
    );
    e.binance
        .history("BTC", HistoryKind::Deposit, 1)
        .await
        .expect("deposit history read");
    e.binance
        .history("BTC", HistoryKind::Withdraw, 1)
        .await
        .expect("withdraw history read");
    e.binance
        .addresses()
        .await
        .expect("registered addresses read");
}
