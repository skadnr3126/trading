use super::*;

impl KrwRequest {
    fn validate(&self) -> Result<Decimal> {
        // Bank transfers use whole won; never round a user's requested amount.
        if !self.amount.bytes().all(|b| b.is_ascii_digit()) {
            return Err(AppError::invalid(
                "원화 금액은 1원 단위의 양의 정수로 입력하세요.",
            ));
        }
        decimal(&self.amount)
    }

    fn parameters(&self) -> Vec<(String, String)> {
        params(&[("amount", &self.amount), ("two_factor_type", "kakao")])
    }

    fn path(&self) -> &'static str {
        krw_path(self.kind)
    }
}

pub(super) fn krw_path(kind: HistoryKind) -> &'static str {
    match kind {
        HistoryKind::Deposit => "/v1/deposits/krw",
        HistoryKind::Withdraw => "/v1/withdraws/krw",
    }
}

impl Bithumb {
    pub async fn review_krw(&self, request: KrwRequest) -> Result<KrwReview> {
        let amount = request.validate()?;
        if !self.ready() {
            return Err(AppError::new(
                "configuration",
                "BITHUMB_KEY / BITHUMB_SECRET 설정을 확인하세요.",
            ));
        }
        let available_balance = match request.kind {
            HistoryKind::Deposit => None,
            HistoryKind::Withdraw => {
                // The coin-only chance endpoint rejects KRW net_type. Do not invent a
                // network, fee, or bank limit; the bank API makes the final decision.
                Some(check_balance(&self.assets().await?, amount)?)
            }
        };
        let (ticket, expires_at) = self.krw_tickets.store(request.clone()).await;
        Ok(KrwReview {
            ticket,
            request,
            available_balance,
            expires_at,
        })
    }

    pub async fn execute_krw(&self, ticket: &str) -> Result<KrwExecution> {
        // Consume before any external side effect, including an ambiguous timeout.
        let request = self.krw_tickets.consume(ticket).await?;
        let value = self
            .request(Method::POST, request.path(), request.parameters(), true)
            .await?;
        execution(&value, request)
    }
}

fn check_balance(assets: &[Asset], amount: Decimal) -> Result<String> {
    let balance = assets
        .iter()
        .find(|a| a.currency == "KRW")
        .map(|a| a.available.as_str())
        .unwrap_or("0");
    let available = Decimal::from_str_exact(balance).map_err(|_| AppError::schema())?;
    if amount > available {
        return Err(AppError::invalid("원화 사용 가능 잔고가 부족합니다."));
    }
    Ok(balance.into())
}

fn execution(value: &Value, request: KrwRequest) -> Result<KrwExecution> {
    let kind = match request.kind {
        HistoryKind::Deposit => "deposit",
        HistoryKind::Withdraw => "withdraw",
    };
    if value["currency"] != "KRW"
        || value["type"] != kind
        || Decimal::from_str_exact(&string(value, "amount")).ok() != Some(request.validate()?)
    {
        return Err(AppError::uncertain());
    }
    Ok(KrwExecution {
        id: optional(value, "uuid").ok_or_else(AppError::uncertain)?,
        state: optional(value, "state").ok_or_else(AppError::uncertain)?,
        fee: optional(value, "fee").ok_or_else(AppError::uncertain)?,
        request,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    // Opt-in: these endpoints only read; never submit a bank transfer.
    #[tokio::test]
    #[ignore]
    async fn live_krw_read_only() {
        let exchange = Bithumb::new(reqwest::Client::new());
        assert!(exchange.ready(), "Bithumb credentials not configured");
        let assets = exchange.assets().await.expect("KRW balance read");
        for asset in assets.iter().filter(|a| a.currency == "KRW") {
            assert!(Decimal::from_str_exact(&asset.available).is_ok());
        }
        for kind in [HistoryKind::Deposit, HistoryKind::Withdraw] {
            exchange
                .history("KRW", kind, 1)
                .await
                .expect("KRW history read");
        }
    }
    #[test]
    fn withdrawal_checks_available_won_without_counting_locked_balance() {
        let assets = [Asset {
            currency: "KRW".into(),
            available: "5000".into(),
            locked: "10000".into(),
        }];
        assert_eq!(check_balance(&assets, Decimal::from(5000)).unwrap(), "5000");
        assert!(check_balance(&assets, Decimal::from(5001)).is_err());
        assert!(check_balance(&[], Decimal::ONE).is_err());
    }
    fn request(kind: &str, amount: &str) -> KrwRequest {
        serde_json::from_value(json!({"kind":kind,"amount":amount,"twoFactorType":"kakao"}))
            .unwrap()
    }
    #[test]
    fn ipc_contract_and_whole_won_validation() {
        for amount in ["", "0", "-1", "1.5", "1.0", "1e4", " 1000", "1,000"] {
            assert!(request("deposit", amount).validate().is_err(), "{amount}");
        }
        assert_eq!(
            request("deposit", "1000").validate().unwrap(),
            Decimal::from(1000)
        );
        for extra in [
            json!({"address":"another-account"}),
            json!({"twoFactorType":"sms"}),
        ] {
            let mut value = serde_json::to_value(request("withdraw", "1000")).unwrap();
            value
                .as_object_mut()
                .unwrap()
                .extend(extra.as_object().unwrap().clone());
            assert!(serde_json::from_value::<KrwRequest>(value).is_err());
        }
    }
    #[test]
    fn bank_endpoints_and_auth_parameters() {
        assert_eq!(request("deposit", "5000").path(), "/v1/deposits/krw");
        let r = request("withdraw", "6000");
        assert_eq!(r.path(), "/v1/withdraws/krw");
        assert_eq!(
            r.parameters(),
            params(&[("amount", "6000"), ("two_factor_type", "kakao")])
        );
    }
    #[test]
    fn processing_is_not_completion_and_malformed_success_is_uncertain() {
        let mut value = json!({"type":"deposit","currency":"KRW","uuid":"123","amount":"5000","fee":"0","state":"PROCESSING"});
        let result = execution(&value, request("deposit", "5000")).unwrap();
        assert_eq!(result.state, "PROCESSING");
        assert_eq!(result.request.amount, "5000");
        assert_eq!(
            execution(&value, request("withdraw", "5000"))
                .unwrap_err()
                .kind,
            "uncertain"
        );
        value["amount"] = json!("6000");
        assert_eq!(
            execution(&value, request("deposit", "5000"))
                .unwrap_err()
                .kind,
            "uncertain"
        );
        value["amount"] = json!("5000");
        value["uuid"] = Value::Null;
        assert_eq!(
            execution(&value, request("deposit", "5000"))
                .unwrap_err()
                .kind,
            "uncertain"
        );
    }
    #[tokio::test]
    async fn krw_tickets_are_single_use_and_separate_from_coin_tickets() {
        let tickets = Tickets::<KrwRequest>::default();
        let (ticket, _) = tickets.store(request("deposit", "5000")).await;
        assert!(
            Tickets::<Withdrawal>::default()
                .consume(&ticket)
                .await
                .is_err()
        );
        assert!(
            Tickets::<KrwRequest>::default()
                .consume(&ticket)
                .await
                .is_err()
        );
        assert_eq!(tickets.consume(&ticket).await.unwrap().amount, "5000");
        assert!(tickets.consume(&ticket).await.is_err());
    }
}
