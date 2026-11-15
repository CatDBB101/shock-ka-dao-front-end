import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Page-level boundary: a crash shows a message instead of a blank screen (F4.2). */
export class PageErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("page crashed", error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="alert" role="alert">
        <h2>Something went wrong</h2>
        <p>This page failed to render. Try reloading it.</p>
        <p className="small muted">{this.state.error.message}</p>
        <button className="btn" type="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}
