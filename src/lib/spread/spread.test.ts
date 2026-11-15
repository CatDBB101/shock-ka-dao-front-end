import { describe, expect, it } from "vitest";
import { fuelById, pointSpread, rosAt, rothermelBase, windAdjustment } from "./rothermel";
import { deadMoistureSeries, emcSimard, type HourWeather } from "./moisture";
import { ensemble, NON_BURNABLE, simulate, slopeAspect, type Grid } from "./simulate";

const MPH = 26.8224; // m/min per mph
const dry = { d1: 0.06, d10: 0.07, d100: 0.08, live: 0.6 };

describe("Rothermel surface spread", () => {
  it("fuel model 1, 5 mph midflame, 6% → ~80 ch/h like BehavePlus (±35%)", () => {
    const p = pointSpread(rothermelBase(fuelById("1"), dry), 5 * MPH, 270, 0, 0);
    const chPerH = (p.rMax / 20.1168) * 60;
    expect(chPerH).toBeGreaterThan(80 * 0.65);
    expect(chPerH).toBeLessThan(80 * 1.35);
  });

  it("timber litter (FM 8) is an order of magnitude slower than grass", () => {
    const g = pointSpread(rothermelBase(fuelById("1"), dry), 5 * MPH, 0, 0, 0).rMax;
    const t = pointSpread(rothermelBase(fuelById("8"), dry), 5 * MPH, 0, 0, 0).rMax;
    expect(t).toBeLessThan(g / 10);
  });

  it("wetter fuel spreads slower; at extinction it does not spread", () => {
    const fm = fuelById("1");
    const r6 = rothermelBase(fm, dry).r0;
    const r10 = rothermelBase(fm, { ...dry, d1: 0.1 }).r0;
    expect(r10).toBeLessThan(r6);
    expect(rothermelBase(fm, { ...dry, d1: 0.13 }).r0).toBeCloseTo(0, 6);
  });

  it("head fire runs downwind; wind from the west pushes it east", () => {
    const p = pointSpread(rothermelBase(fuelById("3"), dry), 4 * MPH, 270, 0, 0);
    expect(p.headDeg).toBeCloseTo(90, 5);
    expect(p.lb).toBeGreaterThan(1.5);
    expect(rosAt(p, 90)).toBeCloseTo(p.rMax, 6);
    expect(rosAt(p, 270)).toBeLessThan(p.rMax / 5);
  });

  it("no wind on a slope: fire runs uphill and faster than on flat ground", () => {
    const b = rothermelBase(fuelById("2"), dry);
    const flat = pointSpread(b, 0, 0, 0, 0);
    const hill = pointSpread(b, 0, 0, Math.tan((30 * Math.PI) / 180), 45);
    expect(hill.headDeg).toBeCloseTo(45, 5);
    expect(hill.rMax).toBeGreaterThan(flat.rMax * 2);
  });

  it("wind adjustment factor is lower under a canopy", () => {
    expect(windAdjustment(fuelById("9"))).toBeLessThan(windAdjustment(fuelById("1")));
    expect(windAdjustment(fuelById("3"))).toBeGreaterThan(0.3);
  });
});

describe("dead fuel moisture", () => {
  it("Simard EMC: dry hot air ≈ 2–4 %, humid cool air ≈ 15–25 %", () => {
    expect(emcSimard(35, 15)).toBeGreaterThan(2);
    expect(emcSimard(35, 15)).toBeLessThan(5);
    expect(emcSimard(15, 90)).toBeGreaterThan(15);
  });
  it("1-h fuel follows EMC faster than 100-h", () => {
    const hrs: HourWeather[] = Array.from({ length: 12 }, (_, i) => ({ time: `${i}`, tempC: 35, rh: 12, windKmh: 10, windFromDeg: 0, gustKmh: 15 }));
    const s = deadMoistureSeries(hrs);
    expect(s.at(-1)!.d1).toBeLessThan(s.at(-1)!.d100);
  });
});

function flatGrid(n = 41, fuel = 0): Grid {
  return { nx: n, ny: n, cell: 30, elev: null, fuel: new Uint8Array(n * n).fill(fuel) };
}
const steady = (windFromDeg: number, kmh = 20, hours = 3): HourWeather[] =>
  Array.from({ length: hours }, (_, i) => ({ time: String(i), tempC: 30, rh: 20, windKmh: kmh, windFromDeg, gustKmh: kmh }));
const moist = (h: number) => Array.from({ length: h }, () => ({ d1: 0.06, d10: 0.07, d100: 0.08 }));

