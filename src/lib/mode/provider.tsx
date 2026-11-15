import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_MODE, homeRedirect, MODE_LABEL, modeForPath, parseMode, readStoredMode, storeMode, type AppMode } from "./mode";

interface ModeCtx {
  mode: AppMode;
  /** switch mode; `go` (default true) also navigates to that mode's home page */
  setMode: (m: AppMode, go?: boolean) => void;
}

const Ctx = createContext<ModeCtx | null>(null);

/** Must be inside the router. Priority: exclusive route > ?mode= > localStorage > default. */
export function ModeProvider({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [chosen, setState] = useState<AppMode>(
    () => parseMode(new URLSearchParams(loc.search).get("mode")) ?? readStoredMode() ?? DEFAULT_MODE,
  );
  // follow the route: /watch → firefighter, /explore and /data → scientist; shared pages keep the chosen mode
  const forcedNow = modeForPath(loc.pathname);
  const mode = forcedNow ?? chosen;
  // remember the route's mode for shared pages — only when the route changes. A render-phase update
  // here used to undo a switch made on a role page (it ran before the navigation to the new home landed).
  useEffect(() => {
    if (forcedNow) setState(forcedNow);
  }, [forcedNow]);

  useEffect(() => {
    storeMode(mode);
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  // the root is the scientist home; a firefighter landing there goes to their own home
  const redirect = homeRedirect(loc.pathname, mode);
  useEffect(() => {
    if (redirect) navigate(`${redirect}${loc.search}`, { replace: true });
  }, [redirect, loc.search, navigate]);

  const setMode = useCallback(
    (m: AppMode, go = true) => {
      setState(m);
      const forced = modeForPath(loc.pathname);
      // leave a page that belongs to the other mode; shared pages (home, evidence, about) stay put unless asked
      if (go || (forced && forced !== m)) navigate(MODE_LABEL[m].home);
    },
    [loc.pathname, navigate],
  );

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMode(): ModeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("wrap the app in <ModeProvider> (inside the router)");
  return c;
}
