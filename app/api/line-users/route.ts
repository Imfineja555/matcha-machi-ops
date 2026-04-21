import { NextRequest, NextResponse } from "next/server";

// In-memory store (resets on redeploy — good enough for setup)
const users: Record<string, string> = {};

export async function POST(req: NextRequest) {
  const body = await req.json();

  for (const event of body.events ?? []) {
    const userId = event.source?.userId;
    const displayName = event.message?.text ?? "unknown";
    if (userId) {
      users[userId] = displayName;
      console.log(`Captured: ${userId}`);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ users });
}
