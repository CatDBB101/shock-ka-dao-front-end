// Put the 4 real data files into public/data.
//   npm run data:sync                  → download from the public Hugging Face bucket (no hf CLI needed)
//   node scripts/sync-data.mjs <local dir> → copy from a local folder (e.g. after `hf sync hf://buckets/… ./local`)
// FC_DATA_SRC can also be set to a local folder or another bucket URL.
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BUCKET = "https://huggingface.co/buckets/Ploychomphoo/firecalendar-data/resolve";
const src = process.argv[2] ?? process.env.FC_DATA_SRC ?? BUCKET;
const files = ["manifest.json", "calendar_region.json", "cell_index.parquet", "cell_month.parquet"];
const mb = (n) => `${(n / 1e6).toFixed(2)} MB`;

mkdirSync("public/data", { recursive: true });

if (/^https?:\/\//.test(src)) {
  console.log(`downloading from ${src}`);
  for (const f of files) {
    const res = await fetch(`${src}/${f}`);
    if (!res.ok) {
      console.error(`${f}: HTTP ${res.status}`);
      process.exit(1);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(join("public/data", f), buf);
    console.log(`${f}  ${mb(buf.length)}`);
  }
} else {
  for (const f of files) {
    const from = join(src, f);
    if (!existsSync(from)) {
      console.error(`missing ${from}`);
      process.exit(1);
    }
    copyFileSync(from, join("public/data", f));
    console.log(`${f}  ${mb(statSync(from).size)}`);
  }
}
