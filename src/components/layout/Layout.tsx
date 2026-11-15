import { NavLink, Outlet, Link } from "react-router-dom";
import { config, useDataSource, useMeta } from "../../lib/firecalendar";
import { PageErrorBoundary } from "./ErrorBoundary";
import { useLocation } from "react-router-dom";
import { ModeSwitch } from "./ModeSwitch";
import { useMode } from "../../lib/mode/provider";
import type { AppMode } from "../../lib/mode/mode";

const NAV: Record<AppMode, [string, string][]> = {
  scientist: [
    ["/", "Home"],
    ["/explore", "Explore"],
    ["/evidence", "Evidence"],
    ["/data", "Data"],
    ...(config.featureAsk ? ([["/ask", "Ask"]] as [string, string][]) : []),
    ["/about", "About"],
  ],
  firefighter: [
    ["/watch", "Watch"],
    ["/evidence", "Evidence"],
    ["/about", "About"],
  ],
};

export function Layout() {
  const loc = useLocation();
  const { mode } = useMode();
  return (
    <>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <header className="fc-header">
        <div className="fc-header-inner">
          <Link to={mode === "firefighter" ? "/watch" : "/"} className="fc-brand">
            FireCalendar<span>+</span>
          </Link>
          <nav className="fc-nav" aria-label="Main menu">
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
          Data version <span className="num">{meta.data?.data_version ?? "…"}</span> · Model{" "}
          <span className="num">{meta.data?.model_id ?? "…"}</span>
        </span>
        <span>Data: NASA FIRMS, MCD12C1</span>
        <span>Data mode: {ds.mode}</span>
        <Link to="/guide">Earth Pulse Prototype Guide</Link>
        <Link to="/prototype">MODIS · VIIRS Explorer Prototype</Link>
      </div>
    </footer>
  );
}