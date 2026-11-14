# FireCalendar+ frontend

ปฏิทินไฟป่ารายเดือน 2001–2024 ที่ต่อเนื่องเป็นเส้นเดียว (NASA Space Apps 2026, MODIS/VIIRS Harmonization)
เว็บอ่านข้อมูลที่ backend คำนวณไว้แล้วเท่านั้น ไม่รันโมเดลในเบราว์เซอร์

## เริ่มใช้

```bash
npm install
npm run data:sync        # คัดลอก 4 ไฟล์ข้อมูลจริงเข้า public/data (ค่าเริ่มต้นอ่านจาก Downloads/nsa/…)
                         # หรือ: npm run data:sync -- <โฟลเดอร์ที่มี manifest.json, calendar_region.json, cell_*.parquet>
npm run dev              # http://localhost:5173
```

| คำสั่ง | ทำอะไร |
| --- | --- |
| `npm run dev` / `npm run build` / `npm run preview` | Vite |
| `npm run typecheck` | `tsc -b` (strict) |
| `npm test` | vitest (20 test รวมตัวเลขจากข้อมูลจริง) |
| `npm run lint` | oxlint |

## หน้าเว็บ

| Route | หน้า |
| --- | --- |
| `/` | Home: ปฏิทินตัวอย่าง 4 ภูมิภาค, กราฟรอยต่อปี 2012 ก่อน/หลังปรับเทียบ, ตัวเลขยืนยัน |
| `/explore?hex=lat,lon,radiusKm` | แผนที่จริง (OpenStreetMap / ภาพดาวเทียม Esri) ค้นหาสถานที่ (Nominatim) แล้ว **กดค้างลากเป็นหกเหลี่ยม** เลือกช่อง H3 ที่จุดกึ่งกลางอยู่ในหกเหลี่ยม แล้วแสดงปฏิทิน แผงรายละเอียด เดือนวิกฤต ดาวน์โหลด |
| `/explore?bbox=minLat,minLon,maxLat,maxLon&start=YYYY-MM&end=YYYY-MM` | แบบกรอบสี่เหลี่ยม (ช่องกรอกพิกัด / พื้นที่ตัวอย่าง) |
| `/evidence` | วิธีแปลง, คะแนน, continuity 4 ภูมิภาค, ข้อจำกัดจาก manifest, กราฟ |
| `/data` | ลิงก์ไฟล์, CSV ปฏิทิน 1,152 แถว, จุดไฟดิบ FIRMS |
| `/about` | ทีม แหล่งข้อมูล การใช้ AI |
| `/guide`, `/prototype` | React port ของ `reference/earth-pulse-guide.html` และ `reference/modis-viirs-explorer.html` (ข้อมูลจำลอง) |
| `/ask` | ซ่อนไว้จนกว่า `POST /v1/ask` จะมี (`VITE_FC_FEATURE_ASK=true`) |

## การดึงข้อมูล (ADR-015: ทาง A)

UI เรียกแค่ hook ใน `src/lib/firecalendar/hooks.ts` (`useMeta`, `useRegionCalendar`, `useAoiCalendar`) สลับแหล่งข้อมูลด้วย env ตัวเดียว:

| `VITE_FC_DATA_MODE` | แหล่ง | หมายเหตุ |
| --- | --- | --- |
| `static` (ค่าเริ่มต้น) | ไฟล์ที่ `VITE_FC_BASE` (`/data`) + DuckDB-WASM | ข้อมูลจริง ไม่ต้องมีเซิร์ฟเวอร์ |
| `api` | FastAPI ที่ `VITE_FIRECALENDAR_API` (5 endpoint) | ใช้เมื่อ Space deploy แล้ว (เฟส 6) |
| `mock` | `public/mocks/*` | ตัดมาจากข้อมูลจริง AOI ตอบเป็นโรซาริโอเสมอ |

โหมด api: API รับแค่กรอบสี่เหลี่ยม หกเหลี่ยมจึงถูกประมาณด้วยกรอบที่ครอบไว้ (มีหมายเหตุบอกบนหน้าเว็บ)

ดู `.env.example` สำหรับตัวแปรทั้งหมด ไฟล์ข้อมูลใน `public/data/` ไม่อยู่ใน git (42 MB) ตอน deploy ต้องคัดลอกไปด้วย
หรือตั้ง `VITE_FC_BASE` เป็นลิงก์ HF bucket (ใช้ได้แต่ AOI ครั้งแรกช้ากว่ามาก ดู ADR-015)

โฮสต์ที่ใช้ต้องตอบ HTTP Range ถูกต้อง (Vercel, Netlify, Cloudflare Pages, S3 ใช้ได้) ตอน dev/preview มี plugin ใน `vite.config.ts` ทำหน้าที่นี้ให้

## เอกสาร

- `docs/adr/ADR-015-data-access-path.md` เหตุผลที่เลือกทาง A และผลทดสอบ
- `docs/REPO_NOTES.md` stack จริง โครงโฟลเดอร์ สิ่งที่ต่างจาก kit
