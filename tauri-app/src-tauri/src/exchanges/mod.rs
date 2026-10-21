pub mod binance;
pub mod bithumb;
#[cfg(test)]
mod live_tests;
use crate::contracts::Exchange;
use std::time::Duration;
pub struct Exchanges {
    pub bithumb: bithumb::Bithumb,
    pub binance: binance::Binance,
}
impl Exchanges {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("HTTP client");
        Self {
            bithumb: bithumb::Bithumb::new(http.clone()),
            binance: binance::Binance::new(http),
        }
    }
    pub fn ready(&self, e: Exchange) -> bool {
        match e {
            Exchange::Bithumb => self.bithumb.ready(),
            Exchange::Binance => self.binance.ready(),
        }
    }
}
