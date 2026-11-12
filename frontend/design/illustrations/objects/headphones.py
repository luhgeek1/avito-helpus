"""Over-ear headphones: purple headband, white cups with soft cushions and metal sliders."""
import math

CAMERA = {'azimuth': -24, 'elevation': 12}


def build(r):
    shell = r.plastic('shell', '#f6f7fa', rough=0.28, coat=0.5)
    band = r.plastic('band', r.PURPLE, rough=0.35, coat=0.3)
    cushion = r.material('cushion', '#2d3038', rough=0.75, bump=0.15, bump_scale=500)
    slider = r.metal('slider', '#d6dbe2', rough=0.2)

    arc = [(0.42 * math.cos(math.radians(a)), 0, 0.5 + 0.48 * math.sin(math.radians(a))) for a in range(0, 181, 15)]
    r.tube('Headband', arc, 0.045, band)
    r.tube('BandPad', [(x, 0, z - 0.035) for x, _, z in arc[3:-3]], 0.035, cushion)
    for side in (-1, 1):
        r.cylinder(f'Slider{side}', 0.018, 0.14, (0.42 * side, 0, 0.45), mat=slider)
        r.box(f'Yoke{side}', (0.05, 0.3, 0.05), (0.42 * side, 0, 0.36), mat=slider, bevel=0.02, segments=3)
        r.cylinder(f'Cup{side}', 0.2, 0.12, (0.47 * side, 0, 0.24), (0, 90, 0), mat=shell, bevel=0.05)
        r.torus(f'Cushion{side}', 0.15, 0.055, (0.39 * side, 0, 0.24), (0, 90, 0), mat=cushion)
        r.cylinder(f'Badge{side}', 0.07, 0.012, (0.535 * side, 0, 0.24), (0, 90, 0), mat=band, bevel=0.004)
