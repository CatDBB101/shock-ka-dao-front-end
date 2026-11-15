# Operational data inputs and serving architecture for a 6-72 h wildfire spread forecast in a web app (as of 15 Nov 2026)

Context: static Vite/React client (DuckDB-WASM, MapLibre) with an optional FastAPI backend on Hugging Face Spaces. CORS results below come from live `curl -H "Origin: https://example.com"` probes run on 2026-11-15. "Verified-live" means I saw the header myself on that date. "No ACAO" means no `Access-Control-Allow-Origin` header came back, so a browser `fetch()` from another origin will fail.

## 1. NASA FIRMS after S-NPP, MODIS status, area API format and columns, latency, geostationary fire products

### Takeaway
S-NPP is gone. FIRMS stopped producing new S-NPP data at 13:00 UTC on 2 Nov 2026, so the live polar-orbiting sources are now VIIRS NOAA-20 and NOAA-21 (375 m) plus MODIS (1 km). Terra still delivered data on 14 Nov 2026, but its science operations are expected to end around Jan-Feb 2027, and Aqua's around Sep 2027. NRT CSVs do **not** include the `type` column. Volcano and static-source attribution exists only in the science-quality/SP archive. Static FIRMS CSVs and the error responses from the area API carried no CORS header, so plan to proxy FIRMS through the backend. GOES ABI FDC on AWS is CORS-open and refreshes every 10 minutes.

