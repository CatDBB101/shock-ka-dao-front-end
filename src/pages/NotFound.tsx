import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <>
      <h1>ไม่พบหน้านี้</h1>
      <Link to="/" className="btn">
        กลับหน้าแรก
      </Link>
    </>
  );
}
