// "Light table" gallery: each figure is a print on a night mount, read in story order
// (problem → test → weakness → result). Opening one shows it large with what to look at,
// how it was validated, and where it came from. Native <dialog> = focus trap + Esc for free.
import { useCallback, useEffect, useRef, useState } from "react";
import { CHAPTER_EN, FIGURES, type EvidenceFigure } from "./figures";

const src = (f: EvidenceFigure) => `/figures/${f.file}`;

export function EvidenceGallery() {
  const [open, setOpen] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const show = (i: number, el: HTMLElement) => {
    opener.current = el;
    setOpen(i);
  };
  const close = useCallback(() => dlg.current?.close(), []);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open != null && !d.open) d.showModal();
  }, [open]);

  return (
    <>
      <ol className="lt-grid" aria-label="Evidence figures in story order">
        {FIGURES.map((f, i) => (
          <li key={f.id} className={`lt-item ${f.w / f.h > 3 ? "is-wide" : "is-narrow"} ch-${f.chapter}`}>
            <button type="button" className="lt-card" onClick={(e) => show(i, e.currentTarget)} aria-label={`Open figure ${i + 1}: ${f.title}`}>
              <span className="lt-meta">
                <span className="lt-step">{i + 1}</span>
                <span className="lt-chapter">{CHAPTER_EN[f.chapter]}</span>
                <span className="lt-valid">{f.validation}</span>
              </span>
              <span className="lt-print" style={{ aspectRatio: `${f.w} / ${f.h}` }}>
                <img src={src(f)} alt={f.alt} width={f.w} height={f.h} loading="lazy" decoding="async" />
              </span>
              <span className="lt-title">{f.title}</span>
              <span className="lt-take">{f.takeaway}</span>
            </button>
          </li>
        ))}
      </ol>

      <dialog
        ref={dlg}
        className="lt-box"
        aria-labelledby="lt-box-title"
        onClose={() => {
          setOpen(null);
          opener.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close(); // backdrop click
        }}
      >
        {open != null && <Viewer key={open} index={open} onIndex={setOpen} onClose={close} />}
      </dialog>
    </>
  );
}

function Viewer({ index, onIndex, onClose }: { index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const f = FIGURES[index]!;
  const n = FIGURES.length;
  const [zoom, setZoom] = useState(false);
  const go = useCallback((d: number) => onIndex((index + d + n) % n), [index, n, onIndex]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go]);

  return (
    <div className={`lt-view ch-${f.chapter}`}>
      <header className="lt-view-head">
        <span className="lt-count num">
          {index + 1} / {n}
        </span>
        <span className="lt-chapter">{CHAPTER_EN[f.chapter]}</span>
        <h2 id="lt-box-title">{f.title}</h2>
        <button type="button" className="lt-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="lt-view-body">
        <div className={`lt-stage${zoom ? " is-zoom" : ""}`}>
          <button type="button" className="lt-zoom" onClick={() => setZoom((z) => !z)} aria-pressed={zoom}>
            {zoom ? "Fit to screen" : "Actual size"}
          </button>
          <div className="lt-stage-scroll" tabIndex={zoom ? 0 : -1} aria-label={zoom ? "Scroll to view actual-size figure" : undefined}>
            <img key={f.id} src={src(f)} alt={f.alt} width={f.w} height={f.h} />
          </div>
        </div>

        <aside className="lt-notes">
          <p className="lt-take-lg">{f.takeaway}</p>
          <h3>What to look at</h3>
          <ul>
            {f.look.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <dl className="lt-prov">
            <div>
              <dt>Validation</dt>
              <dd>{f.validation}</dd>
            </div>
            <div>
              <dt>Models in figure</dt>
              <dd>{f.models}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{f.source}</dd>
            </div>
          </dl>
          <a className="small" href={src(f)} target="_blank" rel="noreferrer">
            Open original image file
          </a>
        </aside>
      </div>

      <nav className="lt-strip" aria-label="Select figure">
        <button type="button" className="lt-nav" onClick={() => go(-1)} aria-label="Previous figure">
          ‹
        </button>
        {FIGURES.map((g, i) => (
          <button
            key={g.id}
            type="button"
            className={`lt-thumb ch-${g.chapter}`}
            aria-current={i === index ? "true" : undefined}
            aria-label={`${i + 1}: ${g.title}`}
            onClick={() => onIndex(i)}
          >
            <img src={src(g)} alt="" />
          </button>
        ))}
        <button type="button" className="lt-nav" onClick={() => go(1)} aria-label="Next figure">
          ›
        </button>
      </nav>
    </div>
  );
}