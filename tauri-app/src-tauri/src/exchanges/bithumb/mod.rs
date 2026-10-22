mod auth;
mod contracts;
mod krw;
mod market;
mod wallet;
mod withdrawals;
use crate::{
    config::{self, Credentials},
    contracts::*,
    error::{AppError, Result},
    review::Tickets,
    transport::*,
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
pub use contracts::WithdrawalDetails;
pub use contracts::{KrwExecution, KrwRequest, KrwReview};
use hmac::{Hmac, Mac};
use reqwest::Method;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use sha2::{Digest, Sha256, Sha512};

pub struct Bithumb {
    http: reqwest::Client,
    credentials: Credentials,
    tickets: Tickets,
    krw_tickets: Tickets<KrwRequest>,
}

impl Bithumb {
    pub fn new(http: reqwest::Client) -> Self {
        Self {
            http,
            credentials: config::load("BITHUMB"),
            tickets: Tickets::default(),
            krw_tickets: Tickets::default(),
        }
    }

    pub fn ready(&self) -> bool {
        self.credentials.ready()
    }
}
