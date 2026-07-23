// Stateless auth — HMAC-signed tokens for magic links and sessions.
//
// No database: a token is `base64url(payload).base64url(hmac)`. We verify the
// signature and expiry on every request; nothing is stored server-side. Uses
// the Web Crypto API (available globally in Cloudflare Workers).

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE = "ms_admin_session";
export const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 minutes
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface TokenPayload {
  /** Subject — the (lowercased) email address. */
  email: string;
  /** Unix seconds when the token expires. */
  exp: number;
  /** What the token is for — a login link vs an active session. */
  purpose: "login" | "session";
  /** Unique id — set on login tokens so they can be consumed (single-use). */
  jti?: string;
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// TS 5.7 types TextEncoder output / typed arrays as Uint8Array<ArrayBufferLike>,
// but Web Crypto wants a BufferSource backed by a plain ArrayBuffer. Ours always
// are; this copies into a guaranteed ArrayBuffer to satisfy the types.
function buf(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    buf(encoder.encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Sign a payload into a compact `body.signature` token. */
export async function signToken(
  secret: string,
  payload: TokenPayload
): Promise<string> {
  const key = await importKey(secret);
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, buf(encoder.encode(body)));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/**
 * Verify a token's signature and expiry. Returns the payload, or null if the
 * token is malformed, tampered with, expired, or the wrong purpose.
 */
export async function verifyToken(
  secret: string,
  token: string | undefined | null,
  expectedPurpose: TokenPayload["purpose"]
): Promise<TokenPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const key = await importKey(secret);
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      buf(b64urlDecode(sig)),
      buf(encoder.encode(body))
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(decoder.decode(b64urlDecode(body)));
  } catch {
    return null;
  }

  if (payload.purpose !== expectedPurpose) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return null;
  }
  return payload;
}

/** Build a signed session cookie header value. */
export function buildSessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join("; ");
}

/** Cookie header value that clears the session. */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Read the raw session token from a Cookie header. */
export function readSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
