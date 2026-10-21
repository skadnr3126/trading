use super::*;
impl Binance {
    pub async fn review(&self, r: Withdrawal) -> Result<WithdrawalReview> {
        r.validate()?;
        let coin = self.coin(&r.currency).await?;
        let n = rows(&coin["networkList"])?
            .iter()
            .find(|n| n["network"] == r.network)
            .ok_or_else(|| AppError::invalid("네트워크를 확인하세요."))?;
        if n["withdrawEnable"] != true {
            return Err(AppError::invalid("현재 출금이 중단된 네트워크입니다."));
        }
        if !string(n, "memoRegex").is_empty() && r.tag.as_deref().unwrap_or_default().is_empty() {
            return Err(AppError::invalid("이 네트워크는 태그/메모가 필요합니다."));
        }
        let amount = decimal(&r.amount)?;
        let min = string(n, "withdrawMin");
        let fee = string(n, "withdrawFee");
        let parse = |s: &str| Decimal::from_str_exact(s).map_err(|_| AppError::schema());
        if amount < parse(&min)? || amount <= parse(&fee)? {
            return Err(AppError::invalid("최소 출금 수량과 수수료를 확인하세요."));
        }
        let step = string(n, "withdrawIntegerMultiple");
        if !step.is_empty() {
            let step = parse(&step)?;
            if step > Decimal::ZERO && amount % step != Decimal::ZERO {
                return Err(AppError::invalid(format!(
                    "출금 수량은 {step}의 배수여야 합니다."
                )));
            }
        }
        if let Some(max) = optional(n, "withdrawMax") {
            let max = parse(&max)?;
            if max > Decimal::ZERO && amount > max {
                return Err(AppError::invalid("최대 출금 수량을 초과했습니다."));
            }
        }
        let balance = self
            .assets()
            .await?
            .into_iter()
            .find(|a| a.currency == r.currency)
            .ok_or_else(|| AppError::invalid("출금 가능한 잔고가 없습니다."))?;
        if amount > parse(&balance.available)? {
            return Err(AppError::invalid("출금 가능한 잔고가 부족합니다."));
        }
        Ok(self.tickets.issue(r,fee,min,"바이낸스 현물 지갑에서 출금합니다. 수수료는 출금 수량에서 차감됩니다. 최종 정책과 한도는 거래소가 판정합니다.".into()).await)
    }

    pub async fn execute(&self, ticket: &str) -> Result<Execution> {
        let r = self.tickets.consume(ticket).await?;
        let mut p = params(&[
            ("coin", &r.currency),
            ("network", &r.network),
            ("address", &r.address),
            ("amount", &r.amount),
            ("walletType", "0"),
            ("withdrawOrderId", ticket),
        ]);
        if let Some(tag) = &r.tag
            && !tag.is_empty()
        {
            p.push(("addressTag".into(), tag.clone()));
        }
        let v = self
            .signed(Method::POST, "/sapi/v1/capital/withdraw/apply", p)
            .await?;
        let id = optional(&v, "id").ok_or_else(AppError::uncertain)?;
        Ok(Execution {
            id,
            state: "접수됨 · 완료 여부는 출금 내역에서 확인".into(),
            request: r,
        })
    }
}
