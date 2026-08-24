// Génération TOTP (RFC 6238) avec Web Crypto (HMAC-SHA1).

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32ToBytes = (secret: string): Uint8Array<ArrayBuffer> => {
  const clean = normalizeForDecode(secret);
  const bits: number[] = [];

  for (const char of clean) {
    const index = BASE32_CHARS.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 character in key');
    }
    for (let shift = 4; shift >= 0; shift -= 1) {
      bits.push((index >> shift) & 1);
    }
  }

  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i += 1) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | bits[i * 8 + j];
    }
    bytes[i] = value;
  }

  return bytes;
};

const normalizeForDecode = (secret: string): string =>
  secret.toUpperCase().replace(/\s+/g, '').replace(/=+$/, '');

const counterToBytes = (counter: bigint): Uint8Array<ArrayBuffer> => {
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(8);
  let value = counter;
  for (let i = 7; i >= 0; i -= 1) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
};
export interface GenerateTOTPOptions {
  period?: number;
  digits?: number;
  timestamp?: number;
}

export const generateTOTP = async (
  secret: string,
  options: GenerateTOTPOptions = {},
): Promise<string> => {
  const period = options.period ?? 30;
  const digits = options.digits ?? 6;
  const timestamp = options.timestamp ?? Date.now();

  const counter = BigInt(Math.floor(timestamp / 1000 / period));
  const counterBytes: Uint8Array<ArrayBuffer> = counterToBytes(counter);
  const keyBytes: Uint8Array<ArrayBuffer> = base32ToBytes(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', cryptoKey, counterBytes as BufferSource),
  );

  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  const code = (binary % 10 ** digits).toString().padStart(digits, '0');
  return code;
};

export const getTimeRemaining = (period: number = 30): number => {
  const epoch = Math.floor(Date.now() / 1000);
  return period - (epoch % period);
};
