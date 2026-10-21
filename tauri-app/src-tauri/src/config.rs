use std::{collections::HashMap, path::PathBuf};
pub struct Credentials {
    pub key: String,
    pub secret: String,
}
impl Credentials {
    pub fn ready(&self) -> bool {
        !self.key.is_empty() && !self.secret.is_empty()
    }
}
// Secrets stay in Rust; no environment mutation or frontend exposure.
pub fn load(prefix: &str) -> Credentials {
    let mut roots: Vec<PathBuf> = std::env::current_dir().ok().into_iter().collect();
    if let Ok(exe) = std::env::current_exe()
        && let Some(parent) = exe.parent()
    {
        roots.push(parent.into());
    }
    #[cfg(debug_assertions)]
    roots.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")));
    let mut values = HashMap::new();
    for root in roots {
        for dir in root.ancestors().take(5) {
            if let Ok(iter) = dotenvy::from_path_iter(dir.join(".env")) {
                for (k, v) in iter.flatten() {
                    values.entry(k).or_insert(v);
                }
            }
        }
    }
    let read = |suffix| {
        let name = format!("{prefix}_{suffix}");
        std::env::var(&name)
            .ok()
            .or_else(|| values.get(&name).cloned())
            .unwrap_or_default()
    };
    Credentials {
        key: read("KEY"),
        secret: read("SECRET"),
    }
}
