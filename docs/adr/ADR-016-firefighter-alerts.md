# ADR-016: โหมด Scientist / Firefighter และระบบแจ้งเตือนจุดเฝ้าระวัง

**Status:** Accepted (ฝั่งเว็บเสร็จแล้ว · ฝั่ง backend ส่งอีเมลยังไม่ได้ทำ)
**Date:** 2026-11-14

## Context

เว็บมีผู้ใช้ 2 กลุ่มที่ต้องการต่างกัน:

- **Scientist** ต้องการดูข้อมูลย้อนหลังของ MODIS และ VIIRS ทั้งหมด ดูแบบ Harmonized เลือกพื้นที่และช่วงเวลาเอง แล้วดาวน์โหลด CSV
- **Firefighter** ต้องการเฝ้าระวังจุดที่ตัวเองรับผิดชอบ กดติดตาม "จุดเฝ้าระวัง" ที่ผู้ดูแลระบบกำหนดไว้ล่วงหน้า และได้รับอีเมลเมื่อเกิดเหตุหรือเข้าช่วงเสี่ยง

เว็บเป็น static (ADR-015) ไม่มีเซิร์ฟเวอร์ แต่การส่งอีเมลต้องมีโปรแกรมที่ทำงานอยู่ตลอดเวลา

## Decision

1. **สวิตช์โหมด** อยู่ที่ header (`role="switch"`) จำค่าไว้ใน localStorage (`fc.mode.v1`) และรับ `?mode=` ได้
   - Scientist: หน้าแรก · สำรวจพื้นที่ · หลักฐาน · ข้อมูล · เกี่ยวกับ
   - Firefighter: จุดเฝ้าระวัง (`/watch`) · หลักฐาน · เกี่ยวกับ
   - เปิด `/watch` จะเปลี่ยนเป็น Firefighter เอง เปิด `/explore` หรือ `/data` จะเปลี่ยนเป็น Scientist เอง
2. **Scientist** (`/explore`): ปุ่มเลือกชุดข้อมูล Harmonized / MODIS ดิบ / VIIRS วัดจริง (`?series=`) และปุ่มดาวน์โหลดปฏิทินของพื้นที่ในช่วงที่เลือก ที่มีทั้ง 3 ชุดในไฟล์เดียว นอกเหนือจากปุ่มดาวน์โหลดจุดไฟดิบ FIRMS ที่มีอยู่แล้ว
3. **Firefighter** (`/watch`): ระดับของแต่ละจุดมาจากสัญญาณ 2 ตัวที่อธิบายได้ (`src/lib/watch/risk.ts`)
   - `active`: VIIRS NRT (NOAA-20 + NOAA-21) พบจุดความร้อนในรัศมีภายใน 48 ชม. ไม่นับจุด confidence `l`
   - `high` / `elevated` / `normal`: เดือนปัจจุบันเทียบกับฤดูไฟของภูมิภาค (`season` ใน `calendar_region.json`)
   - ห้ามเรียกว่า "ความน่าจะเป็นเกิดไฟ" (ตามข้อตัดสินใจที่ 6 จากงานวิจัย)
4. **ชั้นแจ้งเตือน** แยกเป็น interface `AlertService` (`src/lib/watch/alerts.ts`) มี 2 แบบ:
   - `LocalAlertService` (ค่าเริ่มต้น ใช้ตอนไม่ได้ตั้ง `VITE_FC_ALERTS_API`): อ่านจุดจาก `public/watchpoints.json` เก็บการติดตามใน localStorage **ไม่ส่งอีเมล** หน้าเว็บมีป้าย "โหมดเดโม" บอกไว้
   - `HttpAlertService`: เรียก backend ตามสัญญาด้านล่าง

## สัญญา API ของ backend แจ้งเตือน (ยังไม่ได้สร้าง)

ทุกคำตอบเป็น JSON ถ้าผิดพลาดให้ตอบ `{ "detail": "..." }` แบบเดียวกับ FireCalendar API

| Method | Path | Body / Query | ตอบกลับ |
| --- | --- | --- | --- |
| GET | `/v1/watchpoints` | – | `{ version, updated, watchpoints: Watchpoint[] }` (รูปแบบเดียวกับ `public/watchpoints.json`) |
| GET | `/v1/subscriptions` | `?email=` | `[{ watchpoint_id, email, created_at, confirmed }]` |
| POST | `/v1/subscriptions` | `{ email, watchpoint_id }` | `201` subscription · ส่งอีเมลยืนยัน (double opt-in) `confirmed=false` จนกว่าจะกดลิงก์ |
| DELETE | `/v1/subscriptions/{watchpoint_id}` | `?email=` | `204` |
| GET | `/v1/confirm` · `/v1/unsubscribe` | `?token=` | หน้า HTML สั้นๆ (ลิงก์ในอีเมล) |

ข้อกำหนดที่ backend ต้องมี:

- **Worker ตามเวลา** (เช่น cron ทุก 3 ชม.): สำหรับจุดที่มีผู้ติดตามที่ยืนยันแล้ว ดึง FIRMS NRT ด้วย `FIRMS_MAP_KEY` ฝั่งเซิร์ฟเวอร์ ใช้กฎเดียวกับ `risk.ts` แล้วส่งอีเมลเมื่อ **ระดับขึ้น** (เช่น `elevated → active`) ห้ามส่งซ้ำทุกรอบ ให้จำระดับล่าสุดของแต่ละจุดไว้
- อีเมลแจ้งเตือนต้องมี: ชื่อจุด, จำนวนจุดความร้อน, FRP สูงสุด, เวลา UTC, ลิงก์ `/watch` และลิงก์เลิกติดตามแบบกดครั้งเดียว
- ผู้ส่งอีเมล: บริการ transactional (Resend, Amazon SES, SendGrid ฯลฯ) ต้องตั้ง SPF/DKIM ของโดเมนผู้ส่ง
- จำกัดอัตรา POST ต่อ IP/อีเมล และตั้ง `CORS_ORIGINS` เป็นโดเมนเว็บจริง
- ผู้ดูแลระบบแก้จุดเฝ้าระวังผ่านไฟล์หรือฐานข้อมูลฝั่ง backend เท่านั้น นักผจญเพลิงติดตามได้อย่างเดียว เพิ่มจุดเองไม่ได้

## Consequences

- เดโมใช้ได้ทันทีโดยไม่ต้องมีเซิร์ฟเวอร์ แต่ **ยังไม่มีอีเมลจริง** จนกว่าจะสร้าง backend และตั้ง `VITE_FC_ALERTS_API`
- ตรวจจุดความร้อนล่าสุดบนหน้าเว็บต้องมี `VITE_FIRMS_MAP_KEY` (key อยู่ในเบราว์เซอร์ ADR-015) เว็บตรวจเฉพาะจุดที่ติดตามหรือจุดที่เลือก เพื่อไม่ให้ชน rate limit ของ FIRMS
- ระดับตามฤดูกาลใช้ฤดูไฟระดับภูมิภาค ไม่ใช่ระดับจุด หน้ารายละเอียดจึงแสดงกราฟไฟรายเดือนของจุดนั้นเอง (ค่ามัธยฐาน 2013–2024 จาก `cell_month.parquet`) ประกอบไว้ด้วย
