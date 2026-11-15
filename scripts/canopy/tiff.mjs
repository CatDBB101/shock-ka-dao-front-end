// Minimal BigTIFF/TIFF reader over HTTP Range for the Meta/WRI canopy height tiles (8-bit, deflate,
// horizontal predictor, stripped). No dependencies: node:zlib only.
import { inflateSync } from "node:zlib";

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8, 17: 8, 18: 8 };

export async function fetchRange(url, start, end, tries = 4) {
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
      if (r.status !== 206 && r.status !== 200) throw new Error(`HTTP ${r.status} for ${url}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (k >= tries) throw e;
      await new Promise((res) => setTimeout(res, 1000 * 2 ** k));
    }
  }
}

/** Read the first IFD; values that live outside the header are fetched with extra range requests. */
export async function readTiffHeader(url) {
  const head = await fetchRange(url, 0, 1 << 20);
  const le = head.toString("latin1", 0, 2) === "II";
  const u16 = (b, o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (b, o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const u64 = (b, o) => Number(le ? b.readBigUInt64LE(o) : b.readBigUInt64BE(o));
  const big = u16(head, 2) === 43;
  const ifdOff = big ? u64(head, 8) : u32(head, 4);
  const cnt = big ? u64(head, ifdOff) : u16(head, ifdOff);
  const entry = big ? 20 : 12;
  const base = ifdOff + (big ? 8 : 2);
  const tags = {};
  for (let i = 0; i < cnt; i++) {
    const e = base + i * entry;
    const tag = u16(head, e);
    const type = u16(head, e + 2);
    const count = big ? u64(head, e + 4) : u32(head, e + 4);
    const nbytes = (TYPE_SIZE[type] ?? 1) * count;
    const inline = nbytes <= (big ? 8 : 4);
    const valOff = e + (big ? 12 : 8);
    const off = inline ? null : big ? u64(head, valOff) : u32(head, valOff);
    let buf;
    if (inline) buf = head.subarray(valOff, valOff + nbytes);
    else if (off + nbytes <= head.length) buf = head.subarray(off, off + nbytes);
    else buf = await fetchRange(url, off, off + nbytes - 1);
    tags[tag] = decode(buf, type, count, { u16, u32, u64 });
  }
  return { le, big, tags };
}

function decode(buf, type, count, r) {
  if (type === 2) return buf.toString("latin1").replace(/\0+$/, "");
  const out = [];
  const sz = TYPE_SIZE[type] ?? 1;
  for (let i = 0; i < count; i++) {
    const o = i * sz;
    if (type === 1 || type === 7) out.push(buf[o]);
    else if (type === 3) out.push(r.u16(buf, o));
    else if (type === 4) out.push(r.u32(buf, o));
    else if (type === 16) out.push(r.u64(buf, o));
    else if (type === 12) out.push(buf.readDoubleLE(o));
    else if (type === 11) out.push(buf.readFloatLE(o));
    else out.push(buf[o]);
  }
  return count === 1 ? out[0] : out;
}

export const TAG = {
  width: 256,
  height: 257,
  bits: 258,
  compression: 259,
  stripOffsets: 273,
  spp: 277,
  rowsPerStrip: 278,
  stripByteCounts: 279,
  predictor: 317,
  tileWidth: 322,
  sampleFormat: 339,
  pixelScale: 33550,
  tiepoint: 33922,
  geoKeys: 34735,
  gdalMetadata: 42112,
  gdalNodata: 42113,
};

/** Decode one deflate strip of 8-bit samples with horizontal differencing (predictor 2). */
export function decodeStrip(compressed, width, rows, predictor) {
  const px = inflateSync(compressed);
  if (predictor === 2)
    for (let r = 0; r < rows; r++) {
      const o = r * width;
      for (let x = 1; x < width; x++) px[o + x] = (px[o + x] + px[o + x - 1]) & 0xff;
    }
  return px;
}
