import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <>
      <h1>Page Not Found</h1>
      <Link to="/" className="btn">
        Back to Home
      </Link>
    </>
  );
}
