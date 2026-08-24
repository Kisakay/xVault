# xVault

Self-hosted TOTP (2FA) token manager. Vault data is encrypted with AES-256-CBC and stored in SQLite.

## Stack

- **Frontend:** Svelte 5 + TypeScript + Vite + Material Web Components (MD3)
- **Backend:** Rust (Axum) + SQLite (rusqlite, bundled)
- **Encryption:** AES-256-CBC, CryptoJS/OpenSSL-compatible format

## Requirements

- Node.js 20+
- Rust (cargo)
- npm

## Install

```bash
git clone https://github.com/Kisakay/xVault.git
cd xVault

npm install
npm run backend:build
cp config.example.json config.json
```

## Run

```bash
npm run dev:all          # dev: Vite on :5173 + API on the port from config.json
npm run dev              # frontend only
npm run server           # backend only
npm run prod             # build frontend + release binary
npm run start            # run the release binary (serves ./dist itself)
```

## Config

`config.json` (gitignored):

```json
{
  "SERVER_HOST": "127.0.0.1",
  "SERVER_PORT": 58951,
  "SERVER_URL": "http://localhost:58951"
}
```

`SERVER_HOST` must be an IP (`127.0.0.1`), not `localhost` — `localhost` resolves
to `::1` (IPv6) and breaks IPv4 reverse proxies.

Environment variables (override config.json): `SERVER_HOST`, `SERVER_PORT`,
`SERVER_URL`, `XVAULT_DB_PATH` (default `./data/xVault.sqlite`),
`XVAULT_DIST_DIR` (default `./dist`, falls back to `../dist`),
`XVAULT_CONFIG_PATH` (default `./config.json`).

The binary can be run from the repo root or from `backend/` — the static assets
directory is resolved relative to the working directory.

## Usage

1. Create a vault with a password (8+ chars). Save the generated **Login ID** — it is required to sign in.
2. Unlock the vault with your password.
3. Add TOTP entries from a Base32 secret, an `otpauth://` URI, or a QR code scan.
4. Click an entry to copy its code. Codes refresh every 30 s.
5. **Backup** panel: export/import encrypted JSON backups (`xVault-V2` format).
6. **Security** panel: rename vault, rotate password, delete account.

## Deploy

### systemd

```bash
npm run prod
sudo cp deploy/xvault.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now xvault
journalctl -u xvault -f
```

Adjust `User`/`Group` and `WorkingDirectory` in `deploy/xvault.service`.

### Docker

```bash
docker compose up -d
```

Volume `xvault_data` is mounted at `/app/data` (SQLite database).

### Reverse proxy

If exposed to the internet, put HTTPS in front (Nginx/Caddy). Raise
`client_max_body_size` on the xVault vhost if you import large backups.

## Data & backup

- Database: `data/xVault.sqlite` (contains all encrypted data).
- Back it up regularly, or use **Backup → Export** for a portable encrypted file.
- Migration from the legacy Bun/Express backend: automatic. On first start,
  `server/xVault.sqlite` is copied to `data/xVault.sqlite` if present. Schema,
  password hashes, and encrypted payloads are compatible.

## Scripts

| Script | Action |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run server` | Run backend (debug build) |
| `npm run build` | Build frontend to `dist/` |
| `npm run check` | svelte-check (types) |
| `npm run backend:build` | Build release binary |
| `npm run backend:test` | Rust tests (crypto compatibility) |

## License

MIT
