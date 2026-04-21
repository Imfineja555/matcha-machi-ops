import { NextRequest, NextResponse } from "next/server";
import { parsePOSCsv } from "@/lib/parseCsv";
import { buildPayroll } from "@/lib/payroll";

export async function POST(req: NextRequest) {
  try {
    const { csvText, overrides } = await req.json();
    if (!csvText) return NextResponse.json({ error: "csvText required" }, { status: 400 });

    const rows = parsePOSCsv(csvText);
    if (rows.length === 0) return NextResponse.json({ error: "No valid rows parsed" }, { status: 422 });

    const payroll = buildPayroll(rows, overrides ?? {});
    return NextResponse.json({ payroll });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
