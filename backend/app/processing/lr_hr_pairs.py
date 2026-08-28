"""
lr_hr_pairs.py
Adapted from: LR_HR_Pair_Generation.ipynb + Utils.py (components/)
Creates LR/HR pairs for super-resolution training.
"""

import numpy as np
import cv2
from typing import List, Tuple, Dict


def normalize(input_data: np.ndarray) -> np.ndarray:
    """Normalize image to [-1, 1] range. Adapted from Utils.py."""
    return (input_data.astype(np.float32) - 127.5) / 127.5


def denormalize(input_data: np.ndarray) -> np.ndarray:
    """Denormalize from [-1, 1] to [0, 255]. Adapted from Utils.py."""
    output = (input_data + 1) * 127.5
    return np.clip(output, 0, 255).astype(np.uint8)


def generate_lr_image(hr_image: np.ndarray, downscale_factor: int = 5) -> np.ndarray:
    """
    Generates a low-resolution image from a high-resolution image.
    Adapted from Utils.py lr_images() — using bicubic downsampling.

    Args:
        hr_image: High-resolution image (OHRC-like, 0.25m)
        downscale_factor: Factor to downscale (default 5 for TMC 5m / target 1m)

    Returns:
        lr_image: Low-resolution image
    """
    h, w = hr_image.shape[:2]
    new_h = h // downscale_factor
    new_w = w // downscale_factor
    lr_image = cv2.resize(hr_image, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    return lr_image


def generate_lr_hr_pair(
    hr_image: np.ndarray,
    downscale_factor: int = 5
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Creates an LR/HR pair from a high-resolution reference image.
    Adapted from LR_HR_Pair_Generation.ipynb workflow.

    Args:
        hr_image: High-resolution source (OHRC-equivalent)
        downscale_factor: Downscale factor

    Returns:
        (lr_image, hr_image): Tuple of low-res and high-res images
    """
    lr_image = generate_lr_image(hr_image, downscale_factor)
    return lr_image, hr_image


def create_training_pairs(
    hr_images: List[np.ndarray],
    downscale_factor: int = 5,
    normalize_data: bool = True
) -> Dict[str, np.ndarray]:
    """
    Batch generates LR/HR pairs for a set of images.
    Adapted from LR_HR_Pair_Generation.ipynb batch processing.

    Args:
        hr_images: List of high-resolution images
        downscale_factor: Downscale factor
        normalize_data: Whether to normalize to [-1, 1]

    Returns:
        Dictionary with 'lr_images' and 'hr_images' numpy arrays
    """
    lr_list = []
    hr_list = []

    for img in hr_images:
        lr, hr = generate_lr_hr_pair(img, downscale_factor)
        lr_list.append(lr)
        hr_list.append(hr)

    lr_array = np.array(lr_list)
    hr_array = np.array(hr_list)

    if normalize_data:
        # Convert to uint8 first if float
        if lr_array.max() <= 1.0:
            lr_array = (lr_array * 255).astype(np.uint8)
            hr_array = (hr_array * 255).astype(np.uint8)
        lr_array = normalize(lr_array)
        hr_array = normalize(hr_array)

    return {
        "lr_images": lr_array,
        "hr_images": hr_array,
        "num_pairs": len(lr_list),
        "downscale_factor": downscale_factor,
        "lr_shape": lr_list[0].shape if lr_list else None,
        "hr_shape": hr_list[0].shape if hr_list else None
    }


def compute_pair_metrics(lr_image: np.ndarray, hr_image: np.ndarray) -> Dict:
    """
    Computes quality metrics for an LR/HR pair.
    Used for validation of pair generation quality.
    """
    # Upscale LR back to HR size for comparison
    lr_upscaled = cv2.resize(lr_image, (hr_image.shape[1], hr_image.shape[0]),
                             interpolation=cv2.INTER_CUBIC)

    # Ensure float
    if lr_upscaled.max() > 1.0:
        lr_upscaled = lr_upscaled.astype(np.float32) / 255.0
    if hr_image.max() > 1.0:
        hr_float = hr_image.astype(np.float32) / 255.0
    else:
        hr_float = hr_image.astype(np.float32)

    # PSNR
    mse = np.mean((lr_upscaled - hr_float) ** 2)
    psnr = 10 * np.log10(1.0 / (mse + 1e-10))

    # Mean absolute error
    mae = np.mean(np.abs(lr_upscaled - hr_float))

    return {
        "psnr_bicubic_baseline": round(float(psnr), 2),
        "mae": round(float(mae), 4),
        "mse": round(float(mse), 6),
        "lr_shape": list(lr_image.shape),
        "hr_shape": list(hr_image.shape)
    }
