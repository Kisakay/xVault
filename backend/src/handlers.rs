use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Request, State};
use axum::http::HeaderMap;
use axum::http::header::HeaderValue;
use axum::http::{Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use tower_http::services::{ServeDir, ServeFile};

use crate::config::ServerConfig;
use crate::db::{Database, PublicUser};
use crate::session::{self, LoginGuard, Session, SessionStore};

pub struct AppState {
    pub config: Arc<ServerConfig>,
    pub db: Arc<Database>,
    pub sessions: Arc<SessionStore>,
    pub login_guard: Arc<LoginGuard>,
    pub config_path: String,
    pub dist_dir: PathBuf,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn json_response(status: StatusCode, value: serde_json::Value) -> Response {
    (status, Json(value)).into_response()
}

fn error_response(status: StatusCode, message: &str, details: &serde_json::Value) -> Response {
    let mut payload = serde_json::json!({ "error": message });
    if let Some(object) = details.as_object() {
        for (key, value) in object {
            payload[key] = value.clone();
        }
    }
    json_response(status, payload)
}

fn parse_body(body: Bytes) -> Result<serde_json::Value, Response> {
    if body.is_empty() {
        return Err(error_response(
            StatusCode::BAD_REQUEST,
            "Invalid request body",
            &serde_json::Value::Null,
        ));
    }
    serde_json::from_slice(&body).map_err(|_| {
        error_response(
            StatusCode::BAD_REQUEST,
            "Invalid JSON payload",
            &serde_json::Value::Null,
        )
    })
}

fn parse_cookies(header: Option<&HeaderValue>) -> HashMap<String, String> {
    let mut cookies = HashMap::new();
    let Some(header) = header else {
        return cookies;
    };
    let Ok(value) = header.to_str() else {
        return cookies;
    };
    for part in value.split(';') {
        let mut parts = part.trim().splitn(2, '=');
        if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
            cookies.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    cookies
}

fn session_from_request(headers: &HeaderMap, store: &SessionStore) -> Option<Session> {
    let cookies = parse_cookies(headers.get("cookie"));
    let token = cookies.get(session::SESSION_COOKIE_NAME)?;
    store.get(token)
}

fn session_token_from_request(headers: &HeaderMap) -> Option<String> {
    let cookies = parse_cookies(headers.get("cookie"));
    cookies.get(session::SESSION_COOKIE_NAME).cloned()
}

fn build_session_cookie(token: &str, expires_at: i64) -> String {
    let max_age = ((expires_at - session::now_ms()) / 1000).max(0);
    let secure = "";
    format!(
        "{name}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age}{secure}",
        name = session::SESSION_COOKIE_NAME
    )
}

fn build_cleared_session_cookie() -> String {
    format!(
        "{name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
        name = session::SESSION_COOKIE_NAME
    )
}

fn set_cookie(response: &mut Response, cookie: String) {
    response
        .headers_mut()
        .insert("Set-Cookie", HeaderValue::from_str(&cookie).unwrap());
}

fn require_session(headers: &HeaderMap, state: &AppState) -> Result<Session, Response> {
    session_from_request(headers, &state.sessions).ok_or_else(|| {
        error_response(
            StatusCode::UNAUTHORIZED,
            "Authentication required",
            &serde_json::Value::Null,
        )
    })
}

fn user_json(user: &PublicUser) -> serde_json::Value {
    serde_json::json!({
        "id": user.id,
        "loginId": user.login_id,
        "name": user.name,
        "logo": user.logo,
    })
}

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------

async fn cors_layer(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    let origin = request
        .headers()
        .get("origin")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    let is_options = request.method() == Method::OPTIONS;

    let mut response = if is_options {
        StatusCode::NO_CONTENT.into_response()
    } else {
        next.run(request).await
    };

    let headers = response.headers_mut();
    let allowed_origin = origin.unwrap_or_else(|| state.config.server_url.clone());
    headers.insert(
        "Access-Control-Allow-Origin",
        HeaderValue::from_str(&allowed_origin).unwrap(),
    );
    headers.insert(
        "Access-Control-Allow-Credentials",
        HeaderValue::from_static("true"),
    );
    if is_options {
        headers.insert(
            "Access-Control-Allow-Headers",
            HeaderValue::from_static("Content-Type"),
        );
        headers.insert(
            "Access-Control-Allow-Methods",
            HeaderValue::from_static("GET,POST,PUT,OPTIONS"),
        );
    }
    headers.insert("Vary", HeaderValue::from_static("Origin"));

    response
}

// ---------------------------------------------------------------------------
// Auth handlers
// ---------------------------------------------------------------------------

async fn register(
    State(state): State<Arc<AppState>>,
    body: Bytes,
) -> Response {
    let payload = match parse_body(body) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let password = payload.get("password").and_then(|v| v.as_str());

    let Some(password) = password else {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Password is required",
            &serde_json::Value::Null,
        );
    };

    match state.db.create_user(password) {
        Ok((user_id, login_id)) => {
            let (token, expires_at) = state.sessions.create(user_id, &login_id);
            let mut response = json_response(
                StatusCode::OK,
                serde_json::json!({ "success": true, "loginId": login_id }),
            );
            set_cookie(&mut response, build_session_cookie(&token, expires_at));
            response
        }
        Err(message) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &message,
            &serde_json::Value::Null,
        ),
    }
}

async fn login(State(state): State<Arc<AppState>>, body: Bytes) -> Response {
    let payload = match parse_body(body) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let login_id = payload.get("loginId").and_then(|v| v.as_str());
    let password = payload.get("password").and_then(|v| v.as_str());

    let (Some(login_id), Some(password)) = (login_id, password) else {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Login ID and password are required",
            &serde_json::Value::Null,
        );
    };

    let failed = state.login_guard.touch(login_id);
    if failed.count >= session::MAX_ATTEMPTS {
        return error_response(
            StatusCode::TOO_MANY_REQUESTS,
            "Too many failed login attempts. Please try again later.",
            &serde_json::json!({
                "attemptsLeft": 0,
                "lockoutTime": session::DEFAULT_RESET_TIME_MS / 60000,
            }),
        );
    }

    match state.db.authenticate_user(login_id, password) {
        Ok(Some(user)) => {
            state.login_guard.reset(login_id);
            let (token, expires_at) = state.sessions.create(user.id, &user.login_id);
            let mut response = json_response(
                StatusCode::OK,
                serde_json::json!({ "success": true, "user": user_json(&user) }),
            );
            set_cookie(&mut response, build_session_cookie(&token, expires_at));
            response
        }
        Ok(None) => {
            let failed = state.login_guard.record_failure(login_id);
            error_response(
                StatusCode::UNAUTHORIZED,
                "Invalid login credentials",
                &serde_json::json!({
                    "attemptsLeft": session::MAX_ATTEMPTS.saturating_sub(failed.count),
                }),
            )
        }
        Err(message) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &message,
            &serde_json::Value::Null,
        ),
    }
}

