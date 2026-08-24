<script lang="ts">
  import { splitEntryName } from '../otpauth';
  import {
    app,
    copyCode,
    deleteEntry,
    openEntryDialog,
  } from '../store.svelte';
  import { generateTOTP, getTimeRemaining } from '../totp';
  import type { TOTPEntry } from '../types';

  let { entry }: { entry: TOTPEntry } = $props();

  const period = $derived(entry.period ?? 30);
  const digits = $derived(entry.digits ?? 6);
  const parsed = $derived(splitEntryName(entry.name));

  let code = $state('------');
  let remaining = $state(0);
  let copied = $derived(app.copiedEntryId === entry.id);
  let lastBucket = -1;

  const formatCode = (value: string): string => {
    if (value.length === 6) {
      return `${value.slice(0, 3)} ${value.slice(3)}`;
    }
    if (value.length === 8) {
      return `${value.slice(0, 4)} ${value.slice(4)}`;
    }
    return value;
  };

  const tick = async (): Promise<void> => {
    const now = Date.now();
    const bucket = Math.floor(now / 1000 / period);
    remaining = getTimeRemaining(period);
    if (bucket !== lastBucket) {
      lastBucket = bucket;
      try {
        code = await generateTOTP(entry.secret, { period, digits });
      } catch (error) {
        console.error('TOTP generation failed:', error);
        code = '------';
      }
    }
  };

  $effect(() => {
    void tick();
    const interval = setInterval(() => void tick(), 500);
    return () => clearInterval(interval);
  });
</script>

<div
  class="otp-card"
  role="button"
  tabindex="0"
  onclick={() => void copyCode(entry, code)}
  onkeydown={(event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void copyCode(entry, code);
    }
  }}
>
  <div class="otp-card__header">
    <div class="avatar" aria-hidden="true">
      {#if entry.isCustomIcon && entry.icon.startsWith('data:image/')}
        <img class="avatar__image" src={entry.icon} alt="" />
      {:else if (entry.icon ?? '').trim().length > 0 && (entry.icon ?? '').trim().length <= 2}
        <span>{entry.icon.trim()}</span>
      {:else}
        <span class="avatar__fallback">
          {entry.name.trim().slice(0, 1).toUpperCase() || 'X'}
        </span>
      {/if}
    </div>
    <div class="otp-card__identity" title={entry.name}>
      <p class="eyebrow">{parsed.subtitle ?? 'Stored account'}</p>
      <h3>{parsed.title}</h3>
    </div>
    <span class="badge">{period}s</span>
  </div>

  <div>
    <p class="meta-row">
      <span>Current code</span>
      <span>{digits} digits · {period}s cycle</span>
    </p>
    <strong class="otp-card__code" aria-label={`Current code for ${entry.name}`}>
      {formatCode(code)}
    </strong>
  </div>

  <div class="otp-card__footer">
    <div class="meta-row">
      <span>Refresh in</span>
      <span class="mono">{remaining}s</span>
    </div>
    <md-linear-progress value={remaining / period} aria-label="Time until code refresh"></md-linear-progress>

    <div class="inline-actions inline-actions--end">
      <md-text-button
        onclick={(event: MouseEvent) => {
          event.stopPropagation();
          void copyCode(entry, code);
        }}
      >
        <md-icon slot="icon">{copied ? 'check' : 'content_copy'}</md-icon>
        {copied ? 'Copied' : 'Copy'}
      </md-text-button>
      <md-icon-button
        aria-label={`Edit ${entry.name}`}
        onclick={(event: MouseEvent) => {
          event.stopPropagation();
          openEntryDialog('edit', entry.id);
        }}
      >
        <md-icon>edit</md-icon>
      </md-icon-button>
      <md-icon-button
        aria-label={`Delete ${entry.name}`}
        onclick={(event: MouseEvent) => {
          event.stopPropagation();
          deleteEntry(entry.id);
        }}
      >
        <md-icon>delete</md-icon>
      </md-icon-button>
    </div>
  </div>
</div>
