use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto;

pub const SESSION_COOKIE_NAME: &str = "xvault_session";
pub const SESSION_DURATION_MS: i64 = 24 * 60 * 60 * 1000;
pub const DEFAULT_RESET_TIME_MS: i64 = 30 * 60 * 1000;
pub const MAX_ATTEMPTS: u32 = 5;

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Debug, Clone)]
pub struct Session {
    pub user_id: i64,
    pub login_id: String,
    pub expires_at: i64,
}

#[derive(Default)]
pub struct SessionStore {
    inner: Mutex<HashMap<String, Session>>,
}

impl SessionStore {
    pub fn create(&self, user_id: i64, login_id: &str) -> (String, i64) {
        let token = crypto::random_token();
        let expires_at = now_ms() + SESSION_DURATION_MS;
        self.inner.lock().unwrap().insert(
            token.clone(),
            Session {
                user_id,
                login_id: login_id.to_string(),
                expires_at,
            },
        );
        (token, expires_at)
    }

    /// Returns the session if valid, sliding the expiration window forward.
    pub fn get(&self, token: &str) -> Option<Session> {
        let mut store = self.inner.lock().unwrap();
        let session = store.get(token)?;
        if session.expires_at <= now_ms() {
            store.remove(token);
            return None;
        }
        let mut renewed = session.clone();
        renewed.expires_at = now_ms() + SESSION_DURATION_MS;
        store.insert(token.to_string(), renewed.clone());
        Some(renewed)
    }

    pub fn destroy(&self, token: &str) {
        self.inner.lock().unwrap().remove(token);
    }

    pub fn cleanup(&self) {
        let now = now_ms();
        let mut store = self.inner.lock().unwrap();
        store.retain(|_, session| session.expires_at > now);
    }
}

#[derive(Debug, Clone)]
pub struct FailedLoginState {
    pub count: u32,
    pub last_attempt: i64,
}

#[derive(Default)]
pub struct LoginGuard {
    inner: Mutex<HashMap<String, FailedLoginState>>,
}

impl LoginGuard {
    /// Returns the (possibly new) state for this login ID, resetting the
    /// counter when the reset window has elapsed.
    pub fn touch(&self, login_id: &str) -> FailedLoginState {
        let mut store = self.inner.lock().unwrap();
        let now = now_ms();

        let state = store
            .entry(login_id.to_string())
            .or_insert(FailedLoginState {
                count: 0,
                last_attempt: now,
            });

        if now - state.last_attempt > DEFAULT_RESET_TIME_MS {
            state.count = 0;
        }
        state.last_attempt = now;

        state.clone()
    }

    pub fn record_failure(&self, login_id: &str) -> FailedLoginState {
        let mut store = self.inner.lock().unwrap();
        let now = now_ms();
        let state = store
            .entry(login_id.to_string())
            .or_insert(FailedLoginState {
                count: 0,
                last_attempt: now,
            });
        state.count += 1;
        state.last_attempt = now;
        state.clone()
    }

    pub fn reset(&self, login_id: &str) {
        self.inner.lock().unwrap().remove(login_id);
    }

    pub fn cleanup(&self) {
        let now = now_ms();
        let mut store = self.inner.lock().unwrap();
        store.retain(|_, state| now - state.last_attempt <= DEFAULT_RESET_TIME_MS);
    }
}
