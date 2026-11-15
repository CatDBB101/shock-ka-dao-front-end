#!/usr/bin/env node
// Build web canopy tiles for the fire simulator from Meta/WRI "High Resolution Canopy Height Maps"
// (Tolan et al. 2024, CC BY 4.0): 1.19 m canopy height model (CHM) predicted from Maxar imagery and
// calibrated with airborne LiDAR + GEDI spaceborne LiDAR. It is a model output, NOT a raw point cloud.
//
// Source tiles: s3://dataforgood-fb-data/forests/v1/alsgedi_global_v6_float/chm/{quadkey z9}.tif
//   EPSG:3857, 65536×65536 px, uint8 metres above ground (height above ground: no vertical datum).
// Output: public/canopy/12/{x}/{y}.png (XYZ, 256 px ≈ 38 m/px at the equator)
//   R = p90 canopy height in the 32×32 source block (m, 0–254)   — the forestry "canopy height"
//   G = canopy cover: % of source pixels taller than 2 m (0–100)
//   B = 0, A = 255 where the block had data, 0 otherwise
// plus public/canopy/index.json (tiles list + provenance), read by the app.
//
// Usage: node scripts/canopy/build-canopy.mjs                  # tile under each watchpoint
//        node scripts/canopy/build-canopy.mjs -33.2,-60.1 ...    # extra lat,lon points
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
import { join } from "node:path";
import { fetchRange, readTiffHeader, decodeStrip, TAG } from "./tiff.mjs";

const SRC = "https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm";
const SRC_Z = 9;
const OUT_Z = 12;
const BLOCK = 32; // 65536 / (8 tiles × 256 px)
const COVER_M = 2;
const OUT = "public/canopy";

const quadkey = (x, y, z) => {
  let q = "";
  for (let i = z; i > 0; i--) {
    const m = 1 << (i - 1);
    q += ((x & m ? 1 : 0) + (y & m ? 2 : 0)).toString();
  }
  return q;
};
const tileXY = (lon, lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return [Math.floor(((lon + 180) / 360) * 2 ** z), Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z)];
};

function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

async function buildSourceTile(qk, sx, sy) {
  const url = `${SRC}/${qk}.tif`;
  const { tags } = await readTiffHeader(url);
  const W = tags[TAG.width];
  const H = tags[TAG.height];
  if (W !== 65536 || H !== 65536 || tags[TAG.bits] !== 8 || tags[TAG.compression] !== 8 || tags[TAG.rowsPerStrip] !== 1)
    throw new Error(`${qk}: unexpected layout ${W}×${H} bits=${tags[TAG.bits]} comp=${tags[TAG.compression]} rps=${tags[TAG.rowsPerStrip]}`);
  const offs = tags[TAG.stripOffsets];
  const lens = tags[TAG.stripByteCounts];
  const predictor = tags[TAG.predictor] ?? 1;
  const first = offs[0];
  const last = offs[H - 1] + lens[H - 1] - 1;
  process.stdout.write(`  ${qk}: downloading ${((last - first + 1) / 1e6).toFixed(1)} MB… `);
  const body = await fetchRange(url, first, last);
  process.stdout.write("decoding… ");

  const OW = W / BLOCK; // 2048 output px across this source tile
  const out = Buffer.alloc(OW * OW * 4);
  const hist = new Uint32Array(OW * 256);
  const valid = new Uint32Array(OW);
  const tall = new Uint32Array(OW);
  let stats = { px: 0, sum: 0, max: 0, v255: 0 };
  for (let row = 0; row < H; row++) {
    const s = body.subarray(offs[row] - first, offs[row] - first + lens[row]);
    const px = decodeStrip(s, W, 1, predictor);
    for (let x = 0; x < W; x++) {
      const v = px[x];
      if (v === 255) {
        stats.v255++;
        continue; // treated as no data
      }
      const ox = (x / BLOCK) | 0;
      hist[ox * 256 + v]++;
      valid[ox]++;
      if (v > COVER_M) tall[ox]++;
    }
    if ((row + 1) % BLOCK === 0) {
      const oy = (row + 1) / BLOCK - 1;
      for (let ox = 0; ox < OW; ox++) {
        const o = (oy * OW + ox) * 4;
        const n = valid[ox];
        if (n > 0) {
          const target = Math.ceil(n * 0.9);
          let acc = 0;
          let p90 = 0;
          for (let b = 0; b < 255; b++) {
            acc += hist[ox * 256 + b];
            if (acc >= target) {
              p90 = b;
              break;
            }
          }
          out[o] = Math.min(254, p90);
          out[o + 1] = Math.round((100 * tall[ox]) / n);
          out[o + 3] = 255;
          stats.px++;
          stats.sum += p90;
          stats.max = Math.max(stats.max, p90);
        }
      }
      hist.fill(0);
      valid.fill(0);
      tall.fill(0);
    }
  }

  // split 2048² into 8×8 XYZ tiles at OUT_Z
  const k = 2 ** (OUT_Z - SRC_Z);
  const written = [];
  for (let ty = 0; ty < k; ty++)
    for (let tx = 0; tx < k; tx++) {
      const tile = Buffer.alloc(256 * 256 * 4);
      for (let y = 0; y < 256; y++) out.copy(tile, y * 256 * 4, ((ty * 256 + y) * OW + tx * 256) * 4, ((ty * 256 + y) * OW + tx * 256 + 256) * 4);
      const X = sx * k + tx;
      const Y = sy * k + ty;
      mkdirSync(join(OUT, String(OUT_Z), String(X)), { recursive: true });
      writeFileSync(join(OUT, String(OUT_Z), String(X), `${Y}.png`), png(256, 256, tile));
      written.push(`${X}/${Y}`);
    }
  console.log(`ok · mean p90 ${(stats.sum / Math.max(1, stats.px)).toFixed(1)} m · max ${stats.max} m · nodata px ${stats.v255}`);
  return { quadkey: qk, tiles: written, meanP90: +(stats.sum / Math.max(1, stats.px)).toFixed(2), maxP90: stats.max };
}

