import { useState } from "react";
import { Link } from "react-router-dom";
import type { Region } from "../lib/firecalendar";
import { useRegionCalendar } from "../lib/firecalendar";
import { ContinuityChart, LoadError, RegionTabs, RegionView, regionTh } from "../components/firecalendar";

export default function Home() {
  const [region, setRegion] = useState<Region>("africa");
  const [before, setBefore] = useState(false);
  return (
    <>
      <section className="hero">
        <h1>ปฏิทินไฟป่า 24 ปี ที่ต่อเนื่องเป็นเส้นเดียว</h1>
        <p>
          เราแปลงข้อมูลดาวเทียม MODIS รุ่นเก่าให้เทียบเท่า VIIRS 375 ม. จึงดูไฟรายเดือนตั้งแต่ปี 2001 ถึง 2024 ได้ในมาตรฐานเดียวกัน
          ทุกช่องบอกว่าเป็นค่าวัดจริงหรือค่าคำนวณ
        </p>
        <Link to="/explore" className="btn primary">
          เลือกพื้นที่ของคุณ →
        </Link>
      </section>

      <section aria-labelledby="sample">
        <h2 id="sample">ปฏิทินตัวอย่าง</h2>
        <RegionTabs value={region} onChange={setRegion} />
        <div className="panel" style={{ marginTop: 12 }}>
          <RegionView region={region} showModis={before} />
        </div>
      </section>

      <section aria-labelledby="seam">
        <h2 id="seam">รอยต่อที่เราซ่อม</h2>
        <p className="muted">
          ปี 2012 ดาวเทียม VIIRS เริ่มทำงาน มันเห็นไฟละเอียดกว่า MODIS หลายเท่า ถ้าเอาสองชุดมาต่อกันตรงๆ จะเห็น "ไฟเพิ่มขึ้น" แบบหักศอกทั้งที่ไม่จริง
          สลับปุ่มด้านล่างเพื่อดูปฏิทินก่อนและหลังปรับเทียบ
        </p>
        <div className="tabs" role="group" aria-label="ก่อนหรือหลังปรับเทียบ">
          <button type="button" aria-pressed={!before} onClick={() => setBefore(false)}>
            หลังปรับเทียบ
          </button>
          <button type="button" aria-pressed={before} onClick={() => setBefore(true)}>
            ก่อนปรับเทียบ (MODIS ดิบ)
          </button>
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          <SeamChart region={region} />
        </div>
      </section>

      <section aria-label="ข้อความหลัก">
        <div className="claims">
          <div className="panel">
            <h3>ต่อเนื่องตั้งแต่ปี 2001 ไม่มีรอยหักปี 2012</h3>
            <p className="small muted">โมเดล LightGBM เรียนจากช่วงที่มีดาวเทียมทั้งสองดวง แล้วแปลง MODIS ย้อนหลังให้อยู่ในหน่วยเดียวกับ VIIRS</p>
          </div>
          <div className="panel">
            <h3>ทุกตัวเลขบอกว่าวัดจริงหรือคำนวณ พร้อมช่วงความไม่แน่นอน</h3>
            <p className="small muted">ช่องที่มีลายทแยงคือค่าคำนวณ และบอกช่วงที่น่าจะเป็น (~80%) เสมอ</p>
          </div>
          <div className="panel">
            <h3>ทำทันก่อนดาวเทียมรุ่นเก่าหมดอายุ</h3>
            <p className="small muted">MODIS บนดาวเทียม Terra และ Aqua ทยอยปลดระวางปี 2026–2027</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="proof">
        <h2 id="proof">ตัวเลขยืนยัน</h2>
        <p className="bignum">
          5.17<span className="arrow">→</span>1.09
        </p>
        <p>
          ความคลาดเคลื่อน (Poisson deviance) บนข้อสอบปลายภาคลดลงเกือบ 5 เท่า เทียบกับวิธีคูณเลขแบบเดิม{" "}
          <Link to="/evidence">ดูหลักฐาน →</Link>
        </p>
      </section>
    </>
  );
}

function SeamChart({ region }: { region: Region }) {
  const q = useRegionCalendar(region);
  if (q.isPending) return <p role="status">กำลังโหลด…</p>;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return <ContinuityChart rows={q.data.rows} title={regionTh(region)} />;
}
