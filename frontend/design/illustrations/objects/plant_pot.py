"""Potted plant: glossy white pot with a green band, soil and rounded leaves on stems."""
import math

CAMERA = {'azimuth': -20, 'elevation': 14}
VIVID = True

LEAVES = ((0, 0.72, 0, 0.22), (60, 0.6, 35, 0.18), (140, 0.66, 30, 0.2), (210, 0.56, 40, 0.17), (290, 0.62, 32, 0.19),
          (100, 0.84, 12, 0.16), (330, 0.8, 15, 0.15))


def build(r):
    pot = r.plastic('pot', '#f6f7fa', rough=0.22, coat=0.6)
    band = r.plastic('band', r.GREEN, rough=0.3, coat=0.5)
    soil = r.material('soil', '#5a3f2e', rough=0.95, bump=0.8, bump_scale=200)
    leaf = r.material('leaf', '#29c262', rough=0.35, coat=0.3)
    stem = r.material('stem', '#1e9e4e', rough=0.5)

    r.lathe('Pot', [(0.0, 0.0), (0.22, 0.0), (0.24, 0.02), (0.3, 0.4), (0.33, 0.42), (0.33, 0.46), (0.28, 0.46),
                    (0.27, 0.42), (0.0, 0.38)], mat=pot, subdiv=1)
    r.cylinder('Band', 0.322, 0.06, (0, 0, 0.36), mat=band, radius2=0.33, bevel=0.01)
    r.cylinder('Soil', 0.28, 0.03, (0, 0, 0.42), mat=soil)
    for i, (az, z, tilt, size) in enumerate(LEAVES):
        a = math.radians(az)
        reach = 0.22 * math.sin(math.radians(tilt)) + 0.04
        tip = (reach * math.cos(a), reach * math.sin(a), z)
        r.tube(f'Stem{i}', [(0, 0, 0.42), (tip[0] * 0.5, tip[1] * 0.5, (0.42 + z) / 2), tip], 0.012, stem)
        r.sphere(f'Leaf{i}', size, (tip[0] + size * 0.6 * math.cos(a) * math.sin(math.radians(tilt)), tip[1] + size * 0.6 * math.sin(a) * math.sin(math.radians(tilt)), z + size * 0.6),
                 scale=(0.62, 0.16, 1), rotation=(0, -tilt if tilt else 0, az + 90), mat=leaf)
