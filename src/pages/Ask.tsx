import { Link } from "react-router-dom";

/** Hidden until POST /v1/ask exists (VITE_FC_FEATURE_ASK=true shows it in the menu). */
export default function Ask() {
  return (
    <>
      <h1>Ask FireCalendar+</h1>
      <div className="panel">
        <p>Coming soon: ask in plain language like "Was August 2022 fire unusual in Rosario?" and get answers where every number comes from real data.</p>
        <Link to="/explore" className="btn">
          Open in Explore
        </Link>
      </div>
    </>
  );
}
