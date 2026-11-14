// React port of reference/earth-pulse-guide.html (Earth Pulse prototype explainer).
import { Link } from "react-router-dom";
import { FEATURES, METRICS, STAGE, STEPS } from "./guideData";
import "./guide.css";

const RG = "linear-gradient(90deg,#3fa96b,#ffd60a,#ff9f0a,#ff3b30)";
const HG = "linear-gradient(90deg,#ffd60a,#ff9f0a,#ff3b30)";
/** colour strip per metric index: [low label, high label, gradient] */
const STRIPS: Record<number, [string, string, string]> = {
  0: ["แห้ง", "เขียวสด", "linear-gradient(90deg,#b08a3e,#3fa96b)"],
  1: ["เย็น", "ร้อน", "linear-gradient(90deg,#3b6fd6,#ffd60a,#ff3b30)"],
  2: ["อ่อน", "แรง", HG],
  3: ["ต่ำ", "สูง", HG],
  5: ["0 สบายใจ", "100 ระวังที่สุด", RG],
  6: ["ไม่เคย", "บ่อย", HG],
  7: ["มืด", "สว่าง", "linear-gradient(90deg,#0b1320,#ffd60a)"],
  9: ["เมฆบังมาก", "ใส", "linear-gradient(90deg,#9aa5ad,#52c0e6)"],
};

const Arrowhead = () => (
  <defs>
    <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0 0L10 5L0 10z" className="mk" />
    </marker>
  </defs>
);

function MetricsInfographic() {
  const boxes: [number, string, string, string, string][] = [
    [145, "#b08a3e", "NDVI", "ต้นไม้เขียวหรือแห้ง?", "แห้ง = เสี่ยง"],
    [295, "#e8863a", "LST", "พื้นดินร้อนแค่ไหน?", "ร้อนมาก = เสี่ยง"],
    [445, "#ff3b30", "FRP", "มีไฟไหม้อยู่ไหม?", "เจอไฟ = ระวังสุด"],
  ];
  const levels: [number, number, string, string][] = [
    [40, 55, "#ff3b30", "สูงมาก ≥75"],
    [95, 44, "#ff9f0a", "สูง 55–74"],
    [139, 44, "#ffd60a", "ปานกลาง 35–54"],
    [183, 77, "#3fa96b", "ต่ำ <35"],
  ];
  return (
    <div className="info">
      <svg viewBox="0 0 800 300" role="img" aria-label="ดาวเทียมวัดต้นไม้ ความร้อน และไฟ แล้วรวมเป็นคะแนนเสี่ยง 0 ถึง 100">
        <Arrowhead />
        <rect x="48" y="30" width="32" height="26" rx="4" fill="#8aa0b0" />
        <rect x="14" y="38" width="30" height="10" fill="#52c0e6" />
        <rect x="84" y="38" width="30" height="10" fill="#52c0e6" />
        <path className="ln" d="M64 30v-12" />
        <circle cx="64" cy="16" r="3" fill="#ff6b5e" />
        <text className="t" x="64" y="86" textAnchor="middle">ดาวเทียม</text>
        <text className="s" x="64" y="104" textAnchor="middle">มองจากฟ้า</text>
        <path className="ln" strokeDasharray="5 4" d="M80 58L210 72M80 58L360 72M80 58L510 72" />
        {boxes.map(([x, c, a, b, d]) => (
          <g key={a}>
            <rect className="bx" x={x} y="72" width="130" height="150" rx="10" />
            <rect x={x} y="72" width="130" height="5" rx="2" fill={c} />
            <text className="t" x={x + 65} y="156" textAnchor="middle">{a}</text>
            <text className="s" x={x + 65} y="176" textAnchor="middle">{b}</text>
            <text className="s" x={x + 65} y="204" textAnchor="middle" style={{ fill: c }}>{d}</text>
          </g>
        ))}
        <rect x="195" y="108" width="7" height="20" fill="#7a5a2e" />
        <circle cx="198" cy="100" r="15" fill="#3fa96b" />
        <rect x="222" y="112" width="6" height="16" fill="#7a5a2e" />
        <circle cx="225" cy="105" r="12" fill="#b08a3e" />
        <rect x="354" y="92" width="10" height="34" rx="5" fill="none" stroke="var(--mu)" strokeWidth="2" />
        <circle cx="359" cy="132" r="10" fill="#ff3b30" />
        <rect x="357" y="104" width="4" height="26" fill="#ff3b30" />
        <path d="M510 88c6 10 17 15 17 30a17 17 0 0 1-34 0c0-9 4-13 8-17 0 7 3 10 6 10 0-9-2-15 3-23z" fill="#ff3b30" />
        <path d="M510 112c3 5 8 7 8 13a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 2 5 4 5z" fill="#ffd60a" />
        <text className="s" x="145" y="238">น้ำหนักของแต่ละเรื่องในคะแนนเสี่ยง</text>
        <rect x="145" y="244" width="150.5" height="28" fill="#b08a3e" />
        <rect x="295.5" y="244" width="193.5" height="28" fill="#e8863a" />
        <rect x="489" y="244" width="86" height="28" fill="#ff3b30" />
        <text className="w" x="220" y="263" textAnchor="middle">ความแห้ง 35%</text>
        <text className="w" x="392" y="263" textAnchor="middle">ความร้อน 45%</text>
        <text className="w" x="532" y="263" textAnchor="middle">ไฟ 20%</text>
        <path className="ar" d="M578 258C612 258 622 228 644 214" />
        <text className="t" x="670" y="28" textAnchor="middle">คะแนนเสี่ยง 0–100</text>
        {levels.map(([y, h, c, l]) => (
          <g key={l}>
            <rect x="650" y={y} width="40" height={h} fill={c} />
            <text className="s" x="698" y={y + h / 2 + 4}>{l}</text>
          </g>
        ))}
      </svg>
      <div className="cap">
        อ่านจากซ้ายไปขวา: ดาวเทียมวัด 3 เรื่อง แต่ละเรื่องมีน้ำหนักไม่เท่ากัน แล้วรวมเป็นคะแนนเดียว สีของแท่งขวาบอกระดับความเสี่ยง (น้ำหนักเป็นค่าสาธิตของต้นแบบ)
      </div>
    </div>
  );
}

