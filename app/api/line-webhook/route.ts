import { NextRequest, NextResponse } from "next/server";

type LineEvent = {
  type: string;
  replyToken?: string;
  source: {
    type: string;
    userId?: string;
  };
  message?: {
    type: string;
    text?: string;
  };
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  for (const event of (body.events ?? []) as LineEvent[]) {
    const userId = event.source?.userId;
    if (!userId || !event.replyToken) continue;

    // Reply to the user with their own LINE User ID
    if (token) {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `Your LINE User ID is:\n${userId}\n\nส่งข้อความนี้ให้เจ้าของร้านเพื่อตั้งค่าระบบค่าจ้าง`,
            },
          ],
        }),
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
