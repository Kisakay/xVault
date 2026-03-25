const BASE32_SECRET = /^[A-Z2-7]+=*$/;

export interface ParsedOtpSource {
  accountName: string;
  issuer: string;
  secret: string;
  digits: number;
  period: number;
}

export const normalizeSecret = (secret: string): string =>
  secret.toUpperCase().replace(/\s+/g, '');

export const isValidBase32Secret = (secret: string): boolean =>
  BASE32_SECRET.test(normalizeSecret(secret));

export const parseOtpAuthUri = (input: string): ParsedOtpSource | null => {
  const trimmed = input.trim();

  if (!trimmed.startsWith('otpauth://')) {
    return null;
  }

  const url = new URL(trimmed);

  if (url.protocol !== 'otpauth:' || url.hostname.toLowerCase() !== 'totp') {
    throw new Error('Only otpauth://totp URIs are supported.');
  }

  const params = new URLSearchParams(url.search);
  const secret = normalizeSecret(params.get('secret') ?? '');

  if (!secret || !isValidBase32Secret(secret)) {
    throw new Error('The OTP URI does not contain a valid Base32 secret.');
  }

  const rawLabel = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const [labelIssuer, ...labelRest] = rawLabel.split(':');
  const labelAccount = labelRest.join(':').trim();
  const issuer = (params.get('issuer') ?? (labelAccount ? labelIssuer : '')).trim();
  const accountName = (labelAccount || labelIssuer).trim();
  const digits = Number(params.get('digits') ?? '6');
  const period = Number(params.get('period') ?? '30');

  return {
    accountName,
    issuer,
    secret,
    digits: Number.isFinite(digits) && digits > 0 ? digits : 6,
    period: Number.isFinite(period) && period > 0 ? period : 30,
  };
};

export const deriveEntryName = (accountName: string, issuer: string): string => {
  const cleanAccountName = accountName.trim();
  const cleanIssuer = issuer.trim();

  if (cleanIssuer && cleanAccountName) {
    return `${cleanIssuer}: ${cleanAccountName}`;
  }

  return cleanAccountName || cleanIssuer;
};

export const splitEntryName = (name: string): { title: string; subtitle: string | null } => {
  const [head, ...tail] = name.split(':');
  const subtitle = tail.join(':').trim();

  if (!subtitle) {
    return {
      title: name.trim(),
      subtitle: null,
    };
  }

  return {
    title: subtitle,
    subtitle: head.trim(),
  };
};