async fn logout(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    if let Some(token) = session_token_from_request(&headers) {
        state.sessions.destroy(&token);
    }
    let mut response = json_response(StatusCode::OK, serde_json::json!({ "success": true }));
    set_cookie(&mut response, build_cleared_session_cookie());
    response
}

async fn status(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    match session_from_request(&headers, &state.sessions) {
        Some(session) => json_response(
            StatusCode::OK,
            serde_json::json!({
                "authenticated": true,
                "loginId": session.login_id,
            }),
        ),
        None => json_response(
            StatusCode::OK,
            serde_json::json!({ "authenticated": false }),
        ),
    }
}

// ---------------------------------------------------------------------------
// User handlers
// ---------------------------------------------------------------------------

async fn get_profile(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let session = match require_session(&headers, &state) {
        Ok(session) => session,
        Err(response) => return response,
    };

    match state.db.get_user_profile(session.user_id) {
        Ok(Some(user)) => json_response(
            StatusCode::OK,
            serde_json::json!({ "success": true, "user": user_json(&user) }),
        ),
        Ok(None) => error_response(
            StatusCode::NOT_FOUND,
            "User not found",
            &serde_json::Value::Null,
        ),
        Err(message) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &message,
            &serde_json::Value::Null,
        ),
    }
}

async fn put_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let session = match require_session(&headers, &state) {
        Ok(session) => session,
        Err(response) => return response,
    };
    let payload = match parse_body(body) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let name = payload.get("name").and_then(|v| v.as_str()).map(str::to_string);
    let logo = match payload.get("logo") {
        Some(serde_json::Value::Null) | None => None,
        Some(value) => Some(value.as_str().map(str::to_string)),
    };

    if name.is_none() && logo.is_none() {
        return json_response(StatusCode::OK, serde_json::json!({ "success": true }));
    }

    match state.db.update_user_profile(session.user_id, name, logo) {
        Ok(()) => json_response(StatusCode::OK, serde_json::json!({ "success": true })),
        Err(message) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &message,
            &serde_json::Value::Null,
        ),
    }
}

