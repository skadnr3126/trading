use std::path::PathBuf;
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

// This type is sent from the React UI to Rust, then from Rust to Python.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonRequest {
    action: String,
    left: Option<i64>,
    right: Option<i64>,
}

// This type is printed by Python and returned all the way back to the UI.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonResponse {
    ok: bool,
    message: Option<String>,
    result: Option<i64>,
    error: Option<String>,
}

#[tauri::command]
async fn call_python(request: PythonRequest) -> Result<PythonResponse, String> {
    // CARGO_MANIFEST_DIR is the absolute path to src-tauri.
    // Using it avoids depending on the working directory used by `cargo tauri dev`.
    let script_path: PathBuf = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../backend/main.py")
        .canonicalize()
        .map_err(|error| format!("Python script was not found: {error}"))?;

    // On Windows, `py -3 <script>` runs the installed Python 3 interpreter.
    let mut child = Command::new("py")
        .args(["-3"])
        .arg(script_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start Python: {error}"))?;

    // Send exactly one JSON request through the Python process's standard input.
    let request_json = serde_json::to_vec(&request)
        .map_err(|error| format!("Could not serialize request: {error}"))?;
    let mut stdin = child.stdin.take().ok_or("Could not open Python stdin")?;
    stdin
        .write_all(&request_json)
        .await
        .map_err(|error| format!("Could not write to Python: {error}"))?;
    drop(stdin); // Signals end-of-input, allowing Python's json.load() to finish.

    let output = child
        .wait_with_output()
        .await
        .map_err(|error| format!("Python process failed: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "Python exited with {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    serde_json::from_slice(&output.stdout).map_err(|error| {
        format!(
            "Python did not return valid JSON ({error}). stderr: {}",
            String::from_utf8_lossy(&output.stderr)
        )
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![call_python])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
