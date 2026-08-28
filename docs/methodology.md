# Scientific Methodology Guide

This guide details the mathematical and algorithmic pipeline utilized in the **LunarSafe AI** research prototype.

---

## 1. Image Preprocessing

### Radiometric Normalization
Normalized values $x_{\text{norm}}$ scale raw pixel values to $[0, 1]$ while clipping outliers (e.g. top and bottom 1% percentiles $P_1$ and $P_{99}$):
$$x_{\text{norm}} = \frac{\text{clip}(x, P_1, P_{99}) - P_1}{P_{99} - P_1}$$

### Denoising
Bilateral filters are used to denoise while preserving sharp edges:
$$I^{\text{filtered}}(x) = \frac{1}{W_p} \sum_{x_i \in \Omega} I(x_i) f_r(\|I(x_i) - I(x)\|) g_s(\|x_i - x\|)$$
where $f_r$ is the range kernel (intensity difference) and $g_s$ is the spatial kernel (pixel distance).

---

## 2. Super-Resolution upscaling

Transforms 5m input pixels to 1m estimated grids.
* **Bicubic:** Third-order algebraic interpolation.
* **EDSR:** ResBlock sequence (without batch normalization) mapping feature maps.
* **LunarSR:** Attention fuser combining residual features with an edge Sobel filtering sub-network:
  $$F_{\text{fused}} = \text{Conv}_{1\times1}([F_{\text{residual}} \,\|\, \text{EdgeAttention}(F_{\text{head}})])$$

---

## 3. Terrain Analysis

Calculates surface gradients using **Horn's method** over a 3x3 window:
$$dz/dx = \frac{(z_3 + 2z_6 + z_9) - (z_1 + 2z_4 + z_7)}{8 \Delta x}$$
$$dz/dy = \frac{(z_7 + 2z_8 + z_9) - (z_1 + 2z_2 + z_3)}{8 \Delta y}$$
$$\text{Slope (degrees)} = \arctan\left(\sqrt{(dz/dx)^2 + (dz/dy)^2}\right) \times \frac{180}{\pi}$$

---

## 4. Hazard Detection & Fusion

* **Craters:** Segmented using circular Hough transform bounds:
  $$(x - a)^2 + (y - b)^2 = r^2$$
* **Boulders:** In DEM mode, local maxima filter:
  $$\text{Boulder}(x, y) = \text{LocalMax}_{5\times5}(\text{DEM}) \quad \text{and} \quad \text{Height} > 0.8\text{m}$$
* **Fusion Score:** Weighted risk sum:
  $$\text{Hazard Score} = \sum w_i \times \text{Risk}_i$$
  Cells violating hard constraints (slope > 15°, direct shadow, boulder overlap) are forced to **1.0 (EXTREME)**.

---

## 5. Navigation Path Cost

The A* pathfinder minimizes:
$$\text{Cost}(A \to B) = \text{Distance}(A, B) + w_h \times H_B + w_u \times U_B + w_s \times S_B + w_r \times R_B$$
where:
* $H_B$ is hazard score.
* $U_B$ is uncertainty value.
* $S_B$ is slope.
* $R_B$ is roughness.
* $NO\_DATA$ and $EXTREME$ cells are set to infinite cost (obstacles).
