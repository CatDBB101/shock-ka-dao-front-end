# ML and Hybrid (Physics + ML) Wildfire Spread Prediction: Datasets, Benchmarks, Pretrained Models (as of Nov 2026)

## Next Day Wildfire Spread (NDWS; Huot et al. 2022, IEEE TGRS): inputs, size, scores, later improvements

### Takeaway
NDWS has 18,545 tiles of 64x64 px at 1 km over the continental US. Each tile has 12 input layers (11 covariates plus the previous-day fire mask) and a next-day fire mask target. The original best model, a convolutional autoencoder, scored about 0.28 AUC-PR. Models from 2026 report about 0.34 AUC-PR and 0.42 F1 under stricter evaluation. Comparing numbers across papers is hard because, as several papers note, evaluation shortcuts inflate F1.

### Cited Findings
- **Inputs:** elevation, NDVI, min/max temperature (2 bands), precipitation, humidity, wind speed, wind direction, drought index, energy release component (ERC), population density, and the previous-day fire mask (`fire_prev`). The target is the next-day fire mask. The card calls these "twelve covariates" plus a fire mask. Providers are gridMET, USGS and NASA MODIS. — [HF isp-uv-es/next-day-wildfire-spread-taco card](https://huggingface.co/datasets/isp-uv-es/next-day-wildfire-spread-taco)
- **Shape:** 1 km resolution, 64x64 tiles, 18,545 samples (train 14,979 / val 1,877 / test 1,689), continental US. Labels use -1 for uncertain pixels, to be treated as the ignore index. The release has no CRS, geotransform or date, so tiles cannot be georeferenced. — [HF TACO card](https://huggingface.co/datasets/isp-uv-es/next-day-wildfire-spread-taco)
- **Coverage:** "nearly a decade of remote-sensing data … across the United States". The paper compares a neural network against logistic regression and random forest. — [arXiv 2112.02447](https://arxiv.org/abs/2112.02447)
- **Original host:** Kaggle `fantineh/next-day-wildfire-spread`, licensed CC-BY-4.0. — [Kaggle link as given on HF card](https://www.kaggle.com/datasets/fantineh/next-day-wildfire-spread)
- **Baseline score:** Huot et al. reported AUC-PR 0.284 for their convolutional autoencoder (Conv-AE) on the test split. This figure is quoted by a 2024 re-evaluation paper. The same paper finds that precision, recall and AUC-PR "degrade significantly" as the Dice coefficient between consecutive fire masks falls. In other words, much of the apparent skill comes from persistence. — [arXiv 2402.15163](https://arxiv.org/pdf/2402.15163)
- **FireSenseNet (Apr 2026):** a dual-branch CNN with cross-attention. It scores F1 0.4176 and AUC-PR 0.3435 on NDWS. A SegFormer baseline scores F1 0.3502 with about 3.8x more parameters. The authors claim common evaluation shortcuts inflated F1 in prior work by more than 44%. They also note that NDWS's daily time step limits how much wind contributes. — [arXiv 2604.07675](https://arxiv.org/abs/2604.07675)
- **TD-FusionUNet:** reports F1 0.591 with 370k parameters on NDWS and WildfireSpreadTS. It is not clear which protocol produced this number. — [search summary of arXiv 2503.14150](https://arxiv.org/html/2503.14150v1)
- **Other 2026 work:** "Modular Deep Learning Mechanisms for Auditable Next-Day Wildfire Spread Prediction" (arXiv 2609.17763) uses the stricter protocol. — [arXiv 2609.17763](https://arxiv.org/pdf/2609.17763)
- **HF mirrors (both CC-BY-4.0):**
  - `TheRootOf3/next-day-wildfire-spread`: xarray format with train/eval/test splits and arbitrary coordinates. — [HF](https://hf.co/datasets/TheRootOf3/next-day-wildfire-spread)
  - `isp-uv-es/next-day-wildfire-spread-taco`: TACO v3 format, 1.72 GB zip. Loading needs the C++23 `taco` reader, and the HF viewer does not work for it. — [HF](https://hf.co/datasets/isp-uv-es/next-day-wildfire-spread-taco)

### Inferences
- NDWS is the easiest dataset to plug into an HF Trainer segmentation pipeline: 64x64 tiles with 12 channels and a binary mask. SegFormer or a U-Net needs its first layer changed to accept 12 channels instead of RGB, and the loss must ignore label -1.
- Because the tiles have no geolocation, NDWS cannot be used to evaluate transfer to the user's regions. It is a US-only pretraining source.
- The 2022 baseline (0.284) and the 2026 numbers (about 0.34) are not strictly comparable because the evaluation protocols differ.

### Gaps
- I could not extract the original paper's exact precision/recall table or date range because the PDF text was not readable. The commonly cited range is 2012–2020, with recall around 0.43 and precision around 0.34 for the Conv-AE, but I did not verify these.

## WildfireSpreadTS (WSTS; Gerard et al., NeurIPS 2023 D&B): baselines and follow-ups

### Takeaway
WSTS has 607 western-US fires from 2018–2021: 13,607 daily images, 23 channels, 375 m resolution, with VIIRS active-fire masks. Original baselines scored about 0.33–0.37 average precision (AP). WSTS+ (WACV 2026) raised this to about 0.48 AP with a UTAE that uses a ResNet18 encoder, and extended the data to 1,005 fires from 2016–2023. A 2026 benchmark warns that AP alone is a poor guide for operational use.

### Cited Findings
- **Dataset:** 607 events, western US, 2018–2021, 13,607 daily multi-channel images. The 23 channels cover active fire, weather, topography and vegetation, resampled to 375 m. Evaluation uses 12-fold leave-one-year-out cross-validation. — [WSTS+ paper, arXiv 2502.12003](https://arxiv.org/html/2502.12003v2)
- **Original Gerard et al. baselines (AP; Veg / Multi / All feature sets):**
  - Res18-UNet, 1-day input: 0.328 / 0.341 / 0.341
  - Res18-UNet, 5-day input: 0.333 / 0.344 / 0.325
  - UTAE, 5-day input: 0.372 / 0.350 / 0.321 — [arXiv 2502.12003](https://arxiv.org/html/2502.12003v2)
- **WSTS+ improved training (AP; Veg / Multi / All):**
  - Res18-UNet, 1-day: 0.455 / 0.468 / 0.460
  - SwinUnet, 5-day: 0.447 / 0.453 / 0.435
  - UTAE, 5-day: 0.452 / 0.459 / 0.433 (1.1M params)
  - UTAE(Res18), 5-day: 0.478 / 0.477 / 0.475 (14.6M params). Best overall result: AP 0.478.
  - SwinUnet's results depend on ImageNet pretraining. — [arXiv 2502.12003](https://arxiv.org/html/2502.12003v2); [WACV 2026 poster](https://wacv.thecvf.com/virtual/2026/poster/685)
- **WSTS+ dataset:** adds 2016, 2017, 2022 and 2023. Fires grow from 607 to 1,005, images from 13,607 to 24,462, and active-fire pixels from 1.88M to 2.64M. On the harder 4-fold WSTS+ split, AP is only about 0.35–0.36 (Res18-UNet-LTAE, 5-day, Multi: 0.363). — [arXiv 2502.12003](https://arxiv.org/html/2502.12003v2)
- **WildfireSpreadBench (NeurIPS 2026 CCAI workshop):** tests 5 discriminative models and 1 generative model on WSTS.
  - The highest-AP model flagged 4–5x the observed fire area and ranked 5th of 6 on F1 and IoU.
  - Models whose flagged area stayed close to the observed area had 24–37% lower AP.
  - Going from 7 to 23 input channels changed AP by only 0.03, versus a 0.21–0.24 spread across architectures. — [arXiv 2609.22191](https://arxiv.org/abs/2609.22191)
- **Uncertainty quantification:** boundary-aware UQ on WSTS with UTAE and U-Net backbones. — [arXiv 2605.03148](https://arxiv.org/pdf/2605.03148)
- **Pretrained model on HF:** `eitanlebras/fire-spread-forecast-v1-small` (MIT license)
  - U-Net, 1.94M params, 40 channels derived from WSTS's 23 bands, 375 m, 24 h horizon.
  - Trained on 258 fires: train 2018–19, eval 2020, test 2021.
  - Test AUC-PR 0.552 ± 0.003 versus 0.273 for persistence. On pixels not burning today, AUC-PR is 0.243 versus 0.003 for persistence. ECE 0.0044.
  - Runs on CPU in about 4 s per 18-day fire. Inference script outputs GeoTIFFs.
  - Card: "Not for evacuation decisions". Does not model spotting. Validated only on western US 2018–2021.
  - This test split differs from WSTS cross-validation, so the AUC-PR is not comparable to the AP figures above. — [HF model card](https://huggingface.co/eitanlebras/fire-spread-forecast-v1-small)
- **WSTS mirrors on HF (both CC-BY-4.0):**
  - `isp-uv-es/wildfirespreadts-taco`: TACO repackaging. — [HF](https://hf.co/datasets/isp-uv-es/wildfirespreadts-taco)
  - `Emulated-Inc/sci-wildfire-next-day-spread`: 2018–2020 raster tars only, with SHA256 sums. — [HF](https://hf.co/datasets/Emulated-Inc/sci-wildfire-next-day-spread)
- **Third-party WSTS+ table:** a mirror (`saadlahrichi/WSTSPlus`) carries a WSTS+ results table (SegFormer 0.439, SwinUnet 0.447 AP). It is secondary and its formatting is garbled. — [HF mirror page](https://shzhoutlhf.pages.dev/saadlahrichi/WSTSPlus)
- **Unverified:** `nikos230/WildfireSpread` exists on HF with about 650 downloads. It has no card or license. — [HF](https://hf.co/datasets/nikos230/WildfireSpread)

### Inferences
- WSTS is the closest match to the user's pipeline because its fire masks come from VIIRS active fires, which is what FIRMS distributes. Its 375 m daily masks can in principle be rebuilt for any region from FIRMS data, but the weather (gridMET) and fuel/land-cover layers would have to be replaced with global equivalents such as ERA5 and MODIS land cover.
- For operational use, report F1/IoU and the ratio of predicted to observed area alongside AP.

### Gaps
- I did not verify the original WSTS ConvLSTM or logistic-regression AP values, or the GitHub repo URL. The commonly known repo is `SebastianGer/WildfireSpreadTS`, but this is unverified.

## Other datasets and benchmarks

### Takeaway
Few datasets outside the US are built for spread prediction. Mesogeos (Mediterranean, 1 km daily) and SeasFire (global, but weekly/monthly at 0.25°) are the main non-US options. Sim2Real-Fire offers about 1M simulated fires. The global perimeter and event products (GlobFire, FIRED country-level, Global Fire Atlas) are MODIS-based. Newer VIIRS event products exist but are mostly preprints.

### Cited Findings
- **Mesogeos (NeurIPS 2023 D&B):**
  - Mediterranean, 2006–2022, datacube at 1 km x 1 km x 1 day, covering weather, vegetation, human factors, ignitions and burned areas.
  - Two tracks: short-term danger forecasting, and final burned area from the ignition point.
  - Burned-area track leaderboard (U-Net): all variables CE 0.0177 / AUPRC 0.394; ignition only CE 0.0166 / AUPRC 0.418.
  - Data, models and code are open. — [arXiv 2306.05144](https://arxiv.org/pdf/2306.05144); [project page](https://orionlab.space.noa.gr/mesogeos)
  - I found no Mesogeos repo on the HF Hub (HF search, Nov 2026).
- **SeasFire:** global datacube on HF.
  - `orion-ai-lab/seasfire_monthly`: CC-BY-4.0, zarr/xarray, 10B–100B size category, task "time-series-forecasting". — [HF](https://hf.co/datasets/orion-ai-lab/seasfire_monthly)
  - `orion-ai-lab/seasfire_anomalies` also exists. — [HF](https://hf.co/datasets/orion-ai-lab/seasfire_anomalies)
  - This is seasonal burned-area forecasting, not next-day spread.
- **Sim2Real-Fire (NeurIPS 2024 D&B, Tianjin Univ.):**
  - About 1M simulated fire scenarios from FARSITE, WFDS and WRF-SFIRE, with topography, vegetation, fuel, satellite images and fire masks.
  - About 1K real-world test scenarios.
  - Proposes S2R-FireTr, a transformer for forecasting and backtracking.
  - GitHub `TJU-IDVLab/Sim2Real-Fire`, Apache-2.0. — [NeurIPS paper](https://papers.neurips.cc/paper_files/paper/2024/file/02e978a2cc9a1d0d4376a7deb01db612-Paper-Datasets_and_Benchmarks_Track.pdf); [supplement](https://papers.neurips.cc/paper_files/paper/2024/file/02e978a2cc9a1d0d4376a7deb01db612-Supplemental-Datasets_and_Benchmarks_Track.pdf)
- **GlobFire:** global, MODIS burned area, daily perimeters, daily size, and estimates of fire-front location and spread direction. Covers 2001–2017 per one source. — [Sci Data 2024 summary](https://link.springer.com/10.1038/s41597-024-03436-4)
- **FIRED:** MODIS-based (not VIIRS). Continuous spread rate and direction. The CONUS version covers 2001–2019. — [Sci Data 2024 summary](https://link.springer.com/10.1038/s41597-024-03436-4)
  - Country-level FIRED perimeter datasets (2001–2021) exist. — [PubMed 35908041](https://pubmed.ncbi.nlm.nih.gov/35908041/); [Sci Data 2022](https://link.springer.com/article/10.1038/s41597-022-01343-0)
- **VIIRS-based event products:**
  - FEDS: 375 m VIIRS, 12 h progression, California only.
  - CONFEX: CONUS and Alaska, 2012–2024, VIIRS S-NPP.
  - A global VIIRS event dataset for 2012–2025 with daily expansion rates is a preprint; whether it includes direction is unconfirmed. — [ESSD preprint 2026-387](https://essd.copernicus.org/preprints/essd-2026-387/essd-2026-387.pdf); [ESSD preprint 2026-116](https://essd.copernicus.org/preprints/essd-2026-116/essd-2026-116.pdf)
- **Other HF datasets with a spread or prediction angle:**
  - `chaseungjoon/wildfire-korea-episodes-300m` (MIT): South Korea fire progression from FIRMS VIIRS/MODIS plus static layers on a 300 m grid. — [HF](https://hf.co/datasets/chaseungjoon/wildfire-korea-episodes-300m)
  - `chaseungjoon/wildfire-korea-embedded-300m` (MIT, 16-channel tiles). — [HF](https://hf.co/datasets/chaseungjoon/wildfire-korea-embedded-300m)
  - `chaseungjoon/wildfire-prediction-A3C-LSTM`: a reinforcement-learning model trained on the Korea datasets. — [HF](https://hf.co/chaseungjoon/wildfire-prediction-A3C-LSTM)
  - `mateus-pcosta/brazil-wildfire-geospatial-dataset` (CC-BY-SA-4.0): INPE hotspots for Brazil, 2018–2025, with MapBiomas land cover, 100M–1B rows. — [HF](https://hf.co/datasets/mateus-pcosta/brazil-wildfire-geospatial-dataset)
  - `links-ads/wildfires-cems` (CC-BY-4.0): Sentinel-2 burned-area segmentation for Europe. — [HF](https://hf.co/datasets/links-ads/wildfires-cems)
  - `links-ads/effis-wildfire` (Apache-2.0): Sentinel-2 imagery of EFFIS events. — [HF](https://hf.co/datasets/links-ads/effis-wildfire)
  - `moritzrengert1/wildfire_global` (CC-BY-4.0): geographically balanced Sentinel-2 dNBR set for VLM evaluation. — [HF](https://hf.co/datasets/moritzrengert1/wildfire_global)
  - `WildfireIA/Anonymous-WildfireIA`: event-level benchmark (license "other"). — [HF](https://hf.co/datasets/WildfireIA/Anonymous-WildfireIA)
  - `seahorse-stpp/us_wildfires_stpp`: FPA-FOD ignitions as point-process data. — [HF](https://hf.co/datasets/seahorse-stpp/us_wildfires_stpp)

### Inferences
- **Coverage for the user's countries:**
  - Canada, Argentina, Angola and Australia have no ready-made next-day spread benchmark.
  - Global MODIS products (GlobFire, FIRED country-level, Global Fire Atlas) give spread direction labels at about 500 m.
  - VIIRS FIRMS hotspots can be rasterised into WSTS-style daily masks.
  - Mesogeos (Mediterranean shrubland) may transfer somewhat better to Argentina and Australia than US data does, but this is untested.
  - Angola is dominated by savanna fires, which none of these spread benchmarks represent.

### Gaps
- I did not verify FireCast, WildfireDB, CalFire FRAP perimeters or the Canadian National Burned Area Composite (NBAC) in this session.
- From general knowledge only, not checked here:
  - WildfireDB (NeurIPS 2021 D&B) is a US VIIRS-plus-covariates spread-relationship database.
  - NBAC is Natural Resources Canada's annual burned-area polygons (Landsat-based, since 1972).
  - CalFire FRAP is California's historical perimeter database.
- None of these appeared on the HF Hub in my searches.

## Hybrid physics–ML: emulators, physics-informed neural networks (PINNs), data assimilation, Google work

### Takeaway
Deep-learning surrogates trained on simulator output reach 0.68–0.94 Jaccard against the simulators they emulate (ELMFIRE, SPARK, FARSITE), and predict orders of magnitude faster. The established way to assimilate VIIRS/MODIS hotspots is to correct the fire-arrival-time level set in WRF-SFIRE. Google's FireBench is a 1.36 PiB large-eddy simulation (LES) ensemble that can serve as ML training data.

### Cited Findings
- **ELMFIRE surrogates:** 10,000 ELMFIRE simulations were used to train grid-invariant surrogates. RAPIDS-Fire scores 0.79 Jaccard and SCALED-Fire 0.68; SCALED-Fire handles no-burn features better. These are preliminary conference results. — [EGU26-22628 supplement](https://presentations.copernicus.org/EGU26/EGU26-22628_supplement.pdf)
- **SPARK emulator:** a spatio-temporal emulator of firefront models reaches 0.76 average Jaccard. A related uncertainty paper reports 67.4% Jaccard on 35 fires compared against SPARK. — [arXiv 2206.08523](https://arxiv.org/abs/2206.08523v2); [arXiv 2305.06139](https://arxiv.org/pdf/2305.06139v2.pdf)
- **FARSITE-trained network:** a deep network trained on FARSITE output predicts the final fire scar at 0.89–0.94 Jaccard, orders of magnitude faster than the simulator. — [arXiv 2210.16411](https://www.arxiv.org/pdf/2210.16411)
- **Earlier CNN emulator:** a CNN emulator of empirical rate-of-spread simulators (FARSITE, Prometheus, Phoenix). — [Allaire et al. 2021, via core.ac.uk](https://core.ac.uk/download/395676561.pdf)
- **WRF-SFIRE assimilation (Mandel et al. 2014):** adjusts the fire arrival time to stay close to the forecast while maximising the likelihood of the satellite detections, using methods borrowed from contour detection. The arrival-time encoding lets the model go back in time and spin up the atmosphere from the corrected heat fluxes. VIIRS/MODIS hotspots are irregular, have gaps and carry location uncertainty. — [arXiv 1410.6948](https://arxiv.org/pdf/1410.6948)
- **2018 refinement:** treats the level-set equation as only approximately satisfied, which respects diurnal fuel-moisture effects. — [arXiv 1804.03995](https://arxiv.org/pdf/1804.03995)
- **ML estimate of arrival time:** Farguell et al. estimate fire arrival time from Level-2 active fires with an SVM-style separating hyperplane between last-seen-unburned and first-detected times, tested on 5 large fires. — [MDPI Remote Sensing 13(11):2203](https://mdpi.com/2072-4292/13/11/2203); [WRF workshop 2019 abstract](https://www2.mmm.ucar.edu/wrf/users/workshops/WS2019/short_abstracts/p2.html)
- **FireBench (Google, 2024):**
  - 117 SWIRL-FIRE LES runs (9 wind speeds x 13 slopes) on a 1500x250x1800 m domain with 1.35B grid points, totalling 1.36 PiB on Google Cloud, generated with about 200k TPU-hours.
  - Rate of spread agrees with experimental data. The authors identify a critical Froude number separating plume-driven from convection-driven fires. — [arXiv 2406.08589](https://arxiv.org/abs/2406.08589); [Google blog](https://research.google/blog/firebench-using-high-performance-computing-to-advance-machine-learning-and-wildfire-research/); [BLASTNet page](https://blastnet.github.io/wang2024)
- **Differentiable eikonal solvers:** differentiable Randers–Finsler eikonal solvers (2026) are a physics-structured approach to front propagation that can be trained by gradient descent; the paper uses Sim2Real-Fire. — [arXiv 2603.00035](https://arxiv.org/pdf/2603.00035)

### Inferences
- A practical hybrid for the app would run in three steps:
  1. Rasterise FIRMS hotspots into an arrival-time field.
  2. Advance it with a cheap Rothermel or Huygens-style eikonal spread, driven by wind and slope.
  3. Have an ML model (for example a U-Net or the HF U-Net above) correct the spread-rate field.
- Emulator Jaccard scores only measure agreement with a simulator, not with real fires.

### Gaps
- I did not research Google's FireSat in this session. From general knowledge, it is a planned satellite constellation for early fire detection, not a spread model.
- I found no published PINN that predicts real-fire front propagation with real-data metrics. The PINN literature appears to be mostly synthetic level-set tests (not verified here).

## Quantitative comparison: ML vs Rothermel-based simulators

### Takeaway
Head-to-head evidence is thin. The best case study (Maui 2023) found FARSITE and ConvLSTM models essentially tied on F1 (about 0.48–0.49, where F1 equals Sørensen–Dice for binary masks). FARSITE had higher precision and the ML models overpredicted. I found no published direction-accuracy-within-±45° numbers for ML spread models.

### Cited Findings
- **Maui 2023 study:**
  - Excluding Lahaina, single-step F1 was ConvLSTM 0.4848, ConvLSTM with attention 0.4841, FARSITE 0.4883.
  - FARSITE had higher precision and lower recall. Its apparent success at Lahaina is an artefact: it cannot simulate urban land.
  - The deep-learning models predict in under 1 s versus about 1 min for FARSITE, but need training. — [arXiv 2509.21327](https://arxiv.org/pdf/2509.21327); [UB news](https://www.buffalo.edu/news/releases/2026/03/ai-wildfire-spread-prediction.html)
- **Persistence baselines:** the AUC-PR values reported on the HF U-Net card (0.273 overall; 0.003 for the growth region) show that most next-day "skill" comes from persistence. — [HF card](https://huggingface.co/eitanlebras/fire-spread-forecast-v1-small)
- **Emulator agreement:** Jaccard of surrogate versus its own simulator is 0.68–0.94 (see the hybrid section above). These numbers do not measure accuracy against real fires. — [arXiv 2210.16411](https://www.arxiv.org/pdf/2210.16411); [EGU26](https://presentations.copernicus.org/EGU26/EGU26-22628_supplement.pdf)

### Inferences
- For the app's "direction" output, a defensible approach is to derive the growth direction from the change in predicted mask (centroid shift, or the principal axis of newly burned pixels) and validate it against FIRMS day-to-day growth. No established ±45° benchmark exists, so the app would have to define its own metric.

### Gaps
- I found no study reporting angular accuracy of predicted spread direction, ML or physics.
- I found no large-sample ML-versus-FARSITE/Prometheus comparison outside single case studies.

## Hugging Face Hub inventory and training notes (searches for "wildfire", "fire spread", "next day wildfire", Nov 2026)

### Takeaway
The HF Hub has three spread-relevant datasets (two NDWS mirrors and the WSTS mirrors) and one dedicated pretrained spread model (`eitanlebras/fire-spread-forecast-v1-small`). Most other "wildfire" repos are about detection (YOLO, VLMs) or burned-area segmentation.

### Cited Findings
- **Spread datasets:**

  | Repo | License | Notes |
  |---|---|---|
  | `TheRootOf3/next-day-wildfire-spread` | CC-BY-4.0 | NDWS in xarray format |
  | `isp-uv-es/next-day-wildfire-spread-taco` | CC-BY-4.0 | NDWS, 1.72 GB, TACO format |
  | `isp-uv-es/wildfirespreadts-taco` | CC-BY-4.0 | WSTS, TACO format |
  | `Emulated-Inc/sci-wildfire-next-day-spread` | CC-BY-4.0 | WSTS 2018–2020 tars |
  | `nikos230/WildfireSpread` | none | No card |

  — [HF search results](https://hf.co/datasets?search=wildfire)
- **Spread model:** `eitanlebras/fire-spread-forecast-v1-small`, MIT license, 1.9M-param U-Net, safetensors. It is a custom PyTorch class, not a `transformers` architecture. — [HF](https://hf.co/eitanlebras/fire-spread-forecast-v1-small)
- **Segmentation models that could be adapted (cards are minimal):**
  - `bdudgss/embersense-wildfire-segformer` (SegFormer, transformers). — [HF](https://hf.co/bdudgss/embersense-wildfire-segformer)
  - `claudezss/wildfire-segmentation` (PyTorchModelHubMixin). — [HF](https://hf.co/claudezss/wildfire-segmentation)
  - `gdurkin/cali_wildfires_superbuckets` (Mask2Former). — [HF](https://hf.co/gdurkin/cali_wildfires_superbuckets)
- **Not spread models:** `hiko1999/Qwen2-Wildfire-2B` (VLM), the YOLO fire/smoke detectors, and `Paulescu/wildfire-risk-detector` (LFM2.5-VL). — [HF](https://hf.co/hiko1999/Qwen2-Wildfire-2B)
- **No HF repos found for:** "mesogeos", or "fire spread" datasets beyond those listed. — HF hub search

### Inferences
- **Training recipe with the HF Trainer:**
  1. Load the NDWS TFRecords from Kaggle, or the xarray/TACO mirrors, into a `datasets.Dataset` of `pixel_values` (C=12, 64x64) and `labels`.
  2. Use `SegformerForSemanticSegmentation` with `num_channels=12`, `num_labels=2`, `ignore_index=-1`, a positive-weighted or focal loss, and dihedral augmentations.
  3. For WSTS, use 23 or more channels (one-hot land cover gives 40, as on the HF card), 128x128 tiles, and leave-one-year-out splits.
  4. Report AP, F1/IoU and the predicted-to-observed area ratio.
- **Fine-tuning for the user's regions:**
  - Build WSTS-style samples from FIRMS VIIRS 375 m hotspots plus ERA5 or GFS weather, Copernicus DEM and MODIS land cover/NDVI.
  - Pretrain on WSTS/NDWS, then fine-tune on a small regional set.
  - Expect a domain shift for Angola's savannas and Australia's eucalypt fuels.
- The TACO mirrors need a C++ reader. The Kaggle TFRecords or the `TheRootOf3` xarray version are simpler to load.

### Gaps
- I did not verify exact repo sizes for most HF entries; only the 1.72 GB TACO NDWS zip is confirmed.
- I did not search Kaggle or Zenodo directly beyond the NDWS Kaggle link. Zenodo DOIs for WSTS and Mesogeos are unverified.
