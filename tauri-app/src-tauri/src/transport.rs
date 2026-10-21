use crate::error::{AppError, Result};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
pub fn query(params: &[(String, String)]) -> String {
    url::form_urlencoded::Serializer::new(String::new())
        .extend_pairs(params.iter().map(|(k, v)| (k, v)))
        .finish()
}
pub fn params(items: &[(&str, &str)]) -> Vec<(String, String)> {
    items
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}
pub fn string(v: &Value, key: &str) -> String {
    match &v[key] {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        _ => String::new(),
    }
}
pub fn optional(v: &Value, key: &str) -> Option<String> {
    let s = string(v, key);
    if s.is_empty() { None } else { Some(s) }
}
pub fn required(v: &Value, key: &str) -> Result<String> {
    optional(v, key).ok_or_else(AppError::schema)
}
pub fn rows(v: &Value) -> Result<&Vec<Value>> {
    v.as_array().ok_or_else(AppError::schema)
}
pub fn number(v: &Value, key: &str) -> Result<f64> {
    let n = string(v, key)
        .parse::<f64>()
        .map_err(|_| AppError::schema())?;
    if n.is_finite() {
        Ok(n)
    } else {
        Err(AppError::schema())
    }
}
pub async fn send(request: reqwest::RequestBuilder, mutation: bool) -> Result<Value> {
    let response = request.send().await.map_err(|_| {
        if mutation {
            AppError::uncertain()
        } else {
            AppError::new(
                "network",
                "거래소에 연결할 수 없습니다. 네트워크를 확인하세요.",
            )
        }
    })?;
    let status = response.status();
    let data = response.json::<Value>().await.map_err(|_| {
        if mutation {
            AppError::uncertain()
        } else {
            AppError::schema()
        }
    })?;
    let api_error = data.get("error").is_some()
        || data
            .get("code")
            .and_then(Value::as_i64)
            .is_some_and(|n| n < 0);
    if !status.is_success() || api_error {
        if mutation
            && (status.is_server_error()
                || status.as_u16() == 408
                || data["code"] == -1007
                || data["code"] == -1006)
        {
            return Err(AppError::uncertain());
        }
        let message = optional(&data["error"], "message")
            .or_else(|| optional(&data, "msg"))
            .unwrap_or_else(|| format!("거래소 요청이 거절되었습니다 (HTTP {}).", status.as_u16()));
        return Err(AppError::new("rejected", message));
    }
    Ok(data)
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };
    async fn response(status: &str, body: &str, mutation: bool) -> Result<Value> {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let reply = format!(
            "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            let mut b = [0; 4096];
            let _ = s.read(&mut b);
            s.write_all(reply.as_bytes()).unwrap();
        });
        send(
            reqwest::Client::new().post(format!("http://127.0.0.1:{port}")),
            mutation,
        )
        .await
    }
    #[tokio::test]
    async fn mutation_preserves_ambiguous_results_and_explicit_rejections() {
        assert_eq!(
            response("504 Gateway Timeout", r#"{"msg":"timeout"}"#, true)
                .await
                .unwrap_err()
                .kind,
            "uncertain"
        );
        assert_eq!(
            response("200 OK", "broken", true).await.unwrap_err().kind,
            "uncertain"
        );
        assert_eq!(
            response("400 Bad Request", r#"{"code":-1007,"msg":"timeout"}"#, true)
                .await
                .unwrap_err()
                .kind,
            "uncertain"
        );
        assert_eq!(
            response(
                "400 Bad Request",
                r#"{"error":{"message":"rejected"}}"#,
                true
            )
            .await
            .unwrap_err()
            .kind,
            "rejected"
        );
        assert_eq!(
            response("200 OK", "broken", false).await.unwrap_err().kind,
            "response"
        );
    }
}
