import { Link } from "react-router-dom";

/** Hidden until POST /v1/ask exists (VITE_FC_FEATURE_ASK=true shows it in the menu). */
export default function Ask() {
  return (
    <>
      <h1>ถาม FireCalendar+</h1>
      <div className="panel">
        <p>เร็วๆ นี้: ถามเป็นภาษาคน เช่น "ส.ค. 2022 ที่โรซาริโอไฟเยอะผิดปกติไหม" แล้วได้คำตอบที่ตัวเลขทุกตัวมาจากข้อมูลจริง</p>
        <Link to="/explore" className="btn">
          เปิดใน Explore
        </Link>
      </div>
    </>
  );
}
