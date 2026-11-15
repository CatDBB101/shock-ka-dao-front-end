// Turning one arrival-time grid into animation frames (pure, unit-tested).

/** Cells burning at time t: arrived within the last `windowMin` minutes. */
export function frontCells(arrival: Float32Array, tMin: number, windowMin: number): number[] {
  const out: number[] = [];
  const lo = tMin - windowMin;
  for (let i = 0; i < arrival.length; i++) {
    const a = arrival[i]!;
    if (a <= tMin && a > lo) out.push(i);
  }
  return out;
}

export function burnedHaAt(arrival: Float32Array, tMin: number, cellM: number): number {
  let k = 0;
  for (let i = 0; i < arrival.length; i++) if (arrival[i]! <= tMin) k++;
  return (k * cellM * cellM) / 10_000;
}

/**
 * Local spread rate (m/min) from the arrival-time gradient: R = 1 / |∇t|. Uses central differences
 * where both neighbours burned, one-sided otherwise. Infinity-free: returns 0 when no neighbour burned.
 */
export function localRos(arrival: Float32Array, n: number, cellM: number, i: number): number {
  const x = i % n;
  const y = (i - x) / n;
  const t = arrival[i]!;
  const d = (j: number, ok: boolean) => (ok && Number.isFinite(arrival[j]!) ? arrival[j]! : NaN);
  const grad = (a: number, b: number) => {
    if (Number.isFinite(a) && Number.isFinite(b)) return (b - a) / (2 * cellM);
    if (Number.isFinite(b)) return (b - t) / cellM;
    if (Number.isFinite(a)) return (t - a) / cellM;
    return NaN;
  };
  const gx = grad(d(i - 1, x > 0), d(i + 1, x < n - 1));
  const gy = grad(d(i - n, y > 0), d(i + n, y < n - 1));
  const g = Math.hypot(Number.isFinite(gx) ? gx : 0, Number.isFinite(gy) ? gy : 0);
  return g > 1e-9 ? 1 / g : 0;
}

/**
 * Flame length of a front cell. Byram: L ∝ I^0.46 and I ∝ R, so a cell spreading at R relative to the
 * head-fire rate rMax at that hour gets L = Lhead · (R / rMax)^0.46. Flanks and backing fire come out shorter.
 */
export function flameAtCell(localR: number, rMax: number, headFlameM: number): number {
  if (!(rMax > 0) || !(localR > 0)) return headFlameM * 0.2;
  return headFlameM * Math.min(1, localR / rMax) ** 0.46;
}

/** Fixed (not data-driven) arrival bands, so every frame and every run uses the same colours. */
export function arrivalBand(tMin: number, durationMin: number, bands: number): number {
  return Math.min(bands - 1, Math.max(0, Math.floor((tMin / durationMin) * bands)));
}
