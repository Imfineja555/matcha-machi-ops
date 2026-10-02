import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { STATE_COOKIE, siteOrigin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !process.env.SESSION_SECRET) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }
  const state = randomBytes(24).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${siteOrigin(request.nextUrl.origin)}/api/auth/callback`,
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
