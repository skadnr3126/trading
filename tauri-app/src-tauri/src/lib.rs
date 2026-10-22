mod commands;
mod config;
mod contracts;
mod error;
mod exchanges;
mod review;
mod transport;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(exchanges::Exchanges::new())
        .invoke_handler(tauri::generate_handler![
            commands::connection_status,
            commands::assets,
            commands::binance_futures_assets,
            commands::markets,
            commands::candles,
            commands::networks,
            commands::deposit_address,
            commands::generate_address,
            commands::history,
            commands::withdraw_addresses,
            commands::review_withdrawal,
            commands::execute_withdrawal
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
