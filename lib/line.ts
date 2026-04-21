import { StaffPayroll } from "@/types";

const LINE_API = "https://api.line.me/v2/bot/message/push";

export function buildPaySummary(payroll: StaffPayroll, weekLabel: string): string {
  const lines: string[] = [
    `📋 สรุปค่าจ้างสัปดาห์ ${weekLabel}`,
    `👤 ${payroll.name}`,
    `${"─".repeat(28)}`,
  ];

  for (const day of payroll.days) {
    const d = formatDate(day.date);
    if (day.leave) {
      const label = day.leave === "sick" ? "ลาป่วย" : "ลากิจ";
      lines.push(`${d}  ${label}`);
    } else if (day.isStoreLead) {
      lines.push(`${d}  Store Lead  ฿500.00`);
    } else {
      lines.push(`${d}  ฿${day.dailyTotal.toFixed(2)}`);
      for (const s of day.slots) {
        lines.push(`  ${s.slot} (${s.from.slice(0, 5)}–${s.to.slice(0, 5)}) @${s.rate} = ฿${s.amount.toFixed(2)}`);
      }
    }
  }

  lines.push(`${"─".repeat(28)}`);
  lines.push(`💰 รวม ฿${payroll.weeklyTotal.toFixed(2)}`);
  return lines.join("\n");
}

export async function sendLineMessage(userId: string, text: string, token: string): Promise<void> {
  const res = await fetch(LINE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE API error ${res.status}: ${body}`);
  }
}

function formatDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}/${mm}/${yyyy}`;
}
