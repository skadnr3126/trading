use super::*;
impl Bithumb {
    pub async fn assets(&self) -> Result<Vec<Asset>> {
        let v = self
            .request(Method::GET, "/v1/accounts", vec![], true)
            .await?;
        rows(&v)?
            .iter()
            .map(|r| {
                Ok(Asset {
                    currency: required(r, "currency")?,
                    available: required(r, "balance")?,
                    locked: required(r, "locked")?,
                })
            })
            .collect()
    }

    pub async fn networks(&self, currency: &str) -> Result<Vec<Network>> {
        let v = self
            .request(Method::GET, "/v1/status/wallet", vec![], true)
            .await?;
        rows(&v)?
            .iter()
            .filter(|r| r["currency"] == currency)
            .map(|r| {
                let state = string(r, "wallet_state");
                let id = string(r, "net_type");
                if id.is_empty() {
                    return Err(AppError::schema());
                }
                Ok(Network {
                    id,
                    name: optional(r, "network_name").unwrap_or_else(|| string(r, "net_type")),
                    deposit: state == "working" || state == "deposit_only",
                    withdraw: state == "working" || state == "withdraw_only",
                    memo_required: matches!(currency, "XRP" | "XLM" | "EOS" | "ATOM"),
                })
            })
            .collect()
    }

    pub async fn deposit(
        &self,
        currency: &str,
        network: &str,
        generate: bool,
    ) -> Result<DepositAddress> {
        let path = if generate {
            "/v1/deposits/generate_coin_address"
        } else {
            "/v1/deposits/coin_address"
        };
        let v = self
            .request(
                if generate { Method::POST } else { Method::GET },
                path,
                params(&[("currency", currency), ("net_type", network)]),
                true,
            )
            .await?;
        if v["success"] == false {
            return Err(AppError::new(
                "rejected",
                optional(&v, "message")
                    .unwrap_or_else(|| "입금 주소 생성이 거절되었습니다.".into()),
            ));
        }
        Ok(DepositAddress {
            currency: currency.into(),
            network: network.into(),
            address: optional(&v, "deposit_address"),
            tag: optional(&v, "secondary_address"),
            message: optional(&v, "message").unwrap_or_else(|| {
                if v["deposit_address"].is_string() {
                    "입금 자산과 네트워크, 태그를 확인하세요.".into()
                } else {
                    "주소 생성 중일 수 있습니다. 잠시 후 주소를 다시 조회하세요.".into()
                }
            }),
        })
    }

    pub async fn history(
        &self,
        currency: &str,
        kind: HistoryKind,
        page: u32,
    ) -> Result<Vec<HistoryEntry>> {
        let path = match (currency, kind) {
            ("KRW", kind) => super::krw::krw_path(kind),
            (_, HistoryKind::Deposit) => "/v1/deposits",
            (_, HistoryKind::Withdraw) => "/v1/withdraws",
        };
        let mut p = params(&[
            ("page", &page.to_string()),
            ("limit", "50"),
            ("order_by", "desc"),
        ]);
        if currency != "KRW" {
            p.push(("currency".into(), currency.into()));
        }
        let v = self.request(Method::GET, path, p, true).await?;
        rows(&v)?
            .iter()
            .map(|r| {
                Ok(HistoryEntry {
                    id: string(r, "uuid"),
                    currency: string(r, "currency"),
                    network: if currency == "KRW" {
                        "연결 은행 계좌".into()
                    } else {
                        string(r, "net_type")
                    },
                    amount: string(r, "amount"),
                    fee: optional(r, "fee"),
                    state: string(r, "state"),
                    time: string(r, "created_at"),
                    txid: optional(r, "txid"),
                    address: optional(r, "address"),
                })
            })
            .collect()
    }

    pub async fn addresses(&self) -> Result<Vec<AllowedAddress>> {
        let v = self
            .request(Method::GET, "/v1/withdraws/coin_addresses", vec![], true)
            .await?;
        Ok(rows(&v)?
            .iter()
            .map(|r| {
                let exchange = string(r, "exchange_name");
                let bithumb = match string(r, "owner_type").as_str() {
                    "personal" => Some(WithdrawalDetails::Personal {
                        exchange: exchange.clone(),
                        korean: string(r, "owner_ko_name"),
                        english: string(r, "owner_en_name"),
                    }),
                    "corporation" => Some(WithdrawalDetails::Corporation {
                        exchange: exchange.clone(),
                        korean: string(r, "owner_ko_name"),
                        english: string(r, "owner_en_name"),
                        corp_korean: string(r, "owner_corp_ko_name"),
                        corp_english: string(r, "owner_corp_en_name"),
                    }),
                    _ if !exchange.is_empty() => Some(WithdrawalDetails::Whitelist {
                        exchange: exchange.clone(),
                    }),
                    _ => None,
                };
                AllowedAddress {
                    currency: string(r, "currency"),
                    network: string(r, "net_type"),
                    address: optional(r, "withdraw_address")
                        .or_else(|| optional(r, "address"))
                        .unwrap_or_default(),
                    tag: optional(r, "secondary_address"),
                    label: exchange,
                    target: bithumb.map(WithdrawalTarget::Bithumb),
                }
            })
            .collect())
    }
}
