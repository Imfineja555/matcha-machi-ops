export type LeaveType = "sick" | "personal";

export type SlotPay = {
  slot: string;
  from: string;
  to: string;
  rate: number;
  seconds: number;
  amount: number;
};

export type DayRecord = {
  date: string; // "YYYY-MM-DD"
  clockIn: string; // "HH:mm:ss"
  clockOut: string; // "HH:mm:ss"
  missingClock?: "in" | "out" | "both";
  isStoreLead: boolean;
  leave?: LeaveType;
  slots: SlotPay[];
  dailyTotal: number;
};

export type StaffPayroll = {
  name: string;
  days: DayRecord[];
  weeklyTotal: number;
};

export type CsvRow = {
  date: string;
  name: string;
  clockIn: string; // empty string if missing
  clockOut: string; // empty string if missing
  branch: string;
};