const points = [];
const wp = JSON.parse(readFileSync("public/watchpoints.json", "utf8")).watchpoints;
for (const w of wp) points.push({ id: w.id, lat: w.lat, lon: w.lon });
for (const a of process.argv.slice(2).filter((s) => /^-?\d/.test(s))) {
  const [lat, lon] = a.split(",").map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ id: `pt_${lat}_${lon}`, lat, lon });
}

const indexPath = join(OUT, "index.json");
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : { sources: {} };
const done = new Set(Object.keys(index.sources ?? {}));
console.log(`canopy tiles for ${points.length} points → ${OUT}/${OUT_Z}/x/y.png`);
for (const p of points) {
  const [sx, sy] = tileXY(p.lon, p.lat, SRC_Z);
  const qk = quadkey(sx, sy, SRC_Z);
  if (done.has(qk)) {
    console.log(`  ${qk}: already built (${p.id})`);
    continue;
  }
  try {
    const r = await buildSourceTile(qk, sx, sy);
    index.sources[qk] = { ...r, point: p.id };
    done.add(qk);
  } catch (e) {
    console.log(`  ${qk}: FAILED ${e.message}`);
  }
}
Object.assign(index, {
  dataset: "Meta & WRI High Resolution Canopy Height Maps v1 (alsgedi_global_v6_float)",
  citation: "Tolan et al. 2024, Remote Sensing of Environment 300:113888",
  license: "CC BY 4.0",
  sensor: "model output: canopy height predicted from Maxar imagery, calibrated with airborne LiDAR and GEDI spaceborne LiDAR (not a raw point cloud)",
  heightReference: "height above ground (m); relative product, no vertical datum",
  sourceResolutionM: 1.19,
  zoom: OUT_Z,
  blockPx: BLOCK,
  encoding: { R: "p90 canopy height m (0–254)", G: "canopy cover % of 1.19 m pixels > 2 m", A: "255 = data, 0 = none" },
  generated: new Date().toISOString().slice(0, 10),
  tiles: Object.values(index.sources).flatMap((s) => s.tiles),
});
writeFileSync(indexPath, JSON.stringify(index, null, 1));
console.log(`index: ${index.tiles.length} tiles`);
