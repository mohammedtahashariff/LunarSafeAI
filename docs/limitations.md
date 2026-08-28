# Scientific Limitations of Image Super-Resolution in Lunar Landing Operations

This document establishes the scientific constraints of the **LunarSafe AI** platform, warning researchers against invalid assumptions regarding the physical limits of image super-resolution (SR).

---

## 1. Separation of Intensity and Elevation

> [!IMPORTANT]
> **Super-resolution is not elevation reconstruction.**
> Upscaling a 2D optical image (e.g., TMC 5m) improves the visual spatial representation of surface pixels, but **does not** physically measure height. The reconstructed 1m grid-spacing image represents estimated light intensity values based on surface reflectivity, shadowing, and soil albedo. It is mathematically invalid to directly convert upscaled 2D pixel intensities into a physically valid Digital Elevation Model (DEM).

Physical elevation calculations—specifically **slope**, **roughness**, and **local relief**—require direct physical measurement, typically via:
1. **LOLA (Lunar Orbiter Laser Altimeter):** LiDAR range measurements.
2. **Stereo Reconstruction:** Reconstructing depth from multiple overlapping optical angles of TMC.
3. **Existing DEM rasters:** Grid-based elevation heights.

If a DEM is unavailable, these elevation-dependent metrics are marked `UNAVAILABLE` inside the platform.

---

## 2. Information Conservation (No Magical Recovery)

Single Image Super-Resolution (SISR) models (EDSR, SwinIR, LunarSR) estimate the high-resolution grid using learned prior patterns of lunar morphology (craters, boulders, soil textures). 

* **Estimated Details:** While the model synthesizes sharp edges and circular crater contours, these features represent *interpolated estimations* based on spatial patterns, not *direct physical observations*.
* **Risk of Hallucination:** Generative or deep learning networks can occasionally hallucinate circular details (falsely detecting a crater that does not exist) or fail to represent fine-scale boulders under low-lighting angles. 

---

## 3. Operations Impact (False-Safe Risk)

In autonomous landing navigation, classifying a hazardous area as safe (a **False-Safe** error) is catastrophic. 
* **False-Safe Rate:** Image-only hazard detection (e.g. shadow contrast thresholding or Hough crater circles on TMC) can miss fine hazard objects. 
* **Validation Requirement:** Researchers must validate SR upscaled hazard maps against actual high-resolution reference data (e.g., 25cm OHRC) in overlapping regions to establish operational reliability before mission deployment.