describe("grid simulation (minimum travel time)", () => {
  it("wind from the south → the fire grows farthest to the north", () => {
    const g = flatGrid();
    const c = 20 * 41 + 20;
    const r = simulate({ grid: g, ignitions: [c], weather: steady(180), moisture: moist(3), liveMoisture: 0.6, durationMin: 60 });
    const north = r.arrival[5 * 41 + 20]!;
    const south = r.arrival[35 * 41 + 20]!;
    expect(north).toBeLessThan(south);
    expect(r.burnedHa).toBeGreaterThan(0);
  });

  it("non-burnable cells stop the fire", () => {
    const g = flatGrid();
    for (let y = 0; y < 41; y++) for (let x = 25; x < 28; x++) g.fuel[y * 41 + x] = NON_BURNABLE;
    const r = simulate({ grid: g, ignitions: [20 * 41 + 20], weather: steady(270, 30), moisture: moist(3), liveMoisture: 0.6, durationMin: 120 });
    expect(r.arrival[20 * 41 + 35]).toBe(Infinity);
  });

  it("ignition on a non-burnable cell burns nothing instead of crashing", () => {
    const g = flatGrid();
    g.fuel.fill(NON_BURNABLE);
    const r = simulate({ grid: g, ignitions: [20 * 41 + 20], weather: steady(0), moisture: moist(3), liveMoisture: 0.6, durationMin: 60 });
    expect(r.burnedHa).toBe(0);
    expect(r.hourly).toEqual([]);
  });

  it("slope from elevation: a ramp rising to the east has upslope azimuth 90°", () => {
    const g = flatGrid(5);
    g.elev = new Float32Array(25).map((_, i) => (i % 5) * 10);
    const { tan, up } = slopeAspect(g);
    expect(up[12]).toBeCloseTo(90, 3);
    expect(tan[12]).toBeCloseTo(10 / 30, 3);
  });

  it("ensemble gives probability 1 at the ignition and is reproducible", () => {
    const g = flatGrid();
    const inp = { grid: g, ignitions: [20 * 41 + 20], weather: steady(200), moisture: moist(3), liveMoisture: 0.6, durationMin: 15 };
    const a = ensemble(inp, 8, 7);
    const b = ensemble(inp, 8, 7);
    expect(a.probability[20 * 41 + 20]).toBe(1);
    expect(Array.from(a.probability)).toEqual(Array.from(b.probability));
    expect(a.burnedHa.p10).toBeLessThanOrEqual(a.burnedHa.p90);
  });
});

import { arrivalBand, burnedHaAt, flameAtCell, frontCells, localRos } from "./playback";
import { burnFirebreaks } from "./run";

describe("playback frames", () => {
  // arrival grows 2 min per cell eastward → R = 30 m / 2 min = 15 m/min
  const n = 5;
  const arr = new Float32Array(n * n).map((_, i) => (i % n) * 2);
  it("front = cells that arrived in the window; burned area counts arrival ≤ t", () => {
    expect(frontCells(arr, 4, 2).every((i) => i % n === 2)).toBe(true);
    expect(burnedHaAt(arr, 4, 30)).toBeCloseTo((15 * 900) / 10_000, 6);
  });
  it("local rate of spread from the arrival gradient", () => {
    expect(localRos(arr, n, 30, 2 * n + 2)).toBeCloseTo(15, 6);
  });
  it("flames shrink on the flanks (Byram exponent) and never exceed the head", () => {
    expect(flameAtCell(15, 15, 3)).toBeCloseTo(3, 6);
    expect(flameAtCell(1.5, 15, 3)).toBeLessThan(1.2);
    expect(flameAtCell(30, 15, 3)).toBe(3);
  });
  it("fixed arrival bands", () => {
    expect(arrivalBand(0, 600, 6)).toBe(0);
    expect(arrivalBand(600, 600, 6)).toBe(5);
  });
});

describe("firebreaks", () => {
  it("a drawn line stops the fire on the other side", () => {
    const g = flatGrid();
    const geo = { lat: 0, lon: 0, n: 41, cell: 30 };
    // vertical line 8 cells east of centre (30 m cells at the equator ≈ 0.0002695° lon)
    const dLon = (8 * 30) / 111_320;
    const dLat = (19 * 30) / 110_540;
    expect(burnFirebreaks(g.fuel, geo, [[[dLon, -dLat], [dLon, dLat]]])).toBeGreaterThan(30);
    const r = simulate({ grid: g, ignitions: [20 * 41 + 20], weather: steady(270, 30), moisture: moist(3), liveMoisture: 0.6, durationMin: 120 });
    expect(r.arrival[20 * 41 + 35]).toBe(Infinity);
    expect(r.arrival[20 * 41 + 25]).toBeLessThan(Infinity);
  });
});

import { canopyWaf, crownInitiationIntensity, crownState } from "./crown";

describe("canopy and crown fire", () => {
  it("Van Wagner (1977): CBH 3 m, FMC 100 % → ~875 kW/m", () => {
    expect(crownInitiationIntensity(3, 100)).toBeGreaterThan(850);
    expect(crownInitiationIntensity(3, 100)).toBeLessThan(900);
    expect(crownInitiationIntensity(6)).toBeGreaterThan(crownInitiationIntensity(3));
  });
  it("sheltered WAF under a 20 m, 60 % cover canopy ≈ 0.1–0.15; open ground → null", () => {
    const w = canopyWaf(20, 0.6)!;
    expect(w).toBeGreaterThan(0.08);
    expect(w).toBeLessThan(0.16);
    expect(canopyWaf(1, 0.9)).toBeNull();
    expect(canopyWaf(20, 0.02)).toBeNull();
  });
  it("crown state: below threshold surface, above it passive, fast crown run active (R ≥ 3/CBD)", () => {
    expect(crownState(500, 50, 3)).toBe(0);
    expect(crownState(2000, 10, 3)).toBe(1);
    expect(crownState(2000, 40, 3)).toBe(2);
  });
  it("simulation: a dense tall canopy shelters the wind and slows a grass fire; crown map is filled", () => {
    const n = 41;
    const open = flatGrid(n, 0);
    const forest = { ...flatGrid(n, 0), canopyH: new Float32Array(n * n).fill(20), canopyCover: new Float32Array(n * n).fill(0.7) };
    const run = (g: typeof open) => simulate({ grid: g, ignitions: [20 * n + 20], weather: steady(270, 30), moisture: moist(3), liveMoisture: 0.6, durationMin: 30 });
    const a = run(open);
    const b = run(forest);
    expect(b.burnedHa).toBeLessThan(a.burnedHa);
    expect(a.crown).toBeNull();
    expect(b.crown).not.toBeNull();
    expect(b.hourly[0]!.crown).toBe(0); // short grass under tall crowns: surface fire can't reach CBH 6 m
  });
});
