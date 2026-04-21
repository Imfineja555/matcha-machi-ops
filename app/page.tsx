"use client";

import { useState, useRef, useEffect } from "react";
import { StaffPayroll, DayRecord } from "@/types";

type Overrides = Record<string, { isStoreLead?: boolean; leave?: string }>;

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
  const [payroll, setPayroll] = useState<StaffPayroll[] | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const weekLabel = buildWeekLabel(weekStart, weekEnd);
  const [lineUsers, setLineUsers] = useState<Record<string, string>>({});
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<{ name: string; status: string }[] | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Load persisted nicknames and LINE user IDs on mount
  useEffect(() => {
    setNicknames(loadFromStorage("mm_nicknames", {}));
    setLineUsers(loadFromStorage("mm_lineUsers", {}));
  }, []);

  function saveNickname(name: string, nick: string) {
    setNicknames((prev) => {
      const updated = { ...prev, [name]: nick };
      localStorage.setItem("mm_nicknames", JSON.stringify(updated));
      return updated;
    });
  }

  function saveLineUser(name: string, uid: string) {
    setLineUsers((prev) => {
      const updated = { ...prev, [name]: uid };
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

  async function calculate() {
    setError("");
    setPayroll(null);
    setSendResults(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, overrides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPayroll(data.payroll);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function sendLine() {
    if (!payroll) return;
    setSending(true);
    setSendResults(null);
    try {
      const res = await fetch("/api/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payroll, lineUsers, nicknames, weekLabel }),
      });
      const data = await res.json();
      setSendResults(data.results);
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
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
          <h2 className="font-semibold text-lg text-[#4a7c59]">2. ระบุสัปดาห์</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-600">วันแรก</label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="border rounded-lg p-2 w-full text-sm text-gray-800"
              />
            </div>
            <span className="mt-5 text-gray-500">–</span>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-600">วันสุดท้าย</label>
              <input
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
                className="border rounded-lg p-2 w-full text-sm text-gray-800"
              />
            </div>
          </div>
          {weekLabel && (
            <p className="text-sm text-[#4a7c59] font-medium">สัปดาห์: {weekLabel}</p>
          )}
        </section>

        {/* Calculate */}
        <section className="bg-white rounded-2xl p-6 shadow">
          <button
            onClick={calculate}
            disabled={!csvText || loading}
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
                lineUserId={lineUsers[staff.name] ?? ""}
                nickname={nicknames[staff.name] ?? ""}
                onStoreLead={setStoreLead}
                onLeave={setLeave}
                onLineUserChange={(uid) => saveLineUser(staff.name, uid)}
                onNicknameChange={(nick) => saveNickname(staff.name, nick)}
                onRecalculate={calculate}
              />
            ))}
          </section>
        )}

        {/* LINE */}
        {payroll && (
          <section className="bg-white rounded-2xl p-6 shadow space-y-4">
            <h2 className="font-semibold text-lg text-[#4a7c59]">4. ส่ง LINE</h2>
            {payroll.some((s) => s.days.some((d) => d.missingClock)) && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-sm text-amber-800">
                มีพนักงานบางคนที่ข้อมูลเวลายังไม่ครบ — กรุณาตรวจสอบก่อนส่ง LINE
              </div>
            )}
            <button
              onClick={sendLine}
              disabled={sending}
              className="w-full bg-[#06C755] text-white py-3 rounded-xl font-semibold disabled:opacity-40 hover:bg-[#05a847] transition"
            >
              {sending ? "กำลังส่ง..." : "ส่งสรุปค่าจ้างทาง LINE"}
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
      </div>
    </main>
  );
}

function StaffCard({
  staff,
  overrides,
  lineUserId,
  nickname,
  onStoreLead,
  onLeave,
  onLineUserChange,
  onNicknameChange,
  onRecalculate,
}: {
  staff: StaffPayroll;
  overrides: Overrides;
  lineUserId: string;
  nickname: string;
  onStoreLead: (name: string, date: string, val: boolean) => void;
  onLeave: (name: string, date: string, val: string) => void;
  onLineUserChange: (uid: string) => void;
  onNicknameChange: (nick: string) => void;
  onRecalculate: () => void;
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
          className="border rounded-lg p-2 w-1/3 text-sm text-gray-800"
        />
        <input
          type="text"
          placeholder="LINE User ID (Uxxxxxxxx...)"
          value={lineUserId}
          onChange={(e) => onLineUserChange(e.target.value)}
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
            onRecalculate={onRecalculate}
          />
        ))}
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
  onRecalculate,
}: {
  day: DayRecord;
  staffName: string;
  overrides: Overrides;
  onStoreLead: (name: string, date: string, val: boolean) => void;
  onLeave: (name: string, date: string, val: string) => void;
  onRecalculate: () => void;
}) {
  const key = `${staffName}__${day.date}`;
  const ov = overrides[key] ?? {};

  const displayDate = (() => {
    const [yyyy, mm, dd] = day.date.split("-");
    return `${dd}/${mm}/${yyyy}`;
  })();

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
        <div className="text-xs font-semibold text-amber-700 bg-amber-100 rounded-lg px-2 py-1 inline-block">
          ⚠ {missingLabel} — ไม่สามารถคำนวณได้
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-sm w-28 text-gray-800">{displayDate}</span>
        <span className="text-xs text-gray-600">
          {day.clockIn ? day.clockIn.slice(0, 5) : "??:??"} – {day.clockOut ? day.clockOut.slice(0, 5) : "??:??"}
        </span>

        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={ov.isStoreLead ?? false}
            onChange={(e) => {
              onStoreLead(staffName, day.date, e.target.checked);
              onRecalculate();
            }}
            disabled={!!ov.leave}
            className="accent-[#4a7c59]"
          />
          Store Lead (฿500)
        </label>

        <select
          value={ov.leave ?? ""}
          onChange={(e) => {
            onLeave(staffName, day.date, e.target.value);
            onRecalculate();
          }}
          className="text-xs border rounded-lg p-1"
        >
          <option value="">มาทำงาน</option>
          <option value="sick">ลาป่วย</option>
          <option value="personal">ลากิจ</option>
        </select>

        <span className="ml-auto font-semibold text-sm">
          {day.leave ? (
            <span className="text-gray-600">{day.leave === "sick" ? "ลาป่วย" : "ลากิจ"}</span>
          ) : (
            `฿${day.dailyTotal.toFixed(2)}`
          )}
        </span>
      </div>

      {day.slots.length > 0 && (
        <div className="pl-4 space-y-0.5">
          {day.slots.map((s) => (
            <div key={s.slot} className="text-xs text-gray-700 flex gap-2">
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
        <div className="pl-4 text-xs text-[#4a7c59] font-medium">Store Lead — ฿500.00 (อัตราคงที่)</div>
      )}
    </div>
  );
}
