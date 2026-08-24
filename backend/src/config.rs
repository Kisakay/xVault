use std::env;
use std::path::{Path, PathBuf};

/// Mirrors the legacy `config.json` shape.
#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub server_host: String,
    pub server_port: u16,
    pub server_url: String,
}

pub fn default_config() -> ServerConfig {
    ServerConfig {
        server_host: "127.0.0.1".into(),
        server_port: 58951,
        server_url: "http://localhost:58951".into(),
    }
}

/// Loads `config.json` (falling back to defaults) with environment overrides.
pub fn load_config(path: &str) -> Result<ServerConfig, String> {
    let mut config = default_config();

    if let Ok(contents) = std::fs::read_to_string(path) {
        let parsed: serde_json::Value = serde_json::from_str(&contents)
            .map_err(|err| format!("parse config {}: {err}", path))?;
        if let Some(host) = parsed.get("SERVER_HOST").and_then(|v| v.as_str()) {
            if !host.is_empty() {
                config.server_host = host.to_string();
            }
        }
        if let Some(port) = parsed.get("SERVER_PORT").and_then(|v| v.as_u64()) {
            if port > 0 && port <= 65535 {
                config.server_port = port as u16;
            }
        }
        if let Some(url) = parsed.get("SERVER_URL").and_then(|v| v.as_str()) {
            if !url.is_empty() {
                config.server_url = url.to_string();
            }
        }
    }

    if let Ok(host) = env::var("SERVER_HOST") {
        if !host.is_empty() {
            config.server_host = host;
        }
    }
    if let Ok(port) = env::var("SERVER_PORT") {
        if let Ok(value) = port.parse::<u16>() {
            if value > 0 {
                config.server_port = value;
            }
        }
    }
    if let Ok(url) = env::var("SERVER_URL") {
        if !url.is_empty() {
            config.server_url = url;
        }
    }

    Ok(config)
}

/// SQLite database path: `XVAULT_DB_PATH` env var, else `./data/xVault.sqlite`.
pub fn resolve_db_path() -> PathBuf {
    if let Ok(path) = env::var("XVAULT_DB_PATH") {
        return PathBuf::from(path);
    }
    PathBuf::from("data").join("xVault.sqlite")
}

/// Static assets directory: `XVAULT_DIST_DIR` env var wins, then `./dist`
/// (working directory), then `../dist` (when the binary is run from
/// `backend/`).
pub fn resolve_dist_dir() -> PathBuf {
    if let Ok(path) = env::var("XVAULT_DIST_DIR") {
        return PathBuf::from(path);
    }
    for candidate in [PathBuf::from("dist"), PathBuf::from("../dist")] {
        if candidate.join("index.html").is_file() {
            return candidate;
        }
    }
    PathBuf::from("dist")
}

/// If the target database does not exist yet and a legacy `server/xVault.sqlite`
/// file is present, copy it so existing vaults survive the migration.
pub fn migrate_legacy_db(db_path: &Path) {
    if db_path.exists() {
        return;
    }
    let legacy = Path::new("server").join("xVault.sqlite");
    if !legacy.exists() {
        return;
    }
    if let Some(parent) = db_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    match std::fs::copy(&legacy, db_path) {
        Ok(_) => println!(
            "Migrated legacy database from {} to {}",
            legacy.display(),
            db_path.display()
        ),
        Err(err) => eprintln!("Failed to migrate legacy database: {err}"),
    }
}
