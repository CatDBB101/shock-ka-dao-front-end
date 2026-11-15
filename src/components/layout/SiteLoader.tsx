// Splash shown once per browser session while the app boots underneath. A little cheeky: the bar
// races to 99 %, stalls, slips back when "a satellite blinks", then gives up and lets you in.
// It holds the page for 10 s (the app keeps loading underneath), can be skipped at once (button / Esc), and with
// reduced motion it shows a plain one-line loader for a moment instead.
import { useEffect, useRef, useState } from "react";

const SEEN_KEY = "fc.loader.seen.v1";

/** [time ms, progress %, message] — the scripted "loading" */
const SCRIPT: [number, number, string][] = [
  [0, 0, "Counting every fire on Earth since 2001…"],
  [900, 22, "Asking two satellites to agree on something…"],
  [2000, 47, "Converting MODIS into VIIRS. MODIS is not thrilled."],
  [3200, 74, "Checking the wind. It says it's fine. It always says that."],
  [4300, 99, "99%."],
  [5500, 99, "Still 99%. The last 1% is always the hardest."],
  [6800, 93, "Hang on, a satellite blinked. Recounting…"],
  [8000, 99.9, "99.9%. We're basically there. Emotionally."],
  [9200, 100, "Fine. It's ready. It was ready the whole time."],
];
/** the splash stays 10 s unless skipped */
const DONE_AT = 10_000;
const TEASES = ["Clicking it won't make it faster.", "Still not faster.", "You're very persistent.", "OK, OK. Skip is right there."];

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
function markSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private window: show again next time, harmless */
  }
}

export function SiteLoader() {
  const [open, setOpen] = useState(() => !alreadySeen());
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState(0);
  const [tease, setTease] = useState<string | null>(null);
  const teaseN = useRef(0);
  const skipRef = useRef<HTMLButtonElement>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const close = () => {
    markSeen();
    setLeaving(true);
    window.setTimeout(() => setOpen(false), reduced ? 0 : 450);
  };

  useEffect(() => {
    if (!open) return;
    skipRef.current?.focus({ preventScroll: true });
    const timers = reduced
      ? [window.setTimeout(close, 700)]
      : [...SCRIPT.slice(1).map(([t], i) => window.setTimeout(() => setStep(i + 1), t)), window.setTimeout(close, DONE_AT)];
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
    // run once when shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const [, pct, msg] = SCRIPT[step]!;
  const slipped = step === 6;
  const onBarClick = () => {
    setTease(TEASES[Math.min(teaseN.current, TEASES.length - 1)]!);
    teaseN.current++;
  };

  return (
    <div className={`fc-loader${leaving ? " is-leaving" : ""}${reduced ? " is-still" : ""}`} role="dialog" aria-modal="true" aria-label="Loading FireFirm">
      <div className="fc-loader-inner">
        <p className="fc-loader-brand">
          <img src="/brand/firefirm-mark.png" alt="" width={44} height={44} />
          FireFirm
        </p>
        {reduced ? (
          <p className="fc-loader-msg" role="status">
            Loading…
          </p>
        ) : (
          <>
            <button
              type="button"
              className={`fc-loader-bar${slipped ? " slipped" : ""}`}
              onClick={onBarClick}
              aria-label={`Loading progress ${pct}%`}
              tabIndex={-1}
            >
              <span className="fc-loader-fill" style={{ transform: `scaleX(${pct / 100})` }} />
              {(step === 4 || step === 5 || step === 7) && <span className="fc-loader-stuck" aria-hidden="true" />}
            </button>
            <div className="fc-loader-row">
              <p className="fc-loader-msg" role="status" aria-live="polite">
                {tease ?? msg}
              </p>
              <span className="fc-loader-pct num" aria-hidden="true">
                {pct}%
              </span>
            </div>
          </>
        )}
        <button ref={skipRef} type="button" className="fc-loader-skip" onClick={close}>
          Skip, I'm in a hurry
        </button>
      </div>
    </div>
  );
}
