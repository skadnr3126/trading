use serde::{Deserialize, Serialize};
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
