<script lang="ts">
  import { app } from '../store.svelte';
</script>

{#if app.toast}
  <div class="snackbar" role="status" aria-live="polite">
    <span class="snackbar__text">{app.toast.message}</span>
  </div>
{/if}

<style>
  .snackbar {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: min(480px, calc(100vw - 32px));
    padding: 14px 16px;
    border-radius: 4px;
    background: var(--md-sys-color-inverse-surface);
    color: var(--md-sys-color-inverse-on-surface);
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.3),
      0 2px 6px rgb(0 0 0 / 0.25),
      0 8px 24px rgb(0 0 0 / 0.2);
    animation: snackbar-in 180ms ease-out;
  }

  .snackbar__text {
    font-size: 14px;
    line-height: 1.4;
  }

  @keyframes snackbar-in {
    from {
      opacity: 0;
      transform: translate(-50%, 12px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  @media (max-width: 899px) {
    .snackbar {
      bottom: 92px;
    }
  }
</style>
