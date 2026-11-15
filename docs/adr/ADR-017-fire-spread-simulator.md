# ADR-017: Physics-based fire spread simulation (`/spread`)

- สถานะ: ยอมรับ (เฟสแรกอยู่ในเบราว์เซอร์)
- วันที่: 2026-11-15
- งานวิจัยประกอบ: `docs/research/แบบจำลองการลามไฟป่า ฟิสิกส์และ ML.md` (บันทึกค้นคว้าอยู่ใน `docs/research/notes/`)

## บริบท

ทีมต้องการคำนวณทิศทางการลามของไฟป่าและพยากรณ์ล่วงหน้าจากปัจจัยและฟิสิกส์ของไฟจริง ผลสำรวจเครื่องมือ (FARSITE/FlamMap, ELMFIRE, WISE/Prometheus, Spark, ForeFire, Cell2Fire, WRF-SFIRE, QUIC-Fire, WFDS และโมเดล ML บน NDWS/WildfireSpreadTS) สรุปว่า

- ไม่มีตัวไหนแม่นกว่ากันชัดเจนเมื่อเทียบกับไฟจริง (AFAC 2024: 4 ตัวจำลอง 10 ไฟ; Maui 2023: FARSITE F1 0.488 กับ ConvLSTM 0.485)
- ความแม่นขึ้นกับข้อมูลนำเข้ามากที่สุด คือแผนที่เชื้อเพลิงและทิศลมพยากรณ์ จึงควรแสดงเป็นความน่าจะเป็นจากการจำลองหลายชุด (ensemble)
- แบบจำลองที่ต่อกับบรรยากาศ (WRF-SFIRE ฯลฯ) ต้องใช้ HPC ส่วน Rothermel + minimum travel time รันในเบราว์เซอร์ได้

## การตัดสินใจ

เฟสแรกรันทั้งหมดฝั่งเบราว์เซอร์ ไม่ต้องมีเซิร์ฟเวอร์

| ชั้น | ไฟล์ | หน้าที่ |
| --- | --- | --- |
| ฟิสิกส์ | `src/lib/spread/rothermel.ts` | Rothermel 1972 / Albini 1976 (Anderson 13), ลม + ความชัน แบบเวกเตอร์, วงรี Anderson 1983, จำกัด R ≤ U (Andrews et al. 2013), Byram intensity, ความยาวเปลวไฟ |
| ความชื้น | `src/lib/spread/moisture.ts` | EMC Simard 1968 + time-lag 1/10/100 ชม. หมุนจากข้อมูลย้อนหลัง 24 ชม. |
| การลาม | `src/lib/spread/simulate.ts` | minimum travel time บนตาราง 16 ทิศ, อากาศเปลี่ยนรายชั่วโมง, ensemble (ทิศลม σ 20°, ความเร็วลม log-σ 0.25, ความชื้น σ 1%) |
| ข้อมูลนำเข้า | `src/lib/spread/inputs.ts` | Open-Meteo (ลม 10 ม., อุณหภูมิ, RH), AWS Terrain Tiles (Terrarium) → ความสูง ความชัน |
| Worker | `src/lib/spread/spread.worker.ts` | รัน ensemble นอก main thread |
| UI | `src/pages/Spread.tsx`, `src/components/spread/SpreadMap.tsx` | กดเลือกจุดเริ่มไฟ, เลือกเชื้อเพลิง/ระยะพยากรณ์, แสดงความน่าจะเป็นหรือเวลาไฟมาถึง |

ตาราง 201×201 ช่อง, 25 ชุด ใช้ราว 2 วินาทีบนเครื่องทดสอบ (รวมดึงข้อมูล)

## โหมด Simulator (`/simulator`)

ใช้ฟิสิกส์ชุดเดียวกันผ่าน `src/lib/spread/run.ts` (ใช้ร่วมกับ `/spread`) เพิ่มสามอย่าง

- **สภาพอากาศกำหนดเอง** คงที่ตลอดการจำลอง และขนาดพื้นที่คำนวณปรับตามระยะลามที่คาด (`suggestDomain`: ระยะหัวไฟ + ท้ายไฟ ×1.25 เลื่อนศูนย์กลางไปทางท้ายลม สูงสุด 80 กม.)
- **แนวกันไฟ** เส้นที่ผู้ใช้วาด แปลงเป็นช่องที่ไฟข้ามไม่ได้ กว้าง 2 ช่อง กันการก้าวทแยง
- **ภาพ 3 มิติ** `src/components/simulator/Sim3DMap.tsx`: ภาพดาวเทียม Esri บน DEM Terrarium (`setTerrain`), พื้นที่ไหม้เป็น canvas source คลุมภูมิประเทศ สีตามเวลาที่ไหม้ 6 ช่วงคงที่, แนวหน้าไฟเป็น fill-extrusion สูงตามความยาวเปลวไฟ (L ∝ R^0.46 จาก Byram โดย R คำนวณจาก gradient ของเวลาไฟมาถึง) ขยายแนวตั้งตามขนาดช่องและบอกตัวคูณใน legend

## ความสูงเรือนยอด (LiDAR/CHM)

**ข้อมูล:** Meta & WRI High Resolution Canopy Height Maps v1 (Tolan et al. 2024, CC BY 4.0) ความละเอียด 1.19 ม. ทั่วโลก
เป็นแบบจำลองความสูงเรือนยอด (CHM) ที่ทำนายจากภาพ Maxar และสอบเทียบด้วย LiDAR จากเครื่องบินและ GEDI ไม่ใช่ point cloud ดิบ
ค่าเป็นความสูงเหนือพื้นดิน (สัมพัทธ์) จึงไม่มีปัญหา vertical datum บันทึกไว้ใน `public/canopy/index.json`

