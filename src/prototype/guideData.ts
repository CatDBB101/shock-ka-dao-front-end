// Content of reference/earth-pulse-guide.html, in English.
// METRICS: [name, in brief, what it is, how the prototype uses it, why it matters, data status]
export const METRICS: [string, string, string, string, string, string][] = [
  [
    "NDVI · vegetation index",
    "How green the vegetation is. Very green means moist; little green means dry.",
    "Unitless, −1 to 1 (shown as 0.1–0.9), computed from the red and near-infrared light plants reflect. Products MOD13Q1 (250 m, 16-day composite) and VNP13.",
    "The \"vegetation dryness\" component, weighted 35% in the risk index. Lower values mean higher risk.",
    "Dry vegetation is fuel. It shows in advance where forest will ignite easily.",
    "Real / simulated",
  ],
  [
    "LST · land surface temperature",
    "The ground's temperature. Hotter ground dries out and ignites more easily.",
    "°C, from thermal emission. MOD11A1 (1 km, daily) and VNP21 (750 m).",
    "Weighted 45% in the risk index (scaled over 30–40 °C) and shown on the area card.",
    "Heat dries fuel quickly, which makes it an early warning signal.",
    "Real / simulated",
  ],
  [
    "FRP · fire radiative power",
    "The intensity of a fire: higher means hotter and stronger.",
    "Megawatts per detection at the time of overpass, from MOD14 and VNP14IMG. It is not a temperature.",
    "Point size on the map, the \"highest FRP\" ranking and the minimum-FRP filter.",
    "Helps decide which detections to check first.",
    "Real / simulated",
  ],
  [
    "Confidence level",
    "How sure the satellite is that a detection is a real fire and not a false signal.",
    "Three classes, low / nominal / high (yellow / orange / red). The fire products provide it; the prototype's rules are simulated.",
    "The \"high confidence only\" filter and the point colour.",
    "Fewer false alarms, so crews don't waste time on fires that aren't there.",
    "Simulated",
  ],
  [
    "Hotspot count and data age",
    "How many fires there are, and when the satellite saw them.",
    "Detection count, total FRP (MW) and acquisition date. VIIRS passes around 01:30 and 13:30 local time, so fire data is at most ~12 h old.",
    "Summary cards on the firefighter view and the alert conditions.",
    "Old data may not match the fire now; you need to know when it was seen.",
    "Real / simulated",
  ],
  [
    "Wildfire risk index 0–100",
    "One score for how dangerous an area is: 0 calm, 100 extreme.",
    "0–100 = 45 × heat + 35 × dryness + 20 × fire activity (each scaled 0–1). Low < 35, moderate 35–54, high 55–74, very high ≥ 75. An active fire never scores below high.",
    "Watch-area colour, ranking and alert conditions.",
    "One number helps decisions, but the weights are hand-set, not calibrated against real fires, and wind, humidity and rain are left out.",
    "Demo formula",
  ],
  [
    "Fire days in the last 90 days",
    "How often this area burns.",
    "Days (out of 90) with at least one hotspot in the area.",
    "The area detail card.",
    "Areas that burn often deserve closer watching.",
    "Simulated",
  ],
  [
    "NTL · night-time lights",
    "Where it is bright at night, people live.",
    "nW/cm²/sr from the Day/Night Band (0.5–0.9 µm), products VNP46A1/A2 (500 m, daily). MODIS has no such band.",
    "A variable in the scientist view; not used in the risk index.",
    "Locates communities around forests, to estimate who could be affected.",
    "Real / simulated",
  ],
  [
    "Resolution and revisit",
    "How sharp the images are and how often they are taken.",
    "MODIS 250/500/1000 m, global coverage every 1–2 days, 2,330 km swath. VIIRS I-band 375 m, M-band 750 m, ~3,040 km swath.",
    "Sensor choice: VIIRS 375 m suits fire detection.",
    "Small fires are visible only when pixels are small enough.",
    "Real",
  ],
  [
    "QA · share of usable pixels",
    "Where clouds cover the image, the values can't be trusted.",
    "Percentage of pixels not obscured by cloud.",
    "The \"hide cloudy pixels\" switch and the percentage in the scientist view.",
    "Values with less cloud are more reliable (clouds in the prototype are simulated).",
    "Simulated",
  ],
  [
    "Bias and r (MODIS − VIIRS)",
    "Do the two instruments see the same thing?",
    "Bias is the mean difference (same unit as the variable); r is the correlation, −1 to 1, unitless.",
    "The sensor comparison card.",
    "Needed before joining the two records, since MODIS retires in late 2026–2027.",
    "From simulated data",
  ],
  [
    "Anomaly from the mean",
    "Is today unusual?",
    "The selected day's value minus the mean of the selected period (same unit). Not a standard multi-year baseline.",
    "A card in the scientist view.",
    "Separates real anomalies from ordinary seasonal change.",
    "From simulated data",
  ],
  [
    "Harmonized",
    "Two instruments combined into one picture.",
    "Mean of MODIS and VIIRS after an example bias adjustment (NDVI ±0.02, LST ±0.8, fire scaled by resolution).",
    "The Harmonized option on the map.",
    "Keeps the record continuous across sensors. A real product needs a validated statistical method.",
    "Demo formula",
  ],
];

