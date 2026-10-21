use super::*;
impl Binance {
    pub async fn assets(&self) -> Result<Vec<Asset>> {
        let v = self.signed(Method::GET, "/api/v3/account", vec![]).await?;
        rows(&v["balances"])?
            .iter()
            .map(|r| {
                Ok(Asset {
                    currency: required(r, "asset")?,
                    available: required(r, "free")?,
                    locked: required(r, "locked")?,
                })
            })
            .collect()
    }

    pub(super) async fn coin(&self, currency: &str) -> Result<Value> {
        let v = self
            .signed(Method::GET, "/sapi/v1/capital/config/getall", vec![])
            .await?;
        rows(&v)?
            .iter()
            .find(|r| r["coin"] == currency)
            .cloned()
            .ok_or_else(|| AppError::invalid("지원하지 않는 자산입니다."))
    }

    pub async fn networks(&self, currency: &str) -> Result<Vec<Network>> {
        let v = self.coin(currency).await?;
        Ok(rows(&v["networkList"])?
            .iter()
            .map(|r| Network {
                id: string(r, "network"),
                name: string(r, "name"),
                deposit: r["depositEnable"] == true,
                withdraw: r["withdrawEnable"] == true,
                memo_required: !string(r, "memoRegex").is_empty(),
            })
            .collect())
    }

    pub async fn deposit(&self, currency: &str, network: &str) -> Result<DepositAddress> {
        let v = self
            .signed(
                Method::GET,
                "/sapi/v1/capital/deposit/address",
                params(&[("coin", currency), ("network", network)]),
            )
            .await?;
        Ok(DepositAddress {
            currency: currency.into(),
            network: network.into(),
            address: optional(&v, "address"),
            tag: optional(&v, "tag"),
            message: "입금 자산과 네트워크를 반드시 확인하세요.".into(),
        })
    }

    pub async fn history(
        &self,
        currency: &str,
        kind: HistoryKind,
        page: u32,
    ) -> Result<Vec<HistoryEntry>> {
        let (path, limit) = match kind {
            HistoryKind::Deposit => ("/sapi/v1/capital/deposit/hisrec", 50),
            HistoryKind::Withdraw => ("/sapi/v1/capital/withdraw/history", 50),
        };
        // Explicit 90-day window: display the provider's bounded result without pretending it is all-time history.
        let start = (now() - 89 * 86_400_000).to_string();
        let v = self
            .signed(
                Method::GET,
                path,
                params(&[
                    ("coin", currency),
                    ("startTime", &start),
                    ("limit", &limit.to_string()),
                    ("offset", &((page - 1) * 50).to_string()),
                ]),
            )
            .await?;
        rows(&v)?
            .iter()
            .take(50)
            .map(|r| {
                Ok(HistoryEntry {
                    id: optional(r, "id")
                        .or_else(|| optional(r, "txId"))
                        .unwrap_or_default(),
                    currency: string(r, "coin"),
                    network: string(r, "network"),
                    amount: string(r, "amount"),
                    fee: optional(r, "transactionFee"),
                    state: history_state(kind, r["status"].as_i64()),
                    time: optional(r, "insertTime")
                        .or_else(|| optional(r, "applyTime"))
                        .unwrap_or_default(),
                    txid: optional(r, "txId"),
                    address: optional(r, "address"),
                })
            })
            .collect()
    }

    pub async fn addresses(&self) -> Result<Vec<AllowedAddress>> {
        let v = self
            .signed(
                Method::GET,
                "/sapi/v1/capital/withdraw/address/list",
                vec![],
            )
            .await?;
        Ok(rows(&v)?
            .iter()
            .map(|r| AllowedAddress {
                currency: string(r, "coin"),
                network: string(r, "network"),
                address: string(r, "address"),
                tag: optional(r, "addressTag"),
                label: string(r, "name"),
                target: Some(WithdrawalTarget::Binance),
            })
            .collect())
    }
}
fn history_state(kind: HistoryKind, status: Option<i64>) -> String {
    match (kind, status) {
        (HistoryKind::Deposit, Some(0)) => "입금 대기",
        (HistoryKind::Deposit, Some(1)) => "입금 완료",
        (HistoryKind::Deposit, Some(6)) => "입금 확인 중",
        (HistoryKind::Deposit, Some(7)) => "반환 대기",
        (HistoryKind::Deposit, Some(8)) => "입금 보류",
        (HistoryKind::Withdraw, Some(0)) => "이메일 확인 대기",
        (HistoryKind::Withdraw, Some(1)) => "취소",
        (HistoryKind::Withdraw, Some(2)) => "승인 대기",
        (HistoryKind::Withdraw, Some(3)) => "거절",
        (HistoryKind::Withdraw, Some(4)) => "처리 중",
        (HistoryKind::Withdraw, Some(5)) => "실패",
        (HistoryKind::Withdraw, Some(6)) => "출금 완료",
        _ => return format!("알 수 없는 상태 ({status:?})"),
    }
    .into()
}
