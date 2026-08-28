import torch
import torch.nn as nn
import torch.nn.functional as F

class ResBlock(nn.Module):
    """
    Standard Residual Block without Batch Normalization,
    as recommended in the EDSR paper to preserve pixel range details.
    """
    def __init__(self, channels):
        super(ResBlock, self).__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        res = self.conv1(x)
        res = self.relu(res)
        res = self.conv2(res)
        return x + res

class EDSR(nn.Module):
    """
    EDSR: Enhanced Deep Residual Network for Single Image Super-Resolution
    Configured for 5x upscaling of grayscale images.
    """
    def __init__(self, in_channels=1, out_channels=1, num_features=64, num_blocks=8, scale=5):
        super(EDSR, self).__init__()
        self.scale = scale
        
        # 1. Feature extraction
        self.head = nn.Conv2d(in_channels, num_features, kernel_size=3, padding=1)
        
        # 2. Residual body
        self.body = nn.Sequential(
            *[ResBlock(num_features) for _ in range(num_blocks)]
        )
        self.body_tail = nn.Conv2d(num_features, num_features, kernel_size=3, padding=1)
        
        # 3. Upsampler (Scale factor = 5)
        # Pre-shuffle layer: maps features to feature_channels * (scale^2)
        self.upsample_conv = nn.Conv2d(num_features, out_channels * (scale ** 2), kernel_size=3, padding=1)
        self.pixel_shuffle = nn.PixelShuffle(scale)

    def forward(self, x):
        # Feature extraction
        x_head = self.head(x)
        
        # Residual body
        res = self.body(x_head)
        res = self.body_tail(res)
        
        # Residual connection
        feat = x_head + res
        
        # Upsampling and Pixel Shuffling
        out = self.upsample_conv(feat)
        out = self.pixel_shuffle(out)
        return out

class EdgeAwareBlock(nn.Module):
    """
    Custom block that extracts edge-like features using learned filters,
    helping the model focus on crater boundaries and boulder ridges.
    """
    def __init__(self, channels):
        super(EdgeAwareBlock, self).__init__()
        # Sobel-like vertical and horizontal feature detectors
        self.edge_conv = nn.Conv2d(channels, channels, kernel_size=3, padding=1)
        self.attention = nn.Sequential(
            nn.Conv2d(channels, channels, kernel_size=1),
            nn.Sigmoid()
        )

    def forward(self, x):
        # Compute local edge features
        edges = torch.abs(self.edge_conv(x))
        # Compute spatial attention weights based on edges
        attn = self.attention(edges)
        return x * attn + edges

class LunarSR(nn.Module):
    """
    LunarSR: Custom edge-preserving, crater-aware super-resolution model
    Integrates residual blocks with edge-attention pathways.
    """
    def __init__(self, in_channels=1, out_channels=1, num_features=64, num_blocks=6, scale=5):
        super(LunarSR, self).__init__()
        self.scale = scale
        
        # 1. Feature extraction
        self.head = nn.Conv2d(in_channels, num_features, kernel_size=3, padding=1)
        
        # 2. Main residual body
        self.body = nn.ModuleList([ResBlock(num_features) for _ in range(num_blocks)])
        
        # 3. Edge-aware attention path
        self.edge_block = EdgeAwareBlock(num_features)
        
        # 4. Feature fusion
        self.fuse_conv = nn.Conv2d(num_features * 2, num_features, kernel_size=1)
        self.body_tail = nn.Conv2d(num_features, num_features, kernel_size=3, padding=1)
        
        # 5. Upsampler
        self.upsample_conv = nn.Conv2d(num_features, out_channels * (scale ** 2), kernel_size=3, padding=1)
        self.pixel_shuffle = nn.PixelShuffle(scale)

    def forward(self, x):
        # Feature extraction
        x_head = self.head(x)
        
        # Main body path
        res = x_head
        for block in self.body:
            res = block(res)
            
        # Edge body path
        edge_feats = self.edge_block(x_head)
        
        # Fuse channels (residual features + edge features)
        fused = torch.cat([res, edge_feats], dim=1)
        fused = self.fuse_conv(fused)
        
        # Tail and add input features
        feat = x_head + self.body_tail(fused)
        
        # Upsampling
        out = self.upsample_conv(feat)
        out = self.pixel_shuffle(out)
        return out
