import { Database } from "bun:sqlite";
import { join } from "node:path";
import CryptoJS from "crypto-js";

const DB_PATH = join(import.meta.dir, "..", "xVault.sqlite");
const DEFAULT_VAULT_NAME = "My Vault";
const LOGIN_ID_LENGTH = 8;
const MAX_LOGIN_ID_RETRIES = 10;
const LOGIN_ID_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const PASSWORD_SALT = "Kiss2FA-static-salt-for-consistent-hashing";

export interface VaultData {
  entries: unknown[];
  folders: unknown[];
}

interface UserRow {
  id: number;
  login_id: string;
  name: string;
  logo: string | null;
}

export interface PublicUser {
  id: number;
  loginId: string;
  name: string;
  logo: string | null;
}

export interface MutationResult {
  success: boolean;
  error?: string;
  message?: string;
  changes?: number;
}

export interface CreateUserResult extends MutationResult {
  userId?: number;
  loginId?: string;
}

export interface AuthResult extends MutationResult {
  user?: PublicUser;
}

export interface VaultResult extends MutationResult {
  data?: VaultData;
}

let dbInstance: Database | null = null;

const toPublicUser = (user: UserRow): PublicUser => ({
  id: user.id,
  loginId: user.login_id,
  name: user.name,
  logo: user.logo,
});

