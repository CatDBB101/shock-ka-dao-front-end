import { Link } from "react-router-dom";

export default function About() {
  return (
    <>
      <h1>เกี่ยวกับ FireCalendar+</h1>
      <section>
        <p>
          FireCalendar+ เป็นผลงานสำหรับ NASA Space Apps Challenge 2026 โจทย์ MODIS/VIIRS Harmonization เราแปลงข้อมูลจุดไฟจากดาวเทียม MODIS (2001–2012)
          ให้เทียบเท่า VIIRS S-NPP 375 ม. ด้วยโมเดล LightGBM จึงได้ปฏิทินไฟรายเดือน 24 ปีที่ต่อเนื่องเป็นเส้นเดียว
        </p>
        <p>
          ครอบคลุม 6 ประเทศใน 4 ภูมิภาค: แองโกลา, อาร์เจนตินา + บราซิล, แคนาดา + สหรัฐฯ และออสเตรเลีย เท่าที่ตรวจเอกสารสาธารณะของ FIRMS, GWIS และ GFW
          ไม่พบชุดข้อมูลที่แปลง MODIS ย้อนหลังให้อยู่ในหน่วยของ VIIRS พร้อมช่วงความไม่แน่นอนรายเดือนแบบนี้
        </p>
      </section>
      <section>
        <h2>ทีม</h2>
        <ul>
          <li>Backend / ML: ข้อมูล โมเดล และการคำนวณทั้งหมด</li>
          <li>Frontend: หน้าเว็บและการเชื่อมข้อมูล</li>
        </ul>
      </section>
      <section>
        <h2>แหล่งข้อมูล NASA</h2>
        <ul>
          <li>NASA FIRMS — MODIS Collection 6.1 (Terra + Aqua) และ VIIRS 375 m (S-NPP)</li>
          <li>MCD12C1 — ชนิดพื้นที่ (land cover) จาก MODIS</li>
          <li>LAADS DAAC / Earthdata</li>
        </ul>
      </section>
      <section>
        <h2>การใช้ AI</h2>
        <p>
          ตามกติกา Space Apps: โค้ดของเว็บ เอกสาร และบางส่วนของสคริปต์ประมวลผล พัฒนาโดยใช้ AI coding assistant ช่วย ทีมตรวจผลลัพธ์และตัวเลขทั้งหมดด้วยตัวเอง
          ไม่มีตัวเลขใดบนเว็บที่ AI สร้างขึ้นเอง
        </p>
      </section>
      <section>
        <h2>ต้นแบบก่อนหน้า</h2>
        <p className="small">
          <Link to="/guide">คู่มือต้นแบบ Earth Pulse</Link> · <Link to="/prototype">MODIS · VIIRS Explorer (ข้อมูลจำลอง)</Link>
        </p>
        <Link to="/" className="btn ghost">
          ← กลับหน้าแรก
        </Link>
      </section>
    </>
  );
}
