// Content of reference/earth-pulse-guide.html (extracted verbatim)
export const METRICS: [string, string, string, string, string, string][] = [
 [
  "NDVI Vegetation Index",
  "Measures how green/lush the trees are. Very green = moist. Less green = dry.",
  "Unitless value −1 to 1 (app shows 0.1–0.9). Calculated from red and near-infrared light reflected by vegetation. Products: MOD13Q1 (250 m, 16-day composite) and VNP13.",
  "The 'vegetation dryness' component, weight 35% in the risk index. Lower = more risk.",
  "Dry vegetation is fire fuel. Helps know in advance which forest areas ignite easily.",
  "Real/Mock"
 ],
 [
  "LST Land Surface Temperature",
  "Like a fever for the ground. Hotter = drier and easier to ignite.",
  "Unit °C. Measured from thermal radiation. MOD11A1 (1 km, daily) and VNP21 (750 m).",
  "Weight 45% in the risk index (scale 30–40 °C) and shown in area cards.",
  "Hot air dries fuel faster. Early warning signal.",
  "Real/Mock"
 ],
 [
  "FRP Fire Radiative Power",
  "Strength of a fire. Higher = more intense heat.",
  "Unit MW (megawatts) per detected point at satellite overpass. From MOD14 and VNP14IMG. Not a temperature.",
  "Point size on map, 'highest FRP' ranking, and minimum FRP filter.",
  "Helps decide which fire points to investigate first.",
  "Real/Mock"
 ],
 [
  "Confidence Level",
  "Satellite says how confident it is that this is a real fire, not a false alarm.",
  "3 levels: low/medium/high (yellow/orange/red). Fire products include this, but rules in the prototype are simulated.",
  'Filter "high confidence only" and point colour.',
  "Reduces false alerts. People don't waste time checking fake fires.",
  "Mock"
 ],
 [
  "Hotspot Count and Data Age",
  "Count of active fires and when the satellite saw them.",
  "Number of points, total FRP (MW), date. VIIRS passes around 01:30 and 13:30 local time. Fire data every ≤12 hours.",
  "Summary cards on the Firefighter page and alert conditions.",
  "Old data may not match the current fire situation. Need to know when it was observed.",
  "Real/Mock"
 ],
 [
  "Fire Risk Index 0–100",
  "A scariness score for that forest area. 0 = relaxed, 100 = maximum alert.",
  "0–100 = 45×heat + 35×dryness + 20×fire activity (each scaled 0–1). Levels: Low <35, Moderate 35–54, High 55–74, Very High ≥75. If fire detected, never below 'High'.",
  "Colour of watch areas, ranking, and alert triggers.",
  "Combines multiple factors into one number for decisions. Weights are set manually, not calibrated to real data, and do not include wind, humidity, or rain.",
  "Demo formula"
 ],
 [
  "Fire Days in 90 Days",
  "Has this area had fires frequently?",
  "Unit: days (out of 90). Counts days with at least one hotspot in the area.",
  "Area detail cards.",
  "Areas with frequent fires should be watched more closely.",
  "Mock"
 ],
 [
  "NTL Night-time Lights",
  "Where is it bright at night? That means people live there.",
  "Unit nW/cm²/sr from Day/Night Band (0.5–0.9 µm). Product VNP46A1/A2 (500 m, daily). MODIS has no equivalent band.",
  "Variable in Scientist view, not yet used in risk index.",
  "Shows settlements near forests. Helps assess who might be affected.",
  "Real/Mock"
 ],
 [
  "Resolution and Frequency",
  "How detailed is the imagery and how often is it captured?",
  "MODIS 250/500/1000 m. Global coverage every 1–2 days. Swath 2,330 km. VIIRS I-band 375 m, M-band 750 m. Swath ~3,040 km.",
  "Use VIIRS 375 m for fire detection.",
  "Small fires only visible when resolution is sufficient.",
  "Real"
 ],
 [
  "QA: Percentage of Pixels Passing Criteria",
  "If clouds cover the image, we shouldn't trust that area.",
  "Unit: % of pixels not covered by clouds.",
  "Toggle to hide cloud-covered pixels and % value in Scientist view.",
  "Values with less cloud cover are more reliable (clouds in prototype are simulated).",
  "Mock"
 ],
 [
  "Bias and r (MODIS − VIIRS)",
  "Do the two cameras see the same thing?",
  "Bias = mean difference (same units as variable). r = correlation −1 to 1, unitless.",
  "Sensor comparison cards.",
  "Must know before combining two sensors because MODIS retires in 2026–2027.",
  "Calculated from mock data"
 ],
 [
  "Deviation from Mean",
  "Is today abnormal compared to normal?",
  "Selected day value minus mean of selected period (same units as variable). Not a standard multi-year climatological mean.",
  "Cards in Scientist view.",
  "Helps separate anomalies from seasonal changes.",
  "Calculated from mock data"
 ],
 [
  "Harmonized",
  "Merge imagery from two cameras into one.",
  "Average MODIS and VIIRS after adjusting differences (NDVI ±0.02, LST ±0.8, fire scaled by resolution). Sample values shown.",
  "Harmonized toggle on map.",
  "Makes data continuous even when switching sensors. Real implementation needs statistically validated methods.",
  "Demo formula"
 ]
];
export const STEPS: [string, string, string, string][] = [
 [
  "Fetch and Prepare Data",
  "Go get imagery from satellites and make it readable.",
  "Download files from LAADS/Earthdata. Reproject to common coordinate system (from sinusoidal grid to WGS84). Use scale factors and fill values.",
  "Not done — uses formula-generated data"
 ],
 [
  "Quality and Cloud Filtering",
  "Throw out cloudy or bad images.",
  "Read product QA bits. Filter clouds, cloud shadows, aerosols. Then count usable pixel percentage.",
  "Simulate clouds with smooth noise formula, then hide pixels via toggle"
 ],
 [
  "Temporal Compositing",
  "Merge multiple days for a clearer picture.",
  "Create composites (e.g., 16-day NDVI) by picking best value per pixel.",
  "MODIS NDVI uses constant value every 16 days"
 ],
 [
  "Tiling and Grid Creation",
  "Cut the map into small tiles for fast loading.",
  "Build multi-level zoom pyramid. Store as COG/tiles on file storage. Browser loads only what's visible.",
  "Compute grid on screen (max 300 columns) and render as image"
 ],
 [
  "Zonal Statistics",
  'Ask: "What is the average inside the drawn circle?"',
  "Clip image with polygon. Calculate mean, median, pixel count, area-weighted. Done server-side.",
  "Store 14×14 sample points in bounding box, then test if inside area (point-in-polygon)"
 ],
 [
  "Time Series, Calendar, and Anomaly",
  "See how values change day by day.",
  "Aggregate daily values. Compare against multi-year baseline (2000–present) and test trends.",
  "Mean of selected period as baseline. 365 days of data"
 ],
 [
  "Sensor Harmonization",
  "Make two cameras speak the same language.",
  "Regress in overlap period (VIIRS started 2012). Estimate bias and gain with uncertainty.",
  "Subtract sample bias then average"
 ],
 [
  "Hotspot Processing",
  "Identify real fire points and rank them.",
  "Receive NRT data. Filter by confidence. Remove static heat sources. Cluster nearby points. Sum FRP.",
  "Simulate fractal fire field. Filter by confidence and minimum FRP"
 ],
 [
  "Fire Risk Calculation",
  "Combine heat, dryness, and fire into one score.",
  "Use meteorological variables (wind, humidity, rain, temperature). Standard fire indices or model validated against fire history.",
  "Simple linear formula: heat 45%, dryness 35%, fire activity 20%"
 ],
 [
  "Alert System",
  "See something, tell the right people immediately.",
  "Overlay fire points with user-watched areas. Deduplicate alerts. Set severity levels. Send push, LINE, or SMS from always-on server.",
  "Check in page. Show alert bar. Browser notifications only while page is open"
 ],
 [
  "Fast Rendering",
  "Draw large visuals without lag.",
  "Server does heavy compute and caches. Use tiles and GPU to cull loaded data ranges.",
  "Use canvas and equally-spaced grid on Mercator map. Cache entire world grid for reuse"
 ]
];
export const FEATURES: [string, string[]][] = [
 [
  "Map and Drawing",
  [
   "World map with coastlines and borders (Natural Earth 1:50m)",
   "Draw and edit polygons with Terra Draw. Red button cancels drawing.",
   "Auto-zoom to drawn area",
   "MapLibre works on both wide screens and mobile"
  ]
 ],
 [
  "Variables and Sensors",
  [
   "MODIS, VIIRS, and Harmonized",
   "NDVI, LST, Fire (FRP), Night Lights",
   "Smooth raster heatmaps. Colours match the colour scales"
  ]
 ],
 [
  "Time",
  [
   "Select time range with shortcut buttons or custom dates",
   "Slider to scrub through days in range and auto-play button",
   "Historical charts and calendar. Horizontal scroll. Fixed cell size"
  ]
 ],
 [
  "Scientist View",
  [
   "Stats: mean, min–max, deviation from mean",
   "Hide cloud-covered pixels and show % passing QA",
   "Compare MODIS vs VIIRS (bias, r)",
   "Copy data as CSV"
  ]
 ],
 [
  "Firefighter View",
  [
   "Per-point hotspots. Size by FRP. Colour by confidence",
   "Summary: point count, total FRP, and filters",
   "Watch areas from server. Search and filter by continent or country",
   "Follow. View details, risk index, and 14-day chart",
   "In-page alerts with recommendations. Device notifications (experimental)"
  ]
 ],
 [
  "UI and UX",
  [
   "Map controls as icons. Panels collapse and expand.",
   "Left panel splits into sub-panels. Drag to resize width and collapse.",
   "Full-screen panels on mobile",
   "Light and dark mode support"
  ]
 ],
 [
  "Prototype Limitations",
  [
   "All data is mock and only goes back 365 days",
   "No real server yet. Alerts only work while this page is open",
   "Risk index does not yet include wind, humidity, or rain",
   "For decision support only. Does not replace field reports"
  ]
 ]
];
export const STAGE: string[] = ["Get ingredients", "Wash and sort", "Wash and sort", "Cut to size", "Cut to size", "Cook", "Cook", "Cook", "Cook", "Serve", "Serve"];