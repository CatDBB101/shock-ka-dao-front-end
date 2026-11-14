import { Link } from "react-router-dom";
import { REGIONS, useMeta, useRegionCalendar, type Region } from "../lib/firecalendar";
import { ContinuityChart, LoadError, regionTh } from "../components/firecalendar";

// Source: model_card.json · final test set 622,200 rows (switch to /v1/meta/eval when it exists)
const SCORES: { region: string; dev: string; bias: string }[] = [
  { region: "แอฟริกา", dev: "1.98", bias: "−6.8%" },
  { region: "อเมริกาใต้", dev: "1.33", bias: "−2.3%" },
  { region: "แคนาดา + สหรัฐฯ", dev: "0.81", bias: "−10.6%" },
  { region: "ออสเตรเลีย", dev: "1.28", bias: "+1.5%" },
];

const FIGURES: [string, string][] = [
  ["02_seam_annual_counts.png", "จำนวนจุดไฟรายปีของ MODIS และ VIIRS — เห็นรอยหักปี 2012 ถ้าต่อกันตรงๆ"],
  ["12_model_comparison.png", "เทียบคะแนนวิธีต่างๆ: วิธีคูณเลข, โมเดล v2 และ v3"],
  ["12_calendar_reconstruction.png", "ปฏิทินที่แปลงย้อนหลังเทียบกับค่าจริงในช่วงทดสอบ"],
  ["13_bias_by_modis_size.png", "ความเอนเอียงตามขนาดไฟของ MODIS — เดือนไฟใหญ่มากมักทายต่ำไป"],
  ["15_continuity_audit.png", "ตรวจความต่อเนื่องรายปีทั้ง 4 ภูมิภาค"],
];

export default function Evidence() {
  const meta = useMeta();
  return (
    <>
      <h1>หลักฐาน</h1>
      <p className="muted">ตัวเลขบนเว็บนี้เชื่อได้แค่ไหน และมีข้อจำกัดอะไรบ้าง</p>

      <section aria-labelledby="how">
        <h2 id="how">วิธีแปลงโดยย่อ</h2>
        <ol className="steps">
          <li>เรียนจากช่วงที่มีดาวเทียมทั้งสองดวงพร้อมกัน (ก.พ. 2012 เป็นต้นไป)</li>
          <li>LightGBM ใช้เบาะแส 37 ตัว เช่น จำนวนจุด MODIS, ขนาดไฟ, ชนิดพื้นที่ (MCD12C1), ฤดูกาล</li>
          <li>ทดสอบกับพื้นที่และปีที่โมเดลไม่เคยเห็น (แบ่งตามพื้นที่และเวลา)</li>
          <li>แปลงย้อนหลังถึงปี 2001 พร้อมช่วงความไม่แน่นอน ~80%</li>
        </ol>
      </section>

      <section aria-labelledby="score">
        <h2 id="score">คะแนน</h2>
        {meta.data && (
          <p>
            คะแนนรวมจากไฟล์ข้อมูล: Poisson deviance <b className="num">{meta.data.final_test_poisson_dev.toFixed(2)}</b> (ยิ่งต่ำยิ่งดี) · ข้อมูลรุ่น{" "}
            <span className="num">{meta.data.data_version}</span> · โมเดล <span className="num">{meta.data.model_id}</span> · สร้าง{" "}
            {meta.data.generated}
          </p>
        )}
        <div className="table-scroll">
          <table className="fc-table">
            <thead>
              <tr>
                <th>ภูมิภาค</th>
                <th className="num">Poisson deviance (ข้อสอบปลายภาค)</th>
                <th className="num">ทายเกิน/ขาดรวม</th>
              </tr>
            </thead>
            <tbody>
              {SCORES.map((s) => (
                <tr key={s.region}>
                  <td>{s.region}</td>
                  <td className="num">{s.dev}</td>
                  <td className="num">{s.bias}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <b>รวม</b>
                </td>
                <td className="num">
                  <b>1.09</b> (v2 = 1.14, วิธีคูณเลข = 5.17)
                </td>
                <td className="num">–</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small muted">ที่มา model_card.json · ข้อสอบ 622,200 แถว</p>
      </section>

      <section aria-labelledby="cont">
        <h2 id="cont">ตรวจความต่อเนื่อง (Continuity audit)</h2>
        <div className="grid-2">
          {REGIONS.map((r) => (
            <div className="panel" key={r}>
              <RegionContinuity region={r} />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="lim">
        <h2 id="lim">ข้อจำกัด</h2>
        {meta.isPending && <p role="status">กำลังโหลด…</p>}
        {meta.isError && <LoadError error={meta.error} onRetry={() => void meta.refetch()} />}
        {meta.data && (
          <ul>
            {meta.data.known_limitations.map((t) => (
              <li key={t} lang="en">
                {t}
              </li>
            ))}
            <li>เดือน มิ.ย.–ก.ค. 2001 Terra มีช่วงดับ ค่าจึงต่ำกว่าจริง (ยังไม่มีธงในข้อมูล)</li>
          </ul>
        )}
      </section>

      <section aria-labelledby="figs">
        <h2 id="figs">กราฟประกอบ</h2>
        <div className="figs">
          {FIGURES.map(([f, cap]) => (
            <figure key={f}>
              <a href={`/figures/${f}`} target="_blank" rel="noreferrer">
                <img src={`/figures/${f}`} alt={cap} loading="lazy" />
              </a>
              <figcaption>{cap}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="ai">
        <h2 id="ai">การใช้ AI</h2>
        <p>โค้ดและเอกสารของโปรเจกต์นี้พัฒนาโดยใช้ AI ช่วย (ตามกติกา NASA Space Apps) ตัวเลขทุกตัวมาจากข้อมูลและโมเดลที่ทีมสร้างและตรวจเอง</p>
        <Link to="/data" className="btn">
          ดาวน์โหลดข้อมูล →
        </Link>
      </section>
    </>
  );
}

function RegionContinuity({ region }: { region: Region }) {
  const q = useRegionCalendar(region);
  if (q.isPending) return <p role="status">กำลังโหลด…</p>;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return <ContinuityChart rows={q.data.rows} title={regionTh(region)} />;
}
