import { MODE_LABEL } from "../../lib/mode/mode";
import { useMode } from "../../lib/mode/provider";

/** Two-position switch: Scientist ⇄ Firefighter. */
export function ModeSwitch() {
  const { mode, setMode } = useMode();
  const ff = mode === "firefighter";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ff}
      aria-label={`Mode: ${MODE_LABEL[mode].en} — press to switch to ${MODE_LABEL[ff ? "scientist" : "firefighter"].en}`}
      title={`Switch to ${MODE_LABEL[ff ? "scientist" : "firefighter"].en} mode`}
      className={`fc-mode-switch${ff ? " is-ff" : ""}`}
      onClick={() => setMode(ff ? "scientist" : "firefighter")}
    >
      <span className="fc-mode-thumb" aria-hidden="true" />
      <span className="fc-mode-opt" aria-hidden="true">
        {MODE_LABEL.scientist.en}
      </span>
      <span className="fc-mode-opt" aria-hidden="true">
        {MODE_LABEL.firefighter.en}
      </span>
    </button>
  );
}