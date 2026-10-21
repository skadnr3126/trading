use serde::Serialize;
pub type Result<T> = std::result::Result<T, AppError>;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub kind: &'static str,
    pub message: String,
}
impl AppError {
    pub fn new(kind: &'static str, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new("validation", message)
    }
    pub fn schema() -> Self {
        Self::new(
            "response",
            "거래소 응답 형식을 확인할 수 없습니다. 새로고침해 주세요.",
        )
    }
    pub fn uncertain() -> Self {
        Self::new(
            "uncertain",
            "거래소 접수 여부를 확인할 수 없습니다. 같은 요청을 다시 실행하기 전에 해당 자산의 내역 또는 입금 주소를 조회하세요.",
        )
    }
}
