# ADR-015: เว็บดึงข้อมูล FireCalendar+ ทางไหนสำหรับเดโม Space Apps

**Status:** Accepted (แก้ไขรายละเอียดหลังทดสอบในเบราว์เซอร์ ดูหัวข้อ "อัปเดต" ท้ายไฟล์)
**Date:** 2026-11-14
**Deciders:** Ploy (backend/ML), ทีม frontend

## Context

เว็บ FireCalendar+ อ่านข้อมูลที่คำนวณไว้แล้ว 4 ไฟล์ (`manifest.json`, `calendar_region.json`, `cell_index.parquet`, `cell_month.parquet` ~42 MB) โค้ด starter รองรับ 3 โหมดผ่าน `VITE_FC_DATA_MODE` คือ `mock` / `static` / `api` คำถามคือเดโมควรใช้โหมดไหน และ `static` ควรอ่านไฟล์จากที่ไหน

ผลทดสอบจริงวันนี้ (14 พ.ย. 2026):

| สิ่งที่ทดสอบ | ผล |
| --- | --- |
| HF bucket `Ploychomphoo/firecalendar-data` | มีครบ 4 ไฟล์ ขนาดตรงกับไฟล์ในเครื่อง |
| CORS + HTTP Range ของ bucket | ผ่าน: 302 ไป CDN มี `access-control-allow-origin` ทั้งสองขั้น · CDN ตอบ `206 Partial Content` |
| SQL AOI ของ `03-api-reference` ยิงตรงไปที่ bucket (DuckDB 1.x + httpfs) | โรซาริโอ ส.ค. 2022 = `observed, value 6593, modis 1310, clim_median 299, pct 91.67, 282 ช่อง` **ตรงทุกหลัก** ใช้ 4.6 วินาที |
| กรอบประเทศไทย 10–12°N 100–102°E | 0 ช่อง → ต้องเป็น `not_covered` |
| `calendar_region.json` | 1,152 แถว (288 × 4) · เดือนวิกฤต แอฟริกา 35 / อเมริกาใต้ 55 / แคนาดา+สหรัฐฯ 30 / ออสเตรเลีย 60 ตรงกับ Acceptance F2.1 |
| API Space `ploychomphoo-firecalendar-api.hf.space/health` | **404 ยังไม่ deploy** |
| `manifest.json` บน bucket | **เป็นรุ่นเก่า**: `files` ไม่มี `cell_index` และ `cell_month` ชี้ไป `cell_month/*.parquet` (ไฟล์จริงเป็นไฟล์เดียว) · ข้อจำกัดข้อ 4 ยังเขียน "land cover not yet included" |
| ซอร์สของ API ในเครื่อง (`firecalendar-api-space`) | เป็นรุ่นเก่ากว่าเอกสาร: อ่าน `data/cell_month/*.parquet` แบบแบ่งไฟล์ ไม่มี `cell_index` |
| `frontend-kit/src-starter`, `firecalendar-handoff-files/` | **ไม่มีในเครื่องนี้** |

ข้อจำกัดอื่น: เป็นงาน hackathon เวลาน้อย ไม่มีงบ HF PRO และ repo นี้เป็น Vite 8 + React 19 + TypeScript 7 (เอกสารเขียนไว้สำหรับ React 18)

## Decision

ใช้ **โหมด `static` (ทาง A) โดยตั้ง `VITE_FC_BASE` เป็นลิงก์ bucket** ทั้งตอน dev และตอน deploy ใช้ `mock` ระหว่างสร้าง UI ส่วน `api` เลื่อนไปเป็นเฟส 6 เมื่อ Space deploy แล้ว ไฟล์ข้อมูลไม่เก็บใน git

## Options Considered

### Option A1: `static` + HF bucket (เลือกข้อนี้)

| Dimension | Assessment |
| --- | --- |
| Complexity | ต่ำ: ไม่มีเซิร์ฟเวอร์ · ตั้งค่า env ตัวเดียว |
| Cost | ฟรี |
| Scalability | ดีสำหรับเดโม: CDN ของ HF รับโหลด · ผู้ใช้แต่ละคนคำนวณในเบราว์เซอร์ตัวเอง |
| Team familiarity | starter + SQL ทำไว้แล้ว ตรวจกับข้อมูลจริงแล้ว |

