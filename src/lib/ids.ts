/** Globally unique, URL-safe identifiers: `<prefix>_<16 random chars>`. */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (const b of bytes) out += alphabet[b % 36];
  return `${prefix}_${out}`;
}

/** Random secret for invitation links and API keys (base64url, 32 bytes). */
export function newSecret(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace";
}