export const getDb = (): Database => {
  if (dbInstance) {
    return dbInstance;
  }

  const database = new Database(DB_PATH, { create: true });

  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '${DEFAULT_VAULT_NAME}',
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
  `);

  dbInstance = database;
  return database;
};

export const generateLoginId = (): string => {
  let result = "";

  for (let index = 0; index < LOGIN_ID_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * LOGIN_ID_CHARSET.length);
    result += LOGIN_ID_CHARSET[randomIndex];
  }

  return result;
};

export const hashPassword = (password: string): string =>
  CryptoJS.SHA256(password + PASSWORD_SALT).toString();

export const encryptVaultData = (data: VaultData, password: string): string => {
  const jsonValue = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonValue, password).toString();
};

export const decryptVaultData = (
  encryptedData: string,
  password: string,
): VaultData => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, password);
  const decryptedValue = bytes.toString(CryptoJS.enc.Utf8);

  if (!decryptedValue) {
    throw new Error("Failed to decrypt vault data");
  }

  return JSON.parse(decryptedValue) as VaultData;
};

export const getUserProfile = (userId: number): PublicUser | null => {
  const db = getDb();
  const user = db
    .query("SELECT id, login_id, name, logo FROM users WHERE id = ?")
    .get(userId) as UserRow | null;

  return user ? toPublicUser(user) : null;
};

export const createUser = (password: string): CreateUserResult => {
  const db = getDb();
  const passwordHash = hashPassword(password);
  const createVault = db.query(
    "INSERT INTO vaults (user_id, encrypted_data) VALUES (?, ?)",
  );

  for (let attempt = 0; attempt < MAX_LOGIN_ID_RETRIES; attempt += 1) {
    const loginId = generateLoginId();

    try {
      const userInsert = db
        .query("INSERT INTO users (login_id, password_hash) VALUES (?, ?)")
        .run(loginId, passwordHash);
      const userId = Number(userInsert.lastInsertRowid);

      const emptyVaultData = encryptVaultData(
        {
          entries: [],
          folders: [],
        },
        password,
      );

      createVault.run(userId, emptyVaultData);

      return {
        success: true,
        userId,
        loginId,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error);

      if (message.includes("unique")) {
        continue;
      }

      console.error("Error creating user:", error);
      return { success: false, error: "Failed to create user account" };
    }
  }

  return { success: false, error: "Failed to generate a unique login ID" };
};

export const authenticateUser = (
  loginId: string,
  password: string,
): AuthResult => {
  const db = getDb();
  const passwordHash = hashPassword(password);

  try {
    const user = db
      .query(
        "SELECT id, login_id, name, logo FROM users WHERE login_id = ? AND password_hash = ?",
      )
      .get(loginId, passwordHash) as UserRow | null;

    if (!user) {
      return { success: false, error: "Invalid login credentials" };
    }

    return {
      success: true,
      user: toPublicUser(user),
    };
  } catch (error) {
    console.error("Error authenticating user:", error);
    return { success: false, error: "Failed to authenticate user" };
  }
};

export const updateUserProfile = (
  userId: number,
  updates: { name?: string; logo?: string | null },
): MutationResult => {
  const db = getDb();
  const fields: string[] = [];
  const values: Array<string | null | number> = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }

  if (updates.logo !== undefined) {
    fields.push("logo = ?");
    values.push(updates.logo);
  }

  if (fields.length === 0) {
    return { success: true, message: "No updates provided" };
  }

  values.push(userId);

  try {
    const result = db
      .query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);

    return {
      success: true,
      changes: result.changes,
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { success: false, error: "Failed to update user profile" };
  }
};

export const changeUserPassword = (
  userId: number,
  currentPassword: string,
  newPassword: string,
): MutationResult => {
  const db = getDb();

  try {
    const user = db
      .query("SELECT id FROM users WHERE id = ? AND password_hash = ?")
      .get(userId, hashPassword(currentPassword)) as { id: number } | null;

    if (!user) {
      return { success: false, error: "Current password is incorrect" };
    }

    const vault = db
      .query("SELECT encrypted_data FROM vaults WHERE user_id = ?")
      .get(userId) as { encrypted_data: string } | null;

    if (!vault) {
      return { success: false, error: "Vault not found" };
    }

    let decryptedVault: VaultData;

    try {
      decryptedVault = decryptVaultData(vault.encrypted_data, currentPassword);
    } catch (error) {
      console.error("Error decrypting vault with current password:", error);
      return {
        success: false,
        error: "Failed to decrypt vault with current password",
      };
    }

    const updatedPasswordHash = hashPassword(newPassword);
    const updatedEncryptedVault = encryptVaultData(decryptedVault, newPassword);

    const transaction = db.transaction(() => {
      db.query("UPDATE users SET password_hash = ? WHERE id = ?").run(
        updatedPasswordHash,
        userId,
      );
      db.query("UPDATE vaults SET encrypted_data = ? WHERE user_id = ?").run(
        updatedEncryptedVault,
        userId,
      );
    });

    transaction();

    return { success: true };
  } catch (error) {
    console.error("Error changing password:", error);
    return { success: false, error: "Failed to change password" };
  }
};

export const getVaultData = (
  userId: number,
  password: string,
): VaultResult => {
  const db = getDb();

  try {
    const vault = db
      .query("SELECT encrypted_data FROM vaults WHERE user_id = ?")
      .get(userId) as { encrypted_data: string } | null;

    if (!vault) {
      return { success: false, error: "Vault not found" };
    }

    try {
      return {
        success: true,
        data: decryptVaultData(vault.encrypted_data, password),
      };
    } catch (error) {
      console.error("Error decrypting vault data:", error);
      return { success: false, error: "Invalid password or corrupted data" };
    }
  } catch (error) {
    console.error("Error getting vault data:", error);
    return { success: false, error: "Failed to retrieve vault data" };
  }
};

export const saveVaultData = (
  userId: number,
  vaultData: VaultData,
  password: string,
): MutationResult => {
  const db = getDb();

  try {
    const encryptedData = encryptVaultData(vaultData, password);
    const result = db
      .query("UPDATE vaults SET encrypted_data = ? WHERE user_id = ?")
      .run(encryptedData, userId);

    if (result.changes === 0) {
      db.query("INSERT INTO vaults (user_id, encrypted_data) VALUES (?, ?)").run(
        userId,
        encryptedData,
      );
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving vault data:", error);
    return { success: false, error: "Failed to save vault data" };
  }
};

export const deleteUserAccount = (
  userId: number,
  password: string,
): MutationResult => {
  const db = getDb();

  try {
    const user = db
      .query("SELECT id FROM users WHERE id = ? AND password_hash = ?")
      .get(userId, hashPassword(password)) as { id: number } | null;

    if (!user) {
      return { success: false, error: "Password is incorrect" };
    }

    const result = db.query("DELETE FROM users WHERE id = ?").run(userId);

    if (result.changes === 0) {
      return { success: false, error: "Failed to delete account" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting user account:", error);
    return { success: false, error: "Failed to delete user account" };
  }
};

