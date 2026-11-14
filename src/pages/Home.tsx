import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Region } from "../lib/firecalendar";
import { useRegionCalendar } from "../lib/firecalendar";
import { CalendarSkeleton, ContinuityChart, LoadError, RegionTabs, RegionView, regionTh } from "../components/firecalendar";
import { EarthLimb } from "../components/hero/EarthLimb";
import { HeatStrata, type StrataMode } from "../components/hero/HeatStrata";
import { SeamMeter } from "../components/hero/SeamMeter";

export default function Home() {
  const [region, setRegion] = useState<Region>("south_america");
  const [sp, setSp] = useSearchParams();
  const mode: StrataMode = sp.get("seam") === "fixed" ? "harmonized" : "spliced";
  const setMode = (m: StrataMode) => {
    const n = new URLSearchParams(sp);
    if (m === "harmonized") n.set("seam", "fixed");
    else n.delete("seam");
    setSp(n, { replace: true });
  };
  const q = useRegionCalendar(region);

  return (
    <>
      <section className="orbit" aria-labelledby="orbit-title">
        <EarthLimb region={region} />
        <div className="orbit-inner">
          <div className="orbit-copy">
            <h1 id="orbit-title" className="orbit-title">
              <span className="t1" style={{ whiteSpace: "nowrap" }}> 24 Years of Fire</span>
              <span className="t2">จาก MODIS และ VIIRS </span>
            </h1>
            <p className="orbit-lede">
             1 แท่ง = 1 เดือน ยิ่งสูง ยิ่งมีจุดไฟมาก ปี 2012 ดาวเทียม VIIRS ที่ละเอียดกว่าเข้ามาแทน MODIS ถ้าต่อข้อมูลตรงๆ ไฟจะดูเพิ่มขึ้นหลายเท่าในปีเดียว
            </p>

            <div className="orbit-controls">
                <p className="orbit-lede " style={{ marginBottom: "1px" }}>
             ตัวอย่างพื้นที่
            </p>
              <RegionTabs value={region} onChange={setRegion} />
              <div className="morph" role="group" aria-label="วิธีต่อข้อมูลสองดาวเทียม">
                <button type="button" aria-pressed={mode === "spliced"} onClick={() => setMode("spliced")}>
                  ต่อข้อมูลตรงๆ
                </button>
                <button type="button" aria-pressed={mode === "harmonized"} onClick={() => setMode("harmonized")}>
                  ปรับเทียบด้วย FireCalendar+
                </button>
              </div>
              <p className="orbit-caption">
                {mode === "spliced"
                  ? "ก่อน 2012 เป็น MODIS ดิบ หลังจากนั้นเป็น VIIRS สังเกตขั้นบันไดตรงเส้นประ"
                  : "ปีก่อน 2012 ถูกแปลงให้เทียบเท่า VIIRS ขั้นบันไดหายไป แท่งลายทแยงคือค่าที่คำนวณ"}
              </p>
            </div>

            <Link to="/explore" className="btn primary">
              เลือกพื้นที่ของคุณเอง
            </Link>
          </div>

          <div className="orbit-stage">
            {q.isPending && <div className="strata-wait" role="status">กำลังโหลดปฏิทิน…</div>}
            {q.isError && <LoadError error={q.error} onRetry={() => void q.refetch()} />}
            {q.data && (
              <>
                <HeatStrata rows={q.data.rows} mode={mode} label={`ปฏิทินไฟ 3 มิติ ${regionTh(region)} 2001–2024`} />
                <SeamMeter rows={q.data.rows} mode={mode} />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="flat">
        <div className="band-head">
          <h2 id="flat">ตาราง ปี × เดือน</h2>
          <p className="muted">แถวคือปี คอลัมน์คือเดือน สีเข้มแปลว่าไฟมากแสดงข้อมูลของภูมิภาคที่เลือกไว้ด้านบน</p>
        </div>
        <div className="sheet">
          {q.isPending ? <CalendarSkeleton /> : <RegionView region={region} />}
        </div>
      </section>

      <section className="band" aria-labelledby="seam">
        <div className="band-head">
          <h2 id="seam">ยอดรายปี ก่อนและหลังปรับเทียบ</h2>
          <p className="muted">เส้นเทาคือ MODIS ดิบ เส้นส้มคือ FireCalendar+ ช่วงที่มี VIIRS แล้ว เส้นประฟ้าคือค่าที่โมเดลทาย ซึ่งทับค่าจริงเกือบสนิท</p>
        </div>
        <div className="sheet">{q.data ? <ContinuityChart rows={q.data.rows} title={regionTh(region)} /> : <p role="status">กำลังโหลด…</p>}</div>
      </section>

      <section className="band" aria-labelledby="proof">
        <div className="band-head">
          <h2 id="proof">เทียบความแม่นยำ กับข้อมูลที่ไม่เคยใช้</h2>
          <p className="muted">Poisson deviance ยิ่งสั้นยิ่งดี วัดบนพื้นที่และปีที่กันไว้ตั้งแต่ต้น เปิดดูครั้งเดียวตอนจบ</p>
        </div>
        <div className="proof" role="img" aria-label="วิธีคูณตัวเลขเดียว 5.17 เทียบกับ FireCalendar+ 1.09">
          <div className="proof-row">
            <span>คูณ MODIS ด้วยตัวเลขเดียว</span>
            <i style={{ width: "100%" }} className="proof-bar base" />
            <b>5.17</b>
          </div>
          <div className="proof-row">
            <span>FireCalendar+ (LightGBM)</span>
            <i style={{ width: `${(1.09 / 5.17) * 100}%` }} className="proof-bar ours" />
            <b>1.09</b>
          </div>
        </div>
        <p className="small">
          <Link to="/evidence">ดูหลักฐานและข้อจำกัดทั้งหมด</Link>
        </p>
      </section>

      <section className="band" aria-labelledby="why">
        <h2 id="why" className="band-title-only">
          สิ่งที่ข้อมูลนี้ให้
        </h2>
        <dl className="facts">
          <div>
            <dt>ไม่มีรอยหักปี 2012</dt>
            <dd>โมเดลเรียนจากปีที่มีดาวเทียมทั้งสองดวง แล้วแปลง MODIS ย้อนไปถึงปี 2001 ให้อยู่ในหน่วยเดียวกับ VIIRS</dd>
          </div>
          <div>
            <dt>บอกเสมอว่าวัดจริงหรือคำนวณ</dt>
            <dd>ค่าคำนวณมีลายทแยงและช่วงที่น่าจะเป็นราว 80% ทุกเดือน</dd>
          </div>
          <div>
            <dt>ดาวเทียมรุ่นเก่ากำลังปลดระวาง</dt>
            <dd>Terra และ Aqua ทยอยหยุดทำงานปี 2026–2027 สะพานเชื่อมข้อมูลต้องสร้างตอนที่ยังมีช่วงเวลาซ้อนกันให้เรียน</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
