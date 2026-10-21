mod auth;
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
use hmac::{Hmac, Mac};
use reqwest::Method;
use rust_decimal::Decimal;
use serde_json::Value;
use sha2::Sha256;

pub struct Binance {
    http: reqwest::Client,
    credentials: Credentials,
    tickets: Tickets,
}

impl Binance {
    pub fn new(http: reqwest::Client) -> Self {
        Self {
            http,
            credentials: config::load("BINANCE"),
            tickets: Tickets::default(),
        }
    }

    pub fn ready(&self) -> bool {
        self.credentials.ready()
    }
}
