use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct KrwRequest {
    pub kind: crate::contracts::HistoryKind,
    pub amount: String,
    pub two_factor_type: KakaoAuth,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum KakaoAuth {
    Kakao,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KrwReview {
    pub ticket: String,
    pub request: KrwRequest,
    pub available_balance: Option<String>,
    pub expires_at: u64,
}

#[derive(Debug, Serialize)]
pub struct KrwExecution {
    pub id: String,
    pub state: String,
    pub fee: String,
    pub request: KrwRequest,
}
// Bithumb's public input contract; external API field names stay inside this module.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum WithdrawalDetails {
    Internal {},
    Whitelist {
        exchange: String,
    },
    Personal {
        exchange: String,
        korean: String,
        english: String,
    },
    Corporation {
        exchange: String,
        korean: String,
        english: String,
        #[serde(rename = "corpKorean")]
        corp_korean: String,
        #[serde(rename = "corpEnglish")]
        corp_english: String,
    },
}
