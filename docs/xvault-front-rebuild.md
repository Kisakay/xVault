# xVault Front-End Rebuild

## 1. Quick audit

The previous front-end had the usual symptoms of a React app that grew without a clear product shell:

- UI logic, data logic, auth logic, and presentation were mixed inside components.
- Too much state lived in React context, which made behavior implicit and harder to test.
- Tailwind-heavy markup obscured intent and made every component feel like a one-off.
- Core OTP actions were visually buried under decorative UI rather than optimized for speed.
- Accessibility and trust cues were inconsistent: noisy gradients, weak hierarchy, and unclear lock/save states.
- The architecture encouraged local patches, not long-term maintainability.

## 2. Recommended stack

### Chosen stack

- `Vite`
- `TypeScript`
- Native DOM rendering with a small state controller
- Custom CSS design system
- Existing xVault API/backend unchanged

### Why this is better than keeping React here

- The product scope is small and stateful, not component-complex.
- OTP vault UX benefits more from directness and clarity than from a framework-heavy abstraction layer.
- Native TypeScript keeps the mental model simple: one controller, one render model, one source of truth.
- Fewer dependencies reduce bundle weight, attack surface, and maintenance cost.
- The code becomes easier to onboard into because behavior is explicit, not hidden behind hooks/context chains.

### Alternatives considered

- `Vue` or `Svelte` would also be valid choices for a greenfield rebuild.
- For this repo specifically, native TypeScript was the strongest fit because it avoids new framework debt while still delivering a fully fresh front-end.

## 3. UX strategy

### Core flows

1. Sign in or create vault.
2. Unlock the encrypted vault with the password.
3. Search and copy OTP codes immediately.
4. Add a new OTP entry with either a Base32 secret or an `otpauth://` URI.
5. Export or import encrypted backups.
6. Rotate password, rename vault, lock session, or delete account.

### Information architecture

- `Codes`
- `Backup`
- `Security`

This keeps the interface product-shaped:

- Daily use lives in `Codes`.
- Resilience and continuity live in `Backup`.
- Sensitive account controls live in `Security`.

## 4. Design system

### Visual direction

- Dark-first
- High-contrast typography
- Cyan / mint accent palette for trust and freshness
- Subtle atmospheric background, not generic flat dark mode
- Rounded but restrained surfaces to feel secure, not playful

### Tokens

- Background: deep blue-black
- Surface: glassy slate panels
- Accent: mint
- Secondary accent: cold blue
- Danger: muted red
- Typeface: `IBM Plex Sans` + `IBM Plex Mono`

### Component set

- Primary / secondary / ghost / danger buttons
- Cards
- Status badges
- Search field
- OTP card
- Modal form
- Notice banners
- Toasts

## 5. Front-end architecture

### Principles

- One app controller owns state and side effects.
- Pure template rendering lives outside the controller.
- Derived data is computed from state, not duplicated.
- OTP updates are incremental and cached by refresh bucket.
- Autosave is debounced and explicit.

### File structure

```text
src/
  app.ts
  app-state.ts
  main.ts
  otpauth.ts
  templates.ts
  index.css
  types/
  utils/
```

### State management

- Single in-memory state object
- Explicit pending flags per flow
- Debounced encrypted save
- OTP cache keyed by entry ID and time bucket

## 6. Performance and security notes

- No React runtime cost for this UI layer
- No client-side rendering abstraction overhead
- OTP values are only copied on direct user action
- Secrets are not rendered outside the add form
- Export/import flows preserve encrypted backup format
- Visual save status makes persistence state legible

## 7. Developer experience

- Small number of files
- Clear module boundaries
- CSS is tokenized instead of utility-spammed
- Product logic is readable without tracing hooks across the tree
- Easy to extend with focused panels or additional native dialogs later
