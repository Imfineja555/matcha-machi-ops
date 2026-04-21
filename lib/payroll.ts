import { CsvRow, DayRecord, StaffPayroll } from "@/types";
import { calculateSlotPay, STORE_LEAD_RATE } from "./slots";

export function buildPayroll(
  rows: CsvRow[],
  overrides: Record<string, { isStoreLead?: boolean; leave?: string }>
): StaffPayroll[] {
  const byStaff: Record<string, CsvRow[]> = {};
  for (const row of rows) {
    if (!byStaff[row.name]) byStaff[row.name] = [];
    byStaff[row.name].push(row);
  }

  return Object.entries(byStaff).map(([name, staffRows]) => {
    const days: DayRecord[] = staffRows.map((row) => {
      const key = `${name}__${row.date}`;
      const override = overrides[key] ?? {};
      const isStoreLead = override.isStoreLead ?? false;
      const leave = override.leave as DayRecord["leave"] | undefined;

      if (leave) {
        return { date: row.date, clockIn: row.clockIn, clockOut: row.clockOut, isStoreLead: false, leave, slots: [], dailyTotal: 0 };
      }

      if (isStoreLead) {
        return { date: row.date, clockIn: row.clockIn, clockOut: row.clockOut, isStoreLead: true, slots: [], dailyTotal: STORE_LEAD_RATE };
      }

      const slots = calculateSlotPay(row.clockIn, row.clockOut);
      const dailyTotal = parseFloat(slots.reduce((s, p) => s + p.amount, 0).toFixed(2));
      return { date: row.date, clockIn: row.clockIn, clockOut: row.clockOut, isStoreLead: false, slots, dailyTotal };
    });

    const weeklyTotal = parseFloat(days.reduce((s, d) => s + d.dailyTotal, 0).toFixed(2));
    return { name, days, weeklyTotal };
  });
}
