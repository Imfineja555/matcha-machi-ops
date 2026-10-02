import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

const TOOLS = [
  { href: "/payroll", title: "Payroll", body: "คำนวณค่าแรงพนักงานพาร์ตไทม์จากไฟล์ลงเวลา และส่งสรุปยอดทาง LINE" },
  { href: "/pricing", title: "ราคาและต้นทุน", body: "ต้นทุนเครื่องดื่ม ผงออนไลน์ สินค้านำเข้า และราคาขายส่ง" },
];

export default async function Home() {
  const email = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <main className="mm-shell">
      <div className="mm-home">
        <header className="mm-head">
          <div>
            <h1>ระบบหลังบ้าน Matcha Machi</h1>
            <p className="mm-sub">เลือกเครื่องมือที่ต้องการใช้งาน</p>
          </div>
          <p className="mm-user">
            {email}
            <a href="/api/auth/logout">ออกจากระบบ</a>
          </p>
        </header>
        <div className="mm-grid">
          {TOOLS.map((t) =>
            t.href === "/payroll" ? (
              <Link key={t.href} href={t.href} className="mm-card mm-tool">
                <h2>{t.title}</h2>
                <p>{t.body}</p>
                <span>เปิด</span>
              </Link>
            ) : (
              // the pricing tool is a separate page served through /pricing, so it needs a full page load
              <a key={t.href} href={t.href} className="mm-card mm-tool">
                <h2>{t.title}</h2>
                <p>{t.body}</p>
                <span>เปิด</span>
              </a>
            )
          )}
        </div>
      </div>
    </main>
  );
}
