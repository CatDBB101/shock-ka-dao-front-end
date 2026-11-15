import { NavLink, Outlet, Link } from "react-router-dom";
import { config, useDataSource, useMeta } from "../../lib/firecalendar";
import { PageErrorBoundary } from "./ErrorBoundary";
import { useLocation } from "react-router-dom";
import { ModeSwitch } from "./ModeSwitch";
import { useMode } from "../../lib/mode/provider";
import { MODE_LABEL, MODE_ROUTES, type AppMode } from "../../lib/mode/mode";

const NAV_LABEL: Record<string, string> = {
  "/": "Home",
  "/explore": "Explore",
  "/data": "Data",
  "/ask": "Ask",
  "/watch": "Watchpoints",
  "/spread": "Spread forecast",
  "/simulator": "3D simulator",
  "/evidence": "Evidence",
  "/about": "About",
};

/** The role's own pages, then the shared ones — straight from MODE_ROUTES, so nav and mode switching can't drift. */
const navFor = (mode: AppMode): [string, string][] =>
  [...MODE_ROUTES[mode], ...MODE_ROUTES.shared]
    .filter((to) => to !== "/ask" || config.featureAsk)
    .map((to) => [to, NAV_LABEL[to] ?? to]);

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
          <Link to={MODE_LABEL[mode].home} className="fc-brand">
            <img src="/brand/firefirm-mark.png" alt="" width={34} height={34} />
            FireFirm
          </Link>
          <nav className="fc-nav" aria-label="Main">
            {navFor(mode).map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"}>
                {label}
              </NavLink>
            ))}
          </nav>
          <ModeSwitch />
        </div>
      </header>
      <div className={`fc-role-bar is-${mode}`}>
        <div className="fc-role-bar-inner">
          <b>{MODE_LABEL[mode].th} mode</b>
          <span>{MODE_LABEL[mode].tagline}</span>
        </div>
      </div>
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
          Data <span className="num">{meta.data?.data_version ?? "…"}</span> · model{" "}
          <span className="num">{meta.data?.model_id ?? "…"}</span>
        </span>
        <span>Sources: NASA FIRMS, MCD12C1</span>
        <span>Data mode: {ds.mode}</span>
        <Link to="/guide">Earth Pulse guide (prototype)</Link>
        <Link to="/prototype">MODIS · VIIRS Explorer (prototype)</Link>
      </div>
    </footer>
  );
}
