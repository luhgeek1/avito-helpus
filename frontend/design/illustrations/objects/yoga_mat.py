"""Half-unrolled purple yoga mat with a strap, spiral end and a blue foam block (yoga, health)."""
import math

CAMERA = {'azimuth': -32, 'elevation': 22}


def build(r):
    mat = r.material('mat', r.PURPLE, rough=0.6, bump=0.15, bump_scale=300)
    edge = r.material('edge', '#c6a6ff', rough=0.6)
    strap = r.fabric('strap', '#2b2f36', bump=0.25)
    block = r.material('block', r.BLUE, rough=0.7, bump=0.25, bump_scale=200)

    r.cylinder('Roll', 0.2, 0.9, (0, 0.2, 0.2), (0, 90, 0), mat=mat, bevel=0.02)
    spiral = []
    for i in range(60):
        t = i / 59
        a = t * 4 * 2 * math.pi
        radius = 0.03 + t * 0.15
        spiral.append((0.452, 0.2 + radius * math.cos(a), 0.2 + radius * math.sin(a)))
    r.tube('Spiral', spiral, 0.006, edge)
    r.box('Flat', (0.9, 0.62, 0.025), (0, -0.2, 0.0125), mat=mat, bevel=0.01, segments=3)
    r.torus('Strap', 0.205, 0.018, (0.24, 0.2, 0.2), (0, 90, 0), mat=strap)
    r.box('Block', (0.36, 0.22, 0.14), (0.62, -0.18, 0.07), (0, 0, -12), mat=block, bevel=0.04, segments=6)