**ทำไมต้องประมวลผลก่อน:** ไฟล์ต้นฉบับ (`s3://dataforgood-fb-data/forests/v1/alsgedi_global_v6_float/chm/{quadkey z9}.tif`)
ไม่ส่ง CORS header และเป็น BigTIFF แบบ strip (65536×65536 px, uint8, deflate) ไม่ใช่ COG เบราว์เซอร์อ่านตรงไม่ได้

**สคริปต์:** `npm run canopy:build` หรือ `node scripts/canopy/build-canopy.mjs lat,lon ...` (`scripts/canopy/`, Node ไม่มี dependency) ดาวน์โหลด tile ต้นฉบับใต้แต่ละจุด
สรุปบล็อก 32×32 px (≈38 ม.) เป็น p90 ความสูง (R) และ % ปกคลุมที่สูงเกิน 2 ม. (G) เขียนเป็น PNG XYZ z12 ใน `public/canopy/`
(ตั้ง `VITE_FC_CANOPY_BASE` ให้ชี้ HF bucket ได้ภายหลัง) ตอนนี้สร้างรอบจุดเฝ้าระวัง 9 จุด (tile ละ ~78 กม.)

**ผลต่อการคำนวณ** (`src/lib/spread/crown.ts`):

| ผล | สมการ | ข้อมูลที่ใช้ |
| --- | --- | --- |
| ลมใต้เรือนยอด | Albini & Baughman (1979) sheltered WAF แบบ BehavePlus | ความสูง + ปกคลุม (วัด) |
| เริ่มไฟเรือนยอด | Van Wagner (1977) I₀ = (0.010·CBH·(460+25.9·FMC))^1.5 | CBH = 30% ความสูง (สมมติ), FMC 100% (สมมติ) |
| ไฟเรือนยอดลุกลาม | Van Wagner R ≥ 3/CBD, R_crown = 3.34 × R(FM10, ลม 0.4 × ลม 20 ฟุต) (Rothermel 1991) | CBD 0.1 กก./ลบ.ม. (สมมติ) |

ค่าสมมติแสดงบนหน้าเว็บ ถ้ามีข้อมูลโครงสร้างป่าจริง (LANDFIRE CBH/CBD ในสหรัฐฯ) ควรแทนที่

## API ฝั่ง backend ที่จะเพิ่ม (เฟส 2, FastAPI บน HF Spaces)

ใช้เมื่อต้องการแผนที่เชื้อเพลิงจริง ensemble ใหญ่ขึ้น หรือ hotspot ที่ต้องผ่าน proxy (FIRMS ไม่ส่ง CORS header)

```
POST /v1/spread/runs            → 202 { run_id }
  body: { ignition: {lat, lon} | {hotspots: "latest"}, hours: 6..72,
          fuel: "auto" | "<model id>", members: 1..100, weather_models?: ["ecmwf_ifs","gfs","icon"] }
GET  /v1/spread/runs/{run_id}   → { status, progress, result?: { probability_url (COG/PNG), isochrones (GeoJSON), hourly[] } }
GET  /v1/hotspots/latest?bbox=w,s,e,n&hours=24   → NOAA-20/21 NRT ผ่าน proxy (ซ่อน MAP_KEY)
```

- งานยาว: ใช้แบบ async job (202 + polling) ไม่ถือ connection ไว้
- ผลลัพธ์ cache ด้วย key = (ignition ปัดเศษ, hours, fuel, forecast run time)
- ข้อมูลเดิมในเบราว์เซอร์ยังเป็น fallback เมื่อ backend หลับ (HF Spaces ฟรีหลับเมื่อไม่มีคนใช้)

## ลำดับปรับปรุงถัดไป (จากรายงานวิจัย)

1. เริ่มจาก hotspot ทุกรอบดาวเทียมผ่านและถ่วงน้ำหนัก ensemble ตามว่าตรงกับรอบถัดไปแค่ไหน
2. แผนที่เชื้อเพลิง Scott & Burgan 40 จาก ESA WorldCover (ประมวลผลที่ backend)
3. สมการเฉพาะภูมิภาค: FBP (แคนาดา), CSIRO grassland / Vesta (ออสเตรเลีย)
4. ensemble หลายโมเดลอากาศ และสุ่ม ROS ด้วย
5. วัดความแม่นทิศทางเองจากการโตของ hotspot วันต่อวัน (ยังไม่มี benchmark สาธารณะ)
6. ML เป็นตัวแก้ค่าฝั่ง backend (เช่น U-Net ที่ฝึกบน WildfireSpreadTS แล้ว fine-tune ด้วยข้อมูล VIIRS ของ 4 ภูมิภาค)
7. ไฟเรือนยอดและลูกไฟปลิว

## ผลที่ตามมา

- ไม่มีค่าเซิร์ฟเวอร์ แต่ใช้เชื้อเพลิงชนิดเดียวทั้งพื้นที่ และน้ำทะเลเท่านั้นที่กันไฟ
- Open-Meteo ฟรีเฉพาะการใช้ที่ไม่ใช่เชิงพาณิชย์ จำกัดต่อ IP การเรียกจากเบราว์เซอร์จึงกระจายโควตาตามผู้ใช้
- ตัวเลขเป็นแนวโน้มเพื่อวางแผน Rothermel คลาดเคลื่อนมัธยฐานราว 57% จากไฟจริง หน้าเว็บบอกข้อจำกัดนี้ไว้
