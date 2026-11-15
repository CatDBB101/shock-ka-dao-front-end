# คู่มือรันและเอาขึ้นเว็บจริง

**สรุปสั้น:** เว็บนี้เป็น static site ล้วน **ไม่ต้องรันเซิร์ฟเวอร์หรือ backend ตัวไหนเพิ่ม**
ตอนพัฒนาใช้ `npm run dev` คำสั่งเดียวพอ ตอนขึ้นเว็บจริงใช้ `npm run build` แล้วเอาโฟลเดอร์ `dist/` ไปวางบนโฮสต์ static ที่ไหนก็ได้
ทุกอย่างที่เหลือ (ข้อมูลปฏิทิน ตัวคำนวณ DuckDB ตัวจำลองไฟ) ทำงานในเบราว์เซอร์ของผู้ใช้

## 1. รันบนเครื่องตัวเอง (ครั้งแรก)

ต้องมี Node.js 20 ขึ้นไป

```bash
cd shock-ka-dao-front-end-main
npm install
npm run dev
```

เปิด http://localhost:5173 จบแค่นี้ ข้อมูลจริงอยู่ใน `public/data/` และ `public/canopy/` ใน repo แล้ว ไม่ต้องดาวน์โหลดเพิ่ม

ถ้าอยากให้หน้าจุดเฝ้าระวังและพยากรณ์ไฟลามดึงจุดความร้อนจริงจาก NASA ให้สร้างไฟล์ `.env.local` (ไฟล์นี้ git ไม่เก็บ):

```
VITE_FIRMS_MAP_KEY=<MAP KEY จาก https://firms.modaps.eosdis.nasa.gov/api/map_key>
```

แล้วหยุด `npm run dev` (Ctrl+C) และรันใหม่ Vite อ่านไฟล์ env ตอนเริ่มเท่านั้น

## 2. เอาขึ้นเว็บจริง

```bash
npm run build      # ได้โฟลเดอร์ dist/ (ตรวจ type ให้ด้วย)
npm run preview    # ลองเปิด dist/ บนเครื่องก่อน ที่ http://localhost:4173
```

อัปโหลด **ทั้งโฟลเดอร์ `dist/`** ขึ้นโฮสต์ static เช่น Vercel, Netlify, Cloudflare Pages, GitHub Pages หรือ S3

ตั้งค่าบนโฮสต์ 2 อย่าง:

| ตั้งค่า | ทำไม |
| --- | --- |
| ให้ทุก path ที่ไม่ใช่ไฟล์ส่งกลับ `index.html` (SPA fallback) | เว็บใช้ React Router เช่น `/watch` `/simulator` ถ้าไม่ตั้ง กดรีเฟรชแล้วจะ 404 |
| โฮสต์ต้องรองรับ HTTP Range | DuckDB อ่านไฟล์ `.parquet` ทีละส่วน (Vercel, Netlify, Cloudflare Pages, S3 รองรับอยู่แล้ว) |

ตัวอย่าง SPA fallback: Netlify ใส่ไฟล์ `public/_redirects` บรรทัด `/*  /index.html  200` ส่วน Vercel ใส่ `vercel.json` ว่า `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`

### ตัวแปร env ตอน build

ค่าที่ขึ้นต้นด้วย `VITE_` ถูกฝังลงไฟล์ JavaScript ตอน `npm run build` ตั้งบนแผงของโฮสต์หรือใน `.env.local` ก่อน build

| ตัวแปร | จำเป็นไหม | ใช้ทำอะไร |
| --- | --- | --- |
| `VITE_FIRMS_MAP_KEY` | ไม่จำเป็น | จุดความร้อนจริงจาก NASA FIRMS ถ้าไม่ตั้ง หน้าจุดเฝ้าระวังแสดงแค่ระดับตามฤดูไฟ |
| `VITE_FC_BACKEND_API` | ไม่จำเป็น | backend จุดเฝ้าระวัง (`GET {ค่านี้}/watchpoint`) ถ้าไม่ตั้งใช้ไฟล์ตัวอย่าง `public/watchpoints.json` |
| `VITE_FC_ALERTS_API` | ไม่จำเป็น | ระบบส่งอีเมลแจ้งเตือน ถ้าไม่ตั้งเป็นโหมดเดโม (บันทึกในเบราว์เซอร์ ไม่ส่งอีเมล) |
| `VITE_FC_DATA_MODE` / `VITE_FC_BASE` | มีค่าตั้งต้นใน `.env` แล้ว | อ่านข้อมูลจาก `public/data` ไม่ต้องแก้ |

