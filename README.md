# FireCalendar+ frontend

ปฏิทินไฟป่ารายเดือน 2001–2024 ที่ต่อเนื่องเป็นเส้นเดียว (NASA Space Apps 2026, MODIS/VIIRS Harmonization)
เว็บอ่านข้อมูลที่ backend คำนวณไว้แล้วเท่านั้น ไม่รันโมเดลในเบราว์เซอร์

## เริ่มใช้

```bash
npm install
npm run data:sync        # ดาวน์โหลด 4 ไฟล์ข้อมูลจริง (42 MB) จาก HF bucket Ploychomphoo/firecalendar-data เข้า public/data
                         # หรือ: node scripts/sync-data.mjs <โฟลเดอร์ที่มี manifest.json, calendar_region.json, cell_*.parquet>
npm run dev              # http://localhost:5173
```

| คำสั่ง | ทำอะไร |
| --- | --- |
| `npm run dev` / `npm run build` / `npm run preview` | Vite |
| `npm run typecheck` | `tsc -b` (strict) |
| `npm test` | vitest (59 test รวมตัวเลขจากข้อมูลจริงและฟิสิกส์ของไฟ) |
| `npm run lint` | oxlint |

## หน้าเว็บ

| Route | หน้า |
| --- | --- |
| `/` | Home: ปฏิทินตัวอย่าง 4 ภูมิภาค, กราฟรอยต่อปี 2012 ก่อน/หลังปรับเทียบ, ตัวเลขยืนยัน |
| `/explore?hex=lat,lon,radiusKm` | แผนที่จริง (OpenStreetMap / ภาพดาวเทียม Esri) ค้นหาสถานที่ (Nominatim) แล้ว **กดค้างลากเป็นหกเหลี่ยม** เลือกช่อง H3 ที่จุดกึ่งกลางอยู่ในหกเหลี่ยม แล้วแสดงปฏิทิน แผงรายละเอียด เดือนวิกฤต ดาวน์โหลด |
| `/explore?bbox=minLat,minLon,maxLat,maxLon&start=YYYY-MM&end=YYYY-MM` | แบบกรอบสี่เหลี่ยม (ช่องกรอกพิกัด / พื้นที่ตัวอย่าง) |
| `/spread` | จำลองการลามของไฟจากฟิสิกส์ (Rothermel + ลม/ความชัน/ความชื้นเชื้อเพลิง) พยากรณ์ 6–72 ชม. ด้วย Open-Meteo แสดงความน่าจะเป็นจาก ensemble (ADR-017) |
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

### สามโหมด (สลับที่ปุ่มมุมขวาบน)

| บทบาท | หน้า | ใช้ทำอะไร |
| --- | --- | --- |
| Scientist | `/`, `/explore`, `/data` | ข้อมูลย้อนหลัง 2001–2024 วิเคราะห์ ดาวน์โหลด |
| Firefighter | `/watch`, `/spread` | จุดเฝ้าระวัง จุดความร้อนล่าสุด การแจ้งเตือน พยากรณ์ไฟลาม 72 ชม. |
| Simulator | `/simulator` | จำลองสถานการณ์ไฟบนภูมิประเทศ 3 มิติ (MapLibre terrain + ภาพดาวเทียม) ปรับลม/อุณหภูมิ/ความชื้น/เชื้อเพลิง วาดแนวกันไฟ เล่นย้อนดูเป็นภาพเคลื่อนไหว |
| ใช้ร่วมกัน | `/evidence`, `/about` | ความน่าเชื่อถือของตัวเลข ข้อมูลโปรเจกต์ |

เปิดหน้าของบทบาทไหนก็สลับเป็นบทบาทนั้นอัตโนมัติ (`MODE_ROUTES` ใน `src/lib/mode/mode.ts`)

### Backend จุดเฝ้าระวัง

ตั้ง `VITE_FC_BACKEND_API=http://localhost:3000/api` แล้วหน้าจุดเฝ้าระวังจะอ่าน `GET /api/watchpoint`
(`{ success: true, data: [{ name, country, region, lat, lon }] }`) แทนไฟล์ตัวอย่าง `public/watchpoints.json`

- backend ไม่ส่ง id และรัศมี: id สร้างจากพิกัด (`wp_<lat>_<lon>` ทศนิยม 4 ตำแหน่ง) รัศมีใช้ `VITE_FC_WATCH_RADIUS_KM` (ค่าเริ่ม 25 กม.)
- ระดับตามฤดูไฟใช้เฉพาะ 6 ประเทศที่ปฏิทินครอบคลุม จุดอื่น (เช่น ซูดานใต้) ใช้จุดความร้อนอย่างเดียว เพราะฤดูไฟคนละช่วงกับแองโกลา
- backend ต้องเปิด CORS ให้โดเมนของเว็บ
- ถ้าตั้ง `VITE_FC_ALERTS_API` ด้วย ระบบแจ้งเตือนต้องใช้ id แบบเดียวกันในการสมัครรับแจ้งเตือน

### ข้อมูลความสูงเรือนยอด (สำหรับไฟเรือนยอดและต้นไม้ 3 มิติ)

`npm run canopy:build` สร้าง tile ความสูงเรือนยอดจาก Meta/WRI Canopy Height Maps (สอบเทียบด้วย LiDAR, CC BY 4.0) ลง `public/canopy/`
รอบจุดเฝ้าระวังทุกจุด เพิ่มพื้นที่อื่น: `node scripts/canopy/build-canopy.mjs -12.4,17.5` (ดาวน์โหลด ~21 MB ต่อ tile 78 กม.) รายละเอียดใน ADR-017

ดู `.env.example` สำหรับตัวแปรทั้งหมด ไฟล์ข้อมูลใน `public/data/` ไม่อยู่ใน git (42 MB) ตอน deploy ต้องคัดลอกไปด้วย
หรือตั้ง `VITE_FC_BASE` เป็นลิงก์ HF bucket (ใช้ได้แต่ AOI ครั้งแรกช้ากว่ามาก ดู ADR-015)

โฮสต์ที่ใช้ต้องตอบ HTTP Range ถูกต้อง (Vercel, Netlify, Cloudflare Pages, S3 ใช้ได้) ตอน dev/preview มี plugin ใน `vite.config.ts` ทำหน้าที่นี้ให้

## เอกสาร

- `docs/RUNNING.md` **คู่มือรันและเอาขึ้นเว็บจริง**: ต้องรันอะไรบ้าง (สรุป: `npm run dev` คำสั่งเดียว) ตั้ง env อย่างไร
- `docs/adr/ADR-017-fire-spread-simulator.md` สถาปัตยกรรมตัวจำลองไฟลาม, API backend ที่จะเพิ่ม, ลำดับปรับปรุง
- `docs/adr/ADR-015-data-access-path.md` เหตุผลที่เลือกทาง A และผลทดสอบ
- `docs/REPO_NOTES.md` stack จริง โครงโฟลเดอร์ สิ่งที่ต่างจาก kit
- `docs/UI_HANDOFF.md` **สำหรับคนปรับ UX/UI**: หน้าไหนอยู่ไฟล์ไหน, design token, วิธีใช้ Tailwind, สิ่งที่ห้ามแตะ
