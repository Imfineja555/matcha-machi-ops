const MESSAGES: Record<string, string> = {
  denied: "บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งาน กรุณาเข้าสู่ระบบด้วยอีเมลของร้าน",
  state: "การเข้าสู่ระบบหมดเวลา กรุณาลองใหม่อีกครั้ง",
  google: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  config: "ระบบเข้าสู่ระบบยังตั้งค่าไม่ครบ",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mm-shell">
      <div className="mm-card mm-login">
        <svg viewBox="0 0 40 40" aria-hidden="true" className="mm-mark">
          <circle cx="20" cy="20" r="15" fill="none" stroke="#2a4d2a" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="78 17" transform="rotate(-38 20 20)" />
        </svg>
        <h1>Matcha Machi</h1>
        <p className="mm-sub">ระบบหลังบ้าน สำหรับทีมงานเท่านั้น</p>
        {error && <p className="mm-error">{MESSAGES[error] ?? MESSAGES.google}</p>}
        <a className="mm-btn" href="/api/auth/login">เข้าสู่ระบบด้วย Google</a>
      </div>
    </main>
  );
}
