# Physics-based and Semi-empirical Wildfire Spread Models and Simulators (state as of Nov 2026)

> Note on sourcing: items marked **[web-verified]** were confirmed via search or fetch in this session. Items marked **[primary doc, not fetched]** cite the canonical primary document (USDA/CFS reports, journal articles). The writer took the equation or fact from well-known published forms of those documents, but did not re-open the document in this session. Check the exact coefficients against the PDF before you put them in code.

## Q1. Rothermel (1972) surface spread model + Albini (1976) / Andrews (2018) revisions, fuel models, known biases

### Takeaway
Rothermel is a closed-form, semi-empirical steady-state ROS equation. It is cheap to compute, so it can run in a browser. In practice it is the engine inside FARSITE, FlamMap, FSim, ELMFIRE, BehavePlus, Wildfire Analyst and Pyretechnics. Its documented accuracy is modest. Across 28 evaluation studies its median absolute percent error is about 57% (range 20–310%). Under-prediction dominates in evaluation datasets, especially for crown and timber fires.

### Cited Findings
**Core equation** (imperial units: σ in ft⁻¹, U in ft/min, R in ft/min) — [Rothermel 1972, INT-115](https://www.fs.usda.gov/rm/pubs_int/int_rp115.pdf); [Andrews 2018, RMRS-GTR-371](https://d10.nrfirescience.org/sites/default/files/2023-07/rmrs_gtr371.pdf) **[primary doc, not fetched]**
- R = I_R · ξ · (1 + φ_w + φ_s) / (ρ_b · ε · Q_ig)
- Reaction intensity: I_R = Γ' · w_n · h · η_M · η_s
  - Γ' = Γ'_max (β/β_op)^A · exp[A(1 − β/β_op)]
  - Γ'_max = σ^1.5 / (495 + 0.0594 σ^1.5)
  - β_op = 3.348 σ^−0.8189
  - A = 133 σ^−0.7913 (this is Albini's 1976 revision; the original 1972 form was A = 1/(4.774 σ^0.1 − 7.27))
  - Moisture damping: η_M = 1 − 2.59 r_M + 5.11 r_M² − 3.52 r_M³, where r_M = M_f/M_x (capped at 1)
  - Mineral damping: η_s = 0.174 S_e^−0.19 (≤1; S_e = 0.010 for the standard models)
- Propagating flux ratio: ξ = (192 + 0.2595 σ)^−1 · exp[(0.792 + 0.681 σ^0.5)(β + 0.1)]
- Wind factor: φ_w = C · U^B · (β/β_op)^−E, where C = 7.47 exp(−0.133 σ^0.55), B = 0.02526 σ^0.54 and E = 0.715 exp(−3.59×10⁻⁴ σ). U is midflame wind speed.
- Slope factor: φ_s = 5.275 β^−0.3 · tan²θ
- Heat sink: ρ_b · ε · Q_ig, where ε = exp(−138/σ) is the effective heating number and Q_ig = 250 + 1116·M_f (Btu/lb) is the heat of pre-ignition
- Multi-class fuel beds use surface-area weighting of σ, M_f, etc. across dead and live size classes. Live-fuel M_x is computed from the dead/live fuel loading ratio (Albini 1976).
- Wind and slope vectors are combined into an "effective wind speed" that sets the spread direction (Rothermel 1983 / Finney 1998).

**The Andrews documents** — [Andrews 2018 GTR-371 (record)](https://research.fs.usda.gov/treesearch/55928) **[web-verified title/scope]**
- GTR-371 is titled "The Rothermel surface fire spread model and associated developments: A comprehensive explanation". It is a reference and consolidation document. Search snippets did not show any new change to the wind limit in GTR-371.
- The wind-limit revision is in an earlier paper, Andrews, Cruz & Rothermel (2013, IJWF, doi 10.1071/WF12122). It found that both the original wind limit (U_lim = 0.9·I_R) and the revised limit are too restrictive. It recommends limiting ROS to the effective midflame wind speed (R ≤ U) instead — [Treesearch 44352](https://research.fs.usda.gov/treesearch/44352); [nwfirescience PDF](https://nwfirescience.org/sites/default/files/publications/rmrs_2013_andrews_p001.pdf) **[web-verified]**

**Fuel models**
- Anderson (1982) 13 fuel models: grass 1–3, shrub 4–7, timber litter 8–10, slash 11–13. They are static models with dead fuel only, except a live component in models 4, 5 and 7 — [Anderson 1982 GTR-INT-122](https://www.fs.usda.gov/rm/pubs_int/int_gtr122.pdf) **[primary doc, not fetched]**
- Scott & Burgan (2005) 40 fuel models in groups GR1–9, GS1–4, SH1–9, TU1–5, TL1–9, SB1–4, plus non-burnable NB. They have a dynamic herbaceous load transfer that depends on live herbaceous moisture — [Scott & Burgan 2005 RMRS-GTR-153](https://www.fs.usda.gov/rm/pubs_series/rmrs/gtr/rmrs_gtr153.pdf) **[primary doc, not fetched]**
- The pan-European FirEUrisk fuel map was explicitly cross-walked to Scott & Burgan 2005 models. That makes the 40-model set the de facto international standard outside Canada and Australia — [Aragoneses et al. 2023 ESSD](https://essd.copernicus.org/articles/15/1287/2023/) **[web-verified]**

**Measured accuracy and biases**
- Cruz & Alexander (2013, Environ. Model. Softw. 47) compiled 49 evaluation datasets with 1,278 observations across surface and crown models:
  - Mean percent error ranged from 20 to 310%.
  - Only 3% of predictions (35/1278) were exact.
  - Under-prediction occurred in 75% of datasets.
  - They proposed ±35% as a reasonable performance standard for head-fire ROS.
  — [Bushfire CRC citation](https://bushfirecrc.com/publications/citation/bf-4267); [USDA 2015 chapter](https://research.fs.usda.gov/treesearch/49457) **[web-verified via search summary]**
- Rothermel was the most widely evaluated model, with a median MAPE of 57% (range 20–310%) across 28 studies — [later review citing Cruz & Alexander (Springer Fire Technology 2019)](https://link.springer.com/content/pdf/10.1007/s10694-019-00856-2.pdf) **[web-verified via search summary; single review]**
- Operational California case: 1,853 initial-attack fires (2019–2021) were simulated automatically in Wildfire Analyst Enterprise (Rothermel/Scott & Burgan based). Errors and biases were "reasonable" for automated runs. Some fuel models under-estimated ROS, especially in timber — [Cardil et al. 2023, IJWF WF22128 (AGRIS record)](https://agris.fao.org/search/en/records/67051591fea2a3f24f3495aa) **[web-verified abstract-level; full metrics not retrieved]**
- Known structural biases (synthesis of the above plus the model formulation):
  - Rothermel is a surface-fire model. Crown fire needs Van Wagner (1977) initiation together with Rothermel (1991) or Cruz et al. (2005) crown ROS, and the Rothermel-1991 approach is known to under-predict crown ROS (Cruz & Alexander 2010).
  - The original wind limit can cap ROS too aggressively at high winds (Andrews et al. 2013, above).
  - Grass models are very sensitive to fuel load and curing, and can over-predict in sparse or patchy grass.

### Inferences
- Rothermel is about 30 lines of arithmetic per cell. It runs trivially in JavaScript or WASM in the browser.
- Because of the ~±50% ROS error typical of the field, any app should present spread as a band or ensemble rather than a single line.
- Use the Andrews et al. (2013) "R ≤ U_midflame" limit rather than the 0.9·I_R wind limit.

### Gaps
- The exact contents of any GTR-371 changes (e.g., whether it formally adopts the 2013 wind-limit recommendation) were not verified this session.
- Cruz & Alexander 2010 crown under-prediction figures were not re-fetched.
- I found no single study that quantifies grass over-prediction bias globally.

## Q2. Elliptical fire shape, Huygens wavelets, minimum travel time

### Takeaway
Nearly every operational 2-D simulator does one of two things. It either expands an ellipse per vertex (Huygens wavelets: FARSITE, Prometheus/WISE, Phoenix), or it uses an ellipse-derived directional ROS in a raster solver (MTT in FlamMap/FSim/FSPro, level set in ELMFIRE/Spark/WRF-SFIRE, cell-to-cell in Cell2Fire). The length-to-breadth (LB) ratio is a function of wind speed.

### Cited Findings
- **Anderson (1983) LB from midflame wind, used in FARSITE:** LB = 0.936·e^(0.2566·U) + 0.461·e^(−0.1548·U) − 0.397, with U = midflame wind in mi/h — [Finney 1998, FARSITE RMRS-RP-4](https://www.fs.usda.gov/rm/pubs/rmrs_rp004.pdf) **[primary doc, not fetched]**
- **Alexander (1985) / FBP forms (ST-X-3):**
  - Forest fuels: LB = 1 + 8.729·[1 − e^(−0.030·WSV)]^2.155, with WSV = net effective wind in km/h at 10 m.
  - Grass (O-1): LB = 1.1·WSV^0.464 for WSV ≥ 1 km/h.
  - Head-to-back ratio: HB = (LB + √(LB²−1)) / (LB − √(LB²−1)).
  — [Forestry Canada 1992 ST-X-3](https://cfs.nrcan.gc.ca/publications?id=10068) **[primary doc, not fetched]**
- **Richards (1990) differential equations for Huygens elliptical wavelet propagation:** this is the vertex-expansion basis of FARSITE and Prometheus. Prometheus applies Huygens wave propagation to FBP ROS — [CWFIS Prometheus infographic](https://cwfis.cfs.nrcan.gc.ca/downloads/infographics/en/Infographic_Prometheus_EN.pdf) **[web-verified for Prometheus]**; Richards 1990, Int. J. Numer. Methods Eng. 30:1163–1179 **[primary doc, not fetched]**
- **Minimum travel time (Finney 2002, Can. J. For. Res. 32:1420–1424):** fire arrival time is computed as a shortest path on a raster graph with ellipse-derived directional ROS (a Dijkstra-like method). It is the engine of FlamMap MTT, FSPro and FSim. Under constant conditions it is equivalent to Huygens and much faster for burn-probability work — **[primary doc, not fetched]**
- **Spark level-set approach:** it tracks the signed distance to the perimeter in each raster cell instead of tracking perimeter vertices — [Spark docs](https://research.csiro.au/static/spark/docs/docspark.html) **[web-verified]**
- **Cell2Fire:** spread within each cell is elliptical, with FBP rates — [Cell2Fire arXiv](https://arxiv.org/abs/1905.09317) **[web-verified]**

### Inferences
- For a browser app, MTT (a priority-queue shortest path on a 30–100 m grid) or a simple level-set/fast-marching solver is the most practical. It is O(N log N), handles heterogeneous fuel naturally, and avoids FARSITE's perimeter-tangling and vertex-rediscretisation complexity.

### Gaps
- No quantitative head-to-head accuracy comparison of Huygens vs MTT vs level-set against real fires was found this session.

## Q3. Operational / semi-empirical simulators: physics, license, language, inputs, speed, validation

### Takeaway
The open-source candidates actually usable today are:
- ELMFIRE (Fortran, EPL-2.0)
- Pyretechnics (Python, EPL-2.0)
- ForeFire (C++, GPLv3)
- Cell2Fire (C++/Python, open)
- WISE/Prometheus (AGPL-3.0)
- FARSITE/FlamMap (USFS, public domain)

Spark is free but closed (CSIRO Workspace). Phoenix RapidFire is proprietary. Published validation numbers are sparse and heterogeneous. A 2024 AFAC evaluation of four Australian simulators (Australis, Phoenix, Prometheus, Spark) on 10 fires found no clearly superior simulator.

### Cited Findings
**FARSITE / FlamMap / FSPro / FSim (USFS Missoula Fire Lab)**
- Physics: Rothermel surface model, Van Wagner/Rothermel crown, Albini spotting. FARSITE uses Huygens vertex expansion (Finney 1998, RMRS-RP-4); FlamMap/FSPro/FSim use MTT (Finney 2002) — [FARSITE RMRS-RP-4](https://www.fs.usda.gov/rm/pubs/rmrs_rp004.pdf) **[primary doc, not fetched]**
- Validation: a FARSITE study driven by LANDFIRE fuel models reached a maximum Sørensen coefficient of 0.38 (kappa 0.36). Satellite-derived vegetation mapping raised that to SC = 0.70 **(single study)** — [Fire Ecology 2022, s42408-022-00147-2](https://fireecology.springeropen.com/articles/10.1186/s42408-022-00147-2) **[web-verified via search summary]**
- In a Mediterranean (Sardinia) validation, all FARSITE runs over-estimated the north perimeter. The authors attributed this to missing topographic wind-sheltering — [Arca et al., AMS](https://ams.confex.com/ams/pdfpapers/97961.pdf) **[web-verified via search summary]**
- The original FARSITE validation report (Finney 2000) and Perry et al. (1999) used the Sørensen coefficient — [Finney 2000 FARSITE validation final report](https://research.fs.usda.gov/sites/default/files/2024-01/firelab-finney_2000_farsitevalidation_finalreport.pdf) **[web-verified existence; numbers not extracted]**
- Language and license: C++, US-government public domain. The Behave/FlamMap C++ core is wrapped by the open-source `pyrothermel` — [pyrothermel PyPI](https://pypi.org/project/pyrothermel/) **[web-verified]**
- FSPro and FSim (Finney et al. 2011, SERRA) are probabilistic MTT ensembles over climatological weather. FSPro gives burn probability over 1–4+ weeks for large-fire decision support — [Finney et al. 2011](https://www.fs.usda.gov/rm/pubs_other/rmrs_2011_finney_m001.pdf) **[primary doc, not fetched]**

**ELMFIRE (Eulerian Level set Model of FIRE spread; Lautenberger 2013, Fire Safety J.)**
- Repo: github.com/lautenberger/elmfire. License EPL-2.0 (one aggregator says "other"; check LICENSE.md). Written in Fortran — [Berkeley Fire Lab software](https://firelab.berkeley.edu/software); [OSS Insight](https://ossinsight.io/analyze/lautenberger/elmfire) **[web-verified]**
- Physics: Rothermel surface model, Cruz crown fire model, level-set front tracking, spotting, and Monte Carlo ensembles — [Pyretechnics/Pyregence summary](https://pyregence.github.io/pyretechnics) **[web-verified]**
- Operational use: through Pyrecast/Pyregence it forecasts the spread of most large fires in CONUS — [ecosyste.ms entry](https://ost.ecosyste.ms/projects/175594) **[web-verified]**
- ELMFIRE is described as low-cost and coarse-grid capable, and "widely used for operational wildland fire simulation in the U.S." — [par.nsf.gov paper](https://par.nsf.gov/servlets/purl/10461797) **[web-verified via search summary]**
- Validation: no ELMFIRE-specific Sørensen or arrival-time error number was found. A Tubbs Fire reconstruction compared "hours since burned" to observations — [WF25146 supplement](https://connectsci.au/wf/article-supplement/272540/pdf/wf25146_ac/) **[web-verified existence only]**

**Pyretechnics (Pyregence)**
- An open-source Python library (EPL-2.0) that implements the fundamental equations of GridFire, ELMFIRE, FlamMap, FARSITE, FSIM and BehavePlus, plus an ELMFIRE-style level-set spread module — [PyPI](https://pypi.org/project/pyretechnics/); [docs](https://pyregence.github.io/pyretechnics) **[web-verified]**

**Prometheus → WISE (Canada)**
- A deterministic vector Huygens simulator built on the Canadian FBP System, using topography, FBP fuel types and weather. It was developed by the Government of Alberta with other Canadian agencies — [CWFIS infographic](https://cwfis.cfs.nrcan.gc.ca/downloads/infographics/en/Infographic_Prometheus_EN.pdf) **[web-verified]**
- Open-sourced as WISE (Wildfire Intelligence and Simulation Engine) in Jan 2023 under AGPL-3.0+ — [WISE-Developers GitHub](https://github.com/WISE-Developers) **[web-verified]**
- BurnP3+ (ApexRMS, open source) wraps FireSTARR, Prometheus and Cell2Fire for burn-probability work — [ApexRMS BurnP3+](https://apexrms.com/burnp3plus/) **[web-verified]**

**FBP System (Canada, ST-X-3)**
- 16 fuel types: C-1…C-7, D-1/D-2, M-1…M-4, S-1…S-3, O-1a/b.
- ROS = a·[1 − e^(−b·ISI)]^c, with ISI = 0.208·f(W)·f(F) and f(W) = e^(0.05039·WS).
- It is empirical, fitted to Canadian experimental and wildfire data.
— [ST-X-3](https://cfs.nrcan.gc.ca/publications?id=10068) **[primary doc, not fetched]**

**Cell2Fire (Pais, Carrasco, Martell, Weintraub, Woodruff)**
- A cell-based elliptical model with FBP ROS (a Chile/Kitral version also exists). Open source on GitHub (cell2fire org); C++ core with a Python wrapper — [arXiv 1905.09317](https://arxiv.org/abs/1905.09317) **[web-verified]**
- Validation against Prometheus on real and synthetic fires: >90% agreement and up to 30× faster **(authors' own claim, vs another simulator rather than vs observations)** — [Frontiers FFGC 2021](https://frontiersin.org/journals/forests-and-global-change/articles/10.3389/ffgc.2021.692706/text) **[web-verified]**

**Spark (CSIRO Data61, Australia)**
- A raster level-set solver built on CSIRO Workspace. It needs OpenCL (GPU-accelerated). Users can script rate-of-spread models, such as the CSIRO grassland, Vesta and McArthur models — [Spark docs](https://research.csiro.au/static/spark/docs/docspark.html); [Spark about](https://research.csiro.au/spark/about) **[web-verified]**
- "Freely available to researchers, practitioners and managers", but not open source. A SparkWeb version existed in 2025 — [UC conference paper 2018](https://dl.uc.pt/handle/10316.2/44639); [SparkWeb 2025 PDF](https://research.csiro.au/spark/wp-content/uploads/sites/14/2025/02/2025_SparkWeb_no_example.pdf) **[web-verified]**

**Phoenix RapidFire (Univ. Melbourne/Tolhurst; Victoria DEECA, AFAC)**
- A proprietary operational simulator in southeastern Australia (Huygens raster, McArthur/CSIRO-based ROS). The 2024 evaluation included it.

**AFAC evaluation (Fox-Hughes et al. 2024, IJWF 33, WF23028)**
- Australis, Phoenix, Prometheus and Spark were run on 10 historical fires using an automated evaluation framework. No simulator was clearly superior. Each had strengths and weaknesses and different parameter sensitivities — [IJWF WF23028](https://www.publish.csiro.au/wf/Fulltext/WF23028); [FRAMES record](https://frames.gov/catalog/69214) **[web-verified abstract; per-simulator scores not retrieved because the full-text fetch failed]**
- An earlier Australis study of a large WA fire found lower accuracy under extreme fire danger — same search, [UWA repository](https://research-repository.uwa.edu.au/en/publications/techniques-for-evaluating-wildfire-simulators-via-the-simulation-/) **[web-verified via search summary]**
- Evaluation metrics in use include Sørensen, Jaccard, Shape Deviation Index and Area Difference Index (Duff et al. 2016), and Arrival Time Agreement / Shape Agreement (Filippi et al. 2014, IJWF WF12202) — [WF12202](https://www.publish.csiro.au/WF/fulltext/WF12202) **[web-verified via search summary]**

**ForeFire (Univ. Corsica / CNRS)**
- C++ engine with Python bindings, a CLI and a web UI. GPLv3. Repo github.com/forefireAPI/forefire. Front-tracking (Lagrangian markers) with pluggable ROS models such as Balbi and Rothermel — [ForeFire docs](https://forefire.readthedocs.io/en/stable/getting_started/introduction.html); [JOSS 2025 paper](https://www.theoj.org/joss-papers/joss.08680/10.21105.joss.08680.pdf) **[web-verified]**

### Inferences
- Regional fit:
  - **Canada:** FBP + Prometheus/WISE or Cell2Fire.
  - **USA:** Rothermel/Scott-Burgan + ELMFIRE/FlamMap with LANDFIRE.
  - **Australia:** CSIRO grassland, Vesta and McArthur via Spark (or own implementation), since the national AFDRS uses these model families.
  - **Argentina and Angola:** no national operational simulator was found. Rothermel with Scott & Burgan models mapped from land cover is the most portable choice, since FirEUrisk shows the cross-walk approach works. Angolan miombo and savanna are grass-dominated, so grass models (GR-series, or the CSIRO grassland model or FBP O-1) matter most.
- **Browser-feasible:** the Rothermel, FBP, McArthur and CSIRO grass ROS equations; ellipse geometry; MTT and level-set on moderate grids. Porting Cell2Fire (C++) or ForeFire (C++) to WASM via Emscripten is plausible but undocumented. ELMFIRE (Fortran + MPI) and Spark (OpenCL + Workspace) realistically need a server.
- License matters if the app is closed-source:
  - AGPL (WISE) and GPLv3 (ForeFire) are copyleft. Network use of AGPL code triggers source disclosure.
  - EPL-2.0 (ELMFIRE, Pyretechnics) is weak copyleft at file level.
  - USFS code is public domain.

### Gaps
- Per-simulator Sørensen/Jaccard scores from Fox-Hughes 2024: the full text was unreachable (CSIRO publishing has moved to connectsci.au).
- No quantitative ELMFIRE or ForeFire validation vs observed perimeters was found.
- No published runtime benchmarks were found for FARSITE vs ELMFIRE vs Cell2Fire on the same landscape.
- Phoenix licensing details and any public validation numbers were not verified.

## Q4. Fully physical / coupled models

### Takeaway
Coupled models add fire-atmosphere feedback, plume dynamics and fire-induced winds. They are far too expensive for a browser and generally too expensive for routine 12–48 h forecasting:
- **CFD (FIRETEC, WFDS/FDS):** research only.
- **WRF-SFIRE and ForeFire-MesoNH:** can run faster than real time at ~100 m fire-relevant resolution on HPC.
- **QUIC-Fire:** runs at laptop speed, but is designed for prescribed-fire-scale domains.

### Cited Findings
- **WRF-SFIRE / WRF-Fire:**
  - Level-set fire spread with Rothermel ROS, two-way coupled to WRF (heat and moisture fluxes feed back into the atmosphere). Open source at github.com/openwfm/WRF-SFIRE; WRF-Fire has been in mainline WRF since v3.2 — [Mandel et al. 2011 GMD](https://gmd.copernicus.org/articles/4/591/2011/) **[primary doc, not fetched]**
  - Can run faster than real time for large wildfires, but only at modest grid resolution, O(100 m) — [QES-Fire paper, IJWF WF21057](https://publish.csiro.au/wf/Fulltext/wf21057) **[web-verified via search summary]**
  - In the FireFlux evaluation, plume behaviour was consistent with observations, but a full evaluation of perimeter spread was still needed — [Kochanski et al. 2013 GMD](https://gmd.copernicus.org/articles/6/1109/2013/gmd-6-1109-2013.pdf) **[web-verified]**
  - In the 2007 Santa Ana real-time pilot, the forecast perimeter was very sensitive to wind forecast errors. Poor WRF wind direction produced a poor northern perimeter. Static fuel moisture was another error source — [arXiv 1202.3209](https://arxiv.org/pdf/1202.3209) **[web-verified]**
  - Camp Fire WRF-Fire with radar-perimeter assimilation improved propagation over baseline in all benchmarks — [AGU 2022 abstract](https://ui.adsabs.harvard.edu/abs/2022AGUFMNH45F0506S) **[web-verified, abstract only]**
- **FIRETEC (LANL) and WFDS (NIST):** described by their own developers as too computationally expensive for widespread practitioner use. CFD models "have not found operational applications" — [QUIC-Fire/related search summaries](https://www.frames.gov/catalog/60612) **[web-verified]**
- **NIST FDS/WFDS:** open source (github.com/firemodels/fds, US-government public domain) — **[primary doc, not fetched]**
- **QUIC-Fire (LANL; Linn et al. 2020, Environ. Model. Softw.):**
  - Couples the QUIC-URB fast wind solver with a cellular-automata fire model (Fire-CA). Described as "orders of magnitude" cheaper than FIRETEC **(authors' claim)**, and can run in real time on a laptop.
  - Shows strong agreement with FIRETEC fire-behaviour metrics, but no numbers were given.
  - Aimed at prescribed fire.
  — [AMS abstract](https://ams.confex.com/ams/35AF14F6BG/webprogram/Paper424032.html); [OSTI](https://www.osti.gov/biblio/1581577) **[web-verified]**
- **ForeFire-MesoNH:** two-way coupled (MesoNH surface winds drive ForeFire; heat and other fluxes feed back). Demonstrated on large real fires such as Pedrógão Grande. MesoNH must be installed separately, and no formal skill scores were found — [ForeFire docs](https://forefire.readthedocs.io/en/docs/getting_started/introduction.html); [Atmosphere 2018](https://www2.mdpi.com/2073-4433/9/6/218); [OpenWFM wiki](https://wiki.openwfm.org/wiki/MesoNH-Fire) **[web-verified]**

### Inferences
- For 12–48 h forecasting, coupling matters most for large, plume-dominated fires and fire-induced winds. For most fires, the dominant error is the weather forecast (wind direction) and fuel/moisture inputs, not missing coupling. This is shown by the Santa Ana WRF-SFIRE case.
- None of these models are browser-viable. WRF-SFIRE needs an HPC cluster or a large cloud VM for each fire.

### Gaps
- No quantitative operational perimeter-skill statistics (e.g., a mean Sørensen at 24 h) were found for WRF-SFIRE.
- No concrete QUIC-Fire vs FIRETEC speedup number was retrieved.

## Q5. Best approach for 12–48 h spread-direction forecasts; typical accuracy numbers

### Takeaway
I found no authoritative benchmark that reports standardized 12–48 h perimeter skill for operational simulators. The evidence that exists points to three things:
1. Input-driven errors (wind direction, fuel map, moisture) dominate.
2. Typical overlap scores against observed burned area are in the SC ≈ 0.4–0.7 range for Rothermel-based tools, depending heavily on fuel mapping (single study).
3. Ensembles plus data assimilation (re-initializing from observed perimeters or active-fire detections) are the most consistently reported improvements.

### Cited Findings
- ROS accuracy: about ±35% is "reasonable", but field-wide errors are much larger: mean percent error 20–310%, Rothermel median MAPE 57% — [Cruz & Alexander 2013](https://bushfirecrc.com/publications/citation/bf-4267); [Springer review](https://link.springer.com/content/pdf/10.1007/s10694-019-00856-2.pdf) **[web-verified]**
- Burned-area overlap: FARSITE reached SC 0.38 with LANDFIRE fuels and 0.70 with improved fuel mapping **(single study)** — [Fire Ecology 2022](https://fireecology.springeropen.com/articles/10.1186/s42408-022-00147-2) **[web-verified]**
- Even sophisticated models "exhibit significant deviations from reality over time horizons of one to two days" (qualitative statement, not quantified) — [arXiv 2603.26975 (2026)](https://arxiv.org/html/2603.26975v1) **[web-verified]**
- The same 2026 preprint built a flow-matching ML surrogate of WRF-SFIRE with 200-member ensembles **(scores are against WRF-SFIRE output, not observations; single study)**:
  - 24 h recursive from ignition: SC 0.87, POD 0.85, FAR 0.07
  - 24 h from a 12 h perimeter: SC 0.90, POD 0.96, FAR 0.14
  - Runtime: about 9 min per 200-member case on one A100
  — [arXiv 2603.26975](https://arxiv.org/html/2603.26975v1) **[web-verified]**
- Satellite active-fire assimilation into a WRF-SFIRE-type system is an active approach — [arXiv 2204.00686](https://arxiv.org/pdf/2204.00686) **[web-verified existence]**
- MODIS active-fire data has been used to evaluate FARSITE on 9 large Portuguese fires — [Sá et al.](https://idlcc.fc.ul.pt/publications.php?id=317) **[web-verified existence]**
- Ensemble vs deterministic fire-weather (FWI) forecasts: ensemble mean and median beat individual members, and deterministic skill decays faster with lead time — [Weather & Forecasting 2025](https://nwfirescience.org/sites/default/files/publications/wefo-WAF-D-25-0069.1.pdf) **[web-verified via search summary]**
- Operational California automated Rothermel simulations were judged accurate enough for real-time initial-attack use — [Cardil et al. 2023](https://agris.fao.org/search/en/records/67051591fea2a3f24f3495aa) **[web-verified abstract]**

### Inferences
- For an app covering Canada, the USA, Argentina, Angola and Australia, the best accuracy per unit of compute is likely to come from this setup:
  - A regional semi-empirical ROS model: FBP in Canada, Rothermel/Scott-Burgan in the USA, Argentina and Angola, and CSIRO grass/Vesta in Australia.
  - An MTT or level-set spread solver.
  - An ensemble over forecast wind (e.g., GFS/ECMWF/ICON members or perturbations), with ROS adjustment factors.
  - Re-initialization every satellite pass from VIIRS/MODIS hotspots.
- Present the output as probability-of-arrival contours rather than a single line.
- Expect the head-fire direction to be largely correct when the wind forecast is correct. Expect ROS magnitude errors of ±35–60%.

### Gaps
- No quantified spread-direction (angular) error statistic was found in any source.
- No 12/24/48 h observed-perimeter Sørensen benchmark across operational simulators was found.
- Fox-Hughes 2024 and Cardil 2023 numeric results could not be extracted.

## Q6. Free global inputs: fuel, DEM, weather, fuel moisture

### Takeaway
Free global DEM and weather data are solid. Fuels are the weak link: only the US (LANDFIRE), Canada (FBP fuel grid), Europe (FirEUrisk 1 km) and Australia (national fuel types) have fire-model-ready maps. Argentina and Angola require cross-walking global land cover (ESA WorldCover 10 m, Copernicus Global Land Cover 100 m) to Scott & Burgan or FBP types. Fuel moisture can be estimated from forecast temperature and RH with the Nelson model or Fosberg/Simard EMC equations, or with FWI codes (FFMC) in Canada.

### Cited Findings
- **FirEUrisk European fuel map:** 1 km, 20 fuel categories, linked to Scott & Burgan 2005 models; DOI 10.21950/YABYCN. Its fuel parameterization has been criticized by Fernandes, Guiomar & Sá (ESSD comment 2024) — [Aragoneses et al. 2023 ESSD](https://essd.copernicus.org/articles/15/1287/2023/); [ESSD comment essd-2024-587](https://essd.copernicus.org/preprints/essd-2024-587/) **[web-verified]**
- **Pan-European canopy fuels** (canopy height, base height, bulk density for crown-fire modelling): available on Zenodo — [Zenodo 10218523](https://doi.org/10.5281/zenodo.10218523) **[web-verified existence]**
- **LANDFIRE:** US-only. The FARSITE-LANDFIRE example above showed that LANDFIRE fuels gave poor overlap (SC 0.38) in that study — [Fire Ecology 2022](https://fireecology.springeropen.com/articles/10.1186/s42408-022-00147-2) **[web-verified]**
- **ESA WorldCover** (10 m, 2020/2021, CC-BY 4.0), **Copernicus Global Land Cover** (100 m, 2015–2019), **Copernicus DEM GLO-30** (30 m, free) and **AWS Terrain Tiles** (Terrarium/normal PNG tiles, browser-friendly) — **[not verified this session; well-known public datasets]**
- **Open-Meteo:** free API with hourly 10 m wind speed/direction, temperature and RH from GFS, ECMWF IFS/AIFS, ICON and others. It is CORS-enabled, so it can be called from the browser — **[not verified this session]**
- **Fuel moisture models:**
  - Nelson (2000, Can. J. For. Res. 30:1071) dead fuel moisture model, used in BehavePlus/FARSITE/WRF-SFIRE.
  - Simard (1968) EMC equations.
  - Fosberg & Deeming 1971 1-h moisture tables.
  - Van Wagner FFMC (CFFDRS) for Canada.
  — **[primary docs, not fetched]**
- **ForeFire inputs:** ForeFire and many tools ingest GeoTIFF/NetCDF fuel, DEM and wind layers — [ForeFire docs](https://forefire.readthedocs.io/en/stable/getting_started/introduction.html) **[web-verified]**

### Inferences
- **Browser pipeline that is feasible entirely client-side:**
  - AWS Terrain Tiles for slope and aspect
  - ESA WorldCover tiles cross-walked to Scott & Burgan/FBP/grass types
  - Open-Meteo hourly wind, RH and temperature, fed into Simard EMC or a Nelson-like 1-h/10-h moisture estimate
  - Rothermel/FBP ROS
  - MTT spread on a ≤1000×1000 grid in a Web Worker or WASM
- **Regional notes:**
  - Canada: use the CWFIS FBP fuel grid.
  - Australia: use AFDRS fuel types with CSIRO grass/Vesta models.
  - Argentina (Patagonian forests and Pampas grasslands) and Angola (miombo savanna): rely on land-cover cross-walks with large uncertainty, so treat outputs as qualitative.

### Gaps
- Licences, resolution and latency for ESA WorldCover, Copernicus GLO-30, AWS Terrain Tiles and Open-Meteo were not re-verified this session.
- No validated fuel map specific to Argentina or Angola was found. A global fuelbed map (e.g., Pettinari & Chuvieco 2016, FCCS-based) exists but was not checked.
- The Nelson model's accuracy outside North America was not assessed.
