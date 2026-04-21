import { StaffPayroll } from "@/types";

const LINE_API = "https://api.line.me/v2/bot/message/push";

export function buildPaySummary(payroll: StaffPayroll, weekLabel: string, nickname?: string): string {
  const nick = nickname?.trim() || payroll.name;
  const lines: string[] = [
    `สวัสดีครับน้อง${nick} พี่ขอแจ้งสรุปเวลาทำงาน Part time ของสัปดาห์ที่ผ่านมานะครับ`,
    ``,
    `สัปดาห์ ${weekLabel}`,
    ``,
  ];

  for (const day of payroll.days) {
    const d = formatDate(day.date);
    if (day.leave) {
      const label = day.leave === "sick" ? "ลาป่วย" : "ลากิจ";
      lines.push(`${d}  ${label}`);
    } else if (day.isStoreLead) {
      lines.push(`${d}  Store Lead  ฿500.00`);
    } else {
      lines.push(`${d}  ฿${day.dailyTotal.toFixed(2)}${day.bonusPct ? ` (+${day.bonusPct}% วันหยุด)` : ""}`);
      for (const s of day.slots) {
        lines.push(`  ${s.slot} (${s.from.slice(0, 5)}–${s.to.slice(0, 5)}) @${s.rate} = ฿${s.amount.toFixed(2)}`);
      }
    }
  }

  lines.push(``);
  lines.push(`รวม ฿${payroll.weeklyTotal.toFixed(2)}`);
  lines.push(``);
  lines.push(`ถ้ามีตรงไหนไม่ถูกแจ้งพี่ได้เลยน้า ขอบคุณน้อง${nick}ที่มาทำงานด้วยกันนะครับ ☺️`);
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
