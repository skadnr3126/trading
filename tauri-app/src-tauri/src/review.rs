use crate::{
    contracts::{Withdrawal, WithdrawalReview},
    error::{AppError, Result},
    transport::now,
};
use std::collections::HashMap;
use tokio::sync::Mutex;
pub struct Tickets<T = Withdrawal>(Mutex<HashMap<String, (u64, T)>>);
impl<T> Default for Tickets<T> {
    fn default() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}
impl Tickets {
    pub async fn issue(
        &self,
        request: Withdrawal,
        fee: String,
        minimum: String,
        note: String,
    ) -> WithdrawalReview {
        let (ticket, expires_at) = self.store(request.clone()).await;
        WithdrawalReview {
            ticket,
            request,
            fee,
            minimum,
            expires_at,
            note,
        }
    }
}
impl<T> Tickets<T> {
    pub async fn store(&self, request: T) -> (String, u64) {
        let mut tickets = self.0.lock().await;
        let now = now();
        tickets.retain(|_, (expiry, _)| *expiry > now);
        let ticket = uuid::Uuid::new_v4().to_string();
        let expires_at = now + 60_000;
        tickets.insert(ticket.clone(), (expires_at, request));
        (ticket, expires_at)
    }
    pub async fn consume(&self, ticket: &str) -> Result<T> {
        let (expiry, request) = self.0.lock().await.remove(ticket).ok_or_else(|| {
            AppError::invalid("검토가 없거나 이미 사용되었습니다. 다시 검토하세요.")
        })?;
        if expiry <= now() {
            return Err(AppError::invalid("검토가 만료되었습니다. 다시 검토하세요."));
        }
        Ok(request)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::WithdrawalTarget;
    fn request() -> Withdrawal {
        Withdrawal {
            currency: "BTC".into(),
            network: "BTC".into(),
            amount: "0.01".into(),
            address: "address".into(),
            tag: None,
            target: WithdrawalTarget::Binance,
        }
    }
    #[tokio::test]
    async fn one_use_and_immutable_request() {
        let tickets = Tickets::default();
        let mut draft = request();
        let r = tickets
            .issue(draft.clone(), "0".into(), "0".into(), "".into())
            .await;
        draft.amount = "100".into();
        assert_eq!(tickets.consume(&r.ticket).await.unwrap().amount, "0.01");
        assert!(tickets.consume(&r.ticket).await.is_err());
    }
    #[tokio::test]
    async fn expired_and_cross_instance_rejected() {
        let tickets = Tickets::default();
        tickets.0.lock().await.insert("old".into(), (0, request()));
        assert!(tickets.consume("old").await.is_err());
        let r = tickets
            .issue(request(), "0".into(), "0".into(), "".into())
            .await;
        assert!(
            Tickets::<Withdrawal>::default()
                .consume(&r.ticket)
                .await
                .is_err()
        );
    }
    #[test]
    fn ipc_rejects_unknown_fields_and_wrong_details() {
        let good = serde_json::to_value(request()).unwrap();
        assert!(serde_json::from_value::<Withdrawal>(good.clone()).is_ok());
        let mut bad = good.clone();
        bad["target"]["details"] = serde_json::json!({"receiver":"wrong"});
        assert!(serde_json::from_value::<Withdrawal>(bad).is_err());
        for details in [
            serde_json::json!({"type":"personal","exchange":"Binance"}),
            serde_json::json!({"type":"internal","unexpected":true}),
            serde_json::json!({"type":"whitelist","exchange":"Binance","korean":"unexpected"}),
        ] {
            let mut bad = serde_json::to_value(request()).unwrap();
            bad["target"] = serde_json::json!({"exchange":"bithumb","details":details});
            assert!(serde_json::from_value::<Withdrawal>(bad).is_err());
        }
        let mut bad = good;
        bad["extra"] = true.into();
        assert!(serde_json::from_value::<Withdrawal>(bad).is_err());
        for n in [
            "0",
            "-1",
            "NaN",
            "1e4",
            "1.2.3",
            "0.12345678901234567890123456789",
        ] {
            let mut r = request();
            r.amount = n.into();
            assert!(r.validate().is_err());
        }
    }
}
