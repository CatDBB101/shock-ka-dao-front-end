// Canopy height + cover per simulation cell, from the tiles built by scripts/canopy/build-canopy.mjs
// (Meta/WRI 1.19 m canopy height model → 38 m XYZ PNG tiles at z12: R = p90 height m, G = cover %, A = data).
import { cellLonLat, type GridGeo } from "./inputs";

export interface CanopyIndex {
  dataset: string;
  citation: string;
  license: string;
  sensor: string;
  heightReference: string;
  zoom: number;
  generated: string;
  tiles: string[];
}

export interface CanopyGrid {
  height: Float32Array;
  cover: Float32Array;
  /** share of grid cells that had canopy data */
  coverage: number;
  meanHeightM: number;
  meanCover: number;
  /** share of cells with a fire-relevant canopy (≥ 3 m, ≥ 25 % cover) */
  forestShare: number;
  index: CanopyIndex;
}

const base = (import.meta.env.VITE_FC_CANOPY_BASE || "/canopy").replace(/\/+$/, "");
let indexPromise: Promise<CanopyIndex | null> | null = null;

export function loadCanopyIndex(): Promise<CanopyIndex | null> {
  indexPromise ??= fetch(`${base}/index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<CanopyIndex>) : null))
    .catch(() => null);
  return indexPromise;
}

const TILE = 256;
const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z * TILE;
const latToY = (lat: number, z: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z * TILE;
};

async function loadTile(z: number, x: number, y: number, signal?: AbortSignal): Promise<ImageData | null> {
  const r = await fetch(`${base}/${z}/${x}/${y}.png`, { signal });
  if (!r.ok) return null;
  const bmp = await createImageBitmap(await r.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const c = new OffscreenCanvas(TILE, TILE);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, TILE, TILE);
}

/**
 * Canopy per grid cell: mean of the 38 m canopy pixels inside each cell (cells are 50–400 m).
 * Returns null when no tile covers the grid (canopy effects are then left out of the run).
 */
export async function fetchCanopy(g: GridGeo, signal?: AbortSignal): Promise<CanopyGrid | null> {
  const index = await loadCanopyIndex();
  if (!index?.tiles?.length) return null;
  const have = new Set(index.tiles);
  const z = index.zoom;
  const [w, nLat] = cellLonLat(g, -0.5, -0.5);
  const [e, sLat] = cellLonLat(g, g.n - 0.5, g.n - 0.5);
  const tx0 = Math.floor(lonToX(w, z) / TILE), tx1 = Math.floor(lonToX(e, z) / TILE);
  const ty0 = Math.floor(latToY(nLat, z) / TILE), ty1 = Math.floor(latToY(sLat, z) / TILE);
  const want: [number, number][] = [];
  for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) if (have.has(`${x}/${y}`)) want.push([x, y]);
  if (!want.length) return null;
  const tiles = new Map<string, ImageData>();
  await Promise.all(
    want.map(async ([x, y]) => {
      const t = await loadTile(z, x, y, signal).catch(() => null);
      if (t) tiles.set(`${x}/${y}`, t);
    }),
  );
  if (!tiles.size) return null;

  const px = (X: number, Y: number): [number, number] | null => {
    const tx = Math.floor(X / TILE), ty = Math.floor(Y / TILE);
    const t = tiles.get(`${tx}/${ty}`);
    if (!t) return null;
    const o = ((Y - ty * TILE) * TILE + (X - tx * TILE)) * 4;
    return t.data[o + 3]! > 0 ? [t.data[o]!, t.data[o + 1]! / 100] : null;
  };
  const n = g.n * g.n;
  const height = new Float32Array(n).fill(NaN);
  const cover = new Float32Array(n);
  let withData = 0, sumH = 0, sumC = 0, forest = 0;
  for (let y = 0; y < g.n; y++)
    for (let x = 0; x < g.n; x++) {
      // canopy pixels inside the cell footprint
      const [lonA, latA] = cellLonLat(g, x - 0.5, y - 0.5);
      const [lonB, latB] = cellLonLat(g, x + 0.5, y + 0.5);
      const X0 = Math.floor(lonToX(lonA, z)), X1 = Math.max(X0, Math.floor(lonToX(lonB, z)) - 1);
      const Y0 = Math.floor(latToY(latA, z)), Y1 = Math.max(Y0, Math.floor(latToY(latB, z)) - 1);
      let k = 0, sh = 0, sc = 0;
      for (let Y = Y0; Y <= Y1; Y++)
        for (let X = X0; X <= X1; X++) {
          const v = px(X, Y);
          if (!v) continue;
          k++;
          sh += v[0];
          sc += v[1];
        }
      if (!k) continue;
      const i = y * g.n + x;
      height[i] = sh / k;
      cover[i] = sc / k;
      withData++;
      sumH += height[i]!;
      sumC += cover[i]!;
      if (height[i]! >= 3 && cover[i]! >= 0.25) forest++;
    }
  if (!withData) return null;
  return {
    height,
    cover,
    coverage: withData / n,
    meanHeightM: sumH / withData,
    meanCover: sumC / withData,
    forestShare: forest / withData,
    index,
  };
}
