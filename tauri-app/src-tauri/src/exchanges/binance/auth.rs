use super::*;

#[derive(Clone, Copy)]
pub(super) enum Api {
    Spot,
    UsdtM,
    CoinM,
}

impl Api {
    pub(super) fn base(self) -> &'static str {
        match self {
            Self::Spot => "https://api.binance.com",
            Self::UsdtM => "https://fapi.binance.com",
            Self::CoinM => "https://dapi.binance.com",
        }
    }

    fn time_path(self) -> &'static str {
        match self {
            Self::Spot => "/api/v3/time",
            Self::UsdtM => "/fapi/v1/time",
            Self::CoinM => "/dapi/v1/time",
        }
    }
}

impl Binance {
    pub(super) async fn public(&self, path: &str, p: Vec<(String, String)>) -> Result<Value> {
        send(
            self.http
                .get(format!("https://api.binance.com{path}"))
                .query(&p),
            false,
        )
        .await
    }

    pub(super) async fn signed(
        &self,
        method: Method,
        path: &str,
        p: Vec<(String, String)>,
    ) -> Result<Value> {
        self.signed_for(Api::Spot, method, path, p).await
    }

    pub(super) async fn signed_for(
        &self,
        api: Api,
        method: Method,
        path: &str,
        mut p: Vec<(String, String)>,
    ) -> Result<Value> {
        if !self.ready() {
            return Err(AppError::new(
                "configuration",
                "BINANCE_KEY / BINANCE_SECRET 설정을 확인하세요.",
            ));
        }
        let time = send(
            self.http.get(format!("{}{}", api.base(), api.time_path())),
            false,
        )
        .await?;
        let timestamp = time["serverTime"].as_u64().ok_or_else(AppError::schema)?;
        p.push(("timestamp".into(), timestamp.to_string()));
        p.push(("recvWindow".into(), "10000".into()));
        let q = query(&p);
        let mut mac = Hmac::<Sha256>::new_from_slice(self.credentials.secret.as_bytes())
            .map_err(|_| AppError::schema())?;
        mac.update(q.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());
        let mutation = method == Method::POST;
        send(
            self.http
                .request(
                    method,
                    format!("{}{path}?{q}&signature={signature}", api.base()),
                )
                .header("X-MBX-APIKEY", &self.credentials.key),
            mutation,
        )
        .await
    }
}