### Cited Findings
**S-NPP shutdown and replacements**
- FIRMS stopped producing and delivering new S-NPP active fire data, imagery, Black Marble, burned area and OMPS products at 13:00 UTC on 2 Nov 2026. Historical data remains available. The post was published 27 Oct 2026 and updated 3 Nov 2026. Its banner says S-NPP "is no longer delivering new data". — [NASA Earthdata blog: Transitioning from S-NPP VIIRS/OMPS](https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know)
- NASA calls NOAA-20 (JPSS-1) and NOAA-21 (JPSS-2) VIIRS at 375 m the "best direct drop-in replacements". Both fly in the same orbital plane as S-NPP, about 50 min apart. Users should change `VIIRS_SNPP_NRT`/`VIIRS_SNPP_SP` to `VIIRS_NOAA20_NRT` or `VIIRS_NOAA21_NRT`. — [same blog](https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know)
- Copernicus Land reported that S-NPP went into a non-nominal state at about 14:50 UTC on 10 Jul 2026 and that its science data was unavailable "until further notice". This means S-NPP data may have stopped well before 2 Nov in practice. — [Copernicus Land production update](https://land.copernicus.eu/en/production-updates/global-burnt-area-production-temporary-switch-to-noaa-viirs-source-3) (via search snippet; I could not verify its current status)
- A separate S-NPP NRT outage ran from 28 Apr 2026 and was resolved in May. — [Earthdata alert](https://earthdata.nasa.gov/data/alerts-outages/data-outage-alert-suomi-npp-near-real-time-nrt-standard-products) (search snippet)
- No replacement burned-area product is in place yet. A NOAA-20 continuity product is under development. — [NASA blog](https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know)

**MODIS (Terra/Aqua)**
- FIRMS now offers MODIS "with reservations", for historical continuity. Terra provides the only morning overpass, about 3 h before Aqua. NASA is "investigating alternatives" for the morning orbit once Terra ends. Users can swap Aqua for NOAA-20/21 VIIRS "without any loss" in the afternoon orbit. — [NASA blog](https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know)
- NASA projects Terra science operations to end around Feb 2027 and Aqua around Sep 2027. CAMS and LAADS give Jan 2027 and Feb 2027 for Terra. — [NASA Science "Terra: the end of an era"](https://science.nasa.gov/science-research/earth-science/terra-the-end-of-an-era/); [CAMS "Drifting away from MODIS"](https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system); [LAADS MODIS-to-VIIRS transition](https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/) (dates come from search snippets and differ slightly between sources)
- Terra MODIS went into standby after an anomaly on 26 Mar 2026 and returned on 27 Mar. — [Earthdata alert](https://www.earthdata.nasa.gov/data/alerts-outages/terra-modis-placed-standby-mode)
- Verified-live: the FIRMS MODIS C6.1 SE-Asia 24 h CSV still held Terra ("T") detections dated 2026-11-14. — [FIRMS MODIS CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_SouthEast_Asia_24h.csv)

**Area API**
- Format: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA_COORDINATES]/[DAY_RANGE]` with an optional `/[DATE]` (YYYY-MM-DD). `AREA_COORDINATES` is `west,south,east,north` or `world`. `DAY_RANGE` is 1-5. — [FIRMS Area API page](https://firms.modaps.eosdis.nasa.gov/api/area/)
- Listed sources: `LANDSAT_NRT` (US/Canada only), `MODIS_NRT`, `MODIS_SP`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA20_SP`, `VIIRS_NOAA21_NRT`, `VIIRS_NOAA21_SP`, `VIIRS_SNPP_NRT`, `VIIRS_SNPP_SP`. The page has no S-NPP status note, and the SNPP_NRT entry is still listed. — [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)
- Rate limit: 5,000 transactions per 10-minute window per MAP_KEY. "Larger transactions may count as multiple requests (ex. requesting 7 days)." Key status endpoint: `https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=...`. — [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/); endpoint verified-live (returns 403 for an invalid key)
- RT and URT rows are removed once the matching NRT detections are processed, or after 6 h. — [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)

**Columns and the `type` field**
- Verified-live VIIRS NOAA-20/21 NRT CSV header: `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight`. Satellite values are `N20`/`N21`, confidence is `low|nominal|high`, version is `2.0NRT`. There is **no `type` column**. — [J1 VIIRS SE Asia 24h CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv); [J2 CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia_24h.csv)
- Verified-live MODIS NRT header: `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight`. Confidence is 0-100, version is `6.1NRT`. There is no `type` column. — [MODIS CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_SouthEast_Asia_24h.csv)
- The FIRMS FAQ says NRT data "does not attribute the static sources or inferred hotspot 'type'". Thermal anomaly types "are not currently attributed in the NRT MODIS or VIIRS data". Type is available in the science-quality product (MODIS UG Table 10). — [FIRMS FAQ](https://www.earthdata.nasa.gov/data/tools/firms/faq)

**Latency**
- NRT data arrives within 3 h of observation (best effort). The FAQ is internally inconsistent on the faster tiers: RT is given as within 30 min in one place and within 1 h in another, and URT as within 5 min in one place and "within a minute" in another (URT applies to select US/Canada ground stations). — [FIRMS FAQ](https://www.earthdata.nasa.gov/data/tools/firms/faq)

**Geostationary products**
- FIRMS still carries geostationary active fire data (GOES-East/West, Himawari, Meteosat) at 10-15 min intervals. Sub-satellite resolution is about 2 km for ABI and AHI and 3 km for SEVIRI, coarser off-nadir, and less sensitive to small fires. MTG (experimental tab) gives 1 km sub-nadir. — [NASA blog](https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know)
- GOES-19 ABI L2 FDC Full Disk (FDCF) runs every 10 min and became operational on 7 Apr 2025. It provides mask, temperature, area and FRP. NOAA data is public domain. — [Earth Engine catalog NOAA/GOES/19/FDCF](https://developers.google.com/earth-engine/datasets/catalog/NOAA_GOES_19_FDCF)
- Verified-live: `https://noaa-goes19.s3.amazonaws.com/?list-type=2&prefix=ABI-L2-FDCF/2026/318/` returns an S3 listing with `Access-Control-Allow-Origin: *`. Key layout: `ABI-L2-FDCF/YYYY/DOY/HH/*.nc`.
- A 2026 RSE paper benchmarks a 10-min Himawari-8/9 detector against the JAXA L2 WLF product. — [RSE 2026 DCAF PDF](https://qzhang95.github.io/Files/RSE_2026_DCAF.pdf)

**Licence and CORS**
- NASA promotes "full and open sharing". Cite as "NASA FIRMS" and acknowledge LANCE FIRMS. — [FIRMS FAQ](https://www.earthdata.nasa.gov/data/tools/firms/faq)
- Verified-live: the static FIRMS CSVs under `/data/active_fire/...` returned **no ACAO header**. The area API returned no ACAO header on its 400 "Invalid MAP_KEY" response. (curl probe, 2026-11-15)

### Inferences
- Default polar source: request both `VIIRS_NOAA20_NRT` and `VIIRS_NOAA21_NRT` and union them, since together they give about two afternoon and two night passes per day. Keep `MODIS_NRT` as optional morning coverage until Terra ends, which is expected early 2027.
- No NRT source tells you whether a hotspot is a volcano, gas flare or industrial site. To filter them, (a) pull `*_SP` for past years, keep rows with `type` ≠ 0, and build a persistent static-source mask, or (b) mask with a gas-flare/volcano dataset. Grid repeated SP detections (e.g. at 375 m) and flag cells that fire in many separate years. I did not directly verify whether the area API `*_SP` CSV includes `type`.
- Because neither the static CSVs nor the API error path carry an ACAO header, assume the browser cannot call FIRMS directly. Proxy it through FastAPI on HF Spaces. A proxy also keeps the MAP_KEY out of the client bundle, and the backend can cache results (e.g. a 15-min TTL per bbox) to stay under the 5,000 per 10-min limit.
- For sub-hourly updates between polar passes, the backend can poll `noaa-goes19` (GOES-East) and `noaa-goes18` (GOES-West) FDCF/FDCC NetCDF on AWS. Convert fire-mask pixels (codes 10-15/30-35) to points or GeoParquet for DuckDB-WASM. Over Asia, GOES does not cover the region. Use Himawari AHI fire data through FIRMS's geostationary layer or JAXA P-Tree.

### Gaps
- Whether the area API serves geostationary sources, and under what source names (e.g. `GOES_NRT`), was not listed on the area API page.
- Whether the area API `*_SP` output includes the `type` column was not verified (it needs a MAP_KEY).
- Whether a successful (200) area API response carries ACAO is unknown. The 400 response did not.
- The JAXA P-Tree WLF path and access terms were not found. My understanding is that P-Tree requires free registration and FTP/SFTP access, which is not browser-usable, but this is unverified.
- The S-NPP July 2026 anomaly status could not be confirmed against a primary NASA page.

## 2. Forecast weather APIs usable from a browser

### Takeaway
Open-Meteo is the best browser-direct option: verified-live `ACAO: *`, all requested fire variables including VPD and layered soil moisture, up to 16 days, multi-point in one call, and free under CC BY 4.0. The free tier is non-commercial only and limited per IP (600/min, 5,000/h, 10,000/day, 300,000/month). api.weather.gov (NWS/NDFD, US only) is also CORS-open. ECMWF open data is GRIB files, so it is backend-only.

### Cited Findings
- Endpoint `https://api.open-meteo.com/v1/forecast`. Hourly variables include `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m` (max of the preceding hour), `temperature_2m`, `relative_humidity_2m`, `dew_point_2m`, `vapour_pressure_deficit` (kPa), `soil_moisture_0_to_1cm`, `_1_to_3cm`, `_3_to_9cm`, `_9_to_27cm`, `_27_to_81cm`, `et0_fao_evapotranspiration` and `precipitation`. — [Open-Meteo docs](https://open-meteo.com/en/docs)
- `forecast_days` is 0-16 (default 7). `past_days` is 0-92. Multi-location uses comma-separated `latitude=..,..&longitude=..,..` and returns a JSON list. `minutely_15` is native only for Central Europe and North America and interpolated elsewhere. It has no soil moisture, ET0 or VPD. — [Open-Meteo docs](https://open-meteo.com/en/docs)
- Models behind `models=best_match`/`auto` include ECMWF IFS and AIFS, NCEP GFS and RRFS, DWD ICON, JMA, GEM, MET Norway, UKMO, and Météo-France ARPEGE/AROME. I did not confirm the exact identifier strings. — [Open-Meteo docs](https://open-meteo.com/en/docs)
- Verified-live: `ACAO: *`, methods GET/POST/OPTIONS, and the response exposes the headers `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset` and `retry-after`. A test call for Chiang Mai returned `vapour_pressure_deficit` (kPa) and `soil_moisture_0_to_1cm` (m³/m³). Wind is in km/h by default. (curl probe 2026-11-15)
- Free tier: 600 calls/min, 5,000/h, 10,000/day, 300,000/month, applied per IP and per application. Shared hosts (Vercel, Netlify, Render) may hit the limits sooner. Use is non-commercial only. Data is CC BY 4.0. Paid tiers (Standard 1M/month, Professional 5M/month, Enterprise >50M/month) allow commercial use. — [Open-Meteo terms](https://open-meteo.com/en/terms)
- NWS API: verified-live `https://api.weather.gov/points/{lat},{lon}` returns GeoJSON with `ACAO: *`. (curl probe)
- ECMWF Free & Open Data Portal: `https://data.ecmwf.int/forecasts/` serves an HTML directory listing. Verified-live, it returned no ACAO header. (curl probe)

### Inferences
- Calling from the browser spreads usage across user IPs, which suits the free tier's per-IP limits. Calling through HF Spaces puts every user on one IP and will hit the 10,000/day limit quickly. Request wind and RH for a coarse grid of points around the fire (e.g. a 5×5 grid at about 5-10 km spacing) in **one multi-location call**, then interpolate.
- Set `wind_speed_unit=ms` (or convert from km/h) for Rothermel inputs. Wind direction is meteorological ("from"), so add 180° to get the spread direction.
- For a commercial deployment, budget for an Open-Meteo paid tier or self-host the open-source Open-Meteo server.

### Gaps
- I did not verify the exact `models=` identifier strings (e.g. `ecmwf_ifs025`, `gfs_seamless`, `icon_seamless`). Check https://open-meteo.com/en/docs before use.
- NWS API rate limits (it requires a User-Agent; limits are undocumented) and NDFD grid specifics were not researched.

## 3. Terrain

### Takeaway
AWS Terrain Tiles (Terrarium PNG) are verified CORS-open and can be decoded and turned into slope/aspect in the browser. Copernicus DEM GLO-30 COGs on AWS are **not** CORS-open (no ACAO), so read them on the backend or re-host them.

### Cited Findings
- Verified-live: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` returns `ACAO: *`, supports HTTP Range (206), and is `image/png`. (curl probe 2026-11-15)
- Verified-live: `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N18_00_E098_00_DEM/Copernicus_DSM_COG_10_N18_00_E098_00_DEM.tif` is a COG that supports Range (206, about 44.7 MB), but it returned **no ACAO header**. (curl probe)

### Inferences
- Terrarium decoding: `elev_m = (R*256 + G + B/256) - 32768`. In MapLibre, use a `raster-dem` source with `encoding: "terrarium"` for hillshade/3D. For computation, draw tiles to an OffscreenCanvas and read the pixels.
- Slope and aspect via a Horn 3×3 kernel: `dz/dx = ((c+2f+i)-(a+2d+g))/(8·Δx)` and `dz/dy = ((g+2h+i)-(a+2b+c))/(8·Δy)`, giving `slope = atan(√(dzdx²+dzdy²))` and `aspect = atan2(dzdy, -dzdx)`, converted to compass degrees. Ground pixel size at zoom z is `Δ = 156543.03·cos(lat)/2^z` m for 256 px tiles. Zoom 12 gives about 38 m·cos(lat). This is standard GIS math, not taken from a cited source here.
- Rothermel's slope factor needs `tan(slope)`. Spread direction comes from the vector sum of the wind and the upslope direction (aspect + 180°).

### Gaps
- I did not research Terrain Tiles licensing and attribution or the source datasets per region (the bucket exposes `x-amz-meta-x-imagery-sources`).
- I did not verify whether OpenTopography or another mirror serves Copernicus DEM with CORS.

## 4. Fuels and land cover globally; crosswalks to Anderson/Scott-Burgan

### Takeaway
ESA WorldCover 10 m COGs on AWS are reachable with HTTP Range but **not** CORS-open (no ACAO), so tile or crop them on the backend. I found no published global WorldCover→Scott-Burgan crosswalk. The closest peer-reviewed analogue is the European 1 km fuel map of Aragoneses et al. (2023, ESSD), which crosswalks to Scott & Burgan (2005) from Copernicus Global Land Cover 100 m.

### Cited Findings
- Verified-live: `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N18E099_Map.tif` returns 206 with Range (about 80 MB per 3°×3° tile) and **no ACAO**. (curl probe 2026-11-15)
- Aragoneses et al. (2023) built a European 1 km fuel map with 85 fuel types in 6 main categories, mainly from Copernicus Global Land Cover 100 m, and crosswalked it to Scott & Burgan (2005) standard fuel models. — [ESSD 15, 1287-2023](https://essd.copernicus.org/articles/15/1287/2023/)
- Existing global fuel maps (Pettinari & Chuvieco 2016) have categories "too coarse to be operationally applicable". — [ESSD preprint 2022-184](https://essd.copernicus.org/preprints/essd-2022-184/essd-2022-184.pdf)
- LANDFIRE FBFM40 (Scott & Burgan 40) has more models in every fuel type than Anderson's 13. It covers the US only. — [LANDFIRE FBFM40](https://landfire.gov/fuel/fbfm40)

### Inferences
- A pragmatic WorldCover class → fuel model mapping (my proposal, **not from a published source**): 10 Tree cover → TL/TU (e.g. TU1/TL6 for broadleaf or TL8 for pine litter, depending on the biome); 20 Shrubland → SH2/SH5; 30 Grassland → GR2/GR4 (GR1 if grazed); 40 Cropland → GR1 or NB3 (season dependent); 50 Built-up → NB1; 60 Bare/sparse → NB9 or GR1; 70 Snow/ice → NB2; 80 Water → NB8; 90 Herbaceous wetland → GR/GS mix; 95 Mangroves → TU/NB; 100 Moss/lichen → GR1. The tree and shrub classes should be refined by ecoregion, and in Thailand by deciduous dipterocarp vs. evergreen forest.
- Architecture: precompute a WorldCover→fuel-code raster for the area of interest on the backend (rio-tiler or GDAL), then serve it as PMTiles or small GeoTIFF/COG with CORS headers. Alternatively, ship a per-region pre-cut Parquet grid for DuckDB-WASM.

### Gaps
- I did not verify a global published crosswalk from WorldCover or MODIS MCD12Q1 to Anderson 13 or SB40. Search terms to try next: Pettinari & Chuvieco 2016 "global fuel map" (Scientific Data / FCCS-based), and the FirEUrisk fuel map.
- I did not research MODIS MCD12Q1 access and CORS (LP DAAC requires an Earthdata login, so it is backend-only).

## 5. Fuel moisture equations and fire danger indices

### Takeaway
BehavePlus, FARSITE and NWCG deterministic analyses default initial dead fuel moisture to the **Fosberg model** (NFDRS lineage). **Nelson (2000)** is a physically based model, originally for the 10-h stick and later extended to other size classes. Simard (1968) EMC regressions are the common lightweight T/RH → EMC formula. Real-time global FWI forecasts come from JRC GWIS/EFFIS as WMS and are not on the CDS. The CDS/EWDS offers `cems-fire-historical-v1` (ERA5-based) and `cems-fire-seasonal`.

### Cited Findings
- "Initial dead fuel moistures in deterministic analyses default to estimates using the Fosberg dead fuel moisture model." — [NWCG PMS 437 Dead fuel moisture content](https://www.nwcg.gov/publications/pms437/fuel-moisture/dead-fuel-moisture-content)
- Nelson (2000) was originally developed for 10-h dead fuels, and parameters for other size classes were added later. Nelson (1984) is an older EMC-based model and should not be confused with Nelson (2000). — [CSIRO WF13005 "Dead fuel moisture research 1991-2012"](https://publish.csiro.au/WF/fulltext/WF13005)
- Nelson and Simard are ranked the most widely adopted semi-physical EMC models. — [MDPI Forests 17:484 (2026)](https://mdpi-res.com/d_attachment/forests/forests-17-00484/article_deploy/forests-17-00484.pdf) (via search snippet)
- GWIS provides 10-day FWI forecasts from ECMWF (~8 km), Météo-France (~10 km) and NASA GEOS-5 (~28 km), served as WMS. Real-time CEMS fire products are accessible "exclusively" via EFFIS/GWIS or by contacting jrc-effis@ec.europa.eu. — [GWIS fire danger forecast background](https://gwis.jrc.ec.europa.eu/about-gwis/technical-background/fire-danger-forecast); [ECMWF Confluence](https://confluence.ecmwf.int/x/CAzPFg)
- Historical FWI is in the CDS/EWDS as `cems-fire-historical-v1`, retrievable through the CDS API with variable `fire_weather_index`. Seasonal FWI is `cems-fire-seasonal` (lead time up to 7 months). — [EWDS cems-fire-historical-v1](https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1); [EWDS cems-fire-seasonal](https://ewds.climate.copernicus.eu/datasets/cems-fire-seasonal)
- Verified-live: the EFFIS WMS `https://maps.effis.emergency.copernicus.eu/effis?service=WMS&request=GetCapabilities` returns WMS 1.3.0 with `ACAO: *`. (curl probe)

### Inferences
- Simard (1968) EMC as used in NFDRS-78, with T in °F, RH in %. **These values are from memory and unverified; check them against Bradshaw et al. 1983, USDA FS GTR INT-169 before use:** RH<10: `EMC = 0.03229 + 0.281073·RH − 0.000578·RH·T`; 10≤RH<50: `EMC = 2.22749 + 0.160107·RH − 0.01478·T`; RH≥50: `EMC = 21.0606 + 0.005565·RH² − 0.00035·RH·T − 0.483199·RH`.
- A cheap browser-side scheme: per Open-Meteo hour compute EMC, then lag 1-h fuel moisture toward EMC with time constant τ≈1 h (10-h: τ≈10 h, 100-h: τ≈100 h): `m_{t+1} = EMC + (m_t − EMC)·exp(−Δt/τ)`, plus a rain bump from `precipitation`. Fosberg's table method instead takes a reference FM from a T/RH table and corrects it for month, time of day, slope/aspect and shading. That suits a deterministic BehavePlus-style default.
- The FWI system (FFMC/DMC/DC/ISI/BUI/FWI) can be computed client-side from noon T, RH, wind and 24-h rain (Van Wagner 1987), all of which Open-Meteo provides. GWIS WMS can then serve as a visual cross-check layer.

### Gaps
- I did not retrieve the primary texts for the Simard coefficients or the Fosberg tables (Rothermel 1983 GTR INT-143, Table/Appendix). Verify them before implementing.
- I did not find a GWIS real-time WMS endpoint URL or layer names. Only the EFFIS WMS was verified.

## 6. Existing operational spread-forecast services and their API patterns

### Takeaway
None of the operational systems exposes a public, open spread-forecast REST API for arbitrary ignitions. The common pattern is an internal batch or on-demand simulation (FARSITE, ELMFIRE, GridFire, FireSTARR, Spark) triggered by new detections. Outputs are published as OGC services (WMS/WFS) or downloadable files (Shapefile/KML/GeoTIFF). CWFIS GeoServer and EFFIS WMS are verified CORS-open.

### Cited Findings
- WIFIRE Firemap runs FARSITE with dynamic weather and fire data. Outputs include Shapefile, KML, WMS and WFS, and its architecture lists a "Pylaski" component. — [WIFIRE Firemap AGU 2016 poster](https://wifire.ucsd.edu/sites/default/files/pdf/Firemap-36x60_AGU2016.pdf)
- A 2025 paper extended Firemap to 0-5-day spread forecasts by integrating ELMFIRE and GridFire. — [ICCS 2025 paper](https://www.iccs-meeting.org/archive/iccs2025/papers/159100316.pdf)
- Technosylva Wildfire Analyst offers API/SaaS integration and FireSim on-demand spread prediction, with "half a billion" simulations per day claimed. These are vendor claims and no public API docs were found. — [Civic Tech directory: Technosylva](https://directory.civictech.guide/listing/technosylva); [EPRI wildfire tech DB](https://distribution.epri.com/wildfire/public/wildfire-tech-database/modeling-simulation/active-fire-spread/)
- The NWCG Fire Modeling Services Framework (FMSF) is a REST, machine-to-machine API whose initial release includes FARSITE. It is aimed at agency systems. — [NWCG WFM RD&A FMSF](https://wfmrda.nwcg.gov/technology-transfer/fire-modeling-services-framework-fmsf)
- CWFIS FireSTARR is a probabilistic daily growth forecast that outputs burn probability, "not a projected burn perimeter", and is still under development. Its inputs are FBP fuels, topography, ignitions and CWFIF weather forecasts. — [NRCan FireSTARR infographic](https://cwfis.cfs.nrcan.gc.ca/downloads/infographics/en/Infographic_FireSTARR_EN.pdf). The code is open source in the CWFMF GitHub org (firestarr, firestarr-cpp). — [FireSTARR docs](https://gh.r-mj.com/CWFMF/firestarr-doc/blob/main/README.md)
- CWFIS Fire M3 hotspots come from MODIS/VIIRS via FIRMS, with daily updates in May-Sep. The Datamart offers season-to-date buffered hotspot perimeters with attributes for count, first/last detection (UTC) and area in ha. — [CWFIS Datamart fm3buffered](https://cwfis.cfs.nrcan.gc.ca/datamart/metadata/fm3buffered); archives from 1994 are at [CWFIS hotspot archive](https://cwfis.cfs.nrcan.gc.ca/downloads/hotspots/archive/)
- Verified-live: the CWFIS GeoServer WFS 2.0 `https://cwfis.cfs.nrcan.gc.ca/geoserver/public/ows?service=WFS&version=2.0.0&request=GetCapabilities` returns `ACAO: *`. (curl probe)
- Verified-live: the EFFIS WMS returns `ACAO: *` (see section 5).

### Inferences
- A recommended architecture for this app:
  1. **Ingest (FastAPI on HF Spaces, scheduled about every 15-30 min):** proxy FIRMS area API for NOAA-20, NOAA-21 and MODIS NRT over the area of interest, apply the static-source mask, and for the Americas add GOES FDCF from AWS. Write `hotspots.parquet` and serve it with CORS.
  2. **Static layers (precomputed once per area):** WorldCover→fuel-model raster plus Copernicus DEM slope/aspect, stored as COG/PMTiles or Parquet grids. Terrarium tiles can stay browser-direct.
  3. **Weather (browser-direct):** one multi-point Open-Meteo call for 72 h of hourly wind, gusts, T, RH, VPD and precipitation. Compute dead fuel moisture client-side.
  4. **Spread engine:** a Rothermel cellular-automaton/minimum-travel-time model or an Huygens ellipse model in a Web Worker (or WASM). Alternatively, run it in FastAPI using an established engine (ELMFIRE, FireSTARR, or Python `pyretechnics`) for heavier ensemble runs, then return GeoJSON isochrones for +6/+12/+24/+48/+72 h. Display as probability (ensemble over wind perturbations) rather than a single perimeter, following FireSTARR.
  5. **Validation layers:** EFFIS WMS, CWFIS WFS and GWIS FWI as overlays.
- The free HF Spaces CPU tier sleeps when idle, so scheduled ingestion would need an external cron (e.g. GitHub Actions) that writes Parquet to an HF Dataset repo or object storage with CORS.

### Gaps
- No public API documentation was found for WIFIRE Firemap, Technosylva or FireGuard. FireGuard (US DoD/NGA-sourced perimeters shared with CAL FIRE) was not researched.
- Australia's Spark (CSIRO) based operational systems and their API patterns were not researched within the tool budget.
- I did not identify CWFIS FireSTARR output layer names on GeoServer. Inspect the GetCapabilities above.
