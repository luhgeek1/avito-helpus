"""Christmas tree: three tiers, glossy baubles in brand colours, gold garland and a star."""
import math

CAMERA = {'azimuth': -20, 'elevation': 12}
VIVID = True


def build(r):
    needles = r.material('needles', '#20b65a', rough=0.5, bump=0.25, bump_scale=120)
    trunk = r.material('trunk', '#9b6a43', rough=0.6)
    pot = r.plastic('pot', r.RED, rough=0.35)
    gold = r.metal('gold', '#ffcf4a', rough=0.18)
    tiers = ((0.0, 0.5, 0.42), (0.3, 0.4, 0.38), (0.56, 0.3, 0.34))
    for i, (z, radius, height) in enumerate(tiers):
        base = 0.42 + z
        r.lathe(f'Tier{i}', [(0.0, base), (radius, base), (radius * 0.97, base + 0.04), (0.0, base + height)], mat=needles, subdiv=1)
    r.cylinder('Trunk', 0.07, 0.2, (0, 0, 0.36), mat=trunk)
    r.lathe('Pot', [(0.0, 0.0), (0.2, 0.0), (0.25, 0.3), (0.27, 0.32), (0.0, 0.32)], mat=pot, subdiv=1)
    star = [(math.cos(math.radians(90 + 36 * i)) * (0.13 if i % 2 == 0 else 0.055),
             math.sin(math.radians(90 + 36 * i)) * (0.13 if i % 2 == 0 else 0.055)) for i in range(10)]
    r.shape('Star', star, 0.05, (0, 0, 1.38), mat=gold, bevel=0.015)
    colours = (r.BLUE, r.RED, r.PURPLE, r.YELLOW, r.BLUE, r.PURPLE, r.RED)
    spots = ((0.3, -0.33, 0.5), (-0.32, -0.28, 0.52), (0.05, -0.42, 0.55), (0.2, -0.27, 0.82), (-0.22, -0.24, 0.8),
             (0.0, -0.24, 1.08), (0.24, 0.1, 0.58))
    for i, (x, y, zz) in enumerate(spots):
        r.sphere(f'Bauble{i}', 0.055, (x, y, zz), mat=r.plastic(f'bauble{i}', colours[i], rough=0.12, coat=1.0))
    garland = []
    for i in range(40):
        t = i / 39
        a = math.radians(-120 + t * 720)
        radius = 0.47 - t * 0.33
        garland.append((radius * math.cos(a), radius * math.sin(a), 0.48 + t * 0.66))
    r.tube('Garland', garland, 0.012, gold)
