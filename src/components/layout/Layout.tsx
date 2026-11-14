import { NavLink, Outlet, Link } from "react-router-dom";
import { config, useDataSource, useMeta } from "../../lib/firecalendar";
import { PageErrorBoundary } from "./ErrorBoundary";
import { useLocation } from "react-router-dom";
import { ModeSwitch } from "./ModeSwitch";
import { useMode } from "../../lib/mode/provider";
import type { AppMode } from "../../lib/mode/mode";

const NAV: Record<AppMode, [string, string][]> = {
  scientist: [
    ["/", "หน้าแรก"],
    ["/explore", "สำรวจพื้นที่"],
    ["/evidence", "หลักฐาน"],
    ["/data", "ข้อมูล"],
    ...(config.featureAsk ? ([["/ask", "ถาม"]] as [string, string][]) : []),
    ["/about", "เกี่ยวกับ"],
  ],
  firefighter: [
    ["/watch", "จุดเฝ้าระวัง"],
    ["/evidence", "หลักฐาน"],
    ["/about", "เกี่ยวกับ"],
  ],
};

export function Layout() {
  const loc = useLocation();
  const { mode } = useMode();
  return (
    <>
      <a href="#main" className="sr-only">
        ข้ามไปเนื้อหา
      </a>
      <header className="fc-header">
        <div className="fc-header-inner">
          <Link to={mode === "firefighter" ? "/watch" : "/"} className="fc-brand">
            FireCalendar<span>+</span>
          </Link>
          <nav className="fc-nav" aria-label="เมนูหลัก">
            {NAV[mode].map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"}>
                {label}
              </NavLink>
            ))}
          </nav>
          <ModeSwitch />
        </div>
      </header>
      <main id="main" className="fc-main">
        <PageErrorBoundary key={loc.pathname}>
          <Outlet />
        </PageErrorBoundary>
      </main>
      <Footer />
    </>
  );
}

function Footer() {
  const meta = useMeta();
  const ds = useDataSource();
  return (
    <footer className="fc-footer">
      <div className="fc-footer-inner">
        <span>
          ข้อมูลรุ่น <span className="num">{meta.data?.data_version ?? "…"}</span> · โมเดล{" "}
          <span className="num">{meta.data?.model_id ?? "…"}</span>
        </span>
        <span>ข้อมูล: NASA FIRMS, MCD12C1</span>
        <span>โหมดข้อมูล: {ds.mode}</span>
        <Link to="/guide">คู่มือต้นแบบ Earth Pulse</Link>
        <Link to="/prototype">ต้นแบบ MODIS · VIIRS Explorer</Link>
      </div>
    </footer>
  );
}
