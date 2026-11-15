// Dead fuel moisture from hourly weather.
// Equilibrium moisture content: Simard (1968), the equations used by the US NFDRS (Bradshaw et al. 1983).
// Time-lag response: each size class relaxes toward EMC with its time lag (1 h, 10 h, 100 h), Byram (1963).

/** EMC in % from air temperature (°C) and relative humidity (%). */
export function emcSimard(tempC: number, rh: number): number {
  const t = tempC * 1.8 + 32;
  const h = Math.min(100, Math.max(0, rh));
  let emc: number;
  if (h < 10) emc = 0.03229 + 0.281073 * h - 0.000578 * h * t;
  else if (h < 50) emc = 2.22749 + 0.160107 * h - 0.01478 * t;
  else emc = 21.0606 + 0.005565 * h * h - 0.00035 * h * t - 0.483199 * h;
  return Math.max(1, emc);
}

export interface HourWeather {
  /** ISO time, UTC */
  time: string;
  tempC: number;
  rh: number;
  /** 10 m wind, km/h */
  windKmh: number;
  /** direction the wind blows FROM, degrees */
  windFromDeg: number;
  gustKmh: number;
}

export interface HourMoisture {
  d1: number;
  d10: number;
  d100: number;
}

/**
 * Run the three time-lag classes through the hourly series. The first `spinUp` hours (past
 * observations/analysis) only condition the state; returned values cover every hour.
 * Values are fractions (0.08 = 8 %).
 */
export function deadMoistureSeries(hours: HourWeather[]): HourMoisture[] {
  if (!hours.length) return [];
  const e0 = emcSimard(hours[0]!.tempC, hours[0]!.rh);
  // start the slow classes a little wetter than EMC, as they lag the diurnal minimum
  let m1 = e0;
  let m10 = e0 + 1;
  let m100 = e0 + 2;
  return hours.map((h) => {
    const emc = emcSimard(h.tempC, h.rh);
    m1 = emc + (m1 - emc) * Math.exp(-1 / 1);
    m10 = emc + (m10 - emc) * Math.exp(-1 / 10);
    m100 = emc + (m100 - emc) * Math.exp(-1 / 100);
    return { d1: m1 / 100, d10: m10 / 100, d100: m100 / 100 };
  });
}
