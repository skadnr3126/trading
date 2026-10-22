use super::{auth::Api, *};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FuturesAccount {
    UsdtM,
    CoinM,
}

impl FuturesAccount {
    fn endpoint(self) -> (Api, &'static str) {
        match self {
            Self::UsdtM => (Api::UsdtM, "/fapi/v3/balance"),
            Self::CoinM => (Api::CoinM, "/dapi/v1/balance"),
        }
    }
}

// Binance-specific public output; balances retain the provider's decimal precision.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FuturesAsset {
    pub currency: String,
    pub wallet_balance: String,
    pub available_balance: String,
    pub cross_wallet_balance: String,
    pub cross_unrealized_pnl: String,
    pub transferable: String,
}

impl Binance {
    pub async fn futures_assets(&self, account: FuturesAccount) -> Result<Vec<FuturesAsset>> {
        let (api, path) = account.endpoint();
        let response = self.signed_for(api, Method::GET, path, vec![]).await?;
        parse_balances(&response, account)
    }
}

fn parse_balances(response: &Value, account: FuturesAccount) -> Result<Vec<FuturesAsset>> {
    let transfer_field = match account {
        FuturesAccount::UsdtM => "maxWithdrawAmount",
        FuturesAccount::CoinM => "withdrawAvailable",
    };
    rows(response)?
        .iter()
        .map(|row| {
            Ok(FuturesAsset {
                currency: required(row, "asset")?,
                wallet_balance: balance(row, "balance")?,
                available_balance: balance(row, "availableBalance")?,
                cross_wallet_balance: balance(row, "crossWalletBalance")?,
                cross_unrealized_pnl: balance(row, "crossUnPnl")?,
                transferable: balance(row, transfer_field)?,
            })
        })
        .collect()
}

fn balance(row: &Value, key: &str) -> Result<String> {
    let raw = row[key].as_str().ok_or_else(AppError::schema)?;
    Decimal::from_str_exact(raw).map_err(|_| AppError::schema())?;
    Ok(raw.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn fixture(account: FuturesAccount) -> Value {
        let mut row = json!({
            "asset": "BTC", "balance": "0.123456789012345678",
            "availableBalance": "0.10000000", "crossWalletBalance": "0.12000000",
            "crossUnPnl": "-0.00000001"
        });
        match account {
            FuturesAccount::UsdtM => row["maxWithdrawAmount"] = json!("0.09000000"),
            FuturesAccount::CoinM => row["withdrawAvailable"] = json!("0.08000000"),
        }
        json!([row])
    }

    #[test]
    fn futures_accounts_use_their_own_hosts_and_versions() {
        let (api, path) = FuturesAccount::UsdtM.endpoint();
        assert_eq!(
            format!("{}{path}", api.base()),
            "https://fapi.binance.com/fapi/v3/balance"
        );
        let (api, path) = FuturesAccount::CoinM.endpoint();
        assert_eq!(
            format!("{}{path}", api.base()),
            "https://dapi.binance.com/dapi/v1/balance"
        );
        assert!(matches!(
            serde_json::from_str::<FuturesAccount>(r#""usdtM""#).unwrap(),
            FuturesAccount::UsdtM
        ));
        assert!(matches!(
            serde_json::from_str::<FuturesAccount>(r#""coinM""#).unwrap(),
            FuturesAccount::CoinM
        ));
        assert!(serde_json::from_str::<FuturesAccount>(r#""spot""#).is_err());
    }

    #[test]
    fn preserves_precision_negative_pnl_and_account_specific_transfer_limits() {
        for (account, transfer) in [
            (FuturesAccount::UsdtM, "0.09000000"),
            (FuturesAccount::CoinM, "0.08000000"),
        ] {
            let assets = parse_balances(&fixture(account), account).unwrap();
            let serialized = serde_json::to_value(&assets).unwrap();
            assert_eq!(
                serialized[0],
                json!({
                    "currency": "BTC", "walletBalance": "0.123456789012345678",
                    "availableBalance": "0.10000000", "crossWalletBalance": "0.12000000",
                    "crossUnrealizedPnl": "-0.00000001", "transferable": transfer
                })
            );
        }
    }

    #[test]
    fn empty_accounts_are_valid_but_invalid_responses_are_not_zero_balances() {
        assert!(
            parse_balances(&json!([]), FuturesAccount::CoinM)
                .unwrap()
                .is_empty()
        );
        assert!(parse_balances(&json!({"code": -2015}), FuturesAccount::UsdtM).is_err());
        for field in [
            "asset",
            "balance",
            "availableBalance",
            "crossWalletBalance",
            "crossUnPnl",
            "maxWithdrawAmount",
        ] {
            let mut response = fixture(FuturesAccount::UsdtM);
            response[0].as_object_mut().unwrap().remove(field);
            assert!(
                parse_balances(&response, FuturesAccount::UsdtM).is_err(),
                "missing {field}"
            );
        }
        let mut response = fixture(FuturesAccount::CoinM);
        response[0]["balance"] = json!("not a number");
        assert!(parse_balances(&response, FuturesAccount::CoinM).is_err());
        // Do not silently use the USD-M limit field for a COIN-M account.
        assert!(parse_balances(&fixture(FuturesAccount::UsdtM), FuturesAccount::CoinM).is_err());
    }
}
