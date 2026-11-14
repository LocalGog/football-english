/**
 * Parent PIN. It keeps a curious child out of the parent zone on a shared phone; it is not
 * real security, since everything lives in this browser. Only a salted hash is stored.
 */
export const PIN_LENGTH = 4;
export const isValidPin = (pin: string): boolean => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

export function makeSalt(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const toHex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 where the browser offers it (always on HTTPS); FNV-1a only on insecure origins without crypto.subtle. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const text = `${salt}:${pin}`;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) return toHex(await subtle.digest('SHA-256', new TextEncoder().encode(text)));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export async function checkPin(pin: string, salt: string, hash: string): Promise<boolean> {
  return isValidPin(pin) && (await hashPin(pin, salt)) === hash;
}
