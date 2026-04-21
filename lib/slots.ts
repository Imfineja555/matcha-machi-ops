export const SLOTS = [
  { name: "ช่วงที่ 1", end: "12:30", rate: 40 },
  { name: "ช่วงที่ 2", start: "12:30", end: "15:30", rate: 50 },
  { name: "ช่วงที่ 3", start: "15:30", rate: 40 },
] as const;

export const STORE_LEAD_RATE = 500;

function toSeconds(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 3600 + m * 60;
}

function hhmmssToSeconds(hhmmss: string): number {
  const parts = hhmmss.split(":").map(Number);
  return parts[0] * 3600 + parts[1] * 60 + (parts[2] ?? 0);
}

function secondsToHHMM(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function calculateSlotPay(clockInStr: string, clockOutStr: string) {
  const ci = hhmmssToSeconds(clockInStr);
  const co = hhmmssToSeconds(clockOutStr);

  const boundaries = [
    { name: "ช่วงที่ 1", from: 0, to: toSeconds("12:30"), rate: 40 },
    { name: "ช่วงที่ 2", from: toSeconds("12:30"), to: toSeconds("15:30"), rate: 50 },
    { name: "ช่วงที่ 3", from: toSeconds("15:30"), to: 24 * 3600, rate: 40 },
  ];

  return boundaries
    .map((b) => {
      const start = Math.max(ci, b.from);
      const end = Math.min(co, b.to);
      const seconds = Math.max(0, end - start);
      const amount = parseFloat(((seconds / 3600) * b.rate).toFixed(2));
      return {
        slot: b.name,
        from: secondsToHHMM(start),
        to: secondsToHHMM(end),
        rate: b.rate,
        seconds,
        amount,
      };
    })
    .filter((s) => s.seconds > 0);
}
