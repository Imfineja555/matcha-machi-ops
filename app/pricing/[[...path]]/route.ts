import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

// The pricing tool runs as its own service (it keeps the price store on disk). This route is its only door:
// it checks the session, then forwards the request with the shared secret the service requires.
async function forward(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const email = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!email) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  const base = process.env.PRICING_URL;
  const secret = process.env.PRICING_SECRET;
  if (!base || !secret) return NextResponse.json({ error: "PRICING_URL / PRICING_SECRET is not set" }, { status: 503 });

  const { path = [] } = await ctx.params;
  const target = `${base.replace(/\/+$/, "")}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: {
        "x-machi-secret": secret,
        "x-machi-user": email,
        // which workspace of the pricing tool the browser has open ("" = the main data)
        "x-machi-ws": request.headers.get("x-machi-ws") ?? "",
        "Content-Type": "application/json",
      },
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "เชื่อมต่อเครื่องมือราคาไม่ได้ ลองใหม่อีกครั้ง" }, { status: 502 });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export { forward as GET, forward as POST };
