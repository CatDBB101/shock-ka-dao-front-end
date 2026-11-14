// Evidence figures manifest — one place for every figure's provenance and the honest claim it supports.
// Captions describe exactly what each PNG shows (checked by eye against the image, 2026-11-14):
// 12_* and 13_* are model-selection plots of M1v2 on cross-validation folds, NOT the final v3 test.

export type Chapter = "problem" | "test" | "weakness" | "result";

export const CHAPTER_TH: Record<Chapter, string> = {
  problem: "ปัญหา",
  test: "การทดสอบ",
  weakness: "จุดอ่อน",
  result: "ผลลัพธ์",
};

export interface EvidenceFigure {
  id: string;
  file: string;
  /** intrinsic pixel size, for aspect ratio + no layout shift */
  w: number;
  h: number;
  chapter: Chapter;
  title: string;
  /** one sentence: what this figure proves (or doesn't) */
  takeaway: string;
  /** where to look */
  look: string[];
  /** how it was validated — shown as a badge */
  validation: string;
  /** which model(s) appear */
  models: string;
  /** pipeline step that produced it */
  source: string;
  alt: string;
}

export const FIGURES: EvidenceFigure[] = [
  {
    id: "seam",
    file: "02_seam_annual_counts.png",
    w: 1754,
    h: 431,
    chapter: "problem",
    title: "รอยหักปี 2012",
    takeaway: "VIIRS นับจุดไฟได้มากกว่า MODIS 3–5 เท่าทุกภูมิภาค ถ้าต่อสองชุดตรงๆ ไฟจะดูเพิ่มขึ้นทันทีปี 2012",
    look: [
      "เส้นน้ำเงิน (MODIS) อยู่ต่ำกว่าเส้นส้ม (VIIRS S-NPP) ตลอดช่วงที่ซ้อนกัน",
      "เส้นประเขียว NOAA-20 ทับ S-NPP เกือบสนิท ปัญหาจึงอยู่ที่ MODIS กับ VIIRS ไม่ใช่ระหว่างดาวเทียม VIIRS ด้วยกัน",
      "แกนตั้งเป็นสเกล log ระยะห่างคงที่จึงแปลว่าอัตราส่วนคงที่",
    ],
    validation: "สำรวจข้อมูล (EDA)",
    models: "ยังไม่มีโมเดล",
    source: "ขั้น EDA · ข้อมูล FIRMS SP ทั้ง 6 ประเทศ",
    alt: "กราฟเส้นจำนวนจุดไฟรายปีแบบสเกล log สี่ภูมิภาค MODIS ต่ำกว่า VIIRS ราว 3 ถึง 5 เท่า",
  },
  {
    id: "compare",
    file: "12_model_comparison.png",
    w: 724,
    h: 436,
    chapter: "test",
    title: "เทียบกับวิธีง่ายๆ ก่อน",
    takeaway: "LightGBM (M1v2) คลาดเคลื่อนต่ำกว่าวิธีคูณตัวเลขเดียวราว 4.5 เท่า บนข้อมูลที่กันพื้นที่และปีออกไป",
    look: [
      "B0, B1 คือคูณ MODIS ด้วยตัวเลขคงที่ ได้ราว 5.7",
      "B2 สมการถดถอยธรรมดาได้ราว 2.0 ส่วน M1v2 ได้ 1.27",
      "ขีดดำคือความผันผวนระหว่าง 4 กลุ่มทดสอบ ไม่ซ้อนกันระหว่าง B2 กับ M1v2",
      "กราฟนี้ยังไม่มี v3 ซึ่งเลือกภายหลัง (CV 1.21, ข้อสอบปลายภาค 1.09)",
    ],
    validation: "CV แบบกันพื้นที่ × ปี 4 กลุ่ม",
    models: "B0, B1, B2, M1v1, M1v2",
    source: "ขั้นเลือกโมเดล · เฉพาะแถว DEV ไม่แตะข้อสอบปลายภาค",
    alt: "กราฟแท่ง Poisson deviance ห้าวิธี B0 B1 ราว 5.7 B2 ราว 2.0 M1v1 ราว 1.5 M1v2 ราว 1.3",
  },
  {
    id: "bias",
    file: "13_bias_by_modis_size.png",
    w: 930,
    h: 481,
    chapter: "weakness",
    title: "ตรงไหนที่โมเดลยังเอียง",
    takeaway: "ช่องที่ MODIS เห็นไฟหนาแน่นมาก (เกิน 200 จุด) ถูกทายเกิน และแคนาดา + สหรัฐฯ ถูกทายขาดในช่วงไฟขนาดกลาง",
    look: [
      "ออสเตรเลียและแอฟริกาพุ่งขึ้นที่กลุ่ม >200 (ทายเกินราว 25% และ 19%)",
      "เส้นเขียวแคนาดา + สหรัฐฯ ต่ำสุดราว −17% ที่กลุ่ม 11–50",
      "เส้น 0 คือทายพอดี จุดไหนห่างเส้นนี้คือจุดที่ควรระวัง",
    ],
    validation: "CV แบบกันพื้นที่ × ปี (out-of-fold)",
    models: "M1v2",
    source: "ขั้นวิเคราะห์ความคลาดเคลื่อน · แถว DEV",
    alt: "กราฟเส้นความเอนเอียงตามจำนวนจุด MODIS ต่อช่อง ออสเตรเลียและแอฟริกาทายเกินที่มากกว่า 200 จุด แคนาดาทายขาดที่ 11 ถึง 50 จุด",
  },
  {
    id: "recon",
    file: "12_calendar_reconstruction.png",
    w: 1828,
    h: 452,
    chapter: "test",
    title: "ทายย้อนเทียบของจริง",
    takeaway: "ยอดรายเดือนที่แปลงจาก MODIS ทับค่า VIIRS จริงในพื้นที่และปีที่กันไว้ ยกเว้นเดือนไฟใหญ่ผิดปกติ",
    look: [
      "จุดดำคือ VIIRS วัดจริง เส้นส้มคือ M1v2 แปลงจาก MODIS เส้นเทาบางคือวิธีคูณ B1",
      "แคนาดา + สหรัฐฯ ปี 2014 มีจุดดำลอยสูงเหนือเส้น นี่คือเดือนไฟใหญ่ที่ทายต่ำ",
      "เส้นตรงยาวที่แอฟริกาปี 2022–2024 คือช่วงที่ไม่มีเดือนทดสอบ เส้นแค่เชื่อมจุดเว้น",
    ],
    validation: "พื้นที่และปีที่กันไว้ (held-out)",
    models: "M1v2, B1",
    source: "ขั้นเลือกโมเดล · รวมระดับภูมิภาค",
    alt: "กราฟเส้นยอดจุดไฟรายเดือน 2013 ถึง 2024 สี่ภูมิภาค ค่าที่แปลงจาก MODIS ทับค่า VIIRS จริงเกือบทั้งหมด",
  },
  {
    id: "continuity",
    file: "15_continuity_audit.png",
    w: 1846,
    h: 452,
    chapter: "result",
    title: "รอยต่อหายไป",
    takeaway: "หลังปรับเทียบ เส้นรายปีต่อเนื่องข้ามปี 2012 ทั้ง 4 ภูมิภาค และค่าที่โมเดลทายช่วงมี VIIRS ทับค่าจริง",
    look: [
      "เส้นเทาคือ MODIS ดิบ เส้นส้มคือ FireCalendar+ ไม่กระโดดตรงเส้นประปี 2012",
      "แถบส้มอ่อนก่อนปี 2012 คือช่วงความไม่แน่นอนราว 80%",
      "เส้นจุดน้ำเงินคือค่าโมเดลในปีที่มี VIIRS จริง ถ้าทับเส้นส้มแปลว่าโมเดลไม่เพี้ยน",
    ],
    validation: "ตรวจความต่อเนื่องทั้งช่วง",
    models: "v3 (โมเดลที่ใช้บนเว็บ)",
    source: "05b_continuity_fig.py · ข้อมูลที่เสิร์ฟจริง",
    alt: "กราฟเส้นยอดจุดไฟรายปี 2001 ถึง 2024 สี่ภูมิภาค เส้นที่ปรับเทียบแล้วต่อเนื่องข้ามปี 2012",
  },
];
