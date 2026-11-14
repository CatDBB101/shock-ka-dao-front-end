import { Link } from "react-router-dom";
import { REGIONS, useMeta, useRegionCalendar, type Region } from "../lib/firecalendar";
import { ContinuityChart, LoadError, regionTh } from "../components/firecalendar";
import { EvidenceGallery } from "./evidence/EvidenceGallery";

// Source: model_card.json · final test set 622,200 rows (switch to /v1/meta/eval when it exists)
const SCORES: { region: string; dev: number; bias: number }[] = [
  { region: "แอฟริกา", dev: 1.98, bias: -6.8 },
  { region: "อเมริกาใต้", dev: 1.33, bias: -2.3 },
  { region: "แคนาดา + สหรัฐฯ", dev: 0.81, bias: -10.6 },
  { region: "ออสเตรเลีย", dev: 1.28, bias: 1.5 },
];
const DEV_MAX = 2.2;
const BIAS_MAX = 12;
const fmtBias = (b: number) => `${b > 0 ? "+" : b < 0 ? "−" : ""}${Math.abs(b).toFixed(1)}%`;

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
          <table className="fc-table score-table">
            <caption className="sr-only">คะแนนรายภูมิภาคบนข้อสอบปลายภาค</caption>
            <thead>
              <tr>
                <th>ภูมิภาค</th>
                <th>Poisson deviance (ยิ่งสั้นยิ่งดี)</th>
                <th>ทายเกิน / ขาดรวม</th>
              </tr>
            </thead>
            <tbody>
              {SCORES.map((s) => (
                <tr key={s.region}>
                  <td>{s.region}</td>
                  <td>
                    <span className="score-bar">
                      <i style={{ width: `${(s.dev / DEV_MAX) * 100}%` }} />
                      <b className="num">{s.dev.toFixed(2)}</b>
                    </span>
                  </td>
                  <td>
                    <span className={`bias-bar ${s.bias < 0 ? "under" : "over"}`}>
                      <i style={{ width: `${(Math.abs(s.bias) / BIAS_MAX) * 50}%` }} />
                      <b className="num">{fmtBias(s.bias)}</b>
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="score-total">
                <td>
                  <b>รวม</b>
                </td>
                <td>
                  <span className="score-bar">
                    <i style={{ width: `${(1.09 / DEV_MAX) * 100}%` }} />
                    <b className="num">1.09</b>
                  </span>
                  <span className="small muted">v2 ได้ 1.14 และวิธีคูณเลขได้ 5.17 (ยาวเกินสเกล)</span>
                </td>
                <td className="muted">–</td>
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

      <section aria-labelledby="figs" className="lt-section">
        <div className="lt-head">
          <h2 id="figs">ห้องกราฟหลักฐาน</h2>
          <p className="muted">กราฟจริงจากขั้นตอนสร้างโมเดล เรียงตามเรื่อง ปัญหา การทดสอบ จุดอ่อน และผลลัพธ์ กดภาพเพื่อดูขนาดใหญ่ พร้อมคำอธิบายว่าควรดูตรงไหน</p>
        </div>
        <EvidenceGallery />
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
