"""
dataset_splitter.py
Adapted from: train_test_splitting.ipynb (components/)
Splits patch datasets into train/validation/test sets.
"""

import numpy as np
from typing import Dict, Tuple


def split_dataset(
    lr_patches: np.ndarray,
    hr_patches: np.ndarray,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    shuffle: bool = True,
    random_seed: int = 42
) -> Dict:
    """
    Splits LR/HR patch pairs into train/validation/test sets.
    Adapted from train_test_splitting.ipynb logic.

    Args:
        lr_patches: Low-resolution patches array (N, H, W) or (N, H, W, C)
        hr_patches: High-resolution patches array (N, H, W) or (N, H, W, C)
        train_ratio: Fraction for training (default 0.70)
        val_ratio: Fraction for validation (default 0.15)
        test_ratio: Fraction for testing (default 0.15)
        shuffle: Whether to shuffle before splitting
        random_seed: Random seed for reproducibility

    Returns:
        Dictionary with train/val/test sets and metadata
    """
    assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 1e-6, \
        "Ratios must sum to 1.0"
    assert len(lr_patches) == len(hr_patches), \
        "LR and HR patch counts must match"

    n = len(lr_patches)

    if shuffle:
        rng = np.random.RandomState(random_seed)
        indices = rng.permutation(n)
    else:
        indices = np.arange(n)

    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)

    train_idx = indices[:n_train]
    val_idx = indices[n_train:n_train + n_val]
    test_idx = indices[n_train + n_val:]

    return {
        "train": {
            "lr": lr_patches[train_idx],
            "hr": hr_patches[train_idx],
            "count": len(train_idx)
        },
        "validation": {
            "lr": lr_patches[val_idx],
            "hr": hr_patches[val_idx],
            "count": len(val_idx)
        },
        "test": {
            "lr": lr_patches[test_idx],
            "hr": hr_patches[test_idx],
            "count": len(test_idx)
        },
        "total_patches": n,
        "split_ratios": {
            "train": train_ratio,
            "validation": val_ratio,
            "test": test_ratio
        },
        "random_seed": random_seed,
        "shuffled": shuffle
    }


def get_split_summary(split_data: Dict) -> Dict:
    """
    Returns a summary of the dataset split for display.
    """
    return {
        "total_patches": split_data["total_patches"],
        "train_count": split_data["train"]["count"],
        "val_count": split_data["validation"]["count"],
        "test_count": split_data["test"]["count"],
        "train_pct": round(split_data["train"]["count"] / max(1, split_data["total_patches"]) * 100, 1),
        "val_pct": round(split_data["validation"]["count"] / max(1, split_data["total_patches"]) * 100, 1),
        "test_pct": round(split_data["test"]["count"] / max(1, split_data["total_patches"]) * 100, 1),
        "lr_patch_shape": list(split_data["train"]["lr"].shape[1:]) if split_data["train"]["count"] > 0 else [],
        "hr_patch_shape": list(split_data["train"]["hr"].shape[1:]) if split_data["train"]["count"] > 0 else []
    }
