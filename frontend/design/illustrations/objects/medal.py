"""Gold medal on a striped blue-red ribbon with a star emblem (achievement)."""
import math

CAMERA = {'azimuth': -16, 'elevation': 8}


def build(r):
    gold = r.metal('gold', '#ffc23d', rough=0.2)
    gold_dark = r.metal('goldDark', '#e9a91f', rough=0.3)
    blue = r.fabric('blue', r.BLUE, bump=0.1)
    red = r.fabric('red', r.RED, bump=0.1)
    for side, mat in ((-1, blue), (1, red)):
        strap = [(0, 0), (0.16 * side, 0), (0.34 * side, 0.6), (0.18 * side, 0.6)]
        r.shape(f'Ribbon{side}', strap if side > 0 else list(reversed(strap)), 0.02, (0.0, 0.03 * side, 0.5), mat=mat, bevel=0.006)
    r.torus('Ring', 0.06, 0.016, (0, 0, 0.5), (0, 90, 0), mat=gold)
    r.cylinder('Disc', 0.27, 0.05, (0, -0.02, 0.22), (90, 0, 0), mat=gold, bevel=0.018)
    r.torus('Rim', 0.22, 0.012, (0, -0.048, 0.22), (90, 0, 0), mat=gold_dark)
    star = [(math.cos(math.radians(90 + 36 * i)) * (0.13 if i % 2 == 0 else 0.055),
             math.sin(math.radians(90 + 36 * i)) * (0.13 if i % 2 == 0 else 0.055)) for i in range(10)]
    r.shape('Star', star, 0.025, (0, -0.055, 0.22), mat=gold_dark, bevel=0.008)
