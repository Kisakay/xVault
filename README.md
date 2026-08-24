# xVault

A lightweight and secure two-factor authentication (2FA) token manager.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<img src="image.png" alt="xVault overview" width="600">

## Overview

xVault is a self-hosted 2FA token manager that stores TOTP codes securely with AES encryption. It features a clean Material Design 3 interface and runs locally for maximum security.

## Features

- **🔐 Secure Storage** — AES-encrypted vault with password protection (CryptoJS-compatible format)
- **⚡ Auto-Generation** — Time-based codes refresh every 30 seconds
- **📱 QR Code Scanner** — Quickly add accounts by scanning QR codes
- **📦 Export/Import** — Encrypted backup and restore functionality
- **🎨 Modern UI** — Material Design 3 (Svelte 5 + Material Web Components), dark/light themes
- **🔒 Local First** — Self-hosted for complete data control
- **📁 Organization** — Organize entries with folders and custom icons

## Tech Stack

- **Frontend:** Svelte 5 + TypeScript + Vite + Material Web Components (MD3)
- **Backend:** Rust (Axum) + SQLite (rusqlite, bundled)
- **Encryption:** AES-256-CBC (OpenSSL/CryptoJS "Salted__" format)
- **Authentication:** Session-based with login ID system

## Prerequisites

- **Node.js** v20 or higher (frontend build)
- **Rust** toolchain (cargo) v1.75 or higher (backend)
- **npm** v9 or higher (or compatible package manager)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Kisakay/xVault.git
cd xVault
```

### 2. Install dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies (compiles the Rust binary)
npm run backend:build
```

### 3. Configure the application

Copy the example configuration file:

```bash
cp config.example.json config.json
```

Edit `config.json` with your settings:

```json
{
  "SERVER_HOST": "localhost",
  "SERVER_PORT": 58951,
  "SERVER_URL": "http://localhost:58951"
}
```

For production, update `SERVER_URL` to match your domain.

## Development

### Start both client and server

```bash
npm run dev:all
```

This starts:
- **Client** (Vite dev server) on `http://localhost:5173`
- **Server** (Rust API) on the port from `config.json`

### Start services individually

```bash
# Client only (development server)
npm run dev

# Server only (API server)
npm run server
```

### Build for production

```bash
npm run prod
```

This builds the Svelte frontend into `dist/` and compiles the Rust backend to `backend/target/release/xvault`. The backend serves the `dist/` assets itself.

## Usage

### First Time Setup

1. Launch the application and open the web interface
2. Create a new account with a strong password
3. Save your **Login ID** — you'll need it to log in
4. Add your first TOTP secret via QR code or manual entry

### Adding TOTP Entries

1. Click the **Add account** button
2. Scan a QR code or enter the secret key manually
3. Name the service and (optionally) add a custom icon
4. Organize entries into folders for better management
5. Save your entry

### Generating Codes

TOTP codes are automatically generated and refresh every 30 seconds. Click on any entry to copy the code to your clipboard.

### Backup & Restore

**Export:**
1. Navigate to **Backup**
2. Select **Export xVault backup**
3. Save the encrypted JSON file securely

**Import:**
1. Navigate to **Backup**
2. Select **Import encrypted backup**
3. Choose your exported file
4. The vault is decrypted and replaced with the backup content

## Production Deployment

### Option 1: PM2

```bash
# Build the application
npm run prod

# Start with PM2 using ecosystem config
pm2 start pm2.config.cjs

# Save PM2 process list
pm2 save
```

### Option 2: Docker

**Using Docker Compose (Recommended):**

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

**Using Docker directly:**

```bash
# Build the image
docker build -t xvault .

# Run the container
docker run -d \
  -p 58951:58951 \
  -v xvault_data:/app/data \
  --name xvault \
  --restart unless-stopped \
  xvault
```

The server will be available at `http://localhost:58951` (or your configured domain).

### Option 3: Systemd Service

Create `/etc/systemd/system/xvault.service`:

```ini
[Unit]
Description=xVault 2FA Manager
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/xVault
ExecStart=/path/to/xVault/backend/target/release/xvault
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable xvault
sudo systemctl start xvault
```

## Configuration

### Server Configuration

Edit `config.json` in the root directory:

```json
{
  "SERVER_HOST": "0.0.0.0",
  "SERVER_PORT": 58951,
  "SERVER_URL": "https://your-domain.com"
}
```

- **SERVER_HOST:** Host to bind to (`0.0.0.0` for all interfaces, `localhost` for local only)
- **SERVER_PORT:** Port the server listens on
- **SERVER_URL:** Public URL of your server (used for API calls)

### Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `SERVER_HOST` | Host to bind to | from `config.json` |
| `SERVER_PORT` | Port to listen on | from `config.json` |
| `SERVER_URL` | Public server URL | from `config.json` |
| `XVAULT_DB_PATH` | SQLite database path | `./data/xVault.sqlite` |
| `XVAULT_DIST_DIR` | Static assets directory | `./dist` |
| `XVAULT_CONFIG_PATH` | Config file path | `./config.json` |

## Upgrading from the legacy (Bun/Express) backend

The Rust backend keeps full compatibility with the legacy format:

- **Database:** the schema is identical. On first start, if `data/xVault.sqlite`
  does not exist but the legacy `server/xVault.sqlite` file does, it is copied
  automatically.
- **Encryption:** vaults are still encrypted with AES-256-CBC in the
  CryptoJS/OpenSSL `Salted__` format, and password hashes use the same
  SHA-256 derivation — existing passwords keep working.
- **API:** all routes and response shapes are unchanged.

## Backup and Restore

### Manual Backup

The critical file is `data/xVault.sqlite` which contains all encrypted data:

```bash
# Backup the database
cp data/xVault.sqlite /path/to/backup/xVault-$(date +%Y%m%d).sqlite

# Restore from backup
cp /path/to/backup/xVault-YYYYMMDD.sqlite data/xVault.sqlite
```

### Automated Backup Script

Create a backup script (`backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d-%H%M%S)
cp data/xVault.sqlite "$BACKUP_DIR/xVault-$DATE.sqlite"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "xVault-*.sqlite" -mtime +30 -delete
```

Add to crontab for daily backups:

```bash
0 2 * * * /path/to/backup.sh
```

## Security

### Best Practices

- **Use HTTPS** — Always use HTTPS in production (configure reverse proxy with Nginx + Let's Encrypt)
- **Strong Password** — Use a unique, complex password for your vault
- **Local Access** — Run locally or access via VPN; avoid exposing to the internet
- **Regular Backups** — Back up `data/xVault.sqlite` frequently
- **Keep Updated** — Regularly update dependencies and the application

### Nginx Reverse Proxy

Example Nginx configuration with HTTPS:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:58951;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## Troubleshooting

### Port Already in Use

If the configured port is already in use, either:
- Change the port in `config.json`
- Stop the process using the port: `lsof -ti:58951 | xargs kill`

### Database Issues

If you encounter database errors:
- Check file permissions on `data/xVault.sqlite`
- Ensure the `data/` directory is writable
- SQLite is bundled with the Rust binary — no system dependency required

### Build Issues

If the build fails:
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clean the Rust build cache: `cd backend && cargo clean`
- Check versions: `node --version` (v20+), `cargo --version` (1.75+)

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or contributions, please open an issue on [GitHub](https://github.com/Kisakay/xVault/issues).
