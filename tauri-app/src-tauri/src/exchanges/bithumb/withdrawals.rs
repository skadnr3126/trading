use super::*;
impl Bithumb {
    pub async fn review(&self, r: Withdrawal) -> Result<WithdrawalReview> {
        r.validate()?;
        let details = match &r.target {
            WithdrawalTarget::Bithumb(d) => d,
            _ => return Err(AppError::invalid("빗썸 전용 입력이 필요합니다.")),
        };
        details.parameters()?;
        let networks = self.networks(&r.currency).await?;
        let n = networks
            .iter()
            .find(|n| n.id == r.network)
            .ok_or_else(|| AppError::invalid("네트워크를 확인하세요."))?;
        if !n.withdraw {
            return Err(AppError::invalid("현재 출금이 중단된 네트워크입니다."));
        }
        if n.memo_required && r.tag.as_deref().unwrap_or_default().is_empty() {
            return Err(AppError::invalid("태그/메모가 필요합니다."));
        }
        let v = self
            .request(
                Method::GET,
                "/v1/withdraws/chance",
                params(&[("currency", &r.currency), ("net_type", &r.network)]),
                true,
            )
            .await?;
        let (fee, min) = check_chance(&v, decimal(&r.amount)?)?;
        Ok(self.tickets.issue(r,fee,min,"빗썸 출금 수수료와 한도를 조회했습니다. 수수료는 별도 차감되며, 트래블룰·주소 정책은 거래소가 최종 판정합니다.".into()).await)
    }

    pub async fn execute(&self, ticket: &str) -> Result<Execution> {
        let r = self.tickets.consume(ticket).await?;
        let mut p = params(&[
            ("currency", &r.currency),
            ("net_type", &r.network),
            ("amount", &r.amount),
            ("address", &r.address),
        ]);
        if let Some(tag) = &r.tag
            && !tag.is_empty()
        {
            p.push(("secondary_address".into(), tag.clone()));
        }
        if let WithdrawalTarget::Bithumb(d) = &r.target {
            p.extend(d.parameters()?);
        }
        let v = self
            .request(Method::POST, "/v1/withdraws/coin", p, true)
            .await?;
        let id = optional(&v, "uuid").ok_or_else(AppError::uncertain)?;
        Ok(Execution {
            id,
            state: optional(&v, "state").unwrap_or_else(|| "접수됨".into()),
            request: r,
        })
    }
}
impl WithdrawalDetails {
    pub(super) fn parameters(&self) -> Result<Vec<(String, String)>> {
        let p = match self {
            Self::Internal {} => vec![],
            Self::Whitelist { exchange } => params(&[("exchange_name", exchange)]),
            Self::Personal {
                exchange,
                korean,
                english,
            } => params(&[
                ("exchange_name", exchange),
                ("receiver_type", "personal"),
                ("receiver_ko_name", korean),
                ("receiver_en_name", english),
            ]),
            Self::Corporation {
                exchange,
                korean,
                english,
                corp_korean,
                corp_english,
            } => params(&[
                ("exchange_name", exchange),
                ("receiver_type", "corporation"),
                ("receiver_ko_name", korean),
                ("receiver_en_name", english),
                ("receiver_corp_ko_name", corp_korean),
                ("receiver_corp_en_name", corp_english),
            ]),
        };
        if p.iter()
            .any(|(_, v)| v.trim().is_empty() || v.trim() != v || v.len() > 150)
        {
            return Err(AppError::invalid("빗썸 수취인과 거래소 정보를 확인하세요."));
        }
        Ok(p)
    }
}
fn check_chance(v: &Value, amount: Decimal) -> Result<(String, String)> {
    let parse =
        |v: &Value, k: &str| Decimal::from_str_exact(&string(v, k)).map_err(|_| AppError::schema());
    let c = &v["currency"];
    let l = &v["withdraw_limit"];
    if l["can_withdraw"] != true {
        return Err(AppError::invalid(
            "현재 출금할 수 없는 계정 또는 자산입니다.",
        ));
    }
    let min = string(l, "minimum");
    if amount < parse(l, "minimum")? {
        return Err(AppError::invalid("최소 출금 수량보다 작습니다."));
    }
    let fee = if !c["withdraw_fee"].is_null() {
        parse(c, "withdraw_fee")?
    } else {
        let mut fee = amount
            .checked_mul(parse(c, "withdraw_rate")?)
            .ok_or_else(AppError::schema)?;
        if !c["withdraw_fee_min"].is_null() {
            fee = fee.max(parse(c, "withdraw_fee_min")?);
        }
        if !c["withdraw_fee_max"].is_null() {
            fee = fee.min(parse(c, "withdraw_fee_max")?);
        }
        fee
    };
    let debit = amount.checked_add(fee).ok_or_else(AppError::schema)?;
    if debit > parse(&v["account"], "balance")? {
        return Err(AppError::invalid("수수료를 포함한 잔고가 부족합니다."));
    }
    for key in ["onetime", "remaining_daily"] {
        if !l[key].is_null() && amount > parse(l, key)? {
            return Err(AppError::invalid("출금 한도를 초과했습니다."));
        }
    }
    if let Some(fixed) = l["fixed"].as_u64()
        && amount.normalize().scale() as u64 > fixed
    {
        return Err(AppError::invalid("허용된 소수 자릿수를 초과했습니다."));
    }
    Ok((fee.normalize().to_string(), min))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn percentage_fee_is_clamped_and_balance_checked() {
        let mut v = json!({"currency":{"withdraw_fee":null,"withdraw_rate":"0.01","withdraw_fee_min":"1","withdraw_fee_max":"3"},"account":{"balance":"1000"},"withdraw_limit":{"minimum":"1","can_withdraw":true,"fixed":8}});
        assert_eq!(check_chance(&v, Decimal::from(10)).unwrap().0, "1");
        assert_eq!(check_chance(&v, Decimal::from(500)).unwrap().0, "3");
        v["account"]["balance"] = "10".into();
        assert!(check_chance(&v, Decimal::from(10)).is_err());
    }
}