function PipelineInfographic() {
  const flow: [string, string, string][] = [
    ["1", "ซื้อวัตถุดิบ", "ดึงข้อมูลจากดาวเทียม"],
    ["2", "ล้างและคัด", "กรองเมฆ · รวมหลายวัน"],
    ["3", "หั่นพอดีคำ", "ทำ tile · สถิติตามพื้นที่"],
    ["4", "ปรุง", "อนุกรมเวลา · ปรับเซนเซอร์ · จุดไฟ · ความเสี่ยง"],
    ["5", "เสิร์ฟ", "แจ้งเตือน · แสดงผล"],
  ];
  return (
    <div className="info">
      <div className="flow">
        {flow.map(([n, a, b]) => (
          <div className="st" key={n}>
            <b>
              {n}. {a}
            </b>
            {b}
          </div>
        ))}
      </div>
      <svg viewBox="0 0 800 230" role="img" aria-label="ข้อมูลเดินทางจากดาวเทียมผ่านเซิร์ฟเวอร์ไปยังเบราว์เซอร์และมือถือของผู้ใช้">
        <Arrowhead />
        <rect className="bx" x="10" y="60" width="130" height="70" rx="10" />
        <text className="t" x="75" y="90" textAnchor="middle">ดาวเทียม</text>
        <text className="s" x="75" y="110" textAnchor="middle">MODIS · VIIRS</text>
        <rect className="bx" x="215" y="40" width="210" height="110" rx="10" style={{ stroke: "var(--ac)", strokeWidth: 2 }} />
        <text className="t" x="320" y="66" textAnchor="middle">เซิร์ฟเวอร์</text>
        <text className="s" x="320" y="90" textAnchor="middle">ดึง · กรองเมฆ · รวมวัน</text>
        <text className="s" x="320" y="110" textAnchor="middle">ทำ tile · สถิติตามพื้นที่</text>
        <text className="s" x="320" y="130" textAnchor="middle">ตรวจจุดไฟ · ส่งแจ้งเตือน</text>
        <rect className="bx" x="500" y="60" width="140" height="70" rx="10" style={{ stroke: "var(--fire)", strokeWidth: 2 }} />
        <text className="t" x="570" y="90" textAnchor="middle">เบราว์เซอร์</text>
        <text className="s" x="570" y="110" textAnchor="middle">แผนที่ กราฟ ปฏิทิน</text>
        <rect className="bx" x="690" y="60" width="100" height="70" rx="10" />
        <text className="t" x="740" y="90" textAnchor="middle">มือถือ</text>
        <text className="s" x="740" y="110" textAnchor="middle">ผู้ใช้งาน</text>
        <path className="ar" d="M140 95H212" />
        <path className="ar" d="M425 95H497" />
        <path className="ar" d="M640 95H687" />
        <rect className="bx" x="215" y="168" width="210" height="50" rx="8" style={{ stroke: "var(--ac)" }} />
        <text className="s" x="320" y="190" textAnchor="middle">ระบบจริง: ทำงานตลอดเวลา</text>
        <text className="s" x="320" y="208" textAnchor="middle">แม้ไม่มีใครเปิดหน้าเว็บ</text>
        <rect className="bx" x="440" y="168" width="350" height="50" rx="8" style={{ stroke: "var(--fire)" }} />
        <text className="s" x="615" y="190" textAnchor="middle">ต้นแบบ: สร้างข้อมูลจำลองและคำนวณทั้งหมด</text>
        <text className="s" x="615" y="208" textAnchor="middle">ในเบราว์เซอร์นี้ ยังไม่มีเซิร์ฟเวอร์จริง</text>
      </svg>
      <div className="cap">กรอบน้ำเงินคือสิ่งที่ระบบจริงต้องมี กรอบแดงคือสิ่งที่ต้นแบบทำแทนทั้งหมดในหน้าเว็บ</div>
    </div>
  );
}

