"""
patch_generator.py
Adapted from: construct_patches.ipynb (components/)
Creates training patches from LR/HR image pairs.
"""

import numpy as np
from typing import List, Tuple, Dict


def extract_patches(
    image: np.ndarray,
    patch_size: int = 96,
    stride: int = 48
) -> List[np.ndarray]:
    """
    Extracts patches from an image using a sliding window approach.
    Adapted from construct_patches.ipynb logic.

    Args:
        image: Input 2D image (H, W) or (H, W, C)
        patch_size: Size of each square patch
        stride: Step size between patches

    Returns:
        List of image patches
    """
    patches = []
    h, w = image.shape[:2]

    for y in range(0, h - patch_size + 1, stride):
        for x in range(0, w - patch_size + 1, stride):
            if image.ndim == 2:
                patch = image[y:y + patch_size, x:x + patch_size]
            else:
                patch = image[y:y + patch_size, x:x + patch_size, :]
            patches.append(patch)

    return patches


def construct_training_patches(
    lr_images: List[np.ndarray],
    hr_images: List[np.ndarray],
    lr_patch_size: int = 24,
    hr_patch_size: int = 96,
    stride_lr: int = 12,
    stride_hr: int = 48
) -> Dict:
    """
    Creates aligned LR/HR patch pairs for training.
    Adapted from construct_patches.ipynb workflow.

    The LR patch at position (i, j) corresponds to the HR patch
    at position (i * scale, j * scale).

    Args:
        lr_images: List of low-resolution images
        hr_images: List of high-resolution images
        lr_patch_size: Patch size for LR images
        hr_patch_size: Patch size for HR images (= lr_patch_size * scale)
        stride_lr: Stride for LR patch extraction
        stride_hr: Stride for HR patch extraction

    Returns:
        Dictionary with LR and HR patch arrays and metadata
    """
    lr_patches = []
    hr_patches = []
    scale_factor = hr_patch_size // lr_patch_size

    for lr_img, hr_img in zip(lr_images, hr_images):
        lr_h, lr_w = lr_img.shape[:2]
        hr_h, hr_w = hr_img.shape[:2]

        # Extract aligned patches
        for y_lr in range(0, lr_h - lr_patch_size + 1, stride_lr):
            for x_lr in range(0, lr_w - lr_patch_size + 1, stride_lr):
                # Corresponding HR position
                y_hr = y_lr * scale_factor
                x_hr = x_lr * scale_factor

                # Bounds check for HR
                if y_hr + hr_patch_size > hr_h or x_hr + hr_patch_size > hr_w:
                    continue

                if lr_img.ndim == 2:
                    lr_patch = lr_img[y_lr:y_lr + lr_patch_size, x_lr:x_lr + lr_patch_size]
                    hr_patch = hr_img[y_hr:y_hr + hr_patch_size, x_hr:x_hr + hr_patch_size]
                else:
                    lr_patch = lr_img[y_lr:y_lr + lr_patch_size, x_lr:x_lr + lr_patch_size, :]
                    hr_patch = hr_img[y_hr:y_hr + hr_patch_size, x_hr:x_hr + hr_patch_size, :]

                lr_patches.append(lr_patch)
                hr_patches.append(hr_patch)

    return {
        "lr_patches": np.array(lr_patches) if lr_patches else np.array([]),
        "hr_patches": np.array(hr_patches) if hr_patches else np.array([]),
        "num_patches": len(lr_patches),
        "lr_patch_size": lr_patch_size,
        "hr_patch_size": hr_patch_size,
        "scale_factor": scale_factor
    }


def augment_patches(
    lr_patches: np.ndarray,
    hr_patches: np.ndarray,
    flip_horizontal: bool = True,
    flip_vertical: bool = True,
    rotate_90: bool = True
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Augments patch pairs with geometric transforms.
    Maintains alignment between LR and HR patches.

    Returns:
        Augmented (lr_patches, hr_patches) arrays
    """
    aug_lr = [lr_patches]
    aug_hr = [hr_patches]

    if flip_horizontal:
        aug_lr.append(np.flip(lr_patches, axis=2))
        aug_hr.append(np.flip(hr_patches, axis=2))

    if flip_vertical:
        aug_lr.append(np.flip(lr_patches, axis=1))
        aug_hr.append(np.flip(hr_patches, axis=1))

    if rotate_90:
        aug_lr.append(np.rot90(lr_patches, k=1, axes=(1, 2)))
        aug_hr.append(np.rot90(hr_patches, k=1, axes=(1, 2)))

    return np.concatenate(aug_lr, axis=0), np.concatenate(aug_hr, axis=0)
