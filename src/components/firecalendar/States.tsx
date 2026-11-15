import type { ReactNode } from "react";
import { errorMessageEn, type FireCalendarError } from "../../lib/firecalendar";

export function LoadError({ error, onRetry, children }: { error: FireCalendarError; onRetry?: () => void; children?: ReactNode }) {
  const retryable = error.kind === "network" || error.kind === "server";
  return (
    <div className="alert" role="alert">
      <p style={{ margin: 0 }}>
        <b>{errorMessageEn(error)}</b>
        {retryable && error.message && <span className="small muted"> ({error.message})</span>}
      </p>
      {retryable && onRetry && (
        <button className="btn ghost" type="button" style={{ marginTop: 8 }} onClick={onRetry}>
          Retry
        </button>
      )}
      {children}
    </div>
  );
}