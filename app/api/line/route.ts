import { NextRequest, NextResponse } from "next/server";
import { sendLineMessage, buildPaySummary } from "@/lib/line";
import { StaffPayroll } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { payroll, lineUsers, weekLabel } = await req.json() as {
      payroll: StaffPayroll[];
      lineUsers: Record<string, string>; // name → LINE userId
      weekLabel: string;
    };

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set in .env.local");

    const results: { name: string; status: string }[] = [];

    for (const staff of payroll) {
      const userId = lineUsers[staff.name];
      if (!userId) {
        results.push({ name: staff.name, status: "skipped: no LINE user ID" });
        continue;
      }
      try {
        const text = buildPaySummary(staff, weekLabel);
        await sendLineMessage(userId, text, token);
        results.push({ name: staff.name, status: "sent" });
      } catch (e) {
        results.push({ name: staff.name, status: `error: ${e}` });
      }
    }

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
