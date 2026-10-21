use super::*;
impl Bithumb {
    pub async fn markets(&self) -> Result<Vec<Market>> {
        let v = self
            .request(Method::GET, "/v1/market/all", vec![], false)
            .await?;
        rows(&v)?
            .iter()
            .map(|r| {
                let symbol = string(r, "market");
                let (quote, base) = symbol.split_once('-').ok_or_else(AppError::schema)?;
                Ok(Market {
                    base: base.into(),
                    quote: quote.into(),
                    name: string(r, "korean_name"),
                    symbol,
                })
            })
            .collect()
    }

    pub async fn candles(&self, market: &str, interval: &str) -> Result<Vec<Candle>> {
        let path = match interval {
            "1m" => "/v1/candles/minutes/1",
            "5m" => "/v1/candles/minutes/5",
            "15m" => "/v1/candles/minutes/15",
            "1h" => "/v1/candles/minutes/60",
            "4h" => "/v1/candles/minutes/240",
            "1d" => "/v1/candles/days",
            _ => return Err(AppError::invalid("지원하지 않는 차트 간격입니다.")),
        };
        let v = self
            .request(
                Method::GET,
                path,
                params(&[("market", market), ("count", "120")]),
                false,
            )
            .await?;
        let mut result: Vec<Candle> = rows(&v)?
            .iter()
            .map(|r| {
                Ok(Candle {
                    time: chrono::NaiveDateTime::parse_from_str(
                        &string(r, "candle_date_time_utc"),
                        "%Y-%m-%dT%H:%M:%S",
                    )
                    .map_err(|_| AppError::schema())?
                    .and_utc()
                    .timestamp(),
                    open: number(r, "opening_price")?,
                    high: number(r, "high_price")?,
                    low: number(r, "low_price")?,
                    close: number(r, "trade_price")?,
                    volume: number(r, "candle_acc_trade_volume")?,
                })
            })
            .collect::<Result<_>>()?;
        result.sort_by_key(|r| r.time);
        Ok(result)
    }
}
