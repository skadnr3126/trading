use super::*;
impl Binance {
    pub async fn markets(&self) -> Result<Vec<Market>> {
        let v = self.public("/api/v3/exchangeInfo", vec![]).await?;
        Ok(rows(&v["symbols"])?
            .iter()
            .filter(|r| r["status"] == "TRADING" && r["isSpotTradingAllowed"] == true)
            .map(|r| Market {
                symbol: string(r, "symbol"),
                base: string(r, "baseAsset"),
                quote: string(r, "quoteAsset"),
                name: string(r, "baseAsset"),
            })
            .collect())
    }

    pub async fn candles(&self, market: &str, interval: &str) -> Result<Vec<Candle>> {
        let v = self
            .public(
                "/api/v3/klines",
                params(&[("symbol", market), ("interval", interval), ("limit", "120")]),
            )
            .await?;
        rows(&v)?
            .iter()
            .map(|r| {
                let n = |i: usize| {
                    r[i].as_str()
                        .and_then(|s| s.parse::<f64>().ok())
                        .filter(|n| n.is_finite())
                        .ok_or_else(AppError::schema)
                };
                Ok(Candle {
                    time: r[0].as_i64().ok_or_else(AppError::schema)? / 1000,
                    open: n(1)?,
                    high: n(2)?,
                    low: n(3)?,
                    close: n(4)?,
                    volume: n(5)?,
                })
            })
            .collect()
    }
}