async fn change_password(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let session = match require_session(&headers, &state) {
        Ok(session) => session,
        Err(response) => return response,
    };
    let payload = match parse_body(body) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let current_password = payload.get("currentPassword").and_then(|v| v.as_str());
    let new_password = payload.get("newPassword").and_then(|v| v.as_str());

    let (Some(current_password), Some(new_password)) = (current_password, new_password) else {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Current and new passwords are required",
            &serde_json::Value::Null,
        );
    };

    match state
        .db
        .change_user_password(session.user_id, current_password, new_password)
    {
        Ok(()) => json_response(StatusCode::OK, serde_json::json!({ "success": true })),
        Err(message) => error_response(
            StatusCode::BAD_REQUEST,
            &message,
            &serde_json::Value::Null,
        ),
    }
}

async fn delete_account(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let session = match require_session(&headers, &state) {
        Ok(session) => session,
        Err(response) => return response,
    };
    let payload = match parse_body(body) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let password = payload.get("password").and_then(|v| v.as_str());
    let Some(password) = password else {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Password is required",
            &serde_json::Value::Null,
        );
    };

    match state.db.delete_user_account(session.user_id, password) {
        Ok(()) => {
            if let Some(token) = session_token_from_request(&headers) {
                state.sessions.destroy(&token);
            }
            let mut response = json_response(StatusCode::OK, serde_json::json!({ "success": true }));
            set_cookie(&mut response, build_cleared_session_cookie());
            response
        }
        Err(message) => error_response(
            StatusCode::BAD_REQUEST,
            &message,
            &serde_json::Value::Null,
        ),
    }
}

// ---------------------------------------------------------------------------
// Vault handlers
// ---------------------------------------------------------------------------

async fn vault_data(State(state): State<Arc<AppState>>, headers: HeaderMap, body: Bytes) -> Response {
    let session = match require_session(&headers, &state) {
        Ok(session) => session,
        Err(response) => return response,
    };
    let payload = match parse_body(body) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let password = payload.get("password").and_then(|v| v.as_str());

    let Some(password) = password else {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Password required",
            &serde_json::Value::Null,
        );
    };

    match state.db.get_vault_data(session.user_id, password) {
        Ok(data) => json_response(StatusCode::OK, data),
        Err(message) => error_response(
            StatusCode::UNAUTHORIZED,
            &message,
            &serde_json::Value::Null,
        ),
    }
}

async fn vault_save(State(state): State<Arc<AppState>>, headers: HeaderMap, body: Bytes) -> Response {
    let session = match require_session(&headers, &state) {
        Ok(session) => session,
        Err(response) => return response,
    };
    let payload = match parse_body(body) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let password = payload.get("password").and_then(|v| v.as_str());
    let data = payload.get("data");

    let (Some(password), Some(data)) = (password, data) else {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Password and data required",
            &serde_json::Value::Null,
        );
    };

    match state.db.save_vault_data(session.user_id, data, password) {
        Ok(()) => json_response(StatusCode::OK, serde_json::json!({ "success": true })),
        Err(message) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &message,
            &serde_json::Value::Null,
        ),
    }
}

async fn vault_export(State(state): State<Arc<AppState>>, headers: HeaderMap, body: Bytes) -> Response {
    let session = match require_session(&headers, &state) {
        Ok(session) => session,
        Err(response) => return response,
    };
    let payload = match parse_body(body) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let password = payload.get("password").and_then(|v| v.as_str());

    let Some(password) = password else {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Password required",
            &serde_json::Value::Null,
        );
    };

    match state.db.get_vault_data(session.user_id, password) {
        Ok(data) => {
            let timestamp = chrono_like_timestamp();
            json_response(
                StatusCode::OK,
                serde_json::json!({
                    "data": serde_json::to_string(&data).unwrap_or_else(|_| "{}".into()),
                    "timestamp": timestamp,
                    "format": "xVault-V2",
                }),
            )
        }
        Err(message) => error_response(
            StatusCode::UNAUTHORIZED,
            &message,
            &serde_json::Value::Null,
        ),
    }
}

