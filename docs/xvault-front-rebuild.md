# xVault Rebuild — Svelte + Material Design 3 + Rust

## 1. Quick audit

The previous front-end had the usual symptoms of a React app that grew without a
clear product shell:

- UI logic, data logic, auth logic, and presentation were mixed inside components.
- Too much state lived in React context, which made behavior implicit and harder to test.
- Tailwind-heavy markup obscured intent and made every component feel like a one-off.
- Core OTP actions were visually buried under decorative UI rather than optimized for speed.
- Accessibility and trust cues were inconsistent: noisy gradients, weak hierarchy,
  and unclear lock/save states.
- The architecture encouraged local patches, not long-term maintainability.

## 2. Chosen stack (v2)

### Frontend

- `Svelte 5` (runes) + `TypeScript` + `Vite`
- `@material/web` — Google's official Material Design 3 Web Components
- Custom MD3 theme tokens (dark-first, mint/cyan xVault palette, light theme included)
- `jsQR` for QR scanning, Web Crypto for TOTP (no crypto-js on the client)

### Backend

- `Rust` + `Axum` (tokio) + `rusqlite` (SQLite bundled — no system dependency)
- AES-256-CBC in the CryptoJS/OpenSSL `Salted__` format: fully compatible with
  vaults created by the legacy Bun/Express backend (verified by cross-tests
  against `crypto-js` in both directions)
- Same SQLite schema, same API routes and response shapes

### Why this is better

- The product scope is small and stateful, not component-complex: Svelte runes
  keep the mental model simple (one reactive store, no context chains).
- Material Web Components give a consistent, accessible, spec-compliant MD3 UI
  with zero UI-framework lock-in.
- Rust replaces the Node/Bun runtime: single static binary, tiny memory
  footprint, no runtime dependencies in production.
- Existing users keep their data: same database file, same password hashes,
  same encrypted payload format.

## 3. UX strategy

### Core flows

1. Sign in or create vault.
2. Unlock the encrypted vault with the password.
3. Search and copy OTP codes immediately.
4. Add a new OTP entry with either a Base32 secret, an `otpauth://` URI, or a QR scan.
5. Export or import encrypted backups.
6. Rotate password, rename vault, lock session, or delete account.

### Information architecture

- `Codes` — daily use (search, folder filter, OTP grid, copy on click)
- `Backup` — encrypted export/import
- `Security` — profile, password rotation, delete account
- `Info` — vault stats and shortcuts

## 4. Design system

- MD3 tokens (`--md-sys-color-*`) customized for the xVault brand:
  - Background: deep blue-black (`#0d1419`), surfaces in tonal containers
  - Primary: mint (`#7fd9b8` dark / `#006b4f` light)
  - Secondary: cold blue-slate, Tertiary: soft cyan, Error: muted red
- Typography: Roboto + Roboto Mono (codes)
- Components from `@material/web`: buttons, text fields, selects, dialogs,
  progress, FAB, tabs, bottom navigation; custom MD3-styled sidebar, cards,
  snackbar, and OTP countdown.

## 5. Frontend architecture

### Principles

- One reactive store (`src/lib/store.svelte.ts`) owns state and side effects.
- Components are presentational and read/write the store via runes.
- Derived data is computed from state, not duplicated.
- OTP generation is per-card, cached by time bucket, refreshed every 500 ms.
- Autosave is debounced (280 ms) with an explicit save status indicator.

### File structure

```text
src/
  App.svelte                 — screen router (booting/auth/locked/vault)
  main.ts                    — MD3 component registration + mount
  app.css                    — MD3 theme tokens (light/dark) + base styles
  lib/
    types.ts
    api.ts                   — typed REST client (credentials: include)
    otpauth.ts               — otpauth:// URI parsing
    totp.ts                  — RFC 6238 TOTP with Web Crypto
    store.svelte.ts          — app state + actions (auth, vault, save, panels)
    md3.d.ts                 — custom element types for svelte-check
    components/
      AuthScreen.svelte      — sign in / create vault
      LockedScreen.svelte    — unlock with password
      VaultScreen.svelte     — shell: sidebar, topbar, bottom nav, shortcuts
      CodesPanel.svelte      — search + folder filter + OTP grid
      EntryCard.svelte       — live TOTP, countdown, copy on click
      EntryDialog.svelte     — create/edit entry + QR scanner
      FolderDialog.svelte
      ConfirmDialog.svelte
      QrScanner.svelte       — getUserMedia + jsQR
      BackupPanel.svelte     — export/import
      SecurityPanel.svelte   — profile / password / delete account
      InfoPanel.svelte
      Snackbar.svelte        — custom MD3 snackbar
```

### Backend structure

```text
backend/
  Cargo.toml
  src/
    main.rs     — entry point, config, DB init, cleanup task
    config.rs   — config.json + env overrides, DB path, legacy migration
    crypto.rs   — EVP_BytesToKey (MD5) + AES-256-CBC + SHA-256 (CryptoJS-compatible)
    db.rs       — rusqlite schema + CRUD (legacy-compatible)
    session.rs  — in-memory sessions + failed-login guard
    handlers.rs — Axum routes, CORS, static SPA serving
```

## 6. Performance and security notes

- Single static Rust binary; SQLite bundled (no CGO/system dependency).
- No React runtime cost for this UI layer.
- OTP values are only copied on direct user action.
- Secrets are not rendered outside the add form.
- Export/import flows preserve the encrypted backup format (`xVault-V2`).
- Visual save status makes persistence state legible.
- Rate-limited login (5 attempts / 30 min lockout), HttpOnly session cookie.
