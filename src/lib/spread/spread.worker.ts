// Runs the ensemble off the main thread so the map stays responsive.
import { ensemble, type EnsembleResult, type SimInput } from "./simulate";

export type WorkerRequest = { input: Omit<SimInput, "perturb">; members: number; seed: number };
export type WorkerResponse = { type: "progress"; done: number } | { type: "done"; result: EnsembleResult } | { type: "error"; message: string };

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);
  try {
    const { input, members, seed } = ev.data;
    const result = ensemble(input, members, seed, (done) => post({ type: "progress", done }));
    post({ type: "done", result });
  } catch (e) {
    post({ type: "error", message: e instanceof Error ? e.message : String(e) });
  }
};
