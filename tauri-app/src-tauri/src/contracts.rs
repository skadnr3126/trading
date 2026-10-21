use crate::{
    error::{AppError, Result},
    exchanges::bithumb::WithdrawalDetails,
};
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Exchange {
    Bithumb,
    Binance,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub exchange: Exchange,
    pub configured: bool,
}
#[derive(Serialize, Deserialize)]
pub struct Asset {
    pub currency: String,
    pub available: String,
    pub locked: String,
}
#[derive(Serialize, Deserialize)]
pub struct Market {
    pub symbol: String,
    pub base: String,
    pub quote: String,
    pub name: String,
}
#[derive(Serialize, Deserialize)]
pub struct Candle {
    pub time: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Network {
    pub id: String,
    pub name: String,
    pub deposit: bool,
    pub withdraw: bool,
    pub memo_required: bool,
}
#[derive(Serialize)]
pub struct DepositAddress {
    pub currency: String,
    pub network: String,
    pub address: Option<String>,
    pub tag: Option<String>,
    pub message: String,
}
#[derive(Serialize)]
pub struct HistoryEntry {
    pub id: String,
    pub currency: String,
    pub network: String,
    pub amount: String,
    pub fee: Option<String>,
    pub state: String,
    pub time: String,
    pub txid: Option<String>,
    pub address: Option<String>,
}
#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum HistoryKind {
    Deposit,
    Withdraw,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(
    tag = "exchange",
    content = "details",
    rename_all = "lowercase",
    deny_unknown_fields
)]
pub enum WithdrawalTarget {
    Bithumb(WithdrawalDetails),
    Binance,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Withdrawal {
    pub currency: String,
    pub network: String,
    pub amount: String,
    pub address: String,
    pub tag: Option<String>,
    pub target: WithdrawalTarget,
}
impl Withdrawal {
    pub fn exchange(&self) -> Exchange {
        match self.target {
            WithdrawalTarget::Bithumb(_) => Exchange::Bithumb,
            WithdrawalTarget::Binance => Exchange::Binance,
        }
    }
    pub fn validate(&self) -> Result<()> {
        symbol(&self.currency)?;
        symbol(&self.network)?;
        decimal(&self.amount)?;
        if self.address.trim().is_empty()
            || self.address.trim() != self.address
            || self.address.len() > 256
        {
            return Err(AppError::invalid("출금 주소를 확인하세요."));
        }
        if let Some(tag) = &self.tag
            && (tag.len() > 128 || tag.trim() != tag)
        {
            return Err(AppError::invalid("태그를 확인하세요."));
        }
        Ok(())
    }
}
pub fn symbol(value: &str) -> Result<()> {
    if value.is_empty()
        || value.len() > 40
        || !value
            .bytes()
            .all(|v| v.is_ascii_uppercase() || v.is_ascii_digit() || b"_-".contains(&v))
    {
        return Err(AppError::invalid("자산·네트워크·마켓 코드를 확인하세요."));
    }
    Ok(())
}
pub fn decimal(value: &str) -> Result<rust_decimal::Decimal> {
    if value.is_empty()
        || value.len() > 40
        || !value.bytes().all(|v| v.is_ascii_digit() || v == b'.')
    {
        return Err(AppError::invalid("수량은 양의 십진수로 입력하세요."));
    }
    let n = rust_decimal::Decimal::from_str_exact(value)
        .map_err(|_| AppError::invalid("수량의 정밀도 또는 형식을 확인하세요."))?;
    if n <= rust_decimal::Decimal::ZERO {
        return Err(AppError::invalid("수량은 0보다 커야 합니다."));
    }
    Ok(n)
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawalReview {
    pub ticket: String,
    pub request: Withdrawal,
    pub fee: String,
    pub minimum: String,
    pub expires_at: u64,
    pub note: String,
}
#[derive(Serialize)]
pub struct Execution {
    pub id: String,
    pub state: String,
    pub request: Withdrawal,
}
#[derive(Serialize)]
pub struct AllowedAddress {
    pub currency: String,
    pub network: String,
    pub address: String,
    pub tag: Option<String>,
    pub label: String,
    pub target: Option<WithdrawalTarget>,
}