async fn vault_import(State(state): State<Arc<AppState>>, headers: HeaderMap, body: Bytes) -> Response {
    let session = match require_session(&headers, &state) {
        Ok(session) => session,
        Err(response) => return response,
    };
    let payload = match parse_body(body) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let password = payload.get("password").and_then(|v| v.as_str());
    let import_data = payload.get("importData");

    let (Some(password), Some(import_data)) = (password, import_data) else {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Password and import data required",
            &serde_json::Value::Null,
        );
    };

    let format = import_data.get("format").and_then(|v| v.as_str());
    if format != Some("xVault-V2") {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Unsupported vault format. Only xVault-V2 format is supported.",
            &serde_json::Value::Null,
        );
    }

    let raw_data = import_data.get("data").and_then(|v| v.as_str());
    let Some(raw_data) = raw_data else {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Password and import data required",
            &serde_json::Value::Null,
        );
    };

    let vault_data: serde_json::Value = match serde_json::from_str(raw_data) {
        Ok(value) => value,
        Err(_) => {
            return error_response(
                StatusCode::UNAUTHORIZED,
                "Invalid password or corrupted import data",
                &serde_json::Value::Null,
            );
        }
    };

    match state.db.save_vault_data(session.user_id, &vault_data, password) {
        Ok(()) => json_response(StatusCode::OK, serde_json::json!({ "success": true })),
        Err(message) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &message,
            &serde_json::Value::Null,
        ),
    }
}

// ---------------------------------------------------------------------------
// Static / config handlers
// ---------------------------------------------------------------------------

async fn serve_config(State(state): State<Arc<AppState>>) -> Response {
    match tokio::fs::read(&state.config_path).await {
        Ok(contents) => (
            StatusCode::OK,
            [(
                axum::http::header::CONTENT_TYPE,
                HeaderValue::from_static("application/json"),
            )],
            contents,
        )
            .into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "Not found").into_response(),
    }
}

fn chrono_like_timestamp() -> String {
    // RFC 3339 UTC timestamp without pulling in chrono.
    let now = std::time::SystemTime::now();
    let since_epoch = now
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = since_epoch.as_secs();
    let millis = since_epoch.subsec_millis();
    let days = secs / 86400;
    let mut rem = secs % 86400;
    let hour = rem / 3600;
    rem %= 3600;
    let minute = rem / 60;
    let second = rem % 60;

    // Civil-from-days algorithm (Howard Hinnant).
    let z = days as i64 + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { year + 1 } else { year };

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        year, month, day, hour, minute, second, millis
    )
}

pub fn build_router(state: Arc<AppState>) -> Router {
    let index_path = state.dist_dir.join("index.html");
    let serve = ServeDir::new(&state.dist_dir)
        .not_found_service(ServeFile::new(index_path));

    Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/status", get(status))
        .route(
            "/api/user/profile",
            get(get_profile).put(put_profile),
        )
        .route("/api/user/change-password", post(change_password))
        .route("/api/user/delete-account", post(delete_account))
        .route("/api/vault/data", post(vault_data))
        .route("/api/vault/save", post(vault_save))
        .route("/api/vault/export", post(vault_export))
        .route("/api/vault/import", post(vault_import))
        .route("/config.json", get(serve_config))
        .route(
            "/api/{*rest}",
            get(api_not_found)
                .post(api_not_found)
                .put(api_not_found)
                .delete(api_not_found),
        )
        .fallback_service(serve)
        // Le format d'import/sauvegarde peut embarquer des icônes base64 :
        // autorise les gros corps sur l'API (64 Mo au lieu de 2 Mo par défaut).
        .layer(DefaultBodyLimit::max(64 * 1024 * 1024))
        .layer(middleware::from_fn_with_state(state.clone(), cors_layer))
        .with_state(state)
}

async fn api_not_found() -> Response {
    error_response(
        StatusCode::NOT_FOUND,
        "Not found",
        &serde_json::Value::Null,
    )
}
