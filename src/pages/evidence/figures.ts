// Evidence figures manifest — one place for every figure's provenance and the honest claim it supports.
// Captions describe exactly what each PNG shows (checked by eye against the image, 2026-11-14):
// 12_* and 13_* are model-selection plots of M1v2 on cross-validation folds, NOT the final v3 test.

export type Chapter = "problem" | "test" | "weakness" | "result";

export const CHAPTER_EN: Record<Chapter, string> = {
  problem: "Problem",
  test: "Test",
  weakness: "Weakness",
  result: "Result",
};

export interface EvidenceFigure {
  id: string;
  file: string;
  /** intrinsic pixel size, for aspect ratio + no layout shift */
  w: number;
  h: number;
  chapter: Chapter;
  title: string;
  /** one sentence: what this figure proves (or doesn't) */
  takeaway: string;
  /** where to look */
  look: string[];
  /** how it was validated — shown as a badge */
  validation: string;
  /** which model(s) appear */
  models: string;
  /** pipeline step that produced it */
  source: string;
  alt: string;
}

export const FIGURES: EvidenceFigure[] = [
  {
    id: "seam",
    file: "02_seam_annual_counts.png",
    w: 1754,
    h: 431,
    chapter: "problem",
    title: "The 2012 Break",
    takeaway: "VIIRS counts 3–5× more fire points than MODIS in every region. If you splice the two series directly, fire appears to jump in 2012.",
    look: [
      "Blue line (MODIS) sits below orange line (VIIRS S-NPP) throughout the overlap period",
      "Green dashed line (NOAA-20) nearly overlaps S-NPP — the problem is MODIS vs VIIRS, not between VIIRS satellites",
      "Log scale on Y axis means equal vertical gaps = constant ratios",
    ],
    validation: "Exploratory Data Analysis (EDA)",
    models: "No model yet",
    source: "EDA step · FIRMS SP data for all 6 countries",
    alt: "Log-scale annual fire point line charts for 4 regions. MODIS is 3–5× lower than VIIRS.",
  },
  {
    id: "compare",
    file: "12_model_comparison.png",
    w: 724,
    h: 436,
    chapter: "test",
    title: "Compared to Simple Baselines",
    takeaway: "LightGBM (M1v2) has ~4.5× lower error than a single multiplier on area-and-year held-out data.",
    look: [
      "B0, B1 = multiply MODIS by a constant. Error ~5.7",
      "B2 = ordinary regression. Error ~2.0. M1v2 = 1.27",
      "Black bars = variance across 4 test folds. B2 and M1v2 error bars don't overlap",
      "This plot doesn't include v3, which was chosen later (CV 1.21, held-out 1.09)",
    ],
    validation: "4-fold CV blocking by region × year",
    models: "B0, B1, B2, M1v1, M1v2",
    source: "Model selection step · DEV rows only, held-out test not touched",
    alt: "Bar chart of Poisson deviance for 5 methods. B0 B1 ~5.7, B2 ~2.0, M1v1 ~1.5, M1v2 ~1.3",
  },
  {
    id: "bias",
    file: "13_bias_by_modis_size.png",
    w: 930,
    h: 481,
    chapter: "weakness",
    title: "Where the Model Still Has Bias",
    takeaway: "Cells where MODIS sees very dense fires (>200 pts) are over-predicted; Canada + USA under-predicted in medium fire years.",
    look: [
      "Australia and Africa spike up at >200 group (over-predicted by ~25% and ~19%)",
      "Green line (Canada + USA) drops to ~−17% at the 11–50 group",
      "Zero line = perfect prediction. Points far from this line need caution",
    ],
    validation: "Region×year blocked CV (out-of-fold)",
    models: "M1v2",
    source: "Error analysis step · DEV rows",
    alt: "Line chart of bias by MODIS points per cell. Australia and Africa over-predict at >200 pts. Canada under-predicts at 11–50 pts.",
  },
  {
    id: "recon",
    file: "12_calendar_reconstruction.png",
    w: 1828,
    h: 452,
    chapter: "test",
    title: "Backcast vs Reality",
    takeaway: "Monthly totals converted from MODIS overlay actual VIIRS in held-out regions and years, except for anomalous extreme fire months.",
    look: [
      "Black dots = actual VIIRS. Orange line = M1v2 converted from MODIS. Thin grey line = B1 multiplier",
      "Canada + USA 2014 has black dots floating above the line — those are extreme fire months that were under-predicted",
      "Long straight segments in Africa 2022–2024 are periods with no test months — lines just connect across gaps",
    ],
    validation: "Held-out regions and years",
    models: "M1v2, B1",
    source: "Model selection step · Regional totals",
    alt: "Monthly fire point line charts 2013–2024 for 4 regions. MODIS-converted values overlay actual VIIRS almost everywhere.",
  },
  {
    id: "continuity",
    file: "15_continuity_audit.png",
    w: 1846,
    h: 452,
    chapter: "result",
    title: "The Seam Disappears",
    takeaway: "After harmonization, the annual series is continuous across 2012 in all 4 regions, and model predictions in VIIRS years overlay actual values.",
    look: [
      "Grey line = raw MODIS. Orange line = FireCalendar+. No jump at the dashed 2012 line",
      "Light orange band before 2012 = ~80% uncertainty interval",
      "Blue dashed line = model values in years with actual VIIRS. If it overlays the orange line, the model is accurate",
    ],
    validation: "Full-period continuity check",
    models: "v3 (model served on the web)",
    source: "05b_continuity_fig.py · Served data",
    alt: "Annual fire point line charts 2001–2024 for 4 regions. Harmonized line is continuous across 2012.",
  },
];