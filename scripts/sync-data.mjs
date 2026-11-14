// Copy the 4 real data files into public/data. Usage: npm run data:sync [-- <source dir>]
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
const src = process.argv[2] ?? process.env.FC_DATA_SRC ?? "C:/Users/Ploychomphoo/Downloads/nsa/firecalendar-bucket/firecalendar-bucket";
const files = ["manifest.json", "calendar_region.json", "cell_index.parquet", "cell_month.parquet"];
mkdirSync("public/data", { recursive: true });
for (const f of files) {
  const from = join(src, f);
  if (!existsSync(from)) { console.error(`missing ${from}`); process.exit(1); }
  copyFileSync(from, join("public/data", f));
  console.log(`${f}  ${(statSync(from).size / 1e6).toFixed(2)} MB`);
}
