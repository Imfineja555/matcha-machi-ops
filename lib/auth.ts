import { createHmac, timingSafeEqual } from "crypto";

// Back-office sign-in: Google account, allow-listed e-mail, signed session cookie.
export const SESSION_COOKIE = "mm_session";
export const STATE_COOKIE = "mm_oauth_state";
const SESSION_DAYS = 7;

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "matchamachi.co@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string): boolean {
  return allowedEmails().includes(email.trim().toLowerCase());
}

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSession(email: string): { value: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const payload = Buffer.from(
    JSON.stringify({ email: email.toLowerCase(), exp: Math.floor(Date.now() / 1000) + maxAge })
  ).toString("base64url");
  return { value: `${payload}.${sign(payload)}`, maxAge };
}

/** The signed-in e-mail, or null. The allow-list is checked on every request, so removing an e-mail locks it out at once. */
export function readSession(value: string | undefined): string | null {
  if (!value || !process.env.SESSION_SECRET) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { email, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof email !== "string" || typeof exp !== "number" || exp < Date.now() / 1000) return null;
    return isAllowed(email) ? email : null;
  } catch {
    return null;
  }
}

/** Public address of the site, used for the Google redirect. APP_URL wins when set. */
export function siteOrigin(requestOrigin: string): string {
  return (process.env.APP_URL ?? requestOrigin).replace(/\/+$/, "");
}
