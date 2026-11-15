// Evidence figures manifest — one place for every figure's provenance and the honest claim it supports.
// Captions describe exactly what each PNG shows (checked by eye against the image, 2026-11-14):
// 12_* and 13_* are model-selection plots of M1v2 on cross-validation folds, NOT the final v3 test.

export type Chapter = "problem" | "test" | "weakness" | "result";

export const CHAPTER_TH: Record<Chapter, string> = {
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
    title: "The 2012 break",
    takeaway: "VIIRS counts 3–5× more fires than MODIS in every region. Splice the two directly and fire appears to jump in 2012",
    look: [
      "The blue line (MODIS) sits below the orange line (VIIRS S-NPP) throughout the overlap",
      "The dashed green NOAA-20 line almost overlays S-NPP, so the problem is MODIS versus VIIRS, not between VIIRS satellites",
      "The vertical axis is logarithmic: a constant gap means a constant ratio",
    ],
    validation: "Exploratory analysis (EDA)",
    models: "No model yet",
    source: "EDA stage · FIRMS SP data, all 6 countries",
    alt: "Log-scale line chart of annual fire detections in four regions; MODIS is about 3 to 5 times below VIIRS",
  },
  {
    id: "compare",
    file: "12_model_comparison.png",
    w: 724,
    h: 436,
    chapter: "test",
    title: "Beat the simple methods first",
    takeaway: "LightGBM (M1v2) has about 4.5× less error than a single multiplier on held-out areas and years",
    look: [
      "B0 and B1 multiply MODIS by a constant and score about 5.7",
      "B2, a plain regression, scores about 2.0; M1v2 scores 1.27",
      "Black ticks show spread across the 4 test folds; B2 and M1v2 do not overlap",
      "This chart predates v3, chosen later (CV 1.21, final test 1.09)",
    ],
    validation: "4-fold area × year blocked CV",
    models: "B0, B1, B2, M1v1, M1v2",
    source: "Model selection · DEV rows only, final test untouched",
    alt: "Bar chart of Poisson deviance for five methods: B0 and B1 about 5.7, B2 about 2.0, M1v1 about 1.5, M1v2 about 1.3",
  },
  {
    id: "bias",
    file: "13_bias_by_modis_size.png",
    w: 930,
    h: 481,
    chapter: "weakness",
    title: "Where the model is still biased",
    takeaway: "Cells where MODIS sees very dense fire (over 200 detections) are overpredicted, and Canada + US is underpredicted for mid-sized fires",
    look: [
      "Australia and Africa jump in the >200 bin (about 25% and 19% over)",
      "The green Canada + US line bottoms out near −17% in the 11–50 bin",
      "Zero means unbiased; points far from it are where to be careful",
    ],
    validation: "Area × year blocked CV (out-of-fold)",
    models: "M1v2",
    source: "Error analysis · DEV rows",
    alt: "Line chart of bias by MODIS detections per cell; Australia and Africa overpredict above 200, Canada underpredicts at 11 to 50",
  },
  {
    id: "recon",
    file: "12_calendar_reconstruction.png",
    w: 1828,
    h: 452,
    chapter: "test",
    title: "Backcast versus reality",
    takeaway: "Monthly totals converted from MODIS overlay measured VIIRS on held-out areas and years, except unusually large fire months",
    look: [
      "Black dots are measured VIIRS, the orange line is M1v2 from MODIS, the thin grey line is the B1 multiplier",
      "Canada + US in 2014 has black dots well above the line: large fire months that are underpredicted",
      "The long straight segment for Africa in 2022–2024 spans months with no test data; it only joins the gap",
    ],
    validation: "Held-out areas and years",
    models: "M1v2, B1",
    source: "Model selection · aggregated to region",
    alt: "Line chart of monthly fire detections 2013 to 2024 in four regions; values converted from MODIS overlay measured VIIRS almost everywhere",
  },
  {
    id: "continuity",
    file: "15_continuity_audit.png",
    w: 1846,
    h: 452,
    chapter: "result",
    title: "The seam disappears",
    takeaway: "After calibration the annual line runs continuously through 2012 in all 4 regions, and the model's VIIRS-era predictions overlay the measurements",
    look: [
      "Grey is raw MODIS, orange is FireFirm, with no jump at the dashed 2012 line",
      "The pale orange band before 2012 is the ~80% uncertainty range",
      "The dotted blue line is the model over years with real VIIRS; overlaying orange means the model is not drifting",
    ],
    validation: "Continuity over the full period",
    models: "v3 (the model on this site)",
    source: "05b_continuity_fig.py · served data",
    alt: "Line chart of annual fire detections 2001 to 2024 in four regions; the calibrated line is continuous through 2012",
  },
];