// STEPS: [step, in brief, what a production system does, what this prototype does]
export const STEPS: [string, string, string, string][] = [
  [
    "Acquire and prepare data",
    "Fetch satellite granules and make them readable.",
    "Download from LAADS / Earthdata, reproject from the sinusoidal grid to WGS84, apply scale factors and fill values.",
    "Not done; data is generated from formulas.",
  ],
  [
    "Quality and cloud filtering",
    "Discard pixels hidden by cloud or flagged as bad.",
    "Decode the product QA bits, mask cloud, cloud shadow and aerosol, then count the share of usable pixels.",
    "Clouds are simulated with smooth noise and hidden by a switch.",
  ],
  [
    "Temporal compositing",
    "Combine several days into a clearer image.",
    "Build composites, e.g. 16-day NDVI, keeping the best value per pixel.",
    "MODIS NDVI is held constant for each 16-day period.",
  ],
  [
    "Gridding and tiling",
    "Cut the map into small pieces that load fast.",
    "Build a multi-zoom pyramid stored as COG / tiles in object storage; the browser loads only what is visible.",
    "Computes an on-screen grid (up to 300 columns) and draws it as an image.",
  ],
  [
    "Zonal statistics",
    "What is the mean inside the drawn area?",
    "Clip by polygon and compute area-weighted mean, median and pixel count on the server.",
    "Samples a 14 × 14 grid of points in the box and tests each for point-in-polygon.",
  ],
  [
    "Time series, calendar and anomaly",
    "How values change day by day.",
    "Aggregate daily values, compare against a multi-year baseline (2000–present) and test for trends.",
    "Uses the mean of the selected period as the baseline, over 365 days of data.",
  ],
  [
    "Sensor harmonization",
    "Make the two instruments agree.",
    "Regress over the period when both sensors overlap (VIIRS from 2012), estimating bias and gain with uncertainty.",
    "Subtracts an example bias and averages.",
  ],
  [
    "Hotspot processing",
    "Keep real fires and rank them.",
    "Ingest NRT data, filter by confidence, remove static heat sources, cluster nearby detections and sum FRP.",
    "Simulates clustered hotspots from a fire field, filtered by confidence and minimum FRP.",
  ],
  [
    "Fire risk",
    "Combine heat, dryness and fire into one score.",
    "Use meteorology (wind, humidity, rain, temperature), a standard fire-danger index or a model calibrated on fire history.",
    "A simple linear formula: heat 45%, dryness 35%, fire activity 20%.",
  ],
  [
    "Alerting",
    "Tell the people who need to know, immediately.",
    "Intersect detections with subscribed areas, de-duplicate, assign severity, and send push, LINE or SMS from an always-on server.",
    "Checks in the page, shows a banner, and can use browser notifications only while the page is open.",
  ],
  [
    "Fast rendering",
    "Draw large images without stutter.",
    "Do the heavy computation and caching on the server; use tiles and the GPU; limit the data range loaded.",
    "Uses canvas and an equal-spaced grid on the Mercator map, caching the global grid for reuse.",
  ],
];

export const FEATURES: [string, string[]][] = [
  [
    "Map and drawing",
    [
      "World map with coastlines and borders (Natural Earth 1:50m)",
      "Draw and edit polygons with Terra Draw; the red button cancels drawing",
      "Zooms to the drawn area automatically",
      "MapLibre, on desktop and mobile",
    ],
  ],
  ["Variables and sensors", ["MODIS, VIIRS and Harmonized", "NDVI, LST, fire (FRP), night-time lights", "Smooth raster heatmap matching the colour scale"]],
  [
    "Time",
    [
      "Pick a period with presets or custom dates",
      "Slider to step through days, with autoplay",
      "History chart and calendar with horizontal scroll and fixed cell size",
    ],
  ],
  [
    "Scientist view",
    ["Statistics: mean, min–max, anomaly from the mean", "Hide cloudy pixels and see the usable-pixel share", "Compare MODIS with VIIRS (bias, r)", "Copy the data as CSV"],
  ],
  [
    "Firefighter view",
    [
      "Individual hotspots sized by FRP and coloured by confidence",
      "Totals of detections and FRP, with filters",
      "Watch areas from the server, searchable and filterable by continent or country",
      "Follow an area and see details, risk index and a 14-day chart",
      "In-page alerts with guidance, plus test device notifications",
    ],
  ],
  [
    "Interface",
    [
      "Map controls as icons; each panel can collapse",
      "Left panel split into sub-pages, resizable and collapsible",
      "Panels open full screen on mobile",
      "Light and dark themes",
    ],
  ],
  [
    "Prototype limitations",
    [
      "All data is simulated and covers only 365 days",
      "No real server yet, so alerts work only while this page is open",
      "The risk index leaves out wind, humidity and rain",
      "Supports decisions; does not replace field reports",
    ],
  ],
];

export const STAGE: string[] = ["Acquire", "Clean", "Clean", "Grid", "Grid", "Analyse", "Analyse", "Analyse", "Analyse", "Deliver", "Deliver"];
