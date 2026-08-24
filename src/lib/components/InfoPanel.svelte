<script lang="ts">
  import { app } from '../store.svelte';
</script>

<section class="stats-grid">
  <article class="stat-card md-card">
    <md-icon class="stat-card__icon">key</md-icon>
    <span class="eyebrow">Accounts</span>
    <strong>{app.entries.length}</strong>
    <p class="supporting-text">Ready OTP entries.</p>
  </article>

  <article class="stat-card md-card">
    <md-icon class="stat-card__icon">folder</md-icon>
    <span class="eyebrow">Collections</span>
    <strong>{app.folders.length}</strong>
    <p class="supporting-text">Vault folders.</p>
  </article>

  <article class="stat-card md-card">
    <md-icon class="stat-card__icon">keyboard</md-icon>
    <span class="eyebrow">Shortcuts</span>
    <strong><span class="mono">S · N · L</span></strong>
    <p class="supporting-text">Search, create, lock.</p>
  </article>

  <article class="stat-card md-card">
    <md-icon class="stat-card__icon">shield</md-icon>
    <span class="eyebrow">Encryption</span>
    <strong>AES-256</strong>
    <p class="supporting-text">Vault payload encrypted server-side.</p>
  </article>
</section>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-card strong {
    font-size: 26px;
    font-weight: 500;
    margin: 2px 0;
  }

  .stat-card__icon {
    font-size: 26px;
    color: var(--md-sys-color-primary);
    margin-bottom: 6px;
  }
</style>
