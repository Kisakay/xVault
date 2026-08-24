use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};

use crate::crypto;

const SCHEMA: &str = r#"
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT 'My Vault',
      logo TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vaults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      encrypted_data TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TRIGGER IF NOT EXISTS update_user_timestamp
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_vault_timestamp
    AFTER UPDATE ON vaults
    BEGIN
      UPDATE vaults SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
"#;

#[derive(Debug, Clone, serde::Serialize)]
pub struct PublicUser {
    pub id: i64,
    pub login_id: String,
    pub name: String,
    pub logo: Option<String>,
}

struct UserRow {
    id: i64,
    login_id: String,
    name: String,
    logo: Option<String>,
}

fn to_public_user(row: UserRow) -> PublicUser {
    PublicUser {
        id: row.id,
        login_id: row.login_id,
        name: row.name,
        logo: row.logo,
    }
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(path)?;
        conn.execute_batch(SCHEMA)?;
        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn create_user(&self, password: &str) -> Result<(i64, String), String> {
        let password_hash = crypto::hash_password(password);
        let conn = self.conn.lock().unwrap();

        for _ in 0..10 {
            let login_id = crypto::generate_login_id();
            let empty_vault =
                crypto::encrypt_vault_data(&serde_json::json!({ "entries": [], "folders": [] }), password)
                    .map_err(|err| format!("Failed to encrypt vault data: {err}"))?;

            let result = conn
                .execute(
                    "INSERT INTO users (login_id, password_hash) VALUES (?1, ?2)",
                    params![login_id, password_hash],
                )
                .map_err(|err| {
                    if err.to_string().to_lowercase().contains("unique") {
                        return "unique".to_string();
                    }
                    "Failed to create user account".to_string()
                });

            match result {
                Ok(_) => {
                    let user_id = conn.last_insert_rowid();
                    conn.execute(
                        "INSERT INTO vaults (user_id, encrypted_data) VALUES (?1, ?2)",
                        params![user_id, empty_vault],
                    )
                    .map_err(|err| format!("Failed to create user vault: {err}"))?;
                    return Ok((user_id, login_id));
                }
                Err(message) if message == "unique" => continue,
                Err(message) => return Err(message),
            }
        }

        Err("Failed to generate a unique login ID".into())
    }

    pub fn authenticate_user(&self, login_id: &str, password: &str) -> Result<Option<PublicUser>, String> {
        let password_hash = crypto::hash_password(password);
        let conn = self.conn.lock().unwrap();

        let row: Option<UserRow> = conn
            .query_row(
                "SELECT id, login_id, name, logo FROM users WHERE login_id = ?1 AND password_hash = ?2",
                params![login_id, password_hash],
                |row| {
                    Ok(UserRow {
                        id: row.get(0)?,
                        login_id: row.get(1)?,
                        name: row.get(2)?,
                        logo: row.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(|err| format!("Failed to authenticate user: {err}"))?;

        Ok(row.map(to_public_user))
    }

    pub fn get_user_profile(&self, user_id: i64) -> Result<Option<PublicUser>, String> {
        let conn = self.conn.lock().unwrap();
        let row: Option<UserRow> = conn
            .query_row(
                "SELECT id, login_id, name, logo FROM users WHERE id = ?1",
                params![user_id],
                |row| {
                    Ok(UserRow {
                        id: row.get(0)?,
                        login_id: row.get(1)?,
                        name: row.get(2)?,
                        logo: row.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(|err| format!("Failed to fetch user profile: {err}"))?;

        Ok(row.map(to_public_user))
    }

    pub fn update_user_profile(
        &self,
        user_id: i64,
        name: Option<String>,
        logo: Option<Option<String>>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();

        if let Some(name) = name {
            conn.execute(
                "UPDATE users SET name = ?1 WHERE id = ?2",
                params![name, user_id],
            )
            .map_err(|err| format!("Failed to update user profile: {err}"))?;
        }
        if let Some(logo) = logo {
            conn.execute(
                "UPDATE users SET logo = ?1 WHERE id = ?2",
                params![logo, user_id],
            )
            .map_err(|err| format!("Failed to update user profile: {err}"))?;
        }

        Ok(())
    }

    pub fn change_user_password(
        &self,
        user_id: i64,
        current_password: &str,
        new_password: &str,
    ) -> Result<(), String> {
        let current_hash = crypto::hash_password(current_password);
        let mut conn = self.conn.lock().unwrap();

        let valid: Option<i64> = conn
            .query_row(
                "SELECT id FROM users WHERE id = ?1 AND password_hash = ?2",
                params![user_id, current_hash],
                |row| row.get(0),
            )
            .ok();

        if valid.is_none() {
            return Err("Current password is incorrect".into());
        }

        let encrypted: Option<String> = conn
            .query_row(
                "SELECT encrypted_data FROM vaults WHERE user_id = ?1",
                params![user_id],
                |row| row.get(0),
            )
            .map_err(|err| format!("Failed to read vault data: {err}"))?;

        let encrypted = encrypted.ok_or_else(|| "Vault not found".to_string())?;
        let vault_data = crypto::decrypt_vault_data(&encrypted, current_password)
            .map_err(|_| "Failed to decrypt vault with current password".to_string())?;

        let new_hash = crypto::hash_password(new_password);
        let re_encrypted = crypto::encrypt_vault_data(&vault_data, new_password)
            .map_err(|err| format!("Failed to re-encrypt vault data: {err}"))?;

        let transaction = conn
            .transaction()
            .map_err(|err| format!("Failed to start transaction: {err}"))?;

        transaction
            .execute(
                "UPDATE users SET password_hash = ?1 WHERE id = ?2",
                params![new_hash, user_id],
            )
            .map_err(|err| format!("Failed to update password hash: {err}"))?;
        transaction
            .execute(
                "UPDATE vaults SET encrypted_data = ?1 WHERE user_id = ?2",
                params![re_encrypted, user_id],
            )
            .map_err(|err| format!("Failed to re-encrypt vault: {err}"))?;

        transaction
            .commit()
            .map_err(|err| format!("Failed to commit transaction: {err}"))
    }

    pub fn get_vault_data(&self, user_id: i64, password: &str) -> Result<serde_json::Value, String> {
        let conn = self.conn.lock().unwrap();
        let encrypted: Option<String> = conn
            .query_row(
                "SELECT encrypted_data FROM vaults WHERE user_id = ?1",
                params![user_id],
                |row| row.get(0),
            )
            .map_err(|err| format!("Failed to retrieve vault data: {err}"))?;

        let encrypted = encrypted.ok_or_else(|| "Vault not found".to_string())?;
        crypto::decrypt_vault_data(&encrypted, password)
            .map_err(|_| "Invalid password or corrupted data".to_string())
    }

    pub fn save_vault_data(
        &self,
        user_id: i64,
        data: &serde_json::Value,
        password: &str,
    ) -> Result<(), String> {
        let encrypted = crypto::encrypt_vault_data(data, password)
            .map_err(|err| format!("Failed to save vault data: {err}"))?;
        let conn = self.conn.lock().unwrap();

        let changes = conn
            .execute(
                "UPDATE vaults SET encrypted_data = ?1 WHERE user_id = ?2",
                params![encrypted, user_id],
            )
            .map_err(|err| format!("Failed to save vault data: {err}"))?;

        if changes == 0 {
            conn.execute(
                "INSERT INTO vaults (user_id, encrypted_data) VALUES (?1, ?2)",
                params![user_id, encrypted],
            )
            .map_err(|err| format!("Failed to save vault data: {err}"))?;
        }

        Ok(())
    }

    pub fn delete_user_account(&self, user_id: i64, password: &str) -> Result<(), String> {
        let password_hash = crypto::hash_password(password);
        let conn = self.conn.lock().unwrap();

        let valid: Option<i64> = conn
            .query_row(
                "SELECT id FROM users WHERE id = ?1 AND password_hash = ?2",
                params![user_id, password_hash],
                |row| row.get(0),
            )
            .ok();

        if valid.is_none() {
            return Err("Password is incorrect".into());
        }

        let changes = conn
            .execute("DELETE FROM users WHERE id = ?1", params![user_id])
            .map_err(|err| format!("Failed to delete account: {err}"))?;

        if changes == 0 {
            return Err("Failed to delete account".into());
        }

        Ok(())
    }
}
