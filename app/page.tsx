"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { StaffPayroll, DayRecord } from "@/types";
import { STORE_LEAD_RATE } from "@/lib/slots";
import { calculateSlotPay } from "@/lib/slots";

type Overrides = Record<string, { isStoreLead?: boolean; leave?: string; bonus?: number }>;

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function toThaiDate(iso: string): string {
  if (!iso) return "";
  const [yyyy, mm, dd] = iso.split("-").map(Number);
  return `${dd} ${THAI_MONTHS[mm - 1]} ${yyyy + 543}`;
}

function buildWeekLabel(start: string, end: string): string {
  if (!start && !end) return "";
  if (!end) return toThaiDate(start);
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  const thaiYear = Number(end.split("-")[0]) + 543;
  if (sm === em) return `${sd}–${ed} ${THAI_MONTHS[em - 1]} ${thaiYear}`;
  return `${sd} ${THAI_MONTHS[sm - 1]} – ${ed} ${THAI_MONTHS[em - 1]} ${thaiYear}`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [csvText, setCsvText] = useState("");
  const [overrides, setOverrides] = useState<Overrides>({});
  const [basePayroll, setBasePayroll] = useState<StaffPayroll[] | null>(null);
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [weekEnd, setWeekEnd] = useState<Date | null>(null);
  function toLocalISO(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const weekLabel = buildWeekLabel(
    weekStart ? toLocalISO(weekStart) : "",
    weekEnd ? toLocalISO(weekEnd) : ""
  );
  const [lineUsers, setLineUsers] = useState<Record<string, string>>({});
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sendResults, setSendResults] = useState<{ name: string; status: string }[] | null>(null);
  // sendHistory: weekLabel → { staffName → sentAt ISO string }
  const [sendHistory, setSendHistory] = useState<Record<string, Record<string, string>>>({});
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Apply overrides client-side so checkbox/select changes don't trigger API calls
  const payroll = useMemo<StaffPayroll[] | null>(() => {
    if (!basePayroll) return null;
    return basePayroll.map((staff) => {
      const days = staff.days.map((day) => {
        const key = `${staff.name}__${day.date}`;
        const ov = overrides[key] ?? {};

        if (day.missingClock) return day;
        if (ov.leave) return { ...day, isStoreLead: false, leave: ov.leave as DayRecord["leave"], bonusPct: undefined, slots: [], dailyTotal: 0, missingClock: undefined };
        if (ov.isStoreLead) {
          const multiplier = ov.bonus ? 1 + ov.bonus / 100 : 1;
          const dailyTotal = parseFloat((STORE_LEAD_RATE * multiplier).toFixed(2));
          return { ...day, isStoreLead: true, leave: undefined, bonusPct: ov.bonus, slots: [], dailyTotal, missingClock: undefined };
        }
        const baseSlots = calculateSlotPay(day.clockIn, day.clockOut);
        const multiplier = ov.bonus ? 1 + ov.bonus / 100 : 1;
        const slots = baseSlots.map((s) => ({ ...s, amount: parseFloat((s.amount * multiplier).toFixed(2)) }));
        const dailyTotal = parseFloat(slots.reduce((s, p) => s + p.amount, 0).toFixed(2));
        return { ...day, isStoreLead: false, leave: undefined, bonusPct: ov.bonus, slots, dailyTotal, missingClock: undefined };
      });
      const weeklyTotal = parseFloat(days.reduce((s, d) => s + d.dailyTotal, 0).toFixed(2));
      return { ...staff, days, weeklyTotal };
    });
  }, [basePayroll, overrides]);

  // Load persisted data on mount
  useEffect(() => {
    setNicknames(loadFromStorage("mm_nicknames", {}));
    setLineUsers(loadFromStorage("mm_lineUsers", {}));
    setSendHistory(loadFromStorage("mm_sendHistory", {}));
  }, []);

  function saveNickname(name: string, nick: string) {
    const key = name.trim();
    setNicknames((prev) => {
      const updated = { ...prev, [key]: nick };
      localStorage.setItem("mm_nicknames", JSON.stringify(updated));
      return updated;
    });
  }

  function saveLineUser(name: string, uid: string) {
    const key = name.trim();
    setLineUsers((prev) => {
      const updated = { ...prev, [key]: uid };
      localStorage.setItem("mm_lineUsers", JSON.stringify(updated));
      return updated;
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string);
    reader.readAsText(file, "UTF-8");
  }

  function setStoreLead(name: string, date: string, val: boolean) {
    const key = `${name}__${date}`;
    setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], isStoreLead: val, leave: undefined } }));
  }

  function setLeave(name: string, date: string, val: string) {
    const key = `${name}__${date}`;
    setOverrides((prev) => ({ ...prev, [key]: { leave: val || undefined, isStoreLead: false } }));
  }

  function applyManualClock(staffName: string, date: string, clockIn: string, clockOut: string) {
    setBasePayroll((prev) => {
      if (!prev) return prev;
      return prev.map((staff) => {
        if (staff.name !== staffName) return staff;
        const days = staff.days.map((day) => {
          if (day.date !== date) return day;
          const newIn = clockIn ? clockIn + ":00" : day.clockIn;
          const newOut = clockOut ? clockOut + ":00" : day.clockOut;
          const stillMissing = !newIn || !newOut
            ? (!newIn && !newOut ? "both" : !newIn ? "in" : "out") as DayRecord["missingClock"]
            : undefined;
          if (stillMissing) return { ...day, clockIn: newIn, clockOut: newOut, missingClock: stillMissing };
          const slots = calculateSlotPay(newIn, newOut);
          const dailyTotal = parseFloat(slots.reduce((s, p) => s + p.amount, 0).toFixed(2));
          return { ...day, clockIn: newIn, clockOut: newOut, missingClock: undefined, slots, dailyTotal };
        });
        const weeklyTotal = parseFloat(days.reduce((s, d) => s + d.dailyTotal, 0).toFixed(2));
        return { ...staff, days, weeklyTotal };
      });
    });
  }

  function setBonus(name: string, date: string, val: string) {
    const key = `${name}__${date}`;
    const num = val === "" ? undefined : Math.max(0, Number(val));
    setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], bonus: num } }));
  }

  async function calculate() {
    setError("");
    setSendResults(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, overrides: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBasePayroll(data.payroll);
      setOverrides({});
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const [sendingName, setSendingName] = useState<string | null>(null);

  async function sendLine(staffName?: string) {
    if (!payroll) return;
    const targetPayroll = staffName ? payroll.filter((s) => s.name === staffName) : payroll;
    setSendingName(staffName ?? "all");
    setSendResults(null);
    try {
      const res = await fetch("/api/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payroll: targetPayroll, lineUsers, nicknames, weekLabel }),
      });
      const data = await res.json();
      setSendResults(data.results);

      const now = new Date().toISOString();
      setSendHistory((prev) => {
        const weekEntry = { ...(prev[weekLabel] ?? {}) };
        for (const r of data.results) {
          if (r.status === "sent") weekEntry[r.name.trim()] = now;
        }
        const updated = { ...prev, [weekLabel]: weekEntry };
        localStorage.setItem("mm_sendHistory", JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setSendingName(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-[#4a7c59] text-white rounded-2xl p-6 shadow">
          <h1 className="text-2xl font-bold">Matcha Machi Payroll</h1>
          <p className="text-sm opacity-80 mt-1">ระบบคำนวณค่าจ้างรายสัปดาห์</p>
        </div>

        {/* Upload */}
        <section className="bg-white rounded-2xl p-6 shadow space-y-4">
          <h2 className="font-semibold text-lg text-[#4a7c59]">1. อัปโหลด CSV จาก POS</h2>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[#4a7c59] rounded-xl p-8 w-full text-center text-[#4a7c59] hover:bg-[#f0f7f0] transition"
          >
            {csvText ? "✓ ไฟล์โหลดแล้ว — คลิกเพื่อเปลี่ยน" : "คลิกเพื่อเลือกไฟล์ CSV"}
          </button>
          {csvText && (
            <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-32 text-gray-600">
              {csvText.split("\n").slice(0, 5).join("\n")}
            </pre>
          )}
        </section>

        {/* Week label */}
        <section className="bg-white rounded-2xl p-6 shadow space-y-3">
          <h2 className="font-semibold text-lg text-[#4a7c59]">2. ระบุสัปดาห์ <span className="text-red-500">*</span></h2>
          <DatePicker
            selectsRange
            startDate={weekStart ?? undefined}
            endDate={weekEnd ?? undefined}
            onChange={(range: [Date | null, Date | null]) => {
              setWeekStart(range[0]);
              setWeekEnd(range[1]);
            }}
            calendarStartDay={1}
            dateFormat="dd/MM/yyyy"
            placeholderText="เลือกวันแรก — วันสุดท้าย"
            wrapperClassName="w-full"
            className="border-2 border-[#4a7c59] rounded-lg p-2 w-full text-sm text-gray-900"
            isClearable
          />
          {weekLabel && (
            <p className="text-sm text-[#4a7c59] font-medium">สัปดาห์: {weekLabel}</p>
          )}
          {!weekLabel && (
            <p className="text-xs text-red-500">กรุณาเลือกช่วงสัปดาห์ก่อนคำนวณค่าจ้าง</p>
          )}
        </section>

        {/* Calculate */}
        <section className="bg-white rounded-2xl p-6 shadow">
          <button
            onClick={calculate}
            disabled={!csvText || !weekStart || !weekEnd || loading}
            className="w-full bg-[#4a7c59] text-white py-3 rounded-xl font-semibold disabled:opacity-40 hover:bg-[#3a6347] transition"
          >
            {loading ? "กำลังคำนวณ..." : "คำนวณค่าจ้าง"}
          </button>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </section>

        {/* Results */}
        {payroll && (
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-[#4a7c59]">3. ผลการคำนวณ</h2>
            {payroll.map((staff) => (
              <StaffCard
                key={staff.name}
                staff={staff}
                overrides={overrides}
                lineUserId={lineUsers[staff.name.trim()] ?? ""}
                nickname={nicknames[staff.name.trim()] ?? ""}
                sendHistory={sendHistory[weekLabel] ?? {}}
                staffNameKey={staff.name.trim()}
                isSending={sendingName === staff.name}
                onStoreLead={setStoreLead}
                onLeave={setLeave}
                onBonus={setBonus}
                onApplyManualClock={applyManualClock}
                onLineUserChange={(uid) => saveLineUser(staff.name, uid)}
                onNicknameChange={(nick) => saveNickname(staff.name, nick)}
                onSendLine={() => sendLine(staff.name)}
              />
            ))}
          </section>
        )}

        {/* Send all LINE */}
        {payroll && (
          <section className="bg-white rounded-2xl p-6 shadow space-y-4">
            <h2 className="font-semibold text-lg text-[#4a7c59]">4. ส่ง LINE ทุกคน</h2>
            <button
              onClick={() => sendLine()}
              disabled={sendingName !== null}
              className="w-full bg-[#06C755] text-white py-3 rounded-xl font-semibold disabled:opacity-40 hover:bg-[#05a847] transition"
            >
              {sendingName === "all" ? "กำลังส่ง..." : "ส่งสรุปค่าจ้างทุกคนพร้อมกัน"}
            </button>
            {sendResults && (
              <ul className="text-sm space-y-1">
                {sendResults.map((r) => (
                  <li key={r.name} className={r.status === "sent" ? "text-green-600" : "text-red-500"}>
                    {r.name}: {r.status}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {/* Send history */}
        {payroll && weekLabel && (
          <section className="bg-white rounded-2xl p-6 shadow space-y-4">
            <h2 className="font-semibold text-lg text-[#4a7c59]">5. สถานะการแจ้งค่าจ้าง — {weekLabel}</h2>
            <div className="space-y-2">
              {payroll.map((staff) => {
                const sentAt = sendHistory[weekLabel]?.[staff.name.trim()];
                return (
                  <div key={staff.name} className="flex items-center justify-between border rounded-xl px-4 py-3">
                    <span className="font-medium text-gray-800">{staff.name}</span>
                    {sentAt ? (
                      <span className="text-green-600 text-sm font-medium">
                        ✓ ส่งแล้ว — {new Date(sentAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    ) : (
                      <span className="text-amber-600 text-sm font-medium">ยังไม่ได้ส่ง</span>
                    )}
                  </div>
                );
              })}
            </div>
            {Object.keys(sendHistory).length > 1 && (
              <details className="text-sm text-gray-600">
                <summary className="cursor-pointer text-[#4a7c59] font-medium">ประวัติสัปดาห์ก่อนหน้า</summary>
                <div className="mt-2 space-y-3">
                  {Object.entries(sendHistory)
                    .filter(([week]) => week !== weekLabel)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([week, names]) => (
                      <div key={week}>
                        <p className="font-medium text-gray-700 mb-1">{week}</p>
                        {Object.entries(names).map(([name, sentAt]) => (
                          <div key={name} className="flex justify-between text-xs text-gray-600 pl-2">
                            <span>{name}</span>
                            <span className="text-green-600">✓ {new Date(sentAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </details>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function StaffCard({
  staff,
  overrides,
  lineUserId,
  nickname,
  sendHistory,
  staffNameKey,
  isSending,
  onStoreLead,
  onLeave,
  onBonus,
  onApplyManualClock,
  onLineUserChange,
  onNicknameChange,
  onSendLine,
}: {
  staff: StaffPayroll;
  overrides: Overrides;
  lineUserId: string;
  nickname: string;
  sendHistory: Record<string, string>;
  staffNameKey: string;
  isSending: boolean;
  onStoreLead: (name: string, date: string, val: boolean) => void;
  onLeave: (name: string, date: string, val: string) => void;
  onBonus: (name: string, date: string, val: string) => void;
  onApplyManualClock: (staffName: string, date: string, clockIn: string, clockOut: string) => void;
  onLineUserChange: (uid: string) => void;
  onNicknameChange: (nick: string) => void;
  onSendLine: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg text-gray-800">{staff.name}</h3>
        <span className="text-[#4a7c59] font-bold text-xl">฿{staff.weeklyTotal.toFixed(2)}</span>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="ชื่อเล่น (nickname)"
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value)}
          onBlur={(e) => onNicknameChange(e.target.value)}
          className="border rounded-lg p-2 w-1/3 text-sm text-gray-800"
        />
        <input
          type="text"
          placeholder="LINE User ID (Uxxxxxxxx...)"
          value={lineUserId}
          onChange={(e) => onLineUserChange(e.target.value)}
          onBlur={(e) => onLineUserChange(e.target.value)}
          className="border rounded-lg p-2 flex-1 text-sm font-mono text-gray-800"
        />
      </div>

      <div className="space-y-3">
        {staff.days.map((day) => (
          <DayRow
            key={day.date}
            day={day}
            staffName={staff.name}
            overrides={overrides}
            onStoreLead={onStoreLead}
            onLeave={onLeave}
            onBonus={onBonus}
            onApplyManualClock={onApplyManualClock}
          />
        ))}
      </div>

      {/* Per-staff LINE send button */}
      <div className="border-t pt-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {sendHistory[staffNameKey] ? (
            <span className="text-green-600 font-medium">
              ✓ ส่งแล้ว {new Date(sendHistory[staffNameKey]).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
            </span>
          ) : (
            <span className="text-amber-600">ยังไม่ได้ส่ง</span>
          )}
        </div>
        <button
          onClick={onSendLine}
          disabled={isSending || !lineUserId}
          className="bg-[#06C755] text-white text-sm px-4 py-2 rounded-xl font-semibold disabled:opacity-40 hover:bg-[#05a847] transition"
        >
          {isSending ? "กำลังส่ง..." : "ส่ง LINE"}
        </button>
      </div>
    </div>
  );
}

function DayRow({
  day,
  staffName,
  overrides,
  onStoreLead,
  onLeave,
  onBonus,
  onApplyManualClock,
}: {
  day: DayRecord;
  staffName: string;
  overrides: Overrides;
  onStoreLead: (name: string, date: string, val: boolean) => void;
  onLeave: (name: string, date: string, val: string) => void;
  onBonus: (name: string, date: string, val: string) => void;
  onApplyManualClock: (staffName: string, date: string, clockIn: string, clockOut: string) => void;
}) {
  const key = `${staffName}__${day.date}`;
  const ov = overrides[key] ?? {};

  const displayDate = (() => {
    const [yyyy, mm, dd] = day.date.split("-");
    return `${dd}/${mm}/${yyyy}`;
  })();

  const [isEditing, setIsEditing] = useState(false);

  const missingLabel = day.missingClock === "both"
    ? "ไม่มีเวลาเข้า-ออก"
    : day.missingClock === "in"
    ? "ไม่มีเวลาเข้างาน"
    : day.missingClock === "out"
    ? "ไม่มีเวลาออกงาน"
    : null;

  return (
    <div className={`border rounded-xl p-4 space-y-2 ${day.missingClock ? "bg-amber-50 border-amber-300" : "bg-gray-50"}`}>
      {missingLabel && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-amber-700 bg-amber-100 rounded-lg px-2 py-1 inline-block">
            ⚠ {missingLabel} — กรุณากรอกเวลาด้านล่าง
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            {(day.missingClock === "in" || day.missingClock === "both") && (
              <label className="flex flex-col gap-1 text-xs text-gray-900">
                เวลาเข้างาน (HH:MM)
                <input
                  type="text"
                  placeholder="เช่น 08:30"
                  maxLength={5}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^\d{2}:\d{2}$/.test(v)) onApplyManualClock(staffName, day.date, v, "");
                  }}
                  className="border-2 border-amber-400 rounded-lg p-1 text-sm text-gray-900 w-24 font-mono"
                />
              </label>
            )}
            {(day.missingClock === "out" || day.missingClock === "both") && (
              <label className="flex flex-col gap-1 text-xs text-gray-900">
                เวลาออกงาน (HH:MM)
                <input
                  type="text"
                  placeholder="เช่น 18:30"
                  maxLength={5}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^\d{2}:\d{2}$/.test(v)) onApplyManualClock(staffName, day.date, "", v);
                  }}
                  className="border-2 border-amber-400 rounded-lg p-1 text-sm text-gray-900 w-24 font-mono"
                />
              </label>
            )}
            <p className="text-xs text-amber-700">พิมพ์เวลาในรูปแบบ HH:MM แล้วระบบจะคำนวณอัตโนมัติ</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-sm w-28 text-gray-900">{displayDate}</span>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              defaultValue={day.clockIn ? day.clockIn.slice(0, 5) : ""}
              maxLength={5}
              placeholder="HH:MM"
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{2}:\d{2}$/.test(v)) onApplyManualClock(staffName, day.date, v, "");
              }}
              className="border rounded-lg p-1 text-xs text-gray-900 w-16 font-mono text-center"
            />
            <span className="text-xs text-gray-500">–</span>
            <input
              type="text"
              defaultValue={day.clockOut ? day.clockOut.slice(0, 5) : ""}
              maxLength={5}
              placeholder="HH:MM"
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{2}:\d{2}$/.test(v)) onApplyManualClock(staffName, day.date, "", v);
              }}
              className="border rounded-lg p-1 text-xs text-gray-900 w-16 font-mono text-center"
            />
            <button onClick={() => setIsEditing(false)} className="text-xs text-[#4a7c59] font-medium ml-1">✓</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-900">
              {day.clockIn ? day.clockIn.slice(0, 5) : "??:??"} – {day.clockOut ? day.clockOut.slice(0, 5) : "??:??"}
            </span>
            <button onClick={() => setIsEditing(true)} className="text-xs text-gray-400 hover:text-[#4a7c59]">✏️</button>
          </div>
        )}

        <label className="flex items-center gap-1 text-xs text-gray-900 cursor-pointer">
          <input
            type="checkbox"
            checked={ov.isStoreLead ?? false}
            onChange={(e) => onStoreLead(staffName, day.date, e.target.checked)}
            disabled={!!ov.leave}
            className="accent-[#4a7c59]"
          />
          Store Lead (฿500)
        </label>

        <select
          value={ov.leave ?? ""}
          onChange={(e) => onLeave(staffName, day.date, e.target.value)}
          className="text-xs border rounded-lg p-1 text-gray-900"
        >
          <option value="">มาทำงาน</option>
          <option value="sick">ลาป่วย</option>
          <option value="personal">ลากิจ</option>
        </select>

        {!day.leave && (
          <label className="flex items-center gap-1 text-xs text-gray-900">
            โบนัส
            <input
              type="number"
              min="0"
              max="500"
              placeholder="0"
              value={ov.bonus ?? ""}
              onChange={(e) => onBonus(staffName, day.date, e.target.value)}
              className="border rounded-lg p-1 w-14 text-xs text-gray-900"
            />
            %
          </label>
        )}

        <span className="ml-auto font-semibold text-sm text-gray-900">
          {day.leave ? (
            <span className="text-gray-900">{day.leave === "sick" ? "ลาป่วย" : "ลากิจ"}</span>
          ) : (
            `฿${day.dailyTotal.toFixed(2)}`
          )}
        </span>
      </div>

      {day.slots.length > 0 && (
        <div className="pl-4 space-y-0.5">
          {day.slots.map((s) => (
            <div key={s.slot} className="text-xs text-gray-900 flex gap-2">
              <span>{s.slot}</span>
              <span>({s.from.slice(0, 5)}–{s.to.slice(0, 5)})</span>
              <span>@{s.rate}</span>
              <span>=</span>
              <span>฿{s.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {day.isStoreLead && (
        <div className="pl-4 text-xs text-gray-900 font-medium">Store Lead — ฿500.00 (อัตราคงที่)</div>
      )}
      {day.bonusPct && day.bonusPct > 0 && (
        <div className="pl-4 text-xs text-orange-700 font-medium">+ โบนัสวันหยุด {day.bonusPct}%</div>
      )}
    </div>
  );
}
