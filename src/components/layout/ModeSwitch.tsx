import type { KeyboardEvent } from "react";
import { MODE_LABEL, MODES } from "../../lib/mode/mode";
import { useMode } from "../../lib/mode/provider";

/** Three-way segmented switch: Scientist · Firefighter · Simulator (radio group, arrow keys move). */
export function ModeSwitch() {
  const { mode, setMode } = useMode();
  const idx = MODES.indexOf(mode);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = MODES[(idx + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length]!;
    setMode(next);
  };
  return (
    <div className={`fc-mode-switch is-${mode}`} role="radiogroup" aria-label="Choose a mode" onKeyDown={onKey} style={{ ["--mode-i" as string]: idx }}>
      <span className="fc-mode-thumb" aria-hidden="true" />
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={m === mode}
          tabIndex={m === mode ? 0 : -1}
          title={`${MODE_LABEL[m].th} mode: ${MODE_LABEL[m].tagline}`}
          className="fc-mode-opt"
          onClick={() => m !== mode && setMode(m)}
        >
          {MODE_LABEL[m].en}
        </button>
      ))}
    </div>
  );
}
