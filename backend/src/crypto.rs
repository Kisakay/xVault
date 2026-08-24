use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use md5::Md5;
use rand::RngCore;
use sha2::{Digest, Sha256};

type Aes256CbcEnc = cbc::Encryptor<aes::Aes256>;
type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;

/// Must stay identical to the legacy backend salt so existing password hashes
/// remain valid.
const PASSWORD_SALT: &str = "Kiss2FA-static-salt-for-consistent-hashing";

/// Matches the legacy `CryptoJS.SHA256(password + salt)` hex digest.
pub fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(PASSWORD_SALT.as_bytes());
    hex::encode(hasher.finalize())
}

/// OpenSSL EVP_BytesToKey derivation used by `CryptoJS.AES.encrypt(value, passphrase)`:
/// MD5 hashing, 1 iteration, 32-byte key + 16-byte IV.
fn derive_key_and_iv(password: &[u8], salt: &[u8]) -> (Vec<u8>, Vec<u8>) {
    let mut digest: Vec<u8> = Vec::new();
    let mut previous: Vec<u8> = Vec::new();

    while digest.len() < 48 {
        let mut ctx = Md5::new();
        ctx.update(&previous);
        ctx.update(password);
        ctx.update(salt);
        previous = ctx.finalize().to_vec();
        digest.extend_from_slice(&previous);
    }

    (digest[..32].to_vec(), digest[32..48].to_vec())
}

/// Encrypts JSON data with AES-256-CBC in the CryptoJS/OpenSSL "Salted__" format.
pub fn encrypt_vault_data(data: &serde_json::Value, password: &str) -> Result<String, String> {
    let plaintext = serde_json::to_vec(data).map_err(|err| err.to_string())?;

    let mut salt = [0u8; 8];
    rand::rngs::OsRng.fill_bytes(&mut salt);

    let (key, iv) = derive_key_and_iv(password.as_bytes(), &salt);
    let cipher = Aes256CbcEnc::new_from_slices(&key, &iv).map_err(|err| err.to_string())?;
    let ciphertext = cipher.encrypt_padded_vec_mut::<Pkcs7>(&plaintext);

    let mut payload = Vec::with_capacity(16 + ciphertext.len());
    payload.extend_from_slice(b"Salted__");
    payload.extend_from_slice(&salt);
    payload.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(payload))
}

/// Decrypts a CryptoJS/OpenSSL "Salted__" AES-256-CBC payload into JSON data.
pub fn decrypt_vault_data(encrypted: &str, password: &str) -> Result<serde_json::Value, String> {
    let payload = BASE64
        .decode(encrypted.trim())
        .map_err(|_| "Failed to decrypt vault data".to_string())?;

    if payload.len() < 16 || &payload[..8] != b"Salted__" {
        return Err("Unsupported encrypted vault format".into());
    }

    let salt = &payload[8..16];
    let ciphertext = &payload[16..];

    let (key, iv) = derive_key_and_iv(password.as_bytes(), salt);
    let cipher = Aes256CbcDec::new_from_slices(&key, &iv).map_err(|err| err.to_string())?;
    let plaintext = cipher
        .decrypt_padded_vec_mut::<Pkcs7>(ciphertext)
        .map_err(|_| "Failed to decrypt vault data".to_string())?;

    let json = String::from_utf8(plaintext).map_err(|_| "Failed to decrypt vault data".to_string())?;
    serde_json::from_str(&json).map_err(|_| "Failed to decrypt vault data".to_string())
}

/// Generates a URL-safe random token (used for sessions).
pub fn random_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Generates an 8-character alphanumeric login ID.
pub fn generate_login_id() -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::rngs::OsRng;
    let mut result = String::with_capacity(8);
    for _ in 0..8 {
        let index = (rng.next_u32() as usize) % CHARSET.len();
        result.push(CHARSET[index] as char);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_password_is_stable() {
        // Reference digest computed with the same algorithm as the legacy
        // backend (SHA256 of password + static salt).
        assert_eq!(
            hash_password("test-password"),
            "ff62762b37b84c80647fda9247a155259894b0a66746ba158b2224daf731d45c"
        );
    }

    #[test]
    fn aes_roundtrip_matches_crypto_js_format() {
        let data = serde_json::json!({ "entries": [], "folders": [] });
        let encrypted = encrypt_vault_data(&data, "s3cret").unwrap();

        // The payload must be OpenSSL/CryptoJS compatible: base64 of
        // "Salted__" + 8-byte salt + AES-CBC ciphertext.
        let payload = BASE64.decode(&encrypted).unwrap();
        assert_eq!(&payload[..8], b"Salted__");
        // 16-byte header + 32 bytes of PKCS7-padded JSON (27 bytes + 5 padding).
        assert_eq!(payload.len(), 48);

        let decrypted = decrypt_vault_data(&encrypted, "s3cret").unwrap();
        assert_eq!(decrypted, data);

        // Wrong password must fail.
        assert!(decrypt_vault_data(&encrypted, "wrong").is_err());
    }

    #[test]
    fn decrypts_payload_produced_by_crypto_js() {
        // Ciphertext produced by the legacy backend:
        // CryptoJS.AES.encrypt(JSON.stringify(vault), 'pass123').toString()
        let from_crypto_js = "U2FsdGVkX1/0g4PUzF5/SyyrY4mWm3JhOmyeTwimoVeamIYNQ8iR5ACUbcMsDYaWGhczVSAs2JXCczF7pH8nmBADub7TIg0Rnmmo3UDY2GiNnyBjNR2CF/QcWJxktNA/Ezhbvr7sWAGGtM7R/sGysg==";
        let expected = serde_json::json!({
            "entries": [{
                "id": "legacy-1",
                "name": "GitHub: alice",
                "secret": "JBSWY3DPEHPK3PXP"
            }],
            "folders": []
        });

        let decrypted = decrypt_vault_data(from_crypto_js, "pass123").unwrap();
        assert_eq!(decrypted, expected);

        // Print a Rust-produced ciphertext so the reverse direction can be
        // verified against CryptoJS (see `cargo test -- --nocapture`).
        let ours = encrypt_vault_data(&expected, "pass123").unwrap();
        println!("RUST_CIPHER={}", ours);
    }
}
