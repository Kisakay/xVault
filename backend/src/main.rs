mod config;
mod crypto;
mod db;
mod handlers;
mod session;

use std::sync::Arc;

use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    let config_path = std::env::var("XVAULT_CONFIG_PATH").unwrap_or_else(|_| "./config.json".into());
    let config = match config::load_config(&config_path) {
        Ok(config) => config,
        Err(err) => {
            eprintln!("warning: {err}; falling back to defaults");
            config::default_config()
        }
    };

    let db_path = config::resolve_db_path();
    config::migrate_legacy_db(&db_path);

    let database = match db::Database::open(&db_path) {
        Ok(database) => database,
        Err(err) => {
            eprintln!("Failed to open database at {}: {err}", db_path.display());
            std::process::exit(1);
        }
    };
    println!("Database initialized at {}", db_path.display());

    let state = Arc::new(handlers::AppState {
        config: Arc::new(config.clone()),
        db: Arc::new(database),
        sessions: Arc::new(session::SessionStore::default()),
        login_guard: Arc::new(session::LoginGuard::default()),
        config_path,
        dist_dir: std::env::var("XVAULT_DIST_DIR")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| std::path::PathBuf::from("./dist")),
    });

    // Periodic cleanup of expired sessions and failed-login entries.
    {
        let sessions = state.sessions.clone();
        let login_guard = state.login_guard.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(15 * 60));
            loop {
                interval.tick().await;
                sessions.cleanup();
                login_guard.cleanup();
            }
        });
    }

    let app = handlers::build_router(state);
    let address = format!("{}:{}", config.server_host, config.server_port);

    println!("xVault backend listening on http://{address}");
    println!("Serving static assets from ./dist");

    let listener = match TcpListener::bind(&address).await {
        Ok(listener) => listener,
        Err(err) => {
            eprintln!("Failed to bind {address}: {err}");
            std::process::exit(1);
        }
    };

    if let Err(err) = axum::serve(listener, app).await {
        eprintln!("Server error: {err}");
        std::process::exit(1);
    }
}
