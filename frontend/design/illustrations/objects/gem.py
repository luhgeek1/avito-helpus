"""Faceted brilliant-cut gem in light blue with small sparkles (quality)."""
import math

CAMERA = {'azimuth': -16, 'elevation': 18}
VIVID = True


def build(r):
    crystal = r.material('crystal', '#2a9dff', rough=0.1, coat=0.5)
    sparkle = r.glow('sparkle', '#ffffff', 3.0)
    gem = r.lathe('Gem', [(0.0, 0.0), (0.5, 0.55), (0.52, 0.6), (0.36, 0.78), (0.0, 0.78)], mat=crystal, steps=12)
    for poly in gem.data.polygons:
        poly.use_smooth = False
    gem.location = (0, 0, 0.02)
    for i, (x, z, s) in enumerate(((0.52, 0.95, 0.09), (-0.5, 0.82, 0.06), (0.62, 0.45, 0.05))):
        star = [(math.cos(math.radians(45 * k)) * (s if k % 2 == 0 else s * 0.25),
                 math.sin(math.radians(45 * k)) * (s if k % 2 == 0 else s * 0.25)) for k in range(8)]
        r.shape(f'Sparkle{i}', star, 0.02, (x, -0.1, z), mat=sparkle, bevel=0.004)