**Pros:** ทดสอบแล้วว่าใช้ได้จริงวันนี้ · repo ไม่ต้องแบก 41 MB · อัปเดตข้อมูลด้วยการอัปโหลดไฟล์ใหม่ขึ้น bucket ไม่ต้อง redeploy เว็บ
**Cons:** ครั้งแรกที่เลือกกรอบต้องโหลด DuckDB-WASM (~ไม่กี่ MB) และอ่าน parquet บางส่วน · ถ้าใช้ FIRMS key ฝั่งเบราว์เซอร์ key จะมองเห็นได้ · ขึ้นกับ URL ที่ redirect ไป CDN ของ HF (ยังไม่ได้ทดสอบในเบราว์เซอร์จริง ทดสอบแค่ DuckDB native)

### Option A2: `static` + `public/data/` (same-origin)

| Dimension | Assessment |
| --- | --- |
| Complexity | ต่ำที่สุด ไม่มีเรื่อง CORS เลย |
| Cost | ฟรี แต่ไฟล์ 41 MB ต้องไปกับทุก deploy |
| Scalability | ขึ้นกับโฮสต์เว็บ (Vercel/Netlify รองรับ Range) |
| Team familiarity | เหมือน A1 |

**Pros:** ไม่พึ่งบริการภายนอก ใช้แบบออฟไลน์ได้
**Cons:** ถ้าเก็บใน git จะทำให้ repo บวม ถ้าไม่เก็บต้องคัดลอกไฟล์ตอน deploy เอง · ข้อมูลเปลี่ยนเมื่อไรต้อง redeploy เว็บ
→ **เก็บไว้เป็นทางสำรอง** ถ้า A1 ติด CORS ในเบราว์เซอร์จริง

### Option B: `api` (FastAPI บน HF Space)

| Dimension | Assessment |
| --- | --- |
| Complexity | กลาง: ต้องดูแล Docker, secret, การหลับ/ตื่นของ Space |
| Cost | ต้องใช้ HF PRO หรือ Render/Fly ฯลฯ |
| Scalability | ดีกว่าสำหรับกรอบใหญ่ เพราะเซิร์ฟเวอร์คำนวณให้ |
| Team familiarity | โค้ดมีแล้วแต่ **ยังไม่ deploy** และซอร์สในเครื่องยังเป็นรุ่นเก่า |

**Pros:** ซ่อน FIRMS key ได้ · AOI ครั้งแรกเร็ว · ทีมอื่นเรียกใช้ได้ · รองรับ `/v1/ask` ในอนาคต
**Cons:** วันนี้ใช้ไม่ได้ (404) · Space ฟรีหลับ ครั้งแรกช้าหลายสิบวินาที ซึ่งเสี่ยงตอนกรรมการเปิดดู · ต้องอัปเดตซอร์สให้ตรงกับไฟล์ 4 ไฟล์ก่อน

## Trade-off Analysis

จุดชี้ขาดคือ **ความเสี่ยงตอนเดโม** กับ **สิ่งที่ใช้ได้จริงวันนี้** ทาง A1 ผ่านการทดสอบแบบ end-to-end กับข้อมูลจริงแล้ว ส่วนทาง B ยังไม่มีอะไรให้เชื่อม สิ่งที่ยอมเสียคือ AOI ครั้งแรกช้าลงและ FIRMS key มองเห็นได้ ซึ่งรับได้สำหรับเดโม เพราะใช้ key ฟรี และในโหมด static ถ้าไม่มี key ปุ่มดาวน์โหลดจะถูกซ่อนเอง

A1 กับ A2 ใช้โค้ดเดียวกัน ต่างกันแค่ค่า `VITE_FC_BASE` จึงสลับได้ภายในนาทีเดียวถ้า A1 มีปัญหาในเบราว์เซอร์ ความเสี่ยงที่เหลือจึงต่ำ

ประเด็นที่ต้องแก้ไม่ว่าจะเลือกทางไหน: `manifest.json` บน bucket ยังเป็นรุ่นเก่า และเอกสารสั่งให้ "อ่านชื่อไฟล์จาก `files` ห้าม hardcode" ถ้า starter ทำตามนั้นจริง จะหา `cell_index` ไม่เจอ และจะไปหา `cell_month/*.parquet` ซึ่งไม่มีบน bucket

## Consequences