**ระวัง:** ค่าที่ฝังลง JavaScript ใครเปิดเว็บก็ดูได้ รวมถึง FIRMS MAP KEY ถ้าจะ build เพื่อ commit `dist/` ลง git ให้ build แบบไม่มี key:

```bash
VITE_FIRMS_MAP_KEY= npm run build
```

แล้วค่อยตั้ง key บนแผงของโฮสต์ตอน deploy (หรือย้ายการเรียก FIRMS ไปไว้หลัง backend)

## 3. บริการภายนอกที่เบราว์เซอร์เรียกเอง (ไม่ต้องรัน)

| บริการ | ใช้ในหน้า | ต้องมี key |
| --- | --- | --- |
| NASA FIRMS | จุดเฝ้าระวัง, พยากรณ์ไฟลาม, ดาวน์โหลดจุดไฟดิบ | ต้อง (`VITE_FIRMS_MAP_KEY`) |
| Open-Meteo | พยากรณ์ไฟลาม, Simulator (โหมดพยากรณ์จริง) | ไม่ต้อง (ใช้ฟรีแบบไม่เชิงพาณิชย์) |
| AWS Terrain Tiles | ความชัน, ภูมิประเทศ 3 มิติ | ไม่ต้อง |
| Esri World Imagery, OpenFreeMap | ภาพดาวเทียมและแผนที่พื้นหลัง | ไม่ต้อง |
| OpenStreetMap Nominatim | ช่องค้นหาสถานที่ | ไม่ต้อง |

## 4. ส่วนเสริมที่รันก็ต่อเมื่อต้องการ

ไม่จำเป็นต่อการเปิดเว็บ รันครั้งเดียวเมื่ออยากอัปเดตข้อมูล

| คำสั่ง | ทำอะไร | เมื่อไร |
| --- | --- | --- |
| `npm run data:sync` | ดาวน์โหลดไฟล์ข้อมูลปฏิทินชุดล่าสุดจาก Hugging Face ลง `public/data` | backend ออกข้อมูลรุ่นใหม่ |
| `npm run canopy:build` | สร้าง tile ความสูงเรือนยอดรอบจุดเฝ้าระวังลง `public/canopy` (ดาวน์โหลดหลาย GB ใช้เวลาราว 35 นาที) | เพิ่มจุดเฝ้าระวังใหม่ |
| `node scripts/canopy/build-canopy.mjs ละติจูด,ลองจิจูด` | เพิ่ม tile เรือนยอดเฉพาะพื้นที่ที่ระบุ | อยากได้ไฟเรือนยอดในพื้นที่อื่น |
| `npm test` / `npm run typecheck` / `npm run lint` | ตรวจโค้ด | ก่อน commit |

backend (FastAPI โหมด `api`, Node API จุดเฝ้าระวัง, ระบบแจ้งเตือน) เป็นของอีกทีม ถ้ายังไม่พร้อม เว็บใช้ไฟล์ static แทนได้ทั้งหมด

## 5. แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
| --- | --- |
| หน้าจุดเฝ้าระวังขึ้นว่ายังไม่ได้ตั้ง `VITE_FIRMS_MAP_KEY` ทั้งที่ใส่แล้ว | ยังไม่ได้รัน `npm run dev` ใหม่หลังแก้ `.env.local` |
| รีเฟรชหน้า `/watch` บนเว็บจริงแล้ว 404 | ยังไม่ได้ตั้ง SPA fallback บนโฮสต์ |
| หน้าสำรวจพื้นที่ค้าง หรือ DuckDB error | โฮสต์ไม่รองรับ HTTP Range หรือไม่ได้อัปโหลด `dist/data/` ไปด้วย |
| หน้าโหลดตอนเข้าเว็บไม่ขึ้นอีก | ตั้งใจให้ขึ้นครั้งเดียวต่อการเปิดเบราว์เซอร์ ปิดแท็บแล้วเปิดใหม่จะเห็นอีกครั้ง |
| Simulator ไม่มีต้นไม้ 3 มิติ | พื้นที่นั้นยังไม่มี tile เรือนยอด ดูข้อ 4 |