export default function Guide() {
  return (
    <div className="ep-guide">
      <header>
        <p className="mu" style={{ margin: "0 0 8px" }}>
          <Link to="/">← FireCalendar+</Link> · <Link to="/prototype">เปิดต้นแบบ Explorer</Link>
        </p>
        <h1>Earth Pulse: คู่มืออธิบายต้นแบบ</h1>
        <div className="mu">ดาวเทียม MODIS และ VIIRS สำหรับงานเฝ้าระวังไฟป่า · อธิบายให้เด็กประถมอ่านเข้าใจ</div>
        <div className="warn">
          ตัวเลขทั้งหมดในต้นแบบเป็นข้อมูลจำลอง (mock) ไม่ใช่ค่าจากดาวเทียมจริง สูตรดัชนีเสี่ยงเป็นสูตรที่ตั้งขึ้นเพื่อสาธิต ยังไม่ผ่านการตรวจสอบกับข้อมูลไฟจริง
        </div>
      </header>
      <nav aria-label="หัวข้อ">
        <div>
          <a href="#s1">1 ค่าทางวิทยาศาสตร์</a>
          <a href="#s2">2 การคำนวณเบื้องหลัง</a>
          <a href="#s3">3 สิ่งที่ต้นแบบทำได้</a>
        </div>
      </nav>
      <main>
        <section id="s1">
          <h2>1. ค่าทางวิทยาศาสตร์ที่ต้นแบบใช้</h2>
          <div className="kid">
            <b>อธิบายง่ายๆ</b>ดาวเทียมเป็นเหมือนกล้องถ่ายรูปบนฟ้า มันไม่ได้บอกว่า “ไฟไหม้” ตรงๆ แต่วัดสิ่งต่างๆ เช่น ต้นไม้เขียวแค่ไหน พื้นดินร้อนแค่ไหน
            และมีจุดร้อนแรงตรงไหน แล้วเรานำตัวเลขเหล่านี้มาช่วยเดาว่าป่าตรงไหนเสี่ยง หรือไฟกำลังไหม้อยู่ตรงไหน
          </div>
          <MetricsInfographic />
          <div className="grid">
            {METRICS.map(([name, kid, what, use, why, tag], i) => (
              <div className="card" key={name}>
                <h3>
                  {name}
                  <span className="tag">{tag}</span>
                </h3>
                <div className="k">พูดง่ายๆ: {kid}</div>
                {STRIPS[i] && (
                  <div>
                    <div className="strip" style={{ background: STRIPS[i][2] }} />
                    <div className="sl">
                      <span>{STRIPS[i][0]}</span>
                      <span>{STRIPS[i][1]}</span>
                    </div>
                  </div>
                )}
                <dl>
                  <dt>คืออะไร</dt>
                  <dd>{what}</dd>
                  <dt>ใช้ทำอะไร</dt>
                  <dd>{use}</dd>
                  <dt>ทำไมต้องมี</dt>
                  <dd>{why}</dd>
                </dl>
              </div>
            ))}
          </div>
        </section>
        <section id="s2">
          <h2>2. การคำนวณทางเทคนิคเบื้องหลัง</h2>
          <div className="kid">
            <b>อธิบายง่ายๆ</b>ให้คิดเหมือนทำอาหาร: ไปซื้อวัตถุดิบ (ดาวน์โหลดภาพ) ล้างและคัดของเสียออก (กรองเมฆ) หั่นให้พอดีคำ (ตัดเป็นช่อง) ปรุง (คำนวณคะแนน)
            แล้วเสิร์ฟทันเวลา (แจ้งเตือน) แต่ละขั้นต้องทำถูก อาหารจานสุดท้ายถึงจะอร่อยและปลอดภัย
          </div>
          <div className="mu">ในแต่ละขั้น กรอบน้ำเงินคือสิ่งที่ระบบจริงต้องทำ กรอบแดงคือสิ่งที่ต้นแบบนี้ทำอยู่ตอนนี้</div>
          <PipelineInfographic />
          <div className="steps" style={{ marginTop: 12 }}>
            {STEPS.map(([name, kid, real, proto], i) => (
              <div className="step" key={name}>
                <h3>
                  {name}
                  <span className="tag">ช่วง: {STAGE[i]}</span>
                </h3>
                <div className="mu">พูดง่ายๆ: {kid}</div>
                <div className="cols">
                  <div className="real">
                    <b>ระบบจริงต้องทำ</b>
                    {real}
                  </div>
                  <div className="proto">
                    <b>ต้นแบบนี้ทำ</b>
                    {proto}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section id="s3">
          <h2>3. สรุปสิ่งที่ต้นแบบทำได้</h2>
          <div className="kid">
            <b>อธิบายง่ายๆ</b>ต้นแบบนี้เหมือนกล่องเครื่องมือของคนเฝ้าป่า มีแผนที่โลกให้ดู มีปฏิทินและกราฟดูย้อนหลัง
            มีโหมดสำหรับนักวิทยาศาสตร์ที่อยากรู้ว่าตัวเลขเชื่อถือได้แค่ไหน และมีโหมดสำหรับนักดับเพลิงที่อยากรู้ว่าไฟอยู่ตรงไหนและควรไปที่ไหนก่อน
          </div>
          <div className="grid">
            {FEATURES.map(([name, items]) => (
              <div className="card" key={name}>
                <h3>{name}</h3>
                <ul>
                  {items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer>
        แหล่งข้อมูลเซนเซอร์อ้างอิงจากเอกสารสรุป MODIS และ VIIRS ที่ผู้ใช้ให้มา (NASA LAADS / Earthdata) ส่วนสูตรดัชนีเสี่ยงและค่าปรับ bias เป็นค่าสาธิตของต้นแบบ
      </footer>
    </div>
  );
}
