import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { config } from "./lib/firecalendar";
import { Layout } from "./components/layout/Layout";
import { PageErrorBoundary } from "./components/layout/ErrorBoundary";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import { ModeProvider } from "./lib/mode/provider";
import { SiteLoader } from "./components/layout/SiteLoader";

const Explore = lazy(() => import("./pages/Explore"));
const Evidence = lazy(() => import("./pages/Evidence"));
const Data = lazy(() => import("./pages/Data"));
const About = lazy(() => import("./pages/About"));
const Ask = lazy(() => import("./pages/Ask"));
const Watch = lazy(() => import("./pages/Watch"));
const Spread = lazy(() => import("./pages/Spread"));
const Simulator = lazy(() => import("./pages/Simulator"));
// ports of the two reference HTML prototypes (standalone, outside the main layout)
const Guide = lazy(() => import("./prototype/Guide"));
const Explorer = lazy(() => import("./prototype/Explorer"));

const loading = <p role="status" style={{ padding: 16 }}>Loading…</p>;

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SiteLoader />
      <ModeProvider>
      <Suspense fallback={loading}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="explore" element={<Explore />} />
            <Route path="evidence" element={<Evidence />} />
            <Route path="data" element={<Data />} />
            <Route path="about" element={<About />} />
            <Route path="watch" element={<Watch />} />
            <Route path="spread" element={<Spread />} />
            <Route path="simulator" element={<Simulator />} />
            {config.featureAsk && <Route path="ask" element={<Ask />} />}
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="guide" element={<PageErrorBoundary><Guide /></PageErrorBoundary>} />
          <Route path="prototype" element={<PageErrorBoundary><Explorer /></PageErrorBoundary>} />
        </Routes>
      </Suspense>
      </ModeProvider>
    </BrowserRouter>
  );
}
