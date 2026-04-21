import { CsvRow } from "@/types";

// Parses the Thai POS CSV export (tab-separated)
// Headers: วันที่ | ชื่อพนักงาน | เวลาเข้างาน | เวลาออกงาน | ชั่วโมงการทำงาน | สาขา
export function parsePOSCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  // Detect delimiter: tab or comma
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim());

  const colIndex = (candidates: string[]) => {
    for (const c of candidates) {
      const i = headers.findIndex((h) => h.includes(c));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iName = colIndex(["ชื่อพนักงาน", "name"]);
  const iClockIn = colIndex(["เวลาเข้างาน", "clock_in", "clockin"]);
  const iClockOut = colIndex(["เวลาออกงาน", "clock_out", "clockout"]);
  const iBranch = colIndex(["สาขา", "branch"]);

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(delimiter).map((c) => c.trim());

    const rawIn = cols[iClockIn] ?? "";
    const rawOut = cols[iClockOut] ?? "";

    const { date, time: clockIn } = parseDatetime(rawIn);
    const { date: dateOut, time: clockOut } = parseDatetime(rawOut);

    // Use whichever date is available
    const resolvedDate = date || dateOut;
    if (!resolvedDate) continue;

    rows.push({
      date: resolvedDate,
      name: cols[iName] ?? "",
      clockIn: clockIn ?? "",
      clockOut: clockOut ?? "",
      branch: iBranch !== -1 ? (cols[iBranch] ?? "") : "",
    });
  }

  return rows;
}

function parseDatetime(raw: string): { date: string; time: string } {
  // Expected: "30/03/2026 08:38:00"
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/);
  if (!match) return { date: "", time: "" };
  const [, dd, mm, yyyy, time] = match;
  return { date: `${yyyy}-${mm}-${dd}`, time };
}
