# REPO_NOTES (F0.1)

## Stack ที่ใช้จริง (ต่างจากที่ kit สมมติไว้)

| เรื่อง | kit สมมติ | repo นี้ |
| --- | --- | --- |
| React | 18 | **19.3** |
| Vite | 5 | **8** (rolldown) |
| TypeScript | 5 strict | **7** strict + `noUncheckedIndexedAccess` |
| Router | ไม่ระบุ | `react-router-dom@6.28.0` (BrowserRouter) |
| ข้อมูล | TanStack Query 5.59 + DuckDB-WASM 1.29 | ตามนั้น |
| Test | vitest 2.1.5 | ตามนั้น ใช้ `vitest.config.ts` แยก (vitest 2 มี Vite 5 ของตัวเอง) |
| แผนที่ (ต้นแบบ) | maplibre-gl 4.7.1 | ตามนั้น + terra-draw 1.0.0 |
| CSS | ไม่ระบุ | CSS เดิม (`firecalendar.css`) + **Tailwind v4** (`@tailwindcss/vite`, ไม่มี preflight) ดู `docs/UI_HANDOFF.md` |

## โครงโฟลเดอร์

```text
src/
├── main.tsx                   <FireCalendarProvider><App/></…>
├── App.tsx                    routes (lazy)
├── lib/firecalendar/          ชั้นข้อมูลทั้งหมด (types, config, validate, time, colour, share,
│                              dataSource = Static/Api/Mock, duckdb, firms, provider, hooks, tests)
├── components/firecalendar/   CalendarGrid, Legend, ContinuityChart, AoiForm, DownloadCsvButton, RegionView
├── components/layout/         Layout (เมนู + footer), PageErrorBoundary
├── pages/                     Home, Explore, Evidence, Data, About, Ask (ซ่อน), NotFound
├── prototype/                 React port ของ reference/*.html: Guide (/guide), Explorer (/prototype)
├── styles/tailwind.css        Tailwind v4 entry + mapping token → utility
└── styles/firecalendar.css    token สี light/dark, ลายทแยง, ปฏิทิน
public/
├── data/      4 ไฟล์ข้อมูลจริง (gitignored, `npm run data:sync`)
├── mocks/     ตัดจากข้อมูลจริง สำหรับโหมด mock และ unit test
├── figures/   กราฟ 5 รูปของหน้า Evidence
└── geo/       ชายฝั่ง + พรมแดน (Natural Earth) ของต้นแบบ Explorer
```

## สิ่งที่ไม่มีใน kit และทำขึ้นเอง

`frontend-kit/src-starter` ไม่อยู่ในเครื่อง จึงเขียนชั้นข้อมูลและคอมโพเนนต์ใหม่ตาม `03-api-reference.md` และ `04-frontend-spec.md`
ชื่อฟิลด์ทุกตัวตรงกับไฟล์ข้อมูลจริงและ API (ตรวจด้วย unit test)

## พื้นที่ตัวอย่าง

kit บอกแค่จำนวนช่อง ไม่บอกพิกัด จึงหากรอบที่ได้จำนวนช่องตรงจาก `cell_index.parquet` (มีหลายกรอบที่ตรง อาจไม่ใช่กรอบเดียวกับใน kit):
โรซาริโอ −34.5,−61,−32.5,−58.5 (282) · แองโกลา −14,16,−10,20 (669) · บริติชโคลัมเบีย 49,−126,56,−118 (1,762) · นอร์เทิร์นเทร์ริทอรี −17,130,−12,136 (1,366)
