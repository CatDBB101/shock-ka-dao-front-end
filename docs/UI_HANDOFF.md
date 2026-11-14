# UI / UX Handoff: FireCalendar+

เอกสารนี้สำหรับคนที่จะมาปรับหน้าตาและประสบการณ์ใช้งาน (UX/UI) ของเว็บ
อ่านจบแล้วควรรู้ว่าไฟล์ไหนคุมหน้าไหน สี/ฟอนต์มาจากไหน ใช้ Tailwind ยังไง และอะไรห้ามแตะ

---

## 1. เริ่มรัน

```bash
npm install
npm run data:sync   # ดาวน์โหลดข้อมูลจริง 42 MB จาก Hugging Face เข้า public/data (ไม่ต้องลง hf CLI)
npm run dev         # http://localhost:5173
```

ข้อมูลจริงอยู่ที่ HF bucket สาธารณะ [`Ploychomphoo/firecalendar-data`](https://huggingface.co/buckets/Ploychomphoo/firecalendar-data) ซึ่ง `npm run data:sync` ดึงให้อัตโนมัติ
ถ้าอยากใช้ hf CLI เองก็ได้: `hf sync hf://buckets/Ploychomphoo/firecalendar-data ./local` แล้วตามด้วย `npm run data:sync -- ./local`
ถ้าไม่มีเน็ตหรือแค่จะปรับหน้าตา ให้ตั้ง `VITE_FC_DATA_MODE=mock` ใน `.env.local`

ก่อนส่งงานให้รันอย่างน้อย `npm run build` (มี typecheck อยู่ในนั้น) และ `npm test`

แนะนำให้ติดตั้ง extension **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`) ซึ่ง VS Code จะเด้งแนะนำให้เองจาก `.vscode/extensions.json`
ถ้า autocomplete ไม่ขึ้น ให้เพิ่มบรรทัดนี้ใน `.vscode/settings.json` ของเครื่องตัวเอง (ไฟล์นี้ไม่อยู่ใน git):

```json
{ "files.associations": { "*.css": "tailwindcss" }, "editor.quickSuggestions": { "strings": "on" } }
```

---

## 2. ภาพรวมโปรดักต์ (สิ่งที่ UX ต้องรู้)

- **ผลิตภัณฑ์**: ปฏิทินไฟป่ารายเดือน ปี 2001–2024 ที่ต่อข้อมูลดาวเทียม MODIS (เก่า) กับ VIIRS (ใหม่) ให้เป็นเส้นเดียว จุดเด่นคือ "รอยต่อปี 2012" ที่หายไปหลังปรับเทียบ
- **ภาษา**: UI เป็นภาษาไทย (`<html lang="th">`) ส่วนคำศัพท์เทคนิค (MODIS, VIIRS, H3) ใช้ภาษาอังกฤษ
- **2 โหมดผู้ใช้** (สวิตช์มุมขวาบน `ModeSwitch`)
  - **Scientist** (ค่าเริ่มต้น): ดูประวัติ สำรวจพื้นที่ หลักฐาน ดาวน์โหลดข้อมูล
  - **Firefighter**: หน้า `/watch` จุดเฝ้าระวัง + ระดับเตือนภัย ต้องอ่านง่ายและเร็ว
  - เมนูเปลี่ยนตามโหมด (`NAV` ใน `src/components/layout/Layout.tsx`)
- **ธีม**: ค่าเริ่มต้นคือ **ธีมมืด** (โทน "Thermal Strata" กลางคืนสีน้ำเงินมหาสมุทร + สีความร้อน) ถ้าเครื่องผู้ใช้ตั้งเป็น light จะสลับเป็นธีมสว่าง ("ice survey") ให้เอง
- **ข้อมูลหนัก**: หน้า Explore โหลด DuckDB-WASM และไฟล์ parquet ครั้งแรกอาจช้า สถานะ loading/error จึงสำคัญ

---

## 3. หน้าไหนอยู่ไฟล์ไหน

| Route | ไฟล์หลัก | คอมโพเนนต์ / class ที่ใช้เยอะ |
| --- | --- | --- |
| ทุกหน้า (header, เมนู, footer) | `src/components/layout/Layout.tsx` | `.fc-header` `.fc-nav` `.fc-main` `.fc-footer` |
| `/` Home | `src/pages/Home.tsx` | hero `.orbit*`, `EarthLimb`, `HeatStrata` (canvas), `SeamMeter`, `.band` `.proof` `.facts` |
| `/explore` | `src/pages/Explore.tsx` | `AoiMap` (แผนที่ MapLibre), `AoiForm`, `CalendarGrid`, `.strata-panel` `.detail` |
| `/watch` (Firefighter) | `src/pages/Watch.tsx` | `WatchMap`, `.ff-list` `.ff-card` `.ff-badge` `.ff-bars`, ระดับ `.lvl-*` |
| `/evidence` | `src/pages/Evidence.tsx`, `src/pages/evidence/EvidenceGallery.tsx` | `.score-table`, แกลเลอรีกราฟ `.lt-*` (lightbox `<dialog>`) |
| `/data` | `src/pages/Data.tsx` | `.fc-table` `.table-scroll`, `DownloadCsvButton` |
| `/about` | `src/pages/About.tsx` | ข้อความล้วน |
| `/guide`, `/prototype` | `src/prototype/*` | ต้นแบบแยกเดี่ยว มี CSS ของตัวเอง (`guide.css`, `explorer.css`) **ไม่ได้ใช้ token หลัก** |

คอมโพเนนต์ที่ใช้ซ้ำหลายหน้า: `src/components/firecalendar/`
(`CalendarGrid` ตารางปฏิทิน, `Legend` คำอธิบายสี, `ContinuityChart` กราฟ SVG, `States` loading/error)

---

## 4. Tailwind CSS (ติดตั้งแล้ว)

### 4.1 ตั้งค่าไว้อย่างไร

- **Tailwind v4** ผ่าน `@tailwindcss/vite` ไม่มี `tailwind.config.js` เพราะ config ทั้งหมดอยู่ใน CSS
- ไฟล์ตั้งค่าอยู่ที่ **`src/styles/tailwind.css`** และ import ครั้งเดียวใน `src/main.tsx`
- ลำดับ layer: `theme < base < components < utilities`
  - `firecalendar.css` (CSS เดิมทั้งหมด) อยู่ใน layer `components`
  - **utility ของ Tailwind ชนะ class เดิมเสมอ** จึงเขียนเสริมทับของเดิมได้เลย เช่น
    ```tsx
    <button className="btn primary px-8 rounded-full">ดาวน์โหลด</button>
    ```
- **ไม่ได้เปิด Preflight** (reset ของ Tailwind) เพราะ `firecalendar.css` มี base ของตัวเองอยู่แล้ว ถ้าเปิดจะทำให้หัวข้อ ปุ่ม และ input ทุกหน้าเพี้ยน
  - ผลคือ `<h1>`–`<h4>`, `<p>`, `<a>`, `<input>` ยังมีสไตล์ default ของโปรเจกต์ (ดูหัวข้อ 5.4)

### 4.2 Utility จาก design token

ทุก utility ชี้ไปที่ CSS variable (`@theme inline`) **ธีมมืด/สว่างจึงสลับให้เอง ไม่ต้องเขียน `dark:`**

| กลุ่ม | ชื่อ (ใช้กับ `bg-` `text-` `border-` `ring-` `fill-` `stroke-` ได้) | ความหมาย |
| --- | --- | --- |
| พื้น | `fc-bg`, `fc-bg-deep` | พื้นหลังหน้า / พื้นที่ลึกกว่า (footer, input) |
| การ์ด | `fc-panel`, `fc-panel-2` | การ์ด / การ์ดซ้อนชั้น, แท็บที่เลือก |
| ตัวอักษร | `fc-text`, `fc-muted` | ข้อความหลัก / ข้อความรอง |
| เส้น | `fc-line` | ขอบและเส้นแบ่ง |
| เน้น | `fc-ember`, `fc-ember-ink` | ปุ่มหลัก ข้อความเตือน / สีตัวอักษรบน ember |
| แหล่งข้อมูล | `fc-viirs`, `fc-modis` | สีของ VIIRS (และลิงก์) / MODIS |
| Focus | `fc-focus` | วงโฟกัสคีย์บอร์ด |
| สเกลความร้อน | `fc-h0` … `fc-h4` | ไม่มีไฟ → ไฟมากที่สุด (ใช้ในปฏิทินและ legend) |

| อื่น ๆ | Class |
| --- | --- |
| ฟอนต์ | `font-head` (Trirong, หัวข้อ), `font-body` (Anuphan, เนื้อหา), `font-num` |
| ตัวเลขเรียงตรงหลัก | `tabular` (เทียบเท่า class เดิม `.num`) |
| มุมโค้ง | `rounded-fc-sm` (5px), `rounded-fc-md` (10px), `rounded-fc-lg` (20px) |
| เงาเรืองแสง | `shadow-glow-heat`, `shadow-glow-aurora` |
| easing | `ease-fc-out`, `ease-fc-in-out` |

ใส่ความโปร่งใสได้ตามปกติ เช่น `bg-fc-ember/10` `border-fc-line/50`

ตัวอย่างการ์ด:

```tsx
<div className="rounded-fc-md border border-fc-line bg-fc-panel p-5">
  <h3 className="font-head text-fc-text">เดือนวิกฤต</h3>
  <p className="text-sm text-fc-muted">
    สูงสุด <span className="tabular text-fc-ember">12,480</span> จุด
  </p>
</div>
```

### 4.3 Variant พิเศษของโปรเจกต์

| Variant | ทำงานเมื่อ | ตัวอย่าง |
| --- | --- | --- |
| `ff:` | อยู่ในโหมด Firefighter (`<html data-mode="firefighter">`) | `ff:text-lg ff:font-semibold` |
| `sci:` | อยู่ในโหมด Scientist | `sci:hidden` |
| `light:` | ธีมสว่าง (ระบบตั้ง light หรือ `<html data-theme="light">`) | `light:bg-[url(/paper.png)]` |

- ใช้ `light:` เฉพาะกับสิ่งที่**ไม่ใช่ token** (รูปพื้นหลัง เงาพิเศษ) ถ้าเป็นสี ให้ใช้ token ที่สลับเองอยู่แล้ว
- **อย่าใช้ `dark:` ของ Tailwind** เพราะธีมมืดเป็นค่าเริ่มต้น และ `dark:` ไม่รู้จัก `data-theme`
- ทดสอบธีมสว่างด้วยมือ: เปิด DevTools แล้วพิมพ์ `document.documentElement.dataset.theme = "light"`

### 4.4 กติกาการใช้ Tailwind ในโปรเจกต์นี้

1. **สีต้องมาจาก token** (`bg-fc-*`, `text-fc-*`) ห้ามใช้สีของ Tailwind ตรง ๆ อย่าง `bg-orange-500` หรือ `text-[#f0703a]` ยกเว้นสีที่ต้องเหมือนกันทั้งสองธีมจริง ๆ (เช่น สีขาวบนรูปภาพ)
2. **ถ้าจะเพิ่ม/เปลี่ยนสี** ให้แก้ token ใน `firecalendar.css` (ทั้งบล็อกธีมมืด**และ**ธีมสว่างทั้งสองที่) แล้วเพิ่ม mapping ใน `@theme inline` ของ `tailwind.css`
3. **ของเดิมไม่ต้องรื้อ** ค่อย ๆ ปรับเฉพาะส่วนที่แก้ จะผสม class เดิม (`btn`, `panel`) กับ utility ก็ได้
4. ถ้า utility ชุดเดียวกันซ้ำเกิน 3 ที่ ให้ทำเป็นคอมโพเนนต์ React แทนการใช้ `@apply`
5. breakpoint มาตรฐานของ Tailwind (`sm` 640, `md` 768, `lg` 1024) ไม่ตรงกับ CSS เดิม (560 / 760 / 860 / 900px) ถ้าต้องให้ตรงของเดิม ใช้ `max-[860px]:` ได้

---

## 5. ระบบสไตล์เดิม (`src/styles/firecalendar.css`)

### 5.1 โครงสร้าง token 2 ชั้น

1. **Primitives** (`--ocean-*`, `--ice-*`, `--sand-*`, `--heat-0..4`, `--aurora-*`) เป็นค่าดิบ **คอมโพเนนต์ห้ามใช้ตรง**
2. **Semantic** (`--fc-*`) คือสิ่งที่คอมโพเนนต์ใช้ และมีค่าต่างกันระหว่างธีมมืด/สว่าง ค่าธีมสว่างเขียนซ้ำ 2 ที่ (`@media (prefers-color-scheme: light)` และ `:root[data-theme="light"]`) **แก้ต้องแก้ทั้งคู่**

นอกจากนี้ `.orbit` (hero หน้า Home) บังคับสีกลางคืนเสมอ โดย override `--fc-*` ภายในตัวเอง ซึ่ง utility Tailwind ภายใน hero ก็จะได้สีกลางคืนตามไปด้วย

### 5.2 ค่าสีหลัก

| Token | มืด (ค่าเริ่มต้น) | สว่าง |
| --- | --- | --- |
| `--fc-bg` | `#0d2130` | `#eef3f4` |
| `--fc-panel` | `#12293a` | `#ffffff` |
| `--fc-text` | `#ede6d6` | `#12293a` |
| `--fc-muted` | `#93a6b2` | `#4f6573` |
| `--fc-line` | `#24435b` | `#cbd8dd` |
| `--fc-ember` | `#f0703a` | `#c2412d` |
| `--fc-viirs` | `#7fd6c9` | `#127a6e` |
| `--fc-modis` | `#a79a86` | `#7c705f` |
| `--fc-h0 … h4` | `#1a3349` → `#ffd36e` (มืด→ขาวร้อน) | `#e1e8ea` → `#7a1630` (จาง→แดงเข้ม) |

> สเกลความร้อนของธีมสว่าง**กลับทิศ** (สีเข้มสุด = ไฟมากสุด) เพื่อให้ contrast บนพื้นขาวพอ ถ้าเปลี่ยนต้องเช็กทั้งสองธีม

### 5.3 Class เดิมที่ใช้บ่อย

| Class | ใช้ทำอะไร |
| --- | --- |
| `.panel` | การ์ดพื้นฐาน |
| `.stack` / `.row` / `.grid-2` / `.form-grid` | layout แนวตั้ง / แนวนอน / 2 คอลัมน์ responsive / ฟอร์ม |
| `.btn`, `.btn.primary`, `.btn.ghost` | ปุ่มปกติ / ปุ่มหลัก (ember) / ปุ่มรอง |
| `.tabs` | กลุ่มปุ่มแท็บ (สถานะเลือกดูจาก `aria-pressed` / `aria-selected`) |
| `label.field` | label + input |
| `.alert`, `.error`, `.note` | กล่องเตือน / ข้อความ error / หมายเหตุขอบซ้าย |
| `.muted`, `.small`, `.num`, `.sr-only` | ข้อความรอง / 14px / ตัวเลข tabular / ซ่อนแต่ screen reader อ่าน |
| `.fc-cell.lvl-0..4` | ช่องปฏิทินตามระดับไฟ (มี `.src-backcast` = ลายทแยง, `.critical`, `.selected`, `.no-data`) |
| `.lvl-active/high/elevated/normal` | ระดับเตือนภัยในโหมด Firefighter |

### 5.4 Base ที่มีผลทั้งเว็บ

- `body`: ฟอนต์ Anuphan 16px, line-height 1.65
- `h1`–`h4`: ฟอนต์ Trirong ขนาด responsive (`h1` 30–44px, `h2` 22–28px)
- `p`: กว้างสุด `72ch` (ถ้าต้องการเต็มความกว้าง ใส่ `max-w-none`)
- `:focus-visible`: วงโฟกัส 3px สี `--fc-focus`, **ห้ามลบ**
- ความกว้างเนื้อหาสูงสุด 1200px (`.fc-main`)

---

## 6. สีที่อยู่นอก CSS (ต้องแก้ใน TSX)

สิ่งเหล่านี้วาดด้วย canvas หรือ MapLibre ซึ่งอ่าน CSS variable ไม่ได้ จึง hardcode สีไว้:

| ไฟล์ | อะไร |
| --- | --- |
| `src/components/hero/HeatStrata.tsx` (`RAMP`) | สเกลสีภาพ 3D หน้า Home (= `--heat-0..4`) |
| `src/components/hero/EarthLimb.tsx` | สีทะเลในภาพโลก |
| `src/components/firecalendar/AoiMap.tsx` (`addLayer`) | สีกรอบ/ช่อง H3 บนแผนที่ Explore |
| `src/components/watch/WatchMap.tsx` (`LEVEL_COLOUR`) | สีระดับเตือนภัยบนแผนที่ Watch |

ถ้าเปลี่ยนสีแบรนด์ อย่าลืมแก้ที่นี่ให้ตรงกับ token ส่วน `ContinuityChart.tsx` (SVG) ใช้ `var(--fc-*)` อยู่แล้ว ไม่ต้องแก้

---

## 7. สิ่งที่ห้ามแตะ / ต้องระวัง

- **`src/lib/**`** คือชั้นข้อมูล (DuckDB, API, hooks, การคำนวณระดับสี) งาน UI ไม่ควรต้องแก้ที่นี่ ถ้าต้องการข้อมูลเพิ่มให้คุยกับทีม dev
- **ข้อความวิทยาศาสตร์** (ตัวเลข, "แปลงจาก MODIS", "แม่นน้อยกว่า", ข้อจำกัดในหน้า Evidence) มีความหมายทางข้อมูล ปรับถ้อยคำได้แต่ห้ามเปลี่ยนความหมาย ป้ายระดับไฟอยู่ใน `src/lib/firecalendar/colour.ts`
- **ลายทแยง** บนช่องปฏิทิน (`.src-backcast`) บอกว่าค่านั้น "คำนวณย้อนหลัง" ไม่ใช่ค่าวัดจริง ห้ามเอาออก แต่เปลี่ยนสไตล์ได้
- **`role`, `aria-*`** ใน `CalendarGrid` (grid/row/gridcell) และ `ModeSwitch` (`role="switch"`) ใช้กับคีย์บอร์ดและ screen reader ห้ามลบ
- **Animation**: ทุกอนิเมชันต้องอยู่ใต้ `prefers-reduced-motion: no-preference` (Tailwind ใช้ `motion-safe:` ได้) โดยเฉพาะการกะพริบเตือนภัยในโหมด Firefighter
- `/guide`, `/prototype` เป็นต้นแบบแยก แก้ได้อิสระ แต่ไม่ได้ใช้ token หลัก

---

## 8. เช็กลิสต์ก่อนส่งงาน

- [ ] ดูครบทั้ง **ธีมมืด** และ **ธีมสว่าง**
- [ ] ดูครบทั้งโหมด **Scientist** และ **Firefighter**
- [ ] จอมือถือกว้าง 360px ต้องไม่มี scroll แนวนอน (ยกเว้นในตาราง/ปฏิทินที่มี `.table-scroll` / `.fc-cal-scroll`)
- [ ] ใช้งานด้วยคีย์บอร์ดได้ (Tab เห็นวงโฟกัส, Enter/Space กดได้)
- [ ] contrast ตัวอักษรอย่างน้อย 4.5:1 (ข้อความ `fc-muted` บน `fc-panel` ด้วย)
- [ ] สถานะ loading / error / ไม่มีข้อมูล ยังดูดี (ลองตั้ง `VITE_FC_DATA_MODE=mock`)
- [ ] `npm run build` และ `npm test` ผ่าน

---

## 9. อ้างอิงไฟล์

| ไฟล์ | เนื้อหา |
| --- | --- |
| `src/styles/tailwind.css` | ตั้งค่า Tailwind, mapping token, variant `ff:` `sci:` `light:` |
| `src/styles/firecalendar.css` | token สี ธีม และ class เดิมทั้งหมด |
| `reference/*.html` | ต้นแบบดีไซน์ดั้งเดิม (Earth Pulse guide, MODIS·VIIRS explorer) |
| `docs/REPO_NOTES.md` | stack และโครงโฟลเดอร์ |
| `README.md` | คำสั่งและ route ทั้งหมด |
