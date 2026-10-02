import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, STATE_COOKIE, createSession, isAllowed, siteOrigin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const fail = (error: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  };
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return fail("state");

  // The code is exchanged with Google directly over TLS, so the ID token in the reply comes from Google itself.
  const token = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${siteOrigin(origin)}/api/auth/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!token.ok) return fail("google");
  const { id_token } = (await token.json()) as { id_token?: string };
  if (!id_token) return fail("google");

  let claims: { email?: string; email_verified?: boolean; aud?: string };
  try {
    claims = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return fail("google");
  }
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID || !claims.email || !claims.email_verified) return fail("google");
  if (!isAllowed(claims.email)) return fail("denied");

  const session = createSession(claims.email);
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  res.cookies.delete(STATE_COOKIE);
  return res;
}