- **ง่ายขึ้น:** ไม่มีเซิร์ฟเวอร์ให้ดูแล · ทั้งทีมใช้ BASE เดียวกัน · อัปเดตข้อมูลไม่ต้องแตะเว็บ
- **ยากขึ้น:** ต้องจัดการ loading ของ AOI ครั้งแรกให้ดี (skeleton + "ครั้งแรกอาจใช้เวลาสักครู่") · FIRMS key อยู่ใน bundle
- **ต้องกลับมาดู:** เมื่อ Space deploy แล้ว (เฟส 6) ให้สลับเป็น `api` แล้วตรวจว่าตัวเลขตรงกับ static · ถ้า HF เปลี่ยนนโยบาย CORS/redirect ของ bucket ให้ย้ายไป A2

## Action Items

**Backend (Ploy) — ต้องทำก่อน**
1. [ ] อัปโหลด `manifest.json` รุ่นแก้แล้ว (มี `files.cell_index`, `files.cell_month = "cell_month.parquet"`, ข้อจำกัดข้อ 4 ไม่มี "land cover not yet included") ขึ้น bucket
2. [ ] ส่ง `frontend-kit/` (src-starter, public/mocks, public/figures, docs, api/examples) เข้ามาใน repo นี้ เพราะเฟส 1 คัดลอกจากโฟลเดอร์นี้
3. [ ] (เฟส 6) อัปเดต `firecalendar-api-space` ให้อ่าน 4 ไฟล์ตามเอกสาร แล้ว deploy

**Frontend**
1. [ ] F0.1: เขียน `docs/REPO_NOTES.md` (Vite 8, React 19, TS 7, ยังไม่มี router)
2. [ ] F1.1: ติดตั้ง `@tanstack/react-query@5.59.0`, `@duckdb/duckdb-wasm@1.29.0` · **vitest 2.1.5 ผูกกับ Vite 5** ให้ลองก่อน ถ้าชนกับ Vite 8 ให้ใช้ vitest รุ่นที่รองรับ Vite 8 แล้วบันทึกไว้ใน README
3. [ ] ตั้ง `.env.local`: `VITE_FC_DATA_MODE=static`, `VITE_FC_BASE=https://huggingface.co/buckets/Ploychomphoo/firecalendar-data/resolve`
4. [ ] ทดสอบในเบราว์เซอร์จริง (Chrome + Safari มือถือ): DevTools ต้องไม่มี error CORS และโรซาริโอ 2022-08 = 6,593 / 282 ช่อง
5. [ ] ถ้าข้อ 4 ไม่ผ่าน: ย้ายไป A2 (`VITE_FC_BASE=/data` และเพิ่ม `public/data/` ใน `.gitignore`)

## อัปเดต 14 พ.ย. 2026 หลังทดสอบในเบราว์เซอร์จริง (Chrome, production build)

ผู้ใช้เลือกทาง A และให้ใช้ข้อมูลจริงจาก `Downloads/nsa` (ไฟล์เดียวกับบน bucket ทุกไบต์)

| ทดสอบ | `/data` (same-origin) | HF bucket |
| --- | --- | --- |
| AOI โรซาริโอครั้งแรก | ~3 วินาที | **เกิน 60 วินาที** (ทุก range request โดน 302 ไป CDN ก่อน) |
| โหลดซ้ำ (reload) | ผ่าน | – |

จึง **เปลี่ยนค่าเริ่มต้นเป็น A2: `VITE_FC_BASE=/data`** ทั้งตอน dev และ deploy (ตรงกับที่เอกสาร 03 แนะนำ) ส่วน bucket เหลือไว้เป็นทางเลือก

พบเพิ่ม: เซิร์ฟเวอร์ไฟล์ของ `vite dev/preview` ตอบ `Range: bytes=0-0` เป็นทั้งไฟล์ ทำให้ DuckDB โหลดเต็ม 41 MB แล้วพังหลัง reload
แก้ด้วย plugin `fc-data-range-server` ใน `vite.config.ts` (เฉพาะตอน dev/preview) โฮสต์จริงต้องรองรับ Range

ผลตรวจทั้งหมดผ่าน: ปฏิทิน 288 ช่อง × 4 ภูมิภาค · เดือนวิกฤต 35/55/30/60 · โรซาริโอ ส.ค. 2022 = 6,593 / 282 ช่อง / ค่าปกติ 299 / 92%
· พื้นที่ตัวอย่าง 669, 1,762, 1,366 ช่อง · กรอบไทย = "ยังไม่มีข้อมูล" · CSV 1,152 แถว + header · มือถือ 375 px ไม่เลื่อนแนวนอน · ไม่มี error ใน console
