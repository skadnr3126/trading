use super::*;
impl Bithumb {
    pub(super) async fn request(
        &self,
        method: Method,
        path: &str,
        p: Vec<(String, String)>,
        private: bool,
    ) -> Result<Value> {
        let mutation = method == Method::POST;
        let mut req = self
            .http
            .request(method, format!("https://api.bithumb.com{path}"));
        if private {
            if !self.ready() {
                return Err(AppError::new(
                    "configuration",
                    "BITHUMB_KEY / BITHUMB_SECRET 설정을 확인하세요.",
                ));
            }
            let mut payload = json!({"access_key":self.credentials.key,"nonce":uuid::Uuid::new_v4().to_string(),"timestamp":now()});
            if !p.is_empty() {
                payload["query_hash"] = hex::encode(Sha512::digest(query(&p).as_bytes())).into();
                payload["query_hash_alg"] = "SHA512".into();
            }
            let token = jwt(&payload, &self.credentials.secret)?;
            req = req.bearer_auth(token);
        }
        if mutation {
            let body: serde_json::Map<String, Value> =
                p.into_iter().map(|(k, v)| (k, Value::String(v))).collect();
            req = req.json(&body);
        } else {
            req = req.query(&p);
        }
        send(req, mutation).await
    }
}
fn jwt(payload: &Value, secret: &str) -> Result<String> {
    let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"HS256","typ":"JWT"}"#);
    let body = URL_SAFE_NO_PAD.encode(payload.to_string());
    let content = format!("{header}.{body}");
    let mut mac =
        Hmac::<Sha256>::new_from_slice(secret.as_bytes()).map_err(|_| AppError::schema())?;
    mac.update(content.as_bytes());
    Ok(format!(
        "{content}.{}",
        URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes())
    ))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn json_body_keeps_signed_parameter_order() {
        let p = params(&[
            ("currency", "XRP"),
            ("net_type", "XRP"),
            ("amount", "0.123456789012345678"),
            ("receiver_ko_name", "홍길동"),
        ]);
        let body: serde_json::Map<String, Value> =
            p.clone().into_iter().map(|(k, v)| (k, v.into())).collect();
        let decoded: serde_json::Map<String, Value> =
            serde_json::from_str(&serde_json::to_string(&body).unwrap()).unwrap();
        let restored: Vec<(String, String)> = decoded
            .into_iter()
            .map(|(k, v)| (k, v.as_str().unwrap().into()))
            .collect();
        assert_eq!(query(&p), query(&restored));
        assert_eq!(restored[2].1, "0.123456789012345678");
    }
}
